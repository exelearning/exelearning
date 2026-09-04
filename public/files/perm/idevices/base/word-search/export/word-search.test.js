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
        originalSendScoreNew =
            global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;
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
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew =
            originalSendScoreNew;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    // The countdown indicator is shown exactly when the activity has a time
    // limit. It used to be half-shown without one: the counter was hidden but
    // the clock icon was not, leaving a clock that never moved next to nothing.
    describe('countdown indicator visibility', () => {
        function setupInstance(time) {
            document.body.innerHTML = `
                <div class="idevice_node"><div id="sopaMainContainer-0">
                    <strong id="sopaPTimeTitle-0"></strong>
                    <div id="sopaPTimeIcon-0" class="exeQuextIcons-Time"></div>
                    <p id="sopaPTime-0"></p>
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
                time,
                isScorm: 1,
                showResolve: false,
            };
            vi.spyOn($eXeSopa, 'removeEvents').mockImplementation(() => {});
            vi.spyOn($eXeSopa, 'showMessage').mockImplementation(() => {});
        }

        function indicatorDisplays() {
            return [
                $('#sopaPTimeTitle-0').css('display'),
                $('#sopaPTimeIcon-0').css('display'),
                $('#sopaPTime-0').css('display'),
            ];
        }

        it('shows label, icon and counter on a timed activity', () => {
            vi.useFakeTimers();
            setupInstance(60);

            $eXeSopa.addEvents(0);

            for (const display of indicatorDisplays()) {
                expect(display).not.toBe('none');
            }
            // The activity is still playable: the Start button stays visible.
            expect($('#sopaStartGame-0').css('display')).not.toBe('none');

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('hides label, icon and counter when there is no time limit', () => {
            vi.useFakeTimers();
            setupInstance(0);

            $eXeSopa.addEvents(0);

            for (const display of indicatorDisplays()) {
                expect(display).toBe('none');
            }

            vi.clearAllTimers();
            vi.useRealTimers();
        });
    });

    describe('showTimeIndicator', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <strong id="sopaPTimeTitle-3"></strong>
                <div id="sopaPTimeIcon-3"></div>
                <p id="sopaPTime-3"></p>`;
        });

        it('toggles the three pieces together', () => {
            $eXeSopa.showTimeIndicator(3, false);

            expect($('#sopaPTimeTitle-3').css('display')).toBe('none');
            expect($('#sopaPTimeIcon-3').css('display')).toBe('none');
            expect($('#sopaPTime-3').css('display')).toBe('none');

            $eXeSopa.showTimeIndicator(3, true);

            expect($('#sopaPTimeTitle-3').css('display')).not.toBe('none');
            expect($('#sopaPTimeIcon-3').css('display')).not.toBe('none');
            expect($('#sopaPTime-3').css('display')).not.toBe('none');
        });

        // Each instance owns its own indicator, so toggling one must not reach
        // the other's clock.
        it('only touches the instance it was given', () => {
            $('body').append(
                '<div id="sopaPTimeIcon-4"></div><p id="sopaPTime-4"></p>'
            );

            $eXeSopa.showTimeIndicator(3, false);

            expect($('#sopaPTimeIcon-4').css('display')).not.toBe('none');
            expect($('#sopaPTime-4').css('display')).not.toBe('none');
        });
    });

    // Only a timed activity has a start button: without a time limit the game
    // is already running when enable() finishes and the button stays hidden.
    describe('SCORM reporting when a timed game starts', () => {
        function setupInstance(overrides = {}) {
            document.body.innerHTML = `
                <div class="idevice_node">
                    <div id="sopaMainContainer-0">
                        <div id="sopaResolve-0"></div>
                        <div id="sopaMessage-0"></div>
                        <div id="sopaMultimedia-0"></div>
                        <div id="sopaDivImgHome-0"></div>
                        <div id="sopaPHits-0"></div>
                        <div id="sopaPScore-0"></div>
                        <div id="sopaStartGame-0"></div>
                        <div id="sopaPTime-0"></div>
                    </div>
                </div>`;
            $eXeSopa.instances[0] = Object.assign(
                {
                    main: 'sopaMainContainer-0',
                    instanceId: 0,
                    isScorm: 1,
                    time: 1,
                    gameStarted: false,
                    gameOver: false,
                    hits: 0,
                    score: 0,
                    showResolve: false,
                    wordsGame: [{ audio: '' }, { audio: '' }],
                    numberQuestions: 2,
                    itinerary: { showClue: false, percentageClue: 0 },
                    msgs: { msgYouScore: 'Score' },
                },
                overrides
            );
            vi.spyOn($eXeSopa, 'uptateTime').mockImplementation(() => {});
            vi.spyOn($eXeSopa, 'sendScore').mockImplementation(() => {});
            vi.useFakeTimers();
        }

        afterEach(() => {
            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('saveScormScore reports only in automatic SCORM mode', () => {
            setupInstance({ isScorm: 1 });
            $eXeSopa.saveScormScore(0);
            expect($eXeSopa.sendScore).toHaveBeenCalledWith(true, 0);

            $eXeSopa.sendScore.mockClear();
            $eXeSopa.instances[0].isScorm = 2;
            $eXeSopa.saveScormScore(0);
            expect($eXeSopa.sendScore).not.toHaveBeenCalled();
        });

        // The defect: pressing the start button left the LMS holding the
        // previous attempt's grade and status until a word was found.
        it('publishes the cleared state when a finished game is restarted', () => {
            setupInstance({ hits: 2, score: 10, gameOver: true });
            let stateWhenReported;
            $eXeSopa.sendScore.mockImplementation(() => {
                const { hits, score, gameOver, gameStarted } =
                    $eXeSopa.instances[0];
                stateWhenReported = { hits, score, gameOver, gameStarted };
            });

            $eXeSopa.startGame(0);

            expect(stateWhenReported).toEqual({
                hits: 0,
                score: 0,
                gameOver: false,
                // sendScoreNew ignores a game that reports as neither started
                // nor over.
                gameStarted: true,
            });
        });

        it('does not report a game that was already running', () => {
            setupInstance({ gameStarted: true });

            $eXeSopa.startGame(0);

            expect($eXeSopa.sendScore).not.toHaveBeenCalled();
        });

        /** The code field and the maximize link the entry drives. */
        function addCodeAccessDom(typed) {
            $('#sopaMainContainer-0').append(`
                <div id="sopaCodeAccessDiv-0"></div>
                <div id="sopaMesajeAccesCodeE-0"></div>
                <div id="sopaCubierta-0"></div>
                <div id="sopaGameContainer-0"></div>
                <a id="sopaLinkMaximize-0" href="#"></a>
                <input id="sopaCodeAccessE-0" value="${typed}" />`);
            $eXeSopa.instances[0].itinerary.showCodeAccess = true;
            $eXeSopa.instances[0].itinerary.codeAccess = 'abre';
        }

        // Without a clock the grid is live from the moment the page loads and
        // there is no play button — that one only appears with a timer — so the
        // code is the last chance to publish the opening zero.
        it('publishes the opening zero when an untimed grid is opened by code', () => {
            setupInstance({ time: 0, gameStarted: true, hits: 2, score: 10 });
            addCodeAccessDom('AbrE');

            $eXeSopa.enterCodeAccess(0);

            expect($eXeSopa.sendScore).toHaveBeenCalledWith(true, 0);
        });

        // With a clock the code only uncovers: the play button it reveals is
        // the real start, and startGame publishes from there. Reporting here
        // too would put the same zero on the wire twice.
        it('leaves a timed grid to its play button', () => {
            setupInstance({ time: 1, gameStarted: false });
            addCodeAccessDom('abre');

            $eXeSopa.enterCodeAccess(0);

            expect($eXeSopa.sendScore).not.toHaveBeenCalled();
        });

        it('reports nothing when the code is wrong', () => {
            setupInstance({ time: 0, gameStarted: true });
            addCodeAccessDom('nope');

            $eXeSopa.enterCodeAccess(0);

            expect($eXeSopa.sendScore).not.toHaveBeenCalled();
            expect($('#sopaCodeAccessE-0').val()).toBe('');
        });

        it('does not auto-report in manual SCORM mode', () => {
            setupInstance({ time: 0, gameStarted: true, isScorm: 2 });
            addCodeAccessDom('abre');

            $eXeSopa.enterCodeAccess(0);

            expect($eXeSopa.sendScore).not.toHaveBeenCalled();
        });
    });
});
