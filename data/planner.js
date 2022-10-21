import {printTable} from "src/utils/table.js"
import {formatMoney} from "src/utils/utils.js"

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

        const colors = {
            black: "\u001b[30m",
            red: "\u001b[31m",
            green: "\u001b[32m",
            yellow: "\u001b[33m",
            blue: "\u001b[34m",
            magenta: "\u001b[35m",
            cyan: "\u001b[36m",
            white: "\u001b[37m",
            brightBlack: "\u001b[30;1m",
            brightRed: "\u001b[31;1m",
            brightGreen: "\u001b[32;1m",
            brightYellow: "\u001b[33;1m",
            brightBlue: "\u001b[34;1m",
            brightMagenta: "\u001b[35;1m",
            brightCyan: "\u001b[36;1m",
            brightWhite: "\u001b[37;1m",
            reset: "\u001b[0m",
        }
        for (const key of Object.keys(colors)) {
            ns.tprint(`${colors[key]}${key}`)
        }

        lfn(`Current iteration: ${new Date().toTimeString()}, ${workCache.length}`)
        const servers = loadDb(ns, lfn)
        const computedActions = computeData(ns, servers, lfn)
        computedActions.sort((a, b) => {
            if (a.maxMoney > 0 && b.maxMoney > 0) {
                return 0
            } else if (a.maxMoney > 0) {
                return -1
            } else {
                return 1
            }
        })
        printTable(lfn, computedActions, getServerStringData, {
            padLeftColumns: [
                0,
                5,
                6,
            ],
        })
        await saveJobState(ns, lfn)
        if (continuous) {
            await ns.sleep(1000)
        }
    } while (continuous)
}

/**
 * @param {NS} ns
 * @param {{server:string}[]} servers
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
        const maxRamAvailable = ns.getServerMaxRam(name) * (server.maxRamPercentage ?? 1)
        const r = {
            server: name,
            threads: Math.floor((maxRamAvailable - ns.getServerUsedRam(name)) / 2.0),
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

            lfn(`${i}: ${ns.weakenAnalyze(threads)}`);
            if (r.securityLevel - ns.weakenAnalyze(threads) <= r.minSecurityLevel) {
                requiredThreadsToWeaken = i
                break
            }
        }

        const growthPerc = (r.maxMoney - r.currentMoney) / r.currentMoney;

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

    /*
    const runnersForGrowth = []
    while (availableRunners.length) {
        const runner = availableRunners.shift()
        const targetWeaken = availableTargets.map((target) => {
            const finalSecurity = target.securityLevel - ns.weakenAnalyze(runner.threads + target.allocatedWeakenThreads)
            return {
                server: target.server,
                canWeaken: finalSecurity >= target.minSecurityLevel,
                securityDiff: finalSecurity - target.minSecurityLevel,
            }
        }).filter((item) => {
            return item.canWeaken
        }).sort((a, b) => {
            if (a.securityDiff < b.securityDiff) {
                return -1
            } else if (a.securityDiff > b.securityDiff) {
                return 1
            } else {
                return 0
            }
        })

        if (targetWeaken.length) {
            const finalTarget = targetWeaken[0]
            runWork(ns, runner, "weaken", finalTarget.server)
            availableTargetsMap.get(finalTarget.server).allocatedWeakenThreads += runner.threads
        } else {
            runnersForGrowth.push(runner)
        }
    }

    const runnersForHack = []
    while (runnersForGrowth.length) {
        const runner = runnersForGrowth.shift()
        const targetGrow = availableTargets.map((target) => {

            const availableGrowth = target.reqGrowThreads - target.allocatedGrowThreads
            const callCount = availableGrowth > runner.threads
                ? availableGrowth / runner.threads
                : 0
            const totalTime = callCount * target.growTime
            return {
                server: target.server,
                availableGrowth,
                callCount,
                totalTime,
            }
        }).filter((item) => {
            return item.totalTime
        }).sort((a, b) => {
            if (a.totalTime < b.totalTime) {
                return -1
            } else if (a.totalTime > b.totalTime) {
                return 1
            } else {
                return 0
            }
        })

        if (targetGrow.length) {
            const finalTarget = targetGrow[0]
            runWork(ns, runner, "grow", finalTarget.server)
            availableTargetsMap.get(finalTarget.server).allocatedGrowThreads += runner.threads
        } else {
            runnersForHack.push(runner)
        }
    }

    while (runnersForHack.length) {
        const runner = runnersForHack.shift()

        const targetHack = availableTargets.map((target) => {
            return {
                server: target.server,
                hackMoney: target.moneyForOneHack * runner.threads,
                hackPerc: (target.moneyForOneHack * runner.threads) / target.maxMoney,
            }
        }).sort((a, b) => {
            if (a.hackMoney > b.hackMoney) {
                return -1
            } else if (a.hackMoney < b.hackMoney) {
                return 1
            } else {
                return 0
            }
        })

        const full = targetHack.filter((item) => {
            return item.hackPerc >= 100
        })
        if (full.length) {
            const finalTarget = full[0]
            runWork(ns, runner, "hack", finalTarget.server)
            availableTargetsMap.get(finalTarget.server).allocatedHackThreads += runner.threads
        }

    }
*/
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
            ? progressBar(0, server.maxMoney, server.currentMoney, 0, requiredMinMoneyFill)
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
            ? progressBar(server.job.start, server.job.end, Math.floor(Date.now() / 1000), 10)
            : "",
        server.action ?? "",
    ]
}

function getUpdateProgressBar(max, current, size) {
    return (server, lfn) => {
        if (server == null) {
            return null
        }
        return [
            progressBar(0, max, current, size),
        ]

    }
}

function progressBar(min, max, current, size, targetTresh = 0) {
    const filli = size * targetTresh
    const res = []
    const fill = Math.min((current - min) * size / (max - min), size)
    for (let i = 0; i < size; i++) {
        const backgroud = i <= filli
            ? "▒"
            : "░"
        res.push(i < fill
            ? "█"
            : backgroud)
    }
    const perc = Math.round((current - min) * 100 / (max - min))
    return `${res.join("")} ${perc.toString().padStart(3)}%`
}

/**
 * @param {NS} ns
 * @param {(...args: any[]) => void} lfn
 * @returns {{server:string}[]}
 */
function loadDb(ns, lfn) {
    const resArray = []
    try {
        const fileContent = ns.read(db)
        const json = JSON.parse(fileContent)
        if (!Array.isArray(json)) {
            return resArray
        }

        for (const serializedData of json) {
            try {
                const d = deserialize(serializedData)
                if (d) {
                    resArray.push(d)
                }
            } catch {
            }
        }

        resArray.sort((a, b) => {
            if (a.server < b.server) {
                return -1
            } else if (a.server > b.server) {
                return 1
            } else {
                return 0
            }
        })

        return resArray
    } catch (a) {
        lfn("!!! Error in loading ", a)
        return resArray
    }
}

/**
 * @returns {{server:string;threads:number; maxRamPercentage:number} | null}
 */
function deserialize(object) {
    if (!object.name) {
        return null
    }
    if (!object.threadsAvailable) {
        return null
    }

    return {
        server: object.name,
        threads: object.threadsAvailable,
        maxRamPercentage: object.maxRamPercentage ?? 1,
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

const db = "db.txt"
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
