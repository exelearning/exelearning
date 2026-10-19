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
    candadoTime: 40,
    candadoSolution: '',
    candadoShowMinimize: false,
    candadoReboot: false,
    candadoAttemps: 0,
    candadoErrorMessage: '',
    candadoVersion: 1,
    id: null,
    ci18n: {},
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    refreshTranslations: function () {
        this.ci18n = {
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
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgEShowActivity: c_('Show activity'),
            msgSubmit: c_('Check'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgOnlySaveAuto: c_(
                'Your score will be saved after each question. You can only play once.'
            ),
            msgSaveAuto: c_(
                'Your score will be automatically saved after each question.'
            ),
            msgYouScore: c_('Your score'),
            msgSeveralScore: c_(
                'You can save the score as many times as you want'
            ),
            msgYouLastScore: c_('The last score saved is'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_(
                'You can do this activity as many times as you want'
            ),
            msgTypeGame: c_('Padlock'),
        };
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEIntrucctions = _('Please write the instructions.');
        msgs.msgTime = _('Max time');
        msgs.msgERetro = _('Please write the feedback.');
        msgs.msgCodeAccess = _('Access code');
        msgs.msgEnterCodeAccess = _('Enter the access code');
        msgs.msgEREtroalimatacion = _('Feedback');
        msgs.msgEShowMinimize = _('Show minimized.');
        msgs.msgERebootActivity = _('Repeat activity');
        msgs.msgCustomMessage = _('Error message');
        msgs.msgNumFaildedAttemps = _(
            'Errors (number of attempts) to display the message'
        );
        msgs.msgEnterCustomMessage = _('Please write the error message.');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    createForm: function () {
        const msgs = this.msgs,
            edition = $exeIDevicesEdition.iDevice,
            help = edition.common.getHelpTooltip,
            toggle = (id, label, checked = false) => `
                            <span class="toggle-item">
                                <span class="toggle-control">
                                    <input type="checkbox" id="${id}" class="toggle-input"${checked ? ' checked' : ''} />
                                    <span class="toggle-visual" aria-hidden="true"></span>
                                </span>
                                <label for="${id}" class="toggle-label">${label}</label>
                            </span>`,
            options = `
                <div id="candadoEOptions">
                    <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                        <label id="candadolblEDTime" for="candadoEDTime" class="mb-0">${msgs.msgTime}:</label>
                        <select id="candadoEDTime" class="form-select form-select-sm">
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
                        ${help(_('Time learners have to find the access code. Leave it blank for no time limit.'))}
                    </div>
                    <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                        ${toggle('candadoEShowMinimize', msgs.msgEShowMinimize)}
                        ${help(_('Start with the game collapsed. Learners can expand it when they are ready to play.'))}
                    </div>
                    <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                        ${toggle('candadoEReboot', msgs.msgERebootActivity, true)}
                        ${help(_('Start again each time the page is opened, even once solved. Otherwise a solved padlock keeps showing its feedback.'))}
                    </div>
                    <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                        <label for="candadoEAttemps" class="mb-0">${msgs.msgNumFaildedAttemps}:</label>
                        <input type="number" name="candadoEAttemps" id="candadoEAttemps" value="0" min="0" max="9" step="1" required class="form-control" />
                        ${help(_('After this number of wrong codes, learners see the error message. Set 0 to never show it.'))}
                    </div>
                    <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                        <label for="candadoEErrorMessage" class="mb-0">${msgs.msgCustomMessage}:</label>
                        <input type="text" disabled id="candadoEErrorMessage" class="form-control" style="max-width:30ch" />
                        ${help(_('The message learners see after the wrong codes above, for example a clue.'))}
                    </div>
                </div>`,
            contents = `
                <div id="candadoEPanel">
                    <div class="mb-3">
                        <label for="candadoEFeedBack" class="mb-1 d-block">${msgs.msgEREtroalimatacion}:</label>
                        <textarea id="candadoEFeedBack" class="exe-html-editor form-control" rows="6"></textarea>
                    </div>
                    <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                        <label for="candadoEDSolution" class="mb-0">${msgs.msgCodeAccess}:</label>
                        <input type="text" id="candadoEDSolution" class="form-control" style="max-width:20ch" />
                        ${help(_('The code learners have to type to see the feedback.'))}
                    </div>
                </div>`,
            html = `
            <div id="candadoIdeviceForm">
                ${edition.common.getIdeviceDescription(
                    _('Create activities with a password protected feedback.'),
                    'https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe40/html/candado.html',
                )}
                ${edition.tabs.getHtml('candadoIdeviceForm', {
                    path: $exeDevice.idevicePath,
                    instructions: '',
                    options: options,
                    contents: contents,
                    grading: true,
                    texts: this.ci18n,
                    share: false,
                    info: {
                        contents: _('Write the feedback learners unlock and the access code that opens it.'),
                    },
                })}
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        edition.tabs.bind('candadoIdeviceForm');
        edition.gamification.scorm.init();

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
            $exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
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
                dataGame.candadoShowMinimize
            );
            $('#candadoEReboot').prop('checked', dataGame.candadoReboot);
            $('#candadoEAttemps').val(dataGame.candadoAttemps);
            $('#candadoEErrorMessage').val(dataGame.candadoErrorMessage);
            $('#candadoEErrorMessage').prop(
                'disabled',
                !(Number(dataGame.candadoAttemps) > 0)
            );
            $exeIDevicesEdition.iDevice.gamification.progressBar.setValues({
                evaluation: dataGame.evaluation,
                evaluationID: dataGame.evaluationID,
            });
            $exeIDevicesEdition.iDevice.gamification.passScore.setValues({
                passScoreMode: dataGame.passScoreMode,
                passScoreCustom: dataGame.passScoreCustom,
            });

            if (candadoInstructions.length > 0) {
                $('#eXeGameInstructions').val(candadoInstructions);
            }
            if (candadoRetro.length > 0) {
                $('#candadoEFeedBack').val(candadoRetro);
            }
            $exeIDevicesEdition.iDevice.gamification.scorm.setValues(
                dataGame.isScorm,
                dataGame.textButtonScorm,
                dataGame.repeatActivity,
                dataGame.weighted
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
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="candado-version js-hidden">' +
            $exeDevice.candadoVersion +
            '</div>';
        html +=
            '<div class="candado-instructions js-hidden">' +
            tinyMCE.get('eXeGameInstructions').getContent() +
            '</div>';
        html +=
            '<div class="candado-retro js-hidden">' +
            tinyMCE.get('candadoEFeedBack').getContent() +
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
                .get('eXeGameInstructions')
                .getContent(),
            candadoRetro = tinyMCE.get('candadoEFeedBack').getContent();
        $exeDevice.candadoTime = parseInt(
            $('#candadoEDTime option:selected').val()
        );
        $exeDevice.candadoSolution = $('#candadoEDSolution').val();
        $exeDevice.candadoShowMinimize = $('#candadoEShowMinimize').is(
            ':checked'
        );
        $exeDevice.candadoReboot = $('#candadoEReboot').is(':checked');
        $exeDevice.candadoAttemps = $('#candadoEAttemps').val();
        $exeDevice.candadoErrorMessage = $('#candadoEErrorMessage').val();
        const progressBar =
            $exeIDevicesEdition.iDevice.gamification.progressBar.getValues();
        if (!progressBar) return false;
        $exeDevice.evaluation = progressBar.evaluation;
        $exeDevice.evaluationID = progressBar.evaluationID;
        const passScore =
            $exeIDevicesEdition.iDevice.gamification.passScore.getValues();
        $exeDevice.passScoreMode = passScore.passScoreMode;
        $exeDevice.passScoreCustom = passScore.passScoreCustom;
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
        const scorm = $exeIDevicesEdition.iDevice.gamification.scorm.getValues();
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
            passScoreMode: $exeDevice.passScoreMode,
            passScoreCustom: $exeDevice.passScoreCustom,
            id: $exeDevice.getIdeviceID(),
        };
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    addEvents: function () {
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

        $exeIDevicesEdition.iDevice.gamification.progressBar.addEvents();

        $exeIDevicesEdition.iDevice.gamification.passScore.addEvents();
    },
};
