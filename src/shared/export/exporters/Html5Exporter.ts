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

            // 1. Generate HTML pages
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const html = this.generatePageHtml(page, pages, meta, i === 0);
                // First page is index.html, others go in html/ directory
                const pageFilename = i === 0 ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
                this.zip.addFile(pageFilename, html);
            }

            // 2. Add content.xml (ODE format for re-import)
            const contentXml = this.generateContentXml();
            this.zip.addFile('content.xml', contentXml);

            // 3. Add base CSS
            this.zip.addFile('content/css/base.css', this.getBaseCss());

            // 4. Fetch and add theme
            try {
                const themeFiles = await this.resources.fetchTheme(themeName);
                console.log(`[Html5Exporter] Theme '${themeName}' files count: ${themeFiles.size}`);
                for (const [filePath, content] of themeFiles) {
                    console.log(`[Html5Exporter] Adding theme file: theme/${filePath}`);
                    this.zip.addFile(`theme/${filePath}`, content);
                }
            } catch (e) {
                // Add fallback theme if fetch fails
                console.warn(`[Html5Exporter] Failed to fetch theme: ${themeName}`, e);
                this.zip.addFile('theme/style.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/style.js', this.getFallbackThemeJs());
            }

            // 5. Detect and fetch required libraries
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const allRequiredFiles = this.libraryDetector.getAllRequiredFiles(allHtmlContent, {
                includeAccessibilityToolbar: meta.accessibilityToolbar === true,
            });

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles);
                for (const [path, content] of libFiles) {
                    this.zip.addFile(`libs/${path}`, content);
                }
            } catch {
                // Try base libraries as fallback
                try {
                    const baseLibs = await this.resources.fetchBaseLibraries();
                    for (const [path, content] of baseLibs) {
                        this.zip.addFile(`libs/${path}`, content);
                    }
                } catch {
                    // No libraries available
                }
            }

            // 6. Fetch and add iDevice assets
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
     * Generate complete HTML for a page
     */
    generatePageHtml(page: ExportPage, allPages: ExportPage[], meta: ExportMetadata, isIndex: boolean): string {
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
}
