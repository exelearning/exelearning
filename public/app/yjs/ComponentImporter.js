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

// The `_()` translator is provided by the Locale, which is constructed at
// app.js:74 inside the workarea. This module advertises CommonJS use
// (`module.exports = ComponentImporter` at the bottom) and is loaded as a
// plain browser script, so it can be imported outside the workarea where `_`
// would be a ReferenceError (YjsProjectBridge.js:4120 does the same).
// Review #2474, point 8.
const _ = window._ || ((s) => s);

/**
 * Maximum size (compressed) accepted for a .idevice ZIP file imported through
 * importIdeviceIntoBlock. Rejecting oversized files before reading them into
 * memory protects the browser from memory exhaustion (see "decompression
 * bomb" / zip-bomb hardening). The pre-existing importComponent flow
 * (new-block import) deliberately keeps its unlimited historical behaviour
 * (review #2474, point 5).
 *
 * DEGRADED-MODE FALLBACK: the primary source of this value is the shared
 * COMPONENT_IMPORT_LIMITS tier in src/shared/import/importPolicy.ts, exposed
 * by the importers bundle as window.ExeImportPolicy (see resolveComponentLimits).
 * This constant only applies when that bundle is not loaded — keep in sync.
 */
const MAX_COMPONENT_FILE_BYTES = 50 * 1024 * 1024; // 50 MiB

/**
 * Maximum total size (uncompressed) accepted across all ZIP entries of a
 * .idevice file imported through importIdeviceIntoBlock. Enforced in three
 * layers:
 * 1. BEFORE any inflation, on the declared cumulative size read from the
 *    central directory (validateZipPreflight), reusing the shared
 *    import-policy machinery exposed by the bundled importer
 *    (window.ExeImportPolicy, see #2193).
 * 2. DURING extraction, on the declared uncompressed size of each entry, via
 *    the unzipSync filter (see createDeclaredSizeFilter). fflate allocates the
 *    output buffer at that declared size and never grows past it, so skipping
 *    entries whose cumulative total exceeds the limit bounds the memory used
 *    by unzipSync itself — a heavily-compressed ZIP is rejected before it can
 *    inflate, instead of after.
 * 3. AFTER decompression, on the actual byte lengths (validateUncompressedSize),
 *    as a backstop for archives that lie in their central directory (a forged
 *    small declared size only yields truncated, memory-bounded output).
 *
 * DEGRADED-MODE FALLBACK: the primary source of this value is the shared
 * COMPONENT_IMPORT_LIMITS tier in src/shared/import/importPolicy.ts, exposed
 * by the importers bundle as window.ExeImportPolicy (see resolveComponentLimits).
 * This constant only applies when that bundle is not loaded — keep in sync.
 */
const MAX_COMPONENT_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200 MiB

/**
 * Maximum number of ZIP entries accepted for a .idevice file imported through
 * importIdeviceIntoBlock. unzipSync runs synchronously on the UI thread, so a
 * ZIP with a very large number of tiny entries can freeze the editor even when
 * every entry is small (review #2474, point 6).
 *
 * Enforced in two layers:
 * 1. In validateZipPreflight(), when the shared policy bundle is loaded
 *    (assertInspectionWithinLimits checks the central-directory entry count
 *    before any inflation).
 * 2. In createDeclaredSizeFilter(), always — including the degraded mode where
 *    the policy bundle is not loaded. The filter counts entries before
 *    inflating each one, so the cut happens before the offending entry is
 *    decompressed.
 *
 * DEGRADED-MODE FALLBACK: same as MAX_COMPONENT_FILE_BYTES / MAX_COMPONENT_UNCOMPRESSED_BYTES.
 */
const MAX_COMPONENT_ENTRIES = 10000;

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
        return { success: false, error: _('Target page not found') };
      }

      // Load the ZIP without limits. This pre-existing flow (import into a NEW
      // block) deliberately keeps its historical, unlimited behaviour: the
      // component size limits are applied only to importIdeviceIntoBlock,
      // so no .block/.idevice file that imports today is rejected by this PR
      // (review #2474, point 5). Hardening this flow is a separate change.
      const { zip, error: zipError } = await this.readComponentZip(file, { withLimits: false });
      if (zipError) {
        return { success: false, error: zipError };
      }

      // Parse and validate content.xml (content, XML errors, component marker)
      const { xmlDoc, error: xmlError } = this.parseComponentXml(zip);
      if (xmlError) {
        return { success: false, error: xmlError };
      }

      // Import assets first (historical position of this flow: the
      // {{context_path}} conversion happens inline in parseComponentFromXml)
      if (this.assetManager) {
        this.assetMap = await this.assetManager.extractAssetsFromZip(zip);
        Logger.log(`[ComponentImporter] Imported ${this.assetMap.size} assets`);
      }

      // Parse block structure from XML
      const blockData = this.parseBlockFromXml(xmlDoc);
      if (!blockData) {
        return { success: false, error: _('No block structure found in component file') };
      }

      // Generate new IDs for the block and components
      const newBlockId = this.regenerateComponentIds(blockData, { withBlockId: true });

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
      return { success: false, error: error.message || _('Import failed') };
    }
  }

  /**
   * Import a single .idevice file into an existing block.
   *
   * Unlike importComponent (which creates a new block in a page), this appends
   * the parsed component(s) to the `components` Y.Array of an existing block.
   * Only .idevice files are accepted; .block files are rejected.
   *
   * Order of operations (review #2474): every check that can fail on user data
   * (file size, ZIP, XML, target page/block, parsed components) runs BEFORE any
   * asset is stored. Assets are then extracted BEFORE the component Y.Maps are
   * built, because {{context_path}} references must be converted to asset://
   * references (which needs the asset map) before the Y.Maps copy the strings.
   *
   * Known limitation: the page/block are re-resolved inside the transaction
   * (a collaborator may delete them while the assets are being stored). If that
   * happens the import fails with "Target block not found", but the assets
   * already stored stay in the project as unreferenced files. Storing them
   * after the insert is NOT an option: the inserted Y.Maps would keep the
   * unconverted {{context_path}} references and the images would not render.
   *
   * @param {File} file - The .idevice file to import
   * @param {string} pageId - Page ID that contains the target block
   * @param {string} blockId - Target block ID
   * @returns {Promise<{success: boolean, blockId?: string, componentIds?: string[], error?: string}>}
   */
  async importIdeviceIntoBlock(file, pageId, blockId) {
    Logger.log(`[ComponentImporter] Importing ${file.name} into block ${blockId}...`);

    try {
      // Only .idevice files are allowed in this flow
      if (!file.name.toLowerCase().endsWith('.idevice')) {
        return { success: false, error: _('The file is not an iDevice content (.idevice)') };
      }

      // Load the ZIP with the full limit guard (see readComponentZip)
      const { zip, error: zipError } = await this.readComponentZip(file, { withLimits: true });
      if (zipError) {
        return { success: false, error: zipError };
      }

      // Parse and validate content.xml (content, XML errors, component marker)
      const { xmlDoc, error: xmlError } = this.parseComponentXml(zip);
      if (xmlError) {
        return { success: false, error: xmlError };
      }

      // Resolve the target page and block BEFORE extracting or storing any
      // asset (review #2474): extractAssetsFromZip writes every file through
      // putAsset, so if either resolution fails here (for example a
      // collaborator deleted the box while the menu was open) the import fails
      // without storing anything. A deletion that happens later, during asset
      // extraction, is caught by the re-resolve inside the transaction.
      const targetPage = this.findPage(pageId);
      if (!targetPage) {
        return { success: false, error: _('Target page not found') };
      }

      const targetBlocksArray = targetPage.get('blocks');
      if (!targetBlocksArray || !this.findBlockInArray(targetBlocksArray, blockId)) {
        return { success: false, error: _('Target block not found') };
      }

      // Parse components from the XML (a .idevice carries a single component
      // wrapped in its own block, but we accept all components found).
      // {{context_path}} references are converted AFTER the assets are
      // extracted (see applyAssetReferencesToComponents), because the
      // conversion needs the original-path -> new-asset-id mapping built by
      // extractAssetsFromZip.
      const blockData = this.parseBlockFromXml(xmlDoc);
      if (!blockData || blockData.components.length === 0) {
        return { success: false, error: _('No iDevice found in component file') };
      }

      // Generate fresh IDs for the components
      this.regenerateComponentIds(blockData);

      // Store the assets and convert the {{context_path}} references in the
      // parsed components. This MUST run before createComponentYMap: the
      // Y.Maps copy the strings, so a conversion applied afterwards would
      // never reach the Y.Doc and the imported images would not render.
      if (this.assetManager) {
        this.assetMap = await this.assetManager.extractAssetsFromZip(zip);
        Logger.log(`[ComponentImporter] Imported ${this.assetMap.size} assets`);
        this.applyAssetReferencesToComponents(blockData.components);
      }

      // Build every component Y.Map BEFORE the transaction (review #2474):
      // a Yjs transaction does not roll back, so building them inside it
      // could leave a partial import when a later component fails to build.
      const compYMaps = blockData.components.map((compData) => this.createComponentYMap(compData));

      // Insert components into the target block
      const ydoc = this.manager.getDoc();
      let inserted = false;

      ydoc.transact(() => {
        // Re-resolve the page AND the block inside the transaction: a
        // collaborator may have removed either while the file was being read
        // or its assets were being stored (review #2474, point 2). Re-resolving the page — not just
        // the block — is what closes the race the block re-resolve alone left
        // open: a detached page's blocks array would still match.
        const page = this.findPage(pageId);
        if (!page) return;

        const blocksArray = page.get('blocks');
        if (!blocksArray) return;

        const blockMap = this.findBlockInArray(blocksArray, blockId);
        if (!blockMap) return;

        let componentsArray = blockMap.get('components');
        if (!componentsArray) {
          componentsArray = new this.Y.Array();
          blockMap.set('components', componentsArray);
        }

        // Append after the max existing order, not the array length (which
        // may differ from orders, e.g. [0, 2] after a deletion). Same rule as
        // moveComponent in YjsStructureBinding (review #2474).
        let maxOrder = -1;
        for (let i = 0; i < componentsArray.length; i++) {
          const existingOrder = componentsArray.get(i).get('order') ?? 0;
          if (existingOrder > maxOrder) maxOrder = existingOrder;
        }
        for (let i = 0; i < compYMaps.length; i++) {
          compYMaps[i].set('order', maxOrder + 1 + i);
        }

        componentsArray.push(compYMaps);
        inserted = true;
      }, ydoc.clientID);

      if (!inserted) {
        return { success: false, error: _('Target block not found') };
      }

      Logger.log(`[ComponentImporter] Imported ${blockData.components.length} iDevice(s) into block ${blockId}`);
      return {
        success: true,
        blockId: blockId,
        componentIds: blockData.components.map((c) => c.id),
      };
    } catch (error) {
      console.error('[ComponentImporter] Import into block failed:', error);
      return { success: false, error: error.message || _('Import failed') };
    }
  }

  /**
   * Read a component (.idevice/.block) file and unzip it.
   *
   * Shared by both import flows (review #2474 cleanup): the duplicated
   * fflate-load / read / unzip steps live here once. With `withLimits` the
   * four-layer ZIP-bomb guard runs too (compressed-size cap, central-directory
   * preflight, declared-size filter, inflated-size backstop) — currently only
   * importIdeviceIntoBlock passes it; importComponent keeps its historical,
   * unlimited behaviour (review #2474, point 5), so hardening that flow later
   * is a one-line change.
   *
   * @param {File} file - The .idevice or .block file to read
   * @param {{withLimits?: boolean}} [options] - Apply the component size limits
   * @returns {Promise<{zip?: Object, error?: string}>} Unzipped entries, or an error
   */
  async readComponentZip(file, { withLimits = false } = {}) {
    if (withLimits) {
      // Reject oversized files before reading them into memory
      const sizeError = this.validateCompressedSize(file);
      if (sizeError) {
        return { error: sizeError };
      }
    }

    const fflateLib = window.fflate;
    if (!fflateLib) {
      return { error: _('fflate library not loaded') };
    }

    // Load ZIP - convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Data = new Uint8Array(arrayBuffer);

    if (withLimits) {
      // Preflight: inspect the central directory (declared metadata only, no
      // inflation) and reject an over-limit archive before unzipping anything.
      const preflightError = this.validateZipPreflight(uint8Data);
      if (preflightError) {
        return { error: preflightError };
      }
    }

    if (withLimits) {
      // The filter runs BEFORE each entry is inflated and receives its
      // declared uncompressed size, so entries that would push the cumulative
      // total past the limit are skipped (never decompressed, never
      // allocated) instead of inflating first.
      let zip;
      let declaredSizeViolation = { error: null };
      try {
        zip = fflateLib.unzipSync(uint8Data, {
          filter: this.createDeclaredSizeFilter(declaredSizeViolation),
        });
      } catch (e) {
        return { error: _('Invalid ZIP file: %1').replace('%1', e.message) };
      }

      // A declared-size violation was detected while extracting: reject.
      if (declaredSizeViolation.error) {
        return { error: declaredSizeViolation.error };
      }

      // Backstop: verify the actual decompressed sizes (a forged central
      // directory can only produce truncated, memory-bounded output).
      const uncompressedSizeError = this.validateUncompressedSize(zip);
      if (uncompressedSizeError) {
        return { error: uncompressedSizeError };
      }

      return { zip };
    }

    // No limits (historical importComponent behaviour): plain decompression.
    try {
      return { zip: fflateLib.unzipSync(uint8Data) };
    } catch (e) {
      return { error: _('Invalid ZIP file: %1').replace('%1', e.message) };
    }
  }

  /**
   * Validate and parse a component ZIP's content.xml.
   *
   * Shared by both import flows (review #2474 cleanup): content.xml lookup,
   * XML parsing and the odeComponentsResources marker check live here once.
   *
   * Review #2474, point 1: the XML parse error message is NOT interpolated
   * into the returned string. `parseError.textContent` contains a fragment of
   * the offending XML source (Firefox emits a `<sourcetext>` line), and this
   * string becomes `error.message`, which blockNode.js:1541 hands to
   * `modals.alert.show({ body })`, and Modal.setBody does
   * `innerHTML = body` (modal.js:411). A `.idevice` with a deliberately
   * malformed `content.xml` around `<img src=x onerror=...>` would therefore
   * execute that attribute in the workarea origin. The technical detail stays
   * in the console; the user sees a generic message.
   *
   * @param {Object} zip - Result of readComponentZip (path -> Uint8Array)
   * @returns {{xmlDoc?: Document, error?: string}} Parsed XML document, or an error
   */
  parseComponentXml(zip) {
    const contentFile = zip['content.xml'];
    if (!contentFile) {
      return { error: _('No content.xml found in component file') };
    }
    const contentXml = new TextDecoder().decode(contentFile);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(contentXml, 'text/xml');

    // Check for parsing errors. The error text is logged for diagnostics
    // but never interpolated into the user-facing message (XSS sink,
    // review #2474, point 1).
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('[ComponentImporter] XML parsing error:', parseError.textContent);
      return { error: _('The component XML is not valid') };
    }

    // Verify this is a component export (has odeComponentsResources marker)
    if (!this.isComponentExport(xmlDoc)) {
      return { error: _('Invalid component file: missing odeComponentsResources marker') };
    }

    return { xmlDoc };
  }

  /**
   * Regenerate the fresh identifiers of a parsed block's components.
   *
   * Shared by both import flows (review #2474 cleanup). When jsonProperties
   * carries an embedded ideviceId (text/quiz iDevices store it for
   * self-reference), rewrite it to the fresh id so the Y.Map field and the
   * JSON payload stay in sync. See #1786.
   *
   * @param {Object} blockData - Parsed block data (mutated in place)
   * @param {{withBlockId?: boolean}} [options] - Also regenerate the block id
   * @returns {string|null} The new block id when withBlockId, null otherwise
   */
  regenerateComponentIds(blockData, { withBlockId = false } = {}) {
    let newBlockId = null;
    if (withBlockId) {
      newBlockId = this.generateId('block');
      blockData.id = newBlockId;
      blockData.blockId = newBlockId;
    }

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

    return newBlockId;
  }

  /**
   * Convert {{context_path}} references in already-parsed components using the
   * asset map built by extractAssetsFromZip.
   *
   * Called AFTER the assets are extracted, because the conversion needs the
   * original-path -> new-asset-id mapping. Parsing happens before extraction
   * (so a failed import stores no assets, review #2474), which is why the
   * inline conversion in parseComponentFromXml cannot apply on this flow.
   *
   * @param {Array<Object>} components - Parsed component data objects (mutated)
   */
  applyAssetReferencesToComponents(components) {
    if (!this.assetManager || this.assetMap.size === 0) return;
    for (const comp of components) {
      if (comp.htmlView) {
        comp.htmlView = this.assetManager.convertContextPathToAssetRefs(comp.htmlView, this.assetMap);
      }
      if (comp.properties) {
        comp.properties = this.convertAssetPathsInObject(comp.properties);
      }
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
      // Match either id field, like the other block lookups
      // (YjsStructureBinding.deleteBlock, clone/delete in blockNode.js): the
      // two fields can diverge, and comparing only the first truthy one
      // produced false "Target block not found" errors (review #2474,
      // point 7).
      if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
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
   * Resolve the component-scoped import limits (ADR-2473-01: a per-component
   * budget is not a per-project budget). The primary source is
   * COMPONENT_IMPORT_LIMITS, exported by the shared import policy
   * (src/shared/import/importPolicy.ts) and exposed by the bundled importer as
   * window.ExeImportPolicy — one source of truth shared with the ELPX tiers.
   * The local constants above are only a documented fallback for the degraded
   * mode where the policy bundle is not loaded; keep them in sync.
   *
   * @returns {{maxFileBytes: number, maxTotalBytes: number, maxEntryBytes: number, maxEntries: number}}
   */
  resolveComponentLimits() {
    const policy = window.ExeImportPolicy;
    const tier = policy && policy.COMPONENT_IMPORT_LIMITS;
    if (tier && typeof tier === 'object'
        && typeof tier.maxFileBytes === 'number'
        && typeof tier.maxTotalBytes === 'number'
        && typeof tier.maxEntryBytes === 'number'
        && Number.isInteger(tier.maxEntries)) {
      return tier;
    }
    return {
      maxFileBytes: MAX_COMPONENT_FILE_BYTES,
      maxTotalBytes: MAX_COMPONENT_UNCOMPRESSED_BYTES,
      maxEntryBytes: MAX_COMPONENT_UNCOMPRESSED_BYTES,
      maxEntries: MAX_COMPONENT_ENTRIES,
    };
  }

  /**
   * Validate the compressed size of a component file, returning an error
   * message when the file exceeds the tier's maxFileBytes, or null otherwise.
   *
   * Uses Math.ceil (review #2474, point 7): Math.round would report a
   * 52,500,000-byte file as "50 MB" (the exact maximum), which reads as a
   * contradiction. Math.ceil reports it as "51 MB", which is unambiguous.
   * The label says "MB" while the arithmetic is MiB; formatBytes from
   * window.ExeImportPolicy is the preferred fix if it ever needs to change.
   *
   * @param {File} file
   * @returns {string|null}
   */
  validateCompressedSize(file) {
    const { maxFileBytes } = this.resolveComponentLimits();
    if (typeof file.size === 'number' && file.size > maxFileBytes) {
      return _('Component file is too large (%1 MB). Maximum allowed is %2 MB.')
        .replace('%1', Math.ceil(file.size / (1024 * 1024)))
        .replace('%2', Math.ceil(maxFileBytes / (1024 * 1024)));
    }
    return null;
  }

  /**
   * Preflight a component ZIP by inspecting its central directory — declared
   * metadata only, no entry is inflated. Reuses the shared import-policy
   * machinery exposed by the bundled importer (window.ExeImportPolicy, see
   * #2193) so the limits logic lives in one place. The limits come from
   * resolveComponentLimits() — the shared COMPONENT_IMPORT_LIMITS tier: the
   * entry-count cap (10000, same as the project tiers, review #2474) is
   * enforced here because the extraction filter and the post-inflation
   * backstop only see the cumulative byte total; a separate per-entry cap
   * remains follow-up work (ADR-2473-01).
   *
   * Degrades gracefully when the shared policy bundle is not loaded: it
   * returns null and the extraction filter plus the backstop still enforce
   * the same cumulative cap. The entry-count cap is NOT enforced by this
   * degraded path — but createDeclaredSizeFilter() counts entries itself, so
   * the cap still applies in degraded mode (review #2474, point 6).
   *
   * Review #2474, point 3: the message is now chosen from
   * `ZipLimitError.details.kind`. Before, every `ZipLimitError` was mapped to
   * the size message, so a `.idevice` with 20,000 tiny entries — exactly the
   * DoS case point 6 was about — told the user the file was too large. The
   * kind-aware message matches what createDeclaredSizeFilter emits for the
   * same condition in degraded mode.
   *
   * @param {Uint8Array} uint8Data - Raw ZIP bytes
   * @returns {string|null} Error message when the preflight rejects, null otherwise
   */
  validateZipPreflight(uint8Data) {
    const policy = window.ExeImportPolicy;
    if (!policy
        || typeof policy.inspectZipArchive !== 'function'
        || typeof policy.assertInspectionWithinLimits !== 'function') {
      return null;
    }
    const limits = this.resolveComponentLimits();
    try {
      const inspection = policy.inspectZipArchive(uint8Data, 'Component file');
      policy.assertInspectionWithinLimits(inspection, limits, 'Component file');
    } catch (e) {
      if (e && (e.name === 'ZipLimitError' || (policy.ZipLimitError && e instanceof policy.ZipLimitError))) {
        return this.buildPreflightErrorMessage(e, limits);
      }
      // Inspection failed for another reason (e.g. malformed central
      // directory): fall through and let unzipSync report the specific error.
    }
    return null;
  }

  /**
   * Build the user-facing message for a ZipLimitError, honouring its
   * `details.kind` (review #2474, point 3). Shared by validateZipPreflight
   * and the backstop so all three sources of a limit error produce the same
   * wording for the same condition.
   *
   * @param {Error & { details?: { kind?: string } }} error - The caught ZipLimitError
   * @param {{ maxTotalBytes: number, maxEntries: number }} limits - Resolved tier
   * @returns {string}
   */
  buildPreflightErrorMessage(error, limits) {
    const kind = error?.details?.kind;
    if (kind === 'entry-count') {
      return _('Component file has too many entries (maximum allowed is %1).')
        .replace('%1', limits.maxEntries);
    }
    return _('Component file expands beyond the allowed size (%1 MB uncompressed).')
      .replace('%1', Math.ceil(limits.maxTotalBytes / (1024 * 1024)));
  }

  /**
   * Validate the total uncompressed size of a decompressed ZIP, returning an
   * error message when the cumulative bytes exceed the tier's maxTotalBytes,
   * or null otherwise. Backstop against decompression bombs whose central
   * directory under-reports entry sizes.
   *
   * @param {Object} zip - Result of fflate.unzipSync (path -> Uint8Array)
   * @returns {string|null}
   */
  validateUncompressedSize(zip) {
    const { maxTotalBytes } = this.resolveComponentLimits();
    let totalBytes = 0;
    for (const entry of Object.values(zip)) {
      if (entry && typeof entry.byteLength === 'number') {
        totalBytes += entry.byteLength;
        if (totalBytes > maxTotalBytes) {
          return _('Component file expands beyond the allowed size (%1 MB uncompressed).')
            .replace('%1', Math.ceil(maxTotalBytes / (1024 * 1024)));
        }
      }
    }
    return null;
  }

  /**
   * Create a filter for fflate's unzipSync that enforces the component tier's
   * cumulative byte cap AND its entry-count cap against the DECLARED metadata
   * of each ZIP entry, before that entry is inflated.
   *
   * This is the primary guard against decompression bombs: fflate only
   * decompresses (and only allocates the output buffer for) entries the filter
   * accepts, and its inflate never grows past the declared size, so a bomb is
   * rejected without ever inflating into memory.
   *
   * The entry-count check here is the ONLY one that runs in degraded mode
   * (when window.ExeImportPolicy is not loaded and validateZipPreflight()
   * returns null); it also runs when the shared tier is present, because the
   * bundle can change or disappear between the preflight and the extraction
   * (review #2474, point 6). unzipSync is synchronous on the UI thread, so a
   * ZIP with many tiny entries can freeze the editor even when each entry is
   * small.
   *
   * Order of checks (covered by a test): the byte-total check runs first, so
   * an entry that crosses both limits reports the size message (the more
   * actionable one for a decompression bomb), not the count message.
   *
   * On violation the filter records the error on the passed violation object
   * (which the caller checks after unzipSync) and skips the offending entry
   * and every subsequent one.
   *
   * @param {{error: string|null}} violation - Mutated to carry the error message
   * @returns {function(Object): boolean} unzipSync filter
   */
  createDeclaredSizeFilter(violation) {
    const { maxTotalBytes, maxEntries } = this.resolveComponentLimits();
    let totalBytes = 0;
    let entryCount = 0;
    return (info) => {
      if (violation.error) {
        return false;
      }
      entryCount += 1;
      const declaredBytes =
        info && typeof info.originalSize === 'number' && info.originalSize > 0
          ? info.originalSize
          : 0;
      totalBytes += declaredBytes;
      if (totalBytes > maxTotalBytes) {
        violation.error = _('Component file expands beyond the allowed size (%1 MB uncompressed).')
          .replace('%1', Math.ceil(maxTotalBytes / (1024 * 1024)));
        return false;
      }
      if (entryCount > maxEntries) {
        violation.error = _('Component file has too many entries (maximum allowed is %1).')
          .replace('%1', maxEntries);
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
