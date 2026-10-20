/**
 * Unit tests for mathematicaloperations iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - onlyNumbers: Input filtering for numbers only
 * - onlyNumbers1: Alternative number filtering
 * - validTime: Time format validation
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

describe('mathematicaloperations iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'mathematicaloperations.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('onlyNumbers', () => {
    it('removes non-numeric characters from input', () => {
      const mockInput = { value: 'abc123def456' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('123456');
    });

    it('keeps only digits', () => {
      const mockInput = { value: '12.34' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('1234');
    });

    it('handles empty input', () => {
      const mockInput = { value: '' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('');
    });

    it('handles input with only numbers', () => {
      const mockInput = { value: '12345' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('12345');
    });

    it('handles input with only non-numeric characters', () => {
      const mockInput = { value: 'abcdef' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('');
    });

    it('removes spaces', () => {
      const mockInput = { value: '1 2 3' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('123');
    });

    it('removes special characters', () => {
      const mockInput = { value: '1@2#3$4%5' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('12345');
    });

    it('removes negative sign', () => {
      const mockInput = { value: '-123' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('123');
    });
  });

  describe('onlyNumbers1', () => {
    it('removes last character if not a number', () => {
      const mockInput = { value: '123a' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('123');
    });

    it('keeps value unchanged if last character is a number', () => {
      const mockInput = { value: '1234' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('1234');
    });

    it('handles empty string', () => {
      const mockInput = { value: '' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('');
    });

    it('removes special characters at end', () => {
      const mockInput = { value: '123!' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('123');
    });

    it('removes space at end', () => {
      const mockInput = { value: '123 ' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('123');
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
      expect($exeDevice.validTime('12:99:00')).toBe(false);
    });

    it('returns false for invalid seconds', () => {
      expect($exeDevice.validTime('12:30:60')).toBe(false);
      expect($exeDevice.validTime('12:30:99')).toBe(false);
    });

    it('returns false for wrong format', () => {
      expect($exeDevice.validTime('1:30:45')).toBe(false);
      expect($exeDevice.validTime('12:3:45')).toBe(false);
      expect($exeDevice.validTime('12:30:4')).toBe(false);
    });

    it('returns false for wrong length', () => {
      expect($exeDevice.validTime('12:30')).toBe(false);
      expect($exeDevice.validTime('123:30:45')).toBe(false);
      expect($exeDevice.validTime('')).toBe(false);
    });

    it('returns false for non-numeric characters', () => {
      expect($exeDevice.validTime('aa:bb:cc')).toBe(false);
      expect($exeDevice.validTime('12-30-45')).toBe(false);
    });
  });

  describe('defaultSettings', () => {
    it('has correct default settings structure', () => {
      expect($exeDevice.defaultSettings).toEqual({
        modo: 0,
        type: 'result',
        number: 10,
        operations: '1111',
        min: -1000,
        max: 1000,
        decimalsInOperands: 0,
        decimalsInResults: 1,
        negative: 1,
        zero: 1,
      });
    });
  });

  describe('i18n', () => {
    it('has category and name defined', () => {
      expect($exeDevice.i18n).toBeDefined();
      expect($exeDevice.i18n.category).toBeDefined();
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  // The editor truncates its numeric fields on keyup. Capping them at one digit
  // made ordinary values impossible to enter: the second keystroke was dropped,
  // so an author aiming for 10 silently ended up with 1.
  describe('numeric field limits', () => {
    let previousItinerary;

    beforeEach(() => {
      previousItinerary = $exeIDevicesEdition.iDevice.gamification.itinerary;
      // addEvents wires the whole editor. The itinerary component lives outside
      // this iDevice's source, so it is stubbed rather than exercised here.
      $exeIDevicesEdition.iDevice.gamification.itinerary = {
        addEvents: () => {},
        getTab: () => '',
        init: () => {},
        setValues: () => {},
      };
      document.body.innerHTML = `
        <script></script>
        <form id="gameQEIdeviceForm">
          <input id="eRMQTime" />
        </form>`;
      $exeDevice.addEvents();
    });

    afterEach(() => {
      $exeDevice.$lifecycle.destroy();
      $exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
      document.body.innerHTML = '';
    });

    it('keeps a 2-digit time', () => {
      $('#eRMQTime').val('45').trigger('keyup');

      expect($('#eRMQTime').val()).toBe('45');
    });

    it('truncates the time beyond 2 digits and drops non-digits', () => {
      $('#eRMQTime').val('1a234').trigger('keyup');

      expect($('#eRMQTime').val()).toBe('12');
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
            source = readFileSync(join(__dirname, 'mathematicaloperations.js'), 'utf-8');
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

describe('mathematicaloperations minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'mathematicaloperations.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('mathematicaloperations edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/mathematicaloperations/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const tabNames = () =>
        [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        typeGame: 'MathOperations',
        showMinimize: false,
        type: 'result',
        number: 10,
        operations: '0010',
        min: 1,
        max: 9,
        decimalsInOperands: 0,
        decimalsInResults: false,
        negative: false,
        zero: false,
        mode: 0,
        solution: true,
        negativeFractions: false,
        errorType: 0,
        errorRelative: 0,
        errorAbsolute: 0,
        time: 0,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        feedBack: false,
        percentajeFB: 100,
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        evaluation: false,
        evaluationID: '',
        ...overrides,
    });
    let device;
    let previousApp;
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
        global.$exeDevices.iDevice.gamification.helpers.isJsonString = (text) => {
            try {
                return JSON.parse(text);
            } catch {
                return false;
            }
        };
        device = global.loadIdevice(join(__dirname, 'mathematicaloperations.js'));
        document.body.innerHTML = '<div id="mathOperationsBody"></div>';
        device.init(document.getElementById('mathOperationsBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        delete global.$exeDevices.iDevice.gamification.helpers.isJsonString;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its operations', () => {
        expect(tabNames()).toEqual([
            'instructions',
            'options',
            'contents',
            'passwords',
            'feedback',
            'after',
            'grading',
            'texts',
        ]);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts the operations in the Questions tab and the rest in Options', () => {
        expect(panel('contents').firstElementChild.textContent).toContain('Choose the operations the activity creates');
        expect(panel('contents').querySelector('#eRMQEPanel #eRMQtype')).not.toBeNull();
        expect(panel('contents').querySelector('#eRMQEPanel #eRMQmult')).not.toBeNull();
        expect(panel('options').querySelector('#eRMQEOptions #eRMQRelative')).not.toBeNull();
        expect(panel('options').querySelector('#eRMQEOptions #eRMQTime')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of ['eRMQHasFeedBack', 'eRMQPercentajeFB', 'eRMQFeedbackP', 'eRMQFeedBackEditor']) {
            expect(document.getElementById(id)).toBeNull();
        }
    });

    it('explains each setting without changing any of them', () => {
        const helps = [...document.querySelectorAll('#eRMQEPanel .exe-idevice-help, #eRMQEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#gameQEIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(15);
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
        expect(tooltips.size).toBe(21); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('restores the operations and the feedback with the game', () => {
        device.updateFieldGame(game({ operations: '1100', number: 20, feedBack: true, percentajeFB: 80 }));

        expect(document.getElementById('eRMQadd').checked).toBe(true);
        expect(document.getElementById('eRMQmult').checked).toBe(false);
        expect(document.getElementById('eRMQnum').value).toBe('20');
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
    });

    it('loads the saved feedback message into the shared editor', () => {
        device.idevicePreviousData = `
            <div class="mathoperations-IDevice">
                <div class="mathoperations-feedback-game"><p>Well done</p></div>
                <div class="mathoperations-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
            </div>`;

        device.loadPreviousValues();

        expect(feedback().getText()).toBe('<p>Well done</p>');
    });

    it('restores the custom texts with the game', () => {
        device.idevicePreviousData = `
            <div class="mathoperations-IDevice">
                <div class="mathoperations-DataGame js-hidden">${JSON.stringify(game({ msgs: { msgSubmit: 'Check it' } }))}</div>
            </div>`;

        device.loadPreviousValues();

        expect(document.getElementById('ci18n_msgSubmit').value).toBe('Check it');
    });

    it('shows the settings of a fractions game and hides the decimal ones', () => {
        const shown = (id) => document.getElementById(id).style.display !== 'none';

        device.updateFieldGame(game({ mode: 1, negativeFractions: true }));

        expect(shown('eRMQNegativesFractionsDiv')).toBe(true);
        expect(shown('eRMQErrorAbsoluteDiv')).toBe(false);
        expect(document.getElementById('eRMQNegativesFractions').checked).toBe(true);

        device.changeGameMode(0);

        expect(shown('eRMQNegativesFractionsDiv')).toBe(false);
        expect(shown('eRMQErrorAbsoluteDiv')).toBe(true);
    });

    describe('saving', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '',
                eXeGameFeedBackEditor: '',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                          hide: vi.fn(),
                          show: vi.fn(),
                      }
                    : null
            );
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ feedBack: true, percentajeFB: 70 }));
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            const html = device.save();
            expect(html).toContain('<div class="mathoperations-feedback-game"><p>Bravo</p></div>');
            expect(html).not.toContain('exe-idevice-help');
        });

        it('does not save when the feedback is on without a message', () => {
            device.updateFieldGame(game({ feedBack: true }));

            expect(device.validateData()).toBe(false);
            expect(eXe.app.getLastAlert()).toBe('Message to display when passing the game');
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

        it('keeps the negative fractions of a fractions game', () => {
            device.updateFieldGame(game({ mode: 1, negativeFractions: true }));

            expect(device.validateData().negativeFractions).toBe(true);
        });
    });
});
