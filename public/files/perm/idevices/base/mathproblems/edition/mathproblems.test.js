/**
 * Unit tests for mathproblems iDevice sanitization helpers.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice(code) {
    const modifiedCode = code.replace(
        /var\s+\$exeDevice\s*=/,
        'global.$exeDevice ='
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

describe('mathproblems iDevice', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        global._ = global._ || ((value) => value);
        global.c_ = global.c_ || ((value) => value);

        const sanitizeTextMock = vi.fn((value) => `txt:${String(value)}`);
        const sanitizeHtmlMock = vi.fn((value) => `html:${String(value)}`);

        global.$exeDevicesEdition = {
            iDevice: {
                common: {
                    sanitizeText: sanitizeTextMock,
                    sanitizeHtml: sanitizeHtmlMock,
                },
            },
        };

        const filePath = join(__dirname, 'mathproblems.js');
        const code = readFileSync(filePath, 'utf-8');
        $exeDevice = loadIdevice(code);
    });

    it('sanitizes question fields using common_edition helpers', () => {
        const result = $exeDevice.sanitizeQuestion({
            formula: 'x + y',
            wording: '<p>Question</p>',
            textFeedBack: '<p>Feedback</p>',
            domains: [{ name: 'x', value: '1 - 10' }],
        });

        expect(result.formula).toBe('txt:x + y');
        expect(result.wording).toBe('html:<p>Question</p>');
        expect(result.textFeedBack).toBe('html:<p>Feedback</p>');
        expect(result.domains).toEqual([
            {
                name: 'txt:x',
                value: 'txt:1 - 10',
            },
        ]);
    });

    it('returns empty array when sanitizeQuestions receives non-array input', () => {
        expect($exeDevice.sanitizeQuestions(null)).toEqual([]);
        expect($exeDevice.sanitizeQuestions(undefined)).toEqual([]);
    });
});
