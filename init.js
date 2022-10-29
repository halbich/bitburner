/** @param {NS} ns */
import {Files} from "src/utils/constants"

export async function main(ns) {

    let target = home

    ns.scriptKill(Files.Planner, target)
    ns.scriptKill(Files.Optimizer, target)
    ns.scriptKill(Files.ServerExplorer, target)
    ns.scriptKill(Files.HacknetScaler, target)

    ns.write(Files.Db, "[]")
    ns.write(Files.TargetStates, "[]")

    ns.tprint(`Running scripts at ${target}`)

    ns.exec(Files.HacknetScaler, target)
    ns.exec(Files.ServerExplorer, target, 1, "c")
    ns.exec(Files.Optimizer, target, 1)
    ns.exec(Files.Planner, target, 1, "c")

}

const home = "home"
