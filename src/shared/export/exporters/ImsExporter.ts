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
import { generateI18nScript } from '../generators/I18nGenerator';

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

            // Build unique filename map for all pages (handles collisions)
            const pageFilenameMap = this.buildPageFilenameMap(pages);

            // Initialize manifest generator
            this.manifestGenerator = new ImsManifestGenerator(projectId, pages, {
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

            // 1. Generate HTML pages (with optional LaTeX pre-rendering)
            let latexWasRendered = false;

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
                // When MathJax is included, let it process LaTeX at runtime for full UX (context menu, accessibility)
                if (!meta.addMathJax && options?.preRenderLatex) {
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

                // Use unique filename from the map (handles title collisions)
                const uniqueFilename = pageFilenameMap.get(page.id) || 'page.html';
                const pageFilename = isIndex ? 'index.html' : `html/${uniqueFilename}`;
                this.zip.addFile(pageFilename, html);

                pageFiles[page.id] = {
                    fileUrl: pageFilename,
                    files: [],
                };
            }

            // Note: IMS exports do NOT include search_index.js
            // The LMS handles navigation, so client-side search is not needed

            // 2. Add base CSS (fetch from content/css) and pre-rendered LaTeX CSS
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
            commonFiles.push('content/css/base.css');

            // 3. Add theme files (already pre-fetched in step 0)
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    this.zip.addFile(`theme/${filePath}`, content);
                    commonFiles.push(`theme/${filePath}`);
                }
            } else {
                this.zip.addFile('theme/style.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/style.js', this.getFallbackThemeJs());
                commonFiles.push('theme/style.css', 'theme/style.js');
            }

            // 4. Fetch and add base libraries
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [path, content] of baseLibs) {
                    this.zip.addFile(`libs/${path}`, content);
                    commonFiles.push(`libs/${path}`);
                }
            } catch {
                // No base libraries available
            }

            // 4.5. Generate localized i18n file
            const i18nContent = generateI18nScript(meta.language || 'en');
            this.zip.addFile('libs/common_i18n.js', i18nContent);
            commonFiles.push('libs/common_i18n.js');

            // 5. Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [path, content] of ideviceFiles) {
                        this.zip.addFile(`idevices/${idevice}/${path}`, content);
                        commonFiles.push(`idevices/${idevice}/${path}`);
                    }
                } catch {
                    // Many iDevices don't have extra files
                }
            }

            // 6. Add project assets
            await this.addAssetsToZipWithResourcePath();

            // 6b. Add content.xml (ODE format) and content.dtd for re-editing
            const contentXml = generateOdeXml(meta, pages);
            this.zip.addFile('content.xml', contentXml);
            this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);
            commonFiles.push('content.xml', ODE_DTD_FILENAME);

            // 7. Generate imsmanifest.xml with complete file list
            // Get all files from the ZIP to ensure the manifest lists ALL resources
            const allZipFiles = this.zip.getFilePaths();
            const manifestXml = this.manifestGenerator.generate({
                commonFiles,
                pageFiles,
                allZipFiles,
            });
            this.zip.addFile('imsmanifest.xml', manifestXml);

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
            license: meta.license || 'CC-BY-SA',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/',
            // Export options - IMS specific overrides
            // IMS exports don't use client-side search - LMS handles navigation
            addSearchBox: false,
            // Force page counter for IMS
            addPagination: true,
            totalPages: allPages.length,
            currentPageIndex: pageIndex ?? 0,
            bodyClass: 'exe-export exe-ims',
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
        });
    }
}
