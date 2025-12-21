/**
 * Test Helpers Tests
 *
 * Unit tests for test-helpers.js - XML parsing utilities for legacy handler tests.
 */

const { createXmlDoc, parseDictionary, textAreaFieldXml, escapeXml } = require('./test-helpers');

describe('test-helpers', () => {
  describe('escapeXml', () => {
    it('escapes ampersand', () => {
      expect(escapeXml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect(escapeXml('a < b')).toBe('a &lt; b');
    });

    it('escapes greater than', () => {
      expect(escapeXml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect(escapeXml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect(escapeXml("it's")).toBe('it&#39;s');
    });

    it('escapes all special characters together', () => {
      expect(escapeXml('<p class="test">A & B\'s</p>')).toBe(
        '&lt;p class=&quot;test&quot;&gt;A &amp; B&#39;s&lt;/p&gt;'
      );
    });

    it('returns empty string for null', () => {
      expect(escapeXml(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(escapeXml(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(escapeXml('')).toBe('');
    });

    it('preserves text without special characters', () => {
      expect(escapeXml('Hello World')).toBe('Hello World');
    });
  });

  describe('createXmlDoc', () => {
    it('creates XML document from string', () => {
      const doc = createXmlDoc('<root><child>text</child></root>');
      expect(doc).toBeDefined();
      expect(doc.documentElement.tagName).toBe('root');
    });

    it('parses nested elements', () => {
      const doc = createXmlDoc('<parent><child><grandchild/></child></parent>');
      const grandchild = doc.querySelector('grandchild');
      expect(grandchild).not.toBeNull();
    });

    it('preserves attributes', () => {
      const doc = createXmlDoc('<element attr="value" role="key"/>');
      const el = doc.querySelector('element');
      expect(el.getAttribute('attr')).toBe('value');
      expect(el.getAttribute('role')).toBe('key');
    });

    it('handles XML with text content', () => {
      const doc = createXmlDoc('<text>Hello World</text>');
      const textEl = doc.querySelector('text');
      expect(textEl.textContent).toBe('Hello World');
    });

    it('uses lowercase tagNames for XML', () => {
      const doc = createXmlDoc('<dictionary><string role="key" value="test"/></dictionary>');
      const dict = doc.querySelector('dictionary');
      const str = doc.querySelector('string');
      expect(dict.tagName).toBe('dictionary');
      expect(str.tagName).toBe('string');
    });
  });

  describe('parseDictionary', () => {
    it('returns dictionary element from XML', () => {
      const dict = parseDictionary('<dictionary><child/></dictionary>');
      expect(dict).not.toBeNull();
      expect(dict.tagName).toBe('dictionary');
    });

    it('finds dictionary in nested structure', () => {
      const dict = parseDictionary('<root><wrapper><dictionary><content/></dictionary></wrapper></root>');
      expect(dict).not.toBeNull();
      expect(dict.querySelector('content')).not.toBeNull();
    });

    it('returns first dictionary if multiple exist', () => {
      const dict = parseDictionary('<root><dictionary id="first"/><dictionary id="second"/></root>');
      expect(dict.getAttribute('id')).toBe('first');
    });

    it('returns null when no dictionary exists', () => {
      const dict = parseDictionary('<root><other/></root>');
      expect(dict).toBeNull();
    });

    it('handles dictionary with key-value pairs', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="title"></string>
          <unicode value="Test Title"></unicode>
        </dictionary>
      `);
      const keyEl = dict.querySelector('string[role="key"]');
      expect(keyEl.getAttribute('value')).toBe('title');
    });
  });

  describe('textAreaFieldXml', () => {
    it('generates TextAreaField XML structure', () => {
      const xml = textAreaFieldXml('Hello World');
      expect(xml).toContain('exe.engine.field.TextAreaField');
      expect(xml).toContain('content_w_resourcePaths');
    });

    it('escapes HTML content in the field', () => {
      const xml = textAreaFieldXml('<p>Test</p>');
      expect(xml).toContain('&lt;p&gt;Test&lt;/p&gt;');
    });

    it('can be parsed as valid XML', () => {
      const xml = textAreaFieldXml('Content');
      const fullXml = `<root>${xml}</root>`;
      const doc = createXmlDoc(fullXml);
      const instance = doc.querySelector('instance');
      expect(instance).not.toBeNull();
      expect(instance.getAttribute('class')).toBe('exe.engine.field.TextAreaField');
    });

    it('handles empty content', () => {
      const xml = textAreaFieldXml('');
      expect(xml).toContain('unicode value=""');
    });

    it('handles null content', () => {
      const xml = textAreaFieldXml(null);
      expect(xml).toContain('unicode value=""');
    });

    it('handles content with special characters', () => {
      const xml = textAreaFieldXml('A & B <script>');
      expect(xml).toContain('A &amp; B &lt;script&gt;');
    });
  });
});
