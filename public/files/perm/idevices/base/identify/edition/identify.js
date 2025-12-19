/* eslint-disable no-undef */
/**
 * Identifica Activity iDevice (edition code)
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Graphic design: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('Identify'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'identify',
    active: 0,
    questionsGame: [],
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    version: 1,
    id: false,
    checkAltImage: true,
    ci18n: {},
    init: function (element, previousData, path) {
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;

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
            msgSubmit: c_('Submit'),
            msgCodeAccess: c_('Access code'),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgLoseLive: c_('You lost one life'),
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
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            msgClose: c_('Close'),
            msgClue: c_('Hint'),
            msgShowClue: c_('Show a clue'),
            msgShowNewClue: c_('Show another clue'),
            msgUseFulInformation: c_(
                'and information that will be very useful'
            ),
            msgLoading: c_('Loading. Please wait...'),
            msgPoints: c_('points'),
            msgAudio: c_('Audio'),
            msgReply: c_('Reply'),
            msgAttempts: c_('Attempts'),
            msgScoreQuestion: c_('Points at stake'),
            msgAnswer: c_('Please write the answer'),
            msgYouCanTryAgain: c_('You can try it again'),
            msgGameStarted: c_('The game has already started.'),
            msgGameEnd: c_('Game over.'),
            msgCorrectAnswer: c_('The right answer is:'),
            msgMoveOne: c_('Move on'),
            msgUseClue: c_('You used one clue. You can only get %s points.'),
            msgUseAllClues: c_(
                'You already used all the clues. You can only get %s points.'
            ),
            msgModeWhiteBoard: c_('Digital whiteboard mode'),
            msgCheckLetter: c_('Check the letter'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Identify'),
        };
    },

    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgECompleteAllClues = _('Please complete all the clues');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIndicateSolution = _(
            'Indicate the character, object or solution to discover'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning');
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        ); //eXe 3.0
    },

    playSound: function (selectedFile) {
        const selectFile =
            $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);
        $exeDevice.playerAudio = new Audio(selectFile);
        $exeDevice.playerAudio.addEventListener('canplaythrough', function () {
            $exeDevice.playerAudio.play();
        });
    },

    stopSound() {
        if (
            $exeDevice.playerAudio &&
            typeof $exeDevice.playerAudio.pause == 'function'
        ) {
            $exeDevice.playerAudio.pause();
        }
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.questionsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#idfEPaste').hide();
            $('#idfENumQuestions').text($exeDevice.questionsGame.length);
            $('#idfENumberQuestion').val($exeDevice.questionsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },
    removeQuestion: function () {
        if ($exeDevice.questionsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.questionsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.questionsGame.length - 1) {
                $exeDevice.active = $exeDevice.questionsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#idfEPaste').hide();
            $('#idfENumQuestions').text($exeDevice.questionsGame.length);
            $('#idfENumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.questionsGame[$exeDevice.active])
            );
            $('#idfEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#idfEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.questionsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#idfEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.questionsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#idfENumQuestions').text($exeDevice.questionsGame.length);
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
        let percentaje = parseInt(
            $exeDevice.removeTags($('#idfEPercentajeQuestions').val())
        );
        if (isNaN(percentaje)) return;
        percentaje = percentaje < 1 ? 1 : percentaje;
        percentaje = percentaje > 100 ? 100 : percentaje;
        let num = Math.round(
            (percentaje * $exeDevice.questionsGame.length) / 100
        );
        num = num == 0 ? 1 : num;
        $('#idfENumeroPercentaje').text(
            num + '/' + $exeDevice.questionsGame.length
        );
    },

    showQuestion: function (i) {
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.questionsGame.length
                ? $exeDevice.questionsGame.length - 1
                : num;
        let p = $exeDevice.questionsGame[num],
            numClues = 0;

        $('.IDFE-EAnwersClues').each(function (j) {
            numClues++;
            if (p.clues[j].trim() !== '') {
                p.numClues = numClues;
            }
            $(this).val(p.clues[j]);
        });

        $exeDevice.showClues(p.numberClues);
        $('#idfEQuestion').val(p.question);
        $('#idfENumQuestions').text($exeDevice.questionsGame.length);
        $('#idfEURLImage').val(p.url);
        $('#idfEXImage').val(p.x);
        $('#idfEYImage').val(p.y);
        $('#idfEAuthor').val(p.author);
        $('#idfEAlt').val(p.alt);
        $('#idfESolution').val(p.solution);
        $('#idfECluesNumber').val(p.numberClues);
        $('#idfEAttemptsNumber').val(p.attempts);
        $exeDevice.showImage(p.url, p.x, p.y, p.alt);

        $('.IDFE-EAnwersClues').each(function (j) {
            const clue = j < p.numClues ? p.clues[j] : '';
            $(this).val(clue);
        });

        p.audio = p.audio && p.audio != 'undefined' ? p.audio : '';
        $exeDevice.stopSound();
        if (p.type != 2 && p.audio.trim().length > 4) {
            $exeDevice.playSound(p.audio.trim());
        }
        $('#idfEURLAudio').val(p.audio);
        $('#idfENumberQuestion').val(i + 1);
        $('#idfEMessageKO').val(p.msgError);
        $('#idfEMessageOK').val(p.msgHit);
    },

    showImage: function (url, x, y, alt) {
        const $image = $('#idfEImage'),
            $cursor = $('#idfECursor');
        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);
        $('#idfENoImage').show();

        url = $exeDevices.iDevice.gamification.media.extractURLGD(url);

        $image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    return false;
                } else {
                    const mData = $exeDevice.placeImageWindows(
                        this,
                        this.naturalWidth,
                        this.naturalHeight
                    );
                    $exeDevice.drawImage(this, mData);
                    $image.show();
                    $('#idfENoImage').hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
    },

    paintMouse: function (image, cursor, x, y) {
        $(cursor).hide();
        if (x > 0 || y > 0) {
            const wI = $(image).width() > 0 ? $(image).width() : 1,
                hI = $(image).height() > 0 ? $(image).height() : 1,
                lI = $(image).position().left + wI * x,
                tI = $(image).position().top + hI * y;
            $(cursor).css({
                left: lI + 'px',
                top: tI + 'px',
                'z-index': 10,
            });
            $(cursor).show();
        }
    },

    clearQuestion: function () {
        $exeDevice.showClues(4);
        $('#idfEURLImage').val('');
        $('#idfEXImage').val('0');
        $('#idfEYImage').val('0');
        $('#idfEAttemptsNumber').val('4');
        $('#idfECluesNumber').val('4');
        $('#idfEAuthor').val('');
        $('#idfEAlt').val('');
        $('#idfEURLAudio').val('');
        $('#idfEQuestion').val('');
        $('#idfESolution').val('');
        $('.IDFE-EAnwersClues').each(function () {
            $(this).val('');
        });
        $('#idfEMessageOK').val('');
        $('#idfEMessageKO').val('');
    },

    showClues: function (number) {
        $('.IDFE-EPistaDiv').each(function (i) {
            $(this).show();
            if (i >= number) {
                $(this).hide();
            }
        });

        $('.IDFE-EAnwersClues').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="identifyQEIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create activities in which the players, with some clues, will have to guess a character, an object or the solution to a problem.')}
                    <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/identifica.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Use the clues to guess the hidden answer for each question.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="idfEShowMinimize" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="idfEShowMinimize">${_('Show minimized.')}</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="true">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="idfESAvancedMode" class="toggle-input" checked />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="idfESAvancedMode">${_('Advanced mode')}.</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="idfEQuestionRamdon" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="idfEQuestionRamdon">${_('Random questions')}</label>
                                </span>
                            </div>
                            <div class="mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="idfECustomMessages" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="idfECustomMessages">${_('Custom messages')}.</label>
                                </span>
                            </div>
                            <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap flex-wrap">
                                <span class="toggle-item" role="switch" aria-checked="true">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="idfEShowSolution" class="toggle-input" checked />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="idfEShowSolution">${_('Show solutions')}.</label>
                                </span>
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="idfETimeShowSolution" class="mb-0">${_('Show solution time (seconds)')}</label>
                                    <input type="number" name="idfETimeShowSolution" class="form-control" id="idfETimeShowSolution" value="3" min="1" max="9" style="width:6ch" />
                                </div>
                            </div>
                            <div class="mb-3 d-flex align-items-center gap-2 flex-nowrap flex-wrap">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="idfEHasFeedBack" class="toggle-input" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="idfEHasFeedBack">${_('Feedback')}.</label>
                                </span>
                                <div class="d-flex align-items-center gap-2 flex-nowrap">
                                    <label for="idfEPercentajeFB" class="mb-0">%FB</label>
                                    <input type="number" name="idfEPercentajeFB" id="idfEPercentajeFB" class="form-control" value="100" min="5" max="100" step="5" disabled />
                                    <span class="ms-2">${_('&percnt; right to see the feedback')}</span>
                                </div>
                            </div>
                            <div id="idfEFeedbackP" class="IDFE-EFeedbackP mb-3">
                                <textarea id="idfEFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="idfEPercentajeQuestions" class="mb-0">%${_('Questions')}:</label>
                                <input type="number" name="idfEPercentajeQuestions" id="idfEPercentajeQuestions" value="100" min="1" max="100" class="form-control" />
                                <span id="idfENumeroPercentaje">1/1</span>
                            </div>
                            <div class="Games-Reportdiv d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span class="toggle-item" role="switch" aria-checked="false">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="idfEEvaluation" class="toggle-input" data-target="#idfEEvaluationIDWrapper" />
                                        <span class="toggle-visual" aria-hidden="true"></span>
                                    </span>
                                    <label class="toggle-label" for="idfEEvaluation">${_('Progress report')}.</label>
                                </span>
                                <span id="idfEEvaluationIDWrapper" class="d-flex align-items-center gap-2 flex-nowrap" style="display:none;">
                                    <label for="idfEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" id="idfEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" class="form-control" />
                                </span>
                                <strong class="GameModeLabel">
                                    <a href="#idfEEvaluationHelp" id="idfEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </strong>
                            </div>
                            <p id="idfEEvaluationHelp" class="IDFE-TypeGameHelp exe-block-info">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="IDFE-EPanel" id="idfEPanel">
                            <div class="IDFE-EPistasMedia">
                                <div class="IDFE-EPistasGame">
                                    <span>${_('Message')}</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                        <label class="sr-av">${_('Message')}:</label>
                                        <input type="text" class="form-control w-100" id="idfEQuestion">
                                    </div>
                                    <span>${_('Solution')}</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                        <label class="sr-av">${_('Solution')}:</label>
                                        <input type="text" class="form-control w-100" id="idfESolution">
                                    </div>
                                    <span id="idfETitleImage">${_('Image URL')}</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="idfEInputImage">
                                        <label class="sr-av" for="idfEURLImage">${_('Image URL')}</label>
                                        <input type="text" class="exe-file-picker w-100 form-control me-0" id="idfEURLImage"/>
                                        <a href="#" id="idfEPlayImage" class="IDFE-ENavigationButton IDFE-EPlayVideo" title="${_('Show')}"><img src="${path}quextIEPlay.png" alt="${_('Show')}" class="IDFE-EButtonImage " /></a>
                                        <a href="#" id="idfEShowMore" class="IDFE-ENavigationButton IDFE-EShowMore" title="${_('More')}"><img src="${path}quextEIMore.png" alt="${_('More')}" class="IDFE-EButtonImage " /></a>
                                    </div>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="idfInputCluesImage">
                                        <div class="IDFE-ECoord">
                                            <label for="idfEXImage">X:</label>
                                            <input id="idfEXImage" type="text" value="0" />
                                            <label for="idfEYImage">Y:</label>
                                            <input id="idfEYImage" type="text" value="0" />
                                        </div>
                                    </div>
                                    <div class="d-none align-items-center gap-2 flex-nowrap mb-3" id="idfEAuthorAlt">
                                        <div class="IDFE-EInputAuthor wp-50">
                                            <label for="idfEAuthor">${_('Authorship')}</label>
                                            <input id="idfEAuthor" type="text" class="IDFE-EAuthor form-control w-100" />
                                        </div>
                                        <div class="IDFE-EInputAlt wp-50">
                                            <label for="idfEAlt">${_('Alt')}</label>
                                            <input id="idfEAlt" type="text" class="IDFE-EAlt form-control w-100" />
                                        </div>
                                    </div>
                                    <span>${_('Audio')}</span>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="idfEInputAudio">
                                        <label class="sr-av" for="idfEURLAudio">${_('URL')}</label>
                                        <input type="text" class="exe-file-picker w-100 form-control me-0" id="idfEURLAudio"/>
                                        <a href="#" id="idfEPlayAudio" class="IDFE-ENavigationButton IDFE-EPlayVideo" title="${_('Play audio')}"><img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="IDFE-EButtonImage " /></a>
                                    </div>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                        <label for="idfEAttemptsNumber">${_('Number of attempts')}:</label>
                                        <input type="number" name="idfEAttemptsNumber" id="idfEAttemptsNumber" class="form-control" value="3" min="1" max="8" step="1" />
                                    </div>
                                </div>
                                <div class="IDFE-EMultiMediaClue">
                                    <div class="IDFE-EMultimedia" id="idfEMultimedia">
                                        <img class="IDFE-EMedia" src="${path}quextIEImage.png" id="idfEImage" alt="${_('Image')}" />
                                        <img class="IDFE-EMedia" src="${path}quextIEImage.png" id="idfENoImage" alt="${_('No image')}" />
                                        <img class="IDFE-ECursor" src="${path}quextIECursor.gif" id="idfECursor" alt="" />
                                    </div>
                                </div>
                            </div>
                            <div class="IDFE-EContents">
                                <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                    <label for="idfECluesNumber">${_('Number of clues')}:</label>
                                    <input type="number" name="idfECluesNumber" class="form-control" id="idfECluesNumber" value="4" min="2" max="8" step="1" />
                                </div>
                                <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>1:</label>
                                        <input type="text" class="IDFE-EPista0 IDFE-EAnwersClues form-control" id="idfEPista0">
                                    </div>
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>2:</label>
                                        <input type="text" class="IDFE-EPista1 IDFE-EAnwersClues form-control" id="idfEPista1">
                                    </div>
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>3:</label>
                                        <input type="text" class="IDFE-EPista2 IDFE-EAnwersClues form-control" id="idfEPista2">
                                    </div>
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>4:</label>
                                        <input type="text" class="IDFE-EPista3 IDFE-EAnwersClues form-control" id="idfEPista3">
                                    </div>
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>5:</label>
                                        <input type="text" class="IDFE-EPista4 IDFE-EAnwersClues form-control" id="idfEPista4">
                                    </div>
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>6:</label>
                                        <input type="text" class="IDFE-EPista5 IDFE-EAnwersClues form-control" id="idfEPista5">
                                    </div>
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>7:</label>
                                        <input type="text" class="IDFE-EPista6 IDFE-EAnwersClues form-control" id="idfEPista6">
                                    </div>
                                    <div class="IDFE-EPistaDiv gap-2 mb-3">
                                        <label>8:</label>
                                        <input type="text" class="IDFE-EPista7 IDFE-EAnwersClues form-control" id="idfEPista7">
                                    </div>
                                </div>
                            </div>
                            <div class="IDFE-EOrders" id="idfEOrder">
                                <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                    <span class="sr-av">${_('Hit')}</span>
                                    <span class="IDFE-EHit"></span>
                                    <label for="idfEMessageOK">${_('Message')}:</label>
                                    <input type="text" class="" id="idfEMessageOK">
                                </div>
                                <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                    <span class="sr-av">${_('Error')}</span>
                                    <span class="IDFE-EError"></span>
                                    <label for="idfEMessageKO">${_('Message')}:</label>
                                    <input type="text" class="" id="idfEMessageKO">
                                </div>
                            </div>
                            <div class="IDFE-ENavigationButtons gap-1">
                                <a href="#" id="idfEAdd" class="IDFE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="IDFE-EButtonImage" /></a>
                                <a href="#" id="idfEFirst" class="IDFE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="IDFE-EButtonImage" /></a>
                                <a href="#" id="idfEPrevious" class="IDFE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="IDFE-EButtonImage" /></a>
                                <label class="sr-av" for="idfENumberQuestion">${_('Question number:')}</label>
                                <input type="text" class="IDFE-NumberQuestion" id="idfENumberQuestion" value="1"/>
                                <a href="#" id="idfENext" class="IDFE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="IDFE-EButtonImage" /></a>
                                <a href="#" id="idfELast" class="IDFE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="IDFE-EButtonImage" /></a>
                                <a href="#" id="idfEDelete" class="IDFE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="IDFE-EButtonImage" /></a>
                                <a href="#" id="idfECopy" class="IDFE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="IDFE-EButtonImage" /></a>
                                <a href="#" id="idfECut" class="IDFE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="IDFE-EButtonImage" /></a>
                                <a href="#" id="idfEPaste" class="IDFE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="IDFE-EButtonImage" /></a>
                            </div>
                            <div class="IDFE-ENumQuestionDiv" id="idfENumQuestionDiv">
                                <div class="IDFE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                                <span class="IDFE-ENumQuestions" id="idfENumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>                
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 4)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(4)}
            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('identifyQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        $exeDevice.enableForm();
    },

    initQuestions: function () {
        $('#idfEInputImage').css('display', 'flex');
        $('#idfMediaNormal').prop('disabled', false);
        $('#idfMediaImage').prop('disabled', false);
        $('#idfMediaText').prop('disabled', false);

        if ($exeDevice.questionsGame.length == 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.questionsGame.push(question);
            this.showClues(4);
        }
        this.active = 0;
    },

    getCuestionDefault: function () {
        return {
            numberClues: 4,
            url: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
            question: '',
            solution: '',
            clues: Array(8).fill(''),
            audio: '',
            msgHit: '',
            msgError: '',
            attempts: 4,
        };
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;
            let wrapper = $('<div></div>');

            wrapper.html(originalHTML);

            let json = $('.identifica-DataGame', wrapper).text(),
                version = $('.identifica-version', wrapper).text();
            if (version.length == 1) {
                json = $exeDevices.iDevice.gamification.helpers.decrypt(json);
            }
            let dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json),
                $imagesLink = $('.identifica-LinkImages', wrapper),
                $audiosLink = $('.identifica-LinkAudios', wrapper);

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.questionsGame.length) {
                    dataGame.questionsGame[iq].url = $(this).attr('href');
                    if (
                        dataGame.questionsGame[iq].url.length < 4 &&
                        dataGame.questionsGame[iq].type == 1
                    ) {
                        dataGame.questionsGame[iq].url = '';
                    }
                }
            });

            for (let i = 0; i < dataGame.questionsGame.length; i++) {
                dataGame.questionsGame[i].audio =
                    typeof dataGame.questionsGame[i].audio == 'undefined'
                        ? ''
                        : dataGame.questionsGame[i].audio;
            }

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

            const instructions = $('.identifica-instructions', wrapper);
            if (instructions.length == 1)
                $('#eXeGameInstructions').val(instructions.html());
            const textAfter = $('.identifica-extra-content', wrapper);
            if (textAfter.length == 1)
                $('#eXeIdeviceTextAfter').val(textAfter.html());

            const textFeedBack = $('.identifica-feedback-game', wrapper);
            if (textFeedBack.length == 1)
                $('#idfEFeedBackEditor').val(textFeedBack.html());

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.updateFieldGame(dataGame);
        }
    },

    updateGameMode: function (feedback) {
        $('#idfEPercentajeFB').prop('disabled', !feedback);
        $('#idfEHasFeedBack').prop('checked', feedback);

        if (feedback) {
            $('#idfEFeedbackP').slideDown();
        } else {
            $('#idfEFeedbackP').slideUp();
        }
    },

    updateFieldGame: function (game) {
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.questonsRamdo = game.questonsRamdo || false;
        game.percentajeFB =
            typeof game.percentajeFB != 'undefined' ? game.percentajeFB : 100;
        game.feedBack =
            typeof game.feedBack != 'undefined' ? game.feedBack : false;
        game.customMessages =
            typeof game.customMessages == 'undefined'
                ? false
                : game.customMessages;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#idfEShowMinimize').prop('checked', game.showMinimize);
        $('#idfESAvancedMode').prop('checked', game.avancedMode);
        $('#idfEQuestionRamdon').prop('checked', game.questionsRamdon);
        $('#idfEShowSolution').prop('checked', game.showSolution);
        $('#idfETimeShowSolution').val(game.timeShowSolution);
        $('#idfETimeShowSolution').prop('disabled', !game.showSolution);
        $('#idfEHasFeedBack').prop('checked', game.feedBack);
        $('#idfEPercentajeFB').val(game.percentajeFB);
        $('#idfECustomMessages').prop('checked', game.customMessages);
        $('#idfEPercentajeQuestions').val(game.percentajeQuestions);
        $('#idfEEvaluation').prop('checked', game.evaluation);
        $('#idfEEvaluationID').val(game.evaluationID);
        $('#idfEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevice.updateGameMode(game.feedBack);
        $exeDevice.showSelectOrder(game.customMessages);

        for (let i = 0; i < game.questionsGame.length; i++) {
            game.questionsGame[i].audio =
                typeof game.questionsGame[i].audio == 'undefined'
                    ? ''
                    : game.questionsGame[i].audio;
            game.questionsGame[i].msgHit =
                typeof game.questionsGame[i].msgHit == 'undefined'
                    ? ''
                    : game.questionsGame[i].msgHit;
            game.questionsGame[i].msgError =
                typeof game.questionsGame[i].msgError == 'undefined'
                    ? ''
                    : game.questionsGame[i].msgError;
        }

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );

        if (game.feedBack) {
            $('#idfEFeedbackP').show();
        } else {
            $('#idfEFeedbackP').hide();
        }
        $('#idfEPercentajeFB').prop('disabled', !game.feedBack);

        $exeDevice.questionsGame = game.questionsGame;
        $exeDevice.updateQuestionsNumber();
        $exeDevice.showQuestion($exeDevice.active);
    },

    showSelectOrder: function (messages) {
        if (messages) {
            $('.IDFE-EOrders').slideDown();
        } else {
            $('.IDFE-EOrders').slideUp();
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

        let fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            let fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }
        dataGame.msgs = i18n;

        let json = JSON.stringify(dataGame),
            divContent = '',
            instructions = tinyMCE.get('eXeGameInstructions').getContent();
        if (instructions != '')
            divContent =
                '<div class="identifica-instructions">' +
                instructions +
                '</div>';

        const textFeedBack = tinyMCE.get('idfEFeedBackEditor').getContent(),
            linksImages = $exeDevice.createlinksImage(dataGame.questionsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.questionsGame);

        let html = '<div class="identifica-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${$exeDevice.getIdeviceID()}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html +=
            '<div class="identifica-version js-hidden">' +
            $exeDevice.version +
            '</div>';
        html +=
            '<div class="identifica-feedback-game">' + textFeedBack + '</div>';
        html +=
            '<div class="identifica-DataGame js-hidden" >' +
            $exeDevices.iDevice.gamification.helpers.encrypt(json) +
            '</div>';
        html += linksImages;
        html += linksAudios;
        const textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            html +=
                '<div class="identifica-extra-content">' + textAfter + '</div>';
        }

        html +=
            '<div class="identifica-bns js-hidden">' +
            $exeDevice.msgs.msgNoSuportBrowser +
            '</div>';
        html += '</div>';
        return html;
    },

    validateAlt: function () {
        let altImage = $('#idfEAlt').val();
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
                let saveButton = document.getElementsByClassName(
                    'button-save-idevice'
                )[0];
                saveButton.click();
            }
        );
        return false;
    },

    validateQuestion: function () {
        let message = '',
            msgs = $exeDevice.msgs,
            p = {};

        p.numberClues = parseInt($('#idfECluesNumber').val());
        p.x = parseFloat($('#idfEXImage').val());
        p.y = parseFloat($('#idfEYImage').val());
        p.author = $('#idfEAuthor').val();
        p.alt = $('#idfEAlt').val();
        p.url = $('#idfEURLImage').val().trim();
        p.audio = $('#idfEURLAudio').val();
        p.question = $('#idfEQuestion').val().trim();
        p.solution = $('#idfESolution').val().trim();
        p.clues = [];
        p.msgHit = $('#idfEMessageOK').val();
        p.msgError = $('#idfEMessageKO').val();
        p.attempts = parseInt($('#idfEAttemptsNumber').val());
        $exeDevice.stopSound();

        let clueEmpy = false;
        $('.IDFE-EAnwersClues').each(function (i) {
            const clue = $(this).val().trim();
            if (i < p.numberClues && clue.length == 0) {
                clueEmpy = true;
            }
            p.clues.push(clue);
        });

        if (p.solution.length == 0) {
            message = msgs.msgIndicateSolution;
        } else if (clueEmpy) {
            message = msgs.msgECompleteAllClues;
        }
        if (message.length == 0) {
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
            let linkImage = '';
            if (questionsGame[i].url.indexOf('http') != 0) {
                linkImage =
                    '<a href="' +
                    questionsGame[i].url +
                    '" class="js-hidden identifica-LinkImages">' +
                    i +
                    '</a>';
            }
            html += linkImage;
        }
        return html;
    },

    createlinksAudio: function (questionsGame) {
        let html = '';
        for (let i = 0; i < questionsGame.length; i++) {
            let linkaudio = '';
            if (
                questionsGame[i].audio.indexOf('http') != 0 &&
                questionsGame[i].audio.length > 4
            ) {
                linkaudio =
                    '<a href="' +
                    questionsGame[i].audio +
                    '" class="js-hidden identifica-LinkAudios">' +
                    i +
                    '</a>';
            }
            html += linkaudio;
        }
        return html;
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.questionsGame.length > 1) {
            const word = $('#idfESolution').val().trim();
            if (word.length == 0) {
                $exeDevice.removeQuestion();
            }
        }
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertQuestions(lines);
    },

    insertQuestions: function (lines) {
        const lineFormat = /^([^#]+)(#([^#]+)){3,9}$/;
        let valids = 0;
        lines.forEach((line) => {
            if (lineFormat.test(line)) {
                const p = $exeDevice.getCuestionDefault(),
                    linarray = line.trim().split('#');
                p.solution = linarray[0];
                p.question = linarray[1];

                p.numberClues = linarray.length - 2;
                for (let i = 0; i < p.clues.length; i++)
                    if (i < p.numberClues) p.clues[i] = linarray[i + 2];
                valids++;
                $exeDevice.questionsGame.push(p);
            }
        });
        $exeDevice.addWords(valids);
    },

    addWords: function (valids) {
        if (valids === 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.questionsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('identify')}.txt`;

        document.getElementById('identifyQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('identifyQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (questions) {
        let lineswords = [];
        for (let i = 0; i < questions.length; i++) {
            let q = questions[i];
            let question = `${q.question}`;
            for (let j = 0; j < q.clues.length; j++) {
                if (q.clues[j]) {
                    question += `#${q.clues[j]}`;
                }
            }
            lineswords.push(question);
        }
        return lineswords;
    },

    importGame: function (content, filetype) {
        const game =
            $exeDevices.iDevice.gamification.helpers.isJsonString(content);
        if (content && content.includes('\u0000')) {
            eXe.app.alert(_('Sorry, wrong file format'));
            return;
        } else if (!game && content) {
            if (filetype.match('text/plain')) {
                $exeDevice.importText(content);
            } else {
                eXe.app.alert(_('Sorry, wrong file format'));
            }
            return;
        } else if (!game || typeof game.typeGame == 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame === 'Identifica') {
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.active = 0;
            $exeDevice.questionsGame = game.questionsGame;
            $exeDevice.questionsGame.forEach((question) => {
                let numOpt = 0;
                question.clues.forEach((clue) => {
                    if (!clue.trim().length) {
                        question.numberClues = numOpt;
                        return;
                    }
                    numOpt++;
                });
            });
            $exeDevice.updateFieldGame(game);
            const instructions = game.instructionsExe || game.instructions,
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '';
            if (tinyMCE.get('eXeGameInstructions'))
                tinyMCE
                    .get('eXeGameInstructions')
                    .setContent(unescape(instructions));
            else $('#eXeGameInstructions').val(unescape(instructions));
            if (tinyMCE.get('idfEFeedBackEditor'))
                tinyMCE
                    .get('idfEFeedBackEditor')
                    .setContent(unescape(textFeedBack));
            else $('#idfEFeedBackEditor').val(unescape(textFeedBack));
            if (tinyMCE.get('eXeIdeviceTextAfter'))
                tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
            else $('#eXeIdeviceTextAfter').val(unescape(tAfter));
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }

        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    importIdentifica: function (game) {
        const questionsGame = $exeDevice.questionsGame;
        game.questionsGame.forEach((p) => {
            p.time = typeof p.time === 'undefined' ? 1 : p.time;
            p.audio = typeof p.audio === 'undefined' ? '' : p.audio;
            p.hit = typeof p.hit === 'undefined' ? -1 : p.hit;
            p.error = typeof p.error === 'undefined' ? -1 : p.error;
            p.msgHit = typeof p.msgHit === 'undefined' ? '' : p.msgHit;
            p.msgError = typeof p.msgError === 'undefined' ? '' : p.msgError;
            questionsGame.push(p);
        });
        return questionsGame;
    },

    removeTags: function (str) {
        let wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#identifyQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const instructions = $('#eXeGameInstructions').text(),
            instructionsExe = escape(
                tinyMCE.get('eXeGameInstructions').getContent()
            ),
            textAfter = escape(tinyMCE.get('eXeIdeviceTextAfter').getContent()),
            textFeedBack = escape(
                tinyMCE.get('idfEFeedBackEditor').getContent()
            ),
            showMinimize = $('#idfEShowMinimize').is(':checked'),
            avancedMode = $('#idfESAvancedMode').is(':checked'),
            questionsRamdon = $('#idfEQuestionRamdon').is(':checked'),
            showSolution = $('#idfEShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                $exeDevice.removeTags($('#idfETimeShowSolution').val())
            ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#idfEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(
                $exeDevice.removeTags($('#idfEPercentajeFB').val())
            ),
            customMessages = $('#idfECustomMessages').is(':checked'),
            percentajeQuestions = parseInt(
                $exeDevice.removeTags($('#idfEPercentajeQuestions').val())
            ),
            evaluation = $('#idfEEvaluation').is(':checked'),
            evaluationID = $('#idfEEvaluationID').val(),
            id = $exeDevice.getIdeviceID();

        if (!itinerary) return false;

        if (feedBack && textFeedBack.trim().length === 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }
        if (showSolution && timeShowSolution.length === 0) {
            $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
            return false;
        }
        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        const questionsGame = $exeDevice.questionsGame;
        for (let i = 0; i < questionsGame.length; i++) {
            const mquestion = questionsGame[i];
            if (mquestion.solution.length === 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgIndicateSolution);
                return false;
            }
            let completAnswer = true;
            for (let j = 0; j < mquestion.numberClues; j++) {
                if (mquestion.clues[j].length === 0) completAnswer = false;
            }
            if (!completAnswer) {
                $exeDevice.showMessage($exeDevice.msgs.msgECompleteAllClues);
                return false;
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            asignatura: '',
            author: '',
            typeGame: 'Identifica',
            instructionsExe: instructionsExe,
            instructions: instructions,
            showMinimize: showMinimize,
            questionsRamdon: questionsRamdon,
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            itinerary: itinerary,
            questionsGame: questionsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted,
            title: '',
            textAfter: textAfter,
            textFeedBack: textFeedBack,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: $exeDevice.version,
            customMessages: customMessages,
            percentajeQuestions: percentajeQuestions,
            avancedMode: avancedMode,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
        };
    },

    addEvents: function () {
        const initToggle = function ($input) {
            const checked = $input.is(':checked');
            $input
                .closest('.toggle-item[role="switch"]')
                .attr('aria-checked', checked);
            const targetSel = $input.data('target');
            if (targetSel) {
                const $target = $(targetSel);
                if (checked) {
                    $target.css('display', 'flex');
                } else {
                    $target.hide();
                }
            }
        };
        $('.toggle-input').each(function () {
            initToggle($(this));
        });
        $(document).on('change', '.toggle-input', function () {
            initToggle($(this));
        });
        $('#idfEPaste, #idfEAuthorAlt').hide();
        $('#idfEAuthorAlt').removeClass('d-flex').addClass('d-none');
        $('#idfEShowMore').on('click', (e) => {
            const $target = $('#idfEAuthorAlt');
            const show = $target.hasClass('d-none');
            $target.toggleClass('d-none', !show).toggleClass('d-flex', show);
        });

        $('#idfShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#idfCodeAccess, #idfMessageCodeAccess').prop(
                'disabled',
                !marcado
            );
        });

        $('#idfEAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#idfEFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#idfEPrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#idfENext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#idfELast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#idfEDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#idfECopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#idfECut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#idfEPaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#identifyQEIdeviceForm').on('dblclick', '#idfEImage', function () {
            $('#idfECursor').hide();
            $('#idfEXImage, #idfEYImage').val(0);
        });

        $('#idfEAttemptsNumber').on('keyup focusout', function () {
            this.value = this.value.replace(/\D/g, '').substring(0, 1) || 3;
            this.value = Math.min(9, Math.max(1, this.value));
        });

        $('#idfECluesNumber').on('keyup focusout change', function () {
            this.value = this.value.replace(/\D/g, '').substring(0, 1) || 4;
            if (this.value > 1 && this.value < 9)
                $exeDevice.showClues(parseInt(this.value));
        });

        $('#idfETimeShowSolution').on('keyup focusout', function () {
            this.value = this.value.replace(/\D/g, '').substring(0, 1) || 3;
            this.value = Math.min(9, Math.max(1, this.value));
        });

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
            $('#eXeGameImportGame')
                .attr('accept', '.txt')
                .on('change', function (e) {
                    const file = e.target.files[0];
                    if (!file) {
                        eXe.app.alert(_('Please select a text file (.txt)'));
                        return;
                    }
                    if (
                        !file.type ||
                        !(
                            file.type.match('text/plain') ||
                            file.type.match('application/json')
                        )
                    ) {
                        eXe.app.alert(_('Please select a text file (.txt)'));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) =>
                        $exeDevice.importGame(e.target.result, file.type);
                    reader.readAsText(file);
                });
            $('#eXeGameExportQuestions').on('click', () => {
                $exeDevice.exportQuestions();
            });
        } else $('#eXeGameExportImport').hide();

        $('#idfEShowSolution').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#idfETimeShowSolution').prop('disabled', !marcado);
        });

        $('#idfEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'web`'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#idfEAlt').val(),
                x = parseFloat($('#idfEXImage').val()),
                y = parseFloat($('#idfEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#idfEPlayImage').on('click', (e) => {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp`'],
                selectedFile = $('#idfEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();
            if (selectedFile.startsWith('files') && !validExt.includes(ext)) {
                $exeDevice.showMessage(
                    `${_('Supported formats')}: jpg, jpeg, gif, png, svg, webp`
                );
                return false;
            }
            const url = selectedFile,
                alt = $('#idfEAlt').val(),
                x = parseFloat($('#idfEXImage').val()),
                y = parseFloat($('#idfEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#idfEImage').on('click', function (e) {
            $exeDevice.clickImage(this, e.pageX, e.pageY);
        });

        $('#idfECursor').on('click', () => {
            $('#idfECursor').hide();
            $('#idfEXImage, #idfEYImage').val(0);
        });

        $('#idfEPlayAudio').on('click', (e) => {
            e.preventDefault();
            const selectedFile = $('#idfEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
            }
        });

        $('#idfEURLAudio').on('change', function () {
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

        $('#idfEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#idfEFeedbackP').slideToggle();
            $('#idfEPercentajeFB').prop('disabled', !marcado);
        });

        $('#idfECustomMessages').on('change', function () {
            $exeDevice.showSelectOrder($(this).is(':checked'));
        });

        $('#idfEPercentajeQuestions').on('keyup focusout', function () {
            this.value = this.value.replace(/\D/g, '').substring(0, 3) || 100;
            this.value = Math.min(100, Math.max(1, this.value));
            $exeDevice.updateQuestionsNumber();
        });

        $('#idfENumberQuestion').on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion() !== false) {
                        $exeDevice.active = Math.min(
                            num - 1,
                            $exeDevice.questionsGame.length - 1
                        );
                        $exeDevice.showQuestion($exeDevice.active);
                    } else $(this).val($exeDevice.active + 1);
                } else $(this).val($exeDevice.active + 1);
            }
        });

        $('#idfEEvaluation').on('change', function () {
            $('#idfEEvaluationID').prop('disabled', !$(this).is(':checked'));
        });

        $('#idfEEvaluationHelpLnk').click(() => {
            $('#idfEEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            4,
            $exeDevice.insertQuestions
        );

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $('#idfECursor'),
            $x = $('#idfEXImage'),
            $y = $('#idfEYImage'),
            $img = $(img),
            posX = epx - $img.offset().left,
            posY = epy - $img.offset().top,
            wI = $img.width() || 1,
            hI = $img.height() || 1,
            lI = $img.position().left,
            tI = $img.position().top;

        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor.css({
            left: posX + lI,
            top: posY + tI,
            'z-index': 10,
        });
        $cursor.show();
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const $parent = $(image).parent(),
            wDiv = $parent.width() || 1,
            hDiv = $parent.height() || 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;

        let wImage = wDiv,
            hImage = hDiv,
            xImage = 0,
            yImage = 0;

        if (varW > varH) {
            wImage = parseInt(wDiv, 10);
            hImage = parseInt(naturalHeight / varW, 10);
            yImage = parseInt((hDiv - hImage) / 2, 10);
        } else {
            wImage = parseInt(naturalWidth / varH, 10);
            hImage = parseInt(hDiv, 10);
            xImage = parseInt((wDiv - wImage) / 2, 10);
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
        return (
            text.length > 0 &&
            text !== '.' &&
            text !== ',' &&
            /^-?\d*[.,]?\d*$/.test(text)
        );
    },
};
