/**
 * Unit tests for az-quiz-game iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getRealLetter: Converts 0/1 codes to L·L/SS special characters
 * - getCaracterLetter: Converts L·L/SS special characters to 0/1 codes
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $azquizgame globally.
 * Replaces 'var $azquizgame' with 'global.$azquizgame' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$azquizgame\s*=/, 'global.$azquizgame =');
  // Remove the auto-init call, whichever form the export uses:
  // $(function () { $azquizgame.init(); }); or $(() => { $azquizgame.init(); });
  modifiedCode = modifiedCode.replace(
    /\$\(\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{\s*\$azquizgame\.init\(\);\s*\}\s*\);?/g,
    ''
  );
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$azquizgame;
}

describe('az-quiz-game iDevice export', () => {
  let $azquizgame;

  beforeEach(() => {
    global.$azquizgame = undefined;

    const filePath = join(__dirname, 'az-quiz-game.js');
    const code = readFileSync(filePath, 'utf-8');

    $azquizgame = loadExportIdevice(code);
  });

  describe('getRealLetter', () => {
    it('converts 0 to L·L', () => {
      expect($azquizgame.getRealLetter('0')).toBe('L·L');
    });

    it('converts 1 to SS', () => {
      expect($azquizgame.getRealLetter('1')).toBe('SS');
    });

    it('returns regular letter unchanged', () => {
      expect($azquizgame.getRealLetter('A')).toBe('A');
      expect($azquizgame.getRealLetter('Z')).toBe('Z');
      expect($azquizgame.getRealLetter('Ñ')).toBe('Ñ');
    });

    it('returns empty string unchanged', () => {
      expect($azquizgame.getRealLetter('')).toBe('');
    });
  });

  describe('getCaracterLetter', () => {
    it('converts L·L to 0', () => {
      expect($azquizgame.getCaracterLetter('L·L')).toBe('0');
    });

    it('converts SS to 1', () => {
      expect($azquizgame.getCaracterLetter('SS')).toBe('1');
    });

    it('returns regular letter unchanged', () => {
      expect($azquizgame.getCaracterLetter('A')).toBe('A');
      expect($azquizgame.getCaracterLetter('Z')).toBe('Z');
      expect($azquizgame.getCaracterLetter('Ñ')).toBe('Ñ');
    });

    it('returns empty string unchanged', () => {
      expect($azquizgame.getCaracterLetter('')).toBe('');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($azquizgame.colors).toBeDefined();
      expect($azquizgame.colors.black).toBe('#f9f9f9');
      expect($azquizgame.colors.white).toBe('#ffffff');
      expect($azquizgame.colors.blue).toBe('#5877c6');
      expect($azquizgame.colors.green).toBe('#00a300');
      expect($azquizgame.colors.red).toBe('#b3092f');
      expect($azquizgame.colors.yellow).toBe('#f3d55a');
    });
  });

  describe('mcanvas', () => {
    it('has default canvas dimensions', () => {
      expect($azquizgame.mcanvas).toBeDefined();
      expect($azquizgame.mcanvas.width).toBe(360);
      expect($azquizgame.mcanvas.height).toBe(360);
    });
  });

  describe('radiusLetter', () => {
    it('has default radius value', () => {
      expect($azquizgame.radiusLetter).toBe(16);
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $azquizgame.init).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($azquizgame.options).toEqual([]);
    });
  });

  describe('loadDataGame', () => {
    beforeEach(() => {
      // Mock $exeDevices.iDevice.gamification
      global.$exeDevices = {
        iDevice: {
          gamification: {
            helpers: {
              decrypt: (json) => json,
              isJsonString: (json) => JSON.parse(json),
            },
            media: {
              extractURLGD: (url) => url,
            },
          },
        },
      };
    });

    afterEach(() => {
      delete global.$exeDevices;
    });

    it('sets durationGame to 240 when not defined in JSON', () => {
      const mockData = {
        text: () => JSON.stringify({
          wordsGame: [],
        }),
      };
      const mockImgsLink = { each: () => {} };
      const mockAudiosLink = { each: () => {} };

      const result = $azquizgame.loadDataGame(mockData, mockImgsLink, mockAudiosLink, 0);

      expect(result.durationGame).toBe(240);
    });

    it('preserves durationGame when defined in JSON', () => {
      const mockData = {
        text: () => JSON.stringify({
          wordsGame: [],
          durationGame: 300,
        }),
      };
      const mockImgsLink = { each: () => {} };
      const mockAudiosLink = { each: () => {} };

      const result = $azquizgame.loadDataGame(mockData, mockImgsLink, mockAudiosLink, 0);

      expect(result.durationGame).toBe(300);
    });

    it('sets default values for modeBoard, evaluation, and evaluationID', () => {
      const mockData = {
        text: () => JSON.stringify({
          wordsGame: [],
        }),
      };
      const mockImgsLink = { each: () => {} };
      const mockAudiosLink = { each: () => {} };

      const result = $azquizgame.loadDataGame(mockData, mockImgsLink, mockAudiosLink, 0);

      expect(result.modeBoard).toBe(false);
      expect(result.evaluation).toBe(false);
      expect(result.evaluationID).toBe('');
      expect(result.playerAudio).toBe('');
      expect(result.gameOver).toBe(false);
    });
  });

  describe('page lifecycle', () => {
    // The SCORM runtime owns the end of the session (pagehide / visibilitychange).
    // An activity must never finish itself when the page is hidden: a learner who
    // navigates away, switches tab or lets the browser freeze the page mid-rosco
    // would otherwise be reported as finished with the score of the moment — a
    // fail below the threshold — and the completion flag survives in
    // cmi.suspend_data, so the attempt is closed for good.
    beforeEach(() => {
      // An earlier suite in this file removes the shared mock; rebuild the surface
      // addEvents touches. The scorm helpers are what the hide handler used to call.
      global.$exeDevices = {
        iDevice: {
          gamification: {
            scorm: { endScorm: vi.fn(), registerActivity: vi.fn() },
            media: { stopSound: vi.fn(), playSound: vi.fn() },
            helpers: { toggleFullscreen: vi.fn(), getTimeToString: vi.fn(() => '00:00') },
          },
        },
      };
    });

    afterEach(() => {
      delete global.$exeDevices;
    });

    it('does not finish a running game when the page is hidden', () => {
      document.body.innerHTML = `
        <div id="roscoMainContainer-0">
          <div id="roscoTypeGame-0"></div>
          <canvas id="roscoCanvas-0"></canvas>
        </div>
      `;
      // happy-dom has no 2D context; addEvents only needs one it can draw on.
      const getContext = vi
        .spyOn(HTMLCanvasElement.prototype, 'getContext')
        .mockReturnValue(new Proxy({}, { get: () => vi.fn() }));
      $azquizgame.options[0] = {
        isScorm: 0,
        gameStarted: true,
        gameOver: false,
        itinerary: { showCodeAccess: false },
        wordsGame: [],
        msgs: {},
        instructions: '',
        title: '',
        author: '',
        durationGame: 0,
        numberTurns: 1,
      };
      // Board drawing is not what this test is about.
      $azquizgame.drawRosco = vi.fn();
      $azquizgame.drawRows = vi.fn();
      $azquizgame.drawText = vi.fn();
      $azquizgame.gameOver = vi.fn();
      $azquizgame.sendScore = vi.fn();

      $azquizgame.addEvents(0);
      try {
        $(window).trigger('pagehide');
      } finally {
        $azquizgame.removeEvents(0);
        getContext.mockRestore();
        document.body.innerHTML = '';
      }

      expect($azquizgame.gameOver).not.toHaveBeenCalled();
      expect($azquizgame.sendScore).not.toHaveBeenCalled();
    });
  });
});
