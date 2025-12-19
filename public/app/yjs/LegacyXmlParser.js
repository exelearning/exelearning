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
    if (shouldFlatten && rootPage) {
      return this.flattenRootChildren(rootPage);
    }

    // 3. Flatten into array with correct structure (no flattening needed)
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
            blocks.push({
              id: `block-${nodeEl.getAttribute('reference')}-${idx}`,
              name: blockName,  // Use iDevice title as block name, filtering defaults
              iconName: idevice.icon || '',  // Use iDevice icon as block icon
              position: idx,
              idevices: [idevice],  // Exactly one iDevice per block
            });
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
      // Reflection variants
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
      // Multiple choice (single answer)
      'MultichoiceIdevice': 'quick-questions-multiple-choice',
      'EleccionmultiplefpdIdevice': 'quick-questions-multiple-choice',
      // Multiple select (multiple answers)
      'MultiSelectIdevice': 'quick-questions-multiple-choice',
      'SeleccionmultiplefpdIdevice': 'quick-questions-multiple-choice',
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
      // File attachments
      'FileAttachIdeviceInc': 'attached-files',
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

    // Find all instance elements that are iDevices
    const instances = listEl.querySelectorAll(':scope > instance');

    for (const inst of instances) {
      const className = inst.getAttribute('class') || '';

      // Check if this is an iDevice (class contains "idevice" case-insensitive)
      if (!className.toLowerCase().includes('idevice')) continue;

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
          ideviceType = parts[parts.length - 1] || iDeviceDir;
          Logger.log(`[LegacyXmlParser] JsIdevice detected with type: ${ideviceType} (from path: ${iDeviceDir})`);
        } else {
          ideviceType = 'text'; // Fallback for JsIdevice without _iDeviceDir
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

    return {
      content,
      buttonCaption: buttonCaption || 'Mostrar retroalimentación'
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

            if (content && buttonCaption) {
              return { content, buttonCaption };
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
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LegacyXmlParser;
} else {
  window.LegacyXmlParser = LegacyXmlParser;
}
