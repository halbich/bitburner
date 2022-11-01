import {printTable} from "src/utils/table.js"
import {formatMoney, progressBar} from "src/utils/utils.js"
import {loadRunners} from "src/models/runnerData.js"
import {loadTargets} from "src/models/targetData.js"
import {initServer, runJob, TargetsStates, TargetStatesEnum} from "src/models/targetState.js"
import {ActionsEnum, Files, IterationLength} from "src/utils/constants"
import {getNextSleepForSlot} from "src/utils/slots"

let id = 0

/** @param {NS} ns */
export async function main(ns) {
    const ar = ns.args[0] ?? ""
    const continuous = ar.includes("c")
    const lfn = continuous
        ? ns.print
        : ns.tprint

    lfn(Date.now() % IterationLength)

    const sleep = getNextSleepForSlot(slotId)
    if (sleep) {
        await ns.sleep(sleep)
    }
    lfn(Date.now() % IterationLength)

    await ns.sleep(210)

    const now = Date.now();
    const sleepTime = 950;

    const slot = (now + sleepTime) % IterationLength
    lfn(slot)

    lfn(getNextSleepForSlot(slotId, sleepTime))

}

const slotId = 0
