/**
 * DefaultHandler Tests
 *
 * Unit tests for DefaultHandler - fallback handler for unknown legacy iDevice types.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const DefaultHandler = require('./DefaultHandler');

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

describe('DefaultHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new DefaultHandler();
  });

  describe('canHandle', () => {
    it('returns true for any class name', () => {
      expect(handler.canHandle('exe.engine.unknownidevice.UnknownIdevice')).toBe(true);
      expect(handler.canHandle('SomeRandomClass')).toBe(true);
      expect(handler.canHandle('')).toBe(true);
    });
  });

  describe('getTargetType', () => {
    it('returns text', () => {
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts from fields list', () => {
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

    it('extracts from content key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="content"></string>
          <unicode value="${escapeXml('<p>Direct content</p>')}"></unicode>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Direct content</p>');
    });

    it('extracts from htmlView key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="htmlView"></string>
          <unicode value="${escapeXml('<div>HTML View</div>')}"></unicode>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<div>HTML View</div>');
    });

    it('extracts from any TextAreaField instance', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Any text area</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Any text area</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no content found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });
  });

  describe('extractFeedback', () => {
    it('extracts from answerTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="answerTextArea"></string>
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

  describe('extractFieldsContent', () => {
    it('extracts from multiple TextAreaFields', () => {
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

    it('returns empty string when no fields list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const content = handler.extractFieldsContent(dict);
      expect(content).toBe('');
    });
  });

  describe('extractRichTextContent', () => {
    it('extracts unicode value', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="content"></string>
          <unicode value="${escapeXml('<p>Rich text</p>')}"></unicode>
        </dictionary>
      `);

      const content = handler.extractRichTextContent(dict, 'content');
      expect(content).toBe('<p>Rich text</p>');
    });

    it('extracts from instance', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="textField"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>From instance</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const content = handler.extractRichTextContent(dict, 'textField');
      expect(content).toBe('<p>From instance</p>');
    });

    it('returns empty string for missing field', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const content = handler.extractRichTextContent(dict, 'nonexistent');
      expect(content).toBe('');
    });
  });

  describe('extractAnyTextFieldContent', () => {
    it('finds TextField at any level', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Nested content</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const content = handler.extractAnyTextFieldContent(dict);
      expect(content).toBe('<p>Nested content</p>');
    });

    it('returns empty when no text fields', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const content = handler.extractAnyTextFieldContent(dict);
      expect(content).toBe('');
    });
  });
});
