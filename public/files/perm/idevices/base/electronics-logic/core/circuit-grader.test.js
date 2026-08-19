const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const { gradeCircuitResponse, isValidTestbench } = require('./circuit-grader.js');

const currentDirectory = dirname(require.resolve('./circuit-grader.js'));

function createAndNetlist() {
    return {
        schemaVersion: 1,
        nodes: [
            { id: 'in-a', kind: 'INPUT', x: 0, y: 0 },
            { id: 'in-b', kind: 'INPUT', x: 0, y: 100 },
            { id: 'gate-p', kind: 'AND', x: 100, y: 50 },
            { id: 'p-out', kind: 'OUTPUT', x: 200, y: 50 },
        ],
        wires: [
            { id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'gate-p', pin: 'a' } },
            { id: 'w2', from: { node: 'in-b', pin: 'out' }, to: { node: 'gate-p', pin: 'b' } },
            { id: 'w3', from: { node: 'gate-p', pin: 'out' }, to: { node: 'p-out', pin: 'a' } },
        ],
    };
}

function createAndTestbench(expected = 'A AND B', outputName = 'P') {
    return {
        variables: ['A', 'B'],
        inputs: { A: 'in-a', B: 'in-b' },
        outputs: { [outputName]: 'p-out' },
        expected: { [outputName]: expected },
    };
}

function createNotNetlist() {
    return {
        schemaVersion: 1,
        nodes: [
            { id: 'in-a', kind: 'INPUT', x: 0, y: 0 },
            { id: 'gate-p', kind: 'NOT', x: 100, y: 0 },
            { id: 'p-out', kind: 'OUTPUT', x: 200, y: 0 },
        ],
        wires: [
            { id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'gate-p', pin: 'a' } },
            { id: 'w2', from: { node: 'gate-p', pin: 'out' }, to: { node: 'p-out', pin: 'a' } },
        ],
    };
}

function createTwoOutputNetlist() {
    return {
        schemaVersion: 1,
        nodes: [
            { id: 'in-a', kind: 'INPUT', x: 0, y: 0 },
            { id: 'in-b', kind: 'INPUT', x: 0, y: 100 },
            { id: 'gate-p', kind: 'XOR', x: 100, y: 25 },
            { id: 'gate-q', kind: 'AND', x: 100, y: 75 },
            { id: 'p-out', kind: 'OUTPUT', x: 200, y: 25 },
            { id: 'q-out', kind: 'OUTPUT', x: 200, y: 75 },
        ],
        wires: [
            { id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'gate-p', pin: 'a' } },
            { id: 'w2', from: { node: 'in-b', pin: 'out' }, to: { node: 'gate-p', pin: 'b' } },
            { id: 'w3', from: { node: 'gate-p', pin: 'out' }, to: { node: 'p-out', pin: 'a' } },
            { id: 'w4', from: { node: 'in-a', pin: 'out' }, to: { node: 'gate-q', pin: 'a' } },
            { id: 'w5', from: { node: 'in-b', pin: 'out' }, to: { node: 'gate-q', pin: 'b' } },
            { id: 'w6', from: { node: 'gate-q', pin: 'out' }, to: { node: 'q-out', pin: 'a' } },
        ],
    };
}

function createDanglingNetlist() {
    const netlist = createAndNetlist();
    netlist.wires = netlist.wires.filter(wire => wire.id !== 'w2');
    return netlist;
}

function createLoopNetlist() {
    return {
        schemaVersion: 1,
        nodes: [{ id: 'gate-p', kind: 'NOT', x: 0, y: 0 }],
        wires: [{ id: 'w1', from: { node: 'gate-p', pin: 'out' }, to: { node: 'gate-p', pin: 'a' } }],
    };
}

describe('Circuit testbench grader', () => {
    it('is a frozen pure CommonJS module with exactly the three approved runtime dependencies', () => {
        const moduleApi = require('./circuit-grader.js');
        const source = readFileSync(join(currentDirectory, 'circuit-grader.js'), 'utf8');
        const relativeRequires = [...source.matchAll(/require\(['"](\.\/[^'"]+)['"]\)/g)].map(match => match[1]);

        expect(Object.isFrozen(moduleApi)).toBe(true);
        expect(Object.keys(moduleApi)).toEqual(['gradeCircuitResponse', 'isValidTestbench']);
        expect(relativeRequires.sort()).toEqual(
            ['./boolean-core.js', './circuit-engine.js', './circuit-netlist.js'].sort(),
        );
        expect(source).not.toMatch(/require\(['"]\.\/(?:kmap-|schema-lifecycle)/);
        expect(source).not.toMatch(/\b(?:document|window|electron)\b/i);
        expect(source).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    });

    it('exports the locked testbench validator for schema lifecycle reuse', () => {
        expect(isValidTestbench(createAndTestbench())).toBe(true);
        expect(isValidTestbench({ ...createAndTestbench(), expected: {} })).toBe(false);
    });

    it('grades every binary combination of a valid two-input AND circuit', () => {
        expect(
            gradeCircuitResponse({ netlist: createAndNetlist(), testbench: createAndTestbench(), maxScore: 10 }),
        ).toEqual({
            score: 10,
            checks: [
                { id: 'case-00-p', passed: true, expected: '0', actual: '0' },
                { id: 'case-01-p', passed: true, expected: '0', actual: '0' },
                { id: 'case-10-p', passed: true, expected: '0', actual: '0' },
                { id: 'case-11-p', passed: true, expected: '1', actual: '1' },
            ],
        });
    });

    it('returns exact failed-output evidence and a proportional score for a wrong expected expression', () => {
        expect(
            gradeCircuitResponse({
                netlist: createAndNetlist(),
                testbench: createAndTestbench('A OR B'),
                maxScore: 10,
            }),
        ).toEqual({
            score: 5,
            checks: [
                { id: 'case-00-p', passed: true, expected: '0', actual: '0' },
                { id: 'case-01-p', passed: false, expected: '1', actual: '0' },
                { id: 'case-10-p', passed: false, expected: '1', actual: '0' },
                { id: 'case-11-p', passed: true, expected: '1', actual: '1' },
            ],
        });
    });

    it('supports a one-variable testbench without hard-coded row counts', () => {
        const testbench = {
            variables: ['A'],
            inputs: { A: 'in-a' },
            outputs: { P: 'p-out' },
            expected: { P: 'NOT A' },
        };

        expect(gradeCircuitResponse({ netlist: createNotNetlist(), testbench, maxScore: 4 })).toEqual({
            score: 4,
            checks: [
                { id: 'case-0-p', passed: true, expected: '1', actual: '1' },
                { id: 'case-1-p', passed: true, expected: '0', actual: '0' },
            ],
        });
    });

    it('grades every mapped output for every input combination', () => {
        const testbench = {
            variables: ['A', 'B'],
            inputs: { A: 'in-a', B: 'in-b' },
            outputs: { P: 'p-out', Q: 'q-out' },
            expected: { P: 'A XOR B', Q: 'A AND B' },
        };
        const result = gradeCircuitResponse({ netlist: createTwoOutputNetlist(), testbench, maxScore: 8 });

        expect(result.score).toBe(8);
        expect(result.checks).toHaveLength(8);
        expect(result.checks.every(check => check.passed)).toBe(true);
        expect(result.checks.map(check => check.id)).toEqual([
            'case-00-p',
            'case-00-q',
            'case-01-p',
            'case-01-q',
            'case-10-p',
            'case-10-q',
            'case-11-p',
            'case-11-q',
        ]);
    });

    it('uses the byte-for-byte SPEC check id for the Carry label at row 11', () => {
        const result = gradeCircuitResponse({
            netlist: createAndNetlist(),
            testbench: createAndTestbench('A AND B', 'Carry'),
            maxScore: 10,
        });

        expect(result.checks[3].id).toBe('case-11-carry');
    });

    it('is deterministic for repeated grading of the same input', () => {
        const request = { netlist: createAndNetlist(), testbench: createAndTestbench(), maxScore: 10 };

        expect(gradeCircuitResponse(request)).toEqual(gradeCircuitResponse(request));
    });

    it.each([
        ['invalid syntax', 'A AND'],
        ['a variable outside the declared variable order', 'A AND C'],
    ])('lets Boolean Core reject expected expressions with %s', (_description, expected) => {
        expect(() =>
            gradeCircuitResponse({
                netlist: createAndNetlist(),
                testbench: createAndTestbench(expected),
                maxScore: 10,
            }),
        ).toThrow();
    });

    it('returns a graceful structure check when learner netlist JSON is invalid', () => {
        const netlist = createAndNetlist();
        delete netlist.schemaVersion;

        expect(() => gradeCircuitResponse({ netlist, testbench: createAndTestbench(), maxScore: 10 })).not.toThrow();
        expect(gradeCircuitResponse({ netlist, testbench: createAndTestbench(), maxScore: 10 })).toEqual({
            score: 0,
            checks: [
                {
                    id: 'structure-invalid-netlist',
                    passed: false,
                    expected: 'valid-netlist-shape',
                    actual: 'Phiên bản schema netlist không hợp lệ.',
                },
            ],
        });
    });

    it.each([
        [
            'a dangling gate input',
            createDanglingNetlist,
            {
                id: 'structure-danglingInputPin',
                passed: false,
                expected: 'valid-topology',
                actual: 'danglingInputPin',
                path: 'nodes[gate-p].inputs[b]',
            },
        ],
        [
            'a combinational loop',
            createLoopNetlist,
            {
                id: 'structure-combinationalLoop',
                passed: false,
                expected: 'valid-topology',
                actual: 'combinationalLoop',
                path: 'nodes[gate-p]',
            },
        ],
    ])('returns graceful topology evidence for %s', (_description, createNetlist, expectedCheck) => {
        const request = { netlist: createNetlist(), testbench: createAndTestbench(), maxScore: 10 };

        expect(() => gradeCircuitResponse(request)).not.toThrow();
        expect(gradeCircuitResponse(request)).toEqual({ score: 0, checks: [expectedCheck] });
    });

    it.each([
        [
            'an INPUT node omitted by the testbench',
            createAndNetlist,
            () => ({
                variables: ['A'],
                inputs: { A: 'in-a' },
                outputs: { P: 'p-out' },
                expected: { P: 'A' },
            }),
        ],
        [
            'a testbench input mapped to a non-INPUT node',
            createAndNetlist,
            () => ({ ...createAndTestbench(), inputs: { A: 'in-a', B: 'gate-p' } }),
        ],
    ])('returns a graceful input-mapping check for %s', (_description, createNetlist, createTestbench) => {
        const request = { netlist: createNetlist(), testbench: createTestbench(), maxScore: 10 };

        expect(() => gradeCircuitResponse(request)).not.toThrow();
        expect(gradeCircuitResponse(request)).toEqual({
            score: 0,
            checks: [
                {
                    id: 'structure-input-mapping',
                    passed: false,
                    expected: 'testbench-inputs-match-netlist-inputs',
                    actual: 'mismatch',
                },
            ],
        });
    });

    it.each([
        [
            'an OUTPUT node omitted by the testbench',
            createTwoOutputNetlist,
            () => ({
                variables: ['A', 'B'],
                inputs: { A: 'in-a', B: 'in-b' },
                outputs: { P: 'p-out' },
                expected: { P: 'A XOR B' },
            }),
        ],
        [
            'a testbench output mapped to a non-OUTPUT node',
            createAndNetlist,
            () => ({ ...createAndTestbench(), outputs: { P: 'gate-p' } }),
        ],
    ])('returns a graceful output-mapping check for %s', (_description, createNetlist, createTestbench) => {
        const request = { netlist: createNetlist(), testbench: createTestbench(), maxScore: 10 };

        expect(() => gradeCircuitResponse(request)).not.toThrow();
        expect(gradeCircuitResponse(request)).toEqual({
            score: 0,
            checks: [
                {
                    id: 'structure-output-mapping',
                    passed: false,
                    expected: 'testbench-outputs-match-netlist-outputs',
                    actual: 'mismatch',
                },
            ],
        });
    });

    it.each([
        ['an empty variable list', { variables: [], inputs: {}, outputs: { P: 'p-out' }, expected: { P: '0' } }],
        [
            'a variable outside A-D',
            {
                variables: ['A', 'E'],
                inputs: { A: 'in-a', E: 'in-b' },
                outputs: { P: 'p-out' },
                expected: { P: 'A AND E' },
            },
        ],
        [
            'duplicate variables',
            { variables: ['A', 'A'], inputs: { A: 'in-a' }, outputs: { P: 'p-out' }, expected: { P: 'A' } },
        ],
        ['a missing input mapping', { ...createAndTestbench(), inputs: { A: 'in-a' } }],
        ['an input mapping with the wrong type', { ...createAndTestbench(), inputs: ['in-a', 'in-b'] }],
        ['an empty output mapping', { ...createAndTestbench(), outputs: {}, expected: {} }],
        ['an output mapping with the wrong type', { ...createAndTestbench(), outputs: null }],
        ['a missing expected expression', { ...createAndTestbench(), expected: {} }],
    ])('rejects invalid testbench configuration with the locked error for %s', (_description, testbench) => {
        expect(() => gradeCircuitResponse({ netlist: createAndNetlist(), testbench, maxScore: 10 })).toThrow(
            new TypeError('Testbench không hợp lệ.'),
        );
    });

    it.each([
        ['zero', 0],
        ['a negative number', -1],
        ['NaN', Number.NaN],
        ['a numeric string', '10'],
    ])('rejects %s as maxScore', (_description, maxScore) => {
        expect(() =>
            gradeCircuitResponse({ netlist: createAndNetlist(), testbench: createAndTestbench(), maxScore }),
        ).toThrow(new TypeError('Điểm tối đa không hợp lệ.'));
    });

    it('validates author configuration before parsing learner netlist', () => {
        expect(() => gradeCircuitResponse({ netlist: null, testbench: null, maxScore: 0 })).toThrow(
            new TypeError('Testbench không hợp lệ.'),
        );
        expect(() => gradeCircuitResponse({ netlist: null, testbench: createAndTestbench(), maxScore: 0 })).toThrow(
            new TypeError('Điểm tối đa không hợp lệ.'),
        );
    });
});
