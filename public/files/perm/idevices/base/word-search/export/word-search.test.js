/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$eXeSopa\s*=/, 'global.$eXeSopa =')
        .replace(/\$\(function\s*\(\)\s*\{\s*\$eXeSopa\.init\(\);\s*\}\);?/g, '');

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeSopa;
}

describe('word-search iDevice export', () => {
    let $eXeSopa;
    let originalMedia;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
        global.$eXeSopa = undefined;
        originalMedia = global.$exeDevices.iDevice.gamification.media;
        originalReport = global.$exeDevices.iDevice.gamification.report;
        originalSendScoreNew = global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;
        global.$exeDevices.iDevice.gamification.media = {
            stopSound: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();

        const code = readFileSync(join(__dirname, 'word-search.js'), 'utf-8');
        $eXeSopa = loadExportIdevice(code);
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.media = originalMedia;
        global.$exeDevices.iDevice.gamification.report = originalReport;
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = originalSendScoreNew;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('does not register unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(join(__dirname, 'word-search.js'), 'utf-8');

        expect(code).not.toMatch(/beforeunload|unload\.eXeSopa|endScorm/);
    });

    it('sends the SCORM score from the words found', () => {
        $eXeSopa.instances[0] = {
            gameOver: false,
            gameStarted: true,
            hits: 2,
            wordsGame: ['one', 'two', 'three', 'four'],
        };

        $eXeSopa.sendScore(true, 0);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: false,
                gameStarted: true,
                scorerp: 5,
            }),
        );
    });

    it('marks the completed game before sending the final SCORM score', () => {
        document.body.innerHTML = `
            <div id="sopaMainContainer-0">
                <span id="sopaRepeatActivity-0"></span>
                <span id="sopaPShowClue-0"></span>
            </div>
        `;
        $eXeSopa.instances[0] = {
            activeCounter: true,
            counterClock: 1,
            gameOver: false,
            gameStarted: true,
            hits: 2,
            isScorm: 1,
            itinerary: {
                showClue: false,
            },
            msgs: {
                msgEndGameM: 'End %s',
                msgEndTime: 'Time %s',
                msgTryAgain: 'Try %s',
                msgWordsFind: 'Words %s',
                msgYouScore: 'Score',
            },
            numberQuestions: 4,
            wordsGame: ['one', 'two', 'three', 'four'],
        };
        vi.spyOn($eXeSopa, 'getRetroFeedMessages').mockReturnValue('OK');
        vi.spyOn($eXeSopa, 'showMessage').mockImplementation(() => {});
        vi.spyOn($eXeSopa, 'showFeedBack').mockImplementation(() => {});

        $eXeSopa.gameOver(1, 0);

        expect(global.$exeDevices.iDevice.gamification.media.stopSound).toHaveBeenCalledTimes(1);
        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: true,
                gameStarted: false,
                scorerp: 5,
            }),
        );
        expect($('#sopaRepeatActivity-0').text()).toBe('Score: 5.00');
    });

    describe('does not send a score on page load', () => {
        function setupInstance(time) {
            document.body.innerHTML =
                '<div class="idevice_node"><div id="sopaMainContainer-0"></div></div>';
            global.$exeDevices.iDevice.gamification.report.updateEvaluationIcon =
                vi.fn();
            $eXeSopa.instances[0] = {
                itinerary: { showCodeAccess: false, clueGame: 'clue' },
                wordsGame: ['a', 'b'],
                msgs: { mgsGameStart: 'start', msgInformation: 'info' },
                numberQuestions: 2,
                instructions: '',
                time,
                isScorm: 1,
                showResolve: false,
            };
            vi.spyOn($eXeSopa, 'removeEvents').mockImplementation(() => {});
            vi.spyOn($eXeSopa, 'showMessage').mockImplementation(() => {});
        }

        it('registers the untimed activity with gameStarted=false (no premature send)', () => {
            vi.useFakeTimers();
            setupInstance(0);
            let gameStartedAtRegister;
            global.$exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn(
                (opts) => {
                    gameStartedAtRegister = opts.gameStarted;
                },
            );

            $eXeSopa.addEvents(0);

            // The session is not active at registration, so the shared helper
            // does not send a 0 score on load.
            expect(gameStartedAtRegister).toBe(false);
            // Untimed games become playable right after registration.
            expect($eXeSopa.instances[0].gameStarted).toBe(true);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('keeps a timed activity not started at registration', () => {
            vi.useFakeTimers();
            setupInstance(60);
            let gameStartedAtRegister;
            global.$exeDevices.iDevice.gamification.scorm.registerActivity = vi.fn(
                (opts) => {
                    gameStartedAtRegister = opts.gameStarted;
                },
            );

            $eXeSopa.addEvents(0);

            expect(gameStartedAtRegister).toBe(false);
            // Timed games stay not started until the Start button is pressed.
            expect($eXeSopa.instances[0].gameStarted).toBe(false);

            vi.clearAllTimers();
            vi.useRealTimers();
        });
    });

    describe('hide time icon on timed activities', () => {
        function setupTimedInstance(hideTime) {
            document.body.innerHTML = `
                <div class="idevice_node"><div id="sopaMainContainer-0">
                    <span id="sopaPTimeTitle-0"></span>
                    <span id="sopaPTime-0"></span>
                    <span class="exeQuextIcons-Time"></span>
                    <a id="sopaStartGame-0"></a>
                    <div id="sopaDivImgHome-0"></div>
                </div></div>`;
            global.$exeDevices.iDevice.gamification.report.updateEvaluationIcon =
                vi.fn();
            global.$exeDevices.iDevice.gamification.scorm.registerActivity =
                vi.fn();
            $eXeSopa.instances[0] = {
                itinerary: { showCodeAccess: false, clueGame: 'clue' },
                wordsGame: ['a', 'b'],
                msgs: { mgsGameStart: 'start', msgInformation: 'info' },
                numberQuestions: 2,
                instructions: '',
                time: 60,
                hideTime,
                isScorm: 1,
                showResolve: false,
            };
            vi.spyOn($eXeSopa, 'removeEvents').mockImplementation(() => {});
            vi.spyOn($eXeSopa, 'showMessage').mockImplementation(() => {});
        }

        it('hides the countdown indicator but keeps the start button', () => {
            vi.useFakeTimers();
            setupTimedInstance(true);

            $eXeSopa.addEvents(0);

            expect($('#sopaPTime-0').css('display')).toBe('none');
            expect($('#sopaPTimeTitle-0').css('display')).toBe('none');
            expect($('.exeQuextIcons-Time').css('display')).toBe('none');
            // The activity is still playable: the Start button stays visible.
            expect($('#sopaStartGame-0').css('display')).not.toBe('none');

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('shows the countdown indicator by default (hideTime off)', () => {
            vi.useFakeTimers();
            setupTimedInstance(false);

            $eXeSopa.addEvents(0);

            expect($('#sopaPTime-0').css('display')).not.toBe('none');
            expect($('.exeQuextIcons-Time').css('display')).not.toBe('none');

            vi.clearAllTimers();
            vi.useRealTimers();
        });
    });
});
