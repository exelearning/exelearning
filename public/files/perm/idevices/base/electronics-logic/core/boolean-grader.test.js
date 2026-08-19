/**
 * Unit tests for deterministic Boolean/truth-table grading.
 */

const grader = require('./boolean-grader.js');
const halfAdder = require('./fixtures/circuit-half-adder.json');

const metadata = {
    attemptId: 'attempt-0001',
    createdAt: '2026-08-12T04:00:00.000Z',
};

function createExercise(overrides = {}) {
    return {
        id: 'exercise-0001',
        type: 'electronics.logic',
        schemaVersion: 1,
        mode: 'truthTable',
        prompt: 'Hoàn thành bảng chân trị.',
        variables: ['A', 'B'],
        authoring: { answerSource: 'minterms' },
        answer: { expression: '', minterms: [1, 2], dontCares: [3] },
        grading: { maxScore: 10 },
        learner: {},
        accessibility: { label: 'Bài tập XOR' },
        ...overrides,
    };
}

describe('Electronics Logic deterministic grader', () => {
    it('dispatches circuit grading and wraps all half-adder checks in GradingResult v1 evidence', () => {
        const exercise = createExercise({
            mode: 'circuit',
            answer: {
                expression: '',
                minterms: [],
                dontCares: [],
                testbench: halfAdder.testbench,
            },
            grading: { maxScore: 8 },
        });

        const result = grader.gradeActivity(exercise, { netlist: halfAdder.netlist }, metadata);

        expect(result).toMatchObject({
            attemptId: 'attempt-0001',
            exerciseId: 'exercise-0001',
            engine: 'electronics-logic-core',
            engineVersion: '0.1.0',
            score: 8,
            maxScore: 8,
            createdAt: '2026-08-12T04:00:00.000Z',
        });
        expect(result.checks).toHaveLength(8);
        expect(result.checks.every(check => check.passed)).toBe(true);
    });

    it('returns circuit structure evidence without throwing and rejects a missing learner netlist', () => {
        const exercise = createExercise({
            mode: 'circuit',
            answer: { ...createExercise().answer, testbench: halfAdder.testbench },
        });
        const netlist = structuredClone(halfAdder.netlist);
        netlist.wires = netlist.wires.filter(wire => wire.id !== 'w2');

        expect(grader.gradeActivity(exercise, { netlist }, metadata)).toMatchObject({
            score: 0,
            checks: [expect.objectContaining({ id: 'structure-danglingInputPin', passed: false })],
        });
        expect(() => grader.gradeActivity(exercise, {}, metadata)).toThrow(
            new TypeError('Câu trả lời mạch không hợp lệ.'),
        );
    });

    it('dispatches Karnaugh grading and wraps the result in GradingResult v1 evidence', () => {
        const exercise = createExercise({
            mode: 'kmap',
            variables: ['A', 'B'],
            answer: { expression: '', minterms: [1, 2], dontCares: [] },
        });
        const result = grader.gradeActivity(
            exercise,
            {
                cells: [
                    ['0', '1'],
                    ['1', '0'],
                ],
                groups: [
                    { id: 'g1', cells: [1] },
                    { id: 'g2', cells: [2] },
                ],
            },
            metadata,
        );

        expect(result).toMatchObject({
            attemptId: 'attempt-0001',
            exerciseId: 'exercise-0001',
            engine: 'electronics-logic-core',
            engineVersion: '0.1.0',
            score: 10,
            maxScore: 10,
            createdAt: '2026-08-12T04:00:00.000Z',
        });
        expect(result.checks.find(check => check.id === 'kmap-sop-minimal')).toHaveProperty('solution');
    });

    it.each([
        [{ cells: [['0']], groups: [] }, 'Câu trả lời Karnaugh phải có đúng 4 ô.'],
        [
            {
                cells: [
                    ['0', '1'],
                    ['2', '0'],
                ],
                groups: [],
            },
            'Mỗi ô Karnaugh chỉ nhận 0, 1 hoặc X.',
        ],
        [
            {
                cells: [
                    ['0', '1'],
                    ['1', '0'],
                ],
                groups: [{ id: 'g1', cells: [4] }],
            },
            'Danh sách nhóm Karnaugh không hợp lệ.',
        ],
    ])('rejects invalid Karnaugh response shape %#', (response, message) => {
        const exercise = createExercise({
            mode: 'kmap',
            answer: { expression: '', minterms: [1, 2], dontCares: [] },
        });

        expect(() => grader.gradeActivity(exercise, response, metadata)).toThrow(new TypeError(message));
    });

    it('grades each truth-table cell independently and returns GradingResult v1 evidence', () => {
        const result = grader.gradeActivity(createExercise(), { values: ['0', '1', '0', 'X'] }, metadata);

        expect(result).toEqual({
            attemptId: 'attempt-0001',
            exerciseId: 'exercise-0001',
            engine: 'electronics-logic-core',
            engineVersion: '0.1.0',
            score: 7.5,
            maxScore: 10,
            checks: [
                { id: 'case-00', passed: true, expected: '0', actual: '0' },
                { id: 'case-01', passed: true, expected: '1', actual: '1' },
                { id: 'case-10', passed: false, expected: '1', actual: '0' },
                { id: 'case-11', passed: true, expected: 'X', actual: 'X' },
            ],
            createdAt: '2026-08-12T04:00:00.000Z',
        });
    });

    it("accepts any supported learner value for an expected truth-table don't-care", () => {
        for (const value of ['0', '1', 'X']) {
            const result = grader.gradeActivity(createExercise(), { values: ['0', '1', '1', value] }, metadata);
            expect(result.checks[3]).toMatchObject({ passed: true, expected: 'X', actual: value });
            expect(result.score).toBe(10);
        }
    });

    it('derives the expected truth table from an author expression using the shared Core', () => {
        const exercise = createExercise({
            authoring: { answerSource: 'expression' },
            answer: { expression: 'A XOR B', minterms: [], dontCares: [] },
        });

        const result = grader.gradeActivity(exercise, { values: ['0', '1', '1', '0'] }, metadata);

        expect(result.score).toBe(10);
        expect(result.checks.every(check => check.passed)).toBe(true);
    });

    it('grades Boolean expressions by equivalence over every assignment', () => {
        const exercise = createExercise({
            mode: 'boolean',
            authoring: { answerSource: 'expression' },
            answer: { expression: 'A XOR B', minterms: [], dontCares: [] },
        });

        const equivalent = grader.gradeActivity(exercise, { expression: '!A*B+A*!B' }, metadata);
        const different = grader.gradeActivity(exercise, { expression: 'A+B' }, metadata);

        expect(equivalent.score).toBe(10);
        expect(equivalent.checks).toEqual([
            {
                id: 'expression-equivalence',
                passed: true,
                expected: 'equivalent',
                actual: 'equivalent',
            },
        ]);
        expect(different.score).toBe(0);
        expect(different.checks[0]).toMatchObject({ passed: false, expected: 'equivalent', actual: 'different' });
    });

    it('returns syntax evidence without throwing or revealing the expected expression', () => {
        const exercise = createExercise({
            mode: 'boolean',
            authoring: { answerSource: 'expression' },
            answer: { expression: 'A XOR B', minterms: [], dontCares: [] },
        });

        const result = grader.gradeActivity(exercise, { expression: 'A +' }, metadata);

        expect(result.score).toBe(0);
        expect(result.checks[0]).toMatchObject({
            id: 'expression-syntax',
            passed: false,
            expected: 'valid-expression',
            actual: 'invalid-expression',
        });
        expect(result.checks[0].error).toMatchObject({ position: 3 });
        expect(JSON.stringify(result)).not.toContain('A XOR B');
    });

    it.each([
        [null, { values: [] }, metadata, 'Bài tập chấm điểm không hợp lệ.'],
        [createExercise(), { values: ['0'] }, metadata, 'Câu trả lời bảng chân trị phải có đúng 4 ô.'],
        [createExercise(), { values: ['0', '1', '2', '0'] }, metadata, 'Mỗi ô chỉ nhận 0, 1 hoặc X.'],
        [createExercise(), { values: ['0', '1', '1', '0'] }, {}, 'Thiếu định danh lần làm hoặc thời điểm chấm.'],
        [
            createExercise({
                authoring: { answerSource: 'expression' },
                answer: { expression: '', minterms: [], dontCares: [] },
            }),
            { values: ['0', '1', '1', '0'] },
            metadata,
            'Bài tập chấm điểm không hợp lệ.',
        ],
        [
            createExercise({ authoring: { answerSource: 'unknown' } }),
            { values: ['0', '1', '1', '0'] },
            metadata,
            'Bài tập chấm điểm không hợp lệ.',
        ],
        [createExercise({ mode: 'boolean' }), { expression: 'A' }, metadata, 'Bài tập chấm điểm không hợp lệ.'],
        [
            createExercise({
                mode: 'boolean',
                authoring: { answerSource: 'expression' },
                answer: { expression: 'A', minterms: [], dontCares: [] },
            }),
            { expression: '' },
            metadata,
            'Chưa nhập biểu thức cần chấm.',
        ],
    ])('rejects invalid grader boundaries %#', (exercise, response, resultMetadata, message) => {
        expect(() => grader.gradeActivity(exercise, response, resultMetadata)).toThrow(message);
    });

    it('rounds fractional scores deterministically to four decimal places', () => {
        const exercise = createExercise({
            answer: { expression: '', minterms: [1, 2], dontCares: [] },
            grading: { maxScore: 7 },
        });
        const result = grader.gradeActivity(exercise, { values: ['0', '0', '0', '1'] }, metadata);

        expect(result.score).toBe(1.75);
        expect(grader.ENGINE).toEqual({ name: 'electronics-logic-core', version: '0.1.0' });
    });
});
