'use strict';

const { isValidTestbench: isValidCircuitTestbench } = require('./circuit-grader.js');

const SCHEMA_VERSION = 1;
const ACTIVITY_TYPE = 'electronics.logic';
const SUPPORTED_MODES = Object.freeze(['boolean', 'truthTable', 'kmap', 'circuit']);
const AUTHORING_MODES = Object.freeze(['boolean', 'truthTable', 'kmap', 'circuit']);
const EXPRESSION_ANSWER_MODES = Object.freeze(['boolean', 'truthTable', 'kmap']);
const ANSWER_SOURCES = Object.freeze(['expression', 'minterms']);
const VARIABLE_ORDER = Object.freeze(['A', 'B', 'C', 'D']);
const LEGACY_MODE_ALIASES = Object.freeze({ booleanExpression: 'boolean', karnaugh: 'kmap' });

const ERROR_MESSAGES = Object.freeze({
    invalidObject: 'Dữ liệu Electronics Logic phải là một đối tượng JSON.',
    invalidId: 'Dữ liệu Electronics Logic thiếu mã hoạt động hợp lệ.',
    invalidType: 'Loại hoạt động Electronics Logic không được hỗ trợ.',
    missingSchemaVersion: 'Dữ liệu Electronics Logic thiếu phiên bản schema.',
    unsupportedSchemaVersion: 'Phiên bản dữ liệu Electronics Logic không được hỗ trợ.',
    invalidMode: 'Chế độ Electronics Logic không hợp lệ.',
    invalidPrompt: 'Đề bài Electronics Logic phải là văn bản.',
    emptyPrompt: 'Đề bài không được để trống.',
    invalidVariables: 'Chế độ Boolean và bảng chân trị cần từ hai đến bốn biến A–D duy nhất.',
    invalidAuthoring: 'Dữ liệu biên soạn Electronics Logic không hợp lệ.',
    invalidAnswerSource: 'Nguồn đáp án phải là biểu thức hoặc danh sách minterm.',
    invalidSolution: 'Lời giải phải là văn bản.',
    invalidAnswer: 'Dữ liệu đáp án Electronics Logic không hợp lệ.',
    invalidExpression: 'Biểu thức đáp án phải là văn bản.',
    emptyExpression: 'Biểu thức đáp án không được để trống.',
    invalidMinterms: 'Minterm phải là danh sách số nguyên.',
    invalidDontCares: "Don't-care phải là danh sách số nguyên.",
    invalidTestbench: 'Testbench mạch điện không hợp lệ.',
    duplicateMinterm: 'Danh sách minterm không được lặp giá trị.',
    duplicateDontCare: "Danh sách don't-care không được lặp giá trị.",
    mintermOutOfRange: 'Minterm phải nằm trong miền của số biến đã chọn.',
    dontCareOutOfRange: "Don't-care phải nằm trong miền của số biến đã chọn.",
    overlappingDontCare: "Minterm và don't-care không được trùng nhau.",
    invalidOutputs: 'Đáp án đầu ra phải là một danh sách.',
    invalidOutputLength: 'Số đáp án đầu ra phải bằng 2 lũy thừa số biến.',
    invalidGrading: 'Dữ liệu chấm điểm Electronics Logic không hợp lệ.',
    invalidMaxScore: 'Điểm tối đa Electronics Logic phải lớn hơn 0.',
    invalidLearner: 'Dữ liệu người học Electronics Logic không hợp lệ.',
    invalidAccessibility: 'Dữ liệu hỗ trợ tiếp cận Electronics Logic không hợp lệ.',
    invalidAccessibilityLabel: 'Nhãn hỗ trợ tiếp cận Electronics Logic phải là văn bản.',
});

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function createDefaultActivity(options = {}) {
    return {
        id: typeof options.id === 'string' ? options.id : '',
        type: ACTIVITY_TYPE,
        schemaVersion: SCHEMA_VERSION,
        mode: 'boolean',
        prompt: '',
        variables: ['A', 'B'],
        authoring: {
            answerSource: 'expression',
            placeholderText:
                typeof options.placeholderText === 'string'
                    ? options.placeholderText
                    : 'Electronics Logic activity placeholder',
            solution: '',
        },
        answer: { expression: '', minterms: [], dontCares: [] },
        grading: { maxScore: 10 },
        learner: {},
        accessibility: { label: '' },
    };
}

function indicesForOutput(outputs, expected) {
    if (!Array.isArray(outputs)) return [];
    const indices = [];
    outputs.forEach((value, index) => {
        if (value === expected) indices.push(index);
    });
    return indices;
}

function completeMigratedData(data, defaults) {
    if (AUTHORING_MODES.includes(data.mode) && Array.isArray(data.variables) && data.variables.length < 2) {
        data.variables = cloneJson(defaults.variables);
    }
    if (isPlainObject(data.authoring)) {
        if (typeof data.authoring.placeholderText !== 'string' || data.authoring.placeholderText.trim() === '') {
            data.authoring.placeholderText = defaults.authoring.placeholderText;
        }
        if (!ANSWER_SOURCES.includes(data.authoring.answerSource)) {
            data.authoring.answerSource = Array.isArray(data.answer?.outputs) ? 'minterms' : 'expression';
        }
        if (typeof data.authoring.solution !== 'string') data.authoring.solution = '';
    }
    if (isPlainObject(data.answer)) {
        if (typeof data.answer.expression !== 'string') data.answer.expression = '';
        if (!Array.isArray(data.answer.minterms)) {
            data.answer.minterms = indicesForOutput(data.answer.outputs, 1);
        }
        if (!Array.isArray(data.answer.dontCares)) {
            data.answer.dontCares = indicesForOutput(data.answer.outputs, 'X');
        }
    }
    return data;
}

function migrateSchemaV0ToV1(source, options = {}) {
    if (!isPlainObject(source)) return source;

    const sourceVersion = source.schemaVersion == null ? 0 : source.schemaVersion;
    if (sourceVersion !== 0) return cloneJson(source);

    const fallbackId = typeof options.fallbackId === 'string' ? options.fallbackId : '';
    const defaults = createDefaultActivity({ id: fallbackId, placeholderText: options.placeholderText });
    const migrated = cloneJson(source);

    migrated.id =
        typeof source.id === 'string' && source.id.trim() !== ''
            ? source.id
            : typeof source.ideviceId === 'string' && source.ideviceId.trim() !== ''
              ? source.ideviceId
              : fallbackId;
    migrated.type = typeof source.type === 'string' ? source.type : defaults.type;
    migrated.schemaVersion = SCHEMA_VERSION;
    migrated.mode = LEGACY_MODE_ALIASES[source.mode] || (typeof source.mode === 'string' ? source.mode : defaults.mode);
    migrated.prompt = typeof source.prompt === 'string' ? source.prompt : defaults.prompt;
    migrated.variables = Array.isArray(source.variables) ? cloneJson(source.variables) : cloneJson(defaults.variables);
    migrated.authoring = isPlainObject(source.authoring) ? cloneJson(source.authoring) : {};
    migrated.answer = isPlainObject(source.answer) ? cloneJson(source.answer) : {};
    migrated.grading = isPlainObject(source.grading) ? cloneJson(source.grading) : cloneJson(defaults.grading);
    migrated.learner = isPlainObject(source.learner) ? cloneJson(source.learner) : {};
    migrated.accessibility = isPlainObject(source.accessibility)
        ? cloneJson(source.accessibility)
        : cloneJson(defaults.accessibility);

    if (typeof source.placeholderText === 'string' && source.placeholderText.trim() !== '') {
        migrated.authoring.placeholderText = source.placeholderText;
    }
    return completeMigratedData(migrated, defaults);
}

function validateAnswer(data, addError) {
    if (typeof data.answer.expression !== 'string') addError('invalidExpression', 'answer.expression');
    if (!Array.isArray(data.answer.minterms) || !data.answer.minterms.every(Number.isInteger)) {
        addError('invalidMinterms', 'answer.minterms');
    }
    if (!Array.isArray(data.answer.dontCares) || !data.answer.dontCares.every(Number.isInteger)) {
        addError('invalidDontCares', 'answer.dontCares');
    }

    if (data.authoring.answerSource === 'expression') {
        if (typeof data.answer.expression === 'string' && data.answer.expression.trim() === '') {
            addError('emptyExpression', 'answer.expression');
        }
        return;
    }
    if (data.authoring.answerSource !== 'minterms') return;

    const minterms = Array.isArray(data.answer.minterms) ? data.answer.minterms : [];
    const dontCares = Array.isArray(data.answer.dontCares) ? data.answer.dontCares : [];
    const maxIndex = 2 ** data.variables.length - 1;
    if (new Set(minterms).size !== minterms.length) addError('duplicateMinterm', 'answer.minterms');
    if (new Set(dontCares).size !== dontCares.length) addError('duplicateDontCare', 'answer.dontCares');
    if (minterms.some(value => !Number.isInteger(value) || value < 0 || value > maxIndex)) {
        addError('mintermOutOfRange', 'answer.minterms');
    }
    if (dontCares.some(value => !Number.isInteger(value) || value < 0 || value > maxIndex)) {
        addError('dontCareOutOfRange', 'answer.dontCares');
    }
    if (minterms.some(value => dontCares.includes(value))) addError('overlappingDontCare', 'answer.dontCares');
}

function validateCircuitTestbench(activity, addError) {
    const testbench = activity.answer.testbench;
    const variablesMatch =
        Array.isArray(activity.variables) &&
        Array.isArray(testbench?.variables) &&
        testbench.variables.length === activity.variables.length &&
        testbench.variables.every((variable, index) => variable === activity.variables[index]);
    if (!variablesMatch || !isValidCircuitTestbench(testbench)) {
        addError('invalidTestbench', 'answer.testbench');
    }
}

function validate(activity) {
    const errors = [];
    const addError = (code, path) => errors.push({ code, path, message: ERROR_MESSAGES[code] });

    if (!isPlainObject(activity)) {
        addError('invalidObject', '$');
        return { valid: false, errors };
    }
    if (typeof activity.id !== 'string' || activity.id.trim() === '') addError('invalidId', 'id');
    if (activity.type !== ACTIVITY_TYPE) addError('invalidType', 'type');
    if (activity.schemaVersion == null) {
        addError('missingSchemaVersion', 'schemaVersion');
    } else if (activity.schemaVersion !== SCHEMA_VERSION) {
        addError('unsupportedSchemaVersion', 'schemaVersion');
    }
    if (!SUPPORTED_MODES.includes(activity.mode)) addError('invalidMode', 'mode');
    if (typeof activity.prompt !== 'string') {
        addError('invalidPrompt', 'prompt');
    } else if (AUTHORING_MODES.includes(activity.mode) && activity.prompt.trim() === '') {
        addError('emptyPrompt', 'prompt');
    }

    const variablesAreValid =
        Array.isArray(activity.variables) &&
        activity.variables.length <= VARIABLE_ORDER.length &&
        activity.variables.every(variable => typeof variable === 'string' && /^[A-D]$/.test(variable)) &&
        new Set(activity.variables).size === activity.variables.length;
    const hasEnoughVariables = !AUTHORING_MODES.includes(activity.mode) || activity.variables?.length >= 2;
    if (!variablesAreValid || !hasEnoughVariables) addError('invalidVariables', 'variables');

    if (!isPlainObject(activity.authoring)) {
        addError('invalidAuthoring', 'authoring');
    } else if (EXPRESSION_ANSWER_MODES.includes(activity.mode)) {
        if (!ANSWER_SOURCES.includes(activity.authoring.answerSource)) {
            addError('invalidAnswerSource', 'authoring.answerSource');
        }
        if (typeof activity.authoring.solution !== 'string') addError('invalidSolution', 'authoring.solution');
    }

    if (!isPlainObject(activity.answer)) {
        addError('invalidAnswer', 'answer');
    } else {
        if (EXPRESSION_ANSWER_MODES.includes(activity.mode) && isPlainObject(activity.authoring)) {
            validateAnswer(activity, addError);
        }
        if (activity.mode === 'circuit') {
            validateCircuitTestbench(activity, addError);
        }
        if (Object.hasOwn(activity.answer, 'outputs')) {
            if (!Array.isArray(activity.answer.outputs)) {
                addError('invalidOutputs', 'answer.outputs');
            } else if (variablesAreValid && activity.answer.outputs.length !== 2 ** activity.variables.length) {
                addError('invalidOutputLength', 'answer.outputs');
            }
        }
    }
    if (!isPlainObject(activity.grading)) {
        addError('invalidGrading', 'grading');
    } else if (
        typeof activity.grading.maxScore !== 'number' ||
        !Number.isFinite(activity.grading.maxScore) ||
        activity.grading.maxScore <= 0
    ) {
        addError('invalidMaxScore', 'grading.maxScore');
    }
    if (!isPlainObject(activity.learner)) addError('invalidLearner', 'learner');
    if (!isPlainObject(activity.accessibility)) {
        addError('invalidAccessibility', 'accessibility');
    } else if (typeof activity.accessibility.label !== 'string') {
        addError('invalidAccessibilityLabel', 'accessibility.label');
    }

    return { valid: errors.length === 0, errors };
}

function normalize(activity) {
    const normalized = cloneJson(activity);
    normalized.id = normalized.id.trim();
    normalized.prompt = normalized.prompt.trim();
    normalized.authoring.solution = normalized.authoring.solution.trim();
    normalized.answer.expression = normalized.answer.expression.trim();
    normalized.answer.minterms.sort((left, right) => left - right);
    normalized.answer.dontCares.sort((left, right) => left - right);
    return normalized;
}

const lifecycle = Object.freeze({
    ACTIVITY_TYPE,
    ANSWER_SOURCES,
    AUTHORING_MODES,
    ERROR_MESSAGES,
    EXPRESSION_ANSWER_MODES,
    SCHEMA_VERSION,
    SUPPORTED_MODES,
    VARIABLE_ORDER,
    createDefaultActivity,
    isPlainObject,
    migrateSchemaV0ToV1,
    normalize,
    validate,
});

if (typeof module !== 'undefined' && module.exports) module.exports = lifecycle;
if (typeof globalThis !== 'undefined') globalThis.$electronicsLogicSchemaLifecycle = lifecycle;
