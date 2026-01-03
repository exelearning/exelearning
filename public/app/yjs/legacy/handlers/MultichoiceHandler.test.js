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

    it('sets _isMultiSelect to false for MultichoiceIdevice', () => {
      handler.canHandle('exe.engine.multichoiceidevice.MultichoiceIdevice');
      expect(handler._isMultiSelect).toBe(false);
    });

    it('sets _isMultiSelect to true for MultiSelectIdevice', () => {
      handler.canHandle('exe.engine.multiselectidevice.MultiSelectIdevice');
      expect(handler._isMultiSelect).toBe(true);
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

    it('uses single selectionType for MultichoiceIdevice even with multiple correct answers', () => {
      // First call canHandle to set the iDevice type
      handler.canHandle('exe.engine.multichoiceidevice.MultichoiceIdevice');

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
      // MultichoiceIdevice always uses 'single' (radio buttons)
      expect(questions[0].selectionType).toBe('single');
    });

    it('uses multiple selectionType for MultiSelectIdevice', () => {
      // First call canHandle to set the iDevice type
      handler.canHandle('exe.engine.multiselectidevice.MultiSelectIdevice');

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
      // MultiSelectIdevice always uses 'multiple' (checkboxes)
      expect(questions[0].selectionType).toBe('multiple');
    });

    it('returns empty array when no questions list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const questions = handler.extractQuestions(dict);
      expect(questions).toEqual([]);
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
              <unicode value="${escapeXml('<p>Select the correct answer</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Select the correct answer</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no instructions', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });
  });

  describe('extractFeedback', () => {
    it('extracts feedback from feedback TextAreaField', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="feedback"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Well done!</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const feedback = handler.extractFeedback(dict);
      expect(feedback).toBe('<p>Well done!</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractFeedback(null)).toBe('');
    });

    it('returns empty string when no feedback field', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractFeedback(dict)).toBe('');
    });
  });

  describe('hint extraction', () => {
    it('extracts hint from hintTextArea', () => {
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
                <string role="key" value="hintTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Think of addition</p>')}"></unicode>
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

      const questions = handler.extractQuestions(dict);

      expect(questions[0].hint).toBe('<p>Think of addition</p>');
    });

    it('does not include hint when empty', () => {
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
                <list></list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);

      expect(questions[0].hint).toBeUndefined();
    });
  });

  describe('option feedback extraction', () => {
    it('extracts feedback from option feedbackTextArea', () => {
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
                      <string role="key" value="feedbackTextArea"></string>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"></string>
                          <unicode value="${escapeXml('<p>Correct! Well done.</p>')}"></unicode>
                        </dictionary>
                      </instance>
                    </dictionary>
                  </instance>
                </list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const questions = handler.extractQuestions(dict);

      // Answer with feedback has 3 elements: [isCorrect, text, feedback]
      expect(questions[0].answers[0]).toEqual([true, '4', '<p>Correct! Well done.</p>']);
    });

    it('does not include feedback element when empty', () => {
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

      const questions = handler.extractQuestions(dict);

      // Answer without feedback has 2 elements: [isCorrect, text]
      expect(questions[0].answers[0]).toEqual([true, '4']);
    });
  });

  describe('eXeFormInstructions in extractProperties', () => {
    it('includes eXeFormInstructions when instructions are present', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="instructionsForLearners"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Choose wisely</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.field.QuizQuestionField">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>What is 1+1?</p>')}"></unicode>
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
                </list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeFormInstructions).toBe('<p>Choose wisely</p>');
      expect(result.questionsData).toBeDefined();
      expect(result.questionsData.length).toBe(1);
    });

    it('does not include eXeFormInstructions when no instructions', () => {
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
                    <unicode value="${escapeXml('<p>What is 1+1?</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="options"></string>
                <list></list>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const result = handler.extractProperties(dict);

      expect(result.eXeFormInstructions).toBeUndefined();
      expect(result.questionsData).toBeDefined();
    });
  });
});
