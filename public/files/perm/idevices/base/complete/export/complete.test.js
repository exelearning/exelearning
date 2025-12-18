/**
 * Unit tests for complete iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - editDistance: Levenshtein distance calculation
 * - similarity: String similarity (0-1)
 * - checkWord: Word validation with options
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeCompleta globally.
 * Replaces 'var $eXeCompleta' with 'global.$eXeCompleta' to make it accessible.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeCompleta\s*=/, 'global.$eXeCompleta =');
  // Remove auto-init call: $(function () { $eXeCompleta.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeCompleta\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeCompleta;
}

describe('complete iDevice export', () => {
  let $eXeCompleta;

  beforeEach(() => {
    global.$eXeCompleta = undefined;

    const filePath = join(__dirname, 'complete.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeCompleta = loadExportIdevice(code);
  });

  describe('editDistance', () => {
    it('returns 0 for identical strings', () => {
      expect($eXeCompleta.editDistance('hello', 'hello')).toBe(0);
    });

    it('returns length of s2 when s1 is empty', () => {
      expect($eXeCompleta.editDistance('', 'hello')).toBe(5);
    });

    it('returns length of s1 when s2 is empty', () => {
      expect($eXeCompleta.editDistance('hello', '')).toBe(5);
    });

    it('returns correct distance for one character difference', () => {
      expect($eXeCompleta.editDistance('hello', 'hallo')).toBe(1);
    });

    it('returns correct distance for insertion', () => {
      expect($eXeCompleta.editDistance('helo', 'hello')).toBe(1);
    });

    it('returns correct distance for deletion', () => {
      expect($eXeCompleta.editDistance('hello', 'helo')).toBe(1);
    });

    it('returns correct distance for substitution', () => {
      expect($eXeCompleta.editDistance('cat', 'bat')).toBe(1);
    });

    it('returns correct distance for multiple operations', () => {
      expect($eXeCompleta.editDistance('kitten', 'sitting')).toBe(3);
    });

    it('is case insensitive', () => {
      expect($eXeCompleta.editDistance('HELLO', 'hello')).toBe(0);
      expect($eXeCompleta.editDistance('Hello', 'HELLO')).toBe(0);
    });

    it('handles completely different strings', () => {
      expect($eXeCompleta.editDistance('abc', 'xyz')).toBe(3);
    });
  });

  describe('similarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect($eXeCompleta.similarity('hello', 'hello')).toBe(1.0);
    });

    it('returns 1.0 for empty strings', () => {
      expect($eXeCompleta.similarity('', '')).toBe(1.0);
    });

    it('returns 0 for completely different strings of same length', () => {
      expect($eXeCompleta.similarity('abc', 'xyz')).toBe(0);
    });

    it('returns value between 0 and 1 for similar strings', () => {
      const sim = $eXeCompleta.similarity('hello', 'hallo');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
      // 4 chars match out of 5, so ~0.8
      expect(sim).toBe(0.8);
    });

    it('handles strings of different lengths', () => {
      const sim = $eXeCompleta.similarity('hello', 'helloworld');
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThanOrEqual(1);
    });

    it('is symmetric', () => {
      const sim1 = $eXeCompleta.similarity('hello', 'hallo');
      const sim2 = $eXeCompleta.similarity('hallo', 'hello');
      expect(sim1).toBe(sim2);
    });

    it('handles one empty string', () => {
      const sim = $eXeCompleta.similarity('hello', '');
      expect(sim).toBe(0);
    });
  });

  describe('checkWord', () => {
    const createInstance = (options) => {
      const instanceId = 'test-instance';
      $eXeCompleta.options[instanceId] = {
        percentajeError: 0,
        caseSensitive: false,
        estrictCheck: false,
        ...options,
      };
      return instanceId;
    };

    describe('exact matching mode', () => {
      it('returns true for exact match', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('hello', 'hello', instance)).toBe(true);
      });

      it('returns false for different words', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('hello', 'world', instance)).toBe(false);
      });

      it('is case insensitive by default', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('Hello', 'hello', instance)).toBe(true);
        expect($eXeCompleta.checkWord('HELLO', 'hello', instance)).toBe(true);
      });

      it('respects case sensitivity when enabled', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: true });
        expect($eXeCompleta.checkWord('Hello', 'hello', instance)).toBe(false);
        expect($eXeCompleta.checkWord('hello', 'hello', instance)).toBe(true);
      });

      it('trims whitespace', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('  hello  ', 'hello', instance)).toBe(true);
      });

      it('normalizes multiple spaces', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('hello   world', 'hello world', instance)).toBe(true);
      });

      it('removes trailing punctuation', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('hello.', 'hello', instance)).toBe(true);
        expect($eXeCompleta.checkWord('hello,', 'hello', instance)).toBe(true);
        expect($eXeCompleta.checkWord('hello;', 'hello', instance)).toBe(true);
      });
    });

    describe('alternative answers with pipe separator', () => {
      it('accepts any of the pipe-separated alternatives', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('cat|dog|bird', 'cat', instance)).toBe(true);
        expect($eXeCompleta.checkWord('cat|dog|bird', 'dog', instance)).toBe(true);
        expect($eXeCompleta.checkWord('cat|dog|bird', 'bird', instance)).toBe(true);
      });

      it('returns false for non-matching alternatives', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord('cat|dog|bird', 'fish', instance)).toBe(false);
      });

      it('handles whitespace in alternatives', () => {
        const instance = createInstance({ estrictCheck: false, caseSensitive: false });
        expect($eXeCompleta.checkWord(' cat | dog | bird ', 'dog', instance)).toBe(true);
      });
    });

    describe('fuzzy matching mode (estrictCheck)', () => {
      it('accepts similar words within tolerance', () => {
        const instance = createInstance({
          estrictCheck: true,
          caseSensitive: false,
          percentajeError: 20, // 20% error allowed
        });
        // 'helo' vs 'hello' - 1 character difference in 5 = 80% similar
        expect($eXeCompleta.checkWord('hello', 'helo', instance)).toBe(true);
      });

      it('rejects words outside tolerance', () => {
        const instance = createInstance({
          estrictCheck: true,
          caseSensitive: false,
          percentajeError: 5, // Only 5% error allowed (very strict)
        });
        // 'helo' vs 'hello' - 1 character difference in 5 = 80% similar (needs 95%)
        expect($eXeCompleta.checkWord('hello', 'helo', instance)).toBe(false);
      });

      it('accepts exact matches with strict check', () => {
        const instance = createInstance({
          estrictCheck: true,
          caseSensitive: false,
          percentajeError: 0,
        });
        expect($eXeCompleta.checkWord('hello', 'hello', instance)).toBe(true);
      });
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeCompleta.borderColors).toBeDefined();
      expect($eXeCompleta.borderColors.black).toBe('#1c1b1b');
      expect($eXeCompleta.borderColors.blue).toBe('#5877c6');
      expect($eXeCompleta.borderColors.green).toBe('#2a9315');
      expect($eXeCompleta.borderColors.red).toBe('#ff0000');
      expect($eXeCompleta.borderColors.white).toBe('#ffffff');
      expect($eXeCompleta.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeCompleta.colors).toBeDefined();
      expect($eXeCompleta.colors.black).toBe('#1c1b1b');
      expect($eXeCompleta.colors.white).toBe('#ffffff');
    });
  });

  describe('init', () => {
    it('exists as a function', () => {
      expect(typeof $eXeCompleta.init).toBe('function');
    });
  });

  describe('enable', () => {
    it('exists as a function', () => {
      expect(typeof $eXeCompleta.enable).toBe('function');
    });
  });
});
