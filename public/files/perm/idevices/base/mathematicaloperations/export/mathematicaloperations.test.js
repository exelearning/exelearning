/**
 * Unit tests for mathematicaloperations iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getRandomNo: Generates random numbers
 * - reduceDecimals: Reduces decimal places
 * - removeUnnecessaryDecimals: Removes trailing zeros
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeMathOperations globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeMathOperations\s*=/, 'global.$eXeMathOperations =');
  // Remove auto-init call: $(function () { $eXeMathOperations.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeMathOperations\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeMathOperations;
}

describe('mathematicaloperations iDevice export', () => {
  let $eXeMathOperations;

  beforeEach(() => {
    global.$eXeMathOperations = undefined;

    const filePath = join(__dirname, 'mathematicaloperations.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeMathOperations = loadExportIdevice(code);
  });

  describe('getRandomNo', () => {
    it('returns integer when allowDecimals is 0', () => {
      for (let i = 0; i < 10; i++) {
        const result = $eXeMathOperations.getRandomNo(0, 100, 0);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(100);
      }
    });

    it('returns decimal when allowDecimals is non-zero', () => {
      const result = $eXeMathOperations.getRandomNo(0, 10, 2);
      expect(typeof result).toBe('number');
    });

    it('respects from parameter', () => {
      for (let i = 0; i < 10; i++) {
        const result = $eXeMathOperations.getRandomNo(5, 10, 0);
        expect(result).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('reduceDecimals', () => {
    it('reduces number to at most 2 decimals', () => {
      expect($eXeMathOperations.reduceDecimals(1.2345)).toBe('1.23');
    });

    it('removes trailing zeros', () => {
      expect($eXeMathOperations.reduceDecimals(1.10)).toBe('1.1');
      expect($eXeMathOperations.reduceDecimals(1.00)).toBe('1');
    });

    it('handles integers', () => {
      expect($eXeMathOperations.reduceDecimals(5)).toBe('5');
    });

    it('handles string input', () => {
      expect($eXeMathOperations.reduceDecimals('1.2345')).toBe('1.23');
    });

    it('returns NaN string for non-numeric string', () => {
      // parseFloat('abc') = NaN, then toFixed(2) returns 'NaN' string
      expect($eXeMathOperations.reduceDecimals('abc')).toBe('NaN');
    });

    it('returns NaN value for null', () => {
      // null is not a string and not a valid number
      const result = $eXeMathOperations.reduceDecimals(null);
      expect(Number.isNaN(result)).toBe(true);
    });
  });

  describe('removeUnnecessaryDecimals', () => {
    it('removes .00 suffix', () => {
      expect($eXeMathOperations.removeUnnecessaryDecimals(5, true)).toBe('5');
    });

    it('removes trailing zero after decimal', () => {
      expect($eXeMathOperations.removeUnnecessaryDecimals(1.10, true)).toBe('1.1');
    });

    it('keeps necessary decimals', () => {
      expect($eXeMathOperations.removeUnnecessaryDecimals(1.23, true)).toBe('1.23');
    });

    it('handles fix=false', () => {
      const result = $eXeMathOperations.removeUnnecessaryDecimals(5, false);
      expect(result).toBe('5');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeMathOperations.borderColors).toBeDefined();
      expect($eXeMathOperations.borderColors.black).toBe('#1c1b1b');
      expect($eXeMathOperations.borderColors.blue).toBe('#5877c6');
      expect($eXeMathOperations.borderColors.green).toBe('#00a300');
      expect($eXeMathOperations.borderColors.red).toBe('#b3092f');
      expect($eXeMathOperations.borderColors.white).toBe('#ffffff');
      expect($eXeMathOperations.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($eXeMathOperations.options)).toBe(true);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeMathOperations.idevicePath).toBe('');
    });
  });
});
