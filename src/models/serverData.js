import {Files} from "src/utils/constants"

class ServerData {

    /**
     * @param {string} name
     */
    constructor(name) {
        this.serverName = name
    }

    /** @returns {string} */
    get serverName() {
        return this._serverName
    }

    set serverName(serverName) {
        this._serverName = serverName
    }

    /** @returns {number | undefined} */
    get ttl() {
        return this._ttl
    }

    set ttl(value) {
        this._ttl = value
    }

    /** @returns {boolean | undefined} */
    get hasAdmin() {
        return this._hasAdmin
    }

    set hasAdmin(value) {
        this._hasAdmin = value
    }

    /** @returns {number | undefined} */
    get reqHackLevel() {
        return this._reqHackLevel
    }

    set reqHackLevel(value) {
        this._reqHackLevel = value
    }

    /** @returns {string | undefined} */
    get note() {
        return this._note
    }

    set note(value) {
        this._note = value
    }

    /** @returns {string | undefined} */
    get parent() {
        return this._parent
    }

    set parent(value) {
        this._parent = value
    }

    /** @returns {number | undefined} */
    get maxRamPercentage() {
        return this._maxRamPercentage
    }

    set maxRamPercentage(value) {
        this._maxRamPercentage = value
    }

    /** @returns {boolean | undefined} */
    get scriptingAvailable() {
        return this._scriptingAvailable
    }

    set scriptingAvailable(value) {
        this._scriptingAvailable = value
    }

    /** @returns {boolean | undefined} */
    get backdoorInstalled() {
        return this._backdoorInstalled
    }

    set backdoorInstalled(value) {
        this._backdoorInstalled = value
    }

    serialize() {
        const result = {
            name: this.serverName,
        }
        for (const property of savedProperties) {
            result[property] = this[property]
        }
        return result
    }

}

function deserialize(object) {
    if (!object.name) {
        throw new Error("Invalid object name")
    }
    const result = new ServerData(object.name)
    for (const property of savedProperties) {
        result[property] = object[property]
    }
    return result
}

/**
 * @param {NS} ns
 * @param {Array<ServerData>} data
 * @returns {Map<string, ServerData>}
 */
function loadIndex(ns, data) {
    const dataIndex = new Map()
    for (const server of data) {
        if (ns.serverExists(server.serverName)) {
            dataIndex.set(server.serverName, server)
        }
    }
    return dataIndex
}

/**
 * @param {NS} ns
 * @param {(...args: any[]) => void} lfn
 * @returns {Map<string, ServerData>}
 */
function loadServerData(ns, lfn) {
    const resArray = []
    try {
        if (!ns.fileExists(Files.Db)) {
            return loadIndex(ns, resArray)
        }

        const fileContent = ns.read(Files.Db)
        const json = JSON.parse(fileContent)
        if (!Array.isArray(json)) {
            return loadIndex(ns, resArray)
        }

        for (const serializedData of json) {
            try {
                resArray.push(deserialize(serializedData))
            } catch {
            }
        }

        return loadIndex(ns, resArray)
    } catch (a) {
        lfn("!!! Error in loading ", a)
        return loadIndex(ns, resArray)
    }
}

/**
 * @param {NS} ns
 * @param {Map<string, ServerData>} index
 * @param {(...args: any[]) => void} lfn
 * @returns {void}
 */
async function saveServerData(ns, index, lfn) {
    try {
        const servers = Array.from(index.keys())
        servers.sort()

        const serialized = []
        for (const server of servers) {
            serialized.push(index.get(server).serialize())
        }

        const json = JSON.stringify(serialized, null, 4)
        await ns.write(Files.Db, json, "w")
    } catch (a) {
        lfn("!!! Error in saving", a)
    }
}

const savedProperties = [
    "hasAdmin",
    "note",
    "reqHackLevel",
    "ttl",
    "maxRamPercentage",
    "scriptingAvailable",
    "parent",
    "backdoorInstalled"
]

export {ServerData, loadServerData, saveServerData}
