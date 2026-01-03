/**
 * FpdSolvedExerciseHandler
 *
 * Handles legacy SolvedExerciseIdevice (FPD solved exercise format).
 * Converts to modern 'text' iDevice with story and question/feedback sections.
 *
 * Legacy XML structure:
 * - exe.engine.ejercicioresueltofpdidevice.SolvedExerciseIdevice
 * - exe.engine.ejercicioresueltofpdidevice.EjercicioResueltoFpdIdevice
 *
 * Extracts:
 * - storyTextArea (intro text)
 * - questions list with Question instances (questionTextArea + feedbackTextArea)
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class FpdSolvedExerciseHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('SolvedExerciseIdevice') ||
           className.includes('EjercicioResueltoFpdIdevice') ||
           className.includes('ejercicioresueltofpdidevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Extract HTML view combining story and questions with feedback
   * @param {Element} dict - Dictionary element
   * @param {Object} context - Context with language info
   * @param {string} context.language - Project language code
   */
  extractHtmlView(dict, context = {}) {
    if (!dict) return '';

    let html = '';

    // Extract story text area (intro)
    const storyArea = this.findDictInstance(dict, 'storyTextArea');
    if (storyArea) {
      const storyContent = this.extractTextAreaFieldContent(storyArea);
      if (storyContent) {
        html += storyContent;
      }
    }

    // Extract questions with feedback
    const questionsList = this.findDictList(dict, 'questions');
    if (questionsList) {
      const questions = questionsList.querySelectorAll(':scope > instance[class*="Question"]');
      for (const q of questions) {
        const qDict = q.querySelector(':scope > dictionary');
        if (!qDict) continue;

        // Extract question text
        const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
        if (questionTextArea) {
          const questionContent = this.extractTextAreaFieldContent(questionTextArea);
          if (questionContent) {
            html += questionContent;
          }
        }

        // Extract feedback and render button + hidden div (matching Symfony approach)
        const feedbackTextArea = this.findDictInstance(qDict, 'feedbackTextArea');
        if (feedbackTextArea) {
          const feedbackContent = this.extractTextAreaFieldContent(feedbackTextArea);
          if (feedbackContent) {
            // Get button caption if available
            const feedbackDict = feedbackTextArea.querySelector(':scope > dictionary');
            const defaultCaption = this.getLocalizedFeedbackText(context.language);
            let buttonCaption = defaultCaption;
            if (feedbackDict) {
              const caption = this.findDictStringValue(feedbackDict, 'buttonCaption');
              if (caption) {
                buttonCaption = caption;
              }
            }
            // Render feedback button and div (matching FreeTextHandler pattern)
            html += `<div class="iDevice_buttons feedback-button js-required">
<input type="button" class="feedbacktooglebutton" value="${buttonCaption}" data-text-a="${buttonCaption}" data-text-b="${buttonCaption}">
</div>
<div class="feedback js-feedback js-hidden" style="display: none;">${feedbackContent}</div>`;
          }
        }
      }
    }

    return html;
  }

  /**
   * Extract properties (none needed for text iDevice)
   */
  extractProperties(dict) {
    return {};
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FpdSolvedExerciseHandler;
} else {
  window.FpdSolvedExerciseHandler = FpdSolvedExerciseHandler;
}
