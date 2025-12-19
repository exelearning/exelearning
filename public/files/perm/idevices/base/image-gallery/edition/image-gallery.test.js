/**
 * Unit tests for image-gallery iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getLicenseValue: License title to value conversion
 * - getLicenseTitle: License value to title conversion
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

describe('image-gallery iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'image-gallery.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('getLicenseValue', () => {
    it('converts CC0 title to value', () => {
      const title = 'Creative Commons (Public Domain)';
      const result = $exeDevice.getLicenseValue(title);
      expect(result).toBe('CC0');
    });

    it('converts CC-BY title to value', () => {
      const result = $exeDevice.getLicenseValue('Creative Commons BY');
      expect(result).toBe('CC-BY');
    });

    it('converts CC-BY-SA title to value', () => {
      const result = $exeDevice.getLicenseValue('Creative Commons BY-SA');
      expect(result).toBe('CC-BY-SA');
    });

    it('converts CC-BY-ND title to value', () => {
      const result = $exeDevice.getLicenseValue('Creative Commons BY-ND');
      expect(result).toBe('CC-BY-ND');
    });

    it('converts CC-BY-NC title to value', () => {
      const result = $exeDevice.getLicenseValue('Creative Commons BY-NC');
      expect(result).toBe('CC-BY-NC');
    });

    it('converts CC-BY-NC-SA title to value', () => {
      const result = $exeDevice.getLicenseValue('Creative Commons BY-NC-SA');
      expect(result).toBe('CC-BY-NC-SA');
    });

    it('converts CC-BY-NC-ND title to value', () => {
      const result = $exeDevice.getLicenseValue('Creative Commons BY-NC-ND');
      expect(result).toBe('CC-BY-NC-ND');
    });

    it('converts Copyright title to value', () => {
      const title = 'Copyright (All Rights Reserved)';
      const result = $exeDevice.getLicenseValue(title);
      expect(result).toBe('All Rights Reserved');
    });

    it('returns original value for unknown license', () => {
      const result = $exeDevice.getLicenseValue('Unknown License');
      expect(result).toBe('Unknown License');
    });
  });

  describe('getLicenseTitle', () => {
    it('converts CC0 value to title', () => {
      const result = $exeDevice.getLicenseTitle('CC0');
      expect(result).toBe('Creative Commons (Public Domain)');
    });

    it('converts CC-BY value to title', () => {
      const result = $exeDevice.getLicenseTitle('CC-BY');
      expect(result).toBe('Creative Commons BY');
    });

    it('converts CC-BY-SA value to title', () => {
      const result = $exeDevice.getLicenseTitle('CC-BY-SA');
      expect(result).toBe('Creative Commons BY-SA');
    });

    it('converts CC-BY-ND value to title', () => {
      const result = $exeDevice.getLicenseTitle('CC-BY-ND');
      expect(result).toBe('Creative Commons BY-ND');
    });

    it('converts CC-BY-NC value to title', () => {
      const result = $exeDevice.getLicenseTitle('CC-BY-NC');
      expect(result).toBe('Creative Commons BY-NC');
    });

    it('converts CC-BY-NC-SA value to title', () => {
      const result = $exeDevice.getLicenseTitle('CC-BY-NC-SA');
      expect(result).toBe('Creative Commons BY-NC-SA');
    });

    it('converts CC-BY-NC-ND value to title', () => {
      const result = $exeDevice.getLicenseTitle('CC-BY-NC-ND');
      expect(result).toBe('Creative Commons BY-NC-ND');
    });

    it('converts All Rights Reserved value to title', () => {
      const result = $exeDevice.getLicenseTitle('All Rights Reserved');
      expect(result).toBe('Copyright (All Rights Reserved)');
    });

    it('returns original value for unknown license', () => {
      const result = $exeDevice.getLicenseTitle('Unknown');
      expect(result).toBe('Unknown');
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });
  });

  describe('checkFormValues', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.checkFormValues).toBe('function');
    });
  });

  describe('getDataJson', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.getDataJson).toBe('function');
    });
  });
});
