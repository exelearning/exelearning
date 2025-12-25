/**
 * TrueFalseHandler Tests
 *
 * Unit tests for TrueFalseHandler - handles TrueFalseIdevice.
 * Updated to test game-compatible format output.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const TrueFalseHandler = require('./TrueFalseHandler');

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

describe('TrueFalseHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new TrueFalseHandler();
  });

  describe('canHandle', () => {
    it('returns true for TrueFalseIdevice', () => {
      expect(handler.canHandle('exe.engine.truefalseidevice.TrueFalseIdevice')).toBe(true);
    });

    it('returns true for VerdaderoFalsoFPDIdevice', () => {
      expect(handler.canHandle('exe.engine.verdaderofalsofpdidevice.VerdaderoFalsoFPDIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.multichoiceidevice.MultichoiceIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns trueorfalse', () => {
      expect(handler.getTargetType()).toBe('trueorfalse');
    });
  });

  describe('getDefaultMessages', () => {
    it('returns all required message keys', () => {
      const msgs = handler.getDefaultMessages();
      expect(msgs.msgStartGame).toBe('Click here to start');
      expect(msgs.msgTrue).toBe('True');
      expect(msgs.msgFalse).toBe('False');
      expect(msgs.msgCheck).toBe('Check');
      expect(msgs.msgReboot).toBe('Try again!');
    });
  });

  describe('extractProperties', () => {
    it('returns game-compatible format with typeGame and questionsGame', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>The sky is blue</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractProperties(dict, 'idevice-123');

      expect(result.typeGame).toBe('TrueOrFalse');
      expect(result.questionsGame).toBeDefined();
      expect(result.questionsGame.length).toBe(1);
      expect(result.id).toBe('idevice-123');
      expect(result.ideviceId).toBe('idevice-123');
    });

    it('includes all required game properties', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractProperties(dict, 'idevice-456');

      expect(result.msgs).toBeDefined();
      expect(result.msgs.msgTrue).toBe('True');
      expect(result.isScorm).toBe(0);
      expect(result.repeatActivity).toBe(true);
      expect(result.questionsRandom).toBe(false);
      expect(result.percentageQuestions).toBe(100);
      expect(result.isTest).toBe(false);
      expect(result.time).toBe(0);
      expect(result.evaluation).toBe(false);
    });

    it('returns empty object when no questions found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const result = handler.extractProperties(dict, 'idevice-789');
      expect(result).toEqual({});
    });
  });

  describe('extractQuestionsGame', () => {
    it('extracts true answer correctly (solution=1)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Water is wet</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestionsGame(dict);

      expect(questions.length).toBe(1);
      expect(questions[0].question).toBe('<p>Water is wet</p>');
      expect(questions[0].solution).toBe(1);
    });

    it('extracts false answer correctly (solution=0)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Fire is cold</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="0"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestionsGame(dict);
      expect(questions[0].solution).toBe(0);
    });

    it('extracts suggestion (from hint) and feedback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
                <string role="key" value="hintTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>This is a hint</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>This is feedback</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestionsGame(dict);

      // hint maps to suggestion in game format
      expect(questions[0].suggestion).toBe('<p>This is a hint</p>');
      expect(questions[0].feedback).toBe('<p>This is feedback</p>');
    });

    it('handles multiple questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q1</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Q2</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="0"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestionsGame(dict);
      expect(questions.length).toBe(2);
      expect(questions[0].solution).toBe(1);
      expect(questions[1].solution).toBe(0);
    });

    it('looks for questions in "questions" key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Test</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestionsGame(dict);
      expect(questions.length).toBe(1);
    });

    it('skips questions without text', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestionsGame(dict);
      expect(questions).toEqual([]);
    });
  });

  describe('extractHtmlView', () => {
    it('extracts instructionsForLearners', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Instructions</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Instructions</p>');
    });

    it('returns empty string when no instructions', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('handles null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('eXeGameInstructions in extractProperties', () => {
    it('includes eXeGameInstructions when instructions are present', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Mark each statement as true or false</p>')}"></unicode>
            </dictionary>
          </instance>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>The sun rises in the east</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractProperties(dict, 'idevice-test');

      expect(result.eXeGameInstructions).toBe('<p>Mark each statement as true or false</p>');
      expect(result.questionsGame).toBeDefined();
      expect(result.questionsGame.length).toBe(1);
    });

    it('has empty eXeGameInstructions when no instructions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.truefalseidevice.TrueFalseQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Statement</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractProperties(dict, 'idevice-test');

      expect(result.eXeGameInstructions).toBe('');
      expect(result.questionsGame).toBeDefined();
    });
  });
});
