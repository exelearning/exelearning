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
});
