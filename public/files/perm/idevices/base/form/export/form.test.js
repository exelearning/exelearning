/**
 * Unit tests for form iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - formatTime: Converts seconds to mm:ss or hh:mm:ss format
 * - generateRandomId: Generates unique random ID
 * - compare2Words: Compares words with 1 character tolerance
 * - mergeFields: Merges object fields
 * - escapeForCallback: Escapes JSON for callback
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $form globally.
 * Replaces 'var $form' with 'global.$form' to make it accessible.
 */
function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$form\s*=/, 'global.$form =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$form;
}

describe('form iDevice export', () => {
  let $form;

  beforeEach(() => {
    global.$form = undefined;

    const filePath = join(__dirname, 'form.js');
    const code = readFileSync(filePath, 'utf-8');

    $form = loadExportIdevice(code);
  });

  describe('formatTime', () => {
    it('formats seconds to mm:ss format', () => {
      expect($form.formatTime(0)).toBe('00:00');
      expect($form.formatTime(30)).toBe('00:30');
      expect($form.formatTime(60)).toBe('01:00');
      expect($form.formatTime(90)).toBe('01:30');
    });

    it('pads single digit minutes and seconds with zero', () => {
      expect($form.formatTime(65)).toBe('01:05');
      expect($form.formatTime(5)).toBe('00:05');
    });

    it('handles times under an hour', () => {
      expect($form.formatTime(3599)).toBe('59:59');
    });

    it('formats to hh:mm:ss for times >= 1 hour', () => {
      expect($form.formatTime(3600)).toBe('01:00:00');
      expect($form.formatTime(3661)).toBe('01:01:01');
      expect($form.formatTime(7200)).toBe('02:00:00');
    });

    it('handles large time values', () => {
      expect($form.formatTime(36000)).toBe('10:00:00');
      expect($form.formatTime(86399)).toBe('23:59:59');
    });
  });

  describe('generateRandomId', () => {
    it('returns a string', () => {
      const result = $form.generateRandomId();
      expect(typeof result).toBe('string');
    });

    it('contains timestamp and letters separated by dash', () => {
      const result = $form.generateRandomId();
      expect(result).toMatch(/^\d+-[A-Z0-9]+$/);
    });

    it('generates unique IDs on subsequent calls', () => {
      const id1 = $form.generateRandomId();
      const id2 = $form.generateRandomId();
      // IDs should be different (timestamp changes or random part differs)
      // In rare cases they could be the same, so we generate more
      const ids = new Set([id1, id2]);
      for (let i = 0; i < 10; i++) {
        ids.add($form.generateRandomId());
      }
      // At least some IDs should be unique
      expect(ids.size).toBeGreaterThan(1);
    });

    it('has correct format structure', () => {
      const result = $form.generateRandomId();
      const parts = result.split('-');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^\d+$/); // timestamp
      expect(parts[1]).toMatch(/^[A-Z0-9]+$/); // random letters
    });
  });

  describe('compare2Words', () => {
    it('returns true for identical words', () => {
      expect($form.compare2Words('hello', 'hello')).toBe(true);
      expect($form.compare2Words('test', 'test')).toBe(true);
    });

    it('returns true for words with one character difference', () => {
      expect($form.compare2Words('hello', 'hallo')).toBe(true);
      expect($form.compare2Words('test', 'tast')).toBe(true);
      expect($form.compare2Words('word', 'wurd')).toBe(true);
    });

    it('returns false for words with different lengths', () => {
      expect($form.compare2Words('hello', 'hell')).toBe(false);
      expect($form.compare2Words('hi', 'hello')).toBe(false);
    });

    it('returns false for words with more than one difference', () => {
      expect($form.compare2Words('hello', 'hxxlo')).toBe(false);
      expect($form.compare2Words('test', 'best')).toBe(true); // only 1 diff
      expect($form.compare2Words('test', 'bast')).toBe(false); // 2 diffs
    });

    it('handles empty strings', () => {
      expect($form.compare2Words('', '')).toBe(true);
    });

    it('handles single character words', () => {
      expect($form.compare2Words('a', 'a')).toBe(true);
      expect($form.compare2Words('a', 'b')).toBe(true); // 1 diff allowed
    });

    it('is case sensitive', () => {
      expect($form.compare2Words('Hello', 'hello')).toBe(true); // only 1 diff
      expect($form.compare2Words('HELLO', 'hello')).toBe(false); // 5 diffs
    });
  });

  describe('mergeFields', () => {
    it('returns obj2 if obj1 is null', () => {
      const obj2 = { a: 1, b: 2 };
      expect($form.mergeFields(null, obj2)).toBe(obj2);
    });

    it('returns obj2 if obj1 is undefined', () => {
      const obj2 = { a: 1, b: 2 };
      expect($form.mergeFields(undefined, obj2)).toBe(obj2);
    });

    it('adds missing fields from obj2 to obj1', () => {
      const obj1 = { a: 1 };
      const obj2 = { b: 2, c: 3 };
      const result = $form.mergeFields(obj1, obj2);
      expect(result.a).toBe(1);
      expect(result.b).toBe(2);
      expect(result.c).toBe(3);
    });

    it('does not overwrite existing fields in obj1', () => {
      const obj1 = { a: 1, b: 'original' };
      const obj2 = { b: 'new', c: 3 };
      const result = $form.mergeFields(obj1, obj2);
      expect(result.b).toBe('original');
      expect(result.c).toBe(3);
    });

    it('returns obj1 reference (mutates obj1)', () => {
      const obj1 = { a: 1 };
      const obj2 = { b: 2 };
      const result = $form.mergeFields(obj1, obj2);
      expect(result).toBe(obj1);
    });

    it('handles empty objects', () => {
      const obj1 = {};
      const obj2 = { a: 1 };
      const result = $form.mergeFields(obj1, obj2);
      expect(result.a).toBe(1);
    });
  });

  describe('escapeForCallback', () => {
    it('escapes backslashes', () => {
      const result = $form.escapeForCallback({ path: 'C:\\path' });
      expect(result).toContain('\\\\');
    });

    it('escapes double quotes', () => {
      const result = $form.escapeForCallback({ text: 'say "hello"' });
      expect(result).toContain('\\"');
    });

    it('returns valid escaped JSON string', () => {
      const obj = { a: 1, b: 'test' };
      const result = $form.escapeForCallback(obj);
      expect(typeof result).toBe('string');
    });

    it('handles nested objects', () => {
      const obj = { outer: { inner: 'value' } };
      const result = $form.escapeForCallback(obj);
      expect(result).toContain('outer');
      expect(result).toContain('inner');
    });

    it('handles arrays', () => {
      const obj = { items: [1, 2, 3] };
      const result = $form.escapeForCallback(obj);
      expect(result).toContain('[1,2,3]');
    });
  });

  describe('msgs', () => {
    it('has required message properties', () => {
      expect($form.msgs.msgScoreScorm).toBeDefined();
      expect($form.msgs.msgYouScore).toBeDefined();
      expect($form.msgs.msgScore).toBeDefined();
      expect($form.msgs.msgCheck).toBeDefined();
      expect($form.msgs.msgReset).toBeDefined();
      expect($form.msgs.msgShowAnswers).toBeDefined();
    });

    it('has question type help messages', () => {
      expect($form.msgs.msgTrueFalseHelp).toBeDefined();
      expect($form.msgs.msgDropdownHelp).toBeDefined();
      expect($form.msgs.msgFillHelp).toBeDefined();
      expect($form.msgs.msgSingleSelectionHelp).toBeDefined();
      expect($form.msgs.msgMultipleSelectionHelp).toBeDefined();
    });

    it('has true/false labels', () => {
      expect($form.msgs.msgTrue).toBeDefined();
      expect($form.msgs.msgFalse).toBeDefined();
    });
  });

  describe('icons', () => {
    it('has required icon definitions', () => {
      expect($form.iconSingleSelection).toBe('rule');
      expect($form.iconMultipleSelection).toBe('checklist_rtl');
      expect($form.iconTrueFalse).toBe('rule');
      expect($form.iconDropdown).toBe('expand_more');
      expect($form.iconFill).toBe('horizontal_rule');
    });
  });

  describe('passRate', () => {
    it('is initially empty', () => {
      expect($form.passRate).toBe('');
    });
  });

  describe('ideviceId', () => {
    it('is initially empty', () => {
      expect($form.ideviceId).toBe('');
    });
  });

  describe('scorm paths', () => {
    it('has scorm wrapper path', () => {
      expect($form.scormAPIwrapper).toBe('libs/SCORM_API_wrapper.js');
    });

    it('has scorm functions path', () => {
      expect($form.scormFunctions).toBe('libs/SCOFunctions.js');
    });
  });
});
