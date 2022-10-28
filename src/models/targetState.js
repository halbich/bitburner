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
}

export class TargetsStates {

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    constructor(ns, lfn) {
        /**
         * @type {TargetState[]}
         */
        this.states = this.#loadJobState(ns, lfn)

    }

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     * @returns {TargetState[]}
     */
    #loadJobState(ns, lfn) {
        try {
            const fileContent = ns.read(targetStatesFile)
            const json = JSON.parse(fileContent)
            if (!Array.isArray(json)) {
                return []
            }
            return json.map((item) => {
                return new TargetState(item)
            })
        } catch (a) {
            lfn("!!! Error in loading jobState ", a)
            return []
        }
    }

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    async saveJobState(ns, lfn) {
        try {
            await ns.write(targetStatesFile, JSON.stringify(this.states, null, 4), "w")
        } catch (a) {
            lfn("!!! Error in saving jobState ", a)
        }
    }
}

const targetStatesFile = "targetStates.txt"
