/**
 * PrintPreviewExporter
 *
 * Generates a single-page HTML preview for printing.
 * All pages are rendered together in one document, optimized for print.
 *
 * Key differences from Html5Exporter:
 * - All pages visible at once (not SPA)
 * - Body class includes 'exe-single-page' for print styles
 * - Navigation uses anchor links (not JavaScript page switching)
 * - No prev/next buttons
 * - Optimized for @media print CSS rules
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
 * Options for print preview generation
 */
export interface PrintPreviewOptions {
    /** Base path for versioned URLs (e.g., 'http://localhost:3001') */
    baseUrl?: string;
    /** App version for cache busting */
    version?: string;
    /** Base path for URLs (e.g., '/exelearning') */
    basePath?: string;
    /**
     * Full theme URL from the themes manager (e.g., '/v1/site-files/themes/chiquito/')
     * When provided, this is used instead of constructing the path from theme name.
     */
    themeUrl?: string;
    /**
     * Optional hook to pre-render LaTeX expressions to SVG+MathML.
     * When provided and successful, MathJax library will NOT be included in the output.
     */
    preRenderLatex?: (html: string) => Promise<LatexPreRenderResult>;
    /**
     * Optional hook to pre-render LaTeX inside encrypted DataGame divs.
     */
    preRenderDataGameLatex?: (html: string) => Promise<{ html: string; count: number }>;
    /**
     * Optional hook to pre-render Mermaid diagrams to static SVG.
     * When provided and successful, Mermaid library (~2.7MB) will NOT be included.
     */
    preRenderMermaid?: (html: string) => Promise<MermaidPreRenderResult>;
}

/**
 * Result of print preview generation
 */
export interface PrintPreviewResult {
    success: boolean;
    html?: string;
    error?: string;
}

/**
 * PrintPreviewExporter class
 * Generates single-page HTML for printing
 */
export class PrintPreviewExporter {
    private document: ExportDocument;
    private ideviceRenderer: IdeviceRenderer;

    /**
     * Create a PrintPreviewExporter
     * @param document - Export document adapter
     * @param resourceProvider - Resource provider for theme/iDevice info
     */
    constructor(document: ExportDocument, resourceProvider: ResourceProvider) {
        this.document = document;
        this.ideviceRenderer = new IdeviceRenderer(resourceProvider);
    }

    /**
     * Generate print preview HTML
     * @param options - Preview options
     * @returns Preview result with HTML string
     */
    async generatePreview(options: PrintPreviewOptions = {}): Promise<PrintPreviewResult> {
        try {
            const pages = this.document.getNavigation();
            const meta = this.document.getMetadata();

            if (pages.length === 0) {
                return { success: false, error: 'No pages to preview' };
            }

            // Get all used iDevice types
            const usedIdevices = this.getUsedIdevices(pages);

            // Generate the single-page HTML
            const html = await this.generateSinglePageHtml(pages, meta, usedIdevices, options);

            return { success: true, html };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, error: errorMessage };
        }
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
     */
    private getVersionedPath(path: string, options: PrintPreviewOptions): string {
        const baseUrl = options.baseUrl || '';
        const basePath = options.basePath || '';
        const version = options.version || 'v1.0.0';
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `${baseUrl}${basePath}/${version}/${cleanPath}`;
    }

    /**
     * Libraries that are located in /libs/ instead of /app/common/
     */
    private static readonly LIBS_FOLDER_LIBRARIES = new Set(['jquery-ui', 'fflate', 'exe_atools', 'exe_elpx_download']);

    /**
     * Get the correct server path for a detected library file
     */
    private getLibraryServerPath(file: string, options: PrintPreviewOptions): string {
        const firstPart = file.split('/')[0];
        if (
            PrintPreviewExporter.LIBS_FOLDER_LIBRARIES.has(firstPart) ||
            PrintPreviewExporter.LIBS_FOLDER_LIBRARIES.has(file)
        ) {
            return this.getVersionedPath(`/libs/${file}`, options);
        }
        return this.getVersionedPath(`/app/common/${file}`, options);
    }

    /**
     * Check if a page is visible in export
     */
    private isPageVisible(page: ExportPage, allPages: ExportPage[]): boolean {
        if (page.id === allPages[0]?.id) {
            return true;
        }
        const visibility = page.properties?.visibility;
        if (visibility === false || visibility === 'false') {
            return false;
        }
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
     * Get effective page title
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
     * Generate complete single-page HTML for printing
     */
    private async generateSinglePageHtml(
        pages: ExportPage[],
        meta: ReturnType<ExportDocument['getMetadata']>,
        usedIdevices: string[],
        options: PrintPreviewOptions,
    ): Promise<string> {
        const lang = meta.language || 'en';
        const projectTitle = meta.title || 'eXeLearning';
        const customStyles = meta.customStyles || '';
        const license = meta.license || 'CC-BY-SA';
        const themeName = meta.theme || 'base';
        const userFooterContent = meta.footer || '';

        // Export options
        const addExeLink = meta.addExeLink ?? true;
        const addAccessibilityToolbar = meta.addAccessibilityToolbar ?? false;

        // Filter to only visible pages
        const visiblePages = pages.filter(page => this.isPageVisible(page, pages));

        // Generate all page sections (all visible at once)
        let sectionsHtml = '';
        for (const page of visiblePages) {
            sectionsHtml += this.renderPageSection(page, options, themeName);
        }

        // Render "Made with eXeLearning"
        const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe(lang) : '';

        // Build the body content
        const bodyContent = `<div class="exe-content exe-export pre-js">
${this.renderSinglePageNav(pages)}
<main class="single-page-content">
<header class="package-header"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1></header>
${sectionsHtml}
</main>
${this.renderFooterSection({ license, userFooterContent })}
</div>
${madeWithExeHtml}`;

        // Pre-render LaTeX if needed
        let finalBodyContent = bodyContent;
        let latexWasRendered = false;
        let mermaidWasRendered = false;
        if (!meta.addMathJax) {
            if (options.preRenderDataGameLatex) {
                try {
                    const result = await options.preRenderDataGameLatex(bodyContent);
                    if (result.count > 0) {
                        finalBodyContent = result.html;
                        latexWasRendered = true;
                    }
                } catch (error) {
                    console.warn('[PrintPreview] DataGame LaTeX pre-render failed:', error);
                }
            }
            if (options.preRenderLatex) {
                try {
                    const result = await options.preRenderLatex(finalBodyContent);
                    if (result.latexRendered) {
                        finalBodyContent = result.html;
                        latexWasRendered = true;
                    }
                } catch (error) {
                    console.warn('[PrintPreview] LaTeX pre-render failed:', error);
                }
            }
        }

        // Pre-render Mermaid diagrams to static SVG if hook is provided
        if (options.preRenderMermaid) {
            try {
                const result = await options.preRenderMermaid(finalBodyContent);
                if (result.mermaidRendered) {
                    finalBodyContent = result.html;
                    mermaidWasRendered = true;
                    console.log(`[PrintPreview] Pre-rendered ${result.count} Mermaid diagram(s) to SVG`);
                }
            } catch (error) {
                console.warn('[PrintPreview] Mermaid pre-render failed:', error);
            }
        }

        // Detect required libraries
        const libraryDetector = new LibraryDetector();
        const detectedLibraries = libraryDetector.detectLibraries(finalBodyContent, {
            includeAccessibilityToolbar: addAccessibilityToolbar,
            includeMathJax: meta.addMathJax === true,
            skipMathJax: latexWasRendered && !meta.addMathJax,
            skipMermaid: mermaidWasRendered,
        });

        return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${this.generateHead(themeName, usedIdevices, projectTitle, customStyles, options, addAccessibilityToolbar, detectedLibraries)}
</head>
<body class="exe-web-site exe-export exe-single-page exe-preview">
<script>document.body.className+=" js"</script>
${finalBodyContent}
${this.generateScripts(themeName, usedIdevices, options, addAccessibilityToolbar, detectedLibraries)}
</body>
</html>`;
    }

    /**
     * Render a page as a section (for single-page layout)
     */
    private renderPageSection(page: ExportPage, options: PrintPreviewOptions, themeName: string = 'base'): string {
        const hideTitle = this.shouldHidePageTitle(page);
        const effectiveTitle = this.getEffectivePageTitle(page);
        const headerStyle = hideTitle ? ' style="display:none"' : '';

        const ideviceBasePath = this.getVersionedPath('/files/perm/idevices/base/', options);
        // Use themeUrl from options if provided (handles admin themes)
        const themeBase = options.themeUrl
            ? options.themeUrl.replace(/\/$/, '')
            : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
        const themeIconBasePath = `${themeBase}/icons/`;

        let blockHtml = '';
        for (const block of page.blocks || []) {
            blockHtml += this.ideviceRenderer.renderBlock(block, {
                basePath: ideviceBasePath,
                includeDataAttributes: true,
                themeIconBasePath,
            });
        }

        return `<section id="section-${page.id}" class="single-page-section">
<header class="page-header"${headerStyle}>
<h2 class="page-title">${this.escapeHtml(effectiveTitle)}</h2>
</header>
<div class="page-content">
${blockHtml}
</div>
</section>
`;
    }

    /**
     * Render navigation for single-page (anchor links)
     */
    private renderSinglePageNav(pages: ExportPage[]): string {
        const rootPages = pages.filter(p => !p.parentId);

        let html = '<nav id="siteNav" class="single-page-nav">\n<ul>\n';
        for (const page of rootPages) {
            html += this.renderNavItem(page, pages);
        }
        html += '</ul>\n</nav>';

        return html;
    }

    /**
     * Render a navigation item for single-page (anchor links)
     */
    private renderNavItem(page: ExportPage, allPages: ExportPage[]): string {
        if (!this.isPageVisible(page, allPages)) {
            return '';
        }

        const children = allPages.filter(p => p.parentId === page.id && this.isPageVisible(p, allPages));
        const hasChildren = children.length > 0;

        const linkClasses: string[] = [];
        linkClasses.push(hasChildren ? 'daddy' : 'no-ch');
        if (this.isPageHighlighted(page)) {
            linkClasses.push('highlighted-link');
        }

        let html = '<li>';
        html += ` <a href="#section-${page.id}" class="${linkClasses.join(' ')}">${this.escapeHtml(page.title)}</a>\n`;

        if (hasChildren) {
            html += '<ul class="other-section">\n';
            for (const child of children) {
                html += this.renderNavItem(child, allPages);
            }
            html += '</ul>\n';
        }

        html += '</li>\n';
        return html;
    }

    /**
     * Render footer section
     */
    private renderFooterSection(options: { license: string; licenseUrl?: string; userFooterContent?: string }): string {
        const { license, licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/', userFooterContent } = options;

        let userFooterHtml = '';
        if (userFooterContent) {
            userFooterHtml = `<div id="siteUserFooter"><div>${userFooterContent}</div></div>`;
        }

        return `<footer id="siteFooter"><div id="siteFooterContent"><div id="packageLicense" class="cc cc-by-sa"><p><span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${this.escapeHtml(license)}</a></p>
</div>
${userFooterHtml}</div></footer>`;
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
     * Render "Made with eXeLearning" credit
     */
    private renderMadeWithEXe(lang: string): string {
        const text =
            PrintPreviewExporter.MADE_WITH_TRANSLATIONS[lang] || PrintPreviewExporter.MADE_WITH_TRANSLATIONS['en'];
        return `<p id="made-with-eXe"><a href="https://exelearning.net/" target="_blank" rel="noopener"><span>${this.escapeHtml(text)} </span></a></p>`;
    }

    /**
     * Generate <head> content
     */
    private generateHead(
        themeName: string,
        usedIdevices: string[],
        projectTitle: string,
        customStyles: string,
        options: PrintPreviewOptions,
        addAccessibilityToolbar: boolean = false,
        detectedLibraries: { libraries: Array<{ name: string; files: string[] }>; files: string[]; count: number } = {
            libraries: [],
            files: [],
            count: 0,
        },
    ): string {
        const bootstrapCss = this.getVersionedPath('/libs/bootstrap/bootstrap.min.css', options);
        // Use themeUrl from options if provided (handles admin themes)
        const themeBasePath = options.themeUrl
            ? options.themeUrl.replace(/\/$/, '')
            : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
        const themeCss = `${themeBasePath}/style.css`;
        const fallbackCss = this.getVersionedPath('/style/content.css', options);

        // Check if jQuery UI CSS is needed
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
                const serverPath = this.getLibraryServerPath(file, options);
                detectedLibraryCss += `\n<link rel="stylesheet" href="${serverPath}" onerror="this.remove()">`;
            }
        }

        let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net (Print Preview)">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)} - Print</title>
<script>document.querySelector("html").classList.add("js");</script>

<!-- Server-hosted libraries -->
<link rel="stylesheet" href="${bootstrapCss}">${jqueryUiCssLink}${detectedLibraryCss}

<!-- Print-specific CSS -->
<style>
${this.getPrintPreviewCss(options)}
</style>

<!-- Theme from server -->
<link rel="stylesheet" href="${themeCss}" onerror="this.href='${fallbackCss}'">`;

        // iDevice CSS
        const seen = new Set<string>();
        for (const idevice of usedIdevices) {
            const typeName = normalizeIdeviceType(idevice);
            if (!seen.has(typeName)) {
                seen.add(typeName);
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

        // Made-with-eXe CSS
        head += `\n<style>\n${this.getMadeWithExeCss(options)}\n</style>`;

        return head;
    }

    /**
     * Get print preview specific CSS
     */
    private getPrintPreviewCss(options: PrintPreviewOptions): string {
        return `/* Single-page Print Preview Styles */

/* All sections visible */
.single-page-section {
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 40px;
    margin-bottom: 40px;
}

.single-page-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

/* Navigation styling */
.single-page-nav {
    position: sticky;
    top: 0;
    max-height: 100vh;
    overflow-y: auto;
}

.single-page-content {
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

/* JavaScript visibility classes */
.js-hidden { display: none; }
.exe-hidden, .js-required, .js .js-hidden, .exe-mindmap-code { display: none; }
.js .js-required { display: block; }

/* Teacher mode - hide teacher-only content */
html:not(.mode-teacher) .js .teacher-only {
    display: none !important;
}

/* Block minimized - hide content */
.exe-export article.minimized .box-content {
    display: none;
}

/* Block/iDevice novisible */
.exe-export article.novisible.box {
    display: none !important;
}
.exe-export article.box .idevice_node.novisible {
    display: none !important;
}

/* Pre-rendered LaTeX */
.exe-math-rendered { display: inline-block; vertical-align: middle; }
.exe-math-rendered[data-display="block"] { display: block; text-align: center; margin: 1em 0; }
.exe-math-rendered svg { vertical-align: middle; max-width: 100%; height: auto; }
.exe-math-rendered svg line.mjx-solid { stroke-width: 60 !important; }
.exe-math-rendered svg rect[data-frame="true"] { fill: none; stroke-width: 60 !important; }
.exe-math-rendered math { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* Print-specific styles */
@media print {
    .single-page-nav {
        display: none;
    }
    .single-page-section {
        page-break-inside: avoid;
        border-bottom: none;
    }
    #made-with-eXe {
        display: none;
    }
    .nav-buttons {
        display: none;
    }
}`;
    }

    /**
     * Get Made-with-eXe CSS
     */
    private getMadeWithExeCss(options: PrintPreviewOptions): string {
        const logoUrl = this.getVersionedPath('/app/common/exe_powered_logo/exe_powered_logo.png', options);

        return `/* Made with eXeLearning */
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
     * Generate scripts section
     */
    private generateScripts(
        themeName: string,
        usedIdevices: string[],
        options: PrintPreviewOptions,
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
        // Use themeUrl from options if provided (handles admin themes), otherwise construct from name
        const themeJsBasePath = options.themeUrl
            ? options.themeUrl.replace(/\/$/, '') // Remove trailing slash if present
            : this.getVersionedPath(`/files/perm/themes/base/${themeName}`, options);
        const themeJs = `${themeJsBasePath}/style.js`;

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

        // Check if MathJax is needed
        const needsMathJax = detectedLibraries.libraries.some(
            lib => lib.name === 'exe_math' || lib.name === 'exe_math_datagame',
        );

        let mathJaxScripts = '';
        if (needsMathJax) {
            const mathJaxJs = this.getVersionedPath('/app/common/exe_math/tex-mml-svg.js', options);
            mathJaxScripts = `\n<script>
window.MathJax = {
    startup: {
        typeset: true
    }
};
</script>
<script src="${mathJaxJs}"></script>`;
        }

        // Build detected library JS scripts
        let detectedLibraryScripts = '';
        for (const file of detectedLibraries.files) {
            if (file.endsWith('.js')) {
                const serverPath = this.getLibraryServerPath(file, options);
                detectedLibraryScripts += `\n<script src="${serverPath}" onerror="this.remove()"></script>`;
            }
        }

        // iDevice scripts
        let ideviceScripts = '';
        const seenJs = new Set<string>();
        for (const idevice of usedIdevices) {
            const typeName = normalizeIdeviceType(idevice);
            if (!seenJs.has(typeName)) {
                seenJs.add(typeName);
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
<script src="${bootstrapJs}"></script>${jqueryUiScript}
<script src="${commonJs}"></script>
<script src="${commonI18nJs}"></script>
<script src="${exeExportJs}"></script>${mathJaxScripts}${detectedLibraryScripts}${ideviceScripts}${atoolsScript}
<script src="${themeJs}" onerror="this.remove()"></script>
<script>
// Initialize iDevices after DOM is ready
if (typeof $exeExport !== 'undefined' && $exeExport.init) {
    $exeExport.init();
}
</script>`;
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
}
