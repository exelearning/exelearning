'use strict';

const VALID_GROUP_SIZES = new Set([1, 2, 4, 8, 16]);

function popcount(value) {
    let remaining = value;
    let count = 0;
    while (remaining !== 0) {
        remaining &= remaining - 1;
        count += 1;
    }
    return count;
}

function validateKmapGroup({ variableCount, cells, values }) {
    const size = cells.length;
    if (!VALID_GROUP_SIZES.has(size) || size > 2 ** variableCount) {
        return { valid: false, reason: 'invalidSize' };
    }

    const varyMask = cells.reduce((mask, cell) => mask | (cell ^ cells[0]), 0);
    if (popcount(varyMask) !== Math.log2(size)) {
        return { valid: false, reason: 'notRectangle' };
    }

    if (cells.some(cell => values[cell] === '0')) {
        return { valid: false, reason: 'containsZero' };
    }

    return { valid: true };
}

module.exports = { validateKmapGroup };
