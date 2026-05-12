/* eslint-disable no-undef */
/**
 * Adaptative Quiz iDevice (export/runtime code)
 *
 * Multiple-choice quiz with a single correct answer per question and
 * per-question difficulty level (1 = easy, 2 = medium, 3 = hard).
 *
 * Adaptive rules (micro-adaptativity):
 *  - Level UP after 2 consecutive correct answers (counters reset).
 *  - Level DOWN after 2 consecutive wrong answers (counters reset).
 *  - If the active level has no pending questions, fall back to a lower
 *    level first, then to a higher level. If neither is available, end.
 *
 * Reporting:
 *  - Tracks the maximum level reached during the session.
 *  - Final report with hits/errors, final level, max level, score % and a
 *    pedagogical interpretation (high / medium / reinforcement).
 *
 * NOTE: Global name MUST be lowercase ($adaptativequiz) because the app
 * looks up iDevice export objects via `'$' + id.split('-').join('')`,
 * which strips hyphens but does NOT apply camelCase. See
 * `public/app/workarea/idevices/idevice.js#getIdeviceObjectKey`.
 */
var $adaptativequiz = {
    ideviceClass: 'adaptative-quiz-IDevice',
    options: {},
    previousScores: {},
    userName: '',
    isInExe: false,
    LEVELS_BY_COUNT: { 3: [1, 2, 3], 4: [1, 2, 3, 4], 5: [1, 2, 3, 4, 5] },
    DEFAULT_NUM_LEVELS: 3,
    CONSEC_THRESHOLD: 2,
    getLevels: function (numLevels) {
        return this.LEVELS_BY_COUNT[numLevels] || this.LEVELS_BY_COUNT[this.DEFAULT_NUM_LEVELS];
    },
    msgs: {
        msgReady: 'Ready?',
        msgStartGame: 'Click here to play',
        msgCheck: 'Check',
        msgSelectOption: 'Click on an option to choose your answer.',
        msgNext: 'Next question',
        msgPlayAgain: 'Play Again',
        msgHits: 'Hits',
        msgErrors: 'Errors',
        msgScore: 'Score',
        msgLevel: 'Level',
        msgMaxLevel: 'Highest level reached',
        msgAnswered: 'Answered',
        msgGameOver: 'Game Over!',
        msgSuccesses: 'Right! | Excellent! | Great! | Very good! | Perfect!',
        msgFailures: 'It was not that! | Incorrect! | Not correct! | Sorry! | Error!',
        msgQuestion: 'Question',
        msgDifficulty: 'Difficulty',
        msgLevelEasy: 'Easy',
        msgLevelMedium: 'Medium',
        msgLevelHard: 'Hard',
        msgLevelExpert: 'Expert',
        msgLevelMaster: 'Master',
        msgLevelUp: 'Level up!',
        msgLevelDown: 'Level down',
        msgReportTitle: 'Final report',
        msgReportHigh: 'Excellent. You dominate the highest-level contents.',
        msgReportMedium: 'Good job. You have achieved the intermediate level.',
        msgReportLow: 'You need a bit more practice. Review the basic contents.',
        msgEndGameScore: 'Please start the game before saving your score.',
        msgScoreScorm: "The score can't be saved because this page is not part of a SCORM package.",
        msgOnlySaveScore: 'You can only save the score once!',
        msgOnlySave: 'You can only save once',
        msgInformation: 'Information',
        msgYouScore: 'Your score',
        msgOnlySaveAuto: 'Your score will be saved after each question. You can only play once.',
        msgSaveAuto: 'Your score will be automatically saved after each question.',
        msgSeveralScore: 'You can save the score as many times as you want',
        msgYouLastScore: 'The last score saved is',
        msgActityComply: 'You have already done this activity.',
        msgPlaySeveralTimes: 'You can do this activity as many times as you want',
        msgUncompletedActivity: 'Incomplete activity',
        msgSuccessfulActivity: 'Activity: Passed. Score: %s',
        msgUnsuccessfulActivity: 'Activity: Not passed. Score: %s',
        msgTypeGame: 'Adaptative Quiz',
        msgCorrect: 'Correct',
        msgIncorrect: 'Incorrect',
        msgCodeAccess: 'Access code',
        msgReply: 'Submit',
        msgPlayAudio: 'Play audio',
        msgPauseAudio: 'Pause audio',
        msgImageAlt: 'Illustration',
        msgTime: 'Time',
        msgStart: 'Start',
        msgTimeUp: "Time's up!",
    },

    renderView: function (data, accesibility, template, ideviceId) {
        if (typeof template !== 'string') return '';

        const ldata = this.updateConfig(data, ideviceId);
        this.options[ldata.id] = ldata;

        const instructions = ldata.eXeFormInstructions
            ? `<div class="adaptative-quiz-instructions">${ldata.eXeFormInstructions}</div>`
            : '';
        const textAfter = ldata.eXeIdeviceTextAfter
            ? `<div class="adaptative-quiz-extra-content">${ldata.eXeIdeviceTextAfter}</div>`
            : '';

        const htmlContent = `
            <div class="game-evaluation-ids js-hidden" data-id="${ldata.id}" data-evaluationb="${ldata.evaluation}" data-evaluationid="${ldata.evaluationID}"></div>
            <div id="adaptativeQuizRoot-${ldata.id}" class="${this.ideviceClass}" data-id="${ldata.id}">
                ${instructions}
                ${this.createInterface(ldata.id)}
                ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(ldata, this.isInExe)}
                ${textAfter}
            </div>
        `;

        return template.replace('{content}', htmlContent);
    },

    renderBehaviour: function (data, accesibility, ideviceId) {
        const ldata = this.updateConfig(data, ideviceId);
        this.options[ldata.id] = { ...this.options[ldata.id], ...ldata };

        if (typeof eXe !== 'undefined' && eXe.app && typeof eXe.app.isInExe === 'function') {
            this.isInExe = eXe.app.isInExe();
        }

        this.addEvents(ldata.id);

        return true;
    },

    init: (data, accesibility, ideviceId) => true,

    mergeFields: (obj1, obj2) => {
        const base = obj1 || {};
        Object.keys(obj2 || {}).forEach(key => {
            if (!(key in base)) base[key] = obj2[key];
        });
        return base;
    },

    /**
     * Resolve a media URL through the iDevice gamification helper.
     */
    resolveMediaUrl: url => {
        if (!url) return '';
        if (
            $exeDevices &&
            $exeDevices.iDevice &&
            $exeDevices.iDevice.gamification &&
            $exeDevices.iDevice.gamification.media &&
            typeof $exeDevices.iDevice.gamification.media.extractURLGD === 'function'
        ) {
            return $exeDevices.iDevice.gamification.media.extractURLGD(url);
        }
        return url;
    },

    normalizeQuestions: function (raw, numLevels) {
        const levels = this.getLevels(numLevels);
        const maxLevel = levels[levels.length - 1];
        const legacyMap = { 0: 1, 1: 2, 2: 3 };
        const questions = Array.isArray(raw) ? raw : [];
        return questions.map(q => {
            const source = q || {};
            const rawOptions = Array.isArray(source.options) ? source.options : [];
            const numberOptions = Math.max(2, Math.min(parseInt(source.numberOptions) || rawOptions.length || 4, 6));
            const options = [];
            for (let i = 0; i < numberOptions; i++) {
                const o = rawOptions[i];
                if (typeof o === 'string') {
                    options.push({ text: o, audio: '' });
                } else if (o) {
                    options.push({
                        text: o.text || '',
                        audio: this.resolveMediaUrl(o.audio || ''),
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
            solution = Math.max(0, Math.min(solution, options.length - 1));

            let difficulty = source.difficulty;
            if (Number.isInteger(difficulty) && levels.indexOf(difficulty) === -1 && legacyMap[difficulty]) {
                difficulty = legacyMap[difficulty];
            }
            if (levels.indexOf(difficulty) === -1) {
                difficulty = Math.min(Math.max(parseInt(difficulty) || 2, 1), maxLevel);
                if (levels.indexOf(difficulty) === -1) difficulty = 2;
            }

            const legacyFeedback = source.feedback || {};
            const questionText = source.question || source.text || '';
            const type = Number.isInteger(source.type) ? source.type : source.image ? 1 : 0;
            const url = type === 1 ? source.url || source.image || '' : '';
            // typeSelect: 0=select (multi), 1=sort, 2=word.
            // Legacy types Test (3) and True/False (4) — and any absent or
            // unknown value — map to Select (multi) with the legacy single
            // `solution` index promoted to a one-element solutionMulti.
            let typeSelect = Number.isInteger(source.typeSelect) ? source.typeSelect : 0;
            if (typeSelect !== 0 && typeSelect !== 1 && typeSelect !== 2) {
                typeSelect = 0;
            }

            // Per-type solution normalization. The Select (multi) type pulls
            // from `solutionMulti`; falls back to `[solution]` for migrated
            // entries. Sort uses `solutionOrder`. Word uses `solutionWord`.
            // True/False keeps the single `solution` index.
            let solutionMulti = Array.isArray(source.solutionMulti)
                ? source.solutionMulti
                      .map(n => parseInt(n, 10))
                      .filter(n => Number.isInteger(n) && n >= 0 && n < options.length)
                : [];
            if (typeSelect === 0 && solutionMulti.length === 0 && Number.isInteger(solution)) {
                if (solution >= 0 && solution < options.length) solutionMulti = [solution];
            }
            const solutionOrder = Array.isArray(source.solutionOrder)
                ? source.solutionOrder.slice(0, options.length).map(n => parseInt(n, 10) || 0)
                : [];
            const solutionWord = String(source.solutionWord || '');
            const solutionWordAudio = String(source.solutionWordAudio || '');
            const percentageShowRaw = parseInt(source.percentageShow, 10);
            const percentageShow = Number.isInteger(percentageShowRaw)
                ? Math.max(0, Math.min(100, percentageShowRaw))
                : 35;

            return {
                type: type === 1 ? 1 : 0,
                typeSelect: typeSelect,
                url: this.resolveMediaUrl(url),
                audio: this.resolveMediaUrl(source.audio || ''),
                question: questionText,
                numberOptions: options.length,
                options: options,
                solution: solution,
                solutionMulti: solutionMulti,
                solutionOrder: solutionOrder,
                solutionWord: solutionWord,
                solutionWordAudio: this.resolveMediaUrl(solutionWordAudio),
                percentageShow: percentageShow,
                difficulty: difficulty,
                msgHit: source.msgHit || legacyFeedback.correct || '',
                msgHitAudio: this.resolveMediaUrl(source.msgHitAudio || ''),
                msgError: source.msgError || legacyFeedback.incorrect || '',
                msgErrorAudio: this.resolveMediaUrl(source.msgErrorAudio || ''),
            };
        });
    },

    updateConfig: function (odata, ideviceId) {
        const data = JSON.parse(JSON.stringify(odata || {}));
        data.isInExe = eXe.app.isInExe() ?? false;
        data.idevicePath = data.isInExe
            ? eXe.app.getIdeviceInstalledExportPath('adaptative-quiz')
            : $('.idevice_node.adaptative-quiz').eq(0).attr('data-idevice-path');
        data.id = ideviceId || data.ideviceId || data.id || 'adaptative-quiz';
        data.ideviceId = data.id;
        data.msgs = this.mergeFields(data.msgs, this.msgs);

        const numLevelsRaw = parseInt(data.numLevels, 10);
        data.numLevels = numLevelsRaw === 5 ? 5 : numLevelsRaw === 4 ? 4 : this.DEFAULT_NUM_LEVELS;
        const levels = this.getLevels(data.numLevels);
        const maxLevel = levels[levels.length - 1];

        const rawQuestions = Array.isArray(data.questionsGame) ? data.questionsGame : data.questions;
        data.questions = this.normalizeQuestions(rawQuestions, data.numLevels);
        data.questionsGame = data.questions;
        data.shuffle = data.shuffle !== false;
        data.immediateFeedback = data.immediateFeedback !== false;
        // Word-type answer-matching options (default = lenient: ignore
        // case and ignore accents, matching pre-feature behaviour).
        data.caseSensitive = data.caseSensitive === true;
        data.accentSensitive = data.accentSensitive === true;
        data.showSolution = data.showSolution !== false;
        data.timeShowSolution = Math.max(1, Math.min(9, parseInt(data.timeShowSolution, 10) || 3));
        data.numRound = parseInt(data.numRound) || Math.max(1, data.questions.length);
        if (data.numRound > data.questions.length) data.numRound = data.questions.length;
        data.numOperations = data.numRound;
        data.minQuestionsShown = parseInt(data.minQuestionsShown) || 5;
        data.time = Math.max(0, Math.min(59, parseInt(data.time, 10) || 0));
        data.initialLevel = levels.indexOf(parseInt(data.initialLevel)) !== -1 ? parseInt(data.initialLevel) : 2;
        if (!Array.isArray(data.levelNames) || data.levelNames.length < levels.length) {
            data.levelNames = [
                data.msgs.msgLevelEasy || 'Easy',
                data.msgs.msgLevelMedium || 'Medium',
                data.msgs.msgLevelHard || 'Hard',
            ];
            if (data.numLevels >= 4) data.levelNames.push(data.msgs.msgLevelExpert || 'Expert');
            if (data.numLevels === 5) data.levelNames.push(data.msgs.msgLevelMaster || 'Master');
        }
        data.maxLevel = maxLevel;

        data.isScorm = parseInt(data.isScorm) || 0;
        data.textButtonScorm = data.textButtonScorm || data.msgs.msgScore || 'Save score';
        data.repeatActivity = data.repeatActivity !== false;
        data.weighted = data.weighted ?? 100;
        data.evaluation = data.evaluation ?? false;
        data.evaluationID = data.evaluationID || '';
        data.eXeFormInstructions = data.eXeFormInstructions || data.instructions || '';
        data.eXeIdeviceTextAfter = data.eXeIdeviceTextAfter || data.textAfter || '';

        data.itinerary = data.itinerary || {
            showClue: false,
            clueGame: '',
            percentageClue: 0,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        };

        data.hits = 0;
        data.errors = 0;
        data.score = 0;
        data.scorerp = 0;
        data.gameOver = false;
        data.gameStarted = false;
        data.counter = data.time > 0 ? data.time * 60 : 0;
        data.clockInterval = null;
        data.currentLevel = data.initialLevel;
        data.maxLevelReached = data.initialLevel;
        data.consecutiveCorrect = 0;
        data.consecutiveWrong = 0;
        data.currentQuestionIndex = -1;
        data.answeredIndexes = [];
        data.roundCount = 0;
        data.optionOrder = [];
        data.main = 'adaptativeQuizMainContainer-' + data.id;
        data.idevice = this.ideviceClass;

        return data;
    },

    createInterface: function (id) {
        const opts = this.options[id];
        const msgs = opts.msgs || {};
        const iconPath = opts.idevicePath || '';
        const hasTime = opts.time > 0;
        const initialClock = hasTime ? this.formatTime(opts.time * 60) : '00:00';

        return `
            <div class="ADAPTATIVEQUIZ-MainContainer" id="adaptativeQuizMainContainer-${id}" style="display:none">
                <div class="ADAPTATIVEQUIZ-GameContainer" id="adaptativeQuizGameContainer-${id}">
                    <div class="ADAPTATIVEQUIZ-ScoreBoard" id="adaptativeQuizScoreBoard-${id}">
                        <span class="ADAPTATIVEQUIZ-ScoreLabel">${msgs.msgQuestion || 'Question'}: <strong id="adaptativeQuizRound-${id}">0 / 0</strong></span>
                        <span class="ADAPTATIVEQUIZ-ScoreLabel">${msgs.msgLevel || 'Level'}: <strong class="ADAPTATIVEQUIZ-LevelValue" id="adaptativeQuizLevel-${id}">—</strong></span>
                        <span class="ADAPTATIVEQUIZ-ScoreLabel">${msgs.msgHits || 'Hits'}: <strong id="adaptativeQuizHits-${id}">0</strong></span>
                        <span class="ADAPTATIVEQUIZ-ScoreLabel">${msgs.msgErrors || 'Errors'}: <strong id="adaptativeQuizErrors-${id}">0</strong></span>
                        <span class="ADAPTATIVEQUIZ-ScoreLabel">${msgs.msgScore || 'Score'}: <strong id="adaptativeQuizScore-${id}">0</strong></span>
                        <span class="ADAPTATIVEQUIZ-ScoreLabel ADAPTATIVEQUIZ-TimeBox" id="adaptativeQuizTimeBox-${id}" style="display:${hasTime ? 'inline-flex' : 'none'}">
                            <strong><span class="sr-av">${msgs.msgTime || 'Time'}:</span></strong>
                            <span id="adaptativeQuizTime-${id}" class="ADAPTATIVEQUIZ-Time">${initialClock}</span>
                        </span>
                    </div>
                    <div class="ADAPTATIVEQUIZ-StartGameDiv" id="adaptativeQuizStartGameDiv-${id}" style="display:none">
                        <p class="ADAPTATIVEQUIZ-Ready">${msgs.msgReady || 'Ready?'}</p>
                        <button class="ADAPTATIVEQUIZ-BtnStart" id="adaptativeQuizBtnStart-${id}">${msgs.msgStart || 'Start'}</button>
                    </div>
                    <div class="ADAPTATIVEQUIZ-QuestionContainer" id="adaptativeQuizQuestionContainer-${id}"></div>
                    <div class="ADAPTATIVEQUIZ-ButtonsContainer" id="adaptativeQuizButtonsContainer-${id}">
                        <button class="ADAPTATIVEQUIZ-BtnCheck" id="adaptativeQuizBtnCheck-${id}">${msgs.msgCheck || 'Check'}</button>
                        <button class="ADAPTATIVEQUIZ-BtnNewGame" id="adaptativeQuizBtnNewGame-${id}" style="display:none">${msgs.msgPlayAgain || 'Play Again'}</button>
                    </div>
                    <div class="ADAPTATIVEQUIZ-Report" id="adaptativeQuizReport-${id}" style="display:none" aria-live="polite"></div>
                    <div class="ADAPTATIVEQUIZ-Cubierta" id="adaptativeQuizCubierta-${id}" style="display:none">
                        <div class="ADAPTATIVEQUIZ-CodeAccessDiv" id="adaptativeQuizCodeAccessDiv-${id}" style="display:none">
                            <div class="ADAPTATIVEQUIZ-MessageCodeAccess" id="adaptativeQuizMessageCodeAccess-${id}"></div>
                            <div class="ADAPTATIVEQUIZ-DataCodeAccessE">
                                <label class="sr-av" for="adaptativeQuizCodeAccessInput-${id}">${msgs.msgCodeAccess || 'Access code'}:</label>
                                <input type="text" class="ADAPTATIVEQUIZ-CodeAccessInput form-control" id="adaptativeQuizCodeAccessInput-${id}" placeholder="${msgs.msgCodeAccess || 'Access code'}" />
                                <a href="#" id="adaptativeQuizCodeAccessButton-${id}" title="${msgs.msgReply || 'Submit'}">
                                    <strong class="sr-av">${msgs.msgReply || 'Submit'}</strong>
                                    <img src="${iconPath}exequextreply.svg" class="ADAPTATIVEQUIZ-IconSubmit" alt="" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    escapeHtml: str =>
        String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'),

    escapeAttr: str =>
        String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'),

    shuffleArray: arr => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    /**
     * Build the partial-letter hint shown above the word-type answer input.
     * Reveals `percentage`% of the (non-whitespace) letters of `word` at
     * random positions, masking the rest with `_`. Whitespace splits the
     * hint into separate `.ADAPTATIVEQUIZ-WordHintWord` rows so each word
     * stays together (same pattern as the Guess iDevice).
     */
    buildWordHint: function (word, percentage) {
        const text = String(word || '').trim();
        if (text.length === 0) return '';
        const pct = Math.max(0, Math.min(100, parseInt(percentage, 10) || 0));
        // Pick which non-whitespace positions to reveal.
        const letterPositions = [];
        for (let i = 0; i < text.length; i++) {
            if (!/\s/.test(text[i])) letterPositions.push(i);
        }
        const revealCount = Math.floor((letterPositions.length * pct) / 100);
        const reveal = new Set();
        const pool = letterPositions.slice();
        for (let i = 0; i < revealCount && pool.length > 0; i++) {
            const r = Math.floor(Math.random() * pool.length);
            reveal.add(pool.splice(r, 1)[0]);
        }
        // Group consecutive non-whitespace runs into "word" rows.
        const words = [];
        let current = null;
        for (let i = 0; i < text.length; i++) {
            if (/\s/.test(text[i])) {
                current = null;
            } else {
                if (!current) {
                    current = [];
                    words.push(current);
                }
                current.push({ ch: text[i], reveal: reveal.has(i) });
            }
        }
        return words
            .map(letters => {
                const cells = letters
                    .map(({ ch, reveal: r }) => {
                        const cls = r
                            ? 'ADAPTATIVEQUIZ-WordHintLetter ADAPTATIVEQUIZ-WordHintLetter--shown'
                            : 'ADAPTATIVEQUIZ-WordHintLetter ADAPTATIVEQUIZ-WordHintLetter--hidden';
                        const inner = r ? this.escapeHtml(ch) : '';
                        return `<span class="${cls}">${inner}</span>`;
                    })
                    .join('');
                return `<div class="ADAPTATIVEQUIZ-WordHintWord">${cells}</div>`;
            })
            .join('');
    },

    levelName: (opts, level) => {
        const names = opts.levelNames || [];
        return names[level - 1] || String(level);
    },

    /**
     * Update the scoreboard "Level" element with the current level name and
     * apply the per-level color modifier class so each level is visually
     * distinct (1: red, 2: blue, 3: green, 4: violet).
     */
    updateLevelDisplay: function (id, opts) {
        const $el = $('#adaptativeQuizLevel-' + id);
        if (!$el.length) return;
        $el.removeClass(
            'ADAPTATIVEQUIZ-LevelValue--1 ADAPTATIVEQUIZ-LevelValue--2 ADAPTATIVEQUIZ-LevelValue--3 ADAPTATIVEQUIZ-LevelValue--4',
        );
        const level = parseInt(opts.currentLevel, 10);
        if (level >= 1 && level <= 4) {
            $el.addClass('ADAPTATIVEQUIZ-LevelValue--' + level);
        }
        $el.text(this.levelName(opts, opts.currentLevel));
    },

    /**
     * Pick the next question index using the current level.
     * Fallback priority: active level → lower levels (descending) → higher
     * levels (ascending). Returns -1 when no questions remain.
     */
    pickNextQuestionIndex: opts => {
        const maxLevel = opts.maxLevel || 3;
        const poolByLevel = {};
        for (let lvl = 1; lvl <= maxLevel; lvl++) poolByLevel[lvl] = [];
        for (let i = 0; i < opts.questions.length; i++) {
            if (opts.answeredIndexes.indexOf(i) !== -1) continue;
            const lvl = opts.questions[i].difficulty;
            if (poolByLevel[lvl]) poolByLevel[lvl].push(i);
        }

        const order = [opts.currentLevel];
        for (let lvl = opts.currentLevel - 1; lvl >= 1; lvl--) order.push(lvl);
        for (let lvl = opts.currentLevel + 1; lvl <= maxLevel; lvl++) order.push(lvl);

        for (const lvl of order) {
            const pool = poolByLevel[lvl] || [];
            if (pool.length > 0) {
                opts.currentLevel = lvl;
                if (lvl > opts.maxLevelReached) opts.maxLevelReached = lvl;
                return pool[Math.floor(Math.random() * pool.length)];
            }
        }
        return -1;
    },

    renderMedia: function (opts, url, kind, altText, variant) {
        if (!url) return '';
        const msgs = opts.msgs || {};
        if (kind === 'audio') {
            // Audio is played/stopped by clicking the toggle button (black
            // circle with a white play triangle). See `bindMediaToggle`.
            const playLabel = this.escapeAttr(msgs.msgPlayAudio || 'Play audio');
            const variantCls = variant === 'stem' ? ' ADAPTATIVEQUIZ-AudioToggle--stem' : '';
            return `
                <button type="button" class="ADAPTATIVEQUIZ-AudioToggle${variantCls}" data-audio-url="${this.escapeAttr(url)}" aria-label="${playLabel}" title="${playLabel}">
                    <span class="ADAPTATIVEQUIZ-AudioToggleIcon" aria-hidden="true"></span>
                </button>
            `;
        }
        const alt = altText || msgs.msgImageAlt || 'Illustration';
        return `<div class="ADAPTATIVEQUIZ-Image"><img src="${this.escapeAttr(url)}" alt="${this.escapeAttr(alt)}" /></div>`;
    },

    /**
     * Set the inline status message shown between the question text and the
     * image. `kind` controls the colour: `info` = blue (default), `success`
     * = green, `error` = red. When `isHtml` is true the content is inserted
     * verbatim (caller is responsible for escaping).
     */
    setMessage: (id, content, kind, isHtml) => {
        const $msg = $('#adaptativeQuizMessages-' + id);
        if (!$msg.length) return;
        $msg.removeClass(
            'ADAPTATIVEQUIZ-Messages--info ADAPTATIVEQUIZ-Messages--success ADAPTATIVEQUIZ-Messages--error',
        );
        const safeKind = kind === 'success' || kind === 'error' ? kind : 'info';
        $msg.addClass('ADAPTATIVEQUIZ-Messages--' + safeKind);
        if (isHtml) $msg.html(content);
        else $msg.text(content);
        $msg.stop(true, true).show();
    },

    /**
     * Wire HTML5 drag-and-drop handlers on the sort list so the learner can
     * reorder items. Also supports keyboard reordering with ArrowUp/ArrowDown
     * (when the item is focused) for accessibility. The visible rank badge
     * is recomputed after every move.
     */
    bindSortDragDrop: id => {
        const $list = $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-SortList');
        if (!$list.length) return;
        const list = $list.get(0);
        const refreshRanks = () => {
            $list.children('.ADAPTATIVEQUIZ-SortItem').each(function (i) {
                $(this)
                    .find('.ADAPTATIVEQUIZ-SortRank')
                    .text(i + 1);
            });
        };
        let dragged = null;
        $list.on('dragstart', '.ADAPTATIVEQUIZ-SortItem', function (e) {
            if ($(this).hasClass('ADAPTATIVEQUIZ-SortItem--locked')) {
                e.preventDefault();
                return;
            }
            dragged = this;
            $(this).addClass('is-dragging').attr('aria-grabbed', 'true');
            const dt = e.originalEvent && e.originalEvent.dataTransfer;
            if (dt) {
                dt.effectAllowed = 'move';
                try {
                    dt.setData('text/plain', $(this).attr('data-orig-index') || '');
                } catch (_err) {
                    // Some browsers (e.g. certain test envs) reject setData; safe to ignore.
                }
            }
        });
        $list.on('dragend', '.ADAPTATIVEQUIZ-SortItem', function () {
            $(this).removeClass('is-dragging').attr('aria-grabbed', 'false');
            $list.children('.ADAPTATIVEQUIZ-SortItem').removeClass('is-drop-target');
            dragged = null;
            refreshRanks();
        });
        $list.on('dragover', '.ADAPTATIVEQUIZ-SortItem', function (e) {
            if (!dragged || dragged === this) return;
            e.preventDefault();
            if (e.originalEvent && e.originalEvent.dataTransfer) {
                e.originalEvent.dataTransfer.dropEffect = 'move';
            }
            $list.children('.ADAPTATIVEQUIZ-SortItem').removeClass('is-drop-target');
            $(this).addClass('is-drop-target');
        });
        $list.on('drop', '.ADAPTATIVEQUIZ-SortItem', function (e) {
            e.preventDefault();
            if (!dragged || dragged === this) return;
            const $target = $(this);
            const targetIdx = $target.index();
            const draggedIdx = $(dragged).index();
            if (draggedIdx < targetIdx) {
                $target.after(dragged);
            } else {
                $target.before(dragged);
            }
            $target.removeClass('is-drop-target');
            refreshRanks();
        });
        $list.on('keydown', '.ADAPTATIVEQUIZ-SortItem', function (e) {
            if ($(this).hasClass('ADAPTATIVEQUIZ-SortItem--locked')) return;
            const key = e.key;
            if (key !== 'ArrowUp' && key !== 'ArrowDown') return;
            e.preventDefault();
            const $self = $(this);
            if (key === 'ArrowUp') {
                const $prev = $self.prev('.ADAPTATIVEQUIZ-SortItem');
                if ($prev.length) $self.insertBefore($prev);
            } else {
                const $next = $self.next('.ADAPTATIVEQUIZ-SortItem');
                if ($next.length) $self.insertAfter($next);
            }
            refreshRanks();
            $self.trigger('focus');
        });
    },

    /**
     * Wire click handlers that play the stem / option audio on click and
     * stop playback from the red pause buttons overlaid on each audio
     * container. Inspired by flipcards' `cardClick` pattern (see
     * `public/files/perm/idevices/base/flipcards/export/flipcards.js`).
     */
    bindMediaToggle: function (id) {
        const $container = $('#adaptativeQuizQuestionContainer-' + id);

        const stopAll = () => {
            if (
                typeof $exeDevices !== 'undefined' &&
                $exeDevices.iDevice &&
                $exeDevices.iDevice.gamification &&
                $exeDevices.iDevice.gamification.media &&
                typeof $exeDevices.iDevice.gamification.media.stopSound === 'function'
            ) {
                $exeDevices.iDevice.gamification.media.stopSound();
            }
            $container.find('.ADAPTATIVEQUIZ-AudioToggle').removeClass('is-playing');
        };
        const play = async url => {
            if (!url) return;
            // Audio URLs entered via the file picker are stored as `asset://`
            // identifiers. The AssetResolver auto-resolves these for media
            // tags and anchor hrefs inserted in the DOM, but not for the
            // `data-audio-url` attribute we render on the toggle button, so
            // the raw `asset://` URL would reach `new Audio()` and the
            // browser would fail with `ERR_UNKNOWN_URL_SCHEME`. Resolve it
            // here (the resolver is a no-op for non-asset URLs and in real
            // exports where URLs are rewritten to relative paths).
            if (
                url.startsWith('asset://') &&
                typeof window !== 'undefined' &&
                window.eXeLearningAssetResolver &&
                typeof window.eXeLearningAssetResolver.resolve === 'function'
            ) {
                try {
                    const resolved = await window.eXeLearningAssetResolver.resolve(url);
                    if (resolved) url = resolved;
                } catch (_err) {
                    // Fall through with the original URL — playSound will log.
                }
            }
            if (
                typeof $exeDevices !== 'undefined' &&
                $exeDevices.iDevice &&
                $exeDevices.iDevice.gamification &&
                $exeDevices.iDevice.gamification.media &&
                typeof $exeDevices.iDevice.gamification.media.playSound === 'function'
            ) {
                $exeDevices.iDevice.gamification.media.playSound(url);
            }
        };

        // The toggle button is the single audio control: click plays if
        // stopped, stops if currently playing. Clicking inside an option
        // label must not select the radio.
        $container
            .off('click.adaptativeQuizAudio', '.ADAPTATIVEQUIZ-AudioToggle')
            .on('click.adaptativeQuizAudio', '.ADAPTATIVEQUIZ-AudioToggle', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const $btn = $(this);
                const wasPlaying = $btn.hasClass('is-playing');
                stopAll();
                if (!wasPlaying) {
                    play($btn.data('audio-url'));
                    $btn.addClass('is-playing');
                }
            });
        // Reference to self to avoid unused lint warning if future changes
        // need the helper; see updateConfig for the normalization flow.
        void this;
    },

    renderCurrentQuestion: function (id) {
        const opts = this.options[id];
        const idx = opts.currentQuestionIndex;
        const question = opts.questions[idx];
        if (!question) return;

        const tSel = Number.isInteger(question.typeSelect) ? question.typeSelect : 0;
        // Sort questions are always shuffled so the learner has something to
        // reorder; other types respect the opts.shuffle preference.
        const order =
            tSel === 1
                ? this.shuffleArray(question.options.map((_, i) => i))
                : opts.shuffle
                  ? this.shuffleArray(question.options.map((_, i) => i))
                  : question.options.map((_, i) => i);
        opts.optionOrder = order;

        const stemImage = question.type === 1 ? this.renderMedia(opts, question.url, 'image', question.question) : '';
        const stemAudio = this.renderMedia(opts, question.audio, 'audio', null, 'stem');

        let html = `<div class="ADAPTATIVEQUIZ-QuestionMedia">${stemImage}</div>`;
        if (tSel !== 2) {
            // Non-word types show the question stem above the answers.
            // Word-type renders its own (centered) layout below: hint cells,
            // definition, then input.
            html += `<div class="ADAPTATIVEQUIZ-QuestionRow">${stemAudio}<div class="ADAPTATIVEQUIZ-QuestionText">${this.escapeHtml(question.question)}</div></div>`;
        }

        if (tSel === 2) {
            // Word: render the partial-letter hint (guess-style cells), then
            // the definition (the prompt), then the answer input. All three
            // blocks are horizontally centered via the wrapper.
            //
            // Data mapping (matches the edition form labels):
            //   q.question     -> the WORD (what the learner types; hint cells)
            //   q.solutionWord -> the DEFINITION (the prompt shown above the input)
            const inputId = `adaptativeQuizWord-${id}`;
            const hintMarkup = this.buildWordHint(question.question || '', question.percentageShow);
            html += `<div class="ADAPTATIVEQUIZ-WordAnswer">`;
            if (hintMarkup) {
                html += `<div class="ADAPTATIVEQUIZ-WordHint" aria-hidden="true">${hintMarkup}</div>`;
            }
            html += `<div class="ADAPTATIVEQUIZ-WordDefinition">${stemAudio}<div class="ADAPTATIVEQUIZ-WordDefinitionText">${this.escapeHtml(question.solutionWord || '')}</div></div>`;
            html += `<label for="${inputId}" class="sr-av">${this.escapeHtml((opts.msgs || {}).msgAnswer || 'Answer')}</label><input type="text" class="ADAPTATIVEQUIZ-WordInput form-control" id="${inputId}" autocomplete="off" /></div>`;
        } else if (tSel === 1) {
            // Sort: drag-and-drop reorderable list. Each item shows a live
            // rank badge (1..n) reflecting its visual position.
            //
            // Use a 2-column grid when there is an option audio (so the
            // audio buttons don't push the rows too wide) or when the
            // question itself has a stem image (so the answers don't push
            // the image off-screen on narrow viewports).
            const hasOptionAudio = order.some(origIndex => (question.options[origIndex] || {}).audio);
            const layoutClass = hasOptionAudio || stemImage ? ' ADAPTATIVEQUIZ-OptionsGrid' : '';
            html += `<ol class="ADAPTATIVEQUIZ-Options ADAPTATIVEQUIZ-SortList${layoutClass}" data-type-select="1">`;
            for (let visualIndex = 0; visualIndex < order.length; visualIndex++) {
                const origIndex = order[visualIndex];
                const option = question.options[origIndex] || {};
                const optText = option.text || '';
                const hasAudio = !!option.audio;
                const audioCls = hasAudio ? ' ADAPTATIVEQUIZ-Option--has-audio' : '';
                const playLabel = this.escapeAttr((opts.msgs || {}).msgPlayAudio || 'Play audio');
                const audioBtn = hasAudio
                    ? `<button type="button" class="ADAPTATIVEQUIZ-AudioToggle ADAPTATIVEQUIZ-AudioToggle--option" data-audio-url="${this.escapeAttr(option.audio)}" aria-label="${playLabel}" title="${playLabel}"><span class="ADAPTATIVEQUIZ-AudioToggleIcon" aria-hidden="true"></span></button>`
                    : '';
                html += `
                    <li class="ADAPTATIVEQUIZ-Option ADAPTATIVEQUIZ-SortItem${audioCls}" draggable="true" data-orig-index="${origIndex}" tabindex="0" aria-grabbed="false">
                        <span class="ADAPTATIVEQUIZ-SortHandle" aria-hidden="true">☰</span>
                        <span class="ADAPTATIVEQUIZ-SortRank" aria-hidden="true" hidden></span>
                        <span class="ADAPTATIVEQUIZ-OptionBody">
                            <span class="ADAPTATIVEQUIZ-OptionText">${this.escapeHtml(optText)}</span>
                        </span>
                        ${audioBtn}
                    </li>
                `;
            }
            html += '</ol>';
        } else {
            // Same rationale as the sort branch above: switch to the
            // 2-column layout when option audio is present, or when the
            // question has a stem image.
            const hasOptionAudio = order.some(origIndex => (question.options[origIndex] || {}).audio);
            const layoutClass = hasOptionAudio || stemImage ? ' ADAPTATIVEQUIZ-OptionsGrid' : '';
            // Default to multi-select (checkbox) for tSel===0 and any unknown.
            html += `<div class="ADAPTATIVEQUIZ-Options${layoutClass}" role="group" data-type-select="${tSel}">`;
            const groupName = `adaptativeQuizAnswer-${id}`;

            for (let visualIndex = 0; visualIndex < order.length; visualIndex++) {
                const origIndex = order[visualIndex];
                const option = question.options[origIndex] || {};
                const optText = option.text || '';
                const hasAudio = !!option.audio;
                const inputId = `adaptativeQuizAnswer-${id}-${visualIndex}`;
                const audioCls = hasAudio ? ' ADAPTATIVEQUIZ-Option--has-audio' : '';
                const playLabel = this.escapeAttr((opts.msgs || {}).msgPlayAudio || 'Play audio');
                const audioBtn = hasAudio
                    ? `<button type="button" class="ADAPTATIVEQUIZ-AudioToggle ADAPTATIVEQUIZ-AudioToggle--option" data-audio-url="${this.escapeAttr(option.audio)}" aria-label="${playLabel}" title="${playLabel}"><span class="ADAPTATIVEQUIZ-AudioToggleIcon" aria-hidden="true"></span></button>`
                    : '';
                const inputHtml = `<input type="checkbox" name="${groupName}" value="${origIndex}" class="ADAPTATIVEQUIZ-OptionInput" id="${inputId}" />`;
                html += `
                    <label class="ADAPTATIVEQUIZ-Option${audioCls}" data-orig-index="${origIndex}" for="${inputId}">
                        ${inputHtml}
                        <span class="ADAPTATIVEQUIZ-OptionBody">
                            <span class="ADAPTATIVEQUIZ-OptionText">${this.escapeHtml(optText)}</span>
                        </span>
                        ${audioBtn}
                    </label>
                `;
            }
            html += '</div>';
        }
        html += `<div class="ADAPTATIVEQUIZ-Messages" id="adaptativeQuizMessages-${id}" aria-live="polite"></div>`;

        $('#adaptativeQuizQuestionContainer-' + id).html(html);
        this.bindMediaToggle(id);
        if (tSel === 1) this.bindSortDragDrop(id);
        // Auto-play the question stem audio if present. Clicking the toggle
        // reuses the existing play/stop logic and marks it as `is-playing`.
        if (question.audio) {
            const $stem = $('#adaptativeQuizQuestionContainer-' + id).find('.ADAPTATIVEQUIZ-AudioToggle--stem');
            if ($stem.length) $stem.trigger('click');
        }
        // For word-type questions, pressing Enter inside the answer input
        // submits the answer (same as clicking the Check button). Auto-focus
        // the input from the second question onwards so keyboard users can
        // keep typing without re-clicking; the first question is left
        // unfocused to avoid stealing focus on initial render.
        if (tSel === 2) {
            const $wordInput = $('#adaptativeQuizWord-' + id);
            if ($wordInput.length) {
                $wordInput.off('keydown.adaptativeQuiz').on('keydown.adaptativeQuiz', event => {
                    if (event.which === 13 || event.keyCode === 13) {
                        event.preventDefault();
                        $('#adaptativeQuizBtnCheck-' + id).trigger('click');
                        return false;
                    }
                    return true;
                });
                if (opts.roundCount > 0) $wordInput.trigger('focus');
            }
        }
        this.setMessage(id, '', 'info');
        $('#adaptativeQuizReport-' + id)
            .hide()
            .empty();
        $('#adaptativeQuizBtnCheck-' + id).show();
        $('#adaptativeQuizRound-' + id).text(opts.roundCount + 1 + ' / ' + opts.numRound);
        this.updateLevelDisplay(id, opts);
    },

    startGame: function (id) {
        const opts = this.options[id];
        opts.gameStarted = true;
        opts.gameOver = false;
        opts.hits = 0;
        opts.errors = 0;
        opts.score = 0;
        opts.currentLevel = opts.initialLevel;
        opts.maxLevelReached = opts.initialLevel;
        opts.consecutiveCorrect = 0;
        opts.consecutiveWrong = 0;
        opts.answeredIndexes = [];
        opts.roundCount = 0;

        $('#adaptativeQuizHits-' + id).text(0);
        $('#adaptativeQuizErrors-' + id).text(0);
        $('#adaptativeQuizScore-' + id).text(0);
        $('#adaptativeQuizBtnNewGame-' + id).hide();
        $('#adaptativeQuizReport-' + id)
            .hide()
            .empty();
        $('#adaptativeQuizStartGameDiv-' + id).css('display', 'none');
        $('#adaptativeQuizQuestionContainer-' + id).css('display', '');
        $('#adaptativeQuizButtonsContainer-' + id).css('display', '');

        opts.currentQuestionIndex = this.pickNextQuestionIndex(opts);
        if (opts.currentQuestionIndex < 0) {
            this.endGame(id);
            return;
        }
        this.renderCurrentQuestion(id);

        if (opts.time > 0) this.setupTimer(id);
    },

    /**
     * When a time limit is configured, show the Start screen instead of
     * launching the game immediately. The counter is pre-filled with the full
     * time so the learner sees how long they have before clicking Start.
     */
    showStartScreen: function (id) {
        const opts = this.options[id];
        opts.gameStarted = false;
        opts.gameOver = false;
        this.stopCounter(id);
        if (opts.time > 0) {
            opts.counter = opts.time * 60;
            this.updateTime(id);
        }
        $('#adaptativeQuizQuestionContainer-' + id).css('display', 'none');
        $('#adaptativeQuizButtonsContainer-' + id).css('display', 'none');
        $('#adaptativeQuizReport-' + id)
            .hide()
            .empty();
        $('#adaptativeQuizStartGameDiv-' + id).css('display', '');
    },

    beginActivity: function (id) {
        const opts = this.options[id];
        if (opts && opts.time > 0) {
            this.showStartScreen(id);
        } else {
            this.startGame(id);
        }
    },

    setupTimer: function (id) {
        const opts = this.options[id];
        if (!opts || opts.time <= 0) return;
        opts.counter = opts.time * 60;
        this.updateTime(id);
        this.stopCounter(id);
        opts.clockInterval = setInterval(() => this.tick(id), 1000);
    },

    tick: function (id) {
        const opts = this.options[id];
        if (!opts) return;
        const $node = $('#adaptativeQuizMainContainer-' + id);
        const $content = $('#node-content');
        if (!$node.length || ($content.length && $content.attr('mode') === 'edition') || opts.gameOver) {
            this.stopCounter(id);
            return;
        }
        opts.counter = Math.max(0, (opts.counter || 0) - 1);
        this.updateTime(id);
        if (opts.counter <= 0) {
            const msgs = opts.msgs || {};
            this.setMessage(id, msgs.msgTimeUp || "Time's up!", 'error');
            this.endGame(id);
        }
    },

    updateTime: function (id) {
        const opts = this.options[id];
        if (!opts) return;
        const seconds = opts.counter || 0;
        const helpers =
            typeof $exeDevices !== 'undefined' &&
            $exeDevices.iDevice &&
            $exeDevices.iDevice.gamification &&
            $exeDevices.iDevice.gamification.helpers;
        const text = helpers && helpers.getTimeToString ? helpers.getTimeToString(seconds) : this.formatTime(seconds);
        $('#adaptativeQuizTime-' + id).text(text);
    },

    formatTime: seconds => {
        const total = Math.max(0, parseInt(seconds, 10) || 0);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    },

    stopCounter: function (id) {
        const opts = this.options[id];
        if (!opts) return;
        if (opts.clockInterval) {
            clearInterval(opts.clockInterval);
            opts.clockInterval = null;
        }
    },

    /**
     * Update the adaptive level after an answer. Returns the delta applied
     * (+1, -1 or 0). Counters reset whenever the level actually changes or
     * when the streak is broken by an opposite answer.
     */
    applyAdaptation: function (opts, isCorrect) {
        const maxLevel = opts.maxLevel || 3;
        if (isCorrect) {
            opts.consecutiveWrong = 0;
            opts.consecutiveCorrect += 1;
            if (opts.consecutiveCorrect >= this.CONSEC_THRESHOLD && opts.currentLevel < maxLevel) {
                opts.currentLevel += 1;
                opts.consecutiveCorrect = 0;
                if (opts.currentLevel > opts.maxLevelReached) opts.maxLevelReached = opts.currentLevel;
                return 1;
            }
        } else {
            opts.consecutiveCorrect = 0;
            opts.consecutiveWrong += 1;
            if (opts.consecutiveWrong >= this.CONSEC_THRESHOLD && opts.currentLevel > 1) {
                opts.currentLevel -= 1;
                opts.consecutiveWrong = 0;
                return -1;
            }
        }
        return 0;
    },

    checkAnswer: function (id) {
        const opts = this.options[id];
        const question = opts.questions[opts.currentQuestionIndex];
        if (!question) return;

        const tSel = Number.isInteger(question.typeSelect) ? question.typeSelect : 0;
        const msgs = opts.msgs || {};

        let isCorrect = false;
        let chosen = null;
        let $selected = $();

        if (tSel === 0) {
            // Select (multi). solutionMulti can be empty: in that case the
            // correct response is to submit without selecting any option.
            $selected = $('input[name="adaptativeQuizAnswer-' + id + '"]:checked');
            const expected = (question.solutionMulti || []).slice().sort((a, b) => a - b);
            if ($selected.length === 0 && expected.length > 0) {
                this.setMessage(id, msgs.msgSelectOption || 'Click on an option to choose your answer.', 'info');
                const $msg = $('#adaptativeQuizMessages-' + id);
                $msg.stop(true, true).fadeIn(100).delay(2500).fadeOut(400);
                return;
            }
            const picked = $selected
                .map(function () {
                    return parseInt($(this).val());
                })
                .get()
                .sort((a, b) => a - b);
            isCorrect = picked.length === expected.length && picked.every((v, i) => v === expected[i]);
            chosen = picked;
        } else if (tSel === 1) {
            // Sort: read the user's answer from the visual order of the items.
            const $items = $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-SortItem');
            if (!$items.length) {
                this.setMessage(id, msgs.msgSelectOption || 'Click on an option to choose your answer.', 'info');
                return;
            }
            const ranks = {};
            $items.each(function (visualIndex) {
                const orig = parseInt($(this).attr('data-orig-index'), 10);
                ranks[orig] = visualIndex + 1;
            });
            const num = question.options.length;
            const expected = (question.solutionOrder || []).slice(0, num);
            isCorrect =
                expected.length === num && expected.every((expectedRank, origIdx) => ranks[origIdx] === expectedRank);
            chosen = ranks;
        } else if (tSel === 2) {
            // Word
            const $input = $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-WordInput');
            const answer = $.trim($input.val() || '');
            if (answer.length === 0) {
                this.setMessage(id, msgs.msgSelectOption || 'Click on an option to choose your answer.', 'info');
                return;
            }
            const norm = s => {
                let v = String(s).trim();
                if (!opts.caseSensitive) v = v.toLocaleLowerCase();
                if (!opts.accentSensitive) {
                    // Strip diacritics so e.g. "camion" matches "camión".
                    v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                }
                return v;
            };
            // The learner types the WORD, which is stored in q.question (see
            // edition form: the "Word" field maps to q.question, the
            // "Definition" field maps to q.solutionWord).
            isCorrect = norm(answer) === norm(question.question || '');
            chosen = answer;
        }

        $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-OptionInput').prop('disabled', true);
        // Lock the sort list so the learner cannot reorder it after checking.
        $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-SortItem')
            .addClass('ADAPTATIVEQUIZ-SortItem--locked')
            .attr('draggable', 'false');

        if (opts.immediateFeedback) {
            if (opts.showSolution) {
                if (tSel === 0) {
                    const expectedSet = new Set(question.solutionMulti || []);
                    $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-Option').each(function () {
                        const orig = parseInt($(this).attr('data-orig-index'));
                        if (expectedSet.has(orig)) $(this).addClass('ADAPTATIVEQUIZ-OptionCorrect');
                    });
                } else if (tSel === 1) {
                    // Sort: reveal the correct rank for every item (its real
                    // position in the expected order) and colour each row
                    // green when its current visual position matches that
                    // rank, red otherwise.
                    const expected = (question.solutionOrder || []).slice(0, question.options.length);
                    $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-SortItem').each(
                        function (visualIndex) {
                            const orig = parseInt($(this).attr('data-orig-index'), 10);
                            const $rank = $(this).find('.ADAPTATIVEQUIZ-SortRank');
                            const expectedRank = expected[orig];
                            $rank.text(expectedRank).removeAttr('hidden');
                            if (expectedRank === visualIndex + 1) {
                                $(this).addClass('ADAPTATIVEQUIZ-OptionCorrect');
                            } else {
                                $(this).addClass('ADAPTATIVEQUIZ-OptionIncorrect');
                            }
                        },
                    );
                } else if (tSel === 2) {
                    // Word: reveal the full word in the hint cells and tint
                    // them green when the learner's answer was correct,
                    // blue when it was incorrect.
                    const fullHint = this.buildWordHint(question.question || '', 100);
                    const $hint = $('#adaptativeQuizQuestionContainer-' + id + ' .ADAPTATIVEQUIZ-WordHint');
                    if ($hint.length) {
                        $hint.html(fullHint).addClass(
                            isCorrect
                                ? 'ADAPTATIVEQUIZ-WordHint--correct'
                                : 'ADAPTATIVEQUIZ-WordHint--incorrect',
                        );
                    }
                }
            }
        }
        // Reference `chosen` to silence unused-variable lints when no diagnostic
        // path consumes it (e.g. word-type incorrect answers).
        void chosen;

        if (isCorrect) {
            opts.hits++;
        } else {
            opts.errors++;
        }

        const delta = this.applyAdaptation(opts, isCorrect);

        if (opts.immediateFeedback) {
            const pieces = [];
            const feedbackAudio = isCorrect ? question.msgHitAudio : question.msgErrorAudio;
            if (isCorrect) {
                const primary = question.msgHit || this.pickRandom(msgs.msgSuccesses || 'Right!');
                pieces.push(primary);
            } else {
                const primary = question.msgError || this.pickRandom(msgs.msgFailures || 'Incorrect!');
                pieces.push(primary);
            }
            if (delta === 1) pieces.push('↑ ' + (msgs.msgLevelUp || 'Level up!'));
            if (delta === -1) pieces.push('↓ ' + (msgs.msgLevelDown || 'Level down'));
            const audioHtml = feedbackAudio ? this.renderMedia(opts, feedbackAudio, 'audio') : '';
            this.setMessage(id, this.escapeHtml(pieces.join(' ')) + audioHtml, isCorrect ? 'success' : 'error', true);
        }

        opts.answeredIndexes.push(opts.currentQuestionIndex);
        opts.roundCount++;
        opts.score = Math.round(((opts.hits * 10) / opts.numRound) * 100) / 100;

        $('#adaptativeQuizHits-' + id).text(opts.hits);
        $('#adaptativeQuizErrors-' + id).text(opts.errors);
        $('#adaptativeQuizScore-' + id).text(opts.score);
        this.updateLevelDisplay(id, opts);

        $('#adaptativeQuizBtnCheck-' + id).hide();

        const minShown = Math.max(opts.minQuestionsShown || 0, 0);
        const answeredAll = opts.answeredIndexes.length >= opts.questions.length;
        const reachedRound = opts.roundCount >= opts.numRound;
        const shouldEnd = answeredAll || (reachedRound && opts.roundCount >= minShown);

        if (shouldEnd) {
            this.endGame(id);
        } else {
            const delay = opts.showSolution ? (opts.timeShowSolution || 3) * 1000 : 1000;
            setTimeout(() => {
                if (!opts.gameOver) this.nextQuestion(id);
            }, delay);
        }
    },

    pickRandom: pipedString => {
        const list = String(pipedString)
            .split('|')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        if (list.length === 0) return '';
        return list[Math.floor(Math.random() * list.length)];
    },

    nextQuestion: function (id) {
        const opts = this.options[id];
        opts.currentQuestionIndex = this.pickNextQuestionIndex(opts);
        if (opts.currentQuestionIndex < 0) {
            this.endGame(id);
            return;
        }
        this.renderCurrentQuestion(id);
    },

    /**
     * Classify the final performance into a pedagogical profile.
     *  - high: score ≥ 80% and max level reached is 3.
     *  - low: score < 50% or final level is 1 with no climbs.
     *  - medium: everything else.
     */
    buildPedagogicalProfile: opts => {
        const msgs = opts.msgs || {};
        const maxLevel = opts.maxLevel || 3;
        const total = Math.max(1, opts.roundCount);
        const percent = (opts.hits / total) * 100;
        if (percent >= 80 && opts.maxLevelReached >= maxLevel) {
            return { key: 'high', text: msgs.msgReportHigh || 'Excellent.' };
        }
        if (percent < 50 || (opts.currentLevel === 1 && opts.maxLevelReached === 1)) {
            return { key: 'low', text: msgs.msgReportLow || 'Needs more practice.' };
        }
        return { key: 'medium', text: msgs.msgReportMedium || 'Good job.' };
    },

    renderFinalReport: function (id) {
        const opts = this.options[id];
        const msgs = opts.msgs || {};
        const total = Math.max(1, opts.roundCount);
        const percent = Math.round((opts.hits / total) * 100);
        const profile = this.buildPedagogicalProfile(opts);

        const html = `
            <div class="ADAPTATIVEQUIZ-ReportBox ADAPTATIVEQUIZ-Report-${profile.key}">
                <h3 class="ADAPTATIVEQUIZ-ReportTitle">${this.escapeHtml(msgs.msgReportTitle || 'Final report')}</h3>
                <ul class="ADAPTATIVEQUIZ-ReportStats">
                    <li>${this.escapeHtml(msgs.msgAnswered || 'Answered')}: <strong>${opts.roundCount}</strong></li>
                    <li>${this.escapeHtml(msgs.msgHits || 'Hits')}: <strong>${opts.hits}</strong></li>
                    <li>${this.escapeHtml(msgs.msgErrors || 'Errors')}: <strong>${opts.errors}</strong></li>
                    <li>${this.escapeHtml(msgs.msgLevel || 'Level')}: <strong>${this.escapeHtml(this.levelName(opts, opts.currentLevel))} (${opts.currentLevel})</strong></li>
                    <li>${this.escapeHtml(msgs.msgMaxLevel || 'Highest level reached')}: <strong>${this.escapeHtml(this.levelName(opts, opts.maxLevelReached))} (${opts.maxLevelReached})</strong></li>
                    <li>${this.escapeHtml(msgs.msgScore || 'Score')}: <strong>${percent}%</strong></li>
                </ul>
                <p class="ADAPTATIVEQUIZ-ReportProfile">${this.escapeHtml(profile.text)}</p>
            </div>
        `;

        $('#adaptativeQuizReport-' + id)
            .html(html)
            .show();
    },

    endGame: function (id) {
        const opts = this.options[id];
        opts.gameOver = true;
        this.stopCounter(id);
        $('#adaptativeQuizBtnCheck-' + id).hide();
        $('#adaptativeQuizBtnNewGame-' + id).show();

        this.renderFinalReport(id);

        if (opts.isScorm === 1) {
            this.sendScore(true, id);
        }
        this.saveEvaluation(id);
    },

    sendScore: function (auto, id) {
        const opts = this.options[id];
        opts.scorerp = (10 * opts.hits) / (opts.numRound || 1);
        opts.previousScore = this.previousScores[id] || '';
        opts.userName = this.userName;

        if ($exeDevices && $exeDevices.iDevice && $exeDevices.iDevice.gamification) {
            $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, opts);
            this.previousScores[id] = opts.previousScore;
        }
    },

    saveEvaluation: function (id) {
        const opts = this.options[id];
        opts.scorerp = (10 * opts.hits) / (opts.numRound || 1);

        if ($exeDevices && $exeDevices.iDevice && $exeDevices.iDevice.gamification) {
            $exeDevices.iDevice.gamification.report.saveEvaluation(opts, this.isInExe);
        }
    },

    enterCodeAccess: function (id) {
        const opts = this.options[id];
        const itinerary = opts.itinerary || {};
        const codeAccess = String(itinerary.codeAccess || '')
            .trim()
            .toLowerCase();
        const codeInput = String($('#adaptativeQuizCodeAccessInput-' + id).val() || '')
            .trim()
            .toLowerCase();

        if (codeAccess === '' || codeAccess === codeInput) {
            opts.accessUnlocked = true;
            $('#adaptativeQuizCodeAccessDiv-' + id).hide();
            $('#adaptativeQuizCubierta-' + id).hide();
            if (!opts.gameStarted) this.beginActivity(id);
            return;
        }

        $('#adaptativeQuizMessageCodeAccess-' + id)
            .fadeOut(300)
            .fadeIn(200)
            .fadeOut(300)
            .fadeIn(200);
        $('#adaptativeQuizCodeAccessInput-' + id).val('');
    },

    addEvents: function (id) {
        const opts = this.options[id];
        const itinerary = opts.itinerary || {};
        opts.accessUnlocked = !itinerary.showCodeAccess;

        $('#adaptativeQuizBtnCheck-' + id)
            .off('click.adaptativeQuiz')
            .on('click.adaptativeQuiz', e => {
                e.preventDefault();
                this.checkAnswer(id);
            });

        $('#adaptativeQuizBtnNewGame-' + id)
            .off('click.adaptativeQuiz')
            .on('click.adaptativeQuiz', e => {
                e.preventDefault();
                this.beginActivity(id);
            });

        $('#adaptativeQuizBtnStart-' + id)
            .off('click.adaptativeQuiz')
            .on('click.adaptativeQuiz', e => {
                e.preventDefault();
                this.startGame(id);
            });

        $('#adaptativeQuizMainContainer-' + id)
            .closest('.idevice_node')
            .off('click.adaptativeQuiz', '.Games-SendScore')
            .on('click.adaptativeQuiz', '.Games-SendScore', e => {
                e.preventDefault();
                this.sendScore(false, id);
                this.saveEvaluation(id);
            });

        $('#adaptativeQuizCodeAccessButton-' + id)
            .off('click.adaptativeQuiz')
            .on('click.adaptativeQuiz', e => {
                e.preventDefault();
                this.enterCodeAccess(id);
            });

        $('#adaptativeQuizCodeAccessInput-' + id)
            .off('keydown.adaptativeQuiz')
            .on('keydown.adaptativeQuiz', event => {
                if (event.which === 13 || event.keyCode === 13) {
                    this.enterCodeAccess(id);
                    return false;
                }
                return true;
            });

        $('#adaptativeQuizMainContainer-' + id)
            .css('display', 'flex')
            .show();
        $('#adaptativeQuizCubierta-' + id).hide();
        $('#adaptativeQuizCodeAccessDiv-' + id).hide();

        if (itinerary.showCodeAccess) {
            $('#adaptativeQuizMessageCodeAccess-' + id).text(itinerary.messageCodeAccess || '');
            $('#adaptativeQuizCubierta-' + id).show();
            $('#adaptativeQuizCodeAccessDiv-' + id).show();
        } else if (!opts.gameStarted && opts.questions.length > 0) {
            this.beginActivity(id);
        }

        if (
            opts.evaluation &&
            opts.evaluationID &&
            opts.evaluationID.length > 3 &&
            $exeDevices &&
            $exeDevices.iDevice &&
            $exeDevices.iDevice.gamification &&
            $exeDevices.iDevice.gamification.report
        ) {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(opts, this.isInExe);
        }

        if (
            opts.isScorm > 0 &&
            $exeDevices &&
            $exeDevices.iDevice &&
            $exeDevices.iDevice.gamification &&
            $exeDevices.iDevice.gamification.scorm
        ) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(opts);
        }
    },
};
