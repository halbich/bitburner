import {Files} from "src/utils/constants"
import {loadRunners} from "src/models/runnerData"

/** @param {NS} ns */
export async function main(ns) {

    const runners = loadRunners(ns, ns.tprint)

    let target = home

    ns.scriptKill(Files.Planner, target)
    ns.scriptKill(Files.Optimizer, target)
    ns.scriptKill(Files.ServerExplorer, target)
    ns.scriptKill(Files.HacknetScaler, target)
    for (const runner of runners) {
        ns.scriptKill(Files.HackScript, runner.server)
    }
    ns.scriptKill(Files.HackScript, target)

    // update run script
    const updateRunScripts = ns.exec(Files.ServerExplorer, target, 1, "r")

    while (ns.isRunning(updateRunScripts, target)) {
        await ns.sleep(500)
    }
    // clear databases
    await ns.write(Files.Db, "[]")
    await ns.write(Files.TargetStates, "[]")

    ns.tprint(`Running scripts at ${target}`)

    if (!ns.exec(Files.ServerExplorer, target, 1, "c")) {
        ns.tprint("Failed to start ServerExplorer")
    }
    if (!ns.exec(Files.Optimizer, target, 1)) {
        ns.tprint("Failed to start Optimizer")
    }
    if (!ns.exec(Files.Planner, target, 1, "c")) {
        ns.tprint("Failed to start Planner")
    }
    if (!ns.exec(Files.HacknetScaler, target)) {
        ns.tprint("Failed to start HacknetScaler")
    }

}

const home = "home"
