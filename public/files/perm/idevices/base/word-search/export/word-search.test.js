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
});
