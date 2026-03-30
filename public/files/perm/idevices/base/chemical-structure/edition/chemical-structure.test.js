/**
 * Unit tests for chemical-structure iDevice (edition code)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - sanitizeSvg: strips XSS vectors from SVG strings
 * - removeTags: strips HTML tags from a string
 * - escapeHtml: escapes HTML special characters
 * - getCuestionDefault: returns a valid default question object
 * - initQuestions: populates selectsGame with a demo question when empty
 * - updateFieldGame migration: migrates missing question fields to defaults
 * - applyExportToCurrentQuestion: updates the active question and textarea
 * - clearStructureTextarea: clears the quick-loader textarea
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice(code) {
    global._ = (str) => str;
    global.c_ = (str) => str;

    // Minimal chainable jQuery mock
    const jqChain = () => {
        const obj = {
            val: vi.fn(() => ''),
            text: vi.fn(() => ''),
            html: vi.fn(() => obj),
            prop: vi.fn(() => obj),
            attr: vi.fn(() => ''),
            data: vi.fn(() => null),
            find: vi.fn(() => obj),
            each: vi.fn(() => obj),
            on: vi.fn(() => obj),
            off: vi.fn(() => obj),
            hide: vi.fn(() => obj),
            show: vi.fn(() => obj),
            toggle: vi.fn(() => obj),
            css: vi.fn(() => obj),
            addClass: vi.fn(() => obj),
            removeClass: vi.fn(() => obj),
            hasClass: vi.fn(() => false),
            is: vi.fn(() => false),
            closest: vi.fn(() => obj),
            parent: vi.fn(() => obj),
            next: vi.fn(() => obj),
            append: vi.fn(() => obj),
            prepend: vi.fn(() => obj),
            before: vi.fn(() => obj),
            after: vi.fn(() => obj),
            remove: vi.fn(() => obj),
            insertBefore: vi.fn(() => obj),
            insertAfter: vi.fn(() => obj),
            trigger: vi.fn(() => obj),
            length: 0,
        };
        // Chained calls must also return the same interface
        obj.val.mockReturnValue(obj);
        return obj;
    };

    const $mock = vi.fn(() => jqChain());
    $mock.trim = (s) => (s ? String(s).trim() : '');
    $mock.extend = (target, ...sources) => Object.assign(target || {}, ...sources);
    global.$ = $mock;
    global.jQuery = $mock;

    global.$exeDevices = {
        iDevice: {
            gamification: {
                helpers: {
                    supportedBrowser: () => true,
                    isJsonString: (str) => { try { return JSON.parse(str); } catch { return false; } },
                    decrypt: (s) => s,
                },
                scorm: { setValues: vi.fn() },
                common: { getLanguageTab: () => '' },
                itinerary: { getValues: vi.fn(() => ({})) },
                report: { saveEvaluation: vi.fn() },
            },
        },
    };

    global.$exeDevicesEdition = {
        iDevice: {
            common: { getTextFieldset: () => '' },
            gamification: {
                common: { getLanguageTab: () => '' },
                instructions: { getFieldset: vi.fn(() => '') },
                itinerary: {
                    getTab: vi.fn(() => ''),
                    getValues: vi.fn(() => ({})),
                    addEvents: vi.fn(),
                    setValues: vi.fn(),
                },
                share: { addEvents: vi.fn() },
                scorm: {
                    init: vi.fn(),
                    getTab: vi.fn(() => ''),
                    setValues: vi.fn(),
                    getValues: vi.fn(() => ({})),
                },
            },
            tabs: { init: vi.fn() },
            voiceRecorder: { initVoiceRecorders: vi.fn() },
            filePicker: { init: vi.fn() },
        },
    };

    global.eXeLearning = { app: { project: { odeId: '' } } };

    global.tinyMCE = { get: () => null };

    const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

describe('chemical-structure iDevice edition', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        const filePath = join(__dirname, 'chemical-structure.js');
        const code = readFileSync(filePath, 'utf-8');
        $exeDevice = loadIdevice(code);
        // Reset mutable state
        $exeDevice.selectsGame = [];
        $exeDevice.active = 0;
    });

    afterEach(() => {
        delete global.$exeDevice;
        delete global.$exeDevices;
        delete global.$exeDevicesEdition;
        delete global.$;
        delete global.jQuery;
        delete global._;
        delete global.c_;
        delete global.tinyMCE;
        delete global.eXeLearning;
    });

    describe('createForm', () => {
        it('initializes the SCORM tab like other iDevices', () => {
            global.window = {
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            };
            $exeDevice.ideviceBody = document.createElement('div');
            $exeDevice.idevicePath = '/';
            $exeDevice.ci18n = { msgEditorNotReady: 'Editor not ready' };
            $exeDevice.enableForm = vi.fn();

            $exeDevice.createForm();

            expect(
                global.$exeDevicesEdition.iDevice.gamification.scorm.init
            ).toHaveBeenCalled();

            delete global.window;
        });
    });

    // ──────────────────────────────────────────────────────────────
    // sanitizeSvg
    // ──────────────────────────────────────────────────────────────
    describe('sanitizeSvg', () => {
        it('returns empty string for falsy input', () => {
            expect($exeDevice.sanitizeSvg('')).toBe('');
            expect($exeDevice.sanitizeSvg(null)).toBe('');
            expect($exeDevice.sanitizeSvg(undefined)).toBe('');
            expect($exeDevice.sanitizeSvg(0)).toBe('');
        });

        it('removes script elements', () => {
            const svg = '<svg><script>alert(1)</script><circle/></svg>';
            const result = $exeDevice.sanitizeSvg(svg);
            expect(result).not.toContain('<script');
            expect(result).toContain('<circle');
        });

        it('removes double-quoted inline event handlers', () => {
            const svg = '<svg><circle onclick="evil()"></svg>';
            expect($exeDevice.sanitizeSvg(svg)).not.toContain('onclick');
        });

        it('removes single-quoted inline event handlers', () => {
            const svg = "<svg><circle onmouseover='bad()'></svg>";
            expect($exeDevice.sanitizeSvg(svg)).not.toContain('onmouseover');
        });

        it('removes javascript: URIs', () => {
            const svg = '<svg><a href="javascript:evil()">x</a></svg>';
            expect($exeDevice.sanitizeSvg(svg)).not.toContain('javascript:');
        });

        it('leaves safe SVG untouched', () => {
            const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
            expect($exeDevice.sanitizeSvg(svg)).toBe(svg);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // removeTags
    // ──────────────────────────────────────────────────────────────
    describe('removeTags', () => {
        it('removes simple tags', () => {
            expect($exeDevice.removeTags('<p>Hello</p>')).toBe('Hello');
        });

        it('removes nested tags', () => {
            expect($exeDevice.removeTags('<div><strong>Text</strong></div>')).toBe('Text');
        });

        it('returns plain text unchanged', () => {
            expect($exeDevice.removeTags('plain text')).toBe('plain text');
        });

        it('returns empty string for empty input', () => {
            expect($exeDevice.removeTags('')).toBe('');
        });

        it('handles null/undefined gracefully', () => {
            expect($exeDevice.removeTags(null)).toBe('');
            expect($exeDevice.removeTags(undefined)).toBe('');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // escapeHtml
    // ──────────────────────────────────────────────────────────────
    describe('escapeHtml', () => {
        it('escapes ampersand', () => {
            expect($exeDevice.escapeHtml('a & b')).toBe('a &amp; b');
        });

        it('escapes less-than', () => {
            expect($exeDevice.escapeHtml('a < b')).toBe('a &lt; b');
        });

        it('escapes greater-than', () => {
            expect($exeDevice.escapeHtml('a > b')).toBe('a &gt; b');
        });

        it('escapes double quotes', () => {
            expect($exeDevice.escapeHtml('"hello"')).toBe('&quot;hello&quot;');
        });

        it("escapes single quotes", () => {
            expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
        });

        it('escapes a complete XSS payload', () => {
            expect($exeDevice.escapeHtml('<script>alert("xss")</script>'))
                .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('returns empty string for empty input', () => {
            expect($exeDevice.escapeHtml('')).toBe('');
        });

        it('handles null/undefined as empty string', () => {
            expect($exeDevice.escapeHtml(null)).toBe('');
            expect($exeDevice.escapeHtml(undefined)).toBe('');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // getCuestionDefault
    // ──────────────────────────────────────────────────────────────
    describe('getCuestionDefault', () => {
        it('returns an object with all required fields', () => {
            const q = $exeDevice.getCuestionDefault();
            expect(q).toMatchObject({
                ket: '',
                svg: '',
                smiles: '',
                molfile: '',
                rxn: '',
                structureType: 'molecule',
                description: '',
                quextion: '',
                solution: '',
                solutionQuestion: '',
                percentageShow: 35,
                typeSelect: 0,
                numberOptions: 4,
                time: 0,
                hit: 0,
                error: 0,
                msgHit: '',
                msgError: '',
            });
        });

        it('returns an array with 4 empty options', () => {
            const q = $exeDevice.getCuestionDefault();
            expect(q.options).toEqual(['', '', '', '']);
        });

        it('returns a new object on each call', () => {
            const q1 = $exeDevice.getCuestionDefault();
            const q2 = $exeDevice.getCuestionDefault();
            q1.quextion = 'modified';
            expect(q2.quextion).toBe('');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // initQuestions
    // ──────────────────────────────────────────────────────────────
    describe('initQuestions', () => {
        it('adds a demo question when selectsGame is empty', () => {
            $exeDevice.selectsGame = [];
            $exeDevice.initQuestions();
            expect($exeDevice.selectsGame.length).toBe(1);
        });

        it('demo question has the caffeine SMILES', () => {
            $exeDevice.selectsGame = [];
            $exeDevice.initQuestions();
            expect($exeDevice.selectsGame[0].smiles).toBe('CN1C=NC2=C1C(=O)N(C(=O)N2C)C');
        });

        it('demo question has a structureType of molecule', () => {
            $exeDevice.selectsGame = [];
            $exeDevice.initQuestions();
            expect($exeDevice.selectsGame[0].structureType).toBe('molecule');
        });

        it('demo question has 4 non-empty options', () => {
            $exeDevice.selectsGame = [];
            $exeDevice.initQuestions();
            const opts = $exeDevice.selectsGame[0].options;
            expect(opts.length).toBe(4);
            opts.forEach((o) => expect(o.length).toBeGreaterThan(0));
        });

        it('demo question has solution A', () => {
            $exeDevice.selectsGame = [];
            $exeDevice.initQuestions();
            expect($exeDevice.selectsGame[0].solution).toBe('A');
        });

        it('does not add a question when selectsGame already has entries', () => {
            const existing = $exeDevice.getCuestionDefault();
            $exeDevice.selectsGame = [existing];
            $exeDevice.initQuestions();
            expect($exeDevice.selectsGame.length).toBe(1);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // updateFieldGame — migration of question fields
    // ──────────────────────────────────────────────────────────────
    describe('updateFieldGame — question migration', () => {
        beforeEach(() => {
            // Stub DOM-heavy methods so migration can run in isolation
            $exeDevice.updateQuestionsNumber = vi.fn();
            $exeDevice.showQuestion = vi.fn();
        });

        it('fills missing ket, svg, smiles, molfile, rxn with empty strings', () => {
            const game = { selectsGame: [{ quextion: 'Q1' }] };
            $exeDevice.updateFieldGame(game);
            const q = $exeDevice.selectsGame[0];
            expect(q.ket).toBe('');
            expect(q.svg).toBe('');
            expect(q.smiles).toBe('');
            expect(q.molfile).toBe('');
            expect(q.rxn).toBe('');
        });

        it('fills missing description with empty string', () => {
            const game = { selectsGame: [{ quextion: 'Q1' }] };
            $exeDevice.updateFieldGame(game);
            expect($exeDevice.selectsGame[0].description).toBe('');
        });

        it('fills missing structureType with molecule', () => {
            const game = { selectsGame: [{ quextion: 'Q1' }] };
            $exeDevice.updateFieldGame(game);
            expect($exeDevice.selectsGame[0].structureType).toBe('molecule');
        });

        it('preserves existing field values', () => {
            const game = {
                selectsGame: [{
                    quextion: 'Q1',
                    ket: '{"root":{}}',
                    svg: '<svg/>',
                    smiles: 'CCO',
                    structureType: 'reaction',
                    description: 'Ethanol',
                }],
            };
            $exeDevice.updateFieldGame(game);
            const q = $exeDevice.selectsGame[0];
            expect(q.ket).toBe('{"root":{}}');
            expect(q.svg).toBe('<svg/>');
            expect(q.smiles).toBe('CCO');
            expect(q.structureType).toBe('reaction');
            expect(q.description).toBe('Ethanol');
        });

        it('migrates multiple questions in a single call', () => {
            const game = {
                selectsGame: [
                    { quextion: 'Q1' },
                    { quextion: 'Q2', smiles: 'CCO' },
                    { quextion: 'Q3' },
                ],
            };
            $exeDevice.updateFieldGame(game);
            expect($exeDevice.selectsGame.length).toBe(3);
            expect($exeDevice.selectsGame[0].smiles).toBe('');
            expect($exeDevice.selectsGame[1].smiles).toBe('CCO');
            expect($exeDevice.selectsGame[2].structureType).toBe('molecule');
        });

        it('handles empty selectsGame without throwing', () => {
            expect(() => $exeDevice.updateFieldGame({ selectsGame: [] })).not.toThrow();
        });

        it('handles missing selectsGame without throwing', () => {
            expect(() => $exeDevice.updateFieldGame({})).not.toThrow();
        });
    });

    // ──────────────────────────────────────────────────────────────
    // applyExportToCurrentQuestion
    // ──────────────────────────────────────────────────────────────
    describe('applyExportToCurrentQuestion', () => {
        beforeEach(() => {
            $exeDevice.selectsGame = [$exeDevice.getCuestionDefault()];
            $exeDevice.active = 0;
        });

        it('updates all structure fields on the active question', () => {
            const exported = {
                ket: '{"root":{}}',
                svg: '<svg/>',
                smiles: 'CCO',
                molfile: '\n  Mrv  COO',
                rxn: '',
                structureType: 'molecule',
            };
            $exeDevice.applyExportToCurrentQuestion(exported);
            const q = $exeDevice.selectsGame[0];
            expect(q.ket).toBe('{"root":{}}');
            expect(q.svg).toBe('<svg/>');
            expect(q.smiles).toBe('CCO');
            expect(q.molfile).toBe('\n  Mrv  COO');
            expect(q.structureType).toBe('molecule');
        });

        it('does nothing when there is no active question', () => {
            $exeDevice.selectsGame = [];
            expect(() => $exeDevice.applyExportToCurrentQuestion({ svg: '', ket: '', smiles: '' })).not.toThrow();
        });

        it('falls back to empty string for missing fields', () => {
            $exeDevice.applyExportToCurrentQuestion({});
            const q = $exeDevice.selectsGame[0];
            expect(q.ket).toBe('');
            expect(q.svg).toBe('');
            expect(q.smiles).toBe('');
            expect(q.molfile).toBe('');
            expect(q.rxn).toBe('');
            expect(q.structureType).toBe('molecule');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // pasteQuestion / clearStructureTextarea
    // ──────────────────────────────────────────────────────────────
    describe('pasteQuestion', () => {
        beforeEach(() => {
            $exeDevice.showQuestion = vi.fn();
            $exeDevice.updateQuestionsNumber = vi.fn();
        });

        it('copies structure fields when pasting from clipboard', () => {
            $exeDevice.selectsGame = [$exeDevice.getCuestionDefault()];
            $exeDevice.active = 0;
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = {
                quextion: 'Question copy',
                ket: '{"root":{}}',
                svg: '<svg><rect/></svg>',
                smiles: 'CCO',
                molfile: 'MOL',
                rxn: '',
                structureType: 'molecule',
            };

            $exeDevice.pasteQuestion();

            expect($exeDevice.selectsGame.length).toBe(2);
            const pasted = $exeDevice.selectsGame[1];
            expect(pasted.smiles).toBe('CCO');
            expect(pasted.molfile).toBe('MOL');
            expect(pasted.svg).toBe('<svg><rect/></svg>');
            expect(pasted.ket).toBe('{"root":{}}');
            expect(pasted.structureType).toBe('molecule');
            expect(pasted).not.toBe($exeDevice.clipBoard);
        });

        it('creates a new object for each paste action', () => {
            $exeDevice.selectsGame = [$exeDevice.getCuestionDefault()];
            $exeDevice.active = 0;
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = {
                quextion: 'Question copy',
                smiles: 'NCCO',
            };

            $exeDevice.pasteQuestion();
            $exeDevice.pasteQuestion();

            expect($exeDevice.selectsGame[1]).not.toBe($exeDevice.selectsGame[2]);
            expect($exeDevice.selectsGame[1].smiles).toBe('NCCO');
            expect($exeDevice.selectsGame[2].smiles).toBe('NCCO');
        });
    });

    describe('showTypeQuestion', () => {
        function createSelectorAwareJquery() {
            const selectors = new Map();

            const buildChain = () => {
                const obj = {
                    val: vi.fn(() => obj),
                    text: vi.fn(() => obj),
                    html: vi.fn(() => obj),
                    prop: vi.fn(() => obj),
                    attr: vi.fn(() => obj),
                    data: vi.fn(() => null),
                    find: vi.fn(() => obj),
                    each: vi.fn(() => obj),
                    on: vi.fn(() => obj),
                    off: vi.fn(() => obj),
                    hide: vi.fn(() => obj),
                    show: vi.fn(() => obj),
                    toggle: vi.fn(() => obj),
                    css: vi.fn(() => obj),
                    addClass: vi.fn(() => obj),
                    removeClass: vi.fn(() => obj),
                    hasClass: vi.fn(() => false),
                    is: vi.fn(() => false),
                    closest: vi.fn(() => obj),
                    parent: vi.fn(() => obj),
                    next: vi.fn(() => obj),
                    append: vi.fn(() => obj),
                    prepend: vi.fn(() => obj),
                    before: vi.fn(() => obj),
                    after: vi.fn(() => obj),
                    remove: vi.fn(() => obj),
                    insertBefore: vi.fn(() => obj),
                    insertAfter: vi.fn(() => obj),
                    trigger: vi.fn(() => obj),
                    length: 0,
                };
                return obj;
            };

            const $mock = vi.fn((selector) => {
                const key = String(selector);
                if (!selectors.has(key)) selectors.set(key, buildChain());
                return selectors.get(key);
            });

            $mock.trim = (s) => (s ? String(s).trim() : '');
            $mock.extend = (target, ...sources) =>
                Object.assign(target || {}, ...sources);

            return { $mock, selectors };
        }

        it('adds d-none to options count for word type', () => {
            const previous$ = global.$;
            const previousJquery = global.jQuery;
            const { $mock, selectors } = createSelectorAwareJquery();
            global.$ = $mock;
            global.jQuery = $mock;

            try {
                $exeDevice.showTypeQuestion(2);
            } finally {
                global.$ = previous$;
                global.jQuery = previousJquery;
            }

            const inputNumbers = selectors.get('#chemInputNumbers');
            expect(inputNumbers.removeClass).toHaveBeenCalledWith('d-flex');
            expect(inputNumbers.addClass).toHaveBeenCalledWith('d-none');
            expect(inputNumbers.hide).not.toHaveBeenCalled();
        });
    });

    describe('clearStructureTextarea', () => {
        it('clears #chemCodeInput value', () => {
            $exeDevice.clearStructureTextarea();
            expect(global.$).toHaveBeenCalledWith('#chemCodeInput');
            const lastResult = global.$.mock.results.at(-1);
            expect(lastResult.value.val).toHaveBeenCalledWith('');
        });
    });
});
