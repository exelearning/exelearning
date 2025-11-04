/* eslint-disable no-undef */
/**
 * Hidden Image Activity iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    idevicePath: '',
    msgs: {},
    classIdevice: 'hidden-image',
    active: 0,
    questionsGame: [],
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    version: 1,
    id: false,
    checkAltImage: true,
    accesibilityIsOk: true,
    i18n: {
        name: _('Hidden image'),
    },
    ci18n: {},

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    enableForm: function () {
        $exeDevice.initQuestions();
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },
    refreshTranslations: function () {
        this.ci18n = {
            msgStartGame: c_('Click here to start'),
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
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time game'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgCool: c_('Cool!'),
            msgAllQuestions: c_('Questions completed!'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgQuestion: c_('Question'),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgInformation: c_('Information'),
            msgAuthor: c_('Authorship'),
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
            msgClose: c_('Close'),
            msgOption: c_('Option'),
            msgUseFulInformation: c_(
                'and information that will be very useful'
            ),
            msgLoading: c_('Loading. Please wait...'),
            msgPoints: c_('points'),
            msgAudio: c_('Audio'),
            msgEndGameScore: c_('Please start playing first...'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgCardClick: c_('Click on a card. Attempts: %s'),
            msgGameOver: c_('You finished the game. Your score is %s.'),
            msgattempts0: c_(
                'No more attempts left. Please answer the question.'
            ),
            msgEndTime: c_('Time Over. 0 points'),
            msgTypeGame: c_('Hidden image'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image'
        );
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgECompleteAllOptions = _(
            'You have to complete all the selected options'
        );
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'Are you sure you want to continue without including an image description? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
    },

    playSound: function (selectedFile) {
        const selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);
        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio.addEventListener('canplaythrough', function () {
            $exeDevice.playerAudio.play();
        });
    },

    stopSound: function () {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause === 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion() !== false) {
            $exeDevice.clearQuestion();
            $exeDevice.questionsGame.push($exeDevice.getDefaultQuestion());
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#hiEPaste').hide();
            $('#hiENumQuestions').text($exeDevice.questionsGame.length);
            $('#hiENumberQuestion').val($exeDevice.questionsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.questionsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        }
        $exeDevice.questionsGame.splice($exeDevice.active, 1);
        if ($exeDevice.active >= $exeDevice.questionsGame.length - 1) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
        }
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.typeEdit = -1;
        $('#hiEPaste').hide();
        $('#hiENumQuestions').text($exeDevice.questionsGame.length);
        $('#hiENumberQuestion').val($exeDevice.active + 1);
        $exeDevice.updateQuestionsNumber();
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.questionsGame[$exeDevice.active])
            );
            $('#hiEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#hiEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            $exeDevice.questionsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit === 1) {
            $('#hiEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.questionsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#hiENumQuestions').text($exeDevice.questionsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.questionsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.questionsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
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

    updateQuestionsNumber: function () {
        let percentage = parseInt(
            $exeDevice.removeTags($('#hiEPercentajeQuestions').val())
        );
        if (isNaN(percentage)) return;

        percentage = Math.min(Math.max(percentage, 1), 100);
        const totalQuestions = $exeDevice.questionsGame.length;
        let num = Math.max(Math.round((percentage * totalQuestions) / 100), 1);

        $('#hiENumeroPercentaje').text(`${num}/${totalQuestions}`);
    },

    showQuestion: function (i) {
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.questionsGame.length
                ? $exeDevice.questionsGame.length - 1
                : num;
        const p = $exeDevice.questionsGame[num];
        let numOptions = 0;

        $('.HIE-AnwersOptions').each(function (j) {
            numOptions++;
            if (p.options[j].trim() !== '') {
                p.numOptions = numOptions;
            }
            $(this).val(p.options[j]);
        });

        $exeDevice.showOptions(p.numberOptions);
        $('#hiEQuestion').val(p.question);
        $('#hiENumQuestions').text($exeDevice.questionsGame.length);
        $('#hiEURLImage').val(p.url);
        $('#hiEXImage').val(p.x);
        $('#hiEYImage').val(p.y);
        $('#hiEAuthor').val(p.author);
        $('#hiEAlt').val(p.alt);
        $('#hiETimeQuestion').val(p.time);
        $('#hiERows').val(p.rows);
        $('#hiEColumns').val(p.columns);
        $('#hiEAttempts').val(p.attempts);

        $exeDevice.showImage(p.url, p.alt);

        $('.HIE-AnwersOptions').each(function (j) {
            const option = j < p.numOptions ? p.options[j] : '';
            $(this).val(option);
        });

        $exeDevice.stopSound();
        p.audio = p.audio && p.audio !== 'undefined' ? p.audio : '';
        if (p.audio.trim().length > 4) $exeDevice.playSound(p.audio.trim());

        $('#hiEURLAudio').val(p.audio);
        $('#hiENumberQuestion').val(i + 1);
        $('#hiEScoreQuestion').val(1);
        if (typeof p.customScore !== 'undefined') {
            $('#hiEScoreQuestion').val(p.customScore);
        }
        $('#hiEMessageKO').val(p.msgError);
        $('#hiEMessageOK').val(p.msgHit);
        $(
            `input.HIE-Number[name='qxtnumber'][value='${p.numberOptions}']`
        ).prop('checked', true);
        $(`input.HIE-Solution[name='hisoluiton'][value='${p.solution}']`).prop(
            'checked',
            true
        );
    },

    showImage: function (url, alt) {
        const $image = $('#hiEImage');
        const $nimage = $('#hiENoImage');
        $image.hide();
        $image.attr('alt', alt);
        $nimage.show();
        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);
        $image.prop('src', url).on('load', function () {
            $image.show();
            $nimage.hide();
            return true;
        });
    },

    clearQuestion: function () {
        $exeDevice.showOptions(4);
        $exeDevice.showSolution(0);
        $('.HIE-Number')[2].checked = true;
        $('#hiEURLImage').val('');
        $('#hiEXImage').val('0');
        $('#hiEYImage').val('0');
        $('#hiEAuthor').val('');
        $('#hiEAlt').val('');
        $('#hiEURLYoutube').val('');
        $('#hiEURLAudio').val('');
        $('#hiEQuestion').val('');
        $('.HIE-AnwersOptions').each(function () {
            $(this).val('');
        });
        $('#hiEMessageOK').val('');
        $('#hiEMessageKO').val('');
    },

    showOptions: function (number) {
        $('.HIE-OptionDiv').each(function (i) {
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showSolution(0);
            }
        });
        $('.HIE-AnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showSolution: function (solution) {
        $('.HIE-Solution')[solution].checked = true;
    },

    createForm: function () {
        let path = $exeDevice.idevicePath,
            html = `
            <div id="hiQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create interactive challenges in which students progressively reveal sections of a concealed image and then choose the correct answer based on the visual clues.')} <a style="display:none;" href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/quext.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Reveal the hidden image and choose the right answer.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div id="hiEOptions" class="mb-3">
                            <div class="toggle-item mb-3" data-target="hiEShowMinimize">
                                <span class="toggle-control"><input type="checkbox" class="toggle-input" id="hiEShowMinimize" /><span class="toggle-visual"></span></span>
                                <label class="toggle-label" for="hiEShowMinimize">${_('Show minimized.')}</label>
                            </div>
                            <div class="mb-3 d-flex flex-nowrap align-items-center gap-3">
                                <div class="toggle-item m-0" data-target="hiEQuestionsRamdon">
                                    <span class="toggle-control"><input type="checkbox" class="toggle-input" id="hiEQuestionsRamdon" /><span class="toggle-visual"></span></span>
                                    <label class="toggle-label" for="hiEQuestionsRamdon">${_('Random questions')}</label>
                                </div>
                                <div class="toggle-item m-0" data-target="hiEAnswersRamdon">
                                    <span class="toggle-control"><input type="checkbox" class="toggle-input" id="hiEAnswersRamdon" /><span class="toggle-visual"></span></span>
                                    <label class="toggle-label" for="hiEAnswersRamdon">${_('Random options')}</label>
                                </div>
                            </div>
                            <div class="mb-3 d-flex flex-nowrap align-items-center gap-2">
                                <label class="m-0" for="hiERevealTime">${_('Card hidden time (seconds)')}</label>
                                <input type="number" name="hiERevealTime" id="hiERevealTime" value="1" min="0" max="100" class="form-control" style="width:90px" />
                            </div>
                            <div class="toggle-item mb-3" data-target="hiECustomMessages">
                                <span class="toggle-control"><input type="checkbox" class="toggle-input" id="hiECustomMessages" /><span class="toggle-visual"></span></span>
                                <label class="toggle-label" for="hiECustomMessages">${_('Custom messages')}.</label>
                            </div>
                            <div class="mb-3 d-flex flex-nowrap align-items-center gap-3">
                                <div class="toggle-item toggle-related m-0" data-target="hiEShowSolution">
                                    <span class="toggle-control"><input type="checkbox" class="toggle-input" checked id="hiEShowSolution" /><span class="toggle-visual"></span></span>
                                    <label class="toggle-label" for="hiEShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <label class="m-0 d-flex align-items-center gap-2" for="hiETimeShowSolution">${_('Show solution time (seconds)')}</label>
                                <input type="number" name="hiETimeShowSolution" id="hiETimeShowSolution" value="3" min="1" max="9" class="form-control" style="width:70px" />
                            </div>
                            <div class="mb-3 d-flex flex-nowrap align-items-center gap-2">
                                <label class="m-0" for="hiEPercentajeQuestions">%${_('Questions')}:</label>
                                <input type="number" name="hiEPercentajeQuestions" id="hiEPercentajeQuestions" value="100" min="1" max="100" class="form-control" style="width:90px" />
                                <span id="hiENumeroPercentaje">1/1</span>
                            </div>
                            <div class="mb-3 d-flex flex-nowrap align-items-center gap-2 Games-Reportdiv">
                                <div class="toggle-item m-0" data-target="hiEEvaluation">
                                    <span class="toggle-control"><input type="checkbox" class="toggle-input" id="hiEEvaluation" /><span class="toggle-visual"></span></span>
                                    <label class="toggle-label" for="hiEEvaluation">${_('Progress report')}.</label>
                                </div>
                                <label class="m-0" for="hiEEvaluationID">${_('Identifier')}:</label>
                                <input type="text" id="hiEEvaluationID" disabled class="form-control" style="max-width:200px" value="${eXeLearning.app.project.odeId || ''}" />
                                <a href="#hiEEvaluationHelp" id="hiEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}"><img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}"/></a>

                            </div>
                            <p id="hiEEvaluationHelp" class="HIE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="HIE-Panel" id="hiEPanel">
                            <div class="HIE-OptionsMedia">
                                <div class="HIE-OptionsGame">
                                    <div class="mb-3 d-flex flex-nowrap align-items-center gap-2">
                                        <div class="d-flex flex-nowrap align-items-center gap-1">
                                            <label for="hiETimeQuestion" class="m-0">${_('Time (seconds)')}:</label>
                                            <input type="number" name="hiETimeQuestion" id="hiETimeQuestion" value="30" min="0" max="99" class="form-control" style="width:90px" />
                                        </div>
                                        <div class="d-flex flex-nowrap align-items-center gap-3">
                                            <label for="hiEAttempts" class="m-0">${_('Attempts')}:</label>
                                            <input type="number" name="hiEAttempts" id="hiEAttempts" value="4" min="1" max="30" class="form-control" style="width:90px" />
                                        </div>
                                    </div>
                                    <div class="mb-3 d-flex flex-nowrap align-items-center gap-2">
                                        <div class="d-flex flex-nowrap align-items-center gap-1">
                                            <label for="hiERows" class="m-0">${_('Rows')}:</label>
                                            <input type="number" name="hiERows" id="hiERows" value="4" min="2" max="10" class="form-control" style="width:90px" />
                                        </div>
                                        <div class="d-flex flex-nowrap align-items-center gap-2">
                                            <label for="hiEColumns" class="m-0">${_('Columns')}:</label>
                                            <input type="number" name="hiEColumns" id="hiEColumns" value="4" min="2" max="10" class="form-control" style="width:90px" />
                                        </div>
                                    </div>
                                    <div class="mb-3 d-flex flex-nowrap align-items-center gap-2">
                                        <span>${_('Options Number')}:</span>
                                        <div class="HIE-InputNumbers d-flex align-items-center gap-2">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="form-check-input HIE-Number" id="numQ2" type="radio" name="qxtnumber" value="2" />
                                                <label class="form-check-label" for="numQ2">2</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="form-check-input HIE-Number" id="numQ3" type="radio" name="qxtnumber" value="3" />
                                                <label class="form-check-label" for="numQ3">3</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="form-check-input HIE-Number" id="numQ4" type="radio" name="qxtnumber" value="4" checked="checked" />
                                                <label class="form-check-label" for="numQ4">4</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div id="hiEScoreQuestionDiv" class="HIE-ScoreQuestionDiv mb-3 d-none flex-nowrap align-items-center gap-2">
                                        <label for="hiEScoreQuestion" class="m-0">${_('Score')}:</label>
                                        <input type="number" name="hiEScoreQuestion" id="hiEScoreQuestion" value="1" min="0" max="100" step="0.05" class="form-control" style="width:90px" />
                                    </div>
                                    <span class="HIE-TitleImage" id="hiETitleImage">${_('Image URL')}</span>
                                    <div class="justify-content-start d-flex flex-nowrap align-items-center gap-2 mb-3" id="hiEInputImage">
                                        <label class="sr-av" for="hiEURLImage">${_('Image URL')}</label>
                                        <input type="text" class="exe-file-picker form-control me-0" id="hiEURLImage" />
                                        <a href="#" id="hiEPlayImage" class="HIE-NavigationButton HIE-PlayVideo" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="HIE-ButtonImage " /></a>
                                    </div>
                                    <div class="HIE-AuthorAlt mb-3 d-flex flex-nowrap align-items-center gap-2" id="hiEAuthorAlt">
                                        <div id="hiEInputAuthor" class="w-50">
                                            <label for="hiEAuthor" class="m-0">${_('Authorship')}</label>
                                            <input id="hiEAuthor" type="text" class="form-control w-100" />
                                        </div>
                                        <div id="hiEInputAlt" class="w-50">
                                            <label for="hiEAlt" class="m-0">${_('Alternative text')}</label>
                                            <input id="hiEAlt" type="text" class="form-control w-100" />
                                        </div>
                                    </div>
                                    <span id="hiETitleAudio">${_('Audio')}</span>
                                    <div class="justify-content-start  d-flex flex-nowrap align-items-center gap-1 mb-3" id="hiEInputAudio">
                                        <label class="sr-av" for="hiEURLAudio">${_('URL')}</label>
                                        <input type="text" class="exe-file-picker HIE-URLAudio form-control me-0" id="hiEURLAudio" />
                                        <a href="#" id="hiEPlayAudio" class="HIE-NavigationButton HIE-PlayVideo" title="${_('Play audio')}"><img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="HIE-ButtonImage " /></a>
                                    </div>
                                </div>
                                <div class="HIE-MultiMediaOption">
                                    <img class="HIE-Media" src="${path}quextIEImage.png" id="hiEImage" alt="${_('Image')}" style="display:none" />
                                    <img class="HIE-Media" src="${path}quextIEImage.png" id="hiENoImage" alt="${_('No image')}" />
                                </div>
                            </div>
                            <div class="HIE-Contents">
                                <span>${_('Question')}</span>
                                <div class="HIE-QuestionDiv mb-3 d-flex flex-nowrap align-items-center gap-2">
                                    <label class="sr-av" for="hiEQuestion">${_('Question')}:</label>
                                    <input type="text" class="HIE-Question form-control" id="hiEQuestion">
                                </div>
                                <div class="HIE-Answers">
                                    <div class="HIE-OptionDiv d-flex flex-nowrap align-items-center gap-2 mb-3">
                                        <label class="sr-av" for="hiESolution0">${_('Solution')} A:</label>
                                        <input type="radio" class="HIE-Solution form-check-input" name="hisoluiton" id="hiESolution0" value="0" checked="checked" />
                                        <label class="sr-av" for="hiEOption0">${_('Option')} A:</label>
                                        <input type="text" class="HIE-Option0 HIE-AnwersOptions form-control" id="hiEOption0">
                                    </div>
                                    <div class="HIE-OptionDiv d-flex flex-nowrap align-items-center gap-2 mb-3">
                                        <label class="sr-av" for="hiESolution1">${_('Solution')} B:</label>
                                        <input type="radio" class="HIE-Solution form-check-input" name="hisoluiton" id="hiESolution1" value="1" />
                                        <label class="sr-av" for="hiEOption1">${_('Option')} B:</label>
                                        <input type="text" class="HIE-Option1 HIE-AnwersOptions form-control" id="hiEOption1">
                                    </div>
                                    <div class="HIE-OptionDiv d-flex flex-nowrap align-items-center gap-2 mb-3">
                                        <label class="sr-av" for="hiESolution2">${_('Solution')} C:</label>
                                        <input type="radio" class="HIE-Solution form-check-input" name="hisoluiton" id="hiESolution2" value="2" />
                                        <label class="sr-av" for="hiEOption2">${_('Option')} C:</label>
                                        <input type="text" class="HIE-Option2 HIE-AnwersOptions form-control" id="hiEOption2">
                                    </div>
                                    <div class="HIE-OptionDiv d-flex flex-nowrap align-items-center gap-2 mb-3">
                                        <label class="sr-av" for="hiESolution3">${_('Solution')} D:</label>
                                        <input type="radio" class="HIE-Solution form-check-input" name="hisoluiton" id="hiESolution3" value="3" />
                                        <label class="sr-av" for="hiEOption3">${_('Option')} D:</label>
                                        <input type="text" class="HIE-Option3 HIE-AnwersOptions form-control" id="hiEOption3">
                                    </div>
                                </div>
                            </div>
                            <div class="HIE-Orders" id="hiEOrder">
                                <div class="HIE-ECustomMessage mb-3 d-flex flex-nowrap align-items-center gap-2">
                                    <span class="sr-av">${_('Hit')}</span><span class="HIE-EHit"></span>
                                    <label class="m-0" for="hiEMessageOK">${_('Message')}:</label>
                                    <input type="text" id="hiEMessageOK" class="form-control">
                                </div>
                                <div class="HIE-ECustomMessage mb-3 d-flex flex-nowrap align-items-center gap-2">
                                    <span class="sr-av">${_('Error')}</span><span class="HIE-Error"></span>
                                    <label class="m-0" for="hiEMessageKO">${_('Message')}:</label>
                                    <input type="text" id="hiEMessageKO" class="form-control">
                                </div>
                            </div>
                            <div class="HIE-NavigationButtons gap-1">
                                <a href="#" id="hiEAdd" class="HIE-NavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="HIE-ButtonImage" /></a>
                                <a href="#" id="hiEFirst" class="HIE-NavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="HIE-ButtonImage" /></a>
                                <a href="#" id="hiEPrevious" class="HIE-NavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="HIE-ButtonImage" /></a>
                                <label class="sr-av" for="hiENumberQuestion">${_('Question number:')}:</label><input type="text" class="HIE-NumberQuestion form-control" id="hiENumberQuestion" value="1"/>
                                <a href="#" id="hiENext" class="HIE-NavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="HIE-ButtonImage" /></a>
                                <a href="#" id="hiELast" class="HIE-NavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="HIE-ButtonImage" /></a>
                                <a href="#" id="hiEDelete" class="HIE-NavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="HIE-ButtonImage" /></a>
                                <a href="#" id="hiECopy" class="HIE-NavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="HIE-ButtonImage" /></a>
                                <a href="#" id="hiECut" class="HIE-NavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="HIE-ButtonImage" /></a>
                                <a href="#" id="hiEPaste" class="HIE-NavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="HIE-ButtonImage" /></a>
                            </div>
                            <div class="HIE-NumQuestionDiv" id="hiENumQuestionDiv">
                                <div class="HIE-NumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                                <span class="HIE-NumQuestions" id="hiENumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;
        this.ideviceBody.innerHTML = html; //eXe 3.0
        $exeDevicesEdition.iDevice.tabs.init('hiQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        $exeDevice.enableForm();
    },

    initQuestions: function () {
        $('#hiEInputImage').css('display', 'flex');
        $('#hiEMediaNormal, #hiEMediaImage').prop('disabled', false);

        if ($exeDevice.questionsGame.length === 0) {
            const question = $exeDevice.getDefaultQuestion();
            $exeDevice.questionsGame.push(question);
            this.showOptions(4);
            this.showSolution(0);
        }

        this.active = 0;
    },

    getDefaultQuestion: function () {
        const p = {
            numberOptions: 4,
            attempts: 4,
            rows: 4,
            columns: 4,
            time: 30,
            url: '',
            author: '',
            alt: '',
            question: '',
            options: ['', '', '', ''],
            solution: 0,
            audio: '',
            msgHit: '',
            msgError: '',
        };
        return p;
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length === 8 && reg.test(time);
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);

            let json = $('.hiddenimage-DataGame', wrapper).text();
            const version = $('.hiddenimage-version', wrapper).text();

            if (version.length === 1) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }

            const dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink = $('.hiddenimage-LinkImages', wrapper),
                $audiosLink = $('.hiddenimage-LinkAudios', wrapper);

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.questionsGame.length) {
                    dataGame.questionsGame[iq].url = $(this).attr('href');
                    if (dataGame.questionsGame[iq].url.length < 4) {
                        dataGame.questionsGame[iq].url = '';
                    }
                }
            });

            dataGame.questionsGame.forEach(function (question, index) {
                question.audio =
                    typeof question.audio === 'undefined' ? '' : question.audio;
            });

            $audiosLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.questionsGame.length) {
                    dataGame.questionsGame[iq].audio = $(this).attr('href');
                    if (dataGame.questionsGame[iq].audio.length < 4) {
                        dataGame.questionsGame[iq].audio = '';
                    }
                }
            });

            $exeDevice.active = 0;
            const instructions = $('.hiddenimage-instructions', wrapper);
            if (instructions.length === 1) {
                $('#eXeGameInstructions').val(instructions.html());
            }

            const textAfter = $('.hiddenimage-extra-content', wrapper);
            if (textAfter.length === 1) {
                $('#eXeIdeviceTextAfter').val(textAfter.html());
            }

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateFieldGame: function (game) {
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.answersRamdon = game.answersRamdon || false;
        game.percentajeFB =
            typeof game.percentajeFB !== 'undefined' ? game.percentajeFB : 100;
        game.gameMode =
            typeof game.gameMode !== 'undefined' ? game.gameMode : 0;
        game.feedBack =
            typeof game.feedBack !== 'undefined' ? game.feedBack : false;
        game.customMessages =
            typeof game.customMessages === 'undefined'
                ? false
                : game.customMessages;
        game.percentajeQuestions =
            typeof game.percentajeQuestions === 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation !== 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID !== 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#hiEShowMinimize').prop('checked', game.showMinimize);
        $('#hiEQuestionsRamdon').prop('checked', game.optionsRamdon);
        $('#hiEAnswersRamdon').prop('checked', game.answersRamdon);
        $('#hiEShowSolution').prop('checked', game.showSolution);
        $('#hiETimeShowSolution').val(game.timeShowSolution);
        $('#hiETimeShowSolution').prop('disabled', !game.showSolution);
        $('#hiECustomScore').prop('checked', game.customScore);
        $(
            `input.HIE-TypeGame[name='qxtgamemode'][value='${game.gameMode}']`
        ).prop('checked', true);
        $('#hiECustomMessages').prop('checked', game.customMessages);
        $('#hiEPercentajeQuestions').val(game.percentajeQuestions);
        $('#hiEEvaluation').prop('checked', game.evaluation);
        $('#hiEEvaluationID').val(game.evaluationID);
        $('#hiEEvaluationID').prop('disabled', !game.evaluation);
        $('#hiERevealTime').val(game.revealTime);

        $exeDevice.showSelectOrder(game.customMessages);

        game.questionsGame.forEach(function (question) {
            question.audio =
                typeof question.audio === 'undefined' ? '' : question.audio;
            question.msgHit =
                typeof question.msgHit === 'undefined' ? '' : question.msgHit;
            question.msgError =
                typeof question.msgError === 'undefined'
                    ? ''
                    : question.msgError;
        });

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );

        if (game.feedBack || game.gameMode === 2) {
            $('#hiEFeedbackP').show();
        } else {
            $('#hiEFeedbackP').hide();
        }

        $('#hiEPercentajeFB').prop('disabled', !game.feedBack);
        $exeDevice.questionsGame = game.questionsGame;
        $exeDevice.updateQuestionsNumber();
        $exeDevice.showQuestion($exeDevice.active);
    },

    showSelectOrder: function (messages) {
        if (messages) {
            $('.HIE-Orders').slideDown();
        } else {
            $('.HIE-Orders').slideUp();
        }
    },

    getMediaType: function () {
        const ele = document.getElementsByName('qxtype');
        for (let i = 0; i < ele.length; i++) {
            if (ele[i].checked) {
                return ele[i].value;
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
        if (!$exeDevice.validateQuestion()) return false;

        const dataGame = this.validateData();
        if (!dataGame) return false;

        const fields = this.ci18n,
            i18n = Object.assign({}, fields);
        for (const key in fields) {
            const fVal = $('#ci18n_' + key).val();
            if (fVal !== '') {
                i18n[key] = fVal;
            }
        }

        dataGame.msgs = i18n;
        const json = JSON.stringify(dataGame);
        let divContent = '';

        const instructions = tinyMCE.get('eXeGameInstructions').getContent();

        if (instructions !== '') {
            divContent = `<div class="hiddenimage-instructions HIP-instructions">${instructions}</div>`;
        }

        const linksImages = $exeDevice.createlinksImage(dataGame.questionsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.questionsGame);

        let html = '<div class="hiddenimage-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html += `<div class="hiddenimage-version js-hidden">${$exeDevice.version}</div>`;
        html += `<div class="hiddenimage-DataGame js-hidden">${$exeDevices.iDevice.gamification.helpers.encrypt(json)}</div>`;

        html += linksImages;
        html += linksAudios;
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter !== '') {
            html += `<div class="hiddenimage-extra-content">${textAfter}</div>`;
        }
        html += `<div class="hiddenimage-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';
        return html;
    },

    validateAlt: function () {
        const altImage = $('#hiEAlt').val();
        if (!$exeDevice.checkAltImage) {
            return true;
        }
        if (altImage !== '') {
            return true;
        }
        eXe.app.confirm(
            $exeDevice.msgs.msgTitleAltImageWarning,
            $exeDevice.msgs.msgAltImageWarning,
            function () {
                $exeDevice.checkAltImage = false;
                const saveButton = document.getElementsByClassName(
                    'button-save-idevice'
                )[0];
                saveButton.click();
            }
        );
        return false;
    },

    validateQuestion: function () {
        let message = '',
            optionEmpy = false,
            p = {};
        const msgs = $exeDevice.msgs;
        p.numberOptions = parseInt($('input[name=qxtnumber]:checked').val());
        p.author = $('#hiEAuthor').val();
        p.alt = $('#hiEAlt').val();
        p.customScore = parseFloat($('#hiEScoreQuestion').val());
        p.url = $('#hiEURLImage').val().trim();
        p.audio = $('#hiEURLAudio').val();
        $exeDevice.stopSound();
        p.question = $('#hiEQuestion').val().trim();
        p.options = [];
        p.solution = parseInt($('input[name=hisoluiton]:checked').val());
        p.msgHit = $('#hiEMessageOK').val();
        p.msgError = $('#hiEMessageKO').val();
        p.time = parseInt($('#hiETimeQuestion').val());
        p.rows = parseInt($('#hiERows').val());
        p.columns = parseInt($('#hiEColumns').val());
        p.attempts = parseInt($('#hiEAttempts').val());

        $('.HIE-AnwersOptions').each(function (i) {
            const option = $(this).val().trim();
            if (i < p.numberOptions && option.length === 0) {
                optionEmpy = true;
            }
            p.options.push(option);
        });

        if (p.question.length === 0) {
            message = msgs.msgECompleteQuestion;
        } else if (optionEmpy) {
            message = msgs.msgECompleteAllOptions;
        } else if (p.url.length < 5) {
            message = msgs.msgEURLValid;
        }

        if (message.length === 0) {
            $exeDevice.questionsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }

        return message;
    },

    createlinksImage: function (questionsGame) {
        let html = '';
        for (let i = 0; i < questionsGame.length; i++) {
            const question = questionsGame[i];
            let linkImage = '';
            if (!question.url.startsWith('http')) {
                linkImage = `<a href="${question.url}" class="js-hidden hiddenimage-LinkImages">${i}</a>`;
            }
            html += linkImage;
        }
        return html;
    },

    createlinksAudio: function (questionsGame) {
        let html = '';
        for (let i = 0; i < questionsGame.length; i++) {
            const question = questionsGame[i];
            let linkAudio = '';
            if (
                !question.audio.startsWith('http') &&
                question.audio.length > 4
            ) {
                linkAudio = `<a href="${question.audio}" class="js-hidden hiddenimage-LinkAudios">${i}</a>`;
            }
            html += linkAudio;
        }
        return html;
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#hiQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = $('#eXeGameInstructions').text(),
            instructionsExe = escape(
                tinyMCE.get('eXeGameInstructions').getContent()
            ),
            textAfter = escape(tinyMCE.get('eXeIdeviceTextAfter').getContent()),
            showMinimize = $('#hiEShowMinimize').is(':checked'),
            optionsRamdon = $('#hiEQuestionsRamdon').is(':checked'),
            answersRamdon = $('#hiEAnswersRamdon').is(':checked'),
            showSolution = $('#hiEShowSolution').is(':checked'),
            timeShowSolution = parseInt(clear($('#hiETimeShowSolution').val())),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            customScore = $('#hiECustomScore').is(':checked'),
            customMessages = $('#hiECustomMessages').is(':checked'),
            percentajeQuestions = parseInt(
                clear($('#hiEPercentajeQuestions').val())
            ),
            evaluation = $('#hiEEvaluation').is(':checked'),
            evaluationID = $('#hiEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            questionsGame = $exeDevice.questionsGame,
            revealTime = $('#hiERevealTime').val(),
            scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        if (!itinerary) return false;

        if (showSolution && timeShowSolution.toString().length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }
        for (let i = 0; i < questionsGame.length; i++) {
            const mquestion = questionsGame[i];
            mquestion.customScore =
                typeof mquestion.customScore === 'undefined'
                    ? 1
                    : mquestion.customScore;
            if (mquestion.question.length === 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                return false;
            } else if (mquestion.url.length < 10) {
                $exeDevice.showMessage($exeDevice.msgs.msgEURLValid);
                return false;
            }
            let completAnswer = true;
            for (let j = 0; j < mquestion.numberOptions; j++) {
                if (mquestion.options[j].length === 0) {
                    completAnswer = false;
                }
            }
            if (!completAnswer) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteAllOptions);
                return false;
            }
        }
        for (let i = 0; i < questionsGame.length; i++) {
            const qt = questionsGame[i];
            if (qt.url.length < 8) {
                qt.author = '';
                qt.alt = '';
            }
        }
        const data = {
            asignatura: '',
            author: '',
            typeGame: 'HiddenImage',
            instructionsExe: instructionsExe,
            instructions: instructions,
            showMinimize: showMinimize,
            optionsRamdon: optionsRamdon,
            answersRamdon: answersRamdon,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            revealTime: revealTime,
            itinerary: itinerary,
            questionsGame: questionsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            customScore: customScore,
            textAfter: textAfter,
            version: 1,
            customMessages: customMessages,
            percentajeQuestions: percentajeQuestions,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
        return data;
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    addEvents: function () {
        $('#hiEPaste').hide();

        $('#hiEShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#hiECodeAccess, #hiEMessageCodeAccess').prop(
                'disabled',
                !marcado
            );
        });
        $('.HIE-Panel').on('click', 'input.HIE-Number', (e) => {
            const number = parseInt($(e.target).val());
            $exeDevice.showOptions(number);
        });

        $('#hiEAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#hiEFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#hiEPrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#hiENext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#hiELast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#hiEDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#hiECopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#hiECut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#hiEPaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#hiETimeShowSolution')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 1);
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 3 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 9));
                this.value = value;
            });

        $('#hiEScoreQuestion').on('focusout', function () {
            if (!$exeDevice.validateScoreQuestion($(this).val())) {
                $(this).val(1);
            }
        });

        $('#hiEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#hiETimeShowSolution').prop('disabled', !marcado);
        });

        $('#hiEAttempts')
            .on('keyup', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 2);
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 4 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 20));
                this.value = value;
            });

        $('#hiEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#hiEAlt').val();
            $exeDevice.showImage(url, alt);
        });

        $('#hiEPlayImage').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#hiEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#hiEAlt').val(),
                x = parseFloat($('#hiEXImage').val()),
                y = parseFloat($('#hiEYImage').val());
            $exeDevice.showImage(url, alt);
        });

        $('#hiEImage').on('click', (e) => {
            $exeDevice.clickImage(e.currentTarget, e.pageX, e.pageY);
        });
        $('#hiEPlayAudio').on('click', (e) => {
            e.preventDefault();
            const selectedFile = $('#hiEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#hiEURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length === 0) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: mp3, ogg, wav`
                );
            } else if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#hiEGameModeHelpLnk').on('click', function () {
            $('#hiEGameModeHelp').toggle();
            return false;
        });

        $('#hiECustomMessages').on('change', function () {
            const messages = $(this).is(':checked');
            $exeDevice.showSelectOrder(messages);
        });

        $('#hiEPercentajeQuestions')
            .on('keyup click', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 3);
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                value = Math.max(1, Math.min(value, 100));
                this.value = value;
                $exeDevice.updateQuestionsNumber();
            });

        $('#hiENumberQuestion').on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion() !== false) {
                        $exeDevice.active =
                            num < $exeDevice.questionsGame.length
                                ? num - 1
                                : $exeDevice.questionsGame.length - 1;
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#hiEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#hiEEvaluationID').prop('disabled', !marcado);
        });

        $('#hiEEvaluationHelpLnk').on('click', function () {
            $('#hiEEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $('#hiECursor'),
            $x = $('#hiEXImage'),
            $y = $('#hiEYImage'),
            $img = $(img),
            offset = $img.offset(),
            posX = epx - offset.left,
            posY = epy - offset.top,
            wI = Math.max($img.width(), 1),
            hI = Math.max($img.height(), 1),
            position = $img.position(),
            lI = position.left,
            tI = position.top;

        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor.css({
            left: posX + lI,
            top: posY + tI,
            'z-index': 30,
        });
        $cursor.show();
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const $parent = $(image).parent(),
            wDiv = Math.max($parent.width(), 1),
            hDiv = Math.max($parent.height(), 1),
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;

        if (varW > varH) {
            wImage = Math.round(wDiv);
            hImage = Math.round(naturalHeight / varW);
            yImage = Math.round((hDiv - hImage) / 2);
        } else {
            wImage = Math.round(naturalWidth / varH);
            hImage = Math.round(hDiv);
            xImage = Math.round((wDiv - wImage) / 2);
        }

        return {
            w: wImage,
            h: hImage,
            x: xImage,
            y: yImage,
        };
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: `${mData.x}px`,
            top: `${mData.y}px`,
            width: `${mData.w}px`,
            height: `${mData.h}px`,
        });
    },

    validateScoreQuestion: function (text) {
        const isValid =
            text.length > 0 &&
            text !== '.' &&
            text !== ',' &&
            /^-?\d*[.,]?\d*$/.test(text);
        return isValid;
    },
};
