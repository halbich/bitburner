/** @param {NS} ns */
export async function main(ns) {

    while (true) {

        const pid = ns.run("planner.js")
        if (!pid) {
            const continueWithDev = await ns.prompt("Continue?", {type: "boolean"});
            if(!continueWithDev) {
                break;
            }
        } else {
            await ns.sleep(1000)
        }

    }
}
