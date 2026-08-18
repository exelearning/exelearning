/**
 * Unit tests for crossword iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getCuestionDefault: Default question structure
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

describe('crossword iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'crossword.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('getCuestionDefault', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();

      expect(defaultQuestion).toEqual({
        word: '',
        definition: '',
        url: '',
        audio: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
      });
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getCuestionDefault();
      const q2 = $exeDevice.getCuestionDefault();

      expect(q1).not.toBe(q2);
      q1.word = 'modified';
      expect(q2.word).toBe('');
    });

    it('has word property as empty string', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.word).toBe('');
    });

    it('has definition property as empty string', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.definition).toBe('');
    });

    it('has coordinates initialized to 0', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.x).toBe(0);
      expect(defaultQuestion.y).toBe(0);
    });
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
    it('has category and name defined', () => {
      expect($exeDevice.i18n).toBeDefined();
      expect($exeDevice.i18n.category).toBeDefined();
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('crossword');
    });
  });

  describe('edition lifecycle', () => {
    let originalItinerary;
    let originalMedia;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="crosswordForm">
          <span class="toggle-item" role="switch">
            <input id="tgl" class="toggle-input" type="checkbox" data-target="#tgt">
          </span>
          <div id="tgt"></div>
          <input id="eXeGameImportGame" type="file">
        </div>
      `;
      originalItinerary = global.$exeDevicesEdition.iDevice.gamification.itinerary;
      global.$exeDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };
      originalMedia = global.$exeDevices.iDevice.gamification.media;
      global.$exeDevices.iDevice.gamification.media = { extractURLGD: url => url };
      global.$exeDevicesEdition.iDevice.gamification.helpers.stopSound = vi.fn();
      $exeDevice.addEvents();
    });

    afterEach(() => {
      // Close the edition the test opened, so its document handlers cannot
      // leak into the next one — exactly what the workarea does on teardown.
      $exeDevice.$lifecycle.destroy();
      global.$exeDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
      global.$exeDevices.iDevice.gamification.media = originalMedia;
      document.body.innerHTML = '';
    });

    describe('delegated .toggle-input handler on document', () => {
      it('reacts to a change while the edition is open', () => {
        const $input = $('#tgl');
        $input.prop('checked', true).trigger('change');

        expect($('.toggle-item').attr('aria-checked')).toBe('true');
        expect($('#tgt').css('display')).toBe('flex');
      });

      it('stops reacting once the edition is closed', () => {
        $('#tgl').prop('checked', true).trigger('change');
        expect($('.toggle-item').attr('aria-checked')).toBe('true');

        $exeDevice.$lifecycle.destroy();

        $('.toggle-item').attr('aria-checked', 'stale');
        $('#tgl').prop('checked', false).trigger('change');

        expect($('.toggle-item').attr('aria-checked')).toBe('stale');
      });

      it('leaves unrelated document handlers registered', () => {
        const unrelated = vi.fn();
        $(document).on('change.crosswordUnrelated', '.toggle-input', unrelated);

        $exeDevice.$lifecycle.destroy();
        $('#tgl').trigger('change');

        expect(unrelated).toHaveBeenCalledTimes(1);
        $(document).off('change.crosswordUnrelated');
      });
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
            value: [new File(['word|clue'], 'game.txt', { type: 'text/plain' })],
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
        reader.onload({ target: { result: 'word|clue' } });

        expect(importGame).not.toHaveBeenCalled();
      });

      it('imports a load that resolves while the edition is open', () => {
        const reader = pickFile();
        const importGame = vi.fn();
        $exeDevice.importGame = importGame;

        reader.onload({ target: { result: 'word|clue' } });

        expect(importGame).toHaveBeenCalledWith('word|clue', 'text/plain');
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
