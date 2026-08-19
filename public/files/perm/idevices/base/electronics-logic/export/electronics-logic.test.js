/**
 * Unit tests for the Electronics Logic learner runtime.
 */

/* eslint-disable no-undef */
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

const currentDirectory = join(process.cwd(), 'public/files/perm/idevices/base/electronics-logic/export');
const core = require(join(currentDirectory, '../core/boolean-core.js'));
const grader = require(join(currentDirectory, '../core/boolean-grader.js'));
const kmapGroupValidator = require(join(currentDirectory, '../core/kmap-group-validator.js'));
const circuitNetlist = require(join(currentDirectory, '../core/circuit-netlist.js'));
let moduleSequence = 0;

async function loadExportIdevice() {
    moduleSequence += 1;
    const sourcePath = join(currentDirectory, 'electronics-logic.js');
    await import(`${pathToFileURL(sourcePath).href}?test=${moduleSequence}`);
    return global.$electronicslogic;
}

function createData(overrides = {}) {
    return {
        id: 'electronics-runtime-test',
        type: 'electronics.logic',
        schemaVersion: 1,
        mode: 'boolean',
        prompt: 'Viết biểu thức tương đương.',
        variables: ['A', 'B'],
        authoring: { answerSource: 'expression', solution: 'Không hiển thị trước khi chấm.' },
        answer: { expression: 'A XOR B', minterms: [], dontCares: [] },
        grading: { maxScore: 10 },
        learner: {},
        accessibility: { label: 'Bài tập Boolean' },
        ...overrides,
    };
}

function createCircuitData(overrides = {}) {
    return createData({
        mode: 'circuit',
        variables: [],
        authoring: {},
        answer: {},
        ...overrides,
    });
}

function pressKey(control, key) {
    control.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function renderCircuitActivity(renderer) {
    const data = createCircuitData();
    document.body.innerHTML = renderer.renderView(data, false, '{content}');
    renderer.renderBehaviour(data);
    return document.querySelector('.electronics-logic-runtime');
}

function placeCircuitNode(activity, kind, x, y) {
    const existingIds = new Set(
        [...activity.querySelectorAll('[data-role="circuit-node"]')].map(node => node.dataset.nodeId),
    );
    activity.querySelector(`[data-node-kind="${kind}"]`).click();
    activity.querySelector(`[data-role="circuit-cell"][data-x="${x}"][data-y="${y}"]`).click();
    return [...activity.querySelectorAll('[data-role="circuit-node"]')].find(
        node => !existingIds.has(node.dataset.nodeId),
    );
}

function getCircuitPin(activity, nodeId, pinName) {
    return activity.querySelector(`[data-role="circuit-pin"][data-node-id="${nodeId}"][data-pin-name="${pinName}"]`);
}

function connectCircuitPins(activity, fromNodeId, fromPin, toNodeId, toPin) {
    getCircuitPin(activity, fromNodeId, fromPin).click();
    getCircuitPin(activity, toNodeId, toPin).click();
    return [...activity.querySelectorAll('[data-role="circuit-wire"]')].at(-1);
}

describe('Electronics Logic learner runtime', () => {
    let renderer;

    beforeEach(async () => {
        global.$electronicslogic = undefined;
        global.$electronicsLogicCore = core;
        global.$electronicsLogicGrader = grader;
        global.$electronicsLogicKmapValidator = kmapGroupValidator;
        global.$electronicsLogicCircuitNetlist = circuitNetlist;
        global._ = vi.fn(value => value);
        document.body.replaceChildren();
        renderer = await loadExportIdevice();
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it('renders a Boolean expression input without leaking the saved answer or solution', () => {
        const html = renderer.renderView(createData(), false, '<div class="template">{content}</div>');

        expect(html).toContain('class="template"');
        expect(html).toContain('data-schema-version="1"');
        expect(html).toContain('data-mode="boolean"');
        expect(html).toContain('data-role="learner-expression"');
        expect(html).toContain('Viết biểu thức tương đương.');
        expect(html).not.toContain('A XOR B');
        expect(html).not.toContain('Không hiển thị trước khi chấm.');
        expect(global._).toHaveBeenCalled();
    });

    it('renders exactly 2^n binary-ascending truth-table rows with 0/1/X controls', () => {
        const html = renderer.renderView(
            createData({
                mode: 'truthTable',
                prompt: 'Hoàn thành bảng chân trị.',
                variables: ['A', 'B', 'C'],
            }),
            false,
            '{content}',
        );
        document.body.innerHTML = html;

        const rows = [...document.querySelectorAll('tbody tr')];
        expect(rows).toHaveLength(8);
        expect([...rows[0].querySelectorAll('[data-role="truth-input"]')].map(cell => cell.textContent)).toEqual([
            '0',
            '0',
            '0',
        ]);
        expect([...rows[7].querySelectorAll('[data-role="truth-input"]')].map(cell => cell.textContent)).toEqual([
            '1',
            '1',
            '1',
        ]);
        const outputs = [...document.querySelectorAll('[data-role="truth-value"]')];
        expect(outputs).toHaveLength(8);
        expect([...outputs[0].querySelectorAll('option')].map(option => option.value)).toEqual(['', '0', '1', 'X']);
    });

    it.each([
        [['A', 'B'], ['0', '1'], ['0', '1'], 4],
        [['A', 'B', 'C'], ['0', '1'], ['00', '01', '11', '10'], 8],
        [['A', 'B', 'C', 'D'], ['00', '01', '11', '10'], ['00', '01', '11', '10'], 16],
    ])('renders a Gray-code Karnaugh grid for %s', (variables, rowLabels, columnLabels, cellCount) => {
        document.body.innerHTML = renderer.renderView(
            createData({
                mode: 'kmap',
                prompt: 'Hoàn thành bản đồ Karnaugh.',
                variables,
                authoring: { answerSource: 'minterms', solution: '' },
                answer: { expression: '', minterms: [1], dontCares: [] },
            }),
            false,
            '{content}',
        );

        expect([...document.querySelectorAll('[data-role="kmap-row-label"]')].map(label => label.textContent)).toEqual(
            rowLabels,
        );
        expect(
            [...document.querySelectorAll('[data-role="kmap-column-label"]')].map(label => label.textContent),
        ).toEqual(columnLabels);
        expect(document.querySelector('[data-role="kmap-row-variables"]').textContent).toBe(
            variables.length === 4 ? 'AB' : 'A',
        );
        expect(document.querySelector('[data-role="kmap-column-variables"]').textContent).toBe(
            variables.length === 2 ? 'B' : variables.slice(1 + Number(variables.length === 4)).join(''),
        );
        expect(document.querySelectorAll('[data-role="kmap-value"]')).toHaveLength(cellCount);
        expect(document.body.textContent).not.toContain('Không hiển thị trước khi chấm.');
    });

    it('fills cells, creates and deletes a selected Karnaugh group, and collects the contract response', () => {
        document.body.innerHTML = renderer.renderView(
            createData({
                mode: 'kmap',
                authoring: { answerSource: 'minterms', solution: '' },
                answer: { expression: '', minterms: [1, 2], dontCares: [] },
            }),
            false,
            '{content}',
        );
        renderer.init(document);
        const activity = document.querySelector('.electronics-logic-runtime');
        const values = [...activity.querySelectorAll('[data-role="kmap-value"]')];
        ['1', '1', 'X', '0'].forEach((value, index) => {
            values[index].value = value;
            values[index].dispatchEvent(new Event('change'));
        });
        activity.querySelector('[data-action="toggle-kmap-cell"][data-minterm-index="0"]').click();
        activity.querySelector('[data-action="toggle-kmap-cell"][data-minterm-index="1"]').click();
        activity.querySelector('[data-action="create-kmap-group"]').click();

        expect(renderer.collectResponse(activity)).toEqual({
            cells: [
                ['1', '1'],
                ['X', '0'],
            ],
            groups: [{ id: 'g1', cells: [0, 1] }],
        });
        expect(activity.querySelector('[data-role="kmap-group-list"]').textContent).toContain('0, 1');
        expect(activity.querySelectorAll('[data-kmap-grouped="true"]')).toHaveLength(2);

        activity.querySelector('[data-action="delete-kmap-group"]').click();

        expect(renderer.collectResponse(activity).groups).toEqual([]);
        expect(activity.querySelector('[data-role="kmap-group-list"]').textContent).toContain('Chưa có nhóm nào.');
        expect(activity.querySelectorAll('[data-kmap-grouped="true"]')).toHaveLength(0);
    });

    it('rejects an invalid Karnaugh group size without clearing the current selection', () => {
        document.body.innerHTML = renderer.renderView(
            createData({
                mode: 'kmap',
                variables: ['A', 'B', 'C'],
                authoring: { answerSource: 'minterms', solution: '' },
                answer: { expression: '', minterms: [1, 2], dontCares: [] },
            }),
            false,
            '{content}',
        );
        renderer.init(document);
        const activity = document.querySelector('.electronics-logic-runtime');
        [0, 1, 3].forEach(index => {
            activity.querySelector(`[data-action="toggle-kmap-cell"][data-minterm-index="${index}"]`).click();
        });

        activity.querySelector('[data-action="create-kmap-group"]').click();

        expect(activity.querySelectorAll('[data-role="kmap-group"]')).toHaveLength(0);
        expect(activity.querySelectorAll('[data-kmap-selected="true"]')).toHaveLength(3);
        expect(activity.querySelector('[data-role="kmap-group-feedback"]').textContent).toContain(
            'Nhóm Karnaugh phải có 1, 2, 4, 8 hoặc 16 ô.',
        );
    });

    it('rejects a power-of-two Karnaugh group that is not a Gray-space rectangle', () => {
        document.body.innerHTML = renderer.renderView(
            createData({
                mode: 'kmap',
                variables: ['A', 'B', 'C'],
                authoring: { answerSource: 'minterms', solution: '' },
                answer: { expression: '', minterms: [1, 2], dontCares: [] },
            }),
            false,
            '{content}',
        );
        renderer.init(document);
        const activity = document.querySelector('.electronics-logic-runtime');
        [0, 1, 2, 4].forEach(index => {
            activity.querySelector(`[data-action="toggle-kmap-cell"][data-minterm-index="${index}"]`).click();
        });

        activity.querySelector('[data-action="create-kmap-group"]').click();

        expect(activity.querySelectorAll('[data-role="kmap-group"]')).toHaveLength(0);
        expect(activity.querySelector('[data-role="kmap-group-feedback"]').textContent).toContain(
            'Các ô đã chọn không tạo thành hình chữ nhật Karnaugh hợp lệ.',
        );
    });

    it('rejects a rectangular Karnaugh group containing a current zero value', () => {
        document.body.innerHTML = renderer.renderView(
            createData({
                mode: 'kmap',
                authoring: { answerSource: 'minterms', solution: '' },
                answer: { expression: '', minterms: [1, 2], dontCares: [] },
            }),
            false,
            '{content}',
        );
        renderer.init(document);
        const activity = document.querySelector('.electronics-logic-runtime');
        activity.querySelector('[data-role="kmap-cell"][data-minterm-index="0"] [data-role="kmap-value"]').value = '0';
        [0, 1].forEach(index => {
            activity.querySelector(`[data-action="toggle-kmap-cell"][data-minterm-index="${index}"]`).click();
        });

        activity.querySelector('[data-action="create-kmap-group"]').click();

        expect(activity.querySelectorAll('[data-role="kmap-group"]')).toHaveLength(0);
        expect(activity.querySelector('[data-role="kmap-group-feedback"]').textContent).toContain(
            'Nhóm Karnaugh không được chứa ô có giá trị 0.',
        );
    });

    it('accepts a wraparound group and a second valid group overlapping it without changing the response contract', () => {
        document.body.innerHTML = renderer.renderView(
            createData({
                mode: 'kmap',
                variables: ['A', 'B', 'C', 'D'],
                authoring: { answerSource: 'minterms', solution: '' },
                answer: { expression: '', minterms: [1, 2], dontCares: [] },
            }),
            false,
            '{content}',
        );
        renderer.init(document);
        const activity = document.querySelector('.electronics-logic-runtime');
        const selectCells = cells => {
            cells.forEach(index => {
                activity.querySelector(`[data-action="toggle-kmap-cell"][data-minterm-index="${index}"]`).click();
            });
            activity.querySelector('[data-action="create-kmap-group"]').click();
        };

        selectCells([0, 2, 8, 10]);
        selectCells([0, 2]);

        expect(renderer.collectResponse(activity)).toMatchObject({
            groups: [
                { id: 'g1', cells: [0, 2, 8, 10] },
                { id: 'g2', cells: [0, 2] },
            ],
        });
        expect(renderer.collectResponse(activity)).toHaveProperty('cells');
        expect(activity.querySelector('[data-role="kmap-group-feedback"]').textContent).toBe('');
    });

    it('tracks incomplete Karnaugh cells and reset clears values, selection, groups, and feedback', () => {
        document.body.innerHTML = renderer.renderView(
            createData({
                mode: 'kmap',
                authoring: { answerSource: 'minterms', solution: '' },
                answer: { expression: '', minterms: [1, 2], dontCares: [] },
            }),
            false,
            '{content}',
        );
        renderer.init(document);
        const activity = document.querySelector('.electronics-logic-runtime');
        const values = [...activity.querySelectorAll('[data-role="kmap-value"]')];
        expect(activity.querySelector('[data-role="empty-state"]').hidden).toBe(false);

        values.forEach(value => {
            value.value = '1';
            value.dispatchEvent(new Event('change'));
        });
        activity.querySelector('[data-action="toggle-kmap-cell"]').click();
        activity.querySelector('[data-action="create-kmap-group"]').click();
        expect(activity.querySelector('[data-role="empty-state"]').hidden).toBe(true);

        activity.querySelector('[data-action="reset"]').click();

        expect(values.every(value => value.value === '')).toBe(true);
        expect(activity.querySelectorAll('[data-kmap-selected="true"]')).toHaveLength(0);
        expect(renderer.collectResponse(activity).groups).toEqual([]);
        expect(activity.querySelector('[data-role="empty-state"]').hidden).toBe(false);
        expect(activity.querySelector('[data-role="grading-feedback"]').textContent).toBe('');
    });

    it('grades a complete Karnaugh response and marks cells and overlapping wraparound groups as passed', () => {
        const data = createData({
            mode: 'kmap',
            variables: ['A', 'B', 'C', 'D'],
            authoring: { answerSource: 'minterms', solution: '' },
            answer: { expression: '', minterms: [0, 2, 8, 10, 12, 14], dontCares: [4] },
        });
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');
        const expected = core.mintermsToVector({
            variables: data.variables,
            minterms: data.answer.minterms,
            dontCares: data.answer.dontCares,
        });
        expected.values.forEach((value, index) => {
            const control = activity.querySelector(
                `[data-role="kmap-cell"][data-minterm-index="${index}"] [data-role="kmap-value"]`,
            );
            control.value = String(value);
            control.dispatchEvent(new Event('change'));
        });
        const createGroup = cells => {
            cells.forEach(index => {
                activity.querySelector(`[data-action="toggle-kmap-cell"][data-minterm-index="${index}"]`).click();
            });
            activity.querySelector('[data-action="create-kmap-group"]').click();
        };
        createGroup([0, 2, 8, 10]);
        createGroup([8, 10, 12, 14]);

        activity.querySelector('[data-action="check"]').click();

        expect(
            [...activity.querySelectorAll('[data-role="kmap-value"]')].every(
                control => control.dataset.grade === 'passed',
            ),
        ).toBe(true);
        expect(
            [...activity.querySelectorAll('[data-role="kmap-group"]')].every(group => group.dataset.grade === 'passed'),
        ).toBe(true);
        const feedback = activity.querySelector('[data-role="grading-feedback"]');
        expect(feedback.textContent).toContain('10 / 10');
        expect(feedback.textContent).toContain('Đạt 8/8 yêu cầu nhóm.');
        expect(feedback.textContent).toContain('Một lời giải tối giản: !B*!D+A*!D.');
        expect(feedback.getAttribute('role')).toBe('status');
    });

    it('marks a wrong Karnaugh cell failed and reports incomplete group coverage', () => {
        const data = createData({
            mode: 'kmap',
            variables: ['A', 'B', 'C', 'D'],
            authoring: { answerSource: 'minterms', solution: '' },
            answer: { expression: '', minterms: [0, 2, 8, 10, 12, 14], dontCares: [4] },
        });
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');
        const expected = core.mintermsToVector({
            variables: data.variables,
            minterms: data.answer.minterms,
            dontCares: data.answer.dontCares,
        });
        expected.values.forEach((value, index) => {
            const control = activity.querySelector(
                `[data-role="kmap-cell"][data-minterm-index="${index}"] [data-role="kmap-value"]`,
            );
            control.value = index === 1 ? '1' : String(value);
            control.dispatchEvent(new Event('change'));
        });
        [0, 2, 8, 10].forEach(index => {
            activity.querySelector(`[data-action="toggle-kmap-cell"][data-minterm-index="${index}"]`).click();
        });
        activity.querySelector('[data-action="create-kmap-group"]').click();

        activity.querySelector('[data-action="check"]').click();

        expect(
            activity.querySelector('[data-role="kmap-cell"][data-minterm-index="1"] [data-role="kmap-value"]').dataset
                .grade,
        ).toBe('failed');
        expect(activity.querySelector('[data-role="kmap-group"]').dataset.grade).toBe('passed');
        const feedback = activity.querySelector('[data-role="grading-feedback"]');
        expect(feedback.textContent).toContain('5.6696 / 10');
        expect(feedback.textContent).toContain('Đạt 5/7 yêu cầu nhóm.');
        expect(feedback.textContent).toContain('Một lời giải tối giản: !B*!D+A*!D.');
        expect(feedback.getAttribute('role')).toBe('alert');
    });

    it('exposes shared Boolean, Karnaugh, and circuit modules through the offline browser bridge', async () => {
        global.$electronicsLogicCore = undefined;
        global.$electronicsLogicKmapValidator = undefined;
        global.$electronicsLogicCircuitNetlist = undefined;
        moduleSequence += 1;
        const bridgePath = join(currentDirectory, '../core/boolean-grader-browser.mjs');

        await import(`${pathToFileURL(bridgePath).href}?test=${moduleSequence}`);

        const browserCore = global.$electronicsLogicCore;
        expect(browserCore.mintermsToVector).toBeTypeOf('function');
        expect(browserCore.vectorToKmapModel).toBeTypeOf('function');
        expect(
            browserCore.vectorToKmapModel(
                browserCore.mintermsToVector({ variables: ['A', 'B'], minterms: [1], dontCares: [2] }),
            ),
        ).toEqual(
            core.vectorToKmapModel(core.mintermsToVector({ variables: ['A', 'B'], minterms: [1], dontCares: [2] })),
        );
        expect(global.$electronicsLogicKmapValidator.validateKmapGroup).toBeTypeOf('function');
        expect(global.$electronicsLogicCircuitNetlist.GATE_PINS).toEqual(circuitNetlist.GATE_PINS);
        expect(global.$electronicsLogicCircuitNetlist.parseNetlist).toBeTypeOf('function');
    });

    it('escapes prompt, variable, instance, and accessibility content', () => {
        const html = renderer.renderView(
            createData({
                id: '"><script>instance</script>',
                prompt: '<img src=x onerror=alert(1)>',
                accessibility: { label: '" onfocus="alert(1)' },
            }),
            false,
            '{content}',
        );

        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(html).toContain('&quot; onfocus=&quot;alert(1)');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<img');
    });

    it('renders a Vietnamese alert for malformed runtime data without throwing', () => {
        expect(() => renderer.renderView(null, false, '{content}')).not.toThrow();
        const html = renderer.renderView(createData({ variables: ['AA'], prompt: '' }), false, '{content}');

        expect(html).toContain('role="alert"');
        expect(html).toContain('Dữ liệu bài tập Electronics Logic không hợp lệ.');
        expect(html).not.toContain('data-role="learner-expression"');
        expect(html).not.toContain('<table');
    });

    it('resets one Boolean instance without changing another instance', () => {
        document.body.innerHTML =
            renderer.renderView(createData({ id: 'first' }), false, '{content}') +
            renderer.renderView(createData({ id: 'second' }), false, '{content}');
        renderer.renderBehaviour(document);
        const activities = [...document.querySelectorAll('.electronics-logic-runtime')];
        const firstInput = activities[0].querySelector('[data-role="learner-expression"]');
        const secondInput = activities[1].querySelector('[data-role="learner-expression"]');
        firstInput.value = 'A+B';
        secondInput.value = 'AB';
        firstInput.dispatchEvent(new Event('input'));
        secondInput.dispatchEvent(new Event('input'));

        activities[0].querySelector('[data-action="reset"]').click();

        expect(firstInput.value).toBe('');
        expect(secondInput.value).toBe('AB');
        expect(activities[0].querySelector('[data-role="empty-state"]').hidden).toBe(false);
        expect(activities[1].querySelector('[data-role="empty-state"]').hidden).toBe(true);
    });

    it('tracks incomplete truth-table state and reset clears all 0/1/X cells', () => {
        document.body.innerHTML = renderer.renderView(
            createData({ mode: 'truthTable', variables: ['A', 'B'] }),
            false,
            '{content}',
        );
        expect(renderer.init(document)).toBe(true);
        const activity = document.querySelector('.electronics-logic-runtime');
        const outputs = [...activity.querySelectorAll('[data-role="truth-value"]')];
        outputs.forEach((output, index) => {
            output.value = index === 3 ? 'X' : String(index % 2);
            output.dispatchEvent(new Event('change'));
        });
        expect(activity.querySelector('[data-role="empty-state"]').hidden).toBe(true);

        activity.querySelector('[data-action="reset"]').click();

        expect(outputs.every(output => output.value === '')).toBe(true);
        expect(activity.querySelector('[data-role="empty-state"]').hidden).toBe(false);
    });

    it('binds each runtime once when given an explicit DOM root', () => {
        document.body.innerHTML = renderer.renderView(createData(), false, '{content}');

        expect(renderer.renderBehaviour(document)).toBe(true);
        expect(renderer.renderBehaviour(document)).toBe(true);
    });

    it('binds through the eXe lifecycle signature that passes JSON data instead of a DOM root', () => {
        const data = createData({ mode: 'truthTable', variables: ['A', 'B'] });
        document.body.innerHTML = renderer.renderView(data, false, '{content}');

        expect(renderer.renderBehaviour(data, false, 'ode-instance')).toBe(true);
        expect(renderer.init(data, false)).toBe(true);
        const status = document.querySelector('[data-role="empty-state"]');
        expect(status.hidden).toBe(false);
        expect(status.textContent).toBe('Chưa điền đủ bảng chân trị.');
    });

    it('reports every malformed schema-v1 runtime boundary with stable error codes', () => {
        const cases = [
            [{ id: '' }, 'invalidId'],
            [{ type: 'unsupported' }, 'invalidType'],
            [{ schemaVersion: 2 }, 'invalidSchemaVersion'],
            [{ mode: 'unsupported' }, 'invalidMode'],
            [{ prompt: 42 }, 'invalidPrompt'],
            [{ variables: null }, 'invalidVariables'],
            [{ variables: ['A'] }, 'invalidVariables'],
            [{ variables: ['A', 'B', 'C', 'D', 'A'] }, 'invalidVariables'],
            [{ variables: ['A', 42] }, 'invalidVariables'],
            [{ variables: ['A', 'A'] }, 'invalidVariables'],
            [{ learner: null }, 'invalidLearner'],
            [{ accessibility: null }, 'invalidAccessibility'],
            [{ accessibility: { label: 42 } }, 'invalidAccessibility'],
        ];

        cases.forEach(([override, code]) => {
            expect(renderer.validateData(createData(override)).errors).toContain(code);
        });
    });

    it('uses offline message/template/accessibility fallbacks without a translation global', () => {
        global._ = undefined;
        const data = createData({ accessibility: { label: '' } });

        expect(renderer.getMessages()).toMatchObject({
            invalidData: 'Dữ liệu bài tập Electronics Logic không hợp lệ.',
            reset: 'Làm lại',
        });
        const html = renderer.renderView(data, false, null);
        expect(html).toContain('aria-label="Viết biểu thức tương đương."');
        expect(html).toContain('Làm lại');
        expect(renderer.escapeHtml(null)).toBe('');
    });

    it('handles an incomplete host shell while binding through the default document root', () => {
        document.body.innerHTML = renderer.renderView(createData(), false, '{content}');
        document.querySelector('[data-role="empty-state"]').remove();
        document.querySelector('[data-action="reset"]').remove();

        expect(() => renderer.renderBehaviour({})).not.toThrow();
        expect(renderer.renderBehaviour({})).toBe(true);
    });

    it('renders check and feedback controls without exposing expected answers before grading', () => {
        const html = renderer.renderView(createData(), false, '{content}');

        expect(html).toContain('data-action="check"');
        expect(html).toContain('data-role="grading-feedback"');
        expect(html).not.toContain('A XOR B');
        expect(html).not.toContain('data-grade=');
    });

    it('grades truth-table cells independently, shows score evidence, and reset removes old feedback', () => {
        const data = createData({
            mode: 'truthTable',
            variables: ['A', 'B'],
            authoring: { answerSource: 'minterms', solution: 'Không lộ trước lần chấm.' },
            answer: { expression: '', minterms: [1, 2], dontCares: [3] },
        });
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        vi.spyOn(renderer, 'createAttemptMetadata').mockReturnValue({
            attemptId: 'runtime-attempt',
            createdAt: '2026-08-12T04:00:00.000Z',
        });
        renderer.renderBehaviour(data);
        const outputs = [...document.querySelectorAll('[data-role="truth-value"]')];
        ['0', '1', '0', 'X'].forEach((value, index) => {
            outputs[index].value = value;
            outputs[index].dispatchEvent(new Event('change'));
        });

        document.querySelector('[data-action="check"]').click();

        expect(outputs.map(output => output.dataset.grade)).toEqual(['passed', 'passed', 'failed', 'passed']);
        expect(document.querySelector('[data-role="grading-feedback"]').textContent).toContain('7.5 / 10');
        expect(renderer.lastResults.get('electronics-runtime-test')).toMatchObject({
            engine: 'electronics-logic-core',
            score: 7.5,
        });

        document.querySelector('[data-action="reset"]').click();

        expect(outputs.every(output => output.value === '' && output.dataset.grade === undefined)).toBe(true);
        expect(document.querySelector('[data-role="grading-feedback"]').textContent).toBe('');
        expect(renderer.lastResults.has('electronics-runtime-test')).toBe(false);
        expect(document.querySelector('.electronics-logic-runtime__prompt').textContent).toContain('Viết biểu thức');
    });

    it('shows syntax feedback, then accepts an equivalent Boolean expression', () => {
        const data = createData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        vi.spyOn(renderer, 'createAttemptMetadata').mockReturnValue({
            attemptId: 'runtime-attempt',
            createdAt: '2026-08-12T04:00:00.000Z',
        });
        renderer.renderBehaviour(data);
        const input = document.querySelector('[data-role="learner-expression"]');
        input.value = 'A +';

        document.querySelector('[data-action="check"]').click();

        const feedback = document.querySelector('[data-role="grading-feedback"]');
        expect(feedback.textContent).toContain('Biểu thức chưa đúng cú pháp');
        expect(feedback.textContent).not.toContain('A XOR B');

        input.value = '!A*B+A*!B';
        document.querySelector('[data-action="check"]').click();

        expect(input.dataset.grade).toBe('passed');
        expect(feedback.textContent).toContain('10 / 10');
    });

    it('renders a Vietnamese runtime error when the offline grader bundle is unavailable', () => {
        const data = createData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        global.$electronicsLogicGrader = undefined;
        renderer.renderBehaviour(data);
        document.querySelector('[data-role="learner-expression"]').value = 'A';

        document.querySelector('[data-action="check"]').click();

        const feedback = document.querySelector('[data-role="grading-feedback"]');
        expect(feedback.getAttribute('role')).toBe('alert');
        expect(feedback.textContent).toContain('Không thể chấm bài lúc này.');
    });

    it('renders the six circuit palette tools from GATE_PINS in their canonical order', () => {
        document.body.innerHTML = renderer.renderView(createCircuitData(), false, '{content}');
        renderer.renderBehaviour(document);

        const paletteItems = [...document.querySelectorAll('[data-role="circuit-palette-item"]')];
        expect(paletteItems.map(item => item.dataset.nodeKind)).toEqual(['INPUT', 'OUTPUT', 'NOT', 'AND', 'OR', 'XOR']);
        expect(paletteItems.every(item => item.getAttribute('aria-pressed') === 'false')).toBe(true);
        expect(document.querySelector('[data-role="circuit-canvas"]')).not.toBeNull();
        expect(document.querySelectorAll('[data-role="circuit-cell"]')).toHaveLength(96);
        expect(document.querySelector('[data-role="empty-state"]').textContent).toBe('Chưa thêm nút mạch nào.');
        paletteItems[0].click();
        paletteItems[0].click();
        expect(paletteItems[0].getAttribute('aria-pressed')).toBe('false');
        document.querySelector('[data-role="circuit-canvas"]').click();
        expect(document.querySelector('[data-role="circuit-node"]')).toBeNull();
    });

    it('arms a palette tool, adds one snapped node, and collects the circuit netlist contract', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');
        const tool = activity.querySelector('[data-node-kind="AND"]');
        const cell = activity.querySelector('[data-role="circuit-cell"][data-x="80"][data-y="120"]');

        cell.click();
        expect(activity.querySelector('[data-role="circuit-node"]')).toBeNull();
        tool.click();
        expect(tool.getAttribute('aria-pressed')).toBe('true');
        cell.click();

        const nodes = [...activity.querySelectorAll('[data-role="circuit-node"]')];
        expect(nodes).toHaveLength(1);
        expect(nodes[0].dataset).toMatchObject({ nodeKind: 'AND', x: '80', y: '120' });
        expect(Number(nodes[0].dataset.x) % 40).toBe(0);
        expect(Number(nodes[0].dataset.y) % 40).toBe(0);
        expect(renderer.collectResponse(activity)).toEqual({
            netlist: {
                schemaVersion: 1,
                nodes: [{ id: nodes[0].dataset.nodeId, kind: 'AND', x: 80, y: 120 }],
                wires: [],
            },
        });
    });

    it('assigns sequential kind-specific ids when adding two nodes of the same kind', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');
        const tool = activity.querySelector('[data-node-kind="AND"]');
        const firstCell = activity.querySelector('[data-role="circuit-cell"][data-x="40"][data-y="40"]');
        const secondCell = activity.querySelector('[data-role="circuit-cell"][data-x="80"][data-y="40"]');

        tool.click();
        firstCell.click();
        tool.click();
        secondCell.click();

        expect([...activity.querySelectorAll('[data-role="circuit-node"]')].map(node => node.dataset.nodeId)).toEqual([
            'and-1',
            'and-2',
        ]);
        expect(renderer.collectResponse(activity).netlist.nodes.map(node => node.id)).toEqual(['and-1', 'and-2']);
    });

    it('renders the wire layer and GATE_PINS as labelled sibling controls with deterministic offsets', () => {
        const activity = renderCircuitActivity(renderer);
        const wireLayer = activity.querySelector('[data-role="circuit-wire-layer"]');

        expect(wireLayer?.tagName.toLowerCase()).toBe('svg');
        expect(wireLayer?.getAttribute('class')).toBe('electronics-logic-circuit__wire-layer');
        expect(wireLayer?.getAttribute('width')).toBe('480');
        expect(wireLayer?.getAttribute('height')).toBe('320');
        expect(wireLayer?.hasAttribute('aria-hidden')).toBe(false);

        const andNode = placeCircuitNode(activity, 'AND', 40, 40);
        const outputNode = placeCircuitNode(activity, 'OUTPUT', 160, 40);
        const andPins = [...andNode.parentElement.querySelectorAll('[data-role="circuit-pin"]')];
        const outputPins = [...outputNode.parentElement.querySelectorAll('[data-role="circuit-pin"]')];

        expect(andPins).toHaveLength(3);
        expect(outputPins).toHaveLength(1);
        expect(andPins.map(pin => [pin.dataset.pinName, pin.dataset.pinDirection])).toEqual([
            ['a', 'input'],
            ['b', 'input'],
            ['out', 'output'],
        ]);
        expect(outputPins.map(pin => [pin.dataset.pinName, pin.dataset.pinDirection])).toEqual([['a', 'input']]);
        expect(andPins.every(pin => pin.parentElement === andNode.parentElement && !andNode.contains(pin))).toBe(true);
        expect(andPins.every(pin => pin.dataset.nodeId === 'and-1')).toBe(true);
        expect(andPins.every(pin => pin.dataset.action === 'select-circuit-pin')).toBe(true);
        expect(andPins.every(pin => pin.dataset.circuitWireSource === 'false')).toBe(true);
        expect(andPins.every(pin => pin.getAttribute('aria-pressed') === 'false')).toBe(true);
        expect(andPins.map(pin => [pin.style.left, pin.style.top])).toEqual([
            ['0px', '10px'],
            ['0px', '30px'],
            ['40px', '20px'],
        ]);
        expect(outputPins.map(pin => [pin.style.left, pin.style.top])).toEqual([['0px', '20px']]);
        expect(andPins.map(pin => pin.getAttribute('aria-label'))).toEqual([
            'Chân vào a của nút and-1',
            'Chân vào b của nút and-1',
            'Chân ra out của nút and-1',
        ]);
    });

    it('rejects an input pin as the first wire endpoint without arming a source', () => {
        const activity = renderCircuitActivity(renderer);
        const outputNode = placeCircuitNode(activity, 'OUTPUT', 160, 40);

        getCircuitPin(activity, outputNode.dataset.nodeId, 'a').click();

        expect(activity.querySelector('[data-role="circuit-wire"]')).toBeNull();
        expect(activity.querySelector('[data-circuit-wire-source="true"]')).toBeNull();
        expect(activity.querySelector('[data-role="circuit-feedback"]').textContent).toBe(
            'Hãy bấm vào chân ra (bên phải nút) trước để bắt đầu nối dây.',
        );
    });

    it('arms an output pin and toggles it off without creating a wire', () => {
        const activity = renderCircuitActivity(renderer);
        const inputNode = placeCircuitNode(activity, 'INPUT', 40, 40);
        const source = getCircuitPin(activity, inputNode.dataset.nodeId, 'out');

        source.click();

        expect(source.dataset.circuitWireSource).toBe('true');
        expect(source.getAttribute('aria-pressed')).toBe('true');
        expect(activity.querySelector('[data-role="circuit-feedback"]').textContent).toBe('');

        source.click();

        expect(source.dataset.circuitWireSource).toBe('false');
        expect(source.getAttribute('aria-pressed')).toBe('false');
        expect(activity.querySelector('[data-role="circuit-wire"]')).toBeNull();
        expect(activity.querySelector('[data-role="circuit-feedback"]').textContent).toBe('');
    });

    it('keeps the source armed after self-connection and output-target rejections', () => {
        const activity = renderCircuitActivity(renderer);
        const andNode = placeCircuitNode(activity, 'AND', 40, 40);
        const inputNode = placeCircuitNode(activity, 'INPUT', 160, 40);
        const source = getCircuitPin(activity, andNode.dataset.nodeId, 'out');
        const feedback = activity.querySelector('[data-role="circuit-feedback"]');

        source.click();
        getCircuitPin(activity, andNode.dataset.nodeId, 'a').click();

        expect(feedback.textContent).toBe('Không thể nối một nút với chính nó.');
        expect(source.dataset.circuitWireSource).toBe('true');

        getCircuitPin(activity, inputNode.dataset.nodeId, 'out').click();

        expect(feedback.textContent).toBe('Hãy bấm vào một chân vào (bên trái nút) để hoàn tất dây nối.');
        expect(source.dataset.circuitWireSource).toBe('true');
        expect(activity.querySelector('[data-role="circuit-wire"]')).toBeNull();
    });

    it('creates and serializes a positioned wire while rejecting an occupied target', () => {
        const activity = renderCircuitActivity(renderer);
        const firstInput = placeCircuitNode(activity, 'INPUT', 40, 80);
        const output = placeCircuitNode(activity, 'OUTPUT', 200, 120);
        const secondInput = placeCircuitNode(activity, 'INPUT', 40, 160);
        const source = getCircuitPin(activity, firstInput.dataset.nodeId, 'out');
        const target = getCircuitPin(activity, output.dataset.nodeId, 'a');

        source.click();
        target.click();

        const wireLayer = activity.querySelector('[data-role="circuit-wire-layer"]');
        const wire = wireLayer.querySelector('[data-role="circuit-wire"]');
        expect(wire?.tagName.toLowerCase()).toBe('line');
        expect(wire?.getAttribute('class')).toBe('electronics-logic-circuit__wire');
        expect(wire?.getAttribute('data-action')).toBe('delete-circuit-wire');
        expect(wire?.getAttribute('data-wire-id')).toBe('w1');
        expect(wire?.getAttribute('data-from-node')).toBe('input-1');
        expect(wire?.getAttribute('data-from-pin')).toBe('out');
        expect(wire?.getAttribute('data-to-node')).toBe('output-1');
        expect(wire?.getAttribute('data-to-pin')).toBe('a');
        expect(['x1', 'y1', 'x2', 'y2'].map(attribute => wire?.getAttribute(attribute))).toEqual([
            '80',
            '100',
            '200',
            '140',
        ]);
        expect(wire?.getAttribute('tabindex')).toBe('0');
        expect(wire?.getAttribute('role')).toBe('button');
        expect(wire?.getAttribute('aria-label')).toBe('Dây nối input-1.out tới output-1.a. Bấm để xóa.');
        expect(source.dataset.circuitWireSource).toBe('false');
        expect(source.getAttribute('aria-pressed')).toBe('false');
        expect(activity.querySelector('[data-role="circuit-feedback"]').textContent).toBe('');
        expect(renderer.collectResponse(activity).netlist.wires).toEqual([
            {
                id: 'w1',
                from: { node: 'input-1', pin: 'out' },
                to: { node: 'output-1', pin: 'a' },
            },
        ]);

        const secondSource = getCircuitPin(activity, secondInput.dataset.nodeId, 'out');
        secondSource.click();
        target.click();

        expect(activity.querySelectorAll('[data-role="circuit-wire"]')).toHaveLength(1);
        expect(activity.querySelector('[data-role="circuit-feedback"]').textContent).toBe(
            'Chân vào này đã có dây nối tới.',
        );
        expect(secondSource.dataset.circuitWireSource).toBe('true');
    });

    it('assigns sequential wire ids across two valid connections', () => {
        const activity = renderCircuitActivity(renderer);
        const firstInput = placeCircuitNode(activity, 'INPUT', 0, 0);
        const secondInput = placeCircuitNode(activity, 'INPUT', 0, 80);
        const firstOutput = placeCircuitNode(activity, 'OUTPUT', 200, 0);
        const secondOutput = placeCircuitNode(activity, 'OUTPUT', 200, 80);

        connectCircuitPins(activity, firstInput.dataset.nodeId, 'out', firstOutput.dataset.nodeId, 'a');
        connectCircuitPins(activity, secondInput.dataset.nodeId, 'out', secondOutput.dataset.nodeId, 'a');

        expect(
            [...activity.querySelectorAll('[data-role="circuit-wire"]')].map(wire => wire.getAttribute('data-wire-id')),
        ).toEqual(['w1', 'w2']);
    });

    it('deletes a wire immediately on click and records a response change', () => {
        const activity = renderCircuitActivity(renderer);
        const input = placeCircuitNode(activity, 'INPUT', 0, 0);
        const output = placeCircuitNode(activity, 'OUTPUT', 200, 0);
        const wire = connectCircuitPins(activity, input.dataset.nodeId, 'out', output.dataset.nodeId, 'a');
        renderer.lastResults.set(activity.dataset.instanceId, { stale: true });

        wire.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(activity.querySelector('[data-role="circuit-wire"]')).toBeNull();
        expect(renderer.lastResults.has(activity.dataset.instanceId)).toBe(false);
        expect(activity.querySelector('[data-role="circuit-feedback"]').textContent).toBe('');
    });

    it('supports keyboard-only pin connection and wire deletion', () => {
        const activity = renderCircuitActivity(renderer);
        const input = placeCircuitNode(activity, 'INPUT', 0, 0);
        const output = placeCircuitNode(activity, 'OUTPUT', 200, 0);
        const source = getCircuitPin(activity, input.dataset.nodeId, 'out');
        const target = getCircuitPin(activity, output.dataset.nodeId, 'a');

        pressKey(source, 'Escape');
        expect(source.dataset.circuitWireSource).toBe('false');
        pressKey(source, 'Enter');
        expect(source.dataset.circuitWireSource).toBe('true');
        pressKey(target, ' ');

        const wire = activity.querySelector('[data-role="circuit-wire"]');
        expect(wire).not.toBeNull();
        pressKey(wire, 'Enter');
        expect(activity.querySelector('[data-role="circuit-wire"]')).toBeNull();
    });

    it('cascade-deletes every wire connected to a deleted node', () => {
        const activity = renderCircuitActivity(renderer);
        const input = placeCircuitNode(activity, 'INPUT', 0, 0);
        const andNode = placeCircuitNode(activity, 'AND', 160, 40);

        connectCircuitPins(activity, input.dataset.nodeId, 'out', andNode.dataset.nodeId, 'a');
        connectCircuitPins(activity, input.dataset.nodeId, 'out', andNode.dataset.nodeId, 'b');
        expect(activity.querySelectorAll('[data-role="circuit-wire"]')).toHaveLength(2);

        input.click();
        input.parentElement.querySelector('[data-action="delete-circuit-node"]').click();

        expect(activity.querySelector('[data-node-id="input-1"]')).toBeNull();
        expect(activity.querySelectorAll('[data-role="circuit-wire"]')).toHaveLength(0);
        expect(renderer.collectResponse(activity).netlist.wires).toEqual([]);
    });

    it('cascade-deletes wires targeting a deleted node while preserving an unrelated wire', () => {
        const activity = renderCircuitActivity(renderer);
        const firstInput = placeCircuitNode(activity, 'INPUT', 0, 0);
        const secondInput = placeCircuitNode(activity, 'INPUT', 0, 80);
        const targetAnd = placeCircuitNode(activity, 'AND', 160, 40);
        const unrelatedInput = placeCircuitNode(activity, 'INPUT', 0, 160);
        const unrelatedOutput = placeCircuitNode(activity, 'OUTPUT', 320, 160);

        connectCircuitPins(activity, firstInput.dataset.nodeId, 'out', targetAnd.dataset.nodeId, 'a');
        connectCircuitPins(activity, secondInput.dataset.nodeId, 'out', targetAnd.dataset.nodeId, 'b');
        connectCircuitPins(activity, unrelatedInput.dataset.nodeId, 'out', unrelatedOutput.dataset.nodeId, 'a');
        expect(
            [...activity.querySelectorAll('[data-role="circuit-wire"]')].map(wire => wire.getAttribute('data-wire-id')),
        ).toEqual(['w1', 'w2', 'w3']);

        targetAnd.click();
        targetAnd.parentElement.querySelector('[data-action="delete-circuit-node"]').click();

        expect(activity.querySelector('[data-node-id="and-1"]')).toBeNull();
        expect(activity.querySelector('[data-node-id="input-1"]')).not.toBeNull();
        expect(activity.querySelector('[data-node-id="input-2"]')).not.toBeNull();
        expect(renderer.collectResponse(activity).netlist.wires).toEqual([
            {
                id: 'w3',
                from: { node: 'input-3', pin: 'out' },
                to: { node: 'output-1', pin: 'a' },
            },
        ]);
    });

    it('recalculates all related wire endpoints when source and target nodes move', () => {
        const activity = renderCircuitActivity(renderer);
        const firstInput = placeCircuitNode(activity, 'INPUT', 0, 0);
        const andNode = placeCircuitNode(activity, 'AND', 160, 40);
        const secondInput = placeCircuitNode(activity, 'INPUT', 0, 160);
        const output = placeCircuitNode(activity, 'OUTPUT', 320, 160);
        const firstWire = connectCircuitPins(activity, firstInput.dataset.nodeId, 'out', andNode.dataset.nodeId, 'a');
        const secondWire = connectCircuitPins(activity, firstInput.dataset.nodeId, 'out', andNode.dataset.nodeId, 'b');
        const unrelatedWire = connectCircuitPins(
            activity,
            secondInput.dataset.nodeId,
            'out',
            output.dataset.nodeId,
            'a',
        );
        const unrelatedCoordinates = ['x1', 'y1', 'x2', 'y2'].map(attribute => unrelatedWire.getAttribute(attribute));

        firstInput.click();
        activity.querySelector('[data-role="circuit-cell"][data-x="80"][data-y="80"]').click();

        expect(['x1', 'y1'].map(attribute => firstWire.getAttribute(attribute))).toEqual(['120', '100']);
        expect(['x1', 'y1'].map(attribute => secondWire.getAttribute(attribute))).toEqual(['120', '100']);
        expect(['x2', 'y2'].map(attribute => firstWire.getAttribute(attribute))).toEqual(['160', '50']);
        expect(['x2', 'y2'].map(attribute => secondWire.getAttribute(attribute))).toEqual(['160', '70']);

        andNode.click();
        activity.querySelector('[data-role="circuit-cell"][data-x="240"][data-y="120"]').click();

        expect(['x2', 'y2'].map(attribute => firstWire.getAttribute(attribute))).toEqual(['240', '130']);
        expect(['x2', 'y2'].map(attribute => secondWire.getAttribute(attribute))).toEqual(['240', '150']);
        expect(['x1', 'y1', 'x2', 'y2'].map(attribute => unrelatedWire.getAttribute(attribute))).toEqual(
            unrelatedCoordinates,
        );
    });

    it('removes all circuit nodes and wires on reset', () => {
        const activity = renderCircuitActivity(renderer);
        const input = placeCircuitNode(activity, 'INPUT', 0, 0);
        const output = placeCircuitNode(activity, 'OUTPUT', 200, 0);
        connectCircuitPins(activity, input.dataset.nodeId, 'out', output.dataset.nodeId, 'a');

        activity.querySelector('[data-action="reset"]').click();

        expect(activity.querySelector('[data-role="circuit-node-item"]')).toBeNull();
        expect(activity.querySelector('[data-role="circuit-wire"]')).toBeNull();
        expect(renderer.collectResponse(activity)).toEqual({
            netlist: { schemaVersion: 1, nodes: [], wires: [] },
        });
    });

    it('disarms a wire source when a palette tool is armed', () => {
        const activity = renderCircuitActivity(renderer);
        const input = placeCircuitNode(activity, 'INPUT', 0, 0);
        const source = getCircuitPin(activity, input.dataset.nodeId, 'out');

        source.click();
        activity.querySelector('[data-node-kind="AND"]').click();

        expect(source.dataset.circuitWireSource).toBe('false');
        expect(source.getAttribute('aria-pressed')).toBe('false');
        expect(activity.querySelector('[data-node-kind="AND"]').getAttribute('aria-pressed')).toBe('true');
    });

    it('disarms a wire source when another node is selected', () => {
        const activity = renderCircuitActivity(renderer);
        const input = placeCircuitNode(activity, 'INPUT', 0, 0);
        const output = placeCircuitNode(activity, 'OUTPUT', 200, 0);
        const source = getCircuitPin(activity, input.dataset.nodeId, 'out');

        source.click();
        output.click();

        expect(source.dataset.circuitWireSource).toBe('false');
        expect(source.getAttribute('aria-pressed')).toBe('false');
        expect(output.dataset.circuitSelected).toBe('true');
        expect(output.getAttribute('aria-pressed')).toBe('true');
    });

    it('rejects a second node on an occupied cell and preserves the armed tool', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');
        const cell = activity.querySelector('[data-role="circuit-cell"][data-x="40"][data-y="40"]');

        activity.querySelector('[data-node-kind="AND"]').click();
        cell.click();
        activity.querySelector('[data-node-kind="OR"]').click();
        activity.querySelector('[data-role="circuit-node"]').click();

        expect(activity.querySelectorAll('[data-role="circuit-node"]')).toHaveLength(1);
        expect(activity.querySelector('[data-role="circuit-node"]').dataset.nodeKind).toBe('AND');
        expect(activity.querySelector('[data-node-kind="OR"]').getAttribute('aria-pressed')).toBe('true');
        const feedback = activity.querySelector('[data-role="circuit-feedback"]');
        expect(feedback.getAttribute('aria-live')).toBe('assertive');
        expect(feedback.textContent).toBe('Ô lưới này đã có nút mạch.');
    });

    it('selects and moves a node without changing its identity or duplicating it', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');

        activity.querySelector('[data-node-kind="XOR"]').click();
        activity.querySelector('[data-role="circuit-cell"][data-x="40"][data-y="40"]').click();
        const node = activity.querySelector('[data-role="circuit-node"]');
        const nodeId = node.dataset.nodeId;
        node.click();
        activity.querySelector('[data-role="circuit-cell"][data-x="200"][data-y="160"]').click();

        const movedNodes = [...activity.querySelectorAll('[data-role="circuit-node"]')];
        expect(movedNodes).toHaveLength(1);
        expect(movedNodes[0].dataset).toMatchObject({ nodeId, nodeKind: 'XOR', x: '200', y: '160' });
        expect(renderer.collectResponse(activity).netlist.nodes).toEqual([{ id: nodeId, kind: 'XOR', x: 200, y: 160 }]);
    });

    it('deletes the selected node from both the canvas and collected response', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');

        activity.querySelector('[data-node-kind="NOT"]').click();
        activity.querySelector('[data-role="circuit-cell"][data-x="120"][data-y="80"]').click();
        activity.querySelector('[data-role="circuit-node"]').click();
        activity.querySelector('[data-action="delete-circuit-node"]').click();

        expect(activity.querySelector('[data-role="circuit-node"]')).toBeNull();
        expect(renderer.collectResponse(activity)).toEqual({
            netlist: { schemaVersion: 1, nodes: [], wires: [] },
        });
    });

    it('supports keyboard-only placement, node selection, and movement', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');
        const firstCell = activity.querySelector('[data-role="circuit-cell"][data-x="0"][data-y="0"]');
        const destination = activity.querySelector('[data-role="circuit-cell"][data-x="160"][data-y="200"]');

        pressKey(firstCell, 'Escape');
        expect(activity.querySelector('[data-role="circuit-node"]')).toBeNull();
        activity.querySelector('[data-node-kind="INPUT"]').click();
        pressKey(firstCell, 'Enter');
        const node = activity.querySelector('[data-role="circuit-node"]');
        expect(node.tagName).toBe('BUTTON');
        pressKey(node, 'Enter');
        pressKey(destination, ' ');

        expect(activity.querySelectorAll('[data-role="circuit-node"]')).toHaveLength(1);
        expect(activity.querySelector('[data-role="circuit-node"]').dataset).toMatchObject({ x: '160', y: '200' });
    });

    it('keeps circuit grading gracefully unavailable through the existing check path', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const checkButton = document.querySelector('[data-action="check"]');

        expect(() => checkButton.click()).not.toThrow();
        const feedback = document.querySelector('[data-role="grading-feedback"]');
        expect(feedback.getAttribute('role')).toBe('alert');
        expect(feedback.textContent).toBe('Không thể chấm bài lúc này.');
    });

    it('shows the locked structural circuit error through the existing check path without a misleading score', () => {
        const data = createCircuitData({
            variables: ['A', 'B'],
            answer: {
                expression: '',
                minterms: [],
                dontCares: [],
                testbench: {
                    variables: ['A', 'B'],
                    inputs: { A: 'input-1', B: 'input-2' },
                    outputs: { Sum: 'output-1' },
                    expected: { Sum: 'A XOR B' },
                },
            },
        });
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');
        placeCircuitNode(activity, 'OUTPUT', 0, 0);

        expect(() => activity.querySelector('[data-action="check"]').click()).not.toThrow();
        const feedback = activity.querySelector('[data-role="grading-feedback"]');
        expect(feedback.textContent).toBe('Mạch chưa đúng cấu trúc, chưa thể chấm điểm.');
        expect(feedback.textContent).not.toContain('Điểm');
        expect(feedback.getAttribute('role')).toBe('alert');
    });

    it('shows the circuit score and passed testbench count for a non-structural result', () => {
        const activity = renderCircuitActivity(renderer);

        renderer.applyResult(
            activity,
            {
                score: 5,
                maxScore: 10,
                checks: [
                    { id: 'case-00-sum', passed: true },
                    { id: 'case-01-sum', passed: false },
                    { id: 'case-10-sum', passed: true },
                    { id: 'case-11-sum', passed: false },
                ],
            },
            renderer.getMessages(),
        );

        const feedback = activity.querySelector('[data-role="grading-feedback"]');
        expect(feedback.textContent).toBe('Điểm: 5 / 10. Đúng 2/4 tổ hợp kiểm tra.');
        expect(feedback.getAttribute('role')).toBe('alert');
    });

    it('validates circuit data without requiring a top-level netlist field', () => {
        expect(renderer.validateData(createCircuitData())).toEqual({ valid: true, errors: [] });

        global.$electronicsLogicCircuitNetlist = undefined;
        expect(renderer.validateData(createCircuitData())).toEqual({ valid: false, errors: ['coreUnavailable'] });
    });

    it('resets all circuit nodes, palette and selection state', () => {
        const data = createCircuitData();
        document.body.innerHTML = renderer.renderView(data, false, '{content}');
        renderer.renderBehaviour(data);
        const activity = document.querySelector('.electronics-logic-runtime');

        activity.querySelector('[data-node-kind="AND"]').click();
        activity.querySelector('[data-role="circuit-cell"][data-x="40"][data-y="40"]').click();
        activity.querySelector('[data-role="circuit-node"]').click();
        activity.querySelector('[data-node-kind="OR"]').click();
        activity.querySelector('[data-action="reset"]').click();

        expect(activity.querySelectorAll('[data-role="circuit-node"]')).toHaveLength(0);
        expect(
            [...activity.querySelectorAll('[data-role="circuit-palette-item"]')].every(
                item => item.getAttribute('aria-pressed') === 'false',
            ),
        ).toBe(true);
        expect(activity.querySelector('[data-circuit-selected="true"]')).toBeNull();
        expect(activity.querySelector('[data-role="empty-state"]').hidden).toBe(false);
        expect(renderer.collectResponse(activity)).toEqual({
            netlist: { schemaVersion: 1, nodes: [], wires: [] },
        });
    });
});
