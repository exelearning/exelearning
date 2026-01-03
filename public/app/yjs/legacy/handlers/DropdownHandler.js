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
 * - Questions with dropdown placeholders (uses <u> tags)
 * - Wrong answers (distractors)
 * - Instructions (instructionsForLearners -> eXeFormInstructions)
 * - Feedback (feedback field -> rendered as button + hidden div)
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
   * Extract feedback content from the legacy format
   *
   * Legacy ListaIdevice has a "feedback" key containing a TextAreaField
   * with content_w_resourcePaths for the feedback text.
   *
   * @param {Element} dict - Dictionary element
   * @param {Object} context - Context with language info
   * @param {string} context.language - Project language code
   * @returns {Object} { content, buttonCaption }
   */
  extractFeedback(dict, context = {}) {
    if (!dict) return { content: '', buttonCaption: '' };

    // Use project language for default caption
    const defaultCaption = this.getLocalizedFeedbackText(context.language);

    // Look for feedback field (ListaIdevice uses "feedback" key)
    const feedbackField = this.findDictInstance(dict, 'feedback');
    if (feedbackField) {
      const feedbackDict = feedbackField.querySelector(':scope > dictionary');
      let buttonCaption = defaultCaption;
      if (feedbackDict) {
        const storedCaption = this.findDictStringValue(feedbackDict, 'buttonCaption');
        buttonCaption = storedCaption || defaultCaption;
      }
      const content = this.extractTextAreaFieldContent(feedbackField);
      if (content) {
        return { content, buttonCaption };
      }
    }

    // Alternative: Look for feedbackTextArea (other legacy formats)
    const feedbackTextArea = this.findDictInstance(dict, 'feedbackTextArea');
    if (feedbackTextArea) {
      const feedbackDict = feedbackTextArea.querySelector(':scope > dictionary');
      let buttonCaption = defaultCaption;
      if (feedbackDict) {
        const storedCaption = this.findDictStringValue(feedbackDict, 'buttonCaption');
        buttonCaption = storedCaption || defaultCaption;
      }
      const content = this.extractTextAreaFieldContent(feedbackTextArea);
      if (content) {
        return { content, buttonCaption };
      }
    }

    return { content: '', buttonCaption: '' };
  }

  /**
   * Extract properties including questionsData, eXeFormInstructions, and feedback
   *
   * Based on Symfony OdeOldXmlDropdownIdevice.php:
   * - eXeFormInstructions comes from instructionsForLearners
   * - questionsData contains the dropdown questions with <u> tags preserved
   * - eXeIdeviceTextAfter contains the feedback content (form iDevice uses this field)
   *
   * @param {Element} dict - Dictionary element
   * @param {string} ideviceId - iDevice ID (unused)
   * @param {Object} context - Context with language info
   */
  extractProperties(dict, ideviceId, context = {}) {
    const questionsData = this.extractDropdownQuestions(dict);
    const instructions = this.extractHtmlView(dict);
    const feedback = this.extractFeedback(dict, context);

    if (questionsData.length > 0 || feedback.content) {
      const props = {};

      if (questionsData.length > 0) {
        props.questionsData = questionsData;
      }

      if (instructions) {
        props.eXeFormInstructions = instructions;
      }

      // Add feedback as eXeIdeviceTextAfter for form iDevice
      // (form.js uses eXeIdeviceTextAfter for "content after" section)
      if (feedback.content) {
        props.eXeIdeviceTextAfter = feedback.content;
      }

      return props;
    }
    return {};
  }

  /**
   * Build the full HTML view including content and feedback button
   *
   * For dropdown iDevices, we need to render the feedback as a button
   * and hidden div, similar to FreeTextHandler.
   *
   * @param {Element} dict - Dictionary element
   * @param {Object} context - Context with language info
   * @returns {string} HTML content
   */
  buildHtmlViewWithFeedback(dict, context = {}) {
    if (!dict) return '';

    let content = '';

    // Get instructions (main content for dropdown is in questionsData, not htmlView)
    // But we may want to include feedback rendering here
    const feedback = this.extractFeedback(dict, context);
    if (feedback.content) {
      const buttonCaption = feedback.buttonCaption;

      content += `<div class="iDevice_buttons feedback-button js-required">
<input type="button" class="feedbacktooglebutton" value="${buttonCaption}" data-text-a="${buttonCaption}" data-text-b="${buttonCaption}">
</div>
<div class="feedback js-feedback js-hidden" style="display: none;">${feedback.content}</div>`;
    }

    return content;
  }

  /**
   * Extract dropdown questions from the legacy format
   *
   * Structure can be:
   * - Single ListaField in _content key (most common in real legacy files)
   * - List of ListaField instances
   * - Each has: _encodedContent/content_w_resourcePaths, otras (wrong answers)
   *
   * @param {Element} dict - Dictionary element of the ListaIdevice
   * @returns {Array} Array of question objects in form iDevice format
   */
  extractDropdownQuestions(dict) {
    const questionsData = [];

    // First: Look for single ListaField in _content key (real legacy format)
    const contentField = this.findDictInstance(dict, '_content');
    if (contentField) {
      const className = contentField.getAttribute('class') || '';
      if (className.includes('ListaField')) {
        const question = this.extractSingleListaField(contentField);
        if (question) questionsData.push(question);
        return questionsData; // Single ListaField found, return
      }
    }

    // Fallback: Find the list containing ListaField instances
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
      const question = this.extractSingleListaField(questionInst);
      if (question) questionsData.push(question);
    }

    return questionsData;
  }

  /**
   * Extract a single ListaField instance
   *
   * IMPORTANT: The baseText should preserve <u> tags as-is!
   * form.js (getProcessTextDropdownQuestion) will convert <u> tags to <select> elements.
   * See Symfony OdeOldXmlDropdownIdevice.php line 145 - it also keeps <u> tags.
   *
   * @param {Element} listaFieldInst - ListaField instance element
   * @returns {Object|null} Question object or null
   */
  extractSingleListaField(listaFieldInst) {
    const qDict = listaFieldInst.querySelector(':scope > dictionary');
    if (!qDict) return null;

    // Extract question text from _encodedContent or content_w_resourcePaths
    // Keep <u> tags intact - form.js will convert them to <select> elements
    let baseText = this.findDictStringValue(qDict, '_encodedContent') ||
                   this.findDictStringValue(qDict, 'content_w_resourcePaths') || '';

    // Fallback: check for questionTextArea field (some legacy formats)
    if (!baseText) {
      const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
      baseText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';
    }

    // Extract wrong answers from "otras" field (pipe-separated) or "wrongAnswers"
    const wrongAnswers = this.findDictStringValue(qDict, 'otras') ||
                        this.findDictStringValue(qDict, 'wrongAnswers') ||
                        this.findDictStringValue(qDict, '_wrongAnswers') || '';

    // Return with <u> tags preserved - do NOT convert to {{placeholders}}
    if (baseText) {
      return {
        activityType: 'dropdown',
        baseText: baseText,
        wrongAnswersValue: wrongAnswers
      };
    }

    return null;
  }

  /**
   * Parse dropdown text to extract answers and convert to modern format
   *
   * Legacy formats may use:
   * - <u> tags (underlined text) marking correct answers
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

    // Pattern 0: <u>answer</u> tags (most common in real legacy files)
    // Answers are marked with underline tags
    baseText = baseText.replace(
      /<u>([^<]+)<\/u>/gi,
      (match, answer) => {
        answers.push(answer.trim());
        return '{{' + answer.trim() + '}}';
      }
    );

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
