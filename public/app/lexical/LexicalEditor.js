/**
 * Lexical Editor Wrapper
 *
 * High-level wrapper class for Lexical editor instances.
 * Handles initialization, plugin management, and common operations.
 */
(function () {
    'use strict';

    const {
        createEditor,
        $getRoot,
        $getSelection,
        $isRangeSelection,
        $createParagraphNode,
        $createTextNode,
        $insertNodes,
        $selectAll,
        ParagraphNode,
        TextNode,
        LineBreakNode,
        COMMAND_PRIORITY_LOW,
        COMMAND_PRIORITY_NORMAL,
        KEY_ENTER_COMMAND,
        KEY_TAB_COMMAND,
        FORMAT_TEXT_COMMAND,
        FORMAT_ELEMENT_COMMAND,
        UNDO_COMMAND,
        REDO_COMMAND,
        CAN_UNDO_COMMAND,
        CAN_REDO_COMMAND,
        // Rich text
        registerRichText,
        HeadingNode,
        QuoteNode,
        // History
        registerHistory,
        createEmptyHistoryState,
        // List
        registerList,
        ListNode,
        ListItemNode,
        // Table
        registerTablePlugin,
        TableNode,
        TableRowNode,
        TableCellNode,
        // Link
        LinkNode,
        AutoLinkNode,
        // Code
        CodeNode,
        CodeHighlightNode,
        // HTML
        $generateHtmlFromNodes,
        $generateNodesFromDOM,
        // Utils
        mergeRegister,
    } = window.LexicalBundle;

    const Logger = window.Logger || console;

    // Get custom nodes
    const { getCustomNodes, $createImageNode } = window.LexicalNodes || {};

    /**
     * Editor theme configuration (matches TinyMCE styling)
     */
    const editorTheme = {
        paragraph: 'lexical-paragraph',
        heading: {
            h1: 'lexical-h1',
            h2: 'lexical-h2',
            h3: 'lexical-h3',
            h4: 'lexical-h4',
            h5: 'lexical-h5',
            h6: 'lexical-h6',
        },
        text: {
            bold: 'lexical-bold',
            italic: 'lexical-italic',
            underline: 'lexical-underline',
            strikethrough: 'lexical-strikethrough',
            code: 'lexical-code',
            subscript: 'lexical-subscript',
            superscript: 'lexical-superscript',
        },
        list: {
            ul: 'lexical-ul',
            ol: 'lexical-ol',
            listitem: 'lexical-listitem',
            nested: {
                listitem: 'lexical-nested-listitem',
            },
        },
        link: 'lexical-link',
        quote: 'lexical-quote',
        code: 'lexical-code-block',
        codeHighlight: {
            atrule: 'lexical-tokenAttr',
            attr: 'lexical-tokenAttr',
            boolean: 'lexical-tokenProperty',
            builtin: 'lexical-tokenSelector',
            cdata: 'lexical-tokenComment',
            char: 'lexical-tokenSelector',
            class: 'lexical-tokenFunction',
            'class-name': 'lexical-tokenFunction',
            comment: 'lexical-tokenComment',
            constant: 'lexical-tokenProperty',
            deleted: 'lexical-tokenProperty',
            doctype: 'lexical-tokenComment',
            entity: 'lexical-tokenOperator',
            function: 'lexical-tokenFunction',
            important: 'lexical-tokenVariable',
            inserted: 'lexical-tokenSelector',
            keyword: 'lexical-tokenAttr',
            namespace: 'lexical-tokenVariable',
            number: 'lexical-tokenProperty',
            operator: 'lexical-tokenOperator',
            prolog: 'lexical-tokenComment',
            property: 'lexical-tokenProperty',
            punctuation: 'lexical-tokenPunctuation',
            regex: 'lexical-tokenVariable',
            selector: 'lexical-tokenSelector',
            string: 'lexical-tokenSelector',
            symbol: 'lexical-tokenProperty',
            tag: 'lexical-tokenProperty',
            url: 'lexical-tokenOperator',
            variable: 'lexical-tokenVariable',
        },
        table: 'lexical-table',
        tableCell: 'lexical-table-cell',
        tableCellHeader: 'lexical-table-cell-header',
        tableRow: 'lexical-table-row',
    };

    /**
     * Get all node classes for editor registration
     */
    function getAllNodes() {
        const nodes = [
            HeadingNode,
            QuoteNode,
            ListNode,
            ListItemNode,
            TableNode,
            TableRowNode,
            TableCellNode,
            LinkNode,
            AutoLinkNode,
            CodeNode,
            CodeHighlightNode,
        ];

        // Add custom nodes if available
        if (getCustomNodes) {
            nodes.push(...getCustomNodes());
        }

        return nodes;
    }

    /**
     * LexicalEditor class
     */
    class LexicalEditor {
        /**
         * @param {Object} options
         * @param {HTMLElement} options.container - Container element for the editor
         * @param {string} [options.content=''] - Initial HTML content
         * @param {string} [options.placeholder=''] - Placeholder text
         * @param {Function} [options.onUpdate] - Callback when content changes
         * @param {Function} [options.onSelectionChange] - Callback when selection changes
         * @param {boolean} [options.editable=true] - Whether the editor is editable
         */
        constructor(options = {}) {
            this.container = options.container;
            this.onUpdate = options.onUpdate || null;
            this.onSelectionChange = options.onSelectionChange || null;
            this._destroyed = false;
            this._cleanupFunctions = [];
            this._placeholder = options.placeholder || '';

            if (!this.container) {
                throw new Error('LexicalEditor: container is required');
            }

            // Create editor root element
            this._editorRoot = document.createElement('div');
            this._editorRoot.className = 'lexical-editor-root';
            this._editorRoot.contentEditable = options.editable !== false ? 'true' : 'false';
            this.container.appendChild(this._editorRoot);

            // Create placeholder element
            if (this._placeholder) {
                this._placeholderEl = document.createElement('div');
                this._placeholderEl.className = 'lexical-placeholder';
                this._placeholderEl.textContent = this._placeholder;
                this.container.appendChild(this._placeholderEl);
            }

            // Create editor instance
            this.editor = createEditor({
                namespace: 'LexicalEditor',
                theme: editorTheme,
                nodes: getAllNodes(),
                onError: (error) => {
                    Logger.error('[LexicalEditor] Error:', error);
                },
                editable: options.editable !== false,
            });

            // Set root element
            this.editor.setRootElement(this._editorRoot);

            // Register plugins
            this._registerPlugins();

            // Set initial content
            if (options.content) {
                this.setHTML(options.content);
            }

            // Register update listener
            this._cleanupFunctions.push(
                this.editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
                    if (this._destroyed) return;

                    // Update placeholder visibility
                    this._updatePlaceholder();

                    // Call onUpdate callback
                    if (this.onUpdate && (dirtyElements.size > 0 || dirtyLeaves.size > 0)) {
                        this.onUpdate(this.getHTML());
                    }
                })
            );

            // Register selection listener
            if (this.onSelectionChange) {
                this._cleanupFunctions.push(
                    this.editor.registerCommand(
                        window.LexicalBundle.SELECTION_CHANGE_COMMAND,
                        () => {
                            if (this._destroyed) return false;
                            this.editor.getEditorState().read(() => {
                                const selection = $getSelection();
                                this.onSelectionChange(selection);
                            });
                            return false;
                        },
                        COMMAND_PRIORITY_LOW
                    )
                );
            }

            Logger.log('[LexicalEditor] Initialized');
        }

        /**
         * Register editor plugins
         * @private
         */
        _registerPlugins() {
            // Rich text plugin
            this._cleanupFunctions.push(registerRichText(this.editor));

            // History plugin
            this._cleanupFunctions.push(
                registerHistory(this.editor, createEmptyHistoryState(), 1000)
            );

            // List plugin
            this._cleanupFunctions.push(registerList(this.editor));

            // Table plugin
            this._cleanupFunctions.push(registerTablePlugin(this.editor));

            // Image resizer plugin (if available)
            if (window.ImageResizerPlugin) {
                this._imageResizerPlugin = new window.ImageResizerPlugin(this);
                this._cleanupFunctions.push(() => {
                    if (this._imageResizerPlugin) {
                        this._imageResizerPlugin.destroy();
                        this._imageResizerPlugin = null;
                    }
                });
            }

            // Table resizer plugin (if available)
            if (window.TableResizerPlugin) {
                this._tableResizerPlugin = new window.TableResizerPlugin(this);
                this._cleanupFunctions.push(() => {
                    if (this._tableResizerPlugin) {
                        this._tableResizerPlugin.destroy();
                        this._tableResizerPlugin = null;
                    }
                });
            }
        }

        /**
         * Update placeholder visibility
         * @private
         */
        _updatePlaceholder() {
            if (!this._placeholderEl) return;

            this.editor.getEditorState().read(() => {
                const root = $getRoot();
                const isEmpty =
                    root.getChildrenSize() === 1 &&
                    root.getFirstChild()?.getType() === 'paragraph' &&
                    root.getFirstChild()?.getTextContentSize() === 0;

                this._placeholderEl.style.display = isEmpty ? 'block' : 'none';
            });
        }

        /**
         * Get HTML content
         * @returns {string}
         */
        getHTML() {
            let html = '';
            this.editor.getEditorState().read(() => {
                html = $generateHtmlFromNodes(this.editor, null);
            });
            return html;
        }

        /**
         * Set HTML content
         * @param {string} html
         */
        setHTML(html) {
            this.editor.update(() => {
                const root = $getRoot();
                root.clear();

                if (!html || html.trim() === '') {
                    root.append($createParagraphNode());
                    return;
                }

                const parser = new DOMParser();
                const dom = parser.parseFromString(html, 'text/html');
                const nodes = $generateNodesFromDOM(this.editor, dom);

                if (nodes.length === 0) {
                    root.append($createParagraphNode());
                } else {
                    root.append(...nodes);
                }
            });
        }

        /**
         * Get plain text content
         * @returns {string}
         */
        getText() {
            let text = '';
            this.editor.getEditorState().read(() => {
                text = $getRoot().getTextContent();
            });
            return text;
        }

        /**
         * Check if editor is empty
         * @returns {boolean}
         */
        isEmpty() {
            let empty = true;
            this.editor.getEditorState().read(() => {
                const root = $getRoot();
                empty =
                    root.getChildrenSize() === 1 &&
                    root.getFirstChild()?.getType() === 'paragraph' &&
                    root.getFirstChild()?.getTextContentSize() === 0;
            });
            return empty;
        }

        /**
         * Focus the editor
         */
        focus() {
            this.editor.focus();
        }

        /**
         * Blur the editor
         */
        blur() {
            this._editorRoot.blur();
        }

        /**
         * Set editable state
         * @param {boolean} editable
         */
        setEditable(editable) {
            this.editor.setEditable(editable);
            this._editorRoot.contentEditable = editable ? 'true' : 'false';
        }

        /**
         * Check if editor is editable
         * @returns {boolean}
         */
        isEditable() {
            return this.editor.isEditable();
        }

        /**
         * Get the current selection
         * @returns {Selection|null}
         */
        getSelection() {
            let selection = null;
            this.editor.getEditorState().read(() => {
                selection = $getSelection();
            });
            return selection;
        }

        /**
         * Execute a format command
         * @param {string} format - Format type (bold, italic, underline, etc.)
         */
        formatText(format) {
            this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
        }

        /**
         * Execute an element format command
         * @param {string} format - Format type (left, center, right, justify)
         */
        formatElement(format) {
            this.editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
        }

        /**
         * Undo
         */
        undo() {
            this.editor.dispatchCommand(UNDO_COMMAND, undefined);
        }

        /**
         * Redo
         */
        redo() {
            this.editor.dispatchCommand(REDO_COMMAND, undefined);
        }

        /**
         * Check if can undo
         * @returns {boolean}
         */
        canUndo() {
            // This would require tracking history state
            return true;
        }

        /**
         * Check if can redo
         * @returns {boolean}
         */
        canRedo() {
            // This would require tracking history state
            return true;
        }

        /**
         * Insert text at cursor position
         * @param {string} text
         */
        insertText(text) {
            this.editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    selection.insertText(text);
                }
            });
        }

        /**
         * Insert a node at cursor position
         * @param {LexicalNode} node
         */
        insertNode(node) {
            this.editor.update(() => {
                $insertNodes([node]);
            });
        }

        /**
         * Insert an image
         * @param {Object} attrs - Image attributes (src, altText, title, etc.)
         */
        insertImage(attrs) {
            if (!$createImageNode) {
                Logger.error('[LexicalEditor] LexicalNodes not loaded');
                return;
            }

            this.editor.update(() => {
                const imageNode = $createImageNode({
                    src: attrs.src,
                    altText: attrs.alt || attrs.altText || '',
                    title: attrs.title,
                    width: attrs.width,
                    height: attrs.height,
                    dataAssetSrc: attrs['data-asset-src'] || attrs.dataAssetSrc,
                    dataAssetId: attrs['data-asset-id'] || attrs.dataAssetId,
                    className: attrs.class || attrs.className,
                });
                $insertNodes([imageNode]);
            });
        }

        /**
         * Select all content
         */
        selectAll() {
            this.editor.update(() => {
                $selectAll();
            });
        }

        /**
         * Get the native Lexical editor instance
         * @returns {LexicalEditor}
         */
        getEditor() {
            return this.editor;
        }

        /**
         * Register a command handler
         * @param {LexicalCommand} command
         * @param {Function} handler
         * @param {number} priority
         * @returns {Function} Cleanup function
         */
        registerCommand(command, handler, priority = COMMAND_PRIORITY_LOW) {
            return this.editor.registerCommand(command, handler, priority);
        }

        /**
         * Register an update listener
         * @param {Function} listener
         * @returns {Function} Cleanup function
         */
        registerUpdateListener(listener) {
            return this.editor.registerUpdateListener(listener);
        }

        /**
         * Execute an update
         * @param {Function} updateFn
         */
        update(updateFn) {
            this.editor.update(updateFn);
        }

        /**
         * Read the current state
         * @param {Function} readFn
         */
        read(readFn) {
            this.editor.getEditorState().read(readFn);
        }

        /**
         * Check if the editor has been destroyed
         * @returns {boolean}
         */
        isDestroyed() {
            return this._destroyed;
        }

        /**
         * Destroy the editor
         */
        destroy() {
            if (this._destroyed) return;

            this._destroyed = true;

            // Run cleanup functions
            for (const cleanup of this._cleanupFunctions) {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            }
            this._cleanupFunctions = [];

            // Clear root element
            this.editor.setRootElement(null);

            // Clear container
            this.container.innerHTML = '';

            Logger.log('[LexicalEditor] Destroyed');
        }
    }

    // Export globally
    window.LexicalEditor = LexicalEditor;
})();
