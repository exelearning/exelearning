/* eslint-disable no-undef */
/**
 * Electrical Circuits Quiz iDevice (edition code)
 * Based on Select Activity (quick-questions-multiple-choice).
 * Questions are paired with TikZ circuit diagrams rendered via TikZJax.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('Electrical Circuits'),
        alt: _('Electrical Circuits'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'electrical-circuits',
    active: 0,
    selectsGame: [],
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    id: false,
    ci18n: {},
    version: 3.1,

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );

        this.setMessagesInfo();
        this.createForm();
    },

    getEditorContent: function (id) {
        const editor = tinyMCE.get(id);
        if (editor) return editor.getContent();
        return $('#' + id).val() || '';
    },

    setEditorContent: function (id, content) {
        const editor = tinyMCE.get(id);
        if (editor) {
            editor.setContent(content);
        } else {
            $('#' + id).val(content);
        }
    },

    enableForm: function () {
        $exeDevice.initQuestions();
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        // Ensure correct layout for current mode
        var currentMode = $('input[name="slcactivitymode"]:checked').val() || 'test';
        $exeDevice.toggleActivityMode(currentMode);
        // Show first question and render circuit preview
        $exeDevice.showQuestion($exeDevice.active);
    },

    toggleActivityMode: function (mode) {
        const isShow = mode === 'show';
        const ids = [
            'elceTypeDiv', 'elceInputNumbers', 'elcePercentageSpan',
            'elceTimeDiv', 'elceScoreQuestionDiv',
            'elceContents', 'elceShowSolutionDiv', 'elceGlobalTimeDiv',
            'elceAnswersRamdonDiv', 'elceModeBoardDiv'
        ];
        ids.forEach(function (id) {
            const $el = $('#' + id);
            if (isShow) {
                $el.addClass('d-none');
            } else {
                $el.removeClass('d-none');
            }
        });
        // Description: visible only in Show mode
        if (isShow) {
            $('#elceDescriptionDiv').removeClass('d-none');
        } else {
            $('#elceDescriptionDiv').addClass('d-none');
        }
        // Show mode layout: centered full-width preview
        var $panel = $('#elcePanel');
        if (isShow) {
            $panel.addClass('ELCE-ShowMode');
            // Move tikz code group below preview in multimedia column
            $('#elceTikzCodeGroup').insertAfter('#elceMultimedia');
        } else {
            $panel.removeClass('ELCE-ShowMode');
            // Move tikz code group to options column, before Type
            $('#elceTikzCodeGroup').insertBefore('#elceTypeDiv');
        }
    },

    refreshTranslations: function () {
        this.ci18n = {
            // Used in export/electrical-circuits.js
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgNewGame: c_('Click here for a new game'),
            msgCodeAccess: c_('Access code'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time per question'),
            msgLive: c_('Life'),
            msgFullScreen: c_('Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
            msgLoseLive: c_('You lost one life'),
            msgLostLives: c_('You lost all your lives!'),
            msgAllQuestions: c_('You answered all the questions.'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgYouScore: c_('Your score'),
            msgTryAgain: c_('You need at least &percnt;s&percnt; of correct answers to get the information. Please try again.'),
            msgQuestion: c_('Question'),
            msgAnswer: c_('Check'),
            msgInformation: c_('Information'),
            msgAuthor: c_('Authorship'),
            msgClose: c_('Close'),
            msgOption: c_('Option'),
            msgOrders: c_('Please order the answers'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgMoveOne: c_('Move on'),
            msgPoints: c_('points'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgPrevious: c_('Previous'),
            msgNext: c_('Next'),
            msgWeight: c_('Weight'),
            msgScoreScorm: c_('The score can not be saved because this page is not part of a SCORM package.'),
            msgOnlySaveScore: c_('You can only save the score once'),
            msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
            msgSeveralScore: c_('You can save the score as many times as you want'),
            msgYouLastScore: c_('The last score saved is'),
            msgEndGameScore: c_('Please start the activity before saving your score.'),
            msgSaveAuto: c_('Your score will be automatically saved after each question.'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Electrical Circuits Quiz'),
        };
    },

    setMessagesInfo: function () {
        const msgs = $exeDevice.msgs;
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgTypeChoose = _(
            'Please select the correct answer for each option'
        );
        msgs.msgECompleteQuestion = _('Please write the question');
        msgs.msgECompleteAllOptions = _('Please complete all options');
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideSolution = _('Please write the word/phrase');
        msgs.msgESelectFile = _('The selected file is not a valid game');
        msgs.msgEProvideTimeSolution = _(
            'Please indicate the time to display the solution'
        );
        msgs.msgEProvideWord = _('Please provide the word or phrase');
        msgs.msgEDefintion = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNotHitCuestion = _(
            'The question marked as next in case of success does not exist.'
        );
        msgs.msgNotErrorCuestion = _(
            'The question marked as next in case of error does not exist.'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.selectsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#elcePaste').hide();
            $('#elceNumQuestions').text($exeDevice.selectsGame.length);
            $('#elceNumberQuestion').val($exeDevice.selectsGame.length);
            $exeDevice.updateSelectOrder();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.selectsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.selectsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.selectsGame.length - 1) {
                $exeDevice.active = $exeDevice.selectsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#elcePaste').hide();
            $('#elceNumQuestions').text($exeDevice.selectsGame.length);
            $('#elceNumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateSelectOrder();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.selectsGame[$exeDevice.active])
            );
            $('#elcePaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#elcePaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.selectsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#elcePaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.selectsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#elceNumQuestions').text($exeDevice.selectsGame.length);
        }
        $exeDevice.updateSelectOrder();
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
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

    updateSelectOrder: function () {
        const activeGame = $exeDevice.selectsGame[$exeDevice.active];

        function updateSelectOptions(selectId, valueToSet) {
            const $select = $(selectId);
            $select
                .empty()
                .append(
                    $('<option>', { value: -2, text: _('End') }),
                    $('<option>', { value: -1, text: _('Next') })
                );

            $.each($exeDevice.selectsGame, function (index) {
                $select.append(
                    $('<option>', {
                        value: index,
                        text: (index + 1).toString(),
                    })
                );
            });

            $select.val(valueToSet);
        }
        $exeDevice.updateQuestionsNumber();
    },

    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags(
                $('#elcePercentajeQuestionsValue').val()
            ),
            10
        );
        if (isNaN(percentaje)) return;

        percentaje = Math.max(1, Math.min(percentaje, 100));
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(1, Math.round((percentaje * totalQuestions) / 100));
        $('#elceNumeroPercentaje').text(num + '/' + totalQuestions);
    },

    showQuestion: function (i) {
        $exeDevice.clearQuestion();
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(0, Math.min(i, totalQuestions - 1));
        let p = $exeDevice.selectsGame[num];
        const activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test';

        $('#elceNumQuestions').text(totalQuestions);
        $('#elceNumberQuestion').val(num + 1);

        // Load TikZ code, description and render preview
        $('#elceTikzCode').val(p.tikzCode || '');
        $('#elceDescription').val(p.description || '');
        $exeDevice.renderTikzPreview();

        if (activityMode === 'show') return;

        if (p.typeSelect !== 2) {
            let numOptions = 0;
            $('.ELCE-EAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim() !== '') {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
        } else {
            $('#elceSolutionWord').val(p.solutionQuestion);
            $('#elcePercentageShow').val(p.percentageShow);
            $('#elceDefinitionWord').val(p.quextion);
        }

        $exeDevice.showTypeQuestion(p.typeSelect);
        $exeDevice.showOptions(p.numberOptions);
        $('#elceQuestion').val(p.quextion);

        $('.ELCE-EAnwersOptions').each(function (j) {
            $(this).val(p.options[j] || '');
        });

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        $(
            "input.ELCE-Number[name='slcnumber'][value='" +
                p.numberOptions +
                "']"
        ).prop('checked', true);
        $exeDevice.checkQuestions(p.solution);
        $("input.ELCE-Times[name='slctime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.ELCE-TypeSelect[name='slctypeselect'][value='" +
                p.typeSelect +
                "']"
        ).prop('checked', true);
    },

    checkQuestions: function (solution) {
        $("input.ELCE-ESolution[name='slcsolution']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            let sol = solution[i];
            $(
                "input.ELCE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#elceSolutionSelect').text(solution);
    },

    /**
     * Render TikZ code in the preview area using TikZJax
     */
    renderTikzPreview: function () {
        const code = $('#elceTikzCode').val().trim();
        const preview = document.getElementById('elceTikzPreview');
        const $noCircuit = $('#elceNoCircuit');

        if (!code) {
            preview.innerHTML = '';
            $noCircuit.show();
            return;
        }

        $noCircuit.hide();
        preview.innerHTML = '';

        // Insert <script type="text/tikz"> via DOM so MutationObserver detects it
        const tikzScript = document.createElement('script');
        tikzScript.type = 'text/tikz';
        tikzScript.dataset.texPackages = JSON.stringify({'circuitikz': '', 'amsmath': '', 'amssymb': ''});
        tikzScript.dataset.showConsole = 'true';
        tikzScript.textContent = '\\begin{document}' + code + '\\end{document}';
        preview.appendChild(tikzScript);
    },

    clearQuestion: function () {
        $exeDevice.showOptions(4);
        $exeDevice.showSolution('');
        $('.ELCE-Times')[0].checked = true;
        $('.ELCE-Number')[2].checked = true;
        $('#elceTikzCode').val('');
        $('#elceDescription').val('');
        $('#elceTikzPreview').empty();
        $('#elceNoCircuit').show();
        $("input.ELCE-ESolution[name='slcsolution']").prop('checked', false);
        $('#elceSolutionSelect').text('');
        $('#elceQuestion').val('');
        $('#elceSolutionWord').val('');
        $('#elceDefinitionWord').val('');
        $('.ELCE-EAnwersOptions').each(function () {
            $(this).val('');
        });
        $('#elceMessageOK').val('');
        $('#elceMessageKO').val('');
    },

    showOptions: function (number) {
        $('.ELCE-EOptionDiv').each(function (i) {
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showSolution('');
            }
        });

        $('.ELCE-EAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showSolution: function (solution) {
        $("input.ELCE-ESolution[name='slcsolution']").prop('checked', false);

        for (let i = 0; i < solution.length; i++) {
            const sol = solution[i];
            $('.ELCE-ESolution')[solution].checked = true;
            $(
                "input.ELCE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="electricalCircuitsIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create quiz activities based on electrical circuit diagrams drawn with TikZ.')}
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Observe the electrical circuit and answer the questions.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div id="elceOptions">
                            <div class="d-flex align-items-center gap-3 mb-3" id="elceActivityMode">
                                <span>${_('Mode')}:</span>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input" type="radio" name="slcactivitymode" id="elceModeTest" value="test" checked />
                                    <label class="form-check-label" for="elceModeTest">${_('Test')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input" type="radio" name="slcactivitymode" id="elceModeShow" value="show" />
                                    <label class="form-check-label" for="elceModeShow">${_('Presentation')}</label>
                                </div>
                            </div>
                            <div class="toggle-item mb-3" data-target="elceShowMinimize">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceShowMinimize" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceShowMinimize">${_('Show minimized.')} </label>
                            </div> 
                            <div class="toggle-item mb-3" data-target="elceAnswersRamdon" id="elceAnswersRamdonDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceAnswersRamdon" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceAnswersRamdon">${_('Random options')}</label>
                            </div>
                            <div class="toggle-item mb-3" id="elceQuestionsRandomDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceQuestionsRandom" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceQuestionsRandom">${_('Random questions')}</label>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3" id="elceShowSolutionDiv">
                                <div class="toggle-item toggle-related" data-target="elceShowSolution">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="elceShowSolution" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="elceShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="elceTimeShowSolution" id="elceTimeShowSolution" value="3" min="1" max="9" class="form-control" />
                                    <label for="elceTimeShowSolution">${_('Show solution time (seconds)')}</label>
                                </div>
                            </div>                            
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item toggle-related" data-target="elceHasFeedBack">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="elceHasFeedBack" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="elceHasFeedBack">${_('Feedback')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="elcePercentajeFB" id="elcePercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" />
                                    <label for="elcePercentajeFB">${_('&percnt; right to see the feedback')}</label>
                                </div>
                            </div>
                            <div id="elceFeedbackP" class="ELCE-EFeedbackP mb-3">
                                <textarea id="elceFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-flex align-items-center flex-wrap mb-3 gap-2">
                                <label for="elcePercentajeQuestionsValue">${_('% Questions')}:</label>
                                <input type="number" name="elcePercentajeQuestionsValue" id="elcePercentajeQuestionsValue" value="100" min="1" max="100" class="form-control" />
                                <span id="elceNumeroPercentaje" class="ms-2">1/1</span>
                            </div>
                            <div class="toggle-item mb-3" data-target="elceModeBoard" id="elceModeBoardDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="elceModeBoard" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="elceModeBoard">${_('Digital whiteboard mode')}</label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3" id="elceGlobalTimeDiv">
                                <label for="elceGlobalTimes">${_('Time per question')}:</label>
                                <select id="elceGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                                    <option value="0" selected>15s</option>
                                    <option value="1">30s</option>
                                    <option value="2">1m</option>
                                    <option value="3">3m</option>
                                    <option value="4">5m</option>
                                    <option value="5">10m</option>
                                </select>
                                <button id="elceGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item" data-target="elceEvaluation">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="elceEvaluation" class="toggle-input" aria-label="${_('Progress report')}">
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="elceEvaluation">${_('Progress report')}.</label>
                                </div>
                                <div class="d-flex align-items-center flex-nowrap gap-2 ms-2 ELCE-EEvaluationFields">
                                    <label for="elceEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" class="form-control" id="elceEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" />
                                    <a href="#elceEvaluationHelp" id="elceEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </div>
                            </div>
                            <p id="elceEvaluationHelp" class="exe-block-info ELCE-TypeGameHelp">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="ELCE-EPanel" id="elcePanel">
                            <div class="ELCE-EOptionsMedia d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <div class="ELCE-EOptionsGame">
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="elceTypeDiv">
                                        <span>${_('Type')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-TypeSelect form-check-input" checked id="elceTypeChoose" type="radio" name="slctypeselect" value="0"/>
                                                <label class="form-check-label" for="elceTypeChoose">${_('Select')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-TypeSelect form-check-input" id="elceTypeOrders" type="radio" name="slctypeselect" value="1"/>
                                                <label class="form-check-label" for="elceTypeOrders">${_('Order')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-TypeSelect form-check-input" id="elceTypeWord" type="radio" name="slctypeselect" value="2"/>
                                                <label class="form-check-label" for="elceTypeWord">${_('Word')}</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="elceInputNumbers">
                                        <span>${_('Options Number')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Number form-check-input" id="numQ2" type="radio" name="slcnumber" value="2" />
                                                <label class="form-check-label" for="numQ2">2</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Number form-check-input" id="numQ3" type="radio" name="slcnumber" value="3" />
                                                <label class="form-check-label" for="numQ3">3</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Number form-check-input" id="numQ4" type="radio" name="slcnumber" value="4" checked="checked" />
                                                <label class="form-check-label" for="numQ4">4</label>
                                            </div>
                                         </span>
                                    </div>
                                    <div id="elcePercentageSpan" class="d-none flex-wrap align-items-center gap-2 mb-3">
                                        <span >${_('Percentage of letters to show (%)')}:</span>
                                        <span class="ELCE-EPercentage" id="elcePercentage">
                                            <input type="number" class="form-control form-control-sm"  name="elcePercentageShow" id="elcePercentageShow" value="35" min="0" max="100" step="5" />
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="elceTimeDiv">
                                        <span>${_('Time per question')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" checked="checked" id="q15s" type="radio" name="slctime" value="0" />
                                                <label class="form-check-label" for="q15s">15s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q30s" type="radio" name="slctime" value="1" />
                                                <label class="form-check-label" for="q30s">30s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q1m" type="radio" name="slctime" value="2" />
                                                <label class="form-check-label" for="q1m">1m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q3m" type="radio" name="slctime" value="3" />
                                                <label class="form-check-label" for="q3m">3m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q5m" type="radio" name="slctime" value="4" />
                                                <label class="form-check-label" for="q5m">5m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ELCE-Times form-check-input" id="q10m" type="radio" name="slctime" value="5" />
                                                <label class="form-check-label" for="q10m">10m</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div id="elceScoreQuestionDiv" class="ELCE-ScoreQuestionDiv align-items-center gap-2 mb-3 d-none">
                                        <label for="elceScoreQuestion">${_('Score')}:</label>
                                        <input type="number" name="elceScoreQuestion" id="elceScoreQuestion" value="1" min="0" max="100" step="0.05" class="form-control"/>
                                    </div>                                    
                                </div>
                                <div class="ELCE-EMultiMediaOption ">
                                    <div class="ELCE-EMultimedia" id="elceMultimedia">
                                        <div id="elceTikzPreview" class="ELCE-ETikzPreview"></div>
                                        <img class="ELCE-EMedia" src="${path}quextIELCBack.png" id="elceNoCircuit" alt="${_('No circuit')}" />
                                    </div>
                                    <div id="elceTikzCodeGroup">
                                        <span id="elceTitleTikz">${_('Circuit code (TikZ)')}:</span>
                                        <div class="ELCE-ETikzInput d-flex flex-nowrap align-items-start gap-2 mb-3">
                                            <textarea id="elceTikzCode" class="form-control" rows="4" placeholder="${_('Enter TikZ circuit code...')}"></textarea>
                                            <a href="#" id="elcePreviewTikz" class="ELCE-ENavigationButton" title="${_('Preview circuit')}">
                                                <img src="${path}quextIEPlay.png" alt="${_('Preview')}" class="ELCE-ENavigationButton" />
                                            </a>
                                        </div>
                                    </div>
                                     <div class="mb-3 d-none" id="elceDescriptionDiv">
                                        <label for="elceDescription">${_('Description')}:</label>
                                        <input type="text" class="form-control" id="elceDescription" value="" />
                                    </div>
                                </div>                               
                            </div>
                            <div class="ELCE-EContents" id="elceContents">
                                <div id="elceSolitionOptions" class="ELCE-SolitionOptionsDiv"><span>${_('Question')}:</span><span><span>${_('Solution')}: </span><span id="elceSolutionSelect">A</span></span></div>
                                <div class="ELCE-EQuestionDiv" id="elceQuestionDiv">
                                    <label class="sr-av" for="elceQuestion">${_('Question')}:</label>
                                    <input type="text" class="ELCE-EQuestion form-control" id="elceQuestion" value="${c_('What type of circuit is shown?')}">
                                </div>
                                <div class="ELCE-EAnswers" id="elceAnswers">
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution0">${_('Solution')} A:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution0" value="A" checked />
                                        <label for="elceOption0">A</label>
                                        <input type="text" class="ELCE-EOption0 ELCE-EAnwersOptions form-control" id="elceOption0" value="${c_('Series circuit')}">
                                    </div>
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution1">${_('Solution')} B:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution1" value="B" />
                                        <label for="elceOption1">B</label>
                                        <input type="text" class="ELCE-EOption1 ELCE-EAnwersOptions form-control" id="elceOption1" value="${c_('Parallel circuit')}">
                                    </div>
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution2">${_('Solution')} C:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution2" value="C" />
                                        <label for="elceOption2">C</label>
                                        <input type="text" class="ELCE-EOption2 ELCE-EAnwersOptions form-control" id="elceOption2" value="${c_('Mixed circuit')}">
                                    </div>
                                    <div class="ELCE-EOptionDiv gap-2">
                                        <label class="sr-av" for="elceSolution3">${_('Solution')} D:</label>
                                        <input type="checkbox" class="ELCE-ESolution form-check-input me-0" name="slcsolution" id="elceSolution3" value="D" />
                                        <label for="elceOption3">D</label>
                                        <input type="text" class="ELCE-EOption3 ELCE-EAnwersOptions form-control" id="elceOption3" value="${c_('Open circuit')}">
                                    </div>
                                </div>
                                <div class="ELCE-EWordDiv ELCE-DP" id="elceWordDiv">
                                    <div class="ELCE-ESolutionWord"><label for="elceSolutionWord">${_('Word/Phrase')}:</label><input type="text" id="elceSolutionWord" class="form-control"/></div>
                                    <div class="ELCE-ESolutionWord"><label for="elceDefinitionWord">${_('Definition')}:</label><input type="text" id="elceDefinitionWord" class="form-control"/></div>
                                </div>
                            </div>                           
                            <div class="ELCE-ENavigationButtons gap-2">
                                <a href="#" id="elceAdd" class="ELCE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceFirst" class="ELCE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elcePrevious" class="ELCE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="ELCE-ENavigationButton" /></a>
                                <label class="sr-av" for="elceNumberQuestion">${_('Question number:')}</label><input type="text" class="ELCE-NumberQuestion form-control" id="elceNumberQuestion" value="1"/>
                                <a href="#" id="elceNext" class="ELCE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceLast" class="ELCE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceDelete" class="ELCE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceCopy" class="ELCE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elceCut" class="ELCE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="ELCE-ENavigationButton" /></a>
                                <a href="#" id="elcePaste" class="ELCE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="ELCE-ENavigationButton" /></a>
                            </div>
                            <div class="ELCE-ENumQuestionDiv" id="elceNumQuestionDiv">
                                <div class="ELCE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div> <span class="ELCE-ENumQuestions" id="elceNumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                 </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(10)}

            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('electricalCircuitsIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

        $exeDevice.enableForm();
    },

    initQuestions: function () {


        if ($exeDevice.selectsGame.length == 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.selectsGame.push(question);
            this.showOptions(4);
            this.showSolution('');
        }
        $exeDevice.showTypeQuestion(0);
        this.active = 0;
    },

    defaultTikzCode: '\\begin{circuitikz}\\draw  (0,0) to[battery1, l=$V$] (0,3) to[short] (3,3) to[R, l=$R_1$] (3,1.5)  to[R, l=$R_2$] (3,0)  to[short] (0,0); \\end{circuitikz}',

    getCuestionDefault: function () {
        const p = {
            typeSelect: 0,
            time: 0,
            numberOptions: 4,
            tikzCode: $exeDevice.defaultTikzCode,
            quextion: c_('What type of circuit is shown?'),
            options: [c_('Series circuit'), c_('Parallel circuit'), c_('Mixed circuit'), c_('Open circuit')],
            solution: 'A',
            solutionQuestion: '',
            percentageShow: 35,
            description: c_('Circuit with a battery connected in series with two resistors')
        };
        return p;
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;

            const wrapper = $('<div></div>').html(originalHTML),
                json = $exeDevices.iDevice.gamification.helpers.decrypt(
                    $('.electrical-circuits-DataGame', wrapper).text()
                ),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            if (dataGame) {
                $exeDevice.updateFieldGame(dataGame);

                const instructions =
                    dataGame.instructionsExe || dataGame.instructions;
                if (instructions) {
                    $exeDevice.setEditorContent('eXeGameInstructions', unescape(instructions));
                }
                const textAfter = dataGame.textAfter || '';
                if (textAfter) {
                    $exeDevice.setEditorContent('eXeIdeviceTextAfter', unescape(textAfter));
                }
                const textFeedBack = dataGame.textFeedBack || '';
                if (textFeedBack) {
                    $exeDevice.setEditorContent('elceFeedBackEditor', unescape(textFeedBack));
                }
            }
        }
    },

    updateFieldGame: function (game) {
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.answersRamdon = game.answersRamdon || false;
        game.questionsRandom = game.questionsRandom || false;
        game.percentajeFB =
            typeof game.percentajeFB != 'undefined' ? game.percentajeFB : 100;
        game.feedBack =
            typeof game.feedBack != 'undefined' ? game.feedBack : false;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted != 'undefined' ? game.weighted : 100;
        game.globalTime =
            typeof game.globalTime != 'undefined' ? game.globalTime : 0;
        game.activityMode =
            typeof game.activityMode != 'undefined' ? game.activityMode : 'test';

        $('input[name="slcactivitymode"][value="' + game.activityMode + '"]').prop('checked', true);
        $exeDevice.toggleActivityMode(game.activityMode);

        $exeDevice.id =
            typeof game.id !== 'undefined'
                ? game.id
                : $exeDevice.getIdeviceID();

        $('#elceShowMinimize').prop('checked', game.showMinimize);
        $('#elceAnswersRamdon').prop('checked', game.answersRamdon);
        $('#elceQuestionsRandom').prop('checked', game.questionsRandom);
        $('#elceShowSolution').prop('checked', game.showSolution);
        $('#elceTimeShowSolution').prop('disabled', !game.showSolution);
        $('#elceTimeShowSolution').val(game.timeShowSolution);
        $('#elceModeBoard').prop('checked', game.modeBoard);
        $('#elceScoreQuestionDiv')
            .addClass('d-none')
            .removeClass('d-flex');
        $('#elceHasFeedBack').prop('checked', game.feedBack);
        $('#elcePercentajeFB').val(game.percentajeFB);
        $('#elcePercentajeQuestionsValue').val(game.percentajeQuestions);
        $('#elceEvaluation').prop('checked', game.evaluation);
        $('#elceEvaluationID').val(game.evaluationID);
        $('#elceGlobalTimes').val(game.globalTime);

        $('#elceEvaluationID').prop('disabled', !game.evaluation);

        for (let i = 0; i < game.selectsGame.length; i++) {
            game.selectsGame[i].typeSelect =
                typeof game.selectsGame[i].typeSelect == 'undefined'
                    ? ''
                    : game.selectsGame[i].typeSelect;
            game.selectsGame[i].solutionQuestion =
                typeof game.selectsGame[i].solutionQuestion == 'undefined'
                    ? ''
                    : game.selectsGame[i].solutionQuestion;
            game.selectsGame[i].tikzCode =
                typeof game.selectsGame[i].tikzCode == 'undefined'
                    ? ''
                    : game.selectsGame[i].tikzCode;
            game.selectsGame[i].description =
                typeof game.selectsGame[i].description == 'undefined'
                    ? ''
                    : game.selectsGame[i].description;
        }
        if (game.feedBack) {
            $('#elceFeedbackP').show();
        } else {
            $('#elceFeedbackP').hide();
        }
        $('#elcePercentajeFB').prop('disabled', !game.feedBack);
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.selectsGame = game.selectsGame;
        $exeDevice.updateSelectOrder();
        $exeDevice.showQuestion($exeDevice.active);
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
        if (!$exeDevice.validateQuestion()) {
            return false;
        }

        const dataGame = this.validateData();
        if (!dataGame) {
            return false;
        }

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        const fields = this.ci18n;
        const i18n = { ...fields };

        for (let key in fields) {
            const fVal = $('#ci18n_' + key).val();
            if (fVal !== '') {
                i18n[key] = fVal;
            }
        }

        dataGame.msgs = i18n;

        const json = JSON.stringify(dataGame),
            instructions = $exeDevice.getEditorContent('eXeGameInstructions');

        let divContent = '';
        if (instructions !== '') {
            divContent = `<div class="electrical-circuits-instructions SLCNP-instructions">${instructions}</div>`;
        }

        const textFeedBack = $exeDevice.getEditorContent('elceFeedBackEditor');
   
        let html = '<div class="electrical-circuits-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html += `<div class="electrical-circuits-version js-hidden">${$exeDevice.version}</div>`;
        html += `<div class="electrical-circuits-feedback-game">${textFeedBack}</div>`;
        html += `<div class="electrical-circuits-DataGame js-hidden">${$exeDevices.iDevice.gamification.helpers.encrypt(json)}</div>`;

        const textAfter = $exeDevice.getEditorContent('eXeIdeviceTextAfter');
        if (textAfter !== '') {
            html += `<div class="electrical-circuits-extra-content">${textAfter}</div>`;
        }

        html += `<div class="electrical-circuits-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';

        return html;
    },

    validateQuestion: function () {
        const msgs = $exeDevice.msgs;
        const activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test';
        let p = {},
            message = '';

        p.time = parseInt($('input[name=slctime]:checked').val());
        p.numberOptions = parseInt($('input[name=slcnumber]:checked').val());
        p.typeSelect = parseInt($('input[name=slctypeselect]:checked').val());
        p.customScore = parseFloat($('#elceScoreQuestion').val()) || 1;
        p.tikzCode = $('#elceTikzCode').val().trim();
        p.description = $('#elceDescription').val().trim();

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        p.quextion = $('#elceQuestion').val().trim();
        p.options = [];
        p.solution = $('#elceSolutionSelect').text().trim();
        p.solutionQuestion = '';

        if (p.typeSelect == 2) {
            p.quextion = $('#elceDefinitionWord').val().trim();
            p.solution = '';
            p.solutionQuestion = $('#elceSolutionWord').val();
        }

        p.percentageShow = parseInt($('#elcePercentageShow').val());

        let optionEmpy = false;
        $('.ELCE-EAnwersOptions').each(function (i) {
            let option = $(this).val().trim();
            if (i < p.numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            if (p.typeSelect == 2) {
                option = '';
            }
            p.options.push(option);
        });

        if (activityMode === 'test') {
            if (p.typeSelect == 1 && p.solution.length != p.numberOptions) {
                message = msgs.msgTypeChoose;
            } else if (p.typeSelect != 2 && p.quextion.length == 0) {
                message = msgs.msgECompleteQuestion;
            } else if (p.typeSelect != 2 && optionEmpy) {
                message = msgs.msgECompleteAllOptions;
            } else if (p.typeSelect == 2 && p.solutionQuestion.trim().length == 0) {
                message = $exeDevice.msgs.msgEProvideWord;
            } else if (p.typeSelect == 2 && p.quextion.trim().length == 0) {
                message = $exeDevice.msgs.msgEDefintion;
            }
        }

        if (message.length == 0) {
            $exeDevice.selectsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }

        return message;
    },



    getIdeviceID: function () {
        const ideviceid =
            $('#electricalCircuitsIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.selectsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('test')}.txt`;

        document.getElementById('electricalCircuitsIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document
                .getElementById('electricalCircuitsIdeviceForm')
                .removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (questions) {
        let linequestions = [];
        for (let i = 0; i < questions.length; i++) {
            let q = questions[i];
            let question = '';
            if (q.typeSelect !== 2) {
                question = `${q.solution}#${q.quextion}`;
                for (let j = 0; j < q.options.length; j++) {
                    if (q.options[j]) {
                        question += `#${q.options[j]}`;
                    }
                }
            } else {
                question = `${q.solutionQuestion}#${q.quextion}`;
            }

            linequestions.push(question);
        }
        return linequestions;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test',
            instructions = $('#eXeGameInstructions').text(),
            instructionsExe = escape(
                $exeDevice.getEditorContent('eXeGameInstructions')
            ),
            textAfter = escape($exeDevice.getEditorContent('eXeIdeviceTextAfter')),
            textFeedBack = escape(
                $exeDevice.getEditorContent('elceFeedBackEditor')
            ),
            showMinimize = $('#elceShowMinimize').is(':checked'),
            modeBoard = $('#elceModeBoard').is(':checked'),
            answersRamdon = $('#elceAnswersRamdon').is(':checked'),
            questionsRandom = $('#elceQuestionsRandom').is(':checked'),
            showSolution = $('#elceShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#elceTimeShowSolution').val())
            ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#elceHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#elcePercentajeFB').val())),
            percentajeQuestions = parseInt(
                clear($('#elcePercentajeQuestionsValue').val())
            ),
            evaluation = $('#elceEvaluation').is(':checked'),
            evaluationID = $('#elceEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            globalTime = parseInt($('#elceGlobalTimes').val(), 10);

        if (!itinerary) return false;

        if (activityMode === 'test') {
            if (feedBack && textFeedBack.trim().length == 0) {
                eXe.app.alert($exeDevice.msgs.msgProvideFB);
                return false;
            }
            if (showSolution && timeShowSolution.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
                return false;
            }
            if (evaluation && evaluationID.length < 5) {
                eXe.app.alert($exeDevice.msgs.msgIDLenght);
                return false;
            }
        }
        const selectsGame = $exeDevice.selectsGame;

        if (activityMode === 'test') {
            for (let i = 0; i < selectsGame.length; i++) {
                let mquestion = selectsGame[i];
                mquestion.customScore =
                    typeof mquestion.customScore == 'undefined'
                        ? 1
                        : mquestion.customScore;
                if (mquestion.quextion.length == 0) {
                    $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                    return false;
                }
                if (mquestion.typeSelect == 2) {
                    if (mquestion.solutionQuestion.length == 0) {
                        $exeDevice.showMessage($exeDevice.msgs.msgProvideSolution);
                        return false;
                    }
                } else {
                    let completAnswer = true;
                    for (let j = 0; j < mquestion.numberOptions; j++) {
                        if (mquestion.options[j].length == 0) {
                            completAnswer = false;
                        }
                    }
                    if (!completAnswer) {
                        $exeDevice.showMessage(
                            $exeDevice.msgs.msgECompleteAllOptions
                        );
                        return false;
                    }
                }
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            asignatura: '',
            author: '',
            typeGame: 'ElectricalCircuits',
            activityMode: activityMode,
            instructionsExe: instructionsExe,
            instructions: instructions,
            showMinimize: showMinimize,
            answersRamdon: answersRamdon,
            questionsRandom: questionsRandom,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            useLives: false,
            numberLives: 3,
            itinerary: itinerary,
            selectsGame: selectsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            title: '',
            customScore: false,
            textAfter: textAfter,
            textFeedBack: textFeedBack,
            gameMode: 1,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: 3.1,
            percentajeQuestions: percentajeQuestions,
            modeBoard: modeBoard,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
            globalTime: globalTime,
        };
    },

    removeTags: function (str) {
        return $('<div></div>').html(str).text();
    },

    showTypeQuestion: function (type) {
        if (type == 2) {
            $('#elceAnswers').hide();
            $('#elceQuestionDiv')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#electricalCircuitsIdeviceForm .ELCE-ESolutionSelect').hide();
            $('#elceInputNumbers')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#elceSolitionOptions')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#elcePercentageSpan')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#elcePercentage').removeClass('d-none').addClass('d-flex');
            $('#elceWordDiv').show();
        } else {
            $('#elceAnswers').show();
            $('#elceQuestionDiv')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#electricalCircuitsIdeviceForm .ELCE-ESolutionSelect').show();
            $('#elceInputNumbers')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#elceSolitionOptions')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#elcePercentageSpan')
                .removeClass('d-flax')
                .addClass('d-none');
            $('#elcePercentage').removeClass('d-flax').addClass('d-none');
            $('#elceWordDiv').hide();
        }
    },

    addEvents: function () {
        const $elcePaste = $('#elcePaste'),
            $elceTimeShowSolution = $('#elceTimeShowSolution'),
            $elceShowSolution = $('#elceShowSolution'),
            $elcePercentajeQuestions = $(
                '#elcePercentajeQuestionsValue'
            ),
            $elceNumberQuestion = $('#elceNumberQuestion'),
            $electricalCircuitsForm = $('#electricalCircuitsIdeviceForm');

        $elcePaste.hide();

        // Activity mode (Test / Show)
        $('#elceModeTest, #elceModeShow').on('click', function () {
            $exeDevice.toggleActivityMode($(this).val());
        });

        // Toggle switch delegation
        $electricalCircuitsForm.on(
            'click.qq.toggle',
            '.toggle-item',
            function (e) {
                if (
                    $(e.target).is(
                        'input.toggle-input, label[for], input[type=number], input[type=text], select, textarea, button'
                    )
                )
                    return;
                if (
                    $(e.target).is('#elceEvaluationID') ||
                    $(e.target).closest('#elceEvaluationHelpLnk').length
                )
                    return;
                const $input = $(this).find('input.toggle-input').first();
                if ($input.length) {
                    const newVal = !$input.prop('checked');
                    $input.prop('checked', newVal).trigger('change');
                }
            }
        );

        $electricalCircuitsForm.on(
            'click',
            '#elceEvaluationID',
            function (e) {
                e.stopPropagation();
            }
        );
        $electricalCircuitsForm.on(
            'click',
            '#elceEvaluationHelpLnk, #elceEvaluationHelpLnk *',
            function (e) {
                e.stopPropagation();
            }
        );

        $('#elceShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#elceCodeAccess, #elceMessageCodeAccess').prop(
                'disabled',
                !marcado
            );
        });

        $('.ELCE-EPanel').on('click', 'input.ELCE-TypeSelect', function () {
            const type = parseInt($(this).val(), 10);
            $exeDevice.showTypeQuestion(type);
        });

        $('.ELCE-EPanel').on('click', 'input.ELCE-Number', function () {
            const number = parseInt($(this).val(), 10);
            $exeDevice.showOptions(number);
        });

        $('#elceAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#elceFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#elcePrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#elceNext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#elceLast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#elceDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#elceCopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#elceCut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#elcePaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#elceGlobalTimeButton').on('click', (e) => {
            e.preventDefault();
            const selectedTime = parseInt(
                $('#elceGlobalTimes').val(),
                10
            );
            for (let i = 0; i < $exeDevice.selectsGame.length; i++) {
                $exeDevice.selectsGame[i].time = selectedTime;
            }
            $(
                `input.ELCE-Times[name='slctime'][value='${selectedTime}']`
            ).prop('checked', true);
        });

        // TikZ preview button
        $('#elcePreviewTikz').on('click', (e) => {
            e.preventDefault();
            $exeDevice.renderTikzPreview();
        });

        $elceTimeShowSolution
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 3, 10);
                val = Math.max(1, Math.min(val, 9));
                this.value = val;
            });

        $('#elcePercentageShow')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 35, 10);
                val = Math.max(0, Math.min(val, 100));
                this.value = val;
            });

        $('#elceScoreQuestion').on('focusout', function () {
            if (!$exeDevice.validateScoreQuestion($(this).val())) {
                $(this).val(1);
            }
        });

        if (
            window.File &&
            window.FileReader &&
            window.FileList &&
            window.Blob
        ) {
            $('#eXeGameExportImport .exe-field-instructions')
                .eq(0)
                .text(`${_('Supported formats')}: txt, xml(Moodle)`);
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame')
                .attr('accept', '.txt, .xml')
                .on('change', function (e) {
                    const file = e.target.files[0];
                    if (!file) {
                        $exeDevice.showMessage(
                            `${_('Select a file')} (txt, xml(Moodle))`
                        );
                        return;
                    }
                    if (
                        !file.type ||
                        !(
                            file.type.match('text/plain') ||
                            file.type.match('application/json') ||
                            file.type.match('application/xml') ||
                            file.type.match('text/xml')
                        )
                    ) {
                        $exeDevice.showMessage(
                            `${_('Select a file')} (txt, xml(Moodle))`
                        );
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        $exeDevice.importGame(e.target.result, file.type);
                    };
                    reader.readAsText(file);
                });
            $('#eXeGameExportQuestions').on('click', () => {
                $exeDevice.exportQuestions();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }


        $elceShowSolution.on('change', function () {
            const marcado = $(this).is(':checked');
            $elceTimeShowSolution.prop('disabled', !marcado);
        });

        $('.ELCE-ESolution').on('change', function () {
            const marcado = $(this).is(':checked'),
                value = $(this).val();
            $exeDevice.clickSolution(marcado, value);
        });

        $('#elceHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#elceFeedbackP').slideToggle(marcado);
            $('#elcePercentajeFB').prop('disabled', !marcado);
        });

        $elcePercentajeQuestions
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('click', function () {
                $exeDevice.updateQuestionsNumber();
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 100, 10);
                val = Math.max(1, Math.min(val, 100));
                this.value = val;
                $exeDevice.updateQuestionsNumber();
            });

        $elceNumberQuestion.on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.active = Math.min(
                            num - 1,
                            $exeDevice.selectsGame.length - 1
                        );
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#elceEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#elceEvaluationID').prop('disabled', !marcado);
        });

        $('#elceEvaluationHelpLnk').on('click', function () {
            $('#elceEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            10,
            $exeDevice.insertQuestions
        );

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },



    clickSolution: function (checked, value) {
        let solutions = $('#elceSolutionSelect').text();
        if (checked) {
            if (solutions.indexOf(value) == -1) {
                solutions += value;
            }
        } else {
            solutions = solutions.split(value).join('');
        }
        $('#elceSolutionSelect').text(solutions);
    },

    validateScoreQuestion: function (text) {
        const isValid =
            text.length > 0 &&
            text !== '.' &&
            text !== ',' &&
            /^-?\d*[.,]?\d*$/.test(text);
        return isValid;
    },


    importMoodle(xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            $exeDevice.importCuestionaryXML(xmlString);
        } else {
            eXe.app.alert(_('Sorry, wrong file format'));
        }
    },

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);

        if (content && content.includes('\u0000')) {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
            return;
        } else if (!game && content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else if (
                filetype.match('application/xml') ||
                filetype.match('text/xml')
            ) {
                $exeDevice.importMoodle(content);
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
            return;
        } else if (!game || typeof game.typeGame === 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame === 'ElectricalCircuits' || game.typeGame === 'Selecciona') {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.active = 0;
            $exeDevice.updateFieldGame(game);
            const instructions = game.instructionsExe || game.instructions,
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '';
            $exeDevice.setEditorContent('eXeGameInstructions', unescape(instructions));
            $exeDevice.setEditorContent('eXeIdeviceTextAfter', unescape(tAfter));
            $exeDevice.setEditorContent('elceFeedBackEditor', unescape(textFeedBack));
        } else if (game.typeGame === 'QuExt') {
            $exeDevice.selectsGame = $exeDevice.importQuExt(game);
        } else if (game.typeGame === 'Rosco' || game.typeGame === 'Adivina') {
            $exeDevice.selectsGame = $exeDevice.importRosco(game);
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }

        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        $exeDevice.updateSelectOrder();
    },

    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        if ($(xmlDoc).find('parsererror').length > 0) {
            return false;
        }

        const quiz = $(xmlDoc).find('quiz').first();
        if (quiz.length === 0) {
            return false;
        }

        const questions = quiz.find('question'),
            questionsJson = [];
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i],
                type = $(question).attr('type');

            if (
                ![
                    'multichoice',
                    'truefalse',
                    'numerical',
                    'shortanswer',
                ].includes(type)
            ) {
                continue;
            }

            const typeSelect = type === 'shortanswer' ? 2 : 0,
                questionText = $(question).find('questiontext').first().text(),
                answers = $(question).find('answer');
            let options = [],
                solution = '',
                solutionQuestion = '';

            if (typeSelect === 0) {
                for (let j = 0; j < answers.length; j++) {
                    const answer = answers[j],
                        answerHtml = $exeDevice.removeTags(
                            $(answer).find('text').eq(0).text().trim()
                        ),
                        answerText = answerHtml.split('\n')[0].trim();
                    options.push(answerText);
                    if (parseFloat($(answer).attr('fraction')) > 0) {
                        solution += String.fromCharCode(65 + j);
                    }
                }
            } else if (typeSelect === 2) {
                let maxFraction = -1;
                for (let j = 0; j < answers.length; j++) {
                    const answer = answers[j],
                        answerHtml = $(answer).find('text').eq(0).text().trim(),
                        answerText = answerHtml.split('\n')[0].trim(),
                        currentFraction = parseFloat(
                            $(answer).attr('fraction')
                        );
                    if (currentFraction > maxFraction) {
                        maxFraction = currentFraction;
                        solutionQuestion = answerText;
                    }
                }
            }

            questionsJson.push({
                typeSelect,
                question: $exeDevice.removeTags(questionText.trim()),
                options,
                solution,
                solutionQuestion,
            });
        }

        let questionsj = [];
        questionsJson.forEach((question) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = question.typeSelect;
            if (p.typeSelect === 0) {
                p.quextion = question.question;
                p.options[0] = question.options[0] || '';
                p.options[1] = question.options[1] || '';
                p.options[2] = question.options[2] || '';
                p.options[3] = question.options[3] || '';
                p.solution = question.solution;
                p.numberOptions = question.options.length;
                if (p.numberOptions === 2) {
                    p.options[0] =
                        p.options[0] === 'true' ? _('True') : p.options[0];
                    p.options[0] =
                        p.options[0] === 'false' ? _('False') : p.options[0];
                    p.options[1] =
                        p.options[1] === 'true' ? _('True') : p.options[1];
                    p.options[1] =
                        p.options[1] === 'false' ? _('False') : p.options[1];
                }
                if (question.question && question.options.length > 1) {
                    questionsj.push(p);
                }
            } else if (p.typeSelect === 2) {
                p.quextion = question.question;
                p.solutionQuestion = question.solutionQuestion;
                p.percentageShow = 35;
                if (question.question && question.solutionQuestion) {
                    questionsj.push(p);
                }
            }
        });

        $exeDevice.addQuestions(questionsj);
    },

    importGlosary: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) {
            return false;
        }

        const $entries = $xml.find('ENTRIES').first();
        if ($entries.length === 0) {
            return false;
        }

        const questionsJson = [];
        $entries.find('ENTRY').each(function () {
            const $this = $(this),
                concept = $this.find('CONCEPT').text(),
                definition = $this
                    .find('DEFINITION')
                    .text()
                    .replace(/<[^>]*>/g, '');
            if (concept && definition) {
                questionsJson.push({
                    solution: concept,
                    question: definition,
                });
            }
        });

        let questionsj = [];
        questionsJson.forEach((question) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = 2;
            p.quextion = question.question;
            p.solutionQuestion = question.solution;
            p.percentageShow = 35;
            if (p.quextion.length > 0 && p.solutionQuestion.length > 0) {
                questionsj.push(p);
            }
        });

        $exeDevice.addQuestions(questionsj);
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines);
    },

    insertQuestions: function (lines) {
        // Format: Description#TikzCode#Solution#Question#OptionA#OptionB[#OptionC][#OptionD]
        const lineFormat =
                /^([^#]+)#([^#]+)#([0-3]|[ABCD]{1,4})#([^#]+)#([^#]+)#([^#]+)(#([^#]*))?(#([^#]*))?$/i,
            lineFormat1 = /^([^#]+)#([^#]+)$/;
        let questions = [];

        lines.forEach((line) => {
            const p = $exeDevice.getCuestionDefault();
            if (lineFormat.test(line)) {
                const linarray = line.trim().split('#'),
                    description = linarray[0],
                    tikzCode = linarray[1],
                    solution = linarray[2];
                let solutionChar = solution;
                if (!isNaN(solution)) {
                    const index = parseInt(solution, 10),
                        letters = 'ABCD';
                    if (index >= 0 && index < letters.length) {
                        solutionChar = letters.charAt(index);
                    }
                }
                p.description = description;
                p.tikzCode = tikzCode;
                p.solution = solutionChar;
                p.quextion = linarray[3];
                p.options[0] = linarray[4] || '';
                p.options[1] = linarray[5] || '';
                p.options[2] = linarray[6] || '';
                p.options[3] = linarray[7] || '';
                p.numberOptions = linarray.length - 4;
                questions.push(p);
            } else if (lineFormat1.test(line)) {
                const linarray1 = line.trim().split('#');
                p.typeSelect = 2;
                p.solutionQuestion = linarray1[0];
                p.quextion = linarray1[1];
                p.percentageShow = 35;
                if (p.quextion && p.solutionQuestion) {
                    questions.push(p);
                }
            }
        });

        $exeDevice.addQuestions(questions);
    },

    addQuestions: function (questions) {
        if (!questions || questions.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        for (let i = 0; i < questions.length; i++) {
            $exeDevice.selectsGame.push(questions[i]);
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
    },

    importQuExt: function (data) {
        data.questionsGame.forEach((cuestion) => {
            const p = $exeDevice.getCuestionDefault();
            p.typeSelect = 0;
            p.time = cuestion.time;
            p.numberOptions = cuestion.numberOptions;
            p.quextion = cuestion.quextion;
            p.options = [...cuestion.options];

            let numOpt = 0;
            for (let j = 0; j < p.options.length; j++) {
                if (p.options[j].trim().length === 0) {
                    p.numberOptions = numOpt;
                    break;
                }
                numOpt++;
            }

            const solution = 'ABCD';
            p.solution = solution.charAt(cuestion.solution);
            p.solutionQuestion = '';
            p.percentageShow = 35;
            $exeDevice.selectsGame.push(p);
        });
        return $exeDevice.selectsGame;
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.selectsGame.length > 1) {
            const quextion = $('#elceQuestion').val().trim(),
                typeSelect = parseInt(
                    $('input[name=slctypeselect]:checked').val(),
                    10
                ),
                solutionQuestion =
                    typeSelect === 2 ? $('#elceSolutionWord').val() : '';
            let shouldRemove = false;

            if (typeSelect === 2) {
                const definition = $('#elceDefinitionWord').val().trim();
                if (definition.length === 0 && solutionQuestion.length === 0) {
                    shouldRemove = true;
                }
            } else {
                let empty = true;
                $('.ELCE-EAnwersOptions').each(function () {
                    if ($(this).val().trim().length > 0) {
                        empty = false;
                    }
                });
                if (quextion.length === 0 && empty) {
                    shouldRemove = true;
                }
            }

            if (shouldRemove) {
                $exeDevice.removeQuestion();
            }
        }
    },

    importRosco: function (data) {
        for (let i = 0; i < data.wordsGame.length; i++) {
            const p = $exeDevice.getCuestionDefault();
            const cuestion = data.wordsGame[i];
            const msc = $exeDevice.msgs.msgContaint.replace(
                '%1',
                cuestion.letter
            );
            const mss = $exeDevice.msgs.msgStartWith.replace(
                '%1',
                cuestion.letter
            );
            const start = cuestion.type == 1 ? msc : mss;
            p.typeSelect = 2;
            p.time =
                cuestion.time || $exeDevice.getIndexTime(data.timeQuestion);
            p.numberOptions = 4;
            p.quextion = start + ': ' + cuestion.definition;
            p.options = ['', '', '', ''];
            p.solution = '';
            p.solutionQuestion = cuestion.word;
            p.percentageShow = cuestion.percentageShow || data.percentageShow;
            if (p.solutionQuestion.trim().length > 0) {
                $exeDevice.selectsGame.push(p);
            }
        }
        return $exeDevice.selectsGame;
    },

    getIndexTime: function (tm) {
        const tms = [15, 30, 60, 180, 300, 600, 900];
        let itm = tms.indexOf(tm);
        itm = itm < 0 ? 1 : itm;
        return itm;
    },
};
