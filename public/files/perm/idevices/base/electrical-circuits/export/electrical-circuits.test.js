/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    global.$exeDevices.iDevice.gamification.colors = {
        borderColors: { black: '#000', white: '#fff' },
        backColor: { black: '#000', white: '#fff' },
    };

    const modifiedCode = code
        .replace(/var\s+\$eXeEC\s*=/, 'global.$eXeEC =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$eXeEC\.init\(\);\s*\}\);?\s*$/,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeEC;
}

describe('electrical-circuits export', () => {
    let $eXeEC;

    beforeEach(() => {
        global.$eXeEC = undefined;
        const filePath = join(__dirname, 'electrical-circuits.js');
        const code = readFileSync(filePath, 'utf-8');
        $eXeEC = loadExportIdevice(code);
        document.body.innerHTML = '<span id="elcpRepeatActivity-0"></span>';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('returns zero when the score denominator is not available', () => {
        $eXeEC.options[0] = {
            activityMode: 'game',
            scoreGame: 1,
            scoreTotal: 0,
        };

        expect($eXeEC.getScoreRP(0)).toBe(0);
    });

    it('saves the SCORM score and updates the visible score text', () => {
        const sendScore = vi
            .spyOn($eXeEC, 'sendScore')
            .mockImplementation(() => {});
        $eXeEC.initialScore = '';
        $eXeEC.options[0] = {
            isScorm: 1,
            repeatActivity: true,
            activityMode: 'game',
            scoreGame: 3,
            scoreTotal: 6,
            msgs: { msgYouScore: 'Score' },
        };

        $eXeEC.saveScormScore(0);

        expect(sendScore).toHaveBeenCalledWith(true, 0);
        expect($('#elcpRepeatActivity-0').text()).toBe('Score: 5.00');
    });

    it('saves the initial SCORM score when the test game starts', () => {
        vi.useFakeTimers();
        const saveScormScore = vi
            .spyOn($eXeEC, 'saveScormScore')
            .mockImplementation(() => {});
        vi.spyOn($eXeEC, 'updateLives').mockImplementation(() => {});
        vi.spyOn($eXeEC, 'updateTime').mockImplementation(() => {});
        vi.spyOn($eXeEC, 'newQuestion').mockImplementation(() => {});
        $eXeEC.options[0] = {
            activityMode: 'test',
            gameStarted: false,
            numberQuestions: 1,
            numberLives: 1,
            selectsGame: [{}],
        };

        $eXeEC.startGame(0);

        expect(saveScormScore).toHaveBeenCalledWith(0);
        expect($eXeEC.newQuestion).toHaveBeenCalledWith(0);
    });

    it('saves the SCORM score after answering a board question', () => {
        const saveScormScore = vi
            .spyOn($eXeEC, 'saveScormScore')
            .mockImplementation(() => {});
        vi.spyOn($eXeEC, 'updateScore').mockImplementation(() => {});
        $eXeEC.options[0] = {
            gameActived: true,
            activeQuestion: 0,
            activeCounter: true,
            selectsGame: [{}],
            showSolution: false,
            timeShowSolution: 0,
            numberQuestions: 1,
            hits: 1,
            errors: 0,
            itinerary: { showClue: false },
        };

        $eXeEC.answerQuestionBoard(true, 0);

        expect($eXeEC.updateScore).toHaveBeenCalledWith(true, 0);
        expect(saveScormScore).toHaveBeenCalledWith(0);
    });
});
