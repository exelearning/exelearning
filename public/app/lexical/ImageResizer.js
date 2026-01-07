/**
 * ImageResizer - Visual resize handles for images in Lexical editor
 *
 * Adds 8-directional resize handles when an image is selected.
 * Based on the Lexical playground implementation.
 */
(function () {
    'use strict';

    const {
        $getNodeByKey,
        $getSelection,
        $isNodeSelection,
        CLICK_COMMAND,
        COMMAND_PRIORITY_LOW,
        KEY_BACKSPACE_COMMAND,
        KEY_DELETE_COMMAND,
        KEY_ESCAPE_COMMAND,
    } = window.LexicalBundle;

    const { $isImageNode } = window.LexicalNodes || {};

    const MIN_WIDTH = 50;
    const MIN_HEIGHT = 50;

    // Direction constants using bitwise flags
    const Direction = {
        east: 1 << 0,  // 1
        north: 1 << 1, // 2
        south: 1 << 2, // 4
        west: 1 << 3,  // 8
    };

    /**
     * Clamp a value between min and max
     */
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * ImageResizer class
     * Creates resize handles around an image element
     */
    class ImageResizer {
        /**
         * @param {LexicalEditor} editor - The Lexical editor instance
         * @param {HTMLImageElement} imageElement - The image DOM element
         * @param {string} nodeKey - The Lexical node key
         * @param {Function} onResizeEnd - Callback when resize completes
         */
        constructor(editor, imageElement, nodeKey, onResizeEnd) {
            this.editor = editor;
            this.imageElement = imageElement;
            this.nodeKey = nodeKey;
            this.onResizeEnd = onResizeEnd;

            this.wrapper = null;
            this.isResizing = false;
            this.startX = 0;
            this.startY = 0;
            this.startWidth = 0;
            this.startHeight = 0;
            this.ratio = 1;
            this.direction = 0;

            this._boundPointerMove = this._handlePointerMove.bind(this);
            this._boundPointerUp = this._handlePointerUp.bind(this);

            this._init();
        }

        /**
         * Initialize the resizer wrapper and handles
         * @private
         */
        _init() {
            // Create wrapper - positioned outside the editor to avoid Lexical DOM reconciliation
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'lexical-image-resizer-wrapper';

            // Find the editor container (parent of .lexical-editor-root)
            const editorRoot = this.imageElement.closest('.lexical-editor-root');
            if (!editorRoot) {
                console.warn('[ImageResizer] Could not find .lexical-editor-root');
                return;
            }

            // Use the editor container (parent of root) as the positioning context
            const editorContainer = editorRoot.parentElement;
            if (!editorContainer) {
                console.warn('[ImageResizer] Could not find editor container');
                return;
            }

            // Ensure the container has relative positioning
            const containerStyle = window.getComputedStyle(editorContainer);
            if (containerStyle.position === 'static') {
                editorContainer.style.position = 'relative';
            }

            // Calculate position relative to the editor container
            const containerRect = editorContainer.getBoundingClientRect();
            const imageRect = this.imageElement.getBoundingClientRect();

            const left = imageRect.left - containerRect.left;
            const top = imageRect.top - containerRect.top;

            this.wrapper.style.cssText = `
                position: absolute;
                left: ${left}px;
                top: ${top}px;
                width: ${imageRect.width}px;
                height: ${imageRect.height}px;
                pointer-events: none;
                z-index: 100;
                box-sizing: border-box;
            `;

            // Create 8 resize handles
            const handles = [
                { direction: Direction.north, className: 'n', cursor: 'n-resize' },
                { direction: Direction.north | Direction.east, className: 'ne', cursor: 'ne-resize' },
                { direction: Direction.east, className: 'e', cursor: 'e-resize' },
                { direction: Direction.south | Direction.east, className: 'se', cursor: 'se-resize' },
                { direction: Direction.south, className: 's', cursor: 's-resize' },
                { direction: Direction.south | Direction.west, className: 'sw', cursor: 'sw-resize' },
                { direction: Direction.west, className: 'w', cursor: 'w-resize' },
                { direction: Direction.north | Direction.west, className: 'nw', cursor: 'nw-resize' },
            ];

            for (const handle of handles) {
                const el = document.createElement('div');
                el.className = `lexical-image-resizer lexical-image-resizer-${handle.className}`;
                el.style.cursor = handle.cursor;
                el.style.pointerEvents = 'auto';
                el.dataset.direction = handle.direction;
                el.addEventListener('pointerdown', this._handlePointerDown.bind(this, handle.direction));
                this.wrapper.appendChild(el);
            }

            // Append wrapper to editor container (outside of lexical-editor-root)
            editorContainer.appendChild(this.wrapper);

            // Store reference to editorContainer for cleanup
            this._editorContainer = editorContainer;

            // Add selected class to image
            this.imageElement.classList.add('lexical-image-selected');
        }

        /**
         * Handle pointer down on a resize handle
         * @private
         */
        _handlePointerDown(direction, event) {
            event.preventDefault();
            event.stopPropagation();

            this.isResizing = true;
            this.direction = direction;
            this.startX = event.clientX;
            this.startY = event.clientY;
            this.startWidth = this.imageElement.offsetWidth;
            this.startHeight = this.imageElement.offsetHeight;
            this.ratio = this.startWidth / this.startHeight;

            this.wrapper.classList.add('lexical-image-resizer-wrapper--resizing');

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
            const deltaY = event.clientY - this.startY;

            let newWidth = this.startWidth;
            let newHeight = this.startHeight;

            const isHorizontal = this.direction & (Direction.east | Direction.west);
            const isVertical = this.direction & (Direction.north | Direction.south);

            // Calculate new dimensions based on direction
            if (isHorizontal && isVertical) {
                // Diagonal resize - maintain aspect ratio
                if (this.direction & Direction.east) {
                    newWidth = this.startWidth + deltaX;
                } else {
                    newWidth = this.startWidth - deltaX;
                }
                newHeight = newWidth / this.ratio;
            } else if (isHorizontal) {
                // Horizontal only
                if (this.direction & Direction.east) {
                    newWidth = this.startWidth + deltaX;
                } else {
                    newWidth = this.startWidth - deltaX;
                }
                newHeight = newWidth / this.ratio;
            } else if (isVertical) {
                // Vertical only
                if (this.direction & Direction.south) {
                    newHeight = this.startHeight + deltaY;
                } else {
                    newHeight = this.startHeight - deltaY;
                }
                newWidth = newHeight * this.ratio;
            }

            // Get max width from container
            const container = this.imageElement.closest('.lexical-editor-root') || this.imageElement.parentElement;
            const maxWidth = container.clientWidth - 40;

            // Clamp dimensions
            newWidth = clamp(Math.round(newWidth), MIN_WIDTH, maxWidth);
            newHeight = clamp(Math.round(newHeight), MIN_HEIGHT, maxWidth);

            // Update image and wrapper size
            this.imageElement.style.width = `${newWidth}px`;
            this.imageElement.style.height = 'auto';
            this.wrapper.style.width = `${newWidth}px`;
            this.wrapper.style.height = `${this.imageElement.offsetHeight}px`;
        }

        /**
         * Handle pointer up - end resize
         * @private
         */
        _handlePointerUp(event) {
            if (!this.isResizing) return;

            this.isResizing = false;
            this.wrapper.classList.remove('lexical-image-resizer-wrapper--resizing');

            document.removeEventListener('pointermove', this._boundPointerMove);
            document.removeEventListener('pointerup', this._boundPointerUp);

            // Get final dimensions
            const finalWidth = this.imageElement.offsetWidth;
            const finalHeight = this.imageElement.offsetHeight;

            // Call callback to update Lexical node
            if (this.onResizeEnd) {
                this.onResizeEnd(finalWidth, finalHeight);
            }
        }

        /**
         * Update wrapper position (call after image position changes)
         */
        updatePosition() {
            if (!this.wrapper || !this.imageElement || !this._editorContainer) return;

            const containerRect = this._editorContainer.getBoundingClientRect();
            const imageRect = this.imageElement.getBoundingClientRect();

            const left = imageRect.left - containerRect.left;
            const top = imageRect.top - containerRect.top;

            this.wrapper.style.left = `${left}px`;
            this.wrapper.style.top = `${top}px`;
            this.wrapper.style.width = `${imageRect.width}px`;
            this.wrapper.style.height = `${imageRect.height}px`;
        }

        /**
         * Destroy the resizer
         */
        destroy() {
            document.removeEventListener('pointermove', this._boundPointerMove);
            document.removeEventListener('pointerup', this._boundPointerUp);

            if (this.wrapper && this.wrapper.parentElement) {
                this.wrapper.parentElement.removeChild(this.wrapper);
            }

            if (this.imageElement) {
                this.imageElement.classList.remove('lexical-image-selected');
            }

            this.wrapper = null;
            this.imageElement = null;
        }
    }

    /**
     * ImageResizerPlugin - Manages image selection and resize handles
     */
    class ImageResizerPlugin {
        /**
         * @param {LexicalEditor} editor - The Lexical editor wrapper
         */
        constructor(editor) {
            this.editorWrapper = editor;
            this.editor = editor.getEditor();
            this.activeResizer = null;
            this.selectedNodeKey = null;
            this._cleanupFunctions = [];

            this._init();
        }

        /**
         * Initialize the plugin
         * @private
         */
        _init() {
            const rootElement = this.editor.getRootElement();
            if (!rootElement) return;

            // Handle clicks on images
            this._cleanupFunctions.push(
                this.editor.registerCommand(
                    CLICK_COMMAND,
                    (event) => {
                        const target = event.target;

                        // Check if clicked on an image
                        if (target.tagName === 'IMG' && target.closest('.lexical-editor-root')) {
                            this._selectImage(target, event);
                            return true;
                        }

                        // Click elsewhere - deselect
                        if (this.activeResizer) {
                            this._deselectImage();
                        }

                        return false;
                    },
                    COMMAND_PRIORITY_LOW
                )
            );

            // Handle delete/backspace on selected image
            this._cleanupFunctions.push(
                this.editor.registerCommand(
                    KEY_DELETE_COMMAND,
                    () => this._handleDelete(),
                    COMMAND_PRIORITY_LOW
                )
            );

            this._cleanupFunctions.push(
                this.editor.registerCommand(
                    KEY_BACKSPACE_COMMAND,
                    () => this._handleDelete(),
                    COMMAND_PRIORITY_LOW
                )
            );

            // Handle escape to deselect
            this._cleanupFunctions.push(
                this.editor.registerCommand(
                    KEY_ESCAPE_COMMAND,
                    () => {
                        if (this.activeResizer) {
                            this._deselectImage();
                            return true;
                        }
                        return false;
                    },
                    COMMAND_PRIORITY_LOW
                )
            );

            // Handle selection changes
            this._cleanupFunctions.push(
                this.editor.registerUpdateListener(({ editorState }) => {
                    editorState.read(() => {
                        const selection = $getSelection();
                        if (!$isNodeSelection(selection)) {
                            // Text selection - deselect image
                            if (this.activeResizer) {
                                this._deselectImage();
                            }
                        }
                    });
                })
            );
        }

        /**
         * Select an image and show resize handles
         * @private
         */
        _selectImage(imgElement, event) {
            // Deselect previous
            if (this.activeResizer) {
                this.activeResizer.destroy();
            }

            // Find the node key from data attribute or traverse
            const nodeKey = imgElement.getAttribute('data-lexical-key') || this._findNodeKeyForImage(imgElement);
            if (!nodeKey) return;

            this.selectedNodeKey = nodeKey;

            // Create resizer
            this.activeResizer = new ImageResizer(
                this.editor,
                imgElement,
                nodeKey,
                (width, height) => {
                    this._updateImageNode(nodeKey, width, height);
                }
            );
        }

        /**
         * Find the Lexical node key for an image element
         * @private
         */
        _findNodeKeyForImage(imgElement) {
            // Try to find from parent span with data-lexical-decorator
            let parent = imgElement.parentElement;
            while (parent && !parent.dataset.lexicalDecoratorKey) {
                parent = parent.parentElement;
                if (parent && parent.classList.contains('lexical-editor-root')) {
                    break;
                }
            }

            if (parent && parent.dataset.lexicalDecoratorKey) {
                return parent.dataset.lexicalDecoratorKey;
            }

            // Search through editor state
            let foundKey = null;
            this.editor.getEditorState().read(() => {
                const root = this.editor.getEditorState()._nodeMap;
                for (const [key, node] of root) {
                    if ($isImageNode && $isImageNode(node)) {
                        // Compare src
                        if (node.__src === imgElement.src ||
                            node.__src === imgElement.getAttribute('data-asset-src')) {
                            foundKey = key;
                            break;
                        }
                    }
                }
            });

            return foundKey;
        }

        /**
         * Update the Lexical ImageNode dimensions
         * @private
         */
        _updateImageNode(nodeKey, width, height) {
            this.editor.update(() => {
                const node = $getNodeByKey(nodeKey);
                if (node && typeof node.setWidthAndHeight === 'function') {
                    node.setWidthAndHeight(width, height);
                } else if (node) {
                    // Fallback: update properties directly
                    if (node.__width !== undefined) {
                        node.__width = width;
                    }
                    if (node.__height !== undefined) {
                        node.__height = height;
                    }
                }
            });
        }

        /**
         * Deselect the current image
         * @private
         */
        _deselectImage() {
            if (this.activeResizer) {
                this.activeResizer.destroy();
                this.activeResizer = null;
            }
            this.selectedNodeKey = null;
        }

        /**
         * Handle delete key on selected image
         * @private
         */
        _handleDelete() {
            if (!this.selectedNodeKey) return false;

            this.editor.update(() => {
                const node = $getNodeByKey(this.selectedNodeKey);
                if (node) {
                    node.remove();
                }
            });

            this._deselectImage();
            return true;
        }

        /**
         * Destroy the plugin
         */
        destroy() {
            for (const cleanup of this._cleanupFunctions) {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            }
            this._cleanupFunctions = [];

            if (this.activeResizer) {
                this.activeResizer.destroy();
                this.activeResizer = null;
            }
        }
    }

    // Export globally
    window.ImageResizer = ImageResizer;
    window.ImageResizerPlugin = ImageResizerPlugin;
})();
