import {ActionsEnum, PortAllocations, IterationLength} from "src/utils/constants"

/** @param {NS} ns */
export async function main(ns) {
    const scriptStart = Date.now()
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
        await ns.sleep(flags.delay)
    }
    const {
        action,
        target,
        threads,
        amount,
        duration,
    } = flags
    const actionBegin = Date.now()
    ns.print(`${new Date().toLocaleTimeString()}. Doing ${action} on ${target}`)
    switch (action) {
        case ActionsEnum.WeakenHack:
        case ActionsEnum.WeakenGrow: {
            const value = await ns.weaken(target, {threads})
            const actionEnd = Date.now()
            await writeAction(ns, target, action, threads, flags.delay, amount, value, duration, scriptStart, actionBegin, actionEnd)
            break
        }
        case ActionsEnum.Grow: {
            const value = await ns.grow(target, {threads})
            const actionEnd = Date.now()
            await writeAction(ns, target, action, threads, flags.delay, amount, value, duration, scriptStart, actionBegin, actionEnd)
            break
        }
        case ActionsEnum.Hack: {
            const value = await ns.hack(target, {threads})
            const actionEnd = Date.now()
            await writeAction(ns, target, action, threads, flags.delay, amount, value, duration, scriptStart, actionBegin, actionEnd)
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
 * @param {number} scriptStartTimestamp
 * @param {number} actionStartTimestamp
 * @param {number} actionEndTimestamp
 * @returns {Promise<any>}
 */
async function writeAction(ns, server, action, threads, delay, expectedAmount, amount, expectedDuration, scriptStartTimestamp, actionStartTimestamp, actionEndTimestamp) {
    return ns.writePort(PortAllocations.TargetState, JSON.stringify({
        server,
        action,
        threads,
        delay,
        expectedAmount,
        amount,
        expectedDuration,
        scriptStartTimestamp,
        actionStartTimestamp,
        actionEndTimestamp,
    }))
}
