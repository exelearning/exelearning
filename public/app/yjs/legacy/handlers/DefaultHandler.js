/**
 * DefaultHandler
 *
 * Fallback handler for unknown legacy iDevice types.
 * Extracts basic HTML content and maps to 'text' iDevice.
 *
 * This handler should always be the LAST in the registry
 * as it accepts all class names.
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class DefaultHandler extends BaseLegacyHandler {
  /**
   * Always matches (fallback handler)
   */
  canHandle(className) {
    return true;
  }

  /**
   * Default to 'text' iDevice for unknown types
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Try to extract HTML content from various common fields
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Strategy 1: Look for "fields" list (JsIdevice format)
    const fieldsResult = this.extractFieldsContent(dict);
    if (fieldsResult) {
      return fieldsResult;
    }

    // Strategy 2: Direct content fields (older formats)
    const contentFields = ['content', '_content', '_html', 'htmlView', 'story', '_story', 'text', '_text'];
    for (const field of contentFields) {
      const content = this.extractRichTextContent(dict, field);
      if (content) {
        return content;
      }
    }

    // Strategy 3: Any TextField or TextAreaField
    return this.extractAnyTextFieldContent(dict);
  }

  /**
   * Try to extract feedback content
   * @param {Element} dict - Dictionary element
   * @param {Object} context - Context with language info
   * @param {string} context.language - Project language code
   */
  extractFeedback(dict, context = {}) {
    if (!dict) return { content: '', buttonCaption: '' };

    // Look for answerTextArea (ReflectionIdevice style)
    const answerTextArea = this.findDictInstance(dict, 'answerTextArea');
    if (answerTextArea) {
      const content = this.extractTextAreaFieldContent(answerTextArea);
      if (content) {
        return {
          content,
          buttonCaption: this.getLocalizedFeedbackText(context.language)
        };
      }
    }

    return { content: '', buttonCaption: '' };
  }

  /**
   * Extract content from "fields" list in JsIdevice format
   */
  extractFieldsContent(dict) {
    const children = Array.from(dict.children);

    // Find "fields" key and its list
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

  /**
   * Extract rich text content from a dictionary field
   */
  extractRichTextContent(dict, fieldName) {
    const children = Array.from(dict.children);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === fieldName) {
        const valueEl = children[i + 1];
        if (!valueEl) return '';

        if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
          return this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
        }

        if (valueEl.tagName === 'instance') {
          return this.extractTextAreaFieldContent(valueEl);
        }
      }
    }

    return '';
  }

  /**
   * Extract content from any TextAreaField or TextField in the dictionary
   */
  extractAnyTextFieldContent(dict) {
    // Find all instance elements that look like text fields
    const instances = dict.querySelectorAll(':scope > instance');
    for (const inst of instances) {
      const className = inst.getAttribute('class') || '';
      if (className.includes('TextAreaField') || className.includes('TextField')) {
        const content = this.extractTextAreaFieldContent(inst);
        if (content) {
          return content;
        }
      }
    }

    // Try nested instances
    const nestedInstances = dict.querySelectorAll('instance');
    for (const inst of nestedInstances) {
      const className = inst.getAttribute('class') || '';
      if (className.includes('TextAreaField') || className.includes('TextField')) {
        const content = this.extractTextAreaFieldContent(inst);
        if (content) {
          return content;
        }
      }
    }

    return '';
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DefaultHandler;
} else {
  window.DefaultHandler = DefaultHandler;
}
