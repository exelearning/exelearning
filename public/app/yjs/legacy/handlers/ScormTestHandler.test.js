/**
 * ScormTestHandler Tests
 *
 * Unit tests for ScormTestHandler - handles ScormTestIdevice (SCORM quiz format).
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const ScormTestHandler = require('./ScormTestHandler');

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

describe('ScormTestHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new ScormTestHandler();
  });

  describe('canHandle', () => {
    it('returns true for ScormTestIdevice', () => {
      expect(handler.canHandle('exe.engine.quiztestidevice.ScormTestIdevice')).toBe(true);
    });

    it('returns true for QuizTestIdevice', () => {
      expect(handler.canHandle('exe.engine.quiztestidevice.QuizTestIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });

    it('returns false for similar but different class names', () => {
      expect(handler.canHandle('exe.engine.quizidevice.QuizIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns form', () => {
      expect(handler.getTargetType()).toBe('form');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts instructionsForLearners', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Answer the following questions:</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Answer the following questions:</p>');
    });

    it('returns empty string when no instructions', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts questionsData from questions list', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.TestQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>What is 2+2?</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="3"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="0"></bool>
                    </dictionary>
                  </instance>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="4"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                </list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.questionsData).toBeDefined();
      expect(props.questionsData.length).toBe(1);
      expect(props.questionsData[0].activityType).toBe('selection');
      expect(props.questionsData[0].selectionType).toBe('single');
      expect(props.questionsData[0].baseText).toBe('<p>What is 2+2?</p>');
      expect(props.questionsData[0].answers).toEqual([
        [false, '3'],
        [true, '4']
      ]);
    });

    it('sets selectionType to multiple when multiple correct answers', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.TestQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Select all prime numbers:</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="2"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="3"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="4"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="0"></bool>
                    </dictionary>
                  </instance>
                </list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.questionsData[0].selectionType).toBe('multiple');
      expect(props.questionsData[0].answers).toEqual([
        [true, '2'],
        [true, '3'],
        [false, '4']
      ]);
    });

    it('handles multiple questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.TestQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question 1</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="A"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                </list>
              </dictionary>
            </instance>
            <instance class="exe.engine.quiztestidevice.TestQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question 2</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="B"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                </list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.questionsData.length).toBe(2);
      expect(props.questionsData[0].baseText).toBe('<p>Question 1</p>');
      expect(props.questionsData[1].baseText).toBe('<p>Question 2</p>');
    });

    it('returns empty object when no questions', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });

    it('returns empty object for null dict', () => {
      const props = handler.extractProperties(null);
      expect(props).toEqual({});
    });

    it('strips HTML from answer text', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.TestQuestion">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p><strong>Bold</strong> answer</p>')}"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                </list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);
      expect(props.questionsData[0].answers[0][1]).toBe('Bold answer');
    });
  });

  describe('extractQuestions', () => {
    it('returns empty array when questions list not found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const questions = handler.extractQuestions(dict);
      expect(questions).toEqual([]);
    });

    it('skips questions without dictionary', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.TestQuestion">
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);
      expect(questions).toEqual([]);
    });

    it('handles question with answers but empty text', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.TestQuestion">
              <dictionary>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.quiztestidevice.AnswerOption">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="Answer"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                </list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);
      expect(questions.length).toBe(1);
      expect(questions[0].baseText).toBe('');
      expect(questions[0].answers.length).toBe(1);
    });
  });

  describe('extractOptions', () => {
    it('returns empty array when options list not found', () => {
      const qDict = parseDictionary('<dictionary></dictionary>');
      const options = handler.extractOptions(qDict);
      expect(options).toEqual([]);
    });

    it('skips options without dictionary', () => {
      const qDict = parseDictionary(`
        <dictionary>
          <string role="key" value="options"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.AnswerOption">
            </instance>
          </list>
        </dictionary>
      `);

      const options = handler.extractOptions(qDict);
      expect(options).toEqual([]);
    });

    it('skips options with empty answer text', () => {
      const qDict = parseDictionary(`
        <dictionary>
          <string role="key" value="options"></string>
          <list>
            <instance class="exe.engine.quiztestidevice.AnswerOption">
              <dictionary>
                <string role="key" value="answerTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value=""></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="isCorrect"></string>
                <bool value="1"></bool>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const options = handler.extractOptions(qDict);
      expect(options).toEqual([]);
    });
  });
});
