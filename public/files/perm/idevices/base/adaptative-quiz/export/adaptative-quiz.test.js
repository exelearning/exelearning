import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
