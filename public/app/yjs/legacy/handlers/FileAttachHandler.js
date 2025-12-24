/**
 * FileAttachHandler
 *
 * Handles legacy FileAttachIdevice and AttachmentIdevice.
 * Converts to modern 'text' iDevice with file links.
 *
 * Legacy XML structure:
 * - exe.engine.fileattachidevice.FileAttachIdevice
 * - exe.engine.fileattachidevice.FileAttachIdeviceInc
 * - exe.engine.attachmentidevice.AttachmentIdevice
 *
 * Based on Symfony OdeOldXmlFileAttachIdevice.php:
 * - Converts to 'text' iDevice (not download-source-file)
 * - Creates HTML with links to attached files
 * - Links open in new tab (target="_blank")
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
   * Symfony converts to 'text' iDevice with file links in textTextarea
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Extract HTML content with file links
   *
   * Matches Symfony OdeOldXmlFileAttachIdevice.php format:
   * <p><a href="path" target="_blank">description</a></p>
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Extract files and generate links (Symfony format)
    const files = this.extractFiles(dict);
    if (files.length === 0) return '';

    // Generate HTML links like Symfony does
    const fileLinks = files.map(file => {
      // Use description as link text, fallback to filename
      const linkText = file.description || file.displayName || file.filename;
      return `<p><a href="${file.path}" target="_blank">${linkText}</a></p>`;
    }).join('');

    return fileLinks;
  }

  /**
   * Extract properties for text iDevice
   *
   * Symfony sets textTextarea with the same HTML as htmlView
   */
  extractProperties(dict) {
    const htmlView = this.extractHtmlView(dict);
    if (htmlView) {
      return { textTextarea: htmlView };
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
   *
   * Based on Symfony's extraction of:
   * - fileResource -> _storageName (filename)
   * - fileDescription -> content (description for link text)
   */
  extractFileFromDict(fDict) {
    // Extract file resource path (Symfony: fileResource/_storageName)
    const filename = this.extractResourcePath(fDict, 'fileResource') ||
                    this.extractResourcePath(fDict, '_fileResource') ||
                    this.extractResourcePath(fDict, '_resource') ||
                    this.findDictStringValue(fDict, '_storageName') ||
                    this.findDictStringValue(fDict, 'storageName');

    if (!filename) return null;

    // Extract description from fileDescription TextAreaField (Symfony format)
    let description = '';
    const descInst = this.findDictInstance(fDict, 'fileDescription');
    if (descInst) {
      const descDict = descInst.querySelector(':scope > dictionary');
      if (descDict) {
        description = this.findDictStringValue(descDict, 'content') ||
                     this.findDictStringValue(descDict, '_content') || '';
      }
    }
    // Fallback to direct description field
    if (!description) {
      description = this.findDictStringValue(fDict, '_description') ||
                   this.findDictStringValue(fDict, 'description') || '';
    }

    // If no description, use filename as link text (Symfony behavior)
    if (!description) {
      description = filename;
    }

    // Extract display name
    const displayName = this.findDictStringValue(fDict, '_displayName') ||
                       this.findDictStringValue(fDict, 'displayName') ||
                       this.findDictStringValue(fDict, '_label') ||
                       this.findDictStringValue(fDict, 'label') || filename;

    // Build path (will be updated by resource resolver)
    // Symfony uses: sessionPath + ideviceId + "/" + filename
    const path = `resources/${filename}`;

    return {
      filename: filename,
      displayName: displayName,
      description: description,
      path: path
    };
  }

  /**
   * Extract single file resource
   */
  extractSingleFile(dict) {
    const filename = this.extractResourcePath(dict, 'fileResource') ||
                    this.extractResourcePath(dict, '_fileResource');

    if (!filename) return null;

    const displayName = this.findDictStringValue(dict, '_displayName') ||
                       this.findDictStringValue(dict, 'displayName') || filename;

    const path = `resources/${filename}`;

    return {
      filename: filename,
      displayName: displayName,
      description: filename,  // Use filename as description (link text)
      path: path
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
