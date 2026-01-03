/**
 * ScormTestHandler
 *
 * Handles legacy ScormTestIdevice/QuizTestIdevice (SCORM quiz format).
 * Converts to modern 'form' iDevice with selection questions.
 *
 * Legacy XML structure:
 * - exe.engine.quiztestidevice.ScormTestIdevice
 * - exe.engine.quiztestidevice.QuizTestIdevice
 *
 * Extracts:
 * - passRate → dropdownPassRate
 * - questions list with TestQuestion instances
 * - Each question has options (AnswerOption instances)
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class ScormTestHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('ScormTestIdevice') ||
           className.includes('QuizTestIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'form';
  }

  /**
   * Extract HTML view - QuizTestIdevice doesn't have instructionsForLearners
   * per Symfony legacy which comments out eXeFormInstructions.
   */
  extractHtmlView(dict) {
    // QuizTestIdevice/ScormTestIdevice doesn't have instructionsForLearners
    // Symfony's OdeOldXmlScormTestIdevice.php comments out eXeFormInstructions
    return '';
  }

  /**
   * Extract properties including questionsData, dropdownPassRate, etc.
   * Follows Symfony's OdeOldXmlScormTestIdevice.php pattern.
   */
  extractProperties(dict) {
    if (!dict) return {};

    const questionsData = this.extractQuestions(dict);

    if (questionsData.length === 0) {
      return {};
    }

    const props = {
      questionsData,
      checkAddBtnAnswers: true,
      userTranslations: {
        langTrueFalseHelp: 'Select whether the statement is true or false',
        langDropdownHelp: 'Choose the correct answer among the options proposed',
        langSingleSelectionHelp: 'Multiple choice with only one correct answer',
        langMultipleSelectionHelp: 'Multiple choice with multiple corrects answers',
        langFillHelp: 'Fill in the blanks with the appropriate word'
      }
    };

    // Extract passRate → dropdownPassRate
    const passRate = this.findDictStringValue(dict, 'passRate');
    if (passRate) {
      props.dropdownPassRate = passRate;
    }

    return props;
  }

  /**
   * Extract questions from the legacy SCORM test format
   *
   * Structure:
   * - "questions" key contains a list of TestQuestion instances
   * - Each TestQuestion has: questionTextArea, options (list of AnswerOption)
   *
   * @param {Element} dict - Dictionary element of the ScormTestIdevice
   * @returns {Array} Array of question objects in form iDevice format
   */
  extractQuestions(dict) {
    const questionsData = [];

    // Find questions list
    const questionsList = this.findDictList(dict, 'questions');
    if (!questionsList) return questionsData;

    // Iterate over TestQuestion instances
    const questions = questionsList.querySelectorAll(':scope > instance[class*="TestQuestion"]');
    for (const q of questions) {
      const qDict = q.querySelector(':scope > dictionary');
      if (!qDict) continue;

      // Extract question text
      const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
      const baseText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';

      // Extract options/answers
      const answers = this.extractOptions(qDict);

      // Determine if multiple answers are correct
      const correctCount = answers.filter(a => a[0] === true).length;
      const selectionType = correctCount > 1 ? 'multiple' : 'single';

      if (baseText || answers.length > 0) {
        questionsData.push({
          activityType: 'selection',
          selectionType: selectionType,
          baseText: baseText,
          answers: answers
        });
      }
    }

    return questionsData;
  }

  /**
   * Extract answer options from a question dictionary
   *
   * @param {Element} qDict - Question dictionary element
   * @returns {Array} Array of [isCorrect, answerText] pairs
   */
  extractOptions(qDict) {
    const answers = [];

    // Look for options list
    const optionsList = this.findDictList(qDict, 'options');
    if (!optionsList) return answers;

    // Iterate over AnswerOption instances
    const options = optionsList.querySelectorAll(':scope > instance[class*="AnswerOption"]');
    for (const opt of options) {
      const optDict = opt.querySelector(':scope > dictionary');
      if (!optDict) continue;

      // Extract answer text
      const answerTextArea = this.findDictInstance(optDict, 'answerTextArea');
      let answerText = '';
      if (answerTextArea) {
        answerText = this.extractTextAreaFieldContent(answerTextArea);
        // Strip HTML for answer text
        answerText = this.stripHtmlTags(answerText);
      }

      // Extract isCorrect
      const isCorrect = this.findDictBoolValue(optDict, 'isCorrect');

      if (answerText) {
        answers.push([isCorrect, answerText]);
      }
    }

    return answers;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScormTestHandler;
} else {
  window.ScormTestHandler = ScormTestHandler;
}
