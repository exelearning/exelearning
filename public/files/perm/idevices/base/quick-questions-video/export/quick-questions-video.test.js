/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$quickquestionsvideo\s*=/, 'global.$quickquestionsvideo =')
        .replace(/\$\(function\s*\(\)\s*\{\s*\$quickquestionsvideo\.init\(\);\s*\}\);?/g, '');

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$quickquestionsvideo;
}

describe('quick-questions-video iDevice export', () => {
    let $quickquestionsvideo;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
        global.$quickquestionsvideo = undefined;
        originalReport = global.$exeDevices.iDevice.gamification.report;
        originalSendScoreNew = global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();

        const code = readFileSync(join(__dirname, 'quick-questions-video.js'), 'utf-8');
        $quickquestionsvideo = loadExportIdevice(code);
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.report = originalReport;
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = originalSendScoreNew;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('does not register unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(join(__dirname, 'quick-questions-video.js'), 'utf-8');

        expect(code).not.toMatch(/beforeunload|unload\.\$?quickquestionsvideo|endScorm/);
    });

    it('formats seconds as mm:ss', () => {
        expect($quickquestionsvideo.getTimeToString(0)).toBe('00:00');
        expect($quickquestionsvideo.getTimeToString(75)).toBe('01:15');
    });

    it('sends the current SCORM score', () => {
        $quickquestionsvideo.options[0] = {
            gameOver: false,
            gameStarted: true,
            scoreGame: 3,
            scoreTotal: 6,
        };

        $quickquestionsvideo.sendScore(true, 0);

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
        document.body.innerHTML = '<span id="vquextRepeatActivity-0"></span>';
        $quickquestionsvideo.options[0] = {
            counterClock: 1,
            gameActived: true,
            gameOver: false,
            gameStarted: true,
            hits: 2,
            isScorm: 1,
            msgs: {
                msgAllQuestions: 'All questions',
                msgLostLives: 'Lost lives',
                msgNewGame: 'New game',
                msgYouScore: 'Score',
            },
            numberQuestions: 4,
            repeatActivity: true,
            scoreGame: 2,
            scoreTotal: 4,
            videoType: 1,
        };
        vi.spyOn($quickquestionsvideo, 'showMessage').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'showScoreGame').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'clearQuestions').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'uptateTime').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'stopVideo').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'showNumbersQuestions').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'showNavigationButtons').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'saveEvaluation').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'showFeedBack').mockImplementation(() => {});

        $quickquestionsvideo.gameOver(0, 0);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: true,
                gameStarted: false,
                scorerp: 5,
            }),
        );
        expect($('#vquextRepeatActivity-0').text()).toBe('Score: 5.00');
    });

    it('non-repeat scoring is per-instance (a finished instance does not block another)', () => {
        document.body.innerHTML = '<span id="vquextRepeatActivity-1"></span>';
        // A DIFFERENT, already-finished instance polluted the old shared static;
        // it must not stop this fresh non-repeat instance from sending its score.
        $quickquestionsvideo.initialScore = '7.50';
        $quickquestionsvideo.options[1] = {
            counterClock: 1,
            gameActived: true,
            gameOver: false,
            gameStarted: true,
            hits: 2,
            isScorm: 1,
            msgs: {
                msgAllQuestions: 'All questions',
                msgLostLives: 'Lost lives',
                msgNewGame: 'New game',
                msgYouScore: 'Score',
            },
            numberQuestions: 4,
            repeatActivity: false,
            scoreGame: 2,
            scoreTotal: 4,
            videoType: 1,
        };
        vi.spyOn($quickquestionsvideo, 'showMessage').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'showScoreGame').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'clearQuestions').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'uptateTime').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'stopVideo').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'showNumbersQuestions').mockImplementation(
            () => {},
        );
        vi.spyOn($quickquestionsvideo, 'showNavigationButtons').mockImplementation(
            () => {},
        );
        vi.spyOn($quickquestionsvideo, 'saveEvaluation').mockImplementation(() => {});
        vi.spyOn($quickquestionsvideo, 'showFeedBack').mockImplementation(() => {});

        $quickquestionsvideo.gameOver(0, 1);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: true,
                scorerp: 5,
            }),
        );
        // The lock is now per-instance, not shared.
        expect($quickquestionsvideo.options[1].initialScore).toBe('5.00');
    });
});
