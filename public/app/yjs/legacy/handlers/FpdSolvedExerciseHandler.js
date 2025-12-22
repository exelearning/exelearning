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
   */
  extractHtmlView(dict) {
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

        // Extract feedback with toggle wrapper
        const feedbackTextArea = this.findDictInstance(qDict, 'feedbackTextArea');
        if (feedbackTextArea) {
          const feedbackContent = this.extractTextAreaFieldContent(feedbackTextArea);
          if (feedbackContent) {
            // Get button caption if available
            const feedbackDict = feedbackTextArea.querySelector(':scope > dictionary');
            let buttonCaption = 'Mostrar retroalimentación';
            if (feedbackDict) {
              const caption = this.findDictStringValue(feedbackDict, 'buttonCaption');
              if (caption) {
                buttonCaption = caption;
              }
            }
            // Wrap feedback in toggle structure
            html += `<div class="exe-feedback-toggle" data-button-caption="${this.escapeHtmlAttribute(buttonCaption)}">${feedbackContent}</div>`;
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

  /**
   * Escape HTML attribute value
   */
  escapeHtmlAttribute(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FpdSolvedExerciseHandler;
} else {
  window.FpdSolvedExerciseHandler = FpdSolvedExerciseHandler;
}
