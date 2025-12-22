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
    infoTitle: _('Task information (optional)'),
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

        const data = this.idevicePreviousData;
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
