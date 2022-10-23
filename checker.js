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

        printTable(lfn, runners, getRunnerStringData)
        printTable(lfn, targets, getTargetStringData)
        await jobs.saveJobState(ns, lfn)
        if (continuous) {
            await ns.sleep(1000)
        }
    } while (continuous)
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
            "Actions",
        ]
    }
    const jobs = [...target.jobs]
    jobs.sort((a, b) => {
        if (a.end < b.end) {
            return -1
        } else if (a.end > b.end) {
            return 1
        } else {
            return 0
        }
    })
    const jobsStr = []

    if (jobs.length > 0) {

        jobsStr.push(jobs[0].action)
        jobsStr.push(jobs[0].end - Date.now())

        for (let i = 1; i < jobs.length; i++) {
            jobsStr.push(jobs[i].action)
            jobsStr.push(jobs[i].end - jobs[i - 1].end)
        }
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
        `${jobsStr.join(", ")}`,
    ]
}

function toMinutes(sec) {
    const minutes = Math.floor(sec / 60.0)
    const seconds = sec % 60.0
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

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

const stealingPercent = 0.5
