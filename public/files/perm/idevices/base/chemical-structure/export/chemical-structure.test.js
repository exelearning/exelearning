/**
 * Unit tests for chemical-structure iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - sanitizeSvg: strips XSS vectors from SVG strings
 * - clear: normalises whitespace in a phrase
 * - getShowLetter: selects random letter indices to reveal
 * - createLives: generates lives HTML
 * - createOptions: generates answer-option HTML
 * - getScoreRP: calculates the reporting score
 * - getShowScoreRP: calculates the show-mode reporting score
 * - updateNumberQuestion: advances the active question index
 * - loadDataGame: parses and migrates saved game data
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    // Expose the object globally so tests can access it
    let modifiedCode = code.replace(/var\s+\$eXeChemical\s*=/, 'global.$eXeChemical =');
    // Remove auto-init call
    modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeChemical\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeChemical;
}

describe('chemical-structure iDevice export', () => {
    let $eXeChemical;

    beforeEach(() => {
        global.$eXeChemical = undefined;

        // Minimal $exeDevices mock required at evaluation time
        global.$exeDevices = {
            iDevice: {
                gamification: {
                    colors: {
                        borderColors: {
                            red: '#e74c3c',
                            green: '#2ecc71',
                            blue: '#3498db',
                            yellow: '#f1c40f',
                            correct: '#2ecc71',
                            incorrect: '#e74c3c',
                            grey: '#95a5a6',
                            black: '#2c3e50',
                        },
                        backColor: {
                            black: '#2c3e50',
                            correct: '#d5f5e3',
                        },
                    },
                    helpers: {
                        decrypt: (json) => json,
                        isJsonString: (json) => JSON.parse(json),
                        getQuestions: (questions) => questions,
                        shuffleAds: (arr) => [...arr],
                        getTimeToString: (t) => String(t),
                        getTimeSeconds: (t) => t,
                    },
                    math: {
                        hasLatex: () => false,
                        updateLatex: () => {},
                    },
                    scorm: {
                        addButtonScoreNew: () => '',
                    },
                    report: {
                        updateEvaluationIcon: () => {},
                        saveEvaluation: () => {},
                    },
                    media: { stopSound: () => {} },
                    observers: { observeResize: () => {} },
                    initGame: () => {},
                },
            },
        };

        const filePath = join(__dirname, 'chemical-structure.js');
        const code = readFileSync(filePath, 'utf-8');
        $eXeChemical = loadExportIdevice(code);
    });

    afterEach(() => {
        delete global.$exeDevices;
        delete global.$eXeChemical;
    });

    // ──────────────────────────────────────────────────────────────
    // sanitizeSvg
    // ──────────────────────────────────────────────────────────────
    describe('sanitizeSvg', () => {
        it('returns empty string for falsy input', () => {
            expect($eXeChemical.sanitizeSvg('')).toBe('');
            expect($eXeChemical.sanitizeSvg(null)).toBe('');
            expect($eXeChemical.sanitizeSvg(undefined)).toBe('');
        });

        it('removes script elements', () => {
            const svg = '<svg><script>alert(1)</script><circle/></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('<script');
            expect(result).toContain('<circle');
        });

        it('removes inline event handlers', () => {
            const svg = '<svg><circle onclick="evil()" onmouseover=\'bad()\'></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('onclick');
            expect(result).not.toContain('onmouseover');
        });

        it('replaces javascript: href with #', () => {
            const svg = '<svg><a href="javascript:evil()">x</a></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('javascript:');
        });

        it('replaces javascript: in xlink:href', () => {
            const svg = '<svg><a xlink:href="javascript:evil()">x</a></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('javascript:');
        });

        it('removes foreignObject elements', () => {
            const svg = '<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject><circle/></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('foreignObject');
            expect(result).toContain('<circle');
        });

        it('replaces data:text/html URIs in href', () => {
            const svg = '<svg><a href="data:text/html,<script>alert(1)</script>">x</a></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('data:text/html');
        });

        it('replaces data:text/html URIs in xlink:href', () => {
            const svg = '<svg><image xlink:href="data:text/html,<script>alert(1)</script>"/></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('data:text/html');
        });

        it('removes white full-canvas background rect', () => {
            const svg = '<svg><rect x="0" y="0" width="100%" height="100%" fill="#fff"/><circle cx="50" cy="50" r="20"/></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('<rect');
            expect(result).toContain('<circle');
        });

        it('removes root background style from svg', () => {
            const svg = '<svg style="background-color:#fff;stroke:#000"><circle/></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).not.toContain('background-color');
            expect(result).toContain('stroke:#000');
        });

        it('leaves safe SVG untouched', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
            const result = $eXeChemical.sanitizeSvg(svg);
            expect(result).toBe(svg);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // clear
    // ──────────────────────────────────────────────────────────────
    describe('clear', () => {
        it('collapses multiple spaces into one', () => {
            expect($eXeChemical.clear('hello   world')).toBe('hello world');
        });

        it('trims leading and trailing whitespace', () => {
            expect($eXeChemical.clear('  hello  ')).toBe('hello');
        });

        it('replaces newlines with a single space', () => {
            expect($eXeChemical.clear('hello\nworld')).toBe('hello world');
        });

        it('returns empty string for blank input', () => {
            expect($eXeChemical.clear('   ')).toBe('');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // getShowLetter
    // ──────────────────────────────────────────────────────────────
    describe('getShowLetter', () => {
        it('returns an array of the correct length for nivel=50', () => {
            const phrase = 'CAFFEINE';
            const result = $eXeChemical.getShowLetter(phrase, 50);
            const expected = Math.floor((phrase.length * 50) / 100);
            expect(result.length).toBe(expected);
        });

        it('returns no indices for nivel=0', () => {
            expect($eXeChemical.getShowLetter('ASPIRIN', 0)).toEqual([]);
        });

        it('returns all indices for nivel=100', () => {
            const phrase = 'GLUCOSE';
            const result = $eXeChemical.getShowLetter(phrase, 100);
            expect(result.length).toBe(phrase.length);
        });

        it('returns unique sorted indices', () => {
            const result = $eXeChemical.getShowLetter('DOPAMINE', 75);
            const unique = [...new Set(result)];
            const sorted = [...result].sort((a, b) => a - b);
            expect(unique.length).toBe(result.length);
            expect(result).toEqual(sorted);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // createLives
    // ──────────────────────────────────────────────────────────────
    describe('createLives', () => {
        it('generates exactly 5 life elements', () => {
            const msgs = { msgLive: 'Life' };
            const html = $eXeChemical.createLives(msgs);
            const matches = html.match(/exeQuextIcons-Life/g);
            expect(matches).toHaveLength(5);
        });

        it('includes the msgLive text', () => {
            const msgs = { msgLive: 'Vida' };
            const html = $eXeChemical.createLives(msgs);
            expect(html).toContain('Vida');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // createOptions
    // ──────────────────────────────────────────────────────────────
    describe('createOptions', () => {
        it('generates 4 option elements', () => {
            const msgs = { msgOption: 'Option' };
            const html = $eXeChemical.createOptions(msgs, 0);
            const matches = html.match(/CHEMP-Options/g);
            expect(matches).toHaveLength(4);
        });

        it('includes data-number attributes 0..3', () => {
            const msgs = { msgOption: 'Option' };
            const html = $eXeChemical.createOptions(msgs, 0);
            expect(html).toContain('data-number="0"');
            expect(html).toContain('data-number="1"');
            expect(html).toContain('data-number="2"');
            expect(html).toContain('data-number="3"');
        });

        it('includes option labels A B C D', () => {
            const msgs = { msgOption: 'Option' };
            const html = $eXeChemical.createOptions(msgs, 0);
            expect(html).toContain('Option A');
            expect(html).toContain('Option B');
            expect(html).toContain('Option C');
            expect(html).toContain('Option D');
        });

        it('uses instance index in element IDs', () => {
            const msgs = { msgOption: 'Option' };
            const html = $eXeChemical.createOptions(msgs, 3);
            expect(html).toContain('chemepOption1-3');
            expect(html).toContain('chemepOption4-3');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // getShowScoreRP
    // ──────────────────────────────────────────────────────────────
    describe('getShowScoreRP', () => {
        beforeEach(() => {
            $eXeChemical.options = [{
                selectsGame: [1, 2, 3, 4, 5], // 5 questions
                visiteds: 0,
            }];
        });

        it('returns 2 when 1 of 5 questions visited', () => {
            $eXeChemical.options[0].visiteds = 0;
            expect($eXeChemical.getShowScoreRP(0)).toBe(2); // min((0+1)*10/5, 10) = 2
        });

        it('caps at 10', () => {
            $eXeChemical.options[0].visiteds = 9;
            expect($eXeChemical.getShowScoreRP(0)).toBe(10);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // getScoreRP
    // ──────────────────────────────────────────────────────────────
    describe('getScoreRP', () => {
        it('delegates to getShowScoreRP in show mode', () => {
            $eXeChemical.options = [{
                activityMode: 'show',
                selectsGame: [1, 2],
                visiteds: 0,
            }];
            const spy = vi.spyOn($eXeChemical, 'getShowScoreRP');
            $eXeChemical.getScoreRP(0);
            expect(spy).toHaveBeenCalledWith(0);
        });

        it('computes (scoreGame * 10) / scoreTotal in test mode', () => {
            $eXeChemical.options = [{
                activityMode: 'test',
                scoreGame: 3,
                scoreTotal: 5,
            }];
            expect($eXeChemical.getScoreRP(0)).toBe(6); // 3*10/5
        });

        it('returns 0 when no points scored', () => {
            $eXeChemical.options = [{
                activityMode: 'test',
                scoreGame: 0,
                scoreTotal: 4,
            }];
            expect($eXeChemical.getScoreRP(0)).toBe(0);
        });

        it('returns 0 when scoreTotal is 0 (no division by zero)', () => {
            $eXeChemical.options = [{
                activityMode: 'test',
                scoreGame: 0,
                scoreTotal: 0,
            }];
            expect($eXeChemical.getScoreRP(0)).toBe(0);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // updateNumberQuestion
    // ──────────────────────────────────────────────────────────────
    describe('updateNumberQuestion', () => {
        beforeEach(() => {
            $eXeChemical.options = [{
                numberQuestions: 3,
                activeQuestion: -1,
            }];
        });

        it('advances from -1 to 0', () => {
            const result = $eXeChemical.updateNumberQuestion(-1, 0);
            expect(result).toBe(0);
            expect($eXeChemical.options[0].activeQuestion).toBe(0);
        });

        it('advances to the next question', () => {
            $eXeChemical.options[0].activeQuestion = 1;
            const result = $eXeChemical.updateNumberQuestion(1, 0);
            expect(result).toBe(2);
        });

        it('returns null when all questions exhausted', () => {
            const result = $eXeChemical.updateNumberQuestion(2, 0); // 2+1 >= 3
            expect(result).toBeNull();
        });
    });

    // ──────────────────────────────────────────────────────────────
    // getRetroFeedMessages
    // ──────────────────────────────────────────────────────────────
    describe('getRetroFeedMessages', () => {
        beforeEach(() => {
            $eXeChemical.options = [{
                msgs: {
                    msgSuccesses: 'Great!|Perfect!',
                    msgFailures: 'Wrong!|Oops!',
                },
            }];
        });

        it('returns one of the success messages on hit', () => {
            const result = $eXeChemical.getRetroFeedMessages(true, 0);
            expect(['Great!', 'Perfect!']).toContain(result.trim());
        });

        it('returns one of the failure messages on miss', () => {
            const result = $eXeChemical.getRetroFeedMessages(false, 0);
            expect(['Wrong!', 'Oops!']).toContain(result.trim());
        });

        it('uses default messages when msgSuccesses is empty', () => {
            $eXeChemical.options[0].msgs.msgSuccesses = '';
            const result = $eXeChemical.getRetroFeedMessages(true, 0);
            expect(result).toBeTruthy();
        });

        it('uses default messages when msgFailures is empty', () => {
            $eXeChemical.options[0].msgs.msgFailures = '';
            const result = $eXeChemical.getRetroFeedMessages(false, 0);
            expect(result).toBeTruthy();
        });
    });

    // ──────────────────────────────────────────────────────────────
    // sameQuestion
    // ──────────────────────────────────────────────────────────────
    describe('sameQuestion', () => {
        beforeEach(() => {
            $eXeChemical.options = [{
                activeQuestion: 1,
                selectsGame: [
                    { hit: 0, error: 0 },
                    { hit: 1, error: 1 },
                    { hit: 2, error: 0 },
                ],
            }];
        });

        it('returns true when correct and q.hit matches activeQuestion', () => {
            // activeQuestion=1, selectsGame[1].hit=1 → match
            expect($eXeChemical.sameQuestion(true, 0)).toBe(true);
        });

        it('returns false when correct but q.hit does not match', () => {
            $eXeChemical.options[0].activeQuestion = 2;
            // selectsGame[2].hit=2, override to 5 so it doesn't match activeQuestion=2
            $eXeChemical.options[0].selectsGame[2].hit = 5;
            expect($eXeChemical.sameQuestion(true, 0)).toBe(false);
        });

        it('returns true when incorrect and q.error matches activeQuestion', () => {
            // activeQuestion=1, selectsGame[1].error=1 → match
            expect($eXeChemical.sameQuestion(false, 0)).toBe(true);
        });

        it('returns false when incorrect but q.error does not match', () => {
            $eXeChemical.options[0].activeQuestion = 2;
            // selectsGame[2].error=0 != 2
            expect($eXeChemical.sameQuestion(false, 0)).toBe(false);
        });

        it('returns false when question is missing', () => {
            $eXeChemical.options[0].activeQuestion = 10;
            expect($eXeChemical.sameQuestion(true, 0)).toBe(false);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // getMessageAnswer / getMessageCorrectAnswer / getMessageErrorAnswer
    // ──────────────────────────────────────────────────────────────
    describe('getMessageAnswer', () => {
        beforeEach(() => {
            $eXeChemical.options = [{
                msgs: {
                    msgSuccesses: 'Great!',
                    msgFailures: 'Wrong!',
                    msgPoints: 'points',
                    msgLoseLive: 'You lost a life',
                },
                gameMode: 0,
                useLives: false,
            }];
        });

        it('returns correct message with points on correct answer', () => {
            const result = $eXeChemical.getMessageAnswer(true, 100, 0);
            expect(result).toContain('Great!');
            expect(result).toContain('100');
            expect(result).toContain('points');
        });

        it('returns error message with points on incorrect answer', () => {
            const result = $eXeChemical.getMessageAnswer(false, -330, 0);
            expect(result).toContain('Wrong!');
            expect(result).toContain('-330');
        });

        it('returns only feedback message in gameMode 2 (no points)', () => {
            $eXeChemical.options[0].gameMode = 2;
            const result = $eXeChemical.getMessageCorrectAnswer(100, 0);
            expect(result).toBe('Great!');
        });

        it('returns lose-life message when useLives is true', () => {
            $eXeChemical.options[0].useLives = true;
            const result = $eXeChemical.getMessageErrorAnswer(-330, 0);
            expect(result).toContain('You lost a life');
        });

        it('returns only feedback in error for gameMode > 0', () => {
            $eXeChemical.options[0].gameMode = 1;
            const result = $eXeChemical.getMessageErrorAnswer(0, 0);
            expect(result).toBe('Wrong!');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // loadDataGame — field migration
    // ──────────────────────────────────────────────────────────────
    describe('loadDataGame', () => {
        function makeData(overrides = {}) {
            return {
                text: () => JSON.stringify({
                    selectsGame: [],
                    msgs: { msgPlayStart: 'Start' },
                    itinerary: { showCodeAccess: false },
                    ...overrides,
                }),
            };
        }

        it('sets gameOver to false', () => {
            const result = $eXeChemical.loadDataGame(makeData());
            expect(result.gameOver).toBe(false);
        });

        it('defaults percentajeQuestions to 100 when missing', () => {
            const result = $eXeChemical.loadDataGame(makeData());
            expect(result.percentajeQuestions).toBe(100);
        });

        it('preserves percentajeQuestions when present', () => {
            const result = $eXeChemical.loadDataGame(makeData({ percentajeQuestions: 50 }));
            expect(result.percentajeQuestions).toBe(50);
        });

        it('defaults modeBoard to false when missing', () => {
            const result = $eXeChemical.loadDataGame(makeData());
            expect(result.modeBoard).toBe(false);
        });

        it('defaults activityMode to test when missing', () => {
            const result = $eXeChemical.loadDataGame(makeData());
            expect(result.activityMode).toBe('test');
        });

        it('defaults questionsRandom to false when missing', () => {
            const result = $eXeChemical.loadDataGame(makeData());
            expect(result.questionsRandom).toBe(false);
        });

        it('migrates missing question fields with defaults', () => {
            const result = $eXeChemical.loadDataGame(makeData({
                selectsGame: [{ quextion: 'Q1', options: ['A', 'B'], solution: 'A' }],
            }));
            const q = result.selectsGame[0];
            expect(q.ket).toBe('');
            expect(q.svg).toBe('');
            expect(q.smiles).toBe('');
            expect(q.molfile).toBe('');
            expect(q.rxn).toBe('');
            expect(q.structureType).toBe('molecule');
            expect(q.description).toBe('');
            expect(q.hit).toBe(0);
            expect(q.error).toBe(0);
            expect(q.msgHit).toBe('');
            expect(q.msgError).toBe('');
        });

        it('preserves existing question fields', () => {
            const result = $eXeChemical.loadDataGame(makeData({
                selectsGame: [{
                    quextion: 'Q1',
                    ket: '{"root":{}}',
                    svg: '<svg/>',
                    smiles: 'CCO',
                    structureType: 'molecule',
                    hit: 2,
                    error: 1,
                }],
            }));
            const q = result.selectsGame[0];
            expect(q.ket).toBe('{"root":{}}');
            expect(q.svg).toBe('<svg/>');
            expect(q.smiles).toBe('CCO');
            expect(q.hit).toBe(2);
            expect(q.error).toBe(1);
        });

        it('computes scoreTotal from question count when customScore absent', () => {
            const result = $eXeChemical.loadDataGame(makeData({
                selectsGame: [
                    { quextion: 'Q1' },
                    { quextion: 'Q2' },
                    { quextion: 'Q3' },
                ],
            }));
            expect(result.scoreTotal).toBe(3);
        });

        it('sets numberQuestions from selectsGame length', () => {
            const result = $eXeChemical.loadDataGame(makeData({
                selectsGame: [{ quextion: 'Q1' }, { quextion: 'Q2' }],
            }));
            expect(result.numberQuestions).toBe(2);
        });
    });
});
