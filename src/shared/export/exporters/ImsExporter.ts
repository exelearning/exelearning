/**
 * ImsExporter
 *
 * Exports a document to IMS Content Package format (ZIP).
 *
 * IMS CP export creates:
 * - imsmanifest.xml (IMS CP manifest with LOM metadata)
 * - content.xml (ODE format for re-editing)
 * - content.dtd (DTD for XML validation)
 * - index.html (first page)
 * - html/*.html (other pages)
 * - libs/ (JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 */

import type { ExportPage, ExportMetadata, ExportOptions, ExportResult, FaviconInfo } from '../interfaces';
import { Html5Exporter } from './Html5Exporter';
import { ImsManifestGenerator } from '../generators/ImsManifest';
import { generateOdeXml } from '../generators/OdeXmlGenerator';
import { ODE_DTD_FILENAME, ODE_DTD_CONTENT } from '../constants';
import { GlobalFontGenerator } from '../utils/GlobalFontGenerator';

export class ImsExporter extends Html5Exporter {
    protected manifestGenerator: ImsManifestGenerator | null = null;

    /**
     * Get file suffix for IMS CP format
     */
    getFileSuffix(): string {
        return '_ims';
    }

    /**
     * Export to IMS Content Package ZIP
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();

        try {
            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = options?.theme || meta.theme || 'base';
            const projectId = this.generateProjectId();

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // Filter out hidden pages (visibility: false)
            pages = pages.filter(p => this.isPageVisible(p, pages));

            // Build unique filename map for all pages (handles collisions)
            const pageFilenameMap = this.buildPageFilenameMap(pages);

            // Check for ELPX download support (looks for exe-package:elp in content)
            const needsElpxDownload = this.needsElpxDownloadSupport(pages);

            // File tracking for ELPX manifest (only when download-source-file is used)
            const fileList: string[] | null = needsElpxDownload ? [] : null;
            const addFile = (path: string, content: Uint8Array | string) => {
                this.zip.addFile(path, content);
                if (fileList) fileList.push(path);
            };

            // Initialize manifest generator
            this.manifestGenerator = new ImsManifestGenerator(projectId, pages, {
                identifier: projectId,
                pages: pages,
                title: meta.title || 'eXeLearning',
                language: meta.language || 'en',
                author: meta.author || '',
                description: meta.description || '',
                license: meta.license || '',
            });

            // Track files for manifest
            const commonFiles: string[] = [];
            const pageFiles: Record<string, { fileUrl: string; files: string[] }> = {};

            // 0. Pre-fetch theme to get the list of CSS/JS files for HTML includes
            const { themeFilesMap, themeRootFiles, faviconInfo } = await this.prepareThemeData(themeName);

            // Configure iDevice renderer with theme files for icon resolution
            this.ideviceRenderer.setThemeIconFiles(themeFilesMap);

            // 1. Generate HTML pages (with optional LaTeX/Mermaid pre-rendering)
            const pageHtmlMap = new Map<string, string>();
            let latexWasRendered = false;
            let mermaidWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const isIndex = i === 0;
                let html = this.generateImsPageHtml(
                    page,
                    pages,
                    meta,
                    isIndex,
                    themeRootFiles,
                    i,
                    faviconInfo,
                    pageFilenameMap,
                );

                // Pre-render LaTeX ONLY if addMathJax is false
                if (!meta.addMathJax) {
                    // Pre-render LaTeX in encrypted DataGame divs FIRST
                    if (options?.preRenderDataGameLatex) {
                        try {
                            const result = await options.preRenderDataGameLatex(html);
                            if (result.count > 0) {
                                html = result.html;
                                latexWasRendered = true;
                                console.log(
                                    `[ImsExporter] Pre-rendered LaTeX in ${result.count} DataGame(s) on page: ${page.title}`,
                                );
                            }
                        } catch (error) {
                            console.warn('[ImsExporter] DataGame LaTeX pre-render failed for page:', page.title, error);
                        }
                    }

                    // Pre-render visible LaTeX to SVG+MathML
                    if (options?.preRenderLatex) {
                        try {
                            const result = await options.preRenderLatex(html);
                            if (result.latexRendered) {
                                html = result.html;
                                latexWasRendered = true;
                                console.log(
                                    `[ImsExporter] Pre-rendered ${result.count} LaTeX expressions on page: ${page.title}`,
                                );
                            }
                        } catch (error) {
                            console.warn('[ImsExporter] LaTeX pre-render failed for page:', page.title, error);
                        }
                    }
                }

                // Pre-render Mermaid diagrams to static SVG
                if (options?.preRenderMermaid) {
                    try {
                        const result = await options.preRenderMermaid(html);
                        if (result.mermaidRendered) {
                            html = result.html;
                            mermaidWasRendered = true;
                            console.log(
                                `[ImsExporter] Pre-rendered ${result.count} Mermaid diagram(s) on page: ${page.title}`,
                            );
                        }
                    } catch (error) {
                        console.warn('[ImsExporter] Mermaid pre-render failed for page:', page.title, error);
                    }
                }

                // Use unique filename from the map (handles title collisions)
                const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const pageFilename = isIndex ? 'index.html' : `html/${uniqueFilename}`;
                pageHtmlMap.set(pageFilename, html);

                pageFiles[page.id] = {
                    fileUrl: pageFilename,
                    files: [],
                };
            }

            // Note: IMS exports do NOT include search_index.js
            // The LMS handles navigation, so client-side search is not needed

            // 2. Add base CSS (fetch from content/css) and pre-rendered LaTeX/Mermaid CSS
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
            commonFiles.push('content/css/base.css');

            // 3. Add theme files (already pre-fetched in step 0)
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    addFile(`theme/${filePath}`, content);
                    commonFiles.push(`theme/${filePath}`);
                }
            } else {
                addFile('theme/style.css', this.getFallbackThemeCss());
                addFile('theme/style.js', this.getFallbackThemeJs());
                commonFiles.push('theme/style.css', 'theme/style.js');
            }

            // 4. Fetch and add base libraries
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [path, content] of baseLibs) {
                    addFile(`libs/${path}`, content);
                    commonFiles.push(`libs/${path}`);
                }
            } catch {
                // No base libraries available
            }

            // 4.5. Generate localized i18n file
            const i18nContent = await this.generateI18nContent(meta.language || 'en');
            addFile('libs/common_i18n.js', new TextEncoder().encode(i18nContent));
            commonFiles.push('libs/common_i18n.js');

            // 5. Detect and fetch additional required libraries based on content
            const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
                includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                includeMathJax: meta.addMathJax === true,
                skipMathJax: latexWasRendered && !meta.addMathJax,
            });

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [libPath, content] of libFiles) {
                    // Only add if not already added by base libraries
                    const zipPath = `libs/${libPath}`;
                    if (!this.zip.hasFile(zipPath)) {
                        addFile(zipPath, content);
                        commonFiles.push(zipPath);
                    }
                }
            } catch {
                // Additional libraries not available - continue anyway
            }

            // 5b. Ensure ELPX download libraries are present
            if (needsElpxDownload) {
                await this.ensureElpxDownloadLibraries(addFile, commonFiles);
            }

            // 6. Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    const normalizedType = this.resources.normalizeIdeviceType(idevice);
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [path, content] of ideviceFiles) {
                        addFile(`idevices/${normalizedType}/${path}`, content);
                        commonFiles.push(`idevices/${normalizedType}/${path}`);
                    }
                } catch {
                    // Many iDevices don't have extra files
                }
            }

            // 7. Fetch and add global font files (if selected)
            if (meta.globalFont && meta.globalFont !== 'default') {
                try {
                    const fontFiles = await this.resources.fetchGlobalFontFiles(meta.globalFont);
                    if (fontFiles) {
                        for (const [filePath, content] of fontFiles) {
                            addFile(filePath, content);
                            commonFiles.push(filePath);
                        }
                    }
                } catch (e) {
                    console.warn(`[ImsExporter] Failed to fetch global font files: ${meta.globalFont}`, e);
                }
            }

            // 8. Add project assets (with tracking for ELPX manifest)
            await this.addAssetsToZipWithResourcePath(fileList);

            // 8b. Add content.xml (ODE format) and content.dtd for re-editing
            const contentXml = generateOdeXml(meta, pages);
            addFile('content.xml', contentXml);
            addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);
            commonFiles.push('content.xml', ODE_DTD_FILENAME);

            // 9. Generate ELPX manifest file if download-source-file is used
            if (needsElpxDownload && fileList) {
                const pageUrls = Object.values(pageFiles).map(pf => pf.fileUrl);
                this.addElpxManifestToZip(fileList, pageUrls, commonFiles);
            }

            // 10. Add all HTML pages to ZIP (with ELPX script injection on pages with download-source-file)
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const isIndex = i === 0;
                const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const filename = isIndex ? 'index.html' : `html/${uniqueFilename}`;
                let html = pageHtmlMap.get(filename) || '';
                if (needsElpxDownload) {
                    html = this.injectElpxScripts(html, page, isIndex);
                }
                this.zip.addFile(filename, html);
            }

            // 11. Generate imsmanifest.xml with complete file list
            // Get all files from the ZIP to ensure the manifest lists ALL resources
            const allZipFiles = this.zip.getFilePaths();
            const manifestXml = this.manifestGenerator.generate({
                commonFiles,
                pageFiles,
                allZipFiles,
            });
            this.zip.addFile('imsmanifest.xml', manifestXml);

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
     * Generate project ID for IMS package
     */
    generateProjectId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }

    /**
     * Generate IMS CP HTML page (standard website, no SCORM)
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param themeFiles - List of root-level theme CSS/JS files
     * @param pageIndex - Index of the current page (for page counter)
     * @param faviconInfo - Favicon info (optional)
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     */
    generateImsPageHtml(
        page: ExportPage,
        allPages: ExportPage[],
        meta: ExportMetadata,
        isIndex: boolean,
        themeFiles?: string[],
        pageIndex?: number,
        faviconInfo?: FaviconInfo | null,
        pageFilenameMap?: Map<string, string>,
    ): string {
        const basePath = isIndex ? '' : '../';
        const usedIdevices = this.getUsedIdevicesForPage(page);

        // Generate global font CSS if a font is selected
        let customStyles = meta.customStyles || '';
        let bodyClass = 'exe-export exe-ims';
        if (meta.globalFont && meta.globalFont !== 'default') {
            const globalFontCss = GlobalFontGenerator.generateCss(meta.globalFont, basePath);
            if (globalFontCss) {
                // Prepend global font CSS to customStyles
                customStyles = globalFontCss + '\n' + customStyles;
            }
            // Add font-specific body class
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
            customStyles: customStyles,
            allPages,
            basePath,
            isIndex,
            usedIdevices,
            author: meta.author || '',
            license: meta.license || '',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || '',
            // Export options - IMS specific overrides
            // IMS exports don't use client-side search - LMS handles navigation
            addSearchBox: false,
            // Force page counter for IMS
            addPagination: true,
            totalPages: allPages.length,
            currentPageIndex: pageIndex ?? 0,
            bodyClass: bodyClass,
            // Hide navigation elements - LMS handles navigation in IMS
            hideNavigation: true,
            hideNavButtons: true,
            // Theme files for HTML head includes
            themeFiles: themeFiles || [],
            // Favicon options
            faviconPath: faviconInfo?.path,
            faviconType: faviconInfo?.type,
            // Page filename map for navigation links (handles title collisions)
            pageFilenameMap,
            // Application version for generator meta tag
            version: meta.exelearningVersion,
        });
    }
}
