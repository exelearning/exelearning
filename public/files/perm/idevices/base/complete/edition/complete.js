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
        name: _('Complete'),
    },
    idevicePath: '',
    checkAltImage: true,
    msgs: {},
    classIdevice: 'complete',
    version: 1,
    id: false,
    ci18n: {
        msgReply: c_('Reply'),
        msgEnterCode: c_('Enter the access code'),
        msgErrorCode: c_('The access code is not correct'),
        msgGameOver: c_('Game Over!'),
        msgClue: c_('Cool! The clue is:'),
        msgCodeAccess: c_('Access code'),
        msgPlayStart: c_('Click here to play'),
        msgErrors: c_('Errors'),
        msgHits: c_('Hits'),
        msgScore: c_('Score'),
        msgWeight: c_('Weight'),
        msgMinimize: c_('Minimize'),
        msgMaximize: c_('Maximize'),
        msgTime: c_('Time Limit (mm:ss)'),
        msgLive: c_('Life'),
        msgFullScreen: c_('Full Screen'),
        msgExitFullScreen: c_('Exit Full Screen'),
        msgNumQuestions: c_('Number of questions'),
        msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
        msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
        msgTryAgain: c_('You need at least %s&percnt; of correct answers to get the information. Please try again.'),
        msgEndGameScore: c_('Please start the game before saving your score.'),
        msgScoreScorm: c_("The score can't be saved because this page is not part of a SCORM package."),
        msgAnswer: c_('Answer'),
        msgOnlySaveScore: c_('You can only save the score once!'),
        msgOnlySave: c_('You can only save once'),
        msgInformation: c_('Information'),
        msgYouScore: c_('Your score'),
        msgAuthor: c_('Authorship'),
        msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: c_('Your score will be automatically saved after each question.'),
        msgSeveralScore: c_('You can save the score as many times as you want'),
        msgYouLastScore: c_('The last score saved is'),
        msgActityComply: c_('You have already done this activity.'),
        msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
        msgClose: c_('Close'),
        msgSolution: c_('Solution'),
        msgTry: c_('Try again!'),
        msgCheck: c_('Check'),
        msgEndScore: c_('You got %s right answers and %d errors.'),
        msgEndTime: c_('Time over.'),
        msgGameEnd: c_('You completed the activity'),
        msgUncompletedActivity: c_('Incomplete activity'),
        msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
        msgTypeGame: c_('Complete'),
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
        msgs.msgEOneQuestion = _('Please provide at least one question');
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
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game',
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.',
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    createForm: function () {
        const html = `
            <div id="completeQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create activities in which the student must fill in the blanks of a text by writing, dragging or selecting the answer.')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/completa.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                     <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevices.iDevice.gamification.instructions.getFieldset(c_('Read the text and complete the missing words.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <p>
                                <span>${_('Type')}:</span>
                                <span class="CMPT-ETypes">
                                    <input class="CMPT-Type" checked="checked" id="cmpttype0" type="radio" name="cmpttype" value="0" />
                                    <label for="cmpttype0">${_('Complete')}</label>
                                    <input class="CMPT-Type" id="cmpttype1" type="radio" name="cmpttype" value="1" />
                                    <label for="cmpttype1">${_('Drag and drop')}</label>
                                    <input class="CMPT-Type" id="cmpttype2" type="radio" name="cmpttype" value="2" />
                                    <label for="cmpttype2">${_('Select')}</label>
                                </span>
                            </p>
                            <p id="cmptEWordsLimitDiv" class="CMPT-EWordsNo">
                                <label for="cmptEWordsLimit"><input type="checkbox" id="cmptEWordsLimit">${_('Limit the words in each dropdown box. Write the possible options, starting with the correct one, separated by |')}</label>
                            </p>
                            <p id="cmptEWordsErrorsDiv" class="CMPT-EWordsNo">
                                <label for="cmptEWordsErrors">${_('Wrong words')}: </label><input type="text" id="cmptEWordsErrors">
                            </p>
                            <p>
                                <label for="cmptAttemptsNumber">${_('Number of attempts')}: 
                                <input type="number" name="cmptAttemptsNumber" id="cmptAttemptsNumber" value="1" min="1" max="9" /></label>
                            </p>
                            <p>
                                <label for="cmptETime">${_('Time (minutes)')}: 
                                <input type="number" name="cmptETime" id="cmptETime" value="0" min="0" max="59" /></label>
                            </p>
                            <p>
                                <label for="cmptEShowSolution"><input type="checkbox" id="cmptEShowSolution">${_('Show solutions')}.</label>
                            </p>
                            <p>
                                <label for="cmptEEstrictCheck"><input type="checkbox" id="cmptEEstrictCheck">${_('Allow errors in typed words')}.</label>
                                <span id="cmptEPercentajeErrorsDiv" class="CMPT-Hide">
                                    <label for="cmptEPercentajeError">${_('Incorrect letters allowed (&percnt;)')}: <input type="number" name="cmptEPercentajeError" id="cmptEPercentajeError" value="20" min="0" max="100" step="5" /></label>
                                </span>
                            </p>
                            <p id="cmptECaseSensitiveDiv">
                                 <label for="cmptECaseSensitive"><input type="checkbox" id="cmptECaseSensitive">${_('Case sensitive')}.</label>
                            </p>
                            <p>
                                <label for="cmptEWordsSize"><input type="checkbox" id="cmptEWordsSize">${_('Field width proportional to the words length')}.</label>
                            </p>
                            <p>
                                <label for="cmptEShowMinimize"><input type="checkbox" id="cmptEShowMinimize">${_('Show minimized.')}</label>
                            </p>
                            <p>
                                <label for="cmptEHasFeedBack"><input type="checkbox" id="cmptEHasFeedBack">${_('Feedback')}.</label> 
                                <label for="cmptEPercentajeFB"><input type="number" name="cmptEPercentajeFB" id="cmptEPercentajeFB" value="100" min="5" max="100" step="5" disabled />${_('&percnt; right to see the feedback')}.</label>
                            </p>
                            <p id="cmptEFeedbackP" class="CMPT-EFeedbackP">
                                <textarea id="cmptEFeedBackEditor" class="exe-html-editor"></textarea>
                            </p>
                            <p class="Games-Reportdiv">
                                <strong class="GameModeLabel"><a href="#cmptEEvaluationHelp" id="cmptEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${$exeDevice.idevicePath}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}" /></a></strong>
                                <label for="cmptEEvaluation"><input type="checkbox" id="cmptEEvaluation">${_('Progress report')}.</label> 
                                <label for="cmptEEvaluationID">${_('Identifier')}:</label> <input type="text" id="cmptEEvaluationID" disabled />
                            </p>
                            <div id="cmptEEvaluationHelp" class="CMPT-TypeGameHelp">
                                <p class="exe-block-info">${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                            </div>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Text')}</a></legend>
                        <div class="CMPT-EPanel" id="cmptEPanel">
                            <p>
                                <label for="cmptEText" class="sr-av">${_('Text')}:</label>
                                <textarea id="cmptEText" class="exe-html-editor">${c_("eXeLearning is a **free** and open source editor to create **educational** resources in an **simple and easy** way. It's available for different **operating** systems.").replace(/\*\*/g, '@@')}</textarea>
                            </p>
                        </div>
                    </fieldset>
                    ${$exeDevices.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevices.iDevice.gamification.itinerary.getTab()}
                ${$exeDevices.iDevice.gamification.scorm.getTab(true)}
                ${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        $exeDevices.iDevice.tabs.init('completeQEIdeviceForm');
        $exeDevices.iDevice.gamification.scorm.init();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            let json = $('.completa-DataGame', wrapper).text();
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                instructions = $('.completa-instructions', wrapper),
                textAfter = $('.completa-extra-content', wrapper),
                textFeedBack = $('.completa-feedback-game', wrapper),
                textText = $('.completa-text-game', wrapper);

            $exeDevice.updateFieldGame(dataGame);

            if (textText.length == 1) $('#cmptEText').val(textText.html());
            if (instructions.length === 1)
                $('#eXeGameInstructions').val(instructions.html());
            if (textAfter.length === 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());
            if (textFeedBack.length === 1)
                $('#cmptEFeedBackEditor').val(textFeedBack.html());

            $exeDevices.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs,
            );
        }
    },

    updateFieldGame: function (game) {
        game.wordsLimit =
            typeof game.wordsLimit === 'undefined' ? false : game.wordsLimit;
        game.evaluation =
            typeof game.evaluation !== 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID !== 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $exeDevices.iDevice.gamification.itinerary.setValues(game.itinerary);

        $('#cmptEShowMinimize').prop('checked', game.showMinimize);
        $('#cmptEShowSolution').prop('checked', game.showSolution);
        $('#cmptECaseSensitive').prop('checked', game.caseSensitive);
        $('#cmptEHasFeedBack').prop('checked', game.feedBack);
        $('#cmptEPercentajeFB').val(game.percentajeFB);
        $('#cmptEPercentajeError').val(game.percentajeError);
        $('#cmptAttemptsNumber').val(game.attempsNumber);
        $('#cmptEEstrictCheck').prop('checked', game.estrictCheck);
        $('#cmptEWordsSize').prop('checked', game.wordsSize);
        $('#cmptETime').val(game.time);
        $('#cmptEWordsErrors').val(game.wordsErrors);
        $('#cmptEWordsLimit').prop('checked', game.wordsLimit);
        $(`input.CMPT-Type[name='cmpttype'][value='${game.type}']`).prop(
            'checked',
            true,
        );
        $('#cmptEEvaluation').prop('checked', game.evaluation);
        $('#cmptEEvaluationID').val(game.evaluationID);
        $('#cmptEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevices.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted,
        );

        if (game.feedBack) {
            $('#cmptEFeedbackP').show();
        } else {
            $('#cmptEFeedbackP').hide();
        }

        $('#cmptEWordsLimitDiv').hide();
        $('#cmptEPercentajeFB').prop('disabled', !game.feedBack);
        $('#cmptEWordsErrorsDiv').hide();

        if (game.type === 2) {
            $('#cmptEWordsLimitDiv').css('display', 'flex').show();
        }

        if (game.type > 0 && !game.wordsLimit) {
            $('#cmptEWordsErrorsDiv').css('display', 'flex').show();
        }

        $('#cmptEPercentajeErrorsDiv').show();
        $('#cmptECaseSensitiveDiv').hide();

        if (!game.estrictCheck) {
            $('#cmptECaseSensitiveDiv').show();
            $('#cmptEPercentajeErrorsDiv').hide();
        }
    },

    importGame: function (content) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (!game || typeof game.typeGame === 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame === 'Completa') {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.updateFieldGame(game);
            const instructions =
                game.instructionsExe || game.instructions || '',
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '',
                textText = game.textText || '';
            if (tinyMCE.get('cmptEText')) {
                tinyMCE.get('cmptEText').setContent(unescape(textText));
            } else {
                $('#cmptEText').val(unescape(textText));
            }
            if (tinyMCE.get('eXeGameInstructions')) {
                tinyMCE
                    .get('eXeGameInstructions')
                    .setContent(unescape(instructions));
            } else {
                $('#eXeGameInstructions').val(unescape(instructions));
            }
            if (tinyMCE.get('cmptEFeedBackEditor')) {
                tinyMCE
                    .get('cmptEFeedBackEditor')
                    .setContent(unescape(textFeedBack));
            } else {
                $('#cmptEFeedBackEditor').val(unescape(textFeedBack));
            }
            if (tinyMCE.get('eXeIdeviceTextAfter')) {
                tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
            } else {
                $('#eXeIdeviceTextAfter').val(unescape(tAfter));
            }
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }
        $('.exe-form-tabs li:first-child a').click();
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
        const dataGame = $exeDevice.validateData();

        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = fields;

        for (const i in fields) {
            const fVal = $('#ci18n_' + i).val();
            if (fVal !== '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame),
            divContent = '';
        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const textFeedBack = tinyMCE.get('cmptEFeedBackEditor').getContent();
        if (dataGame.instructions !== '') {
            divContent = `<div class="completa-instructions">${dataGame.instructions}</div>`;
        }

        let html = '<div class="completa-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += `<div class="completa-feedback-game">${textFeedBack}</div>`;
        html += divContent;
        html += `<div class="completa-DataGame js-hidden">${json}</div>`;

        const textText = tinyMCE.get('cmptEText').getContent();
        if (textText !== '') {
            html += `<div class="completa-text-game js-hidden">${textText}</div>`;
        }

        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            html += `<div class="completa-extra-content">${textAfter}</div>`;
        }

        html += `<div class="cmpt-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';
        return html;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#completeQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textText = tinyMCE.get('cmptEText').getContent(),
            textFeedBack = tinyMCE.get('cmptEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#cmptEShowMinimize').is(':checked'),
            showSolution = $('#cmptEShowSolution').is(':checked'),
            caseSensitive = $('#cmptECaseSensitive').is(':checked'),
            estrictCheck = $('#cmptEEstrictCheck').is(':checked'),
            wordsSize = $('#cmptEWordsSize').is(':checked'),
            time = parseInt($('#cmptETime').val(), 10),
            itinerary = $exeDevices.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#cmptEHasFeedBack').is(':checked'),
            percentajeFB = parseInt($('#cmptEPercentajeFB').val(), 10),
            percentajeError = parseInt($('#cmptEPercentajeError').val(), 10),
            type = parseInt($('input[name=cmpttype]:checked').val(), 10),
            wordsErrors = $('#cmptEWordsErrors').val(),
            wordsLimit = $('#cmptEWordsLimit').is(':checked'),
            attempsNumber = parseInt($('#cmptAttemptsNumber').val(), 10),
            evaluation = $('#cmptEEvaluation').is(':checked'),
            evaluationID = $('#cmptEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();
        if(!itinerary) return;

        if (textText.trim().length === 0) {
            eXe.app.alert($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        const regex = /@@(.*?)@@/;
        if (!regex.test(textText)) {
            eXe.app.alert($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        if (feedBack && textFeedBack.trim().length === 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }

        const scorm = $exeDevices.iDevice.gamification.scorm.getValues();
        return {
            typeGame: 'Completa',
            instructions: instructions,
            textText: escape(textText),
            showMinimize: showMinimize,
            itinerary: itinerary,
            caseSensitive: caseSensitive,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: $exeDevice.version,
            estrictCheck: estrictCheck,
            wordsSize: wordsSize,
            time: time,
            type: type,
            wordsErrors: wordsErrors,
            attempsNumber: attempsNumber,
            percentajeError: percentajeError,
            showSolution: showSolution,
            wordsLimit: wordsLimit,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
    },

    addEvents: function () {
        $('#cmptEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#cmptEFeedbackP').show();
            } else {
                $('#cmptEFeedbackP').hide();
            }
            $('#cmptEPercentajeFB').prop('disabled', !marcado);
        });

        $('#completeQEIdeviceForm').on('click', 'input.CMPT-Type', function () {
            const type = parseInt($(this).val(), 10),
                limit = $('#cmptEWordsLimit').is(':checked');
            $('#cmptEWordsLimitDiv').hide();
            $('#cmptEWordsErrorsDiv').hide();
            if (type === 2) {
                $('#cmptEWordsLimitDiv').css('display', 'flex').show();
            }
            if (type > 0 && !limit) {
                $('#cmptEWordsErrorsDiv').css('display', 'flex').show();
            }
        });

        $('#cmptEWordsLimit').on('click', function () {
            const limit = $(this).is(':checked');
            $('#cmptEWordsErrorsDiv').hide();
            if (!limit) {
                $('#cmptEWordsErrorsDiv').css('display', 'flex').show();
            }
        });

        $('#cmptEEstrictCheck').on('change', function () {
            const state = $(this).is(':checked');
            $('#cmptECaseSensitiveDiv').show();
            $('#cmptEPercentajeErrorsDiv').hide();
            if (state) {
                $('#cmptECaseSensitiveDiv').hide();
                $('#cmptEPercentajeErrorsDiv').show();
            }
        });

        $('#cmptETime')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = this.value.trim();
                val = val === '' ? '0' : val;
                val = Math.min(Math.max(parseInt(val, 10), 0), 59);
                this.value = val;
            });

        $('#cmptAttemptsNumber')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = this.value.trim();
                val = val === '' ? '1' : val;
                val = Math.min(Math.max(parseInt(val, 10), 1), 9);
                this.value = val;
            });

        $('#cmptEPercentajeError')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = this.value.trim();
                val = val === '' ? '1' : val;
                val = Math.min(Math.max(parseInt(val, 10), 0), 100);
                this.value = val;
            });

        $('#cmptEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#cmptEEvaluationID').prop('disabled', !marcado);
        });

        $('#cmptEEvaluationHelpLnk').on('click', function () {
            $('#cmptEEvaluationHelp').toggle();
            return false;
        });

        $exeDevices.iDevice.gamification.itinerary.addEvents();

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },
};
