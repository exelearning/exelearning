'use strict';

const { createTruthVector } = require('./boolean-core.js');
const { propagate } = require('./circuit-engine.js');
const { parseNetlist, validateTopology } = require('./circuit-netlist.js');

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function hasExactKeys(value, expectedKeys) {
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value);
    return keys.length === expectedKeys.length && keys.every(key => expectedKeys.includes(key));
}

function isValidTestbench(testbench) {
    if (!isPlainObject(testbench)) return false;
    const variables = testbench.variables;
    const validVariables =
        Array.isArray(variables) &&
        variables.length >= 1 &&
        variables.length <= 4 &&
        variables.every(variable => typeof variable === 'string' && /^[A-D]$/.test(variable)) &&
        new Set(variables).size === variables.length;
    if (!validVariables || !hasExactKeys(testbench.inputs, variables)) return false;
    if (Object.values(testbench.inputs).some(value => !isNonEmptyString(value))) return false;

    if (!isPlainObject(testbench.outputs)) return false;
    const outputNames = Object.keys(testbench.outputs);
    if (
        outputNames.length === 0 ||
        outputNames.some(name => !isNonEmptyString(name)) ||
        Object.values(testbench.outputs).some(value => !isNonEmptyString(value))
    ) {
        return false;
    }
    return (
        hasExactKeys(testbench.expected, outputNames) &&
        Object.values(testbench.expected).every(value => isNonEmptyString(value))
    );
}

function sameSet(leftValues, rightValues) {
    const left = new Set(leftValues);
    const right = new Set(rightValues);
    return left.size === right.size && [...left].every(value => right.has(value));
}

function mappingError(kind) {
    return {
        score: 0,
        checks: [
            {
                id: `structure-${kind}-mapping`,
                passed: false,
                expected: `testbench-${kind}s-match-netlist-${kind}s`,
                actual: 'mismatch',
            },
        ],
    };
}

function gradeCircuitResponse({ netlist, testbench, maxScore }) {
    if (!isValidTestbench(testbench)) throw new TypeError('Testbench không hợp lệ.');
    if (typeof maxScore !== 'number' || !Number.isFinite(maxScore) || maxScore <= 0) {
        throw new TypeError('Điểm tối đa không hợp lệ.');
    }

    let model;
    try {
        model = parseNetlist(netlist);
    } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        return {
            score: 0,
            checks: [
                {
                    id: 'structure-invalid-netlist',
                    passed: false,
                    expected: 'valid-netlist-shape',
                    actual: error.message,
                },
            ],
        };
    }
    const topology = validateTopology(model);
    if (!topology.valid) {
        return {
            score: 0,
            checks: topology.errors.map(error => ({
                id: `structure-${error.code}`,
                passed: false,
                expected: 'valid-topology',
                actual: error.code,
                path: error.path,
            })),
        };
    }

    const inputNodeIds = model.nodes.filter(node => node.kind === 'INPUT').map(node => node.id);
    if (!sameSet(Object.values(testbench.inputs), inputNodeIds)) return mappingError('input');
    const outputNodeIds = model.nodes.filter(node => node.kind === 'OUTPUT').map(node => node.id);
    if (!sameSet(Object.values(testbench.outputs), outputNodeIds)) return mappingError('output');

    const outputNames = Object.keys(testbench.outputs);
    const expectedVectors = Object.fromEntries(
        outputNames.map(name => [name, createTruthVector(testbench.expected[name], testbench.variables)]),
    );
    const checks = [];

    for (let index = 0; index < 2 ** testbench.variables.length; index += 1) {
        const bits = index.toString(2).padStart(testbench.variables.length, '0');
        const inputAssignment = Object.fromEntries(
            testbench.variables.map((variable, variableIndex) => [testbench.inputs[variable], bits[variableIndex]]),
        );
        const result = propagate(model, inputAssignment);

        for (const name of outputNames) {
            const expected = String(expectedVectors[name].values[index]);
            const actual = result.values[`${testbench.outputs[name]}.a`];
            checks.push({
                id: `case-${bits}-${name.toLowerCase()}`,
                passed: actual === expected,
                expected,
                actual,
            });
        }
    }

    const passed = checks.filter(check => check.passed).length;
    return {
        score: Number(((passed / checks.length) * maxScore).toFixed(4)),
        checks,
    };
}

module.exports = Object.freeze({ gradeCircuitResponse, isValidTestbench });
