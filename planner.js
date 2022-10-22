import {printTable} from "src/utils/table.js"
import {formatMoney, progressBar} from "src/utils/utils.js"
import {loadRunners} from "src/runnerData.js"
import {loadTargets} from "src/targetData.js"
import {WorkCache, WorkJob} from "src/workCache.js"

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

        lfn(`Current iteration: ${new Date().toTimeString()}`)
        const jobs = new WorkCache(ns, lfn)
        const runners = loadRunners(ns, lfn)
        const targets = loadTargets(ns, jobs, lfn)

        processJobs(ns, runners, targets, jobs, lfn)

        //printTable(lfn, runners, getRunnerStringData)
        printTable(lfn, targets, getTargetStringData)
        await jobs.saveJobState(ns, lfn)
        if (continuous) {
            await ns.sleep(1000)
        }
    } while (continuous)
}

/**
 * @param {({server: string, threadsToWeaken: number, timeToWeaken: number, growthThreads: number, timeToGrow: number, growthThreadsRemaining: number}|null)[]} needFill
 * @param {RunnerData[]} availableRunners
 * @param {NS} ns
 * @param {WorkCache} jobs
 */
function tryFillWeaken(needFill, availableRunners, ns, jobs) {
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
        fillRunners(availableRunners, ns, jobs, {
            threadsToFill: weaken.threadsToWeaken,
            target: weaken.server,
            action: "weaken",
            jobTime: weaken.timeToWeaken,
        })
    }
}

/**
 * @param {({server: string, threadsToWeaken: number, timeToWeaken: number, growthThreads: number, timeToGrow: number, growthThreadsRemaining: number}|null)[]} needFill
 * @param {RunnerData[]} availableRunners
 * @param {NS} ns
 * @param {WorkCache} jobs
 */
function tryFillGrow(needFill, availableRunners, ns, jobs) {
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
        fillRunners(availableRunners, ns, jobs, {
            threadsToFill: weaken.growthThreads,
            target: weaken.server,
            action: "grow",
            jobTime: weaken.timeToGrow,
        })
    }
}

/**
 * @param {RunnerData[]} availableRunners
 * @param {NS} ns
 * @param {WorkCache} jobs
 * @param {{
 * threadsToFill:number;
 * target: string;
 * action: string;
 * jobTime: number;
 * }}
 */
function fillRunners(availableRunners, ns, jobs, {
    threadsToFill,
    target,
    action,
    jobTime,
}) {

    let remainingThreadsToFill = threadsToFill
    while (availableRunners.length && remainingThreadsToFill) {
        const runner = availableRunners.shift()
        if (!runner.threadsAvailable) {
            continue
        }

        if (runner.threadsAvailable >= remainingThreadsToFill) {
            const job = new WorkJob({
                runner: runner.server,
                target,
                action,
                threads: remainingThreadsToFill,
                start: Date.now(),
                end: Date.now() + jobTime + scriptOffset,
            })
            runWork(ns, runner, job, jobs)
            remainingThreadsToFill -= job.threads
        } else {
            const job = new WorkJob({
                runner: runner.server,
                target,
                action,
                threads: runner.threadsAvailable,
                start: Date.now(),
                end: Date.now() + jobTime + scriptOffset,
            })
            runWork(ns, runner, job, jobs)
            remainingThreadsToFill -= job.threads
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
 * @param {WorkCache} jobs
 * @param {(...args: any[]) => void} lfn
 */
function processJobs(ns, runners, targets, jobs, lfn) {
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

    const needFill = targets.map((item) => {
        return item.getUpgradeStats()
    }).filter((item) => {
        return item && (item.threadsToWeaken > 0 || item.growthThreads > 0)
    })

    tryFillWeaken(needFill, availableRunners, ns, jobs)
    tryFillGrow(needFill, availableRunners, ns, jobs)

    const available = availableRunners.filter((item) => {
        return item.threadsAvailable
    })

    const totalAvailable = available.reduce((partial, a) => {
        return partial + a.threadsAvailable
    }, 0)

    const batchTargets = targets.filter((item) => {
        const upgrade = item.getUpgradeStats()
        if (upgrade) {
            item.note = "upgrading"
            return false
        }
        if (item.jobs.length > 0) {
            item.note = "batching"
        }

        const hacks = item.getHackStats(stealingPercent)
        if (hacks.totalThreads > totalAvailable) {
            item.note = item.note ?? "not Enough RAM"
            return
        }
        return item
    }).sort((a, b) => {
        const ha = a.getHackStats(stealingPercent)
        const hb = b.getHackStats(stealingPercent)

        if (ha.expectedRevenue > hb.expectedRevenue) {
            return -1
        } else if (ha.expectedRevenue < hb.expectedRevenue) {
            return 1
        } else {
            return 0
        }
    })

    let remainingAvailable = totalAvailable
    while (batchTargets.length && remainingAvailable > 0) {
        const target = batchTargets.shift()
        const hacks = target.getHackStats(stealingPercent)
        if (hacks.totalThreads > remainingAvailable) {
            target.note = target.note ?? "not Enough RAM"
            continue
        }
        remainingAvailable -= hacks.totalThreads
        const times = computeBatch(target, lfn)
        for (const time of times) {
            lfn(time)
        }

        lfn(available)
    }

    while (batchTargets.length) {
        const target = batchTargets.shift()
        target.note = target.note ?? "not Enough RAM"
    }
}

/**
 *
 * @param {TargetData} target
 * @param {(...args: any[]) => void} lfn
 */
function computeBatch(target, lfn) {
    target.note = "batching"
    const hacks = target.getHackStats(stealingPercent)
    lfn(hacks)
    const times = [
        [
            hacks.weakenTime - 3 * scriptOffset - hacks.hackTime,
            hacks.weakenTime - 3 * scriptOffset,
        ],
        [
            hacks.weakenTime - 2 * scriptOffset - hacks.weakenTime,
            hacks.weakenTime - 2 * scriptOffset,
        ],
        [
            hacks.weakenTime - scriptOffset - hacks.growTime,
            hacks.weakenTime - scriptOffset,
        ],
        [
            0,
            hacks.weakenTime,
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
 * @param {WorkJob} job
 * @param {WorkCache} jobs
 * @returns {WorkJob|null}
 */
function runWork(ns, runner, job, jobs) {

    if (!job.threads || job.threads < 1) {
        return null
    }

    const params = ["--threads", job.threads, "--target", job.target, "--action", job.action]

    if (!ns.exec(hackScript, runner.server, job.threads, ...params)) {
        return null
    }
    runner.reserveThreads(job.threads)
    jobs.addJobs([job])
    return job
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
            "ag",
            "aW",
            "aH",
            "note",
            "jobs",
            "rem",
            "hack",
        ]
    }
    const hack = target.getHackStats(stealingPercent)
    const remainingSeconds = target.jobs.length > 0
        ? Math.floor((target.jobs[0].end - Date.now()) / 1000.0)
        : -1
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
        target.allocatedGrowThreads,
        target.allocatedWeakenThreads,
        target.allocatedHackThreads,
        target.note ?? "",
        target.jobs.length > 0
            ? progressBar({
                min: target.jobs[0].start,
                max: target.jobs[0].end,
                current: Date.now(),
                size: 5,
            })
            : "",
        remainingSeconds > 0
            ? toMinutes(remainingSeconds)
            : "",
        "",
        //`${hack.totalThreads} ${hack.hackThreads} ${hack.threadsToWeakenHack} ${hack.growthThreads} ${hack.threadsToWeakenGrow}  ${formatMoney(hack.hackAmount)}`,
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

const hackScript = "run.js"

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
]

const stealingPercent = 0.1
const scriptOffset = 100
