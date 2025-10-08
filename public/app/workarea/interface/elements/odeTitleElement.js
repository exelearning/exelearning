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
        this.titleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            title.click();
        });
        title.addEventListener('click', () => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
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
            const finishEditing = () => {
                if (finished) return;
                finished = true;
                title.removeAttribute('contenteditable');
                title.scrollTop = 0;
                this.titleContainer.classList.remove('title-editing');
                this.titleContainer.classList.add('title-not-editing');
                this.saveTitle(title.textContent).then((response) => {
                    this.checkTitleLineCount();
                    title.removeEventListener('blur', finishEditing);
                    title.removeEventListener('keydown', onKeydown);
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
                });
                if (title._onPastePlain) {
                    title.removeEventListener('paste', title._onPastePlain);
                    title.removeEventListener('drop', title._onDropPlain);
                    delete title._onPastePlain;
                    delete title._onDropPlain;
                }
            };
            const onKeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    finishEditing();
                }
            };
            title.addEventListener('blur', finishEditing);
            title.addEventListener('keydown', onKeydown);
        });
        eXeLearning.app.common.initTooltips(this.titleContainer);
    }

    async saveTitle(title) {
        const properties = await this.getProjectProperties();
        const output = Object.keys(properties).reduce((acc, key) => {
            acc[key] =
                typeof properties[key] === 'object' &&
                'value' in properties[key]
                    ? properties[key].value
                    : properties[key];
            return acc;
        }, {});
        output.pp_title = title;
        return eXeLearning.app.project.properties.apiSaveProperties(
            output,
            false
        );
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
}
