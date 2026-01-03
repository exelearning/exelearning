/**
 * Unit tests for guess iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - clear: Cleans phrase by normalizing whitespace
 * - getShowLetter: Gets array of letter positions to show based on level
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $guess globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  // Mock $exeDevices.iDevice.gamification.colors used at load time
  global.$exeDevices = {
    iDevice: {
      gamification: {
        colors: {
          borderColors: { black: '#000', white: '#fff' },
          backColor: { black: '#000', white: '#fff' }
        }
      }
    }
  };
  let modifiedCode = code.replace(/var\s+\$guess\s*=/, 'global.$guess =');
  // Remove auto-init call: $(function () { $guess.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$guess\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$guess;
}

describe('guess iDevice export', () => {
  let $guess;

  beforeEach(() => {
    global.$guess = undefined;
    global.$exeDevices = undefined;

    const filePath = join(__dirname, 'guess.js');
    const code = readFileSync(filePath, 'utf-8');

    $guess = loadExportIdevice(code);
  });

  describe('clear', () => {
    it('trims whitespace', () => {
      expect($guess.clear('  hello  ')).toBe('hello');
    });

    it('normalizes multiple spaces to single space', () => {
      expect($guess.clear('hello   world')).toBe('hello world');
    });

    it('replaces newlines with space', () => {
      expect($guess.clear('hello\nworld')).toBe('hello world');
      expect($guess.clear('hello\r\nworld')).toBe('hello world');
    });

    it('replaces ampersands with space', () => {
      expect($guess.clear('hello&world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect($guess.clear('')).toBe('');
    });

    it('handles single word', () => {
      expect($guess.clear('hello')).toBe('hello');
    });

    it('handles mixed whitespace characters', () => {
      expect($guess.clear('hello\n\r  &  world')).toBe('hello world');
    });
  });

  describe('getShowLetter', () => {
    it('returns empty array when nivel is 0', () => {
      const result = $guess.getShowLetter('hello', 0);
      expect(result).toHaveLength(0);
    });

    it('returns array with positions when nivel > 0', () => {
      const result = $guess.getShowLetter('hello', 50);
      // 50% of 5 letters = 2 positions
      expect(result).toHaveLength(2);
    });

    it('returns array (note: sorted lexicographically due to .sort() without comparator)', () => {
      const result = $guess.getShowLetter('hello world', 50);
      // The function uses .sort() without comparator, so it sorts as strings
      // This means [10, 4, 2] becomes [10, 2, 4] (lexicographic order)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns positions within phrase length', () => {
      const phrase = 'test';
      const result = $guess.getShowLetter(phrase, 100);
      result.forEach(pos => {
        expect(pos).toBeGreaterThanOrEqual(0);
        expect(pos).toBeLessThan(phrase.length);
      });
    });

    it('returns unique positions', () => {
      const result = $guess.getShowLetter('hello world test', 75);
      const uniquePositions = new Set(result);
      expect(uniquePositions.size).toBe(result.length);
    });

    it('handles 100% level', () => {
      const phrase = 'hi';
      const result = $guess.getShowLetter(phrase, 100);
      // Should return positions for all letters
      expect(result).toHaveLength(phrase.length);
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($guess.options)).toBe(true);
    });
  });

  describe('hasSCORMbutton', () => {
    it('is initially false', () => {
      expect($guess.hasSCORMbutton).toBe(false);
    });
  });

  describe('isInExe', () => {
    it('is initially false', () => {
      expect($guess.isInExe).toBe(false);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($guess.idevicePath).toBe('');
    });
  });
});
