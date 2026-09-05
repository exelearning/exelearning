/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function configureGamificationGlobals() {
    global.$exeDevices = {
        iDevice: {
            gamification: {
                colors: {
                    borderColors: {
                        red: '#ff0000',
                        blue: '#0000ff',
                        green: '#00ff00',
                        yellow: '#ffff00',
                    },
                    backColor: {
                        black: '#000000',
                        white: '#ffffff',
                    },
                },
                helpers: {
                    decrypt: (value) => value,
                    isJsonString: (value) => JSON.parse(value),
                    getQuestions: (questions) => questions,
                },
                scorm: {},
                math: {
                    updateLatex: vi.fn(),
                },
                observers: {
                    observeResize: vi.fn(),
                },
            },
        },
    };
}

function loadExportIdevice(code) {
    let modifiedCode = code.replace(/var\s+\$eXeEC\s*=/, 'global.$eXeEC =');
    modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeEC\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeEC;
}

describe('electrical-circuits iDevice export', () => {
    let $eXeEC;

    beforeEach(() => {
        global.$eXeEC = undefined;
        configureGamificationGlobals();
        const code = readFileSync(join(__dirname, 'electrical-circuits.js'), 'utf-8');
        $eXeEC = loadExportIdevice(code);
    });

    it('enable starts the game without loading TikZJax', () => {
        const loadGame = vi.spyOn($eXeEC, 'loadGame').mockImplementation(() => {});

        $eXeEC.enable();

        expect(loadGame).toHaveBeenCalled();
        expect(document.querySelector('script[src*="tikzjax"]')).toBeNull();
    });

    it('sanitizes SVG before rendering it', () => {
        document.body.innerHTML = '<div id="elcpTikzPreview-0"></div><div id="elcpCover-0"></div>';
        const question = {
            tikzSvg: `
                <svg width="100" height="50" viewBox="0 0 10 10" onload="alert(1)">
                    <script>alert(1)</script>
                    <foreignObject><div>html</div></foreignObject>
                    <path onclick="alert(1)" href="javascript:alert(1)" d="M0 0"></path>
                </svg>
            `,
        };

        $eXeEC.showTikzCircuit(question, 0);
        const previewHtml = document.getElementById('elcpTikzPreview-0').innerHTML;

        expect(previewHtml).toContain('<svg');
        expect(previewHtml).toContain('viewBox="0 0 10 10"');
        expect(previewHtml).not.toContain('width=');
        expect(previewHtml).not.toContain('height=');
        expect(previewHtml).not.toContain('<script');
        expect(previewHtml).not.toContain('foreignObject');
        expect(previewHtml).not.toContain('onload');
        expect(previewHtml).not.toContain('onclick');
        expect(previewHtml).not.toContain('javascript:');
        expect(document.querySelector('script[type="text/tikz"]')).toBeNull();
    });

    it('does not render from tikzCode when SVG is missing', () => {
        document.body.innerHTML = '<div id="elcpTikzPreview-0"></div><div id="elcpCover-0"></div>';

        $eXeEC.showTikzCircuit({ tikzCode: '\\draw (0,0);', tikzSvg: '' }, 0);

        expect(document.getElementById('elcpTikzPreview-0').innerHTML).toBe('');
        expect(document.querySelector('script[type="text/tikz"]')).toBeNull();
    });

    it('disableWordAnswer locks the word input and its buttons', () => {
        document.body.innerHTML = `
            <input id="elcpEdAnswer-0" type="text">
            <button id="elcpBtnReply-0"></button>
            <button id="elcpBtnMoveOn-0"></button>
        `;

        $eXeEC.disableWordAnswer(0);

        expect(document.getElementById('elcpEdAnswer-0').disabled).toBe(true);
        expect(document.getElementById('elcpBtnReply-0').disabled).toBe(true);
        expect(document.getElementById('elcpBtnMoveOn-0').disabled).toBe(true);
    });

    function setupWordQuestion() {
        document.body.innerHTML = `
            <input id="elcpEdAnswer-0" type="text" value="OHM">
            <button id="elcpBtnReply-0"></button>
            <button id="elcpBtnMoveOn-0"></button>
            <span id="elcpPHits-0"></span>
            <span id="elcpPErrors-0"></span>
        `;
        $eXeEC.options = [
            {
                activeQuestion: 0,
                gameActived: true,
                respuesta: '',
                showSolution: false,
                numberQuestions: 1,
                hits: 0,
                errors: 0,
                timeShowSolution: 1,
                itinerary: { showClue: false },
                msgs: {},
                selectsGame: [{ typeSelect: 2, solutionQuestion: 'OHM' }],
            },
        ];
        vi.spyOn($eXeEC, 'updateScore').mockImplementation(() => {});
        vi.spyOn($eXeEC, 'sameQuestion').mockReturnValue(false);
        vi.spyOn($eXeEC, 'newQuestion').mockImplementation(() => {});
    }

    it('answerQuestion disables the word input for word questions', () => {
        vi.useFakeTimers();
        setupWordQuestion();

        $eXeEC.answerQuestion(0);

        expect(document.getElementById('elcpEdAnswer-0').disabled).toBe(true);
        vi.useRealTimers();
    });

    it('answerQuestionBoard disables the word input for word questions', () => {
        vi.useFakeTimers();
        setupWordQuestion();

        $eXeEC.answerQuestionBoard(true, 0);

        expect(document.getElementById('elcpEdAnswer-0').disabled).toBe(true);
        vi.useRealTimers();
    });

    it('reveals the full solution word when show solution is on (ignoring sameQuestion)', () => {
        vi.useFakeTimers();
        setupWordQuestion();
        $eXeEC.options[0].showSolution = true;
        // Force the buggy guard to report "same question" to prove it no longer
        // blocks revealing the word.
        $eXeEC.sameQuestion.mockReturnValue(true);
        const drawPhrase = vi
            .spyOn($eXeEC, 'drawPhrase')
            .mockImplementation(() => {});

        $eXeEC.answerQuestion(0);

        expect(drawPhrase).toHaveBeenCalled();
        const args = drawPhrase.mock.calls[0];
        expect(args[0]).toBe('OHM'); // the correct solution word
        expect(args[2]).toBe(100); // fully revealed
        vi.useRealTimers();
    });

    it('ramdonOptions shuffles order questions and remaps the solution sequence', () => {
        // Deterministic "shuffle": reverse the array.
        global.$exeDevices.iDevice.gamification.helpers.shuffleAds = (arr) => [
            ...arr,
        ].reverse();
        $eXeEC.options = [
            {
                question: {
                    typeSelect: 1,
                    options: ['A1', 'B2', 'C3', 'D4'],
                    solution: 'ACBD', // correct order: A1, C3, B2, D4
                },
            },
        ];

        $eXeEC.ramdonOptions(0);

        const q = $eXeEC.options[0].question;
        expect(q.options).toEqual(['D4', 'C3', 'B2', 'A1']);
        // The new positions must still read out as A1, C3, B2, D4 in order.
        expect(q.solution).toBe('DBCA');
    });

    it('shows the order solution even when sameQuestion would block it', () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <span id="elcpPHits-0"></span>
            <span id="elcpPErrors-0"></span>
        `;
        $eXeEC.options = [
            {
                activeQuestion: 0,
                gameActived: true,
                respuesta: 'AB',
                showSolution: true,
                numberQuestions: 1,
                hits: 0,
                errors: 0,
                timeShowSolution: 1,
                itinerary: { showClue: false },
                msgs: {},
                selectsGame: [{ typeSelect: 1, solution: 'AB' }],
            },
        ];
        vi.spyOn($eXeEC, 'updateScore').mockImplementation(() => {});
        vi.spyOn($eXeEC, 'sameQuestion').mockReturnValue(true);
        const drawSolution = vi
            .spyOn($eXeEC, 'drawSolution')
            .mockImplementation(() => {});
        vi.spyOn($eXeEC, 'newQuestion').mockImplementation(() => {});

        $eXeEC.answerQuestion(0);

        expect(drawSolution).toHaveBeenCalledWith(0);
        vi.useRealTimers();
    });

    it('loadDataGame preserves tikzSvg and does not add tikzSvgHash', () => {
        const data = {
            text: () =>
                JSON.stringify({
                    selectsGame: [
                        {
                            tikzCode: '\\draw (0,0);',
                            tikzSvg: '<svg viewBox="0 0 10 10"></svg>',
                            customScore: 2,
                        },
                    ],
                    percentajeQuestions: 100,
                    msgs: {},
                }),
        };

        const loaded = $eXeEC.loadDataGame(data);

        expect(loaded.selectsGame[0].tikzSvg).toBe('<svg viewBox="0 0 10 10"></svg>');
        expect(loaded.selectsGame[0]).not.toHaveProperty('tikzSvgHash');
    });

    // The automatic report used to happen only from showQuestion(), i.e. once
    // the setTimeout that reveals the next question had elapsed. That put the
    // mark in the LMS seconds late, and a learner who left during that window
    // lost the answer: the timer never fired.
    describe('reporting in the same turn the learner answered', () => {
        const idevice = () => global.$eXeEC;

        function setupAnswer(overrides) {
            document.body.innerHTML =
                '<div id="elcpMainContainer-0">' +
                '<div id="elcpPShowClue-0"></div>' +
                '<div id="elcpLinkAudio-0"></div>' +
                '</div>';
            idevice().initialScore = '';
            idevice().options[0] = Object.assign(
                {
                    id: 0,
                    isScorm: 1,
                    repeatActivity: true,
                    gameStarted: true,
                    gameActived: true,
                    gameOver: false,
                    hits: 1,
                    errors: 0,
                    numberQuestions: 4,
                    activeQuestion: 0,
                    activeCounter: true,
                    showSolution: false,
                    audioFeedBach: false,
                    obtainedClue: false,
                    selectsGame: [
                        { audio: '', typeSelect: 0 },
                        { audio: '', typeSelect: 0 },
                        { audio: '', typeSelect: 0 },
                        { audio: '', typeSelect: 0 },
                    ],
                    itinerary: { showClue: false, percentageClue: 0 },
                    msgs: { msgInformation: 'info', msgYouScore: 'Score' },
                },
                overrides
            );
            vi.spyOn(idevice(), 'updateScore').mockImplementation(() => {});
            vi.spyOn(idevice(), 'sendScore').mockImplementation(() => {});
            vi.spyOn(idevice(), 'newQuestion').mockImplementation(() => {});
            vi.spyOn(idevice(), 'showMessage').mockImplementation(() => {});
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        it('reports before the reveal timer runs, not after it', () => {
            vi.useFakeTimers();
            setupAnswer();

            idevice().answerQuestionBoard(true, 0);

            // No timer has been advanced: the report has to have gone out.
            expect(idevice().sendScore).toHaveBeenCalledWith(true, 0);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('does not report outside automatic SCORM mode', () => {
            vi.useFakeTimers();
            setupAnswer({ isScorm: 0 });

            idevice().answerQuestionBoard(true, 0);

            expect(idevice().sendScore).not.toHaveBeenCalled();

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // An intermediate answer must not close the attempt: the page would go
        // to passed/failed while the learner is still playing.
        it('leaves the activity unfinished while questions remain', () => {
            vi.useFakeTimers();
            setupAnswer({ activeQuestion: 0, numberQuestions: 4 });

            idevice().answerQuestionBoard(true, 0);

            expect(idevice().options[0].gameOver).toBe(false);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // The last answer must carry the completion, so leaving during the
        // reveal delay still records a finished activity.
        it('marks the activity finished on the last question, before reporting', () => {
            vi.useFakeTimers();
            setupAnswer({ activeQuestion: 3, numberQuestions: 4 });
            let flagWhenReported;
            idevice().sendScore.mockImplementation(() => {
                flagWhenReported = idevice().options[0].gameOver;
            });

            idevice().answerQuestionBoard(true, 0);

            expect(flagWhenReported).toBe(true);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // No "score only once" lock any more: every report goes out. The one
        // that used to sit here could never close anyway — registerActivity
        // forces repeatActivity to true at page load (common.js
        // updateScormNew) — and a stale mark in the LMS is worse than a
        // repeated one.
        it('reports again after a previous score, with repeating disabled', () => {
            setupAnswer({ repeatActivity: false });
            idevice().options[0].initialScore = '5.00';

            idevice().saveScormScore(0);

            expect(idevice().sendScore).toHaveBeenCalledWith(true, 0);
        });

    });

    // Presentation mode has no questions: walking to the last circuit is the
    // whole of the activity. The score already reached 10 there, but nothing
    // said the activity was finished, so the page stayed `incomplete`.
    describe('completion in presentation mode', () => {
        const instance = 0;
        const idevice = () => global.$eXeEC;
        let reported;

        function setupShow(circuits) {
            document.body.innerHTML = `
                <div id="elcpMainContainer-${instance}">
                    <div id="elcpMultimedia-${instance}"></div>
                    <div id="elcpShowPrev-${instance}"></div>
                    <div id="elcpShowNext-${instance}"></div>
                </div>`;
            idevice().previousScore = '';
            idevice().options[instance] = {
                main: `elcpMainContainer-${instance}`,
                isScorm: 1,
                activityMode: 'show',
                gameOver: false,
                gameStarted: false,
                visiteds: 0,
                showCurrentIndex: 0,
                selectsGame: new Array(circuits).fill({}),
                msgs: { msgYouScore: 'Score' },
            };
            reported = [];
            idevice().showCircuitAtIndex = () => {};
            idevice().saveEvaluation = () => {};
            idevice().sendScore = (auto, i) => {
                reported.push({
                    auto,
                    gameOver: idevice().options[i].gameOver,
                    scorerp: idevice().getScoreRP(i),
                });
            };
            idevice().initShowMode(instance);
        }

        /** Press Next once. */
        function next() {
            $(`#elcpShowNext-${instance}`).trigger('click');
        }

        it('stays unfinished while circuits remain', () => {
            setupShow(3);

            next();

            expect(reported).toHaveLength(1);
            expect(reported[0].gameOver).toBe(false);
        });

        it('finishes on the last circuit, with the full mark', () => {
            setupShow(3);

            next();
            next();

            expect(reported).toHaveLength(2);
            expect(reported[1].gameOver).toBe(true);
            expect(reported[1].scorerp).toBe(10);
        });

        it('finishes on the first step of a two-circuit presentation', () => {
            setupShow(2);

            next();

            expect(reported[0].gameOver).toBe(true);
            expect(reported[0].scorerp).toBe(10);
        });
    });

    // The code opens both modes, but only one of them can be started by it.
    describe('opening with an access code', () => {
        const instance = 0;
        const idevice = () => global.$eXeEC;
        let reported;

        function setupCoded(activityMode, typed) {
            document.body.innerHTML = `
                <div id="elcpMainContainer-${instance}">
                    <div id="elcpCodeAccessDiv-${instance}"></div>
                    <div id="elcpMesajeAccesCodeE-${instance}"></div>
                    <a id="elcpLinkMaximize-${instance}" href="#"></a>
                    <input id="elcpCodeAccessE-${instance}" value="${typed}">
                </div>`;
            idevice().options[instance] = {
                main: `elcpMainContainer-${instance}`,
                isScorm: 1,
                activityMode,
                // initShowMode raises this at load in presentation mode; the
                // quiz waits for its start.
                gameStarted: activityMode === 'show',
                gameOver: false,
                visiteds: 0,
                showCurrentIndex: 0,
                selectsGame: [{}, {}],
                itinerary: { codeAccess: 'abre', showCodeAccess: true },
                msgs: { msgYouScore: 'Score' },
            };
            reported = [];
            vi.spyOn(idevice(), 'showCubiertaOptions').mockImplementation(
                () => {}
            );
            vi.spyOn(idevice(), 'startGame').mockImplementation(() => {});
            vi.spyOn(idevice(), 'sendScore').mockImplementation((auto, i) => {
                reported.push({
                    auto,
                    gameOver: idevice().options[i].gameOver,
                    scorerp: idevice().getScoreRP(i),
                });
            });
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        it('starts the quiz, which publishes its own opening zero', () => {
            setupCoded('quiz', 'AbrE');

            idevice().enterCodeAccess(instance);

            expect(idevice().startGame).toHaveBeenCalledWith(instance);
        });

        // startGame returns early on a presentation — that early return is what
        // keeps the quiz interface off it — so the report has to come from here.
        it('publishes the opening mark of a presentation itself', () => {
            setupCoded('show', 'abre');

            idevice().enterCodeAccess(instance);

            expect(idevice().startGame).not.toHaveBeenCalled();
            expect(reported).toEqual([
                // One circuit of two seen, and nothing finished yet.
                { auto: true, gameOver: false, scorerp: 5 },
            ]);
        });

        it('reports nothing when the code is wrong', () => {
            setupCoded('show', 'nope');

            idevice().enterCodeAccess(instance);

            expect(reported).toEqual([]);
            expect($(`#elcpCodeAccessE-${instance}`).val()).toBe('');
        });

        it('does not auto-report a presentation in manual SCORM mode', () => {
            setupCoded('show', 'abre');
            idevice().options[instance].isScorm = 2;

            idevice().enterCodeAccess(instance);

            expect(reported).toEqual([]);
        });
    });

    // gameOver() renames the same button to New game, so the replay comes back
    // through startGame carrying the finished attempt's flag.
    describe('replaying a finished attempt', () => {
        const instance = 0;
        const idevice = () => global.$eXeEC;

        function setupReplay() {
            document.body.innerHTML = `
                <div id="elcpMainContainer-${instance}">
                    <div id="elcpGameContainer-${instance}">
                        <div class="ELCP-StartGame"></div>
                    </div>
                    <div id="elcpQuestionDiv-${instance}"></div>
                    <div id="elcpWordDiv-${instance}"></div>
                    <div id="elcpShowClue-${instance}"></div>
                    <div id="elcpPNumber-${instance}"></div>
                    <div id="elcpPHits-${instance}"></div>
                    <div id="elcpPErrors-${instance}"></div>
                    <div id="elcpPScore-${instance}"></div>
                    <div id="elcpGamerOver-${instance}"></div>
                </div>`;
            idevice().options[instance] = {
                main: `elcpMainContainer-${instance}`,
                isScorm: 1,
                activityMode: 'quiz',
                // What gameOver() left behind: finished, with a grade.
                gameStarted: false,
                gameOver: true,
                hits: 4,
                errors: 0,
                score: 10,
                scoreGame: 4,
                scoreTotal: 4,
                numberQuestions: 4,
                questionsRandom: false,
                selectsGame: [{}, {}, {}, {}],
                itinerary: { showClue: false },
                msgs: { msgYouScore: 'Score' },
            };
            vi.spyOn(idevice(), 'updateTime').mockImplementation(() => {});
            vi.spyOn(idevice(), 'newQuestion').mockImplementation(() => {});
            vi.spyOn(idevice(), 'sendScore').mockImplementation(() => {});
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        it('reports the replay as unfinished, with the counts cleared', () => {
            setupReplay();
            let stateWhenReported;
            idevice().sendScore.mockImplementation(() => {
                const { hits, errors, gameOver, gameStarted } =
                    idevice().options[instance];
                stateWhenReported = { hits, errors, gameOver, gameStarted };
            });

            idevice().startGame(instance);

            expect(stateWhenReported).toEqual({
                hits: 0,
                errors: 0,
                // The whole point: sendScoreNew reads gameOver as "the learner
                // finished", and a replay has not.
                gameOver: false,
                gameStarted: true,
            });
        });
    });

    // Dropping the lives option took the panel and the variable holding it,
    // but left the hide() call at the top of showScoreGame. Every game-over
    // threw ReferenceError there, before a single figure was painted — and
    // the throw came from inside gameOver, so it took the report with it.
    describe('the end-of-game panel', () => {
        const instance = 0;
        const idevice = () => global.$eXeEC;

        function setupPanel(overrides = {}) {
            document.body.innerHTML = `
                <div id="elcpMainContainer-${instance}">
                    <div id="elcpGameContainer-${instance}"></div>
                    <div id="elcpHistGame-${instance}"></div>
                    <div id="elcpOverScore-${instance}"></div>
                    <div id="elcpOverHits-${instance}"></div>
                    <div id="elcpOverErrors-${instance}"></div>
                    <div id="elcpShowClue-${instance}"></div>
                    <div id="elcpGamerOver-${instance}"></div>
                </div>`;
            idevice().options[instance] = Object.assign(
                {
                    main: `elcpMainContainer-${instance}`,
                    gameMode: 1,
                    score: 7.5,
                    hits: 3,
                    errors: 1,
                    obtainedClue: false,
                    itinerary: { showClue: false, percentageClue: 0, clueGame: '' },
                    msgs: {
                        msgCool: 'Bien',
                        msgAllQuestions: 'Todas',
                        msgScore: 'Score',
                        msgHits: 'Hits',
                        msgErrors: 'Errors',
                        msgInformationLooking: 'Mira',
                    },
                },
                overrides
            );
            vi.spyOn(idevice(), 'showMessage').mockImplementation(() => {});
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        // 0 is finishing every question, 2 is running out of time.
        it.each([0, 2])('paints the totals when the game ends with type %i', type => {
            setupPanel();

            expect(() => idevice().showScoreGame(type, instance)).not.toThrow();

            expect($(`#elcpOverHits-${instance}`).html()).toBe('Hits: 3');
            expect($(`#elcpOverErrors-${instance}`).html()).toBe('Errors: 1');
        });
    });
});
