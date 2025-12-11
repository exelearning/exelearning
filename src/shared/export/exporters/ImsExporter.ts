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
import { ImsManifestGenerator } from '../generators/ImsManifest';

export class ImsExporter extends Html5Exporter {
    protected manifestGenerator: ImsManifestGenerator | null = null;

    constructor(
        document: ExportDocument,
        resources: ResourceProvider,
        assets: AssetProvider,
        zip: ZipProvider
    ) {
        super(document, resources, assets, zip);
    }

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
            const themeName = (options as any)?.theme || meta.theme || 'base';
            const projectId = this.generateProjectId();

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // Initialize manifest generator
            this.manifestGenerator = new ImsManifestGenerator(
                projectId,
                pages,
                {
                    title: meta.title || 'eXeLearning',
                    language: meta.language || 'en',
                    author: meta.author || '',
                    description: meta.description || '',
                    license: meta.license || '',
                }
            );

            // Track files for manifest
            const commonFiles: string[] = [];
            const pageFiles: Record<
                string,
                { fileUrl: string; files: string[] }
            > = {};

            // 1. Generate HTML pages
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const isIndex = i === 0;
                const html = this.generateImsPageHtml(
                    page,
                    pages,
                    meta,
                    isIndex
                );
                const pageFilename = isIndex
                    ? 'index.html'
                    : `html/${this.sanitizePageFilename(page.title)}.html`;
                this.zip.addFile(pageFilename, html);

                pageFiles[page.id] = {
                    fileUrl: pageFilename,
                    files: [],
                };
            }

            // 2. Add base CSS
            this.zip.addFile('content/css/base.css', this.getBaseCss());
            commonFiles.push('content/css/base.css');

            // 3. Fetch and add theme
            try {
                const themeFiles = await this.resources.fetchTheme(themeName);
                for (const [path, content] of themeFiles) {
                    this.zip.addFile(`theme/${path}`, content);
                    commonFiles.push(`theme/${path}`);
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
                    const ideviceFiles =
                        await this.resources.fetchIdeviceResources(idevice);
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
        return (
            Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
        );
    }

    /**
     * Generate IMS CP HTML page (standard website, no SCORM)
     */
    generateImsPageHtml(
        page: ExportPage,
        allPages: ExportPage[],
        meta: ExportMetadata,
        isIndex: boolean
    ): string {
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
            bodyClass: 'exe-web-site exe-ims',
        });
    }
}
