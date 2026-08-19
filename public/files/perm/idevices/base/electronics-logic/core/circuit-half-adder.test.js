const { gradeCircuitResponse } = require('./circuit-grader.js');
const fixture = require('./fixtures/circuit-half-adder.json');

const expectedCheckIds = [
    'case-00-sum',
    'case-00-carry',
    'case-01-sum',
    'case-01-carry',
    'case-10-sum',
    'case-10-carry',
    'case-11-sum',
    'case-11-carry',
];

function cloneNetlist() {
    return structuredClone(fixture.netlist);
}

describe('Half-adder circuit fixture', () => {
    it('keeps the locked fixture shape and passes all four input cases', () => {
        expect(fixture).toMatchObject({
            schemaVersion: 1,
            id: 'half-adder',
            testbench: {
                variables: ['A', 'B'],
                inputs: { A: 'in-a', B: 'in-b' },
                outputs: { Sum: 'sum-out', Carry: 'carry-out' },
                expected: { Sum: 'A XOR B', Carry: 'A AND B' },
            },
        });
        expect(fixture.netlist.nodes.map(({ id, kind }) => ({ id, kind }))).toEqual([
            { id: 'in-a', kind: 'INPUT' },
            { id: 'in-b', kind: 'INPUT' },
            { id: 'xor-1', kind: 'XOR' },
            { id: 'and-1', kind: 'AND' },
            { id: 'sum-out', kind: 'OUTPUT' },
            { id: 'carry-out', kind: 'OUTPUT' },
        ]);
        expect(fixture.netlist.wires).toEqual([
            { id: 'w1', from: { node: 'in-a', pin: 'out' }, to: { node: 'xor-1', pin: 'a' } },
            { id: 'w2', from: { node: 'in-b', pin: 'out' }, to: { node: 'xor-1', pin: 'b' } },
            { id: 'w3', from: { node: 'in-a', pin: 'out' }, to: { node: 'and-1', pin: 'a' } },
            { id: 'w4', from: { node: 'in-b', pin: 'out' }, to: { node: 'and-1', pin: 'b' } },
            { id: 'w5', from: { node: 'xor-1', pin: 'out' }, to: { node: 'sum-out', pin: 'a' } },
            { id: 'w6', from: { node: 'and-1', pin: 'out' }, to: { node: 'carry-out', pin: 'a' } },
        ]);

        const result = gradeCircuitResponse({
            netlist: cloneNetlist(),
            testbench: fixture.testbench,
            maxScore: 10,
        });

        expect(result.checks).toHaveLength(8);
        expect(result.checks.map(check => check.id)).toEqual(expectedCheckIds);
        expect(result.checks.every(check => check.passed)).toBe(true);
        expect(result.score).toBe(10);
    });

    it('reports a removed carry wire as one graceful dangling-pin structure error', () => {
        const netlist = cloneNetlist();
        netlist.wires = netlist.wires.filter(wire => wire.id !== 'w4');
        let result;

        expect(() => {
            result = gradeCircuitResponse({ netlist, testbench: fixture.testbench, maxScore: 10 });
        }).not.toThrow();
        expect(result).toEqual({
            score: 0,
            checks: [
                {
                    id: 'structure-danglingInputPin',
                    passed: false,
                    expected: 'valid-topology',
                    actual: 'danglingInputPin',
                    path: 'nodes[and-1].inputs[b]',
                },
            ],
        });
    });

    it('fails only case 10 carry when the carry gate receives A twice', () => {
        const netlist = cloneNetlist();
        const carryWire = netlist.wires.find(wire => wire.id === 'w4');
        carryWire.from.node = 'in-a';
        let result;

        expect(() => {
            result = gradeCircuitResponse({ netlist, testbench: fixture.testbench, maxScore: 10 });
        }).not.toThrow();

        expect(result.checks).toHaveLength(8);
        expect(result.checks.filter(check => check.passed)).toHaveLength(7);
        expect(result.checks.filter(check => !check.passed)).toEqual([
            {
                id: 'case-10-carry',
                passed: false,
                expected: '0',
                actual: '1',
            },
        ]);
        expect(result.score).toBe(8.75);
    });
});
