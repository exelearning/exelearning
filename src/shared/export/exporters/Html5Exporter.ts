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
    ExportPage,
    ExportMetadata,
    ExportOptions,
    ExportResult,
    Html5ExportOptions,
    FaviconInfo,
    ThemeData,
} from '../interfaces';
import { BaseExporter } from './BaseExporter';
import { GlobalFontGenerator } from '../utils/GlobalFontGenerator';

export class Html5Exporter extends BaseExporter {
    private getBrowserLatexPreRenderer(): {
        preRender: (
            html: string,
        ) => Promise<{ html: string; hasLatex: boolean; latexRendered: boolean; count: number }>;
        preRenderDataGameLatex: (html: string) => Promise<{ html: string; count: number }>;
    } | null {
        // Browser-only fallback when hooks are not provided.
        const browserGlobal = globalThis as unknown as {
            window?: {
                LatexPreRenderer?: {
                    preRender: (
                        html: string,
                    ) => Promise<{ html: string; hasLatex: boolean; latexRendered: boolean; count: number }>;
                    preRenderDataGameLatex: (html: string) => Promise<{ html: string; count: number }>;
                };
            };
        };

        return browserGlobal.window?.LatexPreRenderer || null;
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

            // Check for ELPX download support (looks for exe-package:elp in content)
            const needsElpxDownload = this.needsElpxDownloadSupport(pages);

            // Pre-process pages: add filenames to asset URLs, convert internal links
            // Note: exe-package:elp transformation now happens in PageRenderer.renderPageContent()
            pages = await this.preprocessPagesForExport(pages);

            // Build unique filename map for all pages (handles collisions)
            const pageFilenameMap = this.buildPageFilenameMap(pages);

            // File tracking for ELPX manifest (only when download-source-file is used)
            const fileList: string[] | null = needsElpxDownload ? [] : null;
            const addFile = (path: string, content: Uint8Array | string) => {
                this.zip.addFile(path, content);
                if (fileList) fileList.push(path);
            };

            // 0. Pre-fetch theme files to get the list of CSS/JS for HTML includes
            const {
                themeFilesMap,
                themeRootFiles,
                faviconInfo: detectedFavicon,
            } = await this.prepareThemeData(themeName);
            if (themeFilesMap) {
                console.log(`[Html5Exporter] Theme '${themeName}' files count: ${themeFilesMap.size}`);
            }

            // Override favicon if provided in options
            const faviconInfo = html5Options?.faviconPath
                ? { path: html5Options.faviconPath, type: html5Options.faviconType || 'image/x-icon' }
                : detectedFavicon;

            // Build asset export path map for URL transformation
            const assetExportPathMap = await this.buildAssetExportPathMap();

            // Fetch translated nav button labels for the content language
            const navLabels = await this.fetchNavLabels(meta.language || 'en');

            // 1. Generate HTML pages, pre-render LaTeX/Mermaid, and add directly to ZIP
            // Pages are added to ZIP immediately to avoid storing all HTML in memory
            // Manifest script tags are injected inline (they reference the file, not its content)
            let latexWasRendered = false;
            let mermaidWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                let html = this.generatePageHtml(
                    page,
                    pages,
                    meta,
                    i === 0,
                    i,
                    themeRootFiles,
                    faviconInfo,
                    pageFilenameMap,
                    assetExportPathMap,
                    navLabels,
                );

                // Pre-render LaTeX ONLY if addMathJax is false
                // When MathJax is included, let it process LaTeX at runtime for full UX (context menu, accessibility)
                if (!meta.addMathJax) {
                    // Pre-render LaTeX in encrypted DataGame divs FIRST
                    // (game iDevices store questions in encrypted JSON)
                    const preRenderDataGameLatex =
                        options?.preRenderDataGameLatex || this.getBrowserLatexPreRenderer()?.preRenderDataGameLatex;
                    if (preRenderDataGameLatex) {
                        try {
                            const result = await preRenderDataGameLatex(html);
                            if (result.count > 0) {
                                html = result.html;
                                latexWasRendered = true;
                                console.log(
                                    `[Html5Exporter] Pre-rendered LaTeX in ${result.count} DataGame(s) on page: ${page.title}`,
                                );
                            }
                        } catch (error) {
                            console.warn(
                                '[Html5Exporter] DataGame LaTeX pre-render failed for page:',
                                page.title,
                                error,
                            );
                        }
                    }

                    // Pre-render visible LaTeX to SVG+MathML if hook is provided
                    const preRenderLatex = options?.preRenderLatex || this.getBrowserLatexPreRenderer()?.preRender;
                    if (preRenderLatex) {
                        try {
                            const result = await preRenderLatex(html);
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
                }

                // Pre-render Mermaid diagrams to static SVG if hook is provided
                // This eliminates the need for the ~2.7MB Mermaid library in exports
                if (options?.preRenderMermaid) {
                    try {
                        const result = await options.preRenderMermaid(html);
                        if (result.mermaidRendered) {
                            html = result.html;
                            mermaidWasRendered = true;
                            console.log(
                                `[Html5Exporter] Pre-rendered ${result.count} Mermaid diagram(s) on page: ${page.title}`,
                            );
                        }
                    } catch (error) {
                        console.warn('[Html5Exporter] Mermaid pre-render failed for page:', page.title, error);
                    }
                }

                // Inject ELPX manifest script tag for pages that have download-source-file
                if (needsElpxDownload && this.pageHasDownloadSourceFile(page)) {
                    const basePath = i === 0 ? '' : '../';
                    const manifestScriptTag = `<script src="${basePath}libs/elpx-manifest.js"> </script>`;
                    html = html.replace(/<\/body>/i, `${manifestScriptTag}\n</body>`);
                }

                // Add page directly to ZIP (no intermediate Map storage)
                const pageUniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const filename = i === 0 ? 'index.html' : `html/${pageUniqueFilename}`;
                this.zip.addFile(filename, html);
                if (fileList) fileList.push(filename);
            }

            // 2. Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '', pageFilenameMap);
                addFile('search_index.js', searchIndexContent);
            }

            // 3. Add content.xml (ODE format for re-import) - only if exportSource is enabled
            if (meta.exportSource !== false) {
                const contentXml = this.generateContentXml(pages);
                addFile('content.xml', contentXml);
            }

            // 4. Add base CSS (fetch from content/css) and pre-rendered LaTeX/Mermaid CSS
            const contentCssFiles = await this.resources.fetchContentCss();
            let baseCss = contentCssFiles.get('content/css/base.css');
            if (!baseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            // Append pre-rendered CSS if LaTeX or Mermaid was rendered
            if (latexWasRendered || mermaidWasRendered) {
                const decoder = new TextDecoder();
                let baseCssText = decoder.decode(baseCss);
                if (latexWasRendered) {
                    baseCssText += '\n' + this.getPreRenderedLatexCss();
                }
                if (mermaidWasRendered) {
                    baseCssText += '\n' + this.getPreRenderedMermaidCss();
                }
                const encoder = new TextEncoder();
                baseCss = encoder.encode(baseCssText);
            }
            addFile('content/css/base.css', baseCss);

            // 5. Add eXeLearning logo for "Made with eXeLearning" footer
            try {
                const logoData = await this.resources.fetchExeLogo();
                if (logoData) {
                    addFile('content/img/exe_powered_logo.png', logoData);
                }
            } catch {
                // Logo not available - footer will still render but without background image
            }

            // 6. Add theme files (already pre-fetched in step 0)
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    console.log(`[Html5Exporter] Adding theme file: theme/${filePath}`);
                    addFile(`theme/${filePath}`, content);
                }
            } else {
                // Add fallback theme if pre-fetch failed
                addFile('theme/style.css', this.getFallbackThemeCss());
                addFile('theme/style.js', this.getFallbackThemeJs());
            }

            // 7. Fetch base libraries (always included - jQuery, Bootstrap, exe_lightbox, etc.)
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [libPath, content] of baseLibs) {
                    addFile(`libs/${libPath}`, content);
                }
            } catch {
                // Base libraries not available - continue anyway
            }

            // 7.5. Generate localized i18n file
            const i18nContent = await this.generateI18nContent(meta.language || 'en');
            addFile('libs/common_i18n.js', new TextEncoder().encode(i18nContent));

            // 8. Detect and fetch additional required libraries based on content
            // Skip MathJax if LaTeX was pre-rendered to SVG+MathML (unless explicitly requested)
            // Note: Mermaid is never included - diagrams are always pre-rendered to SVG
            // Note: exe-package:elp is still in the content at this point (transformation happens in PageRenderer)
            const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
                includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                includeMathJax: meta.addMathJax === true,
                skipMathJax: latexWasRendered && !meta.addMathJax,
            });

            if (latexWasRendered) {
                console.log('[Html5Exporter] LaTeX pre-rendered - skipping MathJax library (~1MB saved)');
            }

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [libPath, content] of libFiles) {
                    // Only add if not already added by base libraries
                    const zipPath = `libs/${libPath}`;
                    if (!this.zip.hasFile(zipPath)) {
                        addFile(zipPath, content);
                    }
                }
            } catch {
                // Additional libraries not available - continue anyway
            }

            // 9. Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    // Normalize iDevice type to directory name (e.g., 'FreeTextIdevice' -> 'text')
                    const normalizedType = this.resources.normalizeIdeviceType(idevice);
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [filePath, content] of ideviceFiles) {
                        // Use normalized type for ZIP path
                        addFile(`idevices/${normalizedType}/${filePath}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files - this is normal
                }
            }

            // 9.5. Fetch and add global font files (if selected)
            if (meta.globalFont && meta.globalFont !== 'default') {
                try {
                    const fontFiles = await this.resources.fetchGlobalFontFiles(meta.globalFont);
                    if (fontFiles) {
                        for (const [filePath, content] of fontFiles) {
                            addFile(filePath, content);
                        }
                        console.log(
                            `[Html5Exporter] Added ${fontFiles.size} global font files for: ${meta.globalFont}`,
                        );
                    }
                } catch (e) {
                    console.warn(`[Html5Exporter] Failed to fetch global font files: ${meta.globalFont}`, e);
                }
            }

            // 10. Add project assets (with tracking)
            await this.addAssetsToZipWithResourcePath(fileList);

            // 11. Generate ELPX manifest file if download-source-file is used
            // (HTML pages were already added to ZIP in step 1 with script tags injected)
            if (needsElpxDownload && fileList) {
                // Include the manifest file itself in the file list (self-reference)
                fileList.push('libs/elpx-manifest.js');
                const manifestJs = this.generateElpxManifestFile(fileList);
                this.zip.addFile('libs/elpx-manifest.js', manifestJs);
            }

            // 12. Generate ZIP buffer
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
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param pageIndex - Page index for page counter
     * @param themeFiles - List of root-level theme CSS/JS files
     * @param faviconInfo - Favicon info (optional)
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     * @param assetExportPathMap - Map of asset UUID to export path for URL transformation
     */
    generatePageHtml(
        page: ExportPage,
        allPages: ExportPage[],
        meta: ExportMetadata,
        isIndex: boolean,
        pageIndex?: number,
        themeFiles?: string[],
        faviconInfo?: FaviconInfo | null,
        pageFilenameMap?: Map<string, string>,
        assetExportPathMap?: Map<string, string>,
        navLabels?: { previous: string; next: string },
    ): string {
        const basePath = isIndex ? '' : '../';
        const usedIdevices = this.getUsedIdevicesForPage(page);
        const currentPageIndex = pageIndex ?? allPages.findIndex(p => p.id === page.id);

        // Generate global font CSS if a font is selected
        let customStyles = meta.customStyles || '';
        let bodyClass = 'exe-export exe-web-site';
        if (meta.globalFont && meta.globalFont !== 'default') {
            const globalFontCss = GlobalFontGenerator.generateCss(meta.globalFont, basePath);
            if (globalFontCss) {
                // Prepend global font CSS to customStyles (font CSS should come first)
                customStyles = globalFontCss + '\n' + customStyles;
            }
            // Add font-specific body class for CSS overrides
            const fontBodyClass = GlobalFontGenerator.getBodyClassName(meta.globalFont);
            if (fontBodyClass) {
                bodyClass += ` ${fontBodyClass}`;
            }
        }

        return this.pageRenderer.render(page, {
            projectTitle: meta.title || 'eXeLearning',
            projectSubtitle: meta.subtitle || '',
            language: meta.language || 'en',
            theme: meta.theme || 'base',
            customStyles,
            bodyClass,
            allPages,
            basePath,
            isIndex,
            usedIdevices,
            author: meta.author || '',
            license: meta.license || '',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || '',
            // Page counter options
            totalPages: allPages.length,
            currentPageIndex,
            userFooterContent: meta.footer,
            // Export options
            addExeLink: meta.addExeLink ?? true,
            addPagination: meta.addPagination ?? false,
            addSearchBox: meta.addSearchBox ?? false,
            addAccessibilityToolbar: meta.addAccessibilityToolbar ?? false,
            addMathJax: meta.addMathJax ?? false,
            // Custom head content
            extraHeadContent: meta.extraHeadContent,
            // Theme files for HTML head includes
            themeFiles: themeFiles || [],
            // Favicon options
            faviconPath: faviconInfo?.path,
            faviconType: faviconInfo?.type,
            // Page filename map for navigation links (handles title collisions)
            pageFilenameMap,
            // Asset URL transformation map
            assetExportPathMap,
            // Application version for generator meta tag
            version: meta.exelearningVersion,
            // Pre-translated nav button labels (resolved from XLF at export time)
            navLabels,
        });
    }

    /**
     * Detect theme-specific favicon from theme files map
     * @param themeFilesMap - Map of theme files
     * @returns Favicon info or null if not found
     */
    protected detectFavicon(themeFilesMap: Map<string, Uint8Array>): FaviconInfo | null {
        if (themeFilesMap.has('img/favicon.ico')) {
            return { path: 'theme/img/favicon.ico', type: 'image/x-icon' };
        }
        if (themeFilesMap.has('img/favicon.png')) {
            return { path: 'theme/img/favicon.png', type: 'image/png' };
        }
        return null;
    }

    /**
     * Prepare theme data for export: fetch theme files, extract root-level CSS/JS, detect favicon
     * @param themeName - Name of the theme to fetch
     * @returns ThemeData with files, root files list, and favicon info
     */
    protected async prepareThemeData(themeName: string): Promise<ThemeData> {
        const themeRootFiles: string[] = [];
        let themeFilesMap: Map<string, Uint8Array> | null = null;
        let faviconInfo: FaviconInfo | null = null;

        try {
            themeFilesMap = await this.resources.fetchTheme(themeName);
            for (const [filePath] of themeFilesMap) {
                if (!filePath.includes('/') && (filePath.endsWith('.css') || filePath.endsWith('.js'))) {
                    themeRootFiles.push(filePath);
                }
            }
            faviconInfo = this.detectFavicon(themeFilesMap);
        } catch (e) {
            console.warn(`[Html5Exporter] Failed to fetch theme: ${themeName}`, e);
            themeRootFiles.push('style.css', 'style.js');
        }

        // Configure iDevice renderer with theme files for icon resolution (SVG vs PNG)
        this.ideviceRenderer.setThemeIconFiles(themeFilesMap);

        return { themeFilesMap, themeRootFiles, faviconInfo };
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

    /**
     * Get CSS for pre-rendered Mermaid diagrams (static SVG)
     * This CSS is needed when Mermaid is pre-rendered instead of using the library at runtime
     */
    protected getPreRenderedMermaidCss(): string {
        return `/* Pre-rendered Mermaid (static SVG) - Mermaid library not included */
.exe-mermaid-rendered { display: block; text-align: center; margin: 1.5em 0; }
.exe-mermaid-rendered svg { max-width: 100%; height: auto; }`;
    }

    /**
     * Generate preview files map (for Service Worker-based preview)
     * Returns a map of file paths to transferable ArrayBuffers
     * Same structure as ZIP export but without creating the archive
     *
     * This enables unified preview/export rendering using the eXeViewer approach:
     * - Preview uses Service Worker to serve files from memory
     * - Files are the same as what would be in the HTML5 export
     * - No blob:// URLs, no special preview rendering path
     */
    async generateForPreview(options?: Html5ExportOptions): Promise<Map<string, ArrayBuffer>> {
        const files = new Map<string, ArrayBuffer>();

        try {
            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = options?.theme || meta.theme || 'base';

            // Check for ELPX download support (looks for exe-package:elp in content)
            const needsElpxDownload = this.needsElpxDownloadSupport(pages);

            // Pre-process pages: add filenames to asset URLs, convert internal links
            pages = await this.preprocessPagesForExport(pages);

            // Build unique filename map for all pages (handles collisions)
            const pageFilenameMap = this.buildPageFilenameMap(pages);

            // File tracking for ELPX manifest (only when download-source-file is used)
            const fileList: string[] | null = needsElpxDownload ? [] : null;
            const addFile = (path: string, content: Uint8Array | string | ArrayBuffer) => {
                files.set(path, this.toPreviewArrayBuffer(content));
                if (fileList) fileList.push(path);
            };

            // 0. Pre-fetch theme files to get the list of CSS/JS for HTML includes
            const {
                themeFilesMap,
                themeRootFiles,
                faviconInfo: detectedFavicon,
            } = await this.prepareThemeData(themeName);

            // Override favicon if provided in options
            const faviconInfo = options?.faviconPath
                ? { path: options.faviconPath, type: options.faviconType || 'image/x-icon' }
                : detectedFavicon;

            // Build asset export path map for URL transformation
            const assetExportPathMap = await this.buildAssetExportPathMap();

            // Fetch translated nav button labels for the content language
            const navLabels = await this.fetchNavLabels(meta.language || 'en');

            // 1. Generate HTML pages, pre-render LaTeX/Mermaid, and collect for later addition
            // We buffer page HTML because ELPX download scripts need libraries to be loaded first
            const pageEntries: Array<{ filename: string; html: string; page: ExportPage; index: number }> = [];
            let latexWasRendered = false;
            let mermaidWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                let html = this.generatePageHtml(
                    page,
                    pages,
                    meta,
                    i === 0,
                    i,
                    themeRootFiles,
                    faviconInfo,
                    pageFilenameMap,
                    assetExportPathMap,
                    navLabels,
                );

                // Pre-render LaTeX ONLY if addMathJax is false
                if (!meta.addMathJax) {
                    const preRenderDataGameLatex =
                        options?.preRenderDataGameLatex || this.getBrowserLatexPreRenderer()?.preRenderDataGameLatex;
                    if (preRenderDataGameLatex) {
                        try {
                            const result = await preRenderDataGameLatex(html);
                            if (result.count > 0) {
                                html = result.html;
                                latexWasRendered = true;
                            }
                        } catch {
                            // Continue without pre-rendering
                        }
                    }

                    const preRenderLatex = options?.preRenderLatex || this.getBrowserLatexPreRenderer()?.preRender;
                    if (preRenderLatex) {
                        try {
                            const result = await preRenderLatex(html);
                            if (result.latexRendered) {
                                html = result.html;
                                latexWasRendered = true;
                            }
                        } catch {
                            // Continue without pre-rendering
                        }
                    }
                }

                // Pre-render Mermaid diagrams
                if (options?.preRenderMermaid) {
                    try {
                        const result = await options.preRenderMermaid(html);
                        if (result.mermaidRendered) {
                            html = result.html;
                            mermaidWasRendered = true;
                        }
                    } catch {
                        // Continue without pre-rendering
                    }
                }

                // Use unique filenames from the map (handles collisions)
                const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const filename = i === 0 ? 'index.html' : `html/${uniqueFilename}`;
                pageEntries.push({ filename, html, page, index: i });
            }

            // 2. Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '', pageFilenameMap);
                addFile('search_index.js', searchIndexContent);
            }

            // 3. Skip content.xml for preview (not needed for viewing)
            // This saves space and prevents unnecessary file generation

            // 4. Add base CSS (fetch from content/css) and pre-rendered LaTeX/Mermaid CSS
            const contentCssFiles = await this.resources.fetchContentCss();
            let baseCss = contentCssFiles.get('content/css/base.css');
            if (baseCss) {
                if (latexWasRendered || mermaidWasRendered) {
                    const decoder = new TextDecoder();
                    let baseCssText = decoder.decode(baseCss);
                    if (latexWasRendered) {
                        baseCssText += '\n' + this.getPreRenderedLatexCss();
                    }
                    if (mermaidWasRendered) {
                        baseCssText += '\n' + this.getPreRenderedMermaidCss();
                    }
                    const encoder = new TextEncoder();
                    baseCss = encoder.encode(baseCssText);
                }
                addFile('content/css/base.css', baseCss);
            }

            // 5. Add eXeLearning logo for "Made with eXeLearning" footer
            try {
                const logoData = await this.resources.fetchExeLogo();
                if (logoData) {
                    addFile('content/img/exe_powered_logo.png', logoData);
                }
            } catch {
                // Logo not available - footer will still render but without background image
            }

            // 6. Add theme files
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    addFile(`theme/${filePath}`, content);
                }
            } else {
                const encoder = new TextEncoder();
                addFile('theme/style.css', encoder.encode(this.getFallbackThemeCss()));
                addFile('theme/style.js', encoder.encode(this.getFallbackThemeJs()));
            }

            // 7. Fetch base libraries
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [libPath, content] of baseLibs) {
                    addFile(`libs/${libPath}`, content);
                }
            } catch {
                // Base libraries not available - continue anyway
            }

            // 7.5. Generate localized i18n file
            const i18nContent = await this.generateI18nContent(meta.language || 'en');
            addFile('libs/common_i18n.js', new TextEncoder().encode(i18nContent));

            // 8. Detect and fetch additional required libraries based on content
            // Note: Mermaid is never included - diagrams are always pre-rendered to SVG
            const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
                includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                includeMathJax: meta.addMathJax === true,
                skipMathJax: latexWasRendered && !meta.addMathJax,
            });

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [libPath, content] of libFiles) {
                    const filePath = `libs/${libPath}`;
                    if (!files.has(filePath)) {
                        addFile(filePath, content);
                    }
                }
            } catch {
                // Additional libraries not available - continue anyway
            }

            // 9. Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    const normalizedType = this.resources.normalizeIdeviceType(idevice);
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [filePath, content] of ideviceFiles) {
                        addFile(`idevices/${normalizedType}/${filePath}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files - this is normal
                }
            }

            // 9.5. Fetch and add global font files (if selected)
            if (meta.globalFont && meta.globalFont !== 'default') {
                try {
                    const fontFiles = await this.resources.fetchGlobalFontFiles(meta.globalFont);
                    if (fontFiles) {
                        for (const [filePath, content] of fontFiles) {
                            addFile(filePath, content);
                        }
                        console.log(
                            `[Html5Exporter] Added ${fontFiles.size} global font files for preview: ${meta.globalFont}`,
                        );
                    }
                } catch (e) {
                    console.warn(
                        `[Html5Exporter] Failed to fetch global font files for preview: ${meta.globalFont}`,
                        e,
                    );
                }
            }

            // 10. Add project assets
            await this.addAssetsToPreviewFiles(files, fileList);

            // 11. Generate ELPX manifest file and ensure required libraries if download-source-file is used
            if (needsElpxDownload && fileList) {
                for (const entry of pageEntries) {
                    if (!fileList.includes(entry.filename)) {
                        fileList.push(entry.filename);
                    }
                }
                // Include the manifest file itself in the file list (self-reference)
                fileList.push('libs/elpx-manifest.js');
                const manifestJs = this.generateElpxManifestFile(fileList);
                addFile('libs/elpx-manifest.js', manifestJs);

                // Ensure ELPX download libraries are present (may not be detected by library detector)
                const elpxLibFiles = ['fflate/fflate.umd.js', 'exe_elpx_download/exe_elpx_download.js'];
                const missingLibs = elpxLibFiles.filter(f => !files.has(`libs/${f}`));
                if (missingLibs.length > 0) {
                    try {
                        const libContents = await this.resources.fetchLibraryFiles(missingLibs);
                        for (const [libPath, content] of libContents) {
                            addFile(`libs/${libPath}`, content);
                        }
                    } catch {
                        // Library files not available - continue anyway
                    }
                }
            }

            // 12. Add all HTML pages to files map
            for (const entry of pageEntries) {
                let { html } = entry;
                if (needsElpxDownload) {
                    html = this.injectElpxScripts(html, entry.page, entry.index === 0);
                }
                addFile(entry.filename, html);
            }

            return files;
        } catch (error) {
            console.error('[Html5Exporter] generateForPreview failed:', error);
            throw error;
        }
    }

    /**
     * Add project assets to preview files map
     */
    private async addAssetsToPreviewFiles(
        files: Map<string, ArrayBuffer>,
        trackingList?: string[] | null,
    ): Promise<number> {
        let assetsAdded = 0;

        try {
            const exportPathMap = await this.buildAssetExportPathMap();

            const processAsset = async (asset: { id: string; data: Uint8Array | Blob }) => {
                const exportPath = exportPathMap.get(asset.id);
                if (!exportPath) return;

                const filePath = `content/resources/${exportPath}`;
                files.set(filePath, await this.toPreviewAssetBuffer(asset.data));
                if (trackingList) trackingList.push(filePath);
                assetsAdded++;
            };

            await this.forEachAsset(processAsset);
        } catch (e) {
            console.warn('[Html5Exporter] Failed to add assets to preview files:', e);
        }

        return assetsAdded;
    }

    private toPreviewArrayBuffer(content: Uint8Array | string | ArrayBuffer): ArrayBuffer {
        if (content instanceof ArrayBuffer) {
            return content;
        }

        if (typeof content === 'string') {
            return new TextEncoder().encode(content).buffer as ArrayBuffer;
        }

        if (content.byteOffset === 0 && content.byteLength === content.buffer.byteLength) {
            return content.buffer as ArrayBuffer;
        }

        return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
    }

    private async toPreviewAssetBuffer(content: Uint8Array | Blob | ArrayBuffer): Promise<ArrayBuffer> {
        if (content instanceof Blob) {
            return content.arrayBuffer();
        }

        return this.toPreviewArrayBuffer(content);
    }
}
