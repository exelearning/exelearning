/**
 * NotaHandler
 *
 * Handles legacy NotaIdevice and NotaInformacionIdevice.
 * These iDevices are text-based but should be imported with their
 * block visibility set to false (collapsed by default).
 *
 * Legacy XML classes:
 * - exe.engine.notaidevice.NotaIdevice
 * - exe.engine.notainformacionidevice.NotaInformacionIdevice
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class NotaHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('NotaIdevice') ||
           className.includes('NotaInformacionIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Get block properties for Nota iDevices
   * These iDevices should have their block collapsed by default
   * @returns {Object} Block properties with visibility: 'false'
   */
  getBlockProperties() {
    return {
      visibility: 'false'
    };
  }

  /**
   * Extract HTML content from the legacy format
   * Nota iDevices store content in commentTextArea
   * @param {Element} dict - Dictionary element from legacy XML
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for commentTextArea (main content for NotaIdevice)
    const commentTextArea = this.findDictInstance(dict, 'commentTextArea');
    if (commentTextArea) {
      return this.extractTextAreaFieldContent(commentTextArea);
    }

    // Fallback: Look for "content" key
    const contentTextArea = this.findDictInstance(dict, 'content');
    if (contentTextArea) {
      return this.extractTextAreaFieldContent(contentTextArea);
    }

    // Fallback: Any TextAreaField in the dictionary
    const textAreaInst = dict.querySelector(':scope > instance[class*="TextAreaField"]');
    if (textAreaInst) {
      return this.extractTextAreaFieldContent(textAreaInst);
    }

    return '';
  }

  /**
   * Extract properties for text iDevice
   */
  extractProperties() {
    return {};
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotaHandler;
} else {
  window.NotaHandler = NotaHandler;
}
