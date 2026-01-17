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
import { generateI18nScript } from '../generators/I18nGenerator';

export class Html5Exporter extends BaseExporter {
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

            // 1. Generate HTML pages (with optional LaTeX and Mermaid pre-rendering)
            const pageHtmlMap = new Map<string, string>();
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
                );

                // Pre-render LaTeX ONLY if addMathJax is false
                // When MathJax is included, let it process LaTeX at runtime for full UX (context menu, accessibility)
                if (!meta.addMathJax) {
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
                            console.warn(
                                '[Html5Exporter] DataGame LaTeX pre-render failed for page:',
                                page.title,
                                error,
                            );
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

                // First page is index.html, others go in html/ directory using unique filenames
                const filename = pageFilenameMap.get(page.id) || 'page.html';
                const pageFilename = i === 0 ? 'index.html' : `html/${filename}`;
                pageHtmlMap.set(pageFilename, html);
            }

            // 2. Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '', pageFilenameMap);
                addFile('search_index.js', searchIndexContent);
            }

            // 3. Add content.xml (ODE format for re-import) - only if exportSource is enabled
            if (meta.exportSource !== false) {
                const contentXml = this.generateContentXml();
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
            const i18nContent = generateI18nScript(meta.language || 'en');
            addFile('libs/common_i18n.js', new TextEncoder().encode(i18nContent));

            // 8. Detect and fetch additional required libraries based on content
            // Skip MathJax if LaTeX was pre-rendered to SVG+MathML (unless explicitly requested)
            // Skip Mermaid if diagrams were pre-rendered to static SVG
            // Note: exe-package:elp is still in the content at this point (transformation happens in PageRenderer)
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
                allHtmlContent,
                {
                    includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                    includeMathJax: meta.addMathJax === true,
                    skipMathJax: latexWasRendered && !meta.addMathJax, // Don't skip if explicitly requested
                    skipMermaid: mermaidWasRendered,
                },
            );

            if (latexWasRendered) {
                console.log('[Html5Exporter] LaTeX pre-rendered - skipping MathJax library (~1MB saved)');
            }
            if (mermaidWasRendered) {
                console.log('[Html5Exporter] Mermaid pre-rendered - skipping Mermaid library (~2.7MB saved)');
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
            if (needsElpxDownload && fileList) {
                // Add HTML pages to file list
                for (const [htmlFile] of pageHtmlMap) {
                    if (!fileList.includes(htmlFile)) {
                        fileList.push(htmlFile);
                    }
                }
                // Create separate manifest JS file
                const manifestJs = this.generateElpxManifestFile(fileList);
                addFile('libs/elpx-manifest.js', manifestJs);
            }

            // 12. Add all HTML pages to ZIP (with manifest script only on pages with download-source-file)
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const pageFilename = pageFilenameMap.get(page.id) || 'page.html';
                const filename = i === 0 ? 'index.html' : `html/${pageFilename}`;
                let html = pageHtmlMap.get(filename) || '';

                // Only add manifest script to pages that have download-source-file iDevice or exe-package:elp link
                // Note: pageHasDownloadSourceFile works correctly because exe-package:elp is not transformed
                // in the pages data (transformation happens in PageRenderer during HTML rendering)
                if (needsElpxDownload && this.pageHasDownloadSourceFile(page)) {
                    const basePath = i === 0 ? '' : '../';
                    const manifestScriptTag = `<script src="${basePath}libs/elpx-manifest.js"> </script>`;
                    html = html.replace(/<\/body>/i, `${manifestScriptTag}\n</body>`);
                }
                this.zip.addFile(filename, html);
            }

            // 13. Generate ZIP buffer
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
     * Returns a map of file paths to content (Uint8Array or string)
     * Same structure as ZIP export but without creating the archive
     *
     * This enables unified preview/export rendering using the eXeViewer approach:
     * - Preview uses Service Worker to serve files from memory
     * - Files are the same as what would be in the HTML5 export
     * - No blob:// URLs, no special preview rendering path
     */
    async generateForPreview(options?: Html5ExportOptions): Promise<Map<string, Uint8Array | string>> {
        const files = new Map<string, Uint8Array | string>();

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
            const addFile = (path: string, content: Uint8Array | string) => {
                files.set(path, content);
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

            // 1. Generate HTML pages (with optional LaTeX and Mermaid pre-rendering)
            const pageHtmlMap = new Map<string, string>();
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
                );

                // Pre-render LaTeX ONLY if addMathJax is false
                if (!meta.addMathJax) {
                    if (options?.preRenderDataGameLatex) {
                        try {
                            const result = await options.preRenderDataGameLatex(html);
                            if (result.count > 0) {
                                html = result.html;
                                latexWasRendered = true;
                            }
                        } catch {
                            // Continue without pre-rendering
                        }
                    }

                    if (options?.preRenderLatex) {
                        try {
                            const result = await options.preRenderLatex(html);
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
                const pageFilename = i === 0 ? 'index.html' : `html/${uniqueFilename}`;
                pageHtmlMap.set(pageFilename, html);
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
            const i18nContent = generateI18nScript(meta.language || 'en');
            addFile('libs/common_i18n.js', new TextEncoder().encode(i18nContent));

            // 8. Detect and fetch additional required libraries based on content
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
                allHtmlContent,
                {
                    includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                    includeMathJax: meta.addMathJax === true,
                    skipMathJax: latexWasRendered && !meta.addMathJax,
                    skipMermaid: mermaidWasRendered,
                },
            );

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

            // 10. Add project assets
            await this.addAssetsToPreviewFiles(files, fileList);

            // 11. Generate ELPX manifest file if download-source-file is used
            if (needsElpxDownload && fileList) {
                for (const [htmlFile] of pageHtmlMap) {
                    if (!fileList.includes(htmlFile)) {
                        fileList.push(htmlFile);
                    }
                }
                const manifestJs = this.generateElpxManifestFile(fileList);
                addFile('libs/elpx-manifest.js', manifestJs);
            }

            // 12. Add all HTML pages
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const filename = i === 0 ? 'index.html' : `html/${uniqueFilename}`;
                let html = pageHtmlMap.get(filename) || '';

                // Only add manifest script to pages that have download-source-file iDevice
                if (needsElpxDownload && this.pageHasDownloadSourceFile(page)) {
                    const basePath = i === 0 ? '' : '../';
                    const manifestScriptTag = `<script src="${basePath}libs/elpx-manifest.js"> </script>`;
                    html = html.replace(/<\/body>/i, `${manifestScriptTag}\n</body>`);
                }
                const encoder = new TextEncoder();
                files.set(filename, encoder.encode(html));
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
        files: Map<string, Uint8Array | string>,
        trackingList?: string[] | null,
    ): Promise<number> {
        let assetsAdded = 0;

        try {
            const assets = await this.assets.getAllAssets();
            const exportPathMap = await this.buildAssetExportPathMap();

            for (const asset of assets) {
                const exportPath = exportPathMap.get(asset.id);
                if (!exportPath) continue;

                const filePath = `content/resources/${exportPath}`;
                files.set(filePath, asset.data);
                if (trackingList) trackingList.push(filePath);
                assetsAdded++;
            }
        } catch (e) {
            console.warn('[Html5Exporter] Failed to add assets to preview files:', e);
        }

        return assetsAdded;
    }
}
