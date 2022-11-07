export const PortAllocations = {
    TargetState: 1,
}

export const ActionsEnum = {
    Hack: "hack",
    WeakenHack: "weakenHack",
    Grow: "grow",
    WeakenGrow: "weakenGrow",
}

export const Files = {
    Db: "/data/db.txt",
    TargetStates: "/data/targetStates.txt",

    HacknetScaler: "/src/hacknetScaler.js",
    Planner: "/src/planner.js",
    ServerExplorer: "/src/serverExplorer.js",
    Optimizer: "/src/optimizer.js",
    HackScript: "/src/run.js",
    Share: "share.js",

    UtilsConstants: "/src/utils/constants.js",
    UtilsSlots: "/src/utils/slots.js",

    Dev: "dev.js",

}

export const IterationLength = 1000
export const SlotsCount = 5
export const SlotSize = IterationLength / SlotsCount
export const IterationOffset = 100
