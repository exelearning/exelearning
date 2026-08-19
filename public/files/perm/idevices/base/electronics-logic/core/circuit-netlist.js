'use strict';

const GATE_PINS = Object.freeze({
    INPUT: Object.freeze({ inputs: Object.freeze([]), outputs: Object.freeze(['out']) }),
    OUTPUT: Object.freeze({ inputs: Object.freeze(['a']), outputs: Object.freeze([]) }),
    NOT: Object.freeze({ inputs: Object.freeze(['a']), outputs: Object.freeze(['out']) }),
    AND: Object.freeze({ inputs: Object.freeze(['a', 'b']), outputs: Object.freeze(['out']) }),
    OR: Object.freeze({ inputs: Object.freeze(['a', 'b']), outputs: Object.freeze(['out']) }),
    XOR: Object.freeze({ inputs: Object.freeze(['a', 'b']), outputs: Object.freeze(['out']) }),
});

const ERROR_MESSAGES = Object.freeze({
    unknownNodeReference: 'Dây nối trỏ tới node không tồn tại.',
    unknownPin: 'Dây nối trỏ tới chân không tồn tại.',
    wireDirectionMismatch: 'Dây nối phải đi từ chân ra tới chân vào.',
    danglingInputPin: 'Chân đầu vào chưa được nối dây.',
    multipleSources: 'Một chân đầu vào không được nhận nhiều nguồn.',
    combinationalLoop: 'Mạch có vòng lặp tổ hợp, không thể xác định thứ tự tính toán.',
});

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

function validateNodes(nodes) {
    const ids = new Set();
    for (const node of nodes) {
        const valid =
            isPlainObject(node) &&
            isNonEmptyString(node.id) &&
            Object.hasOwn(GATE_PINS, node.kind) &&
            Number.isFinite(node.x) &&
            Number.isFinite(node.y) &&
            !ids.has(node.id);
        if (!valid) throw new TypeError('Danh sách node của netlist không hợp lệ.');
        ids.add(node.id);
    }
}

function isEndpoint(endpoint) {
    return isPlainObject(endpoint) && typeof endpoint.node === 'string' && typeof endpoint.pin === 'string';
}

function validateWires(wires) {
    const ids = new Set();
    for (const wire of wires) {
        const valid =
            isPlainObject(wire) &&
            isNonEmptyString(wire.id) &&
            isEndpoint(wire.from) &&
            isEndpoint(wire.to) &&
            !ids.has(wire.id);
        if (!valid) throw new TypeError('Danh sách dây nối của netlist không hợp lệ.');
        ids.add(wire.id);
    }
}

function parseNetlist(raw) {
    if (!isPlainObject(raw)) throw new TypeError('Netlist phải là một đối tượng JSON hợp lệ.');
    if (raw.schemaVersion !== 1) throw new TypeError('Phiên bản schema netlist không hợp lệ.');
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.wires)) {
        throw new TypeError('Netlist phải có danh sách node và dây nối hợp lệ.');
    }
    validateNodes(raw.nodes);
    validateWires(raw.wires);
    return JSON.parse(JSON.stringify(raw));
}

function findCycleNodes(nodes, adjacency) {
    let nextIndex = 0;
    const indices = new Map();
    const lowLinks = new Map();
    const stack = [];
    const onStack = new Set();
    const cycleNodes = new Set();

    function visit(nodeId) {
        indices.set(nodeId, nextIndex);
        lowLinks.set(nodeId, nextIndex);
        nextIndex += 1;
        stack.push(nodeId);
        onStack.add(nodeId);

        for (const targetId of adjacency.get(nodeId)) {
            if (!indices.has(targetId)) {
                visit(targetId);
                lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), lowLinks.get(targetId)));
            } else if (onStack.has(targetId)) {
                lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId), indices.get(targetId)));
            }
        }

        if (lowLinks.get(nodeId) !== indices.get(nodeId)) return;
        const component = [];
        let member;
        do {
            member = stack.pop();
            onStack.delete(member);
            component.push(member);
        } while (member !== nodeId);

        const hasSelfLoop = component.length === 1 && adjacency.get(component[0]).includes(component[0]);
        if (component.length > 1 || hasSelfLoop) component.forEach(id => cycleNodes.add(id));
    }

    for (const node of nodes) {
        if (!indices.has(node.id)) visit(node.id);
    }
    return nodes.filter(node => cycleNodes.has(node.id)).map(node => node.id);
}

function topologicalSort(model) {
    const nodeIds = new Set(model.nodes.map(node => node.id));
    const indegree = new Map(model.nodes.map(node => [node.id, 0]));
    const adjacency = new Map(model.nodes.map(node => [node.id, []]));

    for (const wire of model.wires) {
        if (!nodeIds.has(wire.from.node) || !nodeIds.has(wire.to.node)) continue;
        adjacency.get(wire.from.node).push(wire.to.node);
        indegree.set(wire.to.node, indegree.get(wire.to.node) + 1);
    }

    const queue = model.nodes.filter(node => indegree.get(node.id) === 0).map(node => node.id);
    const order = [];
    for (let index = 0; index < queue.length; index += 1) {
        const nodeId = queue[index];
        order.push(nodeId);
        for (const targetId of adjacency.get(nodeId)) {
            const nextIndegree = indegree.get(targetId) - 1;
            indegree.set(targetId, nextIndegree);
            if (nextIndegree === 0) queue.push(targetId);
        }
    }

    if (order.length === model.nodes.length) return { ok: true, order };
    return {
        ok: false,
        cycle: findCycleNodes(model.nodes, adjacency),
    };
}

function addError(errors, code, path) {
    errors.push({ code, path, message: ERROR_MESSAGES[code] });
}

function validateTopology(model) {
    const nodesById = new Map(model.nodes.map(node => [node.id, node]));
    const incoming = new Map();
    const errors = [];

    for (const wire of model.wires) {
        const fromNode = nodesById.get(wire.from.node);
        const toNode = nodesById.get(wire.to.node);
        if (!fromNode) addError(errors, 'unknownNodeReference', `wires[${wire.id}].from.node`);
        if (!toNode) addError(errors, 'unknownNodeReference', `wires[${wire.id}].to.node`);

        const fromPins = fromNode ? GATE_PINS[fromNode.kind] : null;
        const toPins = toNode ? GATE_PINS[toNode.kind] : null;
        const fromPinExists = fromPins
            ? fromPins.inputs.includes(wire.from.pin) || fromPins.outputs.includes(wire.from.pin)
            : false;
        const toPinExists = toPins
            ? toPins.inputs.includes(wire.to.pin) || toPins.outputs.includes(wire.to.pin)
            : false;
        if (fromNode && !fromPinExists) addError(errors, 'unknownPin', `wires[${wire.id}].from.pin`);
        if (toNode && !toPinExists) addError(errors, 'unknownPin', `wires[${wire.id}].to.pin`);

        if (!fromPinExists || !toPinExists) continue;
        const hasValidDirection = fromPins.outputs.includes(wire.from.pin) && toPins.inputs.includes(wire.to.pin);
        if (!hasValidDirection) {
            addError(errors, 'wireDirectionMismatch', `wires[${wire.id}]`);
            continue;
        }

        const key = `${wire.to.node}\0${wire.to.pin}`;
        incoming.set(key, (incoming.get(key) ?? 0) + 1);
    }

    for (const node of model.nodes) {
        for (const pin of GATE_PINS[node.kind].inputs) {
            const sourceCount = incoming.get(`${node.id}\0${pin}`) ?? 0;
            if (sourceCount === 0) addError(errors, 'danglingInputPin', `nodes[${node.id}].inputs[${pin}]`);
            if (sourceCount >= 2) addError(errors, 'multipleSources', `nodes[${node.id}].inputs[${pin}]`);
        }
    }

    const sortResult = topologicalSort(model);
    if (!sortResult.ok) addError(errors, 'combinationalLoop', `nodes[${sortResult.cycle.join(',')}]`);

    return { valid: errors.length === 0, errors };
}

module.exports = Object.freeze({
    GATE_PINS,
    parseNetlist,
    topologicalSort,
    validateTopology,
});
