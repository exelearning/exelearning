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
   * Property names MUST match what the modern magnifier editor expects
   */
  extractProperties(dict) {
    // Default structure matching modern magnifier editor expectations
    const defaultProperties = {
      textTextarea: '',        // Instructions (from htmlView/caption)
      imageResource: '',       // Image path
      isDefaultImage: '1',     // '0' = custom image, '1' = default
      width: 600,              // Image width
      height: '',              // Image height
      align: 'left',           // Alignment
      initialZSize: 100,       // Initial zoom (100, 150, 200, etc.)
      glassSize: 2,            // Magnifier size (1-6 range, 2 = 100px)
    };

    if (!dict) return defaultProperties;

    const props = { ...defaultProperties };

    // Extract image source -> imageResource
    const imagePath = this.extractImagePath(dict);
    if (imagePath) {
      props.imageResource = imagePath;
      props.isDefaultImage = '0';  // Has custom image
    }

    // Extract instructions from caption (goes to textTextarea)
    const caption = this.extractHtmlView(dict);
    if (caption) {
      props.textTextarea = caption;
    }

    // Extract magnifier settings
    // Legacy zoomSize (like 2.0) -> initialZSize (100, 150, 200, etc.)
    const zoomSize = this.findDictStringValue(dict, 'zoomSize') ||
                    this.findDictStringValue(dict, '_zoomSize');
    if (zoomSize) {
      // Convert legacy zoom multiplier (e.g. 2.0) to percentage (e.g. 200)
      const zoomMultiplier = parseFloat(zoomSize) || 2;
      props.initialZSize = Math.round(zoomMultiplier * 100);
    }

    // Legacy glassSize (like 150px) -> modern glassSize (1-6 range)
    // 1=50, 2=100, 3=150, 4=200, 5=250, 6=300
    const legacyGlassSize = this.findDictStringValue(dict, 'glassSize') ||
                           this.findDictStringValue(dict, '_glassSize');
    if (legacyGlassSize) {
      const glassPx = parseInt(legacyGlassSize, 10) || 100;
      // Convert px to range: 50->1, 100->2, 150->3, 200->4, 250->5, 300->6
      props.glassSize = Math.max(1, Math.min(6, Math.round(glassPx / 50)));
    }

    // Extract width (from maxImageWidth)
    const maxWidth = this.findDictStringValue(dict, 'maxImageWidth') ||
                    this.findDictStringValue(dict, '_maxImageWidth');
    if (maxWidth) {
      props.width = parseInt(maxWidth, 10) || 600;
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
