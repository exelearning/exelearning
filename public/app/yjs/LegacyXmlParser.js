/**
 * LegacyXmlParser
 * Parses legacy .elp files (contentv3.xml) that use Python pickle format.
 * Converts the legacy XML structure to the same format as modern ODE XML.
 *
 * Legacy format has XML like:
 * <instance class="exe.engine.package.Package">
 *   <dictionary>
 *     <string role="key" value="_title"/>
 *     <unicode value="Project Title"/>
 *     ...
 *   </dictionary>
 * </instance>
 */
class LegacyXmlParser {
  constructor() {
    this.xmlContent = '';
    this.xmlDoc = null;
    this.parentRefMap = new Map(); // nodeRef -> parentRef
  }

  /**
   * Parse legacy XML content and return normalized structure
   * @param {string} xmlContent - The raw XML content from contentv3.xml
   * @returns {Object} Normalized structure with pages, meta, etc.
   */
  parse(xmlContent) {
    Logger.log('[LegacyXmlParser] Parsing legacy XML format');
    this.xmlContent = xmlContent;

    // Parse XML
    const parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const parseError = this.xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`XML parsing error: ${parseError.textContent}`);
    }

    // Build parent reference map
    this.buildParentReferenceMap();

    // Find all Node instances (pages)
    const nodes = this.findAllNodes();
    Logger.log(`[LegacyXmlParser] Found ${nodes.length} legacy nodes`);

    // Extract metadata
    const meta = this.extractMetadata();

    // Build page hierarchy
    const pages = this.buildPageHierarchy(nodes);

    Logger.log(`[LegacyXmlParser] Parse complete: ${pages.length} pages`);

    return {
      meta,
      pages,
    };
  }

  /**
   * Build parent reference map from XML
   * Searches for Node instances and their parent references
   */
  buildParentReferenceMap() {
    // Find all instance elements with class="exe.engine.node.Node"
    const nodeInstances = this.xmlDoc.querySelectorAll('instance[class="exe.engine.node.Node"]');

    for (const nodeEl of nodeInstances) {
      const ref = nodeEl.getAttribute('reference');
      if (!ref) continue;

      // Find parent reference within this node
      // Look for: <string role="key" value="parent"/> followed by <reference> or <none/>
      const dict = nodeEl.querySelector(':scope > dictionary');
      if (!dict) continue;

      const parentRef = this.findDictValue(dict, 'parent');
      this.parentRefMap.set(ref, parentRef);
    }

    Logger.log(`[LegacyXmlParser] Built parent map with ${this.parentRefMap.size} entries`);
  }

  /**
   * Find value for a key in a dictionary element
   * @param {Element} dict - The dictionary element
   * @param {string} key - The key to find
   * @returns {string|null} The value or null
   */
  findDictValue(dict, key) {
    // Dictionary structure: alternating <string role="key" value="KEY"/> and value elements
    const children = Array.from(dict.children);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        // Next element is the value
        const valueEl = children[i + 1];
        if (!valueEl) return null;

        if (valueEl.tagName === 'none') {
          return null;
        }
        if (valueEl.tagName === 'reference') {
          return valueEl.getAttribute('key');
        }
        if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
          return valueEl.getAttribute('value') || valueEl.textContent;
        }
        if (valueEl.tagName === 'instance') {
          return valueEl.getAttribute('reference');
        }
      }
    }

    return null;
  }

  /**
   * Find all Node instances in the document
   * @returns {Element[]} Array of Node instance elements
   */
  findAllNodes() {
    return Array.from(
      this.xmlDoc.querySelectorAll('instance[class="exe.engine.node.Node"]')
    );
  }

  /**
   * Extract metadata from root package
   * @returns {Object} Metadata object with title, author, description
   */
  extractMetadata() {
    const meta = {
      title: 'Legacy Project',
      author: '',
      description: '',
    };

    // Find root package instance
    const rootPackage = this.xmlDoc.querySelector('instance[class="exe.engine.package.Package"]');
    if (!rootPackage) return meta;

    const dict = rootPackage.querySelector(':scope > dictionary');
    if (!dict) return meta;

    // Extract title
    const title = this.findDictValue(dict, '_title');
    if (title) meta.title = title;

    // Extract author
    const author = this.findDictValue(dict, '_author');
    if (author) meta.author = author;

    // Extract description
    const description = this.findDictValue(dict, '_description');
    if (description) meta.description = description;

    Logger.log(`[LegacyXmlParser] Metadata: title="${meta.title}"`);
    return meta;
  }

  /**
   * Build page hierarchy from Node instances
   * @param {Element[]} nodes - Array of Node instance elements
   * @returns {Array} Array of normalized pages (flat with parent_id)
   */
  buildPageHierarchy(nodes) {
    const pageMap = new Map();
    const rootPages = [];

    // 1. Create page object for each node
    nodes.forEach((nodeEl, index) => {
      const ref = nodeEl.getAttribute('reference');
      if (!ref) return;

      const dict = nodeEl.querySelector(':scope > dictionary');
      const title = dict ? (this.findDictValue(dict, '_title') || 'Untitled') : 'Untitled';

      const page = {
        id: `page-${ref}`,
        title: title,
        blocks: [],
        children: [],
        parent_id: null,
        position: index,
      };

      // Extract iDevices (components) for this node
      page.blocks = this.extractNodeBlocks(nodeEl);

      pageMap.set(ref, page);
    });

    // 2. Link children to parents
    pageMap.forEach((page, ref) => {
      const parentRef = this.parentRefMap.get(ref);
      if (parentRef && pageMap.has(parentRef)) {
        const parent = pageMap.get(parentRef);
        parent.children.push(page);
        page.parent_id = parent.id;
      } else {
        rootPages.push(page);
      }
    });

    // 3. Flatten into array with correct structure
    const flatPages = [];
    this.flattenPages(rootPages, flatPages, null);

    return flatPages;
  }

  /**
   * Flatten page tree into array
   * @param {Array} pages - Pages at current level
   * @param {Array} result - Result array to populate
   * @param {string|null} parentId - Parent page ID
   */
  flattenPages(pages, result, parentId) {
    pages.forEach((page, index) => {
      const flatPage = {
        id: page.id,
        title: page.title,
        parent_id: parentId,
        position: result.length,
        blocks: page.blocks,
      };
      result.push(flatPage);

      // Recursively add children
      if (page.children && page.children.length > 0) {
        this.flattenPages(page.children, result, page.id);
      }
    });
  }

  /**
   * Extract blocks and iDevices from a Node
   * @param {Element} nodeEl - The Node instance element
   * @returns {Array} Array of blocks with idevices
   */
  extractNodeBlocks(nodeEl) {
    const blocks = [];

    // In legacy format, iDevices are stored in the node's dictionary under "idevices"
    // They're in a list element
    const dict = nodeEl.querySelector(':scope > dictionary');
    if (!dict) return blocks;

    // Find idevices list
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === 'idevices') {
        const listEl = children[i + 1];
        if (listEl && listEl.tagName === 'list') {
          // Create a single block containing all iDevices
          const block = {
            id: `block-${nodeEl.getAttribute('reference')}-0`,
            name: '',  // Empty by default (legacy files didn't have block names)
            position: 0,
            idevices: this.extractIDevices(listEl),
          };
          if (block.idevices.length > 0) {
            blocks.push(block);
          }
        }
        break;
      }
    }

    return blocks;
  }

  /**
   * Extract iDevices from a list element
   * @param {Element} listEl - The list element containing iDevice instances
   * @returns {Array} Array of iDevice objects
   */
  extractIDevices(listEl) {
    const idevices = [];

    // Find all instance elements that are iDevices
    const instances = listEl.querySelectorAll(':scope > instance');

    for (const inst of instances) {
      const className = inst.getAttribute('class') || '';

      // Check if this is an iDevice (class contains "idevice" case-insensitive)
      if (!className.toLowerCase().includes('idevice')) continue;

      const ref = inst.getAttribute('reference') || `idev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      // Extract iDevice type from class name or _iDeviceDir
      // e.g., "exe.engine.jsidevice.JsIdevice" -> need to get _iDeviceDir for real type
      const typeParts = className.split('.');
      let ideviceType = typeParts[typeParts.length - 1] || 'FreeTextIdevice';

      const dict = inst.querySelector(':scope > dictionary');

      // For JsIdevice, extract the actual type from _iDeviceDir
      if (className === 'exe.engine.jsidevice.JsIdevice' && dict) {
        const iDeviceDir = this.findDictStringValue(dict, '_iDeviceDir');
        if (iDeviceDir) {
          ideviceType = iDeviceDir;
        }
      }

      const idevice = {
        id: `idevice-${ref}`,
        type: ideviceType,
        position: idevices.length,
        htmlView: '',
      };

      // Extract HTML content from iDevice
      if (dict) {
        // Strategy 1: Look for "fields" list (JsIdevice format)
        const fieldsContent = this.extractFieldsContent(dict);
        if (fieldsContent) {
          idevice.htmlView = fieldsContent;
        }

        // Strategy 2: Direct content fields (older formats)
        if (!idevice.htmlView) {
          const contentFields = ['content', '_content', '_html', 'htmlView', 'story', '_story', 'text', '_text'];
          for (const field of contentFields) {
            const content = this.extractRichTextContent(dict, field);
            if (content) {
              idevice.htmlView = content;
              break;
            }
          }
        }

        // Strategy 3: Any TextField or TextAreaField
        if (!idevice.htmlView) {
          idevice.htmlView = this.extractAnyTextFieldContent(dict);
        }
      }

      idevices.push(idevice);
    }

    Logger.log(`[LegacyXmlParser] Extracted ${idevices.length} iDevices`);
    return idevices;
  }

  /**
   * Find a string value in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {string|null} Value or null
   */
  findDictStringValue(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'string') {
          return valueEl.getAttribute('value') || valueEl.textContent || null;
        }
      }
    }
    return null;
  }

  /**
   * Extract content from "fields" list in JsIdevice format
   * Structure: fields -> list -> TextAreaField instances -> content_w_resourcePaths
   * @param {Element} dict - Dictionary element of the iDevice
   * @returns {string} Combined HTML content from all fields
   */
  extractFieldsContent(dict) {
    const contents = [];
    const children = Array.from(dict.children);

    // Find "fields" key and its list
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === 'fields') {
        const listEl = children[i + 1];
        if (listEl && listEl.tagName === 'list') {
          // Extract content from each field in the list
          const fieldInstances = listEl.querySelectorAll(':scope > instance');
          for (const fieldInst of fieldInstances) {
            const fieldClass = fieldInst.getAttribute('class') || '';
            // Process TextAreaField and TextField
            if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
              const content = this.extractTextAreaFieldContent(fieldInst);
              if (content) {
                contents.push(content);
              }
            }
          }
        }
        break;
      }
    }

    return contents.join('\n');
  }

  /**
   * Extract content from a TextAreaField instance
   * @param {Element} fieldInst - TextAreaField instance element
   * @returns {string} HTML content
   */
  extractTextAreaFieldContent(fieldInst) {
    const dict = fieldInst.querySelector(':scope > dictionary');
    if (!dict) return '';

    const children = Array.from(dict.children);

    // Look for content_w_resourcePaths or _content key
    const contentKeys = ['content_w_resourcePaths', '_content', 'content'];

    for (const targetKey of contentKeys) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'string' &&
            child.getAttribute('role') === 'key' &&
            child.getAttribute('value') === targetKey) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === 'unicode') {
            const value = valueEl.getAttribute('value') || valueEl.textContent || '';
            if (value.trim()) {
              return this.decodeHtmlContent(value);
            }
          }
        }
      }
    }

    return '';
  }

  /**
   * Extract rich text content from a dictionary field
   * @param {Element} dict - Dictionary element
   * @param {string} fieldName - Field name to look for
   * @returns {string} HTML content or empty string
   */
  extractRichTextContent(dict, fieldName) {
    const children = Array.from(dict.children);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === fieldName) {
        const valueEl = children[i + 1];
        if (!valueEl) return '';

        // Value might be unicode, string, or an instance (TextField)
        if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
          return this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
        }

        if (valueEl.tagName === 'instance') {
          // It's a TextField or similar - look for content inside
          return this.extractTextFieldContent(valueEl);
        }
      }
    }

    return '';
  }

  /**
   * Extract content from a TextField instance
   * @param {Element} fieldInst - TextField instance element
   * @returns {string} HTML content
   */
  extractTextFieldContent(fieldInst) {
    const dict = fieldInst.querySelector(':scope > dictionary');
    if (!dict) return '';

    // TextField stores content in "_content" or "content_w_resourcePaths"
    const children = Array.from(dict.children);

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key') {
        const keyValue = child.getAttribute('value');
        if (keyValue === '_content' || keyValue === 'content_w_resourcePaths' || keyValue === 'content') {
          const valueEl = children[i + 1];
          if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
            return this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
          }
        }
      }
    }

    return '';
  }

  /**
   * Try to extract content from any TextField-like instance in the dictionary
   * @param {Element} dict - Dictionary element
   * @returns {string} HTML content
   */
  extractAnyTextFieldContent(dict) {
    // Look for any instance that might be a TextField
    const instances = dict.querySelectorAll(':scope > instance');

    for (const inst of instances) {
      const className = inst.getAttribute('class') || '';
      if (className.toLowerCase().includes('field') || className.toLowerCase().includes('text')) {
        const content = this.extractTextFieldContent(inst);
        if (content) return content;
      }
    }

    return '';
  }

  /**
   * Decode HTML-encoded content
   * @param {string} text - Encoded text
   * @returns {string} Decoded text
   */
  decodeHtmlContent(text) {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LegacyXmlParser;
} else {
  window.LegacyXmlParser = LegacyXmlParser;
}
