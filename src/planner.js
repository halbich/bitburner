import {printTable} from "src/utils/table.js"
import {formatMoney, progressBar} from "src/utils/utils.js"
import {loadRunners} from "src/models/runnerData.js"
import {loadTargets} from "src/models/targetData.js"
import {initServer, runJob, TargetsStates, TargetStatesEnum} from "src/models/targetState.js"
import {ActionsEnum} from "src/utils/constants"

/** @param {NS} ns */
export async function main(ns) {
    const ar = ns.args[0] ?? ""
    const continuous = ar.includes("c")
    const lfn = continuous
        ? ns.print
        : ns.tprint

    for (const muted of mutedFunctions) {
        ns.disableLog(muted)
    }
    do {
        ns.clearLog()
        const start = Date.now()
        lfn(`Current iteration: ${new Date().toTimeString()}`)

        const states = new TargetsStates(ns, lfn)
        const runners = loadRunners(ns, lfn)
        const targets = loadTargets(ns, states, lfn)

        lfn(`load ${Date.now() - start} ms`)

        processJobs(ns, runners, targets, lfn)

        lfn(`process ${Date.now() - start} ms`)
        //printTable(lfn, runners, getRunnerStringData)
        printTable(lfn, targets, getTargetStringData)

        const length = Date.now() - start
        lfn(`Iteration done in ${length} ms`)
        if (continuous) {
            await ns.sleep(Math.max(20, iterationLength - length))
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
 */
function fillRunners(availableRunners, ns, jobParams) {

    const {
        allowSplit,
        threads,
        target,
        action,
        delay,
        amount,
        duration,
    } = jobParams

    let remainingThreadsToFill = threads
    while (availableRunners.length && remainingThreadsToFill) {
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
                expectedAmount: amount,
                expectedDuration: duration,
            })
            remainingThreadsToFill -= remainingThreadsToFill
        } else if (allowSplit) {
            runWork(ns, runner, {
                threads: runner.threadsAvailable,
                target,
                action,
                delay,
                expectedAmount: amount,
                expectedDuration: duration,
            })
            remainingThreadsToFill -= runner.threadsAvailable
        }

        if (runner.threadsAvailable) {
            availableRunners.unshift(runner)
        }

    }
}

/**
 * @param {NS} ns
 * @param {RunnerData[]} runners
 * @param {TargetData[]} targets
 * @param {(...args: any[]) => void} lfn
 */
function processJobs(ns, runners, targets, lfn) {
    const availableRunners = Array.from(runners)
    if (!availableRunners.length || !targets.length) {
        return
    }

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
        return item.threadsAvailable
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
                batchingTargets.push(item)
                break
            }
            default: {
                if (!state.isRunning) {
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
            fillRunners(availableRunners, ns, {
                allowSplit: true,
                threads: threadsToWeakenGrow,
                target: target.server,
                action: ActionsEnum.Weaken,
                amount: ns.weakenAnalyze(threadsToWeakenGrow),
                duration: Math.ceil(ns.getWeakenTime(target.server)),
            })
        } else if (target.currentMoney < target.maxMoney) {
            const expectedAmount = Math.ceil(target.maxMoney / Math.max(1, target.currentMoney)) // it should be 2, better safe than sorry
            let threadsToGrow = Math.ceil(ns.growthAnalyze(target.server, expectedAmount))
            fillRunners(availableRunners, ns, {
                allowSplit: true,
                threads: threadsToGrow,
                target: target.server,
                action: ActionsEnum.Grow,
                amount: expectedAmount,
                duration: Math.ceil(ns.getGrowTime(target.server)),
            })
        } else {
            let threadsToHack = Math.floor(ns.hackAnalyzeThreads(target.server, target.maxMoney * 0.5))
            fillRunners(availableRunners, ns, {
                allowSplit: true,
                threads: threadsToHack,
                target: target.server,
                action: ActionsEnum.Hack,
                amount: target.maxMoney * 0.5,
                duration: Math.ceil(ns.getHackTime(target.server)),
            })
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

    while (batchingTargets.length && remainingAvailable > 0) {
        const target = batchingTargets.shift()
        const state = target.targetState
        if (state.totalThreads > remainingAvailable) {
            continue
        }
        remainingAvailable -= state.totalThreads

        fillRunners(availableRunners, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.Hack,
            ...state.hack,
        })
        fillRunners(availableRunners, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.Weaken,
            ...state.weakenHack,
        })
        fillRunners(availableRunners, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.Grow,
            ...state.grow,
        })
        fillRunners(availableRunners, ns, {
            allowSplit: false,
            target: target.server,
            action: ActionsEnum.Weaken,
            ...state.weakenGrow,
        })
    }
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
 *     expectedAmount: number|undefined;
 *     expectedDuration: number | undefined;
 * }} job
 */
function runWork(ns, runner, job) {

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
    ]

    if (job.delay) {
        params.push(...[
            "--delay",
            job.delay,
        ])
    }

    if (job.expectedAmount) {
        params.push(...[
            "--expectedAmount",
            job.expectedAmount,
        ])

    }

    if (job.expectedDuration) {
        params.push(...[
            "--expectedDuration",
            job.expectedDuration,
        ])

    }

    if (ns.exec(hackScript, runner.server, job.threads, ...params)) {
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
            ? target.targetState.state
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

const hackScript = "/src/run.js"

const mutedFunctions = [
    "getServerRequiredHackingLevel",
    "getHackingLevel",
    "scan",
    "getServerMaxRam",
    "getServerMaxMoney",
    "scp",
    "sleep",
    "getServerMoneyAvailable",
    "getServerSecurityLevel",
    "getServerMinSecurityLevel",
    "exec",
    "getServerUsedRam",
]

const iterationLength = 1000
