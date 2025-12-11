/**
 * ElpxExporter
 * Exports a Yjs document to .elpx (ZIP) format.
 * Generates content.xml from the Y.Doc structure and packages assets.
 *
 * ELPX is the native eXeLearning project format - a ZIP containing:
 * - content.xml (ODE format describing structure)
 * - Assets (images, media files)
 * - Optionally: HTML pages, theme, libs (when includeHtml option is true)
 *
 * @extends BaseExporter
 */
class ElpxExporter extends BaseExporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   * @param {ResourceFetcher} resourceFetcher - Optional resource fetcher for HTML export
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null) {
    super(documentManager, assetCacheManager, resourceFetcher);

    // Initialize renderers for HTML generation
    this.ideviceRenderer = new IdeviceHtmlRenderer(resourceFetcher);
    this.pageRenderer = new PageHtmlRenderer(this.ideviceRenderer);
  }

  /**
   * Get file extension for ELPX format
   * @returns {string}
   */
  getFileExtension() {
    return '.elpx';
  }

  /**
   * Get file suffix for ELPX format (no suffix)
   * @returns {string}
   */
  getFileSuffix() {
    return '';
  }

  /**
   * Export to .elpx file and trigger download
   * @param {string} filename - Optional filename override
   * @param {Object} options - Export options
   * @param {boolean} options.includeHtml - Include HTML pages in export (default: true)
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async export(filename = null, options = {}) {
    const { includeHtml = true } = options;
    const exportFilename = filename || this.buildFilename();
    Logger.log(`[ElpxExporter] Exporting to ${exportFilename}...`);

    try {
      const zip = this.createZip();
      let pages = this.buildPageList();
      const meta = this.getMetadata();

      // Generate content.xml (before preprocessing - keeps original asset:// URLs)
      const contentXml = this.generateContentXml();
      zip.file('content.xml', contentXml);

      // Add assets from cache
      await this.addAssetsToZip(zip);

      // Optionally include HTML pages and resources
      if (includeHtml) {
        // Pre-process pages: add filenames to asset URLs for HTML export
        Logger.log('[ElpxExporter] Pre-processing asset URLs...');
        pages = await this.preprocessPagesForExport(pages);
        await this.addHtmlContent(zip, pages, meta);
      }

      // Generate ZIP blob
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Trigger download
      this.downloadBlob(blob, exportFilename);

      Logger.log(`[ElpxExporter] Export complete: ${exportFilename}`);
      return { success: true, filename: exportFilename };
    } catch (error) {
      console.error('[ElpxExporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Export to Blob (for programmatic use)
   * @returns {Promise<Blob>}
   */
  async exportToBlob() {
    const zip = this.createZip();

    // Generate content.xml
    const contentXml = this.generateContentXml();
    zip.file('content.xml', contentXml);

    // Add assets
    await this.addAssetsToZip(zip);

    return zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  // Legacy method name for backwards compatibility
  async exportToFile(filename = null) {
    return this.export(filename);
  }

  // =========================================================================
  // HTML Content Generation (for ELPX with embedded HTML)
  // =========================================================================

  /**
   * Add HTML pages and resources to the ZIP
   * @param {JSZip} zip - The ZIP file
   * @param {Array} pages - List of pages from buildPageList()
   * @param {Y.Map} meta - Project metadata
   */
  async addHtmlContent(zip, pages, meta) {
    Logger.log(`[ElpxExporter] Generating ${pages.length} HTML pages...`);

    const lang = meta.get('language') || 'en';
    const projectTitle = meta.get('title') || 'eXeLearning';
    const customStyles = meta.get('customStyles') || '';
    const author = meta.get('author') || '';
    const license = meta.get('license') || 'CC-BY-SA';
    const themeName = meta.get('theme') || 'base';

    // Collect all used iDevice types
    const allUsedIdevices = this.getUsedIdevices(pages);

    // Generate HTML for each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const isIndex = i === 0;
      const basePath = isIndex ? '' : '../';
      const usedIdevices = this.getUsedIdevicesForPage(page);

      const html = this.pageRenderer.render(page, {
        projectTitle,
        language: lang,
        theme: themeName,
        customStyles,
        allPages: pages,
        basePath,
        isIndex,
        usedIdevices,
        author,
        license,
      });

      // First page is index.html, others go in html/ directory
      const pageFilename = isIndex ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
      zip.file(pageFilename, html);
    }

    // Add base CSS
    zip.file('content/css/base.css', this.getBaseCss());

    // Add theme and iDevice files if resourceFetcher is available
    if (this.resourceFetcher) {
      await this.addThemeAndLibs(zip, themeName, allUsedIdevices);
    } else {
      // Add fallback styles
      zip.file('theme/content.css', this.getFallbackThemeCss());
      zip.file('theme/default.js', this.getFallbackThemeJs());
    }
  }

  /**
   * Add theme, libraries, and iDevice files to ZIP
   * @param {JSZip} zip
   * @param {string} themeName
   * @param {string[]} usedIdevices
   */
  async addThemeAndLibs(zip, themeName, usedIdevices) {
    // Fetch and add theme
    try {
      Logger.log(`[ElpxExporter] Fetching theme: ${themeName}...`);
      const themeFiles = await this.resourceFetcher.fetchTheme(themeName);
      for (const [path, content] of themeFiles) {
        zip.file(`theme/${path}`, content);
      }
    } catch (e) {
      console.warn(`[ElpxExporter] Could not load theme ${themeName}:`, e);
      zip.file('theme/content.css', this.getFallbackThemeCss());
      zip.file('theme/default.js', this.getFallbackThemeJs());
    }

    // Fetch and add base libraries
    try {
      Logger.log('[ElpxExporter] Fetching base libraries...');
      const baseLibs = await this.resourceFetcher.fetchBaseLibraries();
      for (const [path, content] of baseLibs) {
        zip.file(`libs/${path}`, content);
      }
    } catch (e) {
      console.warn('[ElpxExporter] Could not load base libraries:', e);
    }

    // Fetch and add iDevice assets
    if (usedIdevices.length > 0) {
      Logger.log(`[ElpxExporter] Fetching iDevice assets: ${usedIdevices.join(', ')}...`);
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
  }

  /**
   * Get list of unique iDevice types used in a page
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

  /**
   * Get base CSS content
   * @returns {string}
   */
  getBaseCss() {
    return `.exe-content{background:#fff}.exe-content .page-title{font-size:1.45em}
.exe-content .box{margin-top:20px;border:1px solid #dbdbdb}
.exe-content a{color:#5a7f0c}.exe-content a:hover{color:#71a300}
.iDevice_wrapper{margin-bottom:25px;border:1px solid #e0e0e0;border-radius:8px;padding:20px;background:#fff}
.iDevice_content{line-height:1.8}.iDevice_content img{max-width:100%;height:auto}
#siteNav{background:#34495e;color:#fff;padding:15px 20px;min-width:220px}
#siteNav ul{list-style:none;margin:0;padding:0}#siteNav li{margin:5px 0}
#siteNav a{color:#ecf0f1;text-decoration:none;display:block;padding:5px 10px;border-radius:4px}
#siteNav a:hover{background:rgba(255,255,255,0.1)}
#siteNav .active>a,#siteNav a.active{background:#3498db;font-weight:bold}
.pagination{margin-top:30px;padding-top:20px;border-top:1px solid #e0e0e0}
#packageLicense{margin-top:30px;padding:15px;background:#f8f9fa;border-radius:4px;font-size:0.9em;color:#666}
@media(min-width:768px){.exe-content{display:flex}#siteNav{width:250px;flex-shrink:0}main.page{flex:1;padding:20px 30px;max-width:900px}}`;
  }

  /**
   * Get fallback theme CSS
   * @returns {string}
   */
  getFallbackThemeCss() {
    return `body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:0;line-height:1.6}`;
  }

  /**
   * Get fallback theme JS
   * @returns {string}
   */
  getFallbackThemeJs() {
    return `(function(){document.addEventListener('DOMContentLoaded',function(){Logger.log('[Theme] Default theme loaded')})})();`;
  }

  // =========================================================================
  // Content XML Generation
  // =========================================================================

  /**
   * Generate content.xml from Y.Doc
   * @returns {string}
   */
  generateContentXml() {
    const metadata = this.getMetadata();
    const navigation = this.getNavigation();

    // Build XML document
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';

    // Add odeProperties
    xml += this.generatePropertiesXml(metadata);

    // Add odeNavStructures (pages)
    xml += '<odeNavStructures>\n';
    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      xml += this.generatePageXml(pageMap, i);
    }
    xml += '</odeNavStructures>\n';

    xml += '</ode>';

    return xml;
  }

  /**
   * Generate odeProperties XML
   * @param {Y.Map} metadata
   * @returns {string}
   */
  generatePropertiesXml(metadata) {
    let xml = '<odeProperties>\n';

    const props = {
      pp_title: metadata.get('title') || 'Untitled',
      pp_author: metadata.get('author') || '',
      pp_lang: metadata.get('language') || 'en',
      pp_description: metadata.get('description') || '',
      pp_license: metadata.get('license') || '',
      pp_createdAt: metadata.get('createdAt') || new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(props)) {
      xml += `  <${key}>${this.escapeXml(value)}</${key}>\n`;
    }

    xml += '</odeProperties>\n';
    return xml;
  }

  /**
   * Generate XML for a single page (odeNavStructure)
   * @param {Y.Map} pageMap
   * @param {number} index
   * @returns {string}
   */
  generatePageXml(pageMap, index) {
    const pageId = pageMap.get('id') || pageMap.get('pageId');
    const pageName = pageMap.get('pageName') || 'Page';
    const parentId = pageMap.get('parentId') || '';
    const order = pageMap.get('order') ?? index;

    let xml = `<odeNavStructure `;
    xml += `odeNavStructureId="${this.escapeXml(pageId)}" `;
    xml += `odePageName="${this.escapeXml(pageName)}" `;
    xml += `odeNavStructureOrder="${order}" `;
    if (parentId) {
      xml += `parentOdeNavStructureId="${this.escapeXml(parentId)}" `;
    }
    xml += `>\n`;

    // Add blocks
    const blocks = pageMap.get('blocks');
    if (blocks) {
      for (let i = 0; i < blocks.length; i++) {
        const blockMap = blocks.get(i);
        xml += this.generateBlockXml(blockMap, i);
      }
    }

    xml += '</odeNavStructure>\n';
    return xml;
  }

  /**
   * Generate XML for a single block (odePagStructure)
   * @param {Y.Map} blockMap
   * @param {number} index
   * @returns {string}
   */
  generateBlockXml(blockMap, index) {
    const blockId = blockMap.get('id') || blockMap.get('blockId');
    const blockName = blockMap.get('blockName') || 'Block';
    const order = blockMap.get('order') ?? index;

    let xml = `  <odePagStructure `;
    xml += `odePagStructureId="${this.escapeXml(blockId)}" `;
    xml += `blockName="${this.escapeXml(blockName)}" `;
    xml += `odePagStructureOrder="${order}" `;
    xml += `>\n`;

    // Add components
    const components = blockMap.get('components');
    if (components) {
      for (let i = 0; i < components.length; i++) {
        const compMap = components.get(i);
        xml += this.generateComponentXml(compMap, i);
      }
    }

    xml += '  </odePagStructure>\n';
    return xml;
  }

  /**
   * Generate XML for a single component (odeComponent)
   * @param {Y.Map} compMap
   * @param {number} index
   * @returns {string}
   */
  generateComponentXml(compMap, index) {
    const compId = compMap.get('id') || compMap.get('ideviceId');
    const ideviceType = compMap.get('ideviceType') || 'FreeTextIdevice';
    const order = compMap.get('order') ?? index;

    let xml = `    <odeComponent `;
    xml += `odeComponentId="${this.escapeXml(compId)}" `;
    xml += `odeIdeviceTypeDirName="${this.escapeXml(ideviceType)}" `;
    xml += `odeComponentOrder="${order}" `;
    xml += `>\n`;

    // Add HTML content
    const htmlContent = compMap.get('htmlContent');
    if (htmlContent) {
      const content = htmlContent.toString ? htmlContent.toString() : String(htmlContent);
      xml += `      <htmlView><![CDATA[${content}]]></htmlView>\n`;
    }

    // Add JSON properties
    const properties = compMap.get('properties');
    if (properties) {
      const propsObj = {};
      properties.forEach((value, key) => {
        propsObj[key] = value;
      });
      xml += `      <jsonProperties><![CDATA[${JSON.stringify(propsObj)}]]></jsonProperties>\n`;
    }

    // Add individual properties
    compMap.forEach((value, key) => {
      if (key.startsWith('prop_')) {
        const propKey = key.substring(5);
        xml += `      <odeComponentProperty key="${this.escapeXml(propKey)}">${this.escapeXml(String(value))}</odeComponentProperty>\n`;
      }
    });

    xml += '    </odeComponent>\n';
    return xml;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ElpxExporter;
} else {
  window.ElpxExporter = ElpxExporter;
}
