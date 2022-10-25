/** @param {NS} ns **/
export async function main(ns) {
    const flags = ns.flags([
        [
            "kill",
            false,
        ],
        [
            "host",
            "home",
        ],
        [
            "share",
            false,
        ],
    ])

    if (flags.kill) {

        const serversAll = new Set()
        const servers = [flags.host]
        while (servers.length > 0) {
            const srv = servers.shift()
            if (serversAll.has(srv)) {
                continue
            }
            serversAll.add(srv)
            for (const nei of ns.scan(srv)) {
                servers.push(nei)
            }
        }

        for (const srv of Array.from(serversAll)) {
            ns.scriptKill(script, srv)
        }
        return
    }

    ns.tprint(flags)

    if (!flags.share) {
        tryShare(ns, "home")
        for (const nei of ns.scan(flags.host)) {
            ns.exec(script, nei, 1, "--share", false, "--host", nei)
        }
    } else {
        while (true) {
            await ns.share()
        }
    }
}

function tryShare(ns, host) {
    const available = Math.floor((ns.getServerMaxRam(host)  - ns.getServerUsedRam(host)) / 7.10)
    if (available > 0) {
        ns.exec(script, host, available, "--share", true, "--host", host)
    }
}

const script = "share.js"
