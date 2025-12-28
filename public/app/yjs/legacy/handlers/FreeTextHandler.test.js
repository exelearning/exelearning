/**
 * FreeTextHandler Tests
 *
 * Unit tests for FreeTextHandler - handles FreeTextIdevice and related text iDevices.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const FreeTextHandler = require('./FreeTextHandler');

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

describe('FreeTextHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new FreeTextHandler();
  });

  describe('canHandle', () => {
    it('returns true for FreeTextIdevice', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(true);
    });

    it('returns true for FreeTextfpdIdevice', () => {
      expect(handler.canHandle('exe.engine.freetextfpdidevice.FreeTextfpdIdevice')).toBe(true);
    });

    it('returns true for ReflectionIdevice', () => {
      expect(handler.canHandle('exe.engine.reflectionidevice.ReflectionIdevice')).toBe(true);
    });

    it('returns true for ReflectionfpdIdevice', () => {
      expect(handler.canHandle('exe.engine.reflectionfpdidevice.ReflectionfpdIdevice')).toBe(true);
    });

    it('returns true for GenericIdevice', () => {
      expect(handler.canHandle('exe.engine.genericidevice.GenericIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.multichoiceidevice.MultichoiceIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns text', () => {
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts content from activityTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="activityTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Main content</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Main content</p>');
    });

    it('extracts content from content key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="content"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Content text</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Content text</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no content found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('extracts from fields list (JsIdevice format)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>Field content</p>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Field content</p>');
    });
  });

  describe('extractFeedback', () => {
    it('extracts feedback from answerTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="answerTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Feedback content</p>')}"></unicode>
              <string role="key" value="buttonCaption"></string>
              <string value="Show Answer"></string>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict);
      expect(feedback.content).toBe('<p>Feedback content</p>');
    });

    it('extracts feedback from feedbackTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedbackTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Feedback</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      // Pass Spanish context (default for legacy files)
      const feedback = handler.extractFeedback(dict, { language: 'es' });
      expect(feedback.content).toBe('<p>Feedback</p>');
      // Uses project language for localized default caption
      expect(feedback.buttonCaption).toBe('Mostrar retroalimentación');
    });

    it('extracts custom buttonCaption from feedbackTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedbackTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="buttonCaption"></string>
              <unicode value="Ver respuesta"></unicode>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Feedback</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict);
      expect(feedback.content).toBe('<p>Feedback</p>');
      expect(feedback.buttonCaption).toBe('Ver respuesta');
    });

    it('returns empty when no feedback', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const feedback = handler.extractFeedback(dict);
      expect(feedback.content).toBe('');
      expect(feedback.buttonCaption).toBe('');
    });

    it('returns empty for null dict', () => {
      const feedback = handler.extractFeedback(null);
      expect(feedback.content).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('includes feedback when present', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedbackTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Feedback</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      // extractProperties calls extractFeedback internally which uses default (Spanish)
      const props = handler.extractProperties(dict);
      expect(props.textFeedbackTextarea).toBe('<p>Feedback</p>');
      // Uses project language for localized default caption (Spanish is default for legacy)
      expect(props.textFeedbackInput).toBe('Mostrar retroalimentación');
    });

    it('returns empty object when no feedback', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });

  describe('extractFieldsContent', () => {
    it('extracts content from TextAreaField in fields list', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>Content 1</p>')}"></unicode>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>Content 2</p>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const content = handler.extractFieldsContent(dict);
      expect(content).toBe('<p>Content 1</p>\n<p>Content 2</p>');
    });

    it('returns empty string when no fields', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const content = handler.extractFieldsContent(dict);
      expect(content).toBe('');
    });
  });
});
