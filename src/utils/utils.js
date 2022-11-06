/**
 * Returns 2.0
 * @returns {number}
 */
export function getRunScriptSize() {
    return 2.0
}

const format = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",

    // These options are needed to round to whole numbers if that's what you want.
    //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
    maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
}).format

/**
 * @param {number} money
 * @returns {string}
 */
export function formatMoney(money) {
    return format(money)
}

export function printInColors() {
    const colors = {
        black: "\u001b[30m",
        red: "\u001b[31m",
        green: "\u001b[32m",
        yellow: "\u001b[33m",
        blue: "\u001b[34m",
        magenta: "\u001b[35m",
        cyan: "\u001b[36m",
        white: "\u001b[37m",
        brightBlack: "\u001b[30;1m",
        brightRed: "\u001b[31;1m",
        brightGreen: "\u001b[32;1m",
        brightYellow: "\u001b[33;1m",
        brightBlue: "\u001b[34;1m",
        brightMagenta: "\u001b[35;1m",
        brightCyan: "\u001b[36;1m",
        brightWhite: "\u001b[37;1m",
        reset: "\u001b[0m",
    }
    for (const key of Object.keys(colors)) {
        ns.tprint(`${colors[key]}${key}`)
    }
}

/**
 * @param {string} text
 * @param {string} color (ColorEnum)
 */
export function colorCode(text, color = ColorEnum.Default) {
    return `${color}${text}${ColorEnum.Default}`
}

/**
 *
 * @param {number} min
 * @param {number} max
 * @param {number} current
 * @param {number} size
 * @param {number} targetThreshold
 * @param {boolean} showPercentage
 * @returns {string}
 */
export function progressBar({
                                min,
                                max,
                                current,
                                size,
                                targetThreshold = 0,
                                showPercentage = true,
                            }) {
    const filli = size * targetThreshold
    const res = []
    const fill = Math.min((current - min) * size / (max - min), size)
    for (let i = 0; i < size; i++) {
        const background = i < filli
            ? "▒"
            : "░"
        res.push(i < fill
            ? "█"
            : background)
    }
    const perc = Math.round((current - min) * 100 / (max - min))
    const percentage = showPercentage
        ? ` ${perc.toString().padStart(3)}%`
        : ""
    return `${res.join("")} ${percentage}`
}



export const ColorEnum = {
    Default: "\u001b[0m",
    Black: "\u001b[30m",
    Red: "\u001b[31m",
    Green: "\u001b[32m",
    Yellow: "\u001b[33m",
    Blue: "\u001b[34m",
    Magenta: "\u001b[35m",
    Cyan: "\u001b[36m",
    White: "\u001b[37m",
    BrightBlack: "\u001b[30;1m",
    BrightRed: "\u001b[31;1m",
    BrightGreen: "\u001b[32;1m",
    BrightYellow: "\u001b[33;1m",
    BrightBlue: "\u001b[34;1m",
    BrightMagenta: "\u001b[35;1m",
    BrightCyan: "\u001b[36;1m",
    BrightWhite: "\u001b[37;1m",
}
