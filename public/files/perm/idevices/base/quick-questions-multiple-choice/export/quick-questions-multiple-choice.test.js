/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    global.$exeDevices.iDevice.gamification.colors = {
        borderColors: {
            red: '#f00',
            blue: '#00f',
            green: '#0f0',
            yellow: '#ff0',
        },
        backColor: {
            black: '#000',
        },
    };

    const modifiedCode = code
        .replace(
            /var\s+\$quickquestionsmultiplechoice\s*=/,
            'global.$quickquestionsmultiplechoice ='
        )
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$quickquestionsmultiplechoice\.init\(\);\s*\}\);?\s*$/,
            ''
        );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$quickquestionsmultiplechoice;
}

describe('quick-questions-multiple-choice export', () => {
    let $quickquestionsmultiplechoice;
    let hasLatexSpy;
    let updateLatexSpy;

    beforeEach(() => {
        global.$quickquestionsmultiplechoice = undefined;

        const filePath = join(__dirname, 'quick-questions-multiple-choice.js');
        const code = readFileSync(filePath, 'utf-8');
        $quickquestionsmultiplechoice = loadExportIdevice(code);

        hasLatexSpy = vi
            .spyOn(global.$exeDevices.iDevice.gamification.math, 'hasLatex')
            .mockReturnValue(true);
        updateLatexSpy = vi.spyOn(
            global.$exeDevices.iDevice.gamification.math,
            'updateLatex'
        );
    });

    afterEach(() => {
        hasLatexSpy?.mockRestore();
        updateLatexSpy?.mockRestore();
        document.body.innerHTML = '';
    });

    it('typesets the question block using an id selector', () => {
        document.body.innerHTML = `
            <div id="seleccionaQuestionDiv-0">
                <div id="seleccionaOptionsDiv-0">
                    <a class="SLCNP-Options"></a>
                    <a class="SLCNP-Options"></a>
                    <a class="SLCNP-Options"></a>
                    <a class="SLCNP-Options"></a>
                </div>
            </div>
            <div id="seleccionaWordDiv-0"></div>
            <div id="seleccionaAnswerDiv-0"></div>
        `;

        $quickquestionsmultiplechoice.options[0] = {
            question: {
                options: ['a', 'b', 'c', 'd'],
            },
        };

        $quickquestionsmultiplechoice.drawQuestions(0);

        expect(hasLatexSpy).toHaveBeenCalled();
        expect(updateLatexSpy).toHaveBeenCalledWith('#seleccionaQuestionDiv-0');
    });

    it('typesets the word block using an id selector', () => {
        document.body.innerHTML = `
            <div id="seleccionaEPhrase-0"></div>
            <div id="seleccionaQuestionDiv-0"></div>
            <div id="seleccionaWordDiv-0"></div>
            <div id="seleccionaAnswerDiv-0"></div>
            <div id="seleccionaDefinition-0"></div>
            <button id="seleccionaBtnReply-0"></button>
            <button id="seleccionaBtnMoveOn-0"></button>
            <input id="seleccionaEdAnswer-0" />
        `;

        $quickquestionsmultiplechoice.drawPhrase(
            'abc',
            '\\(\\oplus\\)',
            0,
            0,
            true,
            0,
            false
        );

        expect(hasLatexSpy).toHaveBeenCalled();
        expect(updateLatexSpy).toHaveBeenCalledWith('#seleccionaWordDiv-0');
    });

    describe('ramdonOptions', () => {
        // Deterministic permutation so we can assert the remapped solution:
        // every shuffle reverses the option order.
        beforeEach(() => {
            global.$exeDevices.iDevice.gamification.helpers.shuffleAds = vi.fn(
                (arr) => [...arr].reverse()
            );
        });

        it('shuffles select options and remaps the correct-answer set', () => {
            const question = {
                typeSelect: 0,
                options: ['a', 'b', 'c', 'd'],
                solution: 'AC',
            };
            $quickquestionsmultiplechoice.options[0] = { question };

            $quickquestionsmultiplechoice.ramdonOptions(0);

            expect(question.options).toEqual(['d', 'c', 'b', 'a']);
            // 'a' moved to position D, 'c' moved to position B (order in the
            // set is irrelevant for select questions).
            expect(question.solution).toBe('BD');
        });

        it('shuffles order options while preserving the correct sequence', () => {
            const question = {
                typeSelect: 1,
                options: ['a', 'b', 'c', 'd'],
                solution: 'ABCD',
            };
            $quickquestionsmultiplechoice.options[0] = { question };

            $quickquestionsmultiplechoice.ramdonOptions(0);

            expect(question.options).toEqual(['d', 'c', 'b', 'a']);
            // The correct order is still a,b,c,d, now sitting at positions
            // D,C,B,A respectively.
            expect(question.solution).toBe('DCBA');
        });

        it('leaves word questions untouched', () => {
            const question = {
                typeSelect: 2,
                options: ['', '', '', ''],
                solution: '',
            };
            $quickquestionsmultiplechoice.options[0] = { question };

            $quickquestionsmultiplechoice.ramdonOptions(0);

            expect(
                global.$exeDevices.iDevice.gamification.helpers.shuffleAds
            ).not.toHaveBeenCalled();
            expect(question.options).toEqual(['', '', '', '']);
            expect(question.solution).toBe('');
        });
    });
});
