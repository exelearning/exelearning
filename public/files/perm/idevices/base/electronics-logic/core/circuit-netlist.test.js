const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const { GATE_PINS, parseNetlist, topologicalSort, validateTopology } = require('./circuit-netlist.js');

const currentDirectory = dirname(require.resolve('./circuit-netlist.js'));

const SPEC_NETLIST = {
    schemaVersion: 1,
    nodes: [
        { id: 'in-a', kind: 'INPUT', x: 40, y: 80 },
        { id: 'xor-1', kind: 'XOR', x: 180, y: 80 },
    ],
    wires: [
        {
            id: 'w1',
            from: { node: 'in-a', pin: 'out' },
            to: { node: 'xor-1', pin: 'a' },
        },
    ],
};

function createValidXorCircuit() {
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

describe('Circuit netlist', () => {
    it('is a frozen pure CommonJS module without DOM, Electron, eval, Function, or Core dependencies', () => {
        const moduleApi = require('./circuit-netlist.js');
        const source = readFileSync(join(currentDirectory, 'circuit-netlist.js'), 'utf-8');

        expect(Object.isFrozen(moduleApi)).toBe(true);
        expect(source).toContain('module.exports');
        expect(source).not.toMatch(/require\(['"]\.\/(?:boolean|kmap|schema)/);
        expect(source).not.toMatch(/\b(?:document|window|electron)\b/i);
        expect(source).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    });

    it('parses the SPEC v1 example as a clone with stable JSON round-trip semantics', () => {
        const model = parseNetlist(SPEC_NETLIST);
        const roundTripped = parseNetlist(JSON.parse(JSON.stringify(model)));

        expect(model).toEqual(SPEC_NETLIST);
        expect(model).not.toBe(SPEC_NETLIST);
        expect(model.nodes).not.toBe(SPEC_NETLIST.nodes);
        expect(model.wires).not.toBe(SPEC_NETLIST.wires);
        expect(model.wires[0].from).not.toBe(SPEC_NETLIST.wires[0].from);
        expect(roundTripped).toEqual(model);
    });

    it('exposes only the six P0 gate kinds with their locked pin names', () => {
        expect(GATE_PINS).toEqual({
            INPUT: { inputs: [], outputs: ['out'] },
            OUTPUT: { inputs: ['a'], outputs: [] },
            NOT: { inputs: ['a'], outputs: ['out'] },
            AND: { inputs: ['a', 'b'], outputs: ['out'] },
            OR: { inputs: ['a', 'b'], outputs: ['out'] },
            XOR: { inputs: ['a', 'b'], outputs: ['out'] },
        });
        expect(Object.isFrozen(GATE_PINS)).toBe(true);
    });

    it.each([
        ['a non-object payload', null],
        ['an unsupported schema version', { ...SPEC_NETLIST, schemaVersion: 2 }],
        ['a missing nodes array', { schemaVersion: 1, wires: [] }],
        ['a missing wires array', { schemaVersion: 1, nodes: [] }],
        [
            'a node without kind',
            {
                ...SPEC_NETLIST,
                nodes: [{ id: 'in-a', x: 40, y: 80 }],
            },
        ],
        [
            'an unknown node kind',
            {
                ...SPEC_NETLIST,
                nodes: [{ id: 'bad', kind: 'FOO', x: 0, y: 0 }],
            },
        ],
        [
            'a non-finite node coordinate',
            {
                ...SPEC_NETLIST,
                nodes: [{ id: 'in-a', kind: 'INPUT', x: Number.POSITIVE_INFINITY, y: 0 }],
            },
        ],
        [
            'duplicate node ids',
            {
                ...SPEC_NETLIST,
                nodes: [
                    { id: 'same', kind: 'INPUT', x: 0, y: 0 },
                    { id: 'same', kind: 'OUTPUT', x: 1, y: 1 },
                ],
            },
        ],
        [
            'an empty node id',
            {
                ...SPEC_NETLIST,
                nodes: [{ id: '', kind: 'INPUT', x: 0, y: 0 }],
            },
        ],
        [
            'a wire without from.pin',
            {
                ...SPEC_NETLIST,
                wires: [{ id: 'w1', from: { node: 'in-a' }, to: { node: 'xor-1', pin: 'a' } }],
            },
        ],
        [
            'duplicate wire ids',
            {
                ...SPEC_NETLIST,
                wires: [SPEC_NETLIST.wires[0], { ...SPEC_NETLIST.wires[0] }],
            },
        ],
    ])('rejects %s with a Vietnamese TypeError', (_label, raw) => {
        expect(() => parseNetlist(raw)).toThrow(TypeError);
        expect(() => parseNetlist(raw)).toThrow(/[À-ỹ]|không|phải|hợp lệ|phiên bản/i);
    });

    it('accepts a complete acyclic XOR circuit', () => {
        expect(validateTopology(createValidXorCircuit())).toEqual({ valid: true, errors: [] });
    });

    it('reports only xor-1.b as dangling for the exact SPEC example', () => {
        expect(validateTopology(parseNetlist(SPEC_NETLIST))).toEqual({
            valid: false,
            errors: [
                {
                    code: 'danglingInputPin',
                    path: 'nodes[xor-1].inputs[b]',
                    message: 'Chân đầu vào chưa được nối dây.',
                },
            ],
        });
    });

    it('sorts every node in an acyclic circuit after its sources', () => {
        const model = createValidXorCircuit();
        const result = topologicalSort(model);

        expect(result.ok).toBe(true);
        expect(result.order).toHaveLength(model.nodes.length);
        for (const wire of model.wires) {
            expect(result.order.indexOf(wire.from.node)).toBeLessThan(result.order.indexOf(wire.to.node));
        }
    });

    it('reports a wire that references a deleted node without throwing', () => {
        const model = parseNetlist({
            schemaVersion: 1,
            nodes: [{ id: 'in-a', kind: 'INPUT', x: 0, y: 0 }],
            wires: [{ id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'deleted', pin: 'a' } }],
        });

        expect(() => validateTopology(model)).not.toThrow();
        expect(validateTopology(model).errors).toContainEqual({
            code: 'unknownNodeReference',
            path: 'wires[w1].to.node',
            message: 'Dây nối trỏ tới node không tồn tại.',
        });
    });

    it('reports an unknown pin on an existing node', () => {
        const model = parseNetlist({
            schemaVersion: 1,
            nodes: [
                { id: 'in-a', kind: 'INPUT', x: 0, y: 0 },
                { id: 'out-1', kind: 'OUTPUT', x: 100, y: 0 },
            ],
            wires: [{ id: 'w1', from: { node: 'in-a', pin: 'missing' }, to: { node: 'out-1', pin: 'a' } }],
        });

        expect(validateTopology(model).errors).toContainEqual({
            code: 'unknownPin',
            path: 'wires[w1].from.pin',
            message: 'Dây nối trỏ tới chân không tồn tại.',
        });
    });

    it('reports a wire whose endpoints do not follow output-to-input direction', () => {
        const model = parseNetlist({
            schemaVersion: 1,
            nodes: [
                { id: 'out-1', kind: 'OUTPUT', x: 0, y: 0 },
                { id: 'out-2', kind: 'OUTPUT', x: 100, y: 0 },
            ],
            wires: [{ id: 'w1', from: { node: 'out-1', pin: 'a' }, to: { node: 'out-2', pin: 'a' } }],
        });

        expect(validateTopology(model).errors).toContainEqual({
            code: 'wireDirectionMismatch',
            path: 'wires[w1]',
            message: 'Dây nối phải đi từ chân ra tới chân vào.',
        });
    });

    it('reports multiple valid sources connected to one input pin', () => {
        const model = parseNetlist({
            schemaVersion: 1,
            nodes: [
                { id: 'in-a', kind: 'INPUT', x: 0, y: 0 },
                { id: 'in-b', kind: 'INPUT', x: 0, y: 50 },
                { id: 'in-c', kind: 'INPUT', x: 0, y: 100 },
                { id: 'and-1', kind: 'AND', x: 100, y: 50 },
            ],
            wires: [
                { id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'and-1', pin: 'a' } },
                { id: 'w2', from: { node: 'in-b', pin: 'out' }, to: { node: 'and-1', pin: 'a' } },
                { id: 'w3', from: { node: 'in-c', pin: 'out' }, to: { node: 'and-1', pin: 'b' } },
            ],
        });

        expect(validateTopology(model).errors).toContainEqual({
            code: 'multipleSources',
            path: 'nodes[and-1].inputs[a]',
            message: 'Một chân đầu vào không được nhận nhiều nguồn.',
        });
    });

    it('detects a self-loop as a combinational loop', () => {
        const model = parseNetlist({
            schemaVersion: 1,
            nodes: [{ id: 'not-1', kind: 'NOT', x: 0, y: 0 }],
            wires: [{ id: 'w1', from: { node: 'not-1', pin: 'out' }, to: { node: 'not-1', pin: 'a' } }],
        });

        expect(topologicalSort(model)).toEqual({ ok: false, cycle: ['not-1'] });
        expect(validateTopology(model).errors).toContainEqual({
            code: 'combinationalLoop',
            path: 'nodes[not-1]',
            message: 'Mạch có vòng lặp tổ hợp, không thể xác định thứ tự tính toán.',
        });
    });

    it('excludes downstream acyclic nodes from the reported cycle', () => {
        const model = parseNetlist({
            schemaVersion: 1,
            nodes: [
                { id: 'not-1', kind: 'NOT', x: 0, y: 0 },
                { id: 'out-1', kind: 'OUTPUT', x: 100, y: 0 },
            ],
            wires: [
                { id: 'w1', from: { node: 'not-1', pin: 'out' }, to: { node: 'not-1', pin: 'a' } },
                { id: 'w2', from: { node: 'not-1', pin: 'out' }, to: { node: 'out-1', pin: 'a' } },
            ],
        });

        expect(topologicalSort(model)).toEqual({ ok: false, cycle: ['not-1'] });
    });

    it('accumulates dangling and multiple-source errors in one validation result', () => {
        const model = parseNetlist({
            schemaVersion: 1,
            nodes: [
                { id: 'in-a', kind: 'INPUT', x: 0, y: 0 },
                { id: 'in-b', kind: 'INPUT', x: 0, y: 100 },
                { id: 'and-1', kind: 'AND', x: 100, y: 50 },
            ],
            wires: [
                { id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'and-1', pin: 'a' } },
                { id: 'w2', from: { node: 'in-b', pin: 'out' }, to: { node: 'and-1', pin: 'a' } },
            ],
        });
        const result = validateTopology(model);

        expect(result.valid).toBe(false);
        expect(result.errors.map(error => error.code)).toEqual(
            expect.arrayContaining(['multipleSources', 'danglingInputPin']),
        );
    });
});
