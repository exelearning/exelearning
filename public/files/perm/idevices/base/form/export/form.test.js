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

  describe('escapeHtmlText / escapeHtmlAttr', () => {
    it('escapes <, > and & in text', () => {
      expect($form.escapeHtmlText('A<B')).toBe('A&lt;B');
      expect($form.escapeHtmlText('x>y')).toBe('x&gt;y');
      expect($form.escapeHtmlText('a && b')).toBe('a &amp;&amp; b');
      expect($form.escapeHtmlText('A + B > C+D && 4')).toBe('A + B &gt; C+D &amp;&amp; 4');
    });

    it('escapes double quotes for attributes', () => {
      expect($form.escapeHtmlAttr('a"b<c')).toBe('a&quot;b&lt;c');
    });

    it('handles null/undefined', () => {
      expect($form.escapeHtmlText(null)).toBe('');
      expect($form.escapeHtmlText(undefined)).toBe('');
    });
  });

  describe('getProcessTextSelectionQuestion escaping', () => {
    it('renders plain-text symbols without changing the stored answers', () => {
      $form.replaceResourceDirectoryPaths = (_data, text) => text;
      const data = {
        msgs: { msgSingleSelectionHelp: 'single', msgMultipleSelectionHelp: 'multiple' },
      };
      const answers = [
        [true, 'a = b && c>a y & b<a'],
        [false, 'b<a Adias'],
        [false, 'say "A<B"'],
      ];

      document.body.innerHTML = $form.getProcessTextSelectionQuestion(
        '<p>Q</p>',
        'radio',
        answers,
        data,
      );

      const labels = [...document.querySelectorAll('.selection-buttons-container label')];
      const inputs = [...document.querySelectorAll('.selection-buttons-container input')];

      expect(labels.map(label => label.textContent)).toEqual(answers.map(answer => answer[1]));
      expect(inputs.map(input => input.value)).toEqual(answers.map(answer => answer[1]));
      expect(answers).toEqual([
        [true, 'a = b && c>a y & b<a'],
        [false, 'b<a Adias'],
        [false, 'say "A<B"'],
      ]);
    });
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

  describe('updateConfig', () => {
    beforeEach(() => {
      eXe.app.isInExe = vi.fn(() => false);
      eXe.app.getIdeviceInstalledExportPath = vi.fn(() => '/idevices/form/');
      document.body.innerHTML = '';
    });

    // An activity whose saved data was lost or discarded arrives as {}, and the
    // shared getQuestions helper hands back an empty array for it.
    it('normalises missing questions to an empty list', () => {
      let result;

      expect(() => {
        result = $form.updateConfig({}, 'form-1');
      }).not.toThrow();

      expect(result.questionsData).toEqual([]);
      expect(result.numberQuestions).toBe(0);
    });

    it('does not throw when there is no saved data at all', () => {
      expect(() => $form.updateConfig(undefined, 'form-1')).not.toThrow();
    });
  });

  describe('renderBehaviour', () => {
    beforeEach(() => {
      eXe.app.isInExe = vi.fn(() => false);
      eXe.app.getIdeviceInstalledExportPath = vi.fn(() => '/idevices/form/');
      document.body.innerHTML = '<div id="form-questions-form-1"></div>';
    });

    // getQuestions now yields [] rather than undefined, so the early return has
    // to test for emptiness instead of falsiness.
    it('renders nothing when the activity has no questions', () => {
      const getHtmlFormView = vi.spyOn($form, 'getHtmlFormView');

      expect(() => $form.renderBehaviour({}, 0, 'form-1')).not.toThrow();

      expect(getHtmlFormView).not.toHaveBeenCalled();
      getHtmlFormView.mockRestore();
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

  describe('escapeHtmlButKeepRenderedMath', () => {
    const RENDERED_MATH =
      '<span class="exe-math-rendered" data-latex="x^2"><svg><use></use></svg></span>';

    it('keeps a valid pre-rendered math span raw while escaping surrounding plain text', () => {
      const out = $form.escapeHtmlButKeepRenderedMath(`a<b ${RENDERED_MATH} c>d`);
      // Plain-text angle brackets are escaped...
      expect(out).toContain('a&lt;b');
      expect(out).toContain('c&gt;d');
      // ...but the math span survives verbatim so the SVG renders.
      expect(out).toContain(RENDERED_MATH);
    });

    it('escapes a forged span carrying an unsafe event handler', () => {
      const forged =
        '<span class="exe-math-rendered" data-latex="x"><svg onload="alert(1)"></svg></span>';
      const out = $form.escapeHtmlButKeepRenderedMath(forged);
      expect(out).not.toContain('<svg onload');
      expect(out).toContain('&lt;span');
    });

    it('handles null/undefined as empty string', () => {
      expect($form.escapeHtmlButKeepRenderedMath(null)).toBe('');
      expect($form.escapeHtmlButKeepRenderedMath(undefined)).toBe('');
    });
  });

  describe('LaTeX pre-render compatibility', () => {
    const RENDERED_MATH =
      '<span class="exe-math-rendered" data-latex="x^2"><svg><use></use></svg></span>';
    let data;

    beforeEach(() => {
      // Isolate the pure HTML builders from jQuery/eXe DOM lookups.
      $form.replaceResourceDirectoryPaths = (_data, html) => html;
      data = { msgs: $form.msgs };
    });

    it('escapes a pre-rendered option in the selection value but keeps it visible in the label', () => {
      const html = $form.getProcessTextSelectionQuestion(
        'Which equals four?',
        'radio',
        [
          [true, RENDERED_MATH],
          [false, 'plain'],
        ],
        data
      );

      // The hidden input value is escaped so the SVG quotes cannot corrupt it...
      expect(html).toContain('value="&lt;span class=&quot;exe-math-rendered');
      expect(html).not.toContain('value="<span');
      // ...while the visible label still renders the math span as innerHTML.
      expect(html).toContain(`<label for=`);
      expect(html).toContain(RENDERED_MATH);
      // Grading stays index-based: the first option (index 0) is the right answer.
      expect(html).toMatch(/class="selectionAnswer"[^>]*>0</);
    });

    it('renders stem LaTeX but keeps the plain fill blank answer intact', () => {
      const html = $form.getProcessTextFillQuestion(
        `Compute ${RENDERED_MATH} then write <u>four</u>`,
        false,
        false,
        data
      );

      // Stem math survives as a pre-rendered span...
      expect(html).toContain('exe-math-rendered');
      // ...and the blank answer is the plain word, not the SVG markup.
      expect(html).toMatch(/class="fillAnswer"[^>]*>four<\/span>/);
      expect(html).not.toMatch(/class="fillAnswer"[^>]*>\s*<span/);
    });

    it('renders stem LaTeX but keeps the plain dropdown answer/options intact', () => {
      const html = $form.getProcessTextDropdownQuestion(
        `Pick ${RENDERED_MATH} <u>four</u>`,
        'five|six',
        data
      );

      // Stem math survives...
      expect(html).toContain('exe-math-rendered');
      // ...the correct answer is the plain word (compared verbatim at runtime)...
      expect(html).toMatch(/class="dropdownAnswer"[^>]*>four<\/span>/);
      // ...and every option value matches its plain text (no SVG injected).
      expect(html).toContain('<option value="four">four</option>');
      expect(html).toContain('<option value="five">five</option>');
    });
  });
});
