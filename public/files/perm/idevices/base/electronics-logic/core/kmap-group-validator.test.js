const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const currentDirectory = dirname(require.resolve('./kmap-group-validator.js'));
const { validateKmapGroup } = require('./kmap-group-validator.js');

function createValues(variableCount, entries = {}) {
    const values = Array(2 ** variableCount).fill('');
    Object.entries(entries).forEach(([index, value]) => {
        values[Number(index)] = value;
    });
    return values;
}

describe('Karnaugh group validator', () => {
    it('is a pure CommonJS module without DOM, Electron, eval, or Function dependencies', () => {
        const source = readFileSync(join(currentDirectory, 'kmap-group-validator.js'), 'utf-8');

        expect(source).toContain('module.exports');
        expect(source).not.toMatch(/\b(?:document|window|electron)\b/i);
        expect(source).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    });

    it.each([
        [2, []],
        [2, [0, 1, 2]],
        [3, [0, 1, 2, 3, 4]],
        [3, [0, 1, 2, 3, 4, 5]],
        [3, [0, 1, 2, 3, 4, 5, 6]],
        [4, [0, 1, 2, 3, 4, 5, 6, 7, 8]],
        [2, [0, 1, 2, 3, 4, 5, 6, 7]],
    ])('rejects invalid group size for %i variables: %j', (variableCount, cells) => {
        expect(validateKmapGroup({ variableCount, cells, values: createValues(variableCount) })).toEqual({
            valid: false,
            reason: 'invalidSize',
        });
    });

    it('rejects a power-of-two group that is not a rectangle in Gray space', () => {
        expect(
            validateKmapGroup({
                variableCount: 3,
                cells: [0, 1, 2, 4],
                values: createValues(3),
            }),
        ).toEqual({ valid: false, reason: 'notRectangle' });
    });

    it('accepts a four-corner wraparound group on a four-variable map', () => {
        expect(
            validateKmapGroup({
                variableCount: 4,
                cells: [0, 2, 8, 10],
                values: createValues(4, { 0: '1', 2: 'X', 8: '', 10: '1' }),
            }),
        ).toEqual({ valid: true });
    });

    it.each([
        [2, [0]],
        [2, [0, 1]],
        [3, [0, 2, 4, 6]],
        [4, Array.from({ length: 16 }, (_, index) => index)],
    ])('accepts rectangular groups at the %i-variable boundary', (variableCount, cells) => {
        expect(validateKmapGroup({ variableCount, cells, values: createValues(variableCount) })).toEqual({
            valid: true,
        });
    });

    it('rejects a rectangular group containing a current zero value', () => {
        expect(
            validateKmapGroup({
                variableCount: 2,
                cells: [0, 1],
                values: createValues(2, { 0: '1', 1: '0' }),
            }),
        ).toEqual({ valid: false, reason: 'containsZero' });
    });

    it('allows empty and X values in an otherwise valid group', () => {
        expect(
            validateKmapGroup({
                variableCount: 2,
                cells: [0, 1],
                values: createValues(2, { 0: '', 1: 'X' }),
            }),
        ).toEqual({ valid: true });
    });

    it('short-circuits size and rectangle errors before checking zero values', () => {
        expect(
            validateKmapGroup({
                variableCount: 3,
                cells: [0, 1, 2],
                values: createValues(3, { 0: '0' }),
            }),
        ).toEqual({ valid: false, reason: 'invalidSize' });
        expect(
            validateKmapGroup({
                variableCount: 3,
                cells: [0, 1, 2, 4],
                values: createValues(3, { 0: '0' }),
            }),
        ).toEqual({ valid: false, reason: 'notRectangle' });
    });
});
