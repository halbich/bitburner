import {ActionsEnum, PortAllocations} from "src/utils/constants"

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
     * @param {boolean} isRunning
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
                    isRunning,
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
        this.isRunning = isRunning
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
     *
     * @param {string} message
     * @param {(...args: any[]) => void} lfn
     */
    processStateMessage(message, lfn) {
        if (message.startsWith(MessagesEnum.Init)) {
            const name = message.substring(MessagesEnum.Init.length)
            lfn(name)
            const newState = new TargetState({
                server: name,
                state: TargetStatesEnum.Init,
            })
            this.states.set(newState.server, newState)
        } else if (message.startsWith(MessagesEnum.Running)) {
            const data = message.substring(MessagesEnum.Running.length).split(";")
            lfn(data)
            const state = this.states.get(data[0])
            if (!state) {
                return
            }
            switch (state.state) {
                case TargetStatesEnum.Init: {
                    state.isRunning = true
                    if(data[1] === ActionsEnum.Hack) {
                        state.state = TargetStatesEnum.PreparingHack
                    }
                    break
                }
            }
        }
    }

    /**
     * @param {{
     * server: string;
     * action: string;
     * expectedAmount: number;
     * amount: number;
     * expectedDuration: number;
     * duration: number;
     * }} data
     * @param {(...args: any[]) => void} lfn
     */
    processJobMessage(data, lfn) {
        lfn(data);
        const state = this.states.get(data.server)
        if (!state) {
            return
        }
        switch (state.state) {
            case TargetStatesEnum.Init: {
                state.isRunning = false
                break
            }
        }
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

const MessagesEnum = {
    Init: "init:",
    Running: "running:",
}

export const TargetStatesEnum = {
    Init: "init",
    Batching: "batching",
    PreparingHack: "preparingHack",
    PreparingHackWeaken: "preparingHackWeaken",
    PreparingGrow: "preparingGrow",
    PreparingGrowWeaken: "preparingGrowWeaken",
}

/**
 * @param {NS} ns
 * @param {string} server
 */
export function initServer(ns, server) {
    ns.writePort(PortAllocations.TargetState, MessagesEnum.Init + server).then()
}

/**
 * @param {NS} ns
 * @param {string} server
 * @param {string} job
 */
export function runJob(ns, server, job) {
    ns.writePort(PortAllocations.TargetState, MessagesEnum.Running + server + ";" + job).then()
}

/**
 * @param {NS} ns
 * @param {TargetState} state
 * @parem {string} action
 */
export function changeState(ns, state, action) {
    switch (state.state) {

    }
    ns.writePort(PortAllocations.TargetState, "init:" + server).then()
}

