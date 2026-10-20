/**
 * Unit tests for padlock iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML character escaping
 * - removeTags: HTML tag removal (with mocked jQuery)
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  // Replace 'var $exeDevice' with 'global.$exeDevice' anywhere in the code
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // Execute the modified code using eval in global context
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$exeDevice;
}

describe('padlock iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'padlock.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple special characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect($exeDevice.escapeHtml(input)).toBe(expected);
    });

    it('returns empty string for empty input', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });

    it('handles string with no special characters', () => {
      expect($exeDevice.escapeHtml('hello world')).toBe('hello world');
    });

    it('converts numbers to strings', () => {
      expect($exeDevice.escapeHtml(123)).toBe('123');
    });
  });

  describe('removeTags', () => {
    it('removes simple HTML tags', () => {
      const result = $exeDevice.removeTags('<p>Hello</p>');
      expect(result).toBe('Hello');
    });

    it('removes nested HTML tags', () => {
      const result = $exeDevice.removeTags('<div><p><strong>Text</strong></p></div>');
      expect(result).toBe('Text');
    });

    it('handles text without tags', () => {
      const result = $exeDevice.removeTags('Plain text');
      expect(result).toBe('Plain text');
    });

    it('handles empty string', () => {
      const result = $exeDevice.removeTags('');
      expect(result).toBe('');
    });

    it('removes multiple tags and preserves text', () => {
      const result = $exeDevice.removeTags('<h1>Title</h1><p>Paragraph</p>');
      expect(result).toBe('TitleParagraph');
    });

    it('handles self-closing tags', () => {
      const result = $exeDevice.removeTags('Line 1<br/>Line 2');
      expect(result).toBe('Line 1Line 2');
    });

    it('removes tags with attributes', () => {
      const result = $exeDevice.removeTags('<a href="http://example.com">Link</a>');
      expect(result).toBe('Link');
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });

    it('has name defined', () => {
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  describe('validateData', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.validateData).toBe('function');
    });
  });

  describe('validateCandado', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.validateCandado).toBe('function');
    });
  });

  describe('showMessage', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.showMessage).toBe('function');
    });
  });

  describe('getIdeviceID', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.getIdeviceID).toBe('function');
    });
  });

    /**
     * The pass-score control is a shared block in common_idevices_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'padlock.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: true/);
        });

        it('restores the control when the iDevice is reopened', () => {
            expect(source).toContain('gamification.passScore.setValues(');
            // This iDevice restores from `dataGame`, not `game`.
            expect(source).toContain('passScoreMode: dataGame.passScoreMode');
            expect(source).toContain('passScoreCustom: dataGame.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            // It parks the values on  before writing them out.
            expect(source).toContain('$exeDevice.passScoreMode = passScore.passScoreMode');
            expect(source).toContain('passScoreMode: $exeDevice.passScoreMode');
            expect(source).toContain('passScoreCustom: $exeDevice.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });
});

describe('padlock edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/padlock/edition/';
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#candadoIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`candadoIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        candadoTime: 10,
        candadoSolution: '1234',
        candadoInstructions: '',
        candadoRetro: '',
        candadoShowMinimize: false,
        candadoReboot: true,
        candadoAttemps: 0,
        candadoErrorMessage: '',
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        evaluation: false,
        evaluationID: '',
        ...overrides,
    });
    const stored = (data, instructions = '<p>Find the code</p>', retro = '<p>Well done</p>') => `
        <div class="candado-IDevice">
            <div class="candado-version js-hidden">1</div>
            <div class="candado-instructions js-hidden">${instructions}</div>
            <div class="candado-retro js-hidden">${retro}</div>
            <div class="candado-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;
    let device;
    let previousApp;
    let tooltips;
    let previousHelpers;

    const open = (previousData = {}) => {
        document.body.innerHTML = '<div id="padlockBody"></div>';
        device.init(document.getElementById('padlockBody'), previousData, PATH);
    };

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning?.app;
        tooltips = new Map();
        global.eXeLearning = {
            ...global.eXeLearning,
            app: {
                ...previousApp,
                common: {
                    initTooltips: vi.fn((scope) => {
                        scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                            if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                        });
                    }),
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        previousHelpers = { ...helpers() };
        Object.assign(helpers(), {
            isJsonString: (text) => {
                try {
                    return JSON.parse(text);
                } catch {
                    return false;
                }
            },
            decrypt: (text) => text,
            encrypt: (text) => text,
        });
        device = global.loadIdevice(join(__dirname, 'padlock.js'));
        open();
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        for (const key of ['isJsonString', 'decrypt', 'encrypt']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on the feedback to unlock', () => {
        expect(tabNames()).toEqual(['instructions', 'options', 'contents', 'grading', 'texts']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('writes the instructions in their tab and the feedback with its code in Questions', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions')).not.toBeNull();
        expect(panel('contents').firstElementChild.textContent).toContain(
            'Write the feedback learners unlock and the access code that opens it.'
        );
        expect(panel('contents').querySelector('#candadoEPanel #candadoEFeedBack')).not.toBeNull();
        expect(panel('contents').querySelector('#candadoEPanel #candadoEDSolution')).not.toBeNull();
        expect(panel('options').querySelector('#candadoEOptions #candadoEDTime')).not.toBeNull();
        expect(panel('options').querySelector('#candadoEOptions #candadoEErrorMessage')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('leaves out the switch between editors, the share links and the report placeholder', () => {
        for (const id of ['candadoECandado', 'candadoERetro', 'candadoEDescription', 'divCandadoFeebBack']) {
            expect(document.getElementById(id)).toBeNull();
        }
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
        expect(document.querySelector('.Games-Reportdiv')).toBeNull();
    });

    it('explains each setting without changing any of them', () => {
        const helps = [
            ...document.querySelectorAll('#candadoEOptions .exe-idevice-help, #candadoEPanel .exe-idevice-help'),
        ];
        const states = () => [...document.querySelectorAll('#candadoIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(6);
        for (const help of helps) {
            expect(help.title).toBe('Information');
            const content = document.getElementById(help.getAttribute('aria-controls'));
            expect(content.textContent.length).toBeGreaterThan(15);
            help.click();
            help.querySelector('span').click();
            content.click();
        }
        expect(states()).toEqual(before);
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('disposes all tooltips when the edition closes', () => {
        expect(tooltips.size).toBe(12); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('restores the instructions, the feedback, the options and the texts', () => {
        open(
            stored(
                game({
                    candadoShowMinimize: true,
                    candadoReboot: false,
                    candadoAttemps: 3,
                    candadoErrorMessage: 'Try the date',
                    msgs: { msgSubmit: 'Open' },
                })
            )
        );

        expect(document.getElementById('eXeGameInstructions').value).toBe('<p>Find the code</p>');
        expect(document.getElementById('candadoEFeedBack').value).toBe('<p>Well done</p>');
        expect(document.getElementById('candadoEDSolution').value).toBe('1234');
        expect(document.getElementById('candadoEShowMinimize').checked).toBe(true);
        expect(document.getElementById('candadoEReboot').checked).toBe(false);
        expect(document.getElementById('candadoEAttemps').value).toBe('3');
        expect(document.getElementById('candadoEErrorMessage').disabled).toBe(false);
        expect(document.getElementById('ci18n_msgSubmit').value).toBe('Open');
    });

    it('keeps the error message off when it reopens with no attempts, as the form saves them', () => {
        // The form saves the number of attempts as the text of its field.
        open(stored(game({ candadoAttemps: '0' })));

        expect(document.getElementById('candadoEErrorMessage').disabled).toBe(true);
    });

    it('offers no more attempts than it keeps', () => {
        const attempts = document.getElementById('candadoEAttemps');
        attempts.value = attempts.max;

        $(attempts).trigger('focusout');

        expect(attempts.value).toBe(attempts.max);
    });

    describe('saving', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Find the code</p>',
                candadoEFeedBack: '<p>Well done</p>',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                      }
                    : null
            );
            document.getElementById('candadoEDSolution').value = '1234';
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('keeps the instructions and the feedback where the export reads them', () => {
            const html = device.save();

            expect(html).toContain('<div class="candado-instructions js-hidden"><p>Find the code</p></div>');
            expect(html).toContain('<div class="candado-retro js-hidden"><p>Well done</p></div>');
            expect(html).toContain('"candadoSolution":"1234"');
            expect(html).not.toContain('exe-idevice-help');
        });

        it('asks for the instructions before saving', () => {
            editors.eXeGameInstructions = '';

            expect(device.save()).toBe(false);
            expect(eXe.app.getLastAlert()).toBe('Please write the instructions.');
        });

        it('asks for the feedback before saving', () => {
            editors.candadoEFeedBack = '';

            expect(device.save()).toBe(false);
            expect(eXe.app.getLastAlert()).toBe('Please write the feedback.');
        });
    });
});
