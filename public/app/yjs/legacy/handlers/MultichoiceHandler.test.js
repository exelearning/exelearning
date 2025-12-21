/**
 * MultichoiceHandler Tests
 *
 * Unit tests for MultichoiceHandler - handles MultichoiceIdevice and MultiSelectIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const MultichoiceHandler = require('./MultichoiceHandler');

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

describe('MultichoiceHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new MultichoiceHandler();
  });

  describe('canHandle', () => {
    it('returns true for MultichoiceIdevice', () => {
      expect(handler.canHandle('exe.engine.multichoiceidevice.MultichoiceIdevice')).toBe(true);
    });

    it('returns true for MultiSelectIdevice', () => {
      expect(handler.canHandle('exe.engine.multiselectidevice.MultiSelectIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
      expect(handler.canHandle('exe.engine.truefalseidevice.TrueFalseIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns form', () => {
      expect(handler.getTargetType()).toBe('form');
    });
  });

  describe('extractProperties', () => {
    it('extracts questionsData from dictionary', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.field.QuizQuestionField">
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
                  <instance class="exe.engine.field.QuizOptionField">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>4</p>')}"></unicode>
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

      const result = handler.extractProperties(dict);

      expect(result.questionsData).toBeDefined();
      expect(result.questionsData.length).toBe(1);
      expect(result.questionsData[0].activityType).toBe('selection');
      expect(result.questionsData[0].selectionType).toBe('single');
    });

    it('returns empty object when no questions found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const result = handler.extractProperties(dict);
      expect(result).toEqual({});
    });
  });

  describe('extractQuestions', () => {
    it('extracts single choice question correctly', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.field.QuizQuestionField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Capital of France?</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.field.QuizOptionField">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>London</p>')}"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="0"></bool>
                    </dictionary>
                  </instance>
                  <instance class="exe.engine.field.QuizOptionField">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>Paris</p>')}"></unicode>
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
      expect(questions[0].selectionType).toBe('single');
      // Options are stripped of HTML tags (matches Symfony's strip_tags())
      expect(questions[0].answers[0]).toEqual([false, 'London']);
      expect(questions[0].answers[1]).toEqual([true, 'Paris']);
    });

    it('strips HTML from option text (matches Symfony strip_tags)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.field.QuizQuestionField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>What century?</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.field.QuizOptionField">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>Del siglo XIV al siglo XV</p>')}"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                  <instance class="exe.engine.field.QuizOptionField">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>A &amp; B options</p>')}"></unicode>
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

      const questions = handler.extractQuestions(dict);

      expect(questions[0].answers[0]).toEqual([true, 'Del siglo XIV al siglo XV']);
      expect(questions[0].answers[1]).toEqual([false, 'A & B options']);
    });

    it('extracts multiple choice question correctly', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.field.QuizQuestionField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Select even numbers</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list>
                  <instance class="exe.engine.field.QuizOptionField">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>2</p>')}"></unicode>
                        </dictionary>
                      </instance>
                      <string role="key" value="isCorrect"></string>
                      <bool value="1"></bool>
                    </dictionary>
                  </instance>
                  <instance class="exe.engine.field.QuizOptionField">
                    <dictionary>
                      <string role="key" value="answerTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>4</p>')}"></unicode>
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
      expect(questions[0].selectionType).toBe('multiple');
    });

    it('returns empty array when no questions list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const questions = handler.extractQuestions(dict);
      expect(questions).toEqual([]);
    });
  });
});
