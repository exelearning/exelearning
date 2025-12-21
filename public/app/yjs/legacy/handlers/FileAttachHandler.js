/**
 * FileAttachHandler
 *
 * Handles legacy FileAttachIdevice and AttachmentIdevice.
 * Converts to modern 'download-source-file' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.fileattachidevice.FileAttachIdevice
 * - exe.engine.attachmentidevice.AttachmentIdevice
 *
 * Extracts:
 * - files list with filename, displayName, description
 * - introductory text
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class FileAttachHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('FileAttachIdevice') ||
           className.includes('AttachmentIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'download-source-file';
  }

  /**
   * Extract intro HTML content including file links
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Build HTML content with file links
    const parts = [];

    // Look for introductory text
    const introArea = this.findDictInstance(dict, 'introductoryText') ||
                     this.findDictInstance(dict, '_introductoryText') ||
                     this.findDictInstance(dict, 'descriptionTextArea');
    if (introArea) {
      const introText = this.extractTextAreaFieldContent(introArea);
      if (introText) {
        parts.push(introText);
      }
    }

    // Extract files and generate links
    const files = this.extractFiles(dict);
    if (files.length > 0) {
      const fileLinks = files.map(file => {
        const displayName = file.displayName || file.filename;
        const description = file.description ? ` - ${file.description}` : '';
        return `<p><a href="${file.filename}" download="${file.filename}">${displayName}</a>${description}</p>`;
      }).join('\n');
      parts.push(fileLinks);
    }

    return parts.join('\n');
  }

  /**
   * Extract properties including files array
   */
  extractProperties(dict) {
    const files = this.extractFiles(dict);
    if (files.length > 0) {
      return { files };
    }
    return {};
  }

  /**
   * Extract files from the legacy format
   *
   * Structure:
   * - list of FileField instances
   * - Each has: _fileResource, _displayName, _description
   *
   * @param {Element} dict - Dictionary element of the FileAttachIdevice
   * @returns {Array} Array of file objects
   */
  extractFiles(dict) {
    const files = [];

    // Find the list containing FileField instances
    const lists = dict.querySelectorAll(':scope > list');
    let filesList = null;

    for (const list of lists) {
      const firstInst = list.querySelector(':scope > instance');
      if (firstInst) {
        const className = firstInst.getAttribute('class') || '';
        if (className.includes('FileField') || className.includes('AttachmentField')) {
          filesList = list;
          break;
        }
      }
    }

    // Alternative: files may be in a "files" or "_files" key
    if (!filesList) {
      filesList = this.findDictList(dict, 'files') ||
                  this.findDictList(dict, '_files') ||
                  this.findDictList(dict, 'attachments') ||
                  this.findDictList(dict, '_attachments');
    }

    if (!filesList) {
      // Try to find a single file resource
      const singleFile = this.extractSingleFile(dict);
      if (singleFile) {
        files.push(singleFile);
      }
      return files;
    }

    // Iterate each FileField
    const fileInstances = filesList.querySelectorAll(':scope > instance');
    for (const fileInst of fileInstances) {
      const fDict = fileInst.querySelector(':scope > dictionary');
      if (!fDict) continue;

      const file = this.extractFileFromDict(fDict);
      if (file) {
        files.push(file);
      }
    }

    return files;
  }

  /**
   * Extract file info from a dictionary
   */
  extractFileFromDict(fDict) {
    // Extract file resource path
    const filename = this.extractResourcePath(fDict, '_fileResource') ||
                    this.extractResourcePath(fDict, 'fileResource') ||
                    this.extractResourcePath(fDict, '_resource') ||
                    this.findDictStringValue(fDict, '_storageName') ||
                    this.findDictStringValue(fDict, 'storageName');

    if (!filename) return null;

    // Extract display name
    const displayName = this.findDictStringValue(fDict, '_displayName') ||
                       this.findDictStringValue(fDict, 'displayName') ||
                       this.findDictStringValue(fDict, '_label') ||
                       this.findDictStringValue(fDict, 'label') || filename;

    // Extract description
    const description = this.findDictStringValue(fDict, '_description') ||
                       this.findDictStringValue(fDict, 'description') || '';

    return {
      filename: filename,
      displayName: displayName,
      description: description
    };
  }

  /**
   * Extract single file resource
   */
  extractSingleFile(dict) {
    const filename = this.extractResourcePath(dict, '_fileResource') ||
                    this.extractResourcePath(dict, 'fileResource');

    if (!filename) return null;

    const displayName = this.findDictStringValue(dict, '_displayName') ||
                       this.findDictStringValue(dict, 'displayName') || filename;

    return {
      filename: filename,
      displayName: displayName,
      description: ''
    };
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
  module.exports = FileAttachHandler;
} else {
  window.FileAttachHandler = FileAttachHandler;
}
