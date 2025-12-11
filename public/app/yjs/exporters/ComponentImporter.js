/**
 * ComponentImporter
 * Imports .idevice and .block files into the current Yjs document.
 * 100% client-side - no server calls.
 *
 * These files are ZIP archives containing:
 * - content.xml (ODE format with odeComponentsResources marker)
 * - Assets referenced by the components (in content/resources/)
 *
 * @class ComponentImporter
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
   * Import a component file (.idevice or .block) into the current page
   * @param {File} file - The .idevice or .block file
   * @param {string} pageId - Target page ID to import into
   * @returns {Promise<{success: boolean, blockId?: string, error?: string}>}
   */
  async importComponent(file, pageId) {
    Logger.log(`[ComponentImporter] Importing ${file.name} into page ${pageId}`);

    try {
      // 1. Load JSZip
      const JSZip = window.JSZip;
      if (!JSZip) {
        return { success: false, error: 'JSZip library not loaded' };
      }

      // 2. Read file as ArrayBuffer and parse ZIP
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      // 3. Read content.xml
      const contentFile = zip.file('content.xml');
      if (!contentFile) {
        return { success: false, error: 'Invalid component file: content.xml not found' };
      }

      const xmlContent = await contentFile.async('string');

      // 4. Parse XML using DOMParser
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

      // Check for parsing errors
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        return { success: false, error: `XML parsing error: ${parseError.textContent}` };
      }

      // 5. Validate odeComponentsResources marker
      if (!this.validateComponentFile(xmlDoc)) {
        return { success: false, error: 'Invalid component file: missing odeComponentsResources marker' };
      }

      // 6. Import assets from ZIP
      await this.importAssets(zip);

      // 7. Extract blocks and components from XML
      const blocks = this.parseBlocks(xmlDoc);

      if (blocks.length === 0) {
        return { success: false, error: 'No blocks found in component file' };
      }

      // 8. Insert into Yjs document
      const firstBlockId = await this.insertIntoYjs(blocks, pageId);

      Logger.log(`[ComponentImporter] Import complete: ${blocks.length} blocks, first block ID: ${firstBlockId}`);
      return { success: true, blockId: firstBlockId };

    } catch (error) {
      console.error('[ComponentImporter] Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate that the XML has odeComponentsResources marker
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {boolean}
   */
  validateComponentFile(xmlDoc) {
    // Find odeResources/odeResource elements
    const odeResources = xmlDoc.querySelectorAll('odeResource');

    for (const resource of odeResources) {
      const keyEl = resource.querySelector('key');
      const valueEl = resource.querySelector('value');

      if (keyEl && valueEl) {
        const key = keyEl.textContent?.trim();
        const value = valueEl.textContent?.trim();

        if (key === 'odeComponentsResources' && (value === 'true' || value === '1')) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Parse blocks from the XML document
   * @param {Document} xmlDoc - Parsed XML document
   * @returns {Array} Array of block data objects
   */
  parseBlocks(xmlDoc) {
    const blocks = [];

    // Find odePagStructure elements (blocks)
    const pagStructures = xmlDoc.querySelectorAll('odePagStructure');

    for (const pagNode of pagStructures) {
      const block = this.parseBlock(pagNode);
      if (block) {
        blocks.push(block);
      }
    }

    // Sort by order
    blocks.sort((a, b) => a.order - b.order);

    return blocks;
  }

  /**
   * Parse a single block from XML
   * @param {Element} pagNode - odePagStructure element
   * @returns {Object} Block data
   */
  parseBlock(pagNode) {
    const blockId = this.getTextContent(pagNode, 'odeBlockId') || this.generateId('block');
    const blockName = this.getTextContent(pagNode, 'blockName') || '';
    const iconName = this.getTextContent(pagNode, 'iconName') || '';
    const orderStr = this.getTextContent(pagNode, 'odePagStructureOrder');
    const order = orderStr ? parseInt(orderStr, 10) : 0;

    const block = {
      id: blockId,
      blockId: blockId,
      blockName: blockName,
      iconName: iconName,
      order: order,
      components: []
    };

    // Parse components
    const odeComponents = pagNode.querySelectorAll('odeComponent');
    for (const compNode of odeComponents) {
      const component = this.parseComponent(compNode);
      if (component) {
        block.components.push(component);
      }
    }

    // Sort components by order
    block.components.sort((a, b) => a.order - b.order);

    return block;
  }

  /**
   * Parse a single component from XML
   * @param {Element} compNode - odeComponent element
   * @returns {Object} Component data
   */
  parseComponent(compNode) {
    const componentId = this.getTextContent(compNode, 'odeIdeviceId') || this.generateId('idevice');
    const ideviceType = this.getTextContent(compNode, 'odeIdeviceTypeName') || 'FreeTextIdevice';
    const orderStr = this.getTextContent(compNode, 'odeComponentsOrder');
    const order = orderStr ? parseInt(orderStr, 10) : 0;

    // Get HTML view content
    let htmlView = this.getTextContent(compNode, 'htmlView') || '';
    htmlView = this.decodeHtmlContent(htmlView);

    // Convert asset paths to asset:// URLs
    if (this.assetManager && this.assetMap.size > 0 && htmlView) {
      htmlView = this.convertAssetPaths(htmlView);
    }

    // Get JSON properties
    let jsonProperties = {};
    const jsonPropsStr = this.getTextContent(compNode, 'jsonProperties');
    if (jsonPropsStr) {
      try {
        let decoded = this.decodeHtmlContent(jsonPropsStr);
        jsonProperties = JSON.parse(decoded);

        // Convert asset paths in JSON properties
        if (this.assetManager && this.assetMap.size > 0) {
          jsonProperties = this.convertAssetPathsInObject(jsonProperties);
        }
      } catch (e) {
        console.warn('[ComponentImporter] Failed to parse jsonProperties:', e);
      }
    }

    return {
      id: componentId,
      ideviceId: componentId,
      ideviceType: ideviceType,
      order: order,
      htmlView: htmlView,
      jsonProperties: jsonProperties
    };
  }

  /**
   * Import assets from ZIP file
   * @param {JSZip} zip - The ZIP file
   * @returns {Promise<number>} Number of assets imported
   */
  async importAssets(zip) {
    if (!this.assetManager) {
      Logger.log('[ComponentImporter] No AssetManager, skipping asset import');
      return 0;
    }

    // Extract assets from content/resources/ directory
    this.assetMap = new Map();
    let count = 0;

    for (const [path, zipEntry] of Object.entries(zip.files)) {
      // Skip directories and content.xml
      if (zipEntry.dir || path === 'content.xml') {
        continue;
      }

      // Only import files from content/resources/
      if (path.startsWith('content/resources/')) {
        try {
          const data = await zipEntry.async('blob');
          const filename = path.split('/').pop() || 'asset';

          // Create a File object
          const file = new File([data], filename, { type: this.getMimeType(filename) });

          // Insert into asset manager
          const assetId = await this.assetManager.insertAsset(file, {
            originalPath: path,
            filename: filename
          });

          if (assetId) {
            // Store mapping: original path -> asset ID (without asset:// prefix)
            const cleanAssetId = assetId.replace('asset://', '');
            this.assetMap.set(path, cleanAssetId);

            // Also store by filename for simpler path matching
            this.assetMap.set(filename, cleanAssetId);

            Logger.log(`[ComponentImporter] Imported asset: ${path} -> ${cleanAssetId}`);
            count++;
          }
        } catch (e) {
          console.warn(`[ComponentImporter] Failed to import asset ${path}:`, e);
        }
      }
    }

    Logger.log(`[ComponentImporter] Imported ${count} assets`);
    return count;
  }

  /**
   * Convert asset paths in HTML content to asset:// URLs
   * @param {string} html - HTML content
   * @returns {string} HTML with converted paths
   */
  convertAssetPaths(html) {
    if (!html || this.assetMap.size === 0) return html;

    let result = html;

    // Replace content/resources/xxx paths
    for (const [originalPath, assetId] of this.assetMap.entries()) {
      // Skip filename-only entries (they're duplicates for convenience)
      if (!originalPath.includes('/')) continue;

      // Replace various path formats
      const patterns = [
        originalPath,
        originalPath.replace('content/resources/', 'resources/'),
        originalPath.replace('content/', ''),
        `{{context_path}}/${originalPath}`,
        `{{context_path}}/resources/${originalPath.split('/').pop()}`
      ];

      for (const pattern of patterns) {
        if (result.includes(pattern)) {
          result = result.split(pattern).join(`asset://${assetId}`);
        }
      }
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
   * Insert parsed blocks into the Yjs document
   * @param {Array} blocks - Array of block data
   * @param {string} pageId - Target page ID
   * @returns {string} ID of the first inserted block
   */
  async insertIntoYjs(blocks, pageId) {
    if (!this.manager) {
      throw new Error('No YjsDocumentManager available');
    }

    const navigation = this.manager.getNavigation();
    if (!navigation) {
      throw new Error('Navigation not available');
    }

    // Find the target page
    let targetPageMap = null;
    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      if (pageMap.get('id') === pageId || pageMap.get('pageId') === pageId) {
        targetPageMap = pageMap;
        break;
      }
    }

    if (!targetPageMap) {
      throw new Error(`Page ${pageId} not found`);
    }

    let firstBlockId = null;
    const ydoc = this.manager.getDoc();
    const Y = this.Y;

    // Wrap all operations in a single transaction
    ydoc.transact(() => {
      let blocksArray = targetPageMap.get('blocks');
      if (!blocksArray) {
        blocksArray = new Y.Array();
        targetPageMap.set('blocks', blocksArray);
      }

      const startOrder = blocksArray.length;

      for (let i = 0; i < blocks.length; i++) {
        const blockData = blocks[i];

        // Generate new IDs for the imported block and components
        const newBlockId = this.generateId('block');
        if (i === 0) {
          firstBlockId = newBlockId;
        }

        // Create block Y.Map
        const blockMap = new Y.Map();
        blockMap.set('id', newBlockId);
        blockMap.set('blockId', newBlockId);
        blockMap.set('blockName', blockData.blockName || '');
        blockMap.set('iconName', blockData.iconName || '');
        blockMap.set('blockType', 'default');
        blockMap.set('order', startOrder + i);
        blockMap.set('createdAt', new Date().toISOString());

        // Initialize block properties
        const propsMap = new Y.Map();
        propsMap.set('visibility', 'true');
        propsMap.set('teacherOnly', 'false');
        propsMap.set('allowToggle', 'true');
        propsMap.set('minimized', 'false');
        propsMap.set('identifier', '');
        propsMap.set('cssClass', '');
        blockMap.set('properties', propsMap);

        // Create components array
        const componentsArray = new Y.Array();

        for (let j = 0; j < blockData.components.length; j++) {
          const compData = blockData.components[j];

          // Generate new component ID
          const newCompId = this.generateId('idevice');

          // Create component Y.Map
          const compMap = new Y.Map();
          compMap.set('id', newCompId);
          compMap.set('ideviceId', newCompId);
          compMap.set('ideviceType', compData.ideviceType);
          compMap.set('order', j);
          compMap.set('createdAt', new Date().toISOString());

          // Store HTML view (as plain string, Y.Text created on-demand by TinyMCE)
          if (compData.htmlView) {
            compMap.set('htmlView', compData.htmlView);
          }

          // Store JSON properties as string
          if (compData.jsonProperties && Object.keys(compData.jsonProperties).length > 0) {
            compMap.set('jsonProperties', JSON.stringify(compData.jsonProperties));
          } else {
            compMap.set('jsonProperties', '{}');
          }

          componentsArray.push([compMap]);
          Logger.log(`[ComponentImporter] Created component: ${compData.ideviceType} (${newCompId})`);
        }

        blockMap.set('components', componentsArray);
        blocksArray.push([blockMap]);

        Logger.log(`[ComponentImporter] Created block: ${blockData.blockName || 'Block'} (${newBlockId}) with ${blockData.components.length} components`);
      }
    }, ydoc.clientID);

    return firstBlockId;
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
   * Decode HTML-encoded content
   * @param {string} text - Encoded text
   * @returns {string}
   */
  decodeHtmlContent(text) {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
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

  /**
   * Get MIME type from filename
   * @param {string} filename - Filename
   * @returns {string}
   */
  getMimeType(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'wav': 'audio/wav',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentImporter;
} else {
  window.ComponentImporter = ComponentImporter;
}
