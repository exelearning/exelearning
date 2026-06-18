import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the real shared gamification helper ($exeDevices) from common.js so the
// SCORM auto-save path can be integration-tested end to end (registerActivity +
// sendScoreNew + updateActivity + showFinalScore against an in-memory LMS API).
require('../../../../../../app/common/common.js');
const realExeDevices = global.$exeDevices;

/**
 * The export iDevice declares `var $adaptativequiz = {...}`. We rewrite it to
 * a global assignment so the test can grab a reference and exercise its pure
 * helpers (time formatting + config normalization).
 */
function loadExport() {
    const code = readFileSync(join(__dirname, 'adaptative-quiz.js'), 'utf-8');
    const modified = code.replace(/var\s+\$adaptativequiz\s*=/, 'global.$adaptativequiz =');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$adaptativequiz;
}

describe('adaptative-quiz export', () => {
    let adq;

    beforeEach(() => {
        // eXe.app.isInExe is read by updateConfig; stub it when missing.
        if (global.eXe && global.eXe.app && !global.eXe.app.isInExe) {
            global.eXe.app.isInExe = () => false;
        }
        // Restore the real $exeDevices (with the gamification.math helper) before
        // every test. Some blocks delete it in their afterEach, and the runtime
        // always exposes it, so question/feedback rendering can rely on it.
        global.$exeDevices = realExeDevices;
        adq = loadExport();
    });

    it('should define the export object with required methods', () => {
        expect(adq).toBeDefined();
        expect(typeof adq.updateConfig).toBe('function');
        expect(typeof adq.startGame).toBe('function');
        expect(typeof adq.setupTimer).toBe('function');
        expect(typeof adq.stopCounter).toBe('function');
        expect(typeof adq.tick).toBe('function');
        expect(typeof adq.beginActivity).toBe('function');
        expect(typeof adq.showStartScreen).toBe('function');
        expect(typeof adq.formatTime).toBe('function');
    });

    describe('export styles', () => {
        it('lays out select options in two columns and keeps sort options in a single column', () => {
            const css = readFileSync(join(__dirname, 'adaptative-quiz.css'), 'utf-8');
            const optionsRule = css.match(/\.ADAPTATIVEQUIZ-Options\s*\{[\s\S]*?\}/)?.[0] || '';
            const selectOptionsRule =
                css.match(/\.ADAPTATIVEQUIZ-Options\[data-type-select="0"\]\s*\{[\s\S]*?\}/)?.[0] || '';
            const optionsGridRule = css.match(/\.ADAPTATIVEQUIZ-OptionsGrid\s*\{[\s\S]*?\}/)?.[0] || '';
            const sortListRule = css.match(/\.ADAPTATIVEQUIZ-SortList\s*\{[\s\S]*?\}/)?.[0] || '';

            expect(optionsRule).toContain('display: flex;');
            expect(optionsRule).toContain('flex-direction: column;');
            expect(selectOptionsRule).toContain('display: grid;');
            expect(selectOptionsRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
            expect(optionsGridRule).toContain('grid-template-columns: 1fr;');
            expect(sortListRule).toContain('display: flex;');
            expect(sortListRule).toContain('flex-direction: column;');
        });

        it('colours every correct option green, even when it was selected (beats the blue state)', () => {
            const css = readFileSync(join(__dirname, 'adaptative-quiz.css'), 'utf-8');
            // The green "correct" rule must mirror the blue selected rule's
            // `input[type="…"]` shape so its specificity matches (and wins by
            // source order); `:has(input)` alone is less specific and a selected
            // correct option would stay blue.
            expect(css).toContain(
                '.ADAPTATIVEQUIZ-Option.ADAPTATIVEQUIZ-OptionCorrect:has(input[type="checkbox"])',
            );
            // Regression guard against the lower-specificity form.
            expect(css).not.toContain('.ADAPTATIVEQUIZ-Option.ADAPTATIVEQUIZ-OptionCorrect:has(input) {');
        });
    });

    describe('image author and alt', () => {
        it('renders the author centered below the image when provided', () => {
            const html = adq.renderMedia({ msgs: {} }, 'pic.png', 'image', 'A red flower', null, 'Jane Doe');
            expect(html).toContain('class="ADAPTATIVEQUIZ-Image"');
            expect(html).toContain('alt="A red flower"');
            expect(html).toContain('<div class="ADAPTATIVEQUIZ-ImageAuthor">Jane Doe</div>');
            // The author caption sits after the image element.
            expect(html.indexOf('<img')).toBeLessThan(html.indexOf('ADAPTATIVEQUIZ-ImageAuthor'));
        });

        it('omits the author caption when no author is provided', () => {
            const html = adq.renderMedia({ msgs: {} }, 'pic.png', 'image', 'Alt', null, '');
            expect(html).not.toContain('ADAPTATIVEQUIZ-ImageAuthor');
        });

        it('escapes the author text', () => {
            const html = adq.renderMedia({ msgs: {} }, 'pic.png', 'image', 'Alt', null, '<b>x</b>');
            expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
            expect(html).not.toContain('<b>x</b>');
        });

        it('normalizeQuestions keeps author and alt for image questions and drops them otherwise', () => {
            const out = adq.normalizeQuestions(
                [
                    {
                        question: 'Look',
                        type: 1,
                        url: 'pic.png',
                        author: 'Jane Doe',
                        alt: 'A red flower',
                        options: [{ text: 'A' }, { text: 'B' }],
                        solution: 0,
                        difficulty: 1,
                    },
                    {
                        question: 'Text only',
                        type: 0,
                        author: 'Ignored',
                        alt: 'Ignored',
                        options: [{ text: 'A' }, { text: 'B' }],
                        solution: 0,
                        difficulty: 1,
                    },
                ],
                3,
            );
            expect(out[0].author).toBe('Jane Doe');
            expect(out[0].alt).toBe('A red flower');
            expect(out[1].author).toBe('');
            expect(out[1].alt).toBe('');
        });

        it('centers the image column and styles the author caption in CSS', () => {
            const css = readFileSync(join(__dirname, 'adaptative-quiz.css'), 'utf-8');
            const imageRule = css.match(/\.ADAPTATIVEQUIZ-Image\s*\{[\s\S]*?\}/)?.[0] || '';
            const authorRule = css.match(/\.ADAPTATIVEQUIZ-ImageAuthor\s*\{[\s\S]*?\}/)?.[0] || '';
            expect(imageRule).toContain('flex-direction: column;');
            expect(authorRule).toContain('text-align: center;');
        });
    });

    describe('formatTime', () => {
        it('pads minutes and seconds below 10', () => {
            expect(adq.formatTime(0)).toBe('00:00');
            expect(adq.formatTime(5)).toBe('00:05');
            expect(adq.formatTime(65)).toBe('01:05');
            expect(adq.formatTime(600)).toBe('10:00');
            expect(adq.formatTime(3599)).toBe('59:59');
        });

        it('clamps invalid values to zero', () => {
            expect(adq.formatTime(-10)).toBe('00:00');
            expect(adq.formatTime(NaN)).toBe('00:00');
            expect(adq.formatTime('abc')).toBe('00:00');
        });
    });

    describe('updateConfig time normalization', () => {
        const baseData = () => ({
            questionsGame: [{ question: 'Q1', options: [{ text: 'A' }, { text: 'B' }], solution: 0, difficulty: 1 }],
            numRound: 1,
            initialLevel: 2,
        });

        it('defaults missing time to 0', () => {
            const out = adq.updateConfig(baseData(), 'test1');
            expect(out.time).toBe(0);
            expect(out.counter).toBe(0);
        });

        it('caps time at 59 minutes', () => {
            const d = baseData();
            d.time = 100;
            const out = adq.updateConfig(d, 'test2');
            expect(out.time).toBe(59);
            expect(out.counter).toBe(59 * 60);
        });

        it('clamps negative time to 0', () => {
            const d = baseData();
            d.time = -5;
            const out = adq.updateConfig(d, 'test3');
            expect(out.time).toBe(0);
            expect(out.counter).toBe(0);
        });

        it('accepts numeric strings', () => {
            const d = baseData();
            d.time = '7';
            const out = adq.updateConfig(d, 'test4');
            expect(out.time).toBe(7);
            expect(out.counter).toBe(7 * 60);
        });

        it('initializes clockInterval as null', () => {
            const out = adq.updateConfig(baseData(), 'test5');
            expect(out.clockInterval).toBe(null);
        });
    });

    describe('showSolution normalization', () => {
        const baseData = () => ({
            questionsGame: [{ question: 'Q1', options: [{ text: 'A' }, { text: 'B' }], solution: 0, difficulty: 1 }],
            numRound: 1,
            initialLevel: 2,
        });

        it('defaults showSolution to true and timeShowSolution to 3', () => {
            const out = adq.updateConfig(baseData(), 'show1');
            expect(out.showSolution).toBe(true);
            expect(out.timeShowSolution).toBe(3);
        });

        it('preserves explicit false for showSolution', () => {
            const d = baseData();
            d.showSolution = false;
            const out = adq.updateConfig(d, 'show2');
            expect(out.showSolution).toBe(false);
        });

        it('clamps timeShowSolution to the 1..9 range', () => {
            const d1 = baseData();
            d1.timeShowSolution = 50;
            expect(adq.updateConfig(d1, 'show3').timeShowSolution).toBe(9);

            const d2 = baseData();
            d2.timeShowSolution = -1;
            expect(adq.updateConfig(d2, 'show4').timeShowSolution).toBe(1);

            const d3 = baseData();
            d3.timeShowSolution = '7';
            expect(adq.updateConfig(d3, 'show5').timeShowSolution).toBe(7);
        });
    });

    describe('createInterface', () => {
        it('does not include the legacy Next question button', () => {
            const data = {
                questionsGame: [
                    { question: 'Q1', options: [{ text: 'A' }, { text: 'B' }], solution: 0, difficulty: 1 },
                ],
                numRound: 1,
                initialLevel: 2,
            };
            adq.options = adq.options || {};
            adq.options['if1'] = adq.updateConfig(data, 'if1');
            const html = adq.createInterface('if1');
            expect(html).not.toContain('ADAPTATIVEQUIZ-BtnNext');
            expect(html).not.toContain('adaptativeQuizBtnNext-');
            expect(html).toContain('ADAPTATIVEQUIZ-BtnCheck');
        });

        it('gives every control button an explicit type="button" so it never acts as a submit', () => {
            const data = {
                questionsGame: [
                    { question: 'Q1', options: [{ text: 'A' }, { text: 'B' }], solution: 0, difficulty: 1 },
                ],
                numRound: 1,
                initialLevel: 2,
            };
            adq.options = adq.options || {};
            adq.options['if-types'] = adq.updateConfig(data, 'if-types');
            const html = adq.createInterface('if-types');
            // No <button> may be left without an explicit type attribute.
            expect(/<button(?![^>]*\btype=)/.test(html)).toBe(false);
            expect(html).toContain('type="button" class="ADAPTATIVEQUIZ-BtnStart"');
            expect(html).toContain('type="button" class="ADAPTATIVEQUIZ-BtnCheck"');
            expect(html).toContain('type="button" class="ADAPTATIVEQUIZ-BtnNewGame"');
        });
    });

    describe('answer group accessibility', () => {
        function renderQuestion(id, question) {
            document.body.innerHTML = `<div id="adaptativeQuizQuestionContainer-${id}"></div>`;
            adq.options[id] = {
                id,
                questions: [question],
                currentQuestionIndex: 0,
                shuffle: false,
                roundCount: 0,
                msgs: adq.msgs,
            };
            adq.renderCurrentQuestion(id);
            return document.getElementById(`adaptativeQuizQuestionContainer-${id}`).innerHTML;
        }

        it('names the select (checkbox) options group after the question text', () => {
            const id = 'a11y-select';
            const html = renderQuestion(id, {
                typeSelect: 0,
                question: 'Pick all',
                options: [{ text: 'A' }, { text: 'B' }],
                solutionMulti: [0],
            });
            const labelId = `adaptativeQuizQuestionText-${id}`;
            expect(html).toContain(`class="ADAPTATIVEQUIZ-QuestionText" id="${labelId}"`);
            expect(html).toContain(`role="group" aria-labelledby="${labelId}"`);
        });

        it('names the sort list after the question text', () => {
            const id = 'a11y-sort';
            const html = renderQuestion(id, {
                typeSelect: 1,
                question: 'Order them',
                options: [{ text: 'A' }, { text: 'B' }],
                solutionOrder: [1, 2],
            });
            expect(html).toContain(`aria-labelledby="adaptativeQuizQuestionText-${id}"`);
        });
    });

    describe('LaTeX rendering', () => {
        let updateLatexSpy;

        beforeEach(() => {
            // The iDevice reads the global $exeDevices loaded from common.js. It
            // loads MathJax on demand and then typesets. Spy on updateLatex so
            // we can assert the iDevice requests the expected target, while
            // keeping the real hasLatex regex.
            const math = global.$exeDevices.iDevice.gamification.math;
            updateLatexSpy = vi.spyOn(math, 'updateLatex').mockImplementation(() => {});
        });

        afterEach(() => {
            updateLatexSpy.mockRestore();
        });

        function renderQuestion(id, question) {
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <div id="adaptativeQuizRound-${id}"></div>
                <div id="adaptativeQuizLevel-${id}"></div>
                <div id="adaptativeQuizReport-${id}"></div>
            `;
            adq.options[id] = {
                id,
                questions: [question],
                currentQuestionIndex: 0,
                shuffle: false,
                roundCount: 0,
                numRound: 1,
                currentLevel: 1,
                maxLevel: 3,
                msgs: adq.msgs,
            };
            adq.renderCurrentQuestion(id);
        }

        it('typesets the export template when its instructions contain LaTeX', () => {
            const data = {
                eXeFormInstructions: 'Intro \\(z\\)',
                questionsGame: [
                    {
                        type: 0,
                        typeSelect: 0,
                        question: 'Solve \\(x + 1 = 2\\)',
                        options: [{ text: '1' }, { text: '2' }],
                        solutionMulti: [0],
                        difficulty: 1,
                    },
                ],
                numRound: 1,
                initialLevel: 1,
            };
            const template = readFileSync(join(__dirname, 'adaptative-quiz.html'), 'utf-8');

            document.body.innerHTML = adq.renderView(data, false, template, 'latex-template');
            expect(document.querySelector('.exe-adaptative-quiz-template')).not.toBeNull();
            adq.renderBehaviour(data, false, 'latex-template');

            expect(updateLatexSpy).toHaveBeenCalledWith('.exe-adaptative-quiz-template');
        });

        it('does NOT typeset the template when it has no unrendered LaTeX', () => {
            const data = {
                eXeFormInstructions: 'Plain intro, no math',
                questionsGame: [
                    { type: 0, typeSelect: 0, question: 'Plain', options: [{ text: '1' }], solutionMulti: [0] },
                ],
                numRound: 1,
                initialLevel: 1,
            };
            const template = readFileSync(join(__dirname, 'adaptative-quiz.html'), 'utf-8');

            document.body.innerHTML = adq.renderView(data, false, template, 'plain-template');
            adq.renderBehaviour(data, false, 'plain-template');

            expect(updateLatexSpy).not.toHaveBeenCalled();
        });

        it('keeps pre-rendered math spans (no MathJax) but escapes author text in options', () => {
            renderQuestion('prerendered-opt', {
                typeSelect: 0,
                question: 'Stem',
                options: [
                    {
                        text: '<span class="exe-math-rendered" data-latex="x^2"><svg><g></g></svg></span>',
                    },
                    { text: '<b>plain</b>' },
                ],
                solutionMulti: [0],
            });
            const container = document.getElementById('adaptativeQuizQuestionContainer-prerendered-opt');
            // The trusted pre-rendered SVG survives intact...
            expect(container.querySelector('.exe-math-rendered svg')).not.toBeNull();
            // ...while plain author markup is still escaped.
            expect(container.innerHTML).toContain('&lt;b&gt;plain&lt;/b&gt;');
            // No MathJax needed: nothing unrendered to typeset.
            expect(updateLatexSpy).not.toHaveBeenCalled();
        });

        it('escapeHtmlButKeepRenderedMath neutralises a forged math span (XSS boundary)', () => {
            const forged = '<span class="exe-math-rendered" data-latex=""><svg onload="alert(1)"></svg></span>';
            const out = adq.escapeHtmlButKeepRenderedMath('Pick ' + forged);
            // The script-bearing span is escaped, not kept raw.
            expect(out).not.toContain('<svg onload');
            expect(out).toContain('&lt;svg onload');
        });

        it('typesets the question container when the stem contains LaTeX', () => {
            renderQuestion('latex-stem', {
                typeSelect: 0,
                question: 'Solve \\(x^2 + 1 = 0\\)',
                options: [{ text: 'A' }, { text: 'B' }],
                solutionMulti: [0],
            });
            expect(updateLatexSpy).toHaveBeenCalledWith('#adaptativeQuizQuestionContainer-latex-stem');
        });

        it('typesets the question container when an answer option contains LaTeX', () => {
            renderQuestion('latex-option', {
                typeSelect: 0,
                question: 'Pick the identity',
                options: [{ text: '\\(\\sin^2\\theta + \\cos^2\\theta = 1\\)' }, { text: 'B' }],
                solutionMulti: [0],
            });
            expect(updateLatexSpy).toHaveBeenCalledWith('#adaptativeQuizQuestionContainer-latex-option');
        });

        it('does not typeset when the question has no LaTeX', () => {
            renderQuestion('latex-none', {
                typeSelect: 0,
                question: 'Plain question with no math',
                options: [{ text: 'A' }, { text: 'B' }],
                solutionMulti: [0],
            });
            expect(updateLatexSpy).not.toHaveBeenCalled();
        });

        it('typesets the feedback message when it contains LaTeX', () => {
            const id = 'latex-msg';
            document.body.innerHTML = `<div id="adaptativeQuizMessages-${id}"></div>`;
            adq.setMessage(id, 'Correct, because \\(2 + 2 = 4\\)', 'success', true);
            expect(updateLatexSpy).toHaveBeenCalledWith('#adaptativeQuizMessages-' + id);
        });

        it('does not typeset a plain feedback message', () => {
            const id = 'plain-msg';
            document.body.innerHTML = `<div id="adaptativeQuizMessages-${id}"></div>`;
            adq.setMessage(id, 'Well done', 'success', true);
            expect(updateLatexSpy).not.toHaveBeenCalled();
        });

        it('typesets the final report when a report message contains LaTeX', () => {
            const id = 'latex-report';
            document.body.innerHTML = `<div id="adaptativeQuizReport-${id}"></div>`;
            adq.options[id] = {
                id,
                hits: 1,
                errors: 0,
                roundCount: 1,
                numRound: 1,
                currentLevel: 1,
                maxLevel: 3,
                maxLevelReached: 1,
                levelNames: ['Easy', 'Medium', 'Hard'],
                msgs: { ...adq.msgs, msgReportTitle: 'Final score \\(\\alpha\\)' },
            };
            adq.renderFinalReport(id);
            expect(updateLatexSpy).toHaveBeenCalledWith('#adaptativeQuizReport-' + id);
        });
    });

    describe('progress and SCORM persistence', () => {
        it('saves progress and automatic SCORM when the learner answers a question', () => {
            const id = 'progress-answer';
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}">
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="0">
                        <input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="0" type="checkbox" checked />
                    </label>
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="1">
                        <input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="1" type="checkbox" />
                    </label>
                </div>
                <div id="adaptativeQuizHits-${id}"></div>
                <div id="adaptativeQuizErrors-${id}"></div>
                <div id="adaptativeQuizScore-${id}"></div>
                <div id="adaptativeQuizLevel-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <div id="adaptativeQuizReport-${id}"></div>
            `;

            adq.options[id] = {
                id,
                questions: [
                    {
                        typeSelect: 0,
                        options: [{ text: 'A' }, { text: 'B' }],
                        solutionMulti: [0],
                        difficulty: 1,
                    },
                ],
                currentQuestionIndex: 0,
                hits: 0,
                errors: 0,
                score: 0,
                scorerp: 0,
                numRound: 1,
                minQuestionsShown: 0,
                roundCount: 0,
                answeredIndexes: [],
                currentLevel: 1,
                maxLevel: 3,
                maxLevelReached: 1,
                consecutiveCorrect: 0,
                consecutiveWrong: 0,
                showSolution: false,
                gameStarted: true,
                gameOver: false,
                isScorm: 1,
                msgs: adq.msgs,
            };

            const sendScoreSpy = vi.spyOn(adq, 'sendScore').mockImplementation(() => {});
            const saveEvaluationSpy = vi.spyOn(adq, 'saveEvaluation').mockImplementation(() => {});

            adq.checkAnswer(id);

            expect(sendScoreSpy).toHaveBeenCalledOnce();
            expect(sendScoreSpy).toHaveBeenCalledWith(true, id);
            expect(saveEvaluationSpy).toHaveBeenCalledOnce();
            expect(saveEvaluationSpy).toHaveBeenCalledWith(id);
            expect(adq.options[id].hits).toBe(1);
            expect(adq.options[id].progressSaveMarker).toBe('1:1:0');
        });

        it('does not duplicate progress persistence for the same answered state', () => {
            const id = 'progress-once';
            adq.options[id] = {
                id,
                roundCount: 1,
                hits: 1,
                errors: 0,
                isScorm: 1,
            };
            const sendScoreSpy = vi.spyOn(adq, 'sendScore').mockImplementation(() => {});
            const saveEvaluationSpy = vi.spyOn(adq, 'saveEvaluation').mockImplementation(() => {});

            adq.saveProgress(id);
            adq.saveProgress(id);

            expect(sendScoreSpy).toHaveBeenCalledOnce();
            expect(saveEvaluationSpy).toHaveBeenCalledOnce();
        });

        it('resets the progress persistence marker when starting a new game', () => {
            const id = 'progress-reset';
            document.body.innerHTML = `
                <div id="adaptativeQuizHits-${id}"></div>
                <div id="adaptativeQuizErrors-${id}"></div>
                <div id="adaptativeQuizScore-${id}"></div>
                <div id="adaptativeQuizShowClue-${id}"></div>
                <div id="adaptativeQuizShowClueText-${id}"></div>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <div id="adaptativeQuizReport-${id}"></div>
                <div id="adaptativeQuizStartGameDiv-${id}"></div>
                <div id="adaptativeQuizQuestionContainer-${id}"></div>
                <div id="adaptativeQuizButtonsContainer-${id}"></div>
            `;
            adq.options[id] = {
                id,
                questions: [{ difficulty: 1 }],
                hits: 1,
                errors: 0,
                score: 10,
                obtainedClue: true,
                progressSaveMarker: '1:1:0',
                initialLevel: 1,
                currentLevel: 2,
                maxLevelReached: 2,
                consecutiveCorrect: 1,
                consecutiveWrong: 1,
                answeredIndexes: [0],
                roundCount: 1,
            };
            vi.spyOn(adq, 'pickNextQuestionIndex').mockReturnValue(0);
            const renderSpy = vi.spyOn(adq, 'renderCurrentQuestion').mockImplementation(() => {});

            adq.startGame(id);

            expect(adq.options[id].progressSaveMarker).toBe('');
            expect(adq.options[id].hits).toBe(0);
            expect(adq.options[id].roundCount).toBe(0);
            expect(renderSpy).toHaveBeenCalledWith(id);
        });
    });

    describe('scoreRatio', () => {
        beforeEach(() => {
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        scorm: { sendScoreNew: vi.fn() },
                        report: { saveEvaluation: vi.fn() },
                    },
                },
            };
        });

        afterEach(() => {
            delete global.$exeDevices;
        });

        it('returns correct answers over the number of rounds', () => {
            expect(adq.scoreRatio(3, 6)).toBe(0.5);
            expect(adq.scoreRatio(6, 6)).toBe(1);
            expect(adq.scoreRatio(0, 6)).toBe(0);
        });

        it('never exceeds 100% even if hits is greater than the rounds', () => {
            expect(adq.scoreRatio(5, 3)).toBe(1);
        });

        it('falls back to a denominator of 1 when numRound is missing or zero', () => {
            expect(adq.scoreRatio(0, 0)).toBe(0);
            expect(adq.scoreRatio(1, 0)).toBe(1);
            expect(adq.scoreRatio(0, undefined)).toBe(0);
        });

        it('treats missing or non-numeric hits as zero', () => {
            expect(adq.scoreRatio(undefined, 4)).toBe(0);
            expect(adq.scoreRatio('abc', 4)).toBe(0);
        });

        it('feeds the SCORM score (scorerp) on the 0-10 scale', () => {
            const id = 'score-rp';
            adq.options[id] = { id, hits: 3, numRound: 6, previousScores: {} };
            adq.previousScores = {};
            adq.sendScore(true, id);
            expect(adq.options[id].scorerp).toBe(5);
        });
    });

    describe('feedback message vs showSolution', () => {
        function setupFeedbackGame(id, overrides) {
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}">
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="0">
                        <input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="0" type="checkbox" checked />
                    </label>
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="1">
                        <input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="1" type="checkbox" />
                    </label>
                    <div class="ADAPTATIVEQUIZ-Messages" id="adaptativeQuizMessages-${id}"></div>
                </div>
                <div id="adaptativeQuizHits-${id}"></div>
                <div id="adaptativeQuizErrors-${id}"></div>
                <div id="adaptativeQuizScore-${id}"></div>
                <div id="adaptativeQuizLevel-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <div id="adaptativeQuizReport-${id}"></div>
            `;
            adq.options[id] = {
                id,
                questions: [
                    {
                        typeSelect: 0,
                        options: [{ text: 'A' }, { text: 'B' }],
                        solutionMulti: [0],
                        difficulty: 1,
                        msgHit: 'CUSTOM_CORRECT',
                        msgError: 'CUSTOM_WRONG',
                    },
                ],
                currentQuestionIndex: 0,
                hits: 0,
                errors: 0,
                score: 0,
                scorerp: 0,
                numRound: 1,
                minQuestionsShown: 0,
                roundCount: 0,
                answeredIndexes: [],
                currentLevel: 1,
                maxLevel: 3,
                maxLevelReached: 1,
                consecutiveCorrect: 0,
                consecutiveWrong: 0,
                gameStarted: true,
                gameOver: false,
                isScorm: 0,
                msgs: { ...adq.msgs, msgSuccesses: 'GENERIC_CORRECT', msgFailures: 'GENERIC_WRONG' },
                ...overrides,
            };
            vi.spyOn(adq, 'saveProgress').mockImplementation(() => {});
            return adq.options[id];
        }

        it('shows the generic correct message (not the custom one) and no solution when solutions are hidden', () => {
            const id = 'fb-hidden';
            setupFeedbackGame(id, { showSolution: false });

            adq.checkAnswer(id);

            const msg = document.getElementById(`adaptativeQuizMessages-${id}`).textContent;
            expect(msg).toContain('GENERIC_CORRECT');
            expect(msg).not.toContain('CUSTOM_CORRECT');
            // Solution is not revealed: the correct option is not highlighted.
            const correctOption = document.querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-Option[data-orig-index="0"]`);
            expect(correctOption.classList.contains('ADAPTATIVEQUIZ-OptionCorrect')).toBe(false);
        });

        it('uses the custom message and reveals the solution when solutions are shown', () => {
            const id = 'fb-shown';
            setupFeedbackGame(id, { showSolution: true });

            adq.checkAnswer(id);

            const msg = document.getElementById(`adaptativeQuizMessages-${id}`).textContent;
            expect(msg).toContain('CUSTOM_CORRECT');
            const correctOption = document.querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-Option[data-orig-index="0"]`);
            expect(correctOption.classList.contains('ADAPTATIVEQUIZ-OptionCorrect')).toBe(true);
        });
    });

    describe('answer locking (prevents double answer)', () => {
        function setupLockGame(id, overrides) {
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}">
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="0">
                        <input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="0" type="checkbox" checked />
                    </label>
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="1">
                        <input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="1" type="checkbox" />
                    </label>
                    <input class="ADAPTATIVEQUIZ-WordInput" id="adaptativeQuizWord-${id}" />
                    <div class="ADAPTATIVEQUIZ-Messages" id="adaptativeQuizMessages-${id}"></div>
                </div>
                <div id="adaptativeQuizHits-${id}"></div>
                <div id="adaptativeQuizErrors-${id}"></div>
                <div id="adaptativeQuizScore-${id}"></div>
                <div id="adaptativeQuizLevel-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <div id="adaptativeQuizReport-${id}"></div>
            `;
            adq.options[id] = {
                id,
                questions: [
                    { typeSelect: 0, options: [{ text: 'A' }, { text: 'B' }], solutionMulti: [0], difficulty: 1 },
                    { typeSelect: 0, options: [{ text: 'A' }, { text: 'B' }], solutionMulti: [0], difficulty: 1 },
                ],
                currentQuestionIndex: 0,
                hits: 0,
                errors: 0,
                score: 0,
                scorerp: 0,
                numRound: 2,
                minQuestionsShown: 0,
                roundCount: 0,
                answeredIndexes: [],
                currentLevel: 1,
                maxLevel: 3,
                maxLevelReached: 1,
                consecutiveCorrect: 0,
                consecutiveWrong: 0,
                showSolution: false,
                gameStarted: true,
                gameOver: false,
                isScorm: 0,
                msgs: adq.msgs,
                ...overrides,
            };
            vi.spyOn(adq, 'saveProgress').mockImplementation(() => {});
            return adq.options[id];
        }

        it('locks every control after a valid answer', () => {
            const id = 'lock1';
            setupLockGame(id);

            adq.checkAnswer(id);

            expect(adq.options[id].answerLocked).toBe(true);
            expect(document.getElementById(`adaptativeQuizBtnCheck-${id}`).disabled).toBe(true);
            expect(document.getElementById(`adaptativeQuizWord-${id}`).disabled).toBe(true);
            expect(
                document.querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-OptionInput`).disabled,
            ).toBe(true);
        });

        it('ignores a second answer attempt while the question is locked', () => {
            const id = 'lock2';
            setupLockGame(id);

            adq.checkAnswer(id);
            const hitsAfterFirst = adq.options[id].hits;
            const roundAfterFirst = adq.options[id].roundCount;
            adq.checkAnswer(id); // second Enter key / click

            expect(adq.options[id].hits).toBe(hitsAfterFirst);
            expect(adq.options[id].roundCount).toBe(roundAfterFirst);
        });

        it('unlocks and re-enables the check button on the next question', () => {
            const id = 'lock3';
            setupLockGame(id);

            adq.checkAnswer(id);
            adq.options[id].currentQuestionIndex = 1;
            adq.renderCurrentQuestion(id);

            expect(adq.options[id].answerLocked).toBe(false);
            expect(document.getElementById(`adaptativeQuizBtnCheck-${id}`).disabled).toBe(false);
        });
    });

    describe('case-sensitive word hint', () => {
        function renderWord(id, caseSensitive) {
            document.body.innerHTML = `<div id="adaptativeQuizQuestionContainer-${id}"></div>`;
            adq.options[id] = {
                id,
                questions: [
                    { typeSelect: 2, question: 'AbC', solutionWord: 'def', percentageShow: 100, options: [] },
                ],
                currentQuestionIndex: 0,
                shuffle: false,
                caseSensitive,
                roundCount: 0,
                msgs: adq.msgs,
            };
            adq.renderCurrentQuestion(id);
            return document.getElementById(`adaptativeQuizQuestionContainer-${id}`).innerHTML;
        }

        it('buildWordHint bakes the original case into the markup when case-sensitive', () => {
            const html = adq.buildWordHint('AbC', 100, true);
            expect(html).toContain('>A<');
            expect(html).toContain('>b<');
            expect(html).toContain('>C<');
        });

        it('buildWordHint uppercases the letters in the markup when not case-sensitive', () => {
            const html = adq.buildWordHint('AbC', 100, false);
            expect(html).toContain('>A<');
            expect(html).toContain('>B<');
            expect(html).toContain('>C<');
            expect(html).not.toContain('>b<');
        });

        it('renders every word of a multi-word answer with its original case (case-sensitive)', () => {
            const id = 'cs-multi';
            document.body.innerHTML = `<div id="adaptativeQuizQuestionContainer-${id}"></div>`;
            adq.options[id] = {
                id,
                questions: [
                    { typeSelect: 2, question: 'Hola Mundo Adios', solutionWord: 'd', percentageShow: 100, options: [] },
                ],
                currentQuestionIndex: 0,
                shuffle: false,
                caseSensitive: true,
                roundCount: 0,
                msgs: adq.msgs,
            };
            adq.renderCurrentQuestion(id);
            const html = document.getElementById(`adaptativeQuizQuestionContainer-${id}`).innerHTML;
            // Every word keeps its original case — not just the first one. The
            // case is baked into the markup, so it never depends on CSS.
            expect(html).toContain('>H<');
            expect(html).toContain('>M<');
            expect(html).toContain('>A<');
            expect(html).toContain('>o<');
            expect(html).toContain('>u<');
            expect(html).not.toContain('>U<'); // "Mundo" must not become "MUNDO"
        });

        it('uppercases the letters when caseSensitive is off', () => {
            const html = renderWord('cs-off', false);
            expect(html).toContain('>A<');
            expect(html).toContain('>B<');
            expect(html).not.toContain('>b<');
        });

        it('the hint cells no longer rely on CSS text-transform', () => {
            const css = readFileSync(join(__dirname, 'adaptative-quiz.css'), 'utf-8');
            const rule = css.match(/\.ADAPTATIVEQUIZ-WordHintLetter\s*\{[^}]*\}/)?.[0] || '';
            expect(rule).not.toContain('text-transform');
        });
    });

    describe('select-type solution colours', () => {
        it('marks every correct option green (even if selected) and leaves a wrong selected option unmarked', () => {
            const id = 'colour';
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}">
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="0"><input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="0" type="checkbox" checked /></label>
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="1"><input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="1" type="checkbox" /></label>
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="2"><input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="2" type="checkbox" checked /></label>
                    <div class="ADAPTATIVEQUIZ-Messages" id="adaptativeQuizMessages-${id}"></div>
                </div>
                <div id="adaptativeQuizHits-${id}"></div>
                <div id="adaptativeQuizErrors-${id}"></div>
                <div id="adaptativeQuizScore-${id}"></div>
                <div id="adaptativeQuizLevel-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <div id="adaptativeQuizReport-${id}"></div>
            `;
            adq.options[id] = {
                id,
                questions: [
                    { typeSelect: 0, options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }], solutionMulti: [0, 1], difficulty: 1 },
                ],
                currentQuestionIndex: 0,
                hits: 0,
                errors: 0,
                score: 0,
                scorerp: 0,
                numRound: 1,
                minQuestionsShown: 0,
                roundCount: 0,
                answeredIndexes: [],
                currentLevel: 1,
                maxLevel: 3,
                maxLevelReached: 1,
                consecutiveCorrect: 0,
                consecutiveWrong: 0,
                showSolution: true,
                gameStarted: true,
                gameOver: false,
                isScorm: 0,
                msgs: adq.msgs,
            };
            vi.spyOn(adq, 'saveProgress').mockImplementation(() => {});

            adq.checkAnswer(id);

            const opt = i =>
                document.querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-Option[data-orig-index="${i}"]`);
            // Both correct options are green — including the one that was selected.
            expect(opt(0).classList.contains('ADAPTATIVEQUIZ-OptionCorrect')).toBe(true);
            expect(opt(1).classList.contains('ADAPTATIVEQUIZ-OptionCorrect')).toBe(true);
            // The wrong but selected option is not recoloured: it keeps its
            // checked (blue) state, no correct/incorrect class added.
            expect(opt(2).classList.contains('ADAPTATIVEQUIZ-OptionCorrect')).toBe(false);
            expect(opt(2).classList.contains('ADAPTATIVEQUIZ-OptionIncorrect')).toBe(false);
            expect(opt(2).querySelector('input').checked).toBe(true);
        });
    });

    describe('option audio on click', () => {
        afterEach(() => {
            delete global.$exeDevices;
        });

        it('plays the option sound when an option with audio is clicked', () => {
            const id = 'optaudio';
            const playSound = vi.fn();
            const stopSound = vi.fn();
            global.$exeDevices = {
                iDevice: { gamification: { media: { playSound, stopSound } } },
            };
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}">
                    <label class="ADAPTATIVEQUIZ-Option ADAPTATIVEQUIZ-Option--has-audio" data-orig-index="0">
                        <input class="ADAPTATIVEQUIZ-OptionInput" type="checkbox" />
                        <button class="ADAPTATIVEQUIZ-AudioToggle ADAPTATIVEQUIZ-AudioToggle--option" data-audio-url="sounds/a.mp3"></button>
                    </label>
                </div>
            `;

            adq.bindMediaToggle(id);
            document
                .querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-Option--has-audio`)
                .click();

            expect(playSound).toHaveBeenCalledWith('sounds/a.mp3');
        });
    });

    describe('audio toggle playing-state sync', () => {
        afterEach(() => {
            delete global.$exeDevices;
        });

        it('clears is-playing when the clip ends so the next click plays again (no every-other-click dead zone)', () => {
            const id = 'stemaudio';
            let endedHandler = null;
            const fakeAudio = {
                addEventListener: (evt, cb) => {
                    if (evt === 'ended') endedHandler = cb;
                },
            };
            const media = {
                playerAudio: null,
                playSound: vi.fn(function () {
                    // Mirror the real helper: build the audio element synchronously.
                    media.playerAudio = fakeAudio;
                }),
                stopSound: vi.fn(function () {
                    media.playerAudio = null;
                }),
            };
            global.$exeDevices = { iDevice: { gamification: { media } } };
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}">
                    <button class="ADAPTATIVEQUIZ-AudioToggle ADAPTATIVEQUIZ-AudioToggle--stem" data-audio-url="stem.mp3"></button>
                </div>
            `;

            adq.bindMediaToggle(id);
            const btn = document.querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-AudioToggle`);

            btn.click();
            expect(media.playSound).toHaveBeenCalledTimes(1);
            expect(btn.classList.contains('is-playing')).toBe(true);

            // The clip finishes on its own — the visual state must reset.
            expect(typeof endedHandler).toBe('function');
            endedHandler();
            expect(btn.classList.contains('is-playing')).toBe(false);

            // Next click plays again instead of being swallowed as a "stop".
            btn.click();
            expect(media.playSound).toHaveBeenCalledTimes(2);
            expect(btn.classList.contains('is-playing')).toBe(true);
        });
    });

    describe('itinerary clue', () => {
        function clueOpts(overrides) {
            return {
                hits: 0,
                numRound: 4,
                obtainedClue: false,
                itinerary: { showClue: true, percentageClue: 50, clueGame: 'Look behind the door' },
                ...overrides,
            };
        }

        it('does not reveal the clue when the activity has no clue configured', () => {
            const opts = clueOpts({ hits: 4, itinerary: { showClue: false, percentageClue: 0 } });
            expect(adq.shouldRevealClue(opts)).toBe(false);
        });

        it('does not reveal the clue without activity options', () => {
            expect(adq.shouldRevealClue()).toBe(false);
        });

        it('does not reveal the clue while the hit percentage is below the threshold', () => {
            const opts = clueOpts({ hits: 1 }); // 25% < 50%
            expect(adq.shouldRevealClue(opts)).toBe(false);
        });

        it('reveals the clue once the hit percentage reaches the threshold', () => {
            const opts = clueOpts({ hits: 2 }); // 50% >= 50%
            expect(adq.shouldRevealClue(opts)).toBe(true);
        });

        it('does not reveal the clue again once it has been obtained', () => {
            const opts = clueOpts({ hits: 4, obtainedClue: true });
            expect(adq.shouldRevealClue(opts)).toBe(false);
        });

        it('maybeRevealClue shows the clue text in the DOM and marks it as obtained', () => {
            const id = 'clue-dom';
            document.body.innerHTML = `
                <div id="adaptativeQuizShowClue-${id}" style="display:none"></div>
                <p id="adaptativeQuizShowClueText-${id}"></p>
            `;
            adq.options[id] = clueOpts({ hits: 2 });

            adq.maybeRevealClue(id);

            expect(adq.options[id].obtainedClue).toBe(true);
            expect(document.getElementById(`adaptativeQuizShowClueText-${id}`).textContent).toBe(
                'Look behind the door',
            );
            expect(document.getElementById(`adaptativeQuizShowClue-${id}`).style.display).not.toBe('none');
        });
    });

    describe('setupScorm', () => {
        let registerActivitySpy;
        let originalExe;

        beforeEach(() => {
            registerActivitySpy = vi.fn();
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        scorm: { registerActivity: registerActivitySpy, getUserName: () => 'Ada' },
                    },
                },
            };
            originalExe = global.eXe;
            document.body.className = '';
        });

        afterEach(() => {
            delete global.$exeDevices;
            delete window.scorm;
            global.eXe = originalExe;
            document.body.className = '';
        });

        it('registers the activity directly when not inside a SCORM package', () => {
            const id = 'no-scorm';
            adq.options[id] = { id, isScorm: 1 };

            adq.setupScorm(id);

            expect(registerActivitySpy).toHaveBeenCalledWith(adq.options[id]);
        });

        it('initialises the LMS connection and registers the activity when the API is ready', () => {
            const id = 'scorm-ready';
            adq.options[id] = { id, isScorm: 1 };
            document.body.classList.add('exe-scorm');
            const setMax = vi.fn();
            const setMin = vi.fn();
            window.scorm = { init: () => true, SetScoreMax: setMax, SetScoreMin: setMin };

            adq.setupScorm(id);

            expect(setMax).toHaveBeenCalledWith(100);
            expect(setMin).toHaveBeenCalledWith(0);
            expect(registerActivitySpy).toHaveBeenCalledWith(adq.options[id]);
        });

        it('loads the SCORM API wrapper when the LMS API is not yet available', () => {
            const id = 'scorm-deferred';
            adq.options[id] = { id, isScorm: 1 };
            document.body.classList.add('exe-scorm');
            delete window.scorm;
            const loadScriptSpy = vi.fn();
            global.eXe = { app: { loadScript: loadScriptSpy, isInExe: () => false } };

            adq.setupScorm(id);

            expect(loadScriptSpy).toHaveBeenCalledOnce();
            expect(loadScriptSpy.mock.calls[0][1]).toContain('$adaptativequiz.loadScoFunctions');
            expect(registerActivitySpy).not.toHaveBeenCalled();
        });

        it('starts the game only after SCORM has been initialised (deferred start)', () => {
            const id = 'deferred-start';
            adq.options[id] = { id, isScorm: 1, questions: [{ difficulty: 1 }], itinerary: {} };
            document.body.classList.add('exe-scorm');
            window.scorm = { init: () => true, SetScoreMax: vi.fn(), SetScoreMin: vi.fn() };
            const beginSpy = vi.spyOn(adq, 'beginActivity').mockImplementation(() => {});

            adq.setupScorm(id);

            expect(registerActivitySpy).toHaveBeenCalledWith(adq.options[id]);
            expect(beginSpy).toHaveBeenCalledWith(id);
        });
    });

    describe('maybeStartAfterScorm', () => {
        afterEach(() => {
            document.body.className = '';
            document.body.innerHTML = '';
        });

        it('starts the game when there are questions and no access-code gate', () => {
            const id = 'start-ok';
            adq.options[id] = { id, gameStarted: false, questions: [{ difficulty: 1 }], itinerary: {} };
            const beginSpy = vi.spyOn(adq, 'beginActivity').mockImplementation(() => {});

            adq.maybeStartAfterScorm(id);

            expect(beginSpy).toHaveBeenCalledWith(id);
        });

        it('does not start the game when an access code is required', () => {
            const id = 'start-gated';
            adq.options[id] = {
                id,
                gameStarted: false,
                questions: [{ difficulty: 1 }],
                itinerary: { showCodeAccess: true },
            };
            const beginSpy = vi.spyOn(adq, 'beginActivity').mockImplementation(() => {});

            adq.maybeStartAfterScorm(id);

            expect(beginSpy).not.toHaveBeenCalled();
        });

        it('does not restart a game that is already running', () => {
            const id = 'start-running';
            adq.options[id] = { id, gameStarted: true, questions: [{ difficulty: 1 }], itinerary: {} };
            const beginSpy = vi.spyOn(adq, 'beginActivity').mockImplementation(() => {});

            adq.maybeStartAfterScorm(id);

            expect(beginSpy).not.toHaveBeenCalled();
        });

        it('waits for SCORM readiness before starting an access-code game', () => {
            const id = 'start-gated-scorm';
            document.body.classList.add('exe-scorm');
            document.body.innerHTML = `
                <input id="adaptativeQuizCodeAccessInput-${id}" value="open" />
                <div id="adaptativeQuizCodeAccessDiv-${id}"></div>
                <div id="adaptativeQuizCubierta-${id}"></div>
                <div id="adaptativeQuizMessageCodeAccess-${id}"></div>
            `;
            adq.options[id] = {
                id,
                gameStarted: false,
                isScorm: 1,
                scormReady: false,
                questions: [{ difficulty: 1 }],
                itinerary: { showCodeAccess: true, codeAccess: 'open' },
            };
            const beginSpy = vi.spyOn(adq, 'beginActivity').mockImplementation(() => {});

            adq.enterCodeAccess(id);
            adq.maybeStartAfterScorm(id);

            expect(adq.options[id].accessUnlocked).toBe(true);
            expect(beginSpy).not.toHaveBeenCalled();

            adq.options[id].scormReady = true;
            adq.maybeStartAfterScorm(id);

            expect(beginSpy).toHaveBeenCalledWith(id);
        });
    });

    describe('submit icon path resolution', () => {
        it('sets the submit-icon src from the runtime idevicePath in addEvents', () => {
            const id = 'icon';
            document.body.innerHTML = `
                <div id="adaptativeQuizCubierta-${id}">
                    <a id="adaptativeQuizCodeAccessButton-${id}">
                        <img src="exequextreply.svg" class="ADAPTATIVEQUIZ-IconSubmit" alt="" />
                    </a>
                </div>
                <div id="adaptativeQuizMainContainer-${id}"></div>
                <input id="adaptativeQuizCodeAccessInput-${id}" />
                <div id="adaptativeQuizCodeAccessDiv-${id}"></div>
                <div id="adaptativeQuizMessageCodeAccess-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <button id="adaptativeQuizBtnStart-${id}"></button>
            `;
            adq.options[id] = {
                id,
                idevicePath: '/exe/idevices/adaptative-quiz/export/',
                itinerary: { showCodeAccess: true, messageCodeAccess: '' },
                questions: [],
                isScorm: 0,
                evaluation: false,
            };

            adq.addEvents(id);

            const src = document
                .querySelector(`#adaptativeQuizCubierta-${id} .ADAPTATIVEQUIZ-IconSubmit`)
                .getAttribute('src');
            expect(src).toBe('/exe/idevices/adaptative-quiz/export/exequextreply.svg');
        });
    });

    describe('code access message rendering', () => {
        function setupCodeAccessGame(id, messageCodeAccess) {
            document.body.innerHTML = `
                <div id="adaptativeQuizCubierta-${id}">
                    <a id="adaptativeQuizCodeAccessButton-${id}">
                        <img src="exequextreply.svg" class="ADAPTATIVEQUIZ-IconSubmit" alt="" />
                    </a>
                </div>
                <div id="adaptativeQuizMainContainer-${id}"></div>
                <input id="adaptativeQuizCodeAccessInput-${id}" />
                <div id="adaptativeQuizCodeAccessDiv-${id}"></div>
                <div id="adaptativeQuizMessageCodeAccess-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <button id="adaptativeQuizBtnStart-${id}"></button>
            `;
            adq.options[id] = {
                id,
                idevicePath: '/exe/idevices/adaptative-quiz/export/',
                itinerary: { showCodeAccess: true, messageCodeAccess },
                questions: [],
                isScorm: 0,
                evaluation: false,
            };
        }

        it('keeps pre-rendered math in the access-code message while escaping author HTML', () => {
            const id = 'access-message-prerendered';
            const renderedMath =
                '<span class="exe-math-rendered" data-latex="x^2"><svg><g></g></svg></span>';
            setupCodeAccessGame(id, `Use <b>bold</b> ${renderedMath}`);

            adq.addEvents(id);

            const message = document.getElementById(`adaptativeQuizMessageCodeAccess-${id}`);
            expect(message.querySelector('.exe-math-rendered svg')).not.toBeNull();
            expect(message.querySelector('b')).toBeNull();
            expect(message.innerHTML).toContain('&lt;b&gt;bold&lt;/b&gt;');
            expect(message.textContent).not.toContain('<span');
        });

        it('requests MathJax for unrendered LaTeX in the access-code message', () => {
            const id = 'access-message-latex';
            const updateLatexSpy = vi
                .spyOn(global.$exeDevices.iDevice.gamification.math, 'updateLatex')
                .mockImplementation(() => {});
            setupCodeAccessGame(id, 'Solve \\(x + 1 = 2\\)');

            try {
                adq.addEvents(id);
                expect(updateLatexSpy).toHaveBeenCalledWith(`#adaptativeQuizMessageCodeAccess-${id}`);
            } finally {
                updateLatexSpy.mockRestore();
            }
        });
    });

    describe('SCORM auto-save per answer (integration with real helper)', () => {
        let store;

        beforeEach(() => {
            // Restore the real $exeDevices helper (other suites stub/delete it).
            global.$exeDevices = realExeDevices;
            // In-memory SCORM 1.2 data model.
            store = {};
            global.pipwerks = {
                SCORM: {
                    get: key => (key in store ? store[key] : ''),
                    set: (key, value) => {
                        store[key] = String(value);
                        return true;
                    },
                },
            };

            document.body.className = 'exe-scorm';
            document.body.innerHTML = `
                <div class="page-content">
                    <article class="idevice_node" id="adq-node">
                        <header><div class="box-title">My quiz</div></header>
                        <div id="adaptativeQuizMainContainer-INT"></div>
                        <div class="Games-BottonContainer">
                            <div class="Games-GetScore"><span class="Games-RepeatActivity"></span></div>
                        </div>
                    </article>
                </div>
            `;
        });

        afterEach(() => {
            delete global.pipwerks;
            document.body.className = '';
            document.body.innerHTML = '';
        });

        it('persists cmi.core.score.raw and refreshes the display after every answered question', () => {
            const id = 'INT';
            adq.options[id] = {
                id,
                main: 'adaptativeQuizMainContainer-INT',
                idevice: 'adaptative-quiz-IDevice',
                isScorm: 1,
                weighted: 100,
                numRound: 2,
                hits: 0,
                errors: 0,
                scorerp: 0,
                gameStarted: true,
                gameOver: false,
                roundCount: 0,
                progressSaveMarker: '',
                evaluation: false,
                msgs: adq.msgs,
            };
            adq.previousScores = {};

            // Register the activity: initial saved score is 0.
            realExeDevices.iDevice.gamification.scorm.registerActivity(adq.options[id]);
            expect(parseFloat(store['cmi.core.score.raw'] || '0')).toBe(0);

            // First correct answer -> 1/2 -> 50/100.
            adq.options[id].hits = 1;
            adq.options[id].roundCount = 1;
            adq.saveProgress(id);
            expect(parseFloat(store['cmi.core.score.raw'])).toBe(50);

            // Second correct answer -> 2/2 -> 100/100.
            adq.options[id].hits = 2;
            adq.options[id].roundCount = 2;
            adq.saveProgress(id);
            expect(parseFloat(store['cmi.core.score.raw'])).toBe(100);
            expect(store['cmi.core.lesson_status']).toBe('passed');

            // The "below the activity" element shows the latest score (0-10 scale).
            const repeatText = document.querySelector('.Games-RepeatActivity').textContent;
            expect(repeatText).toContain('10.00');
        });
    });

    describe('checkAnswer end-of-game boundary', () => {
        beforeEach(() => {
            global.$exeDevices = {
                iDevice: {
                    gamification: {
                        scorm: { sendScoreNew: vi.fn() },
                        report: { saveEvaluation: vi.fn() },
                        math: { hasLatex: vi.fn(() => false), updateLatex: vi.fn() },
                    },
                },
            };
        });

        afterEach(() => {
            delete global.$exeDevices;
        });

        function setupSingleQuestionGame(id, overrides) {
            document.body.innerHTML = `
                <div id="adaptativeQuizQuestionContainer-${id}">
                    <label class="ADAPTATIVEQUIZ-Option" data-orig-index="0">
                        <input class="ADAPTATIVEQUIZ-OptionInput" name="adaptativeQuizAnswer-${id}" value="0" type="checkbox" checked />
                    </label>
                </div>
                <div id="adaptativeQuizHits-${id}"></div>
                <div id="adaptativeQuizErrors-${id}"></div>
                <div id="adaptativeQuizScore-${id}"></div>
                <div id="adaptativeQuizLevel-${id}"></div>
                <div id="adaptativeQuizMessages-${id}"></div>
                <button id="adaptativeQuizBtnCheck-${id}"></button>
                <button id="adaptativeQuizBtnNewGame-${id}"></button>
                <div id="adaptativeQuizReport-${id}"></div>
            `;
            adq.options[id] = {
                id,
                questions: [
                    { typeSelect: 0, options: [{ text: 'A' }], solutionMulti: [0], difficulty: 1 },
                    { typeSelect: 0, options: [{ text: 'B' }], solutionMulti: [0], difficulty: 1 },
                ],
                currentQuestionIndex: 0,
                hits: 0,
                errors: 0,
                score: 0,
                scorerp: 0,
                roundCount: 0,
                answeredIndexes: [],
                currentLevel: 1,
                maxLevel: 3,
                maxLevelReached: 1,
                consecutiveCorrect: 0,
                consecutiveWrong: 0,
                showSolution: false,
                gameStarted: true,
                gameOver: false,
                isScorm: 0,
                msgs: adq.msgs,
                ...overrides,
            };
            return adq.options[id];
        }

        it('ends the game at numRound even when minQuestionsShown is larger', () => {
            const id = 'boundary';
            // numRound is 1 but minQuestionsShown defaults higher: the game must
            // still end after the single configured round, so a perfect answer
            // yields exactly 100% and never overshoots.
            const opts = setupSingleQuestionGame(id, { numRound: 1, minQuestionsShown: 5 });
            const endGameSpy = vi.spyOn(adq, 'endGame');

            adq.checkAnswer(id);

            expect(endGameSpy).toHaveBeenCalledOnce();
            expect(opts.roundCount).toBe(1);
            expect(opts.hits).toBe(1);
            expect(adq.scoreRatio(opts.hits, opts.numRound)).toBe(1);
        });

        it('uses showSolution to display feedback and reveal the correct option', () => {
            const id = 'show-feedback';
            setupSingleQuestionGame(id, {
                numRound: 1,
                minQuestionsShown: 0,
                showSolution: true,
                questions: [
                    {
                        typeSelect: 0,
                        options: [{ text: 'A' }],
                        solutionMulti: [0],
                        difficulty: 1,
                        msgHit: 'Great answer',
                    },
                ],
            });

            adq.checkAnswer(id);

            expect(document.getElementById(`adaptativeQuizMessages-${id}`).textContent).toContain('Great answer');
            expect(
                document
                    .querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-Option`)
                    .classList.contains('ADAPTATIVEQUIZ-OptionCorrect'),
            ).toBe(true);
        });

        it('shows a generic message but no custom message or solution when showSolution is disabled', () => {
            const id = 'hide-feedback';
            setupSingleQuestionGame(id, {
                numRound: 1,
                minQuestionsShown: 0,
                showSolution: false,
                questions: [
                    {
                        typeSelect: 0,
                        options: [{ text: 'A' }],
                        solutionMulti: [0],
                        difficulty: 1,
                        msgHit: 'Great answer',
                    },
                ],
            });

            adq.checkAnswer(id);

            // A generic correct/incorrect message is still shown for a few
            // seconds, but the custom per-question message is not used and the
            // solution is not revealed.
            const msg = document.getElementById(`adaptativeQuizMessages-${id}`).textContent;
            expect(msg).not.toBe('');
            expect(msg).not.toContain('Great answer');
            expect(
                document
                    .querySelector(`#adaptativeQuizQuestionContainer-${id} .ADAPTATIVEQUIZ-Option`)
                    .classList.contains('ADAPTATIVEQUIZ-OptionCorrect'),
            ).toBe(false);
        });
    });

    describe('pickNextQuestionIndex', () => {
        it('uses lower-level fallback questions after exhausting the maximum level', () => {
            const opts = {
                maxLevel: 3,
                currentLevel: 3,
                maxLevelReached: 3,
                answeredIndexes: [2, 3],
                questions: [
                    { difficulty: 1 },
                    { difficulty: 1 },
                    { difficulty: 3 },
                    { difficulty: 3 },
                ],
            };

            const idx = adq.pickNextQuestionIndex(opts);

            expect([0, 1]).toContain(idx);
            expect(opts.currentLevel).toBe(3);
            expect(opts.maxLevelReached).toBe(3);
        });

        it('repeats the current non-maximum level when its pending questions are exhausted', () => {
            const opts = {
                maxLevel: 3,
                currentLevel: 2,
                maxLevelReached: 2,
                answeredIndexes: [2, 3],
                questions: [
                    { difficulty: 1 },
                    { difficulty: 1 },
                    { difficulty: 2 },
                    { difficulty: 2 },
                    { difficulty: 3 },
                ],
            };

            const idx = adq.pickNextQuestionIndex(opts);

            expect([2, 3]).toContain(idx);
            expect(opts.currentLevel).toBe(2);
            expect(opts.maxLevelReached).toBe(2);
        });

        it('prefers pending lower-level questions from easy after exhausting the maximum level', () => {
            const opts = {
                maxLevel: 3,
                currentLevel: 3,
                maxLevelReached: 3,
                answeredIndexes: [0, 4, 5],
                questions: [
                    { difficulty: 1 },
                    { difficulty: 1 },
                    { difficulty: 2 },
                    { difficulty: 2 },
                    { difficulty: 3 },
                    { difficulty: 3 },
                ],
            };

            const idx = adq.pickNextQuestionIndex(opts);

            expect(idx).toBe(1);
            expect(opts.currentLevel).toBe(3);
            expect(opts.maxLevelReached).toBe(3);
        });

        it('repeats easy questions before medium after the maximum level and all lower pending questions are exhausted', () => {
            const opts = {
                maxLevel: 3,
                currentLevel: 3,
                maxLevelReached: 3,
                answeredIndexes: [0, 1, 2, 3, 4, 5],
                questions: [
                    { difficulty: 1 },
                    { difficulty: 1 },
                    { difficulty: 2 },
                    { difficulty: 2 },
                    { difficulty: 3 },
                    { difficulty: 3 },
                ],
            };

            const idx = adq.pickNextQuestionIndex(opts);

            expect([0, 1]).toContain(idx);
            expect(opts.currentLevel).toBe(3);
            expect(opts.maxLevelReached).toBe(3);
        });
    });

    describe('applyAdaptation', () => {
        const baseOpts = () => ({
            maxLevel: 3,
            currentLevel: 3,
            maxLevelReached: 3,
            consecutiveCorrect: 0,
            consecutiveWrong: 0,
        });

        it('moves down after two consecutive wrong answers while staying in the current level', () => {
            const opts = baseOpts();

            expect(adq.applyAdaptation(opts, false)).toBe(0);
            expect(opts.currentLevel).toBe(3);
            expect(opts.consecutiveWrong).toBe(1);

            expect(adq.applyAdaptation(opts, false)).toBe(-1);
            expect(opts.currentLevel).toBe(2);
            expect(opts.consecutiveWrong).toBe(0);
        });

        it('counts wrong fallback questions toward the current-level down streak', () => {
            const opts = baseOpts();

            expect(adq.applyAdaptation(opts, false)).toBe(0);
            expect(adq.applyAdaptation(opts, false)).toBe(-1);

            expect(opts.currentLevel).toBe(2);
            expect(opts.consecutiveWrong).toBe(0);
        });

        it('resets a wrong streak when a correct answer is given', () => {
            const opts = baseOpts();

            expect(adq.applyAdaptation(opts, false)).toBe(0);
            expect(opts.consecutiveWrong).toBe(1);

            expect(adq.applyAdaptation(opts, true)).toBe(0);
            expect(opts.consecutiveWrong).toBe(0);
            expect(opts.consecutiveCorrect).toBe(1);

            expect(adq.applyAdaptation(opts, false)).toBe(0);
            expect(opts.currentLevel).toBe(3);
            expect(opts.consecutiveWrong).toBe(1);
        });
    });

    describe('updateConfig question normalization (4 types)', () => {
        it('migrates legacy entries (no typeSelect, single solution) to typeSelect=0 with solutionMulti', () => {
            const data = {
                questionsGame: [{ question: 'Q', options: [{ text: 'A' }, { text: 'B' }], solution: 1 }],
                numRound: 1,
            };
            const out = adq.updateConfig(data, 'norm1');
            expect(out.questions[0].typeSelect).toBe(0);
            expect(out.questions[0].solutionMulti).toEqual([1]);
            expect(out.questions[0].solutionOrder).toEqual([]);
            expect(out.questions[0].solutionWord).toBe('');
        });

        it('migrates explicit legacy typeSelect=3 to 0 with solutionMulti from solution', () => {
            const data = {
                questionsGame: [
                    {
                        question: 'Q',
                        options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }],
                        typeSelect: 3,
                        solution: 2,
                    },
                ],
                numRound: 1,
            };
            const out = adq.updateConfig(data, 'norm1b');
            expect(out.questions[0].typeSelect).toBe(0);
            expect(out.questions[0].solutionMulti).toEqual([2]);
        });

        it('preserves per-type fields when provided', () => {
            const data = {
                questionsGame: [
                    {
                        question: 'Q',
                        options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
                        typeSelect: 1,
                        solution: 0,
                        solutionMulti: [0, 2],
                        solutionOrder: [2, 1, 4, 3],
                        solutionWord: 'hello',
                    },
                ],
                numRound: 1,
            };
            const out = adq.updateConfig(data, 'norm2');
            const q = out.questions[0];
            expect(q.typeSelect).toBe(1);
            expect(q.solutionMulti).toEqual([0, 2]);
            expect(q.solutionOrder).toEqual([2, 1, 4, 3]);
            expect(q.solutionWord).toBe('hello');
        });
    });
});
