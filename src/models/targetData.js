import {TargetState, TargetsStates} from "src/models/targetState"

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

    /**
     * @param {number} stealingPercent
     * @return {{
     *      hack: {amount: number; threads: number; duration: number},
     *      weakenHack: {amount: number; threads: number; duration: number},
     *      grow: {amount: number; threads: number; duration: number},
     *      weakenGrow: {amount: number; threads: number; duration: number},
     *      totalThreads:number;
     *      pipelineLength:number;
     *      expectedRevenue:number;
     * }}
     */
    _getHackStats(stealingPercent = 0.5) {
        const ns = this._ns
        const hackAmount = this.maxMoney * stealingPercent
        const hackThreads = Math.floor(ns.hackAnalyzeThreads(this.server, hackAmount))
        const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, this.server)

        let threadsToWeakenHack = 0
        while (ns.weakenAnalyze(threadsToWeakenHack) < hackSecurityIncrease) {
            threadsToWeakenHack++
        }

        const growthThreads = Math.ceil(ns.growthAnalyze(this.server, 1.0 / stealingPercent))

        const growthSecurityIncrease = 2 * 0.002 * growthThreads // ns.growthAnalyzeSecurity(growthThreads, this.server, 1)

        let threadsToWeakenGrow = 0
        while (ns.weakenAnalyze(threadsToWeakenGrow) < growthSecurityIncrease) {
            threadsToWeakenGrow++
        }

        const hackTime = Math.ceil(ns.getHackTime(this.server))
        const growTime = Math.ceil(ns.getGrowTime(this.server))
        const weakenTime = Math.ceil(ns.getWeakenTime(this.server))
        const pipelineLength = Math.max(hackTime, growTime, weakenTime)

        return {
            hack: {
                amount: hackAmount,
                threads: hackThreads,
                duration: hackTime,
            },
            weakenHack: {
                amount: hackSecurityIncrease,
                threads: threadsToWeakenHack,
                duration: weakenTime,
            },
            grow: {
                amount: hackAmount,
                threads: growthThreads,
                duration: growTime,
            },
            weakenGrow: {
                amount: growthSecurityIncrease,
                threads: threadsToWeakenGrow,
                duration: weakenTime,

            },
            totalThreads: hackThreads + threadsToWeakenHack + growthThreads + threadsToWeakenGrow,
            pipelineLength,
            expectedRevenue: Math.round(hackAmount / pipelineLength),
        }
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

    if (object.name !== "n00dles") {
        return null
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
        const fileContent = ns.read(db)
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

const db = "/data/db.txt"
