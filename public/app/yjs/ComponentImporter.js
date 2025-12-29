/**
 * ComponentImporter
 * Imports .idevice or .block files (ZIP archives) into the current project.
 * These files are exported by ComponentExporter and contain:
 * - content.xml (ODE format with component structure)
 * - Assets referenced by the component
 *
 * Usage:
 *   const importer = new ComponentImporter(documentManager, assetManager);
 *   const result = await importer.importComponent(file, targetPageId);
 *   if (result.success) {
 *     console.log('Imported block:', result.blockId);
 *   }
 */
class ComponentImporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetManager} assetManager - Asset manager for storing assets
   */
  constructor(documentManager, assetManager = null) {
    this.manager = documentManager;
    this.assetManager = assetManager;
    this.Y = window.Y;

    // Map of original asset paths to asset IDs (populated during import)
    this.assetMap = new Map();
  }

  /**
   * Import a component (.idevice or .block) file into the target page
   * @param {File} file - The .idevice or .block file to import
   * @param {string} targetPageId - Page ID where the block should be added
   * @returns {Promise<{success: boolean, blockId?: string, error?: string}>}
   */
  async importComponent(file, targetPageId) {
    Logger.log(`[ComponentImporter] Importing ${file.name} to page ${targetPageId}...`);

    try {
      // Validate target page exists
      const targetPage = this.findPage(targetPageId);
      if (!targetPage) {
        return { success: false, error: 'Target page not found' };
      }

      // Load fflate
      const fflateLib = window.fflate;
      if (!fflateLib) {
        return { success: false, error: 'fflate library not loaded' };
      }

      // Load ZIP - convert File to ArrayBuffer then to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Data = new Uint8Array(arrayBuffer);

      // Use sync decompression
      let zip;
      try {
        zip = fflateLib.unzipSync(uint8Data);
      } catch (e) {
        return { success: false, error: 'Invalid ZIP file: ' + e.message };
      }

      // Find content.xml
      const contentFile = zip['content.xml'];
      if (!contentFile) {
        return { success: false, error: 'No content.xml found in component file' };
      }

      const contentXml = new TextDecoder().decode(contentFile);

      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(contentXml, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        return { success: false, error: 'XML parsing error: ' + parseError.textContent };
      }

      // Verify this is a component export (has odeComponentsResources marker)
      if (!this.isComponentExport(xmlDoc)) {
        return { success: false, error: 'Invalid component file: missing odeComponentsResources marker' };
      }

      // Import assets first
      if (this.assetManager) {
        this.assetMap = await this.assetManager.extractAssetsFromZip(zip);
        Logger.log(`[ComponentImporter] Imported ${this.assetMap.size} assets`);
      }

      // Parse block structure from XML
      const blockData = this.parseBlockFromXml(xmlDoc);
      if (!blockData) {
        return { success: false, error: 'No block structure found in component file' };
      }

      // Generate new IDs for the block and components
      const newBlockId = this.generateId('block');
      blockData.id = newBlockId;
      blockData.blockId = newBlockId;

      // Generate new IDs for components
      for (const comp of blockData.components) {
        const newCompId = this.generateId('idevice');
        comp.id = newCompId;
        comp.ideviceId = newCompId;
      }

      // Insert block into target page
      const ydoc = this.manager.getDoc();
      const navigation = this.manager.getNavigation();

      ydoc.transact(() => {
        // Find page in navigation
        for (let i = 0; i < navigation.length; i++) {
          const pageMap = navigation.get(i);
          const pageId = pageMap.get('id') || pageMap.get('pageId');

          if (pageId === targetPageId) {
            // Get or create blocks array
            let blocksArray = pageMap.get('blocks');
            if (!blocksArray) {
              blocksArray = new this.Y.Array();
              pageMap.set('blocks', blocksArray);
            }

            // Calculate order for new block (append at end)
            const newOrder = blocksArray.length;
            blockData.order = newOrder;

            // Create Y.Map for block
            const blockYMap = this.createBlockYMap(blockData);
            blocksArray.push([blockYMap]);

            Logger.log(`[ComponentImporter] Block inserted at order ${newOrder}`);
            break;
          }
        }
      });

      Logger.log(`[ComponentImporter] Import complete: ${newBlockId}`);
      return { success: true, blockId: newBlockId };
    } catch (error) {
      console.error('[ComponentImporter] Import failed:', error);
      return { success: false, error: error.message || 'Import failed' };
    }
  }

  /**
   * Check if the XML document is a component export
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {boolean}
   */
  isComponentExport(xmlDoc) {
    // Look for odeComponentsResources marker
    const resources = xmlDoc.querySelectorAll('odeResource');
    for (const res of resources) {
      const keyEl = res.querySelector('key');
      const valueEl = res.querySelector('value');
      if (keyEl?.textContent === 'odeComponentsResources' && valueEl?.textContent === 'true') {
        return true;
      }
    }
    return false;
  }

  /**
   * Find a page by ID in the navigation
   * @param {string} pageId - Page ID to find
   * @returns {Y.Map|null}
   */
  findPage(pageId) {
    const navigation = this.manager.getNavigation();
    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      const id = pageMap.get('id') || pageMap.get('pageId');
      if (id === pageId) {
        return pageMap;
      }
    }
    return null;
  }

  /**
   * Parse block data from XML document
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {Object|null} Block data object
   */
  parseBlockFromXml(xmlDoc) {
    const pagStructure = xmlDoc.querySelector('odePagStructure');
    if (!pagStructure) {
      return null;
    }

    const blockId = this.getTextContent(pagStructure, 'odeBlockId') || this.generateId('block');
    const blockName = this.getTextContent(pagStructure, 'blockName') || '';
    const iconName = this.getTextContent(pagStructure, 'iconName') || '';
    const order = parseInt(this.getTextContent(pagStructure, 'odePagStructureOrder') || '0', 10);

    // Parse properties
    const propsText = this.getTextContent(pagStructure, 'odePagStructureProperties');
    let properties = {};
    if (propsText) {
      try {
        properties = JSON.parse(propsText);
      } catch (e) {
        // Properties might be in a different format, ignore parse errors
      }
    }

    const blockData = {
      id: blockId,
      blockId: blockId,
      blockName: blockName,
      iconName: iconName,
      order: order,
      createdAt: new Date().toISOString(),
      components: [],
      properties: properties,
    };

    // Parse components
    const components = pagStructure.querySelectorAll('odeComponent');
    for (const compNode of components) {
      const compData = this.parseComponentFromXml(compNode);
      if (compData) {
        blockData.components.push(compData);
      }
    }

    return blockData;
  }

  /**
   * Parse component data from XML element
   * @param {Element} compNode - odeComponent element
   * @returns {Object} Component data object
   */
  parseComponentFromXml(compNode) {
    const compId = this.getTextContent(compNode, 'odeIdeviceId') || this.generateId('idevice');
    const ideviceType = this.getTextContent(compNode, 'odeIdeviceTypeName') || 'FreeTextIdevice';
    const order = parseInt(this.getTextContent(compNode, 'odeComponentsOrder') || '0', 10);

    // Get HTML view content
    let htmlView = '';
    const htmlViewNode = compNode.querySelector('htmlView');
    if (htmlViewNode) {
      htmlView = this.decodeHtmlContent(htmlViewNode.textContent || '');
    }

    // Get JSON properties
    let properties = {};
    const jsonPropsNode = compNode.querySelector('jsonProperties');
    if (jsonPropsNode) {
      try {
        properties = JSON.parse(this.decodeHtmlContent(jsonPropsNode.textContent || '{}'));
      } catch (e) {
        console.warn('[ComponentImporter] Failed to parse JSON properties:', e);
      }
    }

    // Convert asset URLs in HTML content
    if (this.assetManager && this.assetMap.size > 0 && htmlView) {
      htmlView = this.convertAssetPaths(htmlView);
    }

    // Convert asset URLs in properties
    if (this.assetManager && this.assetMap.size > 0 && properties) {
      properties = this.convertAssetPathsInObject(properties);
    }

    return {
      id: compId,
      ideviceId: compId,
      ideviceType: ideviceType,
      type: ideviceType,
      order: order,
      createdAt: new Date().toISOString(),
      htmlView: htmlView,
      properties: properties,
    };
  }

  /**
   * Convert asset:// URLs with original UUIDs to new asset UUIDs
   * @param {string} content - HTML content with asset:// URLs
   * @returns {string} Content with converted URLs
   */
  convertAssetPaths(content) {
    if (!content || typeof content !== 'string') return content;

    // The exported content has asset://originalUuid/filename format
    // The assetMap maps originalPath (content/resources/uuid/filename) to new asset ID
    // We need to convert asset://oldUuid/filename to asset://newUuid/filename

    // First, collect all asset://uuid patterns from content
    // UUID pattern matches both standard UUIDs and test IDs like "old-uuid-123"
    const assetPattern = /asset:\/\/([a-zA-Z0-9_-]+)(\/[^"'\s)]+)?/gi;
    let match;
    const replacements = new Map();

    while ((match = assetPattern.exec(content)) !== null) {
      const oldUuid = match[1];
      const suffix = match[2] || '';

      // Find the new asset ID for this old UUID
      // assetMap is: originalPath -> newAssetId
      // originalPath is like "content/resources/uuid/filename"
      for (const [originalPath, newAssetId] of this.assetMap.entries()) {
        // Check if this originalPath contains our old UUID
        if (originalPath.includes(oldUuid)) {
          // Extract filename from originalPath if suffix is empty
          let newSuffix = suffix;
          if (!newSuffix) {
            const parts = originalPath.split('/');
            newSuffix = '/' + parts[parts.length - 1];
          }
          replacements.set(`asset://${oldUuid}${suffix}`, `asset://${newAssetId}${newSuffix}`);
          break;
        }
      }
    }

    // Apply all replacements
    let result = content;
    for (const [oldUrl, newUrl] of replacements) {
      result = result.split(oldUrl).join(newUrl);
    }

    return result;
  }

  /**
   * Recursively convert asset paths in an object
   * @param {any} obj - Object to process
   * @returns {any} Processed object
   */
  convertAssetPathsInObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.convertAssetPaths(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertAssetPathsInObject(item));
    }

    if (typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertAssetPathsInObject(value);
      }
      return result;
    }

    return obj;
  }

  /**
   * Create Y.Map from block data
   * @param {Object} blockData - Plain JS object with block data
   * @returns {Y.Map}
   */
  createBlockYMap(blockData) {
    const blockMap = new this.Y.Map();

    blockMap.set('id', blockData.id);
    blockMap.set('blockId', blockData.blockId);
    blockMap.set('blockName', blockData.blockName);
    blockMap.set('iconName', blockData.iconName || '');
    blockMap.set('order', blockData.order);
    blockMap.set('createdAt', blockData.createdAt);

    // Set properties if present
    if (blockData.properties && Object.keys(blockData.properties).length > 0) {
      const propsMap = new this.Y.Map();
      for (const [key, value] of Object.entries(blockData.properties)) {
        if (value !== undefined && value !== null) {
          propsMap.set(key, value);
        }
      }
      blockMap.set('properties', propsMap);
    }

    // Create components array
    const componentsArray = new this.Y.Array();
    for (const compData of blockData.components) {
      const compMap = this.createComponentYMap(compData);
      componentsArray.push([compMap]);
    }
    blockMap.set('components', componentsArray);

    return blockMap;
  }

  /**
   * Create Y.Map from component data
   * @param {Object} compData - Plain JS object with component data
   * @returns {Y.Map}
   */
  createComponentYMap(compData) {
    const compMap = new this.Y.Map();

    compMap.set('id', compData.id);
    compMap.set('ideviceId', compData.ideviceId);
    compMap.set('ideviceType', compData.ideviceType);
    compMap.set('type', compData.type);
    compMap.set('order', compData.order);
    compMap.set('createdAt', compData.createdAt);

    if (compData.htmlView) {
      compMap.set('htmlView', compData.htmlView);
    }

    if (compData.properties && typeof compData.properties === 'object') {
      compMap.set('jsonProperties', JSON.stringify(compData.properties));
    }

    return compMap;
  }

  /**
   * Get text content from a child element
   * @param {Element} parent - Parent element
   * @param {string} tagName - Tag name to find
   * @returns {string|null}
   */
  getTextContent(parent, tagName) {
    const el = parent.querySelector(tagName);
    return el ? el.textContent : null;
  }

  /**
   * Decode HTML-encoded content (CDATA handling)
   * Handles two cases:
   * 1. CDATA wrapper: "<![CDATA[<p>content</p>]]>" - strip wrapper, return inner content as-is
   * 2. HTML entities: "&lt;p&gt;content&lt;/p&gt;" - decode entities
   * @param {string} text - Text to decode
   * @returns {string}
   */
  decodeHtmlContent(text) {
    if (!text) return '';
    let content = text.trim();

    // Handle CDATA wrapper if present - content is already plain text/HTML
    if (content.startsWith('<![CDATA[') && content.endsWith(']]>')) {
      return content.slice(9, -3);
    }

    // Decode HTML entities (for HTML-escaped content)
    const textarea = document.createElement('textarea');
    textarea.innerHTML = content;
    return textarea.value;
  }

  /**
   * Generate a unique ID
   * @param {string} prefix - ID prefix
   * @returns {string}
   */
  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentImporter;
} else {
  window.ComponentImporter = ComponentImporter;
}
