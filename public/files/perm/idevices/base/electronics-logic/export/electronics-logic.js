/* eslint-disable no-undef */
/**
 * Electronics Logic learner runtime for preview and offline export.
 */
// biome-ignore lint/suspicious/noVar: eXe resolves this global by the config.xml export-object value.
var $electronicslogic = {
    supportedModes: ['boolean', 'truthTable', 'kmap', 'circuit'],
    lastResults: new Map(),

    /**
     * Render learner controls from canonical schema-v1 data.
     * Answers and author solutions are deliberately excluded from the HTML.
     *
     * @param {Object} data
     * @param {boolean} accessibility
     * @param {string} template
     * @returns {string}
     */
    renderView: function (data, accessibility, template) {
        const messages = this.getMessages();
        const validation = this.validateData(data);
        const exportTemplate = typeof template === 'string' && template.includes('{content}') ? template : '{content}';
        if (!validation.valid) {
            const invalidContent =
                '<section class="electronics-logic-runtime electronics-logic-runtime--invalid" ' +
                'data-testid="electronics-logic-runtime" data-schema-version="">' +
                '<p class="electronics-logic-runtime__alert" role="alert">' +
                this.escapeHtml(messages.invalidData) +
                '</p></section>';
            return exportTemplate.replace('{content}', invalidContent);
        }

        const instanceId = this.escapeHtml(data.id);
        const mode = this.escapeHtml(data.mode);
        const prompt = this.escapeHtml(data.prompt);
        const accessibilityLabel = this.escapeHtml(data.accessibility.label.trim() || data.prompt);
        const learnerControl =
            data.mode === 'truthTable'
                ? this.renderTruthTable(data.variables, messages)
                : data.mode === 'kmap'
                  ? this.renderKmap(data.variables, messages)
                  : data.mode === 'circuit'
                    ? this.renderCircuit(messages)
                    : this.renderExpressionInput(messages);
        const emptyMessage =
            data.mode === 'truthTable'
                ? messages.incompleteTable
                : data.mode === 'kmap'
                  ? messages.incompleteKmap
                  : data.mode === 'circuit'
                    ? messages.incompleteCircuit
                    : messages.emptyExpression;
        const content =
            '<section class="electronics-logic-runtime" data-testid="electronics-logic-runtime" ' +
            'data-schema-version="1" data-instance-id="' +
            instanceId +
            '" data-mode="' +
            mode +
            '" aria-label="' +
            accessibilityLabel +
            '">' +
            '<h3 class="electronics-logic-runtime__prompt">' +
            prompt +
            '</h3>' +
            learnerControl +
            '<p class="electronics-logic-runtime__empty" data-role="empty-state" role="status" aria-live="polite" ' +
            'data-empty-message="' +
            this.escapeHtml(emptyMessage) +
            '"></p>' +
            '<div class="electronics-logic-runtime__actions"><button class="electronics-logic-runtime__check" ' +
            'type="button" data-action="check">' +
            this.escapeHtml(messages.check) +
            '</button><button class="electronics-logic-runtime__reset" type="button" data-action="reset">' +
            this.escapeHtml(messages.reset) +
            '</button></div><div class="electronics-logic-runtime__feedback" data-role="grading-feedback" ' +
            'role="status" aria-live="polite"></div></section>';

        return exportTemplate.replace('{content}', content);
    },

    renderExpressionInput: function (messages) {
        return (
            '<div class="electronics-logic-expression">' +
            '<label class="electronics-logic-expression__label">' +
            this.escapeHtml(messages.expressionLabel) +
            '<input class="electronics-logic-expression__input" type="text" data-role="learner-expression" ' +
            'autocomplete="off" spellcheck="false"></label></div>'
        );
    },

    renderTruthTable: function (variables, messages) {
        const headings = variables.map(variable => '<th scope="col">' + this.escapeHtml(variable) + '</th>').join('');
        const rowCount = 2 ** variables.length;
        let rows = '';
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            const bits = rowIndex.toString(2).padStart(variables.length, '0');
            const inputCells = [...bits]
                .map(bit => '<td data-role="truth-input">' + this.escapeHtml(bit) + '</td>')
                .join('');
            const outputLabel = messages.outputAtRow.replace('{row}', bits);
            rows +=
                '<tr data-row-index="' +
                rowIndex +
                '">' +
                inputCells +
                '<td><select data-role="truth-value" aria-label="' +
                this.escapeHtml(outputLabel) +
                '">' +
                '<option value=""></option><option value="0">0</option><option value="1">1</option>' +
                '<option value="X">X</option></select></td></tr>';
        }
        return (
            '<div class="electronics-logic-table-wrap"><table class="electronics-logic-table">' +
            '<caption>' +
            this.escapeHtml(messages.truthTableCaption) +
            '</caption><thead><tr>' +
            headings +
            '<th scope="col">F</th></tr></thead><tbody>' +
            rows +
            '</tbody></table></div>'
        );
    },

    renderKmap: function (variables, messages) {
        const core = this.getCore();
        const vector = core.mintermsToVector({ variables, minterms: [], dontCares: [] });
        const model = core.vectorToKmapModel(vector);
        const columnLabels = model.columnLabels
            .map(label => '<th scope="col" data-role="kmap-column-label">' + this.escapeHtml(label) + '</th>')
            .join('');
        const rows = model.cells
            .map(
                (cells, rowIndex) =>
                    '<tr data-role="kmap-row" data-row-index="' +
                    rowIndex +
                    '"><th scope="row" data-role="kmap-row-label">' +
                    this.escapeHtml(model.rowLabels[rowIndex]) +
                    '</th>' +
                    cells
                        .map(cell => {
                            const cellLabel = messages.kmapCellLabel.replace('{index}', String(cell.index));
                            return (
                                '<td class="electronics-logic-kmap__cell" data-role="kmap-cell" ' +
                                'data-row-index="' +
                                cell.row +
                                '" data-column-index="' +
                                cell.column +
                                '" data-minterm-index="' +
                                cell.index +
                                '"><select data-role="kmap-value" aria-label="' +
                                this.escapeHtml(cellLabel) +
                                '"><option value=""></option><option value="0">0</option><option value="1">1</option>' +
                                '<option value="X">X</option></select><button type="button" ' +
                                'class="electronics-logic-kmap__selector" data-action="toggle-kmap-cell" ' +
                                'data-minterm-index="' +
                                cell.index +
                                '" data-kmap-selected="false" data-kmap-grouped="false" aria-pressed="false">m' +
                                cell.index +
                                '</button></td>'
                            );
                        })
                        .join('') +
                    '</tr>',
            )
            .join('');

        return (
            '<div class="electronics-logic-kmap"><table class="electronics-logic-kmap__table"><caption>' +
            this.escapeHtml(messages.kmapCaption) +
            '</caption><thead><tr><th scope="col"><span data-role="kmap-row-variables">' +
            this.escapeHtml(model.rowVariables.join('')) +
            '</span> \\ <span data-role="kmap-column-variables">' +
            this.escapeHtml(model.columnVariables.join('')) +
            '</span></th>' +
            columnLabels +
            '</tr></thead><tbody>' +
            rows +
            '</tbody></table><div class="electronics-logic-kmap__group-actions"><button type="button" ' +
            'data-action="create-kmap-group">' +
            this.escapeHtml(messages.createKmapGroup) +
            '</button><p data-role="kmap-group-feedback" role="alert" aria-live="assertive"></p></div>' +
            '<section class="electronics-logic-kmap__groups" aria-label="' +
            this.escapeHtml(messages.kmapGroupsLabel) +
            '"><h4>' +
            this.escapeHtml(messages.kmapGroupsLabel) +
            '</h4><ul data-role="kmap-group-list"><li data-role="kmap-no-groups">' +
            this.escapeHtml(messages.noKmapGroups) +
            '</li></ul></section></div>'
        );
    },

    renderCircuit: function (messages) {
        const gateKinds = Object.keys(this.getCircuitNetlist().GATE_PINS);
        const palette = gateKinds
            .map(
                kind =>
                    '<button type="button" class="electronics-logic-circuit__palette-item" ' +
                    'data-role="circuit-palette-item" data-action="arm-circuit-node" data-node-kind="' +
                    kind +
                    '" aria-pressed="false">' +
                    this.escapeHtml(messages.circuitNodeKinds[kind]) +
                    '</button>',
            )
            .join('');
        let cells = '';
        for (let row = 0; row < 8; row += 1) {
            for (let column = 0; column < 12; column += 1) {
                const x = column * 40;
                const y = row * 40;
                const label = messages.circuitCellLabel.replace('{x}', String(x)).replace('{y}', String(y));
                cells +=
                    '<button type="button" class="electronics-logic-circuit__cell" data-role="circuit-cell" ' +
                    'data-action="activate-circuit-cell" data-x="' +
                    x +
                    '" data-y="' +
                    y +
                    '" aria-label="' +
                    this.escapeHtml(label) +
                    '"></button>';
            }
        }
        return (
            '<section class="electronics-logic-circuit"><div class="electronics-logic-circuit__palette" ' +
            'role="toolbar" aria-label="' +
            this.escapeHtml(messages.circuitPaletteLabel) +
            '">' +
            palette +
            '</div><div class="electronics-logic-circuit__canvas" data-role="circuit-canvas" role="group" ' +
            'aria-label="' +
            this.escapeHtml(messages.circuitCanvasLabel) +
            '">' +
            cells +
            '<svg class="electronics-logic-circuit__wire-layer" data-role="circuit-wire-layer" ' +
            'width="480" height="320"></svg>' +
            '</div><p class="electronics-logic-circuit__feedback" data-role="circuit-feedback" role="alert" ' +
            'aria-live="assertive"></p></section>'
        );
    },

    validateData: function (data) {
        if (!this.isPlainObject(data)) return { valid: false, errors: ['invalidObject'] };
        const errors = [];
        if (typeof data.id !== 'string' || data.id.trim() === '') errors.push('invalidId');
        if (data.type !== 'electronics.logic') errors.push('invalidType');
        if (data.schemaVersion !== 1) errors.push('invalidSchemaVersion');
        if (!this.supportedModes.includes(data.mode)) errors.push('invalidMode');
        if (typeof data.prompt !== 'string' || data.prompt.trim() === '') errors.push('invalidPrompt');
        const validVariables =
            Array.isArray(data.variables) &&
            data.variables.length >= 2 &&
            data.variables.length <= 4 &&
            data.variables.every(variable => typeof variable === 'string' && /^[A-D]$/.test(variable)) &&
            new Set(data.variables).size === data.variables.length;
        if (data.mode !== 'circuit' && !validVariables) errors.push('invalidVariables');
        if (!this.isPlainObject(data.learner)) errors.push('invalidLearner');
        if (
            data.mode !== 'circuit' &&
            (!this.isPlainObject(data.authoring) || !['expression', 'minterms'].includes(data.authoring.answerSource))
        ) {
            errors.push('invalidAuthoring');
        }
        if (!this.isPlainObject(data.answer)) errors.push('invalidAnswer');
        if (data.mode === 'kmap') {
            const core = this.getCore();
            if (!core || typeof core.mintermsToVector !== 'function' || typeof core.vectorToKmapModel !== 'function') {
                errors.push('coreUnavailable');
            }
        }
        if (data.mode === 'circuit') {
            const circuitNetlist = this.getCircuitNetlist();
            if (!circuitNetlist || typeof circuitNetlist.parseNetlist !== 'function') {
                errors.push('coreUnavailable');
            }
        }
        if (
            !this.isPlainObject(data.grading) ||
            typeof data.grading.maxScore !== 'number' ||
            !Number.isFinite(data.grading.maxScore) ||
            data.grading.maxScore <= 0
        ) {
            errors.push('invalidGrading');
        }
        if (!this.isPlainObject(data.accessibility) || typeof data.accessibility.label !== 'string') {
            errors.push('invalidAccessibility');
        }
        return { valid: errors.length === 0, errors };
    },

    renderBehaviour: function (root) {
        const data = this.isPlainObject(root) && typeof root.querySelectorAll !== 'function' ? root : null;
        const scope =
            root && typeof root.querySelectorAll === 'function'
                ? root
                : typeof document !== 'undefined'
                  ? document
                  : null;
        if (!scope || typeof scope.querySelectorAll !== 'function') return false;
        scope
            .querySelectorAll('.electronics-logic-runtime:not(.electronics-logic-runtime--invalid)')
            .forEach(activity => {
                if (data && activity.dataset.instanceId !== data.id) return;
                if (activity.dataset.behaviourBound === 'true') return;
                activity.dataset.behaviourBound = 'true';
                activity.querySelectorAll('[data-role="learner-expression"]').forEach(control => {
                    control.addEventListener('input', () => this.handleResponseChange(activity));
                });
                activity.querySelectorAll('[data-role="truth-value"]').forEach(control => {
                    control.addEventListener('change', () => this.handleResponseChange(activity));
                });
                activity.querySelectorAll('[data-role="kmap-value"]').forEach(control => {
                    control.addEventListener('change', () => this.handleResponseChange(activity));
                });
                activity.querySelectorAll('[data-action="toggle-kmap-cell"]').forEach(control => {
                    control.addEventListener('click', () => this.toggleKmapCell(activity, control));
                });
                activity.querySelector('[data-action="create-kmap-group"]')?.addEventListener('click', () => {
                    this.createKmapGroup(activity);
                });
                activity.querySelector('[data-role="kmap-group-list"]')?.addEventListener('click', event => {
                    const deleteButton = event.target.closest('[data-action="delete-kmap-group"]');
                    if (deleteButton) this.deleteKmapGroup(activity, deleteButton);
                });
                activity.querySelectorAll('[data-role="circuit-palette-item"]').forEach(control => {
                    control.addEventListener('click', () => this.armCircuitTool(activity, control));
                });
                const circuitCanvas = activity.querySelector('[data-role="circuit-canvas"]');
                circuitCanvas?.addEventListener('click', event => {
                    this.handleCircuitCanvasAction(activity, event.target);
                });
                circuitCanvas?.addEventListener('keydown', event => {
                    if (
                        ['Enter', ' '].includes(event.key) &&
                        event.target.closest(
                            '[data-role="circuit-cell"], [data-role="circuit-node"], ' +
                                '[data-action="delete-circuit-node"], [data-role="circuit-pin"], ' +
                                '[data-role="circuit-wire"]',
                        )
                    ) {
                        event.preventDefault();
                        this.handleCircuitCanvasAction(activity, event.target);
                    }
                });
                activity.querySelector('[data-action="check"]')?.addEventListener('click', () => {
                    this.checkActivity(activity, data);
                });
                activity.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
                    this.resetActivity(activity);
                });
                this.updateEmptyState(activity);
            });
        return true;
    },

    init: function (root) {
        return this.renderBehaviour(root);
    },

    resetActivity: function (activity) {
        activity.querySelectorAll('[data-role="learner-expression"]').forEach(control => {
            control.value = '';
        });
        activity.querySelectorAll('[data-role="truth-value"]').forEach(control => {
            control.value = '';
        });
        activity.querySelectorAll('[data-role="kmap-value"]').forEach(control => {
            control.value = '';
        });
        activity.querySelectorAll('[data-action="toggle-kmap-cell"]').forEach(control => {
            control.dataset.kmapSelected = 'false';
            control.setAttribute('aria-pressed', 'false');
        });
        activity.querySelectorAll('[data-role="kmap-group"]').forEach(group => group.remove());
        const groupFeedback = activity.querySelector('[data-role="kmap-group-feedback"]');
        if (groupFeedback) groupFeedback.textContent = '';
        activity.querySelectorAll('[data-role="circuit-node-item"]').forEach(node => node.remove());
        activity.querySelectorAll('[data-role="circuit-wire"]').forEach(wire => wire.remove());
        activity.querySelectorAll('[data-role="circuit-palette-item"]').forEach(control => {
            control.setAttribute('aria-pressed', 'false');
        });
        this.clearCircuitFeedback(activity);
        this.updateKmapGroupEmptyState(activity);
        this.refreshKmapHighlights(activity);
        this.clearFeedback(activity);
        this.lastResults.delete(activity.dataset.instanceId);
        this.updateEmptyState(activity);
    },

    handleResponseChange: function (activity) {
        this.clearFeedback(activity);
        this.lastResults.delete(activity.dataset.instanceId);
        this.updateEmptyState(activity);
    },

    toggleKmapCell: function (activity, control) {
        const isSelected = control.dataset.kmapSelected === 'true';
        control.dataset.kmapSelected = String(!isSelected);
        control.setAttribute('aria-pressed', String(!isSelected));
        this.handleResponseChange(activity);
    },

    createKmapGroup: function (activity) {
        const selectedControls = [...activity.querySelectorAll('[data-kmap-selected="true"]')];
        if (selectedControls.length === 0) return;
        const cells = selectedControls.map(control => Number(control.dataset.mintermIndex));
        const kmapCells = [...activity.querySelectorAll('[data-role="kmap-cell"]')];
        const values = Array(kmapCells.length).fill('');
        kmapCells.forEach(cell => {
            values[Number(cell.dataset.mintermIndex)] = cell.querySelector('[data-role="kmap-value"]')?.value || '';
        });
        const validation = this.getKmapValidator().validateKmapGroup({
            variableCount: Math.log2(kmapCells.length),
            cells,
            values,
        });
        const feedback = activity.querySelector('[data-role="kmap-group-feedback"]');
        if (!validation.valid) {
            const messages = this.getMessages();
            const reasonMessages = {
                invalidSize: messages.kmapGroupInvalidSize,
                notRectangle: messages.kmapGroupNotRectangle,
                containsZero: messages.kmapGroupContainsZero,
            };
            if (feedback) feedback.textContent = reasonMessages[validation.reason] || '';
            return;
        }
        if (feedback) feedback.textContent = '';
        const existingIds = [...activity.querySelectorAll('[data-role="kmap-group"]')].map(group =>
            Number(group.dataset.groupId.slice(1)),
        );
        const groupId = `g${Math.max(0, ...existingIds) + 1}`;
        const group = document.createElement('li');
        group.dataset.role = 'kmap-group';
        group.dataset.groupId = groupId;
        group.dataset.cells = JSON.stringify(cells);
        const label = document.createElement('span');
        label.textContent = this.getMessages()
            .kmapGroupLabel.replace('{id}', groupId)
            .replace('{cells}', cells.join(', '));
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.dataset.action = 'delete-kmap-group';
        deleteButton.textContent = this.getMessages().deleteKmapGroup;
        group.append(label, deleteButton);
        activity.querySelector('[data-role="kmap-group-list"]')?.appendChild(group);
        selectedControls.forEach(control => {
            control.dataset.kmapSelected = 'false';
            control.setAttribute('aria-pressed', 'false');
        });
        this.updateKmapGroupEmptyState(activity);
        this.refreshKmapHighlights(activity);
        this.handleResponseChange(activity);
    },

    deleteKmapGroup: function (activity, deleteButton) {
        deleteButton.closest('[data-role="kmap-group"]')?.remove();
        this.updateKmapGroupEmptyState(activity);
        this.refreshKmapHighlights(activity);
        this.handleResponseChange(activity);
    },

    armCircuitTool: function (activity, control) {
        const shouldArm = control.getAttribute('aria-pressed') !== 'true';
        activity.querySelectorAll('[data-role="circuit-palette-item"]').forEach(item => {
            item.setAttribute('aria-pressed', 'false');
        });
        this.clearCircuitSelection(activity);
        this.clearCircuitWireArm(activity);
        if (shouldArm) control.setAttribute('aria-pressed', 'true');
        this.clearCircuitFeedback(activity);
    },

    handleCircuitCanvasAction: function (activity, target) {
        const deleteButton = target.closest('[data-action="delete-circuit-node"]');
        if (deleteButton) {
            this.deleteCircuitNode(activity, deleteButton);
            return;
        }
        const wire = target.closest('[data-role="circuit-wire"]');
        if (wire) {
            this.deleteCircuitWire(activity, wire);
            return;
        }
        const pin = target.closest('[data-role="circuit-pin"]');
        if (pin) {
            this.handleCircuitPinClick(activity, pin);
            return;
        }
        const node = target.closest('[data-role="circuit-node"]');
        if (node) {
            const armedTool = activity.querySelector('[data-role="circuit-palette-item"][aria-pressed="true"]');
            if (armedTool) {
                this.activateCircuitCell(activity, Number(node.dataset.x), Number(node.dataset.y));
            } else {
                this.selectCircuitNode(activity, node);
            }
            return;
        }
        const cell = target.closest('[data-role="circuit-cell"]');
        if (cell) this.activateCircuitCell(activity, Number(cell.dataset.x), Number(cell.dataset.y));
    },

    activateCircuitCell: function (activity, x, y) {
        const occupied = [...activity.querySelectorAll('[data-role="circuit-node"]')].some(
            node => Number(node.dataset.x) === x && Number(node.dataset.y) === y,
        );
        if (occupied) {
            const feedback = activity.querySelector('[data-role="circuit-feedback"]');
            if (feedback) feedback.textContent = this.getMessages().circuitOccupied;
            activity.querySelectorAll('[data-role="circuit-cell"]').forEach(cell => {
                cell.dataset.circuitRejected = String(Number(cell.dataset.x) === x && Number(cell.dataset.y) === y);
            });
            return;
        }

        const armedTool = activity.querySelector('[data-role="circuit-palette-item"][aria-pressed="true"]');
        const selectedNode = activity.querySelector('[data-role="circuit-node"][data-circuit-selected="true"]');
        this.clearCircuitFeedback(activity);
        if (armedTool) {
            this.createCircuitNode(activity, armedTool.dataset.nodeKind, x, y);
            armedTool.setAttribute('aria-pressed', 'false');
            this.handleResponseChange(activity);
        } else if (selectedNode) {
            selectedNode.dataset.x = String(x);
            selectedNode.dataset.y = String(y);
            const nodeItem = selectedNode.closest('[data-role="circuit-node-item"]');
            if (nodeItem) {
                nodeItem.style.left = `${x}px`;
                nodeItem.style.top = `${y}px`;
            }
            this.recalculateCircuitWiresForNode(
                activity,
                selectedNode.dataset.nodeId,
                selectedNode.dataset.nodeKind,
                x,
                y,
            );
            this.handleResponseChange(activity);
        }
    },

    createCircuitNode: function (activity, kind, x, y) {
        const canvas = activity.querySelector('[data-role="circuit-canvas"]');
        if (!canvas) return;
        const id = this.nextCircuitNodeId(activity, kind);
        const messages = this.getMessages();
        const nodeItem = document.createElement('div');
        nodeItem.className = 'electronics-logic-circuit__node-item';
        nodeItem.dataset.role = 'circuit-node-item';
        nodeItem.style.left = `${x}px`;
        nodeItem.style.top = `${y}px`;
        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'electronics-logic-circuit__node';
        node.dataset.role = 'circuit-node';
        node.dataset.action = 'select-circuit-node';
        node.dataset.nodeId = id;
        node.dataset.nodeKind = kind;
        node.dataset.x = String(x);
        node.dataset.y = String(y);
        node.dataset.circuitSelected = 'false';
        node.setAttribute('aria-pressed', 'false');
        node.setAttribute(
            'aria-label',
            messages.circuitNodeLabel.replace('{kind}', messages.circuitNodeKinds[kind]).replace('{id}', id),
        );
        node.textContent = messages.circuitNodeKinds[kind];
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'electronics-logic-circuit__delete';
        deleteButton.dataset.action = 'delete-circuit-node';
        deleteButton.textContent = messages.deleteCircuitNode;
        deleteButton.hidden = true;
        const gatePins = this.getCircuitNetlist().GATE_PINS[kind];
        const pinButtons = [
            ...gatePins.inputs.map(pinName => ({ direction: 'input', pinName })),
            ...gatePins.outputs.map(pinName => ({ direction: 'output', pinName })),
        ].map(({ direction, pinName }) => {
            const pin = document.createElement('button');
            const offset = this.circuitPinOffset(kind, direction, pinName);
            pin.type = 'button';
            pin.className = 'electronics-logic-circuit__pin';
            pin.dataset.role = 'circuit-pin';
            pin.dataset.action = 'select-circuit-pin';
            pin.dataset.nodeId = id;
            pin.dataset.pinName = pinName;
            pin.dataset.pinDirection = direction;
            pin.dataset.circuitWireSource = 'false';
            pin.style.left = `${offset.x}px`;
            pin.style.top = `${offset.y}px`;
            pin.setAttribute('aria-pressed', 'false');
            const label = direction === 'input' ? messages.circuitPinInputLabel : messages.circuitPinOutputLabel;
            pin.setAttribute('aria-label', label.replace('{pin}', pinName).replace('{id}', id));
            return pin;
        });
        nodeItem.append(node, deleteButton, ...pinButtons);
        canvas.appendChild(nodeItem);
    },

    circuitPinOffset: function (kind, direction, pinName) {
        const gatePins = this.getCircuitNetlist().GATE_PINS[kind];
        const pinNames = direction === 'output' ? gatePins.outputs : gatePins.inputs;
        const pinIndex = pinNames.indexOf(pinName);
        return {
            x: direction === 'output' ? 40 : 0,
            y: pinNames.length <= 1 ? 20 : pinIndex === 0 ? 10 : 30,
        };
    },

    nextCircuitNodeId: (activity, kind) => {
        const existingIds = new Set(
            [...activity.querySelectorAll('[data-role="circuit-node"]')].map(node => node.dataset.nodeId),
        );
        const prefix = kind.toLowerCase();
        let sequence = 1;
        while (existingIds.has(`${prefix}-${sequence}`)) sequence += 1;
        return `${prefix}-${sequence}`;
    },

    nextCircuitWireId: activity => {
        const existingIds = new Set(
            [...activity.querySelectorAll('[data-role="circuit-wire"]')].map(wire => wire.getAttribute('data-wire-id')),
        );
        let sequence = 1;
        while (existingIds.has(`w${sequence}`)) sequence += 1;
        return `w${sequence}`;
    },

    selectCircuitNode: function (activity, node) {
        this.clearCircuitWireArm(activity);
        this.clearCircuitSelection(activity);
        node.dataset.circuitSelected = 'true';
        node.setAttribute('aria-pressed', 'true');
        const deleteButton = node
            .closest('[data-role="circuit-node-item"]')
            ?.querySelector('[data-action="delete-circuit-node"]');
        if (deleteButton) deleteButton.hidden = false;
        this.clearCircuitFeedback(activity);
    },

    clearCircuitSelection: activity => {
        activity.querySelectorAll('[data-role="circuit-node"]').forEach(node => {
            node.dataset.circuitSelected = 'false';
            node.setAttribute('aria-pressed', 'false');
            const deleteButton = node
                .closest('[data-role="circuit-node-item"]')
                ?.querySelector('[data-action="delete-circuit-node"]');
            if (deleteButton) deleteButton.hidden = true;
        });
    },

    clearCircuitWireArm: activity => {
        activity.querySelectorAll('[data-role="circuit-pin"][data-circuit-wire-source="true"]').forEach(pin => {
            pin.dataset.circuitWireSource = 'false';
            pin.setAttribute('aria-pressed', 'false');
        });
    },

    handleCircuitPinClick: function (activity, pinButton) {
        const armedSource = activity.querySelector('[data-role="circuit-pin"][data-circuit-wire-source="true"]');
        const feedback = activity.querySelector('[data-role="circuit-feedback"]');
        const messages = this.getMessages();
        if (!armedSource) {
            if (pinButton.dataset.pinDirection !== 'output') {
                if (feedback) feedback.textContent = messages.circuitWireSourceRequired;
                return;
            }
            activity.querySelectorAll('[data-role="circuit-palette-item"]').forEach(item => {
                item.setAttribute('aria-pressed', 'false');
            });
            this.clearCircuitSelection(activity);
            pinButton.dataset.circuitWireSource = 'true';
            pinButton.setAttribute('aria-pressed', 'true');
            this.clearCircuitFeedback(activity);
            return;
        }
        if (pinButton === armedSource) {
            pinButton.dataset.circuitWireSource = 'false';
            pinButton.setAttribute('aria-pressed', 'false');
            this.clearCircuitFeedback(activity);
            return;
        }
        if (pinButton.dataset.nodeId === armedSource.dataset.nodeId) {
            if (feedback) feedback.textContent = messages.circuitWireSelfConnection;
            return;
        }
        if (pinButton.dataset.pinDirection !== 'input') {
            if (feedback) feedback.textContent = messages.circuitWireTargetInvalid;
            return;
        }
        const occupiedTarget = activity.querySelector(
            `[data-role="circuit-wire"][data-to-node="${pinButton.dataset.nodeId}"]` +
                `[data-to-pin="${pinButton.dataset.pinName}"]`,
        );
        if (occupiedTarget) {
            if (feedback) feedback.textContent = messages.circuitWireOccupied;
            return;
        }
        this.createCircuitWire(activity, armedSource, pinButton);
        armedSource.dataset.circuitWireSource = 'false';
        armedSource.setAttribute('aria-pressed', 'false');
        this.clearCircuitFeedback(activity);
        this.handleResponseChange(activity);
    },

    createCircuitWire: function (activity, sourcePin, targetPin) {
        const wireLayer = activity.querySelector('[data-role="circuit-wire-layer"]');
        const sourceNode = activity.querySelector(
            `[data-role="circuit-node"][data-node-id="${sourcePin.dataset.nodeId}"]`,
        );
        const targetNode = activity.querySelector(
            `[data-role="circuit-node"][data-node-id="${targetPin.dataset.nodeId}"]`,
        );
        if (!wireLayer || !sourceNode || !targetNode) return;
        const sourceOffset = this.circuitPinOffset(sourceNode.dataset.nodeKind, 'output', sourcePin.dataset.pinName);
        const targetOffset = this.circuitPinOffset(targetNode.dataset.nodeKind, 'input', targetPin.dataset.pinName);
        const wire = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const id = this.nextCircuitWireId(activity);
        wire.setAttribute('class', 'electronics-logic-circuit__wire');
        wire.setAttribute('data-role', 'circuit-wire');
        wire.setAttribute('data-action', 'delete-circuit-wire');
        wire.setAttribute('data-wire-id', id);
        wire.setAttribute('data-from-node', sourcePin.dataset.nodeId);
        wire.setAttribute('data-from-pin', sourcePin.dataset.pinName);
        wire.setAttribute('data-to-node', targetPin.dataset.nodeId);
        wire.setAttribute('data-to-pin', targetPin.dataset.pinName);
        wire.setAttribute('x1', String(Number(sourceNode.dataset.x) + sourceOffset.x));
        wire.setAttribute('y1', String(Number(sourceNode.dataset.y) + sourceOffset.y));
        wire.setAttribute('x2', String(Number(targetNode.dataset.x) + targetOffset.x));
        wire.setAttribute('y2', String(Number(targetNode.dataset.y) + targetOffset.y));
        wire.setAttribute('tabindex', '0');
        wire.setAttribute('role', 'button');
        wire.setAttribute(
            'aria-label',
            this.getMessages()
                .circuitWireLabel.replace('{from}', `${sourcePin.dataset.nodeId}.${sourcePin.dataset.pinName}`)
                .replace('{to}', `${targetPin.dataset.nodeId}.${targetPin.dataset.pinName}`),
        );
        wireLayer.appendChild(wire);
    },

    deleteCircuitWire: function (activity, wire) {
        wire.remove();
        this.clearCircuitFeedback(activity);
        this.handleResponseChange(activity);
    },

    deleteCircuitNode: function (activity, deleteButton) {
        const nodeItem = deleteButton.closest('[data-role="circuit-node-item"]');
        const nodeId = nodeItem?.querySelector('[data-role="circuit-node"]')?.dataset.nodeId;
        if (nodeId) this.deleteCircuitWiresForNode(activity, nodeId);
        nodeItem?.remove();
        this.clearCircuitFeedback(activity);
        this.handleResponseChange(activity);
    },

    deleteCircuitWiresForNode: (activity, nodeId) => {
        activity.querySelectorAll('[data-role="circuit-wire"]').forEach(wire => {
            if (wire.getAttribute('data-from-node') === nodeId || wire.getAttribute('data-to-node') === nodeId) {
                wire.remove();
            }
        });
    },

    recalculateCircuitWiresForNode: function (activity, nodeId, kind, x, y) {
        activity.querySelectorAll('[data-role="circuit-wire"]').forEach(wire => {
            if (wire.getAttribute('data-from-node') === nodeId) {
                const offset = this.circuitPinOffset(kind, 'output', wire.getAttribute('data-from-pin'));
                wire.setAttribute('x1', String(x + offset.x));
                wire.setAttribute('y1', String(y + offset.y));
            }
            if (wire.getAttribute('data-to-node') === nodeId) {
                const offset = this.circuitPinOffset(kind, 'input', wire.getAttribute('data-to-pin'));
                wire.setAttribute('x2', String(x + offset.x));
                wire.setAttribute('y2', String(y + offset.y));
            }
        });
    },

    clearCircuitFeedback: activity => {
        const feedback = activity.querySelector('[data-role="circuit-feedback"]');
        if (feedback) feedback.textContent = '';
        activity.querySelectorAll('[data-role="circuit-cell"]').forEach(cell => {
            delete cell.dataset.circuitRejected;
        });
    },

    updateKmapGroupEmptyState: function (activity) {
        const list = activity.querySelector('[data-role="kmap-group-list"]');
        if (!list) return;
        const groups = list.querySelectorAll('[data-role="kmap-group"]');
        const emptyItem = list.querySelector('[data-role="kmap-no-groups"]');
        if (groups.length === 0 && !emptyItem) {
            const item = document.createElement('li');
            item.dataset.role = 'kmap-no-groups';
            item.textContent = this.getMessages().noKmapGroups;
            list.appendChild(item);
        } else if (groups.length > 0) {
            emptyItem?.remove();
        }
    },

    refreshKmapHighlights: activity => {
        const groupedCells = new Set(
            [...activity.querySelectorAll('[data-role="kmap-group"]')].flatMap(group =>
                JSON.parse(group.dataset.cells || '[]'),
            ),
        );
        activity.querySelectorAll('[data-action="toggle-kmap-cell"]').forEach(control => {
            control.dataset.kmapGrouped = String(groupedCells.has(Number(control.dataset.mintermIndex)));
        });
    },

    clearFeedback: activity => {
        activity.querySelectorAll('[data-grade]').forEach(control => {
            delete control.dataset.grade;
        });
        const feedback = activity.querySelector('[data-role="grading-feedback"]');
        if (feedback) {
            feedback.textContent = '';
            feedback.setAttribute('role', 'status');
        }
    },

    collectResponse: activity => {
        const expression = activity.querySelector('[data-role="learner-expression"]');
        if (expression) return { expression: expression.value.trim() };
        const circuitCanvas = activity.querySelector('[data-role="circuit-canvas"]');
        if (circuitCanvas) {
            return {
                netlist: {
                    schemaVersion: 1,
                    nodes: [...activity.querySelectorAll('[data-role="circuit-node"]')].map(node => ({
                        id: node.dataset.nodeId,
                        kind: node.dataset.nodeKind,
                        x: Number(node.dataset.x),
                        y: Number(node.dataset.y),
                    })),
                    wires: [...activity.querySelectorAll('[data-role="circuit-wire"]')].map(wire => ({
                        id: wire.getAttribute('data-wire-id'),
                        from: {
                            node: wire.getAttribute('data-from-node'),
                            pin: wire.getAttribute('data-from-pin'),
                        },
                        to: {
                            node: wire.getAttribute('data-to-node'),
                            pin: wire.getAttribute('data-to-pin'),
                        },
                    })),
                },
            };
        }
        const kmapRows = [...activity.querySelectorAll('[data-role="kmap-row"]')];
        if (kmapRows.length > 0) {
            return {
                cells: kmapRows.map(row =>
                    [...row.querySelectorAll('[data-role="kmap-value"]')].map(control => control.value),
                ),
                groups: [...activity.querySelectorAll('[data-role="kmap-group"]')].map(group => ({
                    id: group.dataset.groupId,
                    cells: JSON.parse(group.dataset.cells || '[]'),
                })),
            };
        }
        return {
            values: [...activity.querySelectorAll('[data-role="truth-value"]')].map(control => control.value),
        };
    },

    checkActivity: function (activity, data) {
        const messages = this.getMessages();
        const feedback = activity.querySelector('[data-role="grading-feedback"]');
        if (!feedback) return null;
        const response = this.collectResponse(activity);
        const incomplete =
            response.expression === '' ||
            response.values?.some(value => value === '') ||
            response.cells?.flat().some(value => value === '');
        if (incomplete) {
            feedback.setAttribute('role', 'alert');
            feedback.textContent = activity.querySelector('[data-role="empty-state"]')?.dataset.emptyMessage || '';
            return null;
        }
        const grader = typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicGrader : null;
        if (!grader || typeof grader.gradeActivity !== 'function' || !data) {
            feedback.setAttribute('role', 'alert');
            feedback.textContent = messages.gradingUnavailable;
            return null;
        }
        try {
            const result = grader.gradeActivity(data, response, this.createAttemptMetadata());
            this.lastResults.set(activity.dataset.instanceId, result);
            this.applyResult(activity, result, messages);
            return result;
        } catch (_error) {
            feedback.setAttribute('role', 'alert');
            feedback.textContent = messages.gradingUnavailable;
            return null;
        }
    },

    applyResult: (activity, result, messages) => {
        const feedback = activity.querySelector('[data-role="grading-feedback"]');
        const kmapCells = [...activity.querySelectorAll('[data-role="kmap-cell"]')];
        const truthValues = [...activity.querySelectorAll('[data-role="truth-value"]')];
        const circuitCanvas = activity.querySelector('[data-role="circuit-canvas"]');
        if (kmapCells.length > 0) {
            const checks = new Map(result.checks.map(check => [check.id, check]));
            kmapCells.forEach(cell => {
                const check = checks.get(`kmap-cell-${cell.dataset.mintermIndex}`);
                const control = cell.querySelector('[data-role="kmap-value"]');
                if (check && control) control.dataset.grade = check.passed ? 'passed' : 'failed';
            });
            activity.querySelectorAll('[data-role="kmap-group"]').forEach(group => {
                const check = checks.get(`kmap-group-${group.dataset.groupId}`);
                if (check) group.dataset.grade = check.passed ? 'passed' : 'failed';
            });
            const groupChecks = result.checks.filter(
                check =>
                    check.id.startsWith('kmap-group-') ||
                    check.id.startsWith('kmap-coverage-') ||
                    check.id === 'kmap-groups-not-required',
            );
            const passedGroups = groupChecks.filter(check => check.passed).length;
            const groupSummary = messages.kmapGroupsResult
                .replace('{passed}', passedGroups)
                .replace('{total}', groupChecks.length);
            const solution = checks.get('kmap-sop-minimal')?.solution;
            const solutionHint = solution ? ` ${messages.kmapSolutionHint.replace('{expression}', solution)}` : '';
            feedback.textContent = `${messages.score}: ${result.score} / ${result.maxScore}. ${groupSummary}${solutionHint}`;
        } else if (truthValues.length > 0) {
            result.checks.forEach((check, index) => {
                if (truthValues[index]) truthValues[index].dataset.grade = check.passed ? 'passed' : 'failed';
            });
            const passed = result.checks.filter(check => check.passed).length;
            feedback.textContent = `${messages.score}: ${result.score} / ${result.maxScore}. ${messages.correctCells
                .replace('{passed}', passed)
                .replace('{total}', result.checks.length)}`;
        } else if (circuitCanvas) {
            const structural = result.checks.length > 0 && result.checks.every(check => check.id.startsWith('structure-'));
            if (structural) {
                feedback.textContent = messages.circuitStructureInvalid;
            } else {
                const passed = result.checks.filter(check => check.passed).length;
                feedback.textContent = `${messages.score}: ${result.score} / ${result.maxScore}. ${messages.correctCircuitCases
                    .replace('{passed}', passed)
                    .replace('{total}', result.checks.length)}`;
            }
        } else {
            const check = result.checks[0];
            const expression = activity.querySelector('[data-role="learner-expression"]');
            if (expression) expression.dataset.grade = check.passed ? 'passed' : 'failed';
            feedback.textContent =
                check.id === 'expression-syntax'
                    ? `${messages.syntaxError} ${check.error?.message || ''}`.trim()
                    : `${messages.score}: ${result.score} / ${result.maxScore}.`;
        }
        feedback.setAttribute('role', result.score === result.maxScore ? 'status' : 'alert');
    },

    createAttemptMetadata: () => ({
        attemptId:
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `attempt-${Date.now()}`,
        createdAt: new Date().toISOString(),
    }),

    updateEmptyState: activity => {
        const status = activity.querySelector('[data-role="empty-state"]');
        if (!status) return;
        const expression = activity.querySelector('[data-role="learner-expression"]');
        const truthValues = [...activity.querySelectorAll('[data-role="truth-value"]')];
        const kmapValues = [...activity.querySelectorAll('[data-role="kmap-value"]')];
        const circuitCanvas = activity.querySelector('[data-role="circuit-canvas"]');
        const circuitNodes = [...activity.querySelectorAll('[data-role="circuit-node"]')];
        const isComplete = expression
            ? expression.value.trim() !== ''
            : truthValues.length > 0
              ? truthValues.every(control => ['0', '1', 'X'].includes(control.value))
              : kmapValues.length > 0
                ? kmapValues.every(control => ['0', '1', 'X'].includes(control.value))
                : Boolean(circuitCanvas) && circuitNodes.length > 0;
        status.hidden = isComplete;
        status.textContent = isComplete ? '' : status.dataset.emptyMessage || '';
    },

    getMessages: () => ({
        invalidData:
            typeof _ === 'function'
                ? _('Dữ liệu bài tập Electronics Logic không hợp lệ.')
                : 'Dữ liệu bài tập Electronics Logic không hợp lệ.',
        expressionLabel: typeof _ === 'function' ? _('Biểu thức của bạn') : 'Biểu thức của bạn',
        truthTableCaption: typeof _ === 'function' ? _('Bảng chân trị') : 'Bảng chân trị',
        outputAtRow: typeof _ === 'function' ? _('Giá trị F tại hàng {row}') : 'Giá trị F tại hàng {row}',
        emptyExpression: typeof _ === 'function' ? _('Chưa nhập biểu thức.') : 'Chưa nhập biểu thức.',
        incompleteTable: typeof _ === 'function' ? _('Chưa điền đủ bảng chân trị.') : 'Chưa điền đủ bảng chân trị.',
        incompleteKmap: typeof _ === 'function' ? _('Chưa điền đủ bản đồ Karnaugh.') : 'Chưa điền đủ bản đồ Karnaugh.',
        incompleteCircuit: typeof _ === 'function' ? _('Chưa thêm nút mạch nào.') : 'Chưa thêm nút mạch nào.',
        kmapCaption: typeof _ === 'function' ? _('Bản đồ Karnaugh') : 'Bản đồ Karnaugh',
        kmapCellLabel: typeof _ === 'function' ? _('Giá trị tại minterm {index}') : 'Giá trị tại minterm {index}',
        createKmapGroup: typeof _ === 'function' ? _('Tạo nhóm') : 'Tạo nhóm',
        kmapGroupsLabel: typeof _ === 'function' ? _('Danh sách nhóm') : 'Danh sách nhóm',
        noKmapGroups: typeof _ === 'function' ? _('Chưa có nhóm nào.') : 'Chưa có nhóm nào.',
        kmapGroupLabel: typeof _ === 'function' ? _('Nhóm {id}: {cells}') : 'Nhóm {id}: {cells}',
        deleteKmapGroup: typeof _ === 'function' ? _('Xóa nhóm') : 'Xóa nhóm',
        kmapGroupInvalidSize:
            typeof _ === 'function'
                ? _('Nhóm Karnaugh phải có 1, 2, 4, 8 hoặc 16 ô.')
                : 'Nhóm Karnaugh phải có 1, 2, 4, 8 hoặc 16 ô.',
        kmapGroupNotRectangle:
            typeof _ === 'function'
                ? _('Các ô đã chọn không tạo thành hình chữ nhật Karnaugh hợp lệ.')
                : 'Các ô đã chọn không tạo thành hình chữ nhật Karnaugh hợp lệ.',
        kmapGroupContainsZero:
            typeof _ === 'function'
                ? _('Nhóm Karnaugh không được chứa ô có giá trị 0.')
                : 'Nhóm Karnaugh không được chứa ô có giá trị 0.',
        check: typeof _ === 'function' ? _('Kiểm tra') : 'Kiểm tra',
        reset: typeof _ === 'function' ? _('Làm lại') : 'Làm lại',
        score: typeof _ === 'function' ? _('Điểm') : 'Điểm',
        correctCells: typeof _ === 'function' ? _('Đúng {passed}/{total} ô.') : 'Đúng {passed}/{total} ô.',
        correctCircuitCases:
            typeof _ === 'function'
                ? _('Đúng {passed}/{total} tổ hợp kiểm tra.')
                : 'Đúng {passed}/{total} tổ hợp kiểm tra.',
        circuitStructureInvalid:
            typeof _ === 'function'
                ? _('Mạch chưa đúng cấu trúc, chưa thể chấm điểm.')
                : 'Mạch chưa đúng cấu trúc, chưa thể chấm điểm.',
        kmapGroupsResult:
            typeof _ === 'function' ? _('Đạt {passed}/{total} yêu cầu nhóm.') : 'Đạt {passed}/{total} yêu cầu nhóm.',
        kmapSolutionHint:
            typeof _ === 'function'
                ? _('Một lời giải tối giản: {expression}.')
                : 'Một lời giải tối giản: {expression}.',
        circuitPaletteLabel: typeof _ === 'function' ? _('Bảng chọn nút mạch') : 'Bảng chọn nút mạch',
        circuitCanvasLabel: typeof _ === 'function' ? _('Lưới mạch logic') : 'Lưới mạch logic',
        circuitCellLabel: typeof _ === 'function' ? _('Ô lưới tại tọa độ {x}, {y}') : 'Ô lưới tại tọa độ {x}, {y}',
        circuitNodeLabel: typeof _ === 'function' ? _('Nút {kind} {id}') : 'Nút {kind} {id}',
        deleteCircuitNode: typeof _ === 'function' ? _('Xóa nút') : 'Xóa nút',
        circuitOccupied: typeof _ === 'function' ? _('Ô lưới này đã có nút mạch.') : 'Ô lưới này đã có nút mạch.',
        circuitPinInputLabel:
            typeof _ === 'function' ? _('Chân vào {pin} của nút {id}') : 'Chân vào {pin} của nút {id}',
        circuitPinOutputLabel: typeof _ === 'function' ? _('Chân ra {pin} của nút {id}') : 'Chân ra {pin} của nút {id}',
        circuitWireLabel:
            typeof _ === 'function'
                ? _('Dây nối {from} tới {to}. Bấm để xóa.')
                : 'Dây nối {from} tới {to}. Bấm để xóa.',
        circuitWireSourceRequired:
            typeof _ === 'function'
                ? _('Hãy bấm vào chân ra (bên phải nút) trước để bắt đầu nối dây.')
                : 'Hãy bấm vào chân ra (bên phải nút) trước để bắt đầu nối dây.',
        circuitWireSelfConnection:
            typeof _ === 'function' ? _('Không thể nối một nút với chính nó.') : 'Không thể nối một nút với chính nó.',
        circuitWireTargetInvalid:
            typeof _ === 'function'
                ? _('Hãy bấm vào một chân vào (bên trái nút) để hoàn tất dây nối.')
                : 'Hãy bấm vào một chân vào (bên trái nút) để hoàn tất dây nối.',
        circuitWireOccupied:
            typeof _ === 'function' ? _('Chân vào này đã có dây nối tới.') : 'Chân vào này đã có dây nối tới.',
        circuitNodeKinds: {
            INPUT: typeof _ === 'function' ? _('Input') : 'Input',
            OUTPUT: typeof _ === 'function' ? _('Output/LED') : 'Output/LED',
            NOT: typeof _ === 'function' ? _('NOT') : 'NOT',
            AND: typeof _ === 'function' ? _('AND') : 'AND',
            OR: typeof _ === 'function' ? _('OR') : 'OR',
            XOR: typeof _ === 'function' ? _('XOR') : 'XOR',
        },
        syntaxError: typeof _ === 'function' ? _('Biểu thức chưa đúng cú pháp.') : 'Biểu thức chưa đúng cú pháp.',
        gradingUnavailable: typeof _ === 'function' ? _('Không thể chấm bài lúc này.') : 'Không thể chấm bài lúc này.',
    }),

    isPlainObject: value => value !== null && typeof value === 'object' && !Array.isArray(value),

    getCore: () => (typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicCore : undefined),

    getKmapValidator: () => (typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicKmapValidator : undefined),

    getCircuitNetlist: () =>
        typeof globalThis !== 'undefined' ? globalThis.$electronicsLogicCircuitNetlist : undefined,

    escapeHtml: value =>
        String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;'),
};

if (typeof globalThis !== 'undefined') globalThis.$electronicslogic = $electronicslogic;
