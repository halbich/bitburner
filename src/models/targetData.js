import {TargetState, TargetsStates} from "src/models/targetState"
import {Files} from "src/utils/constants"

class TargetData {

    /**
     *
     * @param {string} server
     * @param {TargetState|null} targetState
     * @param {NS} ns
     */
    constructor(server, targetState, ns) {
        this._server = server
        this._targetState = targetState
        this._ns = ns
        this._note = undefined

    }

    /**
     * @returns {string}
     */
    get server() {
        return this._server
    }

    /**
     * @returns {number}
     */
    get maxMoney() {
        return this._ns.getServerMaxMoney(this.server)
    }

    /**
     * @returns {number}
     */
    get currentMoney() {
        return this._ns.getServerMoneyAvailable(this.server)
    }

    /**
     * @returns {number}
     */
    get minSecurity() {
        return this._ns.getServerMinSecurityLevel(this.server)
    }

    /**
     * @returns {number}
     */
    get currentSecurity() {
        return this._ns.getServerSecurityLevel(this.server)
    }

    /**
     * @return {TargetState}
     */
    get targetState() {
        return this._targetState
    }

}

/**
 * @param {object} object
 * @param {TargetsStates} states
 * @param {NS} ns
 * @returns {TargetData | null}
 */
function deserialize(object, states, ns) {
    if (!object.name) {
        return null
    }
    if (!ns.getServerMaxMoney(object.name) || !object.hasAdmin) {
        return null
    }

    if(object.name !== "foodnstuff") {
        //return null
    }

    const targetState = states.loadTargetStateOrDefault(object.name)
    return new TargetData(object.name, targetState, ns)
}

/**
 * @param {NS} ns
 * @param {TargetsStates} states
 * @param {(...args: any[]) => void} lfn
 * @returns {TargetData[]}}
 */
export function loadTargets(ns, states, lfn) {
    /** @type {TargetData[]} */
    const resArray = []
    try {
        const fileContent = ns.read(Files.Db)
        const json = JSON.parse(fileContent)
        if (!Array.isArray(json)) {
            return resArray
        }

        for (const serializedData of json) {
            try {
                const d = deserialize(serializedData, states, ns)
                if (d) {
                    resArray.push(d)
                }
            } catch {
            }
        }

        resArray.sort((a, b) => {
            if (a.server < b.server) {
                return -1
            } else if (a.server > b.server) {
                return 1
            } else {
                return 0
            }
        })

        return resArray
    } catch (a) {
        lfn("!!! Error in loading ", a)
        return resArray
    }
}
