import {ServerData, loadServerData, saveServerData} from "src/serverData.js"
import {formatMoney} from "src/utils/utils.js"

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
        lfn(`Current iteration: ${new Date().toISOString()}`)
        const index = loadServerData(ns, lfn)

        if (!index.size) {
            const home = new ServerData("home")
            home.ttl = 0
            home.maxRamPercentage = 0.9
            home.note = "home"
            index.set(home.serverName, home)
        }

        const originalServersCount = index.size
        const knownServers = Array.from(index.values())
        for (const server of knownServers) {
            await exploreHost(ns, index, server, exploreParams, lfn)
        }

        printStats(ns, index, lfn)

        saveServerData(ns, index, lfn)
        lfn("Iteration done")
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
        hostData.threadsAvailable = null // we need to clean up after augumentation
        return
    }

    const maxRamAvailable = ns.getServerMaxRam(server) * (hostData.maxRamPercentage ?? 1)
    hostData.threadsAvailable = Math.floor(maxRamAvailable / moneyScriptRam)

    if (!hostData.threadsAvailable) {
        hostData.note = `Not enough ram - req: ${moneyScriptRam}, has ${maxRamAvailable}`
        return
    }

    if (exploreParams.restartScripts || !ns.fileExists(moneyScript, server)) {
        ns.scriptKill(moneyScript, server)

        if (server !== "home" && ns.fileExists(moneyScript, server)) {
            ns.rm(moneyScript, server)
        }
        await ns.scp(moneyScript, server)
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

/**
 * @param {NS} ns
 * @param {Map<string, ServerData>} index
 * @param {(...args: any[]) => void} lfn
 * @returns {void}
 */
function printStats(ns, index, lfn) {

    let serversHacked = 0
    let serversScriptsRunning = 0
    let serversScriptsExcluded = 0

    let totalMoney = 0
    let totalMaxMoney = 0

    let hackedMoney = 0
    let hackedMaxMoney = 0
    for (const [sname, server] of index) {
        const money = ns.getServerMoneyAvailable(sname)
        const maxMoney = ns.getServerMaxMoney(sname)

        totalMoney += money
        totalMaxMoney += maxMoney

        if (server.hasAdmin) {
            serversHacked++

            hackedMoney += money
            hackedMaxMoney += maxMoney
        }

        if (server.threadsAvailable > 0) {
            serversScriptsRunning++
        }
    }

    lfn(`Stats:`)
    lfn(`Servers hacked: ${serversHacked}, known: ${index.size}`)
    lfn(`Servers running: ${serversScriptsRunning}, excluded: ${serversScriptsExcluded}`)
    lfn(`Hacked available money: ${formatMoney(hackedMoney)}, max: ${formatMoney(hackedMaxMoney)}`)
    lfn(`All    available money: ${formatMoney(totalMoney)}, max: ${formatMoney(totalMaxMoney)}`)

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
]

const moneyScript = "run.js"
const moneyScriptRam = 2 // getScriptRam returned null instead of 2;
