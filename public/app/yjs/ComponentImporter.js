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

/**
 * Maximum size (compressed) accepted for a .idevice/.block ZIP file. Rejecting
 * oversized files before reading them into memory protects the browser from
 * memory exhaustion (see "decompression bomb" / zip-bomb hardening).
 */
const MAX_COMPONENT_FILE_BYTES = 50 * 1024 * 1024; // 50 MiB

/**
 * Maximum total size (uncompressed) accepted across all ZIP entries. Enforced
 * in two layers:
 * 1. BEFORE inflation, on the declared uncompressed size of each entry, via
 *    the unzipSync filter (see createDeclaredSizeFilter). fflate allocates the
 *    output buffer at that declared size and never grows past it, so skipping
 *    entries whose cumulative total exceeds the limit bounds the memory used
 *    by unzipSync itself — a heavily-compressed ZIP is rejected before it can
 *    inflate, instead of after.
 * 2. AFTER decompression, on the actual byte lengths (validateUncompressedSize),
 *    as a backstop for archives that lie in their central directory (a forged
 *    small declared size only yields truncated, memory-bounded output).
 */
const MAX_COMPONENT_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200 MiB

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
      // Reject oversized files before reading them into memory
      const sizeError = this.validateCompressedSize(file);
      if (sizeError) {
        return { success: false, error: sizeError };
      }

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

      // Use sync decompression. The filter runs BEFORE each entry is inflated
      // and receives its declared uncompressed size, so entries that would
      // push the cumulative total past the limit are skipped (never
      // decompressed, never allocated) instead of inflating first.
      let zip;
      let declaredSizeViolation = { error: null };
      try {
        zip = fflateLib.unzipSync(uint8Data, {
          filter: this.createDeclaredSizeFilter(declaredSizeViolation),
        });
      } catch (e) {
        return { success: false, error: 'Invalid ZIP file: ' + e.message };
      }

      // A declared-size violation was detected while extracting: reject.
      if (declaredSizeViolation.error) {
        return { success: false, error: declaredSizeViolation.error };
      }

      // Backstop: verify the actual decompressed sizes (a forged central
      // directory can only produce truncated, memory-bounded output).
      const uncompressedSizeError = this.validateUncompressedSize(zip);
      if (uncompressedSizeError) {
        return { success: false, error: uncompressedSizeError };
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

      // Generate new IDs for components. When jsonProperties carries an
      // embedded ideviceId (text/quiz iDevices store it for self-reference),
      // rewrite it to the fresh id so the Y.Map field and the JSON payload
      // stay in sync. See #1786.
      for (const comp of blockData.components) {
        const originalCompId = comp.id;
        const newCompId = this.generateId('idevice');
        comp.id = newCompId;
        comp.ideviceId = newCompId;
        if (originalCompId && comp.properties && typeof comp.properties === 'object'
            && comp.properties.ideviceId === originalCompId) {
          comp.properties.ideviceId = newCompId;
        }
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
      }, ydoc.clientID);

      Logger.log(`[ComponentImporter] Import complete: ${newBlockId}`);
      return { success: true, blockId: newBlockId };
    } catch (error) {
      console.error('[ComponentImporter] Import failed:', error);
      return { success: false, error: error.message || 'Import failed' };
    }
  }

  /**
   * Import a single .idevice file into an existing block.
   *
   * Unlike importComponent (which creates a new block in a page), this appends
   * the parsed component(s) to the `components` Y.Array of an existing block.
   * Only .idevice files are accepted; .block files are rejected.
   *
   * @param {File} file - The .idevice file to import
   * @param {string} pageId - Page ID that contains the target block
   * @param {string} blockId - Target block ID
   * @returns {Promise<{success: boolean, blockId?: string, componentIds?: string[], error?: string}>}
   */
  async importIdeviceIntoBlock(file, pageId, blockId) {
    Logger.log(`[ComponentImporter] Importing ${file.name} into block ${blockId}...`);

    try {
      // Reject oversized files before reading them into memory
      const sizeError = this.validateCompressedSize(file);
      if (sizeError) {
        return { success: false, error: sizeError };
      }

      // Only .idevice files are allowed in this flow
      if (!file.name.toLowerCase().endsWith('.idevice')) {
        return { success: false, error: 'The file is not an iDevice (.idevice)' };
      }

      const fflateLib = window.fflate;
      if (!fflateLib) {
        return { success: false, error: 'fflate library not loaded' };
      }

      // Load ZIP. The filter runs BEFORE each entry is inflated and receives
      // its declared uncompressed size, so entries that would push the
      // cumulative total past the limit are skipped (never decompressed, never
      // allocated) instead of inflating first.
      const arrayBuffer = await file.arrayBuffer();
      let zip;
      let declaredSizeViolation = { error: null };
      try {
        zip = fflateLib.unzipSync(new Uint8Array(arrayBuffer), {
          filter: this.createDeclaredSizeFilter(declaredSizeViolation),
        });
      } catch (e) {
        return { success: false, error: 'Invalid ZIP file: ' + e.message };
      }

      // A declared-size violation was detected while extracting: reject.
      if (declaredSizeViolation.error) {
        return { success: false, error: declaredSizeViolation.error };
      }

      // Backstop: verify the actual decompressed sizes (a forged central
      // directory can only produce truncated, memory-bounded output).
      const uncompressedSizeError = this.validateUncompressedSize(zip);
      if (uncompressedSizeError) {
        return { success: false, error: uncompressedSizeError };
      }

      const contentFile = zip['content.xml'];
      if (!contentFile) {
        return { success: false, error: 'No content.xml found in component file' };
      }
      const contentXml = new TextDecoder().decode(contentFile);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(contentXml, 'text/xml');
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        return { success: false, error: 'XML parsing error: ' + parseError.textContent };
      }

      if (!this.isComponentExport(xmlDoc)) {
        return { success: false, error: 'Invalid component file: missing odeComponentsResources marker' };
      }

      // Import assets first
      if (this.assetManager) {
        this.assetMap = await this.assetManager.extractAssetsFromZip(zip);
        Logger.log(`[ComponentImporter] Imported ${this.assetMap.size} assets`);
      }

      // Parse components from the XML (a .idevice carries a single component
      // wrapped in its own block, but we accept all components found)
      const blockData = this.parseBlockFromXml(xmlDoc);
      if (!blockData || blockData.components.length === 0) {
        return { success: false, error: 'No iDevice found in component file' };
      }

      // Find the target page and block
      const targetPage = this.findPage(pageId);
      if (!targetPage) {
        return { success: false, error: 'Target page not found' };
      }

      // Generate fresh IDs for the components, keeping an embedded
      // jsonProperties.ideviceId in sync (same rule as importComponent, #1786)
      for (const comp of blockData.components) {
        const originalCompId = comp.id;
        const newCompId = this.generateId('idevice');
        comp.id = newCompId;
        comp.ideviceId = newCompId;
        if (originalCompId && comp.properties && typeof comp.properties === 'object'
            && comp.properties.ideviceId === originalCompId) {
          comp.properties.ideviceId = newCompId;
        }
      }

      // Insert components into the target block
      const ydoc = this.manager.getDoc();
      let inserted = false;

      ydoc.transact(() => {
        const blocksArray = targetPage.get('blocks');
        if (!blocksArray) return;

        const blockMap = this.findBlockInArray(blocksArray, blockId);
        if (!blockMap) return;

        let componentsArray = blockMap.get('components');
        if (!componentsArray) {
          componentsArray = new this.Y.Array();
          blockMap.set('components', componentsArray);
        }

        for (const compData of blockData.components) {
          compData.order = componentsArray.length;
          componentsArray.push([this.createComponentYMap(compData)]);
        }
        inserted = true;
      }, ydoc.clientID);

      if (!inserted) {
        return { success: false, error: 'Target block not found' };
      }

      Logger.log(`[ComponentImporter] Imported ${blockData.components.length} iDevice(s) into block ${blockId}`);
      return {
        success: true,
        blockId: blockId,
        componentIds: blockData.components.map((c) => c.id),
      };
    } catch (error) {
      console.error('[ComponentImporter] Import into block failed:', error);
      return { success: false, error: error.message || 'Import failed' };
    }
  }

  /**
   * Find a block Y.Map inside a blocks Y.Array by id/blockId
   * @param {Y.Array} blocksArray
   * @param {string} blockId
   * @returns {Y.Map|null}
   */
  findBlockInArray(blocksArray, blockId) {
    for (let i = 0; i < blocksArray.length; i++) {
      const blockMap = blocksArray.get(i);
      const id = blockMap.get('blockId') || blockMap.get('id');
      if (id === blockId) {
        return blockMap;
      }
    }
    return null;
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

    // Convert {{context_path}} URLs to asset:// URLs (same as ELPX import)
    // This is used when importing components exported with the new flat UUID format
    if (this.assetManager && this.assetMap.size > 0 && htmlView) {
      htmlView = this.assetManager.convertContextPathToAssetRefs(htmlView, this.assetMap);
    }

    // Convert {{context_path}} in properties too
    if (this.assetManager && this.assetMap.size > 0 && properties) {
      properties = this.convertAssetPathsInObject(properties);
    }

    // Parse component-level structure properties (visibility, teacherOnly, cssClass).
    // These live in <odeComponentsProperties> as <odeComponentsProperty> key/value
    // pairs (NOT in jsonProperties). Without this, a re-imported .block/.idevice
    // lost "Visible in export", "Teacher only" and custom CSS classes (issue #1991).
    const structureProperties = this.parseComponentStructureProperties(compNode);

    const compData = {
      id: compId,
      ideviceId: compId,
      ideviceType: ideviceType,
      type: ideviceType,
      order: order,
      createdAt: new Date().toISOString(),
      htmlView: htmlView,
      properties: properties,
    };

    if (structureProperties) {
      compData.structureProperties = structureProperties;
    }

    return compData;
  }

  /**
   * Parse component structure properties from an <odeComponent> element.
   *
   * Reads the <odeComponentsProperty> key/value pairs inside
   * <odeComponentsProperties>. Returns undefined when none are present so callers
   * can skip creating an empty properties map.
   *
   * @param {Element} compNode - odeComponent element
   * @returns {Object|undefined} Map of structure property key -> string value
   */
  parseComponentStructureProperties(compNode) {
    const container = compNode.querySelector('odeComponentsProperties');
    if (!container) {
      return undefined;
    }

    const propNodes = container.querySelectorAll('odeComponentsProperty');
    if (!propNodes || propNodes.length === 0) {
      return undefined;
    }

    const structureProperties = {};
    for (const propNode of propNodes) {
      const key = this.getTextContent(propNode, 'key');
      if (!key) continue;
      structureProperties[key] = this.getTextContent(propNode, 'value') || '';
    }

    return Object.keys(structureProperties).length > 0 ? structureProperties : undefined;
  }

  /**
   * Convert asset:// URLs with original UUIDs to new asset UUIDs
   * Supports both formats:
   * - New format: asset://uuid.ext
   * - Legacy format: asset://uuid/path/filename
   * @param {string} content - HTML content with asset:// URLs
   * @returns {string} Content with converted URLs (always new format)
   */
  convertAssetPaths(content) {
    if (!content || typeof content !== 'string') return content;

    // Match both formats:
    // - New format: asset://uuid.ext
    // - Legacy format: asset://uuid/path/filename
    // UUID pattern matches both standard UUIDs and test IDs like "old-uuid-123"
    const assetPattern = /asset:\/\/([a-zA-Z0-9_-]+)(\.[a-z0-9]+|\/[^"'\s)]+)?/gi;
    let match;
    const replacements = new Map();

    while ((match = assetPattern.exec(content)) !== null) {
      const oldUuid = match[1];
      const suffix = match[2] || '';

      // Find the new asset ID for this old UUID
      // assetMap is: originalPath -> newAssetId
      // originalPath is like "content/resources/uuid/filename" or "uuid/filename"
      for (const [originalPath, newAssetId] of this.assetMap.entries()) {
        // Check if this originalPath contains our old UUID
        if (originalPath.includes(oldUuid)) {
          // Extract filename from originalPath to get extension
          const parts = originalPath.split('/');
          const filename = parts[parts.length - 1];
          // Generate new format URL: asset://uuid.ext
          const ext = filename?.includes('.') ? filename.split('.').pop().toLowerCase() : '';
          const newUrl = ext ? `asset://${newAssetId}.${ext}` : `asset://${newAssetId}`;
          // Map old URL (any format) to new URL
          replacements.set(`asset://${oldUuid}${suffix || ''}`, newUrl);
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
   * Recursively convert {{context_path}} refs in an object to asset:// URLs
   * Uses AssetManager.convertContextPathToAssetRefs for string conversion.
   * @param {any} obj - Object to process
   * @returns {any} Processed object
   */
  convertAssetPathsInObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      // Use convertContextPathToAssetRefs for {{context_path}} format (new format)
      if (obj.includes('{{context_path}}') && this.assetManager) {
        return this.assetManager.convertContextPathToAssetRefs(obj, this.assetMap);
      }
      return obj;
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

    // Store component-level structure properties (visibility, teacherOnly,
    // cssClass) in the dedicated `properties` Y.Map, matching the full-page
    // import path (createComponentMapFromApi) so the workarea and later exports
    // pick them up (issue #1991).
    if (compData.structureProperties && Object.keys(compData.structureProperties).length > 0) {
      const propsMap = new this.Y.Map();
      for (const [key, value] of Object.entries(compData.structureProperties)) {
        if (value !== undefined && value !== null) {
          propsMap.set(key, value);
        }
      }
      compMap.set('properties', propsMap);
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
   * Validate the compressed size of a component file, returning an error
   * message when the file exceeds MAX_COMPONENT_FILE_BYTES, or null otherwise.
   *
   * @param {File} file
   * @returns {string|null}
   */
  validateCompressedSize(file) {
    if (typeof file.size === 'number' && file.size > MAX_COMPONENT_FILE_BYTES) {
      return `Component file is too large (${Math.round(file.size / (1024 * 1024))} MB). Maximum allowed is ${MAX_COMPONENT_FILE_BYTES / (1024 * 1024)} MB.`;
    }
    return null;
  }

  /**
   * Validate the total uncompressed size of a decompressed ZIP, returning an
   * error message when the cumulative bytes exceed MAX_COMPONENT_UNCOMPRESSED_BYTES,
   * or null otherwise. Backstop against decompression bombs whose central
   * directory under-reports entry sizes.
   *
   * @param {Object} zip - Result of fflate.unzipSync (path -> Uint8Array)
   * @returns {string|null}
   */
  validateUncompressedSize(zip) {
    let totalBytes = 0;
    for (const entry of Object.values(zip)) {
      if (entry && typeof entry.byteLength === 'number') {
        totalBytes += entry.byteLength;
        if (totalBytes > MAX_COMPONENT_UNCOMPRESSED_BYTES) {
          return `Component file expands beyond the allowed size (${MAX_COMPONENT_UNCOMPRESSED_BYTES / (1024 * 1024)} MB uncompressed).`;
        }
      }
    }
    return null;
  }

  /**
   * Create a filter for fflate's unzipSync that enforces
   * MAX_COMPONENT_UNCOMPRESSED_BYTES against the DECLARED uncompressed size of
   * each ZIP entry, before that entry is inflated. This is the primary guard
   * against decompression bombs: fflate only decompresses (and only allocates
   * the output buffer for) entries the filter accepts, and its inflate never
   * grows past the declared size, so a bomb is rejected without ever
   * inflating into memory.
   *
   * On violation the filter records the error on the passed violation object
   * (which the caller checks after unzipSync) and skips the offending entry
   * and every subsequent one.
   *
   * @param {{error: string|null}} violation - Mutated to carry the error message
   * @returns {function(Object): boolean} unzipSync filter
   */
  createDeclaredSizeFilter(violation) {
    let totalBytes = 0;
    return (info) => {
      if (violation.error) {
        return false;
      }
      const declaredBytes =
        info && typeof info.originalSize === 'number' && info.originalSize > 0
          ? info.originalSize
          : 0;
      totalBytes += declaredBytes;
      if (totalBytes > MAX_COMPONENT_UNCOMPRESSED_BYTES) {
        violation.error = `Component file expands beyond the allowed size (${MAX_COMPONENT_UNCOMPRESSED_BYTES / (1024 * 1024)} MB uncompressed).`;
        return false;
      }
      return true;
    };
  }

  /**
   * Generate a unique ID.
   *
   * Mirrors src/shared/ids.ts::generateId — keep in sync. See issue #1782.
   *
   * @param {string} prefix - ID prefix
   * @returns {string}
   */
  generateId(prefix) {
    if (!prefix) {
      throw new Error('generateId: prefix is required');
    }
    const timestamp = Date.now().toString(36);
    // Pad to a fixed 9-char suffix: `toString(36)` yields a variable-length
    // tail, so without this the suffix is occasionally 8 chars. Mirrors
    // src/shared/ids.ts::generateId — keep in sync. See issue #1782.
    const random = Math.random().toString(36).substring(2, 11).padEnd(9, '0');
    return `${prefix}-${timestamp}-${random}`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentImporter;
} else {
  window.ComponentImporter = ComponentImporter;
}
