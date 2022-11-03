import {ActionsEnum, PortAllocations, IterationLength} from "src/utils/constants"

/** @param {NS} ns */
export async function main(ns) {
    const dur = Date.now()
    const flags = ns.flags([
        [
            "threads",
            1,
        ],
        [
            "target",
            "",
        ],
        [
            "action",
            "",
        ],
        [
            "delay",
            0,
        ],
        [
            "amount",
            0,
        ],
        [
            "duration",
            0,
        ],
        [
            "id",
            0,
        ],
    ])

    if (!flags.action || !flags.target) {
        ns.tprint("Define action and target")
        return
    }

    if (flags.delay > 0) {
        await ns.sleep(flags.delay + dur % IterationLength)
    }
    const {
        action,
        target,
        threads,
        amount,
        duration,
    } = flags
    const dur0 = Date.now()
    ns.print(`${new Date().toLocaleTimeString()}. Doing ${action} on ${target}`)
    switch (action) {
        case ActionsEnum.Weaken: {
            const value = await ns.weaken(target, {threads})
            //ns.tprint("Weaken " + flags.id + " " + Date.now() % IterationLength)
            await writeAction(ns, target, action, threads, flags.delay, amount, value, duration, dur, dur0)
            break
        }
        case ActionsEnum.Grow: {
            const value = await ns.grow(target, {threads})
            //ns.tprint("Grow " + flags.id + " " + Date.now() % IterationLength)
            await writeAction(ns, target, action, threads, flags.delay, amount, value, duration, dur, dur0)
            break
        }
        case ActionsEnum.Hack: {
            const value = await ns.hack(target, {threads})
            //ns.tprint("Hack " + flags.id + " " + Date.now() % IterationLength)
            await writeAction(ns, target, action, threads, flags.delay, amount, value, duration, dur, dur0)
            break
        }
        default: {
            ns.print("Invalid action!")
        }
    }
}

/**
 *
 * @param {NS} ns
 * @param {string} server
 * @param {string} action
 * @param {number} threads
 * @param {number} delay
 * @param {number} expectedAmount
 * @param {number} amount
 * @param {number} expectedDuration
 * @param {number} jobStartTimestamp
 * @param {number} actionStartTimestamp
 * @returns {Promise<any>}
 */
async function writeAction(ns, server, action, threads, delay, expectedAmount, amount, expectedDuration, jobStartTimestamp, actionStartTimestamp) {
    return ns.writePort(PortAllocations.TargetState, JSON.stringify({
        server,
        action,
        threads,
        delay,
        expectedAmount,
        amount,
        expectedDuration,
        duration: Date.now() - actionStartTimestamp,
        totalDuration: Date.now() - jobStartTimestamp,
    }))
}
