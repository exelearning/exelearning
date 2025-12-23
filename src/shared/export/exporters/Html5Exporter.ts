/**
 * Html5Exporter
 *
 * Exports a document to HTML5 website format (ZIP).
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
 */

import type {
    ExportDocument,
    ExportPage,
    ExportMetadata,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ExportOptions,
    ExportResult,
    Html5ExportOptions,
} from '../interfaces';
import { BaseExporter } from './BaseExporter';

export class Html5Exporter extends BaseExporter {
    constructor(document: ExportDocument, resources: ResourceProvider, assets: AssetProvider, zip: ZipProvider) {
        super(document, resources, assets, zip);
    }

    /**
     * Get file extension for HTML5 format
     */
    getFileExtension(): string {
        return '.zip';
    }

    /**
     * Get file suffix for HTML5 format
     */
    getFileSuffix(): string {
        return '_web';
    }

    /**
     * Export to HTML5 ZIP
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();
        const html5Options = options as Html5ExportOptions | undefined;

        try {
            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = html5Options?.theme || meta.theme || 'base';

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // 1. Generate HTML pages (with optional LaTeX pre-rendering)
            const pageHtmlMap = new Map<string, string>();
            let latexWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                let html = this.generatePageHtml(page, pages, meta, i === 0, i);

                // Pre-render LaTeX in encrypted DataGame divs FIRST
                // (game iDevices store questions in encrypted JSON)
                if (options?.preRenderDataGameLatex) {
                    try {
                        const result = await options.preRenderDataGameLatex(html);
                        if (result.count > 0) {
                            html = result.html;
                            latexWasRendered = true;
                            console.log(
                                `[Html5Exporter] Pre-rendered LaTeX in ${result.count} DataGame(s) on page: ${page.title}`,
                            );
                        }
                    } catch (error) {
                        console.warn('[Html5Exporter] DataGame LaTeX pre-render failed for page:', page.title, error);
                    }
                }

                // Pre-render visible LaTeX to SVG+MathML if hook is provided
                if (options?.preRenderLatex) {
                    try {
                        const result = await options.preRenderLatex(html);
                        if (result.latexRendered) {
                            html = result.html;
                            latexWasRendered = true;
                            console.log(
                                `[Html5Exporter] Pre-rendered ${result.count} LaTeX expressions on page: ${page.title}`,
                            );
                        }
                    } catch (error) {
                        console.warn('[Html5Exporter] LaTeX pre-render failed for page:', page.title, error);
                    }
                }

                // First page is index.html, others go in html/ directory
                const pageFilename = i === 0 ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
                pageHtmlMap.set(pageFilename, html);
            }

            // Add all pages to ZIP
            for (const [filename, html] of pageHtmlMap) {
                this.zip.addFile(filename, html);
            }

            // 2. Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '');
                this.zip.addFile('search_index.js', searchIndexContent);
            }

            // 3. Add content.xml (ODE format for re-import) - only if exportSource is enabled
            if (meta.exportSource !== false) {
                const contentXml = this.generateContentXml();
                this.zip.addFile('content.xml', contentXml);
            }

            // 4. Add base CSS (fetch from content/css) and pre-rendered LaTeX CSS
            const contentCssFiles = await this.resources.fetchContentCss();
            let baseCss = contentCssFiles.get('content/css/base.css');
            if (!baseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            // Append pre-rendered LaTeX CSS if LaTeX was rendered
            if (latexWasRendered) {
                const latexCss = this.getPreRenderedLatexCss();
                const decoder = new TextDecoder();
                const baseCssText = decoder.decode(baseCss);
                const encoder = new TextEncoder();
                baseCss = encoder.encode(baseCssText + '\n' + latexCss);
            }
            this.zip.addFile('content/css/base.css', baseCss);

            // 5. Add eXeLearning logo for "Made with eXeLearning" footer
            try {
                const logoData = await this.resources.fetchExeLogo();
                if (logoData) {
                    this.zip.addFile('content/img/exe_powered_logo.png', logoData);
                }
            } catch {
                // Logo not available - footer will still render but without background image
            }

            // 6. Fetch and add theme (renaming style.css -> content.css, style.js -> default.js)
            try {
                const themeFiles = await this.resources.fetchTheme(themeName);
                console.log(`[Html5Exporter] Theme '${themeName}' files count: ${themeFiles.size}`);
                for (const [filePath, content] of themeFiles) {
                    // Rename theme files to legacy export format
                    let exportPath = filePath;
                    if (filePath === 'style.css') {
                        exportPath = 'content.css';
                    } else if (filePath === 'style.js') {
                        exportPath = 'default.js';
                    }
                    console.log(`[Html5Exporter] Adding theme file: theme/${exportPath}`);
                    this.zip.addFile(`theme/${exportPath}`, content);
                }
            } catch (e) {
                // Add fallback theme if fetch fails (use legacy names)
                console.warn(`[Html5Exporter] Failed to fetch theme: ${themeName}`, e);
                this.zip.addFile('theme/content.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/default.js', this.getFallbackThemeJs());
            }

            // 7. Fetch base libraries (always included - jQuery, Bootstrap, exe_lightbox, etc.)
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [libPath, content] of baseLibs) {
                    this.zip.addFile(`libs/${libPath}`, content);
                }
            } catch {
                // Base libraries not available - continue anyway
            }

            // 8. Detect and fetch additional required libraries based on content
            // Skip MathJax if LaTeX was pre-rendered to SVG+MathML
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const allRequiredFiles = this.libraryDetector.getAllRequiredFiles(allHtmlContent, {
                includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                skipMathJax: latexWasRendered,
            });

            if (latexWasRendered) {
                console.log('[Html5Exporter] LaTeX pre-rendered - skipping MathJax library (~1MB saved)');
            }

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles);
                for (const [libPath, content] of libFiles) {
                    // Only add if not already added by base libraries
                    const zipPath = `libs/${libPath}`;
                    if (!this.zip.hasFile(zipPath)) {
                        this.zip.addFile(zipPath, content);
                    }
                }
            } catch {
                // Additional libraries not available - continue anyway
            }

            // 8. Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    // Normalize iDevice type to directory name (e.g., 'FreeTextIdevice' -> 'text')
                    const normalizedType = this.resources.normalizeIdeviceType(idevice);
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [filePath, content] of ideviceFiles) {
                        // Use normalized type for ZIP path
                        this.zip.addFile(`idevices/${normalizedType}/${filePath}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files - this is normal
                }
            }

            // 9. Add project assets
            await this.addAssetsToZipWithResourcePath();

            // 10. Generate ZIP buffer
            const buffer = await this.zip.generateAsync();

            return {
                success: true,
                filename: exportFilename,
                data: buffer,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Generate complete HTML for a page
     */
    generatePageHtml(
        page: ExportPage,
        allPages: ExportPage[],
        meta: ExportMetadata,
        isIndex: boolean,
        pageIndex?: number,
    ): string {
        const basePath = isIndex ? '' : '../';
        const usedIdevices = this.getUsedIdevicesForPage(page);
        const currentPageIndex = pageIndex ?? allPages.findIndex(p => p.id === page.id);

        return this.pageRenderer.render(page, {
            projectTitle: meta.title || 'eXeLearning',
            language: meta.language || 'en',
            theme: meta.theme || 'base',
            customStyles: meta.customStyles || '',
            allPages,
            basePath,
            isIndex,
            usedIdevices,
            author: meta.author || '',
            license: meta.license || 'creative commons: attribution - share alike 4.0',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/',
            // Page counter options
            totalPages: allPages.length,
            currentPageIndex,
            userFooterContent: meta.footer,
            // Export options
            addExeLink: meta.addExeLink ?? true,
            addPagination: meta.addPagination ?? false,
            addSearchBox: meta.addSearchBox ?? false,
            addAccessibilityToolbar: meta.addAccessibilityToolbar ?? false,
            // Custom head content
            extraHeadContent: meta.extraHeadContent,
        });
    }

    /**
     * Get page link for HTML5 export
     */
    getPageLinkForHtml5(page: ExportPage, allPages: ExportPage[], basePath: string): string {
        const isFirstPage = page.id === allPages[0]?.id;
        if (isFirstPage) {
            return basePath ? `${basePath}index.html` : 'index.html';
        }
        const filename = this.sanitizePageFilename(page.title);
        return `${basePath}html/${filename}.html`;
    }

    /**
     * Get CSS for pre-rendered LaTeX (SVG+MathML)
     * This CSS is needed when LaTeX is pre-rendered instead of using MathJax at runtime
     */
    protected getPreRenderedLatexCss(): string {
        return `/* Pre-rendered LaTeX (SVG+MathML) - MathJax not included */
.exe-math-rendered { display: inline-block; vertical-align: middle; }
.exe-math-rendered[data-display="block"] { display: block; text-align: center; margin: 1em 0; }
.exe-math-rendered svg { vertical-align: middle; max-width: 100%; height: auto; }
/* Fix for MathJax array/table borders - SVG has stroke-width:0 which hides lines */
.exe-math-rendered svg line.mjx-solid { stroke-width: 60 !important; }
.exe-math-rendered svg rect[data-frame="true"] { fill: none; stroke-width: 60 !important; }
/* Hide MathML visually but keep accessible for screen readers */
.exe-math-rendered math { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }`;
    }
}
