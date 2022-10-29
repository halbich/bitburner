import {ActionsEnum, PortAllocations} from "src/utils/constants"

export class TargetJobData {
    /**
     *
     * @param {number} amount
     * @param {number} threads
     * @param {number} duration
     * @param {number} delay
     */
    constructor({
                    amount,
                    threads,
                    duration,
                    delay,
                }) {
        this.amount = amount
        this.threads = threads
        this.duration = duration
        this.delay = delay
    }
}

export class TargetState {
    /**
     *
     * @param {string} server
     * @param {string} state
     * @param {boolean} isRunning
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

        this.hack = hack
        this.weakenHack = weakenHack
        this.grow = grow
        this.weakenGrow = weakenGrow

        this.totalThreads = totalThreads
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
            const newState = new TargetState({
                server: name,
                state: TargetStatesEnum.Init,
            })
            this.states.set(newState.server, newState)
        } else if (message.startsWith(MessagesEnum.Running)) {
            const data = message.substring(MessagesEnum.Running.length).split(";")
            const state = this.states.get(data[0])
            if (!state) {
                return
            }
            switch (state.state) {
                case TargetStatesEnum.Init: {
                    state.isRunning = true
                    if (data[1] === ActionsEnum.Hack) {
                        state.state = TargetStatesEnum.Preparing
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
     * threads: number;
     * delay: number;
     * expectedAmount: number;
     * amount: number;
     * expectedDuration: number;
     * duration: number;
     * }} data
     * @param {(...args: any[]) => void} lfn
     */
    processJobMessage(data, lfn) {
        lfn(data)
        const state = this.states.get(data.server)
        if (!state) {
            return
        }

        switch (state.state) {
            case TargetStatesEnum.Init: {
                state.isRunning = false
                break
            }
            case TargetStatesEnum.Preparing: {
                state.isRunning = false
                switch (data.action) {
                    case ActionsEnum.Hack: {
                        state.hack = new TargetJobData({
                            threads: data.threads,
                            amount: data.expectedAmount,
                            duration: data.expectedDuration,
                            delay: data.delay,
                        })
                        break
                    }
                    case ActionsEnum.Grow: {
                        state.grow = new TargetJobData({
                            threads: data.threads,
                            amount: data.expectedAmount,
                            duration: data.expectedDuration,
                            delay: data.delay,
                        })
                        break
                    }
                    case ActionsEnum.Weaken: {
                        if (state.grow) {
                            state.weakenGrow = new TargetJobData({
                                threads: data.threads,
                                amount: data.expectedAmount,
                                duration: data.expectedDuration,
                                delay: data.delay,
                            })
                            this.#finalizeBatching(state)
                        } else {
                            state.weakenHack = new TargetJobData({
                                threads: data.threads,
                                amount: data.expectedAmount,
                                duration: data.expectedDuration,
                                delay: data.delay,
                            })
                        }
                        break
                    }

                }
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

    /**
     *
     * @param {TargetState} state
     */
    #finalizeBatching(state) {
        const times = this.#computeBatch(state)
        state.hack.delay = times[0][0]
        state.weakenHack.delay = times[1][0]
        state.grow.delay = times[2][0]
        state.weakenGrow.delay = times[3][0]

        const pipelineLength = Math.max(state.hack.duration, state.weakenHack.duration, state.grow.duration, state.weakenGrow.duration) - Math.min(state.hack.duration, state.weakenHack.duration, state.grow.duration, state.weakenGrow.duration)
        state.expectedRevenue = state.hack.amount / pipelineLength
        state.state = TargetStatesEnum.Batching
    }

    /**
     *
     * @param {TargetState} state
     */
    #computeBatch(state) {
        const times = [
            [
                state.weakenHack.duration - 3 * scriptOffset - state.hack.duration,
                state.weakenHack.duration - 3 * scriptOffset,
            ],
            [
                state.weakenHack.duration - 2 * scriptOffset - state.weakenHack.duration,
                state.weakenHack.duration - 2 * scriptOffset,
            ],
            [
                state.weakenHack.duration - scriptOffset - state.grow.duration,
                state.weakenHack.duration - scriptOffset,
            ],
            [
                0,
                state.weakenGrow.duration,
            ],
        ]

        const offset = Math.min(times[0][0], times[1][0], times[2][0], times[3][0])
        for (let i = 0; i < times.length; i++) {
            times[i][0] -= offset
            times[i][1] -= offset
        }
        return times
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
    Preparing: "preparing",
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

const scriptOffset = 250
