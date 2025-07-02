/* eslint-disable no-undef */
var $exeDevice = {
    // i18n
    // We use eXe's _ function
    name: _('Scrambled list'),

    // Max number of items
    items_no: 15,

    // Min number of items
    items_min: 3,

    iDeviceId: 'sortableListForm',
    ci18n: {
        msgScoreScorm: c_("The score can't be saved because this page is not part of a SCORM package."),
        msgYouScore: c_('Your score'),
        msgScore: c_('Score'),
        msgWeight: c_('Weight'),
        msgYouLastScore: c_('The last score saved is'),
        msgOnlySaveScore: c_('You can only save the score once!'),
        msgOnlySave: c_('You can only save once'),
        msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: c_('Your score will be automatically saved after each question.'),
        msgSeveralScore: c_('You can save the score as many times as you want'),
        msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
        msgActityComply: c_('You have already done this activity.'),
        msgUncompletedActivity: c_('Incomplete activity'),
        msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
        msgTypeGame: c_('Scrambled list'),
        msgStartGame: c_('Click here to start'),
        msgSubmit: c_('Submit'),
        msgPlayStart: c_('Click here to play'),
        msgTime: c_('Time per question'),
        msgCheck: c_('Check'),
        msgSaveScore: c_('Save score'),
        msgTestFailed: c_("You didn't pass the test. Please try again"),
    },

    ideviceBody: null,
    idevicePreviousData: null,
    idevicePath: '',

    id: null,
    /**
     * eXe idevice engine
     * Idevice api function
     *
     * Initialized idevice and generate edition form
     *
     * @param {Object} idevice
     */
    init: function (element, previousData, path) {
        //** eXeLearning idevice engine data ***************************
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        //**************************************************************
        this.id = $(element).attr('idevice-id');
        this.createForm(this.id);
        this.addEvents();
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
        // Get the instructions

        this.instructions = '';
        if (tinyMCE.get('eXeGameInstructions')) {
            this.instructions = tinyMCE.get('eXeGameInstructions').getContent();
            if (this.instructions == '') {
                tinyMCE
                    .get('eXeGameInstructions')
                    .getContainer()
                    .classList.add('empty');
            } else {
                tinyMCE
                    .get('eXeGameInstructions')
                    .getContainer()
                    .classList.remove('empty');
            }
        }
        // Get list elements
        this.options = [];
        this.counter = 0;
        this.ideviceBody
            .querySelectorAll('#sortableListFormList input')
            .forEach((element) => {
                if (element.value != '') {
                    this.options.push(element.value);
                    this.counter++;
                }
            });
        // Get button text
        this.buttonText = this.ideviceBody.querySelector(
            '#sortableListButtonText',
        ).value;
        // Text when right
        this.rightText = this.ideviceBody.querySelector(
            '#sortableListRightText',
        ).value;
        // Text when wrong
        this.wrongText = this.ideviceBody.querySelector(
            '#sortableListWrongText',
        ).value;

        this.evaluationID = this.ideviceBody.querySelector(
            '#sortableEvaluationID',
        ).value;

        this.evaluation = this.ideviceBody.querySelector(
            '#sortableEvaluation',
        ).checked;

        this.showSolutions = this.ideviceBody.querySelector(
            '#sortableShowSolutions',
        ).checked;

        this.textAfter = '';
        if (tinyMCE.get('eXeIdeviceTextAfter')) {
            this.textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
            if (this.textAfter == '') {
                tinyMCE
                    .get('eXeIdeviceTextAfter')
                    .getContainer()
                    .classList.add('empty');
            } else {
                tinyMCE
                    .get('eXeIdeviceTextAfter')
                    .getContainer()
                    .classList.remove('empty');
                this.eXeIdeviceTextAfter = `<div class="exe-sortableList-textAfter">${this.eXeIdeviceTextAfter}</div>`;
            }
        }
        this.afterElement = this.textAfter
            ? `<div class="exe-sortableList-textAfter">${this.textAfter}</div>`
            : '';

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $('#ci18n_' + i).val();
            if (fVal !== '') i18n[i] = fVal;
        }
        this.msgs = i18n;
        if (this.checkValues()) {
            return this.dataJson();
        } else {
            return false;
        }
    },

    /**
     * Get a JSON with the idevice data
     *
     * @returns string
     */
    dataJson: function () {
        const scorm = $exeDevices.iDevice.gamification.scorm.getValues();
        this.data = {
            typeGame: 'ScrambledList',
            instructions: this.instructions,
            textAfter: this.textAfter,
            afterElement: this.afterElement,
            options: this.options,
            time: 0,
            buttonText: this.removeTags(this.buttonText),
            rightText: this.removeTags(this.rightText),
            wrongText: this.removeTags(this.wrongText),
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            evaluation: this.evaluation,
            evaluationID: this.evaluationID,
            main: 'sl' + this.id,
            msgs: this.msgs,
            scorerp: 0,
            idevice: 'idevice_node',
            showSolutions: this.showSolutions,
            id: this.id,
        };
        return this.data;
    },

    /**
     * Check if the form values are correct
     *
     * @returns boolean
     */
    checkValues: function () {
        // Check instructiones
        if (this.instructions == '') {
            eXe.app.alert(_('Please write the instructions.'));
            return false;
        }
        // Check options counter
        if (this.counter < this.items_min) {
            eXe.app.alert(_('Add at least 3 elements.'));
            return false;
        }
        // Check button text
        if (this.buttonText == '') {
            eXe.app.alert(_('Please write the button text.'));
            return false;
        }
        // Check right text
        if (this.rightText == '') {
            eXe.app.alert(_('Please write the text to show when right.'));
            return false;
        }
        // Check wrong text
        if (this.wrongText == '') {
            eXe.app.alert(_('Please write the text to show when wrong.'));
            return false;
        }

        if (this.sortableEvaluation && this.sortableEvaluationID.length < 5) {
            eXe.app.alert(
                _('The report identifier must have at least 5 characters'),
            );
            return false;
        }

        // Check equal options
        let equalOptions = false;
        this.options.forEach((item) => {
            if (this.options.filter((i) => i == item).length > 1) {
                equalOptions = true;
                return false;
            }
        });
        if (equalOptions) {
            eXe.app.alert(_('There cannot be 2 or more identical elements.'));
            return false;
        }

        return true;
    },

    /**
     * GET HTML of general settings container
     *
     * @param {*} id
     * @param {*} active (visible/hidden)
     * @return string
     */
    createExeFormContainerGeneralSettings: function (id, active) {
        let textButtonText = _('Button text');
        let textCorrectAnswer = _('Correct Answer Feedback Overlay');
        let textWrongAnswer_1 = _('Wrong Answer Feedback Overlay');
        let textWrongAnswer_2 = _(
            'The right answer will be shown after this text.',
        );
        let textContentAfter_1 = _('Content after');
        let textContentAfter_2 = _('optional');
        let style = active ? '' : 'style="display:none"';

        let html = `<div id="ef${id}" class="exe-form-content" ${style}>`;
        html += this.getListsFields();
        html += this.createInputHTML(
            'sortableListButtonText',
            textButtonText,
            false,
            true,
        );
        html += this.createInputHTML(
            'sortableListRightText',
            textCorrectAnswer,
            false,
            true,
        );
        html += this.createInputHTML(
            'sortableListWrongText',
            textWrongAnswer_1,
            textWrongAnswer_2,
            true,
        );
        html += this.createShowSolutionsInput();
        html += this.createEvaluationInputs();
        html += `</div>`;

        return html;
    },

    createShowSolutionsInput: function () {
        return `<div>
                    <p class="Games-Reportdiv">
                       <label for="sortableShowSolutions"><input type="checkbox" checked id="sortableShowSolutions">${_('Show solutions')}. </label>
                    </p>
                </div> `;
    },


    createEvaluationInputs: function () {
        return `<div>
                    <p class="Games-Reportdiv">
                        <strong class="GameModeLabel"><a href="#sortableEvaluationHelp" id="sortableEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${this.idevicePath}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}"/></a></strong>
                        <label for="sortableEvaluation"><input type="checkbox" id="sortableEvaluation">${_('Progress report')}. </label>
                        <label for="sortableEvaluationID">${_('Identifier')}: </label><input type="text" id="sortableEvaluationID" disabled/>
                    </p>
                    <div id="sortableEvaluationHelp" class="tofTypeGameHelp"  style="display:none">
                        <p class="exe-block-info exe-block-dismissible">${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                    </div>
                </div> `;
    },

    createForm: function (id) {
        const html = `
        <div id="scrambledlistIdeviceForm">
            <p class="exe-block-info exe-block-dismissible">${_('Create interactive text ordering activities.')} <a  style="display:none;" href="https://youtu.be/xHhrBZ_66To" hreflang="es" target="_blank">${_('Usage Instructions')}</a></p>
            <div class="exe-form-tab" title="${_('General settings')}">
                ${$exeDevices.iDevice.gamification.instructions.getFieldset(c_('Arrange the following texts in the correct order to complete the activity.'))}
                <fieldset class="exe-fieldset">
                    <legend><a href="#" >${_('List')}</a></legend>
                    <div class="TOF-EPanel" id="tofEPanel">                   
                        ${this.createExeFormContainerGeneralSettings(id, true)}
                     </div>
                     ${$exeDevices.iDevice.common.getTextFieldset('after')}
                 </fieldset>
             </div>
             ${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
             ${$exeDevices.iDevice.gamification.scorm.getTab(true, true, true)}
             ${$exeDevices.iDevice.gamification.share.getTab(true, 8, false)}
         </div>
     `;
        this.ideviceBody.innerHTML = html;
        $exeDevices.iDevice.tabs.init('scrambledlistIdeviceForm');
        $exeDevices.iDevice.gamification.scorm.init();

        this.loadPreviousValues();
    },

    addEvents: function () {
        document
            .getElementById('sortableEvaluation')
            .addEventListener('change', function () {
                const select = this.checked;
                document.getElementById('sortableEvaluationID').disabled =
                    !select;
            });
        document
            .getElementById('sortableEvaluationHelpLnk')
            .addEventListener('click', function (event) {
                event.preventDefault();
                const helpElement = document.getElementById(
                    'sortableEvaluationHelp',
                );
                helpElement.style.display =
                    helpElement.style.display === 'none' ? 'block' : 'none';
            });
        $exeDevices.iDevice.gamification.share.addEvents(
            8,
            $exeDevice.insertWords,
        );
        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(`${_('Supported formats')}: txt`);
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').attr('accept', '.txt');
            $('#eXeGameImportGame').on('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    eXe.app.alert(
                        _(
                            'Please select a text file (.txt)',
                        ),
                    );
                    return;
                }
                if (
                    !file.type ||
                    !(
                        file.type.match('text/plain')
                    )
                ) {
                    eXe.app.alert(
                        _(
                            'Please select a text file (.txt)',
                        ),
                    );
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    $exeDevice.importGame(e.target.result, file.type);
                };
                reader.readAsText(file);
            });
        } else {
            $('#eXeGameExportImport').hide();
        }
    },

    importGame: function (content, filetype) {
        if (content && filetype.match('text/plain')) {
            $exeDevice.importText(content);
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }

    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertWords(lines);
    },

    insertWords: function (lines) {
        const lineFormat = /^[^#]+(?:#[^#]+){2,}$/;
        let options = [];
        lines.forEach((line) => {
            if (line && lineFormat.test(line)) {
                options = line.split('#');
                $exeDevice.addQuestions(options);
                return;
            }
        });
        if (options.length < 3) {
            eXe.app.alert(_('Sorry, wrong file format'));
        }

    },

    addQuestions: function (options) {
        $('#sortableListFormList ol').empty();
        let inputList = '';
        for (let i = 0; i < this.items_no; i++) {
            let requiredClass = i < this.items_min ? 'required' : '';
            const value = i < options.length ? options[i] : '';
            inputList += `
                <li class="${requiredClass}" ${requiredClass}>
                <label for="sortableListFormList${i}" class="sr-av"></label>
                <input type="text" name="sortableListFormList${i}" id="sortableListFormList${i}"
                    ${requiredClass} class="${requiredClass}" value = "${value}" />
                </li>`;
        }
        $('#sortableListFormList ol').append(inputList)
        $('.exe-form-tabs li:first-child a').trigger('click');
    },


    /**
     * Function to create HTML textfield textarea
     *
     * @param {} id
     * @param {*} title
     * @returns string
     */
    createTextareaHTML(id, title, required) {
        let requiredClass = required ? 'required' : '';
        return `
      <p class="exe-text-field ${requiredClass}">
        <label for="${id}">${title}:</label>
        <textarea id="${id}" class="exe-html-editor" required></textarea>
      </p>`;
    },

    /**
     * Function to create HTML textfield input
     *
     * @param {} id
     * @param {*} title
     * @returns string
     */
    createInputHTML(id, title, instructions, required) {
        let instructionsSpan = instructions
            ? `<span class="exe-field-instructions">${instructions}</span>`
            : '';
        let requiredClass = required ? 'required' : '';
        return `
      <p class="exe-text-field ${requiredClass}">
        <label for="${id}">${title}:</label>
        <input type="text" class="sortableListTextOption ${requiredClass}" name="${id}" ${requiredClass}
          id="${id}" onfocus="this.select()" />
        ${instructionsSpan}
      </p>`;
    },

    /**
     * Function to create HTML fieldset
     *
     * @param {*} id
     * @param {*} title
     * @param {*} affix
     * @returns string
     */
    createFieldset(id, title, affix) {
        let affixText = affix ? ` (${affix})` : '';
        return `
      <fieldset class="exe-advanced exe-fieldset exe-feedback-fieldset exe-fieldset-closed">
        <legend><a href="#">${title}${affixText}</a></legend>
        <div>
          <p>
            <label for="${id}" class="sr-av">${title}</label>
            <textarea id="${id}" class='exe-html-editor'></textarea>
          </p>
        <div>
      </fieldset>`;
    },

    /**
     * Load the saved values in the form fields
     *
     * @param {*} html
     */
    loadPreviousValues: function () {
        // Default values
        var buttonText = c_('Check');
        var rightText = c_('Right!');
        var wrongText = c_('Sorry, that’s incorrect... The right answer is:');
        // Set form values
        let data = this.idevicePreviousData;
        if (data.options) {
            for (let i = 0; i < data.options.length; i++) {
                this.ideviceBody.querySelector(
                    '#sortableListFormList' + i,
                ).value = data.options[i];
            }
        }

        this.ideviceBody.querySelector('#sortableListButtonText').value =
            data.buttonText || buttonText;
        this.ideviceBody.querySelector('#sortableListRightText').value =
            data.rightText || rightText;
        this.ideviceBody.querySelector('#sortableListWrongText').value =
            data.wrongText || wrongText;
        this.ideviceBody.querySelector('#sortableEvaluation').checked =
            data.evaluation || false;
        this.ideviceBody.querySelector('#sortableEvaluationID').value =
            data.evaluationID || '';
        this.ideviceBody.querySelector('#sortableEvaluationID').disabled =
            !data.evaluation;
        this.ideviceBody.querySelector('#eXeGameInstructions').value =
            data.instructions || _('Arrange the following texts in the correct order to complete the activity.');
        this.ideviceBody.querySelector('#eXeIdeviceTextAfter').value =
            data.textAfter || '';
        this.ideviceBody.querySelector('#sortableShowSolutions').checked =
            typeof data.showSolutions !== "undefined" ? data.showSolutions : true;

        data.weighted = data.weighted || 100;
        data.repeatActivity = data.repeatActivity || false;
        data.textButtonScorm = data.textButtonScorm || _('Save score');
        data.isScorm = data.isScorm || 0;

        $exeDevices.iDevice.gamification.scorm.setValues(
            data.isScorm,
            data.textButtonScorm,
            data.repeatActivity,
            data.weighted,
        );
        $exeDevices.iDevice.gamification.common.setLanguageTabValues(
            data.msgs,
        );
    },

    /**
     * Fields for the elements to order (up to $exeDevice.items_no)
     *
     * @returns string
     */
    getListsFields: function () {
        // Instructions text
        let instructionsText = _('Write the elements in the right order:');
        // List of inputs
        let inputList = '';
        for (var i = 0; i < $exeDevice.items_no; i++) {
            let requiredClass = i < this.items_min ? 'required' : '';
            inputList += `
        <li class="${requiredClass}" ${requiredClass}>
          <label for="sortableListFormList${i}" class="sr-av"></label>
          <input type="text" name="sortableListFormList${i}" id="sortableListFormList${i}"
            ${requiredClass} class="${requiredClass}" />
        </li>`;
        }
        // Generate HTML
        return `
      <div id="sortableListFormList">
        <p class="exe-text-field">
          <label>${instructionsText}</label>
        </p>
        <ol>${inputList}</ol>
      </div>`;
    },

    /**
     * Function to remove HTML tags
     *
     * @param {*} str
     * @returns string
     */
    removeTags: function (str) {
        var wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
};
