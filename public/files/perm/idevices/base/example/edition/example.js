var $exeDevice = {
    // ::: i18n :::
    // We use eXe's _function
    // iDevice name
    name: _('Example'),
    // Description
    descriptionText: _('This is just an example iDevice.'),
    // Text
    textTitle: _('Write a text that will be saved'),
    textPlaceholder: _('Type something...'),
    // Data List
    dListTitle: _('Select an option from the list (double click to see it)'),
    dListPlaceholder: _('Type something...'),
    // Number
    numberTitle: _('Choose a number'),
    // Color picker
    colorTitle: _('Color picker example'),
    // Switch
    switchTitle: _('Yes/No example'),
    // Radio buttons
    radioTitle: _('Radio buttons example'),

    // ::: Identifiers of the fields used in the idevice :::
    textId: 'exampleText',
    dListId: 'exampleDataList',
    numberId: 'exampleNumber',
    colorId: 'exampleColor',
    switchId: 'exampleSwitch',
    radioId: 'exampleRadio',

    // ::: iDevice default data :::
    // Data list
    dListDefault: 'element_1',
    dListOptions: [
        { value: 'element_1', title: _('Element 1') },
        { value: 'element_2', title: _('Element 2') },
        { value: 'element_3', title: _('Element 3') },
    ],
    // Number
    numberMax: 5,
    numberMin: 1,
    numberDefault: 3,
    // Color
    colorDefault: '#fbbf3c',
    // Switch
    switchDefault: false,
    // Radio buttons
    radioOptions: [
        { id: 'element_1', title: _('Element 1'), checked: true },
        { id: 'element_2', title: _('Element 2'), checked: false },
        { id: 'element_3', title: _('Element 3'), checked: false },
    ],

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

    escapeHtml: function (value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    escapeAttribute: function (value) {
        return this.escapeHtml(value);
    },

    getSafeDataListValue: function (value) {
        const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
        var sanitized = sanitizeText(value || '');
        var exists = this.dListOptions.some(function (option) {
            return option.value === sanitized;
        });
        return exists ? sanitized : this.dListDefault;
    },

    getSafeNumberValue: function (value) {
        const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
        var parsed = parseInt(sanitizeText(value), 10);
        if (isNaN(parsed)) return this.numberDefault;
        return Math.max(this.numberMin, Math.min(this.numberMax, parsed));
    },

    getSafeColorValue: function (value) {
        const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
        var sanitized = sanitizeText(value || '');
        return /^#[0-9a-f]{6}$/i.test(sanitized)
            ? sanitized
            : this.colorDefault;
    },

    getSafeRadioValue: function (value) {
        const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
        var sanitized = sanitizeText(value || '');
        var exists = this.radioOptions.some(function (option) {
            return option.id === sanitized;
        });
        return exists ? sanitized : this.radioOptions[0].id;
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
        const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
        this.text = sanitizeText(
            this.ideviceBody.querySelector(`#${this.textId}`).value
        );
        this.dataList = this.getSafeDataListValue(
            this.ideviceBody.querySelector(`#${this.dListId}`).value
        );
        this.number = this.getSafeNumberValue(
            this.ideviceBody.querySelector(`#${this.numberId}`).value
        );
        this.color = this.getSafeColorValue(
            this.ideviceBody.querySelector(`#${this.colorId}`).value
        );
        this.switch = this.ideviceBody.querySelector(
            `#${this.switchId}`
        ).checked;
        var selectedRadio = this.ideviceBody.querySelector(
            `input[name="${this.radioId}"]:checked`
        );
        this.radio = this.getSafeRadioValue(selectedRadio ? selectedRadio.id : '');
        // Check if the values ​​are valid
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
        const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
        var safeDescriptionText = this.escapeHtml(
            sanitizeText(this.descriptionText)
        );
        let html = `<div id="exampleForm">`;
        html += `<div class="idevice-description">`;
        html += `<p class="description_p_1">${safeDescriptionText}</p>`;
        html += `</div>`;
        html += this.createInputFloatingHTML(
            this.textId,
            this.textTitle,
            this.textPlaceholder,
            'required'
        );
        html += this.createDataListHTML(
            this.dListId,
            this.dListTitle,
            this.dListPlaceholder,
            this.dListOptions,
            this.dListDefault
        );
        html += this.createRangeHTML(
            this.numberId,
            this.numberTitle,
            this.numberMin,
            this.numberMax,
            this.numberDefault
        );
        html += this.createColorPickerHTML(
            this.colorId,
            this.colorTitle,
            this.colorDefault
        );
        html += this.createSwitchHTML(
            this.switchId,
            this.switchTitle,
            this.switchDefault
        );
        html += this.createRadioButtonsHTML(
            this.radioId,
            this.radioTitle,
            this.radioOptions
        );
        html += `</div>`;
        // [eXeLearning] - Set html to eXe idevice body
        this.ideviceBody.innerHTML = html;
        // Load the previous values ​​of the idevice data from eXe
        this.loadPreviousValues();
        // Set behaviour to elements of form
        this.setBehaviour();
    },

    /**
     * Check if the form values ​​are correct
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
        let data = {
            text: this.text,
            dataList: this.dataList,
            number: this.number,
            color: this.color,
            switch: this.switch,
            radio: this.radio,
        };
        return data;
    },

    /**
     * Load the saved values in the form fields
     *
     */
    loadPreviousValues: function () {
        const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
        // Set form values in the value attribute
        let data = this.idevicePreviousData;
        if (data.text)
            this.ideviceBody
                .querySelector(`#${this.textId}`)
                .setAttribute('value', sanitizeText(data.text));
        if (data.dataList)
            this.ideviceBody
                .querySelector(`#${this.dListId}`)
                .setAttribute(
                    'value',
                    this.getSafeDataListValue(data.dataList)
                );
        if (data.number)
            this.ideviceBody
                .querySelector(`#${this.numberId}`)
                .setAttribute('value', this.getSafeNumberValue(data.number));
        if (data.color)
            this.ideviceBody
                .querySelector(`#${this.colorId}`)
                .setAttribute('value', this.getSafeColorValue(data.color));
        if (typeof data.switch !== 'undefined')
            this.ideviceBody
                .querySelector(`#${this.switchId}`)
                .setAttribute('value', data.switch === true || data.switch === 'true');
        if (data.radio)
            this.ideviceBody.querySelector(
                `#${this.radioId} #${this.getSafeRadioValue(data.radio)}`
            ).checked = true;
        // Set values to elements
        this.setValuesElement();
    },

    /**
     * Set values to form elements based in the value attribute
     *
     */
    setValuesElement: function () {
        // Text
        let textElement = this.ideviceBody.querySelector(`#${this.textId}`);
        textElement.value = textElement.getAttribute('value');
        // Shape
        let shapeSelectorElement = this.ideviceBody.querySelector(
            `#${this.dListId}`
        );
        shapeSelectorElement.value = shapeSelectorElement.getAttribute('value');
        // Number (range selector)
        let rangeSelectorInputElement = this.ideviceBody.querySelector(
            `#${this.numberId}`
        );
        let rangeSelectorContainer = rangeSelectorInputElement.parentNode;
        let rangeSelectorValueElement =
            rangeSelectorContainer.querySelector('.value-number');
        rangeSelectorValueElement.textContent = rangeSelectorInputElement.value;
        // Color
        let colorSelectorElement = this.ideviceBody.querySelector(
            `#${this.colorId}`
        );
        colorSelectorElement.value = colorSelectorElement.getAttribute('value');
        // Switch
        let switchElement = this.ideviceBody.querySelector(`#${this.switchId}`);
        switchElement.checked = switchElement.getAttribute('value') == 'true';
    },

    /**
     * Set events to form
     *
     */
    setBehaviour: function () {
        // Number (range selector)
        let rangeSelectorInputElement = this.ideviceBody.querySelector(
            `#${this.numberId}`
        );
        let rangeSelectorContainer = rangeSelectorInputElement.parentNode;
        let rangeSelectorValueElement =
            rangeSelectorContainer.querySelector('.value-number');
        rangeSelectorInputElement.addEventListener('change', (event) => {
            rangeSelectorValueElement.textContent =
                rangeSelectorInputElement.value;
        });
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
    createTextareaHTML: function (id, title, classExtra, value) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
                var safeClassExtra = this.escapeAttribute(sanitizeText(classExtra));
                var safeValue = this.escapeHtml(sanitizeText(value));
        return `
            <p class="exe-field exe-text-field ${safeClassExtra}">
                <label for="${safeId}">${safeTitle}: </label>
                <textarea id="${safeId}" class="exe-html-editor">${safeValue}</textarea>
      </p>`;
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
    createFieldsetHTML: function (id, title, affix, value) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
                var safeValue = this.escapeHtml(sanitizeText(value));
                let affixText = affix
                        ? ` (${this.escapeHtml(sanitizeText(affix))})`
                        : '';
        return `
      <fieldset class="exe-field exe-advanced exe-fieldset exe-feedback-fieldset exe-fieldset-closed">
                <legend><a href="#">${safeTitle}${affixText}</a></legend>
        <div>
          <p>
                        <label for="${safeId}" class="sr-av">${safeTitle}</label>
                        <textarea id="${safeId}" class='exe-html-editor'>${safeValue}</textarea>
          </p>
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
    createInputHTML: function (id, title, instructions, value) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
                var safeValue = this.escapeAttribute(sanitizeText(value));
        let instructionsSpan = instructions
                        ? `<span class="exe-field-instructions">${this.escapeHtml(
                                    sanitizeText(instructions)
                            )}</span>`
            : '';
        return `
      <div class="exe-field exe-text-field">
                <label for="${safeId}">${safeTitle}: </label>
                <input type="text" value="${safeValue}" class="ideviceTextfield" name="${safeId}" id="${safeId}" onfocus="this.select()" />
        ${instructionsSpan}
      </div>`;
    },

    /**
     * Input text floating
     * Function to create HTML textfield input
     *
     * @param {String} id
     * @param {String} title
     * @param {String} placeholder
     * @param {Boolean} required
     *
     * @returns {String}
     */
    createInputFloatingHTML: function (id, title, placeholder, required) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
                var safePlaceholder = this.escapeAttribute(
                        sanitizeText(placeholder)
                );
        let requiredClass = required ? 'required' : '';
        return `
      <div class="exe-field form-floating mb-3 ${requiredClass}">
                <input type="text" class="form-control ${requiredClass}" ${requiredClass} id="${safeId}"
                    placeholder="${safePlaceholder}">
                <label for="${safeId}">${safeTitle}</label>
      </div>`;
    },

    /**
     * DataList
     * Function to create HTML datalist
     *
     * @param {String} id
     * @param {String} title
     * @param {String} placeholder
     * @param {String} options
     * @param {String} value
     *
     * @returns {String}
     */
    createDataListHTML: function (id, title, placeholder, options, value) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
                var safePlaceholder = this.escapeAttribute(
                        sanitizeText(placeholder)
                );
                var safeValue = this.escapeAttribute(this.getSafeDataListValue(value));
        let optionsHTML = '';
        options.forEach((option) => {
                        optionsHTML += `<option value="${this.escapeAttribute(
                                sanitizeText(option.value)
                        )}">${this.escapeHtml(
                                sanitizeText(option.title)
                        )}</option>`;
        });
        return `
      <div class="exe-field exe-datalist-field">
                <label for="${safeId}" class="form-label">${safeTitle}</label>
                <input class="form-control" list="${safeId}-options" value="${safeValue}" id="${safeId}" placeholder="${safePlaceholder}">
                <datalist id="${safeId}-options">
          ${optionsHTML}
        </datalist>
      </div>`;
    },

    /**
     * Range
     * Function to create HTML range
     *
     * @param {String} id
     * @param {String} title
     * @param {Number} min
     * @param {Number} max
     * @param {Number} value
     *
     * @returns {String}
     */
    createRangeHTML: function (id, title, min, max, value) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
                var safeMin = Number(min);
                var safeMax = Number(max);
                var safeValue = this.getSafeNumberValue(value);
        return `
        <div class="exe-field exe-range-field">
                    <label for="${safeId}" class="form-label">${safeTitle}</label>
                    <input type="range" class="form-range" min="${safeMin}" max="${safeMax}" value="${safeValue}" id="${safeId}">
                    <span class="value-number">${safeValue}</span>
        </div>`;
    },

    /**
     * Colorpicker
     * Function to create HTML colorpicker
     *
     * @param {String} id
     * @param {String} title
     * @param {String} value
     *
     * @returns {String}
     */
    createColorPickerHTML: function (id, title, value) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
                var safeValue = this.escapeAttribute(this.getSafeColorValue(value));
        return `
        <div class="exe-field exe-color-field">
                    <label for="${safeId}" class="form-label">${safeTitle}</label>
                    <input type="color" class="form-control form-control-color" id="${safeId}" value="${safeValue}" title="${safeTitle}">
        </div>`;
    },

    /**
     * Switch
     * Function to create HTML switch
     *
     * @param {String} id
     * @param {String} title
     * @param {String} value
     *
     * @returns {String}
     */
    createSwitchHTML: function (id, title, value) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
        return `
      <div class="exe-field form-check form-switch">
                <input class="form-check-input" type="checkbox" value="${value === true}" id="${safeId}">
                <label class="form-check-label" for="${safeId}">${safeTitle}</label>
      </div>`;
    },

    /**
     * Radio buttons
     * Function to create HTML radio buttons
     *
     * @param {String} id
     * @param {Dict} options
     *    {String} id
     *    {String} title
     *    {Boolean} checked
     * @returns
     */
    createRadioButtonsHTML: function (id, title, options) {
                const sanitizeText = $exeDevicesEdition.iDevice.common.sanitizeText;
                var safeId = this.escapeAttribute(sanitizeText(id));
                var safeTitle = this.escapeHtml(sanitizeText(title));
        let radioOptionsHTML = '';
        options.forEach((option) => {
                        var safeOptionId = this.escapeAttribute(
                                this.getSafeRadioValue(option.id)
                        );
                        var safeOptionTitle = this.escapeHtml(
                                sanitizeText(option.title)
                        );
            let checkedClass = option.checked ? 'checked' : '';
            radioOptionsHTML += `
        <div class="form-check">
                    <input class="form-check-input" type="radio" name="${safeId}" id="${safeOptionId}" ${checkedClass}>
                    <label class="form-check-label" for="${safeOptionId}">
                        ${safeOptionTitle}
          </label>
        </div>`;
        });
        return `
      <div class="exe-field exe-radio-field">
                <div class="radio-options-container" id="${safeId}">
                    <label for="${safeId}" class="form-label">${safeTitle}</label>
          ${radioOptionsHTML}
        </div>
      </div>`;
    },
};
