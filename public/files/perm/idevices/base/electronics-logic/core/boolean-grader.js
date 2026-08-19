'use strict';

const core = require('./boolean-core.js');
const circuitGrader = require('./circuit-grader.js');
const kmapGrader = require('./kmap-grader.js');

const ENGINE = Object.freeze({ name: 'electronics-logic-core', version: '0.1.0' });
const SUPPORTED_VALUES = Object.freeze(['0', '1', 'X']);

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateExercise(exercise) {
    const validVariables =
        Array.isArray(exercise?.variables) &&
        exercise.variables.length >= 2 &&
        exercise.variables.length <= 4 &&
        exercise.variables.every(variable => typeof variable === 'string' && /^[A-D]$/.test(variable)) &&
        new Set(exercise.variables).size === exercise.variables.length;
    if (
        !isPlainObject(exercise) ||
        typeof exercise.id !== 'string' ||
        exercise.id.trim() === '' ||
        exercise.type !== 'electronics.logic' ||
        exercise.schemaVersion !== 1 ||
        !['boolean', 'truthTable', 'kmap', 'circuit'].includes(exercise.mode) ||
        !validVariables ||
        !isPlainObject(exercise.authoring) ||
        !isPlainObject(exercise.answer) ||
        !isPlainObject(exercise.grading) ||
        typeof exercise.grading.maxScore !== 'number' ||
        !Number.isFinite(exercise.grading.maxScore) ||
        exercise.grading.maxScore <= 0
    ) {
        throw new TypeError('Bài tập chấm điểm không hợp lệ.');
    }
}

function validateMetadata(metadata) {
    const validDate =
        typeof metadata?.createdAt === 'string' &&
        !Number.isNaN(Date.parse(metadata.createdAt)) &&
        new Date(metadata.createdAt).toISOString() === metadata.createdAt;
    if (typeof metadata?.attemptId !== 'string' || metadata.attemptId.trim() === '' || !validDate) {
        throw new TypeError('Thiếu định danh lần làm hoặc thời điểm chấm.');
    }
}

function createResult(exercise, metadata, score, checks) {
    return {
        attemptId: metadata.attemptId,
        exerciseId: exercise.id,
        engine: ENGINE.name,
        engineVersion: ENGINE.version,
        score,
        maxScore: exercise.grading.maxScore,
        checks,
        createdAt: metadata.createdAt,
    };
}

function expectedTruthVector(exercise) {
    if (exercise.authoring.answerSource === 'expression') {
        if (typeof exercise.answer.expression !== 'string' || exercise.answer.expression.trim() === '') {
            throw new TypeError('Bài tập chấm điểm không hợp lệ.');
        }
        return core.createTruthVector(exercise.answer.expression, exercise.variables);
    }
    if (exercise.authoring.answerSource !== 'minterms') {
        throw new TypeError('Bài tập chấm điểm không hợp lệ.');
    }
    return core.mintermsToVector({
        variables: exercise.variables,
        minterms: exercise.answer.minterms,
        dontCares: exercise.answer.dontCares,
    });
}

function gradeTruthTable(exercise, response, metadata) {
    const expected = expectedTruthVector(exercise);
    if (!Array.isArray(response?.values) || response.values.length !== expected.values.length) {
        throw new TypeError(`Câu trả lời bảng chân trị phải có đúng ${expected.values.length} ô.`);
    }
    if (response.values.some(value => !SUPPORTED_VALUES.includes(value))) {
        throw new TypeError('Mỗi ô chỉ nhận 0, 1 hoặc X.');
    }
    const checks = expected.values.map((value, index) => {
        const actual = response.values[index];
        const expectedValue = String(value);
        return {
            id: `case-${index.toString(2).padStart(exercise.variables.length, '0')}`,
            passed: expectedValue === 'X' || actual === expectedValue,
            expected: expectedValue,
            actual,
        };
    });
    const passed = checks.filter(check => check.passed).length;
    const score = Number(((passed / checks.length) * exercise.grading.maxScore).toFixed(4));
    return createResult(exercise, metadata, score, checks);
}

function gradeExpression(exercise, response, metadata) {
    if (exercise.authoring.answerSource !== 'expression' || typeof exercise.answer.expression !== 'string') {
        throw new TypeError('Bài tập chấm điểm không hợp lệ.');
    }
    if (typeof response?.expression !== 'string' || response.expression.trim() === '') {
        throw new TypeError('Chưa nhập biểu thức cần chấm.');
    }
    try {
        const passed = core.areEquivalent(response.expression, exercise.answer.expression, exercise.variables);
        return createResult(exercise, metadata, passed ? exercise.grading.maxScore : 0, [
            {
                id: 'expression-equivalence',
                passed,
                expected: 'equivalent',
                actual: passed ? 'equivalent' : 'different',
            },
        ]);
    } catch (error) {
        if (!(error instanceof core.BooleanSyntaxError)) throw error;
        return createResult(exercise, metadata, 0, [
            {
                id: 'expression-syntax',
                passed: false,
                expected: 'valid-expression',
                actual: 'invalid-expression',
                error: {
                    code: error.code,
                    position: error.position,
                    expected: [...error.expected],
                    found: error.found,
                    message: error.message,
                },
            },
        ]);
    }
}

function gradeKmap(exercise, response, metadata) {
    const expected = expectedTruthVector(exercise);
    const expectedModel = core.vectorToKmapModel(expected);
    const validCellsShape =
        Array.isArray(response.cells) &&
        response.cells.length === expectedModel.cells.length &&
        response.cells.every((row, index) => Array.isArray(row) && row.length === expectedModel.cells[index].length);
    if (!validCellsShape || response.cells.flat().length !== expected.values.length) {
        throw new TypeError(`Câu trả lời Karnaugh phải có đúng ${expected.values.length} ô.`);
    }
    if (response.cells.flat().some(value => !SUPPORTED_VALUES.includes(value))) {
        throw new TypeError('Mỗi ô Karnaugh chỉ nhận 0, 1 hoặc X.');
    }
    const size = expected.values.length;
    const validGroups =
        Array.isArray(response.groups) &&
        response.groups.every(
            group =>
                isPlainObject(group) &&
                typeof group.id === 'string' &&
                group.id.trim() !== '' &&
                Array.isArray(group.cells) &&
                group.cells.every(cell => Number.isInteger(cell) && cell >= 0 && cell < size),
        );
    if (!validGroups) throw new TypeError('Danh sách nhóm Karnaugh không hợp lệ.');

    const { score, checks } = kmapGrader.gradeKmapResponse({
        expected,
        response,
        variableCount: exercise.variables.length,
        maxScore: exercise.grading.maxScore,
    });
    return createResult(exercise, metadata, score, checks);
}

function gradeCircuit(exercise, response, metadata) {
    if (!isPlainObject(response?.netlist)) {
        throw new TypeError('Câu trả lời mạch không hợp lệ.');
    }
    const { score, checks } = circuitGrader.gradeCircuitResponse({
        netlist: response.netlist,
        testbench: exercise.answer.testbench,
        maxScore: exercise.grading.maxScore,
    });
    return createResult(exercise, metadata, score, checks);
}

function gradeActivity(exercise, response, metadata) {
    validateExercise(exercise);
    validateMetadata(metadata);
    if (!isPlainObject(response)) throw new TypeError('Câu trả lời cần chấm không hợp lệ.');
    if (exercise.mode === 'truthTable') return gradeTruthTable(exercise, response, metadata);
    if (exercise.mode === 'kmap') return gradeKmap(exercise, response, metadata);
    if (exercise.mode === 'circuit') return gradeCircuit(exercise, response, metadata);
    return gradeExpression(exercise, response, metadata);
}

module.exports = {
    ENGINE,
    gradeActivity,
};
