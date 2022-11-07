import {ActionsEnum, Files, PortAllocations, IterationOffset} from "src/utils/constants"
import {colorCode, ColorEnum, Colors} from "src/utils/utils"

export class TargetJobAction {
    /**
     *
     * @param {string} action
     * @param {boolean} isBegin
     * @param {boolean} isStart
     */
    constructor({
                    action,
                    isBegin,
                    isStart,
                }) {
        this.action = action
        this.isBegin = isBegin
        this.isStart = isStart
    }
}

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
     * @param {number} runningJobs
     * @param {TargetJobData} hack
     * @param {TargetJobData} weakenHack
     * @param {TargetJobData} grow
     * @param {TargetJobData} weakenGrow
     * @param {number} totalThreads
     * @param {number} expectedRevenue
     * @param {TargetJobAction[]} batchData
     */
    constructor({
                    server,
                    state,
                    runningJobs,
                    hack,
                    weakenHack,
                    grow,
                    weakenGrow,
                    totalThreads,
                    expectedRevenue,
                    batchData,
                }) {
        this.server = server
        this.state = state
        this.runningJobs = runningJobs ?? 0

        this.hack = hack
        this.weakenHack = weakenHack
        this.grow = grow
        this.weakenGrow = weakenGrow

        this.totalThreads = totalThreads
        this.expectedRevenue = expectedRevenue
        this.batchData = batchData
    }

    canStartBatch() {
        if (!this.batchData?.length) {
            return false
        }
        const now = Math.floor(Date.now() / IterationOffset)
        const currentIndex = now % this.batchData.length
        return this.batchData[currentIndex]?.isStart ?? false
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
     * @param {NS} ns
     * @param {(...args: any[]) => void} lfn
     */
    processStateMessage(message, ns, lfn) {
        if (message.startsWith(MessagesEnum.Init)) {
            const name = message.substring(MessagesEnum.Init.length)
            const newState = new TargetState({
                server: name,
                state: TargetStatesEnum.Init,
            })
            this.states.set(newState.server, newState)
        } else if (message.startsWith(MessagesEnum.Recompute)) {
            const name = message.substring(MessagesEnum.Recompute.length)
            const state = this.states.get(name)
            if (!state) {
                return
            }

            this.#computeBatchParams(state, ns)
        } else if (message.startsWith(MessagesEnum.Running)) {
            const data = message.substring(MessagesEnum.Running.length).split(";")
            const state = this.states.get(data[0])
            if (!state) {
                return
            }
            state.runningJobs++

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
     * totalDuration: number;
     * }} data
     * @param {NS} ns
     */
    processJobMessage(data, ns) {
        const state = this.states.get(data.server)
        if (!state) {
            return
        }

        const pdata = {
            exAm: data.expectedAmount,
            am: data.amount,
            exDur: data.expectedDuration,
            dur: data.duration,
            total: data.totalDuration,
        }
        //ns.tprint(pdata)
        state.runningJobs--

        switch (state.state) {

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
     * @param {*} totalLength
     * @param {number} step
     * @param {number} hackB
     * @param {number} hackE
     * @param {number} weakenHackB
     * @param {number} weakenHackE
     * @param {number} growB
     * @param {number} growE
     * @param {number} weakenGrowB
     * @param {number} weakenGrowE
     * @return {{actionArray: TargetJobAction[]; startData: number[] }}
     *
     */
    #computeArrayForBatch(totalLength, step, hackB, hackE, weakenHackB, weakenHackE, growB, growE, weakenGrowB, weakenGrowE) {
        const actionArray = new Array(totalLength)
        const startData = []
        for (let start = 0; start < totalLength; start += step) {

            const _hackB = (hackB + start + totalLength) % totalLength
            const _hackE = (hackE + start + totalLength) % totalLength
            const _weakenHackB = (weakenHackB + start + totalLength) % totalLength
            const _weakenHackE = (weakenHackE + start + totalLength) % totalLength
            const _growB = (growB + start + totalLength) % totalLength
            const _growE = (growE + start + totalLength) % totalLength
            const _weakenGrowB = (weakenGrowB + start + totalLength) % totalLength
            const _weakenGrowE = (weakenGrowE + start + totalLength) % totalLength

            if (!actionArray[start] &&
                !actionArray[_hackB] && !actionArray[_hackE] &&
                !actionArray[_weakenHackB] && !actionArray[_weakenHackE] &&
                !actionArray[_growB] && !actionArray[_growE] &&
                !actionArray[_weakenGrowB] && !actionArray[_weakenGrowE]) {

                startData.push(start)

                actionArray[start] = new TargetJobAction({
                    action: "start",
                    isBegin: true,
                    isStart: true,
                })

                actionArray[_hackB] = new TargetJobAction({
                    action: ActionsEnum.Hack,
                    isBegin: true,
                    isStart: _hackB === start,
                })
                actionArray[_hackE] = new TargetJobAction({
                    action: ActionsEnum.Hack,
                    isBegin: false,
                    isStart: _hackE === start,
                })

                actionArray[_weakenHackB] = new TargetJobAction({
                    action: ActionsEnum.WeakenHack,
                    isBegin: true,
                    isStart: _weakenHackB === start,
                })
                actionArray[_weakenHackE] = new TargetJobAction({
                    action: ActionsEnum.WeakenHack,
                    isBegin: false,
                    isStart: _weakenHackE === start,
                })

                actionArray[_growB] = new TargetJobAction({
                    action: ActionsEnum.Grow,
                    isBegin: true,
                    isStart: _growB === start,
                })
                actionArray[_growE] = new TargetJobAction({
                    action: ActionsEnum.Grow,
                    isBegin: false,
                    isStart: _growE === start,
                })

                actionArray[_weakenGrowB] = new TargetJobAction({
                    action: ActionsEnum.WeakenGrow,
                    isBegin: true,
                    isStart: _weakenGrowB === start,
                })
                actionArray[_weakenGrowE] = new TargetJobAction({
                    action: ActionsEnum.WeakenGrow,
                    isBegin: false,
                    isStart: _weakenGrowE === start,
                })

                for (let i = _hackE; i < _weakenGrowE; i++) {
                    if (!actionArray[i]) {
                        actionArray [i] = new TargetJobAction({
                            action: "none",
                            isBegin: false,
                            isStart: false,
                        })
                    }
                }
            }

        }

        return {
            actionArray,
            startData,
        }
    }

    /**
     * @param {TargetState} state
     * @param {NS} ns
     */
    #computeBatchParams(state, ns) {
        const {server} = state
        const hackMoney = 0.5 * ns.getServerMaxMoney(server)
        const hackThreads = Math.floor(ns.hackAnalyzeThreads(server, hackMoney))
        const hackTime = Math.ceil(ns.getHackTime(server))

        const hackSecurity = ns.hackAnalyzeSecurity(hackThreads, server)
        let hackWeakenThreads = 0
        while (ns.weakenAnalyze(hackWeakenThreads) < hackSecurity) {
            hackWeakenThreads++
        }
        const weakenTime = Math.ceil(ns.getWeakenTime(server))

        const growThreads = Math.ceil(ns.growthAnalyze(server, 2))
        const growSecurity = 2 * 0.002 * growThreads // ns.growthAnalyzeSecurity(growThreads, target.server, 1)
        let weakenGrowThreads = 0
        while (ns.weakenAnalyze(weakenGrowThreads) < growSecurity) {
            weakenGrowThreads++
        }
        const growTime = Math.ceil(ns.getGrowTime(server))

        const times = this.#computeBatch(hackTime, weakenTime, growTime)
        const hackDelay = times[0][0]
        const weakenHackDelay = times[1][0]
        const growDelay = times[2][0]
        const weakenGrowDelay = times[3][0]

        const getIndex = (time) => {
            return Math.floor((time) / IterationOffset)
        }
        const totalLength = getIndex(weakenGrowDelay + weakenTime) + 1

        const hackB = getIndex(hackDelay)
        const hackE = getIndex(hackDelay + hackTime)
        const weakenHackB = getIndex(weakenHackDelay)
        const weakenHackE = getIndex(weakenHackDelay + weakenTime)
        const growB = getIndex(growDelay)
        const growE = getIndex(growDelay + growTime)
        const weakenGrowB = getIndex(weakenGrowDelay)
        const weakenGrowE = getIndex(weakenGrowDelay + weakenTime)

        let {
            actionArray,
            startData,
        } = this.#computeArrayForBatch(totalLength, 1, hackB, hackE, weakenHackB, weakenHackE, growB, growE, weakenGrowB, weakenGrowE)

        for (let i = 2; i < 20; i++) {
            const solution = this.#computeArrayForBatch(totalLength, i, hackB, hackE, weakenHackB, weakenHackE, growB, growE, weakenGrowB, weakenGrowE)
            if (solution.startData.length > startData.length) {
                actionArray = solution.actionArray
                startData = solution.startData
            }
        }

        state.hack = new TargetJobData({
            amount: hackMoney,
            threads: hackThreads,
            duration: hackTime,
            delay: hackDelay,
        })
        state.weakenHack = new TargetJobData({
            amount: hackSecurity,
            threads: hackWeakenThreads,
            duration: weakenTime,
            delay: weakenHackDelay,
        })
        state.grow = new TargetJobData({
            amount: 2,
            threads: growThreads,
            duration: growTime,
            delay: growDelay,
        })
        state.weakenGrow = new TargetJobData({
            amount: growSecurity,
            threads: weakenGrowThreads,
            duration: weakenTime,
            delay: weakenGrowDelay,
        })

        state.totalThreads = state.hack.threads + state.weakenHack.threads + state.grow.threads + state.weakenGrow.threads
        state.expectedRevenue = startData.length * state.hack.amount / (state.weakenGrow.delay + state.weakenGrow.duration)
        state.batchData = actionArray
        state.state = TargetStatesEnum.Batching
    }

    /**
     *
     * @param {number} hackDuration
     * @param {number} weakenDuration
     * @param {number} growDuration
     * @returns {number[][]}
     */
    #computeBatch(hackDuration, weakenDuration, growDuration) {
        const times = [
            [
                weakenDuration - 3 * IterationOffset - hackDuration,
                weakenDuration - 3 * IterationOffset,
            ],
            [
                weakenDuration - 2 * IterationOffset - weakenDuration,
                weakenDuration - 2 * IterationOffset,
            ],
            [
                weakenDuration - IterationOffset - growDuration,
                weakenDuration - IterationOffset,
            ],
            [
                0,
                weakenDuration,
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
    Recompute: "recompute:",
    Running: "running:",
}

export const TargetStatesEnum = {
    Init: "init",
    Batching: "batching",
    Preparing: "preparing",
    Repairing: "repairing",
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
 */
export function recomputeServer(ns, server) {
    ns.writePort(PortAllocations.TargetState, MessagesEnum.Recompute + server).then()
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
