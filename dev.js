/** @param {NS} ns */
export async function main(ns) {

    if (ns.args[0]) {
        ns.scriptKill("dev.js", "home")
        return
    }

    while (true) {

        const pid = ns.run("./src/planner.js")
        if (!pid) {
            const continueWithDev = await ns.prompt("Continue?", {type: "boolean"})
            if (!continueWithDev) {
                break
            }
        } else {
            await ns.sleep(1000)
        }

    }
}
