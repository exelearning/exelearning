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
   * Extract properties in format expected by modern image-gallery iDevice
   *
   * Modern format uses indexed keys (img_0, img_1, etc.) with fields:
   * - img: image path with resources/ prefix
   * - thumbnail: thumbnail path with resources/ prefix (optional)
   * - title: caption text
   * - linktitle, author, linkauthor, license: attribution fields
   */
  extractProperties(dict) {
    const images = this.extractImages(dict);
    const props = {};

    // Convert to indexed format expected by modern iDevice
    // The image-gallery edition code uses Object.entries() and expects img_N keys
    // Paths need resources/ prefix as that's where assets are stored
    images.forEach((image, index) => {
      props[`img_${index}`] = {
        img: `resources/${image.src}`,                                    // Add resources/ prefix
        thumbnail: image.thumbnail ? `resources/${image.thumbnail}` : '', // Include thumbnail with prefix
        title: image.caption || '',                                       // caption → title
        linktitle: '',                                                    // Not available in legacy format
        author: '',                                                       // Not available in legacy format
        linkauthor: '',                                                   // Not available in legacy format
        license: ''                                                       // Not available in legacy format
      };
    });

    return props;
  }

  /**
   * Extract images from the legacy format
   *
   * Legacy XML structure:
   * - "images" key points to a GalleryImages wrapper instance
   * - The actual list is inside that wrapper under ".listitems" key
   * - Each GalleryImage has: _imageResource, _caption (TextField), _thumbnailResource
   *
   * @param {Element} dict - Dictionary element of the GalleryIdevice
   * @returns {Array} Array of image objects
   */
  extractImages(dict) {
    const images = [];
    let imagesList = null;

    // STEP 1: Find the images list
    // The "images" key points to a GalleryImages instance wrapper
    // The actual list is inside that instance under ".listitems"
    const imagesInstance = this.findDictInstance(dict, 'images') ||
                           this.findDictInstance(dict, '_images');

    if (imagesInstance) {
      const imagesDict = imagesInstance.querySelector(':scope > dictionary');
      if (imagesDict) {
        // The actual list is under ".listitems" inside the wrapper
        imagesList = this.findDictList(imagesDict, '.listitems');
      }
    }

    // Fallback: direct list containing GalleryImage instances (some formats)
    if (!imagesList) {
      const lists = dict.querySelectorAll(':scope > list');
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
    }

    // Fallback: try direct list keys
    if (!imagesList) {
      imagesList = this.findDictList(dict, '_images') ||
                   this.findDictList(dict, 'images') ||
                   this.findDictList(dict, '_userResources');
    }

    if (!imagesList) return images;

    // STEP 2: Extract each GalleryImage
    const imageInstances = imagesList.querySelectorAll(':scope > instance');
    for (const imageInst of imageInstances) {
      const iDict = imageInst.querySelector(':scope > dictionary');
      if (!iDict) continue;

      // Extract image resource path
      const imageResource = this.extractResourcePath(iDict, '_imageResource') ||
                           this.extractResourcePath(iDict, 'imageResource');

      // Extract caption from TextField instance
      // Legacy format stores caption as TextField instance, not direct string
      let caption = '';
      const captionInstance = this.findDictInstance(iDict, '_caption') ||
                             this.findDictInstance(iDict, 'caption');
      if (captionInstance) {
        caption = this.extractTextAreaFieldContent(captionInstance);
      }
      // Fallback: try direct string value (some legacy formats)
      if (!caption) {
        caption = this.findDictStringValue(iDict, 'caption') ||
                 this.findDictStringValue(iDict, '_caption') || '';
      }

      // Extract alt text
      let alt = '';
      const altInstance = this.findDictInstance(iDict, '_alt') ||
                         this.findDictInstance(iDict, 'alt');
      if (altInstance) {
        alt = this.extractTextAreaFieldContent(altInstance);
      }
      if (!alt) {
        alt = this.findDictStringValue(iDict, 'alt') ||
             this.findDictStringValue(iDict, '_alt') || caption;
      }

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
