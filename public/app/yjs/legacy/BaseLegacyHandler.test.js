/**
 * BaseLegacyHandler Tests
 *
 * Unit tests for BaseLegacyHandler - base class for legacy iDevice handlers.
 */

const BaseLegacyHandler = require('./BaseLegacyHandler');

// Create a real XML DOM parser for proper testing
const createXmlDoc = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

// Helper to get dictionary element from XML
const parseDictionary = (xmlString) => {
  const doc = createXmlDoc(xmlString);
  return doc.querySelector('dictionary');
};

describe('BaseLegacyHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new BaseLegacyHandler();
  });

  describe('abstract methods', () => {
    it('canHandle throws error when not implemented', () => {
      expect(() => handler.canHandle('SomeClass')).toThrow('BaseLegacyHandler.canHandle() must be implemented by subclass');
    });

    it('getTargetType throws error when not implemented', () => {
      expect(() => handler.getTargetType()).toThrow('BaseLegacyHandler.getTargetType() must be implemented by subclass');
    });
  });

  describe('default implementations', () => {
    it('extractProperties returns empty object by default', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractProperties(dict)).toEqual({});
    });

    it('extractHtmlView returns empty string by default', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('extractFeedback returns empty content and buttonCaption by default', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractFeedback(dict)).toEqual({ content: '', buttonCaption: '' });
    });
  });

  describe('findDictStringValue', () => {
    it('finds string value by key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="title"></string>
          <unicode value="Test Title"></unicode>
        </dictionary>
      `);
      expect(handler.findDictStringValue(dict, 'title')).toBe('Test Title');
    });

    it('returns null when key not found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.findDictStringValue(dict, 'nonexistent')).toBeNull();
    });

    it('handles string elements as values', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="name"></string>
          <string value="String value"></string>
        </dictionary>
      `);
      expect(handler.findDictStringValue(dict, 'name')).toBe('String value');
    });

    it('returns null when value element is missing', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="orphan"></string>
        </dictionary>
      `);
      expect(handler.findDictStringValue(dict, 'orphan')).toBeNull();
    });

    it('returns null when value element is not string/unicode', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="notstring"></string>
          <bool value="1"></bool>
        </dictionary>
      `);
      expect(handler.findDictStringValue(dict, 'notstring')).toBeNull();
    });
  });

  describe('findDictBoolValue', () => {
    it('returns true for bool value="1"', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="isCorrect"></string>
          <bool value="1"></bool>
        </dictionary>
      `);
      expect(handler.findDictBoolValue(dict, 'isCorrect')).toBe(true);
    });

    it('returns false for bool value="0"', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="isCorrect"></string>
          <bool value="0"></bool>
        </dictionary>
      `);
      expect(handler.findDictBoolValue(dict, 'isCorrect')).toBe(false);
    });

    it('returns false when key not found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.findDictBoolValue(dict, 'nonexistent')).toBe(false);
    });
  });

  describe('findDictList', () => {
    it('finds list element by key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance></instance>
          </list>
        </dictionary>
      `);
      const result = handler.findDictList(dict, 'questions');
      expect(result).not.toBeNull();
      expect(result.tagName).toBe('list');
    });

    it('returns null when key not found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.findDictList(dict, 'nonexistent')).toBeNull();
    });

    it('returns null when value is not a list', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="title"></string>
          <unicode value="Not a list"></unicode>
        </dictionary>
      `);
      expect(handler.findDictList(dict, 'title')).toBeNull();
    });
  });

  describe('findDictInstance', () => {
    it('finds instance element by key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="textArea"></string>
          <instance class="TextAreaField">
            <dictionary></dictionary>
          </instance>
        </dictionary>
      `);
      const result = handler.findDictInstance(dict, 'textArea');
      expect(result).not.toBeNull();
      expect(result.tagName).toBe('instance');
      expect(result.getAttribute('class')).toBe('TextAreaField');
    });

    it('returns null when key not found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.findDictInstance(dict, 'nonexistent')).toBeNull();
    });
  });

  describe('extractTextAreaFieldContent', () => {
    it('extracts content from TextAreaField with content_w_resourcePaths', () => {
      const doc = createXmlDoc(`
        <instance class="exe.engine.field.TextAreaField">
          <dictionary>
            <string role="key" value="content_w_resourcePaths"></string>
            <unicode value="&lt;p&gt;Test content&lt;/p&gt;"></unicode>
          </dictionary>
        </instance>
      `);
      const textArea = doc.querySelector('instance');
      expect(handler.extractTextAreaFieldContent(textArea)).toBe('<p>Test content</p>');
    });

    it('extracts from _content key as fallback', () => {
      const doc = createXmlDoc(`
        <instance class="exe.engine.field.TextAreaField">
          <dictionary>
            <string role="key" value="_content"></string>
            <unicode value="&lt;p&gt;Fallback content&lt;/p&gt;"></unicode>
          </dictionary>
        </instance>
      `);
      const textArea = doc.querySelector('instance');
      expect(handler.extractTextAreaFieldContent(textArea)).toBe('<p>Fallback content</p>');
    });

    it('returns empty string for null input', () => {
      expect(handler.extractTextAreaFieldContent(null)).toBe('');
    });

    it('returns empty string when no dictionary', () => {
      const doc = createXmlDoc('<instance></instance>');
      const inst = doc.querySelector('instance');
      expect(handler.extractTextAreaFieldContent(inst)).toBe('');
    });

    it('returns empty string when no content found', () => {
      const doc = createXmlDoc(`
        <instance>
          <dictionary>
            <string role="key" value="other"></string>
            <unicode value="value"></unicode>
          </dictionary>
        </instance>
      `);
      const inst = doc.querySelector('instance');
      expect(handler.extractTextAreaFieldContent(inst)).toBe('');
    });
  });

  describe('extractFeedbackFieldContent', () => {
    it('extracts feedback content and button caption', () => {
      const doc = createXmlDoc(`
        <instance>
          <dictionary>
            <string role="key" value="feedback"></string>
            <unicode value="&lt;p&gt;Feedback text&lt;/p&gt;"></unicode>
            <string role="key" value="_buttonCaption"></string>
            <unicode value="Show Answer"></unicode>
          </dictionary>
        </instance>
      `);
      const inst = doc.querySelector('instance');

      const result = handler.extractFeedbackFieldContent(inst);
      expect(result.content).toBe('<p>Feedback text</p>');
      expect(result.buttonCaption).toBe('Show Answer');
    });

    it('returns empty content for null input', () => {
      const result = handler.extractFeedbackFieldContent(null);
      expect(result.content).toBe('');
      expect(result.buttonCaption).toBe('');
    });

    it('returns default button caption when not found', () => {
      const doc = createXmlDoc(`
        <instance>
          <dictionary>
            <string role="key" value="feedback"></string>
            <unicode value="&lt;p&gt;Feedback&lt;/p&gt;"></unicode>
          </dictionary>
        </instance>
      `);
      const inst = doc.querySelector('instance');

      const result = handler.extractFeedbackFieldContent(inst);
      expect(result.buttonCaption).toBe('Show Feedback');
    });

    it('returns empty when no dictionary', () => {
      const doc = createXmlDoc('<instance></instance>');
      const inst = doc.querySelector('instance');
      const result = handler.extractFeedbackFieldContent(inst);
      expect(result.content).toBe('');
    });
  });

  describe('decodeHtmlContent', () => {
    it('decodes HTML entities', () => {
      const encoded = '&lt;p&gt;Test &amp; more&lt;/p&gt;';
      expect(handler.decodeHtmlContent(encoded)).toBe('<p>Test & more</p>');
    });

    it('decodes quote entities', () => {
      const encoded = '&quot;Hello&#39;';
      expect(handler.decodeHtmlContent(encoded)).toBe('"Hello\'');
    });

    it('handles Python unicode escapes', () => {
      const encoded = 'Line1\\nLine2\\tTabbed';
      expect(handler.decodeHtmlContent(encoded)).toBe('Line1\nLine2\tTabbed');
    });

    it('preserves LaTeX commands containing backslash-r', () => {
      // LaTeX commands like \right, \rfloor, \rceil, \rho, \rangle should NOT be converted
      const latex = '\\left( \\frac{a}{b} \\right)';
      expect(handler.decodeHtmlContent(latex)).toBe('\\left( \\frac{a}{b} \\right)');
    });

    it('preserves various LaTeX \\r commands', () => {
      const commands = '\\rfloor \\rceil \\rho \\rangle \\rightarrow';
      expect(handler.decodeHtmlContent(commands)).toBe('\\rfloor \\rceil \\rho \\rangle \\rightarrow');
    });

    it('converts standalone \\r to carriage return', () => {
      // Actual carriage return escape (not followed by letters) should still convert
      const withCR = 'Line1\\r\\nLine2';
      expect(handler.decodeHtmlContent(withCR)).toBe('Line1\r\nLine2');
    });

    it('returns empty string for null/empty input', () => {
      expect(handler.decodeHtmlContent(null)).toBe('');
      expect(handler.decodeHtmlContent('')).toBe('');
    });
  });

  describe('stripHtmlTags', () => {
    it('strips simple HTML tags', () => {
      expect(handler.stripHtmlTags('<p>Text</p>')).toBe('Text');
    });

    it('strips nested HTML tags', () => {
      expect(handler.stripHtmlTags('<div><p><strong>Bold</strong></p></div>')).toBe('Bold');
    });

    it('decodes HTML entities when stripping', () => {
      expect(handler.stripHtmlTags('<p>A &amp; B</p>')).toBe('A & B');
    });

    it('handles complex HTML with entities', () => {
      expect(handler.stripHtmlTags('<p>Del siglo XIV al siglo XV</p>')).toBe('Del siglo XIV al siglo XV');
    });

    it('returns empty string for null', () => {
      expect(handler.stripHtmlTags(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(handler.stripHtmlTags(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(handler.stripHtmlTags('')).toBe('');
    });

    it('preserves text without HTML tags', () => {
      expect(handler.stripHtmlTags('Plain text')).toBe('Plain text');
    });

    it('trims whitespace', () => {
      expect(handler.stripHtmlTags('<p>  Text with spaces  </p>')).toBe('Text with spaces');
    });

    it('handles multiple paragraphs', () => {
      expect(handler.stripHtmlTags('<p>Line 1</p><p>Line 2</p>')).toBe('Line 1Line 2');
    });
  });
});
