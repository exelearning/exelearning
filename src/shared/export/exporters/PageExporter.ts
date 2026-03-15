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

// Regex to match <a> elements that have id or name but NO href (named anchors only)
const NAMED_ANCHOR_RE = /<a\s+(?=[^>]*(?:\bid\b|\bname\b)=)(?![^>]*\bhref\b=)[^>]*>/gi;
const ID_NAME_ATTR_RE = /\b(id|name)="([^"]+)"/gi;

/**
 * PageExporter - Single-page HTML export
 *
 * For internal links, uses anchor fragments (#page-content-pageId)
 * instead of file paths since all content is on one page.
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

            // 1. Generate single-page HTML with all content

            const html = this.generateSinglePageHtml(pages, meta, usedIdevices, faviconInfo);
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
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
                allHtmlContent,
                {
                    includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                    includeMathJax: meta.addMathJax === true, // MATHJAX is included if requested
                },
            );

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
            const singlePageHtml = await this.generateSinglePageHtml(
                pages,
                meta,
                usedIdevices,
                faviconInfo,
                patterns.map(p => p.name),
                meta.addMathJax === true,
            );
            this.zip.addFile(options?.filename || 'index.html', singlePageHtml);

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
    ): string {
        return this.pageRenderer.renderSinglePage(pages, {
            projectTitle: meta.title || 'eXeLearning',
            projectSubtitle: meta.subtitle || '',
            language: meta.language || 'en',
            customStyles: meta.customStyles || '',
            usedIdevices,
            author: meta.author || '',
            license: meta.license || '',
            faviconPath: faviconInfo?.path,
            faviconType: faviconInfo?.type,
            // Application version for generator meta tag
            version: meta.exelearningVersion,
            detectedLibraries,
            addMathJax,
        });
    }

    /**
     * Override pre-processing to namespace named anchors before resolving internal links.
     * In single-page export all pages share one HTML document, so anchor ids like "intro"
     * on different pages would collide. We prefix them with the page id (e.g. "page-2--intro")
     * so that exe-node:page-2#intro resolves unambiguously.
     */
    async preprocessPagesForExport(pages: ExportPage[]): Promise<ExportPage[]> {
        const clonedPages: ExportPage[] = JSON.parse(JSON.stringify(pages));
        const pageUrlMap = this.buildPageUrlMap(clonedPages);

        for (let pageIndex = 0; pageIndex < clonedPages.length; pageIndex++) {
            const page = clonedPages[pageIndex];
            const isIndex = pageIndex === 0;

            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.content) {
                        component.content = await this.addFilenamesToAssetUrls(component.content);
                        // Namespace anchors BEFORE resolving links so links know the prefix
                        component.content = this.namespaceSinglePageAnchors(component.content, page.id);
                        component.content = this.replaceInternalLinks(component.content, pageUrlMap, isIndex);
                    }
                    if (component.properties && Object.keys(component.properties).length > 0) {
                        const propsStr = JSON.stringify(component.properties);
                        const processedStr = await this.addFilenamesToAssetUrls(propsStr);
                        component.properties = JSON.parse(processedStr);
                    }
                }
            }
        }
        return clonedPages;
    }

    /**
     * Prefix id/name attributes on named anchors (<a> without href) with the page id.
     * This avoids collisions when all pages are merged into a single HTML document.
     * E.g. <a id="intro"> on page "page-2" becomes <a id="page-2--intro">
     */
    namespaceSinglePageAnchors(content: string, pageId: string): string {
        if (!content) return content;
        return content.replace(NAMED_ANCHOR_RE, match =>
            match.replace(ID_NAME_ATTR_RE, (_, attr, value) => `${attr}="${pageId}--${value}"`),
        );
    }

    /**
     * Override page URL map for single-page export
     * Uses anchor fragments instead of file paths
     */
    protected buildPageUrlMap(pages: ExportPage[]): Map<string, { url: string; urlFromSubpage: string }> {
        const map = new Map<string, { url: string; urlFromSubpage: string }>();

        for (const page of pages) {
            // All pages use anchor fragments on the same page
            // Uses section-{id} to match the IDs generated in renderSinglePageSection
            const anchor = `#section-${page.id}`;
            map.set(page.id, {
                url: anchor,
                urlFromSubpage: anchor, // Same since it's all one page
            });
        }

        return map;
    }

    /**
     * Override internal link replacement for single-page export.
     * When a link carries its own anchor (exe-node:pageId#anchor), use just #anchor
     * since all content is in the same document. Without an anchor, use #section-pageId.
     */
    protected replaceInternalLinks(
        content: string,
        pageUrlMap: Map<string, { url: string; urlFromSubpage: string }>,
        isFromIndex: boolean,
    ): string {
        if (!content || !content.includes('exe-node:')) {
            return content;
        }

        return content.replace(/href=["']exe-node:([^"']+)["']/gi, (match, pageIdWithAnchor) => {
            const hashIdx = pageIdWithAnchor.indexOf('#');
            const pageId = hashIdx !== -1 ? pageIdWithAnchor.substring(0, hashIdx) : pageIdWithAnchor;
            const anchorFragment = hashIdx !== -1 ? pageIdWithAnchor.substring(hashIdx) : '';

            if (!pageUrlMap.has(pageId)) {
                console.warn(`[PageExporter] Internal link target not found: ${pageId}`);
                return match;
            }

            // If the link has its own anchor, prefix it with the target page id
            // so it matches the namespaced id/name (e.g. #intro → #page-2--intro)
            if (anchorFragment) {
                return `href="#${pageId}--${anchorFragment.substring(1)}"`;
            }

            // No anchor: navigate to the page section
            const pageUrl = pageUrlMap.get(pageId)!;
            return `href="${isFromIndex ? pageUrl.url : pageUrl.urlFromSubpage}"`;
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
