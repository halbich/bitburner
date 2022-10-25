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
        case "weaken": {
            const value = await ns.weaken(target, {threads})
            if (target === "n00dles") {
                ns.tprint(`${action}, ${expectedAmount}, ${value}`)
                ns.tprint(`${expectedDuration}, ${Date.now() - dur0}`)
            }
            break
        }
        case "grow": {
            const value = await ns.grow(target, {threads})
            if (target === "n00dles") {
                ns.tprint(`${action}, ${expectedAmount}, ${value}`)
                ns.tprint(`${expectedDuration}, ${Date.now() - dur0}`)
            }
            break
        }
        case "hack": {
            const value = await ns.hack(target, {threads})
            if (target === "n00dles") {
                ns.tprint(`${action}, ${expectedAmount}, ${value}`)
                ns.tprint(`${expectedDuration}, ${Date.now() - dur0}`)
            }
            break
        }
        default: {
            ns.print("Invalid action!")
        }
    }
}
