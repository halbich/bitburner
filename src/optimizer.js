import {TargetsStates, TargetState} from "src/models/targetState"
import {PortAllocations} from "./utils/constants"

/** @param {NS} ns */
export async function main(ns) {
    const lfn = ns.print

    for (const muted of mutedFunctions) {
        ns.disableLog(muted)
    }
    const port = ns.getPortHandle(notificationPort)
    const states = new TargetsStates(ns, lfn)

    while (true) {
        ns.clearLog()
        const start = Date.now()
        lfn(`Current iteration: ${new Date().toTimeString()}`)

        const wasEmpty = port.empty()
        while (!port.empty()) {

            const msg = port.read()
            ns.tprint("msg: " + msg)
            if (msg.startsWith("init:")) {
                const name = msg.substring(5)
                ns.tprint(name)
                const newState = new TargetState({
                    server: name,
                    state: "init",
                })
                states.states.set(newState.server, newState)
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


/**
 * @param {NS} ns
 * @param {string} server
 */
export function initServer(ns, server) {
    ns.writePort(PortAllocations.TargetState, "init:" + server).then()
}

/**
 * @param {NS} ns
 * @param {TargetState} state
 * @parem {string} action
 */
export function changeState(ns, state, action) {
    switch (state.state) {

    }
    ns.writePort(notificationPort, "init:" + server).then()
}


