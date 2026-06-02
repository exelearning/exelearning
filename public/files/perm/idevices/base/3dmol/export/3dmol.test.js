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
        .replace(/var\s+\$eXe3Dmol\s*=/, 'global.$eXe3Dmol =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$eXe3Dmol\.init\(\);\s*\}\);?\s*$/,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXe3Dmol;
}

describe('3dmol export', () => {
    let $eXe3Dmol;

    beforeEach(() => {
        global.$eXe3Dmol = undefined;
        const filePath = join(__dirname, '3dmol.js');
        const code = readFileSync(filePath, 'utf-8');
        $eXe3Dmol = loadExportIdevice(code);
        document.body.innerHTML = '<span id="dmolpRepeatActivity-0"></span>';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('returns zero when the score denominator is not available', () => {
        $eXe3Dmol.options[0] = {
            activityMode: 'game',
            scoreGame: 1,
            scoreTotal: 0,
        };

        expect($eXe3Dmol.getScoreRP(0)).toBe(0);
    });

    it('saves the SCORM score and updates the visible score text', () => {
        const sendScore = vi
            .spyOn($eXe3Dmol, 'sendScore')
            .mockImplementation(() => {});
        $eXe3Dmol.initialScore = '';
        $eXe3Dmol.options[0] = {
            isScorm: 1,
            repeatActivity: true,
            activityMode: 'game',
            scoreGame: 2,
            scoreTotal: 4,
            msgs: { msgYouScore: 'Score' },
        };

        $eXe3Dmol.saveScormScore(0);

        expect(sendScore).toHaveBeenCalledWith(true, 0);
        expect($('#dmolpRepeatActivity-0').text()).toBe('Score: 5.00');
    });

    it('saves the initial SCORM score when the test game starts', () => {
        vi.useFakeTimers();
        const saveScormScore = vi
            .spyOn($eXe3Dmol, 'saveScormScore')
            .mockImplementation(() => {});
        vi.spyOn($eXe3Dmol, 'setModelStyleControlVisibility').mockImplementation(() => {});
        vi.spyOn($eXe3Dmol, 'updateLives').mockImplementation(() => {});
        vi.spyOn($eXe3Dmol, 'updateTime').mockImplementation(() => {});
        vi.spyOn($eXe3Dmol, 'newQuestion').mockImplementation(() => {});
        $eXe3Dmol.options[0] = {
            activityMode: 'test',
            gameStarted: false,
            numberQuestions: 1,
            numberLives: 1,
            selectsGame: [{}],
        };

        $eXe3Dmol.startGame(0);

        expect(saveScormScore).toHaveBeenCalledWith(0);
        expect($eXe3Dmol.newQuestion).toHaveBeenCalledWith(0);
    });

    it('saves the SCORM score after answering a board question', () => {
        const saveScormScore = vi
            .spyOn($eXe3Dmol, 'saveScormScore')
            .mockImplementation(() => {});
        vi.spyOn($eXe3Dmol, 'updateScore').mockImplementation(() => {});
        $eXe3Dmol.options[0] = {
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

        $eXe3Dmol.answerQuestionBoard(true, 0);

        expect($eXe3Dmol.updateScore).toHaveBeenCalledWith(true, 0);
        expect(saveScormScore).toHaveBeenCalledWith(0);
    });
});
