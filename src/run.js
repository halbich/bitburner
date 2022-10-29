import {ActionsEnum, PortAllocations} from "src/utils/constants"

/** @param {NS} ns */
export async function main(ns) {

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
            "expectedAmount",
            0,
        ],
        [
            "expectedDuration",
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
        expectedAmount,
        expectedDuration,
    } = flags
    const dur0 = Date.now()
    ns.print(`${new Date().toLocaleTimeString()}. Doing ${action} on ${target}`)
    switch (action) {
        case ActionsEnum.Weaken: {
            const value = await ns.weaken(target, {threads})
            await writeAction(ns, target, action, expectedAmount, value, expectedDuration, Date.now() - dur0)
            break
        }
        case ActionsEnum.Grow: {
            const value = await ns.grow(target, {threads})
            const r = await writeAction(ns, target, action, expectedAmount, value, expectedDuration, Date.now() - dur0)
            ns.tprint("Run: " + r)
            break
        }
        case ActionsEnum.Hack: {
            const value = await ns.hack(target, {threads})
            await writeAction(ns, target, action, expectedAmount, value, expectedDuration, Date.now() - dur0)
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
 * @param {number} expectedAmount
 * @param {number} amount
 * @param {number} expectedDuration
 * @param {number} duration
 * @returns {Promise<any>}
 */
async function writeAction(ns, server, action, expectedAmount, amount, expectedDuration, duration) {
    return ns.writePort(PortAllocations.TargetState, JSON.stringify({
        server,
        action,
        expectedAmount,
        amount,
        expectedDuration,
        duration,
    }))
}
