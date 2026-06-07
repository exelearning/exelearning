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

    it('returns null for invalid format', () => {
      expect($exeDevice.getTrueFalseQuestion('invalid')).toBe(null);
    });

    it('returns null for missing parts', () => {
      expect($exeDevice.getTrueFalseQuestion('1')).toBe(null);
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

    it('returns null for insufficient parts', () => {
      expect($exeDevice.getTrueFalseQuestionExe('0#question#1')).toBe(null);
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

    it('returns null for insufficient parts', () => {
      expect($exeDevice.getTrueFalseQuestionExeSv('question#1#extra')).toBe(null);
    });
  });

  describe('selection option rendering', () => {
    it('renders plain-text symbols without changing the stored answers', () => {
      const answers = [
        [true, 'a = b && c>a y & b<a'],
        [false, 'b<a Adias'],
        [false, 'say "A<B"'],
      ];

      document.body.innerHTML = $exeDevice.getProcessTextSelectionQuestion(
        '<p>Question</p>',
        'radio',
        answers,
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

  describe('true/false answer persistence', () => {
    function renderTrueFalseEditor() {
      $exeDevice.strings = {
        ...$exeDevice.strings,
        msgETrue: 'Verdadero',
        msgEFalse: 'Falso',
      };
      document.body.innerHTML = `
        <div id="formPreview">
          <textarea id="formPreviewTextarea"></textarea>
          ${$exeDevice.showTrueFalseRadioButtons('formPreviewTrueFalseRadioButtons')}
        </div>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.getEditorTinyMCEValue = vi.fn(() => '<p>Question</p>');
    }

    it.each([
      ['InputTrue', '1'],
      ['InputFalse', '0'],
    ])('round-trip preserves the selected %s answer', (radioId, expectedAnswer) => {
      renderTrueFalseEditor();
      document.getElementById(radioId).checked = true;

      const savedQuestion = $exeDevice.createQuestionObject(
        'formPreview',
        $exeDevice.ACTIVITY_TYPES.TRUE_FALSE,
      );

      expect(savedQuestion.answer).toBe(expectedAnswer);

      $exeDevice.questionsForm = [{ ...savedQuestion, id: 'question-id' }];
      document.getElementById(radioId === 'InputTrue' ? 'InputFalse' : 'InputTrue').checked = true;
      $exeDevice.setDataFromTrueFalseQuestion({
        dataset: { id: 'question-id' },
      });

      expect(document.getElementById(radioId).checked).toBe(true);
    });

    it('reads the selected answer from the active question container', () => {
      renderTrueFalseEditor();
      const otherForm = document.createElement('form');
      otherForm.innerHTML = '<input type="radio" name="TrueFalseQuestion" value="0" checked>';
      document.body.prepend(otherForm);
      document.getElementById('InputTrue').checked = true;

      const savedQuestion = $exeDevice.createQuestionObject(
        'formPreview',
        $exeDevice.ACTIVITY_TYPES.TRUE_FALSE,
      );

      expect(savedQuestion.answer).toBe('1');
    });

    it.each([
      [1, 'InputTrue'],
      ['1', 'InputTrue'],
      [true, 'InputTrue'],
      ['true', 'InputTrue'],
      [0, 'InputFalse'],
      ['0', 'InputFalse'],
      [false, 'InputFalse'],
      ['false', 'InputFalse'],
    ])('normalizes answer %s as %s', (legacyAnswer, expectedRadioId) => {
      renderTrueFalseEditor();
      $exeDevice.questionsForm = [
        {
          id: 'legacy-question',
          activityType: 'true-false',
          baseText: '<p>Legacy question</p>',
          answer: legacyAnswer,
        },
      ];

      $exeDevice.setDataFromTrueFalseQuestion({
        dataset: { id: 'legacy-question' },
      });

      expect(document.getElementById(expectedRadioId).checked).toBe(true);
    });

    it.each([
      [1, '1'],
      ['1', '1'],
      [0, '0'],
      ['0', '0'],
    ])('renders legacy answer %s correctly', (legacyAnswer, expectedAnswer) => {
      $exeDevice.getProcessTextTrueFalseQuestion = vi.fn(() => 'question-html');

      expect(
        $exeDevice.getPreviewTextTrueFalseQuestion({
          baseText: '<p>Legacy question</p>',
          answer: legacyAnswer,
        }),
      ).toBe('question-html');
      expect($exeDevice.getProcessTextTrueFalseQuestion).toHaveBeenCalledWith(
        '<p>Legacy question</p>',
        expectedAnswer,
      );
    });

    it('uses stable answer values while keeping translated labels', () => {
      renderTrueFalseEditor();

      expect(document.querySelector('label[for="InputTrue"]').textContent).toContain('Verdadero');
      expect(document.querySelector('label[for="InputFalse"]').textContent).toContain('Falso');
      expect(document.getElementById('InputTrue').value).toBe('1');
      expect(document.getElementById('InputFalse').value).toBe('0');
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

  describe('question editing', () => {
    it('replaces the edited question without removing the following question', () => {
      const editedQuestion = {
        id: 'edited-question',
        activityType: 'true-false',
        baseText: '<p>Original question</p>',
        answer: '1',
      };
      const followingQuestion = {
        id: 'following-question',
        activityType: 'true-false',
        baseText: '<p>Following question</p>',
        answer: '0',
      };

      document.body.innerHTML = `
        <ul id="formPreview">
          <li class="FormView_question" data-id="edited-question" style="display: none"></li>
          <li class="FormView_question">
            <div id="formPreviewTextareaContainer"></div>
            <div id="saveQuestionContainer"></div>
          </li>
          <li class="FormView_question" data-id="following-question">Following question</li>
        </ul>
        <input id="frmEPercentageQuestions" value="100">
        <span id="frmENumeroPercentaje"></span>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.questionsForm = [editedQuestion, followingQuestion];
      $exeDevice.dataIdQuestionBeforeEdit = editedQuestion.id;
      $exeDevice.strings = {
        ...$exeDevice.strings,
        msgEActivity: 'Activity',
        msgETrue: 'True',
        msgEFalse: 'False',
      };
      $exeDevice.createQuestionObject = vi.fn(() => ({
        ...editedQuestion,
        baseText: '<p>Updated question</p>',
      }));
      $exeDevice.addSortableBehaviour = vi.fn();
      $exeDevice.disableArrowUpDown = vi.fn();
      $exeDevice.behaviourButtonCloseQuestionInFormView = vi.fn();
      $exeDevice.behaviourButtonEditQuestionInFormView = vi.fn();
      $exeDevice.behaviourButtonMoveUpQuestionInFormView = vi.fn();
      $exeDevice.behaviourButtonMoveDownQuestionInFormView = vi.fn();

      $exeDevice.behaviourButtonSaveQuestion('true-false');
      document.getElementById('saveQuestionContainer').click();

      const renderedQuestions = [...document.querySelectorAll('#formPreview > .FormView_question')];
      expect(renderedQuestions.map(question => question.dataset.id)).toEqual([
        'edited-question',
        'following-question',
      ]);
      expect(renderedQuestions[0].textContent).toContain('Updated question');
      expect(renderedQuestions[1].textContent).toContain('Following question');
      expect($exeDevice.questionsForm).toHaveLength(2);
      expect($exeDevice.dataIdQuestionBeforeEdit).toBe('');
    });
  });

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

  describe('checkFormValues', () => {
    beforeEach(() => {
      eXe.app.alert = vi.fn();
    });

    it('returns false when there are no questions', () => {
      $exeDevice.questionsData = [];
      expect($exeDevice.checkFormValues()).toBe(false);
      expect(eXe.app.alert).toHaveBeenCalled();
    });

    it('returns true when there is at least one question', () => {
      $exeDevice.questionsData = [{ question: 'q1' }];
      expect($exeDevice.checkFormValues()).toBe(true);
    });

    it('does not validate evaluation length here (delegated to progressBar.getValues)', () => {
      // Even with a too-short evaluationID, checkFormValues is only responsible
      // for question count after the migration.
      $exeDevice.evaluation = true;
      $exeDevice.evaluationID = 'abc';
      $exeDevice.questionsData = [{ question: 'q1' }];
      expect($exeDevice.checkFormValues()).toBe(true);
    });
  });

  describe('reorderQuestionsByIds', () => {
    it('reorders questions to match the given id order', () => {
      const questions = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
        { id: 'c', baseText: 'C' },
      ];
      const result = $exeDevice.reorderQuestionsByIds(questions, ['b', 'a', 'c']);
      expect(result.map(q => q.id)).toEqual(['b', 'a', 'c']);
    });

    it('ignores ids that do not match any question', () => {
      const questions = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
      ];
      // The null id corresponds to an in-edition <li> without data-id.
      const result = $exeDevice.reorderQuestionsByIds(questions, ['b', null, 'a']);
      expect(result.map(q => q.id)).toEqual(['b', 'a']);
    });

    it('returns the original array when a question would be lost', () => {
      const questions = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
      ];
      // 'b' is missing from the id list, so reordering would drop it.
      const result = $exeDevice.reorderQuestionsByIds(questions, ['a']);
      expect(result).toBe(questions);
    });

    it('returns the original array when the DOM order repeats a question id', () => {
      const questions = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
      ];

      const result = $exeDevice.reorderQuestionsByIds(questions, ['a', 'a']);

      expect(result).toBe(questions);
    });

    it('returns the original array when the source questions have duplicate ids', () => {
      const questions = [
        { id: 'a', baseText: 'A' },
        { id: 'a', baseText: 'Duplicate A' },
      ];

      const result = $exeDevice.reorderQuestionsByIds(questions, ['a', 'a']);

      expect(result).toBe(questions);
    });

    it('handles empty arrays', () => {
      expect($exeDevice.reorderQuestionsByIds([], [])).toEqual([]);
    });
  });

  describe('syncQuestionsFormToDomOrder', () => {
    it('reorders questionsForm to match the DOM order', () => {
      document.body.innerHTML = `
        <ul id="formPreview">
          <li class="FormView_question" data-id="b"></li>
          <li class="FormView_question" data-id="a"></li>
          <li class="FormView_question" data-id="c"></li>
        </ul>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.questionsForm = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
        { id: 'c', baseText: 'C' },
      ];

      $exeDevice.syncQuestionsFormToDomOrder();

      expect($exeDevice.questionsForm.map(q => q.id)).toEqual(['b', 'a', 'c']);
    });

    it('ignores the in-edition list item without a data-id', () => {
      document.body.innerHTML = `
        <ul id="formPreview">
          <li class="FormView_question" data-id="b"></li>
          <li class="FormView_question"></li>
          <li class="FormView_question" data-id="a"></li>
        </ul>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.questionsForm = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
      ];

      $exeDevice.syncQuestionsFormToDomOrder();

      expect($exeDevice.questionsForm.map(q => q.id)).toEqual(['b', 'a']);
    });

    it('does nothing when the preview container is missing', () => {
      document.body.innerHTML = '';
      $exeDevice.ideviceBody = document.body;
      const questions = [{ id: 'a' }];
      $exeDevice.questionsForm = questions;

      expect(() => $exeDevice.syncQuestionsFormToDomOrder()).not.toThrow();
      expect($exeDevice.questionsForm).toBe(questions);
    });
  });

  describe('addQuestionfrmorm question ordering', () => {
    it('keeps the saved order aligned with the visual position (B, A, C)', () => {
      // DOM already shows B above A (B was added with the top button); the new
      // question C is appended at the bottom with the bottom button.
      document.body.innerHTML = `
        <ul id="formPreview">
          <li class="FormView_question" data-id="b"></li>
          <li class="FormView_question" data-id="a"></li>
        </ul>
        <div id="msgNoQuestions"></div>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.questionsForm = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
      ];
      $exeDevice.createQuestionObject = vi.fn(() => ({ id: 'c', baseText: 'C' }));
      $exeDevice.renderQuestion = vi.fn(() => {
        document
          .getElementById('formPreview')
          .insertAdjacentHTML(
            'beforeend',
            '<li class="FormView_question" data-id="c"></li>',
          );
      });

      $exeDevice.addQuestionfrmorm('formPreview', 'true-false');

      expect($exeDevice.questionsForm.map(q => q.id)).toEqual(['b', 'a', 'c']);
      expect($exeDevice.active).toBe(2);
      expect(document.getElementById('msgNoQuestions').style.display).toBe('none');
    });
  });

  describe('handleDragEnd', () => {
    it('rebuilds questionsForm from the dropped DOM order', () => {
      document.body.innerHTML = `
        <ul id="formPreview">
          <li class="FormView_question" data-id="c"></li>
          <li class="FormView_question" data-id="a"></li>
          <li class="FormView_question" data-id="b"></li>
        </ul>
      `;
      $exeDevice.ideviceBody = document.body;
      $exeDevice.questionsForm = [
        { id: 'a', baseText: 'A' },
        { id: 'b', baseText: 'B' },
        { id: 'c', baseText: 'C' },
      ];
      const remove = vi.fn();

      $exeDevice.handleDragEnd({ currentTarget: { classList: { remove } } });

      expect(remove).toHaveBeenCalledWith('dragging');
      expect($exeDevice.questionsForm.map(q => q.id)).toEqual(['c', 'a', 'b']);
    });
  });

  // Note: Form class tests removed because $exeDevice.Form
  // does not exist in the current version of form.js from main branch.
  // These tests were written for a modified version of the code.
});
