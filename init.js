/** @param {NS} ns */
export async function main(ns) {
    ns.write(db, "[]")

    let target = home

    ns.scriptKill(planner, target)
    ns.scriptKill(autoScaler, target)
    ns.scriptKill(systemScript, target)

    ns.tprint(`Running scripts at ${target}`)

    ns.exec(systemScript, target, 1, "c")
    ns.exec(planner, target, 1, "c")
    ns.exec(autoScaler, target)

}

const planner = "/src/planner.js"
const autoScaler = "/src/hacknetScaler.js"
const systemScript = "/src/serverExplorer.js"
const db = "/data/db.txt"
const home = "home"
