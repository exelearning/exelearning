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
   * LEGACY ICON TO THEME ICON MAPPING CONVENTION
   * Maps legacy iDevice icon names to modern theme icon names.
   * Legacy ELP files store icon names like "preknowledge", "reading", "casestudy"
   * which may differ from the actual theme icon filenames.
   *
   * If a legacy icon name is not in this map, it's used as-is (most icons match directly).
   */
  static LEGACY_ICON_MAP = {
    'preknowledge': 'think',      // Legacy "preknowledge" uses think.png
    'reading': 'book',            // Legacy "reading" uses book.png
    'casestudy': 'case',          // Legacy "casestudy" uses case.png
  };

  /**
   * FEEDBACK BUTTON TEXT TRANSLATIONS
   * Static translations for "Show Feedback" button text.
   * Used instead of UI locale to ensure project language is respected.
   */
  static FEEDBACK_TRANSLATIONS = {
    es: 'Mostrar retroalimentación',
    en: 'Show Feedback',
    ca: 'Mostra la retroalimentació',
    eu: 'Erakutsi feedbacka',
    gl: 'Mostrar retroalimentación',
    pt: 'Mostrar feedback',
    fr: 'Afficher le feedback',
    de: 'Feedback anzeigen',
    it: 'Mostra feedback',
    nl: 'Toon feedback',
    pl: 'Pokaż informację zwrotną',
    ru: 'Показать отзыв',
    zh: '显示反馈',
    ja: 'フィードバックを表示',
    ar: 'إظهار الملاحظات',
  };

  /**
   * Get localized "Show Feedback" text based on language code
   * @param {string} langCode - Language code (e.g., 'es', 'en')
   * @returns {string} Localized feedback button text
   */
  getLocalizedFeedbackText(langCode) {
    const lang = (langCode || '').split('-')[0].toLowerCase();
    return LegacyXmlParser.FEEDBACK_TRANSLATIONS[lang] ||
           LegacyXmlParser.FEEDBACK_TRANSLATIONS.es; // Default to Spanish for legacy files
  }

  /**
   * Preprocess legacy XML content before parsing
   * Fixes encoding issues from eXe 2.x exports
   *
   * Based on Symfony OdeXmlUtil.php lines 993-1035
   *
   * @param {string} xmlContent - Raw XML content
   * @returns {string} Preprocessed XML content
   */
  preprocessLegacyXml(xmlContent) {
    let xml = xmlContent;

    // 1. Remove indentations (5 spaces, tabs)
    // eXe 2.x adds extra indentation inside attributes that breaks DOMParser
    xml = xml.replace(/ {5}/g, '');
    xml = xml.replace(/\t/g, '');

    // 2. Unify newlines to Unix LF
    xml = xml.replace(/\r/g, '\n');
    xml = xml.replace(/\n\n/g, '\n');

    // 3. Convert newlines to &#10; entity (preserves inside attributes)
    xml = xml.replace(/\n/g, '&#10;');

    // 4. Restore newlines between tags (not inside attributes)
    xml = xml.replace(/>&#10;</g, '>\n<');

    // 5. Convert hex escape sequences (\xNN) to characters
    // Legacy files may contain Python-style hex escapes in content
    xml = xml.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    // 6. Convert \n to &#10; (literal backslash-n in content)
    xml = xml.replace(/\\n/g, '&#10;');

    return xml;
  }

  /**
   * Parse legacy XML content and return normalized structure
   * @param {string} xmlContent - The raw XML content from contentv3.xml
   * @returns {Object} Normalized structure with pages, meta, etc.
   */
  parse(xmlContent) {
    Logger.log('[LegacyXmlParser] Parsing legacy XML format');

    // Preprocess XML to fix encoding issues from eXe 2.x
    this.xmlContent = this.preprocessLegacyXml(xmlContent);

    // Parse XML
    const parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(this.xmlContent, 'text/xml');

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

    // Store project language for handlers to use
    this.projectLanguage = meta.language || '';

    // Build page hierarchy
    const pages = this.buildPageHierarchy(nodes);

    // Convert internal links (exe-node: path-based to ID-based)
    const fullPathMap = this.buildFullPathMap(pages);
    this.convertAllInternalLinks(pages, fullPathMap);

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
        if (valueEl.tagName === 'bool') {
          // Handle boolean elements: <bool value="1"/> or <bool value="0"/>
          const boolVal = valueEl.getAttribute('value');
          return boolVal === '1' || boolVal === 'True' || boolVal === 'true';
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
   *
   * Filters out "parentNode" references embedded in TextAreaField/iDevice elements.
   * In legacy XML, fields store their parent node as an inlined instance, not a reference.
   * These are NOT real pages and should be excluded.
   *
   * @returns {Element[]} Array of Node instance elements (real pages only)
   */
  findAllNodes() {
    const allNodes = Array.from(
      this.xmlDoc.querySelectorAll('instance[class="exe.engine.node.Node"]')
    );

    // Filter out parentNode references embedded in fields/idevices
    // Real page nodes are either:
    // 1. Direct children of _nodeIdDict value
    // 2. Inside a "children" list of another node
    return allNodes.filter(nodeEl => {
      // Check if this node is a "parentNode" inside a field
      // If the preceding sibling is <string role="key" value="parentNode"/>, skip it
      const prevSibling = nodeEl.previousElementSibling;
      if (prevSibling?.tagName === 'string' &&
          prevSibling.getAttribute('role') === 'key' &&
          prevSibling.getAttribute('value') === 'parentNode') {
        const ref = nodeEl.getAttribute('reference');
        Logger.log(`[LegacyXmlParser] Skipping parentNode reference=${ref} (not a real page)`);
        return false;
      }
      return true;
    });
  }

  /**
   * Extract metadata from root package
   * @returns {Object} Metadata object with title, author, description, footer, extraHeadContent, and export options
   */
  extractMetadata() {
    const meta = {
      title: 'Legacy Project',
      author: '',
      description: '',
      language: '', // Language code (e.g., 'es', 'en')
      footer: '',
      extraHeadContent: '',
      // Export options (defaults) - use pp_ prefix to match form property names
      exportSource: false,
      pp_addPagination: false,
      pp_addSearchBox: false,
      pp_addExeLink: true, // Default to true
      pp_addAccessibilityToolbar: false,
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

    // Extract language (stored as _lang in legacy format)
    const lang = this.findDictValue(dict, '_lang');
    if (lang) meta.language = lang;

    // Extract custom footer content (user-provided footer HTML)
    const footer = this.findDictValue(dict, 'footer');
    if (footer) meta.footer = footer;

    // Extract custom head content (user-provided head HTML/scripts)
    const extraHeadContent = this.findDictValue(dict, '_extraHeadContent');
    if (extraHeadContent) meta.extraHeadContent = extraHeadContent;

    // Extract export options (legacy uses _addPagination, _addSearchBox, exportSource, _addExeLink)
    // These map to pp_addPagination, pp_addSearchBox, exportSource, pp_addExeLink in modern format
    const addPagination = this.findDictValue(dict, '_addPagination');
    if (addPagination === true) meta.pp_addPagination = true;

    const addSearchBox = this.findDictValue(dict, '_addSearchBox');
    if (addSearchBox === true) meta.pp_addSearchBox = true;

    const exportSource = this.findDictValue(dict, 'exportSource');
    if (exportSource === true) meta.exportSource = true;

    // _addExeLink defaults to true, only set to false if explicitly false
    const addExeLink = this.findDictValue(dict, '_addExeLink');
    if (addExeLink === false) meta.pp_addExeLink = false;

    const addAccessibilityToolbar = this.findDictValue(dict, '_addAccessibilityToolbar');
    if (addAccessibilityToolbar === true) meta.pp_addAccessibilityToolbar = true;

    Logger.log(`[LegacyXmlParser] Metadata: title="${meta.title}"`);
    return meta;
  }

  /**
   * LEGACY V2.X ROOT NODE FLATTENING CONVENTION
   *
   * Checks if the structure has a single root node with children that should be flattened.
   * Legacy contentv3.xml files often have a single root node acting as a container,
   * with all meaningful content pages as children.
   *
   * See doc/conventions.md for full documentation.
   *
   * @param {Array} rootPages - Array of root-level pages
   * @returns {Object} { shouldFlatten: boolean, rootPage: Object|null }
   */
  shouldFlattenRootChildren(rootPages) {
    // Only flatten if there's exactly one root with children
    if (rootPages.length !== 1) {
      return { shouldFlatten: false, rootPage: null };
    }

    const rootPage = rootPages[0];
    const hasDirectChildren = rootPage.children && rootPage.children.length > 0;

    return { shouldFlatten: hasDirectChildren, rootPage };
  }

  /**
   * LEGACY V2.X ROOT NODE FLATTENING CONVENTION
   *
   * Promotes the direct children of the root node to top-level pages.
   * Deeper descendants keep their parent relationships but have their levels recalculated.
   *
   * Transformation:
   *   Legacy:                    After Flattening:
   *   Root                       Root (level 0, no parent)
   *    ├─ Child A                Child A (level 0, no parent) ← promoted
   *    │   └─ Grandchild A1      Grandchild A1 (level 1, parent: Child A) ← preserved
   *    ├─ Child B                Child B (level 0, no parent) ← promoted
   *    └─ Child C                Child C (level 0, no parent) ← promoted
   *
   * This behavior is INTENTIONAL and applies ONLY to legacy v2.x imports.
   * See doc/conventions.md for full documentation.
   *
   * @param {Object} rootPage - The single root page
   * @returns {Array} Array of pages with flattened root children
   */
  flattenRootChildren(rootPage) {
    const flatPages = [];

    // 1. Add root as first top-level page
    flatPages.push({
      id: rootPage.id,
      title: rootPage.title,
      parent_id: null,
      position: 0,
      blocks: rootPage.blocks,
    });

    // 2. Promote direct children to top-level (no parent)
    rootPage.children.forEach((child, index) => {
      flatPages.push({
        id: child.id,
        title: child.title,
        parent_id: null,  // Promoted to top-level
        position: flatPages.length,
        blocks: child.blocks,
      });

      // 3. Add grandchildren with their parent relationships preserved
      if (child.children && child.children.length > 0) {
        this.flattenPages(child.children, flatPages, child.id);
      }
    });

    Logger.log(`[LegacyXmlParser] Applied root node flattening convention for v2.x import`);
    return flatPages;
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

    // LEGACY V2.X ROOT NODE FLATTENING CONVENTION
    // If there's a single root with children, flatten the structure by promoting
    // the root's direct children to top-level pages.
    // This is INTENTIONAL behavior for legacy imports. See doc/conventions.md.
    const { shouldFlatten, rootPage } = this.shouldFlattenRootChildren(rootPages);
    let flatPages;
    if (shouldFlatten && rootPage) {
      flatPages = this.flattenRootChildren(rootPage);
    } else {
      // 3. Flatten into array with correct structure (no flattening needed)
      flatPages = [];
      this.flattenPages(rootPages, flatPages, null);
    }

    // 4. Detect and apply node reordering for malformed contentv3.xml files
    // Some legacy files have nodes in wrong positions (referenced by <reference key="N"/>
    // instead of inline instances). See Symfony OdeXmlUtil.php lines 1101-1210.
    const nodesChangeRef = this.detectNodeReorderMap();
    if (nodesChangeRef.size > 0) {
      flatPages = this.applyNodeReordering(flatPages, nodesChangeRef);
    }

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
   * Detect and reorder nodes that are incorrectly positioned in the XML
   *
   * Some malformed contentv3.xml files have nodes whose content appears
   * outside their correct position in the children list (referenced by
   * <reference key="N"/> instead of being inline instances).
   *
   * Based on Symfony OdeXmlUtil.php lines 1101-1129
   *
   * @returns {Map} Map of oldRef -> afterRef (position after which to insert)
   */
  detectNodeReorderMap() {
    const nodesChangeRef = new Map(); // oldRef -> afterRef

    // Find all Node instances
    const allNodes = this.xmlDoc.querySelectorAll('instance[class="exe.engine.node.Node"]');

    for (const node of allNodes) {
      const nodeRef = node.getAttribute('reference');
      if (!nodeRef) continue;

      // Find children list for this node
      const dict = node.querySelector(':scope > dictionary');
      if (!dict) continue;

      const childrenList = this.findDictList(dict, 'children');
      if (!childrenList) continue;

      let prevRef = parseInt(nodeRef, 10);

      // Check each child in the list
      for (const child of childrenList.children) {
        if (child.tagName === 'instance') {
          // Normal inline instance - update prevRef
          const instRef = child.getAttribute('reference');
          if (instRef) {
            prevRef = parseInt(instRef, 10);
          }
        } else if (child.tagName === 'reference') {
          // Reference to node defined elsewhere - needs reordering
          const refKey = parseInt(child.getAttribute('key'), 10);
          nodesChangeRef.set(refKey, prevRef);
          prevRef = refKey;
        }
      }
    }

    if (nodesChangeRef.size > 0) {
      Logger.log(`[LegacyXmlParser] Detected ${nodesChangeRef.size} nodes needing reordering`);
    }

    return nodesChangeRef;
  }

  /**
   * Apply node reordering based on the detected reference map
   *
   * @param {Array} pages - Array of page objects
   * @param {Map} nodesChangeRef - Map of oldRef -> afterRef
   * @returns {Array} Reordered pages array
   */
  applyNodeReordering(pages, nodesChangeRef) {
    if (nodesChangeRef.size === 0) return pages;

    // Create a map of page ref -> page object
    const pageRefMap = new Map();
    for (const page of pages) {
      // Extract ref from page id (page-{ref})
      const ref = page.id.replace('page-', '');
      pageRefMap.set(parseInt(ref, 10), page);
    }

    // Adjust positions based on reordering map
    for (const [oldRef, afterRef] of nodesChangeRef) {
      const pageToMove = pageRefMap.get(oldRef);
      const referencePoint = pageRefMap.get(afterRef);

      if (pageToMove && referencePoint) {
        // Set position to be right after the reference point
        pageToMove.position = referencePoint.position + 0.5;
      }
    }

    // Re-sort pages by position
    pages.sort((a, b) => a.position - b.position);

    // Renumber positions
    pages.forEach((page, index) => {
      page.position = index;
    });

    Logger.log(`[LegacyXmlParser] Reordered ${nodesChangeRef.size} nodes`);
    return pages;
  }

  /**
   * Build a map of full page paths to page IDs
   *
   * Example: "Root:Chapter1:Page1" -> "page-abc123"
   *
   * Based on Symfony OdeXmlUtil.php changeOldExeNodeLink()
   *
   * @param {Array} pages - Array of page objects
   * @returns {Map} Map of full path -> page ID
   */
  buildFullPathMap(pages) {
    const fullPathMap = new Map();
    const pageIdMap = new Map(); // pageId -> { id, name, parent_id }

    // First pass: build page info map
    for (const page of pages) {
      pageIdMap.set(page.id, {
        id: page.id,
        name: page.title,
        parent_id: page.parent_id
      });
    }

    // Second pass: build full paths
    for (const page of pages) {
      const pathParts = [page.title];
      let currentParentId = page.parent_id;

      // Walk up the parent chain
      while (currentParentId && pageIdMap.has(currentParentId)) {
        const parent = pageIdMap.get(currentParentId);
        pathParts.unshift(parent.name);
        currentParentId = parent.parent_id;
      }

      const fullPath = pathParts.join(':');
      fullPathMap.set(fullPath, page.id);

      // Also add URL-decoded version if different
      try {
        const decodedPath = decodeURIComponent(fullPath);
        if (decodedPath !== fullPath) {
          fullPathMap.set(decodedPath, page.id);
        }
      } catch (e) {
        // Ignore decoding errors
      }
    }

    if (fullPathMap.size > 0) {
      Logger.log(`[LegacyXmlParser] Built path map with ${fullPathMap.size} entries`);
    }

    return fullPathMap;
  }

  /**
   * Convert exe-node: links in HTML content from path-based to ID-based
   *
   * Converts: exe-node:Root:Chapter1:Page1 -> exe-node:page-abc123
   *
   * Based on Symfony OdeComponentsSync.php replaceOldInternalLinks()
   *
   * @param {string} html - HTML content with exe-node: links
   * @param {Map} fullPathMap - Map of full path -> page ID
   * @returns {string} HTML with converted links
   */
  convertInternalLinks(html, fullPathMap) {
    if (!html || !html.includes('exe-node:')) return html;

    const EXE_NODE_PREFIX = 'exe-node:';

    // Find all href attributes with exe-node: links
    return html.replace(
      /href=["'](exe-node:[^"'#]+)(#[^"']*)?["']/gi,
      (match, linkPart, hashPart = '') => {
        const originalLink = linkPart;

        // Remove hash and decode
        let cleanedLink = linkPart;
        try {
          cleanedLink = decodeURIComponent(cleanedLink);
        } catch (e) {
          // Ignore decoding errors
        }

        // Extract path (remove exe-node: prefix)
        let pathOnly = cleanedLink.replace(EXE_NODE_PREFIX, '');

        // Handle case where path starts with project name (first segment)
        const segments = pathOnly.split(':');
        if (segments.length > 1) {
          // Try without first segment (project/root name)
          const pathWithoutRoot = segments.slice(1).join(':');
          if (fullPathMap.has(pathWithoutRoot)) {
            pathOnly = pathWithoutRoot;
          }
        }

        // Look up the page ID
        if (fullPathMap.has(pathOnly)) {
          const pageId = fullPathMap.get(pathOnly);
          const newLink = `${EXE_NODE_PREFIX}${pageId}`;
          Logger.log(`[LegacyXmlParser] Converted link: ${originalLink} -> ${newLink}`);
          // Strip #auto_top suffix (legacy auto-scroll anchor)
          let finalHash = hashPart || '';
          if (finalHash === '#auto_top') {
            finalHash = '';
          }
          return `href="${newLink}${finalHash}"`;
        }

        // No match found - keep original
        Logger.log(`[LegacyXmlParser] Link not found in path map: ${pathOnly}`);
        return match;
      }
    );
  }

  /**
   * Recursively convert internal links in object properties
   *
   * @param {Object|Array} obj - Object or array to process
   * @param {Map} fullPathMap - Map of full path -> page ID
   */
  convertLinksInObject(obj, fullPathMap) {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'string' && obj[i].includes('exe-node:')) {
          obj[i] = this.convertInternalLinks(obj[i], fullPathMap);
        } else if (typeof obj[i] === 'object') {
          this.convertLinksInObject(obj[i], fullPathMap);
        }
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string' && obj[key].includes('exe-node:')) {
          obj[key] = this.convertInternalLinks(obj[key], fullPathMap);
        } else if (typeof obj[key] === 'object') {
          this.convertLinksInObject(obj[key], fullPathMap);
        }
      }
    }
  }

  /**
   * Convert all internal links in all iDevices
   *
   * @param {Array} pages - Array of page objects
   * @param {Map} fullPathMap - Map of full path -> page ID
   * @returns {Array} Pages with converted links
   */
  convertAllInternalLinks(pages, fullPathMap) {
    if (fullPathMap.size === 0) return pages;

    let convertedCount = 0;

    for (const page of pages) {
      if (!page.blocks) continue;

      for (const block of page.blocks) {
        if (!block.idevices) continue;

        for (const idevice of block.idevices) {
          // Convert links in htmlView
          if (idevice.htmlView && idevice.htmlView.includes('exe-node:')) {
            const converted = this.convertInternalLinks(idevice.htmlView, fullPathMap);
            if (converted !== idevice.htmlView) {
              idevice.htmlView = converted;
              convertedCount++;
            }
          }

          // Convert links in feedbackHtml
          if (idevice.feedbackHtml && idevice.feedbackHtml.includes('exe-node:')) {
            idevice.feedbackHtml = this.convertInternalLinks(idevice.feedbackHtml, fullPathMap);
          }

          // Convert links in properties (recursively traverse object)
          if (idevice.properties) {
            this.convertLinksInObject(idevice.properties, fullPathMap);
          }
        }
      }
    }

    if (convertedCount > 0) {
      Logger.log(`[LegacyXmlParser] Converted ${convertedCount} internal links`);
    }

    return pages;
  }

  /**
   * LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
   *
   * Extracts the title from a legacy iDevice instance element.
   * Legacy iDevices store their title in the dictionary under '_title' or 'title'.
   *
   * See doc/conventions.md for full documentation.
   *
   * @param {Element} inst - The iDevice instance element
   * @returns {string} The iDevice title or empty string if not found
   */
  extractIdeviceTitle(inst) {
    const dict = inst.querySelector(':scope > dictionary');
    if (!dict) return '';

    // Look for _title or title in the dictionary
    const title = this.findDictValue(dict, '_title') || this.findDictValue(dict, 'title');
    return title && title.trim() ? title : '';
  }

  /**
   * LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
   *
   * Extracts blocks and iDevices from a Node.
   * Each iDevice is placed in its own block with its title as the block name.
   * This ensures that iDevice titles are preserved when imported,
   * preventing loss of individual iDevice titles.
   *
   * This behavior applies ONLY to legacy .elp imports (contentv3.xml).
   * See doc/conventions.md for full documentation.
   *
   * @param {Element} nodeEl - The Node instance element
   * @returns {Array} Array of blocks, each containing exactly one iDevice
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
          // LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
          // Create one block per iDevice to preserve individual titles.
          // This prevents loss of iDevice titles that would occur if all were in one block.
          const idevices = this.extractIDevicesWithTitles(listEl);

          idevices.forEach((idevice, idx) => {
            // Filter out default "Free Text" title - should show empty block name instead
            const title = idevice.title || '';
            const blockName = title === 'Free Text' ? '' : title;
            const block = {
              id: `block-${nodeEl.getAttribute('reference')}-${idx}`,
              name: blockName,  // Use iDevice title as block name, filtering defaults
              iconName: idevice.icon || '',  // Use iDevice icon as block icon
              position: idx,
              idevices: [idevice],  // Exactly one iDevice per block
            };
            // Pass block properties from handler (e.g., NotaHandler sets visibility=false)
            if (idevice.blockProperties) {
              block.blockProperties = idevice.blockProperties;
            }
            blocks.push(block);
          });
        }
        break;
      }
    }

    return blocks;
  }

  /**
   * LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
   *
   * Maps legacy iDevice class names to modern iDevice type names.
   * This is critical for ensuring that imported legacy iDevices are EDITABLE
   * in the modern editor.
   *
   * HISTORICAL CONTEXT:
   * In eXeLearning 2.x, many iDevices were implemented as specialized variants
   * of a Text iDevice, distinguished mainly by an icon and semantic label.
   * Without conversion, they would render but be READ-ONLY in modern eXeLearning.
   *
   * CONVERSION STRATEGY:
   * All text-based legacy iDevices are converted to the modern 'text' iDevice.
   * This preserves content and enables editing in the modern editor.
   *
   * See doc/conventions.md section "Legacy .elp (v2.x) Import – Editable iDevice Conversion"
   *
   * @param {string} className - The legacy iDevice class name
   * @returns {string} The modern iDevice type name
   */
  mapIdeviceType(className) {
    // LEGACY TEXT-BASED IDEVICES → Convert to 'text' for editability
    // These iDevices were essentially text containers with different icons/styling.
    // Converting to 'text' preserves content AND enables editing in modern editor.
    const textBasedIdevices = [
      // Core text iDevices
      'FreeTextIdevice',
      'FreeTextfpdIdevice',
      'GenericIdevice',
      'TextIdevice',             // Generic text
      // Activity/Task iDevices (text-based with different styling)
      'ActivityIdevice',         // Activity instructions
      'TaskIdevice',             // Task iDevice
      // Learning objectives and prerequisites
      'ObjectivesIdevice',       // Learning objectives
      'PreknowledgeIdevice',     // Prior knowledge / prerequisites
      // Reading and reflection
      'ReadingActivityIdevice',  // Reading activity
      'ReflectionIdevice',
      'ReflectionfpdIdevice',
      'ReflectionfpdmodifIdevice',
      // Spanish FPD variants (Formación Profesional a Distancia)
      'TareasIdevice',           // Tasks
      'ListaApartadosIdevice',   // List sections
      'ComillasIdevice',         // Quotes
      'NotaInformacionIdevice',  // Note/Information
      'NotaIdevice',             // Note
      'CasopracticofpdIdevice',  // Case study FPD
      'CitasparapensarfpdIdevice', // Quotes to think
      'DebesconocerfpdIdevice',  // Must know
      'DestacadofpdIdevice',     // Highlighted
      'OrientacionestutoriafpdIdevice',   // Teacher guidelines
      'OrientacionesalumnadofpdIdevice',  // Student guidelines
      'ParasabermasfpdIdevice',  // To learn more / Step ahead
      'RecomendacionfpdIdevice', // Recommendation
      'EjercicioresueltofpdIdevice', // Solved exercises
      // External content iDevices (no modern equivalent, fallback to text)
      'WikipediaIdevice',
      'RssIdevice',
      'AppletIdevice', // Java applets - no modern support
      // File attachment iDevices → text (as per Symfony OdeOldXmlFileAttachIdevice.php)
      // The attached-files iDevice type has no editor, so we convert to editable 'text'
      'FileAttachIdevice',    // Matches FileAttachIdevice and FileAttachIdeviceInc
      'AttachmentIdevice',
    ];

    // Check if this is a text-based iDevice that should convert to 'text'
    for (const textType of textBasedIdevices) {
      if (className.includes(textType)) {
        Logger.log(`[LegacyXmlParser] Converting ${textType} to 'text' for editability`);
        return 'text';
      }
    }

    // INTERACTIVE IDEVICES → Map to modern equivalents
    // These iDevices have structured content that requires specific handling.
    const interactiveTypeMap = {
      // True/False quiz
      'TrueFalseIdevice': 'trueorfalse',
      'VerdaderofalsofpdIdevice': 'trueorfalse',
      // Multiple choice / Multiple select → form (as per legacy Symfony/NestJS)
      // Note: 'quick-questions-*' are separate modern iDevice types, not legacy equivalents
      'MultichoiceIdevice': 'form',
      'EleccionmultiplefpdIdevice': 'form',
      'MultiSelectIdevice': 'form',
      'SeleccionmultiplefpdIdevice': 'form',
      // Fill in the blanks / Cloze
      'ClozeIdevice': 'complete',
      'ClozefpdIdevice': 'complete',
      'ClozelangfpdIdevice': 'complete',
      // Image magnifier
      'ImageMagnifierIdevice': 'magnifier',
      // Image gallery
      'GalleryIdevice': 'image-gallery',
      // Case study
      'CasestudyIdevice': 'casestudy',
      // Note: FileAttachIdevice moved to textBasedIdevices (converts to 'text' for editability)
      // External URL / website
      'ExternalUrlIdevice': 'external-website',
      // SCORM quiz/test
      'QuizTestIdevice': 'quick-questions',
    };

    // Check for interactive iDevice mappings
    for (const [legacyType, modernType] of Object.entries(interactiveTypeMap)) {
      if (className.includes(legacyType)) {
        Logger.log(`[LegacyXmlParser] Mapping ${legacyType} to '${modernType}'`);
        return modernType;
      }
    }

    // FALLBACK: Unknown iDevice types → Convert to 'text' for editability
    // This ensures that ANY unrecognized legacy iDevice becomes editable
    // rather than being rendered as a read-only, disabled component.
    const match = className.match(/(\w+)Idevice/);
    const extractedType = match ? match[1].toLowerCase() : 'unknown';
    Logger.log(`[LegacyXmlParser] Unknown iDevice '${extractedType}' → converting to 'text' for editability`);
    return 'text';
  }

  /**
   * LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
   *
   * Extract iDevices from a list element, including their titles.
   * Each iDevice's title is extracted and included in the result,
   * which is used to set the block name.
   *
   * See doc/conventions.md for full documentation.
   *
   * @param {Element} listEl - The list element containing iDevice instances
   * @returns {Array} Array of iDevice objects with titles
   */
  extractIDevicesWithTitles(listEl) {
    const idevices = [];

    // Find all direct child elements (instance or reference) in the idevices list
    // Legacy ELP files may have iDevices as:
    // 1. Inline <instance> elements (direct)
    // 2. <reference key="N"/> elements pointing to iDevices defined elsewhere (indirect)
    const directChildren = Array.from(listEl.children);
    const instancesToProcess = [];

    for (const child of directChildren) {
      if (child.tagName === 'instance') {
        // Direct instance - use as-is
        instancesToProcess.push(child);
      } else if (child.tagName === 'reference') {
        // Indirect reference - find the actual iDevice instance globally
        const refKey = child.getAttribute('key');
        if (refKey) {
          // Search globally for the instance with this reference
          const referencedInstance = this.xmlDoc.querySelector(
            `instance[reference="${refKey}"]`
          );
          if (referencedInstance) {
            Logger.log(`[LegacyXmlParser] Resolved reference key=${refKey} to instance`);
            instancesToProcess.push(referencedInstance);
          } else {
            Logger.log(`[LegacyXmlParser] WARNING: Could not find instance for reference key=${refKey}`);
          }
        }
      }
    }

    Logger.log(`[LegacyXmlParser] Found ${instancesToProcess.length} iDevice elements (${directChildren.filter(c => c.tagName === 'instance').length} direct, ${directChildren.filter(c => c.tagName === 'reference').length} references)`);

    for (const inst of instancesToProcess) {
      const className = inst.getAttribute('class') || '';

      // Check if this is an iDevice (class contains "idevice" case-insensitive)
      if (!className.toLowerCase().includes('idevice')) {
        Logger.log(`[LegacyXmlParser] SKIPPING instance - no 'idevice' in class: ${className}`);
        continue;
      }

      const ref = inst.getAttribute('reference') || `idev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      const dict = inst.querySelector(':scope > dictionary');

      // For JsIdevice, extract the actual type from _iDeviceDir (modern iDevice)
      let ideviceType;
      if (className === 'exe.engine.jsidevice.JsIdevice' && dict) {
        const iDeviceDir = this.findDictStringValue(dict, '_iDeviceDir');
        if (iDeviceDir) {
          // Extract basename from path (handles both Windows and Unix paths)
          // e.g., "C:\...\text" or "/path/to/text" -> "text"
          const parts = iDeviceDir.replace(/\\/g, '/').split('/');
          let extractedType = parts[parts.length - 1] || iDeviceDir;

          // Map legacy JsIdevice type names to modern iDevice types
          // Legacy ELP files may use different naming conventions
          // Based on analysis of all legacy _iDeviceDir values found in ELP fixtures
          const jsIdeviceTypeMap = {
            // Spanish activity names -> English iDevice types
            'adivina-activity': 'guess',
            'candado-activity': 'padlock',
            'clasifica-activity': 'classify',
            'completa-activity': 'complete',
            'desafio-activity': 'challenge',
            'descubre-activity': 'discover',
            'flipcards-activity': 'flipcards',
            'identifica-activity': 'identify',
            'listacotejo-activity': 'checklist',
            'mapa-activity': 'map',
            'mathematicaloperations-activity': 'mathematicaloperations',
            'mathproblems-activity': 'mathproblems',
            'ordena-activity': 'sort',
            'quext-activity': 'quick-questions',
            'relaciona-activity': 'relate',
            'rosco-activity': 'az-quiz-game',
            'selecciona-activity': 'quick-questions-multiple-choice',
            'seleccionamedias-activity': 'select-media-files',
            'sopa-activity': 'word-search',
            'trivial-activity': 'trivial',
            'videoquext-activity': 'quick-questions-video',
            // Other legacy type mappings
            'download-package': 'download-source-file',
            'form-activity': 'form',
            'rubrics': 'rubric',
            'pbl-tools': 'text', // PBL Task iDevice -> text with special metadata extraction
          };
          ideviceType = jsIdeviceTypeMap[extractedType] || extractedType;

          // Check if the type is a known modern iDevice type
          // Types that match their directory names (no mapping needed)
          const knownModernTypes = [
            'text', 'casestudy', 'geogebra-activity', 'interactive-video',
            'scrambled-list', 'udl-content', 'image-gallery', 'beforeafter',
            'dragdrop', 'external-website', 'hidden-image', 'magnifier',
            'periodic-table', 'attached-files', 'trueorfalse', 'example',
            'collaborative-editing',
          ];
          const allKnownTypes = [...Object.values(jsIdeviceTypeMap), ...knownModernTypes];
          if (!allKnownTypes.includes(ideviceType)) {
            Logger.log(`[LegacyXmlParser] Unknown JsIdevice type '${extractedType}', defaulting to 'text'`);
            ideviceType = 'text';
          }
          Logger.log(`[LegacyXmlParser] JsIdevice detected with type: ${ideviceType} (from path: ${iDeviceDir})`);
        } else {
          ideviceType = 'text'; // Fallback for JsIdevice without _iDeviceDir
        }
      } else if (this.isGenericIdeviceClass(className) && dict) {
        // GENERIC IDEVICE CLASS FORMAT
        // Handle non-standard formats like exelearning.libs.idevices.idevice.Idevice
        // where the actual type is stored in __name__ field
        const typeName = this.findDictStringValue(dict, '__name__');
        if (typeName) {
          ideviceType = this.mapGenericIdeviceType(typeName);
          Logger.log(`[LegacyXmlParser] Generic Idevice detected with type: ${typeName} -> ${ideviceType}`);
        } else {
          ideviceType = 'text'; // Fallback if no __name__ found
          Logger.log(`[LegacyXmlParser] Generic Idevice without __name__, defaulting to 'text'`);
        }
      } else {
        // LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
        // Convert legacy iDevice class names to modern type names for editability
        ideviceType = this.mapIdeviceType(className);
      }

      // LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
      // Extract the iDevice title to use as the block name
      const title = this.extractIdeviceTitle(inst);

      // LEGACY ICON EXTRACTION CONVENTION
      // Extract icon name from the iDevice dictionary and map to theme icon
      let iconName = '';
      if (dict) {
        const rawIcon = this.findDictStringValue(dict, 'icon');
        if (rawIcon) {
          // Map legacy icon name to theme icon name
          iconName = LegacyXmlParser.LEGACY_ICON_MAP[rawIcon] || rawIcon;
          Logger.log(`[LegacyXmlParser] iDevice icon: ${rawIcon} -> ${iconName}`);
        }
      }

      const idevice = {
        id: `idevice-${ref}`,
        type: ideviceType,
        title: title,  // Include title for block naming
        icon: iconName, // Theme icon name for the block
        position: idevices.length,
        htmlView: '',
        feedbackHtml: '',      // Feedback content from FeedbackField
        feedbackButton: '',    // Feedback button caption
      };

      // Extract HTML content from iDevice
      if (dict) {
        // Strategy 1: Look for "fields" list (JsIdevice format)
        // Also extracts feedback content if present (FeedbackField)
        const fieldsResult = this.extractFieldsContentWithFeedback(dict);
        if (fieldsResult.content) {
          idevice.htmlView = fieldsResult.content;
        }
        if (fieldsResult.feedbackHtml) {
          idevice.feedbackHtml = fieldsResult.feedbackHtml;
          idevice.feedbackButton = fieldsResult.feedbackButton;
        }

        // Fallback: Check for ReflectionIdevice-style answerTextArea feedback
        if (!idevice.feedbackHtml) {
          const answerFeedback = this.extractReflectionFeedback(dict);
          if (answerFeedback.content) {
            idevice.feedbackHtml = answerFeedback.content;
            idevice.feedbackButton = answerFeedback.buttonCaption;
          }
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

        // Strategy 4: FreeTextIdevice with circular reference pattern
        // When content field points back to parent TextAreaField (see Symfony
        // OdeOldXmlFreeTextIdevice.php lines 56-61 for reference implementation)
        if (!idevice.htmlView && className.includes('FreeTextIdevice')) {
          const parentTextArea = this.findParentTextAreaField(inst);
          if (parentTextArea) {
            idevice.htmlView = this.extractTextFieldContent(parentTextArea);
            if (idevice.htmlView) {
              Logger.log(`[LegacyXmlParser] FreeTextIdevice content from parent TextAreaField`);
            }
          }
        }

        // LEGACY IDEVICE PROPERTY EXTRACTION
        // Use handler registry if available, otherwise fall back to inline logic
        if (typeof LegacyHandlerRegistry !== 'undefined') {
          const handler = LegacyHandlerRegistry.getHandler(className, ideviceType);
          // Pass idevice.id and language context for handlers that need it
          const handlerContext = { language: this.projectLanguage };
          const handlerProps = handler.extractProperties(dict, idevice.id, handlerContext);
          if (handlerProps && Object.keys(handlerProps).length > 0) {
            idevice.properties = handlerProps;
            Logger.log(`[LegacyXmlParser] Extracted properties via ${handler.constructor.name}`);
          }

          // Use handler's extractHtmlView if available (e.g., GameIdeviceHandler updates DataGame div with decrypted JSON)
          // Pass project language as context for proper localization of default texts
          if (typeof handler.extractHtmlView === 'function') {
            const handlerHtml = handler.extractHtmlView(dict, { language: this.projectLanguage });
            if (handlerHtml) {
              idevice.htmlView = handlerHtml;
              Logger.log(`[LegacyXmlParser] Used handler htmlView (${handlerHtml.length} chars)`);
            }
          }

          // Update type from handler if it provides a normalized type
          // GameIdeviceHandler normalizes: flipcards-activity -> flipcards, selecciona-activity -> selecciona
          // Call this AFTER extractProperties since handler may set _detectedType during extraction
          const handlerType = handler.getTargetType();
          if (handlerType && handlerType !== 'text' && handlerType !== idevice.type) {
            Logger.log(`[LegacyXmlParser] Handler updated type: ${idevice.type} -> ${handlerType}`);
            idevice.type = handlerType;
          }

          // Get block properties from handler if available
          // This allows handlers like NotaHandler to set visibility=false on the block
          if (typeof handler.getBlockProperties === 'function') {
            const blockProps = handler.getBlockProperties();
            if (blockProps && Object.keys(blockProps).length > 0) {
              idevice.blockProperties = blockProps;
              Logger.log(`[LegacyXmlParser] Handler block properties:`, blockProps);
            }
          }
        } else {
          // Fallback: Legacy inline extraction for MultichoiceIdevice/MultiSelectIdevice
          if (ideviceType === 'form' && (
            className.includes('MultichoiceIdevice') ||
            className.includes('MultiSelectIdevice')
          )) {
            const questionsData = this.extractMultichoiceQuestions(dict);
            if (questionsData.length > 0) {
              idevice.properties = { questionsData };
              Logger.log(`[LegacyXmlParser] Form iDevice with ${questionsData.length} questions`);
            }
          }
        }
      }

      // RUBRIC IDEVICE DETECTION AND TRANSFORMATION
      // Based on Symfony OdeXmlUtil.php lines 2420-2426 and 2194-2196
      // Legacy rubric content contains 'exe-rubric-strings' (singular) which must be
      // transformed to 'exe-rubrics-strings' (plural) for the export script to work
      if (idevice.htmlView && idevice.htmlView.includes('exe-rubric-strings')) {
        // 1. Set iDevice type to 'rubric'
        idevice.type = 'rubric';

        // 2. Transform exe-rubric to exe-rubrics (fixes singular to plural)
        // This ensures exe-rubric-strings becomes exe-rubrics-strings
        idevice.htmlView = idevice.htmlView.replace(/exe-rubric([^s])/g, 'exe-rubrics$1');

        // 3. Set cssClass for rubricIdevice wrapper class (used by ideviceNode.js line 285)
        idevice.cssClass = 'rubric';

        Logger.log('[LegacyXmlParser] Detected rubric iDevice, transformed to modern format');
      }

      // UDL CONTENT DETECTION (Universal Design for Learning)
      // Based on Symfony OdeXmlUtil.php lines 2407-2412
      if (idevice.htmlView && idevice.htmlView.includes('exe-udlContent')) {
        idevice.type = 'udl-content';
        Logger.log('[LegacyXmlParser] Detected UDL content iDevice');
      }

      // SCRAMBLED LIST DETECTION
      // Based on Symfony OdeXmlUtil.php lines 2414-2418
      if (idevice.htmlView && idevice.htmlView.includes('exe-sortableList')) {
        idevice.type = 'scrambled-list';
        Logger.log('[LegacyXmlParser] Detected scrambled-list iDevice');
      }

      // DOWNLOAD SOURCE FILE DETECTION
      // Based on Symfony OdeXmlUtil.php lines 2427-2433
      if (idevice.htmlView && idevice.htmlView.includes('exe-download-package-instructions')) {
        idevice.type = 'download-source-file';
        // Convert legacy .elp references to .elpx in button text
        // Common patterns: "Download .elp file", "Descargar archivo .elp", etc.
        idevice.htmlView = idevice.htmlView
          .replace(/\.elp([^x])/gi, '.elpx$1')
          .replace(/\.elp(['"])/gi, '.elpx$1')
          .replace(/\.elp(<)/gi, '.elpx$1')
          .replace(/\.elp$/gi, '.elpx');
        Logger.log('[LegacyXmlParser] Detected download-source-file iDevice, converted .elp to .elpx');
      }

      // INTERACTIVE VIDEO DETECTION
      // Based on Symfony OdeXmlUtil.php lines 2441-2476
      if (idevice.htmlView && idevice.htmlView.includes('exe-interactive-video')) {
        idevice.type = 'interactive-video';
        Logger.log('[LegacyXmlParser] Detected interactive-video iDevice');
      }

      // GEOGEBRA ACTIVITY DETECTION
      // Based on Symfony OdeXmlUtil.php lines 2478-2482
      if (idevice.htmlView && idevice.htmlView.includes('auto-geogebra')) {
        idevice.type = 'geogebra-activity';
        Logger.log('[LegacyXmlParser] Detected geogebra-activity iDevice');
      }

      // PBL TASK DETECTION AND METADATA EXTRACTION
      // Based on Symfony OdeXmlUtil.php lines 2159-2192 and 2272-2320
      // PBL Task iDevices have structured HTML with duration, participants, and feedback
      if (idevice.htmlView && idevice.htmlView.includes('pbl-task-description')) {
        // Type stays as 'text' but we preserve the special HTML structure
        // and extract metadata as JSON properties for the text iDevice editor
        const pblTaskData = this.extractPblTaskMetadata(idevice.htmlView);
        if (pblTaskData) {
          idevice.properties = { ...idevice.properties, ...pblTaskData };
          Logger.log('[LegacyXmlParser] Detected PBL Task iDevice, extracted metadata');
        }
      }

      idevices.push(idevice);
    }

    Logger.log(`[LegacyXmlParser] Extracted ${idevices.length} iDevices with titles`);
    return idevices;
  }

  /**
   * Extract iDevices from a list element (legacy method for backwards compatibility)
   * @param {Element} listEl - The list element containing iDevice instances
   * @returns {Array} Array of iDevice objects
   * @deprecated Use extractIDevicesWithTitles instead
   */
  extractIDevices(listEl) {
    return this.extractIDevicesWithTitles(listEl);
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
        // Handle both <string> and <unicode> value elements
        if (valueEl && (valueEl.tagName === 'string' || valueEl.tagName === 'unicode')) {
          return valueEl.getAttribute('value') || valueEl.textContent || null;
        }
      }
    }
    return null;
  }

  /**
   * Find a list element in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {Element|null} List element or null
   */
  findDictList(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'list') {
          return valueEl;
        }
      }
    }
    return null;
  }

  /**
   * Find an instance element in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {Element|null} Instance element or null
   */
  findDictInstance(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'instance') {
          return valueEl;
        }
      }
    }
    return null;
  }

  /**
   * Find a boolean value in dictionary by key
   * @param {Element} dict - Dictionary element
   * @param {string} key - Key to find
   * @returns {boolean} Boolean value (false if not found)
   */
  findDictBoolValue(dict, key) {
    const children = Array.from(dict.children);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === key) {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'bool') {
          return valueEl.getAttribute('value') === '1';
        }
      }
    }
    return false;
  }

  /**
   * LEGACY MULTICHOICE IDEVICE QUESTION EXTRACTION
   *
   * Extracts questions from legacy MultichoiceIdevice format
   * and converts to modern form iDevice questionsData format.
   *
   * Structure:
   * - MultichoiceIdevice.questions -> list of QuizQuestionField
   * - QuizQuestionField.questionTextArea -> question text
   * - QuizQuestionField.options -> list of QuizOptionField
   * - QuizOptionField.answerTextArea -> option text
   * - QuizOptionField.isCorrect -> boolean
   *
   * @param {Element} dict - Dictionary element of the MultichoiceIdevice
   * @returns {Array} Array of question objects in form iDevice format
   */
  extractMultichoiceQuestions(dict) {
    const questionsData = [];

    // Find "questions" list in dictionary
    const questionsList = this.findDictList(dict, 'questions');
    if (!questionsList) return questionsData;

    // Iterate each QuizQuestionField
    const questionFields = questionsList.querySelectorAll(':scope > instance');
    for (const questionField of questionFields) {
      const qDict = questionField.querySelector(':scope > dictionary');
      if (!qDict) continue;

      // Extract question text from questionTextArea
      const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
      const questionText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';

      // Extract options from options list
      const optionsList = this.findDictList(qDict, 'options');
      const answers = [];
      let correctCount = 0;

      if (optionsList) {
        const optionFields = optionsList.querySelectorAll(':scope > instance');
        for (const optionField of optionFields) {
          const optDict = optionField.querySelector(':scope > dictionary');
          if (!optDict) continue;

          // Get answer text from answerTextArea
          const answerTextArea = this.findDictInstance(optDict, 'answerTextArea');
          const optionText = answerTextArea ? this.extractTextAreaFieldContent(answerTextArea) : '';

          // Get isCorrect flag
          const isCorrect = this.findDictBoolValue(optDict, 'isCorrect');

          if (isCorrect) correctCount++;
          answers.push([isCorrect, optionText]);
        }
      }

      // Only add if we have a question or answers
      if (questionText || answers.length > 0) {
        questionsData.push({
          activityType: 'selection',
          selectionType: correctCount > 1 ? 'multiple' : 'single',
          baseText: questionText,
          answers: answers
        });
      }
    }

    Logger.log(`[LegacyXmlParser] Extracted ${questionsData.length} multichoice questions`);
    return questionsData;
  }

  /**
   * Extract PBL Task metadata from HTML content
   * Based on Symfony OdeXmlUtil.php searchTaskIdeviceElementsOldElp()
   *
   * PBL Task iDevices have structured HTML:
   * - dl.pbl-task-info with dt/dd pairs for duration and participants
   * - div.pbl-task-description with main content
   * - div.feedback with feedback content
   * - input.feedbackbutton with button text
   *
   * @param {string} htmlView - HTML content of the iDevice
   * @returns {Object|null} Extracted metadata or null if extraction fails
   */
  extractPblTaskMetadata(htmlView) {
    if (!htmlView) return null;

    try {
      // Create a temporary DOM element to parse HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlView;

      // Extract duration
      const durationLabel = tempDiv.querySelector('dt.pbl-task-duration');
      const durationValue = tempDiv.querySelector('dd.pbl-task-duration');

      // Extract participants
      const participantsLabel = tempDiv.querySelector('dt.pbl-task-participants');
      const participantsValue = tempDiv.querySelector('dd.pbl-task-participants');

      // Extract feedback
      const feedbackDiv = tempDiv.querySelector('.feedback.js-feedback');
      const feedbackButton = tempDiv.querySelector('.feedbackbutton');

      // Build metadata object matching Symfony's structure
      const metadata = {};

      if (durationLabel) {
        metadata.textInfoDurationInput = durationLabel.textContent?.trim() || '';
      }
      if (durationValue) {
        metadata.textInfoDurationTextInput = durationValue.textContent?.trim() || '';
      }
      if (participantsLabel) {
        metadata.textInfoParticipantsInput = participantsLabel.textContent?.trim() || '';
      }
      if (participantsValue) {
        metadata.textInfoParticipantsTextInput = participantsValue.textContent?.trim() || '';
      }
      if (feedbackDiv) {
        metadata.textInfoFeedback = feedbackDiv.innerHTML?.trim() || '';
      }
      if (feedbackButton) {
        metadata.textInfoFeedbackButton = feedbackButton.value || feedbackButton.textContent?.trim() || '';
      }

      // Only return if we found some metadata
      const hasMetadata = Object.keys(metadata).length > 0;
      return hasMetadata ? metadata : null;
    } catch (e) {
      Logger.log(`[LegacyXmlParser] Error extracting PBL Task metadata: ${e.message}`);
      return null;
    }
  }

  /**
   * Extract content from "fields" list in JsIdevice format
   * Structure: fields -> list -> TextAreaField instances -> content_w_resourcePaths
   * @param {Element} dict - Dictionary element of the iDevice
   * @returns {string} Combined HTML content from all fields
   */
  extractFieldsContent(dict) {
    const result = this.extractFieldsContentWithFeedback(dict);
    return result.content;
  }

  /**
   * Extract content and feedback from "fields" list in JsIdevice format
   * Structure: fields -> list -> TextAreaField/FeedbackField instances
   * @param {Element} dict - Dictionary element of the iDevice
   * @returns {{content: string, feedbackHtml: string, feedbackButton: string}} Content and feedback
   */
  extractFieldsContentWithFeedback(dict) {
    const contents = [];
    let feedbackHtml = '';
    let feedbackButton = '';
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
          // Handle both direct instances and references (like iDevices, fields can be referenced)
          const directChildren = Array.from(listEl.children);
          const fieldInstances = [];

          for (const child of directChildren) {
            if (child.tagName === 'instance') {
              fieldInstances.push(child);
            } else if (child.tagName === 'reference') {
              // Resolve reference to actual field instance
              const refKey = child.getAttribute('key');
              if (refKey) {
                const referencedInstance = this.xmlDoc.querySelector(
                  `instance[reference="${refKey}"]`
                );
                if (referencedInstance) {
                  Logger.log(`[LegacyXmlParser] Resolved field reference key=${refKey}`);
                  fieldInstances.push(referencedInstance);
                } else {
                  Logger.log(`[LegacyXmlParser] WARNING: Could not find field for reference key=${refKey}`);
                }
              }
            }
          }

          for (const fieldInst of fieldInstances) {
            const fieldClass = fieldInst.getAttribute('class') || '';
            // Process TextAreaField and TextField
            if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
              const content = this.extractTextAreaFieldContent(fieldInst);
              if (content) {
                contents.push(content);
              }
            }
            // Process FeedbackField
            if (fieldClass.includes('FeedbackField')) {
              const feedback = this.extractFeedbackFieldContent(fieldInst);
              if (feedback.content) {
                feedbackHtml = feedback.content;
                feedbackButton = feedback.buttonCaption;
              }
            }
          }
        }
        break;
      }
    }

    return {
      content: contents.join('\n'),
      feedbackHtml,
      feedbackButton
    };
  }

  /**
   * Extract content from a FeedbackField instance
   * @param {Element} fieldInst - FeedbackField instance element
   * @returns {{content: string, buttonCaption: string}} Feedback content and button caption
   */
  extractFeedbackFieldContent(fieldInst) {
    const dict = fieldInst.querySelector(':scope > dictionary');
    if (!dict) return { content: '', buttonCaption: '' };

    const children = Array.from(dict.children);
    let content = '';
    let buttonCaption = '';

    // Look for feedback content (feedback or content_w_resourcePaths)
    const contentKeys = ['feedback', 'content_w_resourcePaths', '_content', 'content'];
    for (const targetKey of contentKeys) {
      if (content) break;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'string' &&
            child.getAttribute('role') === 'key' &&
            child.getAttribute('value') === targetKey) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === 'unicode') {
            const value = valueEl.getAttribute('value') || valueEl.textContent || '';
            if (value.trim()) {
              content = this.decodeHtmlContent(value);
              break;
            }
          }
        }
      }
    }

    // Look for button caption (_buttonCaption)
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === '_buttonCaption') {
        const valueEl = children[i + 1];
        if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
          buttonCaption = valueEl.getAttribute('value') || valueEl.textContent || '';
          break;
        }
      }
    }

    // Use project language for localized default caption
    const defaultCaption = this.getLocalizedFeedbackText(this.projectLanguage);
    return {
      content,
      buttonCaption: buttonCaption || defaultCaption
    };
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

        // Value might be unicode, string, instance (TextField), or reference
        if (valueEl.tagName === 'unicode' || valueEl.tagName === 'string') {
          return this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
        }

        if (valueEl.tagName === 'instance') {
          // It's a TextField or similar - look for content inside
          return this.extractTextFieldContent(valueEl);
        }

        // Handle reference to TextAreaField defined elsewhere
        // This handles cases where content points to a field at a different location
        if (valueEl.tagName === 'reference') {
          const refKey = valueEl.getAttribute('key');
          if (refKey && this.xmlDoc) {
            const referencedInstance = this.xmlDoc.querySelector(
              `instance[reference="${refKey}"]`
            );
            if (referencedInstance) {
              const refClass = referencedInstance.getAttribute('class') || '';
              if (refClass.includes('TextAreaField') || refClass.includes('TextField')) {
                Logger.log(`[LegacyXmlParser] Resolved content reference key=${refKey}`);
                return this.extractTextFieldContent(referencedInstance);
              }
            }
          }
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

    // TextField stores content in "content_w_resourcePaths" (preferred) or "_content" (fallback)
    // IMPORTANT: Prioritize content_w_resourcePaths because it contains the actual HTML with resource paths
    // The "_content" field may be empty or contain unprocessed content
    const children = Array.from(dict.children);

    // First pass: look for content_w_resourcePaths (has actual HTML with resource paths)
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === 'content_w_resourcePaths') {
        const valueEl = children[i + 1];
        if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
          const content = this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
          if (content) return content;
        }
      }
    }

    // Second pass: fallback to _content or content
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key') {
        const keyValue = child.getAttribute('value');
        if (keyValue === '_content' || keyValue === 'content') {
          const valueEl = children[i + 1];
          if (valueEl && (valueEl.tagName === 'unicode' || valueEl.tagName === 'string')) {
            const content = this.decodeHtmlContent(valueEl.getAttribute('value') || valueEl.textContent || '');
            if (content) return content;
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
   * Extract feedback from ReflectionIdevice-style structure
   * ReflectionIdevice stores feedback in answerTextArea field with buttonCaption
   * @param {Element} dict - Dictionary element of the iDevice
   * @returns {{content: string, buttonCaption: string}} Feedback content and button caption
   */
  extractReflectionFeedback(dict) {
    const children = Array.from(dict.children);

    // Look for answerTextArea key (used by ReflectionIdevice)
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === 'answerTextArea') {
        const valueEl = children[i + 1];
        if (valueEl && valueEl.tagName === 'instance') {
          // It's a TextAreaField instance - extract buttonCaption and content
          const fieldDict = valueEl.querySelector(':scope > dictionary');
          if (fieldDict) {
            const buttonCaption = this.findDictStringValue(fieldDict, 'buttonCaption') || '';
            const content = this.extractTextAreaFieldContent(valueEl);

            // Return feedback if there's content (button caption is optional)
            if (content) {
              // Use project language for localized default caption
              const defaultCaption = this.getLocalizedFeedbackText(this.projectLanguage);
              return {
                content,
                buttonCaption: buttonCaption || defaultCaption
              };
            }
          }
        }
      }
    }

    return { content: '', buttonCaption: '' };
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

  /**
   * FREETEXTIDEVICE PARENT TEXTAREAFIELD LOOKUP
   *
   * Find the parent TextAreaField that contains this iDevice instance.
   * Used for circular reference patterns where FreeTextIdevice's `content`
   * field points back to its parent TextAreaField.
   *
   * Legacy structure (circular reference pattern):
   *   <instance class="exe.engine.field.TextAreaField" reference="61">
   *     <dictionary>
   *       <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="62">
   *         <dictionary>
   *           <string role="key" value="content"/>
   *           <reference key="61"/>  <!-- Points to parent -->
   *         </dictionary>
   *       </instance>
   *       <string role="key" value="content_w_resourcePaths"/>
   *       <unicode content="true" value="...actual content..."/>
   *     </dictionary>
   *   </instance>
   *
   * See Symfony OdeOldXmlFreeTextIdevice.php lines 56-61 for reference.
   *
   * @param {Element} ideviceInst - The iDevice instance element
   * @returns {Element|null} The parent TextAreaField element or null
   */
  findParentTextAreaField(ideviceInst) {
    if (!ideviceInst) return null;

    // Navigate up: ideviceInst -> dictionary -> TextAreaField
    const parentDict = ideviceInst.parentElement;
    if (parentDict && parentDict.tagName === 'dictionary') {
      const parentInst = parentDict.parentElement;
      if (parentInst && parentInst.tagName === 'instance') {
        const parentClass = parentInst.getAttribute('class') || '';
        if (parentClass.includes('TextAreaField')) {
          return parentInst;
        }
      }
    }
    return null;
  }

  /**
   * GENERIC IDEVICE CLASS DETECTION
   *
   * Check if class is a generic Idevice class from non-standard formats.
   * These formats store their actual type in the __name__ field rather than
   * encoding it in the class name.
   *
   * Example: exelearning.libs.idevices.idevice.Idevice
   * (vs standard exe.engine.freetextidevice.FreeTextIdevice)
   *
   * @param {string} className - Legacy class name
   * @returns {boolean} True if this is a generic Idevice class
   */
  isGenericIdeviceClass(className) {
    // Matches classes that end with .Idevice but are NOT from exe.engine.*
    // These are from alternate forks/versions of eXeLearning
    return className.endsWith('.Idevice') &&
           !className.startsWith('exe.engine.');
  }

  /**
   * GENERIC IDEVICE TYPE MAPPING
   *
   * Map generic iDevice type names (from __name__ field) to modern types.
   * Generic types typically map to 'text' since they're simple content containers.
   *
   * @param {string} typeName - Type from __name__ field (e.g., 'latex')
   * @returns {string} Modern iDevice type
   */
  mapGenericIdeviceType(typeName) {
    // Generic types map to 'text' for editability in modern editor
    // Add specific mappings here if certain types need different handling
    const typeMap = {
      // Future: Add specific mappings if needed
      // 'specific-type': 'modern-type',
    };
    return typeMap[typeName.toLowerCase()] || 'text';
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LegacyXmlParser;
} else {
  window.LegacyXmlParser = LegacyXmlParser;
}
