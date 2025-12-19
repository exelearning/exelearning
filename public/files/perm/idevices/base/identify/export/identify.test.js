/**
 * Unit tests for identify iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - checkWord: Compares words with normalization and pipe alternatives
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeIdentifica globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeIdentifica\s*=/, 'global.$eXeIdentifica =');
  // Remove auto-init call: $(function () { $eXeIdentifica.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeIdentifica\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeIdentifica;
}

describe('identify iDevice export', () => {
  let $eXeIdentifica;

  beforeEach(() => {
    global.$eXeIdentifica = undefined;

    const filePath = join(__dirname, 'identify.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeIdentifica = loadExportIdevice(code);
  });

  describe('checkWord', () => {
    it('returns true for identical words', () => {
      expect($eXeIdentifica.checkWord('hello', 'hello')).toBe(true);
    });

    it('is case insensitive', () => {
      expect($eXeIdentifica.checkWord('Hello', 'HELLO')).toBe(true);
      expect($eXeIdentifica.checkWord('WORLD', 'world')).toBe(true);
    });

    it('trims whitespace', () => {
      expect($eXeIdentifica.checkWord('  hello  ', 'hello')).toBe(true);
    });

    it('normalizes multiple spaces', () => {
      expect($eXeIdentifica.checkWord('hello   world', 'hello world')).toBe(true);
    });

    it('removes trailing punctuation', () => {
      expect($eXeIdentifica.checkWord('hello.', 'hello')).toBe(true);
      expect($eXeIdentifica.checkWord('hello,', 'hello')).toBe(true);
      expect($eXeIdentifica.checkWord('hello;', 'hello')).toBe(true);
    });

    it('returns false for different words', () => {
      expect($eXeIdentifica.checkWord('hello', 'world')).toBe(false);
    });

    it('handles pipe-separated alternatives', () => {
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'cat')).toBe(true);
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'dog')).toBe(true);
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'bird')).toBe(true);
      expect($eXeIdentifica.checkWord('cat|dog|bird', 'fish')).toBe(false);
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeIdentifica.borderColors).toBeDefined();
      expect($eXeIdentifica.borderColors.black).toBe('#1c1b1b');
      expect($eXeIdentifica.borderColors.blue).toBe('#45085f');
      expect($eXeIdentifica.borderColors.green).toBe('#00a300');
      expect($eXeIdentifica.borderColors.red).toBe('#b3092f');
      expect($eXeIdentifica.borderColors.white).toBe('#f9f9f9');
      expect($eXeIdentifica.borderColors.yellow).toBe('#f3d55a');
      expect($eXeIdentifica.borderColors.grey).toBe('#777777');
    });
  });

  describe('options', () => {
    it('is defined', () => {
      expect($eXeIdentifica.options).toBeDefined();
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeIdentifica.idevicePath).toBe('');
    });
  });
});
