/**
 * Unit tests for complete iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML escaping
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
  global.attachEditionLifecycle?.(global.$exeDevice);
  return global.$exeDevice;
}

describe('complete iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'complete.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('&')).toBe('&amp;');
      expect($exeDevice.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('<')).toBe('&lt;');
      expect($exeDevice.escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('>')).toBe('&gt;');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('"')).toBe('&quot;');
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("'")).toBe('&#39;');
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple characters', () => {
      expect($exeDevice.escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
    });

    it('handles empty string', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });

    it('handles string with no special characters', () => {
      expect($exeDevice.escapeHtml('Hello World')).toBe('Hello World');
    });

    it('converts numbers to string', () => {
      expect($exeDevice.escapeHtml(123)).toBe('123');
    });

    it('handles HTML attributes', () => {
      const input = 'class="test" data-value=\'foo\'';
      const expected = 'class=&quot;test&quot; data-value=&#39;foo&#39;';
      expect($exeDevice.escapeHtml(input)).toBe(expected);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('complete');
    });
  });

  // The editor truncates its numeric fields on keyup. Capping them at one digit
  // made ordinary values impossible to enter: the second keystroke was dropped,
  // so an author aiming for 10 minutes silently ended up with 1.
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
          <input id="cmptETime" />
          <input id="cmptEPercentajeError" />
        </form>`;
      $exeDevice.addEvents();
    });

    afterEach(() => {
      $exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
      document.body.innerHTML = '';
    });

    it('keeps a two-digit time', () => {
      $('#cmptETime').val('45').trigger('keyup');

      expect($('#cmptETime').val()).toBe('45');
    });

    it('truncates the time beyond two digits and drops non-digits', () => {
      $('#cmptETime').val('1a234').trigger('keyup');

      expect($('#cmptETime').val()).toBe('12');
    });

    it('keeps a three-digit error percentage', () => {
      $('#cmptEPercentajeError').val('100').trigger('keyup');

      expect($('#cmptEPercentajeError').val()).toBe('100');
    });

    it('truncates the error percentage beyond three digits', () => {
      $('#cmptEPercentajeError').val('12345').trigger('keyup');

      expect($('#cmptEPercentajeError').val()).toBe('123');
    });
  });
});

describe('default image edition/export dedup', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const editionDir = __dirname;
  const exportDir = path.join(editionDir, '..', 'export');

  it('ships the default image only in export/ (edition previews the export copy)', () => {
    expect(fs.existsSync(path.join(exportDir, 'cmptbackground.webp'))).toBe(true);
    expect(fs.existsSync(path.join(editionDir, 'cmptbackground.webp'))).toBe(false);
  });

  it('routes every edition reference to the export copy', () => {
    const source = fs.readFileSync(path.join(editionDir, 'complete.js'), 'utf-8');
    const refs = source.split('cmptbackground.webp').length - 1;
    const routed = source.split("replace(/\\/edition\\/?$/, '/export/')").length - 1;
    expect(refs).toBeGreaterThan(0);
    expect(routed).toBeGreaterThan(0);
    // No unrouted direct reference may sneak back in.
    expect(source).not.toContain("path + 'cmptbackground.webp'");
    expect(source).not.toContain('${path}cmptbackground.webp');
    expect(source).not.toContain('${$exeDevice.idevicePath}cmptbackground.webp');
  });

  /**
   * The pass-score control is a shared block in common_edition.js, exercised by
   * its own tests. What is specific to this iDevice -- and what silently breaks
   * if someone edits the form -- is the wiring: all four call sites have to be
   * present, and the two saved fields have to reach the stored data. Reading
   * the source is how that is checked without standing up the whole edition
   * form.
   */
  describe('pass score wiring', () => {
      let source;

      beforeEach(() => {
          source = readFileSync(join(__dirname, 'complete.js'), 'utf-8');
      });

      it('delegates the evaluation controls to the shared tab', () => {
          // The pass score and the progress report used to be rendered here,
          // loose in the general options. They now live in the Grading tab,
          // so rendering them again would show each control twice.
          expect(source).not.toContain('passScore.getContents(');
          expect(source).not.toContain('progressBar.getContents(');
          expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading:\s*true/);
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

describe('complete minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'complete.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('complete edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/complete/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const tabNames = () =>
        [...document.querySelectorAll('#completeQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`completeQEIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        typeGame: 'Completa',
        instructions: '<p>Instructions</p>',
        textText: 'eXeLearning is a @@free@@ and open source editor to create @@educational@@ resources.',
        showMinimize: false,
        time: 0,
        type: 0,
        wordsErrors: '',
        attempsNumber: 2,
        showSolution: false,
        estrictCheck: false,
        percentajeError: 20,
        caseSensitive: false,
        wordsSize: false,
        wordsLimit: false,
        hasBack: false,
        urlBack: '',
        authorBackImage: '',
        fontColor: '#000000',
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
        global.$exeDevices = {
            iDevice: {
                gamification: {
                    helpers: exportHelpers,
                    media: {
                        extractURLGD: (url) => url,
                    },
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });

        const filePath = join(__dirname, 'complete.js');
        const code = readFileSync(filePath, 'utf-8');
        device = loadIdevice(code);

        document.body.innerHTML = '<div id="completeBody"></div>';
        device.init(document.getElementById('completeBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        document.body.innerHTML = '';
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('organises the edition form into shared WAI-ARIA tabs', () => {
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

        expect(panel('instructions').querySelector('#eXeGameInstructions')).not.toBeNull();
        expect(panel('options').querySelector('#cmptEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#cmptEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgReply')).not.toBeNull();
    });

    it('provides accessible help tooltips for option rows', () => {
        const optionHelps = [...panel('options').querySelectorAll('#cmptEOptions .exe-idevice-help')];
        expect(optionHelps.length).toBe(11);

        for (const help of optionHelps) {
            expect(help.tagName).toBe('BUTTON');
            expect(help.type).toBe('button');
            expect(help.title).toBe('Information');
            const targetId = help.getAttribute('aria-controls');
            expect(targetId).toBeTruthy();
            expect(document.getElementById(targetId)?.textContent.length).toBeGreaterThan(10);
        }
    });

    it('does not toggle switches when clicking help icons inside toggle-items', () => {
        const minimizeInput = document.getElementById('cmptEShowMinimize');
        const minimizeHelp = minimizeInput.closest('div').querySelector('.exe-idevice-help');
        expect(minimizeHelp).not.toBeNull();
        expect(minimizeInput.checked).toBe(false);
        minimizeHelp.click();
        expect(minimizeInput.checked).toBe(false);

        const solutionInput = document.getElementById('cmptEShowSolution');
        const solutionHelp = solutionInput.closest('div').querySelector('.exe-idevice-help');
        expect(solutionHelp).not.toBeNull();
        expect(solutionInput.checked).toBe(false);
        solutionHelp.click();
        expect(solutionInput.checked).toBe(false);
    });

    it('escapes translated help text in the explanation', () => {
        const text = 'Use "Accept" <once> & keep the learner\'s answer.';
        const container = document.createElement('div');
        container.innerHTML = edition().common.getHelpTooltip(text);
        const button = container.querySelector('button');
        expect(button.title).toBe('Information');
        expect(container.querySelector('.help-content').textContent).toBe(text);
        expect(container.querySelector('once')).toBeNull();
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBeGreaterThanOrEqual(11);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('completeQEIdeviceForm-tab-options').click();

        expect(panel('options').classList.contains('active')).toBe(true);
        expect(panel('instructions').classList.contains('active')).toBe(false);
    });

    it('restores form values and updates gamification modules on updateFieldGame', () => {
        device.updateFieldGame(
            game({
                showMinimize: true,
                showSolution: true,
                wordsSize: true,
                time: 15,
                attempsNumber: 4,
                feedBack: true,
                percentajeFB: 80,
            })
        );

        expect(document.getElementById('cmptEShowMinimize').checked).toBe(true);
        expect(document.getElementById('cmptEShowSolution').checked).toBe(true);
        expect(document.getElementById('cmptEWordsSize').checked).toBe(true);
        expect(document.getElementById('cmptETime').value).toBe('15');
        expect(document.getElementById('cmptAttemptsNumber').value).toBe('4');
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
    });

    describe('saving and validation', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '<p>Extra info</p>',
                eXeGameFeedBackEditor: '<p>Feedback message</p>',
                cmptEText: 'eXeLearning is @@free@@ software.',
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

        it('saves form data with feedback and extra content', () => {
            device.updateFieldGame(
                game({
                    showMinimize: true,
                    feedBack: true,
                    percentajeFB: 75,
                })
            );
            edition().gamification.feedback.setText('<p>Feedback message</p>');
            const data = device.validateData();

            expect(data.showMinimize).toBe(true);
            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(75);
            expect(unescape(data.textFeedBack)).toBe('<p>Feedback message</p>');
            expect(unescape(data.textAfter)).toBe('<p>Extra info</p>');
            expect(unescape(data.textText)).toBe('eXeLearning is @@free@@ software.');

            const savedHtml = device.save();
            expect(savedHtml).toContain('completa-feedback-game');
            expect(savedHtml).toContain('completa-extra-content');
            expect(savedHtml).toContain('completa-text-game');
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

        it('does not save when the feedback is on without a message', () => {
            device.updateFieldGame(game({ feedBack: true }));
            edition().gamification.feedback.setText('');

            expect(device.validateData()).toBe(false);
            expect(eXe.app.getLastAlert()).toBe('Message to display when passing the game');
        });
    });
});

