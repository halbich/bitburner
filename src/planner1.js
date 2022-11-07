import {printTable} from "src/utils/table.js"
import {formatMoney, progressBar} from "src/utils/utils.js"
import {loadRunners} from "src/models/runnerData.js"
import {loadTargets} from "src/models/targetData.js"
import {initServer, recomputeServer, runJob, TargetsStates, TargetStatesEnum} from "src/models/targetState.js"
import {ActionsEnum, Files, IterationLength, IterationOffset} from "src/utils/constants"
import {getNextSleepForSlot1} from "src/utils/slots"

/** @param {NS} ns */
export async function main(ns) {
    const ar = ns.args[0] ?? ""
    const continuous = ar.includes("c")
    const lfn = continuous
        ? ns.print
        : ns.tprint

    ns.disableLog("ALL")
    do {

        ns.clearLog()
        const start = Date.now()
        const act = start % IterationOffset
        const iteration = Math.floor(start / IterationOffset)
        lfn(act)

        lfn(`Current iteration: ${new Date().toTimeString()} ${iteration}`)

        const states = new TargetsStates(ns, lfn)
        const runners = loadRunners(ns, lfn)
        const targets = loadTargets(ns, states, lfn)

        lfn(`load ${Date.now() - start} ms`)

        const display = targets.filter((item) => {
                return forceServers.includes(item.server)
            },
        )

        processJobs(ns, runners, display, iteration, lfn)

        lfn(`process ${Date.now() - start} ms`)
        //printTable(lfn, runners, getRunnerStringData)
        printTable(lfn, display, getTargetStringData)

        const length = Date.now() - start
        lfn(`Iteration done in ${length} ms`)
        if (continuous) {
            const sleepTime = Math.max(20, IterationOffset - length)
            lfn(`Sleep ${sleepTime}`)
            await ns.sleep(sleepTime)
        }
    } while (continuous)
}

/**
 * @param {RunnerData[]} availableRunners
 * @param {NS} ns
 * @param {{
 * allowSplit: boolean;
 * threads:number;
 * target: string;
 * action: string;
 * delay: number | undefined;
 * amount: number | undefined;
 * duration: number | undefined;
 * }} jobParams
 * @param {number} iteration
 * @param {function(...[*]): void} lfn
 */
function fillRunners(availableRunners, ns, jobParams, iteration, lfn) {

    const {
        allowSplit,
        threads,
        target,
        action,
        delay,
        amount,
        duration,
    } = jobParams

    const start = Date.now()
    let remainingThreadsToFill = threads
    let i = availableRunners.length
    while (availableRunners.length && remainingThreadsToFill && i) {
        i--
        const runner = availableRunners.shift()
        if (!runner.threadsAvailable) {
            continue
        }

        if (runner.threadsAvailable >= remainingThreadsToFill) {
            runWork(ns, runner, {
                threads: remainingThreadsToFill,
                target,
                action,
                delay,
                amount,
                duration,
            }, iteration)
            remainingThreadsToFill -= remainingThreadsToFill
        } else if (allowSplit) {
            runWork(ns, runner, {
                threads: runner.threadsAvailable,
                target,
                action,
                delay,
                amount,
                duration,
            }, iteration)
            remainingThreadsToFill -= runner.threadsAvailable
        }

        if (runner.threadsAvailable) {
            availableRunners.unshift(runner)
        }

    }

    //lfn(`fill runners done in ${Date.now() - start} ms`)
}

/**
 * @param {NS} ns
 * @param {RunnerData[]} runners
 * @param {TargetData[]} targets
 * @param {number} iteration
 * @param {(...args: any[]) => void} lfn
 */
function processJobs(ns, runners, targets, iteration, lfn) {
    const availableRunners = Array.from(runners)
    if (!availableRunners.length || !targets.length) {
        return
    }
    const start = Date.now()

    availableRunners.sort((a, b) => {
        if (a.threadsAvailable > b.threadsAvailable) {
            return -1
        } else if (a.threadsAvailable < b.threadsAvailable) {
            return 1
        } else {
            return 0
        }
    })

    const available = availableRunners.filter((item) => {
        return item.threadsAvailable && item.server !== "home"
    })

    const totalAvailable = available.reduce((partial, a) => {
        return partial + a.threadsAvailable
    }, 0)

    /** @type {TargetData[]} */
    const batchingTargets = []
    /** @type {TargetData[]} */
    const initTargets = []

    targets.forEach((item) => {
        const state = item.targetState
        if (!state) {
            initServer(ns, item.server)
            return
        }

        switch (state.state) {
            case TargetStatesEnum.Batching: {
                if (item.minSecurity === item.currentSecurity && item.currentMoney === item.maxMoney) {
                    ns.tprint(item.canStartBatch());
                    if (item.canStartBatch()) {
                        batchingTargets.push(item)
                    }
                } else if (!state.runningJobs) {
                    initTargets.push(item)
                }
                break
            }
            default: {
                if (!state.runningJobs) {
                    initTargets.push(item)
                }
                break
            }

        }
    })

    let remainingAvailable = totalAvailable
    while (initTargets.length && remainingAvailable > 0) {
        const target = initTargets.shift()
        if (target.currentSecurity > target.minSecurity) {
            let threadsToWeakenGrow = 0
            while (target.currentSecurity - ns.weakenAnalyze(threadsToWeakenGrow) > target.minSecurity) {
                threadsToWeakenGrow++
            }
            fillRunners(available, ns, {
                allowSplit: true,
                threads: threadsToWeakenGrow,
                target: target.server,
                action: ActionsEnum.WeakenGrow,
                amount: ns.weakenAnalyze(threadsToWeakenGrow),
                duration: Math.ceil(ns.getWeakenTime(target.server)),
            }, iteration, lfn)
        } else if (target.currentMoney < target.maxMoney) {
            const expectedAmount = Math.ceil(target.maxMoney / Math.max(1, target.currentMoney)) // it should be 2, better safe than sorry
            let threadsToGrow = Math.ceil(ns.growthAnalyze(target.server, expectedAmount))
            fillRunners(available, ns, {
                allowSplit: true,
                threads: threadsToGrow,
                target: target.server,
                action: ActionsEnum.Grow,
                amount: expectedAmount,
                duration: Math.ceil(ns.getGrowTime(target.server)),
            }, iteration, lfn)
        } else {
            lfn("recompute " + target.server)
            recomputeServer(ns, target.server)
        }
    }

    batchingTargets.sort((a, b) => {
        const ha = a.targetState
        const hb = b.targetState

        if (ha.expectedRevenue > hb.expectedRevenue) {
            return -1
        } else if (ha.expectedRevenue < hb.expectedRevenue) {
            return 1
        } else {
            return 0
        }
    })

    lfn(`batching sorted ${Date.now() - start} ms`)

    while (batchingTargets.length && remainingAvailable > 0) {
        const target = batchingTargets.shift()
        const state = target.targetState
        if (state.totalThreads > remainingAvailable) {
            continue
        }
        remainingAvailable -= state.totalThreads

        fillRunners(available, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.Hack,
            ...state.hack,
        }, iteration, lfn)
        fillRunners(available, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.WeakenHack,
            ...state.weakenHack,
        }, iteration, lfn)
        fillRunners(available, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.Grow,
            ...state.grow,
        }, iteration, lfn)
        fillRunners(available, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.WeakenGrow,
            ...state.weakenGrow,
        }, iteration, lfn)
    }
    lfn(`done ${Date.now() - start} ms`)
}

/**
 * @param {TargetJobData} source
 * @param {number} slotId
 */
function updateDelay(source, slotId) {
    source.delay = getNextSleepForSlot(slotId, source.delay + source.duration) - source.duration
}

/**
 *
 * @param {NS} ns
 * @param {RunnerData} runner
 * @param {{
 *     threads: number;
 *     target: string;
 *     action: string;
 *     delay: number|undefined;
 *     amount: number|undefined;
 *     duration: number | undefined;
 * }} job
 * @param {number} iteration
 */
function runWork(ns, runner, job, iteration) {
    if (!job.threads || job.threads < 1) {
        return
    }

    const params = [
        "--threads",
        job.threads,
        "--target",
        job.target,
        "--action",
        job.action,
        "--id",
        iteration,
    ]

    if (job.delay) {
        params.push(...[
            "--delay",
            job.delay,
        ])
    }

    if (job.amount) {
        params.push(...[
            "--amount",
            job.amount,
        ])

    }

    if (job.duration) {
        params.push(...[
            "--duration",
            job.duration,
        ])

    }

    if (ns.exec(Files.HackScript, runner.server, job.threads, ...params)) {
        runner.reserveThreads(job.threads)
        runJob(ns, job.target, job.action)
    }
}

/**
 *
 * @param {RunnerData}runner
 * @returns {string[]}
 */
function getRunnerStringData(runner) {
    if (!runner) {
        return [
            "Server",
            "Threads available",
            "Reserved",
        ]
    }
    return [
        runner.server,
        runner.threadsAvailable,
        runner.reservedThreads,
    ]
}

/**
 *
 * @param {TargetData} target
 * @returns {string[]}
 */
function getTargetStringData(target) {
    if (!target) {
        return [
            "Server",
            "Money",
            "Security",
            "State",
        ]
    }

    return [
        target.server,
        progressBar({
            min: 0,
            max: target.maxMoney,
            current: target.currentMoney,
            size: 5,
        }),
        progressBar({
            min: target.minSecurity,
            max: target.minSecurity + 5,
            current: target.currentSecurity,
            size: 5,
        }),
        target.targetState
            ? `${target.targetState.state}, ${target.targetState.runningJobs}`
            : "",

    ]
}

function toMinutes(sec) {
    const minutes = Math.floor(sec / 60.0)
    const seconds = sec % 60.0
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function getUpdateProgressBar(max, current, size) {
    return (server, lfn) => {
        if (server == null) {
            return null
        }
        return [
            progressBar({
                min: 0,
                max,
                current,
                size,
            }),
        ]

    }
}

const forceServers = [
    "n00dles",
    "joesguns",
]
