/**
 * Unit tests for the Electronics Logic authoring editor.
 */

/* eslint-disable no-undef */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const currentDirectory = join(process.cwd(), 'public/files/perm/idevices/base/electronics-logic/edition');
const schemaLifecycle = require(join(currentDirectory, '../core/schema-lifecycle.js'));
const schemaV0Migrated = require(join(currentDirectory, '../fixtures/schema-v0-migrated.json'));

let moduleSequence = 0;

async function loadEditionIdevice() {
    const sourcePath = join(currentDirectory, 'electronics-logic.js');
    moduleSequence += 1;
    await import(`${pathToFileURL(sourcePath).href}?test=${moduleSequence}`);
    return global.$exeDevice;
}

describe('Electronics Logic edition authoring', () => {
    let container;
    let idevice;

    beforeEach(async () => {
        global.$exeDevice = undefined;
        global.$electronicsLogicSchemaLifecycle = schemaLifecycle;
        global._ = vi.fn(value => value);
        global.c_ = vi.fn(value => value);
        container = document.createElement('div');
        container.setAttribute('idevice-id', 'electronics-logic-test');
        document.body.appendChild(container);
        idevice = await loadEditionIdevice();
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it('renders the Boolean, truth-table, and Karnaugh authoring controls with translated labels', () => {
        idevice.init(container, {});

        const editor = container.querySelector('[data-testid="electronics-logic-editor"]');
        expect(editor).not.toBeNull();
        expect(editor.textContent).toContain('Electronics Logic');
        expect(editor.querySelector('[data-field="mode"]')).not.toBeNull();
        expect(editor.querySelector('[data-field="variable-count"]')).not.toBeNull();
        expect(editor.querySelector('[data-field="answer-source"]')).not.toBeNull();
        expect(editor.querySelector('[data-field="prompt"]')).not.toBeNull();
        expect(editor.querySelector('[data-field="expression"]')).not.toBeNull();
        expect(editor.querySelector('[data-field="max-score"]')).not.toBeNull();
        expect(editor.querySelector('[data-field="solution"]')).not.toBeNull();
        expect(
            [...editor.querySelector('[data-field="mode"]').options].map(option => [option.value, option.textContent]),
        ).toContainEqual(['kmap', 'Karnaugh']);
        expect(global._).toHaveBeenCalled();
        expect(global.c_).toHaveBeenCalled();
    });

    it('renders only the locked circuit output authoring field after selecting circuit mode', () => {
        idevice.init(container, {});
        const mode = container.querySelector('[data-field="mode"]');

        expect([...mode.options].map(option => option.value)).toContain('circuit');
        mode.value = 'circuit';
        mode.dispatchEvent(new Event('change'));

        expect(container.querySelector('[data-field="circuit-outputs"]')).not.toBeNull();
        expect(container.querySelector('[data-field="answer-source"]')).toBeNull();
        expect(container.querySelector('[data-field="expression"]')).toBeNull();
        expect(container.querySelector('[data-field="minterms"]')).toBeNull();
        expect(container.querySelector('[data-field="dont-cares"]')).toBeNull();
    });

    it('creates and round-trips the locked half-adder testbench without losing it across mode changes', () => {
        idevice.init(container, {});
        const mode = container.querySelector('[data-field="mode"]');
        mode.value = 'circuit';
        mode.dispatchEvent(new Event('change'));
        container.querySelector('[data-field="prompt"]').value = '  Dựng mạch bán tổng cho A và B.  ';
        container.querySelector('[data-field="circuit-outputs"]').value = ' Sum = A XOR B\nCarry = A AND B ';
        container.querySelector('[data-field="max-score"]').value = '8';

        const saved = idevice.save();
        expect(saved).toMatchObject({
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
            grading: { maxScore: 8 },
        });

        idevice.init(container, saved);
        expect(container.querySelector('[data-field="circuit-outputs"]').value).toBe(
            'Sum = A XOR B\nCarry = A AND B',
        );
        const circuitMode = container.querySelector('[data-field="mode"]');
        circuitMode.value = 'boolean';
        circuitMode.dispatchEvent(new Event('change'));
        expect(idevice.data.answer.testbench).toEqual(saved.answer.testbench);
        const booleanMode = container.querySelector('[data-field="mode"]');
        booleanMode.value = 'circuit';
        booleanMode.dispatchEvent(new Event('change'));
        expect(idevice.data.answer.testbench).toEqual(saved.answer.testbench);

        expect(idevice.save().answer.testbench).toEqual(saved.answer.testbench);
    });

    it('shows the locked Vietnamese validation message for an empty circuit testbench', () => {
        idevice.init(container, {});
        const mode = container.querySelector('[data-field="mode"]');
        mode.value = 'circuit';
        mode.dispatchEvent(new Event('change'));
        container.querySelector('[data-field="prompt"]').value = 'Dựng mạch bán tổng.';

        expect(idevice.save()).toBe(false);
        expect(idevice.validationErrors).toContainEqual({ code: 'invalidTestbench', path: 'answer.testbench' });
        expect(container.querySelector('[data-testid="electronics-logic-authoring-errors"]').textContent).toContain(
            'Testbench mạch điện không hợp lệ.',
        );
    });

    it('creates the complete canonical schemaVersion 1 contract', () => {
        idevice.init(container, {});

        expect(idevice.createDefaultData('electronics-logic-test')).toEqual({
            id: 'electronics-logic-test',
            type: 'electronics.logic',
            schemaVersion: 1,
            mode: 'boolean',
            prompt: '',
            variables: ['A', 'B'],
            authoring: {
                answerSource: 'expression',
                placeholderText: 'Electronics Logic activity placeholder',
                solution: '',
            },
            answer: { expression: '', minterms: [], dontCares: [] },
            grading: { maxScore: 10 },
            learner: {},
            accessibility: { label: '' },
        });
    });

    it('loads the shared schema lifecycle before the edition script', () => {
        const config = readFileSync(join(currentDirectory, '../config.xml'), 'utf-8');
        const lifecyclePosition = config.indexOf('<filename>electronics-logic-schema.bundle.js</filename>');
        const editionPosition = config.indexOf('<filename>electronics-logic.js</filename>');

        expect(lifecyclePosition).toBeGreaterThanOrEqual(0);
        expect(lifecyclePosition).toBeLessThan(editionPosition);
    });

    it('collects and normalizes expression authoring before save', () => {
        idevice.init(container, {});

        container.querySelector('[data-field="mode"]').value = 'truthTable';
        container.querySelector('[data-field="variable-count"]').value = '4';
        container.querySelector('[data-field="prompt"]').value = '  Hoàn thành bảng chân trị.  ';
        container.querySelector('[data-field="expression"]').value = '  A XOR B  ';
        container.querySelector('[data-field="max-score"]').value = '8';
        container.querySelector('[data-field="solution"]').value = '  So sánh từng hàng.  ';

        expect(idevice.save()).toMatchObject({
            mode: 'truthTable',
            prompt: 'Hoàn thành bảng chân trị.',
            variables: ['A', 'B', 'C', 'D'],
            authoring: { answerSource: 'expression', solution: 'So sánh từng hàng.' },
            answer: { expression: 'A XOR B', minterms: [], dontCares: [] },
            grading: { maxScore: 8 },
        });
    });

    it("collects minterm and don't-care authoring as canonical integer arrays", () => {
        idevice.init(container, {});
        const answerSource = container.querySelector('[data-field="answer-source"]');
        answerSource.value = 'minterms';
        answerSource.dispatchEvent(new Event('change'));

        container.querySelector('[data-field="prompt"]').value = 'Nhập các minterm.';
        container.querySelector('[data-field="minterms"]').value = '3, 0, 1';
        container.querySelector('[data-field="dont-cares"]').value = '2';

        expect(idevice.save()).toMatchObject({
            variables: ['A', 'B'],
            authoring: { answerSource: 'minterms' },
            answer: { expression: '', minterms: [0, 1, 3], dontCares: [2] },
        });
    });

    it('creates, saves, and normalizes Karnaugh minterm authoring', () => {
        idevice.init(container, {});
        const answerSource = container.querySelector('[data-field="answer-source"]');
        answerSource.value = 'minterms';
        answerSource.dispatchEvent(new Event('change'));
        const variableCount = container.querySelector('[data-field="variable-count"]');
        variableCount.value = '4';
        variableCount.dispatchEvent(new Event('change'));
        const mode = container.querySelector('[data-field="mode"]');
        mode.value = 'kmap';
        mode.dispatchEvent(new Event('change'));
        container.querySelector('[data-field="prompt"]').value = '  Nhóm các ô Karnaugh.  ';
        container.querySelector('[data-field="minterms"]').value = '10, 0, 2, 8';
        container.querySelector('[data-field="dont-cares"]').value = '9, 1';

        expect(idevice.save()).toMatchObject({
            mode: 'kmap',
            prompt: 'Nhóm các ô Karnaugh.',
            variables: ['A', 'B', 'C', 'D'],
            authoring: { answerSource: 'minterms' },
            answer: { expression: '', minterms: [0, 2, 8, 10], dontCares: [1, 9] },
        });
    });

    it('switches between Karnaugh and truth table without losing minterm authoring', () => {
        idevice.init(container, {});
        const answerSource = container.querySelector('[data-field="answer-source"]');
        answerSource.value = 'minterms';
        answerSource.dispatchEvent(new Event('change'));
        container.querySelector('[data-field="prompt"]').value = 'Giữ nguyên dữ liệu.';
        container.querySelector('[data-field="minterms"]').value = '1, 2';
        container.querySelector('[data-field="dont-cares"]').value = '3';

        const selectMode = value => {
            const mode = container.querySelector('[data-field="mode"]');
            mode.value = value;
            mode.dispatchEvent(new Event('change'));
        };
        selectMode('kmap');
        expect(idevice.data).toMatchObject({
            mode: 'kmap',
            prompt: 'Giữ nguyên dữ liệu.',
            answer: { minterms: [1, 2], dontCares: [3] },
        });
        selectMode('truthTable');
        selectMode('kmap');

        expect(idevice.save()).toMatchObject({
            mode: 'kmap',
            prompt: 'Giữ nguyên dữ liệu.',
            answer: { minterms: [1, 2], dontCares: [3] },
        });
    });

    it('round-trips every Karnaugh field through save and reopen', () => {
        const activity = {
            ...idevice.createDefaultData('kmap-round-trip'),
            mode: 'kmap',
            prompt: 'Nhóm bản đồ Karnaugh.',
            variables: ['A', 'B', 'C'],
            authoring: {
                answerSource: 'minterms',
                placeholderText: 'Karnaugh placeholder',
                solution: 'Dùng thứ tự Gray.',
                extension: { retained: true },
            },
            answer: { expression: '', minterms: [1, 3, 7], dontCares: [5] },
            grading: { maxScore: 8 },
            learner: { cells: [['0']] },
            accessibility: { label: 'Bản đồ ba biến' },
            extensionData: { retained: true },
        };

        idevice.init(container, activity);
        const saved = idevice.save();
        idevice.init(container, saved);

        expect(idevice.save()).toEqual(saved);
    });

    it('reports Vietnamese minterm validation errors for Karnaugh authoring', () => {
        idevice.init(container, {});
        const answerSource = container.querySelector('[data-field="answer-source"]');
        answerSource.value = 'minterms';
        answerSource.dispatchEvent(new Event('change'));
        container.querySelector('[data-field="mode"]').value = 'kmap';
        container.querySelector('[data-field="prompt"]').value = 'Nhóm các minterm.';
        container.querySelector('[data-field="minterms"]').value = '1, 1, 4';
        container.querySelector('[data-field="dont-cares"]').value = '1';

        expect(idevice.save()).toBe(false);
        expect(idevice.validationErrors.map(error => error.code)).toEqual(
            expect.arrayContaining(['duplicateMinterm', 'mintermOutOfRange', 'overlappingDontCare']),
        );
        const alert = container.querySelector('[data-testid="electronics-logic-authoring-errors"]');
        expect(alert.textContent).toContain('Danh sách minterm không được lặp giá trị.');
        expect(alert.textContent).toContain('Minterm phải nằm trong miền của số biến đã chọn.');
        expect(alert.textContent).toContain("Minterm và don't-care không được trùng nhau.");
    });

    it('refuses to save invalid authoring and reports every field error in Vietnamese', () => {
        idevice.init(container, {});
        const answerSource = container.querySelector('[data-field="answer-source"]');
        answerSource.value = 'minterms';
        answerSource.dispatchEvent(new Event('change'));

        container.querySelector('[data-field="prompt"]').value = '   ';
        container.querySelector('[data-field="minterms"]').value = '1, 1, 4';
        container.querySelector('[data-field="dont-cares"]').value = '1';
        container.querySelector('[data-field="max-score"]').value = '0';

        expect(idevice.save()).toBe(false);
        expect(idevice.validationErrors.map(error => error.code)).toEqual(
            expect.arrayContaining([
                'emptyPrompt',
                'duplicateMinterm',
                'mintermOutOfRange',
                'overlappingDontCare',
                'invalidMaxScore',
            ]),
        );
        const alert = container.querySelector('[data-testid="electronics-logic-authoring-errors"]');
        expect(alert).not.toBeNull();
        expect(alert.getAttribute('role')).toBe('alert');
        expect(alert.textContent).toContain('Đề bài không được để trống.');
    });

    it('requires a non-empty expression when expression is the selected answer source', () => {
        idevice.init(container, {});
        container.querySelector('[data-field="prompt"]').value = 'Rút gọn biểu thức.';

        expect(idevice.save()).toBe(false);
        expect(idevice.validationErrors).toContainEqual({ code: 'emptyExpression', path: 'answer.expression' });
    });

    it('does not reinterpret an empty minterm token as minterm zero', () => {
        expect(idevice.parseIndexList('1,,2')).toEqual([1, Number.NaN, 2]);
    });

    it('migrates the schema 0 fixture to schema 1 without losing domain data', () => {
        const fixture = JSON.parse(readFileSync(join(currentDirectory, '../fixtures/schema-v0.json'), 'utf-8'));
        const migrated = idevice.migrateData(fixture, 'fallback-id');

        expect(migrated).toEqual(schemaV0Migrated);
        expect(idevice.validateData(migrated)).toEqual({ valid: true, errors: [] });
    });

    it('keeps canonical JSON stable through ten save and reopen cycles', () => {
        const fixture = JSON.parse(readFileSync(join(currentDirectory, '../fixtures/schema-v0.json'), 'utf-8'));
        let current = fixture;
        let canonicalJson = '';

        for (let cycle = 0; cycle < 10; cycle += 1) {
            idevice.init(container, current);
            current = idevice.save();
            const currentJson = JSON.stringify(current);
            if (cycle === 0) canonicalJson = currentJson;
            expect(currentJson).toBe(canonicalJson);
        }

        expect(current.schemaVersion).toBe(1);
        expect(current.authoring.instructions).toBe(fixture.authoring.instructions);
        expect(current.answer.outputs).toEqual(fixture.answer.outputs);
        expect(current.answer.minterms).toEqual([1, 2]);
        expect(current.learner.outputs).toEqual(fixture.learner.outputs);
    });

    it('migrates the P03 placeholder payload into authoring data', () => {
        idevice.init(container, {
            ideviceId: 'legacy-placeholder',
            placeholderText: 'Saved placeholder content',
        });

        expect(idevice.data.authoring.placeholderText).toBe('Saved placeholder content');
        expect(idevice.data.variables).toEqual(['A', 'B']);
        container.querySelector('[data-field="prompt"]').value = 'Bài tập đã chuyển đổi.';
        container.querySelector('[data-field="expression"]').value = 'A';
        expect(idevice.save().schemaVersion).toBe(1);
    });

    it('shows Vietnamese validation feedback and refuses to overwrite invalid data', () => {
        const invalidData = {
            id: 'invalid-data',
            type: 'electronics.logic',
            schemaVersion: 2,
            mode: 'unknown',
            prompt: '',
            variables: ['AA'],
            authoring: {},
            answer: {},
            grading: { maxScore: 0 },
            learner: {},
            accessibility: { label: '' },
        };

        expect(() => idevice.init(container, invalidData)).not.toThrow();

        const alert = container.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        expect(alert.textContent).toContain('Dữ liệu Electronics Logic không hợp lệ');
        expect(idevice.validationErrors.map(error => error.code)).toEqual(
            expect.arrayContaining(['unsupportedSchemaVersion', 'invalidMode', 'invalidVariables', 'invalidMaxScore']),
        );
        expect(idevice.save()).toBe(false);
    });

    it('rejects a truth-table output count mismatch without crashing', () => {
        const invalidData = {
            ...schemaV0Migrated,
            answer: { ...schemaV0Migrated.answer, outputs: [0, 1] },
        };

        expect(() => idevice.init(container, invalidData)).not.toThrow();
        expect(idevice.validationErrors).toContainEqual(
            expect.objectContaining({ code: 'invalidOutputLength', path: 'answer.outputs' }),
        );
        expect(container.querySelector('[role="alert"]')?.textContent).toContain(
            'Số đáp án đầu ra phải bằng 2 lũy thừa số biến.',
        );
        expect(idevice.save()).toBe(false);
    });

    it('rejects a non-object payload without crashing', () => {
        expect(() => idevice.init(container, 'invalid')).not.toThrow();

        expect(idevice.validationErrors).toEqual([{ code: 'invalidObject', path: '$' }]);
        expect(idevice.save()).toBe(false);
    });

    it('reports structural validation errors with stable codes', () => {
        expect(idevice.validateData(null)).toEqual({
            valid: false,
            errors: [{ code: 'invalidObject', path: '$' }],
        });

        const invalidStructures = idevice.validateData({
            id: '',
            type: 'unsupported.activity',
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
        expect(invalidStructures.errors.map(error => error.code)).toEqual(
            expect.arrayContaining([
                'invalidId',
                'invalidType',
                'invalidPrompt',
                'invalidAuthoring',
                'invalidAnswer',
                'invalidGrading',
                'invalidLearner',
                'invalidAccessibility',
            ]),
        );

        const invalidLabel = idevice.validateData({
            ...idevice.createDefaultData('invalid-label'),
            accessibility: { label: 42 },
        });
        expect(invalidLabel.errors).toContainEqual({
            code: 'invalidAccessibilityLabel',
            path: 'accessibility.label',
        });
    });
});
