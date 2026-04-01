/**
 * Form iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: SDWEB - Innovative Digital Solutions
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // ::: i18n :::
    // We use eXe's _function
    // iDevice name
    name: _('Text'),
    // Text area
    textareaTitle: _('Text'),
    // Fieldsets
    infoTitle: _('Task information'),
    feedbackTitle: _('Feedback'),
    // Inputs
    feedbakInputTitle: _('Button text'),
    infoDurationInputTitle: _('Estimated duration'),
    infoDurationTextInputTitle: _('Text to display'),
    infoParticipantsInputTitle: _('Participants'),
    infoParticipantsTextInputTitle: _('Text to display'),

    // ::: Identifiers of the fields used in the idevice :::
    textareaId: 'textTextarea',
    feedbackId: 'textFeedback',
    feedbakInputId: 'textFeedbackInput',
    feedbackTextareaId: 'textFeedbackTextarea',
    infoId: 'textInfo',
    infoInputDurationId: 'textInfoDurationInput',
    infoInputDurationTextId: 'textInfoDurationTextInput',
    infoInputParticipantsId: 'textInfoParticipantsInput',
    infoInputParticipantsTextId: 'textInfoParticipantsTextInput',
    editorGroupId: 'textEditorGroup',

    // ::: iDevice default data :::
    // Feedback
    feedbakInputValue: c_('Show Feedback'),
    feedbakInputInstructions: '',
    // Task information
    infoDurationInputValue: '',
    infoDurationInputPlaceholder: _('00:00'),
    infoDurationTextInputValue: _('Duration'),
    infoParticipantsInputValue: '',
    infoParticipantsInputPlaceholder: _('Number or description'),
    infoParticipantsTextInputValue: _('Grouping'),

    // ::: List of elements to save :::
    dataIds: [],

    /**
     * Extract task information (duration, participants, feedback) from HTML content
     * Used when loading legacy PBL Task content that has embedded task info
     * Also handles simple feedback format without exe-text-activity wrapper
     *
     * @param {string} html - HTML content that may contain exe-text-activity structure or simple feedback
     * @returns {Object} Extracted values or null if no task info/feedback found
     */
    extractTaskInfoFromHtml: function (html) {
        if (!html) {
            return null;
        }

        // Check if we have exe-text-activity structure OR simple feedback structure.
        // Use structural markers (js-feedback + iDevice_buttons) instead of button class names
        // so both legacy eXe 2.9 (feedbackbutton) and modern (feedbacktooglebutton) formats are detected.
        const hasActivityStructure = html.includes('exe-text-activity');
        const hasSimpleFeedback = html.includes('js-feedback') && html.includes('iDevice_buttons');

        if (!hasActivityStructure && !hasSimpleFeedback) {
            return null;
        }

        const result = {};
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Extract from dl structure (only in exe-text-activity format)
        if (hasActivityStructure) {
            const dlElement = tempDiv.querySelector('dl');
            if (dlElement) {
                const inlineDivs = dlElement.querySelectorAll('div.inline');
                if (inlineDivs.length >= 1) {
                    // First inline div: duration
                    const dt1 = inlineDivs[0].querySelector('dt');
                    const dd1 = inlineDivs[0].querySelector('dd');
                    if (dt1) result[this.infoInputDurationTextId] = dt1.textContent?.trim() || '';
                    if (dd1) result[this.infoInputDurationId] = dd1.textContent?.trim() || '';
                }
                if (inlineDivs.length >= 2) {
                    // Second inline div: participants
                    const dt2 = inlineDivs[1].querySelector('dt');
                    const dd2 = inlineDivs[1].querySelector('dd');
                    if (dt2) result[this.infoInputParticipantsTextId] = dt2.textContent?.trim() || '';
                    if (dd2) result[this.infoInputParticipantsId] = dd2.textContent?.trim() || '';
                }
            }
        }

        // Extract feedback button text — try both modern (feedbacktooglebutton) and
        // legacy eXe 2.9 (feedbackbutton) class names, plus any other combined variants.
        const feedbackButton = tempDiv.querySelector('.feedbacktooglebutton, .feedbackbutton');
        if (feedbackButton) {
            result[this.feedbakInputId] = feedbackButton.value || feedbackButton.getAttribute('value') || '';
        }

        // Extract feedback content - try multiple selectors for different formats
        let feedbackDiv = tempDiv.querySelector('.feedback.js-feedback');
        if (!feedbackDiv) {
            // Try just .feedback class
            feedbackDiv = tempDiv.querySelector('div.feedback');
        }
        if (feedbackDiv) {
            result[this.feedbackTextareaId] = feedbackDiv.innerHTML?.trim() || '';
        }

        // Extract main content (everything except dl and feedback)
        if (hasActivityStructure) {
            // Clone and remove dl and feedback elements from exe-text-activity
            const contentDiv = tempDiv.querySelector('.exe-text-activity');
            if (contentDiv) {
                const clone = contentDiv.cloneNode(true);
                const toRemove = clone.querySelectorAll('dl, .iDevice_buttons, .feedback');
                toRemove.forEach(el => el.remove());
                result[this.textareaId] = clone.innerHTML?.trim() || '';
            }
        } else if (hasSimpleFeedback) {
            // For simple feedback format, clone tempDiv and remove feedback elements
            const clone = tempDiv.cloneNode(true);
            const toRemove = clone.querySelectorAll('.iDevice_buttons, .feedback');
            toRemove.forEach(el => el.remove());
            result[this.textareaId] = clone.innerHTML?.trim() || '';
        }

        return Object.keys(result).length > 0 ? result : null;
    },

    /**
     * Build HTML content with task information structure
     * Reconstructs the exe-text-activity structure for saving
     *
     * @returns {string} HTML with task info structure or just content if no task info
     */
    buildTextareaHtml: function () {
        const durationValue = this[this.infoInputDurationId] || '';
        const durationLabel = this[this.infoInputDurationTextId] || '';
        const participantsValue = this[this.infoInputParticipantsId] || '';
        const participantsLabel = this[this.infoInputParticipantsTextId] || '';
        const feedbackButton = this[this.feedbakInputId] || '';
        const feedbackContent = this[this.feedbackTextareaId] || '';
        const mainContent = this[this.textareaId] || '';

        // Check if we have any task info to include
        const hasTaskInfo = durationValue || participantsValue;
        const hasFeedback = feedbackButton && feedbackContent;

        // If no task info and no feedback, return just the content
        if (!hasTaskInfo && !hasFeedback) {
            return mainContent;
        }

        // Build the exe-text-activity structure
        let html = '';

        // Add duration/participants dl if we have values
        if (hasTaskInfo) {
            html += '<dl>';
            html += `<div class="inline"><dt><span title="${this.escapeHtmlAttr(durationLabel)}">${this.escapeHtml(durationLabel)}</span></dt>`;
            html += `<dd>${this.escapeHtml(durationValue)}</dd></div>`;
            html += `<div class="inline"><dt><span title="${this.escapeHtmlAttr(participantsLabel)}">${this.escapeHtml(participantsLabel)}</span></dt>`;
            html += `<dd>${this.escapeHtml(participantsValue)}</dd></div>`;
            html += '</dl>';
        }

        // Add main content
        html += mainContent;

        // Add feedback if present
        if (hasFeedback) {
            html += '<div class="iDevice_buttons feedback-button js-required">';
            html += `<input type="button" class="feedbacktooglebutton" value="${this.escapeHtmlAttr(feedbackButton)}" `;
            html += `data-text-a="${this.escapeHtmlAttr(feedbackButton)}" data-text-b="${this.escapeHtmlAttr(feedbackButton)}">`;
            html += '</div>';
            html += `<div class="feedback js-feedback js-hidden" style="display: none;">${feedbackContent}</div>`;
        }

        // Wrap in exe-text-activity container
        return `<div class="exe-text-activity">${html}</div>`;
    },

    /**
     * Escape HTML special characters for safe text content
     */
    escapeHtml: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * Escape HTML special characters for attribute values
     */
    escapeHtmlAttr: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    /**
     * eXe idevice engine
     * Idevice api function
     *
     * Initialized idevice and generate edition form
     *
     * @param {Object} idevice
     */
    init: function (element, previousData) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        //**************************************************************
        this.createForm();
    },

    /**
     * eXe idevice engine
     * Idevice api function
     *
     * It returns the HTML to save. Return false if you find any error
     *
     * @return {String}
     */
    save: function () {
        // Avoid crash when ideviceBody is undefined (deleted or not yet loaded)
        if (!this.ideviceBody || typeof this.ideviceBody === 'undefined') {
            return;
        }

        let dataElements = this.ideviceBody.querySelectorAll(`[id^="text"]`);

        dataElements.forEach((e) => {
            if (e.nodeName === 'TEXTAREA' || e.nodeName === 'INPUT') {
                this.dataIds.push(e.id);
            }
        });

        this.dataIds.forEach((element) => {
            if (element.includes('Textarea')) {
                this[element] = tinymce.editors[element].getContent();
            } else if (element.includes('Input')) {
                this[element] = this.ideviceBody.querySelector(
                    `#${element}`
                ).value;
            }
        });

        this[this.textareaId] = this.buildTextareaHtml();

        // Check if the values are valid
        if (this.checkFormValues()) {
            return this.getDataJson();
        } else {
            return false;
        }
    },

    /**
     * Create the form to insert HTML in the TEXTAREA
     *
     */
    createForm: function () {
        let html = `<div id="textForm">`;
        html += this.createEditorGroup();
        html += `</div>`;
        // [eXeLearning] - Set html to eXe idevice body
        this.ideviceBody.innerHTML = html;
        // Set behaviour to elements of form
        this.setBehaviour();
        // Load the previous values of the idevice data from eXe
        this.loadPreviousValues();
    },

    /**
     * Check if the form values are correct
     *
     * @returns {Boolean}
     */
    checkFormValues: function () {
        if (this.text == '') {
            eXe.app.alert(_('Please write some text.'));
            return false;
        }
        return true;
    },

    /**
     * Get a JSON with the idevice data
     *
     * @returns {Array}
     */
    getDataJson: function () {
        let data = {};

        data.ideviceId = this.ideviceBody.getAttribute('idevice-id');

        this.dataIds.forEach((key) => (data[key] = this[key]));

        return data;
    },

    loadPreviousValues: function () {
        function isValid(val) {
            return (
                val != null && !(typeof val === 'string' && val.trim() === '')
            );
        }

        // Avoid crash when idevicePreviousData is undefined (deleted or not yet loaded)
        if (
            !this.idevicePreviousData ||
            typeof this.idevicePreviousData === 'undefined'
        ) {
            return;
        }

        let data = { ...this.idevicePreviousData };

        if (typeof data[this.textareaId] === 'string' && data[this.textareaId]) {
            data[this.textareaId] = this.stripLegacyExeTextWrapper(data[this.textareaId]);
        }

        // Check for embedded task info or simple feedback in textTextarea.
        // extractTaskInfoFromHtml handles both exe-text-activity (new) and simple feedback (legacy).
        // Use structural markers to detect both modern (feedbacktooglebutton) and
        // legacy eXe 2.9 (feedbackbutton) formats without relying on button class names.
        const textContent = data[this.textareaId];
        if (textContent && (textContent.includes('exe-text-activity') ||
            (textContent.includes('js-feedback') && textContent.includes('iDevice_buttons')))) {
            const extractedInfo = this.extractTaskInfoFromHtml(textContent);
            if (extractedInfo) {
                // Merge extracted info into data (extracted values take precedence)
                data = { ...data, ...extractedInfo };
            }
        }

        const defaults = {
            [this.infoInputDurationId]: this.infoDurationInputValue,
            [this.infoInputDurationTextId]: this.infoDurationTextInputValue,
            [this.infoInputParticipantsId]: this.infoParticipantsInputValue,
            [this.infoInputParticipantsTextId]:
                this.infoParticipantsTextInputValue,
            [this.feedbakInputId]: this.feedbakInputValue,
            [this.feedbackTextareaId]: this.feedbakInputInstructions,
        };

        const unionKeys = new Set([
            ...Object.keys(defaults),
            ...Object.keys(data),
        ]);

        const finalValues = {};
        unionKeys.forEach((key) => {
            if (!key || key === 'ideviceId') return; // descartamos si no es relevante

            const orig = data[key];
            const hasDefault = defaults.hasOwnProperty(key);

            if (isValid(orig)) {
                finalValues[key] = orig;
            } else if (hasDefault) {
                finalValues[key] = defaults[key];
            } else {
                finalValues[key] = orig;
            }
        });

        for (const [key, val] of Object.entries(finalValues)) {
            const el = this.ideviceBody.querySelector(`#${key}`);
            if (!el) continue;

            if (
                el.tagName === 'TEXTAREA' ||
                key.toLowerCase().includes('textarea')
            ) {
                $(el).val(val);
                if (`${key}` == this.feedbackTextareaId && val != '') {
                    $('#' + this.feedbackId)
                        .removeClass('exe-fieldset-closed')
                        .addClass('exe-fieldset-open');
                }
            } else if (el.tagName === 'INPUT') {
                const useTranslation = isValid(data[key]);
                const displayValue = useTranslation ? c_(val) : val;
                el.setAttribute('value', displayValue);
            } else {
                el.textContent = val;
            }
        }
    },

    /**
     * Remove a top-level legacy wrapper <div class="exe-text">...</div> when present.
     * This is applied when loading old saved content to avoid persisting legacy wrappers.
     */
    stripLegacyExeTextWrapper: function (html) {
        if (!html || typeof html !== 'string') return html;

        const container = document.createElement('div');
        container.innerHTML = html;

        const significantNodes = Array.from(container.childNodes).filter((node) => {
            if (node.nodeType === 3) {
                return !/^[\s\uFEFF]*$/.test(node.textContent || '');
            }
            return node.nodeType === 1;
        });

        if (significantNodes.length !== 1) return html;

        const root = significantNodes[0];
        if (!root || root.nodeType !== 1) return html;
        if (root.tagName !== 'DIV') return html;
        if (!root.classList || !root.classList.contains('exe-text')) return html;

        return root.innerHTML;
    },

    /**
     * Set events to form
     *
     */
    setBehaviour: function () {
        $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
    },

    /**
     * Function to create all HTML of a group
     *
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
            this.infoDurationTextInputValue + ':',
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
            this.infoParticipantsTextInputValue + ':',
            ''
        );
        infoContent += `</div>`;
        let newInfo = this.createInformationFieldsetHTML(
            this.infoId,
            this.infoTitle,
            '',
            infoContent
        );

        let feedbackContent = this.createInputHTML(
            this.feedbakInputId,
            this.feedbakInputTitle,
            this.feedbakInputInstructions,
            this.feedbakInputValue
        );
        feedbackContent += this.createTextareaHTML(this.feedbackTextareaId);
        let newFeedback = this.createFieldsetHTML(
            this.feedbackId,
            this.feedbackTitle,
            '',
            feedbackContent
        );

        let content = ``;
        content += `<div class="exe-parent">`;
        content += newInfo;
        content += `</div>`;
        content += this.createTextareaHTML(this.textareaId, this.textareaTitle);
        content += `<div class="exe-parent">`;
        content += newFeedback;
        content += `</div>`;

        let html = `<div id="${this.editorGroupId}_parent", class="exe-parent">`;
        html += content;
        html += `</div>`;

        return html;
    },

    /*********************************************************
     * AUX FUNCTIONS
     *
     * Generic functions that can be used to create various fields in the form
     */

    /**
     * Textarea
     * Function to create HTML textfield textarea (tinyMCE editor)
     *
     * @param {String} id
     * @param {String} title
     * @param {String} classExtra
     * @param {String} value
     *
     * @returns {String}
     */
    createTextareaHTML: function (id, title, icons, classExtra, value) {
        let titleText = title ? title : '';
        let iconsText = icons ? icons : '';
        let classExtraText = classExtra ? classExtra : '';
        let valueText = value ? value : '';
        return `
      <div class="exe-field exe-text-field ${classExtraText}">
        <div>
          <label for="${id}">${titleText}</label>
          ${iconsText}
        </div>
        <textarea id="${id}" class="exe-html-editor">${valueText}</textarea>
      </div>`;
    },

    /**
     * Fieldset
     * Function to create HTML fieldset for Information (tinyMCE editor)
     *
     * @param {*} id
     * @param {*} title
     * @param {*} affix
     *
     * @returns {String}
     */

    createInformationFieldsetHTML: function (id, title, affix, content) {
        let affixText = affix ? affix : '';
        return `
      <fieldset id="${id}" class="exe-advanced exe-fieldset exe-fieldset-closed">
        <legend class="exe-text-legend">
        <a href="#">${title}${affixText}</a>
        </legend>
        <div class="grid-container">
          ${content}
        <div>
      </fieldset>`;
    },

    /**
     * Fieldset
     * Function to create HTML fieldset (tinyMCE editor)
     *
     * @param {*} id
     * @param {*} title
     * @param {*} affix
     *
     * @returns {String}
     */

    createFieldsetHTML: function (id, title, affix, content) {
        let affixText = affix ? affix : '';
        return `
      <fieldset id="${id}" class="exe-advanced exe-fieldset exe-fieldset-closed">
        <legend class="exe-text-legend">
        <a href="#">${title}${affixText}</a>
        </legend>
        <div>
          ${content}
        <div>
      </fieldset>`;
    },

    /**
     * Input text
     * Function to create HTML textfield input
     *
     * @param {} id
     * @param {*} title
     *
     * @returns {String}
     */

    createInputHTML: function (id, title, instructions, value, placeholder) {
        let instructionsSpan = instructions
            ? `<span class="exe-field-instructions">${instructions}</span>`
            : '';
        let placeholderAttrib = placeholder
            ? `placeholder="${placeholder}"`
            : '';
        return `
      <div class="exe-field exe-text-field">
        <label for="${id}">${title}:</label>
        <input type="text" value="${value}" ${placeholderAttrib} class="ideviceTextfield" name="${id}" id="${id}" onfocus="this.select()" />
        ${instructionsSpan}
      </div>`;
    },
};
