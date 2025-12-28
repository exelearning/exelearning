/**
 * FreeTextHandler
 *
 * Handles legacy FreeTextIdevice and related text iDevices.
 * Converts to modern 'text' iDevice.
 *
 * Legacy XML classes:
 * - exe.engine.freetextidevice.FreeTextIdevice
 * - exe.engine.freetextfpdidevice.FreeTextfpdIdevice (FPD variant)
 * - exe.engine.reflectionidevice.ReflectionIdevice
 * - exe.engine.reflectionfpdidevice.ReflectionfpdIdevice
 * - exe.engine.genericidevice.GenericIdevice
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class FreeTextHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('FreeTextIdevice') ||
           className.includes('FreeTextfpdIdevice') ||
           className.includes('ReflectionIdevice') ||
           className.includes('ReflectionfpdIdevice') ||
           className.includes('GenericIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Extract HTML content from the legacy format
   * Also renders feedback button and content directly into htmlView (matching Symfony behavior)
   * @param {Element} dict - Dictionary element from legacy XML
   * @param {Object} context - Context with language info
   * @param {string} context.language - Project language code (e.g., 'es', 'en')
   */
  extractHtmlView(dict, context = {}) {
    if (!dict) return '';

    let content = '';

    // Strategy 1: Look for activityTextArea (main content)
    const activityTextArea = this.findDictInstance(dict, 'activityTextArea');
    if (activityTextArea) {
      content = this.extractTextAreaFieldContent(activityTextArea);
    }

    // Strategy 2: Look for "content" key
    if (!content) {
      const contentTextArea = this.findDictInstance(dict, 'content');
      if (contentTextArea) {
        content = this.extractTextAreaFieldContent(contentTextArea);
      }
    }

    // Strategy 3: Look for "fields" list (JsIdevice format)
    if (!content) {
      const fieldsContent = this.extractFieldsContent(dict);
      if (fieldsContent) {
        content = fieldsContent;
      }
    }

    // Strategy 4: Any TextAreaField in the dictionary
    if (!content) {
      const textAreaInst = dict.querySelector(':scope > instance[class*="TextAreaField"]');
      if (textAreaInst) {
        content = this.extractTextAreaFieldContent(textAreaInst);
      }
    }

    // Render feedback into htmlView (matching Symfony legacy approach)
    // This ensures feedback works in editor, preview, and export
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
   * Extract feedback content (for Reflection iDevices)
   * @param {Element} dict - Dictionary element
   * @param {Object} context - Context with language info
   * @param {string} context.language - Project language code
   */
  extractFeedback(dict, context = {}) {
    if (!dict) return { content: '', buttonCaption: '' };

    // Use project language for default caption (not UI locale)
    const defaultCaption = this.getLocalizedFeedbackText(context.language);

    // Look for answerTextArea (ReflectionIdevice style)
    const answerTextArea = this.findDictInstance(dict, 'answerTextArea');
    if (answerTextArea) {
      const answerDict = answerTextArea.querySelector(':scope > dictionary');
      if (answerDict) {
        // Get feedback content
        const content = this.extractTextAreaFieldContent(answerTextArea);

        // Get button caption - use stored value if available, otherwise use localized default
        const storedCaption = this.findDictStringValue(answerDict, 'buttonCaption');
        const buttonCaption = storedCaption || defaultCaption;

        if (content) {
          return { content, buttonCaption };
        }
      }
    }

    // Alternative: Look for feedbackTextArea
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
   * Extract properties for text iDevice
   */
  extractProperties(dict) {
    const feedback = this.extractFeedback(dict);
    if (feedback.content) {
      return {
        textFeedbackTextarea: feedback.content,
        textFeedbackInput: feedback.buttonCaption
      };
    }
    return {};
  }

  /**
   * Extract content from "fields" list (JsIdevice format)
   */
  extractFieldsContent(dict) {
    const children = Array.from(dict.children);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === 'fields') {
        const listEl = children[i + 1];
        if (listEl && listEl.tagName === 'list') {
          const contents = [];
          const fieldInstances = listEl.querySelectorAll(':scope > instance');
          for (const fieldInst of fieldInstances) {
            const fieldClass = fieldInst.getAttribute('class') || '';
            if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
              const content = this.extractTextAreaFieldContent(fieldInst);
              if (content) {
                contents.push(content);
              }
            }
          }
          return contents.join('\n');
        }
        break;
      }
    }

    return '';
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FreeTextHandler;
} else {
  window.FreeTextHandler = FreeTextHandler;
}
