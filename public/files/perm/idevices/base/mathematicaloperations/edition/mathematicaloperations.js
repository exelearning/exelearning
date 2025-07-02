/* eslint-disable no-undef */
/**
/**
 * Mathematical Operations Activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros
 * Author: Manuel Narvaez Martinez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Games'),
        name: _('Math operations'),
    },
    msgs: {},
    classIdevice: 'mathematicaloperations',
    defaultSettings: {
        modo: 0,
        type: 'result', // result, operator, operandA, operandB, random (to guess)
        number: 10, // Number or operations
        operations: '1111', // Add, subtract, multiply, divide,
        min: -1000, // Smallest number included
        max: 1000, // Highest number included
        decimalsInOperands: 0, // Allow decimals
        decimalsInResults: 1, // Allow decimals in results
        negative: 1, // Allow negative results
        zero: 1, // Allow zero in results
    },
    idevicePath: '',
    id: false,
    domains: [],
    ci18n: {
        msgHappen: c_('Move on'),
        msgReply: c_('Reply'),
        msgSubmit: c_('Submit'),
        msgEnterCode: c_('Enter the access code'),
        msgErrorCode: c_('The access code is not correct'),
        msgGameOver: c_('Game Over!'),
        msgClue: c_('Cool! The clue is:'),
        msgYouHas: c_('You have got %1 hits and %2 misses'),
        msgCodeAccess: c_('Access code'),
        msgPlayAgain: c_('Play Again'),
        msgRequiredAccessKey: c_('Access code required'),
        msgInformationLooking: c_('Cool! The information you were looking for'),
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
        mgsAllQuestions: c_('Questions completed!'),
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
        msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: c_('Your score will be automatically saved after each question.'),
        msgSeveralScore: c_('You can save the score as many times as you want'),
        msgYouLastScore: c_('The last score saved is'),
        msgActityComply: c_('You have already done this activity.'),
        msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
        msgPrevious: c_('Previous'),
        msgNext: c_('Next'),
        msgQuestion: c_('Question'),
        msgCorrect: c_('Correct'),
        msgClose: c_('Close'),
        msgSolution: c_('Solution'),
        msgCheck: c_('Check'),
        msgWithoutAnswer: c_('Not answered'),
        msgReplied: c_('Answered'),
        msgCorrects: c_('Right'),
        msgIncorrects: c_('Wrong'),
        msgIncomplete: c_('Not completed'),
        msgEndTime: c_('Time over.'),
        msgAllOperations: c_('You finished all the operations.'),
        msgFracctionNoValid: c_('Write a valid fraction.'),
        msgOperatNotValid: c_('Write a valid operator: +-x*/:'),
        msgNewGame: c_('Click here to play'),
        msgUncompletedActivity: c_('Incomplete activity'),
        msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
        msgTypeGame: c_('Math operations'),
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
        msgs.msgEProvideDefinition = _('Please provide the definition of the word or phrase');
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game',
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image',
        );
        msgs.msgEProvideWord = _('Please provide one word or phrase');
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgEUnavailableVideo = _('This video is not currently available');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgECompleteAllOptions = _(
            'You have to complete all the selected options',
        );
        msgs.msgESelectSolution = _('Choose the right answer');
        msgs.msgECompleteURLYoutube = _(
            'Type the right URL of a Youtube video',
        );
        msgs.msgEStartEndVideo = _(
            'You have to indicate the start and the end of the video that you want to show',
        );
        msgs.msgEStartEndIncorrect = _(
            'The video end value must be higher than the start one',
        );
        msgs.msgWriteText = _('You have to type a text in the editor');
        msgs.msgSilentPoint = _(
            'The silence time is wrong. Check the video duration.',
        );
        msgs.msgTypeChoose = _(
            'Please check all the answers in the right order',
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.',
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters',
        );
    },
    createForm: function () {
        const html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible">
                    ${_('Create basic math operation games (addition, subtraction, multiplication, division). The student will have to guess the result, operator or an operand.')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/operaciones_matemticas.html" hreflang="es" target="_blank">
                        ${_('Usage Instructions')}
                    </a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevices.iDevice.gamification.instructions.getFieldset(c_('Solve the following operations.'))}
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <p id="eRMQFractionsDiv" style="display:none">
                                <label for="eRMQFractions"><input id="eRMQFractions" type="checkbox" />${_('Fractions')}.</label>
                            </p>
                            <p>
                                <label for="eRMQtype">${_('Choose what to guess:')}
                                    <select id="eRMQtype">
                                        <option value="result">${_('Result')}</option>
                                        <option value="operator">${_('Operator')}</option>
                                        <option value="operandA">${_('First operand')}</option>
                                        <option value="operandB">${_('Second operand')}</option>
                                        <option value="random">${_('Random')}</option>
                                    </select>
                                </label>
                            </p>
                            <p>
                                <label for="eRMQnum">${_('Number of operations:')}
                                    <input id="eRMQnum" type="text" style="width:80px" value="10" onkeyup="$exeDevice.onlyNumbers(this)" />
                                </label>
                                <label for="eRMQmin">${_('Smallest number:')}
                                    <input id="eRMQmin" type="text" style="width:80px"  value="1" onkeyup="$exeDevice.onlyNumbers(this)" />
                                </label>
                                <label for="eRMQmax">${_('Biggest number:')}
                                    <input id="eRMQmax" type="text" style="width:80px"  value="9" onkeyup="$exeDevice.onlyNumbers(this)" />
                                </label>
                            </p>
                            <p id="eRMQdecimalsDiv">
                                <label for="eRMQdecimals">${_('Number of decimals (operands):')}
                                    <select id="eRMQdecimals" onchange="$exeDevice.setDecimalsInResults(this.value)">
                                        <option value="0">0</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                    </select>
                                </label>
                            </p>
                            <p>
                                <strong>${_('Operations:')}</strong>
                                <label for="eRMQadd"><input id="eRMQadd" type="checkbox" /> ${_('Addition')}</label>
                                <label for="eRMQsubs"><input id="eRMQsubs" type="checkbox" /> ${_('Subtraction')}</label>
                                <label for="eRMQmult"><input id="eRMQmult" type="checkbox" checked /> ${_('Multiplication')}</label>
                                <label for="eRMQdiv"><input id="eRMQdiv" type="checkbox" /> ${_('Division')}</label>
                            </p>
                            <p id="eRMQdecimalsResultDiv">
                                <label for="eRMQdecimalsInResults"><input id="eRMQdecimalsInResults" type="checkbox" /> ${_('Allow decimals in the results')}</label>
                            </p>
                            <p id="eRMQSolutionDiv" style="display:none">
                                <label for="eRMQSolution"><input id="eRMQSolution" type="checkbox" checked/> ${_('Irreducible fraction.')}</label>
                            </p>
                            <p id="eRMQnegativeDiv">
                                <label for="eRMQnegative"><input id="eRMQnegative" type="checkbox" /> ${_('Allow negative results')}</label>
                            </p>
                            <p id="eRMQNegativesFractionsDiv" style="display:none">
                                <label for="eRMQNegativesFractions"><input id="eRMQNegativesFractions" type="checkbox" /> ${_('Allow negative')}.</label>
                            </p>
                            <p id="eRMQZeroDiv">
                                <label for="eRMQzero"><input id="eRMQzero" type="checkbox" /> ${_('Allow zero as a result')}</label>
                            </p>
                            <p id="eRMQErrorRelativeDiv">
                                <input class="MTOE-ErrorType" id="eRMQRelative" type="checkbox" name="eRMQtype" value="0" />
                                <label for="eRMQRelative">${_('Relative error')}</label>
                                <label for="eRMQPercentajeRelative" class="sr-av">${_('Relative error')}</label>
                                <input type="number" name="eRMQPercentajeRelative" id="eRMQPercentajeRelative" value="0" min="0" max="1" step="0.01" style="display:none; width:70px"/>
                            </p>
                            <p id="eRMQErrorAbsoluteDiv">
                                <input class="MTOE-ErrorType" id="eRMQAbsolute" type="checkbox" name="eRMQtype" value="1" />
                                <label for="eRMQAbsolute">${_('Absolute error')}</label>
                                <label for="eRMQPercentajeAbsolute" class="sr-av">${_('Absolute error')}</label>
                                <input type="number" name="eRMQPercentajeAbsolute" id="eRMQPercentajeAbsolute" value="0" min="0" max="99.0" step="0.01" style="display:none; width:70px" />
                            </p>
                            <p>
                                <label for="eRMQShowMinimize"><input type="checkbox" id="eRMQShowMinimize"> ${_('Show minimized.')}</label>
                            </p>
                            <p>
                                <label for="eRMQTime">${_('Time (minutes)')}: 
                                    <input type="number" name="eRMQTime" id="eRMQTime" value="0" min="0" max="59" />
                                </label>
                            </p>
                            <p>
                                <label for="eRMQHasFeedBack"><input type="checkbox" id="eRMQHasFeedBack"> ${_('Feedback')}. </label>
                                <label for="eRMQPercentajeFB"><input type="number" name="eRMQPercentajeFB" id="eRMQPercentajeFB" value="100" min="5" max="100" step="5" disabled /> ${_('% right to see the feedback')}.</label>
                            </p>
                            <p id="eRMQFeedbackP" class="MTOE-EFeedbackP">
                                <textarea id="eRMQFeedBackEditor" class="exe-html-editor"></textarea>
                            </p>
                            <p class="Games-Reportdiv">
                                <strong class="GameModeLabel">
                                    <a href="#eRMQEEvaluationHelp" id="eRMQEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${$exeDevice.idevicePath}quextIEHelp.gif" width="16" height="16" alt="${_('Help')}" />
                                    </a>
                                </strong>
                                <input type="checkbox" id="eRMQEEvaluation">  <label for="eRMQEEvaluation">${_('Progress report')}.</label>
                                <label for="eRMQEEvaluationID"></label>${_('Identifier')}:<input type="text" id="eRMQEEvaluationID" disabled/> 
                            </p>
                            <div id="eRMQEEvaluationHelp" class="MTOE-TypeGameHelp exe-block-info">
                                <p>${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}</p>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevices.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevices.iDevice.gamification.itinerary.getTab()}
                ${$exeDevices.iDevice.gamification.scorm.getTab()}
                ${$exeDevices.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;
        this.ideviceBody.innerHTML = html;
        $exeDevices.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevices.iDevice.gamification.scorm.init();
        $exeDevice.enableForm();
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#gameQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('eRMQFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#eRMQShowMinimize').is(':checked'),
            type = $('#eRMQtype').val(),
            itinerary = $exeDevices.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#eRMQHasFeedBack').is(':checked'),
            percentajeFB = parseInt($('#eRMQPercentajeFB').val()),
            decimalsInOperands = parseInt($('#eRMQdecimals').val()),
            decimalsInResults = $('#eRMQdecimalsInResults').is(':checked'),
            negative = $('#eRMQnegative').is(':checked'),
            solution = $('#eRMQSolution').is(':checked'),
            negativeFractions = $('#eRMQNegativesFracctions').is(':checked'),
            zero = $('#eRMQzero').is(':checked'),
            time = parseInt($('#eRMQTime').val()),
            errorRelative = parseFloat($('#eRMQPercentajeRelative').val()),
            errorAbsolute = parseFloat($('#eRMQPercentajeAbsolute').val()),
            mode = $('#eRMQFractions').is(':checked') ? 1 : 0,
            evaluation = $('#eRMQEEvaluation').is(':checked'),
            evaluationID = $('#eRMQEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        let errorType = 0;
        if ($('#eRMQRelative').is(':checked')) {
            errorType = 1;
        } else if ($('#eRMQAbsolute').is(':checked')) {
            errorType = 2;
        }

        let num = $('#eRMQnum');
        if (num.val() == '') {
            $exeDevice.showMessage(
                _('Please specify the number of operations'),
            );
            num.focus();
            return false;
        }
        num = num.val();
        let min = $('#eRMQmin');
        if (min.val() == '') {
            $exeDevice.showMessage(
                _('Please define the minimal value of the operand'),
            );
            min.focus();
            return false;
        }
        min = min.val();
        // max
        let max = $('#eRMQmax');
        if (max.val() == '') {
            $exeDevice.showMessage(
                _('Please define the highest value of the operand'),
            );
            max.focus();
            return false;
        }
        max = max.val();
        let operations = '';

        if (parseInt(min) >= parseInt(max)) {
            $exeDevice.showMessage(
                _('The highest number should be bigger than the smallest one'),
            );
            return false;
        }
        // Add
        if ($('#eRMQadd').is(':checked')) operations += '1';
        else operations += '0';
        // Subtract
        if ($('#eRMQsubs').is(':checked')) operations += '1';
        else operations += '0';
        // Multiply
        if ($('#eRMQmult').is(':checked')) operations += '1';
        else operations += '0';
        // Divide
        if ($('#eRMQdiv').is(':checked')) operations += '1';
        else operations += '0';
        if (operations == '0000') {
            $exeDevice.showMessage(_('No operations selected'));
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        if (!itinerary) return false;

        const scorm = $exeDevices.iDevice.gamification.scorm.getValues();
        return {
            typeGame: 'MathOperations',
            instructions: instructions,
            showMinimize: showMinimize,
            type: type,
            number: num,
            operations: operations,
            min: min,
            max: max,
            decimalsInOperands: decimalsInOperands,
            decimalsInResults: decimalsInResults,
            negative: negative,
            zero: zero,
            itinerary: itinerary,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: $exeDevice.version,
            time: time,
            errorAbsolute: errorAbsolute,
            errorRelative: errorRelative,
            errorType: errorType,
            mode: mode,
            negativeFractions: negativeFractions,
            solution: solution,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
    },

    onlyNumbers: function (e) {
        let valorActual = e.value,
            valorSoloNumeros = valorActual.replace(/[^0-9]/g, '');
        e.value = valorSoloNumeros;
    },

    onlyNumbers1: function (e) {
        let str = e.value,
            lastCharacter = str.slice(-1);
        if (isNaN(parseFloat(lastCharacter))) {
            e.value = str.substring(0, str.length - 1);
        }
    },

    setDecimalsInResults: function (v) {
        if (v == 0) $('#eRMQdecimalsInResults').prop('disabled', false);
        else
            $('#eRMQdecimalsInResults')
                .prop('checked', true)
                .attr('disabled', 'disabled');
    },
    enableForm: function () {
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;
        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            const json = $('.mathoperations-DataGame', wrapper).text(),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json);

            $exeDevice.updateFieldGame(dataGame);

            let instructions = $('.mathoperations-instructions', wrapper);
            if (instructions.length == 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textFeedBack = $('.mathoperations-feedback-game', wrapper);
            if (textFeedBack.length == 1) {
                textFeedBack = textFeedBack.html() || '';
                $('#eRMQFeedBackEditor').val(textFeedBack);
            }

            let textAfter = $('.mathoperations-extra-content', wrapper);
            if (textAfter.length == 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }
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
        const dataGame = $exeDevice.validateData();

        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame),
            divContent = '';
        
        
        const textFeedBack = tinyMCE.get('eRMQFeedBackEditor').getContent();
        if (dataGame.instructions != '')
            divContent =
                '<div class="mathoperations-instructions gameQP-instructions">' +
                dataGame.instructions +
                '</div>';

        let html = '<div class="mathoperations-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="mathoperations-version js-hidden">' +
            $exeDevice.version +
            '</div>';
        html +=
            '<div class="mathoperations-feedback-game">' +
            textFeedBack +
            '</div>';
        html += divContent;
        html +=
            '<div class="mathoperations-DataGame js-hidden">' + json + '</div>';
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html +=
                '<div class="mathoperations-extra-content">' +
                textAfter +
                '</div>';
        }
        
        html +=
            '<div class="mathoperations-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addEvents: function () {
        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').on('change', function (e) {
                let file = e.target.files[0];
                if (!file) {
                    return;
                }
                let reader = new FileReader();
                reader.onload = function (e) {
                    $exeDevice.importGame(e.target.result);
                };
                reader.readAsText(file);
            });
            $('#eXeGameExportGame').on('click', function () {
                $exeDevice.exportGame();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }

        $('#eRMQHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#eRMQFeedbackP').show();
            } else {
                $('#eRMQFeedbackP').hide();
            }
            $('#eRMQPercentajeFB').prop('disabled', !marcado);
        });

        $('#eRMQTime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });

        $('#eRMQTime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 59 ? 59 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#eRMQRelative').on('change', function () {
            const type = $(this).is(':checked') ? 1 : 0;
            $exeDevice.setErrorType(type);
        });

        $('#eRMQAbsolute').on('change', function () {
            const type = $(this).is(':checked') ? 2 : 0;
            $exeDevice.setErrorType(type);
        });

        $('#eRMQPercentajeRelative').on('keypress', function (evt) {
            let ASCIICode = evt.which ? evt.which : evt.keyCode;
            if (
                ASCIICode != 0o54 &&
                ASCIICode != 0o56 &&
                ASCIICode > 31 &&
                (ASCIICode < 48 || ASCIICode > 57)
            )
                return false;
            return true;
        });

        $('#eRMQPercentajeRelative').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 1 ? 1 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#eRMQPercentajeAbsolute').on('keypress', function (evt) {
            const ASCIICode = evt.which ? evt.which : evt.keyCode;
            if (
                ASCIICode != 0o54 &&
                ASCIICode != 0o56 &&
                ASCIICode > 31 &&
                (ASCIICode < 48 || ASCIICode > 57)
            )
                return false;
            return true;
        });

        $('#eRMQPercentajeAbsolute').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $exeDevices.iDevice.gamification.itinerary.addEvents();

        $('#eRMQFractions').on('change', function () {
            const number = $(this).is(':checked') ? 1 : 0;
            $exeDevice.changeGameMode(number);
        });

        $('#eRMQEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#eRMQEEvaluationID').prop('disabled', !marcado);
        });

        $('#eRMQEEvaluationHelpLnk').click(function () {
            $('#eRMQEEvaluationHelp').toggle();
            return false;
        });
    },

    setErrorType: function (type) {
        $('#eRMQAbsolute').prop('checked', false);
        $('#eRMQRelative').prop('checked', false);
        $('#eRMQPercentajeAbsolute').hide();
        $('#eRMQPercentajeRelative').hide();
        if (type === 1) {
            $('#eRMQRelative').prop('checked', true);
            $('#eRMQPercentajeRelative').show();
        } else if (type === 2) {
            $('#eRMQAbsolute').prop('checked', true);
            $('#eRMQPercentajeAbsolute').show();
        }
    },

    updateFieldGame: function (game) {
        $exeDevices.iDevice.gamification.itinerary.setValues(game.itinerary);
        game.mode = typeof game.mode == 'undefined' ? 0 : game.mode;
        game.solution =
            typeof game.solution == 'undefined' ? true : game.solution;
        game.errorType =
            typeof game.errorType == 'undefined' ? 0 : game.errorType;
        game.errorRelative =
            typeof game.errorRelative == 'undefined' ? 0.0 : game.errorRelative;
        game.errorAbsolute =
            typeof game.errorAbsolute == 'undefined' ? 0.0 : game.errorAbsolute;
        game.negativeFractions =
            typeof game.negativeFractions == 'undefined'
                ? false
                : game.negativeFractions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;            
        game.percentajeFB =  game.percentajeFB ?? 100;

        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#eRMQShowMinimize').prop('checked', game.showMinimize);
        $('#eRMQHasFeedBack').prop('checked', game.feedBack);
        $('#eRMQPercentajeFB').val(game.percentajeFB);
        $('#eRMQdecimals').val(game.decimalsInOperands);
        $('#eRMQtype').val(game.type);
        $('#eRMQdecimalsInResults').prop('checked', game.decimalsInResults);
        $('#eRMQnegative').prop('checked', game.negative);
        $('#eRMQSolution').prop('checked', game.solution);
        $('#eRMQNegativesFracctions').prop('checked', game.negativeFractions);
        $('#eRMQzero').prop('checked', game.zero);
        $('#eRMQnum').val(game.number);
        $('#eRMQmax').val(game.max);
        $('#eRMQmin').val(game.min);
        $('#eRMQadd').prop('checked', game.operations.charAt(0) == '1');
        $('#eRMQsubs').prop('checked', game.operations.charAt(1) == '1');
        $('#eRMQmult').prop('checked', game.operations.charAt(2) == '1');
        $('#eRMQdiv').prop('checked', game.operations.charAt(3) == '1');
        $('#eRMQPercentajeRelative').val(game.errorRelative);
        $('#eRMQPercentajeAbsolute').val(game.errorAbsolute);
        $('#eRMQTime').val(game.time);
        $('#eRMQFractions').prop('checked', game.mode == 1);
        $('#eRMQEEvaluation').prop('checked', game.evaluation);
        $('#eRMQEEvaluationID').val(game.evaluationID);
        $('#eRMQEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevice.setErrorType(game.errorType);
        $exeDevice.changeGameMode(game.mode);
        $exeDevices.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted,
        );

        if (game.feedBack) {
            $('#eRMQFeedbackP').show();
        } else {
            $('#eRMQFeedbackP').hide();
        }
        $('#eRMQPercentajeFB').prop('disabled', !game.feedBack);
    },
    changeGameMode: function (mode) {
        if (mode == 1) {
            $('#eRMQdecimalsDiv').hide();
            $('#eRMQdecimalsResultDiv').hide();
            $('#eRMQZeroDiv').hide();
            $('#eRMQErrorRelativeDiv').hide();
            $('#eRMQErrorAsoluteDiv').hide();
            $('#eRMQNegativesFracctionsDiv').show();
            $('#eRMQSolutionDiv').show();
            $('#eRMQnegativeDiv').hide();
        } else {
            $('#eRMQdecimalsDiv').show();
            $('#eRMQdecimalsResultDiv').show();
            $('#eRMQZeroDiv').show();
            $('#eRMQErrorRelativeDiv').show();
            $('#eRMQErrorAsoluteDiv').show();
            $('#eRMQNegativesFracctionsDiv').hide();
            $('#eRMQSolutionDiv').hide();
            $('#eRMQnegativeDiv').show();
        }
    },

    exportGame: function () {
        const dataGame = this.validateData();

        if (!dataGame) return false;

        let blob = JSON.stringify(dataGame),
            newBlob = new Blob([blob], {
                type: 'text/plain',
            });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }

        const data = window.URL.createObjectURL(newBlob);
        let link = document.createElement('a');
        link.href = data;
        link.download = _('Activity') + '-MathOperations.json';
        document.getElementById('gameQEIdeviceForm').appendChild(link);
        link.click();

        setTimeout(function () {
            document.getElementById('gameQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    importGame: function (content) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (!game || typeof game.typeGame == 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame !== 'MathOperations') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }

        game.id = $exeDevice.getIdeviceID();
        $exeDevice.updateFieldGame(game);

        const instructions = game.instructionsExe || game.instructions,
            tAfter = game.textAfter || '',
            textFeedBack = game.textFeedBack || '';
        if (tinyMCE.get('eXeGameInstructions')) {
            tinyMCE
                .get('eXeGameInstructions')
                .setContent(unescape(instructions));
        } else {
            $('#eXeGameInstructions').val(unescape(instructions));
        }
        if (tinyMCE.get('eRMQFeedBackEditor')) {
            tinyMCE
                .get('eRMQFeedBackEditor')
                .setContent(unescape(textFeedBack));
        } else {
            $('#eRMQFeedBackEditor').val(unescape(textFeedBack));
        }
        if (tinyMCE.get('eXeIdeviceTextAfter')) {
            tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
        } else {
            $('#eXeIdeviceTextAfter').val(unescape(tAfter));
        }
        $('.exe-form-tabs li:first-child a').click();
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },
};
