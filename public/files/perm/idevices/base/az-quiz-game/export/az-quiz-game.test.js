/**
 * Unit tests for az-quiz-game iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getRealLetter: Converts 0/1 codes to L·L/SS special characters
 * - getCaracterLetter: Converts L·L/SS special characters to 0/1 codes
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $azquizgame globally.
 * Replaces 'var $azquizgame' with 'global.$azquizgame' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$azquizgame\s*=/, 'global.$azquizgame =');
  // Remove auto-init call: $(function () { $azquizgame.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$azquizgame\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$azquizgame;
}

describe('az-quiz-game iDevice export', () => {
  let $azquizgame;

  beforeEach(() => {
    global.$azquizgame = undefined;

    const filePath = join(__dirname, 'az-quiz-game.js');
    const code = readFileSync(filePath, 'utf-8');

    $azquizgame = loadExportIdevice(code);
  });

  describe('getRealLetter', () => {
    it('converts 0 to L·L', () => {
      expect($azquizgame.getRealLetter('0')).toBe('L·L');
    });

    it('converts 1 to SS', () => {
      expect($azquizgame.getRealLetter('1')).toBe('SS');
    });

    it('returns regular letter unchanged', () => {
      expect($azquizgame.getRealLetter('A')).toBe('A');
      expect($azquizgame.getRealLetter('Z')).toBe('Z');
      expect($azquizgame.getRealLetter('Ñ')).toBe('Ñ');
    });

    it('returns empty string unchanged', () => {
      expect($azquizgame.getRealLetter('')).toBe('');
    });
  });

  describe('getCaracterLetter', () => {
    it('converts L·L to 0', () => {
      expect($azquizgame.getCaracterLetter('L·L')).toBe('0');
    });

    it('converts SS to 1', () => {
      expect($azquizgame.getCaracterLetter('SS')).toBe('1');
    });

    it('returns regular letter unchanged', () => {
      expect($azquizgame.getCaracterLetter('A')).toBe('A');
      expect($azquizgame.getCaracterLetter('Z')).toBe('Z');
      expect($azquizgame.getCaracterLetter('Ñ')).toBe('Ñ');
    });

    it('returns empty string unchanged', () => {
      expect($azquizgame.getCaracterLetter('')).toBe('');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($azquizgame.colors).toBeDefined();
      expect($azquizgame.colors.black).toBe('#f9f9f9');
      expect($azquizgame.colors.white).toBe('#ffffff');
      expect($azquizgame.colors.blue).toBe('#5877c6');
      expect($azquizgame.colors.green).toBe('#00a300');
      expect($azquizgame.colors.red).toBe('#b3092f');
      expect($azquizgame.colors.yellow).toBe('#f3d55a');
    });
  });

  describe('mcanvas', () => {
    it('has default canvas dimensions', () => {
      expect($azquizgame.mcanvas).toBeDefined();
      expect($azquizgame.mcanvas.width).toBe(360);
      expect($azquizgame.mcanvas.height).toBe(360);
    });
  });

  describe('radiusLetter', () => {
    it('has default radius value', () => {
      expect($azquizgame.radiusLetter).toBe(16);
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $azquizgame.init).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($azquizgame.options).toEqual([]);
    });
  });
});
