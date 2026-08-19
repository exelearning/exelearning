/**
 * Loads the real export bundle (the same files Html5Exporter packages into
 * idevices/electronics-logic/) via file:// URLs with fetch stubbed to always
 * reject, proving render + grade both work fully offline for every mode I02
 * ships (truthTable, kmap, circuit) — including catching a wrong answer, not
 * just rubber-stamping a correct one.
 */

/* eslint-disable no-undef */
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const halfAdder = require('../core/fixtures/circuit-half-adder.json');

describe('electronics-logic offline export runtime', () => {
    let fetchCalls;
    let originalFetch;
    let renderer;

    beforeAll(async () => {
        originalFetch = globalThis.fetch;
        fetchCalls = [];
        globalThis.fetch = (...args) => {
            fetchCalls.push(args);
            return Promise.reject(new Error('offline: network disabled'));
        };

        const exportDir = join(process.cwd(), 'public/files/perm/idevices/base/electronics-logic/export');
        const graderUrl = pathToFileURL(join(exportDir, 'electronics-logic-grader.bundle.js')).href;
        const runtimeUrl = pathToFileURL(join(exportDir, 'electronics-logic.js')).href;

        await import(`${graderUrl}?offline=1`);
        await import(`${runtimeUrl}?offline=2`);
        renderer = global.$electronicslogic;
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    it('renders and grades a truth-table activity offline, catching a wrong row', () => {
        const data = {
            id: 'offline-truth-table',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'truthTable',
            prompt: 'Hoàn thành bảng chân trị.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'minterms', solution: '' },
            answer: { expression: '', minterms: [0, 1, 2], dontCares: [] },
            grading: { maxScore: 4 },
            learner: {},
            accessibility: { label: 'Bài tập bảng chân trị Electronics Logic' },
        };

        const html = renderer.renderView(data, false, '{content}');
        expect(html).toContain('class="electronics-logic-runtime"');
        expect(html).toContain('data-schema-version="1"');
        expect(html).toContain('data-mode="truthTable"');

        // Correct vector is ['1','1','1','0']; row 3 (index 3) is submitted wrong on purpose.
        const result = global.$electronicsLogicGrader.gradeActivity(
            data,
            { values: ['1', '1', '1', '1'] },
            { attemptId: 'offline-truth-attempt', createdAt: '2026-08-17T00:00:00.000Z' },
        );

        expect(result.score).toBe(3);
        expect(result.maxScore).toBe(4);
        expect(result.checks.filter(check => !check.passed)).toHaveLength(1);
        expect(result.checks[3]).toMatchObject({ passed: false, expected: '0', actual: '1' });
        expect(fetchCalls.length).toBe(0);
    });

    it('renders and grades a Karnaugh activity offline, catching an incomplete grouping', () => {
        const data = {
            id: 'offline-kmap',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'kmap',
            prompt: 'Hoàn thành bìa Karnaugh.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'minterms', solution: '' },
            answer: { expression: '', minterms: [3], dontCares: [0, 1, 2] },
            grading: { maxScore: 6 },
            learner: {},
            accessibility: { label: 'Bài tập Karnaugh Electronics Logic' },
        };

        const html = renderer.renderView(data, false, '{content}');
        expect(html).toContain('class="electronics-logic-runtime"');
        expect(html).toContain('data-schema-version="1"');
        expect(html).toContain('data-mode="kmap"');

        // 3 of 4 cells are don't-care, so any submitted cell grid earns full cell credit;
        // groups are submitted empty on purpose, so the required minterm (index 3) is
        // reported as not covered and the response scores below full marks.
        const result = global.$electronicsLogicGrader.gradeActivity(
            data,
            {
                cells: [
                    ['1', '1'],
                    ['1', '1'],
                ],
                groups: [],
            },
            { attemptId: 'offline-kmap-attempt', createdAt: '2026-08-17T00:00:00.000Z' },
        );

        expect(result.score).toBeCloseTo(1.8, 4);
        expect(result.maxScore).toBe(6);
        expect(result.score).toBeLessThan(result.maxScore);
        expect(result.checks.find(check => check.id === 'kmap-coverage-3').passed).toBe(false);
        expect(result.checks.find(check => check.id === 'kmap-sop-equivalence').passed).toBe(false);
        expect(fetchCalls.length).toBe(0);
    });

    it('renders and grades a half-adder circuit offline with a fully correct netlist', () => {
        const data = {
            id: 'offline-circuit',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'circuit',
            prompt: 'Hoàn thành mạch cộng bán phần.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'expression' },
            answer: { expression: '', minterms: [], dontCares: [], testbench: halfAdder.testbench },
            grading: { maxScore: 8 },
            learner: {},
            accessibility: { label: 'Bài tập mạch cộng bán phần Electronics Logic' },
        };

        const html = renderer.renderView(data, false, '{content}');
        expect(html).toContain('class="electronics-logic-runtime"');
        expect(html).toContain('data-schema-version="1"');
        expect(html).toContain('data-mode="circuit"');

        const result = global.$electronicsLogicGrader.gradeActivity(
            data,
            { netlist: halfAdder.netlist },
            { attemptId: 'offline-circuit-attempt', createdAt: '2026-08-17T00:00:00.000Z' },
        );

        expect(result.score).toBe(result.maxScore);
        expect(result.checks.every(check => check.passed)).toBe(true);
        expect(fetchCalls.length).toBe(0);
    });
});
