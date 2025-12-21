/**
 * GalleryHandler
 *
 * Handles legacy ImageGalleryIdevice and GalleryIdevice.
 * Converts to modern 'image-gallery' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.imagegalleryldevice.ImageGalleryIdevice
 * - exe.engine.galleryidevice.GalleryIdevice
 *
 * Extracts:
 * - images list with src, alt, caption
 * - gallery settings
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class GalleryHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('ImageGalleryIdevice') ||
           className.includes('GalleryIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'image-gallery';
  }

  /**
   * Extract any intro/description content
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for description or intro text
    const descriptionArea = this.findDictInstance(dict, 'descriptionTextArea');
    if (descriptionArea) {
      return this.extractTextAreaFieldContent(descriptionArea);
    }

    return '';
  }

  /**
   * Extract properties including images array
   */
  extractProperties(dict) {
    const images = this.extractImages(dict);

    // Extract gallery settings
    const showCaptions = this.findDictBoolValue(dict, 'showCaptions');
    const showThumbnails = this.findDictBoolValue(dict, 'showThumbnails');

    const props = {};

    if (images.length > 0) {
      props.images = images;
    }

    if (showCaptions !== undefined) {
      props.showCaptions = showCaptions;
    }

    if (showThumbnails !== undefined) {
      props.showThumbnails = showThumbnails;
    }

    return props;
  }

  /**
   * Extract images from the legacy format
   *
   * Structure:
   * - list of GalleryImage instances
   * - Each has: imageResource (path), caption, thumbnailResource
   *
   * @param {Element} dict - Dictionary element of the GalleryIdevice
   * @returns {Array} Array of image objects
   */
  extractImages(dict) {
    const images = [];

    // Find the list containing GalleryImage instances
    const lists = dict.querySelectorAll(':scope > list');
    let imagesList = null;

    for (const list of lists) {
      const firstInst = list.querySelector(':scope > instance');
      if (firstInst) {
        const className = firstInst.getAttribute('class') || '';
        if (className.includes('GalleryImage')) {
          imagesList = list;
          break;
        }
      }
    }

    // Alternative: images may be in an "_images" or "images" key
    if (!imagesList) {
      imagesList = this.findDictList(dict, '_images') ||
                   this.findDictList(dict, 'images') ||
                   this.findDictList(dict, '_userResources');
    }

    if (!imagesList) return images;

    // Iterate each GalleryImage
    const imageInstances = imagesList.querySelectorAll(':scope > instance');
    for (const imageInst of imageInstances) {
      const iDict = imageInst.querySelector(':scope > dictionary');
      if (!iDict) continue;

      // Extract image resource path
      const imageResource = this.extractResourcePath(iDict, '_imageResource') ||
                           this.extractResourcePath(iDict, 'imageResource');

      // Extract caption
      const caption = this.findDictStringValue(iDict, 'caption') ||
                     this.findDictStringValue(iDict, '_caption') || '';

      // Extract alt text
      const alt = this.findDictStringValue(iDict, 'alt') ||
                 this.findDictStringValue(iDict, '_alt') || caption;

      // Extract thumbnail (optional)
      const thumbnail = this.extractResourcePath(iDict, '_thumbnailResource') ||
                       this.extractResourcePath(iDict, 'thumbnailResource');

      if (imageResource) {
        const image = {
          src: imageResource,
          alt: alt,
          caption: caption
        };

        if (thumbnail) {
          image.thumbnail = thumbnail;
        }

        images.push(image);
      }
    }

    return images;
  }

  /**
   * Extract resource path from dictionary
   *
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key name
   * @returns {string|null} Resource path or null
   */
  extractResourcePath(dict, key) {
    // Look for resource instance
    const resourceInst = this.findDictInstance(dict, key);
    if (!resourceInst) return null;

    const resourceDict = resourceInst.querySelector(':scope > dictionary');
    if (!resourceDict) return null;

    // Get storageName or fileName
    const storageName = this.findDictStringValue(resourceDict, '_storageName') ||
                       this.findDictStringValue(resourceDict, 'storageName') ||
                       this.findDictStringValue(resourceDict, '_fileName') ||
                       this.findDictStringValue(resourceDict, 'fileName');

    return storageName || null;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GalleryHandler;
} else {
  window.GalleryHandler = GalleryHandler;
}
