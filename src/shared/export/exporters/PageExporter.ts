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

import type {
    ExportDocument,
    ExportPage,
    ExportMetadata,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ExportOptions,
    ExportResult,
} from '../interfaces';
import { Html5Exporter } from './Html5Exporter';

export class PageExporter extends Html5Exporter {
    constructor(
        document: ExportDocument,
        resources: ResourceProvider,
        assets: AssetProvider,
        zip: ZipProvider
    ) {
        super(document, resources, assets, zip);
    }

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
            const themeName = (options as any)?.theme || meta.theme || 'base';

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // Get all iDevice types used in the project
            const usedIdevices = this.getUsedIdevices(pages);

            // 1. Generate single-page HTML with all content
            const html = this.generateSinglePageHtml(pages, meta, usedIdevices);
            this.zip.addFile('index.html', html);

            // 2. Add content.xml (ODE format for re-import)
            const contentXml = this.generateContentXml();
            this.zip.addFile('content.xml', contentXml);

            // 3. Add base CSS
            this.zip.addFile('content/css/base.css', this.getBaseCss());
            this.zip.addFile('content/css/single-page.css', this.getSinglePageCss());

            // 4. Fetch and add theme
            try {
                const themeFiles = await this.resources.fetchTheme(themeName);
                for (const [path, content] of themeFiles) {
                    this.zip.addFile(`theme/${path}`, content);
                }
            } catch {
                this.zip.addFile('theme/content.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/default.js', this.getFallbackThemeJs());
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

            // 6. Fetch and add iDevice assets
            for (const idevice of usedIdevices) {
                try {
                    const ideviceFiles =
                        await this.resources.fetchIdeviceResources(idevice);
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
        usedIdevices: string[]
    ): string {
        return this.pageRenderer.renderSinglePage(pages, {
            projectTitle: meta.title || 'eXeLearning',
            language: meta.language || 'en',
            theme: meta.theme || 'base',
            customStyles: meta.customStyles || '',
            usedIdevices,
            author: meta.author || '',
            license: meta.license || 'CC-BY-SA',
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
