var $exeDevice = {

    // ::: i18n :::
    // We use eXe's _function
    // iDevice name
    name: _('Mermaid diagram'),
    // Textarea
    textareaTitle: _("Mermaid code"),

    // ::: Identifiers of the fields used in the idevice :::
    textareaId: "mermaidTextarea",

    // ::: iDevice data :::
    textArea: "",

    // ::: iDevice default data :::

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
        this.textarea = this.ideviceBody.querySelector(`#${this.textareaId}`).value;
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
        let html = `<div id="mermaidForm">`;
        html += this.createPlaintextTextareaHTML(this.textareaId, this.textareaTitle, '', "required");
        html += `</div>`;
        // [eXeLearning] - Set html to eXe idevice body
        this.ideviceBody.innerHTML = html;
        // Load the previous values of the idevice data from eXe
        this.loadPreviousValues();
        // Set behaviour to elements of form
        this.setBehaviour();
    },

    /**
     * Check if the form values are correct
     *
     * @returns {Boolean}
     */
    checkFormValues: function () {
        if (this.text === "") {
            eXe.app.alert(_("Please write some text."));
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
            textarea: this.textarea,
        }
        return data;
    },

    /**
     * Load the saved values in the form fields
     *
     */
    loadPreviousValues: function () {
        // Set form values in the value attribute
        let data = this.idevicePreviousData;
        if (data.textarea) this.ideviceBody.querySelector(`#${this.textareaId}`).setAttribute("value", data.textarea);
        // Set values to elements
        this.setValuesElement();
    },

    /**
     * Set values to form elements based in the value attribute
     *
     */
    setValuesElement: function () {
        // Textarea
        let textareaElement = this.ideviceBody.querySelector(`#${this.textareaId}`);
        textareaElement.value = textareaElement.getAttribute("value");
    },

    /**
     * Set events to form
     *
     */
    setBehaviour: function () {
    },

    /*********************************************************
     * AUX FUNCTIONS
     *
     * Generic functions that can be used to create various fields in the form
     */

    /**
     * Textarea with plain text
     * Function to create plaintext textarea
     *
     * @param {String} id
     * @param {String} title
     * @param {String} classExtra
     * @param {String} value
     *
     * @returns {String}
     */
    createPlaintextTextareaHTML: function (id, title, classExtra, value) {
        return `
      <p class="exe-field exe-text-field ${classExtra}">
        <label for="${id}">${title}: </label>
        <textarea id="${id}" class="form-control">${value}</textarea>
      </p>`;
    },
}
