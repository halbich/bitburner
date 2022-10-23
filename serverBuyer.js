import {formatMoney} from "src/utils/utils.js"

/** @param {NS} ns */
export async function main(ns) {


    const money = ns.getPlayer().money
    const available = []
    for (let i = 1; i < 21; i++) {
        const cost = ns.getPurchasedServerCost(Math.pow(2, i))
        if (cost <= money) {
            available.push({
                i,
                cost,
            })
        }
        ns.tprint(`${i}: ${formatMoney(cost)}`)
    }

    while (available.length > 3) {
        available.shift()
    }

    const choiceMap = new Map()
    const choices = available.map((item) => {
        const str = `${item.i}: ${formatMoney(item.cost)}`
        choiceMap.set(str, item.i)
        return str
    })
    choices.unshift("-")
    const toBuy = await ns.prompt("Buy server?", {
        type: "select",
        choices,
    })
    const i = choiceMap.get(toBuy)
    if (!i) {
        return
    }
    ns.purchaseServer("runner", Math.pow(2, i))

}
