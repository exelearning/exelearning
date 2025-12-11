/**
 * PreviewExporter
 * Generates HTML for client-side preview without creating a ZIP file.
 * Opens the preview in a new browser window/tab.
 *
 * Key differences from PageExporter/Html5Exporter:
 * - Returns HTML string instead of ZIP blob
 * - Uses blob:// URLs for assets (from AssetManager cache)
 * - References theme/libs from server via absolute URLs
 * - Single-page with anchor navigation
 *
 * @extends Html5Exporter
 */
class PreviewExporter extends Html5Exporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager (optional)
   * @param {ResourceFetcher} resourceFetcher - Resource fetcher (optional)
   * @param {AssetManager} assetManager - AssetManager for blob URL resolution
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null, assetManager = null) {
    super(documentManager, assetCacheManager, resourceFetcher);
    this.assetManager = assetManager;
  }

  /**
   * Get versioned asset path for server resources
   * Uses basePath and version for cache busting: {basePath}/{version}/path
   * @param {string} path - The resource path (e.g., '/libs/bootstrap.css')
   * @returns {string} - Versioned URL (e.g., '/web/exelearning/v1.0.0/libs/bootstrap.css')
   */
  getVersionedPath(path) {
    const basePath = window.eXeLearning?.symfony?.basePath || '';
    const version = window.eXeLearning?.version || 'v1.0.0';
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${basePath}/${version}/${cleanPath}`;
  }

  /**
   * Generate preview HTML and open in new window
   * @returns {Promise<{success: boolean, window?: Window, error?: string}>}
   */
  async preview() {
    Logger.log('[PreviewExporter] Starting preview generation...');

    try {
      // 1. Preload all assets to blob cache
      if (this.assetManager) {
        Logger.log('[PreviewExporter] Preloading assets to blob cache...');
        await this.assetManager.preloadAllAssets();
      }

      // 2. Build page list and metadata
      let pages = this.buildPageList();
      const meta = this.getMetadata();

      // Pre-process pages: add filenames to asset URLs
      // This is critical for correct asset path resolution
      Logger.log('[PreviewExporter] Pre-processing asset URLs...');
      pages = await this.preprocessPagesForExport(pages);

      const usedIdevices = this.getUsedIdevices(pages);

      Logger.log(`[PreviewExporter] Generating preview for ${pages.length} pages...`);

      // 3. Generate full HTML with preview mode
      let html = this.generatePreviewHtml(pages, meta, usedIdevices);

      // 4. Resolve asset:// URLs to blob:// URLs
      // asset:// URLs are preserved by IdeviceHtmlRenderer in preview mode
      // and will be resolved to blob:// URLs by AssetManager
      if (this.assetManager) {
        Logger.log('[PreviewExporter] Resolving asset URLs to blob URLs...');
        html = this.assetManager.resolveHTMLAssetsSync(html, {
          usePlaceholder: true,
          addTracking: false,
        });
      }

      // 5. Open in new window
      Logger.log('[PreviewExporter] Opening preview window...');
      const previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        throw new Error('Popup bloqueado. Por favor permita popups para este sitio.');
      }

      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();

      Logger.log('[PreviewExporter] Preview opened successfully');
      return { success: true, window: previewWindow };
    } catch (error) {
      console.error('[PreviewExporter] Preview failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate complete HTML for preview with server-relative paths
   * @param {Array} pages - All pages from buildPageList()
   * @param {Y.Map} meta - Project metadata
   * @param {string[]} usedIdevices - List of used iDevice types
   * @returns {string}
   */
  generatePreviewHtml(pages, meta, usedIdevices) {
    const lang = meta.get('language') || 'en';
    const projectTitle = meta.get('title') || 'eXeLearning';
    const customStyles = meta.get('customStyles') || '';
    const author = meta.get('author') || '';
    const license = meta.get('license') || 'CC-BY-SA';
    const themeName = meta.get('theme') || 'base';

    // Generate content for all pages
    let contentHtml = '';
    for (const page of pages) {
      contentHtml += this.renderPreviewPageSection(page);
    }

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generatePreviewHead(themeName, usedIdevices, projectTitle, customStyles)}
</head>
<body class="exe-export exe-single-page exe-preview" lang="${lang}">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js">
${this.renderPreviewNav(pages)}
<main class="single-page-content">
${contentHtml}
</main>
${this.renderPreviewFooter(author, license)}
</div>
${this.generatePreviewScripts(themeName, usedIdevices)}
</body>
</html>`;
  }

  /**
   * Generate <head> content with absolute server paths
   * @param {string} themeName
   * @param {string[]} usedIdevices
   * @param {string} projectTitle
   * @param {string} customStyles
   * @returns {string}
   */
  generatePreviewHead(themeName, usedIdevices, projectTitle, customStyles) {
    // Use versioned paths for cache busting
    const bootstrapCss = this.getVersionedPath('/libs/bootstrap/bootstrap.min.css');
    const themeCss = this.getVersionedPath(`/files/perm/themes/base/${themeName}/content.css`);
    const fallbackCss = this.getVersionedPath('/style/content.css');

    let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Preview</title>
<script>document.querySelector("html").classList.add("js");</script>

<!-- Server-hosted libraries (versioned paths) -->
<link rel="stylesheet" href="${bootstrapCss}">

<!-- Theme from server -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">

<!-- Base CSS (inline for preview) -->
<style>
${this.getBaseCss()}
${this.getPreviewCss()}
</style>`;

    // iDevice CSS from server
    const seen = new Set();
    for (const idevice of usedIdevices) {
      // Normalize iDevice type name
      let typeName = idevice.toLowerCase();
      // Remove common suffixes
      typeName = typeName.replace(/idevice$/i, '').replace(/-idevice$/i, '');
      // Map common types
      const typeMap = {
        'freetext': 'text',
        'text': 'text',
        'freetextidevice': 'text',
        'textidevice': 'text',
      };
      typeName = typeMap[typeName] || typeName || 'text';

      if (!seen.has(typeName)) {
        seen.add(typeName);
        const ideviceCss = this.getVersionedPath(`/files/perm/idevices/base/${typeName}/export/${typeName}.css`);
        head += `\n<link rel="stylesheet" href="${ideviceCss}" onerror="this.remove()">`;
      }
    }

    // Custom styles
    if (customStyles) {
      head += `\n<style>\n${customStyles}\n</style>`;
    }

    return head;
  }

  /**
   * Render a page section for preview
   * @param {Object} page
   * @returns {string}
   */
  renderPreviewPageSection(page) {
    let blockHtml = '';

    // Use versioned path for iDevice resources in preview
    // This ensures data-idevice-path is an absolute URL that works from about:blank
    const ideviceBasePath = this.getVersionedPath('/files/perm/idevices/base/');

    // Render blocks and components
    for (const block of page.blocks || []) {
      blockHtml += this.ideviceRenderer.renderBlock(block, {
        basePath: ideviceBasePath,
        includeDataAttributes: true,
      });
    }

    return `<section id="section-${page.id}" class="single-page-section">
<header class="page-header">
<h2 class="page-title">${this.escapeHtml(page.title)}</h2>
</header>
<div class="page-content">
${blockHtml}
</div>
</section>
`;
  }

  /**
   * Render navigation with anchor links for preview
   * @param {Array} pages
   * @returns {string}
   */
  renderPreviewNav(pages) {
    const rootPages = pages.filter(p => !p.parentId);

    let html = '<nav id="siteNav" class="single-page-nav">\n<ul>\n';
    for (const page of rootPages) {
      html += this.renderPreviewNavItem(page, pages);
    }
    html += '</ul>\n</nav>';

    return html;
  }

  /**
   * Render a navigation item for preview
   * @param {Object} page
   * @param {Array} allPages
   * @returns {string}
   */
  renderPreviewNavItem(page, allPages) {
    const children = allPages.filter(p => p.parentId === page.id);
    const hasChildren = children.length > 0;

    let html = '<li>';
    html += ` <a href="#section-${page.id}" class="${hasChildren ? 'daddy' : 'no-ch'}">${this.escapeHtml(page.title)}</a>\n`;

    if (hasChildren) {
      html += '<ul class="other-section">\n';
      for (const child of children) {
        html += this.renderPreviewNavItem(child, allPages);
      }
      html += '</ul>\n';
    }

    html += '</li>\n';
    return html;
  }

  /**
   * Generate scripts with absolute server paths
   * @param {string} themeName
   * @param {string[]} usedIdevices - List of used iDevice types
   * @returns {string}
   */
  generatePreviewScripts(themeName, usedIdevices = []) {
    // Use versioned paths for cache busting
    const jqueryJs = this.getVersionedPath('/libs/jquery/jquery.min.js');
    const bootstrapJs = this.getVersionedPath('/libs/bootstrap/bootstrap.bundle.min.js');
    const commonI18nJs = this.getVersionedPath('/app/common/common_i18n.js');
    const commonJs = this.getVersionedPath('/app/common/common.js');
    const themeJs = this.getVersionedPath(`/files/perm/themes/base/${themeName}/content.js`);

    // Generate iDevice-specific scripts (like Html5Exporter does)
    // Each iDevice export script has a self-init pattern that calls init() on jQuery ready
    let ideviceScripts = '';
    const seen = new Set();
    for (const idevice of usedIdevices) {
      // Normalize iDevice type name
      let typeName = idevice.toLowerCase();
      // Remove common suffixes
      typeName = typeName.replace(/idevice$/i, '').replace(/-idevice$/i, '');
      // Map common types
      const typeMap = {
        'freetext': 'text',
        'text': 'text',
        'freetextidevice': 'text',
        'textidevice': 'text',
      };
      typeName = typeMap[typeName] || typeName || 'text';

      if (!seen.has(typeName)) {
        seen.add(typeName);
        const ideviceJs = this.getVersionedPath(`/files/perm/idevices/base/${typeName}/export/${typeName}.js`);
        ideviceScripts += `\n<script src="${ideviceJs}" onerror=""></script>`;
      }
    }

    return `<script src="${jqueryJs}"></script>
<script src="${bootstrapJs}"></script>
<script src="${commonI18nJs}" onerror=""></script>
<script src="${commonJs}" onerror=""></script>${ideviceScripts}
<script src="${themeJs}" onerror=""></script>
<script>
// Preview-specific initialization
document.addEventListener('DOMContentLoaded', function() {
  Logger.log('[Preview] Initialized');
  // Mark preview mode
  document.body.classList.add('exe-preview-mode');
});
</script>`;
  }

  /**
   * Render footer for preview
   * @param {string} author
   * @param {string} license
   * @returns {string}
   */
  renderPreviewFooter(author, license) {
    let html = '<footer id="packageLicense" class="cc cc-by-sa">';
    if (author) {
      html += `\n<p><span>Author:</span> ${this.escapeHtml(author)}</p>`;
    }
    html += `\n<p><span>License:</span> ${this.escapeHtml(license)}</p>`;
    html += '\n<p class="preview-notice"><em>Preview Mode - Content may differ from final export</em></p>';
    html += '\n</footer>';
    return html;
  }

  /**
   * Get CSS specific to preview mode
   * @returns {string}
   */
  getPreviewCss() {
    return `/* Preview-specific styles */
.exe-preview .preview-notice {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 0.85em;
}

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

/* Section target offset */
.single-page-section:target {
  scroll-margin-top: 20px;
}

/* Responsive */
@media (max-width: 768px) {
  .exe-single-page .single-page-nav {
    position: relative;
    max-height: none;
  }
}
`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PreviewExporter;
} else {
  window.PreviewExporter = PreviewExporter;
}
