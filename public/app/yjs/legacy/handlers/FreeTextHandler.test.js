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

    it('wraps content with feedback in exe-text-activity structure', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="activityTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Main content</p>')}"></unicode>
            </dictionary>
          </instance>
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

      const html = handler.extractHtmlView(dict, { language: 'es' });
      // Should be wrapped in exe-text-activity
      expect(html).toContain('<div class="exe-text-activity">');
      // Should contain main content
      expect(html).toContain('<p>Main content</p>');
      // Should contain feedback button
      expect(html).toContain('class="feedbacktooglebutton"');
      expect(html).toContain('value="Show Answer"');
      // Should contain feedback content
      expect(html).toContain('<div class="feedback js-feedback');
      expect(html).toContain('<p>Feedback content</p>');
    });

    it('includes feedback from FeedbackField in exe-text-activity (GenericIdevice / Reading Activity)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>Reading activity content</p>')}"></unicode>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.FeedbackField">
              <dictionary>
                <string role="key" value="_buttonCaption"></string>
                <string value="Ver respuesta"></string>
                <string role="key" value="feedback"></string>
                <unicode value="${escapeXml('<p>This is feedback</p>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict, { language: 'es' });
      // Should be wrapped in exe-text-activity
      expect(html).toContain('<div class="exe-text-activity">');
      // Should contain main content
      expect(html).toContain('<p>Reading activity content</p>');
      // Should contain feedback button with correct caption
      expect(html).toContain('value="Ver respuesta"');
      // Should contain feedback content
      expect(html).toContain('<p>This is feedback</p>');
    });

    it('escapes special characters in feedback button caption', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="activityTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Content</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="answerTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Feedback</p>')}"></unicode>
              <string role="key" value="buttonCaption"></string>
              <string value='Show "Answer" &amp; Tips'></string>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict, { language: 'es' });
      // Quotes should be escaped in attribute, ampersand entity stays as &amp;
      expect(html).toContain('value="Show &quot;Answer&quot; &amp; Tips"');
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

    it('extracts feedback from FeedbackField inside fields list (GenericIdevice / Reading Activity)', () => {
      // This is the structure used by GenericIdevice with Reading Activity
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="_name"></string>
                <unicode value="What to read"></unicode>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>Main content</p>')}"></unicode>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.FeedbackField">
              <dictionary>
                <string role="key" value="_buttonCaption"></string>
                <string value="Ver retroalimentación"></string>
                <string role="key" value="_name"></string>
                <unicode value="Feedback"></unicode>
                <string role="key" value="feedback"></string>
                <unicode value="${escapeXml('<p>This is the feedback content</p>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict, { language: 'es' });
      expect(feedback.content).toBe('<p>This is the feedback content</p>');
      expect(feedback.buttonCaption).toBe('Ver retroalimentación');
    });

    it('extracts feedback from FeedbackField with content_w_resourcePaths', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.FeedbackField">
              <dictionary>
                <string role="key" value="_buttonCaption"></string>
                <string value=""></string>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>Feedback from content_w_resourcePaths</p>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict, { language: 'es' });
      expect(feedback.content).toBe('<p>Feedback from content_w_resourcePaths</p>');
      // Empty _buttonCaption should fall back to default
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
