/**
 * ElpxImporter
 * Imports .elpx (ZIP) files and populates a Yjs document.
 * Parses content.xml to extract navigation, pages, blocks, and iDevices.
 *
 * Uses AssetManager to store assets with asset:// URLs.
 *
 * Usage:
 *   const importer = new ElpxImporter(yjsDocumentManager, assetManager);
 *   await importer.importFromFile(file);
 */
class ElpxImporter {
  // Default block properties (from ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG)
  static BLOCK_PROPERTY_DEFAULTS = {
    visibility: 'true',
    teacherOnly: 'false',
    allowToggle: 'true',
    minimized: 'false',
    identifier: '',
    cssClass: ''
  };

  // Default component properties
  static COMPONENT_PROPERTY_DEFAULTS = {
    visibility: 'true',
    teacherOnly: 'false',
    identifier: '',
    cssClass: ''
  };

  // Default page properties
  static PAGE_PROPERTY_DEFAULTS = {
    visibility: 'true',
    highlight: 'false',
    hidePageTitle: 'false',
    editableInPage: 'false',
    titlePage: '',
    titleNode: ''
  };

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

    // Progress callback (set via options.onProgress)
    this.onProgress = null;
  }

  /**
   * Report progress to callback if set
   * @param {string} phase - Current phase: 'decompress' | 'assets' | 'structure' | 'precache'
   * @param {number} percent - Progress percentage (0-100)
   * @param {string} message - Localized message to display
   */
  _reportProgress(phase, percent, message) {
    if (typeof this.onProgress === 'function') {
      this.onProgress({ phase, percent, message });
    }
  }

  /**
   * Import an .elpx file
   * @param {File} file - The .elpx file to import
   * @param {Object} options - Import options
   * @param {boolean} options.clearExisting - If true, clears existing structure before import (default: true)
   * @param {boolean} options.clearIndexedDB - If true, clears IndexedDB before import (for testing)
   * @param {string|null} options.parentId - Parent page ID to import under (null for root level)
   * @returns {Promise<{pages: number, blocks: number, components: number, assets: number}>}
   */
  async importFromFile(file, options = {}) {
    const { clearExisting = true, clearIndexedDB = false, parentId = null, onProgress = null } = options;

    // Store progress callback
    if (onProgress) {
      this.onProgress = onProgress;
    }

    Logger.log(`[ElpxImporter] Importing ${file.name}... (clearExisting: ${clearExisting}, parentId: ${parentId})`);

    // Phase 1: Decompressing (0-10%)
    this._reportProgress('decompress', 0, typeof _ === 'function' ? _('Decompressing...') : 'Decompressing...');

    // Optional: Clear IndexedDB to ensure clean state (for debugging)
    if (clearIndexedDB && this.manager && this.manager.projectId) {
      const dbName = `exelearning-project-${this.manager.projectId}`;
      Logger.log(`[ElpxImporter] Clearing IndexedDB: ${dbName}`);
      try {
        await this.clearIndexedDB(dbName);
        Logger.log('[ElpxImporter] IndexedDB cleared successfully');
      } catch (e) {
        console.warn('[ElpxImporter] Failed to clear IndexedDB:', e);
      }
    }

    // Load fflate
    const fflateLib = window.fflate;
    if (!fflateLib) {
      throw new Error('fflate library not loaded');
    }

    // Load ZIP - convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Data = new Uint8Array(arrayBuffer);

    // Use sync decompression - async workers cause memory issues on mobile (Chrome Android)
    const zip = fflateLib.unzipSync(uint8Data);

    // Report decompression complete (10%)
    this._reportProgress('decompress', 10, typeof _ === 'function' ? _('File decompressed') : 'File decompressed');

    // Check if this ZIP contains a nested ELP file instead of direct content
    // This handles cases where a user opens a .zip that contains an .elp/.elpx file
    let workingZip = zip;

    // Track if this is an EPUB format (content in EPUB/ folder)
    let isEpubFormat = false;

    // First, check if content.xml or contentv3.xml exists at root or in EPUB/ folder
    if (!zip['content.xml'] && !zip['contentv3.xml'] && !zip['EPUB/content.xml']) {
      // Scan for nested .elp/.elpx files at root level
      const elpFiles = Object.keys(zip).filter(name =>
        !name.includes('/') && // Root level only
        (name.toLowerCase().endsWith('.elp') || name.toLowerCase().endsWith('.elpx'))
      );

      if (elpFiles.length === 1) {
        // Found a nested ELP file - extract it
        Logger.log(`[ElpxImporter] Found nested ELP file: ${elpFiles[0]}, extracting...`);
        const nestedElpData = zip[elpFiles[0]];
        workingZip = fflateLib.unzipSync(nestedElpData);
      } else if (elpFiles.length > 1) {
        throw new Error('ZIP contains multiple ELP files. Please extract and open one at a time.');
      }
      // If no ELP files found, workingZip remains as original zip (will fail below if no content.xml)
    }

    // Find content.xml (could be content.xml, contentv3.xml for legacy, or EPUB/content.xml for EPUB)
    let contentXml = null;
    let contentFile = workingZip['content.xml'];
    let isLegacyFormat = false;

    if (!contentFile) {
      // Check for EPUB format (content.xml inside EPUB/ folder)
      contentFile = workingZip['EPUB/content.xml'];
      if (contentFile) {
        isEpubFormat = true;
        Logger.log('[ElpxImporter] EPUB format detected (content.xml in EPUB/ folder)');
      }
    }

    if (!contentFile) {
      contentFile = workingZip['contentv3.xml'];
      isLegacyFormat = true;
    }

    if (!contentFile) {
      throw new Error('No content.xml found in .elpx file');
    }

    // Store EPUB format flag for asset extraction
    workingZip._isEpubFormat = isEpubFormat;

    contentXml = new TextDecoder().decode(contentFile);

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(contentXml, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`XML parsing error: ${parseError.textContent}`);
    }

    // Check if it's Python pickle format (legacy .elp with contentv3.xml)
    const rootElement = xmlDoc.documentElement?.tagName;
    if (rootElement === 'instance' || rootElement === 'dictionary') {
      Logger.log('[ElpxImporter] Legacy Python pickle format detected, importing legacy format...');
      return await this.importLegacyFormat(file, { clearExisting, parentId, preExtractedZip: workingZip });
    }

    // Extract and import structure
    const stats = await this.importStructure(xmlDoc, workingZip, { clearExisting, parentId });

    Logger.log(`[ElpxImporter] Import complete:`, stats);
    return stats;
  }

  /**
   * Import document structure from parsed XML
   * @param {Document} xmlDoc - Parsed XML document
   * @param {Object} zip - The extracted ZIP files object from fflate {path: Uint8Array}
   * @param {Object} options - Import options
   * @param {boolean} options.clearExisting - If true, clears existing structure before import
   * @param {string|null} options.parentId - Parent page ID to import under (null for root level)
   */
  async importStructure(xmlDoc, zip, options = {}) {
    const { clearExisting = true, parentId = null } = options;
    const stats = { pages: 0, blocks: 0, components: 0, assets: 0 };

    // Phase 2: Extracting assets (10-50%)
    this._reportProgress('assets', 10, typeof _ === 'function' ? _('Extracting assets...') : 'Extracting assets...');

    // *** IMPORTANT: Extract assets FIRST ***
    // This populates this.assetMap for {{context_path}} conversion
    stats.assets = await this.importAssets(zip);

    // Assets extracted (50%)
    this._reportProgress('assets', 50, typeof _ === 'function' ? _('Assets extracted') : 'Assets extracted');

    // Get Y.Doc components
    const ydoc = this.manager.getDoc();
    const navigation = this.manager.getNavigation();
    const metadata = this.manager.getMetadata();

    // Extract pages (odeNavStructures) - do this BEFORE the transaction
    let odeNavStructures = this.findNavStructures(xmlDoc);

    Logger.log('[ElpxImporter] Root element:', xmlDoc.documentElement?.tagName);
    Logger.log('[ElpxImporter] Found odeNavStructure elements:', odeNavStructures.length);

    // Build a map of all pages by ID for hierarchy lookup
    const pageMap = new Map();
    for (const navNode of odeNavStructures) {
      const pageId = this.getPageId(navNode);
      if (pageId) {
        pageMap.set(pageId, navNode);
      }
    }

    // Filter to only root-level pages (those without parent or with null/empty parent)
    const rootNavStructures = [];
    for (const navNode of odeNavStructures) {
      const parentId = this.getParentPageId(navNode);
      if (!parentId || parentId === '' || parentId === 'null') {
        rootNavStructures.push(navNode);
      }
    }

    // Sort root pages by order
    rootNavStructures.sort((a, b) => {
      const orderA = this.getNavOrder(a);
      const orderB = this.getNavOrder(b);
      return orderA - orderB;
    });

    Logger.log('[ElpxImporter] Root-level pages to import:', rootNavStructures.length);

    // Extract metadata info before transaction
    const odeProperties = xmlDoc.querySelector('odeProperties');

    // Extract theme from userPreferences or odeProperties
    let themeFromXml = '';
    const userPreferences = xmlDoc.querySelector('userPreferences');
    if (userPreferences) {
      const themePrefs = userPreferences.querySelectorAll('userPreference');
      for (const pref of themePrefs) {
        const keyEl = pref.querySelector('key');
        const valueEl = pref.querySelector('value');
        if (keyEl && keyEl.textContent === 'theme' && valueEl) {
          themeFromXml = valueEl.textContent || '';
          break;
        }
      }
    }
    // Fallback to odeProperties pp_style if not found in userPreferences
    if (!themeFromXml && odeProperties) {
      themeFromXml = this.getPropertyValue(odeProperties, 'pp_style') || '';
    }

    const metadataValues = {
      // Basic metadata
      title: odeProperties ? (this.getPropertyValue(odeProperties, 'pp_title') || 'Imported Project') : 'Imported Project',
      subtitle: odeProperties ? (this.getPropertyValue(odeProperties, 'pp_subtitle') || '') : '',
      author: odeProperties ? (this.getPropertyValue(odeProperties, 'pp_author') || '') : '',
      language: odeProperties ? (this.getPropertyValue(odeProperties, 'pp_lang') || 'en') : 'en',
      description: odeProperties ? (this.getPropertyValue(odeProperties, 'pp_description') || '') : '',
      license: odeProperties ? (this.getPropertyValue(odeProperties, 'pp_license') || '') : '',
      theme: themeFromXml,
      // Export settings
      addPagination: odeProperties ? this.parseBooleanProperty(odeProperties, 'pp_addPagination', false) : false,
      addSearchBox: odeProperties ? this.parseBooleanProperty(odeProperties, 'pp_addSearchBox', false) : false,
      addExeLink: odeProperties ? this.parseBooleanProperty(odeProperties, 'pp_addExeLink', true) : true,
      addAccessibilityToolbar: odeProperties ? this.parseBooleanProperty(odeProperties, 'pp_addAccessibilityToolbar', false) : false,
      exportSource: odeProperties ? this.parseBooleanProperty(odeProperties, 'exportSource', true) : true,
      extraHeadContent: odeProperties ? (this.getPropertyValue(odeProperties, 'pp_extraHeadContent') || '') : '',
      footer: odeProperties ? (this.getPropertyValue(odeProperties, 'footer') || '') : '',
    };

    // Calculate order offset for imported pages (only when not clearing)
    // This ensures imported pages are added after existing pages at the same level
    let orderOffset = 0;
    if (!clearExisting) {
      orderOffset = this.getNextAvailableOrder(parentId);
      Logger.log('[ElpxImporter] Order offset for import:', orderOffset, 'at parent:', parentId);
    }

    // Build all page structures as a FLAT list (not nested)
    // The structure expects all pages in the navigation array with parentId references
    // If parentId is provided, root-level pages will become children of that parent
    // idRemap maps original XML IDs to new generated IDs to preserve hierarchy
    const pageStructures = [];
    const idRemap = new Map();
    this.buildFlatPageList(rootNavStructures, zip, odeNavStructures, pageStructures, parentId, orderOffset, idRemap, true);
    Logger.log('[ElpxImporter] Built flat page list:', pageStructures.length, 'pages, parentId:', parentId, 'idRemap size:', idRemap.size);

    // Phase 3: Importing structure (50-80%)
    this._reportProgress('structure', 50, typeof _ === 'function' ? _('Importing structure...') : 'Importing structure...');

    // *** WRAP ALL Yjs OPERATIONS IN A SINGLE TRANSACTION ***
    // This ensures all nested Y types are integrated atomically
    Logger.log('[ElpxImporter] Starting Yjs transaction...');
    try {
      ydoc.transact(() => {
        Logger.log('[ElpxImporter] Inside transaction');

        // Clear existing structure only if requested
        if (clearExisting) {
          Logger.log('[ElpxImporter] Clearing existing navigation, length:', navigation.length);
          while (navigation.length > 0) {
            navigation.delete(0);
          }
          Logger.log('[ElpxImporter] Navigation cleared');
        }

        // Set metadata only if clearing (replacing) the document
        if (odeProperties && clearExisting) {
          Logger.log('[ElpxImporter] Setting metadata...');
          // Basic metadata
          metadata.set('title', metadataValues.title);
          if (metadataValues.subtitle) {
            metadata.set('subtitle', metadataValues.subtitle);
          }
          metadata.set('author', metadataValues.author);
          metadata.set('language', metadataValues.language);
          metadata.set('description', metadataValues.description);
          metadata.set('license', metadataValues.license);
          if (metadataValues.theme) {
            metadata.set('theme', metadataValues.theme);
            Logger.log('[ElpxImporter] Theme set:', metadataValues.theme);
          }
          // Export settings
          metadata.set('addPagination', metadataValues.addPagination);
          metadata.set('addSearchBox', metadataValues.addSearchBox);
          metadata.set('addExeLink', metadataValues.addExeLink);
          metadata.set('addAccessibilityToolbar', metadataValues.addAccessibilityToolbar);
          metadata.set('exportSource', metadataValues.exportSource);
          if (metadataValues.extraHeadContent) {
            metadata.set('extraHeadContent', metadataValues.extraHeadContent);
          }
          if (metadataValues.footer) {
            metadata.set('footer', metadataValues.footer);
          }
          Logger.log('[ElpxImporter] Metadata set (including export settings)');
        }

        // Now create Y types and add to document inside the transaction
        Logger.log('[ElpxImporter] Creating', pageStructures.length, 'page structures...');
        for (let i = 0; i < pageStructures.length; i++) {
          const pageData = pageStructures[i];
          Logger.log(`[ElpxImporter] Processing page ${i + 1}/${pageStructures.length}: ${pageData.pageName}`);

          try {
            const pageYMap = this.createPageYMap(pageData, stats);
            if (pageYMap) {
              Logger.log('[ElpxImporter] Page Y.Map created, pushing to navigation...');
              try {
                navigation.push([pageYMap]);
                Logger.log('[ElpxImporter] Page pushed successfully');
              } catch (pushErr) {
                console.error('[ElpxImporter] ERROR pushing page to navigation:', pushErr);
                console.error('[ElpxImporter] Page data was:', pageData.pageName);
                throw pushErr;
              }
              stats.pages++;
            }
          } catch (pageErr) {
            console.error('[ElpxImporter] ERROR creating page:', pageData.pageName, pageErr);
            throw pageErr;
          }
        }
        Logger.log('[ElpxImporter] All pages created');
      });
      Logger.log('[ElpxImporter] Transaction completed successfully');

      // Structure imported (80%)
      this._reportProgress('structure', 80, typeof _ === 'function' ? _('Structure imported') : 'Structure imported');
    } catch (transactionErr) {
      console.error('[ElpxImporter] TRANSACTION ERROR:', transactionErr);
      console.error('[ElpxImporter] Error stack:', transactionErr.stack);
      throw transactionErr;
    }

    // Phase 4: Precaching assets (80-100%)
    this._reportProgress('precache', 80, typeof _ === 'function' ? _('Precaching assets...') : 'Precaching assets...');

    // Preload all assets for immediate rendering
    if (this.assetManager && this.assetManager.preloadAllAssets) {
      await this.assetManager.preloadAllAssets();
    }

    // Import complete (100%)
    this._reportProgress('precache', 100, typeof _ === 'function' ? _('Import complete') : 'Import complete');

    // Add theme to stats for caller to handle theme import
    stats.theme = metadataValues.theme || null;

    Logger.log(`[ElpxImporter] Import complete:`, stats);
    return stats;
  }

  /**
   * Build a flat list of all pages (recursive helper)
   * Pages are added with parentId references instead of nested children arrays
   * Generates new unique IDs for all pages to avoid conflicts with existing pages
   * @param {Array} navNodes - Nav structure elements to process
   * @param {Object} zip - The extracted ZIP files object from fflate
   * @param {Array} allNavStructures - All nav structures for finding children
   * @param {Array} flatList - The flat list to populate
   * @param {string|null} parentId - Parent page ID for the imported pages
   * @param {number} orderOffset - Offset to add to order values (for root level)
   * @param {Map} idRemap - Map of original XML IDs to new generated IDs
   * @param {boolean} isRootLevel - Whether these are root-level imports
   */
  buildFlatPageList(navNodes, zip, allNavStructures, flatList, parentId, orderOffset = 0, idRemap = new Map(), isRootLevel = true) {
    // Track order within this sibling group
    let siblingOrder = 0;

    for (const navNode of navNodes) {
      // Get original ID from XML (before generating new one)
      const originalPageId = this.getPageId(navNode);

      // Generate NEW unique ID to avoid conflicts with existing pages
      const newPageId = this.generateId('page');

      // Store the mapping for hierarchy preservation
      if (originalPageId) {
        idRemap.set(originalPageId, newPageId);
        Logger.log(`[ElpxImporter] ID remap: ${originalPageId} -> ${newPageId}`);
      }

      // Calculate the order for this page
      // Root level pages get offset applied, child pages start from 0
      const calculatedOrder = isRootLevel ? (orderOffset + siblingOrder) : siblingOrder;

      // Build page data with the new ID and calculated order
      const pageData = this.buildPageData(navNode, zip, parentId, newPageId, calculatedOrder);
      if (pageData) {
        flatList.push(pageData);
        siblingOrder++;

        // Find child pages using ORIGINAL XML ID
        const childNavNodes = [];
        for (const childNav of allNavStructures) {
          const childXmlParentId = this.getParentPageId(childNav);
          if (childXmlParentId === originalPageId) {
            childNavNodes.push(childNav);
          }
        }

        // Sort children by order and recursively add them
        childNavNodes.sort((a, b) => this.getNavOrder(a) - this.getNavOrder(b));
        if (childNavNodes.length > 0) {
          // Children use the NEW parent ID, not the original
          // orderOffset is 0 for children (they start fresh within their parent)
          this.buildFlatPageList(childNavNodes, zip, allNavStructures, flatList, newPageId, 0, idRemap, false);
        }
      }
    }
  }

  /**
   * Build plain JavaScript data structure from XML (no Yjs types)
   * This is done BEFORE the transaction to separate parsing from Yjs operations
   * @param {Element} navNode - The odeNavStructure element
   * @param {Object} zip - The extracted ZIP files object from fflate
   * @param {string|null} parentId - Parent page ID
   * @param {string|null} newPageId - Pre-generated page ID (if null, generates new one)
   * @param {number|null} calculatedOrder - Pre-calculated order (if null, reads from XML)
   * @returns {Object} Plain JS object with page data
   */
  buildPageData(navNode, zip, parentId = null, newPageId = null, calculatedOrder = null) {
    // Use provided ID or generate new one (fallback for backward compatibility)
    const pageId = newPageId || this.generateId('page');
    const pageName = this.getPageName(navNode);
    // Use provided order or read from XML (fallback)
    const order = calculatedOrder !== null ? calculatedOrder : this.getNavOrder(navNode);

    // Extract page-level properties (hidePageTitle, editableInPage, titleNode, etc.)
    const properties = this.getNavStructureProperties(navNode);

    const pageData = {
      id: pageId,
      pageId: pageId,
      pageName: pageName,
      title: pageName,
      parentId: parentId,
      order: order,
      createdAt: new Date().toISOString(),
      blocks: [],
      properties: properties
    };

    Logger.log(`[ElpxImporter] Building page data: "${pageName}" (${pageId}) parent: ${parentId} order: ${order}`);

    // Extract blocks (odePagStructures)
    const pagStructures = this.findPagStructures(navNode);

    // Sort blocks by order
    const sortedPagStructures = Array.from(pagStructures).sort((a, b) => {
      const orderA = this.getPagOrder(a);
      const orderB = this.getPagOrder(b);
      return orderA - orderB;
    });

    for (const pagNode of sortedPagStructures) {
      const blockData = this.buildBlockData(pagNode, zip);
      if (blockData) {
        pageData.blocks.push(blockData);
      }
    }

    return pageData;
  }

  /**
   * Build plain JavaScript data structure for a block
   * @param {Element} pagNode - The odePagStructure element
   * @param {Object} zip - The extracted ZIP files object from fflate
   * @returns {Object} Plain JS object with block data
   */
  buildBlockData(pagNode, zip) {
    const blockId = pagNode.getAttribute('odePagStructureId') ||
                    this.getTextContent(pagNode, 'odeBlockId') ||
                    this.generateId('block');
    const blockName = pagNode.getAttribute('blockName') ||
                      this.getTextContent(pagNode, 'blockName') ||
                      '';
    const order = this.getPagOrder(pagNode);

    // Extract iconName from XML
    const iconName = pagNode.getAttribute('iconName') ||
                     this.getTextContent(pagNode, 'iconName') ||
                     '';

    // Extract block-level properties (visibility, minimized, teacherOnly, cssClass, identifier)
    const properties = this.getPagStructureProperties(pagNode);

    const blockData = {
      id: blockId,
      blockId: blockId,
      blockName: blockName,
      iconName: iconName,
      order: order,
      createdAt: new Date().toISOString(),
      components: [],
      properties: properties
    };

    // Extract components (odeComponents)
    const odeComponents = this.findOdeComponents(pagNode);

    // Sort by order
    const sortedComponents = Array.from(odeComponents).sort((a, b) => {
      const orderA = this.getComponentOrder(a);
      const orderB = this.getComponentOrder(b);
      return orderA - orderB;
    });

    for (const compNode of sortedComponents) {
      const compData = this.buildComponentData(compNode, zip);
      if (compData) {
        blockData.components.push(compData);
      }
    }

    return blockData;
  }

  /**
   * Build plain JavaScript data structure for a component
   * @param {Element} compNode - The odeComponent element
   * @param {Object} zip - The extracted ZIP files object from fflate
   * @returns {Object} Plain JS object with component data
   */
  buildComponentData(compNode, zip) {
    const componentId = compNode.getAttribute('odeComponentId') ||
                        this.getTextContent(compNode, 'odeIdeviceId') ||
                        this.generateId('idevice');
    let ideviceType = compNode.getAttribute('odeIdeviceTypeDirName') ||
                        compNode.getAttribute('odeIdeviceTypeName') ||
                        this.getTextContent(compNode, 'odeIdeviceTypeName') ||
                        'FreeTextIdevice';

    // Normalize legacy type names to modern names
    const LEGACY_TYPE_ALIASES = {
      'download-package': 'download-source-file',
    };
    if (LEGACY_TYPE_ALIASES[ideviceType]) {
      ideviceType = LEGACY_TYPE_ALIASES[ideviceType];
    }

    const order = this.getComponentOrder(compNode);

    const compData = {
      id: componentId,
      ideviceId: componentId,
      ideviceType: ideviceType,
      type: ideviceType,
      order: order,
      createdAt: new Date().toISOString(),
      htmlView: '',
      properties: null,
      componentProps: {}
    };

    // Extract HTML view content
    const htmlViewNode = compNode.querySelector('htmlView');
    if (htmlViewNode) {
      let htmlContent = this.decodeHtmlContent(htmlViewNode.textContent || '') || '';

      // *** Convert {{context_path}} to asset:// URLs ***
      if (this.assetManager && this.assetMap.size > 0 && htmlContent) {
        try {
          const converted = this.assetManager.convertContextPathToAssetRefs(htmlContent, this.assetMap);
          htmlContent = (typeof converted === 'string') ? converted : htmlContent;
        } catch (convErr) {
          console.warn(`[ElpxImporter] Error converting asset paths for ${componentId}:`, convErr);
        }
      }

      compData.htmlView = (typeof htmlContent === 'string') ? htmlContent : '';
    }

    // Extract JSON properties
    const jsonPropsNode = compNode.querySelector('jsonProperties');
    if (jsonPropsNode) {
      try {
        let jsonStr = this.decodeHtmlContent(jsonPropsNode.textContent || '{}') || '{}';

        // Parse JSON first, then convert asset paths in the parsed object
        let props = {};
        try {
          props = JSON.parse(jsonStr);
        } catch (parseErr) {
          console.warn(`[ElpxImporter] Invalid JSON for ${componentId}, using empty object:`, parseErr.message);
          props = {};
        }

        // Convert {{context_path}} in parsed JSON values (not raw string)
        if (this.assetManager && this.assetMap.size > 0 && props && typeof props === 'object') {
          try {
            props = this.convertAssetPathsInObject(props);
          } catch (convErr) {
            console.warn(`[ElpxImporter] Error converting paths in JSON for ${componentId}:`, convErr);
          }
        }

        compData.properties = props;
      } catch (e) {
        console.warn(`[ElpxImporter] Failed to process JSON properties for ${componentId}:`, e);
      }
    }

    // Extract component properties (odeComponentProperty) - legacy format
    const componentProps = compNode.querySelectorAll('odeComponentProperty');
    for (const propNode of componentProps) {
      const key = propNode.getAttribute('key') || this.getTextContent(propNode, 'key');
      const value = propNode.getAttribute('value') || this.getTextContent(propNode, 'value') || propNode.textContent;
      if (key && value) {
        compData.componentProps[key] = value;
      }
    }

    // Extract component-level properties (odeComponentsProperties) - visibility, etc.
    // Start with defaults from getComponentsProperties()
    const structureProps = this.getComponentsProperties(compNode);

    // Merge properties from jsonProperties that override structure props
    // Some iDevices store teacherOnly, identifier, cssClass, visibility in jsonProperties
    if (compData.properties && typeof compData.properties === 'object') {
      const propsToMerge = ['visibility', 'teacherOnly', 'identifier', 'cssClass'];
      for (const key of propsToMerge) {
        if (compData.properties[key] !== undefined) {
          // Convert boolean to string for consistency ('true'/'false')
          const value = compData.properties[key];
          if (typeof value === 'boolean') {
            structureProps[key] = value ? 'true' : 'false';
          } else {
            structureProps[key] = String(value);
          }
        }
      }
    }

    compData.structureProps = structureProps;

    return compData;
  }

  /**
   * Create Y.Map from plain page data (called INSIDE transaction)
   * @param {Object} pageData - Plain JS object with page data
   * @param {Object} stats - Stats counter
   * @returns {Y.Map}
   */
  createPageYMap(pageData, stats) {
    Logger.log('[ElpxImporter] createPageYMap START:', pageData.pageName, pageData.id);

    // Helper to wrap Y operations with detailed error logging
    const safeYOp = (opName, fn) => {
      try {
        return fn();
      } catch (err) {
        console.error(`[ElpxImporter] Y operation failed: ${opName}`);
        console.error(`[ElpxImporter] Error:`, err);
        console.error(`[ElpxImporter] Stack:`, err.stack);
        console.error(`[ElpxImporter] Page context:`, pageData.pageName);
        throw err;
      }
    };

    try {
      const pageMap = safeYOp('new Y.Map()', () => new this.Y.Map());

      safeYOp('pageMap.set(id)', () => pageMap.set('id', pageData.id));
      safeYOp('pageMap.set(pageId)', () => pageMap.set('pageId', pageData.pageId));
      safeYOp('pageMap.set(pageName)', () => pageMap.set('pageName', pageData.pageName));
      safeYOp('pageMap.set(title)', () => pageMap.set('title', pageData.title));
      safeYOp('pageMap.set(parentId)', () => pageMap.set('parentId', pageData.parentId));
      safeYOp('pageMap.set(order)', () => pageMap.set('order', pageData.order));
      safeYOp('pageMap.set(createdAt)', () => pageMap.set('createdAt', pageData.createdAt));
      Logger.log('[ElpxImporter] Page basic props set');

      // Create properties Y.Map if page has properties
      if (pageData.properties && Object.keys(pageData.properties).length > 0) {
        const propsMap = safeYOp('new Y.Map() for properties', () => new this.Y.Map());
        for (const [key, value] of Object.entries(pageData.properties)) {
          if (value !== undefined && value !== null) {
            safeYOp(`propsMap.set(${key})`, () => propsMap.set(key, value));
          }
        }
        safeYOp('pageMap.set(properties)', () => pageMap.set('properties', propsMap));
        Logger.log('[ElpxImporter] Page properties set:', Object.keys(pageData.properties));
      }

      // Create blocks array
      const blocksArray = safeYOp('new Y.Array() for blocks', () => new this.Y.Array());
      Logger.log('[ElpxImporter] Creating blocks array, count:', pageData.blocks.length);
      for (let i = 0; i < pageData.blocks.length; i++) {
        const blockData = pageData.blocks[i];
        Logger.log(`[ElpxImporter] Creating block ${i + 1}/${pageData.blocks.length}:`, blockData.blockName);
        const blockMap = this.createBlockYMap(blockData, stats);
        if (blockMap) {
          Logger.log('[ElpxImporter] Pushing block to array...');
          safeYOp(`blocksArray.push(block ${i})`, () => blocksArray.push([blockMap]));
          Logger.log('[ElpxImporter] Block pushed successfully');
          stats.blocks++;
        }
      }
      Logger.log('[ElpxImporter] Setting blocks on pageMap...');
      safeYOp('pageMap.set(blocks)', () => pageMap.set('blocks', blocksArray));
      Logger.log('[ElpxImporter] Blocks set successfully');

      // NOTE: No children array - using flat structure with parentId references

      Logger.log('[ElpxImporter] createPageYMap END:', pageData.pageName);
      return pageMap;
    } catch (err) {
      console.error('[ElpxImporter] ERROR in createPageYMap:', pageData.pageName, err);
      throw err;
    }
  }

  /**
   * Create Y.Map from plain block data (called INSIDE transaction)
   * @param {Object} blockData - Plain JS object with block data
   * @param {Object} stats - Stats counter
   * @returns {Y.Map}
   */
  createBlockYMap(blockData, stats) {
    Logger.log('[ElpxImporter] createBlockYMap START:', blockData.blockName, blockData.id);

    // Helper to wrap Y operations with detailed error logging
    const safeYOp = (opName, fn) => {
      try {
        return fn();
      } catch (err) {
        console.error(`[ElpxImporter] Y operation failed: ${opName}`);
        console.error(`[ElpxImporter] Error:`, err);
        console.error(`[ElpxImporter] Stack:`, err.stack);
        console.error(`[ElpxImporter] Block context:`, blockData.blockName);
        throw err;
      }
    };

    try {
      const blockMap = safeYOp('new Y.Map() for block', () => new this.Y.Map());

      safeYOp('blockMap.set(id)', () => blockMap.set('id', blockData.id));
      safeYOp('blockMap.set(blockId)', () => blockMap.set('blockId', blockData.blockId));
      safeYOp('blockMap.set(blockName)', () => blockMap.set('blockName', blockData.blockName));
      safeYOp('blockMap.set(iconName)', () => blockMap.set('iconName', blockData.iconName || ''));
      safeYOp('blockMap.set(order)', () => blockMap.set('order', blockData.order));
      safeYOp('blockMap.set(createdAt)', () => blockMap.set('createdAt', blockData.createdAt));
      Logger.log('[ElpxImporter] Block basic props set (including iconName:', blockData.iconName, ')');

      // Create properties Y.Map if block has properties
      if (blockData.properties && Object.keys(blockData.properties).length > 0) {
        const propsMap = safeYOp('new Y.Map() for block properties', () => new this.Y.Map());
        for (const [key, value] of Object.entries(blockData.properties)) {
          if (value !== undefined && value !== null) {
            safeYOp(`propsMap.set(${key})`, () => propsMap.set(key, value));
          }
        }
        safeYOp('blockMap.set(properties)', () => blockMap.set('properties', propsMap));
        Logger.log('[ElpxImporter] Block properties set:', Object.keys(blockData.properties));
      }

      // Create components array
      const componentsArray = safeYOp('new Y.Array() for components', () => new this.Y.Array());
      Logger.log('[ElpxImporter] Creating components array, count:', blockData.components.length);
      for (let i = 0; i < blockData.components.length; i++) {
        const compData = blockData.components[i];
        Logger.log(`[ElpxImporter] Creating component ${i + 1}/${blockData.components.length}:`, compData.ideviceType);
        const compMap = this.createComponentYMap(compData);
        if (compMap) {
          Logger.log('[ElpxImporter] Pushing component to array...');
          safeYOp(`componentsArray.push(comp ${i})`, () => componentsArray.push([compMap]));
          Logger.log('[ElpxImporter] Component pushed successfully');
          stats.components++;
        }
      }
      Logger.log('[ElpxImporter] Setting components on blockMap...');
      safeYOp('blockMap.set(components)', () => blockMap.set('components', componentsArray));
      Logger.log('[ElpxImporter] Components set successfully');
      // NOTE: Removed 'idevices' alias because Yjs types can only have one parent

      Logger.log('[ElpxImporter] createBlockYMap END:', blockData.blockName);
      return blockMap;
    } catch (err) {
      console.error('[ElpxImporter] ERROR in createBlockYMap:', blockData.blockName, err);
      throw err;
    }
  }

  /**
   * Create Y.Map from plain component data (called INSIDE transaction)
   * @param {Object} compData - Plain JS object with component data
   * @returns {Y.Map}
   */
  createComponentYMap(compData) {
    Logger.log('[ElpxImporter] createComponentYMap START:', compData.id);

    let compMap;
    try {
      compMap = new this.Y.Map();
      Logger.log('[ElpxImporter] Y.Map created successfully');
    } catch (err) {
      console.error('[ElpxImporter] ERROR creating Y.Map:', err);
      throw err;
    }

    // Debug: Log each value being set with try-catch
    const safeSet = (map, key, value) => {
      const valueType = value === null ? 'null' : typeof value;
      const valuePreview = typeof value === 'string' ? value.substring(0, 50) : value;
      Logger.log(`[ElpxImporter] Setting ${key}: type=${valueType}, value=`, valuePreview);

      // Never set null or undefined - skip silently
      if (value === null || value === undefined) {
        console.warn(`[ElpxImporter] SKIPPING ${key} - value is ${value}`);
        return;
      }

      try {
        map.set(key, value);
        Logger.log(`[ElpxImporter] ${key} SET OK`);
      } catch (err) {
        console.error(`[ElpxImporter] ERROR setting ${key}:`, err);
        console.error(`[ElpxImporter] Value was:`, value);
        throw err;
      }
    };

    safeSet(compMap, 'id', compData.id);
    safeSet(compMap, 'ideviceId', compData.ideviceId);
    safeSet(compMap, 'ideviceType', compData.ideviceType);
    safeSet(compMap, 'type', compData.type);
    safeSet(compMap, 'order', compData.order);
    safeSet(compMap, 'createdAt', compData.createdAt);

    // Store htmlView as plain string - Y.Text will be created on-demand by TinyMCE binding
    if (compData.htmlView) {
      safeSet(compMap, 'htmlView', compData.htmlView);
    }

    // Store jsonProperties as plain string (skip nested Y.Map to avoid issues)
    if (compData.properties && typeof compData.properties === 'object') {
      Logger.log('[ElpxImporter] Converting properties to JSON string');
      try {
        const jsonStr = JSON.stringify(compData.properties);
        safeSet(compMap, 'jsonProperties', jsonStr);
      } catch (err) {
        console.error('[ElpxImporter] ERROR stringifying properties:', err);
      }
    }

    // Set component properties as flat values (legacy format)
    if (compData.componentProps) {
      Logger.log('[ElpxImporter] Setting component props:', Object.keys(compData.componentProps));
      Object.entries(compData.componentProps).forEach(([key, value]) => {
        if (value != null && typeof value !== 'object') {
          safeSet(compMap, `prop_${key}`, String(value));
        }
      });
    }

    // Create properties Y.Map if component has structure properties (visibility, etc.)
    if (compData.structureProps && Object.keys(compData.structureProps).length > 0) {
      const propsMap = new this.Y.Map();
      for (const [key, value] of Object.entries(compData.structureProps)) {
        if (value !== undefined && value !== null) {
          propsMap.set(key, value);
        }
      }
      safeSet(compMap, 'properties', propsMap);
      Logger.log('[ElpxImporter] Component structure properties set:', Object.keys(compData.structureProps));
    }

    Logger.log('[ElpxImporter] createComponentYMap END:', compData.id);
    return compMap;
  }

  /**
   * Find all odeNavStructure elements using multiple strategies
   * @param {Document} xmlDoc
   * @returns {Array}
   */
  findNavStructures(xmlDoc) {
    // Strategy 1: Direct query
    let structures = xmlDoc.querySelectorAll('odeNavStructure');
    if (structures.length > 0) return Array.from(structures);

    // Strategy 2: Inside odeNavStructures container
    const container = xmlDoc.querySelector('odeNavStructures');
    if (container) {
      structures = container.querySelectorAll('odeNavStructure');
      if (structures.length > 0) return Array.from(structures);

      // Try direct children
      const children = Array.from(container.children).filter(
        el => el.tagName === 'odeNavStructure'
      );
      if (children.length > 0) return children;
    }

    // Strategy 3: Namespace wildcard
    structures = xmlDoc.querySelectorAll('*|odeNavStructure');
    if (structures.length > 0) return Array.from(structures);

    console.warn('[ElpxImporter] No odeNavStructure elements found');
    return [];
  }

  /**
   * Get page ID from nav structure (handles both attribute and sub-element)
   * @param {Element} navNode
   * @returns {string|null}
   */
  getPageId(navNode) {
    // Try attribute first
    let id = navNode.getAttribute('odeNavStructureId');
    if (id) return this.sanitizeId(id);

    // Try as sub-element
    const idEl = navNode.querySelector('odePageId');
    if (idEl) return this.sanitizeId(idEl.textContent);

    return null;
  }

  /**
   * Get parent page ID from nav structure
   * @param {Element} navNode
   * @returns {string|null}
   */
  getParentPageId(navNode) {
    // Try attribute first
    let parentId = navNode.getAttribute('parentOdeNavStructureId');
    if (parentId) return this.sanitizeId(parentId);

    // Try as sub-element
    const parentEl = navNode.querySelector('odeParentPageId');
    if (parentEl) return this.sanitizeId(parentEl.textContent);

    return null;
  }

  /**
   * Get page name from nav structure (handles both attribute and sub-element)
   * @param {Element} navNode
   * @returns {string}
   */
  getPageName(navNode) {
    // Try attribute first (odePageName)
    let name = navNode.getAttribute('odePageName');
    if (name) return name;

    // Try pageName attribute
    name = navNode.getAttribute('pageName');
    if (name) return name;

    // Try as sub-element <pageName>
    const nameEl = navNode.querySelector('pageName');
    if (nameEl && nameEl.textContent) return nameEl.textContent;

    // Try as sub-element <odePageName>
    const odeNameEl = navNode.querySelector('odePageName');
    if (odeNameEl && odeNameEl.textContent) return odeNameEl.textContent;

    return 'Untitled Page';
  }

  /**
   * Get navigation order from nav structure
   * @param {Element} navNode
   * @returns {number}
   */
  getNavOrder(navNode) {
    // Try attribute
    let order = navNode.getAttribute('odeNavStructureOrder');
    if (order) return parseInt(order, 10) || 0;

    // Try sub-element
    const orderEl = navNode.querySelector('odeNavStructureOrder');
    if (orderEl) return parseInt(orderEl.textContent, 10) || 0;

    return 0;
  }

  /**
   * Extract page properties from odeNavStructureProperties
   * Properties include: hidePageTitle, editableInPage, titleNode, titlePage, etc.
   * Initializes with defaults and merges XML values.
   * @param {Element} navNode - The odeNavStructure element
   * @returns {Object} - Properties object with all default properties
   */
  getNavStructureProperties(navNode) {
    // Start with all defaults
    const properties = { ...ElpxImporter.PAGE_PROPERTY_DEFAULTS };

    const propsContainer = navNode.querySelector('odeNavStructureProperties');
    if (!propsContainer) return properties;  // Return defaults if no properties element

    const propNodes = propsContainer.querySelectorAll('odeNavStructureProperty');
    for (const propNode of propNodes) {
      const key = this.getTextContent(propNode, 'key');
      const value = this.getTextContent(propNode, 'value');
      if (key && value !== null) {
        // Convert boolean strings to actual booleans
        if (value === 'true' || value === 'false') {
          properties[key] = value === 'true';
        } else {
          properties[key] = value;
        }
      }
    }
    return properties;
  }

  /**
   * Extract block properties from odePagStructureProperties
   * Properties include: visibility, minimized, teacherOnly, cssClass, identifier, allowToggle, etc.
   * Initializes with defaults and merges XML values.
   * @param {Element} pagNode - The odePagStructure element
   * @returns {Object} - Properties object with all default properties
   */
  getPagStructureProperties(pagNode) {
    // Start with all defaults
    const properties = { ...ElpxImporter.BLOCK_PROPERTY_DEFAULTS };

    const propsContainer = pagNode.querySelector('odePagStructureProperties');
    if (!propsContainer) return properties;  // Return defaults if no properties element

    const propNodes = propsContainer.querySelectorAll('odePagStructureProperty');
    for (const propNode of propNodes) {
      const key = this.getTextContent(propNode, 'key');
      const value = this.getTextContent(propNode, 'value');
      if (key && value !== null) {
        // Convert boolean strings to actual booleans
        if (value === 'true' || value === 'false') {
          properties[key] = value === 'true';
        } else {
          properties[key] = value;
        }
      }
    }
    return properties;
  }

  /**
   * Extract component properties from odeComponentsProperties
   * Properties include: visibility, teacherOnly, identifier, cssClass, etc.
   * Initializes with defaults and merges XML values.
   * @param {Element} compNode - The odeComponent element
   * @returns {Object} - Properties object with all default properties
   */
  getComponentsProperties(compNode) {
    // Start with all defaults
    const properties = { ...ElpxImporter.COMPONENT_PROPERTY_DEFAULTS };

    const propsContainer = compNode.querySelector('odeComponentsProperties');
    if (!propsContainer) return properties;  // Return defaults if no properties element

    const propNodes = propsContainer.querySelectorAll('odeComponentsProperty');
    for (const propNode of propNodes) {
      const key = this.getTextContent(propNode, 'key');
      const value = this.getTextContent(propNode, 'value');
      if (key && value !== null) {
        // Convert boolean strings to actual booleans
        if (value === 'true' || value === 'false') {
          properties[key] = value === 'true';
        } else {
          properties[key] = value;
        }
      }
    }
    return properties;
  }

  /**
   * Find odePagStructure elements within a nav structure
   * @param {Element} navNode
   * @returns {NodeList|Array}
   */
  findPagStructures(navNode) {
    // Strategy 1: Direct children
    let structures = navNode.querySelectorAll(':scope > odePagStructure');
    if (structures.length > 0) return structures;

    // Strategy 2: Inside odePagStructures container
    const container = navNode.querySelector('odePagStructures');
    if (container) {
      structures = container.querySelectorAll(':scope > odePagStructure');
      if (structures.length > 0) return structures;

      structures = container.querySelectorAll('odePagStructure');
      if (structures.length > 0) return structures;
    }

    // Strategy 3: Any descendant
    structures = navNode.querySelectorAll('odePagStructure');
    return structures;
  }

  /**
   * Get block order from pag structure
   * @param {Element} pagNode
   * @returns {number}
   */
  getPagOrder(pagNode) {
    let order = pagNode.getAttribute('odePagStructureOrder');
    if (order) return parseInt(order, 10) || 0;

    const orderEl = pagNode.querySelector('odePagStructureOrder');
    if (orderEl) return parseInt(orderEl.textContent, 10) || 0;

    return 0;
  }

  /**
   * Find odeComponent elements within a pag structure
   * @param {Element} pagNode
   * @returns {NodeList|Array}
   */
  findOdeComponents(pagNode) {
    // Strategy 1: Direct children
    let components = pagNode.querySelectorAll(':scope > odeComponent');
    if (components.length > 0) return components;

    // Strategy 2: Inside odeComponents container
    const container = pagNode.querySelector('odeComponents');
    if (container) {
      components = container.querySelectorAll(':scope > odeComponent');
      if (components.length > 0) return components;

      components = container.querySelectorAll('odeComponent');
      if (components.length > 0) return components;
    }

    // Strategy 3: Any descendant
    components = pagNode.querySelectorAll('odeComponent');
    return components;
  }

  /**
   * Get component order
   * @param {Element} compNode
   * @returns {number}
   */
  getComponentOrder(compNode) {
    let order = compNode.getAttribute('odeComponentOrder');
    if (order) return parseInt(order, 10) || 0;

    order = compNode.getAttribute('odeComponentsOrder');
    if (order) return parseInt(order, 10) || 0;

    const orderEl = compNode.querySelector('odeComponentsOrder');
    if (orderEl) return parseInt(orderEl.textContent, 10) || 0;

    return 0;
  }

  /**
   * Import assets from ZIP file
   * Uses AssetManager if available, otherwise falls back to basic cache
   * @param {Object} zip - The extracted ZIP files object from fflate {path: Uint8Array}
   * @returns {Promise<number>} - Number of assets imported
   */
  async importAssets(zip) {
    if (!this.assetManager) {
      Logger.log('[ElpxImporter] No AssetManager, skipping asset import');
      return 0;
    }

    // Use AssetManager to extract assets
    this.assetMap = await this.assetManager.extractAssetsFromZip(zip);
    Logger.log(`[ElpxImporter] Imported ${this.assetMap.size} assets`);

    return this.assetMap.size;
  }

  /**
   * Get property value from odeProperties container
   * @param {Element} propsContainer
   * @param {string} key
   * @returns {string|null}
   */
  getPropertyValue(propsContainer, key) {
    // Try direct child element with the key name
    const directEl = propsContainer.querySelector(key);
    if (directEl) return directEl.textContent;

    // Try odeProperty elements
    const props = propsContainer.querySelectorAll('odeProperty');
    for (const prop of props) {
      const keyEl = prop.querySelector('key');
      const valueEl = prop.querySelector('value');
      if (keyEl && keyEl.textContent === key && valueEl) {
        return valueEl.textContent;
      }
    }

    return null;
  }

  /**
   * Parse boolean property value from odeProperties container
   * @param {Element} container - The odeProperties element
   * @param {string} key - Property key to look for
   * @param {boolean} defaultValue - Default value if not found
   * @returns {boolean}
   */
  parseBooleanProperty(container, key, defaultValue = false) {
    const value = this.getPropertyValue(container, key);
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    // Handle string 'true'/'false' and '1'/'0'
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
    }
    return Boolean(value);
  }

  /**
   * Decode HTML-encoded content
   * @param {string} text
   * @returns {string}
   */
  decodeHtmlContent(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Get text content from a child element
   * @param {Element} parent
   * @param {string} tagName
   * @returns {string|null}
   */
  getTextContent(parent, tagName) {
    const el = parent.querySelector(tagName);
    return el ? el.textContent : null;
  }

  /**
   * Generate a unique ID
   * @param {string} prefix
   * @returns {string}
   */
  generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Sanitize an ID string (trim whitespace, normalize)
   * @param {string} id - The ID to sanitize
   * @returns {string|null} - Sanitized ID or null if invalid
   */
  sanitizeId(id) {
    if (!id || typeof id !== 'string') return null;
    const sanitized = id.trim();
    return sanitized || null;
  }

  /**
   * Calculate the maximum order value among existing pages at a given parent level
   * @param {string|null} parentId - Parent page ID (null for root level)
   * @returns {number} - The next available order (max + 1)
   */
  getNextAvailableOrder(parentId = null) {
    const navigation = this.manager.getNavigation();
    let maxOrder = -1;

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      const pageParentId = pageMap.get('parentId');

      // Match pages at the same parent level
      // null/undefined parentId means root level
      const sameLevel = (parentId === null && !pageParentId) ||
                        (parentId === pageParentId);

      if (sameLevel) {
        const order = pageMap.get('order') ?? 0;
        if (order > maxOrder) {
          maxOrder = order;
        }
      }
    }

    return maxOrder + 1;
  }

  /**
   * Recursively convert {{context_path}} references to asset:// URLs in an object
   * This is used for JSON properties where we can't use regex on raw JSON strings
   * @param {any} obj - Object, array, or primitive to process
   * @returns {any} - Processed value with asset paths converted
   */
  convertAssetPathsInObject(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle strings - convert {{context_path}} references
    if (typeof obj === 'string') {
      if (obj.includes('{{context_path}}')) {
        // Use AssetManager's conversion method for strings
        return this.assetManager.convertContextPathToAssetRefs(obj, this.assetMap);
      }
      return obj;
    }

    // Handle arrays - process each element
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertAssetPathsInObject(item));
    }

    // Handle objects - process each value
    if (typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertAssetPathsInObject(value);
      }
      return result;
    }

    // Return primitives (numbers, booleans) unchanged
    return obj;
  }

  /**
   * Clear IndexedDB for this project (for debugging/testing)
   * @param {string} dbName - Database name to clear
   * @returns {Promise<void>}
   */
  async clearIndexedDB(dbName) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
      request.onblocked = () => {
        console.warn('[ElpxImporter] IndexedDB delete blocked, waiting...');
        // Still resolve after a timeout
        setTimeout(resolve, 1000);
      };
    });
  }

  /**
   * Import a legacy .elp file (pre-v3.0 eXeLearning, Python pickle format).
   *
   * This method handles .elp files with contentv3.xml containing XML in Python pickle format
   * (root element is 'instance' or 'dictionary'). Despite the previous name "ViaBackend",
   * this is entirely client-side using LegacyXmlParser.js.
   *
   * @param {File} file - The legacy .elp file to import
   * @param {Object} options - Import options
   * @param {boolean} [options.clearExisting=true] - Whether to clear existing content
   * @param {string|null} [options.parentId=null] - Parent page ID for nested import
   * @param {Function|null} [options.onProgress=null] - Progress callback
   * @param {Object|null} [options.preExtractedZip=null] - Pre-extracted ZIP data (for nested ELP handling)
   * @returns {Promise<Object>} Import statistics { pages, blocks, components, assets }
   */
  async importLegacyFormat(file, options = {}) {
    const { clearExisting = true, parentId = null, onProgress = null, preExtractedZip = null } = options;

    // Store progress callback if provided
    if (onProgress) {
      this.onProgress = onProgress;
    }

    Logger.log('[ElpxImporter] Parsing legacy file in client:', file.name);

    // Phase 1: Decompressing
    this._reportProgress('decompress', 0, typeof _ === 'function' ? _('Decompressing legacy file...') : 'Decompressing legacy file...');

    // 1. Load ZIP and extract contentv3.xml using fflate
    // If preExtractedZip is provided, use it directly (already extracted from nested ELP)
    let zip;
    if (preExtractedZip) {
      Logger.log('[ElpxImporter] Using pre-extracted ZIP data (nested ELP)');
      zip = preExtractedZip;
    } else {
      const fflateLib = window.fflate;
      if (!fflateLib) {
        throw new Error('fflate library not loaded');
      }

      const arrayBuffer = await file.arrayBuffer();
      const uint8Data = new Uint8Array(arrayBuffer);

      // Use sync decompression - async workers cause memory issues on mobile (Chrome Android)
      zip = fflateLib.unzipSync(uint8Data);

      // Check for nested ELP file (same logic as importFromFile)
      if (!zip['content.xml'] && !zip['contentv3.xml']) {
        const elpFiles = Object.keys(zip).filter(name =>
          !name.includes('/') &&
          (name.toLowerCase().endsWith('.elp') || name.toLowerCase().endsWith('.elpx'))
        );

        if (elpFiles.length === 1) {
          Logger.log(`[ElpxImporter] Found nested ELP file in legacy import: ${elpFiles[0]}, extracting...`);
          const nestedElpData = zip[elpFiles[0]];
          zip = fflateLib.unzipSync(nestedElpData);
        } else if (elpFiles.length > 1) {
          throw new Error('ZIP contains multiple ELP files. Please extract and open one at a time.');
        }
      }
    }

    let contentFile = zip['contentv3.xml'] || zip['content.xml'];
    if (!contentFile) {
      throw new Error('No content.xml or contentv3.xml found in legacy file');
    }

    const xmlContent = new TextDecoder().decode(contentFile);

    // 2. Parse using client-side LegacyXmlParser
    if (!window.LegacyXmlParser) {
      throw new Error('LegacyXmlParser not loaded. Include LegacyXmlParser.js first.');
    }

    const legacyParser = new window.LegacyXmlParser();
    const parsedData = legacyParser.parse(xmlContent);

    Logger.log('[ElpxImporter] Legacy parse complete:', {
      pages: parsedData.pages?.length || 0,
      title: parsedData.meta?.title,
    });

    // Decompression complete (10%)
    this._reportProgress('decompress', 10, typeof _ === 'function' ? _('File decompressed') : 'File decompressed');

    // Phase 2: Extracting assets (10-50%)
    this._reportProgress('assets', 10, typeof _ === 'function' ? _('Extracting assets...') : 'Extracting assets...');

    // 3. Import assets from ZIP (resources/ folder)
    const stats = { pages: 0, blocks: 0, components: 0, assets: 0 };

    if (this.assetManager) {
      this.assetMap = await this.assetManager.extractAssetsFromZip(zip);
      stats.assets = this.assetMap.size;
      Logger.log(`[ElpxImporter] Imported ${stats.assets} assets from legacy file`);
    }

    // Assets extracted (50%)
    this._reportProgress('assets', 50, typeof _ === 'function' ? _('Assets extracted') : 'Assets extracted');

    // Helper to escape regex special characters
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Helper to replace asset paths in strings
    // IMPORTANT: Only replaces LOCAL resource references, NOT filenames inside external URLs
    // This prevents corrupting external URLs like https://example.com/viewer.php?file=https://example.com/file.pdf
    const replaceAssetPaths = (str) => {
      if (str == null || typeof str !== 'string') return '';
      if (!this.assetMap || this.assetMap.size === 0) return str;

      for (const [originalPath, assetId] of this.assetMap.entries()) {
        const fileName = originalPath.split('/').pop();
        const escapedFileName = escapeRegex(fileName);

        // 1. Replace {{context_path}}/resources/filename (exact match)
        // Include filename in asset:// URL so extension can be detected for type attributes
        str = str.split(`{{context_path}}/resources/${fileName}`).join(`asset://${assetId}/${fileName}`);
        str = str.split(`{{context_path}}/${originalPath}`).join(`asset://${assetId}/${fileName}`);

        // 2. Replace resources/filename when preceded by attribute quote or start
        // This ensures we don't replace filenames inside http:// or https:// URLs
        // Pattern: ("|'|=|&quot;|&#39;)resources/filename -> $1asset://uuid
        // Note: Legacy contentv3.xml files often have HTML-entity encoded quotes
        const resourcesPattern = new RegExp(
          `(["'=]|&quot;|&#39;|&apos;)resources/${escapedFileName}`,
          'g'
        );
        str = str.replace(resourcesPattern, `$1asset://${assetId}/${fileName}`);

        // 2b. Replace /resources/filename (with leading slash) when preceded by attribute quote
        // This handles absolute-style resource paths like src="/resources/image.png"
        const absoluteResourcesPattern = new RegExp(
          `(["']|&quot;|&#39;|&apos;)/resources/${escapedFileName}`,
          'g'
        );
        str = str.replace(absoluteResourcesPattern, `$1asset://${assetId}/${fileName}`);

        // 3. Replace bare resources/filename paths (for raw path properties like image gallery)
        // These are object values (not HTML attributes), so they don't have preceding quotes
        // The string itself IS the path, e.g., "resources/image.jpg"
        if (str === `resources/${fileName}`) {
          str = `asset://${assetId}/${fileName}`;
        } else if (str.startsWith(`resources/${fileName}`)) {
          // Handle paths with additional characters after filename (shouldn't normally happen)
          str = str.replace(`resources/${fileName}`, `asset://${assetId}/${fileName}`);
        }

        // 4. Replace bare filename ONLY in src/href attributes (not inside other URLs)
        // Pattern: src="filename" or href="filename" (bare filename, not a path with /)
        if (fileName) {
          str = str.replace(
            new RegExp(`(src|href)=(["'])${escapedFileName}\\2`, 'g'),
            `$1=$2asset://${assetId}/${fileName}$2`
          );
        }

        // NOTE: We intentionally DO NOT replace:
        // - originalPath globally (str.split(originalPath).join(...)) - this corrupts external URLs
        // - Filenames inside query strings (e.g., ?file=filename.pdf)
        // - Filenames inside external URLs (https://example.com/.../filename.pdf)
      }
      return str;
    };

    // Helper that combines replaceAssetPaths with addMediaTypes
    // This ensures media elements have type attributes for proper playback
    const replaceAssetPathsWithMediaTypes = (str) => {
      if (str == null || typeof str !== 'string') return '';
      let result = replaceAssetPaths(str);
      // Add MIME types to audio/video elements while asset:// URLs still have filenames
      if (typeof window.addMediaTypes === 'function' && result) {
        result = window.addMediaTypes(result);
      }
      return result;
    };

    // Helper to transform asset paths in properties object (recursive)
    // This handles questionsData arrays where question/answer HTML may contain images
    const transformPropertiesAssets = (obj, transformFn) => {
      if (obj == null) return obj;
      if (typeof obj === 'string') {
        return transformFn(obj);
      }
      if (Array.isArray(obj)) {
        return obj.map(item => transformPropertiesAssets(item, transformFn));
      }
      if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = transformPropertiesAssets(value, transformFn);
        }
        return result;
      }
      return obj;
    };

    // 4. Import structure into Yjs
    const ydoc = this.manager.getDoc();
    const navigation = this.manager.getNavigation();
    const metadata = this.manager.getMetadata();
    const Y = this.Y;

    // Pages are already flat from LegacyXmlParser
    const flatPages = parsedData.pages || [];

    // Calculate order offset for imported pages (only when not clearing)
    let orderOffset = 0;
    if (!clearExisting) {
      orderOffset = this.getNextAvailableOrder(parentId);
      Logger.log('[ElpxImporter] Legacy import order offset:', orderOffset, 'at parent:', parentId);
    }

    // Remap IDs to avoid conflicts and preserve hierarchy
    const idRemap = new Map();
    let rootIndex = 0;

    // First pass: generate new IDs and build the map
    for (const page of flatPages) {
      const originalId = page.id;
      const newId = this.generateId('page');
      page.id = newId;
      if (originalId) {
        idRemap.set(originalId, newId);
        Logger.log(`[ElpxImporter] Legacy ID remap: ${originalId} -> ${newId}`);
      }
    }

    // Second pass: remap parent_id and calculate orders
    for (const page of flatPages) {
      // Remap parent_id using the ID map
      if (page.parent_id && idRemap.has(page.parent_id)) {
        page.parent_id = idRemap.get(page.parent_id);
      } else if (!page.parent_id) {
        // Root page - apply parentId from options and offset
        page.parent_id = parentId;
        page.position = orderOffset + rootIndex;
        rootIndex++;
      }
    }

    Logger.log('[ElpxImporter] Legacy import: remapped', idRemap.size, 'IDs, root pages:', rootIndex);

    // Third pass: update internal links in idevice content with new page IDs
    // LegacyXmlParser converted links to use old IDs (page-44), now update to new IDs
    const updateInternalLinksWithRemap = (html) => {
      if (!html || typeof html !== 'string' || !html.includes('exe-node:')) return html;
      // Replace exe-node:old-page-id with exe-node:new-page-id
      return html.replace(/exe-node:(page-\d+)/g, (match, oldPageId) => {
        const newPageId = idRemap.get(oldPageId);
        if (newPageId) {
          Logger.log(`[ElpxImporter] Updated internal link: exe-node:${oldPageId} -> exe-node:${newPageId}`);
          return `exe-node:${newPageId}`;
        }
        return match;
      });
    };

    // Recursively update links in object properties
    const updateLinksInObject = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          if (typeof obj[i] === 'string') {
            obj[i] = updateInternalLinksWithRemap(obj[i]);
          } else if (typeof obj[i] === 'object') {
            updateLinksInObject(obj[i]);
          }
        }
      } else {
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'string') {
            obj[key] = updateInternalLinksWithRemap(obj[key]);
          } else if (typeof obj[key] === 'object') {
            updateLinksInObject(obj[key]);
          }
        }
      }
    };

    // Update links in all pages' idevices
    for (const page of flatPages) {
      if (!page.blocks) continue;
      for (const block of page.blocks) {
        if (!block.idevices) continue;
        for (const idevice of block.idevices) {
          if (idevice.htmlView) {
            idevice.htmlView = updateInternalLinksWithRemap(idevice.htmlView);
          }
          if (idevice.feedbackHtml) {
            idevice.feedbackHtml = updateInternalLinksWithRemap(idevice.feedbackHtml);
          }
          if (idevice.properties) {
            updateLinksInObject(idevice.properties);
          }
        }
      }
    }

    // Create page Y.Map
    const createPageYMap = (pageData) => {
      const pageMap = new Y.Map();
      // ID was already remapped above
      const pageId = pageData.id;

      pageMap.set('id', pageId);
      pageMap.set('pageId', pageId);
      pageMap.set('pageName', pageData.title || 'Untitled');
      pageMap.set('title', pageData.title || 'Untitled');
      // parent_id was already remapped above
      pageMap.set('parentId', pageData.parent_id || null);
      // position was already calculated with offset above
      pageMap.set('order', pageData.position || 0);
      pageMap.set('createdAt', new Date().toISOString());

      const blocksArray = new Y.Array();
      if (pageData.blocks && Array.isArray(pageData.blocks)) {
        for (const blockData of pageData.blocks) {
          const blockMap = new Y.Map();
          // ALWAYS generate new ID for blocks
          const blockId = this.generateId('block');

          blockMap.set('id', blockId);
          blockMap.set('blockId', blockId);
          blockMap.set('blockName', blockData.name || '');
          blockMap.set('iconName', blockData.iconName || '');
          blockMap.set('order', blockData.position || 0);

          // Apply block properties from handler (e.g., NotaHandler sets visibility=false)
          if (blockData.blockProperties) {
            const propsMap = new Y.Map();
            for (const [key, value] of Object.entries(blockData.blockProperties)) {
              propsMap.set(key, value);
            }
            blockMap.set('properties', propsMap);
            Logger.log('[ElpxImporter] Block properties set:', blockData.blockProperties);
          }

          const componentsArray = new Y.Array();
          if (blockData.idevices && Array.isArray(blockData.idevices)) {
            for (const ideviceData of blockData.idevices) {
              const compMap = new Y.Map();
              // ALWAYS generate new ID for idevices
              const compId = this.generateId('idevice');
              const ideviceType = ideviceData.type || 'FreeTextIdevice';

              compMap.set('id', compId);
              compMap.set('ideviceId', compId);
              compMap.set('ideviceType', ideviceType);
              compMap.set('type', ideviceType);
              compMap.set('order', ideviceData.position || 0);

              let transformedHtml = '';
              if (ideviceData.htmlView) {
                transformedHtml = replaceAssetPathsWithMediaTypes(ideviceData.htmlView);
                compMap.set('htmlView', transformedHtml || '');
              }

              // Convert htmlView to jsonProperties for JSON-type iDevices (FreeTextIdevice/TextIdevice)
              // These iDevices expect content in jsonProperties.textTextarea format
              // Also include feedback content if present (from FreeTextHandler.extractProperties)
              if (ideviceType === 'FreeTextIdevice' || ideviceType.toLowerCase().includes('text')) {
                // Get feedback from handler properties (FreeTextHandler.extractProperties puts them in ideviceData.properties)
                // Fall back to ideviceData.feedbackButton/feedbackHtml for backwards compatibility
                const feedbackInput = ideviceData.properties?.textFeedbackInput || ideviceData.feedbackButton || '';
                const feedbackTextarea = ideviceData.properties?.textFeedbackTextarea || ideviceData.feedbackHtml || '';

                const jsonProps = {
                  textTextarea: transformedHtml || '',
                  textFeedbackInput: feedbackInput,
                  textFeedbackTextarea: feedbackTextarea ? replaceAssetPathsWithMediaTypes(feedbackTextarea) : ''
                };
                compMap.set('jsonProperties', JSON.stringify(jsonProps));
              } else {
                // For casestudy iDevice, use properties from handler (history, activities)
                // The casestudy editor expects { history: "...", activities: [...] }
                // CaseStudyHandler extracts all content into properties, htmlView is empty
                if (ideviceType === 'casestudy') {
                  const jsonProps = {
                    history: '',
                    activities: [],
                    // Task info fields (new in modern format, default to empty for legacy imports)
                    textInfoDurationInput: '',
                    textInfoDurationTextInput: '',
                    textInfoParticipantsInput: '',
                    textInfoParticipantsTextInput: '',
                    ...(ideviceData.properties || {}),
                  };
                  // Only override history if transformedHtml has content (for compatibility)
                  if (transformedHtml) {
                    jsonProps.history = transformedHtml;
                  }
                  const transformedProps = transformPropertiesAssets(jsonProps, replaceAssetPathsWithMediaTypes);
                  compMap.set('jsonProperties', JSON.stringify(transformedProps));
                } else if (ideviceData.properties && typeof ideviceData.properties === 'object' && Object.keys(ideviceData.properties).length > 0) {
                  // For other iDevices (form, etc.), use properties from LegacyXmlParser if available
                  const transformedProps = transformPropertiesAssets(ideviceData.properties, replaceAssetPathsWithMediaTypes);
                  compMap.set('jsonProperties', JSON.stringify(transformedProps));
                } else {
                  compMap.set('jsonProperties', '{}');
                }
              }

              // Set structure properties for rubric iDevices (cssClass is needed for rubricIdevice wrapper class)
              // The cssClass is set by LegacyXmlParser when detecting rubric content
              if (ideviceData.cssClass) {
                const propsMap = new Y.Map();
                propsMap.set('cssClass', ideviceData.cssClass);
                propsMap.set('visibility', 'true');
                propsMap.set('teacherOnly', 'false');
                propsMap.set('identifier', '');
                compMap.set('properties', propsMap);
              }

              componentsArray.push([compMap]);
              stats.components++;
            }
          }

          blockMap.set('components', componentsArray);
          blocksArray.push([blockMap]);
          stats.blocks++;
        }
      }
      pageMap.set('blocks', blocksArray);

      return pageMap;
    };

    // Phase 3: Importing structure (50-80%)
    this._reportProgress('structure', 50, typeof _ === 'function' ? _('Importing structure...') : 'Importing structure...');

    // Import all pages in a transaction
    ydoc.transact(() => {
      if (clearExisting) {
        while (navigation.length > 0) {
          navigation.delete(0);
        }

        // Set metadata
        if (parsedData.meta) {
          metadata.set('title', parsedData.meta.title || 'Legacy Project');
          metadata.set('author', parsedData.meta.author || '');
          metadata.set('description', parsedData.meta.description || '');
          // Set language if present in legacy file (stored as _lang in contentv3.xml)
          if (parsedData.meta.language) {
            metadata.set('language', parsedData.meta.language);
            Logger.log('[ElpxImporter] Legacy language set:', parsedData.meta.language);
          }
          // Set custom footer content if present in legacy file
          if (parsedData.meta.footer) {
            metadata.set('footer', parsedData.meta.footer);
          }
          // Set custom head content if present in legacy file
          if (parsedData.meta.extraHeadContent) {
            metadata.set('extraHeadContent', parsedData.meta.extraHeadContent);
          }
          // Set export options if present in legacy file
          // Use metadata keys WITHOUT pp_ prefix to match YjsPropertiesBinding.propertyKeyMap
          // (LegacyXmlParser returns pp_ prefixed keys, but metadata uses non-prefixed keys)
          if (parsedData.meta.exportSource !== undefined) {
            metadata.set('exportSource', parsedData.meta.exportSource);
          }
          if (parsedData.meta.pp_addPagination !== undefined) {
            metadata.set('addPagination', parsedData.meta.pp_addPagination);
          }
          if (parsedData.meta.pp_addSearchBox !== undefined) {
            metadata.set('addSearchBox', parsedData.meta.pp_addSearchBox);
          }
          if (parsedData.meta.pp_addExeLink !== undefined) {
            metadata.set('addExeLink', parsedData.meta.pp_addExeLink);
          }
          if (parsedData.meta.pp_addAccessibilityToolbar !== undefined) {
            metadata.set('addAccessibilityToolbar', parsedData.meta.pp_addAccessibilityToolbar);
          }
        }
      }

      for (const pageData of flatPages) {
        const pageMap = createPageYMap(pageData);
        navigation.push([pageMap]);
        stats.pages++;
      }
    });

    // Structure imported (80%)
    this._reportProgress('structure', 80, typeof _ === 'function' ? _('Structure imported') : 'Structure imported');

    // Phase 4: Precaching assets (80-100%)
    this._reportProgress('precache', 80, typeof _ === 'function' ? _('Precaching assets...') : 'Precaching assets...');

    // Preload assets
    if (this.assetManager && this.assetManager.preloadAllAssets) {
      await this.assetManager.preloadAllAssets();
    }

    // Import complete (100%)
    this._reportProgress('precache', 100, typeof _ === 'function' ? _('Import complete') : 'Import complete');

    Logger.log('[ElpxImporter] Legacy import complete:', stats);
    return stats;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElpxImporter;
} else {
  window.ElpxImporter = ElpxImporter;
}
