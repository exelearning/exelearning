/**
 * WikipediaHandler
 *
 * Handles legacy WikipediaIdevice (Wikipedia article content).
 * Converts to modern 'text' iDevice with special wrapper.
 *
 * Legacy XML structure:
 * - exe.engine.wikipediaidevice.WikipediaIdevice
 *
 * Extracts:
 * - TextAreaField content wrapped in exe-wikipedia-content div
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class WikipediaHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('WikipediaIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Extract HTML view from Wikipedia content
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for TextAreaField instances in dictionary
    const textAreas = dict.querySelectorAll(':scope > instance[class*="TextAreaField"]');
    let html = '';

    for (const textArea of textAreas) {
      const content = this.extractTextAreaFieldContent(textArea);
      if (content) {
        // Clean up empty paragraphs as done in Symfony
        const cleanedContent = content.replace(/<p><\/p>/g, '');
        html += cleanedContent;
      }
    }

    // If no direct TextAreaFields found, try through fields list
    if (!html) {
      const fieldsList = this.findDictList(dict, 'fields');
      if (fieldsList) {
        const fields = fieldsList.querySelectorAll(':scope > instance[class*="TextAreaField"]');
        for (const field of fields) {
          const content = this.extractTextAreaFieldContent(field);
          if (content) {
            const cleanedContent = content.replace(/<p><\/p>/g, '');
            html += cleanedContent;
          }
        }
      }
    }

    // Wrap in Wikipedia content div as done in Symfony
    if (html) {
      html = `<div class="exe-wikipedia-content">${html}</div>`;
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
  module.exports = WikipediaHandler;
} else {
  window.WikipediaHandler = WikipediaHandler;
}
