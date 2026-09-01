/**
 * Unit tests for the periodic-table iDevice (export/runtime).
 *
 * The timed game used to end by calling $periodicTable.checkAnswers(), a
 * function that exists nowhere in this iDevice. The interval threw a
 * TypeError instead, so a game whose clock ran out never finished, never
 * reported a score and left the SCO incomplete.
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
        .replace(/var\s+\$periodicTable\s*=/, 'global.$periodicTable =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$periodicTable\.init\(\);\s*\}\);?/g,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$periodicTable;
}

describe('periodic-table iDevice export', () => {
    let $periodicTable;

    beforeEach(() => {
        global.$periodicTable = undefined;
        const code = readFileSync(join(__dirname, 'periodic-table.js'), 'utf-8');
        $periodicTable = loadExportIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('running out of time', () => {
        let previousReport;

        afterEach(() => {
            if (previousReport !== undefined) {
                global.$exeDevices.iDevice.gamification.report = previousReport;
                previousReport = undefined;
            }
        });

        function setupTimedGame() {
            document.body.innerHTML = `
                <div id="ptMainContainer-0">
                    <div id="ptGameContainer-0">
                        <span class="exeQuextIcons-Time"></span>
                    </div>
                    <div id="ptPTime-0"></div>
                    <div id="ptShowClue-0"></div>
                    <div id="ptStartGameDiv-0"></div>
                    <div id="ptStartGameMobileDiv-0"></div>
                    <div id="ptImageMobile-0"></div>
                    <div id="ptPShowClue-0"></div>
                    <div id="ptMessageDiv-0"></div>
                    <div id="ptQuestionP-0"></div>
                    <div id="ptRepeatActivity-0"></div>
                </div>`;
            $periodicTable.options[0] = {
                id: 0,
                gameStarted: false,
                gameOver: false,
                hits: 0,
                number: 4,
                attempts: 0,
                elements: [],
                time: 1,
                isScorm: 0,
                itinerary: { showClue: false },
                msgs: { msgGameOver: '%s %s %s', msgYouScore: 'Score' },
            };
            vi.spyOn($periodicTable, 'getRandomElements').mockReturnValue([]);
            vi.spyOn($periodicTable, 'elements_dataf').mockReturnValue([
                { number: 1, name: 'H', symbol: 'H', group: '1' },
                { number: 2, name: 'He', symbol: 'He', group: '18' },
                { number: 3, name: 'Li', symbol: 'Li', group: '1' },
                { number: 4, name: 'Be', symbol: 'Be', group: '2' },
                { number: 5, name: 'B', symbol: 'B', group: '13' },
            ]);
            vi.spyOn($periodicTable, 'showMessage').mockImplementation(() => {});
            vi.spyOn($periodicTable, 'updateTime').mockImplementation(() => {});
            vi.spyOn($periodicTable, 'showQuestion').mockImplementation(() => {});
            vi.spyOn($periodicTable, 'updateGameBoard').mockImplementation(() => {});
            // Builds the board from the real element table; irrelevant here and
            // it needs a populated deck to run.
            vi.spyOn($periodicTable, 'completeMode').mockImplementation(() => {});
            // gameOver() records the attempt through the shared report helper.
            const gamification = global.$exeDevices.iDevice.gamification;
            previousReport = gamification.report;
            gamification.report = {
                saveEvaluation: vi.fn(),
                updateEvaluationIcon: vi.fn(),
            };
        }

        it('ends the game through gameOver instead of throwing', () => {
            vi.useFakeTimers();
            setupTimedGame();
            const gameOver = vi.spyOn($periodicTable, 'gameOver');

            $periodicTable.startGame(0);
            $periodicTable.options[0].gameStarted = true;
            // One minute of clock: the interval ticks once a second.
            expect(() => vi.advanceTimersByTime(61000)).not.toThrow();

            expect(gameOver).toHaveBeenCalledWith(0);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // gameOver() raises the flag before it reports, so the activity that
        // ran out of time is recorded as finished rather than left pending.
        it('marks the activity finished when the clock runs out', () => {
            vi.useFakeTimers();
            setupTimedGame();

            $periodicTable.startGame(0);
            $periodicTable.options[0].gameStarted = true;
            vi.advanceTimersByTime(61000);

            expect($periodicTable.options[0].gameOver).toBe(true);
            expect($periodicTable.options[0].gameStarted).toBe(false);

            vi.clearAllTimers();
            vi.useRealTimers();
        });
    });

    // The name is gone from the source; a reference to it is always a defect,
    // because the function has never existed in this iDevice.
    it('does not reference the non-existent checkAnswers()', () => {
        const source = readFileSync(
            join(__dirname, 'periodic-table.js'),
            'utf-8'
        );

        expect(source).not.toContain('$periodicTable.checkAnswers');
    });
});
