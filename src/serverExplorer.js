import {ServerData, loadServerData, saveServerData} from "src/models/serverData.js"
import {formatMoney} from "src/utils/utils.js"
import {Files} from "src/utils/constants"

/** @param {NS} ns */
export async function main(ns) {
    const ar = ns.args[0] ?? ""
    const continuous = ar.includes("c")
    const restartScripts = ar.includes("r")
    const exploreParams = {
        restartScripts,
    }
    const lfn = continuous
        ? ns.print
        : ns.tprint

    for (const muted of mutedFunctions) {
        ns.disableLog(muted)
    }

    do {
        ns.clearLog()
        const start = Date.now()
        lfn(`Current iteration: ${new Date().toTimeString()}`)

        const index = loadServerData(ns, lfn)

        if (!index.size) {
            const home = new ServerData("home")
            home.ttl = 0
            home.maxRamPercentage = 0.95
            home.note = "home"
            index.set(home.serverName, home)
        }

        const originalServersCount = index.size
        const knownServers = Array.from(index.values())
        for (const server of knownServers) {
            await exploreHost(ns, index, server, exploreParams, lfn)
        }

        saveServerData(ns, index, lfn)
        lfn(`Iteration done in ${Date.now() - start} ms`)

        if (continuous) {
            await ns.sleep(index.size > originalServersCount
                ? 500
                : 10000)
        }

    } while (continuous)
}

/**
 * @param {NS} ns
 * @param {Map<string, ServerData>} index
 * @param {ServerData} hostData
 * @param {{restartScripts:boolean}} exploreParams
 * @param {(...args: any[]) => void} lfn
 * @returns {Promise<void>}
 */
async function exploreHost(ns, index, hostData, exploreParams, lfn) {
    const server = hostData.serverName

    const neighbours = ns.scan(server)
    for (const neighbour of neighbours) {
        if (!index.has(neighbour)) {
            const newNeighbour = new ServerData(neighbour)
            newNeighbour.ttl = (hostData.ttl ?? 0) + 1
            newNeighbour.parent = server
            index.set(neighbour, newNeighbour)
        }
    }

    const currentHackLevel = ns.getHackingLevel()
    hostData.hasAdmin = ns.hasRootAccess(server)
    hostData.reqHackLevel = ns.getServerRequiredHackingLevel(server)
    if (!hostData.hasAdmin && hostData.reqHackLevel <= currentHackLevel) {
        open(ns, server)
    }
    // we don't have access
    if (!hostData.hasAdmin) {
        hostData.scriptingAvailable = false // we need to clean up after augumentation
        return
    }

    const maxRamAvailable = ns.getServerMaxRam(server) * (hostData.maxRamPercentage ?? 1)
    hostData.scriptingAvailable = Math.floor(maxRamAvailable / moneyScriptRam) > 0

    if (!hostData.scriptingAvailable) {
        hostData.note = `Not enough ram - req: ${moneyScriptRam}, has ${maxRamAvailable}`
        return
    }

    if (server === "home") {
        return
    }
    for (const script of copyScripts) {
        if (exploreParams.restartScripts || !ns.fileExists(script, server)) {
            ns.scriptKill(script, server)

            if (ns.fileExists(script, server)) {
                ns.rm(script, server)
            }
            await ns.scp(script, server)
        }
    }

}

/**
 * @param {NS} ns
 * @param {string} target
 * @returns {boolean} has root access
 */
function open(ns, target) {

    let opened = 0
    if (ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(target)
        opened++
    }

    if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(target)
        opened++
    }

    if (ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(target)
        opened++
    }

    if (ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(target)
        opened++
    }

    if (ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(target)
        opened++
    }

    if (ns.getServerNumPortsRequired(target) <= opened) {
        ns.nuke(target)
    }
    return ns.hasRootAccess(target)
}

const mutedFunctions = [
    "getServerRequiredHackingLevel",
    "getHackingLevel",
    "scan",
    "getServerMaxRam",
    "getServerMaxMoney",
    "scp",
    "sleep",
    "getServerMoneyAvailable",
    "brutessh",
    "ftpcrack",
    "relaysmtp",
    "httpworm",
    "sqlinject",
    "getServerNumPortsRequired",
]
const copyScripts = [
    Files.HackScript,
    Files.UtilsConstants,
]
const moneyScriptRam = 2 // getScriptRam returned null instead of 2;
