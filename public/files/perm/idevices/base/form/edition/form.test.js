/**
 * Unit tests for form iDevice (edition)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - checkQuestions: Validates and parses questions input
 * - clearText: Cleans HTML/CDATA from text
 * - removeTags: Removes HTML tags from string
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load edition iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$exeDevice;
}

describe('form iDevice edition', () => {
  let $exeDevice;

  beforeEach(() => {
    global.$exeDevice = undefined;

    const filePath = join(__dirname, 'form.js');
    const code = readFileSync(filePath, 'utf-8');

    $exeDevice = loadIdevice(code);
  });

  describe('checkQuestions', () => {
    it('returns array if input is already an array with items', () => {
      const input = ['question1', 'question2'];
      expect($exeDevice.checkQuestions(input)).toEqual(input);
    });

    it('returns false for empty array', () => {
      expect($exeDevice.checkQuestions([])).toBe(false);
    });

    it('parses valid JSON string into array', () => {
      const input = '["question1", "question2"]';
      const result = $exeDevice.checkQuestions(input);
      expect(result).toEqual(['question1', 'question2']);
    });

    it('returns false for invalid JSON string', () => {
      expect($exeDevice.checkQuestions('not valid json')).toBe(false);
    });

    it('converts object to array of values', () => {
      const input = { a: 'question1', b: 'question2' };
      const result = $exeDevice.checkQuestions(input);
      expect(result).toContain('question1');
      expect(result).toContain('question2');
    });

    it('returns false for null', () => {
      expect($exeDevice.checkQuestions(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect($exeDevice.checkQuestions(undefined)).toBe(false);
    });

    it('parses JSON object string into array', () => {
      const input = '{"a": "question1", "b": "question2"}';
      const result = $exeDevice.checkQuestions(input);
      expect(result).toContain('question1');
      expect(result).toContain('question2');
    });
  });

  describe('clearText', () => {
    it('removes HTML tags', () => {
      expect($exeDevice.clearText('<p>Hello</p>')).toBe('Hello');
    });

    it('removes CDATA wrappers', () => {
      expect($exeDevice.clearText('<![CDATA[Hello]]')).toBe('Hello');
    });

    it('handles nested HTML tags', () => {
      expect($exeDevice.clearText('<div><p>Hello</p></div>')).toBe('Hello');
    });

    it('replaces newlines with spaces', () => {
      expect($exeDevice.clearText('Hello\nWorld')).toBe('Hello World');
    });

    it('trims whitespace', () => {
      expect($exeDevice.clearText('  Hello  ')).toBe('Hello');
    });

    it('handles empty string', () => {
      expect($exeDevice.clearText('')).toBe('');
    });

    it('handles plain text without HTML', () => {
      expect($exeDevice.clearText('Plain text')).toBe('Plain text');
    });

    it('handles HTML entities', () => {
      const result = $exeDevice.clearText('<p>&amp; &lt; &gt;</p>');
      expect(result).toBe('& < >');
    });
  });

  describe('removeTags', () => {
    it('removes HTML tags using jQuery', () => {
      expect($exeDevice.removeTags('<p>Hello</p>')).toBe('Hello');
    });

    it('handles nested tags', () => {
      expect($exeDevice.removeTags('<div><span>Test</span></div>')).toBe('Test');
    });

    it('handles empty string', () => {
      expect($exeDevice.removeTags('')).toBe('');
    });

    it('handles plain text', () => {
      expect($exeDevice.removeTags('Plain text')).toBe('Plain text');
    });
  });

  describe('getTrueFalseQuestion', () => {
    it('parses valid true question', () => {
      const result = $exeDevice.getTrueFalseQuestion('1#The sky is blue');
      expect(result.activityType).toBe('true-false');
      expect(result.answer).toBe(1);
      expect(result.baseText).toContain('The sky is blue');
    });

    it('parses valid false question', () => {
      const result = $exeDevice.getTrueFalseQuestion('0#The sky is green');
      expect(result.activityType).toBe('true-false');
      expect(result.answer).toBe(0);
      expect(result.baseText).toContain('The sky is green');
    });

    it('returns empty string for invalid format', () => {
      expect($exeDevice.getTrueFalseQuestion('invalid')).toBe('');
    });

    it('returns empty string for missing parts', () => {
      expect($exeDevice.getTrueFalseQuestion('1')).toBe('');
    });
  });

  describe('getTrueFalseQuestionExe', () => {
    it('parses exe format true/false question', () => {
      // Format: index#question#solution#extra
      const result = $exeDevice.getTrueFalseQuestionExe('0#The sky is blue#1#extra');
      expect(result.activityType).toBe('true-false');
      expect(result.answer).toBe(1);
      expect(result.baseText).toContain('The sky is blue');
    });

    it('returns empty string for insufficient parts', () => {
      expect($exeDevice.getTrueFalseQuestionExe('0#question#1')).toBe('');
    });
  });

  describe('getTrueFalseQuestionExeSv', () => {
    it('parses sv format true/false question with truthy answer', () => {
      // Format: question#solution#extra#extra
      const result = $exeDevice.getTrueFalseQuestionExeSv('The sky is blue#1#extra#extra');
      expect(result.activityType).toBe('true-false');
      expect(result.answer).toBe(1);
      expect(result.baseText).toContain('The sky is blue');
    });

    it('parses sv format true/false question with falsy answer', () => {
      const result = $exeDevice.getTrueFalseQuestionExeSv('The sky is green#0#extra#extra');
      expect(result.activityType).toBe('true-false');
      expect(result.answer).toBe(0);
    });

    it('returns empty string for insufficient parts', () => {
      expect($exeDevice.getTrueFalseQuestionExeSv('question#1#extra')).toBe('');
    });
  });

  describe('getTestQuestion', () => {
    it('parses single selection question', () => {
      // Format: solutionIndex#question#option1#option2#option3
      const result = $exeDevice.getTestQuestion('0#What color is the sky?#Blue#Green#Red');
      expect(result.activityType).toBe('selection');
      expect(result.selectionType).toBe('single');
      expect(result.baseText).toContain('What color is the sky?');
      expect(result.answers).toHaveLength(3);
      expect(result.answers[0][0]).toBe(true); // First option is correct
      expect(result.answers[1][0]).toBe(false);
      expect(result.answers[2][0]).toBe(false);
    });

    it('marks correct answer based on index', () => {
      const result = $exeDevice.getTestQuestion('1#Question?#A#B#C');
      expect(result.answers[0][0]).toBe(false);
      expect(result.answers[1][0]).toBe(true); // Second option is correct
      expect(result.answers[2][0]).toBe(false);
    });

    it('returns false for insufficient parts', () => {
      expect($exeDevice.getTestQuestion('0#question#answer')).toBe(false);
    });

    it('trims whitespace from options', () => {
      const result = $exeDevice.getTestQuestion('0#Question?#  A  #  B  #  C  ');
      expect(result.answers[0][1]).toBe('A');
      expect(result.answers[1][1]).toBe('B');
      expect(result.answers[2][1]).toBe('C');
    });
  });

  describe('getTestMutiple', () => {
    it('parses multiple selection question', () => {
      // Format: correctLetters#question#option1#option2#option3
      const result = $exeDevice.getTestMutiple('AB#Select correct ones#First#Second#Third');
      expect(result.activityType).toBe('selection');
      expect(result.selectionType).toBe('multiple');
      expect(result.baseText).toContain('Select correct ones');
      expect(result.answers).toHaveLength(3);
      expect(result.answers[0][0]).toBe(true); // A is correct
      expect(result.answers[1][0]).toBe(true); // B is correct
      expect(result.answers[2][0]).toBe(false); // C is not correct
    });

    it('handles lowercase solution letters', () => {
      const result = $exeDevice.getTestMutiple('ac#Question?#A#B#C');
      expect(result.answers[0][0]).toBe(true); // A
      expect(result.answers[1][0]).toBe(false); // B
      expect(result.answers[2][0]).toBe(true); // C
    });

    it('returns null for insufficient parts', () => {
      expect($exeDevice.getTestMutiple('A#question')).toBe(null);
    });

    it('handles single correct answer', () => {
      const result = $exeDevice.getTestMutiple('B#Question?#A#B#C');
      expect(result.answers[0][0]).toBe(false);
      expect(result.answers[1][0]).toBe(true);
      expect(result.answers[2][0]).toBe(false);
    });
  });

  describe('questionsIds', () => {
    it('contains expected question types', () => {
      expect($exeDevice.questionsIds).toContain('dropdown');
      expect($exeDevice.questionsIds).toContain('selection');
      expect($exeDevice.questionsIds).toContain('true-false');
      expect($exeDevice.questionsIds).toContain('fill');
    });

    it('has 4 question types', () => {
      expect($exeDevice.questionsIds).toHaveLength(4);
    });
  });

  describe('icons', () => {
    it('has required icon definitions', () => {
      expect($exeDevice.iconSelectOne).toBe('rule');
      expect($exeDevice.iconSelectMultiple).toBe('checklist_rtl');
      expect($exeDevice.iconTrueFalse).toBe('rule');
      expect($exeDevice.iconDropdown).toBe('expand_more');
      expect($exeDevice.iconFill).toBe('horizontal_rule');
    });
  });

  describe('iDeviceId', () => {
    it('has correct iDevice identifier', () => {
      expect($exeDevice.iDeviceId).toBe('formIdevice');
    });
  });

  // ============================================
  // DOM Manipulation Tests
  // ============================================

  describe('updateQuestionsNumber', () => {
    let originalGetQuestionsData;

    beforeEach(() => {
      document.body.innerHTML = `
        <input id="frmEPercentageQuestions" value="100" />
        <span id="frmENumeroPercentaje">0/0</span>
      `;
      $exeDevice.ideviceBody = document.body;
      // Mock getQuestionsData to return 5 questions (avoids complex DOM parsing)
      originalGetQuestionsData = $exeDevice.getQuestionsData;
      $exeDevice.getQuestionsData = () => [{}, {}, {}, {}, {}]; // 5 questions
    });

    afterEach(() => {
      $exeDevice.getQuestionsData = originalGetQuestionsData;
    });

    it('shows all questions when percentage is 100', () => {
      $exeDevice.updateQuestionsNumber();
      expect($('#frmENumeroPercentaje').text()).toBe('5/5');
    });

    it('shows half questions when percentage is 50', () => {
      $('#frmEPercentageQuestions').val('50');
      $exeDevice.updateQuestionsNumber();
      // 5 * 0.5 = 2.5, rounded = 3
      expect($('#frmENumeroPercentaje').text()).toBe('3/5');
    });

    it('shows minimum 1 question when percentage is very low', () => {
      $('#frmEPercentageQuestions').val('1');
      $exeDevice.updateQuestionsNumber();
      // Math.max(Math.round(0.01 * 5), 1) = 1
      expect($('#frmENumeroPercentaje').text()).toContain('/5');
      const num = parseInt($('#frmENumeroPercentaje').text().split('/')[0]);
      expect(num).toBeGreaterThanOrEqual(1);
    });

    it('handles NaN percentage gracefully', () => {
      $('#frmEPercentageQuestions').val('invalid');
      // Should not throw
      expect(() => $exeDevice.updateQuestionsNumber()).not.toThrow();
    });

    it('handles empty questions array', () => {
      $exeDevice.getQuestionsData = () => [];
      $exeDevice.updateQuestionsNumber();
      // With 0 questions, totalQuestions = 1 (fallback), so 1/1
      expect($('#frmENumeroPercentaje').text()).toBe('1/1');
    });
  });

  describe('Form class - hideQuestionsPanel', () => {
    let form;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="questionsContainerTop" style="display: block"></div>
        <div id="questionsContainerBottom" style="display: flex"></div>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.msgs = { strings: {} };
      form = new $exeDevice.Form($exeDevice, {});
    });

    it('hides panel by setting display to none', () => {
      form.hideQuestionsPanel('questionsContainerTop');
      expect(document.getElementById('questionsContainerTop').style.display).toBe('none');
    });

    it('hides bottom panel', () => {
      form.hideQuestionsPanel('questionsContainerBottom');
      expect(document.getElementById('questionsContainerBottom').style.display).toBe('none');
    });
  });

  describe('Form class - behaviourToggleOneMultipleAnswer', () => {
    let form;

    beforeEach(() => {
      document.body.innerHTML = `
        <button id="buttonRadioCheckboxToggle" selection-type="single">toggle_off</button>
        <span>Answer type: Single</span>
        <span id="iconActivity_123">rule</span>
        <div class="options-container">
          <input type="radio" name="options" id="option_1" />
          <input type="radio" name="options" id="option_2" />
        </div>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.iconSelectMultiple = 'checklist_rtl';
      $exeDevice.iconSelectOne = 'rule';
      $exeDevice.iconActivityId = 'iconActivity';
      $exeDevice.msgs = { strings: {} };
      form = new $exeDevice.Form($exeDevice, {});
    });

    it('changes icon from toggle_off to toggle_on on click', () => {
      form.behaviourToggleOneMultipleAnswer('buttonRadioCheckboxToggle');
      document.getElementById('buttonRadioCheckboxToggle').click();
      expect(document.getElementById('buttonRadioCheckboxToggle').innerHTML).toBe('toggle_on');
    });

    it('changes selection-type attribute from single to multiple', () => {
      form.behaviourToggleOneMultipleAnswer('buttonRadioCheckboxToggle');
      document.getElementById('buttonRadioCheckboxToggle').click();
      expect(document.getElementById('buttonRadioCheckboxToggle').getAttribute('selection-type')).toBe('multiple');
    });

    it('changes input type from radio to checkbox', () => {
      form.behaviourToggleOneMultipleAnswer('buttonRadioCheckboxToggle');
      document.getElementById('buttonRadioCheckboxToggle').click();
      expect(document.getElementById('option_1').type).toBe('checkbox');
      expect(document.getElementById('option_2').type).toBe('checkbox');
    });

    it('toggles back to single on second click', () => {
      form.behaviourToggleOneMultipleAnswer('buttonRadioCheckboxToggle');
      const btn = document.getElementById('buttonRadioCheckboxToggle');
      btn.click(); // -> multiple
      btn.click(); // -> single
      expect(btn.innerHTML).toBe('toggle_off');
      expect(btn.getAttribute('selection-type')).toBe('single');
    });
  });

  describe('Form class - behaviourButtonRemoveOption', () => {
    let form;

    beforeEach(() => {
      document.body.innerHTML = `
        <div id="options-list">
          <div id="option_1_container" class="question-button">
            <label>Option 1</label>
            <button id="remove_option_1" class="remove-option">close</button>
          </div>
          <div id="option_1_textarea">Textarea 1</div>
          <div id="option_2_container" class="question-button">
            <label>Option 2</label>
            <button id="remove_option_2" class="remove-option">close</button>
          </div>
          <div id="option_2_textarea">Textarea 2</div>
        </div>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.msgs = { strings: {} };
      form = new $exeDevice.Form($exeDevice, {});
    });

    it('removes option and associated textarea on click', () => {
      form.behaviourButtonRemoveOption('remove_option_1');
      document.getElementById('remove_option_1').click();
      expect(document.getElementById('option_1_container')).toBeNull();
      expect(document.getElementById('option_1_textarea')).toBeNull();
    });

    it('keeps other options intact', () => {
      form.behaviourButtonRemoveOption('remove_option_1');
      document.getElementById('remove_option_1').click();
      expect(document.getElementById('option_2_container')).not.toBeNull();
    });
  });

  describe('Form class - generateRandomId', () => {
    let form;

    beforeEach(() => {
      $exeDevice.ideviceBody = document.body;
      $exeDevice.msgs = { strings: {} };
      form = new $exeDevice.Form($exeDevice, {});
    });

    it('generates unique IDs', () => {
      const id1 = form.generateRandomId();
      const id2 = form.generateRandomId();
      expect(id1).not.toBe(id2);
    });

    it('generates string IDs', () => {
      const id = form.generateRandomId();
      expect(typeof id).toBe('string');
    });
  });
});
