/**
 * FillHandler
 *
 * Handles legacy ClozeIdevice and ClozeActivityIdevice.
 * Converts to modern 'form' iDevice with fill-in-blanks questions.
 *
 * Legacy XML structure:
 * - exe.engine.clozeidevice.ClozeIdevice
 * - exe.engine.clozeactivityidevice.ClozeActivityIdevice
 *
 * Extracts:
 * - clozeText with gaps marked as {{answer}}
 * - autoCapitalize, strictMarking settings
 * - instantMarking setting
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class FillHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('ClozeIdevice') ||
           className.includes('ClozeActivityIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'form';
  }

  /**
   * Extract the cloze text (instructions/content before gaps)
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
    const questionsData = this.extractClozeQuestions(dict);

    // Extract settings
    const autoCapitalize = !this.findDictBoolValue(dict, 'autoCapitalize');
    const strictMarking = this.findDictBoolValue(dict, 'strictMarking');
    const instantMarking = this.findDictBoolValue(dict, 'instantMarking');

    const props = {};

    if (questionsData.length > 0) {
      props.questionsData = questionsData;
    }

    // Add settings if present
    if (autoCapitalize !== undefined) {
      props.ignoreCaps = autoCapitalize;
    }
    if (strictMarking !== undefined) {
      props.strictMarking = strictMarking;
    }
    if (instantMarking !== undefined) {
      props.instantMarking = instantMarking;
    }

    return props;
  }

  /**
   * Extract cloze questions from the legacy format
   *
   * Structure:
   * - ClozeHTMLParser with _clozeText containing text with gaps
   * - Gaps are identified by underscore patterns or special markers
   *
   * @param {Element} dict - Dictionary element of the ClozeIdevice
   * @returns {Array} Array of question objects in form iDevice format
   */
  extractClozeQuestions(dict) {
    const questionsData = [];

    // Find the cloze text content
    const clozeInst = this.findDictInstance(dict, '_cloze');
    if (!clozeInst) {
      // Try alternative structure
      return this.extractClozeFromFields(dict);
    }

    const clozeDict = clozeInst.querySelector(':scope > dictionary');
    if (!clozeDict) return questionsData;

    // Get the raw cloze text
    const clozeText = this.findDictStringValue(clozeDict, '_clozeText') ||
                      this.findDictStringValue(clozeDict, 'clozeText');

    if (!clozeText) return questionsData;

    // Parse the cloze text to extract gaps
    // Legacy format uses underscores or special delimiters for gaps
    const parsedText = this.parseClozeText(clozeText);

    if (parsedText.baseText) {
      questionsData.push({
        activityType: 'fill',
        baseText: parsedText.baseText,
        answers: parsedText.answers || []
      });
    }

    return questionsData;
  }

  /**
   * Alternative extraction from fields list
   */
  extractClozeFromFields(dict) {
    const questionsData = [];

    // Look for clozeTextArea
    const clozeTextArea = this.findDictInstance(dict, 'clozeTextArea');
    if (clozeTextArea) {
      const content = this.extractTextAreaFieldContent(clozeTextArea);
      if (content) {
        const parsedText = this.parseClozeText(content);
        if (parsedText.baseText) {
          questionsData.push({
            activityType: 'fill',
            baseText: parsedText.baseText,
            answers: parsedText.answers || []
          });
        }
      }
    }

    return questionsData;
  }

  /**
   * Parse cloze text to extract gaps and convert to modern format
   *
   * Legacy formats:
   * - Words wrapped in underscores: _answer_
   * - Words in special tags
   *
   * Modern format uses: {{answer}}
   *
   * @param {string} text - Raw cloze text
   * @returns {Object} { baseText, answers }
   */
  parseClozeText(text) {
    if (!text) return { baseText: '', answers: [] };

    const answers = [];

    // Pattern 1: <u class="exe-cloze-word">word</u>
    // Pattern 2: <span class="cloze-blank">word</span>
    // Pattern 3: Legacy underscores _word_

    let baseText = text;

    // Replace cloze word spans with {{answer}} placeholders
    baseText = baseText.replace(
      /<u[^>]*class="[^"]*exe-cloze-word[^"]*"[^>]*>([^<]+)<\/u>/gi,
      (match, word) => {
        answers.push(word.trim());
        return '{{' + word.trim() + '}}';
      }
    );

    // Replace span-based cloze blanks
    baseText = baseText.replace(
      /<span[^>]*class="[^"]*cloze-blank[^"]*"[^>]*>([^<]+)<\/span>/gi,
      (match, word) => {
        answers.push(word.trim());
        return '{{' + word.trim() + '}}';
      }
    );

    // Replace input-based blanks (legacy rendering)
    baseText = baseText.replace(
      /<input[^>]*data-answer="([^"]+)"[^>]*>/gi,
      (match, word) => {
        answers.push(word);
        return '{{' + word + '}}';
      }
    );

    return { baseText, answers };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FillHandler;
} else {
  window.FillHandler = FillHandler;
}
