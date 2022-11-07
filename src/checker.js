import {printTable} from "src/utils/table.js"
import {colorCode, ColorEnum, Colors, formatMoney, progressBar} from "src/utils/utils.js"
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

    ns.disableLog("ALL")
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

        let {
            hackTime,
            weakenTime,
            growTime,
            hackDelay,
            weakenHackDelay,
            growDelay,
            weakenGrowDelay,
            actionArray,
            startData,
        } = computeBatchParams(target, ns)

        const size = 1000 / IterationOffset
        const lineSec = 10
        let sb = []
        for (let i = 0; i < actionArray.length; i++) {
            if (i > 0 && i % size === 0 && i % (lineSec * size) !== 0) {
                sb.push(" ")
            }
            if (i > 0 && i % (lineSec * size) === 0) {
                lfn(sb.join(""))
                sb = []
            }

            sb.push(actionArray[i]
                ? actionArray[i]
                : "-")

        }
        lfn(sb.join(""))

        lfn(startData)
        lfn(startData.length)

        /*  updateDelay(state.hack, 1)
          updateDelay(state.weakenHack, 2)
          updateDelay(state.grow, 3)
          updateDelay(state.weakenGrow, 4)*/

        const now = Date.now()
        const state = target.targetState

        const h = (delay, duration, text, color) => {
            return [
                {
                    time: now + delay,
                    event: colorCode(`${text} begin`, color),
                },
                {
                    time: now + delay + duration,
                    event: colorCode(`${text} done`, color),

                },
            ]
        }

        const events = [
            {
                time: now,
                event: colorCode("start", Colors.Start),
            },
            ...h(hackDelay, hackTime, "hack", Colors.Hack),
            ...h(weakenHackDelay, weakenTime, "weakenHack", Colors.WeakenHack),
            ...h(growDelay, growTime, "grow", Colors.Grow),
            ...h(weakenGrowDelay, weakenTime, "weakenGrow", Colors.WeakenGrow),

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
            //    lfn(`${(event.time % IterationLength).toString().padStart(3)}: ${event.time - now} ${event.event}`)
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

const slotId = 0

const ignoreServers = [
    "n00dles",
    "joesguns",
]

const notes = {}
