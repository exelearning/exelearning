/**
 * WikipediaHandler Tests
 *
 * Unit tests for WikipediaHandler - handles WikipediaIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const WikipediaHandler = require('./WikipediaHandler');

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

describe('WikipediaHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new WikipediaHandler();
  });

  describe('canHandle', () => {
    it('returns true for WikipediaIdevice', () => {
      expect(handler.canHandle('exe.engine.wikipediaidevice.WikipediaIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns text', () => {
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('extractHtmlView', () => {
    it('wraps content in exe-wikipedia-content div', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Wikipedia article content.</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<div class="exe-wikipedia-content"><p>Wikipedia article content.</p></div>');
    });

    it('removes empty paragraphs', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p></p><p>Content</p><p></p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<div class="exe-wikipedia-content"><p>Content</p></div>');
    });

    it('extracts content from fields list', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>Wikipedia from fields.</p>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<div class="exe-wikipedia-content"><p>Wikipedia from fields.</p></div>');
    });

    it('combines multiple TextAreaFields', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Section 1</p>')}"></unicode>
            </dictionary>
          </instance>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Section 2</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toContain('<p>Section 1</p>');
      expect(html).toContain('<p>Section 2</p>');
      expect(html).toMatch(/^<div class="exe-wikipedia-content">/);
      expect(html).toMatch(/<\/div>$/);
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no TextAreaField', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('returns empty object', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });
});
