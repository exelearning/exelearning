/**
 * Unit tests for scrambled-list iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - randomizeArray: Shuffles array ensuring at least one change
 * - removeTags: Removes HTML tags from string
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $scrambledlist globally.
 * Note: This file doesn't have auto-init call.
 */
function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$scrambledlist\s*=/, 'global.$scrambledlist =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$scrambledlist;
}

describe('scrambled-list iDevice export', () => {
  let $scrambledlist;

  beforeEach(() => {
    global.$scrambledlist = undefined;

    const filePath = join(__dirname, 'scrambled-list.js');
    const code = readFileSync(filePath, 'utf-8');

    $scrambledlist = loadExportIdevice(code);
  });

  describe('randomizeArray', () => {
    it('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result).toHaveLength(arr.length);
    });

    it('contains all original elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result.sort()).toEqual(arr.sort());
    });

    it('ensures at least one element changes position', () => {
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      const result = $scrambledlist.randomizeArray(arr);

      let hasChanged = false;
      for (let i = 0; i < result.length; i++) {
        if (result[i] !== original[i]) {
          hasChanged = true;
          break;
        }
      }
      expect(hasChanged).toBe(true);
    });

    it('handles array with two elements', () => {
      const arr = [1, 2];
      const result = $scrambledlist.randomizeArray([...arr]);
      expect(result).toHaveLength(2);
      expect(result.sort()).toEqual([1, 2]);
    });
  });

  describe('removeTags', () => {
    it('removes HTML tags', () => {
      expect($scrambledlist.removeTags('<p>Hello</p>')).toBe('Hello');
    });

    it('handles nested tags', () => {
      expect($scrambledlist.removeTags('<div><span>Test</span></div>')).toBe('Test');
    });

    it('handles empty string', () => {
      expect($scrambledlist.removeTags('')).toBe('');
    });

    it('handles plain text', () => {
      expect($scrambledlist.removeTags('Plain text')).toBe('Plain text');
    });

    it('handles multiple elements', () => {
      expect($scrambledlist.removeTags('<p>Hello</p><p>World</p>')).toBe('HelloWorld');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($scrambledlist.borderColors).toBeDefined();
      expect($scrambledlist.borderColors.black).toBe('#1c1b1b');
      expect($scrambledlist.borderColors.blue).toBe('#5877c6');
      expect($scrambledlist.borderColors.green).toBe('#66FF66');
      expect($scrambledlist.borderColors.red).toBe('#FF6666');
      expect($scrambledlist.borderColors.white).toBe('#f9f9f9');
      expect($scrambledlist.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('getMessages', () => {
    it('returns object with message strings', () => {
      const msgs = $scrambledlist.getMessages();
      expect(msgs).toBeDefined();
      expect(typeof msgs).toBe('object');
    });
  });
});
