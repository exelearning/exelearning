/**
 * DropdownHandler Tests
 *
 * Unit tests for DropdownHandler - handles ListaIdevice (dropdown questions).
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const DropdownHandler = require('./DropdownHandler');

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

describe('DropdownHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new DropdownHandler();
  });

  describe('canHandle', () => {
    it('returns true for ListaIdevice', () => {
      expect(handler.canHandle('exe.engine.listaidevice.ListaIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.multichoiceidevice.MultichoiceIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns form', () => {
      expect(handler.getTargetType()).toBe('form');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts from instructionsForLearners', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Select the correct answers</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Select the correct answers</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts questionsData', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Select {{correct}} answer</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="wrongAnswers"></string>
                <unicode value="wrong1,wrong2"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.questionsData).toBeDefined();
      expect(props.questionsData.length).toBe(1);
      expect(props.questionsData[0].activityType).toBe('dropdown');
    });

    it('returns empty object when no questions', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });

  describe('extractDropdownQuestions', () => {
    it('extracts question with wrong answers', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>The capital of France is Paris</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="wrongAnswers"></string>
                <unicode value="London,Berlin,Madrid"></unicode>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractDropdownQuestions(dict);

      expect(questions.length).toBe(1);
      expect(questions[0].wrongAnswersValue).toBe('London,Berlin,Madrid');
    });

    it('handles multiple questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
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
            <instance class="exe.engine.listaidevice.ListaField">
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

      const questions = handler.extractDropdownQuestions(dict);
      expect(questions.length).toBe(2);
    });

    it('looks for questions key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.listaidevice.ListaField">
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

      const questions = handler.extractDropdownQuestions(dict);
      expect(questions.length).toBe(1);
    });

    it('returns empty array when no questions list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const questions = handler.extractDropdownQuestions(dict);
      expect(questions).toEqual([]);
    });
  });

  describe('parseDropdownText', () => {
    it('converts <u> tags to placeholder (real legacy format)', () => {
      const text = '<p>Select the <u>correct</u> answer and <u>another</u> one</p>';
      const result = handler.parseDropdownText(text);

      expect(result.baseText).toBe('<p>Select the {{correct}} answer and {{another}} one</p>');
      expect(result.answers).toEqual(['correct', 'another']);
    });

    it('converts select with selected option to placeholder', () => {
      const text = '<p>Choose <select class="exe-lista-select"><option>wrong</option><option selected>correct</option></select></p>';
      const result = handler.parseDropdownText(text);

      expect(result.baseText).toContain('{{correct}}');
      expect(result.answers).toContain('correct');
    });

    it('converts input data-correct to placeholder', () => {
      const text = '<p>Test <input data-correct="answer"/> here</p>';
      const result = handler.parseDropdownText(text);

      expect(result.baseText).toBe('<p>Test {{answer}} here</p>');
      expect(result.answers).toEqual(['answer']);
    });

    it('returns empty for null input', () => {
      const result = handler.parseDropdownText(null);
      expect(result.baseText).toBe('');
      expect(result.answers).toEqual([]);
    });

    it('handles text without dropdowns', () => {
      const text = '<p>Plain text</p>';
      const result = handler.parseDropdownText(text);

      expect(result.baseText).toBe('<p>Plain text</p>');
      expect(result.answers).toEqual([]);
    });
  });

  describe('extractSingleListaField', () => {
    it('extracts from _encodedContent field and preserves <u> tags', () => {
      // IMPORTANT: baseText should preserve <u> tags - form.js converts them to <select>
      const inst = createXmlDoc(`
        <instance class="exe.engine.listaidevice.ListaField">
          <dictionary>
            <string role="key" value="_encodedContent"></string>
            <unicode value="${escapeXml('<p>Text with <u>answer</u> here</p>')}"></unicode>
            <string role="key" value="otras"></string>
            <unicode value="wrong1|wrong2"></unicode>
          </dictionary>
        </instance>
      `).querySelector('instance');

      const question = handler.extractSingleListaField(inst);

      expect(question).not.toBeNull();
      expect(question.activityType).toBe('dropdown');
      // <u> tags should be preserved, NOT converted to {{placeholders}}
      expect(question.baseText).toBe('<p>Text with <u>answer</u> here</p>');
      expect(question.wrongAnswersValue).toBe('wrong1|wrong2');
    });

    it('extracts from content_w_resourcePaths field with <u> tags preserved', () => {
      const inst = createXmlDoc(`
        <instance class="exe.engine.listaidevice.ListaField">
          <dictionary>
            <string role="key" value="content_w_resourcePaths"></string>
            <unicode value="${escapeXml('<p>Text with <u>word</u> blank</p>')}"></unicode>
          </dictionary>
        </instance>
      `).querySelector('instance');

      const question = handler.extractSingleListaField(inst);

      expect(question).not.toBeNull();
      // <u> tags should be preserved
      expect(question.baseText).toBe('<p>Text with <u>word</u> blank</p>');
    });

    it('returns null for instance without dictionary', () => {
      const inst = createXmlDoc('<instance></instance>').querySelector('instance');
      const question = handler.extractSingleListaField(inst);
      expect(question).toBeNull();
    });
  });

  describe('real legacy XML format (_content key)', () => {
    it('extracts dropdown with eXeFormInstructions and preserves <u> tags', () => {
      // This test matches the real structure from idevices-antiguos.elp
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Lea y complete</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="_content"></string>
          <instance class="exe.engine.listaidevice.ListaField">
            <dictionary>
              <string role="key" value="_encodedContent"></string>
              <unicode value="${escapeXml('<p>Quaerat <u>voluptatem</u>. Ut enim <u>consequatur</u>? Vel <u>eum</u>.</p>')}"></unicode>
              <string role="key" value="otras"></string>
              <unicode value="dfsdf"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const htmlView = handler.extractHtmlView(dict);
      expect(htmlView).toBe('<p>Lea y complete</p>');

      const props = handler.extractProperties(dict);

      // Instructions should be in eXeFormInstructions property
      expect(props.eXeFormInstructions).toBe('<p>Lea y complete</p>');

      expect(props.questionsData).toBeDefined();
      expect(props.questionsData.length).toBe(1);

      const question = props.questionsData[0];
      expect(question.activityType).toBe('dropdown');
      // <u> tags should be PRESERVED - form.js converts them to <select> elements
      expect(question.baseText).toBe('<p>Quaerat <u>voluptatem</u>. Ut enim <u>consequatur</u>? Vel <u>eum</u>.</p>');
      expect(question.wrongAnswersValue).toBe('dfsdf');
    });

    it('handles empty _content', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_content"></string>
          <instance class="exe.engine.listaidevice.ListaField">
            <dictionary></dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });

  describe('extractFeedback', () => {
    it('extracts feedback from feedback field', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>This is the feedback content</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      // Pass Spanish context (default for legacy files)
      const feedback = handler.extractFeedback(dict, { language: 'es' });

      expect(feedback.content).toBe('<p>This is the feedback content</p>');
      // Uses project language for localized default caption
      expect(feedback.buttonCaption).toBe('Mostrar retroalimentación');
    });

    it('extracts feedback with custom buttonCaption', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="buttonCaption"></string>
              <unicode value="Ver solución"></unicode>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Solution here</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict);

      expect(feedback.content).toBe('<p>Solution here</p>');
      expect(feedback.buttonCaption).toBe('Ver solución');
    });

    it('returns empty when no feedback', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const feedback = handler.extractFeedback(dict);

      expect(feedback.content).toBe('');
      expect(feedback.buttonCaption).toBe('');
    });

    it('handles null dict', () => {
      const feedback = handler.extractFeedback(null);

      expect(feedback.content).toBe('');
      expect(feedback.buttonCaption).toBe('');
    });

    it('extracts from feedbackTextArea as fallback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedbackTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Fallback feedback</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict);

      expect(feedback.content).toBe('<p>Fallback feedback</p>');
    });
  });

  describe('feedback in extractProperties', () => {
    it('includes eXeIdeviceTextAfter when feedback present', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_content"></string>
          <instance class="exe.engine.listaidevice.ListaField">
            <dictionary>
              <string role="key" value="_encodedContent"></string>
              <unicode value="${escapeXml('<p>Text with <u>answer</u></p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Feedback content</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.questionsData).toBeDefined();
      // Form iDevice uses eXeIdeviceTextAfter for "content after" section
      expect(props.eXeIdeviceTextAfter).toBe('<p>Feedback content</p>');
    });

    it('includes all properties: questionsData, eXeFormInstructions, and eXeIdeviceTextAfter', () => {
      // Full test matching real idevices-antiguos.elp structure
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Lea y complete</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="_content"></string>
          <instance class="exe.engine.listaidevice.ListaField">
            <dictionary>
              <string role="key" value="_encodedContent"></string>
              <unicode value="${escapeXml('<p>Text with <u>answer</u></p>')}"></unicode>
              <string role="key" value="otras"></string>
              <unicode value="wrong1|wrong2"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>The feedback text here</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      // All three should be present
      expect(props.eXeFormInstructions).toBe('<p>Lea y complete</p>');
      expect(props.questionsData).toBeDefined();
      expect(props.questionsData.length).toBe(1);
      expect(props.questionsData[0].baseText).toBe('<p>Text with <u>answer</u></p>');
      // Feedback goes to eXeIdeviceTextAfter (form iDevice's "content after" field)
      expect(props.eXeIdeviceTextAfter).toBe('<p>The feedback text here</p>');
    });

    it('does not include eXeIdeviceTextAfter when no feedback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_content"></string>
          <instance class="exe.engine.listaidevice.ListaField">
            <dictionary>
              <string role="key" value="_encodedContent"></string>
              <unicode value="${escapeXml('<p>Text with <u>answer</u></p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.questionsData).toBeDefined();
      expect(props.eXeIdeviceTextAfter).toBeUndefined();
    });
  });
});
