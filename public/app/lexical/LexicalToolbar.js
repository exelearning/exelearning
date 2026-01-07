/**
 * Lexical Toolbar Component - TinyMCE-like appearance
 *
 * Provides a complete toolbar matching TinyMCE's style with:
 * - Multiple button rows with all formatting options
 * - Format/Font/Size selectors
 * - Color pickers
 */
(function () {
    'use strict';

    const {
        $getSelection,
        $isRangeSelection,
        $createParagraphNode,
        $getRoot,
        FORMAT_TEXT_COMMAND,
        FORMAT_ELEMENT_COMMAND,
        UNDO_COMMAND,
        REDO_COMMAND,
        COMMAND_PRIORITY_LOW,
        SELECTION_CHANGE_COMMAND,
        // Rich text
        $createHeadingNode,
        $createQuoteNode,
        $isHeadingNode,
        // List
        insertList,
        removeList,
        $isListNode,
        ListNode,
        // Table
        $createTableNode,
        $createTableRowNode,
        $createTableCellNode,
        $insertNodes,
        INSERT_TABLE_COMMAND,
        // Link
        $createLinkNode,
        $isLinkNode,
        toggleLink,
        TOGGLE_LINK_COMMAND,
        // Utils
        $setBlocksType,
        $patchStyleText,
        $getSelectionStyleValueForProperty,
    } = window.LexicalBundle;

    const Logger = window.Logger || console;
    const _ = window._ || ((s) => s);

    // Get icons from EditorIcons
    const getIcon = (name) => {
        if (window.EditorIcons?.getIcon) {
            return window.EditorIcons.getIcon(name);
        }
        return null;
    };

    // Get custom node creators
    const { $createHorizontalRuleNode, $createImageNode } = window.LexicalNodes || {};

    /**
     * Font sizes
     */
    const FONT_SIZES = [
        { value: '', label: _('Default') },
        { value: '8pt', label: '8pt' },
        { value: '10pt', label: '10pt' },
        { value: '12pt', label: '12pt' },
        { value: '14pt', label: '14pt' },
        { value: '16pt', label: '16pt' },
        { value: '18pt', label: '18pt' },
        { value: '20pt', label: '20pt' },
        { value: '24pt', label: '24pt' },
        { value: '36pt', label: '36pt' },
        { value: '48pt', label: '48pt' },
    ];

    /**
     * Block formats
     */
    const BLOCK_FORMATS = [
        { value: 'paragraph', label: _('Paragraph') },
        { value: 'h1', label: _('Heading 1') },
        { value: 'h2', label: _('Heading 2') },
        { value: 'h3', label: _('Heading 3') },
        { value: 'h4', label: _('Heading 4') },
        { value: 'h5', label: _('Heading 5') },
        { value: 'h6', label: _('Heading 6') },
        { value: 'quote', label: _('Quote') },
    ];

    /**
     * Color palette
     */
    const COLOR_PALETTE = [
        '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
        '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
        '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
        '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
        '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
        '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
        '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
        '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
    ];

    /**
     * LexicalToolbar class
     */
    class LexicalToolbar {
        /**
         * @param {Object} options
         * @param {LexicalEditor} options.editor - The editor wrapper instance
         * @param {HTMLElement} options.container - Container for the toolbar
         * @param {Function} [options.onMediaLibrary] - Callback to open media library
         * @param {Function} [options.onLinkDialog] - Callback to open link dialog
         */
        constructor(options = {}) {
            this.editorWrapper = options.editor;
            this.container = options.container;
            this.onMediaLibrary = options.onMediaLibrary || null;
            this.onLinkDialog = options.onLinkDialog || null;

            if (!this.editorWrapper || !this.container) {
                throw new Error('LexicalToolbar: editor and container are required');
            }

            this.editor = this.editorWrapper.getEditor();
            this.buttons = new Map();
            this.selects = new Map();
            this._openDropdown = null;
            this._destroyed = false;

            this._createToolbar();
            this._bindEvents();

            Logger.log('[LexicalToolbar] Initialized');
        }

        /**
         * Create the toolbar structure
         * @private
         */
        _createToolbar() {
            const wrapper = document.createElement('div');
            wrapper.className = 'lexical-toolbar-wrapper tox tox-tinymce';

            // Create button rows
            const buttonRows = this._createButtonRows();
            wrapper.appendChild(buttonRows);

            this.container.appendChild(wrapper);
            this.wrapper = wrapper;
        }

        /**
         * Create button rows
         * @private
         */
        _createButtonRows() {
            const rows = document.createElement('div');
            rows.className = 'lexical-button-rows';

            // Row 1: Format selector, font size, formatting buttons
            const row1 = this._createRow([
                { type: 'select', name: 'format', options: BLOCK_FORMATS, width: '120px' },
                { type: 'select', name: 'fontSize', options: FONT_SIZES, width: '80px' },
                { type: 'separator' },
                { type: 'button', name: 'bold', icon: 'bold', format: 'bold', tooltip: _('Bold (Ctrl+B)') },
                { type: 'button', name: 'italic', icon: 'italic', format: 'italic', tooltip: _('Italic (Ctrl+I)') },
                { type: 'button', name: 'underline', icon: 'underline', format: 'underline', tooltip: _('Underline (Ctrl+U)') },
                { type: 'button', name: 'strikethrough', icon: 'strikethrough', format: 'strikethrough', tooltip: _('Strikethrough') },
                { type: 'separator' },
                { type: 'button', name: 'subscript', icon: 'subscript', format: 'subscript', tooltip: _('Subscript') },
                { type: 'button', name: 'superscript', icon: 'superscript', format: 'superscript', tooltip: _('Superscript') },
                { type: 'separator' },
                { type: 'colorButton', name: 'forecolor', icon: 'forecolor', property: 'color', tooltip: _('Text color') },
                { type: 'colorButton', name: 'backcolor', icon: 'backcolor', property: 'background-color', tooltip: _('Background color') },
            ]);
            rows.appendChild(row1);

            // Row 2: Alignment, lists, indent, link, image, table
            const row2 = this._createRow([
                { type: 'button', name: 'alignleft', icon: 'alignleft', align: 'left', tooltip: _('Align left') },
                { type: 'button', name: 'aligncenter', icon: 'aligncenter', align: 'center', tooltip: _('Align center') },
                { type: 'button', name: 'alignright', icon: 'alignright', align: 'right', tooltip: _('Align right') },
                { type: 'button', name: 'alignjustify', icon: 'alignjustify', align: 'justify', tooltip: _('Justify') },
                { type: 'separator' },
                { type: 'button', name: 'bullist', icon: 'bullist', action: 'bulletList', tooltip: _('Bullet list') },
                { type: 'button', name: 'numlist', icon: 'numlist', action: 'numberedList', tooltip: _('Numbered list') },
                { type: 'separator' },
                { type: 'button', name: 'outdent', icon: 'outdent', action: 'outdent', tooltip: _('Decrease indent') },
                { type: 'button', name: 'indent', icon: 'indent', action: 'indent', tooltip: _('Increase indent') },
                { type: 'separator' },
                { type: 'button', name: 'link', icon: 'link', action: 'link', tooltip: _('Insert/Edit link') },
                { type: 'button', name: 'unlink', icon: 'unlink', action: 'unlink', tooltip: _('Remove link') },
                { type: 'separator' },
                { type: 'button', name: 'image', icon: 'image', action: 'image', tooltip: _('Insert image') },
                { type: 'button', name: 'table', icon: 'table', action: 'table', tooltip: _('Insert table') },
                { type: 'button', name: 'hr', icon: 'hr', action: 'hr', tooltip: _('Horizontal line') },
                { type: 'separator' },
                { type: 'button', name: 'blockquote', icon: 'blockquote', action: 'blockquote', tooltip: _('Blockquote') },
                { type: 'button', name: 'code', icon: 'code', format: 'code', tooltip: _('Code') },
                { type: 'separator' },
                { type: 'button', name: 'removeformat', icon: 'removeformat', action: 'removeFormat', tooltip: _('Clear formatting') },
                { type: 'separator' },
                { type: 'button', name: 'undo', icon: 'undo', action: 'undo', tooltip: _('Undo (Ctrl+Z)') },
                { type: 'button', name: 'redo', icon: 'redo', action: 'redo', tooltip: _('Redo (Ctrl+Y)') },
            ]);
            rows.appendChild(row2);

            return rows;
        }

        /**
         * Create a toolbar row
         * @private
         */
        _createRow(items) {
            const row = document.createElement('div');
            row.className = 'lexical-toolbar-row';

            let currentGroup = document.createElement('div');
            currentGroup.className = 'lexical-toolbar-group';
            row.appendChild(currentGroup);

            for (const item of items) {
                if (item.type === 'separator') {
                    currentGroup = document.createElement('div');
                    currentGroup.className = 'lexical-toolbar-group';
                    row.appendChild(currentGroup);
                    continue;
                }

                if (item.type === 'button') {
                    const btn = this._createButton(item);
                    currentGroup.appendChild(btn);
                } else if (item.type === 'select') {
                    const select = this._createSelect(item);
                    currentGroup.appendChild(select);
                } else if (item.type === 'colorButton') {
                    const colorBtn = this._createColorButton(item);
                    currentGroup.appendChild(colorBtn);
                }
            }

            return row;
        }

        /**
         * Create a toolbar button
         * @private
         */
        _createButton(item) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lexical-toolbar-btn';
            btn.setAttribute('data-name', item.name);
            if (item.tooltip) btn.title = item.tooltip;

            // Add icon
            const iconSvg = getIcon(item.icon);
            if (iconSvg) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'tox-icon';
                iconSpan.innerHTML = iconSvg;
                btn.appendChild(iconSpan);
            } else {
                btn.textContent = item.name.charAt(0).toUpperCase();
            }

            // Store button reference
            this.buttons.set(item.name, { element: btn, config: item });

            // Add click handler
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this._handleButtonClick(item);
            });

            return btn;
        }

        /**
         * Create a select dropdown
         * @private
         */
        _createSelect(item) {
            const wrapper = document.createElement('div');
            wrapper.className = 'lexical-select-wrapper';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lexical-select-btn';
            btn.setAttribute('data-name', item.name);
            if (item.width) btn.style.minWidth = item.width;

            const label = document.createElement('span');
            label.className = 'tox-tbtn__select-label';
            label.textContent = item.options[0]?.label || '';
            btn.appendChild(label);

            const chevron = document.createElement('span');
            chevron.className = 'tox-tbtn__select-chevron';
            const chevronIcon = getIcon('chevrondown');
            if (chevronIcon) {
                chevron.innerHTML = chevronIcon;
            } else {
                chevron.textContent = '▼';
            }
            btn.appendChild(chevron);

            wrapper.appendChild(btn);

            // Store reference
            this.selects.set(item.name, { element: btn, label, config: item });

            // Add click handler
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._showSelectDropdown(wrapper, item);
            });

            return wrapper;
        }

        /**
         * Create a color button with dropdown
         * @private
         */
        _createColorButton(item) {
            const wrapper = document.createElement('div');
            wrapper.className = 'lexical-select-wrapper';
            wrapper.style.position = 'relative';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lexical-toolbar-btn';
            btn.setAttribute('data-name', item.name);
            if (item.tooltip) btn.title = item.tooltip;

            const iconSvg = getIcon(item.icon);
            if (iconSvg) {
                const iconSpan = document.createElement('span');
                iconSpan.className = 'tox-icon';
                iconSpan.innerHTML = iconSvg;
                btn.appendChild(iconSpan);
            }

            wrapper.appendChild(btn);

            // Store reference
            this.buttons.set(item.name, { element: btn, config: item });

            // Add click handler
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._showColorPicker(wrapper, item);
            });

            return wrapper;
        }

        /**
         * Show select dropdown
         * @private
         */
        _showSelectDropdown(wrapper, item) {
            this._closeDropdowns();

            const dropdown = document.createElement('div');
            dropdown.className = 'lexical-select-dropdown';

            for (const option of item.options) {
                const optionEl = document.createElement('div');
                optionEl.className = 'lexical-select-option';
                optionEl.textContent = option.label;
                optionEl.setAttribute('data-value', option.value);

                optionEl.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._handleSelectChange(item.name, option.value);
                    this._closeDropdowns();
                });

                dropdown.appendChild(optionEl);
            }

            wrapper.appendChild(dropdown);
            this._openDropdown = dropdown;
        }

        /**
         * Show color picker
         * @private
         */
        _showColorPicker(wrapper, item) {
            this._closeDropdowns();

            const picker = document.createElement('div');
            picker.className = 'lexical-color-picker';
            picker.style.position = 'absolute';
            picker.style.top = '100%';
            picker.style.left = '0';
            picker.style.zIndex = '1200';

            const grid = document.createElement('div');
            grid.className = 'color-picker-grid';

            for (const color of COLOR_PALETTE) {
                const swatch = document.createElement('div');
                swatch.className = 'color-swatch';
                swatch.style.backgroundColor = color;
                swatch.setAttribute('data-color', color);

                swatch.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._applyColor(item.property, color);
                    this._closeDropdowns();
                });

                grid.appendChild(swatch);
            }

            picker.appendChild(grid);

            // Custom color input
            const custom = document.createElement('div');
            custom.className = 'color-picker-custom';

            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = '#000000';
            colorInput.addEventListener('change', (e) => {
                this._applyColor(item.property, e.target.value);
                this._closeDropdowns();
            });

            const customLabel = document.createElement('span');
            customLabel.textContent = _('Custom color');

            custom.appendChild(colorInput);
            custom.appendChild(customLabel);
            picker.appendChild(custom);

            wrapper.appendChild(picker);
            this._openDropdown = picker;
        }

        /**
         * Close all dropdowns
         * @private
         */
        _closeDropdowns() {
            if (this._openDropdown) {
                this._openDropdown.remove();
                this._openDropdown = null;
            }
        }

        /**
         * Handle button click
         * @private
         */
        _handleButtonClick(item) {
            this.editorWrapper.focus();

            // Format commands (bold, italic, etc.)
            if (item.format) {
                this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, item.format);
                return;
            }

            // Alignment commands
            if (item.align) {
                this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, item.align);
                return;
            }

            // Action commands
            if (item.action) {
                this._executeAction(item.action);
            }
        }

        /**
         * Execute an action
         * @private
         */
        _executeAction(action) {
            switch (action) {
                case 'undo':
                    this.editor.dispatchCommand(UNDO_COMMAND, undefined);
                    break;

                case 'redo':
                    this.editor.dispatchCommand(REDO_COMMAND, undefined);
                    break;

                case 'bulletList':
                    this.editor.update(() => {
                        insertList(this.editor, 'bullet');
                    });
                    break;

                case 'numberedList':
                    this.editor.update(() => {
                        insertList(this.editor, 'number');
                    });
                    break;

                case 'link':
                    if (this.onLinkDialog) {
                        this.onLinkDialog();
                    } else {
                        this._showLinkDialog();
                    }
                    break;

                case 'unlink':
                    this.editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
                    break;

                case 'image':
                    if (this.onMediaLibrary) {
                        this.onMediaLibrary('image');
                    }
                    break;

                case 'table':
                    this._insertTable(3, 3);
                    break;

                case 'hr':
                    this._insertHorizontalRule();
                    break;

                case 'blockquote':
                    this._toggleBlockquote();
                    break;

                case 'removeFormat':
                    this._removeFormat();
                    break;

                case 'indent':
                    // TODO: Implement indent
                    break;

                case 'outdent':
                    // TODO: Implement outdent
                    break;

                default:
                    Logger.log(`[LexicalToolbar] Unknown action: ${action}`);
            }
        }

        /**
         * Handle select change
         * @private
         */
        _handleSelectChange(name, value) {
            this.editorWrapper.focus();

            if (name === 'format') {
                this._setBlockFormat(value);
            } else if (name === 'fontSize') {
                this._setFontSize(value);
            }
        }

        /**
         * Set block format (paragraph, heading, etc.)
         * @private
         */
        _setBlockFormat(format) {
            this.editor.update(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) return;

                if (format === 'paragraph') {
                    $setBlocksType(selection, () => $createParagraphNode());
                } else if (format.startsWith('h')) {
                    const level = parseInt(format.charAt(1), 10);
                    $setBlocksType(selection, () => $createHeadingNode(`h${level}`));
                } else if (format === 'quote') {
                    $setBlocksType(selection, () => $createQuoteNode());
                }
            });
        }

        /**
         * Set font size
         * @private
         */
        _setFontSize(size) {
            this.editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { 'font-size': size || null });
                }
            });
        }

        /**
         * Apply color to selection
         * @private
         */
        _applyColor(property, color) {
            this.editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { [property]: color });
                }
            });
        }

        /**
         * Insert horizontal rule
         * @private
         */
        _insertHorizontalRule() {
            if (!$createHorizontalRuleNode) {
                Logger.error('[LexicalToolbar] LexicalNodes not loaded');
                return;
            }

            this.editor.update(() => {
                const hrNode = $createHorizontalRuleNode();
                $insertNodes([hrNode, $createParagraphNode()]);
            });
        }

        /**
         * Toggle blockquote
         * @private
         */
        _toggleBlockquote() {
            this.editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $setBlocksType(selection, () => $createQuoteNode());
                }
            });
        }

        /**
         * Remove all formatting
         * @private
         */
        _removeFormat() {
            this.editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    // Clear all text formats
                    const formats = ['bold', 'italic', 'underline', 'strikethrough', 'code', 'subscript', 'superscript'];
                    for (const format of formats) {
                        selection.formatText(format);
                        // Toggle off if active
                        if (selection.hasFormat(format)) {
                            selection.formatText(format);
                        }
                    }
                    // Clear inline styles
                    $patchStyleText(selection, {
                        'font-size': null,
                        'color': null,
                        'background-color': null,
                        'font-family': null,
                    });
                }
            });
        }

        /**
         * Insert table
         * @private
         */
        _insertTable(rows, cols) {
            this.editor.update(() => {
                const tableNode = $createTableNode();

                for (let r = 0; r < rows; r++) {
                    const rowNode = $createTableRowNode();
                    for (let c = 0; c < cols; c++) {
                        const cellNode = $createTableCellNode(r === 0 ? 1 : 0); // Header for first row
                        const paragraph = $createParagraphNode();
                        cellNode.append(paragraph);
                        rowNode.append(cellNode);
                    }
                    tableNode.append(rowNode);
                }

                $insertNodes([tableNode, $createParagraphNode()]);
            });
        }

        /**
         * Show simple link dialog
         * @private
         */
        _showLinkDialog() {
            const url = prompt(_('Enter URL:'), 'https://');
            if (url) {
                this.editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
            }
        }

        /**
         * Bind events
         * @private
         */
        _bindEvents() {
            // Update button states on selection change
            this._cleanupFunctions = [];

            this._cleanupFunctions.push(
                this.editor.registerCommand(
                    SELECTION_CHANGE_COMMAND,
                    () => {
                        this._updateActiveStates();
                        return false;
                    },
                    COMMAND_PRIORITY_LOW
                )
            );

            // Close dropdowns on outside click
            this._documentClickHandler = (e) => {
                if (this._openDropdown && !this._openDropdown.contains(e.target)) {
                    this._closeDropdowns();
                }
            };
            document.addEventListener('click', this._documentClickHandler);
        }

        /**
         * Update active states of buttons
         * @private
         */
        _updateActiveStates() {
            if (this._destroyed) return;

            this.editor.getEditorState().read(() => {
                const selection = $getSelection();
                if (!$isRangeSelection(selection)) return;

                // Update format buttons
                const formats = ['bold', 'italic', 'underline', 'strikethrough', 'code', 'subscript', 'superscript'];
                for (const format of formats) {
                    const btnInfo = this.buttons.get(format);
                    if (btnInfo) {
                        const isActive = selection.hasFormat(format);
                        btnInfo.element.classList.toggle('tox-tbtn--enabled', isActive);
                        btnInfo.element.classList.toggle('active', isActive);
                    }
                }

                // Update block format selector
                const formatSelect = this.selects.get('format');
                if (formatSelect) {
                    const anchorNode = selection.anchor.getNode();
                    let blockType = 'paragraph';

                    // Check parent nodes for block type
                    let node = anchorNode;
                    while (node) {
                        if ($isHeadingNode(node)) {
                            blockType = node.getTag();
                            break;
                        }
                        node = node.getParent();
                    }

                    const option = BLOCK_FORMATS.find(f => f.value === blockType);
                    if (option) {
                        formatSelect.label.textContent = option.label;
                    }
                }

                // Update font size selector
                const fontSizeSelect = this.selects.get('fontSize');
                if (fontSizeSelect) {
                    const fontSize = $getSelectionStyleValueForProperty(selection, 'font-size', '');
                    const option = FONT_SIZES.find(f => f.value === fontSize);
                    fontSizeSelect.label.textContent = option ? option.label : _('Default');
                }
            });
        }

        /**
         * Destroy the toolbar
         */
        destroy() {
            if (this._destroyed) return;
            this._destroyed = true;

            // Cleanup event listeners
            if (this._cleanupFunctions) {
                for (const cleanup of this._cleanupFunctions) {
                    if (typeof cleanup === 'function') {
                        cleanup();
                    }
                }
            }

            if (this._documentClickHandler) {
                document.removeEventListener('click', this._documentClickHandler);
            }

            // Remove DOM
            if (this.wrapper) {
                this.wrapper.remove();
            }

            this.buttons.clear();
            this.selects.clear();

            Logger.log('[LexicalToolbar] Destroyed');
        }
    }

    // Export globally
    window.LexicalToolbar = LexicalToolbar;
})();
