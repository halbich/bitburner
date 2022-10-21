/**
 * @param {(...args: any[]) => void} lfn
 * @param {any[]} collection
 * @param {(any) => string[]} dataFn
 * @param {{padLeftColumns:number[];displayRowLines:boolean}| null} style
 */
function printTable(lfn, collection, dataFn, style = null) {
    const columnsPadLeft = style?.padLeftColumns ?? []
    const rowLines = style?.displayRowLines ?? false

    const stringData = []
    let hasHeader = false
    const header = dataFn(null, lfn)
    if (header) {
        stringData.push(ensureString(header))
        hasHeader = true
    }

    for (let i = 0; i < collection.length; i++) {
        const data = dataFn(collection[i], lfn)
        if (data) {
            stringData.push(ensureString(data))
        }
    }

    const widths = []
    for (let i = 0; i < stringData.length; i++) {
        const data = stringData[i]
        for (let j = 0; j < data.length; j++) {
            if (widths.length <= j) {
                widths.push(0)
            }
            widths[j] = Math.max(widths[j], data[j].length + 1)
        }
    }

    if (!stringData.length) {
        return
    }

    top(lfn, widths)

    for (let i = 0; i < stringData.length; i++) {
        const dataArray = []
        const textData = stringData[i]
        for (let j = 0; j < textData.length; j++) {
            const res = (hasHeader && i === 0) || columnsPadLeft.includes(j)
                ? textData[j].padEnd(widths[j])
                : textData[j].padStart(widths[j])
            dataArray.push(res)
        }
        data(lfn, dataArray)
        if (rowLines && i < stringData.length - 1) {
            middle(lfn, widths)
        }
    }
    bottom(lfn, widths)

}

const ch = [
    "╔",
    "═",
    "╦",
    "╗",
    "║",
    "╟",
    "─",
    "╫",
    "╢",
    "╚",
    "╩",
    "╝",
]

function ensureString(data) {
    return data.map((d) => {
        return d?.toString() ?? ""
    })
}

/**
 * @param {(...args: any[]) => void} lfn
 * @param {number[]} columnsWidth
 */
function top(lfn, columnsWidth) {
    const result = [ch[0]]
    for (let i = 0; i < columnsWidth.length; i++) {
        for (let j = 0; j < columnsWidth[i]; j++) {
            result.push(ch[1])
        }
        if (i < columnsWidth.length - 1) {
            result.push(ch[2])
        }
    }
    result.push(ch[3])
    lfn(result.join(""))
}

/**
 * @param {(...args: any[]) => void} lfn
 * @param {string[]} columns
 */
function data(lfn, columns) {
    const result = [ch[4]]
    for (let i = 0; i < columns.length; i++) {
        result.push(columns[i])
        if (i < columns.length - 1) {
            result.push(ch[4])
        }
    }
    result.push(ch[4])
    lfn(result.join(""))
}

/**
 * @param {(...args: any[]) => void} lfn
 * @param {number[]} columnsWidth
 */
function middle(lfn, columnsWidth) {
    const result = [ch[5]]
    for (let i = 0; i < columnsWidth.length; i++) {
        for (let j = 0; j < columnsWidth[i]; j++) {
            result.push(ch[6])
        }
        if (i < columnsWidth.length - 1) {
            result.push(ch[7])
        }
    }
    result.push(ch[8])
    lfn(result.join(""))
}

/**
 * @param {(...args: any[]) => void} lfn
 * @param {number[]} columnsWidth
 */
function bottom(lfn, columnsWidth) {
    const result = [ch[9]]
    for (let i = 0; i < columnsWidth.length; i++) {
        for (let j = 0; j < columnsWidth[i]; j++) {
            result.push(ch[1])
        }
        if (i < columnsWidth.length - 1) {
            result.push(ch[10])
        }
    }
    result.push(ch[11])
    lfn(result.join(""))
}

export {printTable}
