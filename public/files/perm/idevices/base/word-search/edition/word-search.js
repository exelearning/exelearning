/* eslint-disable no-undef */
/**
/**
 * Sopa Activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Dineño: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Games'),
        name: _('Word search'),
    },
    msgs: {},
    classIdevice: 'word-search',
    active: 0,
    wordsGame: [],
    timeQuestion: 30,
    percentajeShow: 35,
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    version: 2,
    idevicePath: '',
    checkAltImage: true,
    playerAudio: '',
    id: false,
    ci18n: {},

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
    refreshTranslations: function () {
        this.ci18n = {
            msgReply: c_('Reply'),
            msgEnterCode: c_('Enter the access code'),
            msgErrorCode: c_('The access code is not correct'),
            msgClue: c_('Cool! The clue is:'),
            msgCodeAccess: c_('Access code'),
            msgPlayStart: c_('Click here to play'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgWeight: c_('Weight'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time Limit (mm:ss)'),
            msgFullScreen: c_('Full Screen'),
            msgExitFullScreen: c_('Exit Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No picture question'),
            msgSuccesses: c_(
                'Right! | Excellent! | Great! | Very good! | Perfect!'
            ),
            msgFailures: c_(
                'It was not that! | Incorrect! | Not correct! | Sorry! | Error!'
            ),
            msgTryAgain: c_(
                'You need at least %s&percnt; of correct answers to get the information. Please try again.'
            ),
            msgScoreScorm: c_(
                "The score can't be saved because this page is not part of a SCORM package."
            ),
            msgOnlySaveScore: c_('You can only save the score once!'),
            msgOnlySave: c_('You can only save once'),
            msgInformation: c_('Information'),
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
            msgPoints: c_('points'),
            msgAudio: c_('Audio'),
            msgWordsFind: c_('You found all the words. Your score is %s.'),
            msgEndGameScore: c_('Please start playing first...'),
            mgsGameStart: c_('The game has already started.'),
            msgYouScore: c_('Score'),
            msgEndTime: c_('Game time is over. Your score is %s.'),
            msgEnd: c_('Finish'),
            msgEndGameM: c_('You finished the game. Your score is %s.'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgManyWord: c_('Try with fewer words'),
            msgTypeGame: c_('Word search'),
        };
    },
    setMessagesInfo: function () {
        const msgs = this.msgs;
        msgs.msgEProvideDefinition = _(
            'Please provide the definition of the word or phrase'
        );
        msgs.msgESelectFile = _(
            'The selected file does not contain a valid game'
        );
        msgs.msgEURLValid = _(
            'You must upload or indicate the valid URL of an image'
        );
        msgs.msgEProvideWord = _('Please provide one word or phrase');
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgECompleteQuestion = _('You have to complete the question');
        msgs.msgECompleteAllOptions = _(
            'You have to complete all the selected options'
        );
        msgs.msgESelectSolution = _('Choose the right answer');
        msgs.msgWriteText = _('You have to type a text in the editor');
        msgs.msgTypeChoose = _(
            'Please check all the answers in the right order'
        );
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNoSuportBrowser = _(
            'Your browser is not compatible with this tool.'
        );
        msgs.msgIDLenght = _(
            'The report identifier must have at least 5 characters'
        );
        msgs.msgMaximeSize = _(
            'The word cannot contain more than fourteen characters or white spaces'
        );
        msgs.msgTitleAltImageWarning = _('Accessibility warning'); // eXe 3.0
        msgs.msgAltImageWarning = _(
            'At least one image has no description, are you sure you want to continue without including it? Without it the image may not be accessible to some users with disabilities, or to those using a text browser, or browsing the Web with images turned off.'
        ); //eXe 3.0
    },

    importText: function (content) {
        const lines = content.split('\n');
        $exeDevice.insertWords(lines);
    },

    insertWords: function (lines) {
        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
        let words = [];
        lines.forEach((line) => {
            if (lineFormat.test(line)) {
                const p = $exeDevice.getCuestionDefault();
                const parts = line.split('#');
                p.word = parts[0];
                p.definition = parts[1];
                if (
                    p.word &&
                    p.definition &&
                    p.word.length <= 14 &&
                    !p.word.includes(' ')
                ) {
                    words.push(p);
                }
            }
        });
        $exeDevice.addWords(words);
    },

    importMoodle: function (xmlString) {
        const xmlDoc = $.parseXML(xmlString),
            $xml = $(xmlDoc);
        if ($xml.find('GLOSSARY').length > 0) {
            $exeDevice.importGlosary(xmlString);
        } else if ($xml.find('quiz').length > 0) {
            $exeDevice.importCuestionaryXML(xmlString);
        } else {
            $exeDevice.showMessage(_('Sorry, wrong file format'));
        }
    },

    importGlosary: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) return false;

        const $entries = $xml.find('ENTRIES').first();
        if ($entries.length === 0) return false;

        const words = [];
        $entries.find('ENTRY').each(function () {
            const concept = $(this).find('CONCEPT').text(),
                definition = $(this)
                    .find('DEFINITION')
                    .text()
                    .replace(/<[^>]*>/g, '');
            if (
                concept &&
                definition &&
                concept.length <= 14 &&
                !concept.includes(' ')
            ) {
                let wd = {
                    word: concept,
                    definition: definition,
                };
                words.push(wd);
            }
        });
        $exeDevice.addWords(words);
    },

    importCuestionaryXML: function (xmlText) {
        const parser = new DOMParser(),
            xmlDoc = parser.parseFromString(xmlText, 'text/xml'),
            $xml = $(xmlDoc);

        if ($xml.find('parsererror').length > 0) {
            return false;
        }

        const $quiz = $xml.find('quiz').first();
        if ($quiz.length === 0) {
            return false;
        }

        const words = [];
        $quiz.find('question').each(function () {
            const $question = $(this),
                type = $question.attr('type');
            if (type !== 'shortanswer') {
                return true;
            }
            const questionText = $question
                    .find('questiontext')
                    .first()
                    .text()
                    .trim(),
                $answers = $question.find('answer');
            let word = '',
                maxFraction = -1;

            $answers.each(function () {
                const $answer = $(this),
                    answerText = $answer.find('text').eq(0).text(),
                    currentFraction = parseInt($answer.attr('fraction'), 10);
                if (currentFraction > maxFraction) {
                    maxFraction = currentFraction;
                    word = answerText;
                }
            });
            if (word && questionText) {
                const cleanWord = $exeDevice.removeTags(word);
                if (cleanWord.length <= 14 && !cleanWord.includes(' ')) {
                    let wd = {
                        word: cleanWord,
                        definition: $exeDevice.removeTags(questionText),
                    };
                    words.push(wd);
                }
            }
        });
        $exeDevice.addWords(words);
    },

    addWords: function (words) {
        if (!words || words.length == 0) {
            eXe.app.alert(
                _('Sorry, there are no questions for this type of activity.')
            );
            return;
        }
        const wordsGame = $exeDevice.wordsGame;
        for (let i = 0; i < words.length; i++) {
            let p = $exeDevice.getCuestionDefault();
            let word = words[i];
            if (word.word && word.definition) {
                p.word = word.word;
                p.definition = word.definition;
                wordsGame.push(p);
            }
        }
        $exeDevice.wordsGame = wordsGame;
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    importAdivina: function (data) {
        for (let i = 0; i < data.wordsGame.length; i++) {
            let p = $exeDevice.getCuestionDefault(),
                cuestion = data.wordsGame[i];
            p.word = cuestion.word;
            p.definition = cuestion.definition;
            p.url = cuestion.url;
            p.audio =
                typeof cuestion.audio == 'undefined' ? '' : cuestion.audio;
            p.x = cuestion.x;
            p.y = cuestion.y;
            p.author = cuestion.author;
            p.alt = cuestion.alt;
            p.solution = '';
            $exeDevice.wordsGame.push(p);
        }
        return $exeDevice.wordsGame;
    },

    importRosco: function (data) {
        for (let i = 0; i < data.wordsGame.length; i++) {
            let p = $exeDevice.getCuestionDefault(),
                cuestion = data.wordsGame[i];
            p.word = cuestion.word;
            p.definition = cuestion.definition;
            p.url = cuestion.url;
            p.audio =
                typeof cuestion.audio == 'undefined' ? '' : cuestion.audio;
            p.x = cuestion.x;
            p.y = cuestion.y;
            p.author = cuestion.author;
            p.alt = cuestion.alt;
            p.solution = '';
            if (
                p.word &&
                p.word.length > 0 &&
                p.definition &&
                p.definition.length > 0
            ) {
                $exeDevice.wordsGame.push(p);
            }
        }
        return $exeDevice.wordsGame;
    },

    createForm: function () {
        const showSolveBtn = _('Show "Solve" button.');
        const path = $exeDevice.idevicePath,
            html = `
        <div id="sopaQEIdeviceForm">
            <p class="exe-block-info exe-block-dismissible" style="position:relative">
                ${_('Create word search games with additional text, images or sound.')}
                <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/sopa_de_letras.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
            </p>
            <div class="exe-form-tab" title="${_('General settings')}">
                ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Find the hidden words.'))}
                <fieldset class="exe-fieldset exe-fieldset-closed">
                    <legend><a href="#">${_('Options')}</a></legend>
                    <div>
                        <div class="toggle-item mb-3">
                            <span class="toggle-control">
                                <input type="checkbox" id="sopaEShowMinimize" class="toggle-input" />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label mb-0" for="sopaEShowMinimize">${_('Show minimized.')}</label>
                        </div>
                        <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                            <label for="sopaETime" class="mb-0">${_('Time (minutes)')}:</label>
                            <input type="number" class="form-control" name="sopaETime" id="sopaETime" value="0" min="0" max="59" />
                        </div>
                        <div class="toggle-item mb-3">
                            <span class="toggle-control">
                                <input type="checkbox" id="sopaEShowResolve" class="toggle-input" checked />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label mb-0" for="sopaEShowResolve">${showSolveBtn}</label>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
                            <span class="mb-0">${_('Accept')}:</span>
                            <div class="toggle-item mb-0">
                                <span class="toggle-control">
                                    <input type="checkbox" id="sopaEDiagonals" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="sopaEDiagonals">${_('Diagonal')}.</label>
                            </div>
                            <div class="toggle-item mb-0">
                                <span class="toggle-control">
                                    <input type="checkbox" id="sopaEReverses" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="sopaEReverses">${_('Inverse')}.</label>
                            </div>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                            <div class="toggle-item mb-0">
                                <span class="toggle-control">
                                    <input type="checkbox" id="sopaEHasFeedBack" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="sopaEHasFeedBack">${_('Feedback')}.</label>
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2">
                                <label for="sopaEPercentajeFB" class="mb-0"></label>
                                <input type="number" class="form-control" name="sopaEPercentajeFB" id="sopaEPercentajeFB" value="100" min="5" max="100" step="5" disabled />
                                <span class="mb-0">${_('&percnt; right to see the feedback')}</span>
                            </div>
                        </div>
                        <div id="sopaEFeedbackP" class="SPE-EFeedbackP mb-3">
                            <textarea id="sopaEFeedBackEditor" class="exe-html-editor"></textarea>
                        </div>
                        <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                            <label for="sopaEPercentajeQuestions" class="mb-0">%${_('Words')}:</label>
                            <input type="number" class="form-control" name="sopaEPercentajeQuestions" id="sopaEPercentajeQuestions" value="100" min="1" max="100" />
                            <span id="sopaENumeroPercentaje">1/1</span>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                            <div class="toggle-item mb-0">
                                <span class="toggle-control">
                                    <input type="checkbox" id="sopaEEvaluation" class="toggle-input" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label mb-0" for="sopaEEvaluation">${_('Progress report')}.</label>
                            </div>
                            <div class="d-flex flex-nowrap align-items-center gap-2">
                                <label for="sopaEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                <input type="text" class="form-control" id="sopaEEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" />
                            </div>
                            <a href="#sopaEEvaluationHelp" id="sopaEEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                            </a>
                        </div>
                        <p id="sopaEEvaluationHelp" class="SPE-TypeGameHelp exe-block-info">
                            ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                        </p>
                    </div>
                </fieldset>
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Words/Phrases')}</a></legend>
                    <div class="SPE-EPanel" id="sopaEPanel">
                        <div class="SPE-EOptionsMedia">
                            <div class="SPE-EOptionsGame">
                                <span class="SPE-sopaETitleAudio">${_('Word')}</span>
                                <div class="SPE-EInputImage d-flex flex-nowrap align-items-center gap-2 mb-3">
                                    <label class="sr-av" for="sopaESolutionWord">${_('Word/Phrase')}:</label>
                                    <input type="text" id="sopaESolutionWord" maxlength="14" class="form-control w-100"/>
                                </div>
                                <span class="SPE-sopaETitleAudio">${_('Definition')}</span>
                                <div class="SPE-EInputImage d-flex flex-nowrap align-items-center gap-2 mb-3">
                                    <label class="sr-av" for="sopaEDefinitionWord">${_('Definition')}:</label>
                                    <input type="text" id="sopaEDefinitionWord" class="form-control w-100"/>
                                </div>
                                <span class="SPE-ETitleImage" id="sopaETitleImage">${_('Image URL')}</span>
                                <div class="SPE-EInputImage d-flex flex-nowrap align-items-center gap-2 mb-3" id="sopaEInputImage">
                                    <label class="sr-av" for="sopaEURLImage">${_('Image URL')}</label>
                                    <input type="text" class="exe-file-picker SPE-EURLImage form-control me-0 w-100" id="sopaEURLImage" />
                                    <a href="#" id="sopaEPlayImage" class="SPE-ENavigationButton SPE-EPlayVideo" title="${_('Show')}">
                                        <img src="${path}quextIEPlay.png" alt="${_('Show')}" class="SPE-EButtonImage" />
                                    </a>
                                    <a href="#" id="sopaEShowMore" class="SPE-ENavigationButton SPE-EShowMore" title="${_('More')}">
                                        <img src="${path}quextEIMore.png" alt="${_('More')}" class="SPE-EButtonImage" />
                                    </a>
                                </div>
                                  <div class="d-none">
                                    <label for="sopaEXImage" class="mb-0">X:</label>
                                    <input id="sopaEXImage" type="text" value="0" class="form-control" />
                                    <label for="sopaEYImage" class="mb-0">Y:</label>
                                    <input id="sopaEYImage" type="text" value="0" class="form-control" />
                                </div>
                                <div class="d-none flex-nowrap align-items-center gap-2 mb-3" id="sopaEAuthorAlt">
                                    <div class="d-flex w-50 flex-nowrap align-items-center gap-2">
                                        <label for="sopaEAuthor">${_('Authorship')}</label>
                                        <input id="sopaEAuthor" type="text" class="me-0 w-100 form-control" />
                                    </div>
                                    <div class="d-flex flex-nowrap align-items-center gap-2">
                                        <label for="sopaEAlt">${_('Alt')}</label>
                                        <input id="sopaEAlt" type="text" class="me-0 w-100 form-control" />
                                    </div>
                                </div>
                                <span id="sopaETitleAudio">${_('Audio')}</span>
                                <div class="d-flex flex-nowrap align-items-center gap-2 mb-3" id="sopaEInputAudio">
                                    <label class="sr-av" for="sopaEURLAudio">${_('URL')}</label>
                                    <input type="text" class="exe-file-picker SPE-EURLAudio form-control me-0 w-100" id="sopaEURLAudio" />
                                    <a href="#" id="sopaEPlayAudio" class="SPE-ENavigationButton SPE-EPlayVideo" title="${_('Play audio')}">
                                        <img src="${path}quextIEPlay.png" alt="${_('Play audio')}" class="SPE-EButtonImage" />
                                    </a>
                                </div>
                            </div>
                            <div class="SPE-EMultiMediaOption">
                                <div class="SPE-EMultimedia" id="sopaEMultimedia">
                                    <img class="SPE-EMedia" src="${path}quextIEImage.png" id="sopaEImage" alt="${_('Image')}" />
                                    <img class="SPE-EMedia" src="${path}quextIEImage.png" id="sopaENoImage" alt="${_('No image')}" />
                                    <img class="SPE-ECursor" src="${path}quextIECursor.gif" id="sopaECursor" alt="" />
                                </div>
                            </div>
                        </div>
                        <div class="SPE-EContents">
                            <div class="SPE-ENavigationButtons d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3">
                                <a href="#" id="sopaEAdd" class="SPE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="SPE-EButtonImage b-add" /></a>
                                <a href="#" id="sopaEFirst" class="SPE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="SPE-EButtonImage b-first" /></a>
                                <a href="#" id="sopaEPrevious" class="SPE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="SPE-EButtonImage b-prev" /></a>
                                <label class="sr-av" for="sopaENumberQuestion">${_('Question number:')}</label>
                                <input type="text" class="SPE-NumberQuestion form-control" id="sopaENumberQuestion" value="1" />
                                <a href="#" id="sopaENext" class="SPE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="SPE-EButtonImage b-next" /></a>
                                <a href="#" id="sopaELast" class="SPE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="SPE-EButtonImage b-last" /></a>
                                <a href="#" id="sopaEDelete" class="SPE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="SPE-EButtonImage b-delete" /></a>
                                <a href="#" id="sopaECopy" class="SPE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="SPE-EButtonImage b-copy" /></a>
                                <a href="#" id="sopaECut" class="SPE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="SPE-EButtonImage b-cut" /></a>
                                <a href="#" id="sopaEPaste" class="SPE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="SPE-EButtonImage b-paste" /></a>
                            </div>
                        </div>
                        <div class="SPE-ENumQuestionDiv d-flex flex-nowrap align-items-center gap-2" id="sopaENumQuestionDiv">
                            <div class="SPE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                            <span class="SPE-ENumQuestions" id="sopaENumQuestions">0</span>
                        </div>
                    </div>
                </fieldset>

                ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
            </div>

            ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
            ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 0, true)}
            ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(9)}
        </div>
        `;
        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('sopaQEIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    enableForm: function () {
        $exeDevice.initQuestions();

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags($('#sopaEPercentajeQuestions').val())
        );
        if (isNaN(percentaje)) return;
        percentaje = Math.min(Math.max(percentaje, 1), 100);
        let num = Math.round((percentaje * $exeDevice.wordsGame.length) / 100);
        num = num == 0 ? 1 : num;
        $('#sopaENumeroPercentaje').text(
            num + '/' + $exeDevice.wordsGame.length
        );
    },

    showQuestion: function (i) {
        let num = i < 0 ? 0 : i;
        num =
            num >= $exeDevice.wordsGame.length
                ? $exeDevice.wordsGame.length - 1
                : num;
        const p = $exeDevice.wordsGame[num];

        $exeDevice.changeTypeQuestion();
        $('#sopaEDefinitionWord').val(p.definition);
        $('#sopaENumQuestions').text($exeDevice.wordsGame.length);
        $('#sopaESolutionWord').val(p.word);
        $('#sopaEURLImage').val(p.url);
        $('#sopaEXImage').val(p.x);
        $('#sopaEYImage').val(p.y);
        $('#sopaEAuthor').val(p.author);
        $('#sopaEAlt').val(p.alt);

        $exeDevice.showImage(p.url, p.x, p.y, p.alt);
        $exeDevice.stopSound();

        if (p.audio.trim().length > 4) {
            $exeDevice.playSound(p.audio.trim());
        }
        $('#sopaEURLAudio').val(p.audio);
        $('#sopaENumberQuestion').val(i + 1);
    },

    initQuestions: function () {
        $('#sopaEInputImage').removeClass('d-none').addClass('d-flex');
        $('#sopaEMediaNormal').prop('disabled', false);
        $('#sopaEMediaImage').prop('disabled', false);
        if ($exeDevice.wordsGame.length == 0) {
            const question = $exeDevice.getCuestionDefault();
            $exeDevice.wordsGame.push(question);
            this.changeTypeQuestion();
        }
        this.active = 0;
    },

    changeTypeQuestion: function () {
        $('#sopaEAuthorAlt').removeClass('d-flex').addClass('d-none');
        $exeDevice.showImage(
            $('#sopaEURLImage').val(),
            $('#sopaEXImage').val(),
            $('#sopaEYImage').val(),
            $('#sopaEAlt').val()
        );
    },

    getCuestionDefault: function () {
        return {
            word: '',
            definition: '',
            url: '',
            audio: '',
            x: 0,
            y: 0,
            author: '',
            alt: '',
            solution: '',
        };
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;
        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>').html(originalHTML),
                json = $('.sopa-DataGame', wrapper).text(),
                versionText = $('.sopa-version', wrapper).text();
            let dataJson = json;

            if (versionText.length === 1)
                dataJson =
                    $exeDevices.iDevice.gamification.helpers.decrypt(json);

            const dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(
                        dataJson
                    ),
                $imagesLink = $('.sopa-LinkImages', wrapper),
                $audiosLink = $('.sopa-LinkAudios', wrapper);

            $imagesLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                    dataGame.wordsGame[iq].url = $(this).attr('href');
                    if (dataGame.wordsGame[iq].url.length < 4) {
                        dataGame.wordsGame[iq].url = '';
                    }
                }
            });

            $audiosLink.each(function () {
                const iq = parseInt($(this).text());
                if (!isNaN(iq) && iq < dataGame.wordsGame.length) {
                    dataGame.wordsGame[iq].audio = $(this).attr('href');
                    if (dataGame.wordsGame[iq].audio.length < 4) {
                        dataGame.wordsGame[iq].audio = '';
                    }
                }
            });

            $exeDevice.updateFieldGame(dataGame);
            let instructions = $('.sopa-instructions', wrapper);
            if (instructions.length === 1) {
                instructions = instructions.html() || '';
                $('#eXeGameInstructions').val(instructions);
            }

            let textFeedBack = $('.sopa-feedback-game', wrapper);
            if (textFeedBack.length === 1) {
                textFeedBack = textFeedBack.html() || '';
                $('#sopaEFeedBackEditor').val(textFeedBack);
            }

            let textAfter = $('.sopa-extra-content', wrapper);
            if (textAfter.length === 1) {
                textAfter = textAfter.html() || '';
                $('#eXeIdeviceTextAfter').val(textAfter);
            }

            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
            $exeDevice.showQuestion(0);
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
            divInstructions = '';

        json = $exeDevices.iDevice.gamification.helpers.encrypt(json);

        const textFeedBack = tinyMCE.get('sopaEFeedBackEditor').getContent();

        if (dataGame.instructions != '')
            divInstructions =
                '<div class="sopa-instructions">' +
                dataGame.instructions +
                '</div>';

        let textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent();
        if (textAfter != '') {
            textAfter =
                '<div class="sopa-extra-content">' + textAfter + '</div>';
        }

        const linksImages = $exeDevice.createlinksImage(dataGame.wordsGame),
            linksAudios = $exeDevice.createlinksAudio(dataGame.wordsGame);

        let html = `<div class="sopa-IDevice">
        <div class="game-evaluation-ids js-hidden" data-id="${dataGame.id}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>
                <div class="sopa-version js-hidden">${$exeDevice.version}</div>
                 ${divInstructions}
                <div class="sopa-feedback-game">${textFeedBack}</div>              
                <div class="sopa-DataGame js-hidden">${json}</div>
                ${linksImages}
                ${linksAudios}
                ${textAfter}
                <div class="sopa-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>
                </div> `;
        return html;
    },

    validateAlt: function () {
        let altImage = $('#sopaEAlt').val();
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

    getMediaType: function () {
        let ele = document.getElementsByName('sopatype');
        for (i = 0; i < ele.length; i++) {
            if (ele[i].checked) return ele[i].value;
        }
    },

    createlinksImage: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            if (
                wordsGame[i].url.length > 4 &&
                !wordsGame[i].url.startsWith('http')
            ) {
                html += `<a href="${wordsGame[i].url}" class="js-hidden sopa-LinkImages">${i}</a>`;
            }
        }
        return html;
    },

    createlinksAudio: function (wordsGame) {
        let html = '';
        for (let i = 0; i < wordsGame.length; i++) {
            if (
                wordsGame[i].audio.length > 4 &&
                !wordsGame[i].audio.startsWith('http')
            ) {
                html += `<a href="${wordsGame[i].audio}" class="js-hidden sopa-LinkAudios">${i}</a>`;
            }
        }
        return html;
    },

    validateQuestion: function () {
        let message = '',
            p = {
                word: $('#sopaESolutionWord').val().trim(),
                definition: $('#sopaEDefinitionWord').val(),
                x: parseFloat($('#sopaEXImage').val()),
                y: parseFloat($('#sopaEYImage').val()),
                author: $('#sopaEAuthor').val(),
                alt: $('#sopaEAlt').val(),
                url: $('#sopaEURLImage').val().trim(),
                audio: $('#sopaEURLAudio').val(),
                percentageShow: 100,
            };

        $exeDevice.stopSound();

        if (p.word.length == 0) {
            message = $exeDevice.msgs.msgEProvideWord;
        } else if (p.word.length > 14 || p.word.includes(' ')) {
            message = $exeDevice.msgs.msgMaximeSize;
        } else if (p.definition.length == 0) {
            message = $exeDevice.msgs.msgEProvideDefinition;
        }
        if (message.length == 0) {
            $exeDevice.wordsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }
        return message;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    getIdeviceID: function () {
        const ideviceid =
            $('#sopaQEIdeviceForm')
                .closest(`div.idevice_node.${$exeDevice.classIdevice}`)
                .attr('id') || '';

        return ideviceid;
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            instructions = tinyMCE.get('eXeGameInstructions').getContent(),
            textFeedBack = tinyMCE.get('sopaEFeedBackEditor').getContent(),
            textAfter = tinyMCE.get('eXeIdeviceTextAfter').getContent(),
            showMinimize = $('#sopaEShowMinimize').is(':checked'),
            showResolve = $('#sopaEShowResolve').is(':checked'),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#sopaEHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#sopaEPercentajeFB').val())),
            percentajeQuestions = parseInt(
                clear($('#sopaEPercentajeQuestions').val())
            ),
            time = parseInt(clear($('#sopaETime').val())),
            diagonals = $('#sopaEDiagonals').is(':checked'),
            reverses = $('#sopaEReverses').is(':checked'),
            evaluation = $('#sopaEEvaluation').is(':checked'),
            evaluationID = $('#sopaEEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            wordsGame = $exeDevice.wordsGame,
            scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        if (!itinerary) return false;

        if (feedBack && textFeedBack.trim().length == 0) {
            eXe.app.alert($exeDevice.msgs.msgProvideFB);
            return false;
        }

        if (wordsGame.length == 0) {
            eXe.app.alert($exeDevice.msgs.msgEOneQuestion);
            return false;
        }

        if (evaluation && evaluationID.length < 5) {
            eXe.app.alert($exeDevice.msgs.msgIDLenght);
            return false;
        }

        for (let i = 0; i < wordsGame.length; i++) {
            const mquestion = wordsGame[i];
            if (mquestion.word.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgEProvideWord);
                return false;
            } else if (
                mquestion.definition.length == 0 &&
                mquestion.url.length < 4
            ) {
                $exeDevice.showMessage(
                    `${$exeDevice.msgs.msgEProvideDefinition} ${mquestion.word}`
                );
                return false;
            }
        }

        return {
            typeGame: 'Sopa',
            instructions,
            showMinimize,
            itinerary,
            wordsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            textFeedBack: escape(textFeedBack),
            textAfter: escape(textAfter),
            feedBack: feedBack,
            percentajeFB,
            version: 1,
            percentajeQuestions,
            time,
            diagonals,
            reverses,
            showResolve,
            evaluation,
            evaluationID,
            id,
        };
    },
    showImage: function (url, x, y, alt) {
        const $image = $('#sopaEImage'),
            $cursor = $('#sopaECursor');
        $image.hide();
        $cursor.hide();
        $image.attr('alt', alt);

        $('#sopaENoImage').show();
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
                    $('#sopaENoImage').hide();
                    $exeDevice.paintMouse(this, $cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                return false;
            });
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
                'z-index': 31,
            });
            $(cursor).show();
        }
    },

    drawImage: function (image, mData) {
        $(image).css({
            left: mData.x + 'px',
            top: mData.y + 'px',
            width: mData.w + 'px',
            height: mData.h + 'px',
        });
    },

    addEvents: function () {
        $('#sopaEPaste').hide();

        $('#sopaEAdd').on('click', function (e) {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#sopaEFirst').on('click', function (e) {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#sopaEPrevious').on('click', function (e) {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#sopaENext').on('click', function (e) {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#sopaELast').on('click', function (e) {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#sopaEDelete').on('click', function (e) {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#sopaECopy').on('click', function (e) {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#sopaECut').on('click', function (e) {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#sopaEPaste').on('click', function (e) {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#sopaEPlayAudio').on('click', function (e) {
            e.preventDefault();
            const selectedFile = $('#sopaEURLAudio').val().trim();
            if (selectedFile.length > 4) {
                $exeDevice.stopSound();
                $exeDevice.playSound(selectedFile);
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
            $('#eXeGameImportGame').attr('accept', '.txt, .xml');
            $('#eXeGameImportGame').on('change', (e) => {
                const file = e.target.files[0];
                if (!file) {
                    eXe.app.alert(
                        _(
                            'Please select a text file (.txt) or a Moodle XML file (.xml)'
                        )
                    );
                    return;
                }
                if (
                    !file.type ||
                    !(
                        file.type.match('text/plain') ||
                        file.type.match('application/xml') ||
                        file.type.match('text/xml')
                    )
                ) {
                    eXe.app.alert(
                        _(
                            'Please select a text file (.txt), or an XML(Moodle) file (.xml) '
                        )
                    );
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
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

        $('#sopaEURLImage').on('change', function () {
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $(this).val(),
                ext = selectedFile.split('.').pop().toLowerCase();

            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }

            const url = selectedFile,
                alt = $('#sopaEAlt').val(),
                x = parseFloat($('#sopaEXImage').val()),
                y = parseFloat($('#sopaEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#sopaEPlayImage').on('click', function (e) {
            e.preventDefault();
            const validExt = ['jpg', 'png', 'gif', 'jpeg', 'svg', 'webp'],
                selectedFile = $('#sopaEURLImage').val(),
                ext = selectedFile.split('.').pop().toLowerCase();

            if (
                selectedFile.indexOf('files') == 0 &&
                validExt.indexOf(ext) == -1
            ) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': jpg, jpeg, gif, png, svg, webp'
                );
                return false;
            }

            const url = selectedFile,
                alt = $('#sopaEAlt').val(),
                x = parseFloat($('#sopaEXImage').val()),
                y = parseFloat($('#sopaEYImage').val());
            $exeDevice.showImage(url, x, y, alt);
        });

        $('#sopaEImage').on('click', function (e) {
            e.preventDefault();
            $exeDevice.clickImage(this, e.pageX, e.pageY);
        });

        $('#sopaECursor').on('click', function (e) {
            e.preventDefault();
            $(this).hide();
            $('#sopaEXImage').val(0);
            $('#sopaEYImage').val(0);
        });

        $('#sopaEURLAudio').on('change', function () {
            const selectedFile = $(this).val().trim();
            if (selectedFile.length == 0) {
                $exeDevice.showMessage(
                    _('Supported formats') + ': mp3, ogg, wav'
                );
            } else {
                if (selectedFile.length > 4) {
                    $exeDevice.stopSound();
                    $exeDevice.playSound(selectedFile);
                }
            }
        });

        $('#sopaEHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            if (marcado) {
                $('#sopaEFeedbackP').show();
            } else {
                $('#sopaEFeedbackP').hide();
            }
            $('#sopaEPercentajeFB').prop('disabled', !marcado);
        });

        $('#sopaEPercentajeQuestions').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 3);
            this.value = v;
            if (this.value > 0 && this.value < 101) {
                $exeDevice.updateQuestionsNumber();
            }
        });

        $('#sopaEPercentajeQuestions').on('click', function () {
            $exeDevice.updateQuestionsNumber();
        });
        $('#sopaEPercentajeQuestions').on('focusout', function () {
            this.value = this.value.trim() == '' ? 100 : this.value;
            this.value = this.value > 100 ? 100 : this.value;
            this.value = this.value < 1 ? 1 : this.value;
            $exeDevice.updateQuestionsNumber();
        });

        $('#sopaENumberQuestion').keyup(function (e) {
            if (e.keyCode == 13) {
                let num = parseInt($(this).val());
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.active =
                            num < $exeDevice.wordsGame.length
                                ? num - 1
                                : $exeDevice.wordsGame.length - 1;
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#sopaEShowMore').on('click', function (e) {
            e.preventDefault();
            const $target = $('#sopaEAuthorAlt');
            const show = $target.hasClass('d-none');
            $target.toggleClass('d-none', !show).toggleClass('d-flex', show);
        });
        $('#sopaETime').on('keyup', function () {
            let v = this.value;
            v = v.replace(/\D/g, '');
            v = v.substring(0, 1);
            this.value = v;
        });
        $('#sopaETime').on('focusout', function () {
            this.value = this.value.trim() == '' ? 0 : this.value;
            this.value = this.value > 59 ? 59 : this.value;
            this.value = this.value < 0 ? 0 : this.value;
        });

        $('#sopaEEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#sopaEEvaluationID').prop('disabled', !marcado);
        });
        $('#sopaEEvaluationHelpLnk').click(function () {
            $('#sopaEEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(
            0,
            $exeDevice.insertWords
        );

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').click(function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    clearQuestion: function () {
        $('#sopaEURLImage').val('');
        $('#sopaEXImage').val('0');
        $('#sopaEYImage').val('0');
        $('#sopaEAuthor').val('');
        $('#sopaEAlt').val('');
        $('#sopaEDefinitionWord').val('');
        $('#sopaESolutionWord').val('');
        $('#sopaEURLAudio').val('');
        $exeDevice.changeTypeQuestion();
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.wordsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.wordsGame.length - 1;
            $('#sopaENumberQuestion').val($exeDevice.wordsGame.length);
            $exeDevice.typeEdit = -1;
            $('#sopaEPaste').hide();
            $('#sopaENumQuestions').text($exeDevice.wordsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.wordsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
        } else {
            $exeDevice.wordsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.wordsGame.length - 1) {
                $exeDevice.active = $exeDevice.wordsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#sopaEPaste').hide();
            $('#sopaENumQuestions').text($exeDevice.wordsGame.length);
            $('#sopaENumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateQuestionsNumber();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.wordsGame[$exeDevice.active])
            );
            $('#sopaEPaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#sopaEPaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.wordsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#sopaEPaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.wordsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#sopaENumQuestions').text($exeDevice.wordsGame.length);
            $exeDevice.updateQuestionsNumber();
        }
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.wordsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.wordsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.wordsGame.length - 1;
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

    updateFieldGame: function (game) {
        $exeDevice.active = 0;
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );

        game.percentajeFB =
            typeof game.percentajeFB != 'undefined' ? game.percentajeFB : 100;
        game.feedBack =
            typeof game.feedBack != 'undefined' ? game.feedBack : false;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.percentageShow = $exeDevice.percentageShow;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted !== 'undefined' ? game.weighted : 100;
        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#sopaEShowMinimize').prop('checked', game.showMinimize);
        $('#sopaEShowResolve').prop('checked', game.showResolve);
        $('#sopaEHasFeedBack').prop('checked', game.feedBack);
        $('#sopaEDiagonals').prop('checked', game.diagonals);
        $('#sopaEReverses').prop('checked', game.reverses);
        $('#sopaETime').val(game.time);
        $('#sopaEPercentajeFB').val(game.percentajeFB);
        $('#sopaEPercentajeQuestions').val(game.percentajeQuestions);
        $('#sopaEEvaluation').prop('checked', game.evaluation);
        $('#sopaEEvaluationID').val(game.evaluationID);
        $('#sopaEEvaluationID').prop('disabled', !game.evaluation);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );

        $exeDevice.wordsGame = game.wordsGame;

        if (game.feedBack) {
            $('#sopaEFeedbackP').show();
        } else {
            $('#sopaEFeedbackP').hide();
        }

        $('#sopaEPercentajeFB').prop('disabled', !game.feedBack);
        $exeDevice.updateQuestionsNumber();
    },

    exportQuestions: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const lines = this.getLinesQuestions(dataGame.wordsGame);
        const fileContent = lines.join('\n');
        const newBlob = new Blob([fileContent], { type: 'text/plain' });
        if (window.navigator && window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(newBlob);
            return;
        }
        const data = window.URL.createObjectURL(newBlob);
        const link = document.createElement('a');
        link.href = data;
        link.download = `${_('words')}-sopa.txt`;

        document.getElementById('sopaQEIdeviceForm').appendChild(link);
        link.click();
        setTimeout(() => {
            document.getElementById('sopaQEIdeviceForm').removeChild(link);
            window.URL.revokeObjectURL(data);
        }, 100);
    },

    getLinesQuestions: function (words) {
        let lineswords = [];
        for (let i = 0; i < words.length; i++) {
            let word = `${words[i].word}#${words[i].definition}`;
            lineswords.push(word);
        }
        return lineswords;
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
        } else if (!game || typeof game.typeGame == 'undefined') {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        } else if (game.typeGame == 'Sopa') {
            $exeDevice.active = 0;
            game.id = $exeDevice.getIdeviceID();
            $exeDevice.updateFieldGame(game);
            let instructions = game.instructionsExe || game.instructions,
                tAfter = game.textAfter || '',
                textFeedBack = game.textFeedBack || '';
            if (tinyMCE.get('eXeGameInstructions')) {
                tinyMCE
                    .get('eXeGameInstructions')
                    .setContent(unescape(instructions));
            } else {
                $('#eXeGameInstructions').val(unescape(instructions));
            }
            if (tinyMCE.get('sopaEFeedBackEditor')) {
                tinyMCE
                    .get('sopaEFeedBackEditor')
                    .setContent(unescape(textFeedBack));
            } else {
                $('#sopaEFeedBackEditor').val(unescape(textFeedBack));
            }
            if (tinyMCE.get('eXeIdeviceTextAfter')) {
                tinyMCE.get('eXeIdeviceTextAfter').setContent(unescape(tAfter));
            } else {
                $('#eXeIdeviceTextAfter').val(unescape(tAfter));
            }
        } else if (game.typeGame == 'Adivina') {
            $exeDevice.importAdivina(game);
        } else if (game.typeGame == 'Rosco') {
            $exeDevice.importRosco(game);
        } else {
            $exeDevice.showMessage($exeDevice.msgs.msgESelectFile);
            return;
        }
        $exeDevice.active = 0;
        $exeDevice.showQuestion($exeDevice.active);
        $exeDevice.deleteEmptyQuestion();
        $exeDevice.updateQuestionsNumber();
        //$('.exe-form-tabs li:first-child a').click();
    },

    deleteEmptyQuestion: function () {
        if ($exeDevice.wordsGame.length > 1) {
            const word = $('#sopaESolutionWord').val().trim();
            if (word.trim().length == 0) {
                $exeDevice.removeQuestion();
            }
        }
    },

    validTime: function (time) {
        const reg = /^(?:(?:([01]?\d|2[0-3]):)?([0-5]?\d):)?([0-5]?\d)$/;
        return time.length == 8 && reg.test(time);
    },

    placeImageWindows: function (image, naturalWidth, naturalHeight) {
        const wDiv =
                $(image).parent().width() > 0 ? $(image).parent().width() : 1,
            hDiv =
                $(image).parent().height() > 0 ? $(image).parent().height() : 1,
            varW = naturalWidth / wDiv,
            varH = naturalHeight / hDiv;
        let wImage = wDiv,
            hImage = hDiv,
            xImagen = 0,
            yImagen = 0;
        if (varW > varH) {
            wImage = parseInt(wDiv);
            hImage = parseInt(naturalHeight / varW);
            yImagen = parseInt((hDiv - hImage) / 2);
        } else {
            wImage = parseInt(naturalWidth / varH);
            hImage = parseInt(hDiv);
            xImagen = parseInt((wDiv - wImage) / 2);
        }
        return {
            w: wImage,
            h: hImage,
            x: xImagen,
            y: yImagen,
        };
    },

    clickImage: function (img, epx, epy) {
        const $cursor = $('#sopaECursor'),
            $x = $('#sopaEXImage'),
            $y = $('#sopaEYImage'),
            $img = $(img),
            posX = epx - $img.offset().left,
            posY = epy - $img.offset().top,
            wI = $img.width() > 0 ? $img.width() : 1,
            hI = $img.height() > 0 ? $img.height() : 1,
            lI = $img.position().left,
            tI = $img.position().top;
        $x.val(posX / wI);
        $y.val(posY / hI);
        $cursor.css({
            left: posX + lI,
            top: posY + tI,
            'z-index': 31,
        });
        $cursor.show();
    },

    removeTags: function (str) {
        const wrapper = $('<div></div>');
        wrapper.html(str);
        return wrapper.text();
    },
};
