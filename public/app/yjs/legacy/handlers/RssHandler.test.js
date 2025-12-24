/**
 * RssHandler Tests
 *
 * Unit tests for RssHandler - handles RssIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const RssHandler = require('./RssHandler');

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

describe('RssHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new RssHandler();
  });

  describe('canHandle', () => {
    it('returns true for RssIdevice', () => {
      expect(handler.canHandle('exe.engine.rssidevice.RssIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });

    it('returns false for similar class names', () => {
      expect(handler.canHandle('exe.engine.processidevice.ProcessIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns text', () => {
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts content from direct TextAreaField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<h2>RSS Feed Title</h2><p>Feed content here.</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<h2>RSS Feed Title</h2><p>Feed content here.</p>');
    });

    it('extracts content from fields list', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<p>RSS content from fields list.</p>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>RSS content from fields list.</p>');
    });

    it('combines multiple TextAreaFields', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Part 1</p>')}"></unicode>
            </dictionary>
          </instance>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Part 2</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toContain('<p>Part 1</p>');
      expect(html).toContain('<p>Part 2</p>');
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
