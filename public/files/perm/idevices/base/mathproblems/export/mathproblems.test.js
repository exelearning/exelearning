/**
 * Unit tests for the mathproblems iDevice (export/runtime).
 *
 * common.js derives completion from `gameOver === true || auto !== true`, and
 * updateScore reports automatically, so without the flag a page carrying a
 * mathproblems stayed `incomplete` in the LMS however well the learner did:
 * the gameOver() that runs after the reveal delay comes too late for the
 * report that carries the final score.
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
        .replace(/var\s+\$eXeMathProblems\s*=/, 'global.$eXeMathProblems =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$eXeMathProblems\.init\(\);\s*\}\);?/g,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeMathProblems;
}

describe('mathproblems iDevice export', () => {
    let $eXeMathProblems;

    beforeEach(() => {
        global.$eXeMathProblems = undefined;
        const code = readFileSync(join(__dirname, 'mathproblems.js'), 'utf-8');
        $eXeMathProblems = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('completion on the last question', () => {
        function setupAnswer(overrides) {
            document.body.innerHTML = `
                <div id="mthpMainContainer-0">
                    <div id="mthpPHits-0"></div>
                    <div id="mthpPErrors-0"></div>
                    <div id="mthpPScore-0"></div>
                    <div id="mthpRepeatActivity-0"></div>
                </div>`;
            $eXeMathProblems.initialScore = '';
            $eXeMathProblems.options[0] = Object.assign(
                {
                    id: 0,
                    isScorm: 1,
                    scorm: { repeatActivity: true },
                    gameOver: false,
                    hits: 2,
                    errors: 0,
                    numberQuestions: 3,
                    obtainedClue: false,
                    itinerary: { showClue: false, percentageClue: 0, clueGame: '' },
                    msgs: { msgYouScore: 'Score', msgInformation: 'info' },
                },
                overrides
            );
            vi.spyOn($eXeMathProblems, 'getMessageAnswer').mockReturnValue('');
            vi.spyOn($eXeMathProblems, 'sendScore').mockImplementation(() => {});
            vi.spyOn($eXeMathProblems, 'showMessage').mockImplementation(() => {});
            vi.spyOn($eXeMathProblems, 'saveEvaluation').mockImplementation(() => {});
        }

        it('marks the activity finished when no questions are left', () => {
            // 2 hits + this one = 3 of 3.
            setupAnswer({ hits: 2, errors: 0, numberQuestions: 3 });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(true);
        });

        // Running out of questions through errors ends the attempt just the same.
        it('marks it finished when the last question is answered wrongly', () => {
            setupAnswer({ hits: 1, errors: 1, numberQuestions: 3 });

            $eXeMathProblems.updateScore(false, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(true);
        });

        // An intermediate answer must not close the attempt: the page would go
        // to passed/failed while the learner is still playing.
        it('leaves the activity unfinished while questions remain', () => {
            setupAnswer({ hits: 0, errors: 0, numberQuestions: 3 });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.options[0].gameOver).toBe(false);
        });

        it('raises the flag before it reports, so the two cannot disagree', () => {
            setupAnswer({ hits: 2, errors: 0, numberQuestions: 3 });
            let flagWhenReported;
            $eXeMathProblems.sendScore.mockImplementation(() => {
                flagWhenReported = $eXeMathProblems.options[0].gameOver;
            });

            $eXeMathProblems.updateScore(true, 0);

            expect($eXeMathProblems.sendScore).toHaveBeenCalledWith(true, 0);
            expect(flagWhenReported).toBe(true);
        });
    });

    // The editor never reloads the document between pages, and a game's ids
    // are numbered by position: the next page's first game takes the ids this
    // one had. The clock used to find that game by id and run it, counting
    // down on its display and answering its question when its own time ran
    // out.
    describe('the clock of a game', () => {
        const instance = 0;

        beforeEach(() => {
            vi.useFakeTimers();
            document.body.innerHTML = `<div id="mthpMainContainer-${instance}"></div>`;
            $eXeMathProblems.options = [{ gameStarted: false, questions: [{}] }];
            for (const method of ['updateGameBoard', 'uptateTime', 'newQuestion', 'answerQuestion', 'gameOver']) {
                vi.spyOn($eXeMathProblems, method).mockImplementation(() => {});
            }
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        /** Start the game and put its first problem on the clock, as newQuestion does. */
        function startGame() {
            $eXeMathProblems.startGame(instance);
            Object.assign($eXeMathProblems.options[instance], { activeCounter: true, counter: 30 });
        }

        it('counts down on its own game', () => {
            startGame();

            vi.advanceTimersByTime(3000);

            expect($eXeMathProblems.uptateTime).toHaveBeenLastCalledWith(27, instance);
        });

        it('answers its own problem when the time runs out', () => {
            startGame();

            vi.advanceTimersByTime(30000);

            expect($eXeMathProblems.answerQuestion).toHaveBeenCalledWith(instance);
        });

        it("leaves the next page's game alone, though it takes the same ids", () => {
            startGame();
            vi.advanceTimersByTime(1000);

            // The author moves to another page, whose first game is numbered the same.
            document.body.innerHTML = `<div id="mthpMainContainer-${instance}"></div>`;
            $eXeMathProblems.options[instance] = { gameStarted: true, activeCounter: true, counter: 30 };
            $eXeMathProblems.uptateTime.mockClear();
            vi.advanceTimersByTime(60000);

            expect($eXeMathProblems.uptateTime).not.toHaveBeenCalled();
            expect($eXeMathProblems.answerQuestion).not.toHaveBeenCalled();
            expect($eXeMathProblems.options[instance].counter).toBe(30);
        });
    });
});

describe('mathproblems minimum score notice', () => {
    it('asks for the notice right after its interface replaces the stored data', () => {
        const source = readFileSync(join(__dirname, 'mathproblems.js'), 'utf-8');
        const loadGame = source.slice(source.indexOf('loadGame: function'));

        // The main container comes with the interface, so from that line on the
        // notice can go right before it, below the instructions.
        expect(loadGame).toMatch(
            /mOption\.main = [^\n]+[\s\S]*?dl\.before\(\w+\)\.remove\(\);\s*\$exeDevices\.iDevice\.gamification\.report\.showPassScoreNotice\(mOption\);/
        );
    });
});
