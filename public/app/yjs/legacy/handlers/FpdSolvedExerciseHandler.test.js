/**
 * FpdSolvedExerciseHandler Tests
 *
 * Unit tests for FpdSolvedExerciseHandler - handles SolvedExerciseIdevice (FPD).
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const FpdSolvedExerciseHandler = require('./FpdSolvedExerciseHandler');

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

describe('FpdSolvedExerciseHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new FpdSolvedExerciseHandler();
  });

  describe('canHandle', () => {
    it('returns true for SolvedExerciseIdevice', () => {
      expect(handler.canHandle('exe.engine.ejercicioresueltofpdidevice.SolvedExerciseIdevice')).toBe(true);
    });

    it('returns true for EjercicioResueltoFpdIdevice', () => {
      expect(handler.canHandle('exe.engine.ejercicioresueltofpdidevice.EjercicioResueltoFpdIdevice')).toBe(true);
    });

    it('returns true for generic ejercicioresueltofpdidevice class', () => {
      expect(handler.canHandle('exe.engine.ejercicioresueltofpdidevice.Question')).toBe(true);
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
    it('extracts story text area', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="storyTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>This is the story introduction.</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>This is the story introduction.</p>');
    });

    it('extracts questions and feedback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.ejercicioresueltofpdidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question 1: What is 2+2?</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="buttonCaption"></string>
                    <unicode value="Ver solución"></unicode>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>The answer is 4.</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toContain('<p>Question 1: What is 2+2?</p>');
      // Check feedback button structure (matching FreeTextHandler pattern)
      expect(html).toContain('class="feedbacktooglebutton"');
      expect(html).toContain('value="Ver solución"');
      expect(html).toContain('class="feedback js-feedback js-hidden"');
      expect(html).toContain('<p>The answer is 4.</p>');
    });

    it('combines story and questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="storyTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Introduction</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.ejercicioresueltofpdidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toContain('<p>Introduction</p>');
      expect(html).toContain('<p>Question</p>');
      // Story should come first
      expect(html.indexOf('Introduction')).toBeLessThan(html.indexOf('Question'));
    });

    it('handles multiple questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.ejercicioresueltofpdidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q1</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.ejercicioresueltofpdidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q2</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toContain('<p>Q1</p>');
      expect(html).toContain('<p>Q2</p>');
    });

    it('uses default button caption when not provided', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.ejercicioresueltofpdidevice.Question">
              <dictionary>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Feedback</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      // Pass Spanish context (default for legacy files)
      const html = handler.extractHtmlView(dict, { language: 'es' });
      // Uses project language for localized default caption
      expect(html).toContain('value="Mostrar retroalimentación"');
      expect(html).toContain('class="feedbacktooglebutton"');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no content', () => {
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
