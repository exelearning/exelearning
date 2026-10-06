/**
 * Unit tests for the quick-questions iDevice (export/runtime).
 *
 * The automatic report used to happen only from showQuestion(), i.e. once the
 * setTimeout that reveals the next question had elapsed. That put the mark in
 * the LMS seconds late — so the SCORM menu still showed the previous score
 * right after answering — and a learner who left during that window lost the
 * answer, because the timer never fired.
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$quickquestions\s*=/, 'global.$quickquestions =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$quickquestions\.init\(\);\s*\}\);?/g,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$quickquestions;
}

describe('quick-questions iDevice export', () => {
    let $quickquestions;

    beforeEach(() => {
        global.$quickquestions = undefined;
        const code = readFileSync(
            join(__dirname, 'quick-questions.js'),
            'utf-8'
        );
        $quickquestions = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('reporting in the same turn the learner answered', () => {
        function setupAnswer(overrides) {
            document.body.innerHTML = `
                <div id="quextMainContainer-0">
                    <div id="quextPShowClue-0"></div>
                    <div id="quextRepeatActivity-0"></div>
                </div>`;
            $quickquestions.initialScore = '';
            $quickquestions.options[0] = Object.assign(
                {
                    id: 0,
                    isScorm: 1,
                    repeatActivity: true,
                    gameStarted: true,
                    gameActived: true,
                    gameOver: false,
                    hits: 1,
                    errors: 0,
                    scoreGame: 1,
                    scoreTotal: 4,
                    numberQuestions: 4,
                    activeQuestion: 0,
                    activeCounter: true,
                    useLives: false,
                    livesLeft: 3,
                    obtainedClue: false,
                    question: { solution: 1 },
                    itinerary: { showClue: false, percentageClue: 0 },
                    msgs: { msgInformation: 'info', msgYouScore: 'Score' },
                },
                overrides
            );
            vi.spyOn($quickquestions, 'updateScore').mockImplementation(() => {});
            vi.spyOn($quickquestions, 'sendScore').mockImplementation(() => {});
            vi.spyOn($quickquestions, 'newQuestion').mockImplementation(() => {});
            vi.spyOn($quickquestions, 'showMessage').mockImplementation(() => {});
        }

        it('reports before the reveal timer runs, not after it', () => {
            vi.useFakeTimers();
            setupAnswer();

            $quickquestions.answerQuestion(1, 0);

            // No timer has been advanced: the report has to have gone out.
            expect($quickquestions.sendScore).toHaveBeenCalledWith(true, 0);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('does not report outside automatic SCORM mode', () => {
            vi.useFakeTimers();
            setupAnswer({ isScorm: 0 });

            $quickquestions.answerQuestion(1, 0);

            expect($quickquestions.sendScore).not.toHaveBeenCalled();

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // An intermediate answer must not close the attempt: the page would go
        // to passed/failed while the learner is still playing.
        it('leaves the activity unfinished while questions remain', () => {
            vi.useFakeTimers();
            setupAnswer({ activeQuestion: 0, numberQuestions: 4 });

            $quickquestions.answerQuestion(1, 0);

            expect($quickquestions.options[0].gameOver).toBe(false);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // The last answer must carry the completion, so leaving during the
        // reveal delay still records a finished activity.
        it('marks the activity finished on the last question, before reporting', () => {
            vi.useFakeTimers();
            setupAnswer({ activeQuestion: 3, numberQuestions: 4 });
            let flagWhenReported;
            $quickquestions.sendScore.mockImplementation(() => {
                flagWhenReported = $quickquestions.options[0].gameOver;
            });

            $quickquestions.answerQuestion(1, 0);

            expect(flagWhenReported).toBe(true);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // Running out of lives ends the attempt just as running out of
        // questions does.
        it('marks the activity finished when the last life is lost', () => {
            vi.useFakeTimers();
            setupAnswer({ useLives: true, livesLeft: 0 });

            $quickquestions.answerQuestion(1, 0);

            expect($quickquestions.options[0].gameOver).toBe(true);

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
            $quickquestions.options[0].initialScore = '5.00';

            $quickquestions.saveScormScore(0);

            expect($quickquestions.sendScore).toHaveBeenCalledWith(true, 0);
        });

        it('saveScormScore reports only in automatic SCORM mode', () => {
            setupAnswer({ isScorm: 1 });
            $quickquestions.saveScormScore(0);
            expect($quickquestions.sendScore).toHaveBeenCalledWith(true, 0);

            $quickquestions.sendScore.mockClear();
            $quickquestions.options[0].isScorm = 2;
            $quickquestions.saveScormScore(0);
            expect($quickquestions.sendScore).not.toHaveBeenCalled();
        });

        it('clears the previous game-over flag before reporting a replay start', () => {
            document.body.innerHTML = '<div id="quextGameContainer-0"><div class="QXTP-StartGame"></div></div>';
            $quickquestions.options[0] = {
                gameStarted: false,
                gameOver: true,
                scoreGame: 8,
                obtainedClue: true,
                hits: 3,
                errors: 1,
                score: 8,
                gameActived: true,
                activeQuestion: 3,
                validQuestions: 4,
                numberQuestions: 4,
                counter: 10,
                useLives: false,
                numberLives: 3,
                livesLeft: 0,
            };
            let flagWhenReported;
            vi.spyOn($quickquestions, 'updateLives').mockImplementation(() => {});
            vi.spyOn($quickquestions, 'uptateTime').mockImplementation(() => {});
            vi.spyOn($quickquestions, 'newQuestion').mockImplementation(() => {});
            vi.spyOn($quickquestions, 'saveScormScore').mockImplementation(() => {
                flagWhenReported = $quickquestions.options[0].gameOver;
            });

            $quickquestions.startGame(0);

            expect(flagWhenReported).toBe(false);
            expect($quickquestions.options[0].gameOver).toBe(false);
        });
    });

    // The editor never reloads the document between pages, and a game's ids
    // are numbered by position: the next page's first game takes the ids this
    // one had. Each clock used to find that game by id and run it — the game
    // clock counting down on its display and moving it on to the next
    // question, the video clocks driving its player.
    describe('the clocks of a game', () => {
        const instance = 0;

        /** The author moves to another page, whose first game is numbered the same. */
        function moveToNextPage(options) {
            document.body.innerHTML = `<div id="quextMainContainer-${instance}"></div>`;
            $quickquestions.options[instance] = options;
        }

        beforeEach(() => {
            vi.useFakeTimers();
            document.body.innerHTML = `<div id="quextMainContainer-${instance}"></div>`;
            $quickquestions.options = [
                {
                    gameStarted: false,
                    numberQuestions: 1,
                    numberLives: 3,
                    localPlayer: { play: vi.fn() },
                    localPlayerIntro: { play: vi.fn() },
                },
            ];
            for (const method of [
                'updateLives',
                'uptateTime',
                'updateSoundVideo',
                'saveScormScore',
                'newQuestion',
                'drawSolution',
                'updateTimerDisplayLocal',
                'updateTimerDisplayLocalIntro',
            ]) {
                vi.spyOn($quickquestions, method).mockImplementation(() => {});
            }
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        /** Start the game and put its first question on the clock, as newQuestion does. */
        function startGame() {
            $quickquestions.startGame(instance);
            Object.assign($quickquestions.options[instance], { activeCounter: true, counter: 30 });
        }

        it('counts down on its own game', () => {
            startGame();

            vi.advanceTimersByTime(3000);

            expect($quickquestions.uptateTime).toHaveBeenLastCalledWith(27, instance);
        });

        it("leaves the next page's game alone, though it takes the same ids", () => {
            startGame();
            vi.advanceTimersByTime(1000);

            moveToNextPage({ gameStarted: true, activeCounter: true, counter: 30 });
            $quickquestions.uptateTime.mockClear();
            $quickquestions.newQuestion.mockClear();
            vi.advanceTimersByTime(60000);

            expect($quickquestions.uptateTime).not.toHaveBeenCalled();
            expect($quickquestions.newQuestion).not.toHaveBeenCalled();
            expect($quickquestions.options[instance].counter).toBe(30);
        });

        it("stops following a question's video once its game leaves the page", () => {
            $quickquestions.startVideo('clip.mp4', 0, 10, instance, 1);
            vi.advanceTimersByTime(1000);
            expect($quickquestions.updateTimerDisplayLocal).toHaveBeenCalledTimes(1);

            moveToNextPage({ localPlayer: { play: vi.fn() } });
            vi.advanceTimersByTime(5000);

            expect($quickquestions.updateTimerDisplayLocal).toHaveBeenCalledTimes(1);
        });

        it('stops following the introduction video once its game leaves the page', () => {
            $quickquestions.startVideoIntro('intro.mp4', 0, 10, instance, 1);
            vi.advanceTimersByTime(1000);
            expect($quickquestions.updateTimerDisplayLocalIntro).toHaveBeenCalledTimes(1);

            moveToNextPage({ localPlayerIntro: { play: vi.fn() } });
            vi.advanceTimersByTime(5000);

            expect($quickquestions.updateTimerDisplayLocalIntro).toHaveBeenCalledTimes(1);
        });

        it('stops while the page is being edited', () => {
            startGame();
            document.body.insertAdjacentHTML('beforeend', '<div id="node-content" mode="edition"></div>');

            vi.advanceTimersByTime(3000);

            expect($quickquestions.uptateTime).not.toHaveBeenCalledWith(29, instance);
        });
    });
});

describe('quick-questions minimum score notice', () => {
    it('asks for the notice right after its interface replaces the stored data', () => {
        const source = readFileSync(join(__dirname, 'quick-questions.js'), 'utf-8');
        const loadGame = source.slice(source.indexOf('loadGame: function'));

        // The main container comes with the interface, so from that line on the
        // notice can go right before it, below the instructions.
        expect(loadGame).toMatch(
            /mOption\.main = [^\n]+[\s\S]*?dl\.before\(\w+\)\.remove\(\);\s*\$exeDevices\.iDevice\.gamification\.report\.showPassScoreNotice\(mOption\);/
        );
    });
});
