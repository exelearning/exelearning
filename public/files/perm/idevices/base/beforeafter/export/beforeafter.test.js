/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeBeforeAfter\s*=/, 'global.$eXeBeforeAfter =')
        .replace(/\$\(function\s*\(\)\s*\{\s*\$eXeBeforeAfter\.init\(\);\s*\}\);?/g, '');

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeBeforeAfter;
}

describe('beforeafter iDevice export', () => {
    let $eXeBeforeAfter;
    let originalColors;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
        global.$eXeBeforeAfter = undefined;
        originalColors = global.$exeDevices.iDevice.gamification.colors;
        originalReport = global.$exeDevices.iDevice.gamification.report;
        originalSendScoreNew = global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;

        global.$exeDevices.iDevice.gamification.colors = {
            backColor: {
                black: '#000000',
                white: '#ffffff',
            },
            borderColors: {
                blue: '#3334a1',
                green: '#006641',
                red: '#a2241a',
                yellow: '#f3d55a',
            },
        };
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();

        const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');
        $eXeBeforeAfter = loadExportIdevice(code);
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.colors = originalColors;
        global.$exeDevices.iDevice.gamification.report = originalReport;
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = originalSendScoreNew;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('does not register unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');

        expect(code).not.toMatch(/beforeunload|unload\.eXeBeforeAfter|endScorm/);
    });

    it('coerces legacy manual SCORM mode (2) to automatic (1) at load', () => {
        const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');

        // beforeafter is auto-only (no manual save button); loadDataGame normalizes
        // legacy manual data to automatic via the shared helper.
        expect(code).toContain('gamification.scorm.normalizeMode(mOptions.isScorm)');
    });

    it('sends the SCORM score from the visited cards', () => {
        $eXeBeforeAfter.options[0] = {
            cardsGame: [{}, {}, {}, {}],
            gameOver: false,
            gameStarted: true,
            visiteds: 1,
        };

        $eXeBeforeAfter.sendScore(true, 0);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: false,
                gameStarted: true,
                scorerp: 5,
            }),
        );
    });

    it('starts the game and saves the initial SCORM score', () => {
        document.body.innerHTML = `
            <div id="bfafCubierta-0"></div>
            <button id="bfafStartGame-0"></button>
        `;
        $eXeBeforeAfter.options[0] = {
            cardsGame: [{}, {}],
            gameOver: true,
            gameStarted: false,
            isScorm: 1,
            itinerary: {
                showClue: false,
            },
            msgs: {},
            obtainedClue: true,
            score: 10,
            visiteds: 0,
        };
        vi.spyOn($eXeBeforeAfter, 'showClue').mockImplementation(() => {});

        $eXeBeforeAfter.startGame(0);

        expect($eXeBeforeAfter.options[0]).toEqual(
            expect.objectContaining({
                gameOver: false,
                gameStarted: true,
                hits: 0,
                obtainedClue: false,
                scorerp: 5,
                score: 0,
            }),
        );
        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: false,
                gameStarted: true,
                scorerp: 5,
            }),
        );
        expect(global.$exeDevices.iDevice.gamification.report.saveEvaluation).toHaveBeenCalledWith(
            expect.objectContaining({
                scorerp: 5,
            }),
            expect.any(Boolean),
        );
    });

    it('marks a single-image before/after as completed on start (all slides visited)', () => {
        document.body.innerHTML = `
            <div id="bfafCubierta-0"></div>
            <button id="bfafStartGame-0"></button>
        `;
        $eXeBeforeAfter.options[0] = {
            cardsGame: [{}],
            gameOver: false,
            gameStarted: false,
            isScorm: 1,
            itinerary: { showClue: false },
            msgs: {},
            visiteds: 0,
        };
        vi.spyOn($eXeBeforeAfter, 'showClue').mockImplementation(() => {});

        $eXeBeforeAfter.startGame(0);

        expect($eXeBeforeAfter.options[0].gameOver).toBe(true);
    });

    describe('completion derived from visited slides (not current position)', () => {
        it('allSlidesVisited is true once the furthest slide reached is the last', () => {
            expect(
                $eXeBeforeAfter.allSlidesVisited({ visiteds: 0, cardsGame: [{}, {}] }),
            ).toBe(false);
            expect(
                $eXeBeforeAfter.allSlidesVisited({ visiteds: 1, cardsGame: [{}, {}] }),
            ).toBe(true);
        });

        it('sendScore finalizes when every slide was visited (2-card first-click case)', () => {
            // The last slide was reached on the same gesture that started the
            // game, so showImage never set gameOver. sendScore must still finalize.
            $eXeBeforeAfter.options[0] = {
                cardsGame: [{}, {}],
                gameOver: false,
                gameStarted: true,
                isScorm: 1,
                visiteds: 1,
                msgs: {},
            };

            $eXeBeforeAfter.sendScore(true, 0);

            expect($eXeBeforeAfter.options[0].gameOver).toBe(true);
            expect(
                global.$exeDevices.iDevice.gamification.scorm.sendScoreNew,
            ).toHaveBeenCalledWith(
                true,
                expect.objectContaining({ gameOver: true, scorerp: 10 }),
            );
        });

        it('finalizes regardless of the slide the learner is on when sending', () => {
            // All slides visited but the learner navigated back to slide 0.
            $eXeBeforeAfter.options[0] = {
                cardsGame: [{}, {}, {}],
                active: 0,
                gameOver: false,
                gameStarted: true,
                isScorm: 1,
                visiteds: 2,
                msgs: {},
            };

            $eXeBeforeAfter.sendScore(true, 0);

            expect($eXeBeforeAfter.options[0].gameOver).toBe(true);
        });

        it('does not finalize before the game has started (edition/preview safe)', () => {
            $eXeBeforeAfter.options[0] = {
                cardsGame: [{}],
                gameOver: false,
                gameStarted: false,
                isScorm: 1,
                visiteds: 0,
                msgs: {},
            };

            $eXeBeforeAfter.sendScore(true, 0);

            expect($eXeBeforeAfter.options[0].gameOver).toBe(false);
        });

        it('saveEvaluation also derives completion from the visited slides', () => {
            $eXeBeforeAfter.options[0] = {
                cardsGame: [{}, {}],
                gameOver: false,
                gameStarted: true,
                visiteds: 1,
                msgs: {},
            };

            $eXeBeforeAfter.saveEvaluation(0);

            expect($eXeBeforeAfter.options[0].gameOver).toBe(true);
        });
    });

    it('completes only when the last image is shown', () => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <img id="bfafpImageAfter-0"><img id="bfafpImageBefore-0">
            <div id="bfafpContainerBA-0"></div>
        `;
        const card = {
            vertical: false,
            description: '',
            alt: '',
            altBk: '',
            eText: '',
            eTextBk: '',
            position: 50,
            url: 'a',
            urlBk: 'b',
        };
        $eXeBeforeAfter.options[0] = {
            cardsGame: [{ ...card }, { ...card }],
            gameStarted: true,
            gameOver: false,
            isScorm: 0,
            visiteds: 0,
            msgs: { msgImage: 'Image' },
        };
        vi.spyOn($eXeBeforeAfter, 'saveEvaluation').mockImplementation(() => {});
        vi.spyOn($eXeBeforeAfter, 'showClue').mockImplementation(() => {});
        vi.spyOn($eXeBeforeAfter, 'initComparison').mockImplementation(() => {});

        // An intermediate image keeps the activity incomplete.
        $eXeBeforeAfter.showImage(0, 0);
        expect($eXeBeforeAfter.options[0].gameOver).toBe(false);

        // Reaching the last image completes it.
        $eXeBeforeAfter.showImage(1, 0);
        expect($eXeBeforeAfter.options[0].gameOver).toBe(true);

        vi.clearAllTimers();
        vi.useRealTimers();
    });
});
