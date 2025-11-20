export default class OdeTitleMenu {
    constructor() {
        this.odeTitleMenuHeadElement = document.querySelector(
            '#exe-title > .exe-title.content'
        );
        this.titleButton = document.querySelector('.title-menu-button');
        this.titleContainer = document.querySelector('#exe-title');
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

        const resizeObserver = new ResizeObserver(() => {
            this.checkTitleLineCount();
        });
        resizeObserver.observe(this.odeTitleMenuHeadElement);
    }

    /**
     * Set title text to menu element
     *
     */
    setTitle() {
        let odeTitleProperty =
            eXeLearning.app.project.properties.properties.pp_title;
        let odeTitleText = odeTitleProperty.value
            ? odeTitleProperty.value
            : _('Untitled document');
        this.odeTitleMenuHeadElement.textContent = odeTitleText;
        //this.odeTitleMenuHeadElement.setAttribute('title', odeTitleText);
    }

    setChangeTitle() {
        const title = this.odeTitleMenuHeadElement;
        let currentFinishEditing = null;
        let currentOnKeydown = null;
        let isEditing = false;
        let isSaving = false;

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

            currentFinishEditing = () => {
                if (finished || isSaving) return;
                finished = true;
                isSaving = true;

                title.removeEventListener('blur', currentFinishEditing);
                title.removeEventListener('keydown', currentOnKeydown);

                title.removeAttribute('contenteditable');
                title.scrollTop = 0;
                this.titleContainer.classList.remove('title-editing');
                this.titleContainer.classList.add('title-not-editing');

                this.saveTitle(title.textContent)
                    .then((response) => {
                        this.checkTitleLineCount();
                        if (response.responseMessage === 'OK') {
                            let toastData = {
                                title: _('Project properties'),
                                body: _('Project properties saved.'),
                                icon: 'downloading',
                            };
                            let toast =
                                window.eXeLearning.app.toasts.createToast(
                                    toastData
                                );
                            setTimeout(() => {
                                toast.remove();
                            }, 1000);
                        }

                        isEditing = false;
                        isSaving = false;
                        currentFinishEditing = null;
                        currentOnKeydown = null;
                    })
                    .catch((error) => {
                        isEditing = false;
                        isSaving = false;
                        console.error('Error saving title:', error);
                    });

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

            title.addEventListener('blur', currentFinishEditing);
            title.addEventListener('keydown', currentOnKeydown);
        });
        eXeLearning.app.common.initTooltips(this.titleContainer);
    }

    async saveTitle(title) {
        let params = {
            odeSessionId: eXeLearning.app.project.odeSession,
            pp_title: title,
        };
        try {
            const response =
                await eXeLearning.app.api.putSaveOdeProperties(params);

            if (response.responseMessage === 'OK') {
                await eXeLearning.app.project.properties.apiLoadProperties();
                eXeLearning.app.project.properties.updateTitlePropertiesMenuTop();

                this.updatePropertiesInput(title);

                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    'root',
                    null,
                    null,
                    'EDIT'
                );
            }

            return response;
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
            titleInput.value = title;
            titleInput.dispatchEvent(new Event('change', { bubbles: true }));
            titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}
