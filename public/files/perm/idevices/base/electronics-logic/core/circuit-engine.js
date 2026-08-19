'use strict';

const { GATE_PINS, topologicalSort } = require('./circuit-netlist.js');

const SIGNAL_VALUES = Object.freeze(['0', '1', 'X']);
const COMPUTATIONAL_GATES = Object.freeze(['NOT', 'AND', 'OR', 'XOR']);

function evaluateGate(kind, inputValues) {
    if (!COMPUTATIONAL_GATES.includes(kind)) {
        throw new TypeError('Chỉ có thể tính giá trị cho cổng NOT, AND, OR hoặc XOR.');
    }
    if (
        !Array.isArray(inputValues) ||
        inputValues.length !== GATE_PINS[kind].inputs.length ||
        inputValues.some(value => !SIGNAL_VALUES.includes(value))
    ) {
        throw new TypeError('Giá trị đầu vào của cổng phải là 0, 1 hoặc X và đủ số chân.');
    }

    if (kind === 'NOT') return inputValues[0] === 'X' ? 'X' : inputValues[0] === '0' ? '1' : '0';
    if (kind === 'AND') {
        if (inputValues.includes('0')) return '0';
        return inputValues.includes('X') ? 'X' : '1';
    }
    if (kind === 'OR') {
        if (inputValues.includes('1')) return '1';
        return inputValues.includes('X') ? 'X' : '0';
    }
    if (inputValues.includes('X')) return 'X';
    return inputValues[0] === inputValues[1] ? '0' : '1';
}

function resolveInputValue(inputAssignment, nodeId) {
    const value = Object.hasOwn(inputAssignment, nodeId) ? inputAssignment[nodeId] : 'X';
    if (!SIGNAL_VALUES.includes(value)) {
        throw new TypeError('Giá trị INPUT phải là chuỗi 0, 1 hoặc X.');
    }
    return value;
}

function propagate(model, inputAssignment) {
    const sortResult = topologicalSort(model);
    if (!sortResult.ok) {
        return {
            ok: false,
            error: {
                code: 'combinationalLoop',
                path: `nodes[${sortResult.cycle.join(',')}]`,
                message: 'Mạch có vòng lặp tổ hợp, không thể xác định thứ tự tính toán.',
            },
        };
    }

    const nodesById = new Map(model.nodes.map(node => [node.id, node]));
    const incomingByPin = new Map(model.wires.map(wire => [`${wire.to.node}\0${wire.to.pin}`, wire.from]));
    const values = {};

    for (const nodeId of sortResult.order) {
        const node = nodesById.get(nodeId);
        if (node.kind === 'INPUT') {
            values[`${node.id}.out`] = resolveInputValue(inputAssignment, node.id);
            continue;
        }

        const inputValues = GATE_PINS[node.kind].inputs.map(pin => {
            const source = incomingByPin.get(`${node.id}\0${pin}`);
            const value = values[`${source.node}.${source.pin}`];
            values[`${node.id}.${pin}`] = value;
            return value;
        });
        if (GATE_PINS[node.kind].outputs.length > 0) {
            values[`${node.id}.out`] = evaluateGate(node.kind, inputValues);
        }
    }

    return { ok: true, values };
}

module.exports = Object.freeze({
    SIGNAL_VALUES,
    evaluateGate,
    propagate,
});
