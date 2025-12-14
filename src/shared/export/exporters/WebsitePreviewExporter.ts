/**
 * WebsitePreviewExporter
 *
 * Generates a multi-page SPA preview for client-side viewing.
 * Shows pages one at a time with navigation, similar to the exported website.
 *
 * Key differences from Html5Exporter:
 * - Returns HTML string, not ZIP buffer
 * - Uses versioned server URLs for resources (not bundled)
 * - Shows one page at a time with SPA-style navigation
 * - Asset URLs stay as `asset://` for later resolution to `blob://`
 */
import type { ExportDocument, ExportPage, ResourceProvider } from '../interfaces';
import { IdeviceRenderer } from '../renderers/IdeviceRenderer';
import { normalizeIdeviceType } from '../constants';

/**
 * Options for preview generation
 */
export interface PreviewOptions {
    /** Base path for versioned URLs (e.g., 'http://localhost:3001') */
    baseUrl?: string;
    /** App version for cache busting */
    version?: string;
    /** Base path for URLs (e.g., '/exelearning') */
    basePath?: string;
}

/**
 * Result of preview generation
 */
export interface PreviewResult {
    success: boolean;
    html?: string;
    error?: string;
}

/**
 * WebsitePreviewExporter class
 * Generates SPA-style preview HTML for browser viewing
 */
export class WebsitePreviewExporter {
    private document: ExportDocument;
    private resourceProvider: ResourceProvider;
    private ideviceRenderer: IdeviceRenderer;

    /**
     * Create a WebsitePreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     */
    constructor(document: ExportDocument, resourceProvider: ResourceProvider) {
        this.document = document;
        this.resourceProvider = resourceProvider;
        this.ideviceRenderer = new IdeviceRenderer(resourceProvider);
    }

    /**
     * Generate preview HTML
     * @param options - Preview options
     * @returns Preview result with HTML string
     */
    async generatePreview(options: PreviewOptions = {}): Promise<PreviewResult> {
        try {
            const pages = this.document.getNavigation();
            const meta = this.document.getMetadata();

            if (pages.length === 0) {
                return { success: false, error: 'No pages to preview' };
            }

            // Get all used iDevice types
            const usedIdevices = this.getUsedIdevices(pages);

            // Check if download-source-file iDevice is used (needs special handling)
            const needsElpxDownload = this.needsElpxDownloadSupport(pages);

            // Generate the SPA HTML
            let html = this.generateWebsiteSpaHtml(pages, meta, usedIdevices, options, needsElpxDownload);

            // Apply exe-package:elp protocol replacement if download-source-file is used
            if (needsElpxDownload) {
                const projectTitle = meta.title || 'project';
                html = this.replaceElpxProtocol(html, projectTitle);
            }

            return { success: true, html };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Check if any page contains the download-source-file iDevice
     * (needs fflate and exe_elpx_download.js)
     */
    private needsElpxDownloadSupport(pages: ExportPage[]): boolean {
        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    // Check by iDevice type
                    const type = (component.type || '').toLowerCase();
                    if (type.includes('download-source-file') || type.includes('downloadsourcefile')) {
                        return true;
                    }
                    // Also check content for the CSS class (more reliable)
                    if (component.content && component.content.includes('exe-download-package-link')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Replace exe-package:elp protocol with client-side download handler
     * Enables the download-source-file iDevice to generate ELPX files on-the-fly
     */
    private replaceElpxProtocol(content: string, projectTitle: string): string {
        if (!content || !content.includes('exe-package:elp')) {
            return content;
        }

        // Replace href="exe-package:elp" with onclick handler
        let result = content.replace(
            /href="exe-package:elp"/g,
            'href="#" onclick="if(typeof downloadElpx===\'function\')downloadElpx();return false;"',
        );

        // Replace download="exe-package:elp-name" with actual filename
        const safeTitle = this.escapeHtml(projectTitle);
        result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);

        return result;
    }

    /**
     * Get all unique iDevice types used in pages
     */
    private getUsedIdevices(pages: ExportPage[]): string[] {
        const types = new Set<string>();
        for (const page of pages) {
            for (const block of page.blocks) {
                for (const component of block.components) {
                    if (component.type) {
                        types.add(component.type);
                    }
                }
            }
        }
        return Array.from(types);
    }

    /**
     * Get versioned asset path for server resources
     * @param path - The resource path (e.g., '/libs/bootstrap.css')
     * @param options - Preview options with baseUrl and version
     * @returns Versioned URL
     */
    private getVersionedPath(path: string, options: PreviewOptions): string {
        const baseUrl = options.baseUrl || '';
        const basePath = options.basePath || '';
        const version = options.version || 'v1.0.0';
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `${baseUrl}${basePath}/${version}/${cleanPath}`;
    }

    /**
     * Generate complete SPA HTML with all pages
     */
    private generateWebsiteSpaHtml(
        pages: ExportPage[],
        meta: ReturnType<ExportDocument['getMetadata']>,
        usedIdevices: string[],
        options: PreviewOptions,
        needsElpxDownload: boolean = false,
    ): string {
        const lang = meta.language || 'en';
        const projectTitle = meta.title || 'eXeLearning';
        const customStyles = meta.customStyles || '';
        const author = meta.author || '';
        const license = meta.license || 'CC-BY-SA';
        const themeName = meta.theme || 'base';
        const totalPages = pages.length;

        // Export options (with defaults)
        const addExeLink = meta.addExeLink ?? true;
        const addPagination = meta.addPagination ?? false;
        const addSearchBox = meta.addSearchBox ?? false;
        const addAccessibilityToolbar = meta.addAccessibilityToolbar ?? false;

        // Generate search data if search box is enabled
        const searchDataJson = addSearchBox ? this.generateSearchData(pages, options) : '';

        // Generate all page contents (hidden except first)
        let pagesHtml = '';
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const isFirst = i === 0;
            pagesHtml += this.renderPageArticle(page, isFirst, i, totalPages, projectTitle, options, addPagination);
        }

        // Conditionally render "Made with eXeLearning"
        const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe(lang) : '';

        // Render search box container if enabled
        const searchBoxHtml = addSearchBox ? this.renderSearchBox() : '';
        // Generate inline search data script (avoids bloating HTML with large JSON attributes)
        const searchDataScript = addSearchBox ? this.generateSearchDataScript(searchDataJson) : '';

        return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar)}
</head>
<body class="exe-web-site exe-preview" lang="${lang}">
<script>document.body.className+=" js"</script>
${searchBoxHtml}
<div class="exe-content exe-export pre-js">
${this.renderSpaNavigation(pages)}
<main class="page">
${pagesHtml}
</main>
${this.renderNavButtons()}
${this.renderWebsiteFooter(author, license)}
</div>
${madeWithExeHtml}
${searchDataScript}
${this.generateWebsitePreviewScripts(themeName, usedIdevices, options, needsElpxDownload, addAccessibilityToolbar)}
</body>
</html>`;
    }

    /**
     * Generate <head> content with versioned server paths
     */
    private generateWebsitePreviewHead(
        themeName: string,
        usedIdevices: string[],
        projectTitle: string,
        customStyles: string,
        options: PreviewOptions,
        addAccessibilityToolbar: boolean = false,
    ): string {
        const bootstrapCss = this.getVersionedPath('/libs/bootstrap/bootstrap.min.css', options);
        const themeCss = this.getVersionedPath(`/files/perm/themes/base/${themeName}/style.css`, options);
        const fallbackCss = this.getVersionedPath('/style/content.css', options);

        // iDevices that require jQuery UI CSS
        const jqueryUiRequiredTypes = new Set([
            'ordena',
            'sort',
            'clasifica',
            'classify',
            'relaciona',
            'relate',
            'dragdrop',
            'complete',
            'completa',
        ]);

        // Check if jQuery UI CSS is needed
        let needsJqueryUiCss = false;
        for (const idevice of usedIdevices) {
            const typeName = idevice
                .toLowerCase()
                .replace(/idevice$/i, '')
                .replace(/-idevice$/i, '');
            if (jqueryUiRequiredTypes.has(typeName)) {
                needsJqueryUiCss = true;
                break;
            }
        }

        let jqueryUiCssLink = '';
        if (needsJqueryUiCss) {
            const jqueryUiCss = this.getVersionedPath('/libs/jquery-ui/jquery-ui.min.css', options);
            jqueryUiCssLink = `\n<link rel="stylesheet" href="${jqueryUiCss}">`;
        }

        let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Preview</title>
<script>document.querySelector("html").classList.add("js");</script>

<!-- Server-hosted libraries (versioned paths) -->
<link rel="stylesheet" href="${bootstrapCss}">${jqueryUiCssLink}

<!-- Preview-only CSS for SPA behavior -->
<style>
${this.getWebsitePreviewCss()}
</style>

<!-- Theme from server (loads AFTER fallback, so theme wins) -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">`;

        // iDevice CSS from server
        const seen = new Set<string>();
        for (const idevice of usedIdevices) {
            const typeName = normalizeIdeviceType(idevice);

            if (!seen.has(typeName)) {
                seen.add(typeName);
                const ideviceCss = this.getVersionedPath(
                    `/files/perm/idevices/base/${typeName}/export/${typeName}.css`,
                    options,
                );
                head += `\n<link rel="stylesheet" href="${ideviceCss}" onerror="this.remove()">`;
            }
        }

        // Custom styles
        if (customStyles) {
            head += `\n<style>\n${customStyles}\n</style>`;
        }

        // Accessibility toolbar CSS
        if (addAccessibilityToolbar) {
            const atoolsCss = this.getVersionedPath('/libs/exe_atools/exe_atools.css', options);
            head += `\n<link rel="stylesheet" href="${atoolsCss}">`;
        }

        // Made-with-eXe CSS - MUST be last to override theme styles
        head += `\n<style>\n${this.getMadeWithExeCss(options)}\n</style>`;

        return head;
    }

    /**
     * Get preview-only CSS for SPA behavior and critical theme fallbacks
     */
    private getWebsitePreviewCss(): string {
        return `/* SPA Preview Styles */
.spa-page { display: none; }
.spa-page.active { display: block; }

/* Navigation link fixes (theme fallback) */
#siteNav a {
    text-decoration: none;
}

/* Button text hiding - visually hidden but accessible */
.nav-buttons .nav-button span,
button.toggler span,
#exe-client-search-reset span {
    position: absolute;
    clip: rect(1px, 1px, 1px, 1px);
    clip-path: inset(50%);
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;
}

/* Search form flex layout */
#exe-client-search-form p {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    align-items: center;
}

/* Nav buttons positioning (theme fallback) */
.nav-buttons { display: flex; justify-content: space-between; padding: 1rem; }
.nav-button { cursor: pointer; }
.nav-button.disabled { opacity: 0.5; pointer-events: none; }`;
    }

    /**
     * Get Made-with-eXe CSS (loaded AFTER theme to ensure it overrides)
     */
    private getMadeWithExeCss(options: PreviewOptions): string {
        // Logo URL for "Made with eXeLearning" styling
        const logoUrl = this.getVersionedPath('/app/common/exe_powered_logo/exe_powered_logo.png', options);

        return `/* Made with eXeLearning - Must load after theme */
#made-with-eXe {
    margin: 0;
    position: fixed;
    bottom: 0;
    right: 0;
    z-index: 9999;
}
#made-with-eXe a {
    text-decoration: none;
    box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
    border-top-left-radius: 4px;
    color: #222;
    font-size: 11px;
    font-family: Arial, sans-serif;
    line-height: 35px;
    width: 35px;
    height: 35px;
    background: #fff url(${logoUrl}) no-repeat 3px 50%;
    display: block;
    background-size: auto 20px;
    transition: .5s;
    opacity: .8;
    overflow: hidden;
}
#made-with-eXe span {
    padding-left: 35px;
    padding-right: 5px;
    white-space: nowrap;
}
#made-with-eXe a:hover {
    width: auto;
    padding: 0 5px;
    background-position: 5px 50%;
    opacity: 1;
}
@media print {
    #made-with-eXe { display: none; }
}`;
    }

    /**
     * Render SPA navigation with JavaScript page switching
     */
    private renderSpaNavigation(pages: ExportPage[]): string {
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
     */
    private renderSpaNavItem(page: ExportPage, allPages: ExportPage[], currentPageId?: string): string {
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
     */
    private renderPageArticle(
        page: ExportPage,
        isFirst: boolean,
        pageIndex: number,
        totalPages: number,
        projectTitle: string,
        options: PreviewOptions,
        addPagination: boolean = false,
    ): string {
        let blockHtml = '';

        // Use versioned path for iDevice resources
        const ideviceBasePath = this.getVersionedPath('/files/perm/idevices/base/', options);

        // Render blocks and components
        for (const block of page.blocks || []) {
            blockHtml += this.ideviceRenderer.renderBlock(block, {
                basePath: ideviceBasePath,
                includeDataAttributes: true,
            });
        }

        const displayStyle = isFirst ? '' : ' style="display:none"';
        const pageId = page.id;

        // Build page counter HTML (only if pagination is enabled)
        const pageCounterHtml = addPagination
            ? `<p class="page-counter"> <span class="page-counter-label">Página </span><span class="page-counter-content"> <strong class="page-counter-current-page">${pageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalPages}</strong></span></p>`
            : '';

        return `<article id="page-${pageId}" class="spa-page${isFirst ? ' active' : ''}"${displayStyle} data-page-index="${pageIndex}">
<header id="header-${pageId}" class="page-header"> ${pageCounterHtml}
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
     */
    private renderNavButtons(): string {
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
     * Render website footer
     */
    private renderWebsiteFooter(author: string, license: string): string {
        return `<footer id="siteFooter">
<p class="license">${this.escapeHtml(author ? `${author} - ` : '')}${this.escapeHtml(license)}</p>
</footer>`;
    }

    /**
     * Translations for "Made with eXeLearning" text
     */
    private static readonly MADE_WITH_TRANSLATIONS: Record<string, string> = {
        en: 'Made with eXeLearning',
        es: 'Creado con eXeLearning',
        ca: 'Creat amb eXeLearning',
        eu: 'eXeLearning-ekin egina',
        gl: 'Creado con eXeLearning',
        pt: 'Criado com eXeLearning',
        va: 'Creat amb eXeLearning',
        ro: 'Creat cu eXeLearning',
        eo: 'Kreita per eXeLearning',
    };

    /**
     * Render "Made with eXeLearning" credit with translated text
     * The text is hidden by default and shown on hover via CSS
     */
    private renderMadeWithEXe(lang: string): string {
        const text =
            WebsitePreviewExporter.MADE_WITH_TRANSLATIONS[lang] || WebsitePreviewExporter.MADE_WITH_TRANSLATIONS['en'];
        return `<p id="made-with-eXe"><a href="https://exelearning.net/" target="_blank" rel="noopener"><span>${this.escapeHtml(text)} </span></a></p>`;
    }

    /**
     * Generate scripts with SPA navigation logic
     */
    private generateWebsitePreviewScripts(
        themeName: string,
        usedIdevices: string[],
        options: PreviewOptions,
        needsElpxDownload: boolean = false,
        addAccessibilityToolbar: boolean = false,
    ): string {
        const jqueryJs = this.getVersionedPath('/libs/jquery/jquery.min.js', options);
        const bootstrapJs = this.getVersionedPath('/libs/bootstrap/bootstrap.bundle.min.js', options);
        const commonJs = this.getVersionedPath('/app/common/common.js', options);
        const commonI18nJs = this.getVersionedPath('/app/common/common_i18n.js', options);
        const exeExportJs = this.getVersionedPath('/app/common/exe_export.js', options);
        const themeJs = this.getVersionedPath(`/files/perm/themes/base/${themeName}/style.js`, options);

        // Check if jQuery UI is needed
        const jqueryUiRequiredTypes = new Set([
            'ordena',
            'sort',
            'clasifica',
            'classify',
            'relaciona',
            'relate',
            'dragdrop',
            'complete',
            'completa',
        ]);

        let needsJqueryUi = false;
        for (const idevice of usedIdevices) {
            const typeName = idevice
                .toLowerCase()
                .replace(/idevice$/i, '')
                .replace(/-idevice$/i, '');
            if (jqueryUiRequiredTypes.has(typeName)) {
                needsJqueryUi = true;
                break;
            }
        }

        let jqueryUiScript = '';
        if (needsJqueryUi) {
            const jqueryUiJs = this.getVersionedPath('/libs/jquery-ui/jquery-ui.min.js', options);
            jqueryUiScript = `\n<script src="${jqueryUiJs}"></script>`;
        }

        // ELPX download scripts (fflate + exe_elpx_download.js) for download-source-file iDevice
        let elpxDownloadScripts = '';
        if (needsElpxDownload) {
            const fflateJs = this.getVersionedPath('/libs/fflate/fflate.umd.js', options);
            const elpxDownloadJs = this.getVersionedPath('/libs/exe_elpx_download.js', options);
            elpxDownloadScripts = `\n<script src="${fflateJs}"></script>\n<script src="${elpxDownloadJs}"></script>`;
        }

        // iDevice scripts
        let ideviceScripts = '';
        const seenJs = new Set<string>();
        for (const idevice of usedIdevices) {
            const typeName = normalizeIdeviceType(idevice);

            if (!seenJs.has(typeName)) {
                seenJs.add(typeName);
                const ideviceJs = this.getVersionedPath(
                    `/files/perm/idevices/base/${typeName}/export/${typeName}.js`,
                    options,
                );
                ideviceScripts += `\n<script src="${ideviceJs}" onerror="this.remove()"></script>`;
            }
        }

        // Accessibility toolbar script
        let atoolsScript = '';
        if (addAccessibilityToolbar) {
            const atoolsJs = this.getVersionedPath('/libs/exe_atools/exe_atools.js', options);
            atoolsScript = `\n<script src="${atoolsJs}"></script>`;
        }

        return `<script src="${jqueryJs}"></script>
<script src="${bootstrapJs}"></script>${jqueryUiScript}${elpxDownloadScripts}
<script src="${commonJs}"></script>
<script src="${commonI18nJs}"></script>
<script src="${exeExportJs}"></script>${ideviceScripts}${atoolsScript}
<script src="${themeJs}" onerror="this.remove()"></script>
<script>
${this.getSpaNavigationScript()}
// Initialize iDevices after DOM is ready
if (typeof $exeExport !== 'undefined' && $exeExport.init) {
    $exeExport.init();
}
</script>`;
    }

    /**
     * Get SPA navigation JavaScript
     */
    private getSpaNavigationScript(): string {
        return `// SPA Navigation
(function() {
  var pages = document.querySelectorAll('.spa-page');
  var navLinks = document.querySelectorAll('[data-page-id]');
  var prevBtn = document.querySelector('[data-nav="prev"]');
  var nextBtn = document.querySelector('[data-nav="next"]');
  var currentIndex = 0;

  function showPage(index) {
    if (index < 0 || index >= pages.length) return;
    currentIndex = index;
    pages.forEach(function(p, i) {
      p.style.display = i === index ? 'block' : 'none';
      p.classList.toggle('active', i === index);
    });
    navLinks.forEach(function(link) {
      var pageId = link.getAttribute('data-page-id');
      var isActive = pages[index].id === 'page-' + pageId;
      link.classList.toggle('active', isActive);
      if (link.parentElement) link.parentElement.classList.toggle('active', isActive);
    });
    updateNavButtons();
  }

  function updateNavButtons() {
    if (prevBtn) prevBtn.classList.toggle('disabled', currentIndex === 0);
    if (nextBtn) nextBtn.classList.toggle('disabled', currentIndex === pages.length - 1);
  }

  navLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var pageId = this.getAttribute('data-page-id');
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === 'page-' + pageId) {
          showPage(i);
          break;
        }
      }
    });
  });

  if (prevBtn) prevBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(currentIndex - 1);
  });

  if (nextBtn) nextBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showPage(currentIndex + 1);
  });

  // Handle hash changes for search result navigation
  function showPageByHash() {
    var hash = window.location.hash;
    if (hash && hash.startsWith('#page-')) {
      var targetId = hash.substring(1); // Remove the #
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === targetId) {
          showPage(i);
          return;
        }
      }
    }
  }

  // Listen for hash changes
  window.addEventListener('hashchange', showPageByHash);

  // Check initial hash on load
  showPageByHash();

  updateNavButtons();
})();`;
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        const escapes: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return text.replace(/[&<>"']/g, char => escapes[char] || char);
    }

    /**
     * Escape string for use in HTML attributes
     */
    private escapeAttr(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Sanitize filename for URLs
     */
    private sanitizeFilename(title: string): string {
        return (
            title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 50) || 'page'
        );
    }

    /**
     * Render search box container (without data-pages attribute)
     * The data is provided via window.exeSearchData inline script
     * The form is created dynamically by exe_export.js
     */
    private renderSearchBox(): string {
        return `<div id="exe-client-search"
    data-block-order-string="Caja %e"
    data-no-results-string="Sin resultados.">
</div>`;
    }

    /**
     * Generate inline script for search data
     * This avoids bloating each page with large JSON in attributes
     */
    private generateSearchDataScript(searchDataJson: string): string {
        return `<script>window.exeSearchData = ${searchDataJson};</script>`;
    }

    /**
     * Generate search data JSON for client-side search functionality
     * For SPA preview, uses anchor links (#page-{id}) instead of file URLs
     * @param pages - All pages in the project
     * @param options - Preview options for URL generation
     * @returns JSON string with page structure
     */
    private generateSearchData(pages: ExportPage[], _options: PreviewOptions): string {
        const pagesData: Record<string, unknown> = {};

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const isIndex = i === 0;
            const prevPage = i > 0 ? pages[i - 1] : null;
            const nextPage = i < pages.length - 1 ? pages[i + 1] : null;

            // For SPA preview, use anchor links that point to page articles
            // The articles have id="page-{pageId}" (see renderPageArticle)
            const fileName = `#page-${page.id}`;
            const fileUrl = `#page-${page.id}`;

            const blocksData: Record<string, unknown> = {};
            for (const block of page.blocks || []) {
                const idevicesData: Record<string, unknown> = {};
                for (let j = 0; j < (block.components || []).length; j++) {
                    const component = block.components[j];
                    idevicesData[component.id] = {
                        order: j + 1,
                        htmlView: component.content || '',
                        jsonProperties: JSON.stringify(component.properties || {}),
                    };
                }
                blocksData[block.id] = {
                    name: block.name || '',
                    order: block.order || 1,
                    idevices: idevicesData,
                };
            }

            pagesData[page.id] = {
                name: page.title,
                isIndex,
                fileName,
                fileUrl,
                prePageId: prevPage?.id || null,
                nextPageId: nextPage?.id || null,
                blocks: blocksData,
            };
        }

        return JSON.stringify(pagesData);
    }
}
