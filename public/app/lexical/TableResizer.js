/**
 * TableResizer - Visual column resize handles for tables in Lexical editor
 *
 * Adds draggable column borders for resizing table columns.
 * Based on common table resize implementations.
 */
(function () {
    'use strict';

    const {
        $getNodeByKey,
        $getSelection,
        $isTableNode,
        $isTableCellNode,
        $getTableNodeFromLexicalNodeOrThrow,
    } = window.LexicalBundle;

    const Logger = window.Logger || console;

    const MIN_COLUMN_WIDTH = 50;

    /**
     * TableResizer class
     * Manages column resize handles for a table
     */
    class TableResizer {
        /**
         * @param {LexicalEditor} editor - The native Lexical editor instance
         * @param {HTMLTableElement} tableElement - The table DOM element
         * @param {string} nodeKey - The Lexical table node key
         * @param {Function} onResizeEnd - Callback when resize completes
         */
        constructor(editor, tableElement, nodeKey, onResizeEnd) {
            this.editor = editor;
            this.tableElement = tableElement;
            this.nodeKey = nodeKey;
            this.onResizeEnd = onResizeEnd;

            this.resizeHandles = [];
            this.isResizing = false;
            this.startX = 0;
            this.columnIndex = -1;
            this.startWidths = [];
            this.overlay = null;

            this._boundPointerMove = this._handlePointerMove.bind(this);
            this._boundPointerUp = this._handlePointerUp.bind(this);

            this._init();
        }

        /**
         * Initialize resize handles
         * @private
         */
        _init() {
            // Get column count from first row
            const firstRow = this.tableElement.querySelector('tr');
            if (!firstRow) return;

            const cells = firstRow.querySelectorAll('th, td');
            const columnCount = cells.length;

            // Create resize handles for column borders (between columns)
            for (let i = 0; i < columnCount - 1; i++) {
                this._createResizeHandle(i);
            }

            // Position handles
            this._updateHandlePositions();

            // Watch for table size changes
            this._resizeObserver = new ResizeObserver(() => {
                this._updateHandlePositions();
            });
            this._resizeObserver.observe(this.tableElement);
        }

        /**
         * Create a resize handle for a column border
         * @private
         */
        _createResizeHandle(columnIndex) {
            const handle = document.createElement('div');
            handle.className = 'lexical-table-column-resize-handle';
            handle.style.cssText = `
                position: absolute;
                width: 5px;
                cursor: col-resize;
                background: transparent;
                z-index: 20;
                top: 0;
            `;
            handle.dataset.columnIndex = columnIndex;

            handle.addEventListener('pointerdown', (e) => this._handlePointerDown(columnIndex, e));
            handle.addEventListener('mouseenter', () => {
                if (!this.isResizing) {
                    handle.style.background = 'var(--lexical-accent-color, #006ce7)';
                }
            });
            handle.addEventListener('mouseleave', () => {
                if (!this.isResizing) {
                    handle.style.background = 'transparent';
                }
            });

            // Append to table's parent (needs relative positioning)
            const parent = this.tableElement.parentElement;
            if (parent) {
                const parentStyle = window.getComputedStyle(parent);
                if (parentStyle.position === 'static') {
                    parent.style.position = 'relative';
                }
                parent.appendChild(handle);
            }

            this.resizeHandles.push(handle);
        }

        /**
         * Update handle positions based on current column widths
         * @private
         */
        _updateHandlePositions() {
            const tableRect = this.tableElement.getBoundingClientRect();
            const parentRect = this.tableElement.parentElement?.getBoundingClientRect();
            if (!parentRect) return;

            const firstRow = this.tableElement.querySelector('tr');
            if (!firstRow) return;

            const cells = firstRow.querySelectorAll('th, td');
            let xOffset = this.tableElement.offsetLeft;

            for (let i = 0; i < this.resizeHandles.length; i++) {
                const cell = cells[i];
                if (!cell) continue;

                xOffset += cell.offsetWidth;
                const handle = this.resizeHandles[i];
                handle.style.left = `${xOffset - 2}px`;
                handle.style.top = `${this.tableElement.offsetTop}px`;
                handle.style.height = `${this.tableElement.offsetHeight}px`;
            }
        }

        /**
         * Handle pointer down on resize handle
         * @private
         */
        _handlePointerDown(columnIndex, event) {
            event.preventDefault();
            event.stopPropagation();

            this.isResizing = true;
            this.columnIndex = columnIndex;
            this.startX = event.clientX;

            // Store all current column widths
            const firstRow = this.tableElement.querySelector('tr');
            const cells = firstRow?.querySelectorAll('th, td');
            this.startWidths = [];

            if (cells) {
                cells.forEach((cell) => {
                    this.startWidths.push(cell.offsetWidth);
                });
            }

            // Create overlay to capture all mouse events
            this.overlay = document.createElement('div');
            this.overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9999;
                cursor: col-resize;
            `;
            document.body.appendChild(this.overlay);

            // Highlight active handle
            const handle = this.resizeHandles[columnIndex];
            if (handle) {
                handle.style.background = 'var(--lexical-accent-color, #006ce7)';
            }

            document.addEventListener('pointermove', this._boundPointerMove);
            document.addEventListener('pointerup', this._boundPointerUp);
        }

        /**
         * Handle pointer move during resize
         * @private
         */
        _handlePointerMove(event) {
            if (!this.isResizing) return;

            const deltaX = event.clientX - this.startX;

            // Calculate new widths for the two affected columns
            const leftWidth = Math.max(MIN_COLUMN_WIDTH, this.startWidths[this.columnIndex] + deltaX);
            const rightWidth = Math.max(
                MIN_COLUMN_WIDTH,
                this.startWidths[this.columnIndex + 1] - deltaX
            );

            // Apply widths to all cells in affected columns
            const rows = this.tableElement.querySelectorAll('tr');
            rows.forEach((row) => {
                const cells = row.querySelectorAll('th, td');
                if (cells[this.columnIndex]) {
                    cells[this.columnIndex].style.width = `${leftWidth}px`;
                }
                if (cells[this.columnIndex + 1]) {
                    cells[this.columnIndex + 1].style.width = `${rightWidth}px`;
                }
            });

            // Update handle positions
            this._updateHandlePositions();
        }

        /**
         * Handle pointer up - end resize
         * @private
         */
        _handlePointerUp(event) {
            if (!this.isResizing) return;

            this.isResizing = false;

            // Remove overlay
            if (this.overlay && this.overlay.parentElement) {
                this.overlay.parentElement.removeChild(this.overlay);
                this.overlay = null;
            }

            // Reset handle highlight
            const handle = this.resizeHandles[this.columnIndex];
            if (handle) {
                handle.style.background = 'transparent';
            }

            document.removeEventListener('pointermove', this._boundPointerMove);
            document.removeEventListener('pointerup', this._boundPointerUp);

            // Get final column widths
            const firstRow = this.tableElement.querySelector('tr');
            const cells = firstRow?.querySelectorAll('th, td');
            const columnWidths = [];

            if (cells) {
                cells.forEach((cell) => {
                    columnWidths.push(cell.offsetWidth);
                });
            }

            // Call callback with new widths
            if (this.onResizeEnd) {
                this.onResizeEnd(columnWidths);
            }

            this.columnIndex = -1;
        }

        /**
         * Destroy the resizer
         */
        destroy() {
            document.removeEventListener('pointermove', this._boundPointerMove);
            document.removeEventListener('pointerup', this._boundPointerUp);

            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
            }

            if (this.overlay && this.overlay.parentElement) {
                this.overlay.parentElement.removeChild(this.overlay);
            }

            for (const handle of this.resizeHandles) {
                if (handle.parentElement) {
                    handle.parentElement.removeChild(handle);
                }
            }

            this.resizeHandles = [];
            this.tableElement = null;
        }
    }

    /**
     * TableResizerPlugin - Manages table resize handles
     */
    class TableResizerPlugin {
        /**
         * @param {LexicalEditor} editor - The Lexical editor wrapper
         */
        constructor(editor) {
            this.editorWrapper = editor;
            this.editor = editor.getEditor();
            this.activeResizers = new Map(); // Map<tableElement, TableResizer>
            this._cleanupFunctions = [];
            this._mutationObserver = null;

            this._init();
        }

        /**
         * Initialize the plugin
         * @private
         */
        _init() {
            const rootElement = this.editor.getRootElement();
            if (!rootElement) return;

            // Set up mutation observer to detect new tables
            this._mutationObserver = new MutationObserver((mutations) => {
                this._checkForTables();
            });

            this._mutationObserver.observe(rootElement, {
                childList: true,
                subtree: true,
            });

            // Initial check
            this._checkForTables();

            // Clean up on editor state changes
            this._cleanupFunctions.push(
                this.editor.registerUpdateListener(() => {
                    // Re-check tables after DOM updates
                    requestAnimationFrame(() => {
                        this._checkForTables();
                    });
                })
            );
        }

        /**
         * Check for tables and add/remove resizers as needed
         * @private
         */
        _checkForTables() {
            const rootElement = this.editor.getRootElement();
            if (!rootElement) return;

            const tables = rootElement.querySelectorAll('table');
            const currentTables = new Set(tables);

            // Remove resizers for tables that no longer exist
            for (const [tableEl, resizer] of this.activeResizers) {
                if (!currentTables.has(tableEl)) {
                    resizer.destroy();
                    this.activeResizers.delete(tableEl);
                }
            }

            // Add resizers for new tables
            for (const table of tables) {
                if (!this.activeResizers.has(table)) {
                    this._addResizerForTable(table);
                }
            }
        }

        /**
         * Add a resizer for a table
         * @private
         */
        _addResizerForTable(tableElement) {
            // Find the node key from the parent decorator span
            const nodeKey = this._findNodeKeyForTable(tableElement);
            if (!nodeKey) {
                Logger.debug('[TableResizerPlugin] Could not find node key for table');
                return;
            }

            const resizer = new TableResizer(
                this.editor,
                tableElement,
                nodeKey,
                (columnWidths) => {
                    // The columnWidths array can be used to update the table node
                    // For now, the CSS widths are applied directly to DOM
                    Logger.debug('[TableResizerPlugin] Column widths updated:', columnWidths);
                }
            );

            this.activeResizers.set(tableElement, resizer);
        }

        /**
         * Find the Lexical node key for a table element
         * @private
         */
        _findNodeKeyForTable(tableElement) {
            // Look for data-lexical-key attribute
            if (tableElement.dataset.lexicalKey) {
                return tableElement.dataset.lexicalKey;
            }

            // Try parent decorator
            let parent = tableElement.parentElement;
            while (parent && !parent.dataset.lexicalDecoratorKey) {
                if (parent.classList.contains('lexical-editor-root')) break;
                parent = parent.parentElement;
            }

            if (parent && parent.dataset.lexicalDecoratorKey) {
                return parent.dataset.lexicalDecoratorKey;
            }

            // Search through editor state
            let foundKey = null;
            this.editor.getEditorState().read(() => {
                const nodeMap = this.editor.getEditorState()._nodeMap;
                for (const [key, node] of nodeMap) {
                    if ($isTableNode && $isTableNode(node)) {
                        foundKey = key;
                        break;
                    }
                }
            });

            return foundKey;
        }

        /**
         * Destroy the plugin
         */
        destroy() {
            if (this._mutationObserver) {
                this._mutationObserver.disconnect();
                this._mutationObserver = null;
            }

            for (const cleanup of this._cleanupFunctions) {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            }
            this._cleanupFunctions = [];

            for (const resizer of this.activeResizers.values()) {
                resizer.destroy();
            }
            this.activeResizers.clear();
        }
    }

    // Export globally
    window.TableResizer = TableResizer;
    window.TableResizerPlugin = TableResizerPlugin;
})();
