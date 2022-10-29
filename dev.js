/** @param {NS} ns */
import {Files} from "src/utils/constants"

export async function main(ns) {

    if (ns.args[0]) {
        ns.scriptKill(Files.Dev, "home")
        return
    }

    while (true) {

        const pid = ns.run(Files.Planner)
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
