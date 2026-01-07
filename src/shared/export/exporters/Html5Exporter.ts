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

import type { ExportPage, ExportMetadata, ExportOptions, ExportResult, Html5ExportOptions } from '../interfaces';
import { BaseExporter } from './BaseExporter';

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

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // Check if download-source-file iDevice is used (needs ELPX manifest for client-side ZIP)
            const needsElpxDownload = this.needsElpxDownloadSupport(pages);

            // File tracking for ELPX manifest (only when download-source-file is used)
            const fileList: string[] | null = needsElpxDownload ? [] : null;
            const addFile = (path: string, content: Uint8Array | string) => {
                this.zip.addFile(path, content);
                if (fileList) fileList.push(path);
            };

            // 1. Generate HTML pages (with optional LaTeX and Mermaid pre-rendering)
            const pageHtmlMap = new Map<string, string>();
            let latexWasRendered = false;
            let mermaidWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                let html = this.generatePageHtml(page, pages, meta, i === 0, i);

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

                // First page is index.html, others go in html/ directory
                const pageFilename = i === 0 ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
                pageHtmlMap.set(pageFilename, html);
            }

            // 2. Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '');
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
                    addFile(`theme/${exportPath}`, content);
                }
            } catch (e) {
                // Add fallback theme if fetch fails (use legacy names)
                console.warn(`[Html5Exporter] Failed to fetch theme: ${themeName}`, e);
                addFile('theme/content.css', this.getFallbackThemeCss());
                addFile('theme/default.js', this.getFallbackThemeJs());
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

            // 8. Detect and fetch additional required libraries based on content
            // Skip MathJax if LaTeX was pre-rendered to SVG+MathML (unless explicitly requested)
            // Skip Mermaid if diagrams were pre-rendered to static SVG
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
                const filename = i === 0 ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
                let html = pageHtmlMap.get(filename) || '';

                // Only add manifest script to pages that have download-source-file iDevice
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
            projectSubtitle: meta.subtitle || '',
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

    /**
     * Get CSS for pre-rendered Mermaid diagrams (static SVG)
     * This CSS is needed when Mermaid is pre-rendered instead of using the library at runtime
     */
    protected getPreRenderedMermaidCss(): string {
        return `/* Pre-rendered Mermaid (static SVG) - Mermaid library not included */
.exe-mermaid-rendered { display: block; text-align: center; margin: 1.5em 0; }
.exe-mermaid-rendered svg { max-width: 100%; height: auto; }`;
    }
}
