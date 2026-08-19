const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const schemaV0 = require('../fixtures/schema-v0.json');
const schemaV0Migrated = require('../fixtures/schema-v0-migrated.json');
const schemaV1 = require('../fixtures/schema-v1.json');

const currentDirectory = dirname(require.resolve('./schema-lifecycle.js'));
let lifecycle;

beforeAll(async () => {
    lifecycle = (await import('./schema-lifecycle.js')).default;
});

function createCircuitActivity(overrides = {}) {
    return {
        ...structuredClone(schemaV1),
        mode: 'circuit',
        prompt: 'Dựng mạch bán tổng cho A và B.',
        variables: ['A', 'B'],
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
        ...overrides,
    };
}

describe('Electronics Logic schema lifecycle', () => {
    it('is a pure module without DOM, Electron, eval, or Function dependencies', () => {
        const source = readFileSync(join(currentDirectory, 'schema-lifecycle.js'), 'utf-8');

        expect(source).not.toMatch(/\b(?:document|window|electron)\b/i);
        expect(source).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    });

    it('migrates the schema-0 fixture exactly to schema 1 without mutating the input', () => {
        const before = structuredClone(schemaV0);

        expect(lifecycle.migrateSchemaV0ToV1(schemaV0)).toEqual(schemaV0Migrated);
        expect(schemaV0).toEqual(before);
    });

    it('preserves unknown top-level and nested fields during migration', () => {
        const source = {
            ...structuredClone(schemaV0),
            extensionData: { provider: 'local', enabled: true },
            answer: { ...structuredClone(schemaV0.answer), explanationMetadata: { format: 'text' } },
        };

        const migrated = lifecycle.migrateSchemaV0ToV1(source);

        expect(migrated.extensionData).toEqual(source.extensionData);
        expect(migrated.answer.explanationMetadata).toEqual(source.answer.explanationMetadata);
        expect(migrated.answer.outputs).toEqual(source.answer.outputs);
        expect(migrated.learner).toEqual(source.learner);
        expect(migrated.accessibility).toEqual(source.accessibility);
    });

    it('fills legacy placeholder defaults while preserving the legacy identifier', () => {
        const migrated = lifecycle.migrateSchemaV0ToV1({
            ideviceId: 'legacy-placeholder',
            placeholderText: 'Saved placeholder',
            variables: [],
            answer: { outputs: [0, 1, 1, 0] },
        });

        expect(migrated).toMatchObject({
            id: 'legacy-placeholder',
            schemaVersion: 1,
            variables: ['A', 'B'],
            authoring: { placeholderText: 'Saved placeholder', answerSource: 'minterms', solution: '' },
            answer: { outputs: [0, 1, 1, 0], expression: '', minterms: [1, 2], dontCares: [] },
        });
    });

    it('accepts the canonical schema-1 fixture', () => {
        expect(lifecycle.validate(schemaV1)).toEqual({ valid: true, errors: [] });
    });

    it('validates circuit authoring with the shared authoring boundary and circuit testbench contract', () => {
        expect(lifecycle.AUTHORING_MODES).toEqual(['boolean', 'truthTable', 'kmap', 'circuit']);
        expect(lifecycle.EXPRESSION_ANSWER_MODES).toEqual(['boolean', 'truthTable', 'kmap']);
        expect(lifecycle.validate(createCircuitActivity())).toEqual({ valid: true, errors: [] });
    });

    it.each([
        [{ prompt: '' }, 'emptyPrompt', 'prompt'],
        [{ variables: ['A'] }, 'invalidVariables', 'variables'],
        [
            {
                answer: {
                    ...createCircuitActivity().answer,
                    testbench: { ...createCircuitActivity().answer.testbench, expected: {} },
                },
            },
            'invalidTestbench',
            'answer.testbench',
        ],
        [
            {
                answer: {
                    ...createCircuitActivity().answer,
                    testbench: { ...createCircuitActivity().answer.testbench, variables: ['B', 'A'] },
                },
            },
            'invalidTestbench',
            'answer.testbench',
        ],
    ])('rejects invalid circuit authoring with stable Vietnamese feedback %#', (override, code, path) => {
        const result = lifecycle.validate(createCircuitActivity(override));

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({ code, path, message: lifecycle.ERROR_MESSAGES[code] });
    });

    it.each([
        [{ prompt: '' }, 'emptyPrompt'],
        [{ variables: ['A'] }, 'invalidVariables'],
        [{ variables: ['A', 'B', 'C', 'D', 'A'] }, 'invalidVariables'],
        [{ answer: { ...schemaV1.answer, minterms: [1, 1] } }, 'duplicateMinterm'],
        [{ answer: { ...schemaV1.answer, minterms: [1, 4] } }, 'mintermOutOfRange'],
        [{ answer: { ...schemaV1.answer, minterms: [1], dontCares: [1] } }, 'overlappingDontCare'],
    ])('validates Karnaugh authoring with the shared answer rules %#', (override, expectedCode) => {
        const activity = {
            ...structuredClone(schemaV1),
            mode: 'kmap',
            ...override,
        };

        const result = lifecycle.validate(activity);

        expect(result.valid).toBe(false);
        expect(result.errors.map(error => error.code)).toContain(expectedCode);
    });

    it('accepts valid Karnaugh authoring data', () => {
        const activity = {
            ...structuredClone(schemaV1),
            mode: 'kmap',
            prompt: 'Nhóm các ô Karnaugh.',
            variables: ['A', 'B', 'C', 'D'],
            answer: { expression: '', minterms: [0, 2, 8, 10], dontCares: [1, 9] },
        };

        expect(lifecycle.validate(activity)).toEqual({ valid: true, errors: [] });
    });

    it.each([
        [{ ...schemaV1, schemaVersion: undefined }, 'missingSchemaVersion'],
        [{ ...schemaV1, schemaVersion: 0 }, 'unsupportedSchemaVersion'],
        [{ ...schemaV1, schemaVersion: 2 }, 'unsupportedSchemaVersion'],
        [{ ...schemaV1, variables: ['A', 'B', 'C', 'D', 'A'] }, 'invalidVariables'],
        [{ ...schemaV1, mode: 'unknown' }, 'invalidMode'],
        [{ ...schemaV1, answer: { ...schemaV1.answer, outputs: [0, 1] } }, 'invalidOutputLength'],
    ])('rejects an invalid schema boundary with Vietnamese feedback %#', (activity, expectedCode) => {
        const result = lifecycle.validate(activity);

        expect(result.valid).toBe(false);
        expect(result.errors.map(error => error.code)).toContain(expectedCode);
        expect(result.errors.every(error => /[À-ỹĐđ]/u.test(error.message))).toBe(true);
    });

    it('rejects schema 0 before migration and accepts it after migration', () => {
        expect(lifecycle.validate(schemaV0).errors.map(error => error.code)).toContain('unsupportedSchemaVersion');
        expect(lifecycle.validate(lifecycle.migrateSchemaV0ToV1(schemaV0))).toEqual({ valid: true, errors: [] });
    });

    it('reports malformed nested structures and answer boundaries with stable codes', () => {
        const structuralErrors = lifecycle.validate({
            id: '',
            type: 'unsupported',
            schemaVersion: 1,
            mode: 'boolean',
            prompt: 42,
            variables: [],
            authoring: null,
            answer: null,
            grading: null,
            learner: null,
            accessibility: null,
        });
        expect(structuralErrors.errors.map(error => error.code)).toEqual(
            expect.arrayContaining([
                'invalidId',
                'invalidType',
                'invalidPrompt',
                'invalidVariables',
                'invalidAuthoring',
                'invalidAnswer',
                'invalidGrading',
                'invalidLearner',
                'invalidAccessibility',
            ]),
        );

        const answerErrors = lifecycle.validate({
            ...schemaV1,
            authoring: { ...schemaV1.authoring, answerSource: 'minterms', solution: 42 },
            answer: { expression: 42, minterms: [1, 1, 5], dontCares: [1, 5], outputs: 'invalid' },
            grading: { maxScore: 0 },
            accessibility: { label: 42 },
        });
        expect(answerErrors.errors.map(error => error.code)).toEqual(
            expect.arrayContaining([
                'invalidSolution',
                'invalidExpression',
                'duplicateMinterm',
                'mintermOutOfRange',
                'dontCareOutOfRange',
                'overlappingDontCare',
                'invalidOutputs',
                'invalidMaxScore',
                'invalidAccessibilityLabel',
            ]),
        );
        expect(lifecycle.validate(null).errors).toEqual([
            expect.objectContaining({ code: 'invalidObject', path: '$' }),
        ]);
    });

    it('normalizes canonical fields without dropping extension data', () => {
        const normalized = lifecycle.normalize({
            ...structuredClone(schemaV1),
            id: '  normalized-id  ',
            prompt: '  Prompt  ',
            authoring: { ...schemaV1.authoring, solution: '  Solution  ' },
            answer: { ...schemaV1.answer, expression: '  A XOR B  ', minterms: [2, 1], dontCares: [3, 0] },
            extensionData: { retained: true },
        });

        expect(normalized).toMatchObject({
            id: 'normalized-id',
            prompt: 'Prompt',
            authoring: { solution: 'Solution' },
            answer: { expression: 'A XOR B', minterms: [1, 2], dontCares: [0, 3] },
            extensionData: { retained: true },
        });
    });

    it('uses canonical schema-1 mode names and migrates legacy aliases', () => {
        expect(lifecycle.SUPPORTED_MODES).toEqual(['boolean', 'truthTable', 'kmap', 'circuit']);
        expect(lifecycle.migrateSchemaV0ToV1({ ...schemaV0, mode: 'booleanExpression' }).mode).toBe('boolean');
        expect(lifecycle.migrateSchemaV0ToV1({ ...schemaV0, mode: 'karnaugh' }).mode).toBe('kmap');
    });
});
