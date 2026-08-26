/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(/var\s+\$quickquestions\s*=/, 'global.$quickquestions =')
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$quickquestions\.init\(\);\s*\}\);?\s*$/,
            ''
        );

    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$quickquestions;
}

describe('quick-questions export', () => {
    let $quickquestions;

    beforeEach(() => {
        global.$quickquestions = undefined;
        const filePath = join(__dirname, 'quick-questions.js');
        const code = readFileSync(filePath, 'utf-8');
        $quickquestions = loadExportIdevice(code);
        document.body.innerHTML = '<span id="quextRepeatActivity-0"></span>';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('returns zero when the score denominator is not available', () => {
        $quickquestions.options[0] = {
            scoreGame: 1,
            scoreTotal: 0,
        };

        expect($quickquestions.getScoreRP(0)).toBe(0);
    });

    it('saves the SCORM score and updates the visible score text', () => {
        const sendScore = vi
            .spyOn($quickquestions, 'sendScore')
            .mockImplementation(() => {});
        $quickquestions.initialScore = '';
        $quickquestions.options[0] = {
            isScorm: 1,
            repeatActivity: true,
            scoreGame: 4,
            scoreTotal: 8,
            msgs: { msgYouScore: 'Score' },
        };

        $quickquestions.saveScormScore(0);

        expect(sendScore).toHaveBeenCalledWith(true, 0);
        expect($('#quextRepeatActivity-0').text()).toBe('Score: 5.00');
    });

    it('computes getScoreRP as (10 * scoreGame) / scoreTotal', () => {
        $quickquestions.options[0] = { scoreGame: 3, scoreTotal: 4 };
        expect($quickquestions.getScoreRP(0)).toBe(7.5);
    });

    it('returns 0 from getScoreRP when scoreTotal is not a finite number', () => {
        $quickquestions.options[0] = { scoreGame: 3, scoreTotal: undefined };
        expect($quickquestions.getScoreRP(0)).toBe(0);
    });

    it('non-repeat scoring is per-instance (a finished instance does not block others)', () => {
        const sendScore = vi
            .spyOn($quickquestions, 'sendScore')
            .mockImplementation(() => {});
        // A DIFFERENT instance has finished: the old shared static must be ignored now.
        $quickquestions.initialScore = '7.50';
        $quickquestions.options[1] = {
            isScorm: 1,
            repeatActivity: false,
            scoreGame: 2,
            scoreTotal: 4,
            msgs: { msgYouScore: 'Score' },
        };

        // This instance has not been scored yet, so it must still send.
        $quickquestions.saveScormScore(1);
        expect(sendScore).toHaveBeenCalledWith(true, 1);

        // Once THIS instance has its own score, non-repeat mode locks it (per-instance).
        sendScore.mockClear();
        $quickquestions.options[1].initialScore = '5.00';
        $quickquestions.saveScormScore(1);
        expect(sendScore).not.toHaveBeenCalled();
    });
});
