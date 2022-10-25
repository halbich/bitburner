import {WorkCache, WorkJob} from "src/workCache"

class TargetData {

    /**
     *
     * @param {string} server
     *
     * @param {WorkJob[]}jobs
     * @param {NS} ns
     */
    constructor(server, jobs, ns) {
        this._server = server
        this._ns = ns
        /**
         * @type {WorkJob[]}
         * @private
         */
        this._jobs = []
        this._allocatedGrowThreads = 0
        this._allocatedWeakenThreads = 0
        this._allocatedHackThreads = 0
        this._note = undefined

        this.jobs = jobs
        this._hacks = new Map()
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

    get note() {
        return this._note
    }

    set note(value) {
        this._note = value
    }

    /**
     * @param {number} stealingPercent
     * @return {{
     *     hackThreads: number;
     *             threadsToWeakenHack : number;
     *             growthThreads:number;
     *             threadsToWeakenGrow:number;
     *             totalThreads:number;
     *             hackTime:number;
     *             growTime:number;
     *             weakenTime:number;
     *             pipelineLength:number;
     *             hackAmount:number;
     *             expectedRevenue:number;
     * }}
     */
    getHackStats(stealingPercent = 0.5) {
        const computed = this._hacks.get(stealingPercent)
        if (computed) {
            return computed
        }
        const n = this._getHackStats(stealingPercent)
        this._hacks.set(stealingPercent, n)
        return n
    }

    /**
     * @param {number} stealingPercent
     * @return {{
     *     hackThreads: number;
     *             threadsToWeakenHack : number;
     *             growthThreads:number;
     *             threadsToWeakenGrow:number;
     *             totalThreads:number;
     *             hackTime:number;
     *             growTime:number;
     *             weakenTime:number;
     *             pipelineLength:number;
     *             hackAmount:number;
     *             expectedRevenue:number;
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

        const growthSecurityIncrease =  2 * 0.002 * growthThreads // ns.growthAnalyzeSecurity(growthThreads, this.server, 1)

        let threadsToWeakenGrow = 0
        while (ns.weakenAnalyze(threadsToWeakenGrow) < growthSecurityIncrease) {
            threadsToWeakenGrow++
        }

        const hackTime = Math.ceil(ns.getHackTime(this.server))
        const growTime = Math.ceil(ns.getGrowTime(this.server))
        const weakenTime = Math.ceil(ns.getWeakenTime(this.server))
        const pipelineLength = Math.max(hackTime, growTime, weakenTime)

        return {
            hackThreads,
            threadsToWeakenHack,
            growthThreads,
            threadsToWeakenGrow,
            totalThreads: hackThreads + threadsToWeakenHack + growthThreads + threadsToWeakenGrow,
            hackTime,
            growTime,
            weakenTime,
            pipelineLength,
            hackAmount,
            expectedRevenue: Math.round(hackAmount / pipelineLength),
        }
    }

    /**
     *
     * @returns {{
     * server: string,
     * threadsToWeaken: number,
     * timeToWeaken: number,
     * growthThreads: number,
     * timeToGrow: number,
     * growthThreadsRemaining: number,
     * }|null}
     */
    getUpgradeStats() {
        if (this.currentMoney === this.maxMoney && this.currentSecurity === this.minSecurity) {
            return null
        }

        const ns = this._ns

        let threadsToWeaken = 0
        while (this.currentSecurity - ns.weakenAnalyze(threadsToWeaken + this.allocatedWeakenThreads) > this.minSecurity) {
            threadsToWeaken++
        }

        const growthThreads = Math.ceil(ns.growthAnalyze(this.server, this.maxMoney / Math.max(this.currentMoney, 1)))

        return {
            server: this.server,
            threadsToWeaken,
            timeToWeaken: ns.getWeakenTime(this.server),
            growthThreads: this.allocatedGrowThreads === 0
                ? growthThreads
                : 0,
            timeToGrow: ns.getGrowTime(this.server),
            growthThreadsRemaining: growthThreads,
        }
    }

    /**
     *
     * @returns {WorkJob[]}
     */
    get jobs() {
        return this._jobs
    }

    /**
     *
     * @param {WorkJob[]} value
     */
    set jobs(value) {
        this._jobs = value
        this._jobs.sort((a, b) => {
            if (a.end < b.end) {
                return -1
            } else if (a.end > b.end) {
                return 1
            } else {
                return 0
            }
        })
        this._allocatedGrowThreads = value.reduce((partial, a) => {
            return partial + (a.action === "grow"
                ? a.threads
                : 0)
        }, 0)
        this._allocatedWeakenThreads = value.reduce((partial, a) => {
            return partial + (a.action === "weaken"
                ? a.threads
                : 0)
        }, 0)
        this._allocatedHackThreads = value.reduce((partial, a) => {
            return partial + (a.action === "hack"
                ? a.threads
                : 0)
        }, 0)

    }

    /**
     *
     * @param {WorkJob[]} jobs
     */
    addJobs(jobs) {
        this._jobs.push(...jobs)
        this.jobs = (this._jobs)
    }

    get allocatedHackThreads() {
        return this._allocatedHackThreads
    }

    get allocatedWeakenThreads() {
        return this._allocatedWeakenThreads
    }

    get allocatedGrowThreads() {
        return this._allocatedGrowThreads
    }

     get isBatching() {
        const batches = this.jobs.length > 0 && this.jobs.length % 4 === 0
        if (!batches) {
            return false
        }

        const growJobs = this.jobs.reduce((partial, a) => {
            return partial + (a.action === "grow"
                ? 1
                : 0)
        }, 0)
        const weakenJobs = this.jobs.reduce((partial, a) => {
            return partial + (a.action === "weaken"
                ? 1
                : 0)
        }, 0)
        const hackJobs = this.jobs.reduce((partial, a) => {
            return partial + (a.action === "hack"
                ? 1
                : 0)
        }, 0)

        return growJobs === hackJobs && growJobs === weakenJobs / 2 && (growJobs + hackJobs + weakenJobs) === this.jobs.length
    }

}

/**
 * @param {object} object
 * @param {WorkCache} workCache
 * @param {NS} ns
 * @returns {TargetData | null}
 */
function deserialize(object, workCache, ns) {
    if (!object.name) {
        return null
    }
    if (!ns.getServerMaxMoney(object.name) || !object.hasAdmin) {
        return null
    }

    const jobs = workCache.jobs.filter((item) => {
        return item.target === object.name
    })
    return new TargetData(object.name, jobs, ns)
}

/**
 * @param {NS} ns
 * @param {WorkCache} workCache
 * @param {(...args: any[]) => void} lfn
 * @returns {TargetData[]}}
 */
export function loadTargets(ns, workCache, lfn) {
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
                const d = deserialize(serializedData, workCache, ns)
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
