
/** @param {NS} ns */
export async function main(ns) {
    let targetServer = home;
    if (ns.serverExists(runnerName)) {
        await safeCopy(ns, autohacker);
        await safeCopy(ns, planner);
        await safeCopy(ns, systemScript);
        await safeCopy(ns, table);
        await safeCopy(ns, utils);
        await safeCopy(ns, autoScaler);
        targetServer = runnerName;
    }

    const target = ns.getScriptRam(systemScript) + ns.getScriptRam(planner) <= ns.getServerMaxRam(targetServer) ? targetServer : home
    ns.tprint(`${targetServer}, ${target}`);

    ns.exec(systemScript, target, 1, "c");
    ns.exec(planner, target, 1, "c");
    ns.exec(autoScaler, target);

}

/**
 * @param {NS} ns
 * @param {string} script
 */
async function safeCopy(ns, script) {
    ns.rm(script, runnerName);
    await ns.scp(script, runnerName);
}

const runnerName = "runner";

const autohacker = "run.js";
const planner = "planner.js";
const autoScaler = "scaleHacknet.js"
const systemScript = "system.js";
const table = "table.js";
const utils = "utils.js";

const home = "home";
