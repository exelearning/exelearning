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
import type {
    ExportDocument,
    ExportPage,
    ResourceProvider,
    LatexPreRenderResult,
    MermaidPreRenderResult,
} from '../interfaces';
import { IdeviceRenderer } from '../renderers/IdeviceRenderer';
import { normalizeIdeviceType } from '../constants';
import { LibraryDetector } from '../utils/LibraryDetector';
import { getIdeviceExportFiles } from '../../../services/idevice-config';

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
    /**
     * Full theme URL from the themes manager (e.g., '/v1/site-files/themes/chiquito/')
     * When provided, this is used instead of constructing the path from theme name.
     * This is needed to correctly handle site themes vs base themes.
     */
    themeUrl?: string;
    /**
     * Optional hook to pre-render LaTeX expressions to SVG+MathML.
     * When provided and successful, MathJax library will NOT be included in the output.
     * The pre-renderer runs on the client using MathJax already loaded in the workarea.
     */
    preRenderLatex?: (html: string) => Promise<LatexPreRenderResult>;
    /**
     * Optional hook to pre-render LaTeX inside encrypted DataGame divs.
     * Game iDevices store questions in encrypted JSON. This decrypts, pre-renders LaTeX,
     * and re-encrypts before the main preRenderLatex processes visible content.
     */
    preRenderDataGameLatex?: (html: string) => Promise<{ html: string; count: number }>;
    /**
     * Optional hook to pre-render Mermaid diagrams to static SVG.
     * When provided and successful, Mermaid library (~2.7MB) will NOT be included.
     * This significantly reduces load time and provides instant diagram rendering.
     */
    preRenderMermaid?: (html: string) => Promise<MermaidPreRenderResult>;
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
    private ideviceRenderer: IdeviceRenderer;

    /**
     * Create a WebsitePreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     */
    constructor(document: ExportDocument, resourceProvider: ResourceProvider) {
        this.document = document;
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

            // Generate the SPA HTML (with optional LaTeX pre-rendering)
            let html = await this.generateWebsiteSpaHtml(pages, meta, usedIdevices, options, needsElpxDownload);

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
     * (needs special handling in preview - postMessage to parent)
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
                    if (component.content?.includes('exe-download-package-link')) {
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
     * Libraries that are located in /libs/ instead of /app/common/
     * The LibraryDetector returns files without the base path, so we need to map them correctly
     * Note: mermaid is in /app/common/mermaid/, not /libs/
     */
    private static readonly LIBS_FOLDER_LIBRARIES = new Set([
        'jquery-ui',
        'fflate',
        'exe_atools',
        'exe_elpx_download', // Folder in /libs/
    ]);

    /**
     * Get the correct server path for a detected library file
     * Some libraries are in /libs/, others in /app/common/
     * @param file - Library file path (e.g., 'jquery-ui/jquery-ui.min.js' or 'exe_lightbox/exe_lightbox.js')
     * @param options - Preview options
     * @returns Versioned URL with correct base path
     */
    private getLibraryServerPath(file: string, options: PreviewOptions): string {
        // Check if this is a library that lives in /libs/
        const firstPart = file.split('/')[0];
        if (
            WebsitePreviewExporter.LIBS_FOLDER_LIBRARIES.has(firstPart) ||
            WebsitePreviewExporter.LIBS_FOLDER_LIBRARIES.has(file)
        ) {
            return this.getVersionedPath(`/libs/${file}`, options);
        }
        // Default: /app/common/ for exe_* libraries
        return this.getVersionedPath(`/app/common/${file}`, options);
    }

    /**
     * Generate complete SPA HTML with all pages
     */
    private async generateWebsiteSpaHtml(
        pages: ExportPage[],
        meta: ReturnType<ExportDocument['getMetadata']>,
        usedIdevices: string[],
        options: PreviewOptions,
        needsElpxDownload: boolean = false,
    ): Promise<string> {
        const lang = meta.language || 'en';
        const projectTitle = meta.title || 'eXeLearning';
        const customStyles = meta.customStyles || '';
        const license = meta.license || 'CC-BY-SA';
        const themeName = meta.theme || 'base';
        const userFooterContent = meta.footer || '';

        // Export options (with defaults)
        const addExeLink = meta.addExeLink ?? true;
        const addPagination = meta.addPagination ?? false;
        const addSearchBox = meta.addSearchBox ?? false;
        const addAccessibilityToolbar = meta.addAccessibilityToolbar ?? false;

        // Filter to only visible pages
        const visiblePages = pages.filter(page => this.isPageVisible(page, pages));

        // Generate search data if search box is enabled (only visible pages)
        const searchDataJson = addSearchBox ? this.generateSearchData(visiblePages, options) : '';

        // Generate all page contents (hidden except first)
        // Note: Use visiblePages for rendering, but totalPages reflects visible count
        const totalVisiblePages = visiblePages.length;
        let pagesHtml = '';
        for (let i = 0; i < visiblePages.length; i++) {
            const page = visiblePages[i];
            const isFirst = i === 0;
            pagesHtml += this.renderPageArticle(
                page,
                isFirst,
                i,
                totalVisiblePages,
                projectTitle,
                options,
                addPagination,
                themeName,
            );
        }

        // Conditionally render "Made with eXeLearning"
        const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe(lang) : '';

        // Render search box container if enabled
        const searchBoxHtml = addSearchBox ? this.renderSearchBox() : '';
        // Generate inline search data script (avoids bloating HTML with large JSON attributes)
        const searchDataScript = addSearchBox ? this.generateSearchDataScript(searchDataJson) : '';

        // Get first visible page for initial header content
        const _firstPage = visiblePages[0];
        const firstPageIndex = 0;

        // Build initial page counter HTML (only if pagination is enabled)
        const initialPageCounterHtml = addPagination
            ? `<p class="page-counter"> <span class="page-counter-label">Página </span><span class="page-counter-content"> <strong class="page-counter-current-page">${firstPageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalVisiblePages}</strong></span></p>`
            : '';

        // Wrap headers in main-header so theme JS (e.g., flux movePageTitle) can find them
        // Theme JS looks for '.main-header .page-header' to move title into .page-content
        // NOTE: Page header is now inside each article (see renderPageArticle) to preserve pre-rendered LaTeX
        // The shared #page-title element is hidden but kept for backwards compatibility with scripts
        const staticHeaderHtml = `${initialPageCounterHtml}<header class="main-header">
<div class="package-header package-node"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1></div>
<div class="page-header" style="display:none"><h2 id="page-title" class="page-title"></h2></div>
</header>`;

        // Build the body content that will be pre-rendered
        // Note: head and scripts are added AFTER pre-rendering to avoid corrupting them
        const bodyContent = `<div class="exe-content exe-export pre-js">
${this.renderSpaNavigation(pages)}
<main class="page">
${searchBoxHtml}
${staticHeaderHtml}
${pagesHtml}
</main>
${this.renderNavButtons(lang)}
${this.renderFooterSection({ license, userFooterContent })}
</div>
${madeWithExeHtml}`;

        // Pre-render LaTeX ONLY if addMathJax is false
        // When MathJax is included, let it process LaTeX at runtime for full UX (context menu, accessibility)
        let finalBodyContent = bodyContent;
        let latexWasRendered = false;
        let mermaidWasRendered = false;
        if (!meta.addMathJax) {
            // Pre-render LaTeX in encrypted DataGame divs FIRST
            // (game iDevices store questions in encrypted JSON)
            if (options.preRenderDataGameLatex) {
                try {
                    const result = await options.preRenderDataGameLatex(bodyContent);
                    if (result.count > 0) {
                        finalBodyContent = result.html;
                        latexWasRendered = true;
                        console.log(`[Preview] Pre-rendered LaTeX in ${result.count} DataGame(s)`);
                    }
                } catch (error) {
                    console.warn('[Preview] DataGame LaTeX pre-render failed:', error);
                }
            }

            // Pre-render visible LaTeX to SVG+MathML if hook is provided
            // This processes ALL body content including navigation, headers, and pages
            // The DOM-based pre-renderer safely skips script, style, code, pre elements
            if (options.preRenderLatex) {
                try {
                    const result = await options.preRenderLatex(finalBodyContent);
                    if (result.latexRendered) {
                        finalBodyContent = result.html;
                        latexWasRendered = true;
                        console.log(`[Preview] Pre-rendered ${result.count} LaTeX expressions to SVG+MathML`);
                    }
                } catch (error) {
                    console.warn('[Preview] LaTeX pre-render failed, falling back to MathJax:', error);
                }
            }
        }

        // Pre-render Mermaid diagrams to static SVG if hook is provided
        // This eliminates the need for the ~2.7MB Mermaid library
        if (options.preRenderMermaid) {
            try {
                const result = await options.preRenderMermaid(finalBodyContent);
                if (result.mermaidRendered) {
                    finalBodyContent = result.html;
                    mermaidWasRendered = true;
                    console.log(`[Preview] Pre-rendered ${result.count} Mermaid diagram(s) to SVG`);
                }
            } catch (error) {
                console.warn('[Preview] Mermaid pre-render failed, falling back to Mermaid library:', error);
            }
        }

        // Detect required libraries by scanning body content (after pre-rendering)
        const libraryDetector = new LibraryDetector();
        const detectedLibraries = libraryDetector.detectLibraries(finalBodyContent, {
            includeAccessibilityToolbar: addAccessibilityToolbar,
            includeMathJax: meta.addMathJax === true,
            skipMathJax: latexWasRendered && !meta.addMathJax,
            skipMermaid: mermaidWasRendered,
        });

        // For preview with download-source-file: use postMessage to parent instead of embedding manifest
        // This is much simpler than embedding the full contentXml in the preview
        const elpxDownloadScript = needsElpxDownload ? this.generatePreviewDownloadScript() : '';

        return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generateWebsitePreviewHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar, detectedLibraries)}
</head>
<body class="exe-web-site exe-preview" lang="${lang}">
<script>document.body.className+=" js"</script>
${finalBodyContent}
${searchDataScript}
${elpxDownloadScript}
${this.generateWebsitePreviewScripts(themeName, usedIdevices, options, needsElpxDownload, addAccessibilityToolbar, detectedLibraries)}
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
        detectedLibraries: { libraries: Array<{ name: string; files: string[] }>; files: string[]; count: number } = {
            libraries: [],
            files: [],
            count: 0,
        },
    ): string {
        const bootstrapCss = this.getVersionedPath('/libs/bootstrap/bootstrap.min.css', options);
        // Use themeUrl from options if provided (handles admin themes), otherwise construct from name
        const themeBasePath = options.themeUrl
            ? options.themeUrl.replace(/\/$/, '') // Remove trailing slash if present
            : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
        const themeCss = `${themeBasePath}/style.css`;
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

        // Build detected library CSS links
        let detectedLibraryCss = '';
        for (const file of detectedLibraries.files) {
            if (file.endsWith('.css')) {
                // Map library path to correct server path (/libs/ or /app/common/)
                const serverPath = this.getLibraryServerPath(file, options);
                detectedLibraryCss += `\n<link rel="stylesheet" href="${serverPath}" onerror="this.remove()">`;
            }
        }

        let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Preview</title>
<script>document.querySelector("html").classList.add("js");</script>
<script>
// jQuery shim - captures $(fn) calls from legacy inline scripts until jQuery loads
(function() {
    var queue = [];
    var jQueryReady = function(fn) {
        if (typeof fn === 'function') queue.push(fn);
        return jQueryReady;
    };
    window.$ = window.jQuery = jQueryReady;
    window.__jQueryShimQueue = queue;
})();
</script>

<!-- Server-hosted libraries (versioned paths) -->
<link rel="stylesheet" href="${bootstrapCss}">${jqueryUiCssLink}${detectedLibraryCss}

<!-- Preview-only CSS for SPA behavior -->
<style>
${this.getWebsitePreviewCss()}
</style>

<!-- Theme from server (loads AFTER fallback, so theme wins) -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">`;

        // iDevice CSS from server
        // Scan export folder for ALL CSS files to include any additional styles
        const seen = new Set<string>();
        for (const idevice of usedIdevices) {
            const typeName = normalizeIdeviceType(idevice);

            if (!seen.has(typeName)) {
                seen.add(typeName);
                // Get ALL CSS files from export folder
                const cssFiles = getIdeviceExportFiles(typeName, '.css');
                for (const cssFile of cssFiles) {
                    const ideviceCss = this.getVersionedPath(
                        `/files/perm/idevices/base/${typeName}/export/${cssFile}`,
                        options,
                    );
                    head += `\n<link rel="stylesheet" href="${ideviceCss}" onerror="this.remove()">`;
                }
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

/* JavaScript on/off visibility (feedback toggle support) */
.js-hidden { display: none; }
.exe-hidden, .js-required, .js .js-hidden, .exe-mindmap-code { display: none; }
.js .js-required { display: block; }

/* Teacher mode - hide teacher-only content by default */
html:not(.mode-teacher) .js .teacher-only {
    display: none !important;
}

/* Block minimized - hide content */
.exe-export article.minimized .box-content {
    display: none;
}

/* Block novisible - hide entire block */
.exe-export article.novisible.box {
    display: none !important;
}

/* iDevice novisible - hide iDevice within block */
.exe-export article.box .idevice_node.novisible {
    display: none !important;
}

/* Navigation link fixes (theme fallback) */
#siteNav a {
    text-decoration: none;
}

/* Navigation: Expand active sections and parent paths */
#siteNav .other-section {
    display: none;
}
#siteNav li.active > .other-section,
#siteNav li.current-page-parent > .other-section {
    display: block;
}

/* Button text hiding - visually hidden but accessible */
/* Note: .nav-button span text is now visible to match export output */
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
.nav-button.disabled { opacity: 0.5; pointer-events: none; }

/* Pre-rendered LaTeX (SVG+MathML) - when MathJax is not included */
.exe-math-rendered { display: inline-block; vertical-align: middle; }
.exe-math-rendered[data-display="block"] { display: block; text-align: center; margin: 1em 0; }
.exe-math-rendered svg { vertical-align: middle; max-width: 100%; height: auto; }
/* Fix for MathJax array/table borders - SVG has stroke-width:0 which hides lines */
.exe-math-rendered svg line.mjx-solid { stroke-width: 60 !important; }
.exe-math-rendered svg rect[data-frame="true"] { fill: none; stroke-width: 60 !important; }
/* Hide MathML visually but keep accessible for screen readers */
.exe-math-rendered math { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* Pre-rendered Mermaid (static SVG) - when Mermaid library is not included */
.exe-mermaid-rendered { display: block; text-align: center; margin: 1.5em 0; }
.exe-mermaid-rendered svg { max-width: 100%; height: auto; }`;
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
}

`;
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
     * Check if a page is visible in export
     * First page is always visible regardless of visibility setting.
     * If a parent is hidden, all its children are also hidden.
     */
    private isPageVisible(page: ExportPage, allPages: ExportPage[]): boolean {
        // First page is always visible
        if (page.id === allPages[0]?.id) {
            return true;
        }

        // Check this page's visibility property
        const visibility = page.properties?.visibility;
        if (visibility === false || visibility === 'false') {
            return false;
        }

        // Check if any ancestor is hidden (recursive)
        if (page.parentId) {
            const parent = allPages.find(p => p.id === page.parentId);
            if (parent && !this.isPageVisible(parent, allPages)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a page has highlight property enabled
     */
    private isPageHighlighted(page: ExportPage): boolean {
        const highlight = page.properties?.highlight;
        return highlight === true || highlight === 'true';
    }

    /**
     * Check if a page's title should be hidden
     */
    private shouldHidePageTitle(page: ExportPage): boolean {
        const hideTitle = page.properties?.hidePageTitle;
        return hideTitle === true || hideTitle === 'true';
    }

    /**
     * Get effective page title (respects editableInPage + titlePage properties)
     * If editableInPage is true and titlePage is set, use titlePage
     * Otherwise use the default page title
     */
    private getEffectivePageTitle(page: ExportPage): string {
        const editableInPage = page.properties?.editableInPage;
        if (editableInPage === true || editableInPage === 'true') {
            const titlePage = page.properties?.titlePage as string;
            if (titlePage) return titlePage;
        }
        return page.title;
    }

    /**
     * Render a navigation item for SPA
     */
    private renderSpaNavItem(page: ExportPage, allPages: ExportPage[], currentPageId?: string): string {
        // Skip hidden pages
        if (!this.isPageVisible(page, allPages)) {
            return '';
        }

        // Filter children to only visible ones
        const children = allPages.filter(p => p.parentId === page.id && this.isPageVisible(p, allPages));
        const hasChildren = children.length > 0;
        const isActive = page.id === currentPageId;
        const isFirstPage = page.id === allPages[0]?.id;

        // Build link classes: main-node for first page, active if current, daddy/no-ch based on children
        const linkClasses: string[] = [];
        if (isActive) linkClasses.push('active');
        if (isFirstPage) linkClasses.push('main-node');
        linkClasses.push(hasChildren ? 'daddy' : 'no-ch');

        // Add highlighted-link class if page is highlighted
        if (this.isPageHighlighted(page)) {
            linkClasses.push('highlighted-link');
        }

        let html = `<li${isActive ? ' id="active" class="active"' : ''}>`;
        const parentAttr = page.parentId ? ` data-parent-id="${page.parentId}"` : '';
        html += ` <a href="#" data-page-id="${page.id}"${parentAttr} class="${linkClasses.join(' ')}">${this.escapeHtml(page.title)}</a>\n`;

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
     * Note: Header is rendered separately as direct child of .page for CSS selector compatibility
     */
    private renderPageArticle(
        page: ExportPage,
        isFirst: boolean,
        pageIndex: number,
        _totalPages: number,
        _projectTitle: string,
        options: PreviewOptions,
        _addPagination: boolean = false,
        themeName: string = 'base',
    ): string {
        let blockHtml = '';

        // Use versioned path for iDevice resources
        const ideviceBasePath = this.getVersionedPath('/files/perm/idevices/base/', options);

        // Build theme icon path for preview
        // Theme icons are at /files/perm/themes/{themeBase}/{themeVariant}/icons/
        // Use themeUrl from options if provided (handles admin themes)
        const themeBase = options.themeUrl
            ? options.themeUrl.replace(/\/$/, '')
            : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
        const themeIconBasePath = `${themeBase}/icons/`;

        // Render blocks and components
        for (const block of page.blocks || []) {
            blockHtml += this.ideviceRenderer.renderBlock(block, {
                basePath: ideviceBasePath,
                includeDataAttributes: true,
                themeIconBasePath,
            });
        }

        const displayStyle = isFirst ? '' : ' style="display:none"';
        const pageId = page.id;

        // Store page title properties as data attributes for SPA navigation to update header
        const effectiveTitle = this.getEffectivePageTitle(page);
        const hideTitle = this.shouldHidePageTitle(page);
        const headerStyle = hideTitle ? ' style="display:none"' : '';

        // Include page header INSIDE page-content so it inherits the same padding as content
        // This ensures title alignment matches content regardless of theme (default=20px, flux=60px)
        const pageHeaderHtml = `<header class="page-header page-header-spa"${headerStyle}><h2 class="page-title">${this.escapeHtml(effectiveTitle)}</h2></header>`;

        return `<article id="page-${pageId}" class="spa-page${isFirst ? ' active' : ''}"${displayStyle} data-page-index="${pageIndex}" data-page-title="${this.escapeAttr(effectiveTitle)}" data-page-hide-title="${hideTitle}">
<div id="page-content-${pageId}" class="page-content">
${pageHeaderHtml}
${blockHtml}
</div>
</article>
`;
    }

    /**
     * Render navigation buttons (Previous/Next) with translated text
     * @param language - Language for button text translation
     */
    private renderNavButtons(language: string = 'en'): string {
        const t = WebsitePreviewExporter.NAV_TRANSLATIONS[language] || WebsitePreviewExporter.NAV_TRANSLATIONS.en;
        return `<div class="nav-buttons">
<a href="#" title="${t.previous}" class="nav-button nav-button-left" data-nav="prev">
<span>${t.previous}</span>
</a>
<a href="#" title="${t.next}" class="nav-button nav-button-right" data-nav="next">
<span>${t.next}</span>
</a>
</div>`;
    }

    /**
     * Render footer section with license and optional user footer content
     * Matches the structure from PageRenderer.renderFooterSection()
     */
    private renderFooterSection(options: { license: string; licenseUrl?: string; userFooterContent?: string }): string {
        const { license, licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/', userFooterContent } = options;

        let userFooterHtml = '';
        if (userFooterContent) {
            userFooterHtml = `<div id="siteUserFooter"> <div>${userFooterContent}</div>\n</div>`;
        }

        return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${this.escapeHtml(license)}</a></p>
</div>
${userFooterHtml}</div></footer>`;
    }

    /**
     * Navigation button translations by language
     */
    private static readonly NAV_TRANSLATIONS: Record<string, { previous: string; next: string }> = {
        es: { previous: 'Anterior', next: 'Siguiente' },
        en: { previous: 'Previous', next: 'Next' },
        ca: { previous: 'Anterior', next: 'Següent' },
        eu: { previous: 'Aurrekoa', next: 'Hurrengoa' },
        gl: { previous: 'Anterior', next: 'Seguinte' },
        pt: { previous: 'Anterior', next: 'Próximo' },
        fr: { previous: 'Précédent', next: 'Suivant' },
        de: { previous: 'Zurück', next: 'Weiter' },
        it: { previous: 'Precedente', next: 'Successivo' },
        nl: { previous: 'Vorige', next: 'Volgende' },
        zh: { previous: '上一页', next: '下一页' },
        ja: { previous: '前へ', next: '次へ' },
        ar: { previous: 'السابق', next: 'التالي' },
    };

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
        detectedLibraries: { libraries: Array<{ name: string; files: string[] }>; files: string[]; count: number } = {
            libraries: [],
            files: [],
            count: 0,
        },
    ): string {
        const jqueryJs = this.getVersionedPath('/libs/jquery/jquery.min.js', options);
        const bootstrapJs = this.getVersionedPath('/libs/bootstrap/bootstrap.bundle.min.js', options);
        const commonJs = this.getVersionedPath('/app/common/common.js', options);
        const commonI18nJs = this.getVersionedPath('/app/common/common_i18n.js', options);
        const exeExportJs = this.getVersionedPath('/app/common/exe_export.js', options);
        // Use themeUrl from options if provided (handles admin themes)
        const themeBasePath = options.themeUrl
            ? options.themeUrl.replace(/\/$/, '')
            : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
        const themeJs = `${themeBasePath}/style.js`;

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

        // ELPX download: In preview mode, we use postMessage to parent (defined in generatePreviewDownloadScript)
        // No need for fflate or exe_elpx_download.js - they are only needed in actual HTML5 exports
        const elpxDownloadScripts = ''; // Kept for signature compatibility

        // Check if MathJax is needed (exe_math library detected)
        const needsMathJax = detectedLibraries.libraries.some(
            lib => lib.name === 'exe_math' || lib.name === 'exe_math_datagame',
        );

        // MathJax configuration and script - must be set BEFORE loading the script
        // For SPA preview: disable auto-typeset and only process active pages
        let mathJaxScripts = '';
        if (needsMathJax) {
            const mathJaxJs = this.getVersionedPath('/app/common/exe_math/tex-mml-svg.js', options);
            mathJaxScripts = `\n<script>
window.MathJax = {
    startup: {
        typeset: false,  // Disable auto-typeset on page load
        pageReady: function() {
            // Only typeset the active SPA page (prevents replaceChild errors on hidden pages)
            var activePage = document.querySelector('.spa-page.active');
            if (activePage) {
                return MathJax.typesetPromise([activePage]).catch(function(err) {
                    console.warn('[MathJax] Typeset error:', err.message);
                });
            }
            return Promise.resolve();
        }
    }
};
</script>
<script src="${mathJaxJs}"></script>`;
        }

        // Build detected library JS scripts
        // Skip exe_elpx_download and fflate in preview - we use postMessage instead
        let detectedLibraryScripts = '';
        for (const file of detectedLibraries.files) {
            if (file.endsWith('.js')) {
                // Skip ELPX download libraries in preview - we define inline downloadElpx via postMessage
                if (needsElpxDownload && (file.includes('exe_elpx_download') || file.includes('fflate'))) {
                    continue;
                }
                // Map library path to correct server path (/libs/ or /app/common/)
                const serverPath = this.getLibraryServerPath(file, options);
                detectedLibraryScripts += `\n<script src="${serverPath}" onerror="this.remove()"></script>`;
            }
        }

        // iDevice scripts
        // Scan export folder for ALL JS files to include dependencies like html2canvas.js
        let ideviceScripts = '';
        const seenJs = new Set<string>();
        for (const idevice of usedIdevices) {
            const typeName = normalizeIdeviceType(idevice);

            if (!seenJs.has(typeName)) {
                seenJs.add(typeName);
                // Get ALL JS files from export folder (main file first, then dependencies)
                const jsFiles = getIdeviceExportFiles(typeName, '.js');
                for (const jsFile of jsFiles) {
                    const ideviceJs = this.getVersionedPath(
                        `/files/perm/idevices/base/${typeName}/export/${jsFile}`,
                        options,
                    );
                    ideviceScripts += `\n<script src="${ideviceJs}" onerror="this.remove()"></script>`;
                }
            }
        }

        // Accessibility toolbar script
        let atoolsScript = '';
        if (addAccessibilityToolbar) {
            const atoolsJs = this.getVersionedPath('/libs/exe_atools/exe_atools.js', options);
            atoolsScript = `\n<script src="${atoolsJs}"></script>`;
        }

        return `<script src="${jqueryJs}"></script>
<script>
// Execute queued callbacks from jQuery shim (legacy inline scripts)
if (window.__jQueryShimQueue) {
    window.__jQueryShimQueue.forEach(function(fn) { $(fn); });
    delete window.__jQueryShimQueue;
}
</script>
<script src="${bootstrapJs}"></script>${jqueryUiScript}${elpxDownloadScripts}
<script src="${commonJs}"></script>
<script src="${commonI18nJs}"></script>
<script src="${exeExportJs}"></script>${mathJaxScripts}${detectedLibraryScripts}${ideviceScripts}${atoolsScript}
<script src="${themeJs}" onerror="this.remove()"></script>
<script>
// Polyfill for confirm/alert/prompt in sandboxed iframes (preview mode)
// These are blocked by default in blob: URLs, so we provide custom implementations
(function() {
    if (typeof window.confirm === 'undefined' || window.confirm.toString().includes('native code')) {
        var originalConfirm = window.confirm;
        window.confirm = function(message) {
            try {
                return originalConfirm.call(window, message);
            } catch (e) {
                // Sandboxed - show Bootstrap modal if available, otherwise return true
                if (typeof $ !== 'undefined' && $.fn.modal) {
                    return new Promise(function(resolve) {
                        var modalId = 'exeConfirmModal';
                        var $modal = $('#' + modalId);
                        if (!$modal.length) {
                            $modal = $('<div class="modal fade" id="' + modalId + '" tabindex="-1">' +
                                '<div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
                                '<div class="modal-body text-center py-4"></div>' +
                                '<div class="modal-footer justify-content-center">' +
                                '<button type="button" class="btn btn-secondary" data-result="false">Cancelar</button>' +
                                '<button type="button" class="btn btn-primary" data-result="true">Aceptar</button>' +
                                '</div></div></div></div>');
                            $('body').append($modal);
                        }
                        $modal.find('.modal-body').text(message);
                        $modal.find('button').off('click').on('click', function() {
                            var result = $(this).data('result');
                            $modal.modal('hide');
                            resolve(result);
                        });
                        $modal.modal('show');
                    });
                }
                // Fallback: just return true in preview mode
                console.log('[Preview] confirm() blocked by sandbox, returning true:', message);
                return true;
            }
        };
    }
    if (typeof window.alert === 'undefined' || window.alert.toString().includes('native code')) {
        var originalAlert = window.alert;
        window.alert = function(message) {
            try {
                return originalAlert.call(window, message);
            } catch (e) {
                console.log('[Preview] alert():', message);
            }
        };
    }
})();

${this.getSpaNavigationScript()}
${this.getYouTubePreviewTransformScript(options)}
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
  var pageCounterEl = document.querySelector('.page-counter-current-page');
  var currentIndex = 0;

  function showPage(index) {
    if (index < 0 || index >= pages.length) return;
    currentIndex = index;
    var activePage = pages[index];
    pages.forEach(function(p, i) {
      p.style.display = i === index ? 'block' : 'none';
      p.classList.toggle('active', i === index);
    });
    // Build parentId map for ancestor tracking
    var parentMap = {};
    navLinks.forEach(function(link) {
      var pageId = link.getAttribute('data-page-id');
      var parentId = link.getAttribute('data-parent-id');
      if (pageId) parentMap[pageId] = parentId;
    });

    // Find ancestors of current page
    var currentPageId = activePage.id.replace('page-', '');
    var ancestors = {};
    var pid = parentMap[currentPageId];
    while (pid) {
      ancestors[pid] = true;
      pid = parentMap[pid];
    }

    // Update nav classes including ancestor expansion
    navLinks.forEach(function(link) {
      var pageId = link.getAttribute('data-page-id');
      var isActive = currentPageId === pageId;
      var isAncestor = ancestors[pageId] === true;
      link.classList.toggle('active', isActive);
      if (link.parentElement) {
        link.parentElement.classList.toggle('active', isActive);
        link.parentElement.classList.toggle('current-page-parent', isAncestor);
      }
    });
    // Page header is inside each article (page-header-spa class)
    if (pageCounterEl) {
      pageCounterEl.textContent = (index + 1).toString();
    }
    updateNavButtons();
    // Typeset MathJax on the active page if MathJax is loaded
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
      MathJax.typesetPromise([activePage]).catch(function(e) {
        console.warn('[MathJax] Typeset error:', e.message);
      });
    }
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

  // Enable internal links (exe-node:pageId format)
  // These are links created in the TinyMCE editor that point to other pages
  function enableInternalLinks() {
    var internalLinks = document.querySelectorAll('a[href^="exe-node:"]');
    internalLinks.forEach(function(link) {
      var href = link.getAttribute('href') || '';
      // Extract page ID: exe-node:page-abc123 -> page-abc123
      var pageId = href.replace('exe-node:', '');

      // Find the page index
      var targetIndex = -1;
      for (var i = 0; i < pages.length; i++) {
        if (pages[i].id === 'page-' + pageId) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex >= 0) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          showPage(targetIndex);
        });
        // Update href for accessibility (shows target in status bar)
        link.setAttribute('href', '#page-' + pageId);
      }
    });
  }

  // Enable internal links after initial render
  enableInternalLinks();

  // MathJax typesets each page when it becomes active (if MathJax is loaded)
  updateNavButtons();
})();`;
    }

    /**
     * Get YouTube preview transform script
     *
     * YOUTUBE EMBEDDING RESTRICTION:
     * YouTube's IFrame Player API requires a valid HTTP/HTTPS origin to function.
     * The preview panel loads content via blob: URLs (e.g., blob:http://localhost:8080/...),
     * which have a null origin that YouTube rejects with "Error 153".
     *
     * SOLUTION:
     * This script detects when running in a blob:/file: context and automatically
     * transforms all YouTube iframe src attributes to point to our HTTP wrapper
     * (youtube-preview.html). The wrapper is served from a valid HTTP origin,
     * so YouTube embeds work correctly inside it.
     *
     * TRANSFORM FLOW:
     * 1. Script detects blob: context
     * 2. Extracts the real HTTP origin from the blob URL
     * 3. Finds all YouTube iframes in the document
     * 4. Replaces their src with: {httpOrigin}/app/common/youtube-preview.html?v={videoId}
     * 5. MutationObserver watches for dynamically added iframes
     *
     * This script only runs in preview mode (blob:/file: contexts).
     * In normal HTTP exports, YouTube embeds work without transformation.
     *
     * @see public/app/common/youtube-preview.html - The HTTP wrapper that loads YouTube
     */
    private getYouTubePreviewTransformScript(options: PreviewOptions): string {
        const basePath = options.basePath || '';
        return `// YouTube Preview Transform (for blob:/file: contexts)
(function() {
    'use strict';

    // Only run in blob: or file: contexts where YouTube embeds fail
    var href = window.location.href;
    var isBlob = href.startsWith('blob:');
    var isFile = window.location.protocol === 'file:';

    if (!isBlob && !isFile) {
        return; // Normal HTTP context, YouTube works fine
    }

    // Extract HTTP origin from blob URL
    var httpOrigin = '';
    if (isBlob) {
        var match = href.match(/^blob:(https?:\\/\\/[^/]+)/);
        if (match) httpOrigin = match[1];
    }

    if (!httpOrigin) {
        console.warn('[YouTube Preview] Cannot determine HTTP origin for wrapper');
        return;
    }

    var basePath = '${basePath}';
    var wrapperBase = httpOrigin + basePath + '/app/common/youtube-preview.html';

    // YouTube URL patterns to extract video ID
    var youtubePatterns = [
        /(?:youtube\\.com\\/embed\\/|youtube-nocookie\\.com\\/embed\\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/)([a-zA-Z0-9_-]{11})/
    ];

    function extractVideoId(src) {
        if (!src) return null;
        for (var i = 0; i < youtubePatterns.length; i++) {
            var match = src.match(youtubePatterns[i]);
            if (match) return match[1];
        }
        return null;
    }

    function extractParams(src) {
        var params = {};
        try {
            // Handle protocol-relative URLs
            var fullUrl = src;
            if (src.startsWith('//')) fullUrl = 'https:' + src;
            var url = new URL(fullUrl);
            url.searchParams.forEach(function(value, key) {
                params[key] = value;
            });
        } catch (e) {
            // Try to extract from query string manually
            var qIdx = src.indexOf('?');
            if (qIdx !== -1) {
                var qs = src.substring(qIdx + 1);
                qs.split('&').forEach(function(part) {
                    var kv = part.split('=');
                    if (kv.length === 2) params[kv[0]] = kv[1];
                });
            }
        }
        return params;
    }

    function transformYouTubeIframe(iframe) {
        var src = iframe.getAttribute('src') || '';
        var videoId = extractVideoId(src);

        if (!videoId) return false;

        // Check if already transformed
        if (iframe.dataset.youtubeTransformed === 'true') return false;

        // Build wrapper URL preserving original parameters
        var params = extractParams(src);
        var wrapperUrl = wrapperBase + '?v=' + videoId;

        // Pass through relevant YouTube parameters
        var passParams = ['autoplay', 'start', 'end', 'mute', 'loop', 'controls', 'cc_load_policy'];
        passParams.forEach(function(p) {
            if (params[p] !== undefined) wrapperUrl += '&' + p + '=' + params[p];
        });

        // Preserve iframe dimensions
        var width = iframe.getAttribute('width');
        var height = iframe.getAttribute('height');
        if (width) wrapperUrl += '&w=' + width;
        if (height) wrapperUrl += '&h=' + height;

        // Transform the iframe
        iframe.dataset.originalSrc = src;
        iframe.dataset.youtubeTransformed = 'true';
        iframe.src = wrapperUrl;

        console.log('[YouTube Preview] Transformed embed:', videoId);
        return true;
    }

    function isYouTubeIframe(iframe) {
        var src = iframe.getAttribute('src') || '';
        return src.includes('youtube.com') ||
               src.includes('youtube-nocookie.com') ||
               src.includes('youtu.be');
    }

    function transformAllYouTubeIframes() {
        var iframes = document.querySelectorAll('iframe');
        var count = 0;
        iframes.forEach(function(iframe) {
            if (isYouTubeIframe(iframe) && transformYouTubeIframe(iframe)) {
                count++;
            }
        });
        if (count > 0) {
            console.log('[YouTube Preview] Transformed ' + count + ' YouTube embed(s)');
        }
    }

    // Transform existing iframes
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', transformAllYouTubeIframes);
    } else {
        transformAllYouTubeIframes();
    }

    // Watch for dynamically added iframes (some iDevices add content after load)
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType !== 1) return; // Not an element

                // Check if the added node is an iframe
                if (node.tagName === 'IFRAME' && isYouTubeIframe(node)) {
                    transformYouTubeIframe(node);
                }

                // Check children of added node
                if (node.querySelectorAll) {
                    var childIframes = node.querySelectorAll('iframe');
                    childIframes.forEach(function(iframe) {
                        if (isYouTubeIframe(iframe)) {
                            transformYouTubeIframe(iframe);
                        }
                    });
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
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
        // Escape </script> sequences to prevent premature script tag closing
        // Replace </ with <\/ which is valid in JSON strings but not parsed as closing tags
        const safeJson = searchDataJson.replace(/<\//g, '<\\/');
        return `<script>window.exeSearchData = ${safeJson};</script>`;
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

    /**
     * Generate inline script for preview that uses postMessage to request ELPX download
     * This is simpler than embedding the full manifest with contentXml
     */
    private generatePreviewDownloadScript(): string {
        return `<script>
// Preview mode: request ELPX download from parent app via postMessage
window.downloadElpx = function(options) {
    options = options || {};
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: 'exe-download-elpx',
            filename: options.filename
        }, '*');
    } else {
        alert('Download is only available when viewing from the eXeLearning editor.');
    }
};
</script>`;
    }
}
