/**
 * GeogebraHandler Tests
 *
 * Unit tests for GeogebraHandler - handles GeogebraIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const GeogebraHandler = require('./GeogebraHandler');

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

describe('GeogebraHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new GeogebraHandler();
  });

  describe('canHandle', () => {
    it('returns true for GeogebraIdevice', () => {
      expect(handler.canHandle('exe.engine.geogebraidevice.GeogebraIdevice')).toBe(true);
    });

    it('returns true for JsIdevice with geogebra-activity type', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'geogebra-activity')).toBe(true);
    });

    it('returns false for JsIdevice without geogebra type', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', 'text')).toBe(false);
    });

    it('returns false for JsIdevice with undefined type', () => {
      expect(handler.canHandle('exe.engine.jsidevice.JsIdevice', undefined)).toBe(false);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });

    it('returns false for similar class names', () => {
      expect(handler.canHandle('exe.engine.algebraidevice.AlgebraIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns geogebra-activity', () => {
      expect(handler.getTargetType()).toBe('geogebra-activity');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts content from fields list', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<div class="GeoGebraApplet">Applet HTML</div>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<div class="GeoGebraApplet">Applet HTML</div>');
    });

    it('extracts content from direct TextAreaField (fallback)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<div class="geogebra-container">Embedded applet</div>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<div class="geogebra-container">Embedded applet</div>');
    });

    it('returns first TextAreaField content from fields', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<div>First content</div>')}"></unicode>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml('<div>Second content</div>')}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<div>First content</div>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no TextAreaField', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('handles complex GeoGebra embed code', () => {
      const geogebraHtml = '<div id="ggb-element"></div><script src="https://www.geogebra.org/apps/deployggb.js"></script>';
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="fields"></string>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"></string>
                <unicode value="${escapeXml(geogebraHtml)}"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toContain('ggb-element');
      expect(html).toContain('geogebra.org');
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
