/**
 * Unit tests for mathematicaloperations iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - onlyNumbers: Input filtering for numbers only
 * - onlyNumbers1: Alternative number filtering
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
  return global.$exeDevice;
}

describe('mathematicaloperations iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'mathematicaloperations.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('onlyNumbers', () => {
    it('removes non-numeric characters from input', () => {
      const mockInput = { value: 'abc123def456' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('123456');
    });

    it('keeps only digits', () => {
      const mockInput = { value: '12.34' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('1234');
    });

    it('handles empty input', () => {
      const mockInput = { value: '' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('');
    });

    it('handles input with only numbers', () => {
      const mockInput = { value: '12345' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('12345');
    });

    it('handles input with only non-numeric characters', () => {
      const mockInput = { value: 'abcdef' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('');
    });

    it('removes spaces', () => {
      const mockInput = { value: '1 2 3' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('123');
    });

    it('removes special characters', () => {
      const mockInput = { value: '1@2#3$4%5' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('12345');
    });

    it('removes negative sign', () => {
      const mockInput = { value: '-123' };
      $exeDevice.onlyNumbers(mockInput);
      expect(mockInput.value).toBe('123');
    });
  });

  describe('onlyNumbers1', () => {
    it('removes last character if not a number', () => {
      const mockInput = { value: '123a' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('123');
    });

    it('keeps value unchanged if last character is a number', () => {
      const mockInput = { value: '1234' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('1234');
    });

    it('handles empty string', () => {
      const mockInput = { value: '' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('');
    });

    it('removes special characters at end', () => {
      const mockInput = { value: '123!' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('123');
    });

    it('removes space at end', () => {
      const mockInput = { value: '123 ' };
      $exeDevice.onlyNumbers1(mockInput);
      expect(mockInput.value).toBe('123');
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

  describe('defaultSettings', () => {
    it('has correct default settings structure', () => {
      expect($exeDevice.defaultSettings).toEqual({
        modo: 0,
        type: 'result',
        number: 10,
        operations: '1111',
        min: -1000,
        max: 1000,
        decimalsInOperands: 0,
        decimalsInResults: 1,
        negative: 1,
        zero: 1,
      });
    });
  });

  describe('i18n', () => {
    it('has category and name defined', () => {
      expect($exeDevice.i18n).toBeDefined();
      expect($exeDevice.i18n.category).toBeDefined();
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });
});
