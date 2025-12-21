/**
 * ImageMagnifierHandler
 *
 * Handles legacy ImageMagnifierIdevice.
 * Converts to modern 'magnifier' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.imagemagnifieridevice.ImageMagnifierIdevice
 *
 * Extracts:
 * - imageSrc - the main image path
 * - zoomSize - magnifier zoom level
 * - glassSize - magnifier glass size
 * - caption/description
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class ImageMagnifierHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('ImageMagnifierIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'magnifier';
  }

  /**
   * Extract any description/intro HTML
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for caption or description text
    const captionArea = this.findDictInstance(dict, 'captionTextArea') ||
                       this.findDictInstance(dict, 'descriptionTextArea');
    if (captionArea) {
      return this.extractTextAreaFieldContent(captionArea);
    }

    // Try direct caption value
    const caption = this.findDictStringValue(dict, 'caption') ||
                   this.findDictStringValue(dict, '_caption');
    if (caption) {
      return `<p>${caption}</p>`;
    }

    return '';
  }

  /**
   * Extract properties including image and magnifier settings
   */
  extractProperties(dict) {
    if (!dict) return {};

    const props = {};

    // Extract image source
    const imageSrc = this.extractImagePath(dict);
    if (imageSrc) {
      props.imageSrc = imageSrc;
    }

    // Extract magnifier settings
    const zoomSize = this.findDictStringValue(dict, 'zoomSize') ||
                    this.findDictStringValue(dict, '_zoomSize');
    if (zoomSize) {
      props.zoomSize = parseFloat(zoomSize) || 2;
    }

    const glassSize = this.findDictStringValue(dict, 'glassSize') ||
                     this.findDictStringValue(dict, '_glassSize');
    if (glassSize) {
      props.glassSize = parseInt(glassSize, 10) || 150;
    }

    // Extract max width
    const maxWidth = this.findDictStringValue(dict, 'maxImageWidth') ||
                    this.findDictStringValue(dict, '_maxImageWidth');
    if (maxWidth) {
      props.maxWidth = parseInt(maxWidth, 10);
    }

    // Extract initial zoom position (optional)
    const initialZoomX = this.findDictStringValue(dict, 'initialZoomX');
    const initialZoomY = this.findDictStringValue(dict, 'initialZoomY');
    if (initialZoomX) {
      props.initialZoomX = parseFloat(initialZoomX);
    }
    if (initialZoomY) {
      props.initialZoomY = parseFloat(initialZoomY);
    }

    return props;
  }

  /**
   * Extract image path from the legacy format
   *
   * @param {Element} dict - Dictionary element of the ImageMagnifierIdevice
   * @returns {string|null} The image path or null
   */
  extractImagePath(dict) {
    // Try MagnifierField instance first
    const magnifierInst = this.findDictInstance(dict, '_magnifierField') ||
                         this.findDictInstance(dict, 'magnifierField');
    if (magnifierInst) {
      const mDict = magnifierInst.querySelector(':scope > dictionary');
      if (mDict) {
        const path = this.extractResourcePath(mDict, '_imageResource') ||
                    this.extractResourcePath(mDict, 'imageResource');
        if (path) return path;
      }
    }

    // Try direct image resource
    const path = this.extractResourcePath(dict, '_imageResource') ||
                this.extractResourcePath(dict, 'imageResource') ||
                this.extractResourcePath(dict, '_imagePath');

    return path;
  }

  /**
   * Extract resource path from dictionary
   *
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key name
   * @returns {string|null} Resource path or null
   */
  extractResourcePath(dict, key) {
    const resourceInst = this.findDictInstance(dict, key);
    if (!resourceInst) return null;

    const resourceDict = resourceInst.querySelector(':scope > dictionary');
    if (!resourceDict) return null;

    return this.findDictStringValue(resourceDict, '_storageName') ||
           this.findDictStringValue(resourceDict, 'storageName') ||
           this.findDictStringValue(resourceDict, '_fileName') ||
           this.findDictStringValue(resourceDict, 'fileName');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageMagnifierHandler;
} else {
  window.ImageMagnifierHandler = ImageMagnifierHandler;
}
