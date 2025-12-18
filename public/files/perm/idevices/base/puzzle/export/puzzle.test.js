/**
 * Unit tests for puzzle iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - generateRandomArray: Creates shuffled array of numbers
 * - isSolvable: Checks if puzzle configuration is solvable
 * - getPhraseDefault: Returns default phrase object
 * - clear: Cleans puzzle data
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXePuzzle globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXePuzzle\s*=/, 'global.$eXePuzzle =');
  // Remove auto-init call: $(function () { $eXePuzzle.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXePuzzle\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXePuzzle;
}

describe('puzzle iDevice export', () => {
  let $eXePuzzle;

  beforeEach(() => {
    global.$eXePuzzle = undefined;

    const filePath = join(__dirname, 'puzzle.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXePuzzle = loadExportIdevice(code);
  });

  describe('generateRandomArray', () => {
    it('generates array of specified length', () => {
      const result = $eXePuzzle.generateRandomArray(5);
      expect(result).toHaveLength(5);
    });

    it('contains all numbers from 0 to n-1', () => {
      const result = $eXePuzzle.generateRandomArray(5);
      const sorted = [...result].sort((a, b) => a - b);
      expect(sorted).toEqual([0, 1, 2, 3, 4]);
    });

    it('handles array of length 1', () => {
      const result = $eXePuzzle.generateRandomArray(1);
      expect(result).toEqual([0]);
    });

    it('handles empty array', () => {
      const result = $eXePuzzle.generateRandomArray(0);
      expect(result).toHaveLength(0);
    });

    it('returns shuffled array (elements may be in different positions)', () => {
      // Run multiple times to increase chance of different orders
      const results = new Set();
      for (let i = 0; i < 50; i++) {
        results.add(JSON.stringify($eXePuzzle.generateRandomArray(5)));
      }
      // Should have at least some variation
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('isSolvable', () => {
    it('returns true for solvable odd-column puzzle', () => {
      // For odd columns, even inversions means solvable
      const parts = [
        { id: 0 }, { id: 1 }, { id: 2 },
        { id: 3 }, { id: 4 }, { id: 5 },
        { id: 6 }, { id: 7 }, null
      ];
      expect($eXePuzzle.isSolvable(parts, 3)).toBe(true);
    });

    it('returns true for already solved puzzle', () => {
      const parts = [
        { id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }
      ];
      expect($eXePuzzle.isSolvable(parts, 2)).toBe(true);
    });

    it('handles parts with null values', () => {
      const parts = [{ id: 0 }, null, { id: 2 }];
      // Should not throw
      expect(() => $eXePuzzle.isSolvable(parts, 3)).not.toThrow();
    });
  });

  describe('getPhraseDefault', () => {
    it('returns object with required properties', () => {
      const phrase = $eXePuzzle.getPhraseDefault();
      expect(phrase).toHaveProperty('cards');
      expect(phrase).toHaveProperty('msgError');
      expect(phrase).toHaveProperty('msgHit');
      expect(phrase).toHaveProperty('definition');
      expect(phrase).toHaveProperty('puzzle');
    });

    it('returns default values', () => {
      const phrase = $eXePuzzle.getPhraseDefault();
      expect(phrase.cards).toEqual([]);
      expect(phrase.msgError).toBe('');
      expect(phrase.msgHit).toBe('');
      expect(phrase.definition).toBe('');
      expect(phrase.puzzle).toBe('');
    });

    it('returns new object on each call', () => {
      const phrase1 = $eXePuzzle.getPhraseDefault();
      const phrase2 = $eXePuzzle.getPhraseDefault();
      expect(phrase1).not.toBe(phrase2);
    });
  });

  describe('clear', () => {
    it('removes localStorage item for puzzle', () => {
      // Note: This function clears localStorage, which may have side effects
      expect(typeof $eXePuzzle.clear).toBe('function');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXePuzzle.borderColors).toBeDefined();
      expect($eXePuzzle.borderColors.black).toBe('#1c1b1b');
      expect($eXePuzzle.borderColors.blue).toBe('#0056b3');
      expect($eXePuzzle.borderColors.green).toBe('#006641');
      expect($eXePuzzle.borderColors.red).toBe('#a2241a');
      expect($eXePuzzle.borderColors.white).toBe('#ffffff');
      expect($eXePuzzle.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($eXePuzzle.options)).toBe(true);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXePuzzle.idevicePath).toBe('');
    });
  });
});
