/**
 * Unit tests for challenge iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - createArrayStateChallenges: Creates array of challenge states
 * - checkWord: Compares words with normalization
 * - addZero: Pads single digit numbers
 * - getTimeToString: Formats time to hh:mm:ss
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeDesafio globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeDesafio\s*=/, 'global.$eXeDesafio =');
  // Remove auto-init call: $(function () { $eXeDesafio.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeDesafio\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeDesafio;
}

describe('challenge iDevice export', () => {
  let $eXeDesafio;

  beforeEach(() => {
    global.$eXeDesafio = undefined;

    const filePath = join(__dirname, 'challenge.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeDesafio = loadExportIdevice(code);
  });

  describe('createArrayStateChallenges', () => {
    it('creates array with correct length', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 5);
      expect(result).toHaveLength(5);
    });

    it('sets first challenge state to 3 (active)', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      expect(result[0].state).toBe(3);
    });

    it('sets subsequent challenges to 0 when type is 0', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      expect(result[1].state).toBe(0);
      expect(result[2].state).toBe(0);
    });

    it('sets subsequent challenges to 1 when type is 1', () => {
      const result = $eXeDesafio.createArrayStateChallenges(1, 3);
      expect(result[1].state).toBe(1);
      expect(result[2].state).toBe(1);
    });

    it('initializes all challenges with solved = 0', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 3);
      result.forEach(challenge => {
        expect(challenge.solved).toBe(0);
      });
    });

    it('handles single challenge', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 1);
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe(3);
    });

    it('handles empty array', () => {
      const result = $eXeDesafio.createArrayStateChallenges(0, 0);
      expect(result).toHaveLength(0);
    });
  });

  describe('checkWord', () => {
    it('returns true for identical words', () => {
      expect($eXeDesafio.checkWord('hello', 'hello')).toBe(true);
    });

    it('is case insensitive', () => {
      expect($eXeDesafio.checkWord('Hello', 'HELLO')).toBe(true);
      expect($eXeDesafio.checkWord('WORLD', 'world')).toBe(true);
    });

    it('trims whitespace', () => {
      expect($eXeDesafio.checkWord('  hello  ', 'hello')).toBe(true);
    });

    it('normalizes multiple spaces', () => {
      expect($eXeDesafio.checkWord('hello   world', 'hello world')).toBe(true);
    });

    it('removes trailing punctuation', () => {
      expect($eXeDesafio.checkWord('hello.', 'hello')).toBe(true);
      expect($eXeDesafio.checkWord('hello,', 'hello')).toBe(true);
      expect($eXeDesafio.checkWord('hello;', 'hello')).toBe(true);
    });

    it('returns false for different words', () => {
      expect($eXeDesafio.checkWord('hello', 'world')).toBe(false);
    });

    it('handles pipe-separated alternatives in answer', () => {
      expect($eXeDesafio.checkWord('cat|dog|bird', 'cat')).toBe(true);
      expect($eXeDesafio.checkWord('cat|dog|bird', 'dog')).toBe(true);
      expect($eXeDesafio.checkWord('cat|dog|bird', 'bird')).toBe(true);
      expect($eXeDesafio.checkWord('cat|dog|bird', 'fish')).toBe(false);
    });

    it('handles empty strings', () => {
      expect($eXeDesafio.checkWord('', '')).toBe(true);
    });
  });

  describe('addZero', () => {
    it('adds zero to single digit numbers', () => {
      expect($eXeDesafio.addZero(0)).toBe('00');
      expect($eXeDesafio.addZero(5)).toBe('05');
      expect($eXeDesafio.addZero(9)).toBe('09');
    });

    it('returns string for double digit numbers', () => {
      expect($eXeDesafio.addZero(10)).toBe('10');
      expect($eXeDesafio.addZero(59)).toBe('59');
    });

    it('handles larger numbers', () => {
      expect($eXeDesafio.addZero(100)).toBe('100');
    });
  });

  describe('getTimeToString', () => {
    it('formats zero seconds', () => {
      expect($eXeDesafio.getTimeToString(0)).toBe('00:00:00');
    });

    it('formats seconds only', () => {
      expect($eXeDesafio.getTimeToString(30)).toBe('00:00:30');
      expect($eXeDesafio.getTimeToString(59)).toBe('00:00:59');
    });

    it('formats minutes and seconds', () => {
      expect($eXeDesafio.getTimeToString(60)).toBe('00:01:00');
      expect($eXeDesafio.getTimeToString(90)).toBe('00:01:30');
      expect($eXeDesafio.getTimeToString(3599)).toBe('00:59:59');
    });

    it('formats hours, minutes, and seconds', () => {
      expect($eXeDesafio.getTimeToString(3600)).toBe('01:00:00');
      expect($eXeDesafio.getTimeToString(3661)).toBe('01:01:01');
      expect($eXeDesafio.getTimeToString(7200)).toBe('02:00:00');
    });

    it('pads single digits with zeros', () => {
      expect($eXeDesafio.getTimeToString(3723)).toBe('01:02:03');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeDesafio.borderColors).toBeDefined();
      expect($eXeDesafio.borderColors.black).toBe('#1c1b1b');
      expect($eXeDesafio.borderColors.blue).toBe('#5877c6');
      expect($eXeDesafio.borderColors.green).toBe('#2a9315');
      expect($eXeDesafio.borderColors.red).toBe('#ff0000');
      expect($eXeDesafio.borderColors.white).toBe('#ffffff');
      expect($eXeDesafio.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('colors', () => {
    it('has required color definitions', () => {
      expect($eXeDesafio.colors).toBeDefined();
      expect($eXeDesafio.colors.black).toBe('#1c1b1b');
    });
  });

  describe('options', () => {
    it('is defined', () => {
      expect($eXeDesafio.options).toBeDefined();
    });
  });
});
