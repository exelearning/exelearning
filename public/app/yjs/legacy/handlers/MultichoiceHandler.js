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
  constructor() {
    super();
    // Track the iDevice class to determine selection type
    this._isMultiSelect = false;
  }

  /**
   * Check if this handler can process the given legacy class
   * Also stores whether this is a MultiSelect iDevice for later use
   */
  canHandle(className) {
    const canHandle = className.includes('MultichoiceIdevice') ||
                      className.includes('MultiSelectIdevice');
    if (canHandle) {
      // Store whether this is a multi-select iDevice
      // MultiSelectIdevice allows multiple answers (checkboxes)
      // MultichoiceIdevice allows only one answer (radio buttons)
      this._isMultiSelect = className.includes('MultiSelectIdevice');
    }
    return canHandle;
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'form';
  }

  /**
   * Extract instructions HTML (if present)
   * MultichoiceIdevice typically doesn't have instructionsForLearners,
   * but we check anyway for compatibility.
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for instructionsForLearners (may not exist in Multichoice)
    const instructionsArea = this.findDictInstance(dict, 'instructionsForLearners');
    if (instructionsArea) {
      return this.extractTextAreaFieldContent(instructionsArea);
    }

    return '';
  }

  /**
   * Extract feedback from iDevice level (if present)
   * MultichoiceIdevice has per-option feedback, not iDevice-level,
   * but we check for compatibility with other formats.
   */
  extractFeedback(dict) {
    if (!dict) return '';

    // Look for feedback TextAreaField at iDevice level
    const feedbackField = this.findDictInstance(dict, 'feedback') ||
                         this.findDictInstance(dict, 'feedbackTextArea');

    if (feedbackField) {
      return this.extractTextAreaFieldContent(feedbackField);
    }

    return '';
  }

  /**
   * Extract questionsData and optionally eXeFormInstructions from the legacy format
   * Only sets properties that have actual content - no defaults.
   */
  extractProperties(dict) {
    const questionsData = this.extractQuestions(dict);
    const instructions = this.extractHtmlView(dict);
    const feedback = this.extractFeedback(dict);

    const props = {};

    if (questionsData.length > 0) {
      props.questionsData = questionsData;
    }

    // Only set instructions if we have actual content
    if (instructions && instructions.trim()) {
      props.eXeFormInstructions = instructions;
    }

    // Only set feedback if we have actual content
    if (feedback && feedback.trim()) {
      props.eXeIdeviceTextAfter = feedback;
    }

    return props;
  }

  /**
   * Extract questions from legacy MultichoiceIdevice format
   *
   * Structure:
   * - questions -> list of QuizQuestionField
   * - QuizQuestionField.questionTextArea -> question text
   * - QuizQuestionField.hintTextArea -> hint for the question
   * - QuizQuestionField.options -> list of QuizOptionField
   * - QuizOptionField.answerTextArea -> option text
   * - QuizOptionField.isCorrect -> boolean
   * - QuizOptionField.feedbackTextArea -> feedback for this option
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

      // Extract hint from hintTextArea
      const hintTextArea = this.findDictInstance(qDict, 'hintTextArea');
      const hint = hintTextArea ? this.extractTextAreaFieldContent(hintTextArea) : '';

      // Extract options from options list
      const optionsList = this.findDictList(qDict, 'options');
      const answers = [];

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

          // Get per-option feedback
          const feedbackTextArea = this.findDictInstance(optDict, 'feedbackTextArea');
          const optionFeedback = feedbackTextArea ? this.extractTextAreaFieldContent(feedbackTextArea) : '';

          // Include feedback if present (as third element)
          if (optionFeedback && optionFeedback.trim()) {
            answers.push([isCorrect, optionText, optionFeedback]);
          } else {
            answers.push([isCorrect, optionText]);
          }
        }
      }

      // Only add if we have a question or answers
      if (questionText || answers.length > 0) {
        // Selection type is based on iDevice type, not number of correct answers:
        // - MultiSelectIdevice: 'multiple' (checkboxes, multiple answers allowed)
        // - MultichoiceIdevice: 'single' (radio buttons, only one answer)
        const questionData = {
          activityType: 'selection',
          selectionType: this._isMultiSelect ? 'multiple' : 'single',
          baseText: questionText,
          answers: answers
        };

        // Add hint if present
        if (hint && hint.trim()) {
          questionData.hint = hint;
        }

        questionsData.push(questionData);
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
