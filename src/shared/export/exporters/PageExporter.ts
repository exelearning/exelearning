/**
 * PageExporter
 *
 * Exports a document to single-page HTML format (ZIP).
 * Generates a single index.html with all pages using anchor navigation.
 *
 * Single-page (HTML5SP) export creates:
 * - index.html (all pages in one document)
 * - libs/ (JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 */

import type { ExportPage, ExportMetadata, ExportOptions, ExportResult, FaviconInfo } from '../interfaces';
import { Html5Exporter } from './Html5Exporter';

/**
 * PageExporter - Single-page HTML export
 *
 * For internal links, uses anchor fragments (#section-pageId) instead of file paths
 * since all content is on one page. The exe-node: → anchor rewrite and named-anchor
 * namespacing are applied at render time in PageRenderer.renderSinglePage(), so the
 * re-editable content.xml keeps the raw exe-node: references (#1927).
 */
export class PageExporter extends Html5Exporter {
    /**
     * Get file suffix for PAGE format
     */
    getFileSuffix(): string {
        return '_page';
    }

    /**
     * Export to single-page HTML ZIP
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();

        try {
            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = options?.theme || meta.theme || 'base';

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // Filter out hidden pages (visibility: false)
            pages = pages.filter(p => this.isPageVisible(p, pages));

            // Get all iDevice types used in the project
            const usedIdevices = this.getUsedIdevices(pages);
            const includeMathJax = meta.addMathJax === true;
            let latexWasRendered = false;

            // 4. Fetch and add theme
            const { themeFilesMap, faviconInfo } = await this.prepareThemeData(themeName);
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    this.zip.addFile(`theme/${filePath}`, content);
                }
            } else {
                this.zip.addFile('theme/style.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/style.js', this.getFallbackThemeJs());
            }

            // Pre-process pages: Mermaid pre-rendering
            // Mermaid diagrams must be converted to SVG before export
            // We process per-component content to avoid regex issues on the massive single-page HTML
            if (options?.preRenderMermaid) {
                for (const page of pages) {
                    if (page.blocks) {
                        for (const block of page.blocks) {
                            if (block.components) {
                                for (const component of block.components) {
                                    try {
                                        // Check if content has potential Mermaid diagrams
                                        if (
                                            component.content &&
                                            (component.content.includes('class="mermaid"') ||
                                                component.content.includes("class='mermaid'"))
                                        ) {
                                            const result = await options.preRenderMermaid(component.content);
                                            // Only update if changes were made
                                            if (result.mermaidRendered) {
                                                component.content = result.html;
                                            }
                                        }
                                    } catch (e) {
                                        console.warn(
                                            `[PageExporter] Mermaid pre-render error for component ${component.id}:`,
                                            e,
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Fetch translated nav labels for the content language (includes license)
            const navLabels = await this.fetchNavLabels(meta.language || 'en', meta.license);

            // 1. Generate single-page HTML with all content
            const html = this.generateSinglePageHtml(
                pages,
                meta,
                usedIdevices,
                faviconInfo,
                [],
                includeMathJax,
                navLabels,
            );
            this.zip.addFile('index.html', html);

            // 2. Add base CSS (fetch from content/css)
            const contentCssFiles = await this.resources.fetchContentCss();
            const baseCss = contentCssFiles.get('content/css/base.css');
            if (!baseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            this.zip.addFile('content/css/base.css', baseCss);
            this.zip.addFile('content/css/single-page.css', this.getSinglePageCss());

            // 3. Add content.xml (ODE format for re-import) - only if exportSource is enabled
            if (meta.exportSource !== false) {
                const contentXml = this.generateContentXml(pages);
                this.zip.addFile('content.xml', contentXml);
            }

            // 4. Add eXeLearning logo for "Made with eXeLearning" footer
            if (meta.addExeLink !== false) {
                try {
                    const logoData = await this.resources.fetchExeLogo();
                    if (logoData) {
                        this.zip.addFile('content/img/exe_powered_logo.png', logoData);
                    }
                } catch {
                    // Logo not available - footer will still render but without background image
                }
            }

            // 5. Fetch and add base libraries
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [path, content] of baseLibs) {
                    this.zip.addFile(`libs/${path}`, content);
                }
            } catch {
                // No base libraries available
            }

            // 5.b Detect and fetch additional required libraries based on content
            // This is crucial for things like MathJax, Tooltips, etc.
            const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
                includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                includeMathJax,
            });

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
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

            // 5.5. Generate localized i18n file
            const i18nContent = await this.generateI18nContent(meta.language || 'en');
            this.zip.addFile('libs/common_i18n.js', i18nContent);

            // 6. Fetch and add iDevice assets (test files filtered at provider level)
            // Note: in single page export, all assets are in the same zip and handled by AssetResolver
            // But we still need to make sure iDevice specific resources (like icons) are handled.
            // PageRenderer.renderSinglePage calls ideviceRenderer.renderBlock which handles structure.

            // 7. Generate single page HTML
            let singlePageHtml = await this.generateSinglePageHtml(
                pages,
                meta,
                usedIdevices,
                faviconInfo,
                patterns.map(p => p.name),
                includeMathJax,
                navLabels,
            );

            // Pre-render LaTeX to SVG+MathML when MathJax is not bundled, so
            // adaptative-quiz / trueorfalse keep their math through runtime escaping.
            // The whole document is one HTML here, so we render it in a single pass
            // (mirrors the per-page HTML5 export; see RECURSIVE_JSON_LATEX_IDEVICES).
            if (!includeMathJax) {
                const latexResult = await this.preRenderHtmlLatex(singlePageHtml, options);
                singlePageHtml = latexResult.html;
                latexWasRendered = latexResult.latexRendered;
            }
            this.zip.addFile(options?.filename || 'index.html', singlePageHtml);

            // Append the pre-rendered LaTeX CSS to base.css (overwrites the earlier
            // entry) so the baked SVG renders correctly without the MathJax engine.
            // The single-page template only links content/css/base.css.
            if (latexWasRendered) {
                const decoder = new TextDecoder();
                const encoder = new TextEncoder();
                const baseCssText = decoder.decode(baseCss) + '\n' + this.getPreRenderedLatexCss();
                this.zip.addFile('content/css/base.css', encoder.encode(baseCssText));
            }

            // 8. Generate CSS files
            const cssFiles = await this.resources.fetchContentCss();
            for (const idevice of usedIdevices) {
                try {
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [path, content] of ideviceFiles) {
                        this.zip.addFile(`idevices/${idevice}/${path}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files
                }
            }

            // 7. Add project assets
            await this.addAssetsToZipWithResourcePath();

            // 8. Generate ZIP buffer
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
     * Generate single-page HTML with all pages
     */
    generateSinglePageHtml(
        pages: ExportPage[],
        meta: ExportMetadata,
        usedIdevices: string[],
        faviconInfo?: FaviconInfo | null,
        detectedLibraries: string[] = [],
        addMathJax = false,
        navLabels?: { previous: string; next: string; page: string; license?: string },
    ): string {
        return this.pageRenderer.renderSinglePage(pages, {
            projectTitle: meta.title || 'eXeLearning',
            projectSubtitle: meta.subtitle || '',
            language: meta.language || 'en',
            customStyles: meta.customStyles || '',
            usedIdevices,
            author: meta.author || '',
            license: meta.license || '',
            licenseUrl: meta.licenseUrl || '',
            faviconPath: faviconInfo?.path,
            faviconType: faviconInfo?.type,
            // Application version for generator meta tag
            version: meta.exelearningVersion,
            // xAPI runtime config for the always-on emitter (stable IRIs from odeId)
            xapi: { odeId: meta.odeIdentifier || '', packageTitle: meta.title || '', language: meta.language || 'en' },
            detectedLibraries,
            linkToElp: meta.exportSource !== false,
            addMathJax,
            addExeLink: meta.addExeLink ?? true,
            // Pre-translated nav labels (resolved from XLF at export time)
            navLabels,
        });
    }

    /**
     * Get CSS specific to single-page layout
     */
    getSinglePageCss(): string {
        return `/* Single-page specific styles */
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

/* Section target offset for fixed header */
.single-page-section:target {
  scroll-margin-top: 20px;
}

/* Print styles for single page */
@media print {
  .exe-single-page .single-page-nav {
    display: none;
  }
  .exe-single-page .single-page-section {
    page-break-inside: avoid;
  }
}
`;
    }
}
