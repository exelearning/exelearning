/**
 * ExternalUrlHandler Tests
 *
 * Unit tests for ExternalUrlHandler - handles ExternalUrlIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const ExternalUrlHandler = require('./ExternalUrlHandler');

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

describe('ExternalUrlHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new ExternalUrlHandler();
  });

  describe('canHandle', () => {
    it('returns true for ExternalUrlIdevice', () => {
      expect(handler.canHandle('exe.engine.externalurlidevice.ExternalUrlIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns external-website', () => {
      expect(handler.getTargetType()).toBe('external-website');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts from descriptionTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="descriptionTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Website description</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Website description</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts URL from url key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="url"></string>
          <unicode value="https://example.com"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.url).toBe('https://example.com');
    });

    it('extracts URL from _url key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_url"></string>
          <unicode value="https://example.org"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.url).toBe('https://example.org');
    });

    it('extracts height', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="url"></string>
          <unicode value="https://example.com"></unicode>
          <string role="key" value="height"></string>
          <unicode value="600px"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.height).toBe('600px');
    });

    it('returns empty object for null dict', () => {
      const props = handler.extractProperties(null);
      expect(props).toEqual({});
    });
  });

  describe('extractUrl', () => {
    it('extracts direct URL string', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="url"></string>
          <unicode value="https://test.com"></unicode>
        </dictionary>
      `);

      const url = handler.extractUrl(dict);
      expect(url).toBe('https://test.com');
    });

    it('extracts URL from TextField instance', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="urlField"></string>
          <instance class="exe.engine.field.TextField">
            <dictionary>
              <string role="key" value="content"></string>
              <unicode value="https://field.com"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const url = handler.extractUrl(dict);
      expect(url).toBe('https://field.com');
    });

    it('tries multiple URL field names', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="websiteUrl"></string>
          <unicode value="https://website.com"></unicode>
        </dictionary>
      `);

      const url = handler.extractUrl(dict);
      expect(url).toBe('https://website.com');
    });

    it('returns null when no URL found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const url = handler.extractUrl(dict);
      expect(url).toBeNull();
    });
  });
});
