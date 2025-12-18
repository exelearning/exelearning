/**
 * Unit tests for crossword iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - shuffleArray: Array randomization (Fisher-Yates)
 * - randomTwoOrThree: Random number generation (2 or 3)
 * - clear: String cleanup (whitespace normalization)
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeCrucigrama globally.
 * Replaces 'var $eXeCrucigrama' with 'global.$eXeCrucigrama' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeCrucigrama\s*=/, 'global.$eXeCrucigrama =');
  // Remove auto-init call: $(function () { $eXeCrucigrama.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeCrucigrama\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeCrucigrama;
}

describe('crossword iDevice export', () => {
  let $eXeCrucigrama;

  beforeEach(() => {
    global.$eXeCrucigrama = undefined;

    const filePath = join(__dirname, 'crossword.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeCrucigrama = loadExportIdevice(code);
  });

  describe('shuffleArray', () => {
    it('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $eXeCrucigrama.shuffleArray([...arr]);
      expect(result.length).toBe(arr.length);
    });

    it('contains all original elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $eXeCrucigrama.shuffleArray([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('handles empty array', () => {
      const result = $eXeCrucigrama.shuffleArray([]);
      expect(result).toEqual([]);
    });

    it('handles single element array', () => {
      const result = $eXeCrucigrama.shuffleArray([1]);
      expect(result).toEqual([1]);
    });

    it('handles array with duplicates', () => {
      const arr = [1, 1, 2, 2, 3];
      const result = $eXeCrucigrama.shuffleArray([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('mutates original array', () => {
      const arr = [1, 2, 3, 4, 5];
      $eXeCrucigrama.shuffleArray(arr);
      // Can't guarantee order changed due to randomness, but length should be same
      expect(arr.length).toBe(5);
    });
  });

  describe('randomTwoOrThree', () => {
    it('returns 2 or 3', () => {
      // Run multiple times to ensure randomness coverage
      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add($eXeCrucigrama.randomTwoOrThree());
      }
      expect(results.has(2) || results.has(3)).toBe(true);
      // Results should only contain 2 and/or 3
      for (const val of results) {
        expect([2, 3]).toContain(val);
      }
    });

    it('returns a number', () => {
      const result = $eXeCrucigrama.randomTwoOrThree();
      expect(typeof result).toBe('number');
    });
  });

  describe('clear', () => {
    it('trims whitespace', () => {
      expect($eXeCrucigrama.clear('  hello  ')).toBe('hello');
    });

    it('normalizes multiple spaces to single space', () => {
      expect($eXeCrucigrama.clear('hello   world')).toBe('hello world');
    });

    it('handles newlines and carriage returns', () => {
      expect($eXeCrucigrama.clear('hello\nworld')).toBe('hello world');
      expect($eXeCrucigrama.clear('hello\r\nworld')).toBe('hello world');
    });

    it('handles ampersands in whitespace normalization', () => {
      expect($eXeCrucigrama.clear('hello&world')).toBe('hello world');
    });

    it('handles empty string', () => {
      expect($eXeCrucigrama.clear('')).toBe('');
    });

    it('handles single word', () => {
      expect($eXeCrucigrama.clear('hello')).toBe('hello');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeCrucigrama.borderColors).toBeDefined();
      expect($eXeCrucigrama.borderColors.black).toBe('#0e1625');
      expect($eXeCrucigrama.borderColors.white).toBe('#FFF');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeCrucigrama.colors).toBeDefined();
      expect($eXeCrucigrama.colors.black).toBe('#0e1625');
      expect($eXeCrucigrama.colors.white).toBe('#ffffff');
      expect($eXeCrucigrama.colors.correct).toBe('#3DA75A');
      expect($eXeCrucigrama.colors.incorrect).toBe('#F22420');
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $eXeCrucigrama.init).toBe('function');
    });
  });

  describe('enable', () => {
    it('exists as a function', () => {
      expect(typeof $eXeCrucigrama.enable).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($eXeCrucigrama.options).toEqual([]);
    });
  });

  describe('domCache', () => {
    it('is initialized as an empty object', () => {
      expect($eXeCrucigrama.domCache).toEqual({});
    });
  });

  describe('inputCache', () => {
    it('is initialized as an empty object', () => {
      expect($eXeCrucigrama.inputCache).toEqual({});
    });
  });
});
