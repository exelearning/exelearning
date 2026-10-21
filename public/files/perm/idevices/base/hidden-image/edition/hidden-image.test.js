/**
 * Unit tests for hidden-image iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML character escaping
 * - validTime: Time format validation
 * - removeTags: HTML tag removal (with mocked jQuery)
 * - getDefaultQuestion: Default question object structure
 * - placeImageWindows: Image dimension calculations (with mocked jQuery)
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
  // The edition scripts register their timers, handlers and disposers through
  // `this.$lifecycle`, exactly as IdeviceNode provides it in the workarea.
  global.attachEditionLifecycle(global.$exeDevice);
  return global.$exeDevice;
}

describe('hidden-image iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'hidden-image.js');
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
  });

  describe('validTime', () => {
    it('returns true for valid time format hh:mm:ss', () => {
      expect($exeDevice.validTime('00:00:00')).toBe(true);
      expect($exeDevice.validTime('23:59:59')).toBe(true);
      expect($exeDevice.validTime('12:30:45')).toBe(true);
    });

    it('returns false for invalid hours', () => {
      expect($exeDevice.validTime('24:00:00')).toBe(false);
      expect($exeDevice.validTime('25:00:00')).toBe(false);
    });

    it('returns false for invalid minutes', () => {
      expect($exeDevice.validTime('12:60:00')).toBe(false);
    });

    it('returns false for invalid seconds', () => {
      expect($exeDevice.validTime('12:30:60')).toBe(false);
    });

    it('returns false for wrong format', () => {
      expect($exeDevice.validTime('1:30:45')).toBe(false);
      expect($exeDevice.validTime('12:3:45')).toBe(false);
    });

    it('returns false for wrong length', () => {
      expect($exeDevice.validTime('12:30')).toBe(false);
      expect($exeDevice.validTime('')).toBe(false);
    });

    it('returns false for non-numeric characters', () => {
      expect($exeDevice.validTime('aa:bb:cc')).toBe(false);
    });
  });

  describe('getDefaultQuestion', () => {
    it('returns object with numberOptions property as 4', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.numberOptions).toBe(4);
    });

    it('returns object with attempts property as 4', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.attempts).toBe(4);
    });

    it('returns object with rows and columns as 4', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.rows).toBe(4);
      expect(question.columns).toBe(4);
    });

    it('returns object with time property as 30', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.time).toBe(30);
    });

    it('returns object with empty url', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.url).toBe('');
    });

    it('returns object with options array of 4 empty strings', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.options).toEqual(['', '', '', '']);
      expect(question.options.length).toBe(4);
    });

    it('returns object with solution property as 0', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.solution).toBe(0);
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getDefaultQuestion();
      const q2 = $exeDevice.getDefaultQuestion();
      expect(q1).not.toBe(q2);
    });

    it('returns object with msgHit and msgError as empty strings', () => {
      const question = $exeDevice.getDefaultQuestion();
      expect(question.msgHit).toBe('');
      expect(question.msgError).toBe('');
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
  });

  describe('placeImageWindows', () => {
    // Helper to create a mock image with real DOM parent dimensions
    const createMockImage = (parentWidth, parentHeight) => {
      const parent = document.createElement('div');
      parent.style.width = `${parentWidth}px`;
      parent.style.height = `${parentHeight}px`;
      Object.defineProperty(parent, 'offsetWidth', {
        value: parentWidth,
        configurable: true,
      });
      Object.defineProperty(parent, 'offsetHeight', {
        value: parentHeight,
        configurable: true,
      });
      const img = document.createElement('img');
      parent.appendChild(img);
      document.body.appendChild(parent);
      return {
        mockImage: img,
        cleanup: () => {
          parent.remove();
        },
      };
    };

    it('calculates dimensions for landscape image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      const result = $exeDevice.placeImageWindows(mockImage, 400, 300);

      expect(result.w).toBe(200);
      expect(result.h).toBe(150);
      expect(result.x).toBe(0);
      expect(result.y).toBe(25);

      cleanup();
    });

    it('calculates dimensions for portrait image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      const result = $exeDevice.placeImageWindows(mockImage, 300, 400);

      expect(result.w).toBe(150);
      expect(result.h).toBe(200);
      expect(result.x).toBe(25);
      expect(result.y).toBe(0);

      cleanup();
    });

    it('returns object with required properties', () => {
      const { mockImage, cleanup } = createMockImage(100, 100);

      const result = $exeDevice.placeImageWindows(mockImage, 200, 200);

      expect(result).toHaveProperty('w');
      expect(result).toHaveProperty('h');
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');

      cleanup();
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

  describe('showMessage', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.showMessage).toBe('function');
    });
  });

  describe('validateData', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.validateData).toBe('function');
    });
  });

    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'hidden-image.js'), 'utf-8');
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
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });
});

describe('hidden-image minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'hidden-image.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('hidden-image edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/hidden-image/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const tabNames = () =>
        [...document.querySelectorAll('#hiQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`hiQEIdeviceForm-panel-${name}`);
    const question = (overrides = {}) => ({
        numberOptions: 4,
        attempts: 4,
        rows: 4,
        columns: 4,
        time: 30,
        url: 'https://example.com/picture.png',
        author: '',
        alt: 'A picture',
        question: 'What is in the picture?',
        options: ['A cat', 'A dog', 'A bird', 'A fish'],
        solution: 0,
        audio: '',
        msgHit: '',
        msgError: '',
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'HiddenImage',
        showMinimize: false,
        optionsRamdon: false,
        answersRamdon: false,
        showSolution: true,
        timeShowSolution: 3,
        revealTime: 1,
        customMessages: false,
        percentajeQuestions: 100,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        questionsGame: [question()],
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        evaluation: false,
        evaluationID: '',
        ...overrides,
    });
    const exportHelpers = {
        isJsonString: (text) => {
            try {
                return JSON.parse(text);
            } catch {
                return false;
            }
        },
        decrypt: (text) => text,
        encrypt: (text) => text,
    };
    let device;
    let previousApp;
    let previousMedia;
    let tooltips;

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
        Object.assign(global.$exeDevices.iDevice.gamification.helpers, exportHelpers);
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
        device = global.loadIdevice(join(__dirname, 'hidden-image.js'));
        document.body.innerHTML = '<div id="hiddenImageBody"></div>';
        device.init(document.getElementById('hiddenImageBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        Object.keys(exportHelpers).forEach((name) => delete global.$exeDevices.iDevice.gamification.helpers[name]);
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its questions', () => {
        expect(tabNames()).toEqual(['instructions', 'options', 'contents', 'passwords', 'after', 'grading', 'texts']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toContain(
            'Reveal the hidden image'
        );
        expect(panel('options').querySelector('#hiEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#hiEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('explains each option without changing any of them', () => {
        const helps = [...panel('options').querySelectorAll('#hiEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#hiQEIdeviceForm input')].map((input) => input.checked);
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

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBe(12); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('restores the options with the game', () => {
        device.updateFieldGame(game({ showMinimize: true, revealTime: 5, percentajeQuestions: 50 }));

        expect(document.getElementById('hiEShowMinimize').checked).toBe(true);
        expect(document.getElementById('hiERevealTime').value).toBe('5');
        expect(document.getElementById('hiEPercentajeQuestions').value).toBe('50');
        expect(document.getElementById('hiEQuestion').value).toBe('What is in the picture?');
    });

    it('counts a pasted copy among the questions used in each game', () => {
        device.updateFieldGame(game());

        device.copyQuestion();
        device.pasteQuestion();

        expect(device.questionsGame).toHaveLength(2);
        expect(document.getElementById('hiENumeroPercentaje').textContent).toBe('2/2');
    });

    it('keeps the changes made to the question on screen after copying it', () => {
        device.updateFieldGame(game());
        device.copyQuestion();
        document.getElementById('hiEQuestion').value = 'What else is in the picture?';

        device.pasteQuestion();

        expect(device.questionsGame.map((item) => item.question)).toEqual([
            'What else is in the picture?',
            'What is in the picture?',
        ]);
    });

    it('keeps the custom texts when the iDevice is edited again', () => {
        device.idevicePreviousData = `
            <div class="hiddenimage-IDevice">
                <div class="hiddenimage-version js-hidden">1</div>
                <div class="hiddenimage-DataGame js-hidden">${JSON.stringify(game({ msgs: { msgScore: 'Points' } }))}</div>
            </div>`;

        device.loadPreviousValues();

        expect(document.getElementById('ci18n_msgScore').value).toBe('Points');
    });

    describe('saving', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '<p>Extra info</p>',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? { initialized: true, getContent: () => editors[id], setContent: (html) => (editors[id] = html) }
                    : null
            );
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('keeps the access code and the clue when saving', () => {
            const itinerary = {
                showClue: true,
                clueGame: 'Next key: river',
                percentageClue: 60,
                showCodeAccess: true,
                codeAccess: '1234',
                messageCodeAccess: 'Code of the previous activity?',
            };
            device.updateFieldGame(game({ itinerary }));

            expect(device.validateData().itinerary).toEqual(itinerary);
        });

        it('saves the game without the help of the form', () => {
            device.updateFieldGame(game({ showMinimize: true }));

            const html = device.save();

            expect(html).toContain('hiddenimage-DataGame');
            expect(html).toContain('"showMinimize":true');
            expect(html).toContain('hiddenimage-extra-content');
            expect(html).not.toContain('exe-idevice-help');
        });
    });
});
