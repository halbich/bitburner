import {getRunScriptSize} from "/src/utils/utils.js"

class PlannerRunnerData {
    /**
     *
     * @param {string} server
     * @param {number} maxRamPercentage
     * @param {NS} ns
     */
    constructor(server, maxRamPercentage, ns) {
        this._server = server
        this._maxRamPercentage = maxRamPercentage
        this._threadsAvailable = Math.floor((ns.getServerMaxRam(server) * maxRamPercentage - ns.getServerUsedRam(server)) / getRunScriptSize())
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
    get maxRamPercentage() {
        return this._maxRamPercentage
    }

    /**
     * @returns {number}
     */
    get threadsAvailable() {
        return this._threadsAvailable
    }
}

/**
 * @param {object} object
 * @param {NS} ns
 * @returns {PlannerRunnerData | null}
 */
function deserialize(object, ns) {
    if (!object.name) {
        return null
    }
    if (!object.scriptingAvailable) {
        return null
    }

    return new PlannerRunnerData(object.name, object.maxRamPercentage ?? 1, ns)
}

/**
 * @param {NS} ns
 * @param {(...args: any[]) => void} lfn
 * @returns {PlannerRunnerData[]}}
 */
export function loadRunners(ns, lfn) {
    /** @type {PlannerRunnerData[]} */
    const resArray = []
    try {
        const fileContent = ns.read(db)
        const json = JSON.parse(fileContent)
        if (!Array.isArray(json)) {
            return resArray
        }

        for (const serializedData of json) {
            try {
                const d = deserialize(serializedData, ns)
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

const db = "db.txt"
