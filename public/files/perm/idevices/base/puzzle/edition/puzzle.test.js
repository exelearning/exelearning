/**
 * Unit tests for puzzle iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML escaping
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

describe('puzzle iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'puzzle.js');
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

    it('returns false for wrong length', () => {
      expect($exeDevice.validTime('12:30')).toBe(false);
      expect($exeDevice.validTime('')).toBe(false);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('puzzle');
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
            source = readFileSync(join(__dirname, 'puzzle.js'), 'utf-8');
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
        <div id="puzzleIdeviceForm">
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

        expect(importGame).toHaveBeenCalledWith('item');
      });
    });

    describe('preview audio', () => {
      it('stops playback and releases the stream when the edition closes', () => {
        $exeDevice.playSound('files/beep.mp3');
        const player = $exeDevice.playerAudio;
        const pause = vi.spyOn(player, 'pause');

        $exeDevice.$lifecycle.destroy();

        expect(pause).toHaveBeenCalledTimes(1);
        expect(player.hasAttribute('src')).toBe(false);
        pause.mockRestore();
      });
    });
  });
});

describe('puzzle minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'puzzle.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('puzzle edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/puzzle/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#puzzleIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`puzzleIdeviceForm-panel-${name}`);
    const puzzle = (overrides = {}) => ({
        type: 0,
        rows: 3,
        columns: 3,
        showImage: false,
        showNumber: false,
        msgError: '',
        msgHit: '',
        definition: 'Put the picture together',
        audioDefinition: '',
        audioClue: '',
        url: 'files/cat.jpg',
        alt: '',
        author: '',
        clue: 'Well done',
        showTime: false,
        showAttemps: false,
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'Puzzle',
        author: '',
        instructions: '',
        randomPuzzles: false,
        showMinimize: false,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        puzzlesGame: [puzzle()],
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        textFeedBack: '',
        textAfter: '',
        feedBack: false,
        percentajeFB: 100,
        percentajeQuestions: 100,
        version: 1,
        evaluation: false,
        evaluationID: '',
        ...overrides,
    });
    const stored = (data, extra = '') => `
        <div class="puzzle-IDevice">
            ${extra}
            <div class="puzzle-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;
    let device;
    let previousApp;
    let tooltips;
    let previousHelpers;
    let previousMedia;

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
                            tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
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
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
        device = global.loadIdevice(join(__dirname, 'puzzle.js'));
        document.body.innerHTML = '<div id="puzzleBody"></div>';
        device.init(document.getElementById('puzzleBody'), {}, PATH);
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
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its puzzles', () => {
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

    it('edits the puzzles in Questions and the game in Options', () => {
        expect(panel('contents').firstElementChild.textContent).toContain('Add the puzzles of the activity');
        expect(panel('contents').querySelector('#puzzleEPanel #puzzleERows')).not.toBeNull();
        expect(panel('contents').querySelector('#puzzleEPanel #puzzleEShowTime')).not.toBeNull();
        expect(panel('options').querySelector('#puzzleEOptions #puzzleERandomPuzzles')).not.toBeNull();
        expect(panel('options').querySelector('#puzzleEOptions #puzzleEPercentajeQuestions')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgTypeGame')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of ['puzzleEHasFeedBack', 'puzzleEPercentajeFB', 'puzzleEFeedbackP', 'puzzleEFeedBackEditor']) {
            expect(document.getElementById(id)).toBeNull();
        }
        expect(document.querySelector('.Games-Reportdiv')).toBeNull();
    });

    it('explains each setting without changing any of them', () => {
        const helps = [...document.querySelectorAll('#puzzleEPanel .exe-idevice-help, #puzzleEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#puzzleIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(10);
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
        expect(tooltips.size).toBe(10);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('restores the options, the puzzles and the feedback with the game', () => {
        device.idevicePreviousData = stored(
            game({
                randomPuzzles: true,
                feedBack: true,
                percentajeFB: 80,
                puzzlesGame: [puzzle({ rows: 4, showTime: true })],
            }),
            '<div class="puzzle-feedback-game"><p>Well done</p></div>'
        );

        device.loadPreviousValues();

        expect(document.getElementById('puzzleERandomPuzzles').checked).toBe(true);
        expect(document.getElementById('puzzleERows').value).toBe('4');
        expect(document.getElementById('puzzleEShowTime').checked).toBe(true);
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
        expect(feedback().getText()).toBe('<p>Well done</p>');
    });

    it('offers only the sizes a puzzle accepts, and explains a refused one', () => {
        for (const id of ['puzzleERows', 'puzzleEColumns']) {
            expect([...document.getElementById(id).options].map((option) => option.value)).toEqual([
                '2',
                '3',
                '4',
                '5',
                '6',
            ]);
        }
        document.getElementById('puzzleEURLImageDefinition').value = 'files/cat.jpg';
        $('#puzzleERows').append('<option>9</option>').val('9');

        expect(device.validatePuzzle()).toBe(false);
        expect(eXe.app.getLastAlert()).toBe(device.msgs.msgRowsNumber);
    });

    it('shows the empty picture again when a puzzle is cleared', () => {
        device.clearPuzzle();

        expect(document.getElementById('puzzleEImageDefinition').getAttribute('src')).toBe(
            `${PATH}quextIEImagen.png`
        );
    });

    it('names the picture, its authorship and its alternative text', () => {
        for (const id of ['puzzleEURLImageDefinition', 'puzzleEAuthorDefinition', 'puzzleEAltDefinition']) {
            expect(document.getElementById(id).labels).toHaveLength(1);
        }
    });

    it('writes the links of the files without leaking a global', () => {
        delete globalThis.linkImage;

        const links =
            device.createlinksImage([puzzle({ url: 'files/cat.jpg' })]) +
            device.createlinksAudio([puzzle({ audioDefinition: 'files/a.mp3', audioClue: 'files/b.mp3' })]);

        expect(links).toContain('puzzle-LinkImagesDef');
        expect(links).toContain('puzzle-LinkAudiosClue');
        expect(globalThis.linkImage).toBeUndefined();
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
                      }
                    : null
            );
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        const open = (overrides) => {
            device.updateFieldGame(game(overrides));
            device.showPuzzle(0);
        };

        it('saves the feedback values the export reads', () => {
            open({ feedBack: true, percentajeFB: 70 });
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            const html = device.save();
            expect(html).toContain('<div class="puzzle-feedback-game"><p>Bravo</p></div>');
            expect(html).not.toContain('exe-idevice-help');
        });

        it('does not save when the feedback is on without a message', () => {
            open({ feedBack: true });

            expect(device.save()).toBe(false);
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
            open({ itinerary });

            expect(device.validateData().itinerary).toEqual(itinerary);
        });

        it('counts a pasted copy in the puzzles per game', () => {
            open();

            device.copyPuzzle();
            device.pastePuzzle();

            expect(device.puzzlesGame).toHaveLength(2);
            expect(document.getElementById('puzzleENumeroPercentaje').textContent).toBe('2/2');
        });

        it('tells the author when there is no room for another puzzle', () => {
            open({ puzzlesGame: Array.from({ length: 30 }, () => puzzle()) });

            device.copyPuzzle();
            device.pastePuzzle();

            expect(device.puzzlesGame).toHaveLength(30);
            expect(eXe.app.getLastAlert()).toBe('Maximum number of activities: 30');
        });
    });
});
