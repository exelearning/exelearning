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

    // The automatic report used to happen only from showQuestion(), i.e. once
    // the setTimeout that reveals the next question had elapsed. That put the
    // mark in the LMS seconds late, and a learner who left during that window
    // lost the answer: the timer never fired.
    describe('reporting in the same turn the learner answered', () => {
        const idevice = () => global.$quickquestionsmultiplechoice;

        function setupAnswer(overrides) {
            document.body.innerHTML =
                '<div id="seleccionaMainContainer-0">' +
                '<div id="seleccionaPShowClue-0"></div>' +
                '<div id="seleccionaLinkAudio-0"></div>' +
                '</div>';
            idevice().initialScore = '';
            idevice().options[0] = Object.assign(
                {
                    id: 0,
                    isScorm: 1,
                    repeatActivity: true,
                    gameStarted: true,
                    gameActived: true,
                    gameOver: false,
                    order: 0,
                    hits: 1,
                    errors: 0,
                    numberQuestions: 4,
                    activeQuestion: 0,
                    activeCounter: true,
                    showSolution: false,
                    audioFeedBach: false,
                    obtainedClue: false,
                    selectsGame: [
                        { audio: '' },
                        { audio: '' },
                        { audio: '' },
                        { audio: '' },
                    ],
                    itinerary: { showClue: false, percentageClue: 0 },
                    msgs: { msgInformation: 'info', msgYouScore: 'Score' },
                },
                overrides
            );
            vi.spyOn(idevice(), 'updateScore').mockImplementation(() => {});
            vi.spyOn(idevice(), 'sendScore').mockImplementation(() => {});
            vi.spyOn(idevice(), 'newQuestion').mockImplementation(() => {});
            vi.spyOn(idevice(), 'showMessage').mockImplementation(() => {});
        }

        afterEach(() => {
            document.body.innerHTML = '';
            vi.restoreAllMocks();
        });

        it('reports before the reveal timer runs, not after it', () => {
            vi.useFakeTimers();
            setupAnswer();

            idevice().answerQuestionBoard(true, 0);

            // No timer has been advanced: the report has to have gone out.
            expect(idevice().sendScore).toHaveBeenCalledWith(true, 0);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        it('does not report outside automatic SCORM mode', () => {
            vi.useFakeTimers();
            setupAnswer({ isScorm: 0 });

            idevice().answerQuestionBoard(true, 0);

            expect(idevice().sendScore).not.toHaveBeenCalled();

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // An intermediate answer must not close the attempt: the page would go
        // to passed/failed while the learner is still playing.
        it('leaves the activity unfinished while questions remain', () => {
            vi.useFakeTimers();
            setupAnswer({ activeQuestion: 0, numberQuestions: 4 });

            idevice().answerQuestionBoard(true, 0);

            expect(idevice().options[0].gameOver).toBe(false);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // The last answer must carry the completion, so leaving during the
        // reveal delay still records a finished activity.
        it('marks the activity finished on the last question, before reporting', () => {
            vi.useFakeTimers();
            setupAnswer({ activeQuestion: 3, numberQuestions: 4 });
            let flagWhenReported;
            idevice().sendScore.mockImplementation(() => {
                flagWhenReported = idevice().options[0].gameOver;
            });

            idevice().answerQuestionBoard(true, 0);

            expect(flagWhenReported).toBe(true);

            vi.clearAllTimers();
            vi.useRealTimers();
        });

        // showQuestion applies the same lock; the new path must not bypass it
        // and score a non-repeatable activity twice.
        // No "score only once" lock any more: every report goes out. The one
        // that used to sit here could never close anyway — registerActivity
        // forces repeatActivity to true at page load (common.js
        // updateScormNew) — and a stale mark in the LMS is worse than a
        // repeated one.
        it('reports again after a previous score, with repeating disabled', () => {
            setupAnswer({ repeatActivity: false });
            idevice().options[0].initialScore = '5.00';

            idevice().saveScormScore(0);

            expect(idevice().sendScore).toHaveBeenCalledWith(true, 0);
        });

    });
});
