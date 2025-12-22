/* eslint-disable no-undef */
/**
/**
 * Math Problems iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros
 * Author: Manuel Narvaez Martinez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Science'),
        name: _('Math problems'),
    },
    msgs: {},
    classIdevice: 'mathproblems',
    defaultSettings: {
        type: 'result', // result, operator, operandA, operandB, random (to guess)
        number: 10, // Number or operations
        operations: '1111', // Add, subtract, multiply, divide,
        min: -1000, // Smallest number included
        max: 1000, // Highest number included
        decimals: 0, // Allow decimals
        decimalsInResults: 1, // Allow decimals in results
        negative: 1, // Allow negative results
        zero: 1, // Allow zero in results
    },
    idevicePath: '',
    id: false,
    domains: false,
    ci18n: {},
    version: 2,
    active: 0,
    questions: [],
    typeEdit: -1,
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgWriteText = _('You have to type a text in the editor');
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
    },

    refreshTranslations: function () {
        this.ci18n = {
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
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time Limit (mm:ss)'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            mgsAllQuestions: c_('Questions completed!'),
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
            msgPrevious: c_('Previous'),
            msgNext: c_('Next'),
            msgQuestion: c_('Question'),
            msgCorrect: c_('Right!'),
            msgClose: c_('Close'),
            msgNotCorrect: c_(
                'Sorry, that’s incorrect... The right answer is:'
            ),
            msgSolution: c_('Solution'),
            msgCheck: c_('Check'),
            msgEndGameM: c_('You finished the game. Your score is %s.'),
            msgFeedBack: c_('Feedback'),
            msgNoImage: c_('No image'),
            msgMoveOne: c_('Move on'),
            msgDuplicateAnswer: c_("You can't give repeated solutions"),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Math problems'),
        };
    },

    createForm: function () {
        const html = `
            <div id="gameQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">${_('Create random basic math problems.')} 
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/problemas_de_matemticas.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Solve the following math problems.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="eCQShowMinimize" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQShowMinimize" class="toggle-label">${_('Show minimized.')}</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="eCQOptionsRamdon" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQOptionsRamdon" class="toggle-label">${_('Random questions')}.</label>
                                </span>
                            </div>
                            <div class="mb-3 d-flex flex-wrap align-items-center gap-3">
                                <span class="toggle-item" role="switch" aria-checked="true">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="eCQShowSolution" class="toggle-input" checked />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQShowSolution" class="toggle-label">${_('Show solutions')}.</label>
                                </span>
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="eCQTimeShowSolution" class="mb-0">${_('Show solution time (seconds)')}:</label>
                                    <input type="number" name="eCQTimeShowSolution" id="eCQTimeShowSolution" value="3" min="1" max="9" step="1" class="form-control" style="width:6ch" />
                                </div>
                            </div>
                            <div id="eCQErrorRelativeDiv" class="mb-3 d-flex align-items-center gap-2 flex-wrap">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input class="MTOE-ErrorType toggle-input" id="eCQRelative" type="checkbox" name="ecqtype" value="0" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQRelative" class="toggle-label">${_('Relative error')}.</label>
                                </span>
                                <input type="number" name="eCQPercentajeRelative" id="eCQPercentajeRelative" value="0" min="0" max="1" step="0.01" class="form-control" style="display:none; width:7ch" />
                            </div>
                            <div id="eCQErrorAbsoluteDiv" class="mb-3 d-flex align-items-center gap-2 flex-wrap">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input class="MTOE-ErrorType toggle-input" id="eCQAbsolute" type="checkbox" name="ecqtype" value="1" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQAbsolute" class="toggle-label">${_('Absolute error')}.</label>
                                </span>
                                <input type="number" name="eCQPercentajeAbsolute" id="eCQPercentajeAbsolute" value="0" min="0" max="99.0" step="0.01" class="form-control" style="display:none; width:7ch" />
                            </div>
                            <div class="mb-3 d-flex flex-wrap align-items-center gap-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="eCQHasFeedBack" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQHasFeedBack" class="toggle-label">${_('Feedback')}.</label>
                                </span>
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="eCQPercentajeFB" class="mb-0">%FB</label>
                                    <input type="number" name="eCQPercentajeFB" id="eCQPercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" style="width:6ch" />
                                    <span>${_('&percnt; right to see the feedback')}.</span>
                                </div>
                            </div>
                            <div id="eCQFeedbackP" class="MTOE-EFeedbackP mb-3" style="display:none">
                                <textarea id="eCQFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="mb-3 d-flex flex-wrap align-items-center gap-2">
                                <label for="eCQPercentajeQuestions" class="mb-0">% ${_('Questions')}:</label>
                                <input type="number" name="eCQPercentajeQuestions" id="eCQPercentajeQuestions" value="100" min="1" max="100" class="form-control" style="width:7ch" />
                                <span id="eCQNumeroPercentaje">1/1</span>
                            </div>
                            <div style="display:none" class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="eCQModeBoard" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQModeBoard" class="toggle-label">${_('Digital whiteboard mode')}</label>
                                </span>
                            </div>
                            <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-wrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="eCQEEvaluation" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQEEvaluation" class="toggle-label">${_('Progress report')}.</label>
                                </span>
                                <span class="d-flex align-items-center gap-1 flex-nowrap">
                                    <label for="eCQEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" id="eCQEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" class="form-control" />
                                </span>
                                <a href="#eCQEEvaluationHelp" id="eCQEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                    <img src="${$exeDevice.idevicePath}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/>
                                </a>

                            </div>
                            <p id="eCQEEvaluationHelp" class="MTOE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset" style="position:relative">
                        <legend><a href="#">${_('Problems')}</a></legend>
                        <div>
                            <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                                <label for="eCQTime" class="mb-0">${_('Time (s)')}:</label>
                                <input type="number" name="eCQTime" id="eCQTime" value="180" min="1" max="3600" class="form-control" style="width:7ch" />
                            </div>
                            <div id="eCQformulaDiv" class="mb-3 d-flex flex-wrap align-items-center gap-2">
                                <label for="eCQformula" class="mb-0">${_('Formula')}:</label>
                                <input id="eCQformula" type="text" value="{b}*{h}/2" class="form-control" style="width:50%" />
                                <span><span class="sr-av">${_('Operations:')}</span> <a href="https://www.w3schools.com/js/js_arithmetic.asp" target="_blank" rel="noopener" hreflang="en" title="+  -  *  /  **  ()">${_('Help')}</a> - <a href="https://www.w3schools.com/js/js_math.asp" target="_blank" rel="noopener" hreflang="en" title="JavaScript Math">${_('More')}</a></span>
                            </div>
                            <div class="mb-3">
                                <label for="eCQwording" class="mb-1 d-block">${_('Question text:')}</label>
                                <textarea name="eCQwording" id="eCQwording" class="exe-html-editor form-control" rows="6">${_('Calculate in square metres the surface of a triangle with a base of {b}m and a height of {h}m')}</textarea>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="eCQDefinidedVariables" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label for="eCQDefinidedVariables" class="toggle-label">${_('Define the domain of each variable')}</label>
                                </span>
                            </div>
                            <p id="eQCVariablesContainer"></p>
                            <div id="eCQAleaContainer">
                                <div class="mb-3 d-flex flex-wrap align-items-center gap-3">
                                    <div class="d-flex align-items-center gap-2 flex-nowrap">
                                        <label for="eCQmin" class="mb-0">${_('Smallest number')}:</label>
                                        <input id="eCQmin" type="text" value="1" onkeyup="$exeDevice.onlyNumbers(this)" class="form-control" style="width:8ch; text-align:center" />
                                    </div>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap">
                                        <label for="eCQmax" class="mb-0">${_('Highest number')}:</label>
                                        <input id="eCQmax" type="text" value="10" onkeyup="$exeDevice.onlyNumbers(this)" class="form-control" style="width:8ch; text-align:center" />
                                    </div>
                                </div>
                                <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="eCQdecimals" class="mb-0">${_('Decimals')}:</label>
                                    <select id="eCQdecimals" class="form-control" style="max-width:16ch">
                                        <option value="0">${_('No decimals')}</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <a href="#" id="eCQfeedbackLink">${_('Feedback (optional)')}</a>
                                <div id="eCQfeedbackQuestionDiv" style="display:none" class="mt-2">
                                    <label for="eCQfeedbackQuestion" class="sr-av">${_('Feedback (optional)')}</label>
                                    <textarea name="eCQfeedbackQuestion" id="eCQfeedbackQuestion" class="exe-html-editor form-control" rows="4"></textarea>
                                    <span class="info d-block mt-1">${_('Use the Feedback to add an explanation or the right formula.')}</span>
                                </div>
                            </div>
                            <div class="MTOE-ENavigationButtons gap-2">
                                <a href="#" id="eCQAdd" class="MTOE-ENavigationButton" title="${_('Add question')}"><img src="${$exeDevice.idevicePath}quextIEAdd.png" alt="${_('Add question')}" class="MTOE-EButtonImage b-add" /></a>
                                <a href="#" id="eCQFirst" class="MTOE-ENavigationButton" title="${_('First question')}"><img src="${$exeDevice.idevicePath}quextIEFirst.png" alt="${_('First question')}" class="MTOE-EButtonImage b-first" /></a>
                                <a href="#" id="eCQPrevious" class="MTOE-ENavigationButton" title="${_('Previous question')}"><img src="${$exeDevice.idevicePath}quextIEPrev.png" alt="${_('Previous question')}" class="MTOE-EButtonImage b-prev" /></a>
                                <label class="sr-av" for="eCQNumberQuestion">${_('Question number:')}:</label><input type="text" class="MTOE-NumberQuestion form-control" id="eCQNumberQuestion" value="1"/>
                                <a href="#" id="eCQNext" class="MTOE-ENavigationButton" title="${_('Next question')}"><img src="${$exeDevice.idevicePath}quextIENext.png" alt="${_('Next question')}" class="MTOE-EButtonImage b-next" /></a>
                                <a href="#" id="eCQLast" class="MTOE-ENavigationButton" title="${_('Last question')}"><img src="${$exeDevice.idevicePath}quextIELast.png" alt="${_('Last question')}" class="MTOE-EButtonImage b-last" /></a>
                                <a href="#" id="eCQDelete" class="MTOE-ENavigationButton" title="${_('Delete question')}"><img src="${$exeDevice.idevicePath}quextIEDelete.png" alt="${_('Delete question')}" class="MTOE-EButtonImage b-delete" /></a>
                                <a href="#" id="eCQCopy" class="MTOE-ENavigationButton" title="${_('Copy question')}"><img src="${$exeDevice.idevicePath}quextIECopy.png" alt="${_('Copy question')}" class="MTOE-EButtonImage b-copy" /></a>
                                <a href="#" id="eCQCut" class="MTOE-ENavigationButton" title="${_('Cut question')}"><img src="${$exeDevice.idevicePath}quextIECut.png" alt="${_('Cut question')}" class="MTOE-EButtonImage b-cut" /></a>
                                <a href="#" id="eCQPaste" class="MTOE-ENavigationButton" title="${_('Paste question')}"><img src="${$exeDevice.idevicePath}quextIEPaste.png" alt="${_('Paste question')}" class="MTOE-EButtonImage b-paste" /></a>
                            </div>
                            <div class="MTOE-ENumQuestionDiv" id="eCQENumQuestionDiv">
                                <div class="MTOE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div> <span class="MTOE-ENumQuestions" id="eCQNumQuestions">1</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('gameQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        $exeDevice.enableForm();
    },

    getCuestionDefault() {
        return {
            min: 1,
            max: 10,
            decimals: 0,
            wording: '',
            formula: '',
            textFeedBack: '',
            time: 180,
            domains: false,
            definedVariables: false,
        };
    },

    showQuestion: function (i) {
        const num = Math.max(0, Math.min(i, $exeDevice.questions.length - 1));
        const p = $exeDevice.questions[num] || {};

        p.definedVariables =
            typeof p.definedVariables == 'undefined'
                ? false
                : p.definedVariables;
        p.domains = typeof p.domains == 'undefined' ? false : p.domains;

        $('#eCQmin').val(p.min);
        $('#eCQmax').val(p.max);
        $('#eCQTime').val(p.time);
        $('#eCQdecimals').val(p.decimals);
        $('#eCQformula').val(p.formula);

        $exeDevice.updateVariables();
        $('#eCQDefinidedVariables').prop('checked', p.definedVariables);

        if (p.definedVariables && p.domains) {
            $exeDevice.domains = p.domains;
            $exeDevice.updateVariablesValues(p.domains);
            $('#eQCVariablesContainer').show();
            $('#eCQAleaContainer').hide();
        } else {
            $('#eQCVariablesContainer').hide();
            $('#eCQAleaContainer').show();
        }

        if (tinyMCE.get('eCQwording')) {
            tinyMCE.get('eCQwording').setContent(p.wording);
        } else {
            $('#eCQwording').val(p.wording);
        }

        if (tinyMCE.get('eCQfeedbackQuestion')) {
            tinyMCE.get('eCQfeedbackQuestion').setContent(p.textFeedBack);
        } else {
            $('#eCQfeedbackQuestion').val(p.textFeedBack);
        }

        $('#eCQNumQuestions').text($exeDevice.questions.length);
        $('#eCQNumberQuestion').val($exeDevice.active + 1);
        $('#eCQfeedbackQuestionDiv').hide();
        if (p.textFeedBack.length > 0) {
            $('#eCQfeedbackQuestionDiv').show();
        }
    },

    clearTags(text) {
        return text.replace(/\\"/g, '"');
    },

    updateVariables: function () {
        $('#eQCVariablesContainer').empty();
        const formula = $('#eCQformula').val(),
            matches = formula.match(/{(.*?)}/g);
        if (!matches) return;
        let addedVariables = {};
        $.each(matches, function (index, variable) {
            variable = variable.replace(/[{}]/g, '');
            if (!addedVariables[variable]) {
                let variableDiv = $("<div class='MTOE-VariableDiv' />"),
                    label = $("<label class='MTOE-VariableName' />").text(
                        variable
                    ),
                    valuesInput = $(
                        "<input type='text' class='MTOE-ValuesInput' placeholder='-9 - 9, !0, 12' />"
                    );
                variableDiv.append(label).append(valuesInput);
                $('#eQCVariablesContainer').append(variableDiv);
                addedVariables[variable] = true;
            }
        });
    },
    validateIntervals: function (domain) {
        const allowedCharactersRegex = /^[0-9\s\-!.]+$/;
        let dm = domain.replace(/\s+/g, ' ').trim();
        if (!allowedCharactersRegex.test(dm)) {
            return false;
        }
        const formatRegex = /^(!?-?\d+(?:\.\d+)?)(\s+-\s+!?-?\d+(?:\.\d+)?)?$/;
        let isValid = formatRegex.test(dm);
        if (isValid && dm.includes(' - ')) {
            let [start, end] = dm.split(' - ').map(Number);
            isValid = start <= end;
        }
        return isValid;
    },

    validateIntervalsWithHash: function (domain) {
        const regex =
            /^-?\d+(?:\.\d+)?\s+-\s*-?\d+(?:\.\d+)?\s*#\s*\d+(?:\.\d+)?$/;
        let dm = domain.replace(/\s+/g, ' ').trim();
        if (!regex.test(dm)) {
            return false;
        }
        if (!dm.includes(' - ')) {
            return false;
        }
        let [interval, hashNumber] = domain.split('#');
        let [start, end] = interval
            .split(' - ')
            .map((str) => Number(str.trim()));
        let hashNum = Number(hashNumber.trim());
        return start < end && hashNum > 0;
    },

    areVariablesValid: function () {
        let variables = [],
            isValid = true;
        $('.MTOE-VariableDiv').each(function () {
            if (!isValid) return false;
            const valname = $(this)
                .find('label.MTOE-VariableName')
                .eq(0)
                .text()
                .trim();
            let value = $(this)
                .find('input.MTOE-ValuesInput')
                .eq(0)
                .val()
                .trim();
            value = value.replace(/\s+/g, ' ').trim();
            const elements = value.split(',');
            for (const el of elements) {
                const trimmedEl = el.trim();
                if (
                    !$exeDevice.validateIntervals(trimmedEl) &&
                    !$exeDevice.validateIntervalsWithHash(trimmedEl)
                ) {
                    isValid = false;
                    break;
                }
            }
            if (!isValid) return false;
            variables.push({
                name: valname,
                value: value,
            });
        });
        return isValid ? variables : false;
    },

    updateVariablesValues: function (values) {
        if (values) {
            $('.MTOE-VariableDiv').each(function () {
                const valname = $(this)
                    .find('label.MTOE-VariableName')
                    .eq(0)
                    .text()
                    .trim();
                for (let i = 0; i < values.length; i++) {
                    if (valname == values[i].name) {
                        value = $(this)
                            .find('input.MTOE-ValuesInput')
                            .eq(0)
                            .val(values[i].value);
                    }
                }
            });
        }
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion() != false) {
            $exeDevice.clearQuestion();
            $exeDevice.questions.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.questions.length - 1;
            $('#eCQNumberQuestion').val($exeDevice.questions.length);
            $exeDevice.typeEdit = -1;
            $('#eCQPaste').hide();
            $('#eCQNumQuestions').text($exeDevice.questions.length);
            $('#eCQNumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
            $('#eQCVariablesContainer').empty();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.questions.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            $exeDevice.questions.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.questions.length - 1) {
                $exeDevice.active = $exeDevice.questions.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#eCQPaste').hide();
            $('#eCQNumQuestions').text($exeDevice.questions.length);
            $('#eCQNumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.questions[$exeDevice.active])
            );
            $('#eCQPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#eCQPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.questions.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#eCQPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.exe.games.helpers(
                $exeDevice.questions,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#eCQNumQuestions').text($exeDevice.questions.length);
            $('#eCQNumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },
    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.questions.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.questions.length - 1
        ) {
            $exeDevice.active = $exeDevice.questions.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    clearQuestion: function () {
        $('#eCQmin').val('1');
        $('#eCQmax').val('10');
        $('#eCQdecimals').val('0');
        $('#eCQTime').val('180');
        $('#eCQformula').val('');
        tinyMCE.get('eCQwording').setContent('');
        tinyMCE.get('eCQfeedbackQuestion').setContent('');
    },
    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags($('#eCQPercentajeQuestions').val()),
            10
        );
        if (isNaN(percentaje)) return;

        percentaje = Math.max(1, Math.min(percentaje, 100));
        const totalQuestions = $exeDevice.questions.length,
            num = Math.max(1, Math.round((percentaje * totalQuestions) / 100));
        $('#eCQPercentajeQuestions').text(num + '/' + totalQuestions);
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    validateQuestion: function () {
        let message = '';
        const p = {};

        p.min = parseInt($('#eCQmin').val());
        p.max = parseInt($('#eCQmax').val());
        p.decimals = parseInt($('#eCQdecimals').val());
        p.time = parseInt($('#eCQTime').val());
        p.definedVariables = $('#eCQDefinidedVariables').is(':checked');

        if (tinyMCE.get('eCQwording')) {
            p.wording = tinyMCE.get('eCQwording').getContent();
        } else {
            p.wording = $('#eCQwording').val();
        }

        if (tinyMCE.get('eCQfeedbackQuestion')) {
            p.textFeedBack = tinyMCE.get('eCQfeedbackQuestion').getContent();
        } else {
            p.textFeedBack = $('#eCQfeedbackQuestion').val();
        }

        p.formula = $('#eCQformula').val();

        if (!p.definedVariables && (p.min.length == 0 || p.max.length == 0)) {
            message = _('Only the Feedback is optional');
        } else if (p.formula.trim().length == 0) {
            message = _('Only the Feedback is optional');
        } else if (p.wording.trim().length == 0) {
            message = _('Please write the question text');
        } else {
            let expresion = /\{[a-zA-z]\}/g,
                vfs = p.formula.split('|'),
                vw = p.wording.match(expresion);
            for (let i = 0; i < vfs.length; i++) {
                let vf0 = vfs[i].trim(),
                    vf = vf0.match(expresion);
                if (vf == null && vw == null) {
                    //
                } else if (vf && vw) {
                    if (vf.length > 0) {
                        vf = vf.filter($exeDevice.onlyUnique);
                    } else {
                        message = _('Only the Feedback is optional');
                    }
                    if (vw.length > 0) {
                        vw = vw.filter($exeDevice.onlyUnique);
                    }
                    if (vf.length != vw.length) {
                        message = _(
                            'The question text and the formula should have the same variables'
                        );
                    }
                } else {
                    message = _(
                        'The question text and the formula should have the same variables'
                    );
                }
            }
        }

        p.domains = $exeDevice.areVariablesValid();
        if (p.definedVariables && p.domains === false) {
            message = _('The domain of at least one variable is not correct');
        }
        if (message.length == 0) {
            $exeDevice.questions[$exeDevice.active] = Object.assign({}, p);
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }
        return message;
    },

    onlyUnique: function (value, index, self) {
        return self.indexOf(value) === index;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#gameQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            showMinimize = $('#eCQShowMinimize').is(':checked'),
            optionsRamdon = $('#eCQOptionsRamdon').is(':checked'),
            showSolution = $('#eCQShowSolution').is(':checked'),
            modeBoard = $('#eCQModeBoard').is(':checked'),
            timeShowSolution = parseInt(clear($('#eCQTimeShowSolution').val())),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#eCQHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#eCQPercentajeFB').val())),
            percentajeQuestions = parseInt(
                clear($('#eCQPercentajeQuestions').val())
            ),
            errorAbsolute = parseFloat(
                clear($('#eCQPercentajeAbsolute').val())
            ),
            errorRelative = parseFloat(
                clear($('#eCQPercentajeRelative').val())
            ),
            evaluation = $('#eCQEEvaluation').is(':checked'),
            evaluationID = $('#eCQEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        let errorType = 0;

        if (!itinerary) return;

        if ($('#eCQRelative').is(':checked')) {
            errorType = 1;
        } else if ($('#eCQAbsolute').is(':checked')) {
            errorType = 2;
        }

        let textFeedBack = '';
        if (tinyMCE.get('eCQFeedBackEditor')) {
            textFeedBack = tinyMCE.get('eCQFeedBackEditor').getContent();
        } else {
            textFeedBack = S('#eCQFeedBackEditor').val();
        }

        let textAfter = '';
        if (tinyMCE.get('eXeIdeviceTextAfter')) {
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        } else {
            textAfter = S('#eXeIdeviceTextAfter').val();
        }

        let instructions = '';
        if (tinyMCE.get('eXeGameInstructions')) {
            instructions = tinyMCE.get('eXeGameInstructions').getContent();
        } else {
            instructions = S('#eXeGameInstructions').val();
        }

        if (showSolution && timeShowSolution.length == 0) {
            eXe.app.alert($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }

        if (feedBack && textFeedBack.trim().length == 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        const questions = $exeDevice.questions;
        if (questions.length == 0) {
            eXe.app.alert($exeDevice.msgs.msgEOneQuestion);
            return false;
        }
        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            typeGame: 'MathProblems',
            instruccions: instructions,
            showMinimize: showMinimize,
            optionsRamdon: optionsRamdon,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            itinerary: itinerary,
            percentajeQuestions: percentajeQuestions,
            modeBoard: modeBoard,
            questions: questions,
            feedBack: feedBack,
            textFeedBack: textFeedBack,
            percentajeFB: percentajeFB,
            scorm: scorm,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            textAfter: textAfter,
            version: $exeDevice.version,
            errorAbsolute: errorAbsolute,
            errorRelative: errorRelative,
            errorType: errorType,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
    },
    onlyNumbers: function (e) {
        let str = e.value;
        const lastCharacter = str.slice(-1);
        if (isNaN(parseFloat(lastCharacter))) {
            e.value = str.substring(0, str.length - 1);
        }
    },

    setDecimalsInResults: function (v) {
        if (v == 0) $('#eCQdecimalsInResults').prop('disabled', false);
        else
            $('#eCQdecimalsInResults')
                .prop('checked', true)
                .attr('disabled', 'disabled');
    },

    enableForm: function () {
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        $exeDevice.updateVariables();

        $('#eQCVariablesContainer').hide();
        if (originalHTML && Object.keys(originalHTML).length > 0) {
            let wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            const json = $('.mathproblems-DataGame', wrapper).text(),
                $wordings = $('.mathproblems-LinkWordings', wrapper),
                $feeebacks = $('.mapa-LinkFeedBacks', wrapper),
                djson = $exeDevices.iDevice.gamification.helpers.decrypt(json),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(
                        djson
                    );

            $exeDevice.questions = dataGame.questions;
            $exeDevice.active = 0;

            if (dataGame.version == 1) {
                for (let i = 0; i < dataGame.questions.length; i++) {
                    dataGame.questions[i].time =
                        dataGame.questions[i].time * 60;
                }
            }

            $exeDevice.setTexts(dataGame.questions, $wordings, $feeebacks);
            $exeDevice.updateFieldGame(dataGame);

            const instructions = $('.mathproblems-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());

            const textAfter = $('.mathproblems-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const textFeedBack = $('.mathproblems-feedback-game', wrapper);
            if (textFeedBack.length == 1)
                $('#eCQFeedBackEditor').val(textFeedBack.html());

            $exeDevice.showQuestion(0);
        }
    },
    saveTexts: function (pts) {
        let medias = {
            wordings: '',
            feedbacks: '',
        };
        for (let i = 0; i < pts.length; i++) {
            let p = pts[i];
            if (typeof p.wording != 'undefined') {
                let w = $exeDevice.clearTags(p.wording);
                medias.wordings +=
                    '<div class="js-hidden mathproblems-LinkWordings" data-id="' +
                    i +
                    '">' +
                    w +
                    '</div>';
            }
            if (
                typeof p.textFeedBack != 'undefined' &&
                p.textFeedBack.length > 0
            ) {
                medias.feedbacks +=
                    '<div class="js-hidden mathproblems-LinkFeedBacks" data-id="' +
                    i +
                    '">' +
                    $exeDevice.clearTags(p.textFeedBack) +
                    '</div>';
            }
        }
        return medias;
    },

    setTexts: function (questions, $wordings, $feedbacks) {
        for (let i = 0; i < questions.length; i++) {
            let p = questions[i];
            if (p.wording != 'undefined' && p.wording.length > 0) {
                $exeDevice.setWording(p, $wordings, i);
            }
            if (p.textFeedBack != 'undefined' && p.textFeedBack.length > 0) {
                $exeDevice.setFeedBack(p, $feedbacks, i);
            }
        }
    },

    setWording: function (p, $wordings, number) {
        $wordings.each(function () {
            let id = parseInt($(this).data('id'));
            if (id == number) {
                p.wording = $exeDevice.clearTags($(this).html());
                return;
            }
        });
    },

    setFeedBack: function (p, $feedbacks, number) {
        $feedbacks.each(function () {
            const id = parseInt($(this).data('id'));
            if (id == number) {
                p.textFeedBack = $exeDevice.clearTags($(this).html());
                return;
            }
        });
    },

    save: function () {
        if (!$exeDevice.validateQuestion()) return false;

        const dataGame = $exeDevice.validateData();
        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        let medias = $exeDevice.saveTexts(dataGame.questions);
        medias = medias.wordings + medias.feedbacks;

        let json = JSON.stringify(dataGame),
            divContent = '',
            textFeedBack = tinyMCE.get('eCQFeedBackEditor').getContent(),
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();

        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        if (instructions != '')
            divContent =
                '<div class="mathproblems-instructions mathproblems-instructions">' +
                instructions +
                '</div>';

        let html = '<div class="mathproblems-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html +=
            '<div class="mathproblems-feedback-game js-hidden">' +
            textFeedBack +
            '</div>';
        html += divContent;
        html +=
            '<div class="mathproblems-DataGame js-hidden">' + json + '</div>';
        html += medias;
        if (textAfter != '') {
            html +=
                '<div class="mathproblems-extra-content">' +
                textAfter +
                '</div>';
        }

        html +=
            '<div class="mathproblems-bns js-hidden">' +
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

        $('#eCQTime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 4);
            this.value = v;
        });

        $('#eCQTime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 1 : this.value;
            this.value = this.value > 3600 ? 3600 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
        });

        $('#eCQPaste').hide();
        $('#eCQAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#eCQFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#eCQPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#eCQNext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#eCQLast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#eCQDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#eCQCopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#eCQCut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#eCQPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#eCQPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#eCQPercentajeQuestions').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });

        $('#eCQPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });

        $('#eCQPercentajeError').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 2);
            this.value = v;
        });

        $('#eCQPercentajeError').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 99 ? 99 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#eCQfeedbackLink').on('click', function (e) {
            e.preventDefault();
            $('#eCQfeedbackQuestionDiv').fadeToggle();
        });
        $('#eCQHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#eCQFeedbackP').slideDown();
            } else {
                $('#eCQFeedbackP').slideUp();
            }
            $('#eCQPercentajeFB').prop('disabled', !marcado);
        });

        $('#eCQRelative').on('change', function () {
            const type = $(this).is(':checked') ? 1 : 0;
            $exeDevice.setErrorType(type);
        });

        $('#eCQAbsolute').on('change', function () {
            const type = $(this).is(':checked') ? 2 : 0;
            $exeDevice.setErrorType(type);
        });

        $('#eCQPercentajeRelative').on('keypress', function (evt) {
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

        $('#eCQPercentajeRelative').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 1 ? 1 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#eCQPercentajeAbsolute').on('keypress', function (evt) {
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

        $('#eCQPercentajeAbsolute').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#eCQEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#eCQEEvaluationID').prop('disabled', !marcado);
        });

        $('#eCQEEvaluationHelpLnk').click(function () {
            $('#eCQEEvaluationHelp').toggle();
            return false;
        });

        $('#eQCVariablesContainer').on(
            'input',
            '.MTOE-ValuesInput',
            function () {
                const valorInicial = $(this).val();
                const valorFiltrado = valorInicial.replace(
                    /[^0-9,#!\-. ]/g,
                    ''
                );
                if (valorFiltrado !== valorInicial) {
                    $(this).val(valorFiltrado);
                }
            }
        );

        $('#eCQDefinidedVariables').change(function () {
            if ($(this).is(':checked')) {
                $('#eQCVariablesContainer').show();
                $('#eCQAleaContainer').hide();
            } else {
                $('#eQCVariablesContainer').hide();
                $('#eCQAleaContainer').show();
            }
        });

        $(document).on('input', '#eCQformula', $exeDevice.updateVariables);

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();

        //eX3 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    setErrorType: function (type) {
        $('#eCQAbsolute').prop('checked', false);
        $('#eCQRelative').prop('checked', false);
        $('#eCQPercentajeAbsolute').hide();
        $('#eCQPercentajeRelative').hide();
        if (type == 1) {
            $('#eCQRelative').prop('checked', true);
            $('#eCQPercentajeRelative').show();
        } else if (type == 2) {
            $('#eCQAbsolute').prop('checked', true);
            $('#eCQPercentajeAbsolute').show();
        }
    },

    onlyNumberKey: function (evt) {
        const ASCIICode = evt.which ? evt.which : evt.keyCode;
        if (
            ASCIICode != 0o54 &&
            ASCIICode != 0o56 &&
            ASCIICode > 31 &&
            (ASCIICode < 48 || ASCIICode > 57)
        )
            return false;
        return true;
    },

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        game.errorType =
            typeof game.errorType == 'undefined' ? 0 : game.errorType;
        game.errorRelative =
            typeof game.errorRelative == 'undefined' ? 0.0 : game.errorRelative;
        game.errorAbsolute =
            typeof game.errorAbsolute == 'undefined' ? 0.0 : game.errorAbsolute;
        game.errorRelative =
            game.version == 1 &&
            typeof game.percentajeError != 'undefined' &&
            game.percentajeError > 0
                ? game.percentajeError / 100
                : game.errorRelative;
        game.errorType =
            game.version == 1 &&
            typeof game.percentajeError != 'undefined' &&
            game.percentajeError > 0
                ? 1
                : game.errorType;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#eCQShowMinimize').prop('checked', game.showMinimize);
        $('#eCQOptionsRamdon').prop('checked', game.optionsRamdon);
        $('#eCQShowSolution').prop('checked', game.showSolution);
        $('#eCQTimeShowSolution').val(game.timeShowSolution);
        $('#eCQTimeShowSolution').prop('disabled', !game.showSolution);
        $('#eCQHasFeedBack').prop('checked', game.feedBack);
        $('#eCQPercentajeFB').val(game.percentajeFB);
        $('#eCQPercentajeQuestions').val(game.percentajeQuestions);
        $('#eCQPercentajeRelative').val(game.errorRelative);
        $('#eCQPercentajeAbsolute').val(game.errorAbsolute);
        $('#eCQModeBoard').prop('checked', game.modeBoard);
        $('#eCQPercentajeFB').prop('disabled', !game.feedBack);
        $('#eCQHasFeedBack').prop('checked', game.feedBack);
        $('#eCQEEvaluation').prop('checked', game.evaluation);
        $('#eCQEEvaluationID').val(game.evaluationID);
        $('#eCQEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevice.setErrorType(game.errorType);
        if (game.feedBack) {
            $('#eCQFeedbackP').slideDown();
        } else {
            $('#eCQFeedbackP').slideUp();
        }

        $exeDevice.questions = game.questions;
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        $exeDevice.updateQuestionsNumber();
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.scorm.isScorm,
            game.scorm.textButtonScorm,
            game.scorm.repeatActivity,
            game.weighted
        );
    },

    exportGame: function () {
        if (!$exeDevice.validateQuestion()) return;

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
        link.download = _('Activity') + '-MathProblems.json';
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
        } else if (game.typeGame !== 'MathProblems') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }

        game.id = $exeDevice.getIdeviceID();
        $exeDevice.updateFieldGame(game);
        let instructions = game.instructionsExe || game.instructions || '',
            tAfter = game.textAfter || '',
            textFeedBack = game.textFeedBack || '';
        if (tinyMCE.get('eXeGameInstructions')) {
            tinyMCE.get('eXeGameInstructions').setContent(instructions);
        } else {
            $('#eXeGameInstructions').val(instructions);
        }
        if (tinyMCE.get('eCQFeedBackEditor')) {
            tinyMCE.get('eCQFeedBackEditor').setContent(textFeedBack);
        } else {
            $('#eCQFeedBackEditor').val(textFeedBack);
        }
        if (tinyMCE.get('eXeIdeviceTextAfter')) {
            tinyMCE.get('eXeIdeviceTextAfter').setContent(tAfter);
        } else {
            $('#eXeIdeviceTextAfter').val(tAfter);
        }
        //$('.exe-form-tabs li:first-child a').click();
        $exeDevice.showQuestion(0);
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },
};
