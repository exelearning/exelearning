const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

describe('Electronics Logic schema lifecycle bundle', () => {
    it('exposes the canonical schema lifecycle globally and validates without Node globals', async () => {
        global.$electronicsLogicSchemaLifecycle = undefined;
        const bundlePath = join(
            process.cwd(),
            'public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js',
        );
        await import(`${pathToFileURL(bundlePath).href}?browser-smoke=1`);

        expect(global.$electronicsLogicSchemaLifecycle).toBeDefined();
        const result = global.$electronicsLogicSchemaLifecycle.validate({
            id: 'offline-circuit',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'circuit',
            prompt: 'Dựng mạch bán tổng.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'expression', placeholderText: 'x', solution: '' },
            answer: {
                expression: '',
                minterms: [],
                dontCares: [],
                testbench: {
                    variables: ['A', 'B'],
                    inputs: { A: 'input-1', B: 'input-2' },
                    outputs: { Sum: 'output-1', Carry: 'output-2' },
                    expected: { Sum: 'A XOR B', Carry: 'A AND B' },
                },
            },
            grading: { maxScore: 8 },
            learner: {},
            accessibility: { label: '' },
        });

        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('rejects an invalid circuit testbench through the rebuilt offline bundle', async () => {
        global.$electronicsLogicSchemaLifecycle = undefined;
        const bundlePath = join(
            process.cwd(),
            'public/files/perm/idevices/base/electronics-logic/edition/electronics-logic-schema.bundle.js',
        );
        await import(`${pathToFileURL(bundlePath).href}?browser-smoke=2`);

        const result = global.$electronicsLogicSchemaLifecycle.validate({
            id: 'offline-circuit-invalid',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'circuit',
            prompt: 'Dựng mạch bán tổng.',
            variables: ['A', 'B'],
            authoring: { answerSource: 'expression', placeholderText: 'x', solution: '' },
            answer: { expression: '', minterms: [], dontCares: [], testbench: {} },
            grading: { maxScore: 8 },
            learner: {},
            accessibility: { label: '' },
        });

        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.code === 'invalidTestbench')).toBe(true);
    });
});
