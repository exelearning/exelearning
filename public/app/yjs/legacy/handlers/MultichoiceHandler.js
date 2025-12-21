/**
 * MultichoiceHandler
 *
 * Handles legacy MultichoiceIdevice and MultiSelectIdevice.
 * Converts to modern 'form' iDevice with questionsData.
 *
 * Legacy XML structure:
 * - exe.engine.multichoiceidevice.MultichoiceIdevice (single choice)
 * - exe.engine.multiselectidevice.MultiSelectIdevice (multiple choice)
 *
 * Uses QuizQuestionField with QuizOptionField for options.
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class MultichoiceHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('MultichoiceIdevice') ||
           className.includes('MultiSelectIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'form';
  }

  /**
   * Extract questionsData from the legacy format
   */
  extractProperties(dict) {
    const questionsData = this.extractQuestions(dict);
    if (questionsData.length > 0) {
      return { questionsData };
    }
    return {};
  }

  /**
   * Extract questions from legacy MultichoiceIdevice format
   *
   * Structure:
   * - questions -> list of QuizQuestionField
   * - QuizQuestionField.questionTextArea -> question text
   * - QuizQuestionField.options -> list of QuizOptionField
   * - QuizOptionField.answerTextArea -> option text
   * - QuizOptionField.isCorrect -> boolean
   *
   * @param {Element} dict - Dictionary element of the MultichoiceIdevice
   * @returns {Array} Array of question objects in form iDevice format
   */
  extractQuestions(dict) {
    const questionsData = [];

    // Find "questions" list in dictionary
    const questionsList = this.findDictList(dict, 'questions');
    if (!questionsList) return questionsData;

    // Iterate each QuizQuestionField
    const questionFields = questionsList.querySelectorAll(':scope > instance');
    for (const questionField of questionFields) {
      const qDict = questionField.querySelector(':scope > dictionary');
      if (!qDict) continue;

      // Extract question text from questionTextArea
      const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
      const questionText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';

      // Extract options from options list
      const optionsList = this.findDictList(qDict, 'options');
      const answers = [];
      let correctCount = 0;

      if (optionsList) {
        const optionFields = optionsList.querySelectorAll(':scope > instance');
        for (const optionField of optionFields) {
          const optDict = optionField.querySelector(':scope > dictionary');
          if (!optDict) continue;

          // Get answer text from answerTextArea
          const answerTextArea = this.findDictInstance(optDict, 'answerTextArea');
          const optionHtml = answerTextArea ? this.extractTextAreaFieldContent(answerTextArea) : '';
          // Strip HTML tags to get plain text (matches Symfony's strip_tags())
          const optionText = this.stripHtmlTags(optionHtml);

          // Get isCorrect flag
          const isCorrect = this.findDictBoolValue(optDict, 'isCorrect');

          if (isCorrect) correctCount++;
          answers.push([isCorrect, optionText]);
        }
      }

      // Only add if we have a question or answers
      if (questionText || answers.length > 0) {
        questionsData.push({
          activityType: 'selection',
          selectionType: correctCount > 1 ? 'multiple' : 'single',
          baseText: questionText,
          answers: answers
        });
      }
    }

    return questionsData;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MultichoiceHandler;
} else {
  window.MultichoiceHandler = MultichoiceHandler;
}
