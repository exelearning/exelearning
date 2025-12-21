/**
 * DropdownHandler
 *
 * Handles legacy ListaIdevice (dropdown/select questions).
 * Converts to modern 'form' iDevice with dropdown questions.
 *
 * Legacy XML structure:
 * - exe.engine.listaidevice.ListaIdevice
 *
 * Extracts:
 * - Questions with dropdown placeholders {{answer}}
 * - Wrong answers (distractors)
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class DropdownHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('ListaIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'form';
  }

  /**
   * Extract instructions HTML
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for instructionsForLearners
    const instructionsArea = this.findDictInstance(dict, 'instructionsForLearners');
    if (instructionsArea) {
      return this.extractTextAreaFieldContent(instructionsArea);
    }

    return '';
  }

  /**
   * Extract properties including questionsData
   */
  extractProperties(dict) {
    const questionsData = this.extractDropdownQuestions(dict);
    if (questionsData.length > 0) {
      return { questionsData };
    }
    return {};
  }

  /**
   * Extract dropdown questions from the legacy format
   *
   * Structure:
   * - list of ListaField instances
   * - Each has: questionTextArea, wrongAnswers
   *
   * @param {Element} dict - Dictionary element of the ListaIdevice
   * @returns {Array} Array of question objects in form iDevice format
   */
  extractDropdownQuestions(dict) {
    const questionsData = [];

    // Find the list containing ListaField instances
    const lists = dict.querySelectorAll(':scope > list');
    let questionsList = null;

    for (const list of lists) {
      const firstInst = list.querySelector(':scope > instance');
      if (firstInst) {
        const className = firstInst.getAttribute('class') || '';
        if (className.includes('ListaField')) {
          questionsList = list;
          break;
        }
      }
    }

    // Alternative: questions may be in a "questions" or "_questions" key
    if (!questionsList) {
      questionsList = this.findDictList(dict, 'questions') ||
                      this.findDictList(dict, '_questions');
    }

    if (!questionsList) return questionsData;

    // Iterate each ListaField
    const questionInstances = questionsList.querySelectorAll(':scope > instance');
    for (const questionInst of questionInstances) {
      const qDict = questionInst.querySelector(':scope > dictionary');
      if (!qDict) continue;

      // Extract question text (contains {{answer}} placeholders)
      const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
      let questionText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';

      // Extract wrong answers (distractors)
      const wrongAnswers = this.findDictStringValue(qDict, 'wrongAnswers') ||
                          this.findDictStringValue(qDict, '_wrongAnswers') || '';

      // Parse the question text to find dropdown markers
      // Legacy format may have various markers for dropdowns
      const parsedQuestion = this.parseDropdownText(questionText);

      if (parsedQuestion.baseText) {
        questionsData.push({
          activityType: 'dropdown',
          baseText: parsedQuestion.baseText,
          wrongAnswersValue: wrongAnswers,
          answers: parsedQuestion.answers || []
        });
      }
    }

    return questionsData;
  }

  /**
   * Parse dropdown text to extract answers and convert to modern format
   *
   * Legacy formats may use:
   * - <select> elements with options
   * - Special delimiters for answers
   *
   * Modern format uses: {{answer}}
   *
   * @param {string} text - Raw question text
   * @returns {Object} { baseText, answers }
   */
  parseDropdownText(text) {
    if (!text) return { baseText: '', answers: [] };

    const answers = [];
    let baseText = text;

    // Pattern 1: <select class="exe-lista-*">...<option selected>answer</option>...</select>
    baseText = baseText.replace(
      /<select[^>]*class="[^"]*exe-lista[^"]*"[^>]*>.*?<option[^>]*selected[^>]*>([^<]+)<\/option>.*?<\/select>/gis,
      (match, answer) => {
        answers.push(answer.trim());
        return '{{' + answer.trim() + '}}';
      }
    );

    // Pattern 2: <select>...<option value="correct">answer</option>...</select>
    baseText = baseText.replace(
      /<select[^>]*>.*?<option[^>]*value="[^"]*correct[^"]*"[^>]*>([^<]+)<\/option>.*?<\/select>/gis,
      (match, answer) => {
        answers.push(answer.trim());
        return '{{' + answer.trim() + '}}';
      }
    );

    // Pattern 3: Input with data-correct attribute
    baseText = baseText.replace(
      /<input[^>]*data-correct="([^"]+)"[^>]*>/gi,
      (match, answer) => {
        answers.push(answer);
        return '{{' + answer + '}}';
      }
    );

    return { baseText, answers };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DropdownHandler;
} else {
  window.DropdownHandler = DropdownHandler;
}
