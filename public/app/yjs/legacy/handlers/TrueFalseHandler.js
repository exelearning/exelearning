/**
 * TrueFalseHandler
 *
 * Handles legacy TrueFalseIdevice.
 * Converts to modern 'form' iDevice with true-false questions.
 *
 * Legacy XML structure:
 * - exe.engine.truefalseidevice.TrueFalseIdevice
 * - exe.engine.verdaderofalsofpdidevice.VerdaderoFalsoFPDIdevice (Spanish variant)
 *
 * Uses TrueFalseQuestion with isCorrect, hint, feedback fields.
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class TrueFalseHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('TrueFalseIdevice') ||
           className.includes('VerdaderoFalsoFPDIdevice');
  }

  /**
   * Get the target modern iDevice type
   * Note: Symfony uses 'trueorfalse' but we map to 'form' for consistency
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
   * Extract questions from legacy TrueFalseIdevice format
   *
   * Structure:
   * - list of TrueFalseQuestion instances
   * - TrueFalseQuestion has: questionTextArea, isCorrect, hintTextArea, feedbackTextArea
   *
   * @param {Element} dict - Dictionary element of the TrueFalseIdevice
   * @returns {Array} Array of question objects in form iDevice format
   */
  extractQuestions(dict) {
    const questionsData = [];

    // Find the list containing TrueFalseQuestion instances
    // Look for <list> elements containing TrueFalseQuestion
    const lists = dict.querySelectorAll(':scope > list');
    let questionsList = null;

    for (const list of lists) {
      const firstInst = list.querySelector(':scope > instance');
      if (firstInst) {
        const className = firstInst.getAttribute('class') || '';
        if (className.includes('TrueFalseQuestion')) {
          questionsList = list;
          break;
        }
      }
    }

    // Alternative: questions may be in a "questions" key
    if (!questionsList) {
      questionsList = this.findDictList(dict, 'questions');
    }

    if (!questionsList) return questionsData;

    // Iterate each TrueFalseQuestion
    const questionInstances = questionsList.querySelectorAll(':scope > instance');
    for (const questionInst of questionInstances) {
      const qDict = questionInst.querySelector(':scope > dictionary');
      if (!qDict) continue;

      // Extract question text
      const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
      // Alternative key used in some versions
      const altTextArea = questionTextArea || qDict.querySelector('instance[class*="TextAreaField"]');
      const questionText = altTextArea ? this.extractTextAreaFieldContent(altTextArea) : '';

      // Get isCorrect flag (determines if statement is true or false)
      const isCorrect = this.findDictBoolValue(qDict, 'isCorrect');

      // Extract hint (optional)
      const hintTextArea = this.findDictInstance(qDict, 'hintTextArea');
      const hint = hintTextArea ? this.extractTextAreaFieldContent(hintTextArea) : '';

      // Extract feedback (optional)
      const feedbackTextArea = this.findDictInstance(qDict, 'feedbackTextArea');
      const feedback = feedbackTextArea ? this.extractTextAreaFieldContent(feedbackTextArea) : '';

      // Only add if we have question text
      if (questionText) {
        questionsData.push({
          activityType: 'true-false',
          baseText: questionText,
          answer: isCorrect ? 'True' : 'False',
          hint: hint,
          feedback: feedback
        });
      }
    }

    return questionsData;
  }

  /**
   * Extract instructions HTML (optional intro text)
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // TrueFalseIdevice may have instructionsForLearners
    const instructionsArea = this.findDictInstance(dict, 'instructionsForLearners');
    if (instructionsArea) {
      return this.extractTextAreaFieldContent(instructionsArea);
    }

    // Alternative: direct TextAreaField for instructions
    const textArea = dict.querySelector(':scope > instance[class*="TextAreaField"]');
    if (textArea) {
      return this.extractTextAreaFieldContent(textArea);
    }

    return '';
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TrueFalseHandler;
} else {
  window.TrueFalseHandler = TrueFalseHandler;
}
