/**
 * Unit tests for Map iDevice export/runtime.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    let modifiedCode = code.replace(/var\s+\$eXeMapa\s*=/, 'global.$eXeMapa =');
    modifiedCode = modifiedCode.replace(
        /\$\(function\s*\(\)\s*\{\s*\$eXeMapa\.init\(\);\s*\}\);?/g,
        ''
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeMapa;
}

function installGamificationMocks() {
    global.$exeDevices.iDevice.gamification.media = {
        getURLVideoMediaTeca: vi.fn(() => false),
        playSound: vi.fn(),
        stopSound: vi.fn(),
    };
    global.$exeDevices.iDevice.gamification.math = {
        hasLatex: vi.fn(() => false),
        updateLatex: vi.fn(),
    };
}

describe('map iDevice export score saving', () => {
    let $eXeMapa;

    beforeEach(() => {
        global.$eXeMapa = undefined;
        installGamificationMocks();

        const filePath = join(__dirname, 'map.js');
        const code = readFileSync(filePath, 'utf-8');

        $eXeMapa = loadExportIdevice(code);
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('does not save quiz scores when only showing a question', () => {
        document.body.innerHTML = `
            <div id="mapaQuestion-0"></div>
            <input id="mapaEdAnswer-0">
            <span id="mapaRepeatActivity-0"></span>`;
        $eXeMapa.options[0] = {
            evaluationG: 4,
            hits: 0,
            isScorm: 1,
            msgs: {
                msgSelectAnswers: 'Select answers',
                msgYouScore: 'Your score',
            },
            numberQuestions: 3,
            selectsGame: [{ quextion: 'Question', solution: 'A', typeSelect: 0 }],
        };
        $eXeMapa.clearQuestions = vi.fn();
        $eXeMapa.drawQuestions = vi.fn();
        $eXeMapa.ramdonOptions = vi.fn();
        $eXeMapa.showMessage = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        $eXeMapa.showQuestion(0, 0);

        expect($eXeMapa.options[0].gameActived).toBe(true);
        expect($eXeMapa.sendScore).not.toHaveBeenCalled();
        expect($eXeMapa.saveEvaluation).not.toHaveBeenCalled();
    });

    it('saves quiz scores after answering a question', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<span id="mapaRepeatActivity-0"></span>';
        $eXeMapa.options[0] = {
            activeQuestion: 0,
            errors: 0,
            evaluationG: 4,
            gameActived: true,
            hits: 0,
            isScorm: 1,
            msgs: {
                msgPoints: 'points',
                msgSuccesses: 'Correct',
                msgFailures: 'Incorrect',
                msgYouScore: 'Your score',
            },
            numberQuestions: 2,
            respuesta: 'A',
            selectsGame: [
                {
                    msgError: '',
                    msgHit: '',
                    quextion: 'Question',
                    solution: 'A',
                    typeSelect: 0,
                },
            ],
            showSolution: false,
            score: 0,
        };
        $eXeMapa.showClue = vi.fn();
        $eXeMapa.showMessage = vi.fn();
        $eXeMapa.newQuestion = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        $eXeMapa.answerQuestion(0);

        expect($eXeMapa.options[0].hits).toBe(1);
        expect($eXeMapa.sendScore).toHaveBeenCalledWith(true, 0);
        expect($eXeMapa.saveEvaluation).toHaveBeenCalledWith(0);
        vi.runOnlyPendingTimers();
    });

    it('saves the completed quiz score from gameOver (terminal state)', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="mapaFMessages-0"></div>';
        $eXeMapa.options[0] = {
            errors: 0,
            evaluationG: 4,
            hits: 1,
            isScorm: 1,
            msgs: {
                msgErrors: 'Errors',
                msgHits: 'Hits',
                msgQuestions: 'Questions',
                msgScore: 'Score',
                msgScore10: '10',
                msgScore4: '4',
                msgScore6: '6',
                msgScore8: '8',
            },
            numberQuestions: 2,
        };
        $eXeMapa.hideCover = vi.fn();
        $eXeMapa.placePointInWindow = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        $eXeMapa.gameOver(0);

        // The per-question sends recorded SCORM state 1 (in progress); this is
        // the only point where the questionnaire's terminal "completed" state
        // (gameOver === true -> state 2) is persisted. (#1831)
        expect($eXeMapa.options[0].gameOver).toBe(true);
        expect($eXeMapa.sendScore).toHaveBeenCalledWith(true, 0);
        // The evaluation report is already saved per-question, so gameOver must
        // not re-save it for the questionnaire mode.
        expect($eXeMapa.saveEvaluation).not.toHaveBeenCalled();
        vi.runOnlyPendingTimers();
    });

    it('saves order scores when the checked order reaches gameOver', () => {
        vi.useFakeTimers();
        document.body.innerHTML = '<div id="mapaFMessages-0"></div>';
        $eXeMapa.options[0] = {
            errors: 1,
            evaluationG: 5,
            hits: 2,
            isScorm: 1,
            msgs: {
                msgErrors: 'Errors',
                msgHits: 'Hits',
                msgPointsA: 'Points',
                msgQuestions: 'Questions',
                msgScore: 'Score',
                msgScore10: '10',
                msgScore4: '4',
                msgScore6: '6',
                msgScore8: '8',
            },
            order: ['1', '2', '3'],
            orderResponse: [1, 2, 3],
        };
        $eXeMapa.hideCover = vi.fn();
        $eXeMapa.placePointInWindow = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        $eXeMapa.gameOver(0);

        expect($eXeMapa.sendScore).toHaveBeenCalledWith(true, 0);
        expect($eXeMapa.saveEvaluation).toHaveBeenCalledWith(0);
        vi.runOnlyPendingTimers();
    });

    it.each([4, 5])(
        'does not save scores from the manual button before answering in mode %s',
        evaluationG => {
            document.body.innerHTML = `
                <article class="idevice_node">
                    <div id="mapaMainContainer-0">
                        <button class="Games-SendScore">Save</button>
                    </div>
                </article>`;
            $eXeMapa.options[0] = {
                evaluationG,
                gameOver: false,
                hideScoreBar: false,
            };
            $eXeMapa.refreshGame = vi.fn();
            $eXeMapa.removeEvents = vi.fn();
            $eXeMapa.sendScore = vi.fn();
            $eXeMapa.saveEvaluation = vi.fn();

            $eXeMapa.addEvents(0);
            $('.Games-SendScore').trigger('click');

            expect($eXeMapa.sendScore).not.toHaveBeenCalled();
            expect($eXeMapa.saveEvaluation).not.toHaveBeenCalled();
        }
    );

    it('allows the manual button to save order scores after checking the order', () => {
        document.body.innerHTML = `
            <article class="idevice_node">
                <div id="mapaMainContainer-0">
                    <button class="Games-SendScore">Save</button>
                </div>
            </article>`;
        $eXeMapa.options[0] = {
            evaluationG: 5,
            gameOver: true,
            hideScoreBar: false,
        };
        $eXeMapa.refreshGame = vi.fn();
        $eXeMapa.removeEvents = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        $eXeMapa.addEvents(0);
        $('.Games-SendScore').trigger('click');

        expect($eXeMapa.sendScore).toHaveBeenCalledWith(false, 0);
        expect($eXeMapa.saveEvaluation).toHaveBeenCalledWith(0);
    });

    it('registers with gameStarted=false then restores it (no score sent on load)', () => {
        // Modes 0/4/6 set gameStarted=true at setup; registration (in initElements)
        // must not treat page load as an active session, but the flag is restored
        // afterwards so intermediate progress is still tracked.
        $eXeMapa.options[0] = {
            evaluationG: 0,
            gameOver: false,
            gameStarted: true,
            isScorm: 1,
            instructions: '',
            authorImage: '',
            showMinimize: false,
            hasAreas: false,
            showActiveAreas: false,
            hideAreas: false,
            itinerary: { showCodeAccess: false },
            msgs: { msgPlayStart: '' },
        };
        $eXeMapa.hideModalWindows = vi.fn();

        let gameStartedAtRegister;
        global.$exeDevices.iDevice.gamification.scorm = {
            registerActivity: vi.fn(opts => {
                gameStartedAtRegister = opts.gameStarted;
            }),
        };

        $eXeMapa.initElements(0);

        expect(gameStartedAtRegister).toBe(false);
        expect($eXeMapa.options[0].gameStarted).toBe(true);
    });

    it.each([4, 5])('does not save scores from point-only visits in mode %s', evaluationG => {
        $eXeMapa.options[0] = {
            activeMap: {
                pts: [{ id: 'point-1', title: 'Point' }],
            },
            evaluationG,
            isScorm: 1,
            msgs: {
                msgYouScore: 'Your score',
            },
            visiteds: [],
        };
        $eXeMapa.showMessageModal = vi.fn();
        $eXeMapa.messageAllVisited = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        $eXeMapa.showPointNone(0, 0);

        expect($eXeMapa.options[0].visiteds).toEqual(['point-1']);
        expect($eXeMapa.sendScore).not.toHaveBeenCalled();
        expect($eXeMapa.saveEvaluation).not.toHaveBeenCalled();
    });

    it('does not save order scores when visiting points before checking the order', () => {
        document.body.innerHTML = '<div id="mapaFDetails-0"></div><div id="mapaMultimediaPoint-0"></div>';
        $eXeMapa.options[0] = {
            activeMap: {
                active: 0,
                pts: [
                    {
                        audio: '',
                        footer: '',
                        id: 'point-1',
                        title: 'Point',
                        toolTip: 'Tip',
                        type: 7,
                        video: '',
                    },
                ],
            },
            evaluationG: 5,
            isScorm: 1,
            orderResponse: [],
            visiteds: [],
            waitPlayVideo: true,
        };
        $eXeMapa.hideModalMessages = vi.fn();
        $eXeMapa.showClue = vi.fn();
        $eXeMapa.showToolTip = vi.fn();
        $eXeMapa.startVideo = vi.fn();
        $eXeMapa.stopVideo = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        $eXeMapa.showPoint(0, 0);

        expect($eXeMapa.options[0].orderResponse).toEqual([1]);
        expect($eXeMapa.sendScore).not.toHaveBeenCalled();
        expect($eXeMapa.saveEvaluation).not.toHaveBeenCalled();
    });

    it('completes a free-exploration map (mode 0) only when every point is visited', () => {
        $eXeMapa.options[0] = {
            activeMap: {
                pts: [
                    { id: 'p1', title: 'P1' },
                    { id: 'p2', title: 'P2' },
                ],
            },
            evaluationG: 0,
            isScorm: 1,
            numberQuestions: 2,
            msgs: { msgYouScore: 'Score', msgAllVisited: 'All' },
            visiteds: [],
        };
        $eXeMapa.showMessageModal = vi.fn();
        $eXeMapa.messageAllVisited = vi.fn();
        $eXeMapa.sendScore = vi.fn();
        $eXeMapa.saveEvaluation = vi.fn();

        // Visiting the first of two points keeps the activity incomplete.
        $eXeMapa.showPointNone(0, 0);
        expect($eXeMapa.options[0].gameOver).toBeFalsy();

        // Visiting the last remaining point completes the exploration.
        $eXeMapa.showPointNone(1, 0);
        expect($eXeMapa.options[0].gameOver).toBe(true);
    });
});
