const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const booleanCore = require('./boolean-core.js');
const { SIGNAL_VALUES, evaluateGate, propagate } = require('./circuit-engine.js');
const { GATE_PINS, parseNetlist } = require('./circuit-netlist.js');

const currentDirectory = dirname(require.resolve('./circuit-engine.js'));

const BINARY_INPUTS = [
    ['0', '0'],
    ['0', '1'],
    ['0', 'X'],
    ['1', '0'],
    ['1', '1'],
    ['1', 'X'],
    ['X', '0'],
    ['X', '1'],
    ['X', 'X'],
];

const EXPECTED_BINARY_RESULTS = {
    AND: ['0', '0', '0', '0', '1', 'X', '0', 'X', 'X'],
    OR: ['0', '1', 'X', '1', '1', '1', 'X', '1', 'X'],
    XOR: ['0', '1', 'X', '1', '0', 'X', 'X', 'X', 'X'],
};

const BOOLEAN_CORE_CASES = [
    ['NOT', ['0'], 'NOT A', { A: 0 }],
    ['NOT', ['1'], 'NOT A', { A: 1 }],
    ...['AND', 'OR', 'XOR'].flatMap(kind =>
        [
            ['0', '0'],
            ['0', '1'],
            ['1', '0'],
            ['1', '1'],
        ].map(inputs => [kind, inputs, `A ${kind} B`, { A: Number(inputs[0]), B: Number(inputs[1]) }]),
    ),
];

function createXorCircuit() {
    return parseNetlist({
        schemaVersion: 1,
        nodes: [
            { id: 'in-a', kind: 'INPUT', x: 0, y: 0 },
            { id: 'in-b', kind: 'INPUT', x: 0, y: 100 },
            { id: 'xor-1', kind: 'XOR', x: 100, y: 50 },
            { id: 'out-1', kind: 'OUTPUT', x: 200, y: 50 },
        ],
        wires: [
            { id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'xor-1', pin: 'a' } },
            { id: 'w2', from: { node: 'in-b', pin: 'out' }, to: { node: 'xor-1', pin: 'b' } },
            { id: 'w3', from: { node: 'xor-1', pin: 'out' }, to: { node: 'out-1', pin: 'a' } },
        ],
    });
}

function createLoopCircuit() {
    return parseNetlist({
        schemaVersion: 1,
        nodes: [
            { id: 'not-1', kind: 'NOT', x: 0, y: 0 },
            { id: 'not-2', kind: 'NOT', x: 100, y: 0 },
        ],
        wires: [
            { id: 'w1', from: { node: 'not-1', pin: 'out' }, to: { node: 'not-2', pin: 'a' } },
            { id: 'w2', from: { node: 'not-2', pin: 'out' }, to: { node: 'not-1', pin: 'a' } },
        ],
    });
}

describe('Circuit value propagation engine', () => {
    it('is a frozen pure CommonJS module with the locked signal vocabulary and dependency boundary', () => {
        const moduleApi = require('./circuit-engine.js');
        const source = readFileSync(join(currentDirectory, 'circuit-engine.js'), 'utf-8');

        expect(Object.isFrozen(moduleApi)).toBe(true);
        expect(SIGNAL_VALUES).toEqual(['0', '1', 'X']);
        expect(Object.isFrozen(SIGNAL_VALUES)).toBe(true);
        expect(source).toContain("require('./circuit-netlist.js')");
        expect(source).toContain('module.exports');
        expect(source).not.toMatch(/require\(['"]\.\/(?:boolean-core|kmap-|schema-lifecycle)/);
        expect(source).not.toMatch(/\b(?:document|window|electron)\b/i);
        expect(source).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    });

    it.each([
        ['0', '1'],
        ['1', '0'],
        ['X', 'X'],
    ])('evaluates NOT %s as %s', (input, expected) => {
        expect(evaluateGate('NOT', [input])).toBe(expected);
    });

    it.each(['AND', 'OR'])('evaluates all nine dominant-value combinations for %s', kind => {
        const actual = BINARY_INPUTS.map(inputs => evaluateGate(kind, inputs));

        expect(actual).toEqual(EXPECTED_BINARY_RESULTS[kind]);
    });

    it('evaluates all nine XOR combinations without a dominant value', () => {
        const actual = BINARY_INPUTS.map(inputs => evaluateGate('XOR', inputs));

        expect(actual).toEqual(EXPECTED_BINARY_RESULTS.XOR);
    });

    it.each(BOOLEAN_CORE_CASES)('matches Boolean Core for binary %s(%j)', (kind, inputs, expression, assignment) => {
        const expected = String(booleanCore.evaluate(expression, assignment));

        expect(evaluateGate(kind, inputs)).toBe(expected);
    });

    it.each([
        ['INPUT', []],
        ['OUTPUT', ['0']],
    ])('rejects the non-computational gate kind %s', (kind, inputs) => {
        expect(() => evaluateGate(kind, inputs)).toThrow(TypeError);
    });

    it.each([
        ['an invalid signal value', 'AND', ['1', '2']],
        ['a missing input pin value', 'AND', ['1']],
    ])('rejects %s', (_description, kind, inputs) => {
        expect(() => evaluateGate(kind, inputs)).toThrow(TypeError);
    });

    it.each([
        ['0', '0', '0'],
        ['0', '1', '1'],
        ['1', '0', '1'],
        ['1', '1', '0'],
    ])('propagates XOR inputs %s/%s to %s', (a, b, expected) => {
        const result = propagate(createXorCircuit(), { 'in-a': a, 'in-b': b });

        expect(result.ok).toBe(true);
        expect(result.values['out-1.a']).toBe(expected);
    });

    it('returns every input and output pin of every node', () => {
        const model = createXorCircuit();
        const result = propagate(model, { 'in-a': '1', 'in-b': '0' });
        const expectedPinCount = model.nodes.reduce(
            (count, node) => count + GATE_PINS[node.kind].inputs.length + GATE_PINS[node.kind].outputs.length,
            0,
        );

        expect(result.values).toEqual({
            'in-a.out': '1',
            'in-b.out': '0',
            'xor-1.a': '1',
            'xor-1.b': '0',
            'xor-1.out': '1',
            'out-1.a': '1',
        });
        expect(Object.keys(result.values)).toHaveLength(expectedPinCount);
    });

    it('is deterministic for repeated propagation of the same model and assignment', () => {
        const model = createXorCircuit();
        const assignment = { 'in-a': '0', 'in-b': '1' };

        expect(propagate(model, assignment)).toEqual(propagate(model, assignment));
    });

    it('defaults a missing input to X, propagates it, and ignores unrelated assignment keys', () => {
        const result = propagate(createXorCircuit(), { 'in-a': '1', unused: '0' });

        expect(result).toEqual({
            ok: true,
            values: {
                'in-a.out': '1',
                'in-b.out': 'X',
                'xor-1.a': '1',
                'xor-1.b': 'X',
                'xor-1.out': 'X',
                'out-1.a': 'X',
            },
        });
    });

    it.each([
        ['a numeric value', 1],
        ['an unsupported string', '2'],
    ])('rejects %s assigned to a present INPUT key with a Vietnamese error', (_description, value) => {
        expect(() => propagate(createXorCircuit(), { 'in-a': value, 'in-b': '0' })).toThrow(
            new TypeError('Giá trị INPUT phải là chuỗi 0, 1 hoặc X.'),
        );
    });

    it('returns the locked runtime error instead of throwing for a combinational loop', () => {
        expect(propagate(createLoopCircuit(), {})).toEqual({
            ok: false,
            error: {
                code: 'combinationalLoop',
                path: 'nodes[not-1,not-2]',
                message: 'Mạch có vòng lặp tổ hợp, không thể xác định thứ tự tính toán.',
            },
        });
    });
});
