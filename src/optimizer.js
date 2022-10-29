import {TargetsStates} from "src/models/targetState"
import {PortAllocations} from "src/utils/constants"

/** @param {NS} ns */
export async function main(ns) {
    const lfn = ns.print

    for (const muted of mutedFunctions) {
        ns.disableLog(muted)
    }
    const port = ns.getPortHandle(PortAllocations.TargetState)
    const states = new TargetsStates(ns, lfn)

    while (true) {
        ns.clearLog()
        const start = Date.now()
        lfn(`Current iteration: ${new Date().toTimeString()}`)

        const wasEmpty = port.empty()
        while (!port.empty()) {

            const msg = port.read().toString()
            if (msg.startsWith("{")) {
                states.processJobMessage(JSON.parse(msg), ns.tprint)
            } else {
                states.processStateMessage(msg, ns.tprint)
            }
        }

        if (!wasEmpty) {
            await states.saveJobState(ns, lfn)
        }
        lfn(`Iteration done in ${Date.now() - start} ms`)
        await ns.sleep(20)

    }
}

const mutedFunctions = []




