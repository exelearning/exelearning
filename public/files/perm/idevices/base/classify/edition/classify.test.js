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

    it('returns false for group number > 3', () => {
      const result = $exeDevice.validateGroups(['0#item1', '4#item2']);
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
});
