/**
 * Client-side Exporters for eXeLearning
 *
 * This module provides client-side export functionality for Yjs-based projects.
 * All exports run entirely in the browser, offloading work from the server.
 *
 * Load Order (important!):
 *   1. BaseExporter.js (base class)
 *   2. ResourceFetcher.js (resource loading)
 *   3. Renderers (IdeviceHtmlRenderer, PageHtmlRenderer)
 *   4. Generators (Scorm12ManifestGenerator, Scorm2004ManifestGenerator, ImsManifestGenerator, LomMetadataGenerator)
 *   5. Individual exporters (ElpxExporter, Html5Exporter, etc.)
 *
 * Usage:
 *   const exporter = new Html5Exporter(documentManager, assetCache, resourceFetcher);
 *   await exporter.export();
 *
 * Available Exporters:
 *   - ElpxExporter: Native .elpx format
 *   - Html5Exporter: HTML5 website (.zip)
 *   - PageExporter: Single-page HTML5
 *   - Scorm12Exporter: SCORM 1.2 package
 *   - Scorm2004Exporter: SCORM 2004 package
 *   - ImsExporter: IMS Content Package
 *   - Epub3Exporter: EPUB3 ebook
 *   - ComponentExporter: Single iDevice/block (.idevice.elp / .block.elp)
 *
 * Available Renderers:
 *   - IdeviceHtmlRenderer: Renders iDevice components to HTML
 *   - PageHtmlRenderer: Renders complete HTML pages
 *
 * Available Generators:
 *   - Scorm12ManifestGenerator: Generates imsmanifest.xml for SCORM 1.2
 *   - Scorm2004ManifestGenerator: Generates imsmanifest.xml for SCORM 2004
 *   - ImsManifestGenerator: Generates imsmanifest.xml for IMS CP
 *   - LomMetadataGenerator: Generates imslrm.xml (LOM metadata)
 */

// Export classes to window for browser use
if (typeof window !== 'undefined') {
  window.Exporters = {
    // Base classes
    BaseExporter: window.BaseExporter,
    ResourceFetcher: window.ResourceFetcher,

    // Renderers
    IdeviceHtmlRenderer: window.IdeviceHtmlRenderer,
    PageHtmlRenderer: window.PageHtmlRenderer,

    // Generators
    Scorm12ManifestGenerator: window.Scorm12ManifestGenerator,
    Scorm2004ManifestGenerator: window.Scorm2004ManifestGenerator,
    ImsManifestGenerator: window.ImsManifestGenerator,
    LomMetadataGenerator: window.LomMetadataGenerator,

    // Exporters
    ElpxExporter: window.ElpxExporter,
    Html5Exporter: window.Html5Exporter,
    PageExporter: window.PageExporter,
    Scorm12Exporter: window.Scorm12Exporter,
    Scorm2004Exporter: window.Scorm2004Exporter,
    ImsExporter: window.ImsExporter,
    Epub3Exporter: window.Epub3Exporter,
    PreviewExporter: window.PreviewExporter,
    WebsitePreviewExporter: window.WebsitePreviewExporter,
    ComponentExporter: window.ComponentExporter,
  };

  /**
   * Factory function to create the appropriate exporter
   * @param {string} format - Export format (ELPX, HTML5, PAGE, SCORM12, IMS, EPUB3)
   * @param {YjsDocumentManager} documentManager
   * @param {AssetCacheManager} assetCache
   * @param {ResourceFetcher} resourceFetcher
   * @param {AssetManager} assetManager - Optional AssetManager for IndexedDB assets
   * @returns {BaseExporter}
   */
  window.createExporter = function(format, documentManager, assetCache, resourceFetcher, assetManager = null) {
    const normalizedFormat = format.toUpperCase().replace('-', '');
    let exporter;

    switch (normalizedFormat) {
      case 'ELPX':
      case 'ELP':
        exporter = new window.ElpxExporter(documentManager, assetCache, resourceFetcher);
        break;

      case 'HTML5':
      case 'WEB':
        exporter = new window.Html5Exporter(documentManager, assetCache, resourceFetcher);
        break;

      case 'PAGE':
      case 'HTML5SP':
        exporter = new window.PageExporter(documentManager, assetCache, resourceFetcher);
        break;

      case 'SCORM12':
      case 'SCORM':
        exporter = new window.Scorm12Exporter(documentManager, assetCache, resourceFetcher);
        break;

      case 'SCORM2004':
        exporter = new window.Scorm2004Exporter(documentManager, assetCache, resourceFetcher);
        break;

      case 'IMS':
      case 'IMSCP':
        exporter = new window.ImsExporter(documentManager, assetCache, resourceFetcher);
        break;

      case 'EPUB3':
      case 'EPUB':
        exporter = new window.Epub3Exporter(documentManager, assetCache, resourceFetcher);
        break;

      case 'PREVIEW':
        exporter = new window.PreviewExporter(documentManager, assetCache, resourceFetcher, assetManager);
        break;

      case 'WEBSITEPREVIEW':
      case 'WEBSITE_PREVIEW':
        exporter = new window.WebsitePreviewExporter(documentManager, assetCache, resourceFetcher, assetManager);
        break;

      case 'COMPONENT':
      case 'IDEVICE':
      case 'BLOCK':
        exporter = new window.ComponentExporter(documentManager, assetCache);
        break;

      default:
        throw new Error(`Unknown export format: ${format}`);
    }

    // Set AssetManager if provided
    if (assetManager && exporter.setAssetManager) {
      exporter.setAssetManager(assetManager);
    }

    return exporter;
  };

  Logger.log('[Exporters] Client-side exporters loaded');
}

// CommonJS exports for Node.js/testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Base classes
    BaseExporter: require('./BaseExporter'),
    ResourceFetcher: require('./ResourceFetcher'),

    // Renderers
    IdeviceHtmlRenderer: require('./renderers/IdeviceHtmlRenderer'),
    PageHtmlRenderer: require('./renderers/PageHtmlRenderer'),

    // Generators
    Scorm12ManifestGenerator: require('./generators/Scorm12ManifestGenerator'),
    LomMetadataGenerator: require('./generators/LomMetadataGenerator'),

    // Exporters
    ElpxExporter: require('./ElpxExporter'),
    Html5Exporter: require('./Html5Exporter'),
    PageExporter: require('./PageExporter'),
    Scorm12Exporter: require('./Scorm12Exporter'),
    PreviewExporter: require('./PreviewExporter'),
    ComponentExporter: require('./ComponentExporter'),
  };
}
