/**
 * PageExporter
 * Exports a Yjs document to single-page HTML format (ZIP).
 * Generates a single index.html with all pages using anchor navigation.
 *
 * Single-page (HTML5SP) export creates:
 * - index.html (all pages in one document)
 * - libs/ (JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 *
 * @extends Html5Exporter
 */
class PageExporter extends Html5Exporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   * @param {ResourceFetcher} resourceFetcher - Resource fetcher for server resources
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null) {
    super(documentManager, assetCacheManager, resourceFetcher);
  }

  /**
   * Get file suffix for PAGE format
   * @returns {string}
   */
  getFileSuffix() {
    return '_page';
  }

  /**
   * Export to single-page HTML ZIP file and trigger download
   * @param {string} filename - Optional filename override
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async export(filename = null) {
    const exportFilename = filename || this.buildFilename();
    Logger.log(`[PageExporter] Exporting to ${exportFilename}...`);

    try {
      const zip = this.createZip();
      const pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.get('theme') || 'base';

      // Get all iDevice types used in the project
      const usedIdevices = this.getUsedIdevices(pages);

      // 1. Generate single-page HTML with all content
      Logger.log(`[PageExporter] Generating single-page HTML with ${pages.length} pages...`);
      const html = this.generateSinglePageHtml(pages, meta, usedIdevices);
      zip.file('index.html', html);

      // 2. Add content.xml (ODE format for re-import)
      Logger.log('[PageExporter] Generating content.xml...');
      const contentXml = this.generateContentXml();
      zip.file('content.xml', contentXml);

      // 3. Add base CSS
      Logger.log('[PageExporter] Adding base CSS...');
      zip.file('content/css/base.css', this.getBaseCss());
      zip.file('content/css/single-page.css', this.getSinglePageCss());

      // 4. Fetch and add theme if resourceFetcher is available
      if (this.resourceFetcher) {
        Logger.log(`[PageExporter] Fetching theme: ${themeName}...`);
        try {
          const themeFiles = await this.resourceFetcher.fetchTheme(themeName);
          for (const [path, content] of themeFiles) {
            zip.file(`theme/${path}`, content);
          }
        } catch (e) {
          console.warn(`[PageExporter] Could not load theme ${themeName}:`, e);
          zip.file('theme/content.css', this.getFallbackThemeCss());
          zip.file('theme/default.js', this.getFallbackThemeJs());
        }

        // 5. Fetch and add base libraries
        Logger.log('[PageExporter] Fetching base libraries...');
        try {
          const baseLibs = await this.resourceFetcher.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            zip.file(`libs/${path}`, content);
          }
        } catch (e) {
          console.warn('[PageExporter] Could not load base libraries:', e);
        }

        // 6. Fetch and add iDevice assets
        if (usedIdevices.length > 0) {
          Logger.log(`[PageExporter] Fetching iDevice assets: ${usedIdevices.join(', ')}...`);
          for (const idevice of usedIdevices) {
            try {
              const ideviceFiles = await this.resourceFetcher.fetchIdevice(idevice);
              for (const [path, content] of ideviceFiles) {
                zip.file(`idevices/${idevice}/${path}`, content);
              }
            } catch (e) {
              // Many iDevices don't have extra files
            }
          }
        }
      } else {
        zip.file('theme/content.css', this.getFallbackThemeCss());
        zip.file('theme/default.js', this.getFallbackThemeJs());
      }

      // 7. Add project assets from cache
      Logger.log('[PageExporter] Adding project assets...');
      await this.addAssetsToZipWithResourcePath(zip);

      // 8. Generate and download ZIP
      Logger.log('[PageExporter] Generating ZIP...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      this.downloadBlob(blob, exportFilename);

      Logger.log(`[PageExporter] Export complete: ${exportFilename}`);
      return { success: true, filename: exportFilename };
    } catch (error) {
      console.error('[PageExporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate single-page HTML with all pages
   * @param {Array} pages - All pages from buildPageList()
   * @param {Y.Map} meta - Project metadata
   * @param {string[]} usedIdevices - List of used iDevice types
   * @returns {string}
   */
  generateSinglePageHtml(pages, meta, usedIdevices) {
    const lang = meta.get('language') || 'en';
    const projectTitle = meta.get('title') || 'eXeLearning';
    const customStyles = meta.get('customStyles') || '';
    const author = meta.get('author') || '';
    const license = meta.get('license') || 'CC-BY-SA';

    return this.pageRenderer.renderSinglePage(pages, {
      projectTitle,
      language: lang,
      customStyles,
      usedIdevices,
      author,
      license,
    });
  }

  /**
   * Get CSS specific to single-page layout
   * @returns {string}
   */
  getSinglePageCss() {
    return `/* Single-page specific styles */
.exe-single-page .single-page-section {
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 40px;
  margin-bottom: 40px;
}

.exe-single-page .single-page-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.exe-single-page .single-page-nav {
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
}

.exe-single-page .single-page-content {
  padding: 20px 30px;
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Section target offset for fixed header */
.single-page-section:target {
  scroll-margin-top: 20px;
}

/* Print styles for single page */
@media print {
  .exe-single-page .single-page-nav {
    display: none;
  }
  .exe-single-page .single-page-section {
    page-break-inside: avoid;
  }
}
`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageExporter;
} else {
  window.PageExporter = PageExporter;
}
