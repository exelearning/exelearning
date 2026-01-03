/**
 * FillHandler Tests
 *
 * Unit tests for FillHandler - handles ClozeIdevice (fill-in-blanks).
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const FillHandler = require('./FillHandler');

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

describe('FillHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new FillHandler();
  });

  describe('canHandle', () => {
    it('returns true for ClozeIdevice', () => {
      expect(handler.canHandle('exe.engine.clozeidevice.ClozeIdevice')).toBe(true);
    });

    it('returns true for ClozeActivityIdevice', () => {
      expect(handler.canHandle('exe.engine.clozeactivityidevice.ClozeActivityIdevice')).toBe(true);
    });

    it('returns true for ClozeLanguageIdevice (FPD variant)', () => {
      expect(handler.canHandle('exe.engine.clozelang.ClozeLanguageIdevice')).toBe(true);
    });

    it('returns true for ClozeLangIdevice', () => {
      expect(handler.canHandle('exe.engine.clozelang.ClozeLangIdevice')).toBe(true);
    });

    it('returns true for ClozelangfpdIdevice (FPD cloze variant)', () => {
      expect(handler.canHandle('exe.engine.clozelangfpdidevice.ClozelangfpdIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
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
              <unicode value="${escapeXml('<p>Fill in the blanks</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Fill in the blanks</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts ignoreCaps setting', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="autoCapitalize"></string>
          <bool value="0"></bool>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.ignoreCaps).toBe(true);
    });

    it('extracts strictMarking setting', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="strictMarking"></string>
          <bool value="1"></bool>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.strictMarking).toBe(true);
    });

    it('extracts instantMarking setting', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instantMarking"></string>
          <bool value="1"></bool>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.instantMarking).toBe(true);
    });
  });

  describe('extractClozeQuestions', () => {
    it('extracts from clozeTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>The sky is blue</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const questions = handler.extractClozeFromFields(dict);
      expect(questions.length).toBe(1);
      expect(questions[0].activityType).toBe('fill');
    });

    it('extracts from _content ClozeField with _encodedContent (Symfony approach)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_content"></string>
          <instance class="exe.engine.field.ClozeField">
            <dictionary>
              <string role="key" value="_encodedContent"></string>
              <unicode value="${escapeXml('<p>The <u>sky</u> is blue</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const questions = handler.extractClozeQuestions(dict);
      expect(questions.length).toBe(1);
      expect(questions[0].activityType).toBe('fill');
      // baseText keeps <u> tags for form renderer (getProcessTextFillQuestion)
      expect(questions[0].baseText).toBe('<p>The <u>sky</u> is blue</p>');
      expect(questions[0].answers).toEqual(['sky']);
    });

    it('extracts from ClozeField by class directly', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.ClozeField">
            <dictionary>
              <string role="key" value="_encodedContent"></string>
              <unicode value="${escapeXml('<p>Test <u>answer</u> here</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const questions = handler.extractClozeQuestions(dict);
      expect(questions.length).toBe(1);
      // baseText keeps <u> tags for form renderer
      expect(questions[0].baseText).toBe('<p>Test <u>answer</u> here</p>');
    });

    it('returns empty array when no cloze content', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const questions = handler.extractClozeQuestions(dict);
      expect(questions).toEqual([]);
    });
  });

  describe('parseClozeText', () => {
    it('keeps simple <u> tags for form renderer', () => {
      const text = '<p>The <u>sky</u> is blue</p>';
      const result = handler.parseClozeText(text);

      // baseText keeps <u> tags - form renderer converts them to inputs
      expect(result.baseText).toBe('<p>The <u>sky</u> is blue</p>');
      expect(result.answers).toEqual(['sky']);
    });

    it('extracts multiple answers from <u> tags', () => {
      const text = '<p>A <u>cat</u> and a <u>dog</u></p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p>A <u>cat</u> and a <u>dog</u></p>');
      expect(result.answers).toEqual(['cat', 'dog']);
    });

    it('normalizes exe-cloze-word class to simple <u> tags', () => {
      const text = '<p>The <u class="exe-cloze-word">sky</u> is blue</p>';
      const result = handler.parseClozeText(text);

      // Normalizes to simple <u> tag
      expect(result.baseText).toBe('<p>The <u>sky</u> is blue</p>');
      expect(result.answers).toEqual(['sky']);
    });

    it('converts cloze-blank spans to <u> tags', () => {
      const text = '<p>Hello <span class="cloze-blank">world</span></p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p>Hello <u>world</u></p>');
      expect(result.answers).toEqual(['world']);
    });

    it('converts input data-answer to <u> tags', () => {
      const text = '<p>Test <input data-answer="answer"/> here</p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p>Test <u>answer</u> here</p>');
      expect(result.answers).toEqual(['answer']);
    });

    it('handles multiple blanks with exe-cloze-word class', () => {
      const text = '<p><u class="exe-cloze-word">One</u> and <u class="exe-cloze-word">Two</u></p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p><u>One</u> and <u>Two</u></p>');
      expect(result.answers).toEqual(['One', 'Two']);
    });

    it('returns empty for null input', () => {
      const result = handler.parseClozeText(null);
      expect(result.baseText).toBe('');
      expect(result.answers).toEqual([]);
    });

    it('handles text without blanks', () => {
      const text = '<p>Plain text without blanks</p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p>Plain text without blanks</p>');
      expect(result.answers).toEqual([]);
    });
  });

  describe('extractFeedback', () => {
    it('extracts feedback from feedback TextAreaField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Good job!</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict);
      expect(feedback).toBe('<p>Good job!</p>');
    });

    it('extracts feedback from feedbackTextArea key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedbackTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Well done!</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict);
      expect(feedback).toBe('<p>Well done!</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractFeedback(null)).toBe('');
    });

    it('returns empty string when no feedback field', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractFeedback(dict)).toBe('');
    });
  });

  describe('eXeIdeviceTextAfter in extractProperties', () => {
    it('includes eXeIdeviceTextAfter when feedback present', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Feedback content here</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>The <u>sky</u> is blue</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeIdeviceTextAfter).toBe('<p>Feedback content here</p>');
      expect(result.questionsData).toBeDefined();
    });

    it('does not include eXeIdeviceTextAfter when no feedback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>The <u>sky</u> is blue</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeIdeviceTextAfter).toBeUndefined();
    });

    it('includes both eXeIdeviceTextAfter and eXeFormInstructions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Fill the blanks</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Well done!</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeFormInstructions).toBe('<p>Fill the blanks</p>');
      expect(result.eXeIdeviceTextAfter).toBe('<p>Well done!</p>');
    });
  });

  describe('eXeFormInstructions in extractProperties', () => {
    it('includes eXeFormInstructions when instructions are present', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Complete the gaps</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>The <u class="exe-cloze-word">sky</u> is blue</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeFormInstructions).toBe('<p>Complete the gaps</p>');
      expect(result.questionsData).toBeDefined();
      expect(result.questionsData.length).toBe(1);
    });

    it('does not include eXeFormInstructions when no instructions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>The <u class="exe-cloze-word">sky</u> is blue</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeFormInstructions).toBeUndefined();
      expect(result.questionsData).toBeDefined();
    });

    it('includes both eXeFormInstructions and settings', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Fill in the blanks</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="strictMarking"></string>
          <bool value="1"></bool>
          <string role="key" value="clozeTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeFormInstructions).toBe('<p>Fill in the blanks</p>');
      expect(result.strictMarking).toBe(true);
    });
  });
});
