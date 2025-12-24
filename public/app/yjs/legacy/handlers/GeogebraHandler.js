/**
 * GeogebraHandler
 *
 * Handles legacy GeogebraIdevice (GeoGebra applet content).
 * Converts to modern 'geogebra-activity' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.geogebraidevice.GeogebraIdevice
 *
 * Extracts:
 * - HTML with embedded GeoGebra applet from fields list
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class GeogebraHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   * Also handles JsIdevice with geogebra-activity type
   * @param {string} className - Legacy class name
   * @param {string} ideviceType - iDevice type from _iDeviceDir (for JsIdevice)
   */
  canHandle(className, ideviceType) {
    // Check legacy GeogebraIdevice class
    if (className.includes('GeogebraIdevice')) {
      return true;
    }
    // Check JsIdevice with geogebra-activity type
    if (ideviceType === 'geogebra-activity') {
      return true;
    }
    return false;
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'geogebra-activity';
  }

  /**
   * Extract HTML view from GeoGebra content
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // GeoGebra content is typically in a fields list with TextAreaField
    const fieldsList = this.findDictList(dict, 'fields');
    if (fieldsList) {
      const textAreas = fieldsList.querySelectorAll(':scope > instance[class*="TextAreaField"]');
      for (const textArea of textAreas) {
        const content = this.extractTextAreaFieldContent(textArea);
        if (content) {
          return content;
        }
      }
    }

    // Fallback: look for direct TextAreaField in dictionary
    const textAreas = dict.querySelectorAll(':scope > instance[class*="TextAreaField"]');
    for (const textArea of textAreas) {
      const content = this.extractTextAreaFieldContent(textArea);
      if (content) {
        return content;
      }
    }

    return '';
  }

  /**
   * Extract properties (none needed for geogebra-activity iDevice)
   */
  extractProperties(dict) {
    return {};
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeogebraHandler;
} else {
  window.GeogebraHandler = GeogebraHandler;
}
