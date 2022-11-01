/** @param {NS} ns */
import {Files} from "src/utils/constants"
import {loadRunners} from "src/models/runnerData"

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
    ns.exec(Files.ServerExplorer, target, 1, "r")

    await ns.sleep(2000);
    // clear databases
    ns.write(Files.Db, "[]")
    ns.write(Files.TargetStates, "[]")

    ns.tprint(`Running scripts at ${target}`)

    ns.exec(Files.HacknetScaler, target)
    ns.exec(Files.ServerExplorer, target, 1, "c")
    ns.exec(Files.Optimizer, target, 1)
    ns.exec(Files.Planner, target, 1, "c")

}

const home = "home"
