/**
 * Unit tests for classify iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - hexToRgba: Color conversion
 * - validateGroups: Group validation
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

describe('classify iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'classify.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba with default alpha', () => {
      const result = $exeDevice.hexToRgba('#ff0000');
      expect(result).toBe('rgba(255, 0, 0, 1)');
    });

    it('converts 6-digit hex to rgba with custom alpha', () => {
      const result = $exeDevice.hexToRgba('#ff0000', 0.5);
      expect(result).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('converts 3-digit hex to rgba', () => {
      const result = $exeDevice.hexToRgba('#f00', 1);
      expect(result).toBe('rgba(255, 0, 0, 1)');
    });

    it('handles hex without hash symbol', () => {
      const result = $exeDevice.hexToRgba('00ff00', 1);
      expect(result).toBe('rgba(0, 255, 0, 1)');
    });

    it('returns white rgba for empty string', () => {
      const result = $exeDevice.hexToRgba('', 1);
      expect(result).toBe('rgba(255,255,255,1)');
    });

    it('returns white rgba for null/undefined', () => {
      const result1 = $exeDevice.hexToRgba(null, 1);
      const result2 = $exeDevice.hexToRgba(undefined, 1);
      expect(result1).toBe('rgba(255,255,255,1)');
      expect(result2).toBe('rgba(255,255,255,1)');
    });

    it('returns white rgba for invalid hex', () => {
      const result = $exeDevice.hexToRgba('#gggggg', 1);
      expect(result).toBe('rgba(255,255,255,1)');
    });

    it('handles rgb() input and converts to rgba', () => {
      const result = $exeDevice.hexToRgba('rgb(100, 150, 200)', 0.5);
      expect(result).toBe('rgba(100, 150, 200, 0.5)');
    });

    it('handles rgba() input and preserves/overrides alpha', () => {
      const result = $exeDevice.hexToRgba('rgba(100, 150, 200, 0.8)', 0.5);
      expect(result).toBe('rgba(100, 150, 200, 0.5)');
    });

    it('returns existing rgba() if alpha is 1 or undefined', () => {
      const result = $exeDevice.hexToRgba('rgba(100, 150, 200, 0.8)', 1);
      expect(result).toBe('rgba(100, 150, 200, 0.8)');
    });

    it('clamps alpha to valid range [0, 1]', () => {
      const result1 = $exeDevice.hexToRgba('#ff0000', 2);
      const result2 = $exeDevice.hexToRgba('#ff0000', -1);
      expect(result1).toBe('rgba(255, 0, 0, 1)');
      expect(result2).toBe('rgba(255, 0, 0, 0)');
    });

    it('converts common colors correctly', () => {
      expect($exeDevice.hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
      expect($exeDevice.hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
      expect($exeDevice.hexToRgba('#808080', 1)).toBe('rgba(128, 128, 128, 1)');
    });
  });

  describe('validateGroups', () => {
    it('returns false for empty array', () => {
      const result = $exeDevice.validateGroups([]);
      expect(result).toBe(false);
    });

    it('returns false for single group', () => {
      const result = $exeDevice.validateGroups(['0#item1', '0#item2']);
      expect(result).toBe(false);
    });

    it('returns 2 for valid 2 groups', () => {
      const result = $exeDevice.validateGroups(['0#item1', '1#item2']);
      expect(result).toBe(2);
    });

    it('returns 3 for valid 3 groups', () => {
      const result = $exeDevice.validateGroups(['0#item1', '1#item2', '2#item3']);
      expect(result).toBe(3);
    });

    it('returns 4 for valid 4 groups', () => {
      const result = $exeDevice.validateGroups([
        '0#item1',
        '1#item2',
        '2#item3',
        '3#item4',
      ]);
      expect(result).toBe(4);
    });

    it('returns 5 for valid 5 groups', () => {
      const result = $exeDevice.validateGroups([
        '0#item1',
        '1#item2',
        '2#item3',
        '3#item4',
        '4#item5',
      ]);
      expect(result).toBe(5);
    });

    it('returns 6 for valid 6 groups', () => {
      const result = $exeDevice.validateGroups([
        '0#item1',
        '1#item2',
        '2#item3',
        '3#item4',
        '4#item5',
        '5#item6',
      ]);
      expect(result).toBe(6);
    });

    it('returns 7 for valid 7 groups', () => {
      const result = $exeDevice.validateGroups([
        '0#item1',
        '1#item2',
        '2#item3',
        '3#item4',
        '4#item5',
        '5#item6',
        '6#item7',
      ]);
      expect(result).toBe(7);
    });

    it('returns 8 for valid 8 groups', () => {
      const result = $exeDevice.validateGroups([
        '0#item1',
        '1#item2',
        '2#item3',
        '3#item4',
        '4#item5',
        '5#item6',
        '6#item7',
        '7#item8',
      ]);
      expect(result).toBe(8);
    });

    it('returns 9 for valid 9 groups', () => {
      const result = $exeDevice.validateGroups([
        '0#item1',
        '1#item2',
        '2#item3',
        '3#item4',
        '4#item5',
        '5#item6',
        '6#item7',
        '7#item8',
        '8#item9',
      ]);
      expect(result).toBe(9);
    });

    it('returns false for group number > 8', () => {
      const result = $exeDevice.validateGroups(['0#item1', '9#item2']);
      expect(result).toBe(false);
    });

    it('returns false for negative group number', () => {
      const result = $exeDevice.validateGroups(['0#item1', '-1#item2']);
      expect(result).toBe(false);
    });

    it('returns false for non-consecutive groups', () => {
      // Groups 0 and 2 without 1 is invalid
      const result = $exeDevice.validateGroups(['0#item1', '2#item2']);
      expect(result).toBe(false);
    });

    it('handles multiple items per group', () => {
      const result = $exeDevice.validateGroups([
        '0#item1',
        '0#item2',
        '1#item3',
        '1#item4',
      ]);
      expect(result).toBe(2);
    });

    it('returns false for groups starting at non-zero', () => {
      // Groups 1 and 2 without 0 is invalid
      const result = $exeDevice.validateGroups(['1#item1', '2#item2']);
      expect(result).toBe(false);
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
      expect($exeDevice.validTime('1:30:45')).toBe(false); // missing leading zero
      expect($exeDevice.validTime('12:3:45')).toBe(false); // missing leading zero
      expect($exeDevice.validTime('12:30:4')).toBe(false); // missing leading zero
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

  describe('getCuestionDefault', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();

      expect(defaultQuestion).toEqual({
        type: 0,
        url: '',
        audio: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
        eText: '',
        type1: 0,
        msgError: '',
        msgHit: '',
        group: 0,
        color: '#000000',
        backcolor: '#ffffff',
      });
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getCuestionDefault();
      const q2 = $exeDevice.getCuestionDefault();

      expect(q1).not.toBe(q2);
      q1.eText = 'modified';
      expect(q2.eText).toBe('');
    });
  });

  describe('normalizeQuestionByType', () => {
    it('keeps image content and audio for type 0', () => {
      const normalized = $exeDevice.normalizeQuestionByType({
        type: 0,
        url: 'files/img.png',
        eText: 'text',
        audio: 'files/sound.mp3',
        x: 0.2,
        y: 0.4,
        author: 'Author',
        alt: 'Alt',
      });

      expect(normalized.url).toBe('files/img.png');
      expect(normalized.eText).toBe('');
      expect(normalized.audio).toBe('files/sound.mp3');
      expect(normalized.x).toBe(0.2);
      expect(normalized.y).toBe(0.4);
    });

    it('keeps text content and audio for type 1', () => {
      const normalized = $exeDevice.normalizeQuestionByType({
        type: 1,
        url: 'files/img.png',
        eText: 'text',
        audio: 'files/sound.mp3',
        x: 0.2,
        y: 0.4,
        author: 'Author',
        alt: 'Alt',
      });

      expect(normalized.eText).toBe('text');
      expect(normalized.url).toBe('');
      expect(normalized.audio).toBe('files/sound.mp3');
      expect(normalized.x).toBe(0);
      expect(normalized.y).toBe(0);
      expect(normalized.author).toBe('');
      expect(normalized.alt).toBe('');
    });

    it('keeps text, image and audio for type 2', () => {
      const normalized = $exeDevice.normalizeQuestionByType({
        type: 2,
        url: 'files/img.png',
        eText: 'text',
        audio: 'files/sound.mp3',
      });

      expect(normalized.url).toBe('files/img.png');
      expect(normalized.eText).toBe('text');
      expect(normalized.audio).toBe('files/sound.mp3');
    });
  });

  describe('isQuestionComplete', () => {
    describe('type 0 (Image)', () => {
      it('accepts a card with an image', () => {
        expect($exeDevice.isQuestionComplete({ type: 0, url: 'files/img.png', eText: '', audio: '' })).toBe(true);
      });

      // Regression for #2187: the player renders an audio-only card as a big
      // audio button (CQP-LinkAudioBig), so the editor must accept it. The 2.9
      // manual ships exactly this card (type 0, no image, only COW2.mp3).
      it('accepts a card that only has an audio', () => {
        expect($exeDevice.isQuestionComplete({ type: 0, url: '', eText: '', audio: 'resources/COW2.mp3' })).toBe(true);
      });

      it('rejects a card with neither image nor audio', () => {
        expect($exeDevice.isQuestionComplete({ type: 0, url: '', eText: '', audio: '' })).toBe(false);
      });

      it('rejects a card whose text alone would not render', () => {
        expect($exeDevice.isQuestionComplete({ type: 0, url: '', eText: 'ignored', audio: '' })).toBe(false);
      });
    });

    describe('type 1 (Text)', () => {
      it('accepts a card with text', () => {
        expect($exeDevice.isQuestionComplete({ type: 1, url: '', eText: 'Cat', audio: '' })).toBe(true);
      });

      it('accepts a card that only has an audio', () => {
        expect($exeDevice.isQuestionComplete({ type: 1, url: '', eText: '', audio: 'resources/cat.mp3' })).toBe(true);
      });

      it('rejects a card with neither text nor audio', () => {
        expect($exeDevice.isQuestionComplete({ type: 1, url: '', eText: '', audio: '' })).toBe(false);
      });

      it('rejects whitespace-only text', () => {
        expect($exeDevice.isQuestionComplete({ type: 1, url: '', eText: '   ', audio: '' })).toBe(false);
      });
    });

    describe('type 2 (Both)', () => {
      it('accepts a card with image and text', () => {
        expect($exeDevice.isQuestionComplete({ type: 2, url: 'files/img.png', eText: 'Pig', audio: '' })).toBe(true);
      });

      it('rejects a card missing the text', () => {
        expect($exeDevice.isQuestionComplete({ type: 2, url: 'files/img.png', eText: '', audio: '' })).toBe(false);
      });

      it('rejects a card missing the image', () => {
        expect($exeDevice.isQuestionComplete({ type: 2, url: '', eText: 'Pig', audio: '' })).toBe(false);
      });

      // "Both" promises an image *and* a text, so an audio must not rescue it.
      it('does not let an audio stand in for the missing half', () => {
        expect($exeDevice.isQuestionComplete({ type: 2, url: 'files/img.png', eText: '', audio: 'a.mp3' })).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('rejects a missing question', () => {
        expect($exeDevice.isQuestionComplete(null)).toBe(false);
        expect($exeDevice.isQuestionComplete(undefined)).toBe(false);
      });

      it('treats non-string media fields as empty', () => {
        expect($exeDevice.isQuestionComplete({ type: 0, url: undefined, eText: '', audio: null })).toBe(false);
      });

      it('treats a url shorter than the minimum as empty', () => {
        expect($exeDevice.isQuestionComplete({ type: 0, url: 'a.p', eText: '', audio: '' })).toBe(false);
      });

      it('treats an audio shorter than the minimum as empty', () => {
        expect($exeDevice.isQuestionComplete({ type: 1, url: '', eText: '', audio: 'a.p' })).toBe(false);
      });
    });
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
          source = readFileSync(join(__dirname, 'classify.js'), 'utf-8');
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
        <div id="clasificaIdeviceForm">
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

describe('classify minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'classify.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('classify edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/classify/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const tabNames = () =>
        [...document.querySelectorAll('#clasificaQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`clasificaQEIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        typeGame: 'Clasifica',
        author: 'Test Author',
        instructions: '<p>Instructions</p>',
        showMinimize: false,
        time: 0,
        gameLevel: 2,
        numberGroups: 2,
        groups: ['Group 1', 'Group 2'],
        customMessages: false,
        percentajeQuestions: 100,
        wordsGame: [
            {
                type: 1,
                group: 0,
                eText: 'Card 1',
                url: '',
                audio: '',
                x: 0,
                y: 0,
                color: '#000000',
                backcolor: '#ffffff',
                author: '',
                alt: '',
                msgHit: '',
                msgError: '',
            },
        ],
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
        imgCard: '',
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

        const filePath = join(__dirname, 'classify.js');
        const code = readFileSync(filePath, 'utf-8');
        device = loadIdevice(code);

        document.body.innerHTML = '<div id="classifyBody"></div>';
        device.init(document.getElementById('classifyBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        document.body.innerHTML = '';
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
    });

    it('explains what goes in the Questions tab', () => {
        const info = panel('contents').firstElementChild;

        expect(info.tagName).toBe('P');
        expect(info.textContent).toContain('Add the cards and choose the group each one belongs to. The groups are named in Options.');
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
        expect(panel('options').querySelector('#clasificaEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('.CQE-EPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('mounts import, export and AI modal triggers in contents toolbar', () => {
        const toolbar = panel('contents').querySelector('[role="toolbar"]');
        expect(toolbar).not.toBeNull();
        const links = [...toolbar.querySelectorAll('[data-exe-share]')];
        expect(links.map((link) => link.getAttribute('data-exe-share'))).toEqual(['import', 'export', 'ai']);
    });

    it('provides accessible help tooltips for option rows', () => {
        const optionHelps = [...panel('options').querySelectorAll('#clasificaEOptions .exe-idevice-help')];
        expect(optionHelps.length).toBe(7);

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
        const customMsgHelp = document.querySelector('#clasificaECustomMessagesDiv .exe-idevice-help');
        const customMsgInput = document.getElementById('clasificaECustomMessages');
        expect(customMsgHelp).not.toBeNull();
        expect(customMsgInput.checked).toBe(false);
        customMsgHelp.click();
        expect(customMsgInput.checked).toBe(false);

        const minimizeHelp = document.getElementById('clasificaEShowMinimize').closest('div').querySelector('.exe-idevice-help');
        const minimizeInput = document.getElementById('clasificaEShowMinimize');
        expect(minimizeHelp).not.toBeNull();
        expect(minimizeInput.checked).toBe(false);
        minimizeHelp.click();
        expect(minimizeInput.checked).toBe(false);
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
        expect(tooltips.size).toBeGreaterThanOrEqual(7);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('clasificaQEIdeviceForm-tab-options').click();

        expect(panel('options').classList.contains('active')).toBe(true);
        expect(panel('instructions').classList.contains('active')).toBe(false);
    });

    it('restores form values and updates gamification modules on updateFieldGame', () => {
        device.updateFieldGame(
            game({
                showMinimize: true,
                customMessages: true,
                numberGroups: 4,
                groups: ['G1', 'G2', 'G3', 'G4'],
                gameLevel: 1,
                feedBack: true,
                percentajeFB: 75,
            })
        );

        expect(document.getElementById('clasificaEShowMinimize').checked).toBe(true);
        expect(document.getElementById('clasificaECustomMessages').checked).toBe(true);
        expect(document.getElementById('clasificaENumGroups').value).toBe('4');
        expect(document.getElementById('clasificaL2').checked).toBe(true);
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('75');
    });

    describe('saving and validation', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '<p>Extra info</p>',
                eXeGameFeedBackEditor: '<p>Feedback message</p>',
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
                    percentajeFB: 80,
                })
            );
            device.showQuestion(0);
            edition().gamification.feedback.setText('<p>Feedback message</p>');
            const data = device.validateData();

            expect(data.showMinimize).toBe(true);
            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(80);
            expect(unescape(data.textFeedBack)).toBe('<p>Feedback message</p>');
            expect(unescape(data.textAfter)).toBe('<p>Extra info</p>');

            const savedHtml = device.save();
            expect(savedHtml).toContain('clasifica-feedback-game');
            expect(savedHtml).toContain('clasifica-extra-content');
        });

        describe('exporting', () => {
            let downloadBlob;
            let validateQuestion;
            const item = (fields) => ({ ...device.getCuestionDefault(), ...fields });
            const exportItems = (items) => {
                device.updateFieldGame(game());
                device.wordsGame = items;
                device.active = 0;
                device.showQuestion(0);
                document.getElementById('eXeGameExportQuestions').click();
            };

            beforeEach(() => {
                downloadBlob = vi.spyOn(edition().gamification.share, 'downloadBlob').mockReturnValue(true);
                // The item on screen is stored first, as on saving; happy-dom
                // cannot read the selected group back, so that step is stubbed.
                validateQuestion = vi.spyOn(device, 'validateQuestion').mockReturnValue(true);
            });

            afterEach(() => {
                downloadBlob.mockRestore();
                validateQuestion.mockRestore();
            });

            it('downloads the items with text as lines the import reads back', async () => {
                exportItems([
                    item({ type: 1, group: 0, eText: 'Lion' }),
                    item({ type: 0, group: 1, url: 'images/rabbit.png' }),
                    item({ type: 2, group: 1, url: 'images/cow.png', eText: 'Cow #1' }),
                ]);

                expect(validateQuestion).toHaveBeenCalled();
                expect(downloadBlob).toHaveBeenCalledTimes(1);
                const [blob, fileName, containerId] = downloadBlob.mock.calls[0];
                expect(await blob.text()).toBe('0#Lion\n1#Cow 1');
                expect(fileName).toBe('Classify.txt');
                expect(containerId).toBe('clasificaQEIdeviceForm');
            });

            it('tells the author when no item has a text to export', () => {
                exportItems([item({ type: 0, group: 0, url: 'images/rabbit.png' })]);

                expect(downloadBlob).not.toHaveBeenCalled();
                expect(eXe.app.getLastAlert()).toBe('Sorry, there are no questions for this type of activity.');
            });
        });
    });
});
