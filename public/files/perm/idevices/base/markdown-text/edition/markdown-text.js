/* eslint-disable no-undef */
/**
 * Markdown Text iDevice
 *
 * Provides a GitHub-like Markdown editor with live preview.
 */
var $exeDevice = {
    // ::: i18n :::
    name: _('Markdown text'),
    textareaTitle: _('Markdown content'),
    infoTitle: _('Task information (optional)'),
    feedbackTitle: _('Feedback'),
    feedbackInputTitle: _('Button text'),
    infoDurationInputTitle: _('Estimated duration'),
    infoDurationTextInputTitle: _('Text to display'),
    infoParticipantsInputTitle: _('Participants'),
    infoParticipantsTextInputTitle: _('Text to display'),
    writeTabLabel: _('Write'),
    previewTabLabel: _('Preview'),

    // ::: Identifiers :::
    prefix: 'markdown',
    textareaId: 'markdownTextarea',
    feedbackId: 'markdownFeedback',
    feedbackInputId: 'markdownFeedbackInput',
    feedbackTextareaId: 'markdownFeedbackTextarea',
    infoId: 'markdownInfo',
    infoInputDurationId: 'markdownInfoDurationInput',
    infoInputDurationTextId: 'markdownInfoDurationTextInput',
    infoInputParticipantsId: 'markdownInfoParticipantsInput',
    infoInputParticipantsTextId: 'markdownInfoParticipantsTextInput',
    editorGroupId: 'markdownEditorGroup',
    htmlSuffix: 'Html',

    // ::: Default values :::
    feedbackInputValue: c_('Show Feedback'),
    feedbackInputInstructions: '',
    infoDurationInputValue: '',
    infoDurationInputPlaceholder: _('00:00'),
    infoDurationTextInputValue: _('Duration'),
    infoParticipantsInputValue: '',
    infoParticipantsInputPlaceholder: _('Number or description'),
    infoParticipantsTextInputValue: _('Grouping'),

    // ::: Runtime collections :::
    dataIds: [],
    markdownEditors: null,
    markdownConverter: null,

    /**
     * Initialize the iDevice editor
     *
     * @param {HTMLElement} element
     * @param {Object} previousData
     */
    init: function (element, previousData) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData || {};
        this.createForm();
    },

    /**
     * Save the current state and return the JSON payload.
     *
     * @returns {Object|boolean}
     */
    save: function () {
        this.dataIds = [];
        const dataElements = this.ideviceBody.querySelectorAll(
            `[id^="${this.prefix}"]`
        );

        dataElements.forEach((element) => {
            if (
                element.nodeName === 'TEXTAREA' ||
                element.nodeName === 'INPUT'
            ) {
                this.dataIds.push(element.id);
                this[element.id] = element.value;
            }
        });

        this.markdownEditors.forEach((editorState) => {
            this[editorState.htmlKey] = editorState.computeHtml();
        });

        if (this.checkFormValues()) {
            return this.getDataJson();
        }
        return false;
    },

    /**
     * Render the form and attach behaviors.
     */
    createForm: function () {
        let html = `<div id="markdownTextForm">`;
        html += this.createEditorGroup();
        html += `</div>`;

        this.ideviceBody.innerHTML = html;
        this.setBehaviour();
        this.loadPreviousValues();
        this.refreshMarkdownPreviews();
    },

    /**
     * Ensure mandatory fields contain data.
     *
     * @returns {boolean}
     */
    checkFormValues: function () {
        const content = this[this.textareaId]
            ? this[this.textareaId].trim()
            : '';
        if (content === '') {
            eXe.app.alert(_('Please write some text.'));
            return false;
        }
        return true;
    },

    /**
     * Build the JSON object that stores the idevice data.
     *
     * @returns {Object}
     */
    getDataJson: function () {
        const data = {};
        data.ideviceId = this.ideviceBody.getAttribute('idevice-id');

        this.dataIds.forEach((key) => {
            data[key] = this[key];
        });

        this.markdownEditors.forEach((editorState) => {
            data[editorState.htmlKey] = editorState.computeHtml();
        });

        return data;
    },

    /**
     * Restore values that were previously saved.
     */
    loadPreviousValues: function () {
        const isValid = (val) =>
            val != null && !(typeof val === 'string' && val.trim() === '');

        const data = this.idevicePreviousData || {};
        const defaults = {
            [this.infoInputDurationId]: this.infoDurationInputValue,
            [this.infoInputDurationTextId]: this.infoDurationTextInputValue,
            [this.infoInputParticipantsId]: this.infoParticipantsInputValue,
            [this.infoInputParticipantsTextId]:
                this.infoParticipantsTextInputValue,
            [this.feedbackInputId]: this.feedbackInputValue,
            [this.feedbackTextareaId]: this.feedbackInputInstructions,
        };

        const unionKeys = new Set([
            ...Object.keys(defaults),
            ...Object.keys(data),
        ]);

        unionKeys.forEach((key) => {
            if (!key || key === 'ideviceId') {
                return;
            }

            const element = this.ideviceBody.querySelector(`#${key}`);
            if (!element) {
                return;
            }

            const originalValue = data[key];
            const hasDefault = Object.prototype.hasOwnProperty.call(
                defaults,
                key
            );
            let finalValue = '';

            if (isValid(originalValue)) {
                finalValue = originalValue;
            } else if (hasDefault) {
                finalValue = defaults[key];
            }

            if (element.tagName === 'TEXTAREA') {
                element.value = finalValue;
            } else if (element.tagName === 'INPUT') {
                const useTranslation = isValid(originalValue);
                const displayValue = useTranslation
                    ? c_(finalValue)
                    : finalValue;
                element.setAttribute('value', displayValue);
                element.value = displayValue;
            }
        });
    },

    /**
     * Attach Markdown editor behaviors to the form.
     */
    setBehaviour: function () {
        this.markdownEditors = new Map();
        const containers = this.ideviceBody.querySelectorAll(
            '.exe-markdown-editor'
        );
        containers.forEach((container) => {
            this.setupMarkdownEditor(container);
        });
    },

    /**
     * Initialize a single Markdown editor widget.
     *
     * @param {HTMLElement} container
     */
    setupMarkdownEditor: function (container) {
        const textarea = container.querySelector('textarea');
        const preview = container.querySelector('.exe-markdown-preview');
        const writeTab = container.querySelector('[data-tab="write"]');
        const previewTab = container.querySelector('[data-tab="preview"]');

        if (!textarea || !preview || !writeTab || !previewTab) {
            return;
        }

        const editorState = {
            textarea,
            preview,
            writeTab,
            previewTab,
            htmlKey: `${textarea.id}${this.htmlSuffix}`,
            computeHtml: () => this.computeMarkdownHtml(textarea.value),
            refreshPreview: () => {
                preview.innerHTML = editorState.computeHtml();
            },
            showWrite: () => {
                textarea.hidden = false;
                preview.hidden = true;
                writeTab.classList.add('is-active');
                previewTab.classList.remove('is-active');
                writeTab.setAttribute('aria-selected', 'true');
                previewTab.setAttribute('aria-selected', 'false');
                textarea.focus();
            },
            showPreview: () => {
                editorState.refreshPreview();
                textarea.hidden = true;
                preview.hidden = false;
                previewTab.classList.add('is-active');
                writeTab.classList.remove('is-active');
                previewTab.setAttribute('aria-selected', 'true');
                writeTab.setAttribute('aria-selected', 'false');
            },
        };

        const handleTabClick = (event) => {
            event.preventDefault();
            const target = event.currentTarget.getAttribute('data-tab');
            if (target === 'write') {
                editorState.showWrite();
            } else {
                editorState.showPreview();
            }
        };

        writeTab.addEventListener('click', handleTabClick);
        previewTab.addEventListener('click', handleTabClick);

        textarea.addEventListener('input', () => {
            if (!preview.hidden) {
                editorState.refreshPreview();
            }
        });

        editorState.showWrite();
        this.markdownEditors.set(textarea.id, editorState);
    },

    /**
     * Force all previews to update so they match the latest textarea values.
     */
    refreshMarkdownPreviews: function () {
        if (!this.markdownEditors) {
            return;
        }
        this.markdownEditors.forEach((editorState) => {
            editorState.refreshPreview();
        });
    },

    /**
     * Convert Markdown into HTML using eXe helpers or Showdown.
     *
     * LaTeX delimiters are protected from Showdown so that subscripts,
     * line breaks and other backslash sequences inside formulas survive.
     *
     * @param {string} value
     * @returns {string}
     */
    computeMarkdownHtml: function (value) {
        const content = value || '';
        if (
            typeof eXe !== 'undefined' &&
            eXe.app &&
            eXe.app.common &&
            typeof eXe.app.common.markdownToHTML === 'function'
        ) {
            return eXe.app.common.markdownToHTML(content);
        }
        const converter = this.getMarkdownConverter();
        if (!converter) {
            return this.escapeHtml(content);
        }
        const stash = this.stashLatex(content);
        const html = converter.makeHtml(stash.text);
        return this.restoreLatex(html, stash.store);
    },

    stashLatex: function (text) {
        const store = [];
        const stash = function (match) {
            store.push(match);
            return 'EXELATEXBEGIN' + (store.length - 1) + 'EXELATEXEND';
        };
        let src = String(text == null ? '' : text);
        [
            /\\\[[\s\S]*?\\\]/g,
            /\$\$[\s\S]*?\$\$/g,
            /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g,
            /\\\([\s\S]*?\\\)/g,
        ].forEach(function (re) {
            src = src.replace(re, stash);
        });
        src = this.normalizeDollarMath(src, stash);
        return { text: src, store: store };
    },

    /**
     * Convert single-dollar inline math ($...$) into \(...\) and stash it.
     *
     * Mirror of eXe.app.common.markdownToHTML (app_common.js) for the
     * standalone Showdown fallback: the MathJax configuration used by
     * eXeLearning only enables \(...\) for inline math, and Showdown would
     * mangle underscores inside the formula before MathJax could see it
     * (#1990). Pandoc-style rules keep plain dollar amounts out of math
     * mode: the opening $ must be followed by a non-space character, the
     * closing $ must be preceded by a non-space character and must not be
     * followed by a digit, neither may be escaped, and the pair must sit on
     * a single line. Fenced code blocks and inline code spans are left
     * untouched.
     *
     * @param {string} src markdown source (LaTeX already stashed)
     * @param {function(string): string} stashFn stores a formula, returns its placeholder
     * @returns {string}
     */
    normalizeDollarMath: function (src, stashFn) {
        const fenceRe = /^\s{0,3}(?:`{3,}|~{3,})/;
        const codeSpanRe = /(`+)[\s\S]*?\1/g;
        // A formula is either a single character or first/last characters with
        // a lazy body; the last character may not be a backslash, so an escaped
        // \$ before the closing delimiter rejects the pair instead of producing
        // a formula that ends in a stray backslash (a MathJax TeX error).
        const dollarRe = /(^|[^\\$])\$([^\s$\\]|[^\s$][^$\n]*?[^\s$\\])\$(?!\d|\$)/g;
        const convert = function (text) {
            return text.replace(dollarRe, function (match, prefix, formula) {
                return prefix + stashFn('\\(' + formula + '\\)');
            });
        };
        let inFence = false;
        return String(src)
            .split('\n')
            .map(function (line) {
                if (fenceRe.test(line)) {
                    inFence = !inFence;
                    return line;
                }
                if (inFence || line.indexOf('$') === -1) {
                    return line;
                }
                let out = '';
                let last = 0;
                let m;
                codeSpanRe.lastIndex = 0;
                while ((m = codeSpanRe.exec(line)) !== null) {
                    out += convert(line.slice(last, m.index)) + m[0];
                    last = m.index + m[0].length;
                }
                return out + convert(line.slice(last));
            })
            .join('\n');
    },

    restoreLatex: function (html, store) {
        return String(html || '').replace(
            /EXELATEXBEGIN(\d+)EXELATEXEND/g,
            function (match, i) {
                const idx = Number(i);
                return store[idx] !== undefined ? store[idx] : match;
            }
        );
    },

    /**
     * Lazily instantiate a Showdown converter if needed.
     *
     * @returns {showdown.Converter|null}
     */
    getMarkdownConverter: function () {
        if (this.markdownConverter) {
            return this.markdownConverter;
        }
        if (typeof showdown === 'undefined') {
            return null;
        }
        this.markdownConverter = new showdown.Converter({
            noHeaderId: true,
            tables: true,
            tasklists: true,
            strikethrough: true,
            disableForced4SpacesIndentedSublists: true,
        });
        return this.markdownConverter;
    },

    /**
     * Escape HTML special characters in a string.
     *
     * @param {string} str
     * @returns {string}
     */
    escapeHtml: function (str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * Compose the editor group HTML with information and feedback sections.
     *
     * @returns {string}
     */
    createEditorGroup: function () {
        let infoContent = `<div>`;
        infoContent += this.createInputHTML(
            this.infoInputDurationId,
            this.infoDurationInputTitle,
            '',
            this.infoDurationInputValue,
            this.infoDurationInputPlaceholder
        );
        infoContent += this.createInputHTML(
            this.infoInputDurationTextId,
            this.infoDurationTextInputTitle,
            '',
            `${this.infoDurationTextInputValue}:`,
            ''
        );
        infoContent += `</div>`;
        infoContent += `<div>`;
        infoContent += this.createInputHTML(
            this.infoInputParticipantsId,
            this.infoParticipantsInputTitle,
            '',
            this.infoParticipantsInputValue,
            this.infoParticipantsInputPlaceholder
        );
        infoContent += this.createInputHTML(
            this.infoInputParticipantsTextId,
            this.infoParticipantsTextInputTitle,
            '',
            `${this.infoParticipantsTextInputValue}:`,
            ''
        );
        infoContent += `</div>`;
        const infoFieldset = this.createInformationFieldsetHTML(
            this.infoId,
            this.infoTitle,
            '',
            infoContent
        );

        let feedbackContent = this.createInputHTML(
            this.feedbackInputId,
            this.feedbackInputTitle,
            this.feedbackInputInstructions,
            this.feedbackInputValue
        );
        feedbackContent += this.createMarkdownEditorHTML(
            this.feedbackTextareaId
        );
        const feedbackFieldset = this.createFieldsetHTML(
            this.feedbackId,
            this.feedbackTitle,
            '',
            feedbackContent
        );

        let content = `<div class="exe-parent">${infoFieldset}</div>`;
        content += this.createMarkdownEditorHTML(
            this.textareaId,
            this.textareaTitle
        );
        content += `<div class="exe-parent">${feedbackFieldset}</div>`;

        let html = `<div id="${this.editorGroupId}_parent" class="exe-parent">`;
        html += content;
        html += `</div>`;

        return html;
    },

    /**
     * Markdown editor markup with tabs and preview pane.
     */
    createMarkdownEditorHTML: function (id, title) {
        const label = title || '';
        return `
      <div class="exe-field exe-text-field exe-markdown-editor">
        <div class="exe-markdown-editor__header">
          <label for="${id}">${label}</label>
        </div>
        <div class="exe-markdown-editor__tabs" role="tablist">
          <button type="button" class="exe-markdown-editor__tab is-active" data-tab="write" aria-selected="true">${this.writeTabLabel}</button>
          <button type="button" class="exe-markdown-editor__tab" data-tab="preview" aria-selected="false">${this.previewTabLabel}</button>
        </div>
        <div class="exe-markdown-editor__panels">
          <textarea id="${id}" class="exe-markdown-editor__textarea" aria-label="${label}"></textarea>
          <div class="exe-markdown-preview" hidden></div>
        </div>
      </div>`;
    },

    /**
     * Fieldset factory. Pass `wrapperClass = 'grid-container'` for the
     * info block layout, omit it for the generic single-column variant.
     */
    createFieldsetHTML: function (id, title, affix, content, wrapperClass) {
        const wrapper = wrapperClass ? ` class="${wrapperClass}"` : '';
        return `
      <fieldset id="${id}" class="exe-advanced exe-fieldset exe-fieldset-closed">
        <legend class="exe-text-legend">
          <a href="#">${title}${affix || ''}</a>
        </legend>
        <div${wrapper}>
          ${content}
        </div>
      </fieldset>`;
    },

    createInformationFieldsetHTML: function (id, title, affix, content) {
        return this.createFieldsetHTML(id, title, affix, content, 'grid-container');
    },

    /**
     * Plain text input generator.
     */
    createInputHTML: function (id, title, instructions, value, placeholder) {
        const instructionsSpan = instructions
            ? `<span class="exe-field-instructions">${instructions}</span>`
            : '';
        const placeholderAttrib = placeholder
            ? `placeholder="${this.escapeHtml(placeholder)}"`
            : '';
        return `
      <div class="exe-field exe-text-field">
        <label for="${id}">${title}:</label>
        <input type="text" value="${this.escapeHtml(value || '')}" ${placeholderAttrib} class="ideviceTextfield" name="${id}" id="${id}" onfocus="this.select()" />
        ${instructionsSpan}
      </div>`;
    },
};
