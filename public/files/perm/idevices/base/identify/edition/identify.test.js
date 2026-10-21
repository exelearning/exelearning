/**
 * Unit tests for identify iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - validTime: Time format validation
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

describe('identify iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'identify.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
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

      // Landscape image (wider than tall)
      const result = $exeDevice.placeImageWindows(mockImage, 400, 300);

      // Image should scale to fit width, with vertical centering
      expect(result.w).toBe(200); // Full width of container
      expect(result.h).toBe(150); // Proportional height (300 * 200/400)
      expect(result.x).toBe(0); // No horizontal offset
      expect(result.y).toBe(25); // Centered vertically ((200-150)/2)

      cleanup();
    });

    it('calculates dimensions for portrait image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      // Portrait image (taller than wide)
      const result = $exeDevice.placeImageWindows(mockImage, 300, 400);

      // Image should scale to fit height, with horizontal centering
      expect(result.w).toBe(150); // Proportional width (300 * 200/400)
      expect(result.h).toBe(200); // Full height of container
      expect(result.x).toBe(25); // Centered horizontally ((200-150)/2)
      expect(result.y).toBe(0); // No vertical offset

      cleanup();
    });

    it('calculates dimensions for square image in square container', () => {
      const { mockImage, cleanup } = createMockImage(200, 200);

      // Square image
      const result = $exeDevice.placeImageWindows(mockImage, 400, 400);

      // Image should fill container exactly
      expect(result.w).toBe(200);
      expect(result.h).toBe(200);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);

      cleanup();
    });

    it('handles landscape container with landscape image', () => {
      const { mockImage, cleanup } = createMockImage(400, 200);

      // Wide container, wider image
      const result = $exeDevice.placeImageWindows(mockImage, 800, 300);

      // Should scale based on the more constrained dimension
      expect(result.w).toBe(400);
      expect(result.h).toBe(150);
      expect(result.x).toBe(0);
      expect(result.y).toBe(25);

      cleanup();
    });

    it('handles portrait container with portrait image', () => {
      const { mockImage, cleanup } = createMockImage(200, 400);

      // Tall container, taller image
      const result = $exeDevice.placeImageWindows(mockImage, 300, 800);

      // Should scale based on the more constrained dimension
      expect(result.w).toBe(150);
      expect(result.h).toBe(400);
      expect(result.x).toBe(25);
      expect(result.y).toBe(0);

      cleanup();
    });

    it('handles zero or invalid container dimensions', () => {
      const { mockImage, cleanup } = createMockImage(0, 0);

      // Container with zero dimensions (falls back to 1)
      const result = $exeDevice.placeImageWindows(mockImage, 100, 100);

      // Should handle gracefully with fallback values
      expect(result).toBeDefined();
      expect(typeof result.w).toBe('number');
      expect(typeof result.h).toBe('number');

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

  describe('getCuestionDefault', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();

      expect(defaultQuestion).toHaveProperty('url');
      expect(defaultQuestion).toHaveProperty('audio');
      expect(defaultQuestion).toHaveProperty('x');
      expect(defaultQuestion).toHaveProperty('y');
      expect(defaultQuestion).toHaveProperty('author');
      expect(defaultQuestion).toHaveProperty('alt');
      expect(defaultQuestion).toHaveProperty('question');
      expect(defaultQuestion).toHaveProperty('clues');
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getCuestionDefault();
      const q2 = $exeDevice.getCuestionDefault();

      expect(q1).not.toBe(q2);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
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
            source = readFileSync(join(__dirname, 'identify.js'), 'utf-8');
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

  describe('edition lifecycle', () => {
    let savedGamification;
    let savedMedia;

    beforeEach(() => {
      savedGamification = global.$exeIDevicesEdition.iDevice.gamification;
      global.$exeIDevicesEdition.iDevice.gamification = {
        ...savedGamification,
        progressBar: { addEvents: vi.fn() },
        itinerary: { addEvents: vi.fn() },
        share: { addEvents: vi.fn(), downloadBlob: vi.fn(() => true) },
        helpers: { stopSound: vi.fn(), playSound: vi.fn() },
      };
      savedMedia = global.$exeDevices.iDevice.gamification.media;
      global.$exeDevices.iDevice.gamification.media = {
        extractURLGD: (url) => url,
      };

      document.body.innerHTML = `
        <div id="idfIdeviceForm">
          <input id="eXeGameImportGame" type="file">
        </div>
      `;

      $exeDevice.addEvents();
    });

    afterEach(() => {
      // Close the edition the test opened, so its document handlers cannot
      // leak into the next one.
      $exeDevice.$lifecycle.destroy();
      document.body.innerHTML = '';
      global.$exeIDevicesEdition.iDevice.gamification = savedGamification;
      global.$exeDevices.iDevice.gamification.media = savedMedia;
    });

    describe('import FileReader', () => {
      /**
       * Drive the file input the way a user picking a file does, and hand back
       * the FileReader the edition created for it.
       *
       * @returns {FileReader}
       */
      function pickFile() {
        const readers = [];
        const RealFileReader = global.FileReader;
        class TrackedFileReader extends RealFileReader {
          constructor() {
            super();
            readers.push(this);
          }
        }
        global.FileReader = TrackedFileReader;
        try {
          const input = document.getElementById('eXeGameImportGame');
          Object.defineProperty(input, 'files', {
            configurable: true,
            value: [new File(['item'], 'game.txt', { type: 'text/plain' })],
          });
          $(input).trigger('change');
        } finally {
          global.FileReader = RealFileReader;
        }
        return readers[0];
      }

      it('aborts a read that is still in flight when the edition closes', () => {
        const reader = pickFile();
        expect(reader).toBeDefined();
        const abort = vi.spyOn(reader, 'abort');

        expect(reader.readyState).toBe(1);
        $exeDevice.$lifecycle.destroy();

        expect(abort).toHaveBeenCalledTimes(1);
        abort.mockRestore();
      });

      it('discards a load that resolves after the edition closed', () => {
        const reader = pickFile();
        const importGame = vi.fn();
        $exeDevice.importGame = importGame;

        $exeDevice.$lifecycle.destroy();
        reader.onload({ target: { result: 'item' } });

        expect(importGame).not.toHaveBeenCalled();
      });

      it('imports a load that resolves while the edition is open', () => {
        const reader = pickFile();
        const importGame = vi.fn();
        $exeDevice.importGame = importGame;

        reader.onload({ target: { result: 'item' } });

        expect(importGame).toHaveBeenCalledWith('item', 'text/plain');
      });
    });
  });
});

describe('identify minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'identify.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('identify edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/identify/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const tabNames = () =>
        [...document.querySelectorAll('#identifyQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`identifyQEIdeviceForm-panel-${name}`);
    const question = (overrides = {}) => ({
        numberClues: 3,
        url: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
        question: 'Who am I?',
        solution: 'Mercury',
        clues: ['Closest planet to the Sun', 'Smallest planet', 'Named after a Roman god', '', '', '', '', ''],
        audio: '',
        msgHit: '',
        msgError: '',
        attempts: 4,
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'Identifica',
        showMinimize: false,
        avancedMode: true,
        questionsRamdon: false,
        showSolution: true,
        timeShowSolution: 3,
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
        device = global.loadIdevice(join(__dirname, 'identify.js'));
        document.body.innerHTML = '<div id="identifyBody"></div>';
        device.init(document.getElementById('identifyBody'), {}, PATH);
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

    it('puts each part of the form in its tab', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toContain('Use the clues');
        expect(panel('options').querySelector('#idfEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#idfEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of ['idfEHasFeedBack', 'idfEPercentajeFB', 'idfEFeedbackP', 'idfEFeedBackEditor']) {
            expect(document.getElementById(id)).toBeNull();
        }
    });

    it('offers to import, to export and to create with AI', () => {
        const links = [...panel('contents').querySelectorAll('[data-exe-share]')];
        expect(links.map((link) => link.getAttribute('data-exe-share'))).toEqual(['import', 'export', 'ai']);
        expect(document.querySelector('body > #eXeShareModal-export #eXeGameExportQuestions')).not.toBeNull();
        // It reads txt files only: the Import window does not offer Moodle xml.
        expect(document.querySelector('#eXeShareModal-import .modal-body').firstElementChild.textContent).toBe(
            'You can import questions compatible with this activity from txt files.'
        );
    });

    describe('exporting', () => {
        const question = (solution, message, clues) => ({
            ...device.getCuestionDefault(),
            solution,
            question: message,
            numberClues: clues.length,
            clues: [...clues, ...Array(8 - clues.length).fill('')],
        });
        let download;

        beforeEach(() => {
            vi.spyOn(global.tinymce, 'get').mockReturnValue(null);
            download = vi.spyOn($exeIDevicesEdition.iDevice.gamification.share, 'downloadBlob').mockReturnValue(true);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('writes one line per question in the format Import reads back', async () => {
            device.questionsGame = [
                question('Paris', 'A capital', ['On the Seine', 'Has a tower', 'In France']),
                question('Rome', '', ['Has a #1 coliseum', 'In Italy']),
            ];
            device.active = 0;
            device.showQuestion(0);

            document.getElementById('eXeGameExportQuestions').click();

            expect(download).toHaveBeenCalledTimes(1);
            const text = await download.mock.calls[0][0].text();
            // A # inside a field would split it; an empty message goes as a space.
            expect(text.split('\n')).toEqual([
                'Paris#A capital#On the Seine#Has a tower#In France',
                'Rome# #Has a  1 coliseum#In Italy',
            ]);

            device.questionsGame = [];
            device.insertQuestions(text.split('\n'));
            expect(device.questionsGame.map(({ solution, question: message, numberClues, clues }) => ({
                solution,
                message,
                clues: clues.slice(0, numberClues),
            }))).toEqual([
                { solution: 'Paris', message: 'A capital', clues: ['On the Seine', 'Has a tower', 'In France'] },
                { solution: 'Rome', message: '', clues: ['Has a  1 coliseum', 'In Italy'] },
            ]);
        });

        it('exports the question on screen with its latest changes', async () => {
            device.questionsGame = [question('Paris', 'A capital', ['On the Seine', 'Has a tower'])];
            device.active = 0;
            device.showQuestion(0);
            document.getElementById('idfESolution').value = 'Lyon';

            device.exportQuestions();

            expect(await download.mock.calls[0][0].text()).toBe('Lyon#A capital#On the Seine#Has a tower');
        });
    });

    it('explains each option without changing any of them', () => {
        const helps = [...panel('options').querySelectorAll('#idfEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#identifyQEIdeviceForm input')].map((input) => input.checked);
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
        expect(tooltips.size).toBeGreaterThanOrEqual(6);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('restores the options and the feedback with the game', () => {
        device.updateFieldGame(game({ avancedMode: false, feedBack: true, percentajeFB: 80 }));

        expect(document.getElementById('idfESAvancedMode').checked).toBe(false);
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
        expect(document.getElementById('idfESolution').value).toBe('Mercury');
    });

    it('takes every field after the solution of an AI line as a clue', async () => {
        document.getElementById('eXeEQuestionsArea').value = 'Mercury#Closest to the Sun#Smallest planet#No moons';
        document.getElementById('eXeESaveButton').click();
        await vi.waitFor(() => expect(eXe.app.getLastAlert()).toBe('The questions have been added successfully'));

        const added = device.questionsGame.at(-1);
        expect(added).toMatchObject({ solution: 'Mercury', question: '', numberClues: 3 });
        expect(added.clues.slice(0, 3)).toEqual(['Closest to the Sun', 'Smallest planet', 'No moons']);
    });

    describe('adding questions to the one on screen', () => {
        // The author typed it in a new activity: it is on screen, not in the list yet.
        const typeOnScreen = (fields) => {
            device.questionsGame = [question(fields)];
            device.active = 0;
            device.showQuestion(0);
            device.questionsGame = [device.getCuestionDefault()];
        };
        const alertsWhile = (action) => {
            const before = eXe.app._alertHistory.length;
            action();
            return eXe.app._alertHistory.slice(before);
        };

        it('keeps it when it is complete', () => {
            typeOnScreen({ solution: 'Venus' });

            device.insertAIQuestions(['Mars#Red planet#Has two moons']);

            expect(device.questionsGame.map((item) => item.solution)).toEqual(['Venus', 'Mars']);
        });

        it('leaves it out, without its warning, when it is incomplete', () => {
            typeOnScreen({ solution: 'Venus', clues: ['Second planet', '', '', '', '', '', '', ''] });

            const alerts = alertsWhile(() => device.insertAIQuestions(['Mars#Red planet#Has two moons']));

            expect(device.questionsGame.map((item) => item.solution)).toEqual(['Mars']);
            expect(alerts).toEqual([]);
        });
    });

    it('accepts webp pictures from the project files', () => {
        const picture = document.getElementById('idfEURLImage');
        picture.value = 'files/picture.webp';
        $(picture).trigger('change');

        expect(eXe.app.getLastAlert() ?? '').not.toContain('Supported formats');
    });

    it('counts a pasted copy among the questions used in each game', () => {
        device.updateFieldGame(game());

        device.copyQuestion();
        device.pasteQuestion();

        expect(device.questionsGame).toHaveLength(2);
        expect(document.getElementById('idfENumeroPercentaje').textContent).toBe('2/2');
    });

    it('keeps the custom texts and the feedback message when the iDevice is edited again', () => {
        device.idevicePreviousData = `
            <div class="identifica-IDevice">
                <div class="identifica-version js-hidden">1</div>
                <div class="identifica-feedback-game"><p>Well done</p></div>
                <div class="identifica-DataGame js-hidden">${JSON.stringify(game({ feedBack: true, msgs: { msgScore: 'Points' } }))}</div>
            </div>`;

        device.loadPreviousValues();

        expect(feedback().getText()).toBe('<p>Well done</p>');
        expect(document.getElementById('ci18n_msgScore').value).toBe('Points');
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
            expect(html).toContain('<div class="identifica-feedback-game"><p>Bravo</p></div>');
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
    });
});
