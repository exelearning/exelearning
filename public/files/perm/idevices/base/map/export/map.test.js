/**
 * Unit tests for the map iDevice (export/runtime).
 *
 * Two concerns share this file:
 *
 * - Regression coverage for issue #2272: createInterfaceMapa and
 *   answerTPQuestion can run when options[instance] or the active map/point/
 *   question data is gone (activity torn down, stale event handlers). They
 *   must bail out instead of crashing (Sentry: reading 'msgs' / 'solution'
 *   of undefined).
 * - The completion signal the LMS depends on. The map has several modes and
 *   only one of them lacked an end condition: exposition (evaluationG 0),
 *   where the learner just visits points and there is no quiz to finish.
 *   Every other mode ends through `gameOver()`, which raises the flag before
 *   it reports. The completion signal is separate from the score — the
 *   runtime decides `passed` from what the activity reports as finished, not
 *   from the number it reports.
 *
 * The export declares `var $eXeMapa`; it is rewired to a global and the
 * auto-init call is stripped so importing has no side effects. Real jQuery
 * + happy-dom (from vitest.setup.js) back the DOM.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExport() {
    const code = readFileSync(join(__dirname, 'map.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXeMapa\s*=/, 'global.$eXeMapa =');
    modified = modified.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeMapa\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXeMapa;
}

/**
 * Swap one member of the shared gamification mock for the duration of a test.
 *
 * @param {string} name member of `$exeDevices.iDevice.gamification`
 * @param {*} value replacement
 * @returns {Function} restores the previous value (deleting it if it did not exist)
 */
function swapGamification(name, value) {
    const gamification = global.$exeDevices.iDevice.gamification;
    const had = Object.prototype.hasOwnProperty.call(gamification, name);
    const previous = gamification[name];
    gamification[name] = value;
    return () => {
        if (had) {
            gamification[name] = previous;
        } else {
            delete gamification[name];
        }
    };
}

describe('map iDevice export — runtime guards (#2272)', () => {
    let m;
    const instance = 0;

    beforeEach(() => {
        global.$eXeMapa = undefined;
        m = loadExport();
        m.options = [];
        document.body.innerHTML = '';
        global.$exeDevices.iDevice.gamification.media = {
            stopSound: vi.fn(),
            playSound: vi.fn(),
        };
    });

    afterEach(() => {
        delete global.$eXeMapa;
        delete global.$exeDevices.iDevice.gamification.media;
        vi.useRealTimers();
    });

    describe('createInterfaceMapa', () => {
        it('returns an empty interface without throwing when options[instance] is gone', () => {
            let html;
            expect(() => {
                html = m.createInterfaceMapa(instance);
            }).not.toThrow();
            expect(html).toBe('');
        });

        it('builds the interface when options are present (positive path)', () => {
            m.idevicePath = '/idevices/map/';
            m.options[instance] = {
                msgs: {
                    msgGoActivity: 'Go to activity',
                    msgClue: 'Clue',
                    msgPlayStart: 'Start',
                    msgCheck: 'Check',
                    msgAudio: 'Audio',
                    msgReturn: 'Return',
                    msgHome: 'Home',
                },
            };
            // Sub-builders assemble unrelated markup; keep the test focused.
            for (const fn of [
                'getToolBar',
                'getDetailSound',
                'getToolTip',
                'getDetailMedia',
                'getModalMessage',
                'getTPQuestions',
                'getDetailTest',
                'getTestGame',
            ]) {
                m[fn] = () => '';
            }
            global.$exeDevices.iDevice.gamification.scorm.addButtonScoreNew = vi.fn(() => '');
            const html = m.createInterfaceMapa(instance);
            expect(html).toContain(`mapaMainContainer-${instance}`);
            expect(html).toContain('Start');
        });
    });

    describe('answerTPQuestion', () => {
        it('returns early without throwing when options[instance] is gone', () => {
            expect(() => m.answerTPQuestion(instance)).not.toThrow();
        });

        it('returns early without throwing when the active point is gone', () => {
            m.options[instance] = {
                gameActived: true,
                activeMap: { pts: [], active: 0 },
            };
            expect(() => m.answerTPQuestion(instance)).not.toThrow();
        });

        it('returns early without throwing when the active question is gone', () => {
            m.options[instance] = {
                gameActived: true,
                activeMap: {
                    pts: [{ tests: [], activeTest: 0, respuesta: 'A' }],
                    active: 0,
                },
            };
            expect(() => m.answerTPQuestion(instance)).not.toThrow();
        });

        it('answers a target-point question normally when data is present (positive path)', () => {
            vi.useFakeTimers();
            const q = { solution: 'A', typeSelect: 0 };
            const p = { tests: [q], activeTest: 0, respuesta: 'a' };
            m.options[instance] = {
                gameActived: true,
                activeMap: { pts: [p], active: 0 },
                msgs: {},
            };
            m.updateTPScore = vi.fn(() => 'well done');
            m.drawTPSolution = vi.fn();
            m.showTPMessage = vi.fn();
            m.newTPQuestion = vi.fn();

            expect(() => m.answerTPQuestion(instance)).not.toThrow();

            expect(m.options[instance].gameActived).toBe(false);
            expect(m.updateTPScore).toHaveBeenCalledWith(true, instance);
            expect(m.drawTPSolution).toHaveBeenCalledWith(instance);
            expect(m.showTPMessage).toHaveBeenCalledWith(2, 'well done', instance);
            vi.runAllTimers();
            expect(m.newTPQuestion).toHaveBeenCalledWith(instance, true, false);
        });
    });
});

describe('map iDevice export — completion signal', () => {
    let m;
    let calls;
    let restoreScorm;
    let restoreReport;

    beforeEach(() => {
        global.$eXeMapa = undefined;
        calls = [];
        // Record what the activity reports to the runtime instead of the shared mock.
        restoreScorm = swapGamification('scorm', {
            sendScoreNew: (auto, game) => calls.push({ auto, game }),
        });
        restoreReport = swapGamification('report', { saveEvaluation: () => {} });
        m = loadExport();
    });

    afterEach(() => {
        restoreReport();
        restoreScorm();
        delete global.$eXeMapa;
        vi.useRealTimers();
    });

    /**
     * Minimal instance state for the exposition mode: `sendScore` only reads the mode,
     * how many points count towards the score, and which point ids have been opened.
     *
     * @param {string[]} visiteds ids of the points the learner has opened, in order
     * @param {number} points how many points the activity scores over
     * @returns {number} the instance index to pass to sendScore
     */
    function givenExposition(visiteds, points) {
        m.options = [{ evaluationG: 0, numberQuestions: points, visiteds, gameOver: false, msgs: {} }];
        return 0;
    }

    describe('reporting when the learner presses start', () => {
        /**
         * Minimal state for a map waiting on its start button.
         *
         * @param {number} evaluationG the game mode
         * @returns {number} the instance index
         */
        function givenWaitingToStart(evaluationG) {
            const instance = 0;
            document.body.innerHTML = `
                <div id="mapaMainContainer-${instance}">
                    <div id="mapaCheckOrder-${instance}"></div>
                    <div id="mapaMessageFindP-${instance}"></div>
                    <div id="mapaStartGame-${instance}"></div>
                </div>`;
            m.options[instance] = {
                main: `mapaMainContainer-${instance}`,
                isScorm: 1,
                evaluationG,
                gameStarted: false,
                gameOver: false,
                hits: 0,
                errors: 0,
                score: 0,
                numberQuestions: 4,
                order: [],
                msgs: { msgYouScore: 'Score' },
            };
            // Paints the first prompt of the identify/find modes from the
            // shuffled title deck; irrelevant to the report.
            vi.spyOn(m, 'showFind').mockImplementation(() => {});
            return instance;
        }

        afterEach(() => {
            vi.restoreAllMocks();
        });

        // The defect: pressing start revealed the interface and told the LMS
        // nothing, so its menu kept the previous attempt's grade and status
        // until the learner answered.
        it.each([
            ['Identify', 2],
            ['Find', 3],
            ['Quiz', 4],
            ['Order', 5],
        ])('publishes a zero on start in %s mode', (_name, evaluationG) => {
            m.startGame(givenWaitingToStart(evaluationG));

            expect(calls).toHaveLength(1);
            expect(calls[0].auto).toBe(true);
            // Raw, not formatted: the recording mock stands in for the runtime,
            // and it is common.js that rounds a report on the way out.
            expect(calls[0].game.scorerp).toBe(0);
            // Starting is not finishing.
            expect(calls[0].game.gameOver).toBe(false);
            expect(calls[0].game.gameStarted).toBe(true);
        });

        it('does not report outside automatic SCORM mode', () => {
            const i = givenWaitingToStart(2);
            m.options[i].isScorm = 2;

            m.startGame(i);

            expect(calls).toHaveLength(0);
        });
    });

    describe('sendScore in exposition mode', () => {
        it('reports progress as a fraction of the points visited', () => {
            m.sendScore(true, givenExposition(['p1'], 4));

            expect(calls).toHaveLength(1);
            expect(calls[0].game.scorerp).toBe('2.50');
        });

        it('does not mark the activity finished while points remain unvisited', () => {
            m.sendScore(true, givenExposition(['p1', 'p2', 'p3'], 4));

            expect(calls[0].game.gameOver).toBe(false);
        });

        it('does not let repeat visits to the same point finish the activity early', () => {
            // Three opens, but only two distinct points: still not over.
            m.sendScore(true, givenExposition(['p1', 'p2', 'p1'], 4));

            expect(calls[0].game.scorerp).toBe('5.00');
            expect(calls[0].game.gameOver).toBe(false);
        });

        it('marks the activity finished on the last point, so the page can be passed', () => {
            // 4 of 4 visited: score 10 of 10, and the activity is over. Without the flag the
            // page stays `incomplete` in the LMS at 100%.
            m.sendScore(true, givenExposition(['p1', 'p2', 'p3', 'p4'], 4));

            expect(calls[0].game.scorerp).toBe('10.00');
            expect(calls[0].game.gameOver).toBe(true);
        });

        it('stays unfinished when the activity scores over no points at all', () => {
            // A zero denominator makes the score non-finite; that is a broken activity, not a
            // completed one, so it must never report itself as finished.
            m.sendScore(true, givenExposition(['p1'], 0));

            expect(calls[0].game.gameOver).toBe(false);
        });
    });

    describe('sendScore in the quiz modes', () => {
        it('never invents completion, even on a perfect intermediate report', () => {
            // Identify mode (2) ends through gameOver(), not through a report. A report with
            // every hit in hand is still just a report: completing here would pass the page
            // while the learner is mid-activity.
            m.options = [
                {
                    evaluationG: 2,
                    numberQuestions: 4,
                    hits: 4,
                    visiteds: [],
                    gameOver: false,
                    msgs: {},
                },
            ];

            m.sendScore(true, 0);

            expect(calls[0].game.scorerp).toBe(10);
            expect(calls[0].game.gameOver).toBe(false);
        });
    });

    describe('gameOver', () => {
        it('raises the flag before it reports, so quiz modes complete', () => {
            vi.useFakeTimers();
            m.options = [
                {
                    evaluationG: 2,
                    numberQuestions: 4,
                    hits: 4,
                    errors: 0,
                    visiteds: [],
                    gameOver: false,
                    isScorm: 1,
                    msgs: {},
                    activeMap: { pts: [{ type: 0, id: 'p1' }], active: 0 },
                },
            ];

            m.gameOver(0);

            expect(calls).toHaveLength(1);
            expect(calls[0].auto).toBe(true);
            expect(calls[0].game.gameOver).toBe(true);
        });
    });

    // The access code stood in for nothing: it dismissed its own dialog and
    // left the LMS holding the previous attempt's grade. What it should do
    // depends on the mode, because only four of them have a start link.
    describe('opening the map with an access code', () => {
        /**
         * A covered map waiting on its code, in the given mode.
         *
         * @param {number} evaluationG the game mode
         * @param {string} typed what the learner puts in the code field
         * @returns {number} the instance index
         */
        function givenCodedMap(evaluationG, typed) {
            const instance = 0;
            document.body.innerHTML = `
                <div id="mapaMainContainer-${instance}">
                    <div id="mapaCheckOrder-${instance}"></div>
                    <div id="mapaMessageFindP-${instance}"></div>
                    <div id="mapaStartGame-${instance}"></div>
                    <div id="mapaMesajeAccesCodeE-${instance}"></div>
                    <input id="mapaCodeAccessE-${instance}" value="${typed}" />
                </div>`;
            m.options[instance] = {
                main: `mapaMainContainer-${instance}`,
                isScorm: 1,
                evaluationG,
                // Visited points and quiz are live from load; the rest wait
                // for their start link (loadDataGame decides this).
                gameStarted: evaluationG === 0 || evaluationG === 4,
                gameOver: false,
                showData: true,
                hits: 0,
                errors: 0,
                score: 0,
                numberQuestions: 4,
                visiteds: [],
                order: [],
                itinerary: { codeAccess: 'abre' },
                msgs: { msgYouScore: 'Score' },
            };
            vi.spyOn(m, 'hideCover').mockImplementation(() => {});
            vi.spyOn(m, 'showFind').mockImplementation(() => {});
            return instance;
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        // Visited points has no start link — the map is already live — so the
        // code is the only explicit opening the learner ever gives it.
        it('publishes a zero and an unfinished attempt in visited-points mode', () => {
            m.enterCodeAccess(givenCodedMap(0, 'abre'));

            expect(calls).toHaveLength(1);
            expect(calls[0].auto).toBe(true);
            expect(Number(calls[0].game.scorerp)).toBe(0);
            expect(calls[0].game.gameOver).toBe(false);
        });

        // The modes that carry the link: the code has to do its job, which is
        // more than reporting — each mode's board is set up in startGame.
        it.each([
            ['Identify Spot', 1],
            ['Identify', 2],
            ['Find', 3],
            ['Order', 5],
        ])('presses start for the learner in %s mode', (_name, evaluationG) => {
            const i = givenCodedMap(evaluationG, 'abre');
            vi.spyOn(m, 'startGame');

            m.enterCodeAccess(i);

            expect(m.startGame).toHaveBeenCalledWith(i);
            expect(m.options[i].gameStarted).toBe(true);
            expect(calls).toHaveLength(1);
            expect(calls[0].game.gameOver).toBe(false);
        });

        it('reports nothing when the code is wrong', () => {
            const i = givenCodedMap(0, 'nope');

            m.enterCodeAccess(i);

            expect(calls).toHaveLength(0);
            expect($(`#mapaCodeAccessE-${i}`).val()).toBe('');
        });

        it('does not auto-report in manual SCORM mode', () => {
            const i = givenCodedMap(0, 'abre');
            m.options[i].isScorm = 2;

            m.enterCodeAccess(i);

            expect(calls).toHaveLength(0);
        });
    });
});
