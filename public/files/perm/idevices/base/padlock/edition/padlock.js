/* eslint-disable no-undef */
/**
 * Lock iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno, Francisco Javier Pulido
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('Lock'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'padlock',
    active: 0,
    typeActive: 0,
    challengesGame: [],
    candadoInstructions: '',
    candadoRetro: '',
    candadoTime: 40,
    candadoSolution: '',
    candadoShowMinimize: false,
    candadoReboot: false,
    candadoAttemps: 0,
    candadoErrorMessage: '',
    candadoVersion: 1,
    id: null,
    ci18n: {
        msgOk: c_('Accept'),
        msgMinimize: c_('Minimize'),
        msgMaximize: c_('Maximize'),
        msgTime: c_('Time Limit (mm:ss)'),
        msgInstructions: c_('Instructions'),
        msgFeedback: c_('Feedback'),
        msgCodeAccess: c_('Access code'),
        msgEnterCode: c_('Enter the access code'),
        msgErrorCode: c_('The access code is not correct'),
        msgRequiredAccessKey: c_('Access code required'),
        msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
        msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
        msgEShowActivity: c_('Show activity'),
        msgSubmit: c_('Check'),
        msgUncompletedActivity: c_('Incomplete activity'),
        msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
        msgOnlySaveScore: c_('You can only save the score once!'),
        msgOnlySave: c_('You can only save once'),
        msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: c_('Your score will be automatically saved after each question.'),
        msgYouScore: c_('Your score'),
        msgSeveralScore: c_('You can save the score as many times as you want'),
        msgYouLastScore: c_('The last score saved is'),
        msgActityComply: c_('You have already done this activity.'),
        msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
        msgTypeGame: c_('Padlock'),
    },

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;

        this.setMessagesInfo();
        this.createForm();
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEGeneralSettings = _('General settings');
        msgs.msgEIntrucctions = _('Please write the instructions.');
        msgs.msgTime = _('Max time');
        msgs.msgERetro = _('Please write the feedback.');
        msgs.msgCodeAccess = _('Access code');
        msgs.msgEnterCodeAccess = _('Enter the access code');
        msgs.msgEInstructions = _('Instructions');
        msgs.msgEREtroalimatacion = _('Feedback');
        msgs.msgEShowMinimize = _('Show minimized.');
        msgs.msgERebootActivity = _('Repeat activity');
        msgs.msgCustomMessage = _('Error message');
        msgs.msgNumFaildedAttemps = _(
            'Errors (number of attempts) to display the message',
        );
        msgs.msgEnterCustomMessage = _('Please write the error message.');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.',
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters',
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    createForm: function () {
        const msgs = this.msgs,
            path = $exeDevice.idevicePath,
            html = `
            <div id="candadoIdeviceForm">
                <p class="exe-block-info exe-block-dismissible">
                    ${_('Create activities with a password protected feedback.')} 
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/candado.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${msgs.msgEGeneralSettings}">
                    <div class="candado-EPanel" id="candadoEPanel">
                        <p class="candadoToggle">
                            <input checked id="candadoECandado" type="radio" name="dsfDesRet" value="0" />
                            <label for="candadoECandado">${msgs.msgEInstructions}</label>
                            <input id="candadoERetro" type="radio" name="dsfDesRet" value="1" />
                            <label for="candadoERetro">${msgs.msgEREtroalimatacion}</label>
                        </p>
                        <p id="divCandadoInstructions">
                            <label for="candadoEDescription" class="sr-av">${_('Instructions')}:</label>
                            <textarea id="candadoEDescription" class="exe-html-editor"></textarea>
                        </p>
                        <p id="divCandadoFeebBack">
                            <label for="candadoEFeedBack" class="sr-av">${_('Feedback')}:</label>
                            <textarea id="candadoEFeedBack" class="exe-html-editor"></textarea>
                        </p>
                        <p class="candado-EDataAccess">
                            <label for="candadoEDSolution">${msgs.msgCodeAccess}:</label>
                            <input type="text" id="candadoEDSolution"/>
                            <label id="candadolblEDTime" for="candadoEDTime">${msgs.msgTime}:</label>
                            <select id="candadoEDTime">
                                <option value="0"></option>
                                <option value="1">1m</option>
                                <option value="3">3m</option>
                                <option value="5">5m</option>
                                <option value="10" selected>10m</option>
                                <option value="15">15m</option>
                                <option value="20">20m</option>
                                <option value="25">25m</option>
                                <option value="30">30m</option>
                                <option value="35">35m</option>
                                <option value="40">40m</option>
                                <option value="45">45m</option>
                                <option value="50">50m</option>
                                <option value="55">55m</option>
                                <option value="60">60m</option>
                            </select>
                            <input type="checkbox" id="candadoEShowMinimize"/>
                            <label for="candadoEShowMinimize">${msgs.msgEShowMinimize}</label>
                            <input type="checkbox" id="candadoEReboot" checked/>
                            <label for="candadoEReboot">${msgs.msgERebootActivity}</label>
                        </p>
                        <p class="candado-EDataAccess">
                            <label for="candadoEAttemps">${msgs.msgNumFaildedAttemps}:</label>
                            <input type="number" name="candadoEAttemps" id="candadoEAttemps" value="0" min="0" max="10" step="1" required />
                            <label for="candadoEErrorMessage">${msgs.msgCustomMessage}:</label>
                            <input type="text" disabled id="candadoEErrorMessage" />
                        </p>
                        <p class="Games-Reportdiv">
                            <strong class="GameModeLabel">
                                <a href="#candadoEEvaluationHelp" id="candadoEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${path}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}"/>
                                </a>
                            </strong>
                            <input type="checkbox" id="candadoEEvaluation"/><label for="candadoEEvaluation">${_('Progress report')}.</label>
                            <label for="candadoEEvaluationID">${_('Identifier')}:</label><input type="text" id="candadoEEvaluationID" disabled/>
                        </p>
                        <div id="candadoEEvaluationHelp" class="candado-TypeGameHelp exe-block-info">
                            <p>${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                        </div>
                    </div>
                </div>
                ${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevices.iDevice.gamification.scorm.getTab()}
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        $('#divCandadoFeebBack').hide();

        $exeDevices.iDevice.tabs.init('candadoIdeviceForm');
        $exeDevices.iDevice.gamification.scorm.init();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    loadPreviousValues: function () {
        let originalHTML = this.idevicePreviousData,
            candadoInstructions = '',
            candadoRetro = '';

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let json = $('.candado-DataGame', wrapper).text();
            const version = $('.candado-version', wrapper).text();

            if (version.length === 1 || !json.startsWith('{')) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            $exeDevice.candadoSolution = dataGame.candadoSolution;
            $exeDevice.candadoTime = dataGame.candadoTime;
            $exeDevice.candadoAttemps = dataGame.candadoAttemps;
            $exeDevice.candadoErrorMessage = dataGame.candadoErrorMessage;
            candadoInstructions = $('.candado-instructions', wrapper)
                .eq(0)
                .html();
            candadoRetro = $('.candado-retro', wrapper).eq(0).html();
            $exeDevices.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs,
            );
            $exeDevice.typeActive = 0;
            $exeDevice.evaluation =
                typeof dataGame.evaluation !== 'undefined'
                    ? dataGame.evaluation
                    : false;
            $exeDevice.evaluationID =
                typeof dataGame.evaluationID !== 'undefined'
                    ? dataGame.evaluationID
                    : '';
            $exeDevice.id = $exeDevice.getIdeviceID();

            $('#candadoEDSolution').val(dataGame.candadoSolution);
            $('#candadoEDTime').val(dataGame.candadoTime);
            $('#candadoEShowMinimize').prop(
                'checked',
                dataGame.candadoShowMinimize,
            );
            $('#candadoEReboot').prop('checked', dataGame.candadoReboot);
            $('#candadoEAttemps').val(dataGame.candadoAttemps);
            $('#candadoEErrorMessage').val(dataGame.candadoErrorMessage);
            $('#candadoEErrorMessage').prop(
                'disabled',
                dataGame.candadoAttemps === 0,
            );
            $('#candadoEEvaluation').prop('checked', dataGame.evaluation);
            $('#candadoEEvaluationID').val(dataGame.evaluationID);
            $('#candadoEEvaluationID').prop('disabled', !dataGame.evaluation);

            if (candadoInstructions.length > 0) {
                $('#candadoEDescription').val(candadoInstructions);
            }
            if (candadoRetro.length > 0) {
                $('#candadoEFeedBack').val(candadoRetro);
            }
            $exeDevices.iDevice.gamification.scorm.setValues(
                dataGame.isScorm,
                dataGame.textButtonScorm,
                dataGame.repeatActivity,
                dataGame.weighted,
            );
        }
    },

    escapeHtml: function (string) {
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    save: function () {
        if (!$exeDevice.validateCandado()) return false;

        const dataGame = this.validateData();
        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = fields;
        for (const i in fields) {
            const fVal = $('#ci18n_' + i).val();
            if (fVal !== '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        let json = JSON.stringify(dataGame);
        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);
        let html = '<div class="candado-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="candado-version js-hidden">' +
            $exeDevice.candadoVersion +
            '</div>';
        html +=
            '<div class="candado-instructions js-hidden">' +
            tinymce.editors[0].getContent() +
            '</div>';
        html +=
            '<div class="candado-retro js-hidden">' +
            tinymce.editors[1].getContent() +
            '</div>';
        html += '<div class="candado-DataGame js-hidden">' + json + '</div>';
        html +=
            '<div class="candado-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },

    validateCandado: function () {
        let message = '',
            candadoInstructions = tinyMCE
                .get('candadoEDescription')
                .getContent(),
            candadoRetro = tinyMCE.get('candadoEFeedBack').getContent();
        $exeDevice.candadoTime = parseInt(
            $('#candadoEDTime option:selected').val(),
        );
        $exeDevice.candadoSolution = $('#candadoEDSolution').val();
        $exeDevice.candadoShowMinimize = $('#candadoEShowMinimize').is(
            ':checked',
        );
        $exeDevice.candadoReboot = $('#candadoEReboot').is(':checked');
        $exeDevice.candadoAttemps = $('#candadoEAttemps').val();
        $exeDevice.candadoErrorMessage = $('#candadoEErrorMessage').val();
        $exeDevice.evaluation = $('#candadoEEvaluation').is(':checked');
        $exeDevice.evaluationID = $('#candadoEEvaluationID').val();
        $exeDevice.id = $exeDevice.id
            ? $exeDevice.id
            : $exeDevice.getIdeviceID();

        if (candadoInstructions.length === 0) {
            message = $exeDevice.msgs.msgEIntrucctions;
        } else if (candadoRetro.length === 0) {
            message = $exeDevice.msgs.msgERetro;
        } else if ($exeDevice.candadoSolution.length === 0) {
            message = $exeDevice.msgs.msgEnterCodeAccess;
        } else if (
            $exeDevice.candadoAttemps > 0 &&
            $exeDevice.candadoErrorMessage.length === 0
        ) {
            message = $exeDevice.msgs.msgEnterCustomMessage;
        } else if (
            $exeDevice.evaluation &&
            $exeDevice.evaluationID.length < 5
        ) {
            message = $exeDevice.msgs.msgIDLenght;
        }

        if (message.length !== 0) {
            $exeDevice.showMessage(message);
            message = false;
        } else {
            message = true;
        }
        return message;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#candadoIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const scorm = $exeDevices.iDevice.gamification.scorm.getValues();
        return {
            candadoTime: $exeDevice.candadoTime,
            candadoSolution: $exeDevice.candadoSolution,
            candadoInstructions: '',
            candadoRetro: '',
            candadoShowMinimize: $exeDevice.candadoShowMinimize,
            candadoReboot: $exeDevice.candadoReboot,
            candadoAttemps: $exeDevice.candadoAttemps,
            candadoErrorMessage: $exeDevice.candadoErrorMessage,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            evaluation: $exeDevice.evaluation,
            evaluationID: $exeDevice.evaluationID,
            id: $exeDevice.getIdeviceID(),
        };
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    addEvents: function () {
        $('#candadoERetro').on('click', function () {
            $('#divCandadoInstructions').hide();
            $('#divCandadoFeebBack').show();
        });

        $('#candadoECandado').on('click', function () {
            $('#divCandadoInstructions').show();
            $('#divCandadoFeebBack').hide();
        });

        $('#candadoEAttemps').on('focusout', function () {
            this.value = this.value.trim() === '' ? 0 : this.value;
            this.value = this.value > 9 ? 9 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
            const d = this.value == 0;
            $('#candadoEErrorMessage').prop('disabled', d);
        });

        $('#candadoEAttemps').on('keyup mouseup', function () {
            const d = this.value == 0;
            $('#candadoEErrorMessage').prop('disabled', d);
        });

        $('#candadoEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#candadoEEvaluationID').prop('disabled', !marcado);
        });

        $('#candadoEEvaluationHelpLnk').on('click', function () {
            $('#candadoEEvaluationHelp').toggle();
            return false;
        });
    },
};
