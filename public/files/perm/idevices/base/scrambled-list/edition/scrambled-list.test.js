/**
 * Unit tests for scrambled-list iDevice
 *
 * Tests pure functions and data structures:
 * - checkValues: Data validation
 * - dataJson: JSON data structure
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

describe('scrambled-list iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'scrambled-list.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('name', () => {
    it('has name defined', () => {
      expect($exeDevice.name).toBeDefined();
    });
  });

  describe('checkValues', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.checkValues).toBe('function');
    });
  });

  describe('dataJson', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.dataJson).toBe('function');
    });
  });

  describe('addQuestions', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.addQuestions).toBe('function');
    });
  });

  describe('sanitization helpers', () => {
    it('getSanitizeText falls back to global-style text sanitization when common sanitizer is unavailable', () => {
      const original = global.$exeDevicesEdition;
      const originalPurify = global.DOMPurify;
      global.$exeDevicesEdition = undefined;
      global.DOMPurify = undefined;

      try {
        const sanitizeText = $exeDevice.getSanitizeText();
        expect(sanitizeText('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
      } finally {
        global.$exeDevicesEdition = original;
        global.DOMPurify = originalPurify;
      }
    });

    it('getSanitizeText uses DOMPurify profile and returns plain text when available', () => {
      const original = global.$exeDevicesEdition;
      const originalPurify = global.DOMPurify;
      const domPurifyCalls = [];
      global.$exeDevicesEdition = undefined;
      global.DOMPurify = {
        sanitize(input, config) {
          domPurifyCalls.push({ input, config });
          return '<strong>Sanitized</strong>';
        },
      };

      try {
        const sanitizeText = $exeDevice.getSanitizeText();
        expect(sanitizeText('<p>Hello <strong>World</strong></p>')).toBe('Sanitized');
        expect(domPurifyCalls).toHaveLength(1);
        expect(domPurifyCalls[0].config).toEqual({
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true,
        });
      } finally {
        global.$exeDevicesEdition = original;
        global.DOMPurify = originalPurify;
      }
    });

    it('getSanitizeHtml falls back to sanitizeText behavior when DOMPurify is unavailable', () => {
      const original = global.$exeDevicesEdition;
      const originalPurify = global.DOMPurify;
      global.$exeDevicesEdition = undefined;
      global.DOMPurify = undefined;

      try {
        const sanitizeHtml = $exeDevice.getSanitizeHtml();
        expect(sanitizeHtml('<p>Safe</p><script>alert(1)</script>')).toBe('Safealert(1)');
      } finally {
        global.$exeDevicesEdition = original;
        global.DOMPurify = originalPurify;
      }
    });

    it('getSanitizeHtml uses DOMPurify html profile and override merge when available', () => {
      const original = global.$exeDevicesEdition;
      const originalPurify = global.DOMPurify;
      const domPurifyCalls = [];
      global.$exeDevicesEdition = undefined;
      global.DOMPurify = {
        sanitize(input, config) {
          domPurifyCalls.push({ input, config });
          return 'sanitized-html';
        },
      };

      try {
        const sanitizeHtml = $exeDevice.getSanitizeHtml();
        const result = sanitizeHtml('<p>Safe</p><script>alert(1)</script>', {
          FORBID_TAGS: ['script', 'style', 'video'],
          ALLOW_DATA_ATTR: true,
        });

        expect(result).toBe('sanitized-html');
        expect(domPurifyCalls).toHaveLength(1);
        expect(domPurifyCalls[0].config).toEqual({
          USE_PROFILES: { html: true },
          FORBID_TAGS: ['script', 'style', 'video'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
          ALLOW_DATA_ATTR: true,
        });
      } finally {
        global.$exeDevicesEdition = original;
        global.DOMPurify = originalPurify;
      }
    });

    it('escapeAttribute escapes HTML-sensitive characters', () => {
      expect($exeDevice.escapeAttribute('"<tag>&')).toBe('&quot;&lt;tag&gt;&amp;');
    });
  });
});
