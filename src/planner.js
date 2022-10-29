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
 * @param {({server: string, threadsToWeaken: number, timeToWeaken: number, growthThreads: number, timeToGrow: number, growthThreadsRemaining: number}|null)[]} needFill
 * @param {RunnerData[]} availableRunners
 * @param {NS} ns
 * @param {number} now
 */
function tryFillWeaken(needFill, availableRunners, ns, now) {
    const needWeaken = needFill.filter((item) => {
        return item && item.threadsToWeaken > 0
    }).sort((a, b) => {
        if (a.threadsToWeaken * a.timeToWeaken < b.threadsToWeaken * b.timeToWeaken) {
            return -1
        } else if (a.threadsToWeaken * a.timeToWeaken > b.threadsToWeaken * b.timeToWeaken) {
            return 1
        } else {
            return 0
        }
    })
    while (needWeaken.length) {
        const weaken = needWeaken.shift()
        fillRunners(availableRunners, ns, {
            allowSplit: true,
            threads: weaken.threadsToWeaken,
            target: weaken.server,
            action: ActionsEnum.Weaken,
            expectedDuration: weaken.timeToWeaken,
        })
    }
}

/**
 * @param {({server: string, threadsToWeaken: number, timeToWeaken: number, growthThreads: number, timeToGrow: number, growthThreadsRemaining: number}|null)[]} needFill
 * @param {RunnerData[]} availableRunners
 * @param {NS} ns
 * @param {number} now
 */
function tryFillGrow(needFill, availableRunners, ns, now) {
    const needGrow = needFill.filter((item) => {
        return item && item.growthThreads > 0
    }).sort((a, b) => {
        if (a.growthThreads * a.timeToGrow < b.growthThreads * b.timeToGrow) {
            return -1
        } else if (a.growthThreads * a.timeToGrow > b.growthThreads * b.timeToGrow) {
            return 1
        } else {
            return 0
        }
    })
    while (needGrow.length) {
        const weaken = needGrow.shift()
        fillRunners(availableRunners, ns, {
            allowSplit: true,
            threads: weaken.growthThreads,
            target: weaken.server,
            action: ActionsEnum.Grow,
            expectedDuration: weaken.timeToGrow,
        })
    }
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
 * expectedAmount: number | undefined;
 * expectedDuration: number | undefined;
 * }} jobParams
 */
function fillRunners(availableRunners, ns, jobParams) {

    const {
        allowSplit,
        threads,
        target,
        action,
        delay,
        expectedAmount,
        expectedDuration,
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
                expectedAmount,
                expectedDuration,
            })
            remainingThreadsToFill -= remainingThreadsToFill
        } else if (allowSplit) {
            runWork(ns, runner, {
                threads: runner.threadsAvailable,
                target,
                action,
                delay,
                expectedAmount,
                expectedDuration,
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
                expectedAmount: ns.weakenAnalyze(threadsToWeakenGrow),
                expectedDuration: ns.getWeakenTime(target.server),
            })
        } else if (target.currentMoney < target.maxMoney) {
            let threadsToGrow = Math.ceil(ns.growthAnalyze(target.server, target.maxMoney / Math.max(1, target.currentMoney)))
            fillRunners(availableRunners, ns, {
                allowSplit: true,
                threads: threadsToGrow,
                target: target.server,
                action: ActionsEnum.Grow,
                expectedAmount: target.maxMoney - target.currentMoney,
                expectedDuration: ns.getGrowTime(target.server),
            })
        } else {
            let threadsToHack = Math.floor(ns.hackAnalyzeThreads(target.server, target.maxMoney * 0.5))
            fillRunners(availableRunners, ns, {
                allowSplit: true,
                threads: threadsToHack,
                target: target.server,
                action: ActionsEnum.Hack,
                expectedAmount: target.maxMoney * 0.5,
                expectedDuration: ns.getHackTime(target.server),
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
        const times = computeBatch(target, lfn)

        fillRunners(availableRunners, ns, {
            allowSplit: false,
            threads: state.hack.threads,
            target: target.server,
            action: ActionsEnum.Hack,
            delay: times[0][0],
            expectedAmount: state.hack.amount,
            expectedDuration: state.hack.duration,
        })
        fillRunners(availableRunners, ns, {
            allowSplit: false,
            threads: state.weakenHack.threads,
            target: target.server,
            action: ActionsEnum.Weaken,
            delay: times[1][0],
            expectedAmount: state.weakenHack.amount,
            expectedDuration: state.weakenHack.duration,
        })
        fillRunners(availableRunners, ns, {
            allowSplit: false,
            threads: state.grow.threads,
            target: target.server,
            action: ActionsEnum.Grow,
            delay: times[2][0],
            expectedAmount: state.grow.amount,
            expectedDuration: state.grow.duration,
        })
        fillRunners(availableRunners, ns, {
            allowSplit: false,
            threads: state.weakenGrow.threads,
            target: target.server,
            action: ActionsEnum.Weaken,
            delay: times[3][0],
            expectedAmount: state.weakenGrow.amount,
            expectedDuration: state.weakenGrow.duration,
        })
    }

    /*
        const needFill = targets.map((item) => {
            return item.getUpgradeStats()
        }).filter((item) => {
            return item && (item.threadsToWeaken > 0 || item.growthThreads > 0)
        })

        tryFillWeaken(needFill, availableRunners, ns, now)
        tryFillGrow(needFill, availableRunners, ns, now)*/
}

/**
 *
 * @param {TargetData} target
 * @param {(...args: any[]) => void} lfn
 */
function computeBatch(target, lfn) {
    const hacks = target.targetState
    const times = [
        [
            hacks.weakenHack.duration - 3 * scriptOffset - hacks.hack.duration,
            hacks.weakenHack.duration - 3 * scriptOffset,
        ],
        [
            hacks.weakenHack.duration - 2 * scriptOffset - hacks.weakenHack.duration,
            hacks.weakenHack.duration - 2 * scriptOffset,
        ],
        [
            hacks.weakenHack.duration - scriptOffset - hacks.grow.duration,
            hacks.weakenHack.duration - scriptOffset,
        ],
        [
            0,
            hacks.weakenGrow.duration,
        ],
    ]

    const offset = Math.min(times[0][0], times[1][0], times[2][0], times[3][0])
    for (let i = 0; i < times.length; i++) {
        times[i][0] -= offset
        times[i][1] -= offset
    }
    return times
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

const scriptOffset = 250
const iterationLength = 1000
