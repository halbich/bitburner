import {ActionsEnum, Files, PortAllocations, IterationLength, SlotSize} from "src/utils/constants"
import {getNextSleepForSlot} from "src/utils/slots"

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
            const fileContent = ns.read(Files.TargetStates)
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
            state.isRunning = true

            switch (state.state) {
                case TargetStatesEnum.Init: {
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
     * @param {NS} ns
     */
    processJobMessage(data, ns) {
        const state = this.states.get(data.server)
        if (!state) {
            return
        }

        ns.tprint(data)

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
                            this.#finalizeBatching(state, ns)
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
            await ns.write(Files.TargetStates, JSON.stringify(statesArray, null, 4), "w")
        } catch (a) {
            lfn("!!! Error in saving jobState ", a)
        }
    }

    /**
     *
     * @param {TargetState} state
     * @param {NS} ns
     */
    #finalizeBatching(state, ns) {
        ns.tprint("finalize")
        state.hack.duration = Math.ceil(ns.getHackTime(state.server))
        state.weakenHack.duration = Math.ceil(ns.getWeakenTime(state.server))
        state.grow.duration = Math.ceil(ns.getGrowTime(state.server))
        state.weakenGrow.duration = Math.ceil(ns.getWeakenTime(state.server))
        ns.tprint(state)
        const times = this.#computeBatch(state)
        const offset = (getNextSleepForSlot(1, 1, times[0][0] + state.hack.duration) + IterationLength) % IterationLength + 10
        ns.tprint(offset)
        state.hack.delay = times[0][0] + offset
        state.weakenHack.delay = times[1][0] + offset
        state.grow.delay = times[2][0] + offset
        state.weakenGrow.delay = times[3][0] + offset

        ns.tprint(state.hack.delay + state.hack.duration)
        ns.tprint(state.weakenHack.delay + state.weakenHack.duration)
        ns.tprint(state.grow.delay + state.grow.duration)
        ns.tprint(state.weakenGrow.delay + state.weakenGrow.duration)

        ns.tprint((state.hack.delay + state.hack.duration) % IterationLength)
        ns.tprint((state.weakenHack.delay + state.weakenHack.duration) % IterationLength)
        ns.tprint((state.grow.delay + state.grow.duration) % IterationLength)
        ns.tprint((state.weakenGrow.delay + state.weakenGrow.duration) % IterationLength)

        const pipelineLength = Math.max(state.hack.duration, state.weakenHack.duration, state.grow.duration, state.weakenGrow.duration) - Math.min(state.hack.duration, state.weakenHack.duration, state.grow.duration, state.weakenGrow.duration)
        state.expectedRevenue = state.hack.amount / pipelineLength
        state.state = TargetStatesEnum.Batching
        state.totalThreads = state.hack.threads + state.weakenHack.threads + state.grow.threads + state.weakenGrow.threads
    }

    /**
     *
     * @param {TargetState} state
     */
    #computeBatch(state) {
        const times = [
            [
                state.weakenGrow.duration - 3 * SlotSize - state.hack.duration,
                state.weakenGrow.duration - 3 * SlotSize,
            ],
            [
                state.weakenGrow.duration - 2 * SlotSize - state.weakenHack.duration,
                state.weakenGrow.duration - 2 * SlotSize,
            ],
            [
                state.weakenGrow.duration - SlotSize - state.grow.duration,
                state.weakenGrow.duration - SlotSize,
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
