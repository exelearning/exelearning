/**
 * Unit tests for crossword iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getCuestionDefault: Default question structure
 * - escapeHtml: HTML escaping
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

describe('crossword iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'crossword.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('getCuestionDefault', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();

      expect(defaultQuestion).toEqual({
        word: '',
        definition: '',
        url: '',
        audio: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
      });
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getCuestionDefault();
      const q2 = $exeDevice.getCuestionDefault();

      expect(q1).not.toBe(q2);
      q1.word = 'modified';
      expect(q2.word).toBe('');
    });

    it('has word property as empty string', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.word).toBe('');
    });

    it('has definition property as empty string', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.definition).toBe('');
    });

    it('has coordinates initialized to 0', () => {
      const defaultQuestion = $exeDevice.getCuestionDefault();
      expect(defaultQuestion.x).toBe(0);
      expect(defaultQuestion.y).toBe(0);
    });
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('&')).toBe('&amp;');
      expect($exeDevice.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('<')).toBe('&lt;');
      expect($exeDevice.escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('>')).toBe('&gt;');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('"')).toBe('&quot;');
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("'")).toBe('&#39;');
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple characters', () => {
      expect($exeDevice.escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
    });

    it('handles empty string', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });

    it('handles string with no special characters', () => {
      expect($exeDevice.escapeHtml('Hello World')).toBe('Hello World');
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

    it('returns false for wrong length', () => {
      expect($exeDevice.validTime('12:30')).toBe(false);
      expect($exeDevice.validTime('')).toBe(false);
    });
  });

  describe('i18n', () => {
    it('has category and name defined', () => {
      expect($exeDevice.i18n).toBeDefined();
      expect($exeDevice.i18n.category).toBeDefined();
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('crossword');
    });
  });
});
