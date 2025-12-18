/**
 * Unit tests for classify iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - hexToRgba: Hex to RGBA color conversion with alpha parameter
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeClasifica globally.
 * Replaces 'var $eXeClasifica' with 'global.$eXeClasifica' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeClasifica\s*=/, 'global.$eXeClasifica =');
  // Remove auto-init call: $(function () { $eXeClasifica.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeClasifica\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeClasifica;
}

describe('classify iDevice export', () => {
  let $eXeClasifica;

  beforeEach(() => {
    global.$eXeClasifica = undefined;

    const filePath = join(__dirname, 'classify.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeClasifica = loadExportIdevice(code);
  });

  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba with default alpha 1', () => {
      expect($eXeClasifica.hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('converts 6-digit hex to rgba with custom alpha', () => {
      expect($eXeClasifica.hexToRgba('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });

    it('converts 3-digit hex to rgba', () => {
      expect($eXeClasifica.hexToRgba('#fff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('converts 3-digit hex to rgba with custom alpha', () => {
      expect($eXeClasifica.hexToRgba('#fff', 0.7)).toBe('rgba(255, 255, 255, 0.7)');
    });

    it('converts black hex to rgba', () => {
      expect($eXeClasifica.hexToRgba('#000000')).toBe('rgba(0, 0, 0, 1)');
    });

    it('converts color hex to rgba', () => {
      expect($eXeClasifica.hexToRgba('#ff0000')).toBe('rgba(255, 0, 0, 1)');
      expect($eXeClasifica.hexToRgba('#00ff00')).toBe('rgba(0, 255, 0, 1)');
      expect($eXeClasifica.hexToRgba('#0000ff')).toBe('rgba(0, 0, 255, 1)');
    });

    it('handles hex without hash prefix', () => {
      expect($eXeClasifica.hexToRgba('ffffff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('handles 3-digit hex without hash', () => {
      expect($eXeClasifica.hexToRgba('fff')).toBe('rgba(255, 255, 255, 1)');
    });

    it('returns fallback for invalid hex', () => {
      expect($eXeClasifica.hexToRgba('gggggg')).toBe('rgba(255,255,255,1)');
      expect($eXeClasifica.hexToRgba('#zzzzzz')).toBe('rgba(255,255,255,1)');
    });

    it('returns fallback for empty string', () => {
      expect($eXeClasifica.hexToRgba('')).toBe('rgba(255,255,255,1)');
    });

    it('returns fallback for non-string input', () => {
      expect($eXeClasifica.hexToRgba(null)).toBe('rgba(255,255,255,1)');
      expect($eXeClasifica.hexToRgba(undefined)).toBe('rgba(255,255,255,1)');
    });

    it('handles rgba input passthrough', () => {
      expect($eXeClasifica.hexToRgba('rgba(100, 150, 200, 0.8)')).toBe('rgba(100, 150, 200, 0.8)');
    });

    it('handles rgb input with alpha injection', () => {
      expect($eXeClasifica.hexToRgba('rgb(100, 150, 200)', 0.5)).toBe('rgba(100, 150, 200, 0.5)');
    });

    it('clamps alpha to valid range', () => {
      expect($eXeClasifica.hexToRgba('#ffffff', 2)).toBe('rgba(255, 255, 255, 1)');
      expect($eXeClasifica.hexToRgba('#ffffff', -1)).toBe('rgba(255, 255, 255, 0)');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeClasifica.borderColors).toBeDefined();
      expect($eXeClasifica.borderColors.black).toBe('#1c1b1b');
      expect($eXeClasifica.borderColors.white).toBe('#ffffff');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeClasifica.colors).toBeDefined();
      expect($eXeClasifica.colors.black).toBe('#1c1b1b');
      expect($eXeClasifica.colors.white).toBe('#ffffff');
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $eXeClasifica.init).toBe('function');
    });
  });

  describe('enable', () => {
    it('exists as a function', () => {
      expect(typeof $eXeClasifica.enable).toBe('function');
    });
  });

  describe('options', () => {
    it('is initialized as an empty array', () => {
      expect($eXeClasifica.options).toEqual([]);
    });
  });
});
