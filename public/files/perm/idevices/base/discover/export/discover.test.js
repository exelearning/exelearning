/**
 * Unit tests for discover iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - hexToRgba: Hex to RGBA color conversion
 * - clear: String cleanup (whitespace normalization)
 * - createCardsData: Card data structure creation
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeDescubre globally.
 * Replaces 'var $eXeDescubre' with 'global.$eXeDescubre' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeDescubre\s*=/, 'global.$eXeDescubre =');
  // Remove auto-init call: $(function () { $eXeDescubre.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeDescubre\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeDescubre;
}

describe('discover iDevice export', () => {
  let $eXeDescubre;

  beforeEach(() => {
    global.$eXeDescubre = undefined;

    const filePath = join(__dirname, 'discover.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeDescubre = loadExportIdevice(code);
  });

  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba with 0.7 opacity', () => {
      expect($eXeDescubre.hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('converts 3-digit hex to rgba', () => {
      expect($eXeDescubre.hexToRgba('#fff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('converts black hex to rgba', () => {
      expect($eXeDescubre.hexToRgba('#000000')).toBe('rgba(0, 0, 0, 0.7)');
    });

    it('converts color hex to rgba', () => {
      expect($eXeDescubre.hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 0.7)');
      expect($eXeDescubre.hexToRgba('#00ff00')).toBe('rgba(0, 255, 0, 0.7)');
      expect($eXeDescubre.hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 0.7)');
    });

    it('handles hex without hash prefix', () => {
      expect($eXeDescubre.hexToRgba('ffffff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('handles 3-digit hex without hash', () => {
      expect($eXeDescubre.hexToRgba('fff')).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('throws error for invalid hex', () => {
      expect(() => $eXeDescubre.hexToRgba('gggggg')).toThrow();
      expect(() => $eXeDescubre.hexToRgba('#zzzzzz')).toThrow();
    });
  });

  describe('clear', () => {
    it('trims whitespace', () => {
      expect($eXeDescubre.clear('  hello  ')).toBe('hello');
    });

    it('normalizes multiple spaces to single space', () => {
      expect($eXeDescubre.clear('hello   world')).toBe('hello world');
    });

    it('handles newlines and carriage returns', () => {
      expect($eXeDescubre.clear('hello\nworld')).toBe('hello world');
      expect($eXeDescubre.clear('hello\r\nworld')).toBe('hello world');
    });

    it('handles ampersands in whitespace normalization', () => {
      expect($eXeDescubre.clear('hello&world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect($eXeDescubre.clear('')).toBe('');
    });

    it('handles single word', () => {
      expect($eXeDescubre.clear('hello')).toBe('hello');
    });
  });

  describe('createCardsData', () => {
    describe('gameMode 0 (pairs)', () => {
      it('creates card pairs from wordsGame array', () => {
        const wordsGame = [
          {
            data: [
              { url: 'img1.jpg', eText: 'Text1', audio: '', x: 0, y: 0, alt: 'Alt1', color: '#000', backcolor: '#fff' },
              { url: 'img2.jpg', eText: 'Text2', audio: '', x: 0, y: 0, alt: 'Alt2', color: '#000', backcolor: '#fff' },
            ],
          },
        ];

        const result = $eXeDescubre.createCardsData(wordsGame, 0);

        expect(result.length).toBe(2);
        expect(result[0].url).toBe('img1.jpg');
        expect(result[0].eText).toBe('Text1');
        expect(result[1].url).toBe('img2.jpg');
        expect(result[1].eText).toBe('Text2');
      });

      it('sets correct property on first card of each pair', () => {
        const wordsGame = [
          {
            data: [
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
            ],
          },
        ];

        const result = $eXeDescubre.createCardsData(wordsGame, 0);
        expect(result[0].correct).toBe(0);
      });

      it('assigns number property correctly', () => {
        const wordsGame = [
          {
            data: [
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
            ],
          },
          {
            data: [
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
              { url: '', eText: '', audio: '', x: 0, y: 0, alt: '', color: '', backcolor: '' },
            ],
          },
        ];

        const result = $eXeDescubre.createCardsData(wordsGame, 0);
        expect(result[0].number).toBe(0);
        expect(result[1].number).toBe(0);
        expect(result[2].number).toBe(1);
        expect(result[3].number).toBe(1);
      });
    });

    it('handles empty wordsGame array', () => {
      const result = $eXeDescubre.createCardsData([], 0);
      expect(result).toEqual([]);
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeDescubre.borderColors).toBeDefined();
      expect($eXeDescubre.borderColors.black).toBe('#1c1b1b');
      expect($eXeDescubre.borderColors.white).toBe('#ffffff');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeDescubre.colors).toBeDefined();
      expect($eXeDescubre.colors.black).toBe('#1c1b1b');
      expect($eXeDescubre.colors.white).toBe('#ffffff');
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $eXeDescubre.init).toBe('function');
    });
  });

  describe('enable', () => {
    it('exists as a function', () => {
      expect(typeof $eXeDescubre.enable).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($eXeDescubre.options).toEqual([]);
    });
  });

  describe('completion when all groups are discovered', () => {
    beforeEach(() => {
      vi.spyOn($eXeDescubre, 'updateCovers').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'showMessage').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'getMessageAnswer').mockReturnValue('');
      vi.spyOn($eXeDescubre, 'saveEvaluation').mockImplementation(() => {});
      vi.spyOn($eXeDescubre, 'gameOver').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
      document.body.innerHTML = '';
    });

    function baseOptions(overrides) {
      return {
        selecteds: [0],
        hits: 0,
        score: 0,
        attempts: 0,
        nattempts: 0,
        wordsGame: [{}],
        gameMode: 0,
        isScorm: 1,
        numberQuestions: 1,
        timeShowSolution: 1000,
        showCards: false,
        gameOver: false,
        gameActived: true,
        itinerary: { showClue: false },
        msgs: { msgCool: 'Cool', mgsAllCards: 'all' },
        ...overrides,
      };
    }

    it('marks complete BEFORE sending when the last group is discovered', () => {
      vi.useFakeTimers();
      // A single group: discovering it completes the activity.
      $eXeDescubre.options[0] = baseOptions();
      let gameOverAtSend;
      vi.spyOn($eXeDescubre, 'sendScore').mockImplementation((_auto, inst) => {
        gameOverAtSend = $eXeDescubre.options[inst].gameOver;
      });

      $eXeDescubre.correctPair(0, 0);

      expect(gameOverAtSend).toBe(true);
      // gameOver still runs after the celebration delay.
      vi.advanceTimersByTime(1000);
      expect($eXeDescubre.gameOver).toHaveBeenCalledWith(0, 0);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('stays incomplete while groups remain', () => {
      // Two groups: discovering one of them is not terminal.
      $eXeDescubre.options[0] = baseOptions({ wordsGame: [{}, {}] });
      let gameOverAtSend;
      vi.spyOn($eXeDescubre, 'sendScore').mockImplementation((_auto, inst) => {
        gameOverAtSend = $eXeDescubre.options[inst].gameOver;
      });

      $eXeDescubre.correctPair(0, 0);

      expect(gameOverAtSend).toBe(false);
      expect($eXeDescubre.gameOver).not.toHaveBeenCalled();
    });
  });
});
