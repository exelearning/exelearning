/**
 * BaseLegacyHandler
 *
 * Base class for legacy iDevice handlers.
 * Provides shared utilities for parsing legacy XML structures.
 *
 * Each handler subclass implements:
 * - canHandle(className): Check if this handler supports the legacy class
 * - getTargetType(): Return the modern iDevice type name
 * - extractProperties(dict): Extract iDevice-specific properties
 * - extractHtmlView(dict): Extract HTML content (optional)
 */
class BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   * @param {string} className - Legacy class name (e.g., 'exe.engine.multichoiceidevice.MultichoiceIdevice')
   * @returns {boolean}
   */
  canHandle(className) {
    throw new Error('BaseLegacyHandler.canHandle() must be implemented by subclass');
  }

  /**
   * Get the target modern iDevice type
   * @returns {string} Modern iDevice type (e.g., 'form', 'text', 'trueorfalse')
   */
  getTargetType() {
    throw new Error('BaseLegacyHandler.getTargetType() must be implemented by subclass');
  }

  /**
   * Extract iDevice-specific properties from the dictionary
   * @param {Element} dict - Dictionary element of the iDevice
   * @returns {Object} Properties object (e.g., { questionsData: [...] })
   */
  extractProperties(dict) {
    return {};
  }

  /**
   * Extract HTML content from the dictionary
   * @param {Element} dict - Dictionary element of the iDevice
   * @returns {string} HTML content
   */
  extractHtmlView(dict) {
    return '';
  }

  /**
   * Extract feedback content from the dictionary
   * @param {Element} dict - Dictionary element of the iDevice
   * @returns {{content: string, buttonCaption: string}} Feedback info
   */
  extractFeedback(dict) {
    return { content: '', buttonCaption: '' };
  }

  /**
   * Get localized "Show Feedback" text based on language code
   * Uses static translations instead of UI locale for legacy imports
   * @param {string} langCode - Language code (e.g., 'es', 'en', 'ca')
   * @returns {string} Localized feedback button text
   */
  getLocalizedFeedbackText(langCode) {
    const translations = {
      es: 'Mostrar retroalimentación',
      en: 'Show Feedback',
      ca: 'Mostra la retroalimentació',
      eu: 'Erakutsi feedbacka',
      gl: 'Mostrar retroalimentación',
      pt: 'Mostrar feedback',
      fr: 'Afficher le feedback',
      de: 'Feedback anzeigen',
      it: 'Mostra feedback',
      nl: 'Toon feedback',
      pl: 'Pokaż informację zwrotną',
      ru: 'Показать отзыв',
      zh: '显示反馈',
      ja: 'フィードバックを表示',
      ar: 'إظهار الملاحظات',
    };
    // Normalize language code (e.g., 'es-ES' -> 'es')
    const lang = (langCode || '').split('-')[0].toLowerCase();
    return translations[lang] || translations.es; // Default to Spanish for legacy files
  }

  // ========================================
  // Shared XML Parsing Utilities
  // ========================================

  /**
   * Find a string value in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {string|null} Value or null
   */
  findDictStringValue(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        // Handle both <string> and <unicode> value elements
        if (valueEl && (valueEl.tagName === 'string' || valueEl.tagName === 'unicode')) {
          return valueEl.getAttribute('value') || valueEl.textContent || null;
        }
      }
    }
    return null;
  }

  /**
   * Find a list element in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {Element|null} List element or null
   */
  findDictList(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'list') {
          return valueEl;
        }
      }
    }
    return null;
  }

  /**
   * Find an instance element in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {Element|null} Instance element or null
   */
  findDictInstance(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'instance') {
          return valueEl;
        }
      }
    }
    return null;
  }

  /**
   * Find a boolean value in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {boolean} Boolean value (false if not found)
   */
  findDictBoolValue(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'bool') {
          return valueEl.getAttribute('value') === '1';
        }
      }
    }
    return false;
  }

  /**
   * Extract content from a TextAreaField instance
   * @param {Element} fieldInst - TextAreaField instance element
   * @returns {string} HTML content
   */
  extractTextAreaFieldContent(fieldInst) {
    if (!fieldInst) return '';
    const dict = fieldInst.querySelector(':scope > dictionary');
    if (!dict) return '';

    const children = Array.from(dict.children);

    // Look for content_w_resourcePaths or _content key
    const contentKeys = ['content_w_resourcePaths', '_content', 'content'];

    for (const targetKey of contentKeys) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'string' &&
            child.getAttribute('role') === 'key' &&
            child.getAttribute('value') === targetKey) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === 'unicode') {
            const value = valueEl.getAttribute('value') || valueEl.textContent || '';
            if (value.trim()) {
              return this.decodeHtmlContent(value);
            }
          }
        }
      }
    }

    return '';
  }

  /**
   * Extract content from a FeedbackField instance
   * @param {Element} fieldInst - FeedbackField instance element
   * @returns {{content: string, buttonCaption: string}} Feedback content and button caption
   */
  extractFeedbackFieldContent(fieldInst) {
    if (!fieldInst) return { content: '', buttonCaption: '' };
    const dict = fieldInst.querySelector(':scope > dictionary');
    if (!dict) return { content: '', buttonCaption: '' };

    const children = Array.from(dict.children);
    let content = '';
    let buttonCaption = '';

    // Look for feedback content
    const contentKeys = ['feedback', 'content_w_resourcePaths', '_content', 'content'];
    for (const targetKey of contentKeys) {
      if (content) break;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'string' &&
            child.getAttribute('role') === 'key' &&
            child.getAttribute('value') === targetKey) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === 'unicode') {
            const value = valueEl.getAttribute('value') || valueEl.textContent || '';
            if (value.trim()) {
              content = this.decodeHtmlContent(value);
              break;
            }
          }
        }
      }
    }

    // Look for button caption
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === '_buttonCaption') {
        const valueEl = children[i + 1];
        if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
          buttonCaption = valueEl.getAttribute('value') || valueEl.textContent || '';
          break;
        }
      }
    }

    return {
      content,
      buttonCaption: buttonCaption || 'Show Feedback'
    };
  }

  /**
   * Decode HTML content from legacy XML format
   * @param {string} content - Encoded HTML content
   * @returns {string} Decoded HTML
   */
  decodeHtmlContent(content) {
    if (!content) return '';

    // Handle Python-style unicode escapes and HTML entities
    let decoded = content
      // Decode common HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Handle Python unicode escapes for common characters
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r(?![a-zA-Z])/g, '\r'); // Negative lookahead to preserve LaTeX commands like \right

    return decoded;
  }

  /**
   * Strip HTML tags from content, returning plain text.
   * Matches Symfony's strip_tags() behavior for legacy imports.
   *
   * @param {string} html - HTML content to strip
   * @returns {string} Plain text content
   */
  stripHtmlTags(html) {
    if (!html) return '';

    // Use DOM parsing to extract text content (decodes entities too)
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseLegacyHandler;
} else {
  window.BaseLegacyHandler = BaseLegacyHandler;
}
