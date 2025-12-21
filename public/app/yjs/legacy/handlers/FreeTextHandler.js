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
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Strategy 1: Look for activityTextArea (main content)
    const activityTextArea = this.findDictInstance(dict, 'activityTextArea');
    if (activityTextArea) {
      return this.extractTextAreaFieldContent(activityTextArea);
    }

    // Strategy 2: Look for "content" key
    const contentTextArea = this.findDictInstance(dict, 'content');
    if (contentTextArea) {
      return this.extractTextAreaFieldContent(contentTextArea);
    }

    // Strategy 3: Look for "fields" list (JsIdevice format)
    const fieldsContent = this.extractFieldsContent(dict);
    if (fieldsContent) {
      return fieldsContent;
    }

    // Strategy 4: Any TextAreaField in the dictionary
    const textAreaInst = dict.querySelector(':scope > instance[class*="TextAreaField"]');
    if (textAreaInst) {
      return this.extractTextAreaFieldContent(textAreaInst);
    }

    return '';
  }

  /**
   * Extract feedback content (for Reflection iDevices)
   */
  extractFeedback(dict) {
    if (!dict) return { content: '', buttonCaption: '' };

    // Look for answerTextArea (ReflectionIdevice style)
    const answerTextArea = this.findDictInstance(dict, 'answerTextArea');
    if (answerTextArea) {
      const answerDict = answerTextArea.querySelector(':scope > dictionary');
      if (answerDict) {
        // Get feedback content
        const content = this.extractTextAreaFieldContent(answerTextArea);

        // Get button caption
        let buttonCaption = this.findDictStringValue(answerDict, 'buttonCaption') || '';
        if (!buttonCaption) {
          buttonCaption = 'Show Feedback';
        }

        if (content) {
          return { content, buttonCaption };
        }
      }
    }

    // Alternative: Look for feedbackTextArea
    const feedbackTextArea = this.findDictInstance(dict, 'feedbackTextArea');
    if (feedbackTextArea) {
      const content = this.extractTextAreaFieldContent(feedbackTextArea);
      if (content) {
        return { content, buttonCaption: 'Show Feedback' };
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
