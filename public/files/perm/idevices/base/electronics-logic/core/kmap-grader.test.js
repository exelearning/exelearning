/**
 * Unit tests for deterministic Karnaugh-map grading.
 */

const core = require('./boolean-core.js');
const { WEIGHTS, gradeKmapResponse } = require('./kmap-grader.js');

function createExpected(overrides = {}) {
    return core.mintermsToVector({
        variables: ['A', 'B', 'C', 'D'],
        minterms: [0, 2, 8, 10, 12, 14],
        dontCares: [4],
        ...overrides,
    });
}

function correctCells(expected) {
    return core.vectorToKmapModel(expected).cells.map(row => row.map(cell => String(cell.value)));
}

function grade(expected, groups, cells = correctCells(expected)) {
    return gradeKmapResponse({
        expected,
        response: { cells, groups },
        variableCount: expected.variables.length,
        maxScore: 10,
    });
}

describe('Karnaugh-map deterministic grader', () => {
    it("awards 10/10 for correct cells and minimal wraparound groups with overlap and a don't-care", () => {
        const expected = createExpected();
        const result = grade(expected, [
            { id: 'g1', cells: [0, 2, 8, 10] },
            { id: 'g2', cells: [8, 10, 12, 14] },
        ]);

        expect(WEIGHTS).toEqual({ cells: 0.3, groups: 0.4, sop: 0.3 });
        expect(result.score).toBe(10);
        expect(result.checks.every(check => check.passed)).toBe(true);
        expect(result.checks.find(check => check.id === 'kmap-sop-minimal')).toMatchObject({
            passed: true,
            expected: '2 nhóm, 4 literal',
            actual: '2 nhóm, 4 literal',
            solution: '!B*!D+A*!D',
        });
    });

    it("scores cells independently and accepts every learner value for a don't-care cell", () => {
        const expected = createExpected();
        const cells = correctCells(expected);
        const model = core.vectorToKmapModel(expected).cells;
        const dontCare = model.flat().find(cell => cell.index === 4);
        cells[dontCare.row][dontCare.column] = '0';
        const wrong = model.flat().find(cell => cell.index === 1);
        cells[wrong.row][wrong.column] = '1';

        const result = grade(
            expected,
            [
                { id: 'g1', cells: [0, 2, 8, 10] },
                { id: 'g2', cells: [8, 10, 12, 14] },
            ],
            cells,
        );

        expect(result.checks.find(check => check.id === 'kmap-cell-4')).toMatchObject({ passed: true, actual: '0' });
        expect(result.checks.find(check => check.id === 'kmap-cell-1')).toMatchObject({ passed: false, actual: '1' });
        expect(result.score).toBe(9.8125);
    });

    it('reduces group score proportionally and fails both SOP checks when required minterms are uncovered', () => {
        const result = grade(createExpected(), [{ id: 'g1', cells: [0, 2, 8, 10] }]);

        expect(result.score).toBe(5.8571);
        expect(result.checks.find(check => check.id === 'kmap-coverage-12')).toMatchObject({
            passed: false,
            actual: 'not-covered',
        });
        expect(result.checks.find(check => check.id === 'kmap-coverage-14').passed).toBe(false);
        expect(result.checks.find(check => check.id === 'kmap-sop-equivalence').passed).toBe(false);
        expect(result.checks.find(check => check.id === 'kmap-sop-minimal')).toMatchObject({
            passed: false,
            actual: 'not-equivalent',
            solution: '!B*!D+A*!D',
        });
    });

    it('rejects a group touching an expected zero and does not count it toward coverage', () => {
        const result = grade(createExpected(), [{ id: 'wrong', cells: [0, 1] }]);

        expect(result.checks.find(check => check.id === 'kmap-group-wrong')).toEqual({
            id: 'kmap-group-wrong',
            passed: false,
            expected: 'valid-group',
            actual: 'containsZero',
        });
        expect(result.checks.find(check => check.id === 'kmap-coverage-0').passed).toBe(false);
        expect(result.score).toBe(3);
    });

    it('uses one passing aggregate group check for the all-zero function without dividing by zero', () => {
        const expected = createExpected({ variables: ['A', 'B'], minterms: [], dontCares: [] });
        const result = grade(expected, []);

        expect(result.score).toBe(10);
        expect(result.checks).toContainEqual({
            id: 'kmap-groups-not-required',
            passed: true,
            expected: 'no-groups-needed',
            actual: 'no-groups-needed',
        });
        expect(result.checks.find(check => check.id === 'kmap-sop-minimal')).toMatchObject({
            passed: true,
            expected: '0 nhóm, 0 literal',
            solution: '0',
        });
    });

    it('judges minimality by cost rather than comparing a saved grouping pattern', () => {
        const expected = createExpected({ variables: ['A', 'B', 'C'], minterms: [0, 1, 2], dontCares: [3] });
        const result = grade(expected, [{ id: 'learner-choice', cells: [0, 1, 2, 3] }]);

        expect(result.score).toBe(10);
        expect(result.checks.find(check => check.id === 'kmap-sop-minimal')).toMatchObject({
            passed: true,
            expected: '1 nhóm, 1 literal',
            actual: '1 nhóm, 1 literal',
            solution: '!A',
        });
    });
});
