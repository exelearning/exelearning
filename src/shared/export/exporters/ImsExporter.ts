/**
 * ImsExporter
 *
 * Exports a document to IMS Content Package format (ZIP).
 *
 * IMS CP export creates:
 * - imsmanifest.xml (IMS CP manifest with LOM metadata)
 * - index.html (first page)
 * - html/*.html (other pages)
 * - libs/ (JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content/resources/ (project assets)
 * - content/css/ (base CSS)
 */

import type { ExportPage, ExportMetadata, ExportOptions, ExportResult } from '../interfaces';
import { Html5Exporter } from './Html5Exporter';
import { ImsManifestGenerator } from '../generators/ImsManifest';

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

            // 1. Generate HTML pages (with optional LaTeX pre-rendering)
            let latexWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const isIndex = i === 0;
                let html = this.generateImsPageHtml(page, pages, meta, isIndex);

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

                const pageFilename = isIndex ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
                this.zip.addFile(pageFilename, html);

                pageFiles[page.id] = {
                    fileUrl: pageFilename,
                    files: [],
                };
            }

            // 1b. Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '');
                this.zip.addFile('search_index.js', searchIndexContent);
                commonFiles.push('search_index.js');
            }

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

            // 3. Fetch and add theme (renaming style.css -> content.css, style.js -> default.js)
            try {
                const themeFiles = await this.resources.fetchTheme(themeName);
                for (const [filePath, content] of themeFiles) {
                    // Rename theme files to legacy export format
                    let exportPath = filePath;
                    if (filePath === 'style.css') {
                        exportPath = 'content.css';
                    } else if (filePath === 'style.js') {
                        exportPath = 'default.js';
                    }
                    this.zip.addFile(`theme/${exportPath}`, content);
                    commonFiles.push(`theme/${exportPath}`);
                }
            } catch {
                this.zip.addFile('theme/content.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/default.js', this.getFallbackThemeJs());
                commonFiles.push('theme/content.css', 'theme/default.js');
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

            // 7. Generate imsmanifest.xml
            const manifestXml = this.manifestGenerator.generate({
                commonFiles,
                pageFiles,
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
     */
    generateImsPageHtml(page: ExportPage, allPages: ExportPage[], meta: ExportMetadata, isIndex: boolean): string {
        const basePath = isIndex ? '' : '../';
        const usedIdevices = this.getUsedIdevicesForPage(page);

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
            license: meta.license || 'CC-BY-SA',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/',
            // Export options
            addSearchBox: meta.addSearchBox ?? false,
            bodyClass: 'exe-web-site exe-ims',
        });
    }
}
