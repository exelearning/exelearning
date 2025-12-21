/**
 * DropdownHandler Tests
 *
 * Unit tests for DropdownHandler - handles ListaIdevice (dropdown questions).
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const DropdownHandler = require('./DropdownHandler');

// Helper to parse XML
const createXmlDoc = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

const parseDictionary = (xmlString) => {
  const doc = createXmlDoc(xmlString);
  return doc.querySelector('dictionary');
};

// Escape XML special characters
const escapeXml = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

describe('DropdownHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new DropdownHandler();
  });

  describe('canHandle', () => {
    it('returns true for ListaIdevice', () => {
      expect(handler.canHandle('exe.engine.listaidevice.ListaIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.multichoiceidevice.MultichoiceIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns form', () => {
      expect(handler.getTargetType()).toBe('form');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts from instructionsForLearners', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Select the correct answers</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Select the correct answers</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts questionsData', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Select {{correct}} answer</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="wrongAnswers"></string>
                <unicode value="wrong1,wrong2"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.questionsData).toBeDefined();
      expect(props.questionsData.length).toBe(1);
      expect(props.questionsData[0].activityType).toBe('dropdown');
    });

    it('returns empty object when no questions', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });

  describe('extractDropdownQuestions', () => {
    it('extracts question with wrong answers', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>The capital of France is Paris</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="wrongAnswers"></string>
                <unicode value="London,Berlin,Madrid"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractDropdownQuestions(dict);

      expect(questions.length).toBe(1);
      expect(questions[0].wrongAnswersValue).toBe('London,Berlin,Madrid');
    });

    it('handles multiple questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q1</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.listaidevice.ListaField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q2</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractDropdownQuestions(dict);
      expect(questions.length).toBe(2);
    });

    it('looks for questions key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractDropdownQuestions(dict);
      expect(questions.length).toBe(1);
    });

    it('returns empty array when no questions list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const questions = handler.extractDropdownQuestions(dict);
      expect(questions).toEqual([]);
    });
  });

  describe('parseDropdownText', () => {
    it('converts select with selected option to placeholder', () => {
      const text = '<p>Choose <select class="exe-lista-select"><option>wrong</option><option selected>correct</option></select></p>';
      const result = handler.parseDropdownText(text);

      expect(result.baseText).toContain('{{correct}}');
      expect(result.answers).toContain('correct');
    });

    it('converts input data-correct to placeholder', () => {
      const text = '<p>Test <input data-correct="answer"/> here</p>';
      const result = handler.parseDropdownText(text);

      expect(result.baseText).toBe('<p>Test {{answer}} here</p>');
      expect(result.answers).toEqual(['answer']);
    });

    it('returns empty for null input', () => {
      const result = handler.parseDropdownText(null);
      expect(result.baseText).toBe('');
      expect(result.answers).toEqual([]);
    });

    it('handles text without dropdowns', () => {
      const text = '<p>Plain text</p>';
      const result = handler.parseDropdownText(text);

      expect(result.baseText).toBe('<p>Plain text</p>');
      expect(result.answers).toEqual([]);
    });
  });
});
