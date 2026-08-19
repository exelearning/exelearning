/* eslint-disable no-undef */
/**
 * Electronics Logic iDevice domain model and authoring editor.
 */
// biome-ignore lint/suspicious/noVar: eXe loads iDevice scripts globally and requires window.$exeDevice.
var $exeDevice = {
    schemaVersion: 1,
    activityType: 'electronics.logic',
    supportedModes: ['boolean', 'truthTable', 'kmap', 'circuit'],
    authoringModes: ['boolean', 'truthTable', 'kmap', 'circuit'],
    answerSources: ['expression', 'minterms'],
    variableOrder: ['A', 'B', 'C', 'D'],
    name: _('Electronics Logic'),
    defaultPlaceholderText: c_('Electronics Logic activity placeholder'),
    validationTitle: _('Dữ liệu Electronics Logic không hợp lệ.'),
    authoringValidationTitle: _('Hãy sửa các trường sau trước khi lưu.'),
    validationMessages: {
        invalidObject: _('Dữ liệu Electronics Logic phải là một đối tượng JSON.'),
        invalidId: _('Dữ liệu Electronics Logic thiếu mã hoạt động hợp lệ.'),
        invalidType: _('Loại hoạt động Electronics Logic không được hỗ trợ.'),
        missingSchemaVersion: _('Dữ liệu Electronics Logic thiếu phiên bản schema.'),
        unsupportedSchemaVersion: _('Phiên bản dữ liệu Electronics Logic không được hỗ trợ.'),
        invalidMode: _('Chế độ Electronics Logic không hợp lệ.'),
        invalidPrompt: _('Đề bài Electronics Logic phải là văn bản.'),
        emptyPrompt: _('Đề bài không được để trống.'),
        invalidVariables: _('Chế độ Boolean và bảng chân trị cần từ hai đến bốn biến A–D duy nhất.'),
        invalidAuthoring: _('Dữ liệu biên soạn Electronics Logic không hợp lệ.'),
        invalidAnswerSource: _('Nguồn đáp án phải là biểu thức hoặc danh sách minterm.'),
        invalidSolution: _('Lời giải phải là văn bản.'),
        invalidAnswer: _('Dữ liệu đáp án Electronics Logic không hợp lệ.'),
        invalidExpression: _('Biểu thức đáp án phải là văn bản.'),
        emptyExpression: _('Biểu thức đáp án không được để trống.'),
        invalidMinterms: _('Minterm phải là danh sách số nguyên.'),
        invalidDontCares: _("Don't-care phải là danh sách số nguyên."),
        invalidTestbench: _('Testbench mạch điện không hợp lệ.'),
        duplicateMinterm: _('Danh sách minterm không được lặp giá trị.'),
        duplicateDontCare: _("Danh sách don't-care không được lặp giá trị."),
        mintermOutOfRange: _('Minterm phải nằm trong miền của số biến đã chọn.'),
        dontCareOutOfRange: _("Don't-care phải nằm trong miền của số biến đã chọn."),
        overlappingDontCare: _("Minterm và don't-care không được trùng nhau."),
        invalidOutputs: _('Đáp án đầu ra phải là một danh sách.'),
        invalidOutputLength: _('Số đáp án đầu ra phải bằng 2 lũy thừa số biến.'),
        invalidGrading: _('Dữ liệu chấm điểm Electronics Logic không hợp lệ.'),
        invalidMaxScore: _('Điểm tối đa Electronics Logic phải lớn hơn 0.'),
        invalidLearner: _('Dữ liệu người học Electronics Logic không hợp lệ.'),
        invalidAccessibility: _('Dữ liệu hỗ trợ tiếp cận Electronics Logic không hợp lệ.'),
        invalidAccessibilityLabel: _('Nhãn hỗ trợ tiếp cận Electronics Logic phải là văn bản.'),
        lifecycleUnavailable: _('Không thể nạp bộ kiểm tra dữ liệu Electronics Logic.'),
    },
    ideviceBody: null,
    data: null,
    validationErrors: [],

    init: function (element, previousData) {
        this.ideviceBody = element;
        this.validationErrors = [];
        const fallbackId = element.getAttribute('idevice-id') || '';

        if (!this.getSchemaLifecycle()) {
            this.data = null;
            this.validationErrors = [{ code: 'lifecycleUnavailable', path: '$' }];
            this.renderEditor();
            return;
        }

        if (this.isPlainObject(previousData) && Object.keys(previousData).length === 0) {
            this.data = this.createDefaultData(fallbackId);
        } else if (!this.isPlainObject(previousData)) {
            this.data = null;
            this.validationErrors = [{ code: 'invalidObject', path: '$' }];
        } else {
            const migrated = this.migrateData(previousData, fallbackId);
            const validation = this.validateData(migrated);
            const blockingErrors = validation.errors.filter(
                error => !['emptyPrompt', 'emptyExpression'].includes(error.code),
            );
            this.validationErrors = blockingErrors;
            this.data = blockingErrors.length === 0 ? this.normalizeData(migrated) : migrated;
        }

        this.renderEditor();
    },

    save: function () {
        if (!this.data || !this.ideviceBody) return false;
        const draft = this.collectEditorData();
        const validation = this.validateData(draft);
        this.validationErrors = validation.errors;
        this.data = draft;

        if (!validation.valid) {
            this.renderAuthoringErrors();
            return false;
        }

        this.data = this.normalizeData(draft);
        this.clearAuthoringErrors();
        return this.cloneJson(this.data);
    },

    createDefaultData: function (id) {
        return this.getSchemaLifecycle().createDefaultActivity({ id, placeholderText: this.defaultPlaceholderText });
    },

    migrateData: function (source, fallbackId) {
        if (!this.isPlainObject(source)) return source;
        const sourceVersion = source.schemaVersion == null ? 0 : source.schemaVersion;
        if (sourceVersion !== 0) return this.cloneJson(source);
        return this.getSchemaLifecycle().migrateSchemaV0ToV1(source, {
            fallbackId,
            placeholderText: this.defaultPlaceholderText,
        });
    },

    validateData: function (data) {
        const lifecycle = this.getSchemaLifecycle();
        if (!lifecycle) return { valid: false, errors: [{ code: 'lifecycleUnavailable', path: '$' }] };
        const validation = lifecycle.validate(data);
        return {
            valid: validation.valid,
            errors: validation.errors.map(error => ({ code: error.code, path: error.path })),
        };
    },

    normalizeData: function (data) {
        return this.getSchemaLifecycle().normalize(data);
    },

    collectEditorData: function () {
        const draft = this.cloneJson(this.data);
        const value = field => this.ideviceBody.querySelector(`[data-field="${field}"]`)?.value;
        const mode = value('mode');
        const variableCount = Number(value('variable-count'));
        const answerSource = value('answer-source');

        if (mode) draft.mode = mode;
        if (Number.isInteger(variableCount)) draft.variables = this.variableOrder.slice(0, variableCount);
        draft.prompt = value('prompt') ?? draft.prompt;
        draft.authoring.answerSource = answerSource || draft.authoring.answerSource;
        draft.authoring.solution = value('solution') ?? draft.authoring.solution;
        draft.grading.maxScore = Number(value('max-score'));

        if (draft.mode === 'circuit') {
            draft.answer.expression = '';
            draft.answer.minterms = [];
            draft.answer.dontCares = [];
            const circuitOutputs = value('circuit-outputs');
            if (typeof circuitOutputs === 'string') {
                const { outputs, expected } = this.parseCircuitOutputs(circuitOutputs);
                draft.answer.testbench = {
                    variables: draft.variables,
                    inputs: this.buildCircuitInputs(draft.variables),
                    outputs,
                    expected,
                };
            }
        } else if (draft.authoring.answerSource === 'expression') {
            draft.answer.expression = value('expression') ?? '';
            draft.answer.minterms = [];
            draft.answer.dontCares = [];
        } else {
            draft.answer.expression = '';
            draft.answer.minterms = this.parseIndexList(value('minterms'));
            draft.answer.dontCares = this.parseIndexList(value('dont-cares'));
        }
        return draft;
    },

    parseIndexList: value => {
        if (typeof value !== 'string' || value.trim() === '') return [];
        return value.split(',').map(part => {
            const token = part.trim();
            return token === '' ? Number.NaN : Number(token);
        });
    },

    parseCircuitOutputs: value => {
        if (typeof value !== 'string') return { outputs: {}, expected: {} };
        const outputs = {};
        const expected = {};
        let sequence = 0;
        value.split('\n').forEach(line => {
            const separatorIndex = line.indexOf('=');
            if (separatorIndex === -1) return;
            const name = line.slice(0, separatorIndex).trim();
            const expression = line.slice(separatorIndex + 1).trim();
            if (name === '' || expression === '') return;
            sequence += 1;
            outputs[name] = `output-${sequence}`;
            expected[name] = expression;
        });
        return { outputs, expected };
    },

    buildCircuitInputs: variables =>
        Object.fromEntries(variables.map((variable, index) => [variable, `input-${index + 1}`])),

    testbenchToOutputsField: testbench => {
        if (testbench === null || typeof testbench !== 'object') return '';
        const outputs = testbench.outputs || {};
        const expected = testbench.expected || {};
        return Object.keys(outputs)
            .map(name => `${name} = ${expected[name] ?? ''}`)
            .join('\n');
    },

    renderEditor: function () {
        this.ideviceBody.replaceChildren();
        if (this.validationErrors.length > 0) {
            this.renderValidationError();
            return;
        }

        const editor = document.createElement('section');
        editor.className = 'electronics-logic-editor';
        editor.dataset.testid = 'electronics-logic-editor';

        const title = document.createElement('h3');
        title.className = 'electronics-logic-editor__title';
        title.textContent = this.name;

        const form = document.createElement('div');
        form.className = 'electronics-logic-authoring';
        form.append(
            this.createSelectField('mode', _('Chế độ'), [
                { value: 'boolean', label: _('Boolean') },
                { value: 'truthTable', label: _('Bảng chân trị') },
                { value: 'kmap', label: _('Karnaugh') },
                { value: 'circuit', label: _('Mạch logic') },
            ]),
            this.createSelectField(
                'variable-count',
                _('Số biến'),
                [2, 3, 4].map(count => ({ value: String(count), label: String(count) })),
                String(this.data.variables.length),
            ),
            this.createTextAreaField('prompt', _('Đề bài'), this.data.prompt, true),
        );

        if (this.data.mode === 'circuit') {
            form.append(
                this.createTextAreaField(
                    'circuit-outputs',
                    _('Đầu ra mạch (mỗi dòng: Tên = Biểu thức)'),
                    this.testbenchToOutputsField(this.data.answer.testbench),
                    true,
                ),
            );
        } else {
            form.append(
                this.createSelectField('answer-source', _('Nguồn đáp án'), [
                    { value: 'expression', label: _('Biểu thức') },
                    { value: 'minterms', label: _("Minterm và don't-care") },
                ]),
            );
            if (this.data.authoring.answerSource === 'minterms') {
                const maxIndex = 2 ** this.data.variables.length - 1;
                form.append(
                    this.createInputField(
                        'minterms',
                        _('Minterm'),
                        this.data.answer.minterms.join(', '),
                        _('Nhập các số cách nhau bằng dấu phẩy, từ 0 đến {max}.').replace(
                            '{max}',
                            String(maxIndex),
                        ),
                    ),
                    this.createInputField(
                        'dont-cares',
                        _("Don't-care"),
                        this.data.answer.dontCares.join(', '),
                        _('Có thể để trống; không được trùng minterm.'),
                    ),
                );
            } else {
                form.append(
                    this.createInputField(
                        'expression',
                        _('Biểu thức đáp án'),
                        this.data.answer.expression,
                        _('Dùng biến A–D và các phép NOT, AND, XOR, OR.'),
                    ),
                );
            }
        }

        form.append(
            this.createNumberField('max-score', _('Điểm tối đa'), this.data.grading.maxScore),
            this.createTextAreaField('solution', _('Lời giải ngắn'), this.data.authoring.solution, false),
        );

        editor.append(title, form);
        this.ideviceBody.appendChild(editor);
        this.bindAuthoringEvents();
    },

    createSelectField: function (name, labelText, options, selectedValue) {
        const select = document.createElement('select');
        select.dataset.field = name;
        select.id = this.controlId(name);
        options.forEach(optionData => {
            const option = document.createElement('option');
            option.value = optionData.value;
            option.textContent = optionData.label;
            select.appendChild(option);
        });
        select.value = selectedValue ?? this.fieldValue(name);
        return this.createField(labelText, select);
    },

    createInputField: function (name, labelText, currentValue, helpText) {
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.field = name;
        input.id = this.controlId(name);
        input.value = currentValue;
        return this.createField(labelText, input, helpText);
    },

    createNumberField: function (name, labelText, currentValue) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0.01';
        input.step = '0.01';
        input.dataset.field = name;
        input.id = this.controlId(name);
        input.value = String(currentValue);
        return this.createField(labelText, input);
    },

    createTextAreaField: function (name, labelText, currentValue, required) {
        const textarea = document.createElement('textarea');
        textarea.dataset.field = name;
        textarea.id = this.controlId(name);
        textarea.value = currentValue;
        textarea.required = required;
        textarea.rows = name === 'prompt' ? 3 : 2;
        return this.createField(labelText, textarea);
    },

    createField: (labelText, control, helpText) => {
        const field = document.createElement('div');
        field.className = 'electronics-logic-field';
        const label = document.createElement('label');
        label.htmlFor = control.id;
        label.textContent = labelText;
        field.append(label, control);
        if (helpText) {
            const help = document.createElement('p');
            help.className = 'electronics-logic-field__help';
            help.textContent = helpText;
            field.appendChild(help);
        }
        return field;
    },

    fieldValue: function (name) {
        if (name === 'mode') return this.data.mode;
        if (name === 'answer-source') return this.data.authoring.answerSource;
        return '';
    },

    controlId: function (name) {
        const ideviceId = String(this.data.id || 'new').replace(/[^a-zA-Z0-9_-]/g, '-');
        return `electronics-logic-${ideviceId}-${name}`;
    },

    bindAuthoringEvents: function () {
        this.ideviceBody.querySelector('[data-field="mode"]')?.addEventListener('change', () => {
            this.data = this.collectEditorData();
            this.validationErrors = [];
            this.renderEditor();
        });
        this.ideviceBody.querySelector('[data-field="answer-source"]')?.addEventListener('change', () => {
            this.data = this.collectEditorData();
            this.validationErrors = [];
            this.renderEditor();
        });
        this.ideviceBody.querySelector('[data-field="variable-count"]')?.addEventListener('change', () => {
            this.data = this.collectEditorData();
            this.validationErrors = [];
            this.renderEditor();
        });
    },

    renderValidationError: function () {
        const alert = this.createValidationAlert(this.validationTitle, this.validationErrors);
        alert.className = 'electronics-logic-validation-error';
        this.ideviceBody.appendChild(alert);
    },

    renderAuthoringErrors: function () {
        this.clearAuthoringErrors();
        const editor = this.ideviceBody.querySelector('[data-testid="electronics-logic-editor"]');
        if (!editor) {
            this.renderValidationError();
            return;
        }
        const alert = this.createValidationAlert(this.authoringValidationTitle, this.validationErrors);
        alert.className = 'electronics-logic-validation-error electronics-logic-authoring-errors';
        alert.dataset.testid = 'electronics-logic-authoring-errors';
        editor.prepend(alert);
    },

    createValidationAlert: function (titleText, errors) {
        const alert = document.createElement('section');
        alert.setAttribute('role', 'alert');
        const title = document.createElement('h3');
        title.textContent = titleText;
        const list = document.createElement('ul');
        errors.forEach(error => {
            const item = document.createElement('li');
            item.textContent = this.validationMessages[error.code] || error.message || this.validationTitle;
            list.appendChild(item);
        });
        alert.append(title, list);
        return alert;
    },

    clearAuthoringErrors: function () {
        this.ideviceBody.querySelector('[data-testid="electronics-logic-authoring-errors"]')?.remove();
    },

    isPlainObject: value => value !== null && typeof value === 'object' && !Array.isArray(value),

    getSchemaLifecycle: () =>
        typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicSchemaLifecycle : undefined,

    cloneJson: value => JSON.parse(JSON.stringify(value)),
};

if (typeof globalThis !== 'undefined') globalThis.$exeDevice = $exeDevice;
