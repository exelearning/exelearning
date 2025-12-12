/**
 * WebsitePreviewExporter
 * Generates a multi-page SPA preview for client-side viewing.
 * Shows pages one at a time with navigation, similar to the exported website.
 *
 * Key differences from PreviewExporter:
 * - Shows one page at a time (not all pages in a single scroll)
 * - Navigation switches between pages via JavaScript (SPA-style)
 * - Layout matches the exported website (_site format)
 *
 * @extends Html5Exporter
 */
class WebsitePreviewExporter extends Html5Exporter {
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
   * For blob URLs in Electron, returns absolute URLs to ensure resources load correctly
   * @param {string} path - The resource path (e.g., '/libs/bootstrap.css')
   * @returns {string} - Versioned URL (e.g., 'http://localhost:3001/v1.0.0/libs/bootstrap.css')
   */
  getVersionedPath(path) {
    const basePath = window.eXeLearning?.symfony?.basePath || '';
    const version = window.eXeLearning?.version || 'v1.0.0';
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const relativePath = `${basePath}/${version}/${cleanPath}`;

    // For blob URLs in Electron, we need absolute URLs
    // Use eXeLearning.symfony.baseURL if available (more reliable), fallback to window.location.origin
    const baseURL = window.eXeLearning?.symfony?.baseURL || window.location.origin;
    return `${baseURL}${relativePath}`;
  }

  /**
   * Generate website preview and open in new window
   * @returns {Promise<{success: boolean, window?: Window, error?: string}>}
   */
  async preview() {
    Logger.log('[WebsitePreviewExporter] Starting website preview generation...');

    try {
      // 1. Preload all assets to blob cache
      if (this.assetManager) {
        Logger.log('[WebsitePreviewExporter] Preloading assets to blob cache...');
        await this.assetManager.preloadAllAssets();
      }

      // 2. Build page list and metadata
      let pages = this.buildPageList();
      const meta = this.getMetadata();

      // Pre-process pages: add filenames to asset URLs
      Logger.log('[WebsitePreviewExporter] Pre-processing asset URLs...');
      pages = await this.preprocessPagesForExport(pages);

      const usedIdevices = this.getUsedIdevices(pages);

      Logger.log(`[WebsitePreviewExporter] Generating website preview for ${pages.length} pages...`);

      // 3. Generate SPA HTML with all pages
      let html = this.generateWebsiteSpaHtml(pages, meta, usedIdevices);

      // 4. Resolve asset:// URLs to blob:// URLs
      // asset:// URLs are preserved by IdeviceHtmlRenderer in preview mode
      // and will be resolved to blob:// URLs by AssetManager
      if (this.assetManager) {
        Logger.log('[WebsitePreviewExporter] Resolving asset URLs to blob URLs...');
        html = this.assetManager.resolveHTMLAssetsSync(html, {
          usePlaceholder: true,
          addTracking: false,
        });
      }

      // 5. Open in new window using document.write (avoids Malwarebytes false positives with createObjectURL)
      Logger.log('[WebsitePreviewExporter] Opening preview window...');

      // In Electron, window.open() may return null even if the window was created
      // because the setWindowOpenHandler returns { action: 'deny' } after manually creating the window
      const isElectron = !!(window.electronAPI || (typeof process !== 'undefined' && process.versions?.electron));

      // Open a blank window first, then write content to it
      // This avoids using URL.createObjectURL which triggers security software false positives
      const previewWindow = window.open('about:blank', '_blank');

      if (!previewWindow && !isElectron) {
        throw new Error('Popup bloqueado. Por favor permita popups para este sitio.');
      }

      // Write the HTML content directly to the new window
      if (previewWindow) {
        previewWindow.document.open();
        previewWindow.document.write(html);
        previewWindow.document.close();
      }

      Logger.log('[WebsitePreviewExporter] Preview opened successfully');
      return { success: true, window: previewWindow };
    } catch (error) {
      console.error('[WebsitePreviewExporter] Preview failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate complete SPA HTML with all pages
   * @param {Array} pages - All pages from buildPageList()
   * @param {Y.Map} meta - Project metadata
   * @param {string[]} usedIdevices - List of used iDevice types
   * @returns {string}
   */
  generateWebsiteSpaHtml(pages, meta, usedIdevices) {
    const lang = meta.get('language') || 'en';
    const projectTitle = meta.get('title') || 'eXeLearning';
    const customStyles = meta.get('customStyles') || '';
    const author = meta.get('author') || '';
    const license = meta.get('license') || 'CC-BY-SA';
    const licenseUrl = meta.get('licenseUrl') || 'https://creativecommons.org/licenses/by-sa/4.0/';
    const themeName = meta.get('theme') || 'base';
    const totalPages = pages.length;

    // Generate all page contents (hidden except first)
    let pagesHtml = '';
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const isFirst = i === 0;
      pagesHtml += this.renderPageArticle(page, isFirst, i, totalPages, projectTitle);
    }

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles)}
</head>
<body class="exe-web-site exe-preview" lang="${lang}">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js">
${this.renderSpaNavigation(pages)}
<main class="page">
${pagesHtml}
</main>
${this.renderNavButtons()}
${this.renderWebsiteFooter(author, license, licenseUrl)}
</div>
${this.renderMadeWithEXe()}
${this.generateWebsitePreviewScripts(themeName, usedIdevices)}
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
  generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles) {
    // Use versioned paths for cache busting
    const bootstrapCss = this.getVersionedPath('/libs/bootstrap/bootstrap.min.css');
    const themeCss = this.getVersionedPath(`/files/perm/themes/base/${themeName}/style.css`);
    const fallbackCss = this.getVersionedPath('/style/content.css');

    // iDevices that require jQuery UI CSS
    const jqueryUiRequiredTypes = new Set([
      'ordena', 'sort', 'clasifica', 'classify', 'relaciona', 'relate',
      'dragdrop', 'complete', 'completa',
    ]);

    // Check if jQuery UI CSS is needed
    let needsJqueryUiCss = false;
    for (const idevice of usedIdevices) {
      let typeName = idevice.toLowerCase().replace(/idevice$/i, '').replace(/-idevice$/i, '');
      if (jqueryUiRequiredTypes.has(typeName)) {
        needsJqueryUiCss = true;
        break;
      }
    }

    let jqueryUiCssLink = '';
    if (needsJqueryUiCss) {
      const jqueryUiCss = this.getVersionedPath('/libs/jquery-ui/jquery-ui.min.css');
      jqueryUiCssLink = `\n<link rel="stylesheet" href="${jqueryUiCss}">`;
    }

    let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Preview</title>
<script>document.querySelector("html").classList.add("js");</script>

<!-- Server-hosted libraries (versioned paths) -->
<link rel="stylesheet" href="${bootstrapCss}">${jqueryUiCssLink}

<!-- Preview-only CSS (BEFORE theme so theme styles take precedence) -->
<style>
${this.getWebsitePreviewCss()}
</style>

<!-- Theme from server (loads AFTER fallback, so theme wins) -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">`;

    // iDevice CSS from server
    const seen = new Set();
    for (const idevice of usedIdevices) {
      let typeName = idevice.toLowerCase();
      typeName = typeName.replace(/idevice$/i, '').replace(/-idevice$/i, '');
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
   * Render SPA navigation with JavaScript page switching
   * @param {Array} pages
   * @returns {string}
   */
  renderSpaNavigation(pages) {
    const rootPages = pages.filter(p => !p.parentId);

    let html = '<nav id="siteNav">\n<ul>\n';
    for (const page of rootPages) {
      html += this.renderSpaNavItem(page, pages, pages[0]?.id);
    }
    html += '</ul>\n</nav>';

    return html;
  }

  /**
   * Render a navigation item for SPA
   * @param {Object} page
   * @param {Array} allPages
   * @param {string} currentPageId - ID of first page (initially active)
   * @returns {string}
   */
  renderSpaNavItem(page, allPages, currentPageId) {
    const children = allPages.filter(p => p.parentId === page.id);
    const hasChildren = children.length > 0;
    const isActive = page.id === currentPageId;

    let html = `<li${isActive ? ' class="active"' : ''}>`;
    html += ` <a href="#" data-page-id="${page.id}" class="${isActive ? 'active ' : ''}${hasChildren ? 'daddy' : 'no-ch'}">${this.escapeHtml(page.title)}</a>\n`;

    if (hasChildren) {
      html += '<ul class="other-section">\n';
      for (const child of children) {
        html += this.renderSpaNavItem(child, allPages, currentPageId);
      }
      html += '</ul>\n';
    }

    html += '</li>\n';
    return html;
  }

  /**
   * Render a page as an article (hidden except first)
   * Matches the structure of the real export from PageRenderer.ts
   * @param {Object} page
   * @param {boolean} isFirst
   * @param {number} pageIndex - Current page index (0-based)
   * @param {number} totalPages - Total number of pages
   * @param {string} projectTitle - Project title for header
   * @returns {string}
   */
  renderPageArticle(page, isFirst, pageIndex = 0, totalPages = 1, projectTitle = 'eXeLearning') {
    let blockHtml = '';

    // Use versioned path for iDevice resources so data-idevice-path resolves correctly
    const ideviceBasePath = this.getVersionedPath('/files/perm/idevices/base/');

    // Render blocks and components
    for (const block of page.blocks || []) {
      blockHtml += this.ideviceRenderer.renderBlock(block, {
        basePath: ideviceBasePath,
        includeDataAttributes: true,
      });
    }

    const displayStyle = isFirst ? '' : ' style="display:none"';
    const pageId = page.id;

    // Match PageRenderer.ts structure with page counter
    return `<article id="page-${pageId}" class="spa-page${isFirst ? ' active' : ''}"${displayStyle} data-page-index="${pageIndex}">
<header id="header-${pageId}" class="page-header"> <p class="page-counter"> <span class="page-counter-label">Página </span><span class="page-counter-content"> <strong class="page-counter-current-page">${pageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalPages}</strong></span></p>
<h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>
<h2 class="page-title">${this.escapeHtml(page.title)}</h2></header>
<div id="page-content-${pageId}" class="page-content">
${blockHtml}
</div>
</article>
`;
  }

  /**
   * Render navigation buttons (Previous/Next)
   * Uses <a> elements for proper clickability and theme styling
   * @returns {string}
   */
  renderNavButtons() {
    return `<div class="nav-buttons">
<a href="#" title="Anterior" class="nav-button nav-button-left" data-nav="prev">
<span>Anterior</span>
</a>
<a href="#" title="Siguiente" class="nav-button nav-button-right" data-nav="next">
<span>Siguiente</span>
</a>
</div>`;
  }

  /**
   * Generate scripts with SPA navigation logic
   * @param {string} themeName
   * @param {string[]} usedIdevices - List of used iDevice types
   * @returns {string}
   */
  generateWebsitePreviewScripts(themeName, usedIdevices = []) {
    // Use versioned paths for cache busting
    const jqueryJs = this.getVersionedPath('/libs/jquery/jquery.min.js');
    const bootstrapJs = this.getVersionedPath('/libs/bootstrap/bootstrap.bundle.min.js');
    const commonI18nJs = this.getVersionedPath('/app/common/common_i18n.js');
    const commonJs = this.getVersionedPath('/app/common/common.js');
    const themeJs = this.getVersionedPath(`/files/perm/themes/base/${themeName}/style.js`);

    // iDevices that require jQuery UI (draggable, sortable, etc.)
    const jqueryUiRequiredTypes = new Set([
      'ordena', 'sort',           // sorting activity
      'clasifica', 'classify',    // classification activity
      'relaciona', 'relate',      // matching activity
      'dragdrop',                 // drag and drop
      'complete', 'completa',     // complete activity
    ]);

    // Generate iDevice-specific scripts (like Html5Exporter does)
    // Each iDevice export script has a self-init pattern that calls init() on jQuery ready
    let ideviceScripts = '';
    const seen = new Set();
    let needsJqueryUi = false;

    for (const idevice of usedIdevices) {
      // Normalize iDevice type name
      let typeName = idevice.toLowerCase();
      // Remove common suffixes (order matters: check -idevice before idevice)
      typeName = typeName.replace(/-idevice$/i, '').replace(/idevice$/i, '');
      // Map common types
      const typeMap = {
        'freetext': 'text',
        'text': 'text',
        'freetextidevice': 'text',
        'textidevice': 'text',
      };
      typeName = typeMap[typeName] || typeName || 'text';

      // Check if this iDevice needs jQuery UI
      if (jqueryUiRequiredTypes.has(typeName)) {
        needsJqueryUi = true;
      }

      if (!seen.has(typeName)) {
        seen.add(typeName);
        const ideviceJs = this.getVersionedPath(`/files/perm/idevices/base/${typeName}/export/${typeName}.js`);
        ideviceScripts += `\n<script src="${ideviceJs}" onerror=""></script>`;
      }
    }

    // jQuery UI script (loaded BEFORE iDevice scripts that need it)
    let jqueryUiScript = '';
    if (needsJqueryUi) {
      const jqueryUiJs = this.getVersionedPath('/libs/jquery-ui/jquery-ui.min.js');
      jqueryUiScript = `\n<script src="${jqueryUiJs}"></script>`;
    }

    return `<script src="${jqueryJs}"></script>
<script src="${bootstrapJs}"></script>${jqueryUiScript}
<script src="${commonI18nJs}" onerror=""></script>
<script src="${commonJs}" onerror=""></script>
<script>
// Global aliases needed for preview context
// Logger: used by some scripts but only defined in workarea
window.Logger = window.Logger || { log: function() {}, warn: function() {}, error: console.error };
// eXe object structure as defined in exe_export.js setExe()
// eXe.app = $exe (which has isInExe, getIdeviceInstalledExportPath, etc.)
window.eXe = window.eXe || {};
window.eXe.app = window.$exe;
</script>${ideviceScripts}
<script src="${themeJs}" onerror=""></script>
<script>
// SPA Navigation for Website Preview
(function() {
  'use strict';

  function initSpaNavigation() {
    const navLinks = document.querySelectorAll('[data-page-id]');
    const pages = document.querySelectorAll('.spa-page');

    navLinks.forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const pageId = this.getAttribute('data-page-id');

        // Hide all pages
        pages.forEach(function(page) {
          page.style.display = 'none';
          page.classList.remove('active');
        });

        // Show selected page
        const targetPage = document.getElementById('page-' + pageId);
        if (targetPage) {
          targetPage.style.display = 'block';
          targetPage.classList.add('active');
        }

        // Update nav active state
        navLinks.forEach(function(l) {
          l.classList.remove('active');
          l.parentElement.classList.remove('active');
        });
        this.classList.add('active');
        this.parentElement.classList.add('active');

        // Update parent ancestors
        updateParentActive(this);

        // Scroll to top
        window.scrollTo(0, 0);
      });
    });
  }

  function updateParentActive(link) {
    var parent = link.closest('ul.other-section');
    while (parent) {
      var parentLi = parent.closest('li');
      if (parentLi) {
        parentLi.classList.add('parent');
      }
      parent = parentLi ? parentLi.parentElement.closest('ul.other-section') : null;
    }
  }

  function initNavButtons() {
    const navButtons = document.querySelectorAll('.nav-button[data-nav]');
    const navLinks = document.querySelectorAll('[data-page-id]');
    const pageIds = Array.from(navLinks).map(l => l.getAttribute('data-page-id'));

    navButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent # navigation
        const direction = this.getAttribute('data-nav');
        const activePage = document.querySelector('.spa-page.active');
        if (!activePage) return;

        const currentId = activePage.id.replace('page-', '');
        const currentIndex = pageIds.indexOf(currentId);
        let newIndex;

        if (direction === 'prev' && currentIndex > 0) {
          newIndex = currentIndex - 1;
        } else if (direction === 'next' && currentIndex < pageIds.length - 1) {
          newIndex = currentIndex + 1;
        } else {
          return; // No navigation possible
        }

        const targetLink = document.querySelector('[data-page-id="' + pageIds[newIndex] + '"]');
        if (targetLink) {
          targetLink.click();
        }
      });
    });

    updateNavButtonsVisibility();
  }

  function updateNavButtonsVisibility() {
    const navLinks = document.querySelectorAll('[data-page-id]');
    const pageIds = Array.from(navLinks).map(l => l.getAttribute('data-page-id'));
    const activePage = document.querySelector('.spa-page.active');
    if (!activePage) return;

    const currentId = activePage.id.replace('page-', '');
    const currentIndex = pageIds.indexOf(currentId);

    const prevBtn = document.querySelector('.nav-button[data-nav="prev"]');
    const nextBtn = document.querySelector('.nav-button[data-nav="next"]');

    // Hide first/last buttons when at boundaries (using display to match theme behavior)
    if (prevBtn) {
      prevBtn.style.display = currentIndex > 0 ? '' : 'none';
    }
    if (nextBtn) {
      nextBtn.style.display = currentIndex < pageIds.length - 1 ? '' : 'none';
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initSpaNavigation();
      initNavButtons();
    });
  } else {
    initSpaNavigation();
    initNavButtons();
  }

  // Update nav buttons visibility when page changes
  document.addEventListener('click', function(e) {
    if (e.target.closest('[data-page-id]')) {
      setTimeout(updateNavButtonsVisibility, 10);
    }
  });

  console.log('[WebsitePreview] SPA Navigation initialized');
})();
</script>`;
  }

  /**
   * Render footer for website preview
   * Matches PageRenderer.ts renderFooterSection structure
   * @param {string} author
   * @param {string} license
   * @param {string} licenseUrl
   * @returns {string}
   */
  renderWebsiteFooter(author, license, licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/') {
    return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="${this.escapeHtml(licenseUrl)}" class="license">${this.escapeHtml(license)}</a></p>
</div>
</div></footer>`;
  }

  /**
   * Render "Made with eXeLearning" credit
   * Matches PageRenderer.ts renderMadeWithEXe structure
   * @returns {string}
   */
  renderMadeWithEXe() {
    return `<p id="made-with-eXe"> <a href="https://exelearning.net/" target="_blank" rel="noopener"> <span>Creado con eXeLearning <span>(nueva ventana)</span></span></a></p>`;
  }

  /**
   * Get CSS specific to website preview mode
   * @returns {string}
   */
  getWebsitePreviewCss() {
    return `/* Website Preview SPA styles */
.exe-preview .preview-notice {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-size: 0.85em;
}

/* SPA Page transitions */
.spa-page {
  animation: fadeIn 0.2s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Active nav state */
#siteNav .active > a {
  font-weight: bold;
}

#siteNav .parent > a {
  font-weight: 500;
}

/* Show submenus on hover and for ancestor/active pages */
#siteNav li:hover > .other-section,
#siteNav li.sfhover > .other-section,
#siteNav li.parent > .other-section,
#siteNav li.active > .other-section {
  display: block;
}
`;
  }

  /**
   * Get base CSS (inherited from parent but we can add more)
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
  cursor: pointer;
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
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }
  main.page {
    flex: 1;
    padding: 20px 30px;
    max-width: 900px;
  }
}
`;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebsitePreviewExporter;
} else {
  window.WebsitePreviewExporter = WebsitePreviewExporter;
}
