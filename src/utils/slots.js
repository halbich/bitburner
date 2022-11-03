import {IterationLength, SlotSize} from "src/utils/constants"

/**
 * @param {number} slotId
 * @param {number} sleepTime
 * @param {number} now
 * @returns {number}
 */
export function getNextSleepForSlot(slotId, sleepTime = 0, now = Date.now()) {
    const slot = (now + sleepTime) % IterationLength

    if (slotId * SlotSize <= slot && slot < (slotId + 1) * SlotSize) {
        return sleepTime > 0
            ? Math.max(20, sleepTime - slot % SlotSize)
            : 0
    } else {
        return sleepTime > 0
            ? Math.max(20, sleepTime - slot + slotId * SlotSize)
            : IterationLength - slot
    }
}


