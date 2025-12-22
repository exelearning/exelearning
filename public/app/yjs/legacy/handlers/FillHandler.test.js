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

    it('returns empty array when no cloze content', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const questions = handler.extractClozeQuestions(dict);
      expect(questions).toEqual([]);
    });
  });

  describe('parseClozeText', () => {
    it('converts exe-cloze-word spans to placeholders', () => {
      const text = '<p>The <u class="exe-cloze-word">sky</u> is blue</p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p>The {{sky}} is blue</p>');
      expect(result.answers).toEqual(['sky']);
    });

    it('converts cloze-blank spans to placeholders', () => {
      const text = '<p>Hello <span class="cloze-blank">world</span></p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p>Hello {{world}}</p>');
      expect(result.answers).toEqual(['world']);
    });

    it('converts input data-answer to placeholders', () => {
      const text = '<p>Test <input data-answer="answer"/> here</p>';
      const result = handler.parseClozeText(text);

      expect(result.baseText).toBe('<p>Test {{answer}} here</p>');
      expect(result.answers).toEqual(['answer']);
    });

    it('handles multiple blanks', () => {
      const text = '<p><u class="exe-cloze-word">One</u> and <u class="exe-cloze-word">Two</u></p>';
      const result = handler.parseClozeText(text);

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
});
