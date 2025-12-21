/**
 * TrueFalseHandler Tests
 *
 * Unit tests for TrueFalseHandler - handles TrueFalseIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const TrueFalseHandler = require('./TrueFalseHandler');

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

describe('TrueFalseHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new TrueFalseHandler();
  });

  describe('canHandle', () => {
    it('returns true for TrueFalseIdevice', () => {
      expect(handler.canHandle('exe.engine.truefalseidevice.TrueFalseIdevice')).toBe(true);
    });

    it('returns true for VerdaderoFalsoFPDIdevice', () => {
      expect(handler.canHandle('exe.engine.verdaderofalsofpdidevice.VerdaderoFalsoFPDIdevice')).toBe(true);
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

  describe('extractProperties', () => {
    it('extracts questionsData from dictionary', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>The sky is blue</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.questionsData).toBeDefined();
      expect(result.questionsData.length).toBe(1);
      expect(result.questionsData[0].activityType).toBe('true-false');
    });

    it('returns empty object when no questions found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const result = handler.extractProperties(dict);
      expect(result).toEqual({});
    });
  });

  describe('extractQuestions', () => {
    it('extracts true answer correctly', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Water is wet</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);

      expect(questions.length).toBe(1);
      expect(questions[0].baseText).toBe('<p>Water is wet</p>');
      expect(questions[0].answer).toBe('True');
    });

    it('extracts false answer correctly', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Fire is cold</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="0"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);
      expect(questions[0].answer).toBe('False');
    });

    it('extracts hint and feedback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
                <string role="key" value="hintTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>This is a hint</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>This is feedback</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);

      expect(questions[0].hint).toBe('<p>This is a hint</p>');
      expect(questions[0].feedback).toBe('<p>This is feedback</p>');
    });

    it('handles multiple questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q1</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q2</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="0"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);
      expect(questions.length).toBe(2);
    });

    it('looks for questions in "questions" key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);
      expect(questions.length).toBe(1);
    });

    it('skips questions without text', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);
      expect(questions).toEqual([]);
    });
  });

  describe('extractHtmlView', () => {
    it('extracts instructionsForLearners', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Instructions</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Instructions</p>');
    });

    it('returns empty string when no instructions', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('handles null dict', () => {
      // Handler should check for null
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });
});
