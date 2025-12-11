/**
 * Html5Exporter
 * Exports a Yjs document to HTML5 website format (ZIP).
 * Generates HTML pages with navigation, styling, and assets.
 *
 * HTML5 export creates a complete standalone website with:
 * - index.html (first page)
 * - html/*.html (other pages)
 * - libs/ (JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 *
 * @extends BaseExporter
 */
class Html5Exporter extends BaseExporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   * @param {ResourceFetcher} resourceFetcher - Resource fetcher for server resources
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null) {
    super(documentManager, assetCacheManager, resourceFetcher);

    // Initialize renderers
    this.ideviceRenderer = new IdeviceHtmlRenderer(resourceFetcher);
    this.pageRenderer = new PageHtmlRenderer(this.ideviceRenderer);

    // Initialize library detector
    this.libraryDetector = new LibraryDetector();
  }

  /**
   * Get file extension for HTML5 format
   * @returns {string}
   */
  getFileExtension() {
    return '.zip';
  }

  /**
   * Get file suffix for HTML5 format
   * @returns {string}
   */
  getFileSuffix() {
    return '_web';
  }

  /**
   * Export to HTML5 ZIP file and trigger download
   * @param {string} filename - Optional filename override
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async export(filename = null) {
    const exportFilename = filename || this.buildFilename();
    Logger.log(`[Html5Exporter] Exporting to ${exportFilename}...`);

    try {
      const zip = this.createZip();
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.get('theme') || 'base';

      // Pre-process pages: add filenames to asset URLs
      // This transforms asset://uuid to asset://uuid/filename.ext
      // so that renderers can later convert to content/resources/uuid/filename.ext
      Logger.log('[Html5Exporter] Pre-processing asset URLs...');
      pages = await this.preprocessPagesForExport(pages);

      // 1. Generate HTML pages
      Logger.log(`[Html5Exporter] Generating ${pages.length} HTML pages...`);
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const html = this.generatePageHtml(page, pages, meta);
        // First page is index.html, others go in html/ directory
        const pageFilename = i === 0 ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
        zip.file(pageFilename, html);
      }

      // 2. Add content.xml (ODE format for re-import)
      Logger.log('[Html5Exporter] Generating content.xml...');
      const contentXml = this.generateContentXml();
      zip.file('content.xml', contentXml);

      // 3. Add base CSS
      Logger.log('[Html5Exporter] Adding base CSS...');
      zip.file('content/css/base.css', this.getBaseCss());

      // 4. Fetch and add theme if resourceFetcher is available
      if (this.resourceFetcher) {
        Logger.log(`[Html5Exporter] Fetching theme: ${themeName}...`);
        try {
          const themeFiles = await this.resourceFetcher.fetchTheme(themeName);
          for (const [path, content] of themeFiles) {
            zip.file(`theme/${path}`, content);
          }
        } catch (e) {
          console.warn(`[Html5Exporter] Could not load theme ${themeName}:`, e);
          // Add fallback theme CSS
          zip.file('theme/content.css', this.getFallbackThemeCss());
          zip.file('theme/default.js', this.getFallbackThemeJs());
        }

        // 5. Detect and fetch required libraries
        Logger.log('[Html5Exporter] Detecting required libraries...');
        const allHtmlContent = this.collectAllHtmlContent(pages);
        const detectedLibs = this.libraryDetector.detectLibraries(allHtmlContent, {
          includeAccessibilityToolbar: meta.get('pp_addAccessibilityToolbar') === 'true',
        });
        Logger.log(`[Html5Exporter] Detected ${detectedLibs.count} additional libraries:`,
          detectedLibs.libraries.map(l => l.name).join(', ') || 'none');

        // Get all required library files (base + detected)
        const allRequiredFiles = this.libraryDetector.getAllRequiredFiles(allHtmlContent, {
          includeAccessibilityToolbar: meta.get('pp_addAccessibilityToolbar') === 'true',
        });

        Logger.log(`[Html5Exporter] Fetching ${allRequiredFiles.length} library files...`);
        try {
          const libFiles = await this.resourceFetcher.fetchLibraryFiles(allRequiredFiles);
          for (const [path, content] of libFiles) {
            zip.file(`libs/${path}`, content);
          }
          Logger.log(`[Html5Exporter] Added ${libFiles.size} library files to ZIP`);
        } catch (e) {
          console.warn('[Html5Exporter] Could not load libraries, trying fallback:', e);
          // Fallback: try base libraries API
          try {
            const baseLibs = await this.resourceFetcher.fetchBaseLibraries();
            for (const [path, content] of baseLibs) {
              zip.file(`libs/${path}`, content);
            }
          } catch (e2) {
            console.warn('[Html5Exporter] Could not load base libraries:', e2);
          }
        }

        // 6. Fetch and add iDevice assets
        const usedIdevices = this.getUsedIdevices(pages);
        if (usedIdevices.length > 0) {
          Logger.log(`[Html5Exporter] Fetching iDevice assets: ${usedIdevices.join(', ')}...`);
          for (const idevice of usedIdevices) {
            try {
              const ideviceFiles = await this.resourceFetcher.fetchIdevice(idevice);
              for (const [path, content] of ideviceFiles) {
                zip.file(`idevices/${idevice}/${path}`, content);
              }
            } catch (e) {
              // Many iDevices don't have extra files - this is normal
            }
          }
        }
      } else {
        // Add fallback theme if no resourceFetcher
        zip.file('theme/content.css', this.getFallbackThemeCss());
        zip.file('theme/default.js', this.getFallbackThemeJs());
      }

      // 7. Add project assets from cache
      Logger.log('[Html5Exporter] Adding project assets...');
      await this.addAssetsToZipWithResourcePath(zip);

      // 8. Generate and download ZIP
      Logger.log('[Html5Exporter] Generating ZIP...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      this.downloadBlob(blob, exportFilename);

      Logger.log(`[Html5Exporter] Export complete: ${exportFilename}`);
      return { success: true, filename: exportFilename };
    } catch (error) {
      console.error('[Html5Exporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add assets to ZIP with content/resources/ prefix
   * Uses AssetManager (IndexedDB) as primary source, falls back to assetCache
   * @param {JSZip} zip
   */
  async addAssetsToZipWithResourcePath(zip) {
    let assetsAdded = 0;

    // 1. Try AssetManager first (primary source - IndexedDB)
    if (this.assetManager) {
      try {
        const assets = await this.assetManager.getProjectAssets();
        Logger.log(`[Html5Exporter] Found ${assets.length} assets in AssetManager`);

        for (const asset of assets) {
          try {
            const assetId = asset.id || asset.assetId;
            const filename = asset.filename || asset.originalFilename || `asset-${assetId}`;
            // Store in content/resources/{assetId}/{filename}
            const zipPath = `content/resources/${assetId}/${filename}`;
            zip.file(zipPath, asset.blob);
            Logger.log(`[Html5Exporter] Added asset from AssetManager: ${zipPath}`);
            assetsAdded++;
          } catch (e) {
            console.warn(`[Html5Exporter] Failed to add asset from AssetManager:`, e);
          }
        }

        if (assetsAdded > 0) {
          Logger.log(`[Html5Exporter] Added ${assetsAdded} assets from AssetManager`);
          return;
        }
      } catch (e) {
        console.warn('[Html5Exporter] Failed to get assets from AssetManager, trying assetCache:', e);
      }
    }

    // 2. Fallback to assetCache (legacy compatibility)
    if (!this.assetCache) {
      console.warn('[Html5Exporter] No asset cache or AssetManager available');
      return;
    }

    try {
      const assets = await this.assetCache.getAllAssets();

      for (const asset of assets) {
        try {
          const assetId = asset.assetId || asset.metadata?.assetId;
          const filename = asset.metadata?.filename || `asset-${assetId}`;
          // Store in content/resources/{assetId}/{filename}
          const zipPath = `content/resources/${assetId}/${filename}`;
          zip.file(zipPath, asset.blob);
          Logger.log(`[Html5Exporter] Added asset from assetCache: ${zipPath}`);
          assetsAdded++;
        } catch (e) {
          console.warn(`[Html5Exporter] Failed to add asset from assetCache:`, e);
        }
      }

      if (assetsAdded > 0) {
        Logger.log(`[Html5Exporter] Added ${assetsAdded} assets from assetCache`);
      }
    } catch (e) {
      console.warn('[Html5Exporter] Failed to get assets from cache:', e);
    }
  }

  /**
   * Sanitize page title for use as filename
   * @param {string} title
   * @returns {string}
   */
  sanitizePageFilename(title) {
    if (!title) return 'page';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  // =========================================================================
  // Content XML Generation (for re-import)
  // =========================================================================

  /**
   * Generate content.xml from Y.Doc (same as ElpxExporter)
   * @returns {string}
   */
  generateContentXml() {
    const metadata = this.getMetadata();
    const navigation = this.getNavigation();

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
    xml += this.generatePropertiesXml(metadata);
    xml += '<odeNavStructures>\n';
    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      xml += this.generatePageXml(pageMap, i);
    }
    xml += '</odeNavStructures>\n';
    xml += '</ode>';
    return xml;
  }

  generatePropertiesXml(metadata) {
    let xml = '<odeProperties>\n';
    const props = {
      pp_title: metadata.get('title') || 'Untitled',
      pp_author: metadata.get('author') || '',
      pp_lang: metadata.get('language') || 'en',
      pp_description: metadata.get('description') || '',
      pp_license: metadata.get('license') || '',
      pp_theme: metadata.get('theme') || 'base',
    };
    for (const [key, value] of Object.entries(props)) {
      xml += `  <${key}>${this.escapeXml(value)}</${key}>\n`;
    }
    xml += '</odeProperties>\n';
    return xml;
  }

  generatePageXml(pageMap, index) {
    const pageId = pageMap.get('id') || pageMap.get('pageId');
    const pageName = pageMap.get('pageName') || 'Page';
    const parentId = pageMap.get('parentId') || '';
    const order = pageMap.get('order') ?? index;

    let xml = `<odeNavStructure odeNavStructureId="${this.escapeXml(pageId)}" `;
    xml += `odePageName="${this.escapeXml(pageName)}" odeNavStructureOrder="${order}" `;
    if (parentId) xml += `parentOdeNavStructureId="${this.escapeXml(parentId)}" `;
    xml += `>\n`;

    const blocks = pageMap.get('blocks');
    if (blocks) {
      for (let i = 0; i < blocks.length; i++) {
        xml += this.generateBlockXml(blocks.get(i), i);
      }
    }
    xml += '</odeNavStructure>\n';
    return xml;
  }

  generateBlockXml(blockMap, index) {
    const blockId = blockMap.get('id') || blockMap.get('blockId');
    const blockName = blockMap.get('blockName') || 'Block';
    const order = blockMap.get('order') ?? index;

    let xml = `  <odePagStructure odePagStructureId="${this.escapeXml(blockId)}" `;
    xml += `blockName="${this.escapeXml(blockName)}" odePagStructureOrder="${order}">\n`;

    const components = blockMap.get('components');
    if (components) {
      for (let i = 0; i < components.length; i++) {
        xml += this.generateComponentXml(components.get(i), i);
      }
    }
    xml += '  </odePagStructure>\n';
    return xml;
  }

  generateComponentXml(compMap, index) {
    const compId = compMap.get('id') || compMap.get('ideviceId');
    const ideviceType = compMap.get('ideviceType') || 'FreeTextIdevice';
    const order = compMap.get('order') ?? index;

    let xml = `    <odeComponent odeComponentId="${this.escapeXml(compId)}" `;
    xml += `odeIdeviceTypeDirName="${this.escapeXml(ideviceType)}" odeComponentOrder="${order}">\n`;

    const htmlContent = compMap.get('htmlContent');
    if (htmlContent) {
      const content = htmlContent.toString ? htmlContent.toString() : String(htmlContent);
      xml += `      <htmlView><![CDATA[${content}]]></htmlView>\n`;
    }

    const properties = compMap.get('properties');
    if (properties) {
      const propsObj = {};
      properties.forEach((value, key) => { propsObj[key] = value; });
      xml += `      <jsonProperties><![CDATA[${JSON.stringify(propsObj)}]]></jsonProperties>\n`;
    }

    xml += '    </odeComponent>\n';
    return xml;
  }

  // =========================================================================
  // HTML Generation
  // =========================================================================

  /**
   * Generate complete HTML for a page
   * @param {Object} page - Page data from buildPageList()
   * @param {Array} allPages - All pages
   * @param {Y.Map} meta - Project metadata
   * @returns {string}
   */
  generatePageHtml(page, allPages, meta) {
    const lang = meta.get('language') || 'en';
    const projectTitle = meta.get('title') || 'eXeLearning';
    const customStyles = meta.get('customStyles') || '';
    const isIndex = allPages.indexOf(page) === 0;
    const basePath = isIndex ? '' : '../';
    const author = meta.get('author') || '';
    const license = meta.get('license') || 'CC-BY-SA';

    // Get all iDevices used in the page
    const usedIdevices = this.getUsedIdevicesForPage(page);

    // Use PageHtmlRenderer for consistent output
    return this.pageRenderer.render(page, {
      projectTitle,
      language: lang,
      theme: meta.get('theme') || 'base',
      customStyles,
      allPages,
      basePath,
      isIndex,
      usedIdevices,
      author,
      license,
    });
  }

  /**
   * Collect all HTML content from all pages for library detection
   * @param {Array} pages - List of pages from buildPageList()
   * @returns {string}
   */
  collectAllHtmlContent(pages) {
    const htmlParts = [];
    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.content) {
            htmlParts.push(component.content);
          }
        }
      }
    }
    return htmlParts.join('\n');
  }

  /**
   * Get list of iDevice types used in a specific page
   * @param {Object} page
   * @returns {string[]}
   */
  getUsedIdevicesForPage(page) {
    const types = new Set();
    for (const block of page.blocks || []) {
      for (const component of block.components || []) {
        if (component.type) {
          types.add(component.type);
        }
      }
    }
    return Array.from(types);
  }

  /**
   * Generate HTML head section
   * @param {Object} page
   * @param {string} projectTitle
   * @param {string[]} usedIdevices
   * @param {string} basePath
   * @param {string} customStyles
   * @returns {string}
   */
  generateHead(page, projectTitle, usedIdevices, basePath, customStyles) {
    const title = `${this.escapeHtml(page.title)} | ${this.escapeHtml(projectTitle)}`;

    let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script>document.querySelector("html").classList.add("js");</script>
<script src="${basePath}libs/jquery/jquery.min.js"></script>
<script src="${basePath}libs/common_i18n.js"></script>
<script src="${basePath}libs/common.js"></script>
<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">`;

    // Add iDevice-specific CSS/JS
    for (const idevice of usedIdevices) {
      const idevicePath = this.getIdevicePath(idevice);
      head += `\n<script src="${basePath}idevices/${idevicePath}/${idevicePath}.js"></script>`;
      head += `\n<link rel="stylesheet" href="${basePath}idevices/${idevicePath}/${idevicePath}.css">`;
    }

    // Base CSS and theme
    head += `\n<link rel="stylesheet" href="${basePath}content/css/base.css">`;
    head += `\n<script src="${basePath}theme/default.js"></script>`;
    head += `\n<link rel="stylesheet" href="${basePath}theme/content.css">`;

    // Custom styles from project properties
    if (customStyles) {
      head += `\n<style>\n${customStyles}\n</style>`;
    }

    return head;
  }

  /**
   * Get the directory name for an iDevice type
   * @param {string} ideviceType
   * @returns {string}
   */
  getIdevicePath(ideviceType) {
    // Map iDevice types to their directory names
    const typeMap = {
      'FreeTextIdevice': 'text',
      'TextIdevice': 'text',
      'text': 'text',
      'MultipleChoiceIdevice': 'form',
      'QuizActivity': 'form',
      'form': 'form',
      'guess': 'guess',
      'checklist': 'checklist',
      'rubric': 'rubric',
    };
    return typeMap[ideviceType] || ideviceType.toLowerCase().replace('idevice', '');
  }

  /**
   * Generate navigation menu
   * @param {Array} pages
   * @param {string} currentPageId
   * @param {string} basePath
   * @returns {string}
   */
  generateNavigation(pages, currentPageId, basePath) {
    const rootPages = this.getRootPages(pages);

    let html = '<nav id="siteNav">\n<ul>\n';
    for (const page of rootPages) {
      html += this.generateNavItem(page, pages, currentPageId, basePath, 0);
    }
    html += '</ul>\n</nav>';

    return html;
  }

  /**
   * Generate navigation item (recursive for children)
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} currentPageId
   * @param {string} basePath
   * @param {number} level
   * @returns {string}
   */
  generateNavItem(page, allPages, currentPageId, basePath, level) {
    const children = this.getChildPages(page.id, allPages);
    const isCurrent = page.id === currentPageId;
    const hasChildren = children.length > 0;

    const classAttr = isCurrent ? ' class="active"' : '';
    const link = this.getPageLinkForHtml5(page, allPages, basePath);
    const linkClass = hasChildren ? 'daddy' : 'no-ch';

    let html = `<li${classAttr}>`;
    html += ` <a href="${link}" class="${isCurrent ? 'active ' : ''}${linkClass}">${this.escapeHtml(page.title)}</a>\n`;

    if (hasChildren) {
      html += '<ul class="other-section">\n';
      for (const child of children) {
        html += this.generateNavItem(child, allPages, currentPageId, basePath, level + 1);
      }
      html += '</ul>\n';
    }

    html += '</li>\n';
    return html;
  }

  /**
   * Get page link for HTML5 export
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} basePath
   * @returns {string}
   */
  getPageLinkForHtml5(page, allPages, basePath) {
    const isFirstPage = page.id === allPages[0]?.id;
    if (isFirstPage) {
      return basePath ? `${basePath}index.html` : 'index.html';
    }
    const filename = this.sanitizePageFilename(page.title);
    return `${basePath}html/${filename}.html`;
  }

  /**
   * Generate page content (iDevices)
   * @param {Object} page
   * @param {string} basePath
   * @returns {string}
   */
  generatePageContent(page, basePath) {
    let html = '';

    // Page title
    html += `<h1 class="page-title">${this.escapeHtml(page.title)}</h1>\n`;

    // Process blocks and components
    for (const block of page.blocks || []) {
      for (const component of block.components || []) {
        html += this.generateIdeviceHtml(component, basePath);
      }
    }

    return html;
  }

  /**
   * Generate HTML for a single iDevice
   * @param {Object} component
   * @param {string} basePath
   * @returns {string}
   */
  generateIdeviceHtml(component, basePath) {
    const type = component.type || 'FreeTextIdevice';
    const idevicePath = this.getIdevicePath(type);

    // Get the HTML content - this is the key fix
    let content = component.content || '';

    // Fix asset URLs in content (convert from asset:// or relative paths to content/resources/)
    content = this.fixAssetUrls(content, basePath);

    return `
<section class="iDevice_wrapper ${idevicePath}-IDevice" id="id${component.id}">
<div class="iDevice_content">
${content}
</div>
</section>
`;
  }

  /**
   * Fix asset URLs in content (simple sync version - fallback)
   * @param {string} content
   * @param {string} basePath
   * @returns {string}
   */
  fixAssetUrls(content, basePath) {
    if (!content) return '';

    // Fix asset:// URLs (filename can contain spaces)
    content = content.replace(/asset:\/\/([^"']+)/g, (match, assetPath) => {
      return `${basePath}content/resources/${assetPath}`;
    });

    // Fix files/tmp/ paths (from server temp paths)
    content = content.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (match, relativePath) => {
      return `${basePath}content/resources/${relativePath}`;
    });

    return content;
  }

  /**
   * Transform asset:// URLs to content/resources/ paths with filename lookup
   * Handles both old format (asset://uuid) and new format (asset://uuid/filename)
   * Supports all file types: images, SVG, PDF, etc.
   * @param {string} content - HTML content
   * @param {string} basePath - Base path prefix
   * @returns {Promise<string>} - Transformed HTML
   */
  async transformAssetUrlsWithLookup(content, basePath = '') {
    if (!content) return '';

    // If no assetManager, fall back to simple replacement
    if (!this.assetManager) {
      return this.fixAssetUrls(content, basePath);
    }

    // Build asset map: uuid -> filename (only once per export)
    if (!this._assetFilenameMap) {
      this._assetFilenameMap = new Map();
      try {
        const assets = await this.assetManager.getProjectAssets();
        for (const asset of assets) {
          const id = asset.id || asset.assetId;
          // Determine filename: stored filename, or generate from mime type
          let filename = asset.filename || asset.originalFilename;
          if (!filename) {
            // Generate filename from mime type (handles svg, pdf, etc.)
            const ext = this.getExtensionFromMime(asset.mime || 'application/octet-stream');
            filename = `asset-${id.substring(0, 8)}${ext}`;
          }
          this._assetFilenameMap.set(id, filename);
        }
        Logger.log(`[Html5Exporter] Built asset map with ${this._assetFilenameMap.size} entries`);
      } catch (e) {
        console.warn('[Html5Exporter] Failed to build asset map:', e);
        return this.fixAssetUrls(content, basePath);
      }
    }

    // Replace asset:// URLs with proper paths including filename
    // Pattern: asset://uuid or asset://uuid/filename (filename can contain spaces)
    let result = content.replace(/asset:\/\/([a-f0-9-]+)(\/[^"']+)?/gi, (match, uuid, existingPath) => {
      if (existingPath) {
        // Already has filename: asset://uuid/filename.jpg
        return `${basePath}content/resources/${uuid}${existingPath}`;
      }
      // Old format without filename: asset://uuid
      const filename = this._assetFilenameMap.get(uuid);
      if (filename) {
        return `${basePath}content/resources/${uuid}/${filename}`;
      }
      // Fallback if asset not found in map
      console.warn(`[Html5Exporter] Asset not found for URL transformation: ${uuid}`);
      return `${basePath}content/resources/${uuid}/asset`;
    });

    // Also fix files/tmp/ paths (from server temp paths)
    result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (match, relativePath) => {
      return `${basePath}content/resources/${relativePath}`;
    });

    return result;
  }

  /**
   * Add filenames to asset:// URLs without changing the protocol
   * Transforms asset://uuid to asset://uuid/filename.ext
   * This allows renderers to later add the correct basePath
   * @param {string} content - HTML content
   * @returns {Promise<string>} - Content with filenames added to asset URLs
   */
  async addFilenamesToAssetUrls(content) {
    if (!content) return '';

    // If no assetManager, return content unchanged
    if (!this.assetManager) {
      return content;
    }

    // Build asset map: uuid -> filename (only once per export)
    if (!this._assetFilenameMap) {
      this._assetFilenameMap = new Map();
      try {
        const assets = await this.assetManager.getProjectAssets();
        for (const asset of assets) {
          const id = asset.id || asset.assetId;
          // Determine filename: stored filename, or generate from mime type
          let filename = asset.filename || asset.originalFilename;
          if (!filename) {
            // Generate filename from mime type (handles svg, pdf, etc.)
            const ext = this.getExtensionFromMime(asset.mime || 'application/octet-stream');
            filename = `asset-${id.substring(0, 8)}${ext}`;
          }
          this._assetFilenameMap.set(id, filename);
        }
        Logger.log(`[Html5Exporter] Built asset map with ${this._assetFilenameMap.size} entries`);
      } catch (e) {
        console.warn('[Html5Exporter] Failed to build asset map:', e);
        return content;
      }
    }

    // Transform asset://uuid to asset://uuid/filename (keeping asset:// protocol)
    // The renderers will later convert asset:// to content/resources/ with basePath
    return content.replace(/asset:\/\/([a-f0-9-]+)(?![/a-zA-Z0-9._-])/gi, (match, uuid) => {
      const filename = this._assetFilenameMap.get(uuid);
      if (filename) {
        return `asset://${uuid}/${filename}`;
      }
      // Fallback if asset not found
      console.warn(`[Html5Exporter] Asset not found in map for URL enrichment: ${uuid}`);
      return match;
    });
  }

  /**
   * Pre-process pages to add filenames to asset URLs in all component content
   * @param {Array} pages - Pages from buildPageList()
   * @returns {Promise<Array>} - Pages with asset URLs enriched with filenames
   */
  async preprocessPagesForExport(pages) {
    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.content) {
            component.content = await this.addFilenamesToAssetUrls(component.content);
          }
        }
      }
    }
    return pages;
  }

  /**
   * Get file extension from MIME type
   * @param {string} mime - MIME type
   * @returns {string} - File extension with dot (e.g., '.jpg')
   */
  getExtensionFromMime(mime) {
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'image/x-icon': '.ico',
      'application/pdf': '.pdf',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/ogg': '.ogv',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/webm': '.weba',
      'application/zip': '.zip',
      'application/json': '.json',
      'text/plain': '.txt',
      'text/html': '.html',
      'text/css': '.css',
      'application/javascript': '.js',
      'application/octet-stream': '.bin',
    };
    return mimeToExt[mime] || '.bin';
  }

  /**
   * Generate pagination (prev/next links)
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} basePath
   * @returns {string}
   */
  generatePagination(page, allPages, basePath) {
    const prevPage = this.getPreviousPage(page, allPages);
    const nextPage = this.getNextPage(page, allPages);

    let html = '<nav class="pagination">\n';

    if (prevPage) {
      const link = this.getPageLinkForHtml5(prevPage, allPages, basePath);
      html += `<a href="${link}" class="prev"><span>&laquo; </span>${this.escapeHtml(prevPage.title)}</a>`;
    }

    if (prevPage && nextPage) {
      html += ' | ';
    }

    if (nextPage) {
      const link = this.getPageLinkForHtml5(nextPage, allPages, basePath);
      html += `<a href="${link}" class="next">${this.escapeHtml(nextPage.title)}<span> &raquo;</span></a>`;
    }

    html += '\n</nav>';
    return html;
  }

  /**
   * Generate footer section
   * @param {Y.Map} meta
   * @returns {string}
   */
  generateFooter(meta) {
    const license = meta.get('license') || 'CC-BY-SA';
    const author = meta.get('author') || '';

    let html = '<footer id="packageLicense" class="cc cc-by-sa">\n';
    if (author) {
      html += `<p><span>Author:</span> ${this.escapeHtml(author)}</p>\n`;
    }
    html += `<p><span>License:</span> ${this.escapeHtml(license)}</p>\n`;
    html += '</footer>';
    return html;
  }

  // =========================================================================
  // Fallback Styles
  // =========================================================================

  /**
   * Get base CSS content
   * @returns {string}
   */
  getBaseCss() {
    return `.exe-content{
  background: #fff;
}
.exe-content .page-title{
  font-size: 1.45em;
}
.exe-content .box{
  margin-top: 20px;
  border: 1px solid #dbdbdb;
}
.exe-content a{
  color: #5a7f0c;
}
.exe-content a:hover,
.exe-content a:focus{
  color: #71a300;
}
.exe-content h2{ font-size: 1.45em; }
.exe-content h3{ font-size: 1.35em; }
.exe-content h4{ font-size: 1.25em; }
.exe-content h5{ font-size: 1.15em; }

/* iDevice styles */
.iDevice_wrapper {
  margin-bottom: 25px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: #fff;
}
.iDevice_content {
  line-height: 1.8;
}
.iDevice_content img {
  max-width: 100%;
  height: auto;
}

/* Navigation */
#siteNav {
  background: #34495e;
  color: #fff;
  padding: 15px 20px;
  min-width: 220px;
}
#siteNav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
#siteNav li {
  margin: 5px 0;
}
#siteNav a {
  color: #ecf0f1;
  text-decoration: none;
  display: block;
  padding: 5px 10px;
  border-radius: 4px;
}
#siteNav a:hover {
  background: rgba(255,255,255,0.1);
}
#siteNav .active > a,
#siteNav a.active {
  background: #3498db;
  font-weight: bold;
}
#siteNav ul ul {
  padding-left: 15px;
}

/* Pagination */
.pagination {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}
.pagination a {
  color: #3498db;
  text-decoration: none;
}
.pagination a:hover {
  text-decoration: underline;
}

/* Footer */
#packageLicense {
  margin-top: 30px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9em;
  color: #666;
}

/* Responsive */
@media (min-width: 768px) {
  .exe-content {
    display: flex;
    flex-direction: row;
  }
  #siteNav {
    width: 250px;
    flex-shrink: 0;
  }
  main.page {
    flex: 1;
    padding: 20px 30px;
    max-width: 900px;
  }
}
`;
  }

  /**
   * Get fallback theme CSS
   * @returns {string}
   */
  getFallbackThemeCss() {
    return `/* Default theme CSS */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}
`;
  }

  /**
   * Get fallback theme JS
   * @returns {string}
   */
  getFallbackThemeJs() {
    return `// Default theme JS
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Theme initialization
    Logger.log('[Theme] Default theme loaded');
  });
})();
`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Html5Exporter;
} else {
  window.Html5Exporter = Html5Exporter;
}
