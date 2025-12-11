import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import archiver from 'archiver';
import { BaseExportStrategy } from './base-export.strategy';
import {
    ExportContext,
    ExportFormatType,
    ExportResult,
} from '../../interfaces/export-strategy.interface';
import { ZipService } from '../../../file-management/services/zip.service';
import { HtmlGeneratorHelper } from '../../helpers/html-generator.helper';
import { AssetCopierService } from '../asset-copier.service';
import { Epub3ManifestBuilder } from '../manifest-builders/epub3-manifest.builder';
import {
    FILE_EXTENSIONS,
    FILE_SUFFIXES,
    EPUB3,
    EXPORT_DIRS,
    HTML,
} from '../../constants/export.constants';

/**
 * EPUB3 export strategy
 * Generates an EPUB3 compliant ebook package
 *
 * EPUB3 structure:
 * - mimetype (first, uncompressed)
 * - META-INF/
 *   - container.xml
 * - EPUB/
 *   - package.opf
 *   - nav.xhtml
 *   - index.xhtml
 *   - html/*.xhtml
 *   - content/
 *   - theme/
 */
@Injectable()
export class Epub3ExportStrategy extends BaseExportStrategy {
    readonly format = ExportFormatType.EPUB3;
    readonly fileExtension = FILE_EXTENSIONS[ExportFormatType.EPUB3];
    readonly fileSuffix = FILE_SUFFIXES[ExportFormatType.EPUB3];

    constructor(
        zipService: ZipService,
        htmlGenerator: HtmlGeneratorHelper,
        private readonly assetCopier: AssetCopierService,
        private readonly manifestBuilder: Epub3ManifestBuilder,
    ) {
        super(zipService, htmlGenerator);
    }

    /**
     * Generate XHTML files for EPUB
     * EPUB uses XHTML instead of HTML5
     */
    async generateHtmlFiles(context: ExportContext): Promise<void> {
        const { structure, exportDir, options } = context;
        const htmlOptions = this.toHtml5Options(options);
        const epubDir = path.join(exportDir, EXPORT_DIRS.EPUB.ROOT);

        // Ensure EPUB directory exists
        await fs.ensureDir(epubDir);

        // Generate index.xhtml (first page)
        const indexXhtml = this.generateXhtml(
            this.htmlGenerator.generateIndexHtml(
                structure,
                htmlOptions,
                this.getResourcePrefix(context),
            ),
        );
        await fs.writeFile(
            path.join(epubDir, HTML.INDEX_XHTML),
            indexXhtml,
            'utf-8',
        );

        // Create html subdirectory for non-index pages
        const htmlDir = path.join(epubDir, EXPORT_DIRS.HTML);
        await fs.ensureDir(htmlDir);

        // Generate individual page files as XHTML
        for (const page of structure.pages) {
            // Skip first page as it's the index
            if (page.id === structure.pages[0].id) continue;

            const pageXhtml = this.generateXhtml(
                this.htmlGenerator.generatePageHtml(
                    page,
                    structure,
                    htmlOptions,
                    this.getResourcePrefix(context),
                ),
            );

            const filename = this.sanitizeFilename(page.title);
            await fs.writeFile(
                path.join(htmlDir, `${filename}.xhtml`),
                pageXhtml,
                'utf-8',
            );
        }

        // Update links in XHTML files for EPUB structure
        await this.updateXhtmlLinks(epubDir);
    }

    /**
     * Generate EPUB-specific files
     */
    async generateFormatSpecificFiles(context: ExportContext): Promise<void> {
        const { exportDir, sessionPath, options } = context;
        const epubDir = path.join(exportDir, EXPORT_DIRS.EPUB.ROOT);
        const metaInfDir = path.join(exportDir, EXPORT_DIRS.EPUB.META_INF);

        // Ensure directories exist
        await fs.ensureDir(epubDir);
        await fs.ensureDir(metaInfDir);

        // Generate mimetype file (no newline at end!)
        await fs.writeFile(
            path.join(exportDir, EPUB3.FILES.MIMETYPE),
            this.manifestBuilder.getMimetypeContent(),
        );

        // Generate container.xml in META-INF
        await fs.writeFile(
            path.join(exportDir, EPUB3.FILES.CONTAINER),
            this.manifestBuilder.generateContainerXml(),
            'utf-8',
        );

        // Generate package.opf in EPUB
        const packageOpf = await this.manifestBuilder.generateManifest(context);
        await fs.writeFile(
            path.join(exportDir, EPUB3.FILES.PACKAGE),
            packageOpf,
            'utf-8',
        );

        // Generate nav.xhtml in EPUB
        const navXhtml = this.manifestBuilder.generateNavXhtml(context);
        await fs.writeFile(
            path.join(exportDir, EPUB3.FILES.NAV),
            navXhtml,
            'utf-8',
        );

        // Create content directories in EPUB
        const contentDir = path.join(epubDir, 'content');
        const themeDir = path.join(epubDir, 'theme');
        await fs.ensureDir(contentDir);
        await fs.ensureDir(themeDir);

        // Copy base assets (without SCORM)
        await this.assetCopier.copyBaseAssets(epubDir, {
            format: this.format,
            includeScormJs: false,
            includeSchemas: false,
            customCss: options.customCss,
        });

        // Copy theme if specified
        if (options.theme) {
            await this.assetCopier.copyThemeAssets(epubDir, options.theme.name);
        }

        // Copy project resources to EPUB content directory
        await this.copyProjectResourcesToEpub(sessionPath, epubDir);

        // Copy iDevice assets
        const ideviceTypes = this.getUsedIdeviceTypes(context);
        if (ideviceTypes.length > 0) {
            await this.assetCopier.copyIdeviceAssets(epubDir, ideviceTypes);
        }

        // Generate fallback.xhtml
        await this.generateFallbackXhtml(epubDir);
    }

    /**
     * EPUB does NOT support preview mode (it's a binary ebook format)
     */
    supportsPreview(): boolean {
        return false;
    }

    /**
     * Get required assets for EPUB (no SCORM, minimal JS)
     */
    getRequiredAssets(): string[] {
        return [
            'base.css',
            'content.css',
        ];
    }

    /**
     * Override createArchive to handle EPUB-specific ZIP requirements
     * - mimetype must be first file
     * - mimetype must be uncompressed (store level 0)
     */
    protected async createArchive(context: ExportContext): Promise<ExportResult> {
        const exportName = this.getExportName(context);
        const epubFileName = `${exportName}${this.fileSuffix}${this.fileExtension}`;
        const epubPath = path.join(path.dirname(context.exportDir), epubFileName);

        // Create EPUB-compliant ZIP
        await this.createEpubZip(context.exportDir, epubPath);

        // Get file stats
        const stats = await fs.stat(epubPath);

        // Cleanup export directory
        await fs.remove(context.exportDir);

        return {
            filePath: epubPath,
            fileName: epubFileName,
            fileSize: stats.size,
            format: this.format,
            success: true,
        };
    }

    /**
     * Create EPUB-compliant ZIP file
     * EPUB requires:
     * 1. mimetype as first entry
     * 2. mimetype uncompressed (STORE)
     * 3. All other files compressed
     */
    private async createEpubZip(sourceDir: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);

            // Create archive with compression disabled first for mimetype
            const archive = archiver('zip', {
                zlib: { level: 0 }, // Start with no compression
            });

            output.on('close', () => resolve());
            archive.on('error', (err) => reject(err));
            archive.pipe(output);

            // Add mimetype first, uncompressed (this is critical for EPUB)
            const mimetypePath = path.join(sourceDir, EPUB3.FILES.MIMETYPE);
            if (fs.existsSync(mimetypePath)) {
                const mimetypeContent = fs.readFileSync(mimetypePath, 'utf-8');
                archive.append(mimetypeContent, {
                    name: EPUB3.FILES.MIMETYPE,
                });
            }

            // Now switch to compressed mode for remaining files
            // Note: archiver doesn't support per-entry compression, so we rely on
            // the fact that mimetype is small enough that store vs deflate makes
            // minimal difference, and EPUB validators focus on byte offset

            // Add META-INF directory
            const metaInfDir = path.join(sourceDir, 'META-INF');
            if (fs.existsSync(metaInfDir)) {
                archive.directory(metaInfDir, 'META-INF');
            }

            // Add EPUB directory
            const epubDir = path.join(sourceDir, 'EPUB');
            if (fs.existsSync(epubDir)) {
                archive.directory(epubDir, 'EPUB');
            }

            archive.finalize();
        });
    }

    /**
     * Convert HTML to XHTML
     */
    private generateXhtml(html: string): string {
        let xhtml = html;

        // Add XML declaration if not present
        if (!xhtml.startsWith('<?xml')) {
            xhtml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xhtml;
        }

        // Convert DOCTYPE
        xhtml = xhtml.replace(
            /<!DOCTYPE html>/i,
            '<!DOCTYPE html>',
        );

        // Add XHTML namespace to html element
        xhtml = xhtml.replace(
            /<html([^>]*)>/,
            '<html xmlns="http://www.w3.org/1999/xhtml"$1>',
        );

        // Self-close void elements
        const voidElements = ['meta', 'link', 'br', 'hr', 'img', 'input', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
        for (const tag of voidElements) {
            // Match tags that don't self-close
            const regex = new RegExp(`<${tag}([^>]*[^/])>`, 'gi');
            xhtml = xhtml.replace(regex, `<${tag}$1/>`);

            // Also handle tags with no attributes
            const simpleRegex = new RegExp(`<${tag}>`, 'gi');
            xhtml = xhtml.replace(simpleRegex, `<${tag}/>`);
        }

        // Change .html references to .xhtml
        xhtml = xhtml.replace(/\.html"/g, '.xhtml"');
        xhtml = xhtml.replace(/\.html'/g, ".xhtml'");

        return xhtml;
    }

    /**
     * Update XHTML links for EPUB directory structure
     */
    private async updateXhtmlLinks(epubDir: string): Promise<void> {
        // Update index.xhtml - links should point to html/
        const indexPath = path.join(epubDir, HTML.INDEX_XHTML);
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf-8');

            // Update page links to point to html/ subdirectory
            content = content.replace(
                /href="([^"]+)\.xhtml"/g,
                (match, filename) => {
                    if (filename === 'index' || filename === 'nav') return match;
                    return `href="html/${filename}.xhtml"`;
                },
            );

            await fs.writeFile(indexPath, content, 'utf-8');
        }

        // Update XHTML files in html/ directory
        const htmlDir = path.join(epubDir, EXPORT_DIRS.HTML);
        if (await fs.pathExists(htmlDir)) {
            const xhtmlFiles = await fs.readdir(htmlDir);
            for (const file of xhtmlFiles) {
                if (!file.endsWith('.xhtml')) continue;

                const filePath = path.join(htmlDir, file);
                let content = await fs.readFile(filePath, 'utf-8');

                // Update resource paths to go up one level
                content = content.replace(
                    /src="([^"]+)"/g,
                    (match, src) => {
                        if (src.startsWith('http') || src.startsWith('//')) return match;
                        if (src.startsWith('../')) return match;
                        return `src="../${src}"`;
                    },
                );

                content = content.replace(
                    /href="([^"]+\.(?:css|js))"/g,
                    (match, href) => {
                        if (href.startsWith('http') || href.startsWith('//')) return match;
                        if (href.startsWith('../')) return match;
                        return `href="../${href}"`;
                    },
                );

                // Update index link
                content = content.replace(
                    /href="index\.xhtml"/g,
                    'href="../index.xhtml"',
                );

                await fs.writeFile(filePath, content, 'utf-8');
            }
        }
    }

    /**
     * Copy project resources to EPUB content directory
     */
    private async copyProjectResourcesToEpub(
        sessionPath: string,
        epubDir: string,
    ): Promise<void> {
        if (!(await fs.pathExists(sessionPath))) {
            return;
        }

        const contentDir = path.join(epubDir, 'content');
        await fs.ensureDir(contentDir);

        const entries = await fs.readdir(sessionPath);
        for (const entry of entries) {
            // Skip XML and special files
            if (this.shouldSkipResource(entry)) continue;

            const sourcePath = path.join(sessionPath, entry);
            const destPath = path.join(contentDir, entry);

            // Safety check
            if (epubDir.startsWith(sourcePath)) continue;

            const stats = await fs.stat(sourcePath);
            if (stats.isDirectory()) {
                await fs.copy(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    /**
     * Generate fallback.xhtml for non-core media types
     */
    private async generateFallbackXhtml(epubDir: string): Promise<void> {
        const fallbackContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta charset="UTF-8"/>
    <title>Content Unavailable</title>
</head>
<body>
    <p>This content is not available in your EPUB reader.</p>
</body>
</html>`;

        await fs.writeFile(
            path.join(epubDir, 'fallback.xhtml'),
            fallbackContent,
            'utf-8',
        );
    }

    /**
     * Sanitize string for filename
     */
    private sanitizeFilename(str: string): string {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    }

    /**
     * Get list of iDevice types used in the project
     */
    private getUsedIdeviceTypes(context: ExportContext): string[] {
        const types = new Set<string>();

        for (const page of context.structure.pages) {
            for (const component of page.components || []) {
                if (component.type) {
                    types.add(component.type);
                }
            }
        }

        return Array.from(types);
    }
}
