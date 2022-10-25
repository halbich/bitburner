/** @param {NS} ns */
export async function main(ns) {

    const flags = ns.flags([
        [
            "delay",
            0,
        ],
        [
            "threads",
            1,
        ],
        [
            "action",
            "",
        ],
        [
            "target",
            "",
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
    } = flags
    ns.print(`${new Date().toLocaleTimeString()}. Doing ${action} on ${target}`)
    switch (action) {
        case "weaken":
            await ns.weaken(target, {threads})
            break
        case "grow":
            await ns.grow(target, {threads})
            break
        case "hack":
            await ns.hack(target, {threads})
            break
        default: {
            ns.print("Invalid action!")
        }
    }
    if(target === "n00dles") {
        ns.tprint(action);
    }
}
