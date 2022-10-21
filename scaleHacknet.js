import {formatMoney} from "src/utils/utils.js"

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("getServerMoneyAvailable")
    ns.disableLog("sleep")
    const ha = ns.hacknet
    //1% of current funds, per cycle.
    const allowancePercentage = 0.01
    while (true) {
        let upgraded = false
        ns.clearLog()
        for (let i = 0; i < ha.numNodes(); i++) {
            const gain = [
                0,
                0,
                0,
            ]
            const currentCash = ns.getServerMoneyAvailable("home") * allowancePercentage

            if (ha.getPurchaseNodeCost() <= currentCash) {
                ha.purchaseNode()
            }

            const node = ha.getNodeStats(i)
            const levelCost = ha.getLevelUpgradeCost(i, 1)
            const ramCost = ha.getRamUpgradeCost(i, 1)
            const coreCost = ha.getCoreUpgradeCost(i, 1)

            if (node.level < 200) {
                gain[0] = ((node.level + 1) * 1.6) * Math.pow(1.035, (node.ram - 1)) * ((node.cores + 5) / 6) / levelCost
            } else {
                gain[0] = 0
            }

            if (node.ram < 64) {
                gain[1] = (node.level * 1.6) * Math.pow(1.035, (node.ram * 2) - 1) * ((node.cores + 5) / 6) / ramCost
            } else {
                gain[1] = 0
            }

            if (node.cores < 16) {
                gain[2] = (node.level * 1.6) * Math.pow(1.035, node.ram - 1) * ((node.cores + 6) / 6) / coreCost
            } else {
                gain[2] = 0
            }

            ns.print("Server ", i, " Level / Ram / Core Upgrade:", gain[0], " ", gain[1], " ", gain[2])
            ns.print("Server ", i, " (", formatMoney(currentCash), ") costs: ", formatMoney(levelCost), " / ", formatMoney(ramCost), " / ", formatMoney(coreCost))

            let topgain = gain[0]

            for (let j = 1; j < 3; j++) {
                if (gain[j] > topgain) {
                    topgain = gain[j]
                }
            }

            if (topgain === 0) {
                ns.print("All Gains maxed on Node " + i)
                continue
            }

            if (topgain === gain[0] && levelCost < currentCash) {
                ns.print("Upgrading Level on Node " + i)
                ha.upgradeLevel(i, 1)
                upgraded = true
            } else if (topgain === gain[1] && ramCost < currentCash) {
                ns.print("Upgrading Ram on Node " + i)
                ha.upgradeRam(i, 1)
                upgraded = true
            } else if (topgain === gain[2] && coreCost < currentCash) {
                ns.print("Upgrading Core on Node " + i)
                ha.upgradeCore(i, 1)
                upgraded = true
            } else {
                ns.print("Cannot afford upgrades on Node " + i)
            }
        }
        await ns.sleep(upgraded
            ? 500
            : 10000)
    }
}

