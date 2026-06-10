/* eslint-disable no-undef */
/**
 * Adaptative Quiz iDevice (edition code)
 *
 * Paginated multiple-choice quiz inspired by the quick-questions form:
 *  - One question is edited at a time.
 *  - Each question has: difficulty (1/2/3/4/5), optional image, optional audio,
 *    2-6 answer options (each with its own optional audio) and optional
 *    feedback strings (with optional audio) for correct/incorrect answers.
 *  - Runtime adaptation rules live in the export code.
 */
var $exeDevice = {
    name: 'adaptative-quiz',
    classIdevice: 'adaptative-quiz',
    idevicePath: '',
    id: false,
    ci18n: {},
    msgs: {},
    version: 2,
    active: 0,
    questionsGame: [],
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    levelFilter: 0,
    MIN_OPTIONS: 2,
    MAX_OPTIONS: 6,
    MIN_QUESTIONS: 1,
    DEFAULT_MIN_PLAY: 5,
    LEVELS_BY_COUNT: { 3: [1, 2, 3], 4: [1, 2, 3, 4], 5: [1, 2, 3, 4, 5] },
    DEFAULT_NUM_LEVELS: 3,
    AI_TOTAL_QUESTIONS: 60,
    numLevels: 3,
    get LEVELS() {
        return this.LEVELS_BY_COUNT[this.numLevels] || this.LEVELS_BY_COUNT[this.DEFAULT_NUM_LEVELS];
    },

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData || {};
        this.idevicePath = path;
        this.questionsGame = [];
        this.refreshTranslations();
        this.setMessagesInfo();
        this.createForm();
    },

    enableForm: () => {
        $exeDevice.applyNumLevels($exeDevice.DEFAULT_NUM_LEVELS);
        $exeDevice.initQuestions();

        const root = document.getElementById('adaptativeQuizIdeviceForm') || document;
        if (
            $exeDevicesEdition &&
            $exeDevicesEdition.iDevice &&
            $exeDevicesEdition.iDevice.voiceRecorder &&
            typeof $exeDevicesEdition.iDevice.voiceRecorder.initVoiceRecorders === 'function'
        ) {
            $exeDevicesEdition.iDevice.voiceRecorder.initVoiceRecorders(root);
        }
        // File picker buttons ("Select a file") are injected by the framework
        // via ideviceNode.legacyExeIdevicesFilePicker(); calling filePicker.init()
        // here would add a second button next to every .exe-file-picker input.

        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgReady: c_('Ready?'),
            msgStartGame: c_('Click here to play'),
            msgCheck: c_('Check'),
            msgSelectOption: c_('Click on an option to choose your answer.'),
            msgNext: c_('Next question'),
            msgPlayAgain: c_('Play Again'),
            msgHits: c_('Hits'),
            msgErrors: c_('Errors'),
            msgScore: c_('Score'),
            msgLevel: c_('Level'),
            msgMaxLevel: c_('Highest level reached'),
            msgAnswered: c_('Answered'),
            msgGameOver: c_('Game Over!'),
            msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
            msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
            msgQuestion: c_('Question'),
            msgDifficulty: c_('Difficulty'),
            msgLevelEasy: c_('Easy'),
            msgLevelMedium: c_('Medium'),
            msgLevelHard: c_('Hard'),
            msgLevelExpert: c_('Expert'),
            msgLevelMaster: c_('Master'),
            msgLevelUp: c_('Level up!'),
            msgLevelDown: c_('Level down'),
            msgReportTitle: c_('Final report'),
            msgReportHigh: c_('Excellent. You dominate the highest-level contents.'),
            msgReportMedium: c_('Good job. You have achieved the intermediate level.'),
            msgReportLow: c_('You need a bit more practice. Review the basic contents.'),
            msgEndGameScore: c_('Please start the game before saving your score.'),
            msgScoreScorm: c_("The score can't be saved because this page is not part of a SCORM package."),
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
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('Adaptative Quiz'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgPlayAudio: c_('Play audio'),
            msgPauseAudio: c_('Pause audio'),
            msgImageAlt: c_('Illustration'),
            msgTime: c_('Time'),
            msgStart: c_('Start'),
            msgTimeUp: c_("Time's up!"),
        };
    },

    setMessagesInfo: function () {
        this.msgs = {
            msgNoSuportBrowser: _('Your browser is not compatible with this type of activity.'),
            msgNoQuestions: _('You must add at least one question.'),
            msgEOneQuestion: _('You must have at least one question.'),
            msgQuestionEmpty: _('Question %s: the question text cannot be empty.'),
            msgOptionsIncomplete: _('Question %s: please fill in all answer options.'),
            msgNoCorrectSelected: _('Question %s: please mark which option is the correct answer.'),
            msgNumQuestionsRange: _('You must add at least %s questions.'),
            msgInitialLevelEmpty: _(
                'Warning: the selected initial level has no questions. The quiz will start using the fallback level.',
            ),
            msgLevelNameEmpty: _('Please provide a name for every level.'),
            msgLevelTooFewQuestions: _('Level "%s" must have at least 2 questions.'),
            msgProvideTimeSolution: _('Please indicate the time the solution will be displayed.'),
            msgESelectAtLeastOne: _('Question %s: please mark at least one correct answer.'),
            msgEProvideWord: _('Question %s: please provide the solution word or phrase.'),
            msgEDefinition: _('Question %s: please provide the definition.'),
            msgETypeChoose: _('Question %s: please specify a unique order from 1 to %n for every option.'),
        };
    },

    showMessage: msg => {
        eXe.app.alert(msg);
    },

    cleanQuestionPrefix: function (msg, questionNumber) {
        const clean = String(msg || '')
            .replace('%s', questionNumber)
            .replace(/^[^:]+:\s*/, '');
        return clean.charAt(0).toUpperCase() + clean.slice(1);
    },

    normalizeQuestionsPerRound: value => Math.max(parseInt(value, 10) || 1, 1),

    removeTags: str =>
        String(str ?? '')
            .replace(/<[^>]*>/g, '')
            .trim(),

    /**
     * Reusable audio input with voice recorder, matching quick-questions'
     * `data-voice-recorder` pattern so common_edition wires the mic control.
     * Collapsed by default; revealed via the "more" toggle rendered next to
     * the corresponding text input (see `audioToggleButton`).
     *
     * A play button (image link) is appended next to the picker, mirroring
     * `#quextEPlayAudio` in quick-questions: clicking it plays the currently
     * referenced audio, or toggles playback if the same file is already
     * sounding (toggle behavior lives in `helpers.playSound`).
     */
    audioField: idSuffix => {
        const inputId = 'adaptativeQuizAudio-' + idSuffix;
        const path = $exeDevice.idevicePath || '';
        const playLabel = _('Play audio');
        return `
            <div class="ADQ-EAudioField d-flex align-items-center gap-2 flex-nowrap mb-2" data-voice-recorder data-voice-input="#${inputId}" data-audio-slot="${idSuffix}" style="display:none">
                <label class="sr-av" for="${inputId}">${_('Audio URL')}</label>
                <input type="text" class="exe-file-picker w-100 form-control me-0 ADQ-EAudioInput" id="${inputId}" data-audio-slot="${idSuffix}" />
                <a href="#" class="ADQ-ENavigationButton ADQ-EAudioPlay" data-audio-play="${idSuffix}" title="${playLabel}" aria-label="${playLabel}"><img src="${path}quextIEPlay.png" alt="${playLabel}" class="ADQ-ENavigationButton" /></a>
            </div>
        `;
    },

    /**
     * Toggle button rendered inline to the right of each text input. Clicking
     * it reveals/hides the associated `.ADQ-EAudioField` (matched by slot).
     */
    audioToggleButton: idSuffix => {
        const label = _('Show audio options');
        return `
            <button type="button" class="ADQ-EAudioToggle btn btn-outline-secondary btn-sm" data-audio-toggle="${idSuffix}" aria-expanded="false" aria-label="${label}" title="${label}">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" width="16" height="16"><path fill="currentColor" d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                <span class="sr-av">${label}</span>
            </button>
        `;
    },

    createForm: function () {
        const path = this.idevicePath;
        const html = `
            <div id="adaptativeQuizIdeviceForm">
                ${$exeDevicesEdition.iDevice.common.getIdeviceDescription(
                    _(
                        'Create a multiple-choice quiz whose difficulty adapts to the learner. Choose the number of difficulty levels (3, 4 or 5) and assign one to each question; the quiz goes up a level after two correct answers in a row and down after two wrong answers in a row.',
                    ),
                    null,
                )}
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Choose the correct answer for each question. To move up to the next level, you must answer two questions correctly in a row. If you get two questions wrong in a row, you will move down to the previous level.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <span>${_('Number of levels')}:</span>
                                <span class="ADQ-EInputLevels d-flex align-items-center gap-2 flex-nowrap">
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input" id="adaptativeQuizNumLevels3" type="radio" name="adqnumlevels" value="3" checked="checked" />
                                        <label for="adaptativeQuizNumLevels3">3</label>
                                    </div>
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input" id="adaptativeQuizNumLevels4" type="radio" name="adqnumlevels" value="4" />
                                        <label for="adaptativeQuizNumLevels4">4</label>
                                    </div>
                                    <div class="form-check form-check-inline m-0">
                                        <input class="form-check-input" id="adaptativeQuizNumLevels5" type="radio" name="adqnumlevels" value="5" />
                                        <label for="adaptativeQuizNumLevels5">5</label>
                                    </div>
                                </span>
                            </div>
                            <div class="ADQ-ELevelsGrid mb-3">
                                <div>
                                    <label for="adaptativeQuizLevelName1">${_('Level 1 name')}:</label>
                                    <input type="text" id="adaptativeQuizLevelName1" class="form-control form-control-sm" value="${_('Easy')}" />
                                </div>
                                <div>
                                    <label for="adaptativeQuizLevelName2">${_('Level 2 name')}:</label>
                                    <input type="text" id="adaptativeQuizLevelName2" class="form-control form-control-sm" value="${_('Medium')}" />
                                </div>
                                <div>
                                    <label for="adaptativeQuizLevelName3">${_('Level 3 name')}:</label>
                                    <input type="text" id="adaptativeQuizLevelName3" class="form-control form-control-sm" value="${_('Hard')}" />
                                </div>
                                <div id="adaptativeQuizLevelName4Wrap" style="display:none">
                                    <label for="adaptativeQuizLevelName4">${_('Level 4 name')}:</label>
                                    <input type="text" id="adaptativeQuizLevelName4" class="form-control form-control-sm" value="${_('Expert')}" />
                                </div>
                                <div id="adaptativeQuizLevelName5Wrap" style="display:none">
                                    <label for="adaptativeQuizLevelName5">${_('Level 5 name')}:</label>
                                    <input type="text" id="adaptativeQuizLevelName5" class="form-control form-control-sm" value="${_('Master')}" />
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="adaptativeQuizInitialLevel" class="mb-0">${_('Initial level')}:</label>
                                <select id="adaptativeQuizInitialLevel" class="form-control form-control-sm" style="width:auto">
                                    <option value="1">1</option>
                                    <option value="2" selected>2</option>
                                    <option value="3">3</option>
                                    <option value="4" data-level-extra="4" style="display:none">4</option>
                                    <option value="5" data-level-extra="5" style="display:none">5</option>
                                </select>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="adaptativeQuizNumRound" class="mb-0">${_('Number of questions')}:</label>
                                <input type="number" id="adaptativeQuizNumRound" class="form-control form-control-sm ADQ-ENumberInput" value="6" min="1" />
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <label for="adaptativeQuizETime" class="mb-0">${_('Time (minutes)')}:</label>
                                <input type="number" id="adaptativeQuizETime" class="form-control form-control-sm ADQ-ENumberInput" value="0" min="0" max="59" />
                                <small class="text-muted">${_('Set to 0 to disable the time limit.')}</small>
                            </div>
                            <div class="adaptativeQuizShowSolutionRow d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item m-0">
                                    <span class="toggle-control"><input type="checkbox" id="adaptativeQuizShowSolution" class="toggle-input" checked/><span class="toggle-visual"></span></span>
                                    <label for="adaptativeQuizShowSolution" class="toggle-label">${_('Show solutions')}.</label>
                                </div>
                                <label for="adaptativeQuizTimeShowSolution" class="mb-0 ms-2 d-flex align-items-center gap-1 adaptativeQuizShowSolutionTime">
                                    ${_('Show solution in')}:
                                </label>
                                <input type="number" class="form-control form-control-sm" id="adaptativeQuizTimeShowSolution" value="3" min="1" max="9" style="width:5rem;text-align:center" />
                                <span>${_('seconds')}</span>
                            </div>
                            <div id="adaptativeQuizCustomMessagesRow" class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control"><input type="checkbox" id="adaptativeQuizECustomMessages" class="toggle-input"/><span class="toggle-visual"></span></span>
                                    <label for="adaptativeQuizECustomMessages" class="toggle-label">${_('Custom messages')}.</label>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control"><input type="checkbox" id="adaptativeQuizShuffle" class="toggle-input" checked/><span class="toggle-visual"></span></span>
                                    <label for="adaptativeQuizShuffle" class="toggle-label">${_('Shuffle answer options at runtime')}</label>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control"><input type="checkbox" id="adaptativeQuizCaseSensitive" class="toggle-input"/><span class="toggle-visual"></span></span>
                                    <label for="adaptativeQuizCaseSensitive" class="toggle-label">${_('Case-sensitive answer matching (word type)')}</label>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                <div class="toggle-item">
                                    <span class="toggle-control"><input type="checkbox" id="adaptativeQuizAccentSensitive" class="toggle-input"/><span class="toggle-visual"></span></span>
                                    <label for="adaptativeQuizAccentSensitive" class="toggle-label">${_('Require correct accents (word type)')}</label>
                                </div>
                            </div>
                            <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                ${$exeDevicesEdition.iDevice.gamification.progressBar.getContents(path)}
                            </div>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="ADQ-EPanel" id="adaptativeQuizEPanel">
                            <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="adaptativeQuizELevelFilterDiv">
                                <label for="adaptativeQuizELevelFilter" class="mb-0">${_('Level filter')}:</label>
                                <select id="adaptativeQuizELevelFilter" class="form-control form-control-sm ADQ-ELevelFilter" style="width:auto">
                                    <option value="0" selected>${_('All')}</option>
                                </select>
                            </div>
                            <div class="ADQ-EOptionsMedia">
                                <div class="ADQ-EOptionsGame">
                                    <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
                                        <span>${_('Type')}:</span>
                                        <span class="ADQ-EInputTypeSelect d-flex align-items-center gap-2 flex-wrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ETypeSelect form-check-input" id="adaptativeQuizTypeSelect" type="radio" name="adqtypeselect" value="0" checked="checked" />
                                                <label for="adaptativeQuizTypeSelect">${_('Select')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ETypeSelect form-check-input" id="adaptativeQuizTypeOrder" type="radio" name="adqtypeselect" value="1" />
                                                <label for="adaptativeQuizTypeOrder">${_('Order')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ETypeSelect form-check-input" id="adaptativeQuizTypeWord" type="radio" name="adqtypeselect" value="2" />
                                                <label for="adaptativeQuizTypeWord">${_('Word')}</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                        <span>${_('Multimedia Type')}:</span>
                                        <span class="ADQ-EInputMedias d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-EType form-check-input" checked="checked" id="adaptativeQuizMediaNormal" type="radio" name="adqtype" value="0" />
                                                <label for="adaptativeQuizMediaNormal">${_('None')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-EType form-check-input" id="adaptativeQuizMediaImage" type="radio" name="adqtype" value="1" />
                                                <label for="adaptativeQuizMediaImage">${_('Image')}</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-none align-items-center gap-2 flex-nowrap mb-3" id="adaptativeQuizInputImage">
                                        <label class="sr-av" for="adaptativeQuizEURLImage">${_('Image URL')}</label>
                                        <input type="text" class="exe-image-picker w-100 form-control me-0 ADQ-EImageInput" id="adaptativeQuizEURLImage"/>
                                        <a href="#" class="ADQ-ENavigationButton ADQ-EImageReload" id="adaptativeQuizEReloadImage" title="${_('Reload image')}" aria-label="${_('Reload image')}"><img src="${path}quextIEPlay.png" alt="${_('Reload image')}" class="ADQ-ENavigationButton" /></a>
                                    </div>
                                    <div class="d-none align-items-center flex-nowrap gap-2 mb-3" id="adaptativeQuizEAuthorAlt">
                                        <div class="w-50" id="adaptativeQuizEInputAuthor">
                                            <label for="adaptativeQuizEAuthor" class="form-label mb-1">${_('Authorship')}</label>
                                            <input id="adaptativeQuizEAuthor" type="text" class="form-control w-100 ADQ-EImageAuthor" />
                                        </div>
                                        <div class="w-50" id="adaptativeQuizEInputAlt">
                                            <label for="adaptativeQuizEAlt" class="form-label mb-1">${_('Alternative text')}</label>
                                            <input id="adaptativeQuizEAlt" type="text" class="form-control w-100 ADQ-EImageAlt" />
                                        </div>
                                    </div>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3" id="adaptativeQuizEOptionsNumberDiv">
                                        <span>${_('Options Number')}:</span>
                                        <span class="ADQ-EInputNumbers d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ENumber form-check-input" id="adaptativeQuizNumQ2" type="radio" name="adqnumber" value="2" />
                                                <label for="adaptativeQuizNumQ2">2</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ENumber form-check-input" id="adaptativeQuizNumQ3" type="radio" name="adqnumber" value="3" />
                                                <label for="adaptativeQuizNumQ3">3</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ENumber form-check-input" id="adaptativeQuizNumQ4" type="radio" name="adqnumber" value="4" checked="checked" />
                                                <label for="adaptativeQuizNumQ4">4</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ENumber form-check-input" id="adaptativeQuizNumQ5" type="radio" name="adqnumber" value="5" />
                                                <label for="adaptativeQuizNumQ5">5</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="ADQ-ENumber form-check-input" id="adaptativeQuizNumQ6" type="radio" name="adqnumber" value="6" />
                                                <label for="adaptativeQuizNumQ6">6</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3 d-none" id="adaptativeQuizEPercentageShowDiv">
                                        <label for="adaptativeQuizEPercentageShow">${_('Percentage of letters to show (%)')}:</label>
                                        <input type="number" id="adaptativeQuizEPercentageShow" class="ADQ-EPercentageShow form-control form-control-sm" value="35" min="0" max="100" step="5" style="width:auto" />
                                    </div>
                                    <div class="d-flex align-items-center gap-2 flex-nowrap mb-3">
                                        <label for="adaptativeQuizDifficulty">${_('Difficulty')}:</label>
                                        <select id="adaptativeQuizDifficulty" class="form-control form-control-sm ADQ-EDifficulty" style="width:auto"></select>
                                    </div>
                                </div>
                                <div class="ADQ-EMultiMediaOption">
                                    <div class="ADQ-EMultimedia" id="adaptativeQuizMultimedia">
                                        <img class="ADQ-EMedia" id="adaptativeQuizEImagePreview" alt="${_('Image')}" style="display:none" />
                                        <img class="ADQ-EMedia" src="${path}quextIEImage.png" id="adaptativeQuizENoImage" alt="${_('No image')}" />
                                    </div>
                                </div>
                            </div>
                            <div class="ADQ-EContents">
                                <div class="ADQ-EQASelect" id="adaptativeQuizEQASelect">
                                    <div class="ADQ-EQuestionDiv">
                                        <label class="sr-av" for="adaptativeQuizEQuestion">${_('Question')}:</label>
                                        <div class="ADQ-EInputWithToggle d-flex align-items-center gap-2">
                                            <input type="text" class="ADQ-EQuestion form-control" id="adaptativeQuizEQuestion" placeholder="${_('Question')}" />
                                            ${this.audioToggleButton('question')}
                                        </div>
                                        ${this.audioField('question')}
                                    </div>
                                    <div class="ADQ-EAnswers" id="adaptativeQuizEAnswers">
                                        ${this.renderAnswerRows()}
                                    </div>
                                </div>
                                <div class="ADQ-EQAWord d-none" id="adaptativeQuizEQAWord">
                                    <div class="ADQ-EWordRow">
                                        <div class="ADQ-EInputWithToggle d-flex align-items-center gap-2 flex-nowrap mb-2">
                                            <label for="adaptativeQuizEWord" class="m-0">${_('Word')}:</label>
                                            <input type="text" class="ADQ-EWord form-control" id="adaptativeQuizEWord" placeholder="${_('Word')}" />
                                            ${this.audioToggleButton('word')}
                                        </div>
                                        ${this.audioField('word')}
                                    </div>
                                    <div class="ADQ-EWordRow">
                                        <div class="ADQ-EInputWithToggle d-flex align-items-center gap-2 flex-nowrap mb-2">
                                            <label for="adaptativeQuizESolutionWord" class="m-0">${_('Definition')}:</label>
                                            <input type="text" class="ADQ-ESolutionWord form-control" id="adaptativeQuizESolutionWord" placeholder="${_('Definition')}" />
                                            ${this.audioToggleButton('solutionWord')}
                                        </div>
                                        ${this.audioField('solutionWord')}
                                    </div>
                                </div>
                            </div>
                            <div class="ADQ-EOrders" id="adaptativeQuizEOrder">
                                <div class="ADQ-ECustomMessage gap-2">
                                    <span class="sr-av">${_('Hit')}</span><span class="ADQ-EHit" aria-hidden="true">&#10004;</span>
                                    <label for="adaptativeQuizEMessageOK">${_('Message')}:</label>
                                    <input type="text" class="form-control ADQ-EMessageOK" id="adaptativeQuizEMessageOK" />
                                    ${this.audioToggleButton('msgHit')}
                                </div>
                                ${this.audioField('msgHit')}
                                <div class="ADQ-ECustomMessage gap-2">
                                    <span class="sr-av">${_('Error')}</span><span class="ADQ-EError" aria-hidden="true">&#10006;</span>
                                    <label for="adaptativeQuizEMessageKO">${_('Message')}:</label>
                                    <input type="text" class="form-control ADQ-EMessageKO" id="adaptativeQuizEMessageKO" />
                                    ${this.audioToggleButton('msgError')}
                                </div>
                                ${this.audioField('msgError')}
                            </div>
                            <div class="ADQ-ENavigationButtons gap-2">
                                <a href="#" id="adaptativeQuizEAdd" class="ADQ-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="ADQ-ENavigationButton" /></a>
                                <a href="#" id="adaptativeQuizEFirst" class="ADQ-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="ADQ-ENavigationButton" /></a>
                                <a href="#" id="adaptativeQuizEPrevious" class="ADQ-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="ADQ-ENavigationButton" /></a>
                                <label class="sr-av" for="adaptativeQuizENumberQuestion">${_('Question number:')}:</label>
                                <input type="text" class="ADQ-NumberQuestion form-control" id="adaptativeQuizENumberQuestion" value="1"/>
                                <a href="#" id="adaptativeQuizENext" class="ADQ-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="ADQ-ENavigationButton" /></a>
                                <a href="#" id="adaptativeQuizELast" class="ADQ-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="ADQ-ENavigationButton" /></a>
                                <a href="#" id="adaptativeQuizEDelete" class="ADQ-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="ADQ-ENavigationButton" /></a>
                                <a href="#" id="adaptativeQuizECopy" class="ADQ-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="ADQ-ENavigationButton" /></a>
                                <a href="#" id="adaptativeQuizECut" class="ADQ-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="ADQ-ENavigationButton" /></a>
                                <a href="#" id="adaptativeQuizEPaste" class="ADQ-ENavigationButton" title="${_('Paste question')}" style="display:none"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="ADQ-ENavigationButton" /></a>
                            </div>
                            <div class="ADQ-ENumQuestionDiv">
                                <div class="ADQ-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div>
                                <span class="ADQ-ENumQuestions" id="adaptativeQuizENumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.share.getTab(true, 10, true)}
                ${$exeDevicesEdition.iDevice.gamification.share.getTabIA(10, { numLevels: this.numLevels })}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
            </div>
        `;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('adaptativeQuizIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();
        this.enableForm();
    },

    /**
     * Render the four answer rows (2-4 visible depending on numberOptions).
     * The leading slot (`.ADQ-EAnswerControl`) is filled in by
     * `applyAnswerControls` according to the current question type so that
     * only one control element exists per row at any moment.
     */
    renderAnswerRows: function () {
        let html = '';
        for (let i = 0; i < this.MAX_OPTIONS; i++) {
            const letter = String.fromCharCode(65 + i);
            html += `
                <div class="ADQ-EOptionDiv" data-option-index="${i}">
                    <div class="ADQ-EOptionRow">
                        <span class="ADQ-EAnswerControl" data-option-index="${i}"></span>
                        <label class="sr-av" for="adaptativeQuizEOption${i}">${_('Option')} ${letter}:</label>
                        <input type="text" class="ADQ-EOption${i} ADQ-EAnwersOptions form-control" id="adaptativeQuizEOption${i}" placeholder="${_('Option')} ${letter}" />
                        ${this.audioToggleButton('option' + i)}
                    </div>
                    ${this.audioField('option' + i)}
                </div>
            `;
        }
        return html;
    },

    /**
     * Replace the leading control in every answer row with the markup that
     * matches the active type:
     *  - typeSelect=0 (Select): a checkbox per row.
     *  - typeSelect=1 (Sort):   a static rank badge (1..n).
     *  - typeSelect=2 (Word):   nothing (the answers panel is hidden).
     * Re-running this is cheap and idempotent.
     */
    applyAnswerControls: function (typeSelect) {
        const t = parseInt(typeSelect, 10);
        for (let i = 0; i < this.MAX_OPTIONS; i++) {
            const letter = String.fromCharCode(65 + i);
            const $slot = $('.ADQ-EAnswerControl[data-option-index="' + i + '"]');
            if (!$slot.length) continue;
            if (t === 1) {
                $slot.html(`<span class="ADQ-ESolutionOrder badge bg-secondary" aria-hidden="true">${i + 1}</span>`);
            } else if (t === 2) {
                $slot.empty();
            } else {
                $slot.html(
                    `<input type="checkbox" class="ADQ-ESolutionMulti form-check-input" name="adqsolutionmulti" id="adaptativeQuizESolutionMulti${i}" value="${i}" />` +
                        `<label class="sr-av" for="adaptativeQuizESolutionMulti${i}">${_('Solution')} ${letter}</label>`,
                );
            }
        }
    },

    initQuestions: function () {
        if (this.questionsGame.length === 0) {
            this.questionsGame.push(this.getCuestionDefault());
        }
        this.active = 0;
        this.showQuestion(0);
        $('#adaptativeQuizENumQuestions').text(this.questionsGame.length);
    },

    getCuestionDefault: () => ({
        type: 0,
        typeSelect: 0,
        url: '',
        author: '',
        alt: '',
        audio: '',
        question: '',
        numberOptions: 4,
        options: [
            { text: '', audio: '' },
            { text: '', audio: '' },
            { text: '', audio: '' },
            { text: '', audio: '' },
            { text: '', audio: '' },
            { text: '', audio: '' },
        ],
        solutionMulti: [],
        solutionOrder: [],
        solutionWord: '',
        solutionWordAudio: '',
        percentageShow: 35,
        difficulty: 1,
        msgHit: '',
        msgHitAudio: '',
        msgError: '',
        msgErrorAudio: '',
    }),

    /**
     * Render the currently active question into the form.
     */
    showQuestion: function (i) {
        const idx = Math.max(0, Math.min(i, this.questionsGame.length - 1));
        this.active = idx;
        const q = this.questionsGame[idx] || this.getCuestionDefault();

        // Legacy migration: drop the obsolete "Test" (3) and "True/False"
        // (4) types. Anything other than 0/1/2 becomes "Select" (multi)
        // with the previous single `solution` mapped into `solutionMulti`.
        let tSel = Number.isInteger(q.typeSelect) ? q.typeSelect : 0;
        if (tSel !== 0 && tSel !== 1 && tSel !== 2) {
            tSel = 0;
            if (!Array.isArray(q.solutionMulti) || q.solutionMulti.length === 0) {
                q.solutionMulti = Number.isInteger(q.solution) ? [q.solution] : [];
            }
        }
        q.typeSelect = tSel;
        $('input[name="adqtypeselect"][value="' + tSel + '"]').prop('checked', true);
        $('input[name="adqtype"][value="' + (q.type || 0) + '"]').prop('checked', true);
        $('input[name="adqnumber"][value="' + (q.numberOptions || 4) + '"]').prop('checked', true);
        $('#adaptativeQuizDifficulty').val(String(q.difficulty || 1));

        if (q.type === 1) {
            $('#adaptativeQuizInputImage').removeClass('d-none').addClass('d-flex');
            $('#adaptativeQuizEAuthorAlt').removeClass('d-none').addClass('d-flex');
        } else {
            $('#adaptativeQuizInputImage').removeClass('d-flex').addClass('d-none');
            $('#adaptativeQuizEAuthorAlt').removeClass('d-flex').addClass('d-none');
        }
        $('#adaptativeQuizEURLImage').val(q.url || '');
        $('#adaptativeQuizEAuthor').val(q.author || '');
        $('#adaptativeQuizEAlt').val(q.alt || '');
        this.updateImagePreview(q.url || '');

        // Populate both question structures (select/sort and word). The
        // visible one is chosen by `showQuestionType` below; populating both
        // keeps the DOM in sync regardless of which type is active.
        $('#adaptativeQuizAudio-question').val(q.audio || '');
        $('#adaptativeQuizEQuestion').val(q.question || '');
        $('#adaptativeQuizEWord').val(q.question || '');
        $('#adaptativeQuizAudio-word').val(q.audio || '');
        $('#adaptativeQuizAudio-solutionWord').val(q.solutionWordAudio || '');

        const options = Array.isArray(q.options) ? q.options : [];
        for (let k = 0; k < this.MAX_OPTIONS; k++) {
            const opt = options[k] || { text: '', audio: '' };
            $('#adaptativeQuizEOption' + k).val(opt.text || '');
            $('#adaptativeQuizAudio-option' + k).val(opt.audio || '');
        }

        // Apply type-specific UI before populating type-specific solution.
        this.showQuestionType(tSel);

        // Reset type-specific solution inputs first.
        $('input[name="adqsolutionmulti"]').prop('checked', false);
        $('#adaptativeQuizESolutionWord').val('');
        $('#adaptativeQuizAudio-solutionWord').val('');

        if (tSel === 1) {
            // Sort: option order in the form IS the correct order. Migrate
            // legacy data where solutionOrder was a permutation of 1..n by
            // reordering options so that solutionOrder becomes [1,2,...,n].
            const num = q.numberOptions || this.MAX_OPTIONS;
            const order = Array.isArray(q.solutionOrder) ? q.solutionOrder.slice(0, num) : [];
            const isPermutation =
                order.length === num &&
                order.every(v => Number.isInteger(v) && v >= 1 && v <= num) &&
                new Set(order).size === num;
            if (isPermutation && order.some((v, k) => v !== k + 1)) {
                const reordered = new Array(num);
                for (let k = 0; k < num; k++) {
                    const targetIdx = order[k] - 1;
                    reordered[targetIdx] = q.options[k];
                }
                for (let k = 0; k < num; k++) {
                    if (reordered[k]) {
                        q.options[k] = reordered[k];
                        $('#adaptativeQuizEOption' + k).val(reordered[k].text || '');
                        $('#adaptativeQuizAudio-option' + k).val(reordered[k].audio || '');
                    }
                }
            }
            q.solutionOrder = Array.from({ length: num }, (_, k) => k + 1);
        } else if (tSel === 2) {
            $('#adaptativeQuizESolutionWord').val(q.solutionWord || '');
            $('#adaptativeQuizAudio-solutionWord').val(q.solutionWordAudio || '');
            const pct = Number.isInteger(q.percentageShow) ? q.percentageShow : 35;
            $('#adaptativeQuizEPercentageShow').val(pct);
        } else {
            // Select (multi, default)
            const arr = Array.isArray(q.solutionMulti) ? q.solutionMulti : [];
            arr.forEach(idx2 => {
                $('#adaptativeQuizESolutionMulti' + idx2).prop('checked', true);
            });
        }

        $('#adaptativeQuizEMessageOK').val(q.msgHit || '');
        $('#adaptativeQuizAudio-msgHit').val(q.msgHitAudio || '');
        $('#adaptativeQuizEMessageKO').val(q.msgError || '');
        $('#adaptativeQuizAudio-msgError').val(q.msgErrorAudio || '');

        this.showOptions(q.numberOptions || 4);
        this.applyLevelFilterToForm(q);
        const filtered = this.getFilteredIndices();
        const pos = filtered.indexOf(idx);
        if (this.levelFilter > 0 && pos !== -1) {
            $('#adaptativeQuizENumberQuestion').val(pos + 1);
            $('#adaptativeQuizENumQuestions').text(filtered.length);
        } else {
            $('#adaptativeQuizENumberQuestion').val(idx + 1);
            $('#adaptativeQuizENumQuestions').text(this.questionsGame.length);
        }
    },

    /**
     * Build the list of question-array indices that satisfy the current
     * `levelFilter`. When the filter is 0 (“All”) every index is returned.
     */
    getFilteredIndices: function () {
        if (!this.levelFilter) return this.questionsGame.map((_q, i) => i);
        const lvl = this.levelFilter;
        const out = [];
        for (let i = 0; i < this.questionsGame.length; i++) {
            if (this.questionsGame[i] && this.questionsGame[i].difficulty === lvl) out.push(i);
        }
        return out;
    },

    /**
     * Reflect the current level filter on the form: when a specific level is
     * selected, the difficulty selector is forced to that level and disabled
     * so any new or edited question stays in the filtered level.
     */
    applyLevelFilterToForm: function (q) {
        const $diff = $('#adaptativeQuizDifficulty');
        if (this.levelFilter > 0) {
            $diff.val(String(this.levelFilter)).prop('disabled', true);
            if (q && q.difficulty !== this.levelFilter) q.difficulty = this.levelFilter;
        } else {
            $diff.prop('disabled', false);
        }
    },

    /**
     * Build the list of level names currently in use. Reads the user-edited
     * inputs in the Options panel and falls back to the translated defaults
     * (Easy/Medium/Hard/Expert/Master) when an input is missing or empty.
     */
    getLevelNames: function () {
        const names = [];
        for (let i = 1; i <= this.numLevels; i++) {
            const $input = $('#adaptativeQuizLevelName' + i);
            const fallback = i === 1
                ? this.msgs.msgLevelEasy
                : i === 2
                    ? this.msgs.msgLevelMedium
                    : i === 3
                        ? this.msgs.msgLevelHard
                        : i === 4
                            ? this.msgs.msgLevelExpert
                            : this.msgs.msgLevelMaster;
            const name = ($input.val() || fallback || ('Level ' + i)).toString();
            names.push(name);
        }
        return names;
    },

    /**
     * Rebuild the difficulty `<select>` so the author sees the configured
     * level names (Easy/Medium/Hard/…) instead of bare numbers. The option
     * value is still the 1-based level index used everywhere internally.
     * Preserves the current selection when still in range.
     */
    populateDifficultyOptions: function () {
        const $sel = $('#adaptativeQuizDifficulty');
        if (!$sel.length) return;
        const names = this.getLevelNames();
        const previous = parseInt($sel.val(), 10);
        let html = '';
        for (let i = 0; i < names.length; i++) {
            html += `<option value="${i + 1}">${names[i]}</option>`;
        }
        $sel.html(html);
        const desired = Number.isInteger(previous) && previous >= 1 && previous <= this.numLevels ? previous : 1;
        $sel.val(String(desired));
    },

    /**
     * Rebuild the level-filter `<select>` options based on the current
     * `numLevels` and the user-defined level names. Preserves the current
     * `levelFilter` value when still valid; otherwise resets to “All”.
     */
    populateLevelFilter: function () {
        const $sel = $('#adaptativeQuizELevelFilter');
        if (!$sel.length) return;
        const names = this.getLevelNames();
        const previous = this.levelFilter;
        let html = `<option value="0">${_('All')}</option>`;
        for (let i = 0; i < names.length; i++) {
            html += `<option value="${i + 1}">${names[i]}</option>`;
        }
        $sel.html(html);
        if (previous > 0 && previous <= this.numLevels) {
            $sel.val(String(previous));
        } else {
            $sel.val('0');
            this.levelFilter = 0;
        }
    },

    /**
     * Apply a new value of the level-filter dropdown. When set to a
     * specific level, navigate to the first question that matches that
     * level; if none exists, append a new empty question with that
     * difficulty so the author always has somewhere to type. The
     * difficulty selector is also disabled while a level filter is active.
     */
    applyLevelFilter: function (level) {
        const parsed = parseInt(level, 10);
        const lvl = Number.isInteger(parsed) && parsed >= 1 && parsed <= this.numLevels ? parsed : 0;
        // Persist any in-progress edit so switching the filter never loses
        // text the author has typed (validation is intentionally skipped so
        // the dropdown always responds).
        if (this.questionsGame && this.questionsGame[this.active]) {
            this.readQuestionFromDom();
        }
        // Drop empty placeholder questions left behind by previous filter
        // switches so we do not stack one empty question per visited level.
        // Always keep at least one question in the game.
        for (let i = this.questionsGame.length - 1; i >= 0 && this.questionsGame.length > 1; i--) {
            if (this.isEmptyQuestion(this.questionsGame[i])) {
                this.questionsGame.splice(i, 1);
            }
        }
        if (this.active >= this.questionsGame.length) {
            this.active = this.questionsGame.length - 1;
        }
        this.levelFilter = lvl;
        if (lvl === 0) {
            // "All" always lands on the very first question.
            this.active = 0;
            this.applyLevelFilterToForm(this.questionsGame[this.active]);
            this.showQuestion(this.active);
            return;
        }
        const filtered = this.getFilteredIndices();
        if (filtered.length === 0) {
            // No question of this level exists: if the sole existing
            // question is empty, repurpose it (just change its difficulty)
            // instead of stacking another empty placeholder.
            if (this.questionsGame.length === 1 && this.isEmptyQuestion(this.questionsGame[0])) {
                this.questionsGame[0].difficulty = lvl;
                this.active = 0;
            } else {
                const empty = this.getCuestionDefault();
                empty.difficulty = lvl;
                this.questionsGame.push(empty);
                this.active = this.questionsGame.length - 1;
            }
        } else {
            // Always show the first question of the chosen level.
            this.active = filtered[0];
        }
        this.applyLevelFilterToForm(this.questionsGame[this.active]);
        this.showQuestion(this.active);
    },

    /**
     * Find the next or previous question index matching the current filter.
     * Returns -1 when no other matching question exists in that direction.
     */
    findNeighborIndex: function (direction) {
        const filtered = this.getFilteredIndices();
        if (filtered.length === 0) return -1;
        const pos = filtered.indexOf(this.active);
        if (direction === 'next') {
            if (pos === -1) return filtered.find(i => i > this.active) ?? -1;
            return pos < filtered.length - 1 ? filtered[pos + 1] : -1;
        }
        if (direction === 'prev') {
            if (pos === -1) {
                let last = -1;
                for (const i of filtered) {
                    if (i < this.active) last = i;
                }
                return last;
            }
            return pos > 0 ? filtered[pos - 1] : -1;
        }
        if (direction === 'first') return filtered[0];
        if (direction === 'last') return filtered[filtered.length - 1];
        return -1;
    },

    /**
     * Apply UI changes for a given question type.
     * 0=select (multi-checkbox, default), 1=sort (order inputs),
     * 2=word (single solution input, options hidden).
     */
    showQuestionType: function (typeSelect) {
        const t = parseInt(typeSelect, 10);
        // Swap the leading control per row so only one element type ever
        // exists in the DOM (no hide/show CSS dependency).
        this.applyAnswerControls(t);

        if (t === 2) {
            // Word: hide select/sort container, show the word/solution
            // dual-row container. Also hide options-number radios and show
            // the percentage-of-letters-to-show input.
            $('#adaptativeQuizEQASelect').addClass('d-none').hide();
            $('#adaptativeQuizEQAWord').removeClass('d-none').show();
            $('#adaptativeQuizEOptionsNumberDiv').addClass('d-none').hide();
            $('#adaptativeQuizEPercentageShowDiv').removeClass('d-none').show();
        } else {
            // Select (multi) or Sort: show the question + answers container
            // and the options-number radios; hide the percentage input.
            $('#adaptativeQuizEQAWord').addClass('d-none').hide();
            $('#adaptativeQuizEQASelect').removeClass('d-none').show();
            $('#adaptativeQuizEOptionsNumberDiv').removeClass('d-none').show();
            $('#adaptativeQuizEPercentageShowDiv').addClass('d-none').hide();
        }
    },

    showOptions: function (n) {
        const num = Math.max(this.MIN_OPTIONS, Math.min(parseInt(n) || this.MAX_OPTIONS, this.MAX_OPTIONS));
        $('#adaptativeQuizEAnswers .ADQ-EOptionDiv').each(function (idx) {
            $(this).toggle(idx < num);
        });
    },

    /**
     * Show/hide the 4th level UI (level-name input, initial-level option and
     * difficulty option) based on `numLevels`. Also clamps any already-stored
     * difficulty and initialLevel that may have become out-of-range when
     * switching from 4 levels back to 3, and refreshes the AI hint.
     */
    applyNumLevels: function (n) {
        const parsed = parseInt(n, 10);
        const value = parsed === 5 ? 5 : parsed === 4 ? 4 : 3;
        this.numLevels = value;
        const showFour = value >= 4;
        const showFive = value >= 5;

        $('#adaptativeQuizLevelName4Wrap').toggle(showFour);
        $('#adaptativeQuizLevelName5Wrap').toggle(showFive);
        $('#adaptativeQuizInitialLevel option[data-level-extra="4"]').toggle(showFour);
        $('#adaptativeQuizInitialLevel option[data-level-extra="5"]').toggle(showFive);
        $('input[name="adqnumlevels"][value="' + value + '"]').prop('checked', true);

        const maxLevel = this.LEVELS[this.LEVELS.length - 1];
        if (parseInt($('#adaptativeQuizInitialLevel').val(), 10) > maxLevel) {
            $('#adaptativeQuizInitialLevel').val(String(maxLevel));
        }
        for (const q of this.questionsGame) {
            if (q && Number.isInteger(q.difficulty) && q.difficulty > maxLevel) {
                q.difficulty = maxLevel;
            }
        }
        if (this.levelFilter > maxLevel) this.levelFilter = 0;
        this.populateDifficultyOptions();
        this.populateLevelFilter();
        this.updateAIHint();
    },

    updateAIHint: function () {
        $exeDevicesEdition.iDevice.gamification.share.refreshIAPrompt(10, { numLevels: this.numLevels });
    },

    /**
     * Toggle the custom-messages panel (`.ADQ-EOrders`) that lets the author
     * override the default hit/error messages per question. Mirrors
     * quick-questions' `showSelectOrder`.
     */
    showSelectOrder: messages => {
        if (messages) {
            $('.ADQ-EOrders').slideDown();
        } else {
            $('.ADQ-EOrders').slideUp();
        }
    },

    updateSolutionFeedbackControls: function (showSolution) {
        const enabled = !!showSolution;
        $('#adaptativeQuizTimeShowSolution').prop('disabled', !enabled);

        const $customMessages = $('#adaptativeQuizECustomMessages');
        // The row uses the Bootstrap `d-flex` utility (display: flex !important),
        // so an inline `display:none` from .toggle()/.hide() is overridden and the
        // row never hides. Swap the `d-flex`/`d-none` utilities instead.
        $('#adaptativeQuizCustomMessagesRow')
            .toggleClass('d-flex', enabled)
            .toggleClass('d-none', !enabled);

        if (!enabled) {
            $customMessages.prop('checked', false);
            this.showSelectOrder(false);
            return;
        }

        this.showSelectOrder($customMessages.is(':checked'));
    },

    updateImagePreview: url => {
        const $img = $('#adaptativeQuizEImagePreview');
        const $noImg = $('#adaptativeQuizENoImage');
        if (url && url.length > 0) {
            $img.attr('src', url).show();
            $noImg.hide();
        } else {
            $img.hide().attr('src', '');
            $noImg.show();
        }
    },

    /**
     * Reload the image preview from the current URL field. Only the preview
     * `src` is affected — the saved question URL is left untouched.
     *
     * External `http(s)` images are force re-fetched with a cache-busting query
     * param. Local images (`asset://`, `blob:`, `data:`, relative paths) MUST
     * be applied verbatim: appending a query string breaks their resolution
     * (e.g. `asset://uuid?_reload=…` no longer matches the asset resolver), so
     * the cache-buster is only used for external URLs.
     */
    reloadImagePreview: () => {
        const url = ($('#adaptativeQuizEURLImage').val() || '').trim();
        const $img = $('#adaptativeQuizEImagePreview');
        const $noImg = $('#adaptativeQuizENoImage');
        if (url.length === 0) {
            $img.hide().attr('src', '');
            $noImg.show();
            return;
        }
        const isExternal = /^https?:\/\//i.test(url);
        const src = isExternal ? `${url}${url.indexOf('?') === -1 ? '?' : '&'}_reload=${Date.now()}` : url;
        // Clear first so re-applying the same local src still re-renders.
        $img.attr('src', '').attr('src', src).show();
        $noImg.hide();
    },

    readQuestionFromDom: function () {
        const q = this.questionsGame[this.active] || this.getCuestionDefault();
        const tSelRaw = parseInt($('input[name="adqtypeselect"]:checked').val(), 10);
        let tSel = Number.isInteger(tSelRaw) ? tSelRaw : 0;
        if (tSel !== 0 && tSel !== 1 && tSel !== 2) tSel = 0;
        q.typeSelect = tSel;
        q.type = parseInt($('input[name="adqtype"]:checked').val()) || 0;
        q.numberOptions = parseInt($('input[name="adqnumber"]:checked').val()) || 4;
        q.difficulty = parseInt($('#adaptativeQuizDifficulty').val()) || 1;
        if (this.LEVELS.indexOf(q.difficulty) === -1) q.difficulty = 1;
        q.url = q.type === 1 ? $('#adaptativeQuizEURLImage').val() || '' : '';
        q.author = q.type === 1 ? $('#adaptativeQuizEAuthor').val() || '' : '';
        q.alt = q.type === 1 ? $('#adaptativeQuizEAlt').val() || '' : '';
        if (q.typeSelect === 2) {
            // Word type reads its own dedicated inputs.
            q.audio = $('#adaptativeQuizAudio-word').val() || '';
            q.question = $('#adaptativeQuizEWord').val() || '';
        } else {
            q.audio = $('#adaptativeQuizAudio-question').val() || '';
            q.question = $('#adaptativeQuizEQuestion').val() || '';
        }

        const options = [];
        for (let k = 0; k < this.MAX_OPTIONS; k++) {
            options.push({
                text: $('#adaptativeQuizEOption' + k).val() || '',
                audio: $('#adaptativeQuizAudio-option' + k).val() || '',
            });
        }
        q.options = options;

        // Per-type solution storage
        q.solutionMulti = [];
        q.solutionOrder = [];
        q.solutionWord = '';
        q.solutionWordAudio = '';
        q.percentageShow = 35;
        if (q.typeSelect === 1) {
            // Sort: the option order in the form is the correct order, so
            // solutionOrder is always sequential [1, 2, ..., numberOptions].
            q.solutionOrder = Array.from({ length: q.numberOptions }, (_, k) => k + 1);
        } else if (q.typeSelect === 2) {
            q.solutionWord = $('#adaptativeQuizESolutionWord').val() || '';
            q.solutionWordAudio = $('#adaptativeQuizAudio-solutionWord').val() || '';
            const pctRaw = parseInt($('#adaptativeQuizEPercentageShow').val(), 10);
            q.percentageShow = Number.isInteger(pctRaw) ? Math.max(0, Math.min(100, pctRaw)) : 35;
        } else {
            // Select (multi, default)
            $('input[name="adqsolutionmulti"]:checked').each(function () {
                q.solutionMulti.push(parseInt($(this).val(), 10));
            });
        }

        q.msgHit = $('#adaptativeQuizEMessageOK').val() || '';
        q.msgHitAudio = $('#adaptativeQuizAudio-msgHit').val() || '';
        q.msgError = $('#adaptativeQuizEMessageKO').val() || '';
        q.msgErrorAudio = $('#adaptativeQuizAudio-msgError').val() || '';

        this.questionsGame[this.active] = q;
        return q;
    },

    clearQuestion: function () {
        $(
            '#adaptativeQuizEURLImage, #adaptativeQuizEAuthor, #adaptativeQuizEAlt, #adaptativeQuizAudio-question, #adaptativeQuizEQuestion, #adaptativeQuizEWord, #adaptativeQuizAudio-word, #adaptativeQuizESolutionWord, #adaptativeQuizAudio-solutionWord',
        ).val('');
        for (let k = 0; k < this.MAX_OPTIONS; k++) {
            $('#adaptativeQuizEOption' + k).val('');
            $('#adaptativeQuizAudio-option' + k).val('');
        }
        $(
            '#adaptativeQuizEMessageOK, #adaptativeQuizEMessageKO, #adaptativeQuizAudio-msgHit, #adaptativeQuizAudio-msgError',
        ).val('');
        this.updateImagePreview('');
    },

    validateQuestion: function () {
        const q = this.readQuestionFromDom();
        const human = this.active + 1;
        const tSel = Number.isInteger(q.typeSelect) ? q.typeSelect : 0;

        if (!q.question || this.removeTags(q.question).length === 0) {
            // For type 2 (word/definition) q.question stores the WORD the
            // learner has to type, so the matching error message is
            // "please provide the solution word" rather than
            // "the question text cannot be empty".
            const msg = this.cleanQuestionPrefix(
                tSel === 2 ? this.msgs.msgEProvideWord : this.msgs.msgQuestionEmpty,
                human,
            );
            this.showMessage(msg);
            return false;
        }

        if (tSel === 2) {
            // For type 2, q.solutionWord stores the DEFINITION (the prompt
            // shown to the learner), so a missing value here is reported as
            // a missing definition.
            if (!q.solutionWord || this.removeTags(q.solutionWord).length === 0) {
                this.showMessage(this.cleanQuestionPrefix(this.msgs.msgEDefinition, human));
                return false;
            }
            return true;
        }

        const num = q.numberOptions || 4;
        for (let k = 0; k < num; k++) {
            if (!q.options[k] || !q.options[k].text || this.removeTags(q.options[k].text).length === 0) {
                this.showMessage(this.cleanQuestionPrefix(this.msgs.msgOptionsIncomplete, human));
                return false;
            }
        }

        if (tSel === 1) {
            // Sort: option order is the correct order. The per-option text
            // check above already guarantees a fully-defined sequence.
        } else {
            // Select (multi, default): zero or more marked solutions are
            // allowed (a question with no correct answer is valid — the
            // learner must then submit without picking any option). Any
            // marked indexes must still be within range.
            const inRange = q.solutionMulti.every(idx => idx >= 0 && idx < num);
            if (!inRange) {
                this.showMessage(this.cleanQuestionPrefix(this.msgs.msgESelectAtLeastOne, human));
                return false;
            }
        }

        return true;
    },

    addQuestion: () => {
        if (!$exeDevice.validateQuestion()) return;
        const fresh = $exeDevice.getCuestionDefault();
        if ($exeDevice.levelFilter > 0) fresh.difficulty = $exeDevice.levelFilter;
        $exeDevice.questionsGame.push(fresh);
        $exeDevice.active = $exeDevice.questionsGame.length - 1;
        $exeDevice.typeEdit = -1;
        $('#adaptativeQuizEPaste').hide();
        $exeDevice.showQuestion($exeDevice.active);
    },

    removeQuestion: () => {
        if ($exeDevice.questionsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        }
        $exeDevice.questionsGame.splice($exeDevice.active, 1);
        if ($exeDevice.active >= $exeDevice.questionsGame.length) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
        }
        if ($exeDevice.levelFilter > 0) {
            const filtered = $exeDevice.getFilteredIndices();
            if (filtered.length === 0) {
                const empty = $exeDevice.getCuestionDefault();
                empty.difficulty = $exeDevice.levelFilter;
                $exeDevice.questionsGame.push(empty);
                $exeDevice.active = $exeDevice.questionsGame.length - 1;
            } else if (filtered.indexOf($exeDevice.active) === -1) {
                $exeDevice.active = filtered[0];
            }
        }
        $exeDevice.showQuestion($exeDevice.active);
    },

    copyQuestion: () => {
        if (!$exeDevice.validateQuestion()) return;
        $exeDevice.typeEdit = 0;
        $exeDevice.clipBoard = JSON.parse(JSON.stringify($exeDevice.questionsGame[$exeDevice.active]));
        $('#adaptativeQuizEPaste').show();
    },

    cutQuestion: () => {
        if (!$exeDevice.validateQuestion()) return;
        $exeDevice.numberCutCuestion = $exeDevice.active;
        $exeDevice.typeEdit = 1;
        $('#adaptativeQuizEPaste').show();
    },

    pasteQuestion: () => {
        if ($exeDevice.typeEdit === 0) {
            $exeDevice.active++;
            $exeDevice.questionsGame.splice($exeDevice.active, 0, JSON.parse(JSON.stringify($exeDevice.clipBoard)));
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit === 1) {
            const from = $exeDevice.numberCutCuestion;
            const to = $exeDevice.active;
            const item = $exeDevice.questionsGame.splice(from, 1)[0];
            $exeDevice.questionsGame.splice(to, 0, item);
            $exeDevice.typeEdit = -1;
            $('#adaptativeQuizEPaste').hide();
            $exeDevice.showQuestion(to);
        }
    },

    nextQuestion: () => {
        if (!$exeDevice.validateQuestion()) return;
        if ($exeDevice.levelFilter > 0) {
            const target = $exeDevice.findNeighborIndex('next');
            if (target !== -1) {
                $exeDevice.active = target;
                $exeDevice.showQuestion(target);
            }
            return;
        }
        if ($exeDevice.active < $exeDevice.questionsGame.length - 1) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: () => {
        if (!$exeDevice.validateQuestion()) return;
        if ($exeDevice.levelFilter > 0) {
            const target = $exeDevice.findNeighborIndex('prev');
            if (target !== -1) {
                $exeDevice.active = target;
                $exeDevice.showQuestion(target);
            }
            return;
        }
        if ($exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: () => {
        if (!$exeDevice.validateQuestion()) return;
        if ($exeDevice.levelFilter > 0) {
            const target = $exeDevice.findNeighborIndex('first');
            if (target !== -1 && target !== $exeDevice.active) {
                $exeDevice.active = target;
                $exeDevice.showQuestion(target);
            }
            return;
        }
        if ($exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showQuestion(0);
        }
    },

    lastQuestion: () => {
        if (!$exeDevice.validateQuestion()) return;
        if ($exeDevice.levelFilter > 0) {
            const target = $exeDevice.findNeighborIndex('last');
            if (target !== -1 && target !== $exeDevice.active) {
                $exeDevice.active = target;
                $exeDevice.showQuestion(target);
            }
            return;
        }
        if ($exeDevice.active < $exeDevice.questionsGame.length - 1) {
            $exeDevice.active = $exeDevice.questionsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    goToQuestion: () => {
        const input = parseInt($('#adaptativeQuizENumberQuestion').val());
        if (Number.isNaN(input)) {
            $exeDevice.showQuestion($exeDevice.active);
            return;
        }
        if ($exeDevice.levelFilter > 0) {
            const filtered = $exeDevice.getFilteredIndices();
            const target = filtered[Math.max(1, Math.min(input, filtered.length)) - 1];
            if (target !== undefined && target !== $exeDevice.active && $exeDevice.validateQuestion()) {
                $exeDevice.active = target;
                $exeDevice.showQuestion(target);
            } else {
                $exeDevice.showQuestion($exeDevice.active);
            }
            return;
        }
        const target = Math.max(1, Math.min(input, $exeDevice.questionsGame.length)) - 1;
        if (target !== $exeDevice.active && $exeDevice.validateQuestion()) {
            $exeDevice.active = target;
            $exeDevice.showQuestion(target);
        } else {
            $('#adaptativeQuizENumberQuestion').val($exeDevice.active + 1);
        }
    },

    loadPreviousValues: function () {
        const data = this.idevicePreviousData || {};
        if (!data || Object.keys(data).length === 0) return;

        this.updateFieldGame(data);

        const instructions = data.eXeFormInstructions || data.instructions || '';
        const textAfter = data.eXeIdeviceTextAfter || data.textAfter || '';
        $('#eXeGameInstructions').val(instructions);
        $('#eXeIdeviceTextAfter').val(textAfter);

        if (data.msgs) {
            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(data.msgs);
        }
    },

    updateFieldGame: function (dataGame) {
        dataGame.evaluation = dataGame.evaluation ?? false;
        dataGame.evaluationID = dataGame.evaluationID ?? '';
        dataGame.weighted = dataGame.weighted ?? 100;

        $exeDevice.id = $exeDevice.getIdeviceID();

        $('#adaptativeQuizNumRound').val(dataGame.numRound ?? this.DEFAULT_MIN_PLAY);
        $('#adaptativeQuizETime').val(Math.max(0, Math.min(59, parseInt(dataGame.time, 10) || 0)));
        $('#adaptativeQuizShuffle').prop('checked', dataGame.shuffle !== false);
        // Word-type answer-matching options. Default to case- and
        // accent-insensitive so existing activities behave as before.
        $('#adaptativeQuizCaseSensitive').prop('checked', dataGame.caseSensitive === true);
        $('#adaptativeQuizAccentSensitive').prop('checked', dataGame.accentSensitive === true);
        const showSolution = dataGame.showSolution !== false;
        $('#adaptativeQuizShowSolution').prop('checked', showSolution);
        const timeShowSolution = Math.max(1, Math.min(9, parseInt(dataGame.timeShowSolution, 10) || 3));
        $('#adaptativeQuizTimeShowSolution').val(timeShowSolution);
        $('#adaptativeQuizECustomMessages').prop('checked', showSolution && !!dataGame.customMessages);
        this.updateSolutionFeedbackControls(showSolution);
        const storedLevelsRaw = parseInt(dataGame.numLevels, 10);
        const storedLevels = storedLevelsRaw === 5 ? 5 : storedLevelsRaw === 4 ? 4 : this.DEFAULT_NUM_LEVELS;
        this.applyNumLevels(storedLevels);
        $('#adaptativeQuizInitialLevel').val(
            this.LEVELS.indexOf(dataGame.initialLevel) !== -1 ? String(dataGame.initialLevel) : '2',
        );
        if (dataGame.levelNames) {
            $('#adaptativeQuizLevelName1').val(dataGame.levelNames[0] || _('Easy'));
            $('#adaptativeQuizLevelName2').val(dataGame.levelNames[1] || _('Medium'));
            $('#adaptativeQuizLevelName3').val(dataGame.levelNames[2] || _('Hard'));
            if (dataGame.levelNames[3]) $('#adaptativeQuizLevelName4').val(dataGame.levelNames[3]);
            if (dataGame.levelNames[4]) $('#adaptativeQuizLevelName5').val(dataGame.levelNames[4]);
        }
        $exeDevicesEdition.iDevice.gamification.progressBar.setValues({
            evaluation: dataGame.evaluation,
            evaluationID: dataGame.evaluationID,
        });

        const loaded = Array.isArray(dataGame.questionsGame)
            ? dataGame.questionsGame
            : Array.isArray(dataGame.questions)
              ? dataGame.questions
              : [];
        this.questionsGame =
            loaded.length > 0 ? loaded.map(q => this.normalizeQuestion(q)) : [this.getCuestionDefault()];
        this.active = 0;
        this.showQuestion(0);

        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(dataGame.itinerary);

        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            dataGame.isScorm,
            dataGame.textButtonScorm,
            dataGame.repeatActivity,
            dataGame.weighted,
        );
    },

    /**
     * Accept both the current schema and the older one (flat options array,
     * 0/1/2 difficulty, `text` wrapper). Normalize into current schema.
     */
    normalizeQuestion: function (q) {
        const source = q || {};
        const legacyMap = { 0: 1, 1: 2, 2: 3 };

        const options = [];
        const rawOptions = Array.isArray(source.options) ? source.options : [];
        for (let i = 0; i < this.MAX_OPTIONS; i++) {
            const o = rawOptions[i];
            if (typeof o === 'string') {
                options.push({ text: o, audio: '' });
            } else if (o) {
                options.push({
                    text: o.text || '',
                    audio: o.audio || '',
                });
            } else {
                options.push({ text: '', audio: '' });
            }
        }

        let solution = source.solution;
        if (!Number.isInteger(solution)) {
            const found = rawOptions.findIndex(o => o && typeof o === 'object' && o.isCorrect);
            solution = found >= 0 ? found : 0;
        }

        let difficulty = source.difficulty;
        if (Number.isInteger(difficulty) && this.LEVELS.indexOf(difficulty) === -1 && legacyMap[difficulty]) {
            difficulty = legacyMap[difficulty];
        }
        if (this.LEVELS.indexOf(difficulty) === -1) difficulty = 1;

        const numberOptions = Math.max(
            this.MIN_OPTIONS,
            Math.min(source.numberOptions || rawOptions.length || this.MAX_OPTIONS, this.MAX_OPTIONS),
        );

        const feedback = source.feedback || {};
        const msgHit = source.msgHit || feedback.correct || '';
        const msgError = source.msgError || feedback.incorrect || '';
        const msgHitAudio = source.msgHitAudio || feedback.correctAudio || '';
        const msgErrorAudio = source.msgErrorAudio || feedback.incorrectAudio || '';

        const questionText = source.question || source.text || '';
        const type = Number.isInteger(source.type) ? source.type : source.image ? 1 : 0;
        const url = source.url || source.image || '';

        // Per-type fields. typeSelect: 0=Select(multi), 1=Sort, 2=Word.
        // Saved values may arrive as numeric strings, so coerce. Anything
        // outside {0,1,2} (e.g. legacy 3=Test or 4=True/False) maps to 0.
        let typeSelect = parseInt(source.typeSelect, 10);
        if (typeSelect !== 0 && typeSelect !== 1 && typeSelect !== 2) typeSelect = 0;

        const solutionMultiRaw = Array.isArray(source.solutionMulti) ? source.solutionMulti : [];
        const solutionMulti = solutionMultiRaw
            .map(v => parseInt(v, 10))
            .filter(v => Number.isInteger(v) && v >= 0 && v < numberOptions);
        // Promote legacy single `solution` into solutionMulti when the
        // upgraded type is Select and no explicit array was provided.
        if (typeSelect === 0 && solutionMulti.length === 0 && Number.isInteger(solution)) {
            if (solution >= 0 && solution < numberOptions) solutionMulti.push(solution);
        }

        const solutionOrderRaw = Array.isArray(source.solutionOrder) ? source.solutionOrder : [];
        const solutionOrder = solutionOrderRaw.slice(0, numberOptions).map(v => parseInt(v, 10) || 0);

        const solutionWord = String(source.solutionWord || '');
        const solutionWordAudio = String(source.solutionWordAudio || '');
        const percentageShowRaw = parseInt(source.percentageShow, 10);
        const percentageShow = Number.isInteger(percentageShowRaw)
            ? Math.max(0, Math.min(100, percentageShowRaw))
            : 35;

        return {
            type: type === 1 ? 1 : 0,
            typeSelect: typeSelect,
            url: url,
            author: source.author || '',
            alt: source.alt || '',
            audio: source.audio || '',
            question: questionText,
            numberOptions: numberOptions,
            options: options,
            solution: Math.max(0, Math.min(solution, numberOptions - 1)),
            solutionMulti: solutionMulti,
            solutionOrder: solutionOrder,
            solutionWord: solutionWord,
            solutionWordAudio: solutionWordAudio,
            percentageShow: percentageShow,
            difficulty: difficulty,
            msgHit: msgHit,
            msgHitAudio: msgHitAudio,
            msgError: msgError,
            msgErrorAudio: msgErrorAudio,
        };
    },

    validateData: function () {
        const itinerary = $exeDevicesEdition.iDevice.gamification.itinerary.getValues();
        if (!itinerary) return false;
        if (!this.validateQuestion()) return false;

        if (this.questionsGame.length < this.MIN_QUESTIONS) {
            this.showMessage(this.msgs.msgNoQuestions);
            return false;
        }

        const numRound = this.normalizeQuestionsPerRound($('#adaptativeQuizNumRound').val());
        $('#adaptativeQuizNumRound').val(numRound);
        if (numRound > this.questionsGame.length) {
            this.showMessage(this.msgs.msgNumQuestionsRange.replace('%s', numRound));
            return false;
        }

        const time = Math.max(0, Math.min(59, parseInt($('#adaptativeQuizETime').val(), 10) || 0));

        const shuffle = $('#adaptativeQuizShuffle').is(':checked');
        const caseSensitive = $('#adaptativeQuizCaseSensitive').is(':checked');
        const accentSensitive = $('#adaptativeQuizAccentSensitive').is(':checked');
        const showSolution = $('#adaptativeQuizShowSolution').is(':checked');
        const timeShowSolution = parseInt($('#adaptativeQuizTimeShowSolution').val(), 10) || 0;
        if (showSolution && timeShowSolution === 0) {
            this.showMessage(this.msgs.msgProvideTimeSolution);
            return false;
        }
        const customMessages = showSolution && $('#adaptativeQuizECustomMessages').is(':checked');
        const numLevelsRaw = parseInt($('input[name="adqnumlevels"]:checked').val(), 10);
        const numLevels = numLevelsRaw === 5 ? 5 : numLevelsRaw === 4 ? 4 : 3;
        let initialLevel = parseInt($('#adaptativeQuizInitialLevel').val()) || 2;
        if (this.LEVELS.indexOf(initialLevel) === -1) initialLevel = 2;
        const rawLevelNames = [
            ($('#adaptativeQuizLevelName1').val() || '').trim(),
            ($('#adaptativeQuizLevelName2').val() || '').trim(),
            ($('#adaptativeQuizLevelName3').val() || '').trim(),
        ];
        if (numLevels >= 4) {
            rawLevelNames.push(($('#adaptativeQuizLevelName4').val() || '').trim());
        }
        if (numLevels === 5) {
            rawLevelNames.push(($('#adaptativeQuizLevelName5').val() || '').trim());
        }
        if (rawLevelNames.some(name => name === '')) {
            this.showMessage(this.msgs.msgLevelNameEmpty);
            return false;
        }
        const levelNames = rawLevelNames.slice();

        const countByLevel = {};
        for (const level of this.LEVELS) countByLevel[level] = 0;
        for (const q of this.questionsGame) {
            if (countByLevel[q.difficulty] !== undefined) countByLevel[q.difficulty] += 1;
        }
        const activeLevels = this.LEVELS_BY_COUNT[numLevels] || this.LEVELS_BY_COUNT[this.DEFAULT_NUM_LEVELS];
        for (const level of activeLevels) {
            if ((countByLevel[level] || 0) < 2) {
                const name = levelNames[level - 1] || String(level);
                this.showMessage((this.msgs.msgLevelTooFewQuestions || '').replace('%s', name));
                return false;
            }
        }
        if (countByLevel[initialLevel] === 0) {
            this.showMessage(this.msgs.msgInitialLevelEmpty);
        }

        const progressBar = $exeDevicesEdition.iDevice.gamification.progressBar.getValues();
        if (!progressBar) return false;
        const evaluation = progressBar.evaluation;
        const evaluationID = progressBar.evaluationID;

        const id = this.getIdeviceID();
        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();

        let eXeFormInstructions = '';
        if (tinymce.get('eXeGameInstructions')) {
            eXeFormInstructions = tinymce.get('eXeGameInstructions').getContent();
        }

        let eXeIdeviceTextAfter = '';
        if (tinymce.get('eXeIdeviceTextAfter')) {
            eXeIdeviceTextAfter = tinymce.get('eXeIdeviceTextAfter').getContent();
        }

        return {
            id: id,
            ideviceId: id,
            typeGame: 'Adaptative Quiz',
            version: this.version,
            eXeFormInstructions: eXeFormInstructions,
            eXeIdeviceTextAfter: eXeIdeviceTextAfter,
            questionsGame: this.questionsGame,
            numRound: numRound,
            time: time,
            shuffle: shuffle,
            caseSensitive: caseSensitive,
            accentSensitive: accentSensitive,
            showSolution: showSolution,
            timeShowSolution: Math.max(1, Math.min(9, timeShowSolution || 3)),
            customMessages: customMessages,
            numLevels: numLevels,
            initialLevel: initialLevel,
            levelNames: levelNames,
            minQuestionsShown: this.DEFAULT_MIN_PLAY,
            evaluation: evaluation,
            evaluationID: evaluationID,
            itinerary: itinerary,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
        };
    },

    save: function () {
        const dataGame = this.validateData();
        if (!dataGame) return false;

        const i18n = this.ci18n;
        for (const i in i18n) {
            if (Object.hasOwn(i18n, i)) {
                const fVal = $('#ci18n_' + i).val();
                if (fVal !== '') i18n[i] = fVal;
            }
        }
        dataGame.msgs = i18n;
        return dataGame;
    },

    /**
     * Parse a single AI-generated line in the format expected by
     * `getAllowedFormats(10)`. Three line shapes are accepted, all sharing
     * the prefix `Type@Level#...`:
     *
     *   Type 0 — Multiple-choice (select):
     *     `0@Level#Solution#Question#OptionA#OptionB[#OptionC[#OptionD]]`
     *     - Solution: empty or any combination (1-4) of letters A, B, C, D
     *       identifying the correct options. Letters are case-insensitive.
     *
     *   Type 1 — Sort/order:
     *     `1@Level#Question#Item1#Item2#Item3[#Item4[#Item5[#Item6]]]`
     *     - Items must already be in the correct order (3 to 6 items).
     *
     *   Type 2 — Word/definition:
     *     `2@Level#Word#Definition`
     *
     * Level: 0 (low), 1 (medium), 2 (high) — and 3 (expert) when
     * `numLevels` is 4. Mapped to internal difficulty 1/2/3/4 via the same
     * legacy map used by `normalizeQuestion`.
     *
     * Returns a question object shaped like `getCuestionDefault()`, or
     * `null` if the line cannot be parsed.
     */
    parseAIQuestionLine: rawLine => {
        const raw = String(rawLine || '').trim();
        if (raw.length === 0) return null;

        const atIdx = raw.indexOf('@');
        const firstHash = raw.indexOf('#');
        if (atIdx <= 0 || firstHash === -1 || atIdx > firstHash) return null;

        const typeToken = raw.slice(0, atIdx).trim();
        const levelToken = raw.slice(atIdx + 1, firstHash).trim();
        const rest = raw.slice(firstHash + 1);

        const type = parseInt(typeToken, 10);
        const level = parseInt(levelToken, 10);
        const maxLevel = $exeDevice.numLevels - 1;
        if (!Number.isInteger(type) || type < 0 || type > 2) return null;
        if (!Number.isInteger(level) || level < 0 || level > maxLevel) return null;

        const parts = rest.split('#').map(p => p.trim());
        const legacyMap = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 };
        const difficulty = legacyMap[level];

        const baseQuestion = () => ({
            type: 0,
            typeSelect: 0,
            url: '',
            author: '',
            alt: '',
            audio: '',
            question: '',
            numberOptions: $exeDevice.MAX_OPTIONS,
            options: Array.from({ length: $exeDevice.MAX_OPTIONS }, () => ({ text: '', audio: '' })),
            solutionMulti: [],
            solutionOrder: [],
            solutionWord: '',
            solutionWordAudio: '',
            percentageShow: 35,
            difficulty: difficulty,
            msgHit: '',
            msgHitAudio: '',
            msgError: '',
            msgErrorAudio: '',
        });

        if (type === 0) {
            // 0@level#solution#question#opt1#opt2[#opt3][#opt4]
            if (parts.length < 1 + 1 + $exeDevice.MIN_OPTIONS) return null;
            const solutionToken = parts[0];
            const question = parts[1];
            const texts = parts.slice(2, 2 + $exeDevice.MAX_OPTIONS).filter(t => t.length > 0);
            if (question.length === 0) return null;
            if (texts.length < $exeDevice.MIN_OPTIONS) return null;

            const letters = solutionToken.toUpperCase();
            const solutionMulti = [];
            if (letters.length > 0) {
                if (!/^[A-F]+$/.test(letters)) return null;
                if (letters.length > $exeDevice.MAX_OPTIONS) return null;
                const seen = new Set();
                for (const ch of letters) {
                    const idx = ch.charCodeAt(0) - 'A'.charCodeAt(0);
                    if (seen.has(idx)) return null;
                    if (idx >= texts.length) return null;
                    seen.add(idx);
                    solutionMulti.push(idx);
                }
            }

            const q = baseQuestion();
            q.typeSelect = 0;
            q.question = question;
            q.numberOptions = texts.length;
            for (let k = 0; k < texts.length; k++) {
                q.options[k].text = texts[k];
            }
            q.solutionMulti = solutionMulti;
            return q;
        }

        if (type === 1) {
            // 1@level#question#item1#item2#item3[#item4][#item5][#item6]
            if (parts.length < 1 + 3) return null;
            const question = parts[0];
            const items = parts.slice(1, 1 + 6).filter(t => t.length > 0);
            if (question.length === 0) return null;
            if (items.length < 3 || items.length > 6) return null;
            // Reject if there are extra non-empty parts beyond the 6-item cap.
            const extra = parts.slice(1 + 6).some(t => t.length > 0);
            if (extra) return null;

            const q = baseQuestion();
            q.typeSelect = 1;
            q.question = question;
            // Order iDevice supports up to MAX_OPTIONS (4) items; truncate if needed.
            const cap = Math.min(items.length, $exeDevice.MAX_OPTIONS);
            q.numberOptions = cap;
            q.options = [];
            for (let k = 0; k < $exeDevice.MAX_OPTIONS; k++) {
                q.options.push({ text: items[k] || '', audio: '' });
            }
            // solutionOrder uses 1-based indices in saved data (see normalizeQuestion).
            q.solutionOrder = [];
            for (let k = 0; k < cap; k++) q.solutionOrder.push(k + 1);
            return q;
        }

        // type === 2: word/definition
        // 2@level#word#definition
        //
        // Legacy data model (kept for compatibility with the export side):
        //   q.question     -> the WORD the learner has to type
        //   q.solutionWord -> the DEFINITION shown to the learner as a prompt
        // The HTML form binds the "Word:" input to q.question and the
        // "Definition:" input to q.solutionWord, so we must respect that
        // mapping here, otherwise the imported question shows up with the
        // word and the definition swapped in the editor.
        if (parts.length < 2) return null;
        const word = parts[0];
        const definition = parts[1];
        if (word.length === 0 || definition.length === 0) return null;

        const q = baseQuestion();
        q.typeSelect = 2;
        q.question = word;
        q.solutionWord = definition;
        return q;
    },

    insertAIContent: content => {
        const lines = Array.isArray(content) ? content : [];
        const parsed = [];

        for (let i = 0; i < lines.length; i++) {
            const q = $exeDevice.parseAIQuestionLine(lines[i]);
            if (q) parsed.push(q);
        }

        if (parsed.length === 0) {
            eXe.app.alert(_('Sorry, wrong file format'));
            return;
        }

        // Persist any in-progress edits from the form before mutating the
        // questions array, so the user does not lose work when the AI tab
        // is invoked while editing a question.
        if (
            typeof $exeDevice.readQuestionFromDom === 'function'
            && Number.isInteger($exeDevice.active)
            && $exeDevice.active >= 0
            && $exeDevice.questionsGame
            && $exeDevice.questionsGame[$exeDevice.active]
            && $('#adaptativeQuizEQuestion').length
        ) {
            try { $exeDevice.readQuestionFromDom(); } catch (_e) { /* ignore */ }
        }

        const existing = Array.isArray($exeDevice.questionsGame) ? $exeDevice.questionsGame : [];
        // Drop placeholder questions that the user has not filled in yet so a
        // brand-new iDevice does not keep the auto-created blank question
        // ahead of the imported ones.
        const meaningful = existing.filter(q => !$exeDevice.isEmptyQuestion(q));
        const merged = meaningful.concat(parsed);
        const firstNewIdx = meaningful.length;

        $exeDevice.questionsGame = merged;
        $exeDevice.active = firstNewIdx;
        $exeDevice.showQuestion(firstNewIdx);
    },

    /**
     * Returns true when a question carries no user content: no statement,
     * no solution word, and every option text is empty. Used by
     * `insertAIContent` to decide whether to append imported questions
     * after the current ones or to replace the empty placeholders.
     */
    isEmptyQuestion: q => {
        if (!q || typeof q !== 'object') return true;
        const question = typeof q.question === 'string' ? q.question.trim() : '';
        const solutionWord = typeof q.solutionWord === 'string' ? q.solutionWord.trim() : '';
        const options = Array.isArray(q.options) ? q.options : [];
        const anyOption = options.some(o => o && typeof o.text === 'string' && o.text.trim().length > 0);
        return question.length === 0 && solutionWord.length === 0 && !anyOption;
    },

    /**
     * Convert a single normalized question into the AI-format line
     * accepted by `parseAIQuestionLine` / `getAllowedFormats(10)`. Returns
     * an empty string when the question lacks the minimal data required
     * by the format (so callers can drop placeholder questions silently).
     *
     * Difficulty is stored 1..N internally; AI format uses 0..N-1, so we
     * subtract 1 when building the level token. Lines must never contain
     * a literal `#` inside any field; we replace stray `#` with a space.
     */
    formatQuestionAsAILine: function (q) {
        if (!q || typeof q !== 'object') return '';
        const sanitize = s => String(s == null ? '' : s).replace(/#/g, ' ').trim();
        const maxLevel = this.LEVELS[this.LEVELS.length - 1];
        const difficulty = Number.isInteger(q.difficulty)
            ? Math.min(Math.max(q.difficulty, 1), maxLevel)
            : 1;
        const level = difficulty - 1;
        const tSelRaw = Number.isInteger(q.typeSelect) ? q.typeSelect : 0;
        const typeSelect = tSelRaw === 1 || tSelRaw === 2 ? tSelRaw : 0;

        if (typeSelect === 2) {
            const word = sanitize(q.question);
            const definition = sanitize(q.solutionWord);
            if (!word || !definition) return '';
            return `2@${level}#${word}#${definition}`;
        }

        const options = Array.isArray(q.options) ? q.options : [];
        const numberOptions = Math.max(
            this.MIN_OPTIONS,
            Math.min(parseInt(q.numberOptions, 10) || options.length, this.MAX_OPTIONS),
        );
        const texts = [];
        for (let i = 0; i < numberOptions; i++) {
            const t = sanitize(options[i] && options[i].text);
            if (!t) return '';
            texts.push(t);
        }
        const question = sanitize(q.question);
        if (!question) return '';

        if (typeSelect === 1) {
            // Sort: option order in the saved data IS the correct order
            // (solutionOrder is always [1,2,...,n] after normalization).
            // The AI format only supports 3..6 items; the editor caps at 4.
            if (texts.length < 3) return '';
            return `1@${level}#${question}#${texts.join('#')}`;
        }

        // typeSelect === 0: multi-choice. Convert solutionMulti indices to
        // sorted unique uppercase letters A..D.
        const solutionMulti = Array.isArray(q.solutionMulti) ? q.solutionMulti : [];
        const seen = new Set();
        const letters = [];
        for (const idx of solutionMulti) {
            const n = parseInt(idx, 10);
            if (!Number.isInteger(n) || n < 0 || n >= texts.length) continue;
            if (seen.has(n)) continue;
            seen.add(n);
            letters.push(String.fromCharCode('A'.charCodeAt(0) + n));
        }
        letters.sort();
        const solution = letters.join('');
        return `0@${level}#${solution}#${question}#${texts.join('#')}`;
    },

    /**
     * Build the txt content for the export: one valid AI-format line per
     * question. Empty/placeholder questions are silently skipped.
     */
    buildExportLines: function () {
        const out = [];
        const questions = Array.isArray(this.questionsGame) ? this.questionsGame : [];
        for (const q of questions) {
            const line = this.formatQuestionAsAILine(q);
            if (line) out.push(line);
        }
        return out;
    },

    /**
     * Persist any in-progress edits, then download the questions as a txt
     * file with one AI-format line per question. Mirrors az-quiz-game's
     * exportQuestions but produces the adaptative-quiz line shapes.
     */
    exportQuestions: function () {
        if (
            typeof this.readQuestionFromDom === 'function'
            && Number.isInteger(this.active)
            && this.active >= 0
            && Array.isArray(this.questionsGame)
            && this.questionsGame[this.active]
            && $('#adaptativeQuizEQuestion').length
        ) {
            try { this.readQuestionFromDom(); } catch (_e) { /* ignore */ }
        }
        const lines = this.buildExportLines();
        if (lines.length === 0) {
            eXe.app.alert(this.msgs.msgNoQuestions || _('You must add at least one question.'));
            return false;
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        return $exeDevicesEdition.iDevice.gamification.share.downloadBlob(
            blob,
            `${_('Adaptative Quiz')}.txt`,
            'adaptativeQuizIdeviceForm',
        );
    },

    /**
     * Normalize a single imported line so we can also accept the simpler
     * formats produced by other iDevices (for example the `word#definition`
     * lines exported by az-quiz-game, or bare multi-choice lines that omit
     * the leading `type@level#` prefix). Lines that already start with the
     * canonical `\d+@\d+#` prefix are returned unchanged.
     *
     * Supported shorthand inputs (default level is 1):
     *   - `word#definition`                         -> `2@1#word#definition`
     *   - `LETTERS#question#opt1#opt2[#opt3...]`    -> `0@1#LETTERS#question#opt1#opt2[...]`
     *     where `LETTERS` is any combination of A-F (or empty), and there
     *     are at least two options after the question.
     *
     * Returns the (possibly rewritten) line, or `null` if no transformation
     * applies and the original line is left for `parseAIQuestionLine` to
     * accept or reject.
     */
    normalizeImportLine: rawLine => {
        const line = String(rawLine || '').trim();
        if (line.length === 0) return line;
        if (/^\d+@\d+#/.test(line)) return line;

        const parts = line.split('#').map(p => p.trim());
        if (parts.length === 2 && parts[0].length > 0 && parts[1].length > 0) {
            // word/definition (e.g. az-quiz-game export).
            return `2@1#${parts[0]}#${parts[1]}`;
        }
        if (parts.length >= 4) {
            const letters = parts[0].toUpperCase();
            const question = parts[1];
            const options = parts.slice(2).filter(p => p.length > 0);
            if (/^[A-F]*$/.test(letters) && question.length > 0 && options.length >= 2) {
                return `0@1#${letters}#${question}#${options.join('#')}`;
            }
        }
        return line;
    },

    /**
     * Handle a file picked by the user. Only plain-text imports are
     * accepted. Each non-empty line is normalized via
     * `normalizeImportLine` (which lets us also ingest the shorthand
     * formats produced by other iDevices) and then fed to
     * `parseAIQuestionLine` through `insertAIContent`, which appends
     * valid questions to the existing list and reports a single error
     * otherwise.
     */
    importGame: function (content, filetype) {
        if (typeof content !== 'string' || content.includes('\u0000')) {
            eXe.app.alert(_('Sorry, wrong file format'));
            return;
        }
        if (filetype && !filetype.match('text/plain')) {
            eXe.app.alert(_('Please select a text file (.txt)'));
            return;
        }
        const lines = content
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .map(l => $exeDevice.normalizeImportLine(l));
        if (lines.length === 0) {
            eXe.app.alert(_('Sorry, wrong file format'));
            return;
        }
        this.insertAIContent(lines);
    },

    addEvents: function () {
        $exeDevicesEdition.iDevice.gamification.progressBar.addEvents();

        $('#adaptativeQuizECustomMessages').on('change', function () {
            const showSolution = $('#adaptativeQuizShowSolution').is(':checked');
            if (!showSolution) $(this).prop('checked', false);
            $exeDevice.showSelectOrder(showSolution && $(this).is(':checked'));
        });

        $('input[name="adqtype"]').on('change', () => {
            this.readQuestionFromDom();
            const type = parseInt($('input[name="adqtype"]:checked').val()) || 0;
            if (type === 1) {
                $('#adaptativeQuizInputImage').removeClass('d-none').addClass('d-flex');
                $('#adaptativeQuizEAuthorAlt').removeClass('d-none').addClass('d-flex');
            } else {
                $('#adaptativeQuizInputImage').removeClass('d-flex').addClass('d-none');
                $('#adaptativeQuizEAuthorAlt').removeClass('d-flex').addClass('d-none');
                $('#adaptativeQuizEURLImage').val('');
                $('#adaptativeQuizEAuthor').val('');
                $('#adaptativeQuizEAlt').val('');
                this.updateImagePreview('');
            }
        });

        $('input[name="adqtypeselect"]').on('change', () => {
            this.readQuestionFromDom();
            const tSel = parseInt($('input[name="adqtypeselect"]:checked').val(), 10);
            this.showQuestionType(Number.isInteger(tSel) ? tSel : 3);
        });

        $('input[name="adqnumber"]').on('change', () => {
            const n = parseInt($('input[name="adqnumber"]:checked').val()) || 4;
            this.showOptions(n);
            this.readQuestionFromDom();
        });

        $('#adaptativeQuizDifficulty').on('change', () => this.readQuestionFromDom());

        $('input[name="adqnumlevels"]').on('change', () => {
            const n = parseInt($('input[name="adqnumlevels"]:checked').val(), 10);
            this.applyNumLevels(n);
            this.readQuestionFromDom();
            this.showQuestion(this.active);
        });

        $('#adaptativeQuizEURLImage').on('change input', () => {
            this.updateImagePreview($('#adaptativeQuizEURLImage').val());
        });

        $('#adaptativeQuizEReloadImage').on('click', e => {
            e.preventDefault();
            this.reloadImagePreview();
        });

        $('#adaptativeQuizNumRound').on('focusout', () => {
            const el = document.getElementById('adaptativeQuizNumRound');
            if (!el) return;
            el.value = this.normalizeQuestionsPerRound(el.value);
        });

        $('#adaptativeQuizETime').on('focusout', () => {
            const el = document.getElementById('adaptativeQuizETime');
            if (!el) return;
            el.value = Math.max(0, Math.min(59, parseInt(el.value, 10) || 0));
        });

        $('#adaptativeQuizShowSolution').on('change', function () {
            $exeDevice.updateSolutionFeedbackControls($(this).is(':checked'));
        });

        $('#adaptativeQuizTimeShowSolution').on('focusout', () => {
            const el = document.getElementById('adaptativeQuizTimeShowSolution');
            if (!el) return;
            const v = parseInt(el.value, 10);
            el.value = isNaN(v) ? 3 : Math.max(1, Math.min(9, v));
        });

        $('#adaptativeQuizEAdd').on('click', e => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });
        $('#adaptativeQuizEDelete').on('click', e => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });
        $('#adaptativeQuizECopy').on('click', e => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });
        $('#adaptativeQuizECut').on('click', e => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });
        $('#adaptativeQuizEPaste').on('click', e => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });
        $('#adaptativeQuizEFirst').on('click', e => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });
        $('#adaptativeQuizEPrevious').on('click', e => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });
        $('#adaptativeQuizENext').on('click', e => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });
        $('#adaptativeQuizELast').on('click', e => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });
        $('#adaptativeQuizENumberQuestion').on('change', () => $exeDevice.goToQuestion());

        // Level-filter and difficulty dropdowns: refresh their options when
        // level names change and apply the new filter when the value is
        // changed. The difficulty select shows the user-defined level names
        // (e.g. Easy/Medium/Hard) rather than bare numbers.
        $exeDevice.populateDifficultyOptions();
        $exeDevice.populateLevelFilter();
        $('#adaptativeQuizLevelName1, #adaptativeQuizLevelName2, #adaptativeQuizLevelName3, #adaptativeQuizLevelName4, #adaptativeQuizLevelName5').on(
            'change',
            () => {
                $exeDevice.populateDifficultyOptions();
                $exeDevice.populateLevelFilter();
            },
        );
        $('#adaptativeQuizELevelFilter').on('change', function () {
            $exeDevice.applyLevelFilter($(this).val());
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(10, $exeDevice.insertAIContent, () => ({
            numLevels: $exeDevice.numLevels,
        }));

        // Import / Export tab wiring. Only plain-text (.txt) is supported:
        // the file is parsed as one AI-format line per question. Mirrors
        // the pattern used by az-quiz-game.
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            $('#eXeGameExportImport .exe-field-instructions').eq(0).text(_('Supported formats') + ': txt');
            $('#eXeGameExportImport').show();
            $('#eXeGameImportGame').attr('accept', '.txt');
            $('#eXeGameImportGame').on('change', function (e) {
                const file = e.target.files && e.target.files[0];
                if (!file) {
                    eXe.app.alert(_('Please select a text file (.txt)'));
                    return;
                }
                if (!file.type || !file.type.match('text/plain')) {
                    eXe.app.alert(_('Please select a text file (.txt)'));
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (ev) {
                    $exeDevice.importGame(ev.target.result, file.type);
                };
                reader.readAsText(file);
            });
            $('#eXeGameExportQuestions').on('click', () => {
                $exeDevice.exportQuestions();
            });
        } else {
            $('#eXeGameExportImport').hide();
        }

        // Audio toggle: reveal/hide the .ADQ-EAudioField linked to each text
        // input. Uses delegated binding on the form root so it survives
        // re-renders of the answer rows.
        $('#adaptativeQuizIdeviceForm').on('click', '.ADQ-EAudioToggle', function (e) {
            e.preventDefault();
            const slot = this.getAttribute('data-audio-toggle');
            if (!slot) return;
            const $field = $('#adaptativeQuizIdeviceForm .ADQ-EAudioField[data-audio-slot="' + slot + '"]');
            if (!$field.length) return;
            const isHidden = $field.css('display') === 'none';
            $field.css('display', isHidden ? '' : 'none');
            this.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
            this.classList.toggle('ADQ-EAudioToggle--active', isHidden);
        });

        // Audio play button: mirrors quick-questions' `#quextEPlayAudio`.
        // Plays the file referenced by the sibling .ADQ-EAudioInput; if the
        // same file is already sounding, helpers.playSound toggles pause.
        $('#adaptativeQuizIdeviceForm').on('click', '.ADQ-EAudioPlay', function (e) {
            e.preventDefault();
            const slot = this.getAttribute('data-audio-play');
            if (!slot) return;
            const $input = $('#adaptativeQuizIdeviceForm .ADQ-EAudioInput[data-audio-slot="' + slot + '"]');
            const selectedFile = ($input.val() || '').trim();
            if (selectedFile.length > 4) {
                $exeDevicesEdition.iDevice.gamification.helpers.playSound(selectedFile);
            }
        });
    },

    getIdeviceID: () =>
        $('#adaptativeQuizIdeviceForm').closest(`div.idevice_node.${$exeDevice.classIdevice}`).attr('id') || '',
};
