// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class OdeTitleMenu {
    constructor() {
        this.odeTitleMenuHeadElement = document.querySelector(
            '#exe-title > .exe-title.content'
        );
        this.titleButton = document.querySelector('.title-menu-button');
        this.titleContainer = document.querySelector('#exe-title');

        // Yjs binding for real-time sync
        this.yjsBinding = null;
        this.metadataObserver = null;

        // Debounce timer for real-time title sync
        this.titleDebounceTimer = null;
        this.titleDebounceDelay = 300; // ms

        // Store raw title text (with LaTeX delimiters) for editing
        this.rawTitleText = '';

        const observer = new MutationObserver(this.onTitleChanged.bind(this));
        observer.observe(this.titleContainer, {
            childList: true,
            characterData: true,
            subtree: true,
        });
    }

    /**
     * Init element
     *
     */
    init() {
        this.setTitle();
        this.setChangeTitle();
        this.checkTitleLineCount();
        this.initYjsBinding();

        const resizeObserver = new ResizeObserver(() => {
            this.checkTitleLineCount();
        });
        resizeObserver.observe(this.odeTitleMenuHeadElement);
    }

    /**
     * Initialize Yjs binding for real-time title sync
     */
    initYjsBinding() {
        const project = eXeLearning.app.project;
        if (project._yjsBridge) {
            const documentManager = project._yjsBridge.getDocumentManager();
            if (documentManager) {
                const metadata = documentManager.getMetadata();

                // Load initial title from Yjs
                const initialTitle = metadata.get('title');
                if (initialTitle) {
                    this.rawTitleText = initialTitle;
                    this.odeTitleMenuHeadElement.textContent = initialTitle;
                    this.checkTitleLineCount();
                    this.typesetTitle();
                    Logger.log('[OdeTitleMenu] Loaded initial title from Yjs:', initialTitle);
                }

                // Observe metadata changes for remote title updates
                this.metadataObserver = (event) => {
                    // Only react to remote changes (not our own)
                    if (event.transaction.origin === 'user') return;

                    event.changes.keys.forEach((change, key) => {
                        if (key === 'title' && (change.action === 'add' || change.action === 'update')) {
                            this.onRemoteTitleChange(metadata.get('title'));
                        }
                    });
                };

                metadata.observe(this.metadataObserver);
                Logger.log('[OdeTitleMenu] Yjs title binding initialized');
            }
        }
    }

    /**
     * Handle remote title change from Yjs
     * @param {string} newTitle - The new title
     */
    onRemoteTitleChange(newTitle) {
        const title = newTitle || _('Untitled document');

        // Only update if we're not currently editing
        if (!this.titleContainer.classList.contains('title-editing')) {
            if (this.rawTitleText !== title) {
                this.rawTitleText = title;
                this.odeTitleMenuHeadElement.textContent = title;
                this.checkTitleLineCount();
                this.typesetTitle();
                Logger.log('[OdeTitleMenu] Remote title update:', title);
            }
        }

        // Also update the properties form if open
        this.updatePropertiesInput(title);
    }

    /**
     * Set title text to menu element
     * Reads from Yjs metadata directly
     */
    setTitle() {
        let odeTitleText = _('Untitled document');

        // Read title from Yjs metadata
        const project = eXeLearning.app.project;
        if (project?._yjsBridge) {
            const documentManager = project._yjsBridge.getDocumentManager();
            if (documentManager) {
                const metadata = documentManager.getMetadata();
                const title = metadata.get('title');
                if (title) {
                    odeTitleText = title;
                }
            }
        }

        // Store raw text for editing
        this.rawTitleText = odeTitleText;
        this.odeTitleMenuHeadElement.textContent = odeTitleText;
        this.checkTitleLineCount();

        // Render LaTeX if present
        this.typesetTitle();
    }

    /**
     * Render LaTeX in title using MathJax
     */
    typesetTitle() {
        const title = this.rawTitleText;
        if (title && /(?:\\\(|\\\[|\\begin\{)/.test(title)) {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                MathJax.typesetPromise([this.odeTitleMenuHeadElement]).catch(err => {
                    Logger.log('[OdeTitleMenu] MathJax typeset error:', err);
                });
            }
        }
    }

    setChangeTitle() {
        const title = this.odeTitleMenuHeadElement;
        let currentFinishEditing = null;
        let currentOnKeydown = null;
        let currentOnInput = null;
        let isEditing = false;

        this.titleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            title.click();
        });

        title.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;

            if (isEditing) return;
            isEditing = true;

            if (currentFinishEditing) {
                title.removeEventListener('blur', currentFinishEditing);
            }
            if (currentOnKeydown) {
                title.removeEventListener('keydown', currentOnKeydown);
            }
            if (currentOnInput) {
                title.removeEventListener('input', currentOnInput);
            }

            // Restore raw text (with LaTeX delimiters) for editing
            // This replaces the rendered MathJax SVG with the original text
            title.textContent = this.rawTitleText;

            title.setAttribute('contenteditable', 'true');
            this.attachPasteAsPlain(title);
            this.titleContainer.classList.add('title-editing');
            this.titleContainer.classList.remove('title-not-editing');
            this.titleContainer.classList.remove('one-line', 'two-lines');
            setTimeout(() => {
                this.placeCursorAtEnd(title);
            }, 0);
            const range = document.createRange();
            range.selectNodeContents(title);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            let finished = false;

            // Real-time sync on each keystroke with debouncing
            currentOnInput = () => {
                // Update raw text as user types
                this.rawTitleText = title.textContent;

                if (this.titleDebounceTimer) {
                    clearTimeout(this.titleDebounceTimer);
                }
                this.titleDebounceTimer = setTimeout(() => {
                    this.saveTitleToYjs(this.rawTitleText);
                    this.titleDebounceTimer = null;
                }, this.titleDebounceDelay);
            };

            currentFinishEditing = () => {
                if (finished) return;
                finished = true;

                // Clear debounce timer and save immediately
                if (this.titleDebounceTimer) {
                    clearTimeout(this.titleDebounceTimer);
                    this.titleDebounceTimer = null;
                }

                title.removeEventListener('blur', currentFinishEditing);
                title.removeEventListener('keydown', currentOnKeydown);
                title.removeEventListener('input', currentOnInput);

                title.removeAttribute('contenteditable');
                title.scrollTop = 0;
                this.titleContainer.classList.remove('title-editing');
                this.titleContainer.classList.add('title-not-editing');

                // Store raw text and save to Yjs
                this.rawTitleText = title.textContent;
                this.saveTitleToYjs(this.rawTitleText);
                this.checkTitleLineCount();

                // Re-render LaTeX after editing
                this.typesetTitle();

                isEditing = false;
                currentFinishEditing = null;
                currentOnKeydown = null;
                currentOnInput = null;

                if (title._onPastePlain) {
                    title.removeEventListener('paste', title._onPastePlain);
                    title.removeEventListener('drop', title._onDropPlain);
                    delete title._onPastePlain;
                    delete title._onDropPlain;
                }
            };

            currentOnKeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    currentFinishEditing();
                }
            };

            title.addEventListener('input', currentOnInput);
            title.addEventListener('blur', currentFinishEditing);
            title.addEventListener('keydown', currentOnKeydown);
        });
        eXeLearning.app.common.initTooltips(this.titleContainer);
    }

    /**
     * Save title to Yjs immediately (used for real-time sync)
     * @param {string} titleText - The title text
     */
    saveTitleToYjs(titleText) {
        const project = eXeLearning.app.project;
        if (project._yjsBridge) {
            const documentManager = project._yjsBridge.getDocumentManager();
            if (documentManager) {
                const metadata = documentManager.getMetadata();
                const ydoc = documentManager.getDoc();

                ydoc.transact(() => {
                    metadata.set('title', titleText);
                    metadata.set('modifiedAt', Date.now());
                }, ydoc.clientID);

                // Update form input if open (without events to avoid loops)
                this.updatePropertiesInput(titleText);
            }
        }
    }

    /**
     * Save title to Yjs metadata
     * @param {string} title - The new title
     * @returns {Promise<{responseMessage: string}>}
     */
    async saveTitle(title) {
        try {
            const project = eXeLearning.app.project;
            if (project._yjsBridge) {
                const documentManager = project._yjsBridge.getDocumentManager();
                if (documentManager) {
                    const metadata = documentManager.getMetadata();
                    const ydoc = documentManager.getDoc();

                    // Update Yjs in a transaction with clientID origin for undo support
                    ydoc.transact(() => {
                        metadata.set('title', title);
                        metadata.set('modifiedAt', Date.now());
                    }, ydoc.clientID);

                    Logger.log('[OdeTitleMenu] Saved title to Yjs:', title);

                    // Update the properties form if open
                    this.updatePropertiesInput(title);

                    return { responseMessage: 'OK' };
                }
            }

            return { responseMessage: 'ERROR', error: 'Yjs not available' };
        } catch (error) {
            console.error('Error in saveTitle:', error);
            throw error;
        }
    }

    checkTitleLineCount() {
        const title = this.odeTitleMenuHeadElement;
        const titleContainer = document.querySelector('#exe-title');
        if (!title || !titleContainer) {
            return;
        }
        if (!title.firstChild) {
            titleContainer.classList.remove('two-lines');
            titleContainer.classList.add('one-line');
            return;
        }
        const range = document.createRange();
        range.selectNodeContents(title);
        const lineRects = range.getClientRects();
        const lineCount = lineRects.length;
        titleContainer.classList.remove('one-line', 'two-lines');
        if (lineCount >= 2) {
            titleContainer.classList.add('two-lines');
        } else {
            titleContainer.classList.add('one-line');
        }
    }

    onTitleChanged(mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                this.checkTitleLineCount();
            }
        }
    }

    placeCursorAtEnd(el) {
        el.focus();

        const selection = window.getSelection();
        const range = document.createRange();

        if (el.childNodes.length > 0) {
            const lastNode = el.childNodes[el.childNodes.length - 1];
            if (lastNode.nodeType === Node.TEXT_NODE) {
                range.setStart(lastNode, lastNode.length);
            } else {
                range.selectNodeContents(el);
                range.collapse(false);
            }
        } else {
            range.selectNodeContents(el);
            range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);

        el.scrollTop = el.scrollHeight;
    }

    async getProjectProperties() {
        return eXeLearning.app.project.properties.load().then(() => {
            return eXeLearning.app.project.properties.properties;
        });
    }

    attachPasteAsPlain(el) {
        const onPaste = (e) => {
            e.preventDefault();
            const text =
                (e.clipboardData || window.clipboardData).getData(
                    'text/plain'
                ) || '';
            this.insertTextAtCursor(el, text);
        };

        const onDrop = (e) => {
            const hasHtml =
                e.dataTransfer && e.dataTransfer.getData('text/html');
            if (hasHtml) {
                e.preventDefault();
                const text = e.dataTransfer.getData('text/plain') || '';
                this.insertTextAtCursor(el, text);
            }
        };

        el.removeEventListener('paste', onPaste);
        el.removeEventListener('drop', onDrop);
        el.addEventListener('paste', onPaste);
        el.addEventListener('drop', onDrop);
        el._onPastePlain = onPaste;
        el._onDropPlain = onDrop;
    }

    insertTextAtCursor(el, text) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) {
            el.appendChild(document.createTextNode(text));
            return;
        }
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    /**
     * Update the properties form input visually (without triggering events)
     * This avoids feedback loops since Yjs already has the updated value
     * @param {string} title - The title to set
     */
    updatePropertiesInput(title) {
        const propertiesForm = document.querySelector(
            '#node-content #properties-node-content-form'
        );
        if (!propertiesForm || !propertiesForm.offsetParent) {
            return;
        }

        const titleInput = propertiesForm.querySelector(
            'input[data-testid="prop-pp_title"]'
        );

        if (titleInput) {
            // Only update the visual value, don't dispatch events
            // Events would cause a feedback loop with Yjs binding
            titleInput.value = title;
        }
    }
}
