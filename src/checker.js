import {printTable} from "src/utils/table.js"
import {formatMoney, progressBar} from "src/utils/utils.js"
import {loadRunners} from "src/models/runnerData.js"
import {loadTargets} from "src/models/targetData.js"
import {initServer, runJob, TargetsStates, TargetStatesEnum} from "src/models/targetState.js"
import {ActionsEnum, Files, IterationLength, IterationOffset, SlotSize} from "src/utils/constants"
import {getNextSleepForSlot} from "src/utils/slots"

let id = 0

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
        const sleep = getNextSleepForSlot(slotId)
        if (sleep) {
            await ns.sleep(sleep)
        }
        ns.clearLog()
        const start = Date.now()
        const act = Date.now() % IterationLength
        lfn(act)

        lfn(`Current iteration: ${new Date().toTimeString()}`)

        const states = new TargetsStates(ns, lfn)
        const runners = loadRunners(ns, lfn)
        const targets = loadTargets(ns, states, lfn)

        lfn(`load ${Date.now() - start} ms`)

        processJobs(ns, runners, targets, lfn)

        lfn(`process ${Date.now() - start} ms`)
        const display = targets.filter((item) => {
            return ignoreServers.length
                ? ignoreServers.includes(item.server)
                : true
        })
        //printTable(lfn, runners, getRunnerStringData)
        printTable(lfn, display, getTargetStringData)

        const length = Date.now() - start
        lfn(`Iteration done in ${length} ms`)
        if (continuous) {
            const sleepTime = Math.max(20, IterationLength - length)
            await ns.sleep(getNextSleepForSlot(slotId, sleepTime))
        }
        id++
    } while (continuous)
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
        return item.threadsAvailable
    })

    const totalAvailable = available.reduce((partial, a) => {
        return partial + a.threadsAvailable
    }, 0)

    /** @type {TargetData[]} */
    const batchingTargets = []

    targets.forEach((item) => {
        const state = item.targetState
        if (!state) {
            initServer(ns, item.server)
            return
        }

        switch (state.state) {
            case TargetStatesEnum.Batching: {
                batchingTargets.push(item)
                if (item.minSecurity === item.currentSecurity && item.currentMoney === item.maxMoney && state.runningJobs < 256) {
                } else if (!state.runningJobs) {
                }
                break
            }
            default: {
                if (!state.runningJobs) {
                }
                break
            }

        }
    })

    let remainingAvailable = totalAvailable

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
        if (!ignoreServers.includes(target.server)) {
            //continue
        }
        const state = target.targetState

        const hackMoney = 0.5 * target.maxMoney
        const hackThreads = Math.floor(ns.hackAnalyzeThreads(target.server, hackMoney))
        const hack = hackThreads !== state.hack.threads
            ? `H: ${hackThreads}/${state.hack.threads} `
            : "H: ✔ "

        const hackSecurity = ns.hackAnalyzeSecurity(hackThreads, target.server)
        let hackWeakenThreads = 0
        while (ns.weakenAnalyze(hackWeakenThreads) < hackSecurity) {
            hackWeakenThreads++
        }
        const hackWeaken = hackWeakenThreads !== state.weakenHack.threads
            ? `WH: ${hackWeakenThreads}/${state.weakenHack.threads} `
            : "WH: ✔ "

        const growThreads = Math.ceil(ns.growthAnalyze(target.server, 2))
        const grow = growThreads !== state.grow.threads
            ? `G: ${growThreads}/${state.grow.threads} `
            : "G: ✔ "

        const growSecurity = 2 * 0.002 * growThreads // ns.growthAnalyzeSecurity(growThreads, target.server, 1)
        lfn(growSecurity)
        let weakenGrowThreads = 0
        while (ns.weakenAnalyze(weakenGrowThreads) < growSecurity) {
            weakenGrowThreads++
        }

        const weakenGrow = weakenGrowThreads !== state.weakenGrow.threads
            ? `WG: ${weakenGrowThreads}/${state.weakenGrow.threads} `
            : "WG: ✔ "

        const aa = `${hackMoney} ${hack} ${hackWeaken} ${grow} ${weakenGrow} T: ${hackThreads + hackWeakenThreads + growThreads + weakenGrowThreads}`
        notes[target.server] = `S: ${state.weakenGrow.delay + state.weakenGrow.duration - state.hack.delay - state.hack.duration} W: ${ state.hack.delay} `

        const batch = computeBatch(state);
        lfn(batch);

        /*  updateDelay(state.hack, 1)
          updateDelay(state.weakenHack, 2)
          updateDelay(state.grow, 3)
          updateDelay(state.weakenGrow, 4)*/

        const now = Date.now()

        const h = (item, text) => {
            return [
                {
                    time: now + item.delay,
                    event: `${text} begin`,
                },
                {
                    time: now + item.delay + item.duration,
                    event: `${text} done`,

                },
            ]
        }

        const events = [
            {
                time: now,
                event: "start",
            },
            ...h(state.hack, "hack"),
            ...h(state.weakenHack, "weakenHack"),
            ...h(state.grow, "grow"),
            ...h(state.weakenGrow, "weakenGrow"),

        ]

        events.sort((a, b) => {
            if (a.time < b.time) {
                return -1
            } else if (a.time > b.time) {
                return 1
            } else {
                return 0
            }
        })

        lfn(``)
        lfn(`Data for: ${target.server}`)

        for (const event of events) {
              lfn(`${(event.time % IterationLength).toString().padStart(3)}: ${event.time - now} ${event.event}`)
        }
        // lfn(state)
        lfn(``)

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

function computeBatch(state) {
    const times = [
        [
            state.weakenGrow.duration - 3 * IterationOffset - state.hack.duration,
            state.weakenGrow.duration - 3 * IterationOffset,
        ],
        [
            state.weakenGrow.duration - 2 * IterationOffset - state.weakenHack.duration,
            state.weakenGrow.duration - 2 * IterationOffset,
        ],
        [
            state.weakenGrow.duration - IterationOffset - state.grow.duration,
            state.weakenGrow.duration - IterationOffset,
        ],
        [
            0,
            state.weakenGrow.duration,
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
            "Note",
        ]
    }

    return [
        target.server,
       /* progressBar({
            min: 0,
            max: target.maxMoney,
            current: target.currentMoney,
            size: 0,
        }),
        progressBar({
            min: target.minSecurity,
            max: target.minSecurity + 5,
            current: target.currentSecurity,
            size: 0,
        }),
        target.targetState
            ? `${target.targetState.state}, ${target.targetState.runningJobs}`
            : "",*/
        notes[target.server] ?? "",
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

const slotId = 0

const ignoreServers = [
    "n00dles",
    "joesguns",
]

const notes = {}
