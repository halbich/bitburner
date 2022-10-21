import {printTable} from "src/utils/table.js"
import {formatMoney, progressBar} from "src/utils/utils.js"
import {loadRunners} from "src/plannerRunnerData.js"

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

    loadJobState(ns, lfn)

    do {
        ns.clearLog()

        lfn(`Current iteration: ${new Date().toTimeString()}, ${workCache.length}`)
        const runners = loadRunners(ns, lfn)
      /*  const computedActions = computeData(ns, servers, lfn)
        computedActions.sort((a, b) => {
            if (a.maxMoney > 0 && b.maxMoney > 0) {
                return 0
            } else if (a.maxMoney > 0) {
                return -1
            } else {
                return 1
            }
        })*/
        /*        printTable(lfn, computedActions, getServerStringData, {
                    padLeftColumns: [
                        0,
                        5,
                        6,
                    ],
                })*/
        printTable(lfn, runners, getRunnerStringData)
        await saveJobState(ns, lfn)
        if (continuous) {
            await ns.sleep(1000)
        }
    } while (continuous)
}

/**
 * @param {NS} ns
 * @param {PlannerServerData[]} servers
 * @param {(...args: any[]) => void} lfn
 * @returns {{
 * 	server: string;
 *  threads: number;
 * 	maxMoney: number;
 * 	currentMoney: number;
 *  hackChance: number;
 *  securityLevel: number;
 *  minSecurityLevel: number;
 *  action: string;
 *  growTime: number;
 *  weakenTime: number;
 *  hackTime: number;
 *  reqGrowThreads: number;
 *  allocatedGrowThreads: number;
 *  allocatedWeakenThreads: number;
 *  allocatedHackThreads: number;
 *  available: boolean;
 * }[]}
 */
function computeData(ns, servers, lfn) {
    const result = []

    for (const server of servers) {
        const name = server.server
        const r = {
            server: name,
            maxMoney: ns.getServerMaxMoney(name),
            currentMoney: ns.getServerMoneyAvailable(name),
            hackChance: ns.hackAnalyzeChance(name),
            securityLevel: ns.getServerSecurityLevel(name),
            minSecurityLevel: ns.getServerMinSecurityLevel(name),
            action: null,

            growTime: ns.getGrowTime(name),
            weakenTime: ns.getWeakenTime(name),
            hackTime: ns.getHackTime(name),

            available: !ns.scriptRunning(hackScript, name),

            reqGrowThreads: 0,
            allocatedGrowThreads: 0,
            allocatedWeakenThreads: 0,
            allocatedHackThreads: 0,

            moneyForOneHack: ns.hackAnalyzeChance(name) * ns.hackAnalyze(name) * ns.getServerMoneyAvailable(name),
        }

        const threads = Math.floor(ns.hackAnalyzeThreads(name, Math.floor(ns.getServerMaxMoney(name) * 0.1)))
        const threadsWeaken = threads > 0
            ? ns.hackAnalyzeSecurity(threads, name)
            : 0

        let requiredThreadsToWeaken = 1

        for (let i = 1; i < threads; i++) {

            lfn(`${i}: ${ns.weakenAnalyze(threads)}`)
            if (r.securityLevel - ns.weakenAnalyze(threads) <= r.minSecurityLevel) {
                requiredThreadsToWeaken = i
                break
            }
        }

        const growthPerc = (r.maxMoney - r.currentMoney) / r.currentMoney

        //   const threadsToGrowth =  ns.growthAnalyze(name, growthPerc);
        //    const securityIncrease = ns.growthAnalyzeSecurity(threadsToGrowth, name)

        r.action = `${threads.toFixed(0)} ${threadsWeaken.toFixed((4))} ${requiredThreadsToWeaken.toFixed(4)}`

        r.reqGrowThreads = r.maxMoney > 0
            ? ns.growthAnalyze(name, r.maxMoney / Math.max(1, r.currentMoney))
            : 0
        result.push(r)
    }

    updateSavedActions(result, lfn)

    const availableTargetsMap = new Map()
    const availableTargets = []
    result.forEach((server) => {
        if (server.maxMoney > 0) {
            availableTargets.push(server)
            availableTargetsMap.set(server.server, server)
        }
    })

    const availableRunners = result.filter((server) => {
        return server.available
    }).sort((a, b) => {
        if (a.threads > b.threads) {
            return -1
        } else if (a.threads < b.threads) {
            return 1
        } else {
            return 0
        }
    })

    return result
}

function runWork(ns, runner, action, target) {
    if (!ns.exec(hackScript, runner.server, runner.threads, runner.threads, action, target)) {
        return
    }
    runner.action = `${action} on ${target}`
    const start = Date.now()
    const entry = {
        runner: runner.server,
        target,
        threads: runner.threads,
        action,
        start,
    }

    switch (action) {
        case "weaken":
            entry.end = Math.ceil(entry.start + ns.getWeakenTime(target))
            break
        case "grow":
            entry.end = Math.ceil(entry.start + ns.getGrowTime(target))
            break
        case "hack":
            entry.end = Math.ceil(entry.start + ns.getHackTime(target))
            break
        default: {
            entry.end = entry.start
        }
    }

    workCache.push(entry)
}

function updateSavedActions(computedActions, lfn) {

    const now = Date.now()

    workCache = workCache.filter((item) => {
        return item.end > now
    })

    for (const action of computedActions) {

        const runningJobs = workCache.filter((item) => {
            return item.runner === action.server
        })
        if (runningJobs.length) {
            const job = runningJobs[0]
            action.action = `${job.action} on ${job.target}`
            action.job = job
        }

        const targetJobs = workCache.filter((item) => {
            return item.target === action.server
        })
        action.allocatedGrowThreads = targetJobs.reduce((partial, a) => {
            return partial + (a.action === "grow"
                ? a.threads
                : 0)
        }, 0)
        action.allocatedWeakenThreads = targetJobs.reduce((partial, a) => {
            return partial + (a.action === "weaken"
                ? a.threads
                : 0)
        }, 0)
        action.allocatedHackThreads = targetJobs.reduce((partial, a) => {
            return partial + (a.action === "hack"
                ? a.threads
                : 0)
        }, 0)
    }
}

/**
 * @param {{
 * 	server: string;
 *  threads: number;
 * 	maxMoney: number;
 * 	currentMoney: number;
 *  hackChance: number;
 *  securityLevel: number;
 *  minSecurityLevel: number;
 *  action: string;
 *  growTime: number;
 *  weakenTime: number;
 *  hackTime: number;
 *  reqGrowThreads: number;
 *  allocatedGrowThreads: number;
 *  allocatedWeakenThreads: number;
 *  allocatedHackThreads: number;
 * }} server
 * @returns {string[]}
 */
function getServerStringData(server, lfn) {
    if (!server) {
        return [
            "Host",
            "T",
            /*  "aG",
             "aW",
             "aH",*/
            "Max money",
            "Money",
            "Fill",
            `Sec`,
            "GT",
            "tg",
            "tw",
            "th",
            "Progress",
            "Note",
        ]
    }
    return [
        server.server,
        server.threads.toString(),
        /*   server.maxMoney > 0 && server.allocatedGrowThreads
              ? server.allocatedGrowThreads
              : "",
          server.maxMoney > 0 && server.allocatedWeakenThreads
              ? server.allocatedWeakenThreads
              : "",
          server.maxMoney > 0 && server.allocatedHackThreads
              ? server.allocatedHackThreads
              : "",*/
        server.maxMoney > 0
            ? formatMoney(server.maxMoney)
            : "",
        server.maxMoney > 0
            ? formatMoney(server.currentMoney)
            : "",
        server.maxMoney > 0
            ? progressBar({
                min: 0,
                max: server.maxMoney,
                current: server.currentMoney,
                size: 0,
                targetThreshold: requiredMinMoneyFill,
            })
            : "",
        server.maxMoney > 0
            ? server.securityLevel.toFixed(4) // progressBar(server.minSecurityLevel, server.minSecurityLevel + hackSecurityOffset, server.securityLevel, 0)
            : "",
        server.maxMoney > 0
            ? Math.round(server.reqGrowThreads)
            : "",
        server.maxMoney > 0
            ? Math.round(server.growTime / 1000.0)
            : "",
        server.maxMoney > 0
            ? Math.round(server.weakenTime / 1000.0)
            : "",
        server.maxMoney > 0
            ? Math.round(server.hackTime / 1000.0)
            : "",
        server.job
            ? progressBar({
                min: server.job.start,
                max: server.job.end,
                current: Math.floor(Date.now() / 1000),
                size: 10,
            })
            : "",
        server.action ?? "",
    ]
}

/**
 *
 * @param {PlannerRunnerData}runner
 * @returns {string[]}
 */
function getRunnerStringData(runner) {
    if (!runner) {
        return [
            "Server",
            "Threads available",
        ]
    }
    return [
        runner.server,
        runner.threadsAvailable,
    ]
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

/**
 * @param {NS} ns
 */
function loadJobState(ns, lfn) {
    try {
        const fileContent = ns.read(jobState)
        const json = JSON.parse(fileContent)
        if (!Array.isArray(json)) {
            return
        }
        workCache = json
    } catch (a) {
        lfn("!!! Error in loading jobState ", a)
    }
}

/**
 * @param {NS} ns
 */
async function saveJobState(ns, lfn) {
    try {
        await ns.write(jobState, JSON.stringify(workCache, null, 4), "w")
    } catch (a) {
        lfn("!!! Error in saving jobState ", a)
    }
}

const hackScript = "run.js"
const requiredMinMoneyFill = 0.8
const hackSecurityOffset = 5

let workCache = []

const jobState = "jobStateTmp.txt"
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
