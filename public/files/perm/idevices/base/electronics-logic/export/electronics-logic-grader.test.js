/**
 * Browser-bundle smoke tests for the offline Electronics Logic grader.
 */

const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const halfAdder = require('../core/fixtures/circuit-half-adder.json');

describe('Electronics Logic offline grader bundle', () => {
    it('exposes the canonical grader globally and grades without Node globals', async () => {
        global.$electronicsLogicGrader = undefined;
        const bundlePath = join(
            process.cwd(),
            'public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js',
        );

        await import(`${pathToFileURL(bundlePath).href}?browser-smoke=1`);

        expect(global.$electronicsLogicGrader).toBeDefined();
        const result = global.$electronicsLogicGrader.gradeActivity(
            {
                id: 'offline-exercise',
                type: 'electronics.logic',
                schemaVersion: 1,
                mode: 'boolean',
                prompt: 'Viết biểu thức tương đương.',
                variables: ['A', 'B'],
                authoring: { answerSource: 'expression' },
                answer: { expression: 'A XOR B', minterms: [], dontCares: [] },
                grading: { maxScore: 10 },
                learner: {},
                accessibility: { label: '' },
            },
            { expression: '!A*B+A*!B' },
            { attemptId: 'offline-attempt', createdAt: '2026-08-12T04:00:00.000Z' },
        );

        expect(result).toMatchObject({
            engine: 'electronics-logic-core',
            engineVersion: '0.1.0',
            score: 10,
            maxScore: 10,
        });
    });

    it('grades a Karnaugh response through the rebuilt offline bundle', async () => {
        global.$electronicsLogicGrader = undefined;
        const bundlePath = join(
            process.cwd(),
            'public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js',
        );

        await import(`${pathToFileURL(bundlePath).href}?browser-smoke=kmap`);

        const result = global.$electronicsLogicGrader.gradeActivity(
            {
                id: 'offline-kmap',
                type: 'electronics.logic',
                schemaVersion: 1,
                mode: 'kmap',
                prompt: 'Hoàn thành bản đồ Karnaugh.',
                variables: ['A', 'B', 'C', 'D'],
                authoring: { answerSource: 'minterms' },
                answer: { expression: '', minterms: [0, 2, 8, 10, 12, 14], dontCares: [4] },
                grading: { maxScore: 10 },
                learner: {},
                accessibility: { label: '' },
            },
            {
                cells: [
                    ['1', '0', '0', '1'],
                    ['X', '0', '0', '0'],
                    ['1', '0', '0', '1'],
                    ['1', '0', '0', '1'],
                ],
                groups: [
                    { id: 'g1', cells: [0, 2, 8, 10] },
                    { id: 'g2', cells: [8, 10, 12, 14] },
                ],
            },
            { attemptId: 'offline-kmap-attempt', createdAt: '2026-08-13T04:00:00.000Z' },
        );

        expect(result.score).toBe(result.maxScore);
        expect(result.checks.find(check => check.id === 'kmap-sop-minimal')).toMatchObject({
            passed: true,
            solution: '!B*!D+A*!D',
        });
    });

    it('grades a half-adder circuit through the rebuilt offline bundle', async () => {
        global.$electronicsLogicGrader = undefined;
        const bundlePath = join(
            process.cwd(),
            'public/files/perm/idevices/base/electronics-logic/export/electronics-logic-grader.bundle.js',
        );

        await import(`${pathToFileURL(bundlePath).href}?browser-smoke=circuit`);

        const result = global.$electronicsLogicGrader.gradeActivity(
            {
                id: 'offline-circuit',
                type: 'electronics.logic',
                schemaVersion: 1,
                mode: 'circuit',
                prompt: 'Dựng mạch bán tổng.',
                variables: ['A', 'B'],
                authoring: { answerSource: 'expression' },
                answer: {
                    expression: '',
                    minterms: [],
                    dontCares: [],
                    testbench: halfAdder.testbench,
                },
                grading: { maxScore: 8 },
                learner: {},
                accessibility: { label: '' },
            },
            { netlist: halfAdder.netlist },
            { attemptId: 'offline-circuit-attempt', createdAt: '2026-08-16T04:00:00.000Z' },
        );

        expect(result.score).toBe(8);
        expect(result.checks).toHaveLength(8);
        expect(result.checks.every(check => check.passed)).toBe(true);
    });
});
