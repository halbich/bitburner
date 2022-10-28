import {printTable} from "src/utils/table.js"
import {formatMoney, progressBar} from "src/utils/utils.js"
import {loadRunners} from "src/models/runnerData.js"
import {loadTargets} from "src/models/targetData.js"

class WorkerJobState{

}

/** @param {NS} ns */
export async function main(ns) {
    const lfn = ns.print

    for (const muted of mutedFunctions) {
        ns.disableLog(muted)
    }
    const port = ns.getPortHandle(notificationPort)

    while (true) {
        ns.clearLog()
        const start = Date.now()
        lfn(`Current iteration: ${new Date().toTimeString()}`)

        if (!port.empty()) {

            /* const targets = loadTargets(ns, jobs, lfn)

           /*printTable(lfn, runners, getRunnerStringData)
             printTable(lfn, targets, getTargetStringData)*/
        }
        lfn(`Iteration done in ${Date.now() - start} ms`)

        await ns.sleep(20)
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
]

const notificationPort = 1
