/**
 * Unit tests for hidden-image iDevice (export/runtime)
 *
 * Tests pure functions and configuration:
 * - borderColors: Color definitions
 * - options: Initial state
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeHiddenImage globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeHiddenImage\s*=/, 'global.$eXeHiddenImage =');
  // Remove auto-init call: $(function () { $eXeHiddenImage.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeHiddenImage\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeHiddenImage;
}

describe('hidden-image iDevice export', () => {
  let $eXeHiddenImage;

  beforeEach(() => {
    global.$eXeHiddenImage = undefined;

    const filePath = join(__dirname, 'hidden-image.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeHiddenImage = loadExportIdevice(code);
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeHiddenImage.borderColors).toBeDefined();
      expect($eXeHiddenImage.borderColors.black).toBe('#1c1b1b');
      expect($eXeHiddenImage.borderColors.blue).toBe('#5877c6');
      expect($eXeHiddenImage.borderColors.green).toBe('#137575');
      expect($eXeHiddenImage.borderColors.red).toBe('#b3092f');
      expect($eXeHiddenImage.borderColors.white).toBe('#f9f9f9');
      expect($eXeHiddenImage.borderColors.yellow).toBe('#f3d55a');
    });

    it('has grey color', () => {
      expect($eXeHiddenImage.borderColors.grey).toBe('#777777');
    });

    it('has incorrect color', () => {
      expect($eXeHiddenImage.borderColors.incorrect).toBe('#d9d9d9');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeHiddenImage.colors).toBeDefined();
    });
  });

  describe('options', () => {
    it('is defined', () => {
      expect($eXeHiddenImage.options).toBeDefined();
    });
  });

  describe('hasSCORMbutton', () => {
    it('is initially false', () => {
      expect($eXeHiddenImage.hasSCORMbutton).toBe(false);
    });
  });

  describe('isInExe', () => {
    it('is initially false', () => {
      expect($eXeHiddenImage.isInExe).toBe(false);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.idevicePath).toBe('');
    });
  });

  describe('userName', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.userName).toBe('');
    });
  });

  describe('previousScore', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.previousScore).toBe('');
    });
  });

  describe('initialScore', () => {
    it('is initially empty', () => {
      expect($eXeHiddenImage.initialScore).toBe('');
    });
  });
});
