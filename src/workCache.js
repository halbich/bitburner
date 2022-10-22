export class WorkJob {
    /**
     *
     * @param {string} runner
     * @param {string} target
     * @param {string} action
     * @param {number} start
     * @param {number} end
     * @param {number} threads
     */
    constructor({
                    runner,
                    target,
                    action,
                    start,
                    end,
                    threads,
                }) {
        this.runner = runner
        this.target = target
        this.action = action
        this.start = Math.floor(start)
        this.end = Math.ceil(end)
        this.threads = threads
    }
}

export class WorkCache {

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    constructor(ns, lfn) {
        /**
         * @type {WorkJob[]}
         */
        this.workCache = []
        this.loadJobState(ns, lfn)
    }

    get length() {
        return this.workCache.length
    }

    get jobs() {
        return this.workCache
    }

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    loadJobState(ns, lfn) {
        try {
            const fileContent = ns.read(jobState)
            const json = JSON.parse(fileContent)
            if (!Array.isArray(json)) {
                return
            }
            const now = Date.now()
            this.addJobs(json.filter((item) => {
                return item.end >= now
            }).map((item) => {
                return new WorkJob(item)
            }))
        } catch (a) {
            lfn("!!! Error in loading jobState ", a)
        }
    }

    /**
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    async saveJobState(ns, lfn) {
        try {
            await ns.write(jobState, JSON.stringify(this.workCache, null, 4), "w")
        } catch (a) {
            lfn("!!! Error in saving jobState ", a)
        }
    }

    /**
     *
     * @param {WorkJob[]} jobs
     */
    addJobs(jobs) {
        this.workCache.push(...jobs)
        this.workCache.sort((a, b) => {
            if (a.start > b.start) {
                return -1
            } else if (a.start < b.start) {
                return 1
            } else {
                return 0
            }
        })
    }
}

const jobState = "jobStateTmp.txt"
