/**
 * NotaHandler Tests
 *
 * Unit tests for NotaHandler - handles NotaIdevice and NotaInformacionIdevice.
 * These iDevices should be imported with block visibility set to false.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const NotaHandler = require('./NotaHandler');

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

describe('NotaHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new NotaHandler();
  });

  describe('canHandle', () => {
    it('returns true for NotaIdevice', () => {
      expect(handler.canHandle('exe.engine.notaidevice.NotaIdevice')).toBe(true);
    });

    it('returns true for NotaInformacionIdevice', () => {
      expect(handler.canHandle('exe.engine.notainformacionidevice.NotaInformacionIdevice')).toBe(true);
    });

    it('returns false for FreeTextIdevice', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.rssidevice.RssIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns text', () => {
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('getBlockProperties', () => {
    it('returns visibility false', () => {
      const props = handler.getBlockProperties();
      expect(props).toEqual({ visibility: 'false' });
    });

    it('returns object with visibility key', () => {
      const props = handler.getBlockProperties();
      expect(props).toHaveProperty('visibility');
      expect(props.visibility).toBe('false');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts content from commentTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="commentTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>iDevice Nota.</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>iDevice Nota.</p>');
    });

    it('extracts content from content key as fallback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="content"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Nota content via content key.</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Nota content via content key.</p>');
    });

    it('extracts content from direct TextAreaField as fallback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Direct TextAreaField content.</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Direct TextAreaField content.</p>');
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
