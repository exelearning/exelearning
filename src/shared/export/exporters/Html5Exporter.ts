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
    LayeredAssetRef,
    LayeredPreviewOptions,
    LayeredPreviewResult,
    PreviewProvenance,
    PreviewResourceGroupId,
} from '../interfaces';
import { BaseExporter } from './BaseExporter';
import { GlobalFontGenerator } from '../utils/GlobalFontGenerator';
import { buildThemeFixedId, sha256HexOf } from '../utils/previewLayers';
import { PRERENDERED_LATEX_CSS } from '../constants';

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
     * Pre-render LaTeX in a page's HTML to SVG+MathML so the export can drop the
     * MathJax engine. Encrypted DataGame data is processed first, then the visible
     * body (which also covers recursive JSON iDevices like adaptative-quiz and
     * trueorfalse). Hooks come from `options` (server/CLI) or, as a fallback, from
     * the browser-global LatexPreRenderer.
     *
     * The caller decides *whether* pre-rendering applies (typically only when
     * MathJax is not bundled). Keeping this the single source of truth ensures the
     * HTML5, single-page (PAGE) and ELPX exports render LaTeX identically.
     *
     * @returns the (possibly updated) HTML and whether any LaTeX was rendered.
     */
    protected async preRenderHtmlLatex(
        html: string,
        options: ExportOptions | undefined,
    ): Promise<{ html: string; latexRendered: boolean }> {
        let latexRendered = false;

        // Encrypted DataGame divs store questions in encrypted JSON -- handle first.
        const preRenderDataGameLatex =
            options?.preRenderDataGameLatex || this.getBrowserLatexPreRenderer()?.preRenderDataGameLatex;
        if (preRenderDataGameLatex) {
            try {
                const result = await preRenderDataGameLatex(html);
                if (result.count > 0) {
                    html = result.html;
                    latexRendered = true;
                }
            } catch (error) {
                console.warn('[Html5Exporter] DataGame LaTeX pre-render failed:', error);
            }
        }

        // Visible body LaTeX + recursive JSON iDevices (data-idevice-json-data).
        const preRenderLatex = options?.preRenderLatex || this.getBrowserLatexPreRenderer()?.preRender;
        if (preRenderLatex) {
            try {
                const result = await preRenderLatex(html);
                if (result.latexRendered) {
                    html = result.html;
                    latexRendered = true;
                }
            } catch (error) {
                console.warn('[Html5Exporter] LaTeX pre-render failed:', error);
            }
        }

        return { html, latexRendered };
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
            const navLabels = await this.fetchNavLabels(meta.language || 'en', meta.license);

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

                // Pre-render LaTeX to SVG unless the author explicitly requested MathJax.
                if (!meta.addMathJax) {
                    const latexResult = await this.preRenderHtmlLatex(html, options);
                    html = latexResult.html;
                    if (latexResult.latexRendered) {
                        latexWasRendered = true;
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
            addMathJax: meta.addMathJax === true,
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
            // xAPI runtime config for the always-on emitter (stable IRIs from odeId)
            xapi: { odeId: meta.odeIdentifier || '', packageTitle: meta.title || '', language: meta.language || 'en' },
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
        return PRERENDERED_LATEX_CSS;
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
            const navLabels = await this.fetchNavLabels(meta.language || 'en', meta.license);

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

                // Pre-render LaTeX to SVG unless the author explicitly requested MathJax.
                if (!meta.addMathJax) {
                    const latexResult = await this.preRenderHtmlLatex(html, options);
                    html = latexResult.html;
                    if (latexResult.latexRendered) {
                        latexWasRendered = true;
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

    // =========================================================================
    // Layered preview generation (serving contract v2)
    // =========================================================================

    /**
     * Generate the preview as the three layers of serving contract v2:
     * generated documents (bytes), project-asset references (identities from
     * the project model — no blob is read here) and fixed installation
     * resource references (identities the host resolves through its build
     * manifest — zero bytes transferred).
     *
     * Additive sibling of {@link generateForPreview}, which stays byte-exact
     * for the srcdoc/static/screenshot consumers. Classification is by fetch
     * provenance via the optional `ResourceProvider.getPreviewProvenance`
     * seam; providers without it (server exports, null providers) get a fully
     * dynamic result — correct, just not incremental.
     *
     * Dirty-scope regeneration: with `opts.dirtyPages` a Set and
     * `opts.previousDocuments` from the previous round, only the dirty pages
     * are re-rendered (LaTeX/Mermaid pre-render included); every other page's
     * entry is copied by reference from the previous documents map.
     */
    async generateForPreviewLayered(options: LayeredPreviewOptions = {}): Promise<LayeredPreviewResult> {
        const documents = new Map<string, ArrayBuffer | string>();
        const assetRefs = new Map<string, LayeredAssetRef>();
        const fixedRefs = new Map<string, string>();

        const prev = options.previousDocuments ?? null;
        // Without a previous generation there is nothing to reuse: render everything.
        const dirty: Set<string> | 'all' = !prev || options.dirtyPages === undefined ? 'all' : options.dirtyPages;
        const isDirtyPage = (pageId: string) => dirty === 'all' || dirty.has(pageId);
        const anyDirty = dirty === 'all' || dirty.size > 0;

        let pages = this.buildPageList();
        const meta = this.getMetadata();
        // Theme priority: 1º parameter > 2º ELP metadata > 3º default
        const themeName = options?.theme || meta.theme || 'base';
        const needsElpxDownload = this.needsElpxDownloadSupport(pages);

        // Pre-process asset URLs. Page-scoped when possible; the search index
        // embeds every page's preprocessed component HTML and there is no
        // cross-refresh cache of per-page entries, so with the search box on,
        // any dirty page forces a full preprocess to keep search_index.js
        // identical to a full generation (still a cheap string pass — no blob
        // or network I/O either way).
        if (dirty === 'all' || (meta.addSearchBox && anyDirty)) {
            pages = await this.preprocessPagesForExport(pages);
        } else {
            pages = await this.preprocessPagesForPreviewScope(pages, dirty);
        }

        // Build unique filename map for all pages (handles collisions)
        const pageFilenameMap = this.buildPageFilenameMap(pages);

        // 0. Pre-fetch theme files (also configures icon resolution)
        const { themeFilesMap, themeRootFiles, faviconInfo: detectedFavicon } = await this.prepareThemeData(themeName);

        const faviconInfo = options?.faviconPath
            ? { path: options.faviconPath, type: options.faviconType || 'image/x-icon' }
            : detectedFavicon;

        const assetExportPathMap = await this.buildAssetExportPathMap();
        const navLabels = await this.fetchNavLabels(meta.language || 'en', meta.license);

        // 1. Page HTML: render dirty pages, reuse clean ones from previousDocuments.
        let latexWasRendered = false;
        let mermaidWasRendered = false;
        const pageEntries: Array<{
            filename: string;
            page: ExportPage;
            index: number;
            reused: boolean;
            content: ArrayBuffer | string;
        }> = [];

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
            const filename = i === 0 ? 'index.html' : `html/${uniqueFilename}`;

            if (!isDirtyPage(page.id) && prev?.has(filename)) {
                pageEntries.push({ filename, page, index: i, reused: true, content: prev.get(filename)! });
                continue;
            }

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

            // Pre-render LaTeX to SVG unless the author explicitly requested MathJax.
            if (!meta.addMathJax) {
                const latexResult = await this.preRenderHtmlLatex(html, options);
                html = latexResult.html;
                if (latexResult.latexRendered) {
                    latexWasRendered = true;
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

            pageEntries.push({ filename, page, index: i, reused: false, content: html });
        }

        // 2. Search index. Its entries embed every page's preprocessed
        // component HTML, so it regenerates whenever any page is dirty (the
        // full preprocess above guarantees identical bytes) and is otherwise
        // copied unchanged from the previous round.
        if (meta.addSearchBox) {
            const prevIndex = prev?.get('search_index.js');
            if (!anyDirty && prevIndex !== undefined) {
                documents.set('search_index.js', prevIndex);
            } else {
                documents.set('search_index.js', this.pageRenderer.generateSearchIndexFile(pages, '', pageFilenameMap));
            }
        }

        // 3. content.xml is skipped for preview (matches generateForPreview)

        // 4. Base CSS: fixed ref while pristine; a document once LaTeX/Mermaid
        // CSS was appended (sticky — reused pages may still need it).
        await this.addBaseCssToLayeredPreview(documents, fixedRefs, prev, latexWasRendered, mermaidWasRendered);

        // 5. eXeLearning logo
        try {
            const logoData = await this.resources.fetchExeLogo();
            if (logoData) {
                if ((await this.previewProvenance({ kind: 'logo' })) === 'base') {
                    fixedRefs.set('content/img/exe_powered_logo.png', 'content/img/exe_powered_logo.png');
                } else {
                    documents.set('content/img/exe_powered_logo.png', this.toPreviewArrayBuffer(logoData));
                }
            }
        } catch {
            // Logo not available - footer will still render but without background image
        }

        // 6. Theme files: base themes ride the fixed layer under theme:{name}
        // ids; user/site/admin themes (and unknown provenance) ride documents.
        if (themeFilesMap) {
            const themeIsBase = (await this.previewProvenance({ kind: 'theme', themeName })) === 'base';
            for (const [filePath, content] of themeFilesMap) {
                if (themeIsBase) {
                    fixedRefs.set(`theme/${filePath}`, buildThemeFixedId(themeName, filePath));
                } else {
                    documents.set(`theme/${filePath}`, this.toPreviewArrayBuffer(content));
                }
            }
        } else {
            documents.set('theme/style.css', this.getFallbackThemeCss());
            documents.set('theme/style.js', this.getFallbackThemeJs());
        }

        // 7. Base libraries
        try {
            const baseLibs = await this.resources.fetchBaseLibraries();
            const libsAreBase = (await this.previewProvenance({ kind: 'baseLibraries' })) === 'base';
            for (const [libPath, content] of baseLibs) {
                const path = `libs/${libPath}`;
                if (libsAreBase) {
                    fixedRefs.set(path, path);
                } else {
                    documents.set(path, this.toPreviewArrayBuffer(content));
                }
            }
        } catch {
            // Base libraries not available - continue anyway
        }

        // 7.5. Localized i18n file — generated per language, ALWAYS a document.
        documents.set('libs/common_i18n.js', await this.generateI18nContent(meta.language || 'en'));

        // 8. Content-detected libraries. LibraryDetector still runs on every
        // refresh — it is a cheap string scan over component HTML and its
        // result only affects which fixed refs are emitted.
        const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
            includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
            includeMathJax: meta.addMathJax === true,
            skipMathJax: latexWasRendered && !meta.addMathJax,
        });

        try {
            const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
            const libsAreBase = (await this.previewProvenance({ kind: 'libraryFiles' })) === 'base';
            for (const [libPath, content] of libFiles) {
                const path = `libs/${libPath}`;
                if (documents.has(path) || fixedRefs.has(path)) continue;
                if (libsAreBase) {
                    fixedRefs.set(path, path);
                } else {
                    documents.set(path, this.toPreviewArrayBuffer(content));
                }
            }
        } catch {
            // Additional libraries not available - continue anyway
        }

        // 9. iDevice runtimes: fixed only when the files provably came from
        // the idevices bundle; per-file fallbacks may serve user-installed
        // iDevices and ride documents.
        const usedIdevices = this.getUsedIdevices(pages);
        for (const idevice of usedIdevices) {
            try {
                const normalizedType = this.resources.normalizeIdeviceType(idevice);
                const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                const ideviceIsBase =
                    (await this.previewProvenance({ kind: 'idevice', ideviceType: idevice })) === 'base';
                for (const [filePath, content] of ideviceFiles) {
                    const path = `idevices/${normalizedType}/${filePath}`;
                    if (ideviceIsBase) {
                        fixedRefs.set(path, path);
                    } else {
                        documents.set(path, this.toPreviewArrayBuffer(content));
                    }
                }
            } catch {
                // Many iDevices don't have extra files - this is normal
            }
        }

        // 9.5. Global font files
        if (meta.globalFont && meta.globalFont !== 'default') {
            try {
                const fontFiles = await this.resources.fetchGlobalFontFiles(meta.globalFont);
                if (fontFiles) {
                    const fontsAreBase = (await this.previewProvenance({ kind: 'globalFonts' })) === 'base';
                    for (const [filePath, content] of fontFiles) {
                        if (fontsAreBase) {
                            fixedRefs.set(filePath, filePath);
                        } else {
                            documents.set(filePath, this.toPreviewArrayBuffer(content));
                        }
                    }
                }
            } catch (e) {
                console.warn(`[Html5Exporter] Failed to fetch global font files for preview: ${meta.globalFont}`, e);
            }
        }

        // 10. Project assets — identity references only, no blob reads.
        await this.addAssetsToLayeredPreview(documents, assetRefs, assetExportPathMap);

        // 11. ELPX manifest — regenerated from the full served path set every
        // round (cheap) and ALWAYS a document when present.
        if (needsElpxDownload) {
            // Ensure ELPX download libraries are present (may not be detected)
            const elpxLibFiles = ['fflate/fflate.umd.js', 'exe_elpx_download/exe_elpx_download.js'];
            const missingLibs = elpxLibFiles.filter(f => !documents.has(`libs/${f}`) && !fixedRefs.has(`libs/${f}`));
            if (missingLibs.length > 0) {
                try {
                    const libContents = await this.resources.fetchLibraryFiles(missingLibs);
                    const libsAreBase = (await this.previewProvenance({ kind: 'libraryFiles' })) === 'base';
                    for (const [libPath, content] of libContents) {
                        const path = `libs/${libPath}`;
                        if (libsAreBase) {
                            fixedRefs.set(path, path);
                        } else {
                            documents.set(path, this.toPreviewArrayBuffer(content));
                        }
                    }
                } catch {
                    // Library files not available - continue anyway
                }
            }

            const fileList: string[] = [
                ...documents.keys(),
                ...assetRefs.keys(),
                ...fixedRefs.keys(),
                ...pageEntries.map(entry => entry.filename),
                'libs/elpx-manifest.js',
            ];
            documents.set('libs/elpx-manifest.js', this.generateElpxManifestFile(fileList));
        }

        // 12. Page HTML into the documents map (reused entries keep their
        // previous value by reference so the transport can skip re-decoration
        // and byte comparison cheaply).
        for (const entry of pageEntries) {
            if (entry.reused) {
                documents.set(entry.filename, entry.content);
                continue;
            }
            let html = entry.content as string;
            if (needsElpxDownload) {
                html = this.injectElpxScripts(html, entry.page, entry.index === 0);
            }
            documents.set(entry.filename, html);
        }

        return { documents, assetRefs, fixedRefs };
    }

    /**
     * Provenance query with a safe default: providers without the optional
     * seam (or failing ones) report 'unknown', which callers treat as session
     * content.
     */
    private async previewProvenance(group: PreviewResourceGroupId): Promise<PreviewProvenance> {
        if (!this.resources.getPreviewProvenance) return 'unknown';
        try {
            return await this.resources.getPreviewProvenance(group);
        } catch {
            return 'unknown';
        }
    }

    /**
     * Scoped variant of preprocessPagesForExport: only the dirty pages are
     * cloned and get their asset URLs rewritten (their HTML is about to be
     * re-rendered); clean pages are passed through untouched because their
     * rendered bytes are copied from the previous round. Navigation rendering
     * only reads titles/ids, never other pages' content.
     */
    protected async preprocessPagesForPreviewScope(pages: ExportPage[], dirty: Set<string>): Promise<ExportPage[]> {
        const result: ExportPage[] = [];
        for (const page of pages) {
            if (!dirty.has(page.id)) {
                result.push(page);
                continue;
            }
            const cloned: ExportPage = JSON.parse(JSON.stringify(page));
            for (const block of cloned.blocks || []) {
                for (const component of block.components || []) {
                    if (component.content) {
                        component.content = await this.addFilenamesToAssetUrls(component.content);
                    }
                    if (component.properties && Object.keys(component.properties).length > 0) {
                        const propsStr = JSON.stringify(component.properties);
                        const processedStr = await this.addFilenamesToAssetUrls(propsStr);
                        component.properties = JSON.parse(processedStr);
                    }
                }
            }
            result.push(cloned);
        }
        return result;
    }

    /** First comment line of the appended pre-rendered LaTeX CSS block. */
    private static readonly LATEX_CSS_MARKER = '/* Pre-rendered LaTeX (SVG+MathML) - MathJax not included */';
    /** First comment line of the appended pre-rendered Mermaid CSS block. */
    private static readonly MERMAID_CSS_MARKER =
        '/* Pre-rendered Mermaid (static SVG) - Mermaid library not included */';

    /**
     * Emit content/css/base.css into the right layer.
     *
     * Pristine base.css is an installation file → fixed ref. Once LaTeX or
     * Mermaid pre-rendering appended CSS the file is a session document, and
     * it is STICKY: with page-scoped regeneration a reused page may contain
     * pre-rendered markup this round did not touch, so a previously appended
     * block keeps being served (detected via its marker comment) even when
     * this round rendered nothing. When the previous copy already covers
     * exactly the needed blocks it is reused byte-for-byte to avoid a
     * spurious document diff.
     */
    private async addBaseCssToLayeredPreview(
        documents: Map<string, ArrayBuffer | string>,
        fixedRefs: Map<string, string>,
        prev: Map<string, ArrayBuffer | string> | null,
        latexThisRound: boolean,
        mermaidThisRound: boolean,
    ): Promise<void> {
        const PATH = 'content/css/base.css';

        const prevCss = prev?.get(PATH);
        let prevHadLatex = false;
        let prevHadMermaid = false;
        if (prevCss !== undefined) {
            const text = typeof prevCss === 'string' ? prevCss : new TextDecoder().decode(prevCss);
            prevHadLatex = text.includes(Html5Exporter.LATEX_CSS_MARKER);
            prevHadMermaid = text.includes(Html5Exporter.MERMAID_CSS_MARKER);
        }

        const needLatex = latexThisRound || prevHadLatex;
        const needMermaid = mermaidThisRound || prevHadMermaid;

        if (!needLatex && !needMermaid) {
            if ((await this.previewProvenance({ kind: 'contentCss' })) === 'base') {
                fixedRefs.set(PATH, PATH);
                return;
            }
        } else if (prevCss !== undefined && prevHadLatex === needLatex && prevHadMermaid === needMermaid) {
            documents.set(PATH, prevCss);
            return;
        }

        const contentCssFiles = await this.resources.fetchContentCss();
        const baseCss = contentCssFiles.get(PATH);
        if (!baseCss) {
            // Matches generateForPreview: a missing base.css is skipped.
            return;
        }

        if (!needLatex && !needMermaid) {
            documents.set(PATH, this.toPreviewArrayBuffer(baseCss));
            return;
        }

        let cssText = new TextDecoder().decode(baseCss);
        if (needLatex) {
            cssText += '\n' + this.getPreRenderedLatexCss();
        }
        if (needMermaid) {
            cssText += '\n' + this.getPreRenderedMermaidCss();
        }
        documents.set(PATH, this.toPreviewArrayBuffer(new TextEncoder().encode(cssText)));
    }

    /**
     * Emit project assets as identity references (layer 2). This is the step
     * that eliminates the per-refresh asset blob reads: identity comes from
     * the metadata the project model already stores. The two defensive
     * fallbacks (a metadata entry without a hash, a legacy non-UUID id that
     * cannot form a contract-valid asset key) each load ONLY that one asset's
     * bytes — never a sweep.
     */
    private async addAssetsToLayeredPreview(
        documents: Map<string, ArrayBuffer | string>,
        assetRefs: Map<string, LayeredAssetRef>,
        exportPathMap: Map<string, string>,
    ): Promise<void> {
        try {
            if (!this.assets.listAssetMetadata) {
                // The provider cannot enumerate metadata: fall back to full
                // dynamic asset bytes in the document layer (correct, not
                // incremental).
                await this.forEachAsset(async asset => {
                    const exportPath = exportPathMap.get(asset.id);
                    if (!exportPath) return;
                    documents.set(`content/resources/${exportPath}`, await this.toPreviewAssetBuffer(asset.data));
                });
                return;
            }

            const items = await this.assets.listAssetMetadata();
            for (const item of items) {
                const exportPath = exportPathMap.get(item.id);
                if (!exportPath) continue;
                const filePath = `content/resources/${exportPath}`;
                const mime = item.mime || 'application/octet-stream';
                const idOk = /^[0-9a-fA-F-]{36}$/.test(item.id);
                const hash = typeof item.hash === 'string' ? item.hash.toLowerCase() : '';

                if (idOk && /^[0-9a-f]{8,64}$/.test(hash)) {
                    assetRefs.set(filePath, {
                        assetId: item.id,
                        hash,
                        size: typeof item.size === 'number' ? item.size : 0,
                        mime,
                    });
                    continue;
                }

                const asset = await this.assets.getAsset(item.id);
                if (!asset) continue;
                const bytes = asset.data instanceof Blob ? new Uint8Array(await asset.data.arrayBuffer()) : asset.data;
                if (idOk) {
                    // Metadata lost its hash → hash this one asset on demand.
                    const computed = await sha256HexOf(bytes);
                    assetRefs.set(filePath, { assetId: item.id, hash: computed, size: bytes.byteLength, mime });
                } else {
                    // Legacy non-UUID id → ship bytes through the document layer.
                    documents.set(filePath, this.toPreviewArrayBuffer(bytes));
                }
            }
        } catch (e) {
            console.warn('[Html5Exporter] Failed to add assets to layered preview:', e);
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
