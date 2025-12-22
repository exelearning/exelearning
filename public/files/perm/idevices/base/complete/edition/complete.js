/* eslint-disable no-undef */
/**
 * Complete iDevice (edition code)
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
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            msgEndGameScore: c_(
                'Please start the game before saving your score.'
            ),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgAnswer: c_('Answer'),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgInformation: c_('Information'),
            msgYouScore: c_('Your score'),
            msgAuthor: c_('Authorship'),
            msgOnlySaveAuto: c_(
                'Your score will be saved after each question. You can only play once.'
            ),
            msgSaveAuto: c_(
                'Your score will be automatically saved after each question.'
            ),
            msgSeveralScore: c_(
                'You can save the score as many times as you want'
            ),
            msgYouLastScore: c_('The last score saved is'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_(
                'You can do this activity as many times as you want'
            ),
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
        };
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
            'Errors (number of attempts) to display the message'
        );
        msgs.msgEnterCustomMessage = _('Please write the error message.');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
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
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Read the text and complete the missing words.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="mb-3 d-flex align-items-center gap-2">
                                <span>${_('Type')}:</span>
                                <div class="form-check form-check-inline m-0">
                                    <input class="CMPT-Type form-check-input" checked="checked" id="cmpttype0" type="radio" name="cmpttype" value="0" />
                                    <label class="form-check-label" for="cmpttype0">${_('Complete')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="CMPT-Type form-check-input" id="cmpttype1" type="radio" name="cmpttype" value="1" />
                                    <label class="form-check-label" for="cmpttype1">${_('Drag and drop')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="CMPT-Type form-check-input" id="cmpttype2" type="radio" name="cmpttype" value="2" />
                                    <label class="form-check-label" for="cmpttype2">${_('Select')}</label>
                                </div>
                            </div>
                            <div id="cmptEWordsLimitDiv" class="CMPT-EWordsNo mb-3">
                                <span class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptEWordsLimit" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptEWordsLimit" class="toggle-label">${_('Limit the words in each dropdown box. Write the possible options, starting with the correct one, separated by |')}</label>
                                </span>
                            </div>
                            <div id="cmptEWordsErrorsDiv" class="CMPT-EWordsNo mb-3 align-items-center gap-2 flex-nowrap">
                                <label for="cmptEWordsErrors">${_('Wrong words')}: </label><input type="text" id="cmptEWordsErrors" class="form-control">
                            </div>
                            <div id="cmptAttemptsNumberDiv" class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                                <label for="cmptAttemptsNumber">${_('Number of attempts')}:</label> 
                                <input type="number" name="cmptAttemptsNumber" id="cmptAttemptsNumber" value="1" min="1" max="9" class="form-control" />
                            </div>
                            <div id="cmptETimeDiv" class="d-flex mb-3 align-items-center gap-2 flex-nowrap">
                                <label for="cmptETime">${_('Time (minutes)')}:</label> 
                                <input type="number" name="cmptETime" id="cmptETime" value="0" min="0" max="59" class="form-control" />
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptEShowSolution" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptEShowSolution" class="toggle-label">${_('Show solutions')}.</label>
                                </span>
                            </div>
                            <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                                <span class="toggle-item ">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptEEstrictCheck" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptEEstrictCheck" class="toggle-label">${_('Allow errors in typed words')}.</label>
                                </span>
                                <span id="cmptEPercentajeErrorsDiv" class="CMPT-Hide  align-items-center gap-2 flex-nowrap">
                                    <label for="cmptEPercentajeError">${_('Incorrect letters allowed (&percnt;)')}:</label><input type="number" name="cmptEPercentajeError" id="cmptEPercentajeError" value="20" min="0" max="100" step="5" class="form-control" />
                                </span>
                            </div>
                            <div id="cmptECaseSensitiveDiv" class="mb-3">
                                <span class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptECaseSensitive" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptECaseSensitive" class="toggle-label">${_('Case sensitive')}.</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item mb-3">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptEWordsSize" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptEWordsSize" class="toggle-label">${_('Field width proportional to the words length')}.</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptEShowMinimize" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptEShowMinimize" class="toggle-label">${_('Show minimized.')}</label>
                                </span>
                            </div>
                            <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                                <span class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptEHasFeedBack" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptEHasFeedBack" class="toggle-label">${_('Feedback')}.</label>
                                </span>
                                <span class="d-flex align-items-center gap-2 flex-nowrap">
                                    <input type="number" name="cmptEPercentajeFB" id="cmptEPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" /><label for="cmptEPercentajeFB">${_('&percnt; right to see the feedback')}.</label>
                                </span>
                            </div>
                            <div id="cmptEFeedbackP" class="CMPT-EFeedbackP mb-3">
                                <textarea id="cmptEFeedBackEditor" class="exe-html-editor"></textarea>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptBack0" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="cmptBack0">${_('Background')}:</label>
                                </span>                            
                                <div class="d-flex align-items-center gap-2 flex-nowrap d-none" id="cmptbackground1">
                                    <label for="cmptEURLBack" class="mb-0">${_('URL')}: </label>
                                    <input type="text" class="exe-file-picker CMPT-EURLImage form-control me-0" id="cmptEURLBack"/>
                                    <a href="#" id="cmptEPlayBack" class="CMPT-ENavigationButton CMPTEPlayVideo" title="${_('Show')}">
                                        <img src="${$exeDevice.idevicePath}quextIEPlay.png" alt="${_('Show')}" class="CMPT-EButtonImage " />
                                    </a>
                                </div>
                             </div>
                            <div id="cmptbackground" class="CMPT-Back mb-3">
                                <img class="CMPT-EMedia1" src="" id="cmptEImageBack" alt="${_('Image')}" />
                                <img class="CMPT-EMedia1" src="${$exeDevice.idevicePath}cmptbackground.png" id="cmptEImageNoBack" alt="${_('No image')}" />
                            </div>
                            <div id="cmptFontColorDiv" class="CMPT-FontColor d-none align-items-center gap-2 flex-nowrap mb-3">
                                <label for="cmptEFontColor" class="mb-0">${_('Font color')}: </label>
                                <input type="color" id="cmptEFontColor" class="form-control form-control-color" value="#000000"/>
                            </div>
                            <div id="cmptAuthorBackDiv" class="CMPT-AuthorBack d-none align-items-center gap-2 flex-nowrap mb-3">
                                <label for="cmptAuthorBack" class="mb-0">${_('Authorship')}: </label>
                                <input type="text" class="CMPT-EURLImage form-control" id="cmptAuthorBack"/>
                            </div>
                            <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-nowrap">
                                <span class="toggle-item">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="cmptEEvaluation" class="toggle-input" data-target="#cmptEEvaluationIDWrapper" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="cmptEEvaluation" class="toggle-label">${_('Progress report')}.</label>
                                </span>
                                <span id="cmptEEvaluationIDWrapper" class="d-flex align-items-center flex-nowrap gap-2">
                                    <label for="cmptEEvaluationID">${_('Identifier')}:</label> <input type="text" id="cmptEEvaluationID" class="form-control" disabled value="${eXeLearning.app.project.odeId || ''}" />
                                </span>
                                <strong class="GameModeLabel"><a href="#cmptEEvaluationHelp" id="cmptEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${$exeDevice.idevicePath}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" /></a></strong>

                            </div>
                            <p id="cmptEEvaluationHelp" class="CMPT-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
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
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab(true)}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('completeQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

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
                textText = $('.completa-text-game', wrapper),
                $imageBack = $('.completa-LinkBack', wrapper);

            if ($imageBack.length === 1) {
                dataGame.urlBack = $imageBack.attr('href') || '';
            }

            $exeDevice.updateFieldGame(dataGame);

            if (textText.length == 1) $('#cmptEText').val(textText.html());
            if (instructions.length === 1)
                $('#eXeGameInstructions').val(instructions.html());
            if (textAfter.length === 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());
            if (textFeedBack.length === 1)
                $('#cmptEFeedBackEditor').val(textFeedBack.html());

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
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
        game.hasBack =
            typeof game.hasBack !== 'undefined' ? game.hasBack : false;
        game.urlBack = typeof game.urlBack !== 'undefined' ? game.urlBack : '';
        game.authorBackImage =
            typeof game.authorBackImage !== 'undefined'
                ? game.authorBackImage
                : '';
        game.fontColor =
            typeof game.fontColor !== 'undefined' ? game.fontColor : '';
        $exeDevice.id = $exeDevice.getIdeviceID();

        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );

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
            true
        );
        $('#cmptEEvaluation').prop('checked', game.evaluation);
        $('#cmptEEvaluationID').val(game.evaluationID);
        $('#cmptEEvaluationID').prop('disabled', !game.evaluation);
        $('#cmptBack0').prop('checked', game.hasBack);
        $('#cmptEURLBack').val(game.urlBack);
        $('#cmptAuthorBack').val(game.authorBackImage);
        $('#cmptEFontColor').val(game.fontColor || '#000000');

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
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

        $('#cmptEPercentajeErrorsDiv').css('display', 'flex');
        $('#cmptECaseSensitiveDiv').hide();

        if (!game.estrictCheck) {
            $('#cmptECaseSensitiveDiv').show();
            $('#cmptEPercentajeErrorsDiv').hide();
        }

        $exeDevice.showImageBack(game.hasBack, game.urlBack);

        // Show font color selector if background is configured
        if (game.hasBack && game.urlBack && game.urlBack.length > 4) {
            $('#cmptFontColorDiv').removeClass('d-none').addClass('d-flex');
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
        //$('.exe-form-tabs li:first-child a').click();
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

        let img = $('#cmptEURLBack').val();
        if (img.trim().length > 4) {
            img = `<a href="${img}" class="js-hidden completa-LinkBack" alt="Back" />Background</a>`;
        } else {
            img = '';
        }

        let html = '<div class="completa-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += `<div class="completa-feedback-game">${textFeedBack}</div>`;
        html += divContent;
        html += `<div class="completa-DataGame js-hidden">${json}</div>`;

        const textText = tinyMCE.get('cmptEText').getContent();
        if (textText !== '') {
            html += `<div class="completa-text-game js-hidden">${textText}</div>`;
        }

        html += img;

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
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#cmptEHasFeedBack').is(':checked'),
            percentajeFB = parseInt($('#cmptEPercentajeFB').val(), 10),
            percentajeError = parseInt($('#cmptEPercentajeError').val(), 10),
            type = parseInt($('input[name=cmpttype]:checked').val(), 10),
            wordsErrors = $('#cmptEWordsErrors').val(),
            wordsLimit = $('#cmptEWordsLimit').is(':checked'),
            attempsNumber = parseInt($('#cmptAttemptsNumber').val(), 10),
            evaluation = $('#cmptEEvaluation').is(':checked'),
            evaluationID = $('#cmptEEvaluationID').val(),
            hasBack = $('#cmptBack0').is(':checked'),
            urlBack = $('#cmptEURLBack').val().trim(),
            authorBackImage = $('#cmptAuthorBack').val(),
            fontColor = $('#cmptEFontColor').val(),
            id = $exeDevice.getIdeviceID();
        if (!itinerary) return;

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

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
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
            hasBack: hasBack,
            urlBack: urlBack,
            authorBackImage: authorBackImage,
            fontColor: fontColor,
            id: id,
        };
    },

    addEvents: function () {
        const $form = $('#completeQEIdeviceForm');

        // Toggle genérico: sincroniza aria-checked y muestra/oculta el target si existe
        $form.on('change', '.toggle-input', function () {
            const checked = $(this).is(':checked');
            $(this).attr('aria-checked', checked);
            const target = $(this).data('target');
            if (target) $(target).toggle(checked);
        });

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
            $('#cmptEPercentajeErrorsDiv').css('display', 'flex');
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

        $('#cmptBack0').on('change', function () {
            if ($(this).is(':checked')) {
                $(
                    '#cmptbackground, #cmptbackground1, #cmptAuthorBackDiv, #cmptFontColorDiv'
                )
                    .removeClass('d-none')
                    .addClass('d-flex');
            } else {
                $(
                    '#cmptbackground, #cmptbackground1, #cmptAuthorBackDiv, #cmptFontColorDiv'
                )
                    .removeClass('d-flex')
                    .addClass('d-none');
            }
        });

        $('#cmptEPlayBack').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#cmptEURLBack').val(),
                ext = selectedFile.split('.').pop().toLowerCase(),
                hasBack = $('#cmptBack0').is(':checked');
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            $exeDevice.showImageBack(hasBack, selectedFile);
        });

        $('#cmptEURLBack').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase(),
                hasBack = $('#cmptBack0').is(':checked');
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            $exeDevice.showImageBack(hasBack, selectedFile);
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();

        $form.find('.toggle-input').each(function () {
            const checked = $(this).is(':checked');
            $(this).attr('aria-checked', checked).trigger('change');
        });

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    showImageBack: function (hasback, url) {
        const $image = $('#cmptEImageBack'),
            $imageno = $('#cmptEImageNoBack');
        $image.hide();
        $imageno.show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        if (hasback && url.length > 4) {
            $image
                .prop('src', url)
                .on('load', function () {
                    $image.show();
                    $imageno.hide();
                })
                .on('error', function () {});
        }
    },
};
