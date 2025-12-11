/**
 * ImsExporter
 * Exports a Yjs document to IMS Content Package format (ZIP).
 *
 * IMS CP export creates:
 * - imsmanifest.xml (IMS CP manifest)
 * - index.html (first page)
 * - html/*.html (other pages)
 * - libs/ (JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 *
 * @extends Html5Exporter
 */

// Get generator (works in both browser and Node.js)
const _ImsManifestGenerator =
  typeof ImsManifestGenerator !== 'undefined'
    ? ImsManifestGenerator
    : typeof require !== 'undefined'
      ? require('./generators/ImsManifestGenerator')
      : null;

class ImsExporter extends Html5Exporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   * @param {ResourceFetcher} resourceFetcher - Resource fetcher for server resources
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null) {
    super(documentManager, assetCacheManager, resourceFetcher);

    // Initialize IMS-specific generator
    this.manifestGenerator = null;
  }

  /**
   * Get file extension for IMS CP format
   * @returns {string}
   */
  getFileExtension() {
    return '.zip';
  }

  /**
   * Get file suffix for IMS CP format
   * @returns {string}
   */
  getFileSuffix() {
    return '_ims';
  }

  /**
   * Export to IMS CP ZIP file and trigger download
   * @param {string} filename - Optional filename override
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async export(filename = null) {
    const exportFilename = filename || this.buildFilename();
    Logger.log(`[ImsExporter] Exporting to ${exportFilename}...`);

    try {
      const zip = this.createZip();
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.get('theme') || 'base';
      const projectId = this.generateProjectId();

      // Pre-process pages: add filenames to asset URLs
      Logger.log('[ImsExporter] Pre-processing asset URLs...');
      pages = await this.preprocessPagesForExport(pages);

      // Initialize manifest generator
      this.manifestGenerator = new _ImsManifestGenerator(projectId, pages, {
        title: meta.get('title') || 'eXeLearning',
        language: meta.get('language') || 'en',
        author: meta.get('author') || '',
        description: meta.get('description') || '',
        license: meta.get('license') || '',
      });

      // Track files for manifest
      const commonFiles = [];
      const pageFiles = {};

      // 1. Generate HTML pages
      Logger.log(`[ImsExporter] Generating ${pages.length} HTML pages...`);
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const html = this.generateImsPageHtml(page, pages, meta);
        const isIndex = i === 0;
        const pageFilename = isIndex ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
        zip.file(pageFilename, html);

        pageFiles[page.id] = {
          fileUrl: pageFilename,
          files: [],
        };
      }

      // 2. Add base CSS
      Logger.log('[ImsExporter] Adding base CSS...');
      zip.file('content/css/base.css', this.getBaseCss());
      commonFiles.push('content/css/base.css');

      // 3. Fetch and add theme
      if (this.resourceFetcher) {
        Logger.log(`[ImsExporter] Fetching theme: ${themeName}...`);
        try {
          const themeFiles = await this.resourceFetcher.fetchTheme(themeName);
          for (const [path, content] of themeFiles) {
            zip.file(`theme/${path}`, content);
            commonFiles.push(`theme/${path}`);
          }
        } catch (e) {
          console.warn(`[ImsExporter] Could not load theme ${themeName}:`, e);
          zip.file('theme/content.css', this.getFallbackThemeCss());
          zip.file('theme/default.js', this.getFallbackThemeJs());
          commonFiles.push('theme/content.css', 'theme/default.js');
        }

        // 4. Fetch and add base libraries
        Logger.log('[ImsExporter] Fetching base libraries...');
        try {
          const baseLibs = await this.resourceFetcher.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            zip.file(`libs/${path}`, content);
            commonFiles.push(`libs/${path}`);
          }
        } catch (e) {
          console.warn('[ImsExporter] Could not load base libraries:', e);
        }

        // 5. Fetch and add iDevice assets
        const usedIdevices = this.getUsedIdevices(pages);
        if (usedIdevices.length > 0) {
          Logger.log(`[ImsExporter] Fetching iDevice assets: ${usedIdevices.join(', ')}...`);
          for (const idevice of usedIdevices) {
            try {
              const ideviceFiles = await this.resourceFetcher.fetchIdevice(idevice);
              for (const [path, content] of ideviceFiles) {
                zip.file(`idevices/${idevice}/${path}`, content);
                commonFiles.push(`idevices/${idevice}/${path}`);
              }
            } catch (e) {
              // Many iDevices don't have extra files
            }
          }
        }
      } else {
        zip.file('theme/content.css', this.getFallbackThemeCss());
        zip.file('theme/default.js', this.getFallbackThemeJs());
        commonFiles.push('theme/content.css', 'theme/default.js');
      }

      // 6. Add project assets from cache
      Logger.log('[ImsExporter] Adding project assets...');
      await this.addAssetsToZipWithResourcePath(zip);

      // 7. Generate imsmanifest.xml
      Logger.log('[ImsExporter] Generating imsmanifest.xml...');
      const manifestXml = this.manifestGenerator.generate({
        commonFiles,
        pageFiles,
      });
      zip.file('imsmanifest.xml', manifestXml);

      // 8. Generate and download ZIP
      Logger.log('[ImsExporter] Generating ZIP...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      this.downloadBlob(blob, exportFilename);

      Logger.log(`[ImsExporter] Export complete: ${exportFilename}`);
      return { success: true, filename: exportFilename };
    } catch (error) {
      console.error('[ImsExporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate project ID for IMS package
   * @returns {string}
   */
  generateProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Generate IMS CP HTML page (standard website, no SCORM)
   * @param {Object} page - Page data
   * @param {Array} allPages - All pages
   * @param {Y.Map} meta - Project metadata
   * @returns {string}
   */
  generateImsPageHtml(page, allPages, meta) {
    const lang = meta.get('language') || 'en';
    const projectTitle = meta.get('title') || 'eXeLearning';
    const customStyles = meta.get('customStyles') || '';
    const isIndex = allPages.indexOf(page) === 0;
    const basePath = isIndex ? '' : '../';
    const author = meta.get('author') || '';
    const license = meta.get('license') || 'CC-BY-SA';
    const usedIdevices = this.getUsedIdevicesForPage(page);

    // Use PageHtmlRenderer (no SCORM options)
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
      bodyClass: 'exe-web-site exe-ims',
    });
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImsExporter;
} else {
  window.ImsExporter = ImsExporter;
}
