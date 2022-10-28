import {TargetStatesEnum} from "../utils/constants"

export class TargetJobData {
    /**
     *
     * @param {number} amount
     * @param {number} threads
     * @param {number} duration
     */
    constructor({
                    amount,
                    threads,
                    duration,
                }) {
        this.amount = amount
        this.threads = threads
        this.duration = duration
    }
}

export class TargetState {
    /**
     *
     * @param {string} server
     * @param {string} state
     * @param {number} end
     * @param {TargetJobData} hack
     * @param {TargetJobData} weakenHack
     * @param {TargetJobData} grow
     * @param {TargetJobData} weakenGrow
     * @param {number} totalThreads
     * @param {number} batchLength
     * @param {number} expectedRevenue
     */
    constructor({
                    server,
                    state,
                    end,
                    hack,
                    weakenHack,
                    grow,
                    weakenGrow,
                    totalThreads,
                    batchLength,
                    expectedRevenue,
                }) {
        this.server = server
        this.state = state
        this.end = end
        this.hack = hack
        this.weakenHack = weakenHack
        this.grow = grow
        this.weakenGrow = weakenGrow
        this.totalThreads = totalThreads
        this.batchLength = batchLength
        this.expectedRevenue = expectedRevenue
    }

    get isBatching() {
        return this.state === TargetStatesEnum.Batching
    }

    get isUpgrading() {
        return this.state === TargetStatesEnum.Upgrading
    }
}

export class TargetsStates {

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    constructor(ns, lfn) {
        /**
         * @type {Map<string,TargetState>}
         */
        this.states = this.#loadJobState(ns, lfn)

    }

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     * @returns {Map<string,TargetState>}
     */
    #loadJobState(ns, lfn) {
        try {
            const fileContent = ns.read(targetStatesFile)
            const json = JSON.parse(fileContent)
            if (!Array.isArray(json)) {
                return new Map()
            }

            const result = new Map()
            for (const data of json) {
                const item = new TargetState(data)
                result.set(item.server, item)
            }
            return result
        } catch (a) {
            lfn("!!! Error in loading jobState ", a)
            return new Map()
        }
    }

    /**
     *
     * @param {string} server
     * @returns {TargetState| null}
     */
    loadTargetStateOrDefault(server) {
        return this.states.get(server)
    }

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    async saveJobState(ns, lfn) {
        try {
            const statesArray = Array.from(this.states.values())
            await ns.write(targetStatesFile, JSON.stringify(statesArray, null, 4), "w")
        } catch (a) {
            lfn("!!! Error in saving jobState ", a)
        }
    }
}

const targetStatesFile = "/data/targetStates.txt"



