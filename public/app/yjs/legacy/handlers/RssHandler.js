/**
 * RssHandler
 *
 * Handles legacy RssIdevice (RSS feed content).
 * Converts to modern 'text' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.rssidevice.RssIdevice
 *
 * Extracts:
 * - TextAreaField content with RSS feed rendered HTML
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class RssHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('RssIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Extract HTML view from RSS content
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for TextAreaField instances in dictionary
    // RSS content is stored directly in TextAreaField
    const textAreas = dict.querySelectorAll(':scope > instance[class*="TextAreaField"]');
    let html = '';

    for (const textArea of textAreas) {
      const content = this.extractTextAreaFieldContent(textArea);
      if (content) {
        html += content;
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
            html += content;
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
  module.exports = RssHandler;
} else {
  window.RssHandler = RssHandler;
}
