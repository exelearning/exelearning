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

  describe('edition lifecycle', () => {
    let savedGamification;
    let savedMedia;

    beforeEach(() => {
      savedGamification = global.$exeDevicesEdition.iDevice.gamification;
      global.$exeDevicesEdition.iDevice.gamification = {
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
          <span class="toggle-item" role="switch">
            <input id="tgl" class="toggle-input" type="checkbox" data-target="#tgt">
          </span>
          <div id="tgt"></div>
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
      global.$exeDevicesEdition.iDevice.gamification = savedGamification;
      global.$exeDevices.iDevice.gamification.media = savedMedia;
    });

    describe('delegated .toggle-input handler on document', () => {
      it('reacts to a change while the edition is open', () => {
        $('#tgl').prop('checked', true).trigger('change');

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
        $(document).on('change.identifyUnrelated', '.toggle-input', unrelated);

        $exeDevice.$lifecycle.destroy();
        $('#tgl').trigger('change');

        expect(unrelated).toHaveBeenCalledTimes(1);
        $(document).off('change.identifyUnrelated');
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

      it('plays on canplaythrough while open, and stays silent afterwards', () => {
        $exeDevice.playSound('files/beep.mp3');
        const player = $exeDevice.playerAudio;
        const play = vi.spyOn(player, 'play').mockReturnValue(undefined);

        player.dispatchEvent(new Event('canplaythrough'));
        expect(play).toHaveBeenCalledTimes(1);

        $exeDevice.$lifecycle.destroy();
        player.dispatchEvent(new Event('canplaythrough'));

        expect(play).toHaveBeenCalledTimes(1);
        play.mockRestore();
      });
    });
  });
});
