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

    /**
     * eXe idevice engine
     * Idevice api function
     *
     * It returns the HTML to save. Return false if you find any error
     *
     * @return {String}
     */
    save: function () {
        this.text = this.ideviceBody.querySelector(`#${this.textId}`).value;
        this.dataList = this.ideviceBody.querySelector(
            `#${this.dListId}`
        ).value;
        this.number = this.ideviceBody.querySelector(`#${this.numberId}`).value;
        this.color = this.ideviceBody.querySelector(`#${this.colorId}`).value;
        this.switch = this.ideviceBody.querySelector(
            `#${this.switchId}`
        ).checked;
        this.radio = this.ideviceBody.querySelector(
            `input[name="${this.radioId}"]:checked`
        ).id;
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
        let html = `<div id="exampleForm">`;
        html += `<div class="idevice-description">`;
        html += `<p class="description_p_1">${this.descriptionText}</p>`;
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
        // Set form values in the value attribute
        let data = this.idevicePreviousData;
        if (data.text)
            this.ideviceBody
                .querySelector(`#${this.textId}`)
                .setAttribute('value', data.text);
        if (data.dataList)
            this.ideviceBody
                .querySelector(`#${this.dListId}`)
                .setAttribute('value', data.dataList);
        if (data.number)
            this.ideviceBody
                .querySelector(`#${this.numberId}`)
                .setAttribute('value', data.number);
        if (data.color)
            this.ideviceBody
                .querySelector(`#${this.colorId}`)
                .setAttribute('value', data.color);
        if (data.switch)
            this.ideviceBody
                .querySelector(`#${this.switchId}`)
                .setAttribute('value', data.switch);
        if (data.radio)
            this.ideviceBody.querySelector(
                `#${this.radioId} #${data.radio}`
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
        rangeSelectorValueElement.innerHTML = rangeSelectorInputElement.value;
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
            rangeSelectorValueElement.innerHTML =
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
        return `
      <p class="exe-field exe-text-field ${classExtra}">
        <label for="${id}">${title}: </label>
        <textarea id="${id}" class="exe-html-editor">${value}</textarea>
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
        let affixText = affix ? ` (${affix})` : '';
        return `
      <fieldset class="exe-field exe-advanced exe-fieldset exe-feedback-fieldset exe-fieldset-closed">
        <legend><a href="#">${title}${affixText}</a></legend>
        <div>
          <p>
            <label for="${id}" class="sr-av">${title}</label>
            <textarea id="${id}" class='exe-html-editor'>${value}</textarea>
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
        let instructionsSpan = instructions
            ? `<span class="exe-field-instructions">${instructions}</span>`
            : '';
        return `
      <div class="exe-field exe-text-field">
        <label for="${id}">${title}: </label>
        <input type="text" value="${value}" class="ideviceTextfield" name="${id}" id="${id}" onfocus="this.select()" />
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
        let requiredClass = required ? 'required' : '';
        return `
      <div class="exe-field form-floating mb-3 ${requiredClass}">
        <input type="text" class="form-control ${requiredClass}" ${requiredClass} id="${id}"
          placeholder="${placeholder}">
        <label for="${id}">${title}</label>
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
        let optionsHTML = '';
        options.forEach((option) => {
            optionsHTML += `<option value="${option.value}">${option.title}</option>`;
        });
        return `
      <div class="exe-field exe-datalist-field">
        <label for="${id}" class="form-label">${title}</label>
        <input class="form-control" list="${id}-options" value=${value} id="${id}" placeholder="${placeholder}">
        <datalist id="${id}-options">
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
        return `
        <div class="exe-field exe-range-field">
          <label for="${id}" class="form-label">${title}</label>
          <input type="range" class="form-range" min="${min}" max="${max}" value="${value}" id="${id}">
          <span class="value-number">${value}</span>
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
        return `
        <div class="exe-field exe-color-field">
          <label for="${id}" class="form-label">${title}</label>
          <input type="color" class="form-control form-control-color" id="${id}" value="${value}" title="${title}">
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
        return `
      <div class="exe-field form-check form-switch">
        <input class="form-check-input" type="checkbox" value="${value}" id="${id}">
        <label class="form-check-label" for="${id}">${title}</label>
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
        let radioOptionsHTML = '';
        options.forEach((option) => {
            let checkedClass = option.checked ? 'checked' : '';
            radioOptionsHTML += `
        <div class="form-check">
          <input class="form-check-input" type="radio" name="${id}" id="${option.id}" ${checkedClass}>
          <label class="form-check-label" for="${option.id}">
            ${option.title}
          </label>
        </div>`;
        });
        return `
      <div class="exe-field exe-radio-field">
        <div class="radio-options-container" id=${id}>
          <label for="${id}" class="form-label">${title}</label>
          ${radioOptionsHTML}
        </div>
      </div>`;
    },
};
