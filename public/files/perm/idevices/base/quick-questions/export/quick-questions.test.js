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
});
