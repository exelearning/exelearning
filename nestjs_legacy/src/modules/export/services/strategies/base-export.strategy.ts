import { Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
    IExportStrategy,
    ExportContext,
    ExportResult,
    ExportFormatType,
} from '../../interfaces/export-strategy.interface';
import { ZipService } from '../../../file-management/services/zip.service';
import { HtmlGeneratorHelper } from '../../helpers/html-generator.helper';
import { Html5ExportOptions } from '../../dto/export.dto';
import { NormalizedPage } from '../../../xml/interfaces/ode-xml.interface';
import { HTML } from '../../constants/export.constants';

/**
 * Abstract base class for export strategies
 * Provides common functionality shared across all export formats
 */
export abstract class BaseExportStrategy implements IExportStrategy {
    protected readonly logger: Logger;

    abstract readonly format: ExportFormatType;
    abstract readonly fileExtension: string;
    abstract readonly fileSuffix: string;

    constructor(
        protected readonly zipService: ZipService,
        protected readonly htmlGenerator: HtmlGeneratorHelper,
    ) {
        this.logger = new Logger(this.constructor.name);
    }

    /**
     * Main export method - orchestrates the export process
     */
    async export(context: ExportContext): Promise<ExportResult> {
        this.logger.debug(
            `Starting ${this.format} export for session ${context.sessionId}`,
        );

        try {
            // Ensure export directory exists
            await fs.ensureDir(context.exportDir);

            // Generate HTML files
            await this.generateHtmlFiles(context);

            // Generate format-specific files (manifests, etc.)
            await this.generateFormatSpecificFiles(context);

            // Copy resources from session
            await this.copyResources(context);

            // Create archive if not preview mode
            if (!context.options.preview) {
                return await this.createArchive(context);
            }

            // Preview mode - return directory path
            return {
                filePath: context.exportDir,
                fileName: `${this.getExportName(context)}${this.fileSuffix}`,
                fileSize: 0,
                format: this.format,
                previewUrl: this.buildPreviewUrl(context),
                success: true,
            };
        } catch (error) {
            this.logger.error(`Export failed: ${error.message}`, error.stack);
            return {
                filePath: '',
                fileName: '',
                fileSize: 0,
                format: this.format,
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Generate HTML files for the export
     * Can be overridden by subclasses for format-specific HTML generation
     */
    async generateHtmlFiles(context: ExportContext): Promise<void> {
        const { structure, exportDir, options } = context;
        const htmlOptions = this.toHtml5Options(options);

        // Generate index.html (first page content)
        const indexHtml = this.htmlGenerator.generateIndexHtml(
            structure,
            htmlOptions,
            this.getResourcePrefix(context),
        );
        await fs.writeFile(path.join(exportDir, HTML.INDEX_FILE), indexHtml, 'utf-8');

        // Generate individual page files
        for (const page of structure.pages) {
            // Skip first page as it's the index
            if (page.id === structure.pages[0].id) continue;

            const pageHtml = this.htmlGenerator.generatePageHtml(
                page,
                structure,
                htmlOptions,
                this.getResourcePrefix(context),
            );
            await fs.writeFile(
                path.join(exportDir, `${page.id}.html`),
                pageHtml,
                'utf-8',
            );
        }
    }

    /**
     * Convert ExportOptions to Html5ExportOptions
     */
    protected toHtml5Options(options: ExportContext['options']): Html5ExportOptions {
        return {
            includeNavigation: options.includeNavigation,
            responsive: options.responsive,
            theme: options.theme?.name,
            customCss: options.customCss,
            preview: options.preview,
            tempPath: options.tempPath,
            resourcePrefix: options.resourcePrefix,
            compressionLevel: options.compressionLevel,
        };
    }

    /**
     * Generate format-specific files (manifests, metadata, etc.)
     * Must be implemented by subclasses
     */
    abstract generateFormatSpecificFiles(context: ExportContext): Promise<void>;

    /**
     * Whether this format supports preview mode
     */
    supportsPreview(): boolean {
        return true; // Most formats support preview
    }

    /**
     * Get list of required base assets for this format
     * Can be overridden by subclasses
     */
    getRequiredAssets(): string[] {
        return [
            'base.css',
            'content.css',
            'exe_jquery.js',
            'common_i18n.js',
            'common.js',
        ];
    }

    /**
     * Copy resources from session to export directory
     */
    protected async copyResources(context: ExportContext): Promise<void> {
        const { sessionPath, exportDir } = context;

        if (!(await fs.pathExists(sessionPath))) {
            this.logger.warn(`Session path does not exist: ${sessionPath}`);
            return;
        }

        const entries = await fs.readdir(sessionPath);

        for (const entry of entries) {
            // Skip content.xml and special directories
            if (this.shouldSkipResource(entry)) continue;

            const sourcePath = path.join(sessionPath, entry);
            const destPath = path.join(exportDir, entry);

            // Safety check: don't copy if source is a parent of destination
            if (exportDir.startsWith(sourcePath)) continue;

            const stats = await fs.stat(sourcePath);
            if (stats.isDirectory()) {
                await fs.copy(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    /**
     * Check if a resource should be skipped during copy
     */
    protected shouldSkipResource(name: string): boolean {
        const skipList = ['content.xml', 'contentv3.xml', 'export', 'preview', '.DS_Store'];
        return skipList.includes(name);
    }

    /**
     * Create ZIP archive of the export
     */
    protected async createArchive(context: ExportContext): Promise<ExportResult> {
        const exportName = this.getExportName(context);
        const zipFileName = `${exportName}${this.fileSuffix}${this.fileExtension}`;
        const zipPath = path.join(path.dirname(context.exportDir), zipFileName);

        // Create ZIP
        await this.zipService.create(context.exportDir, zipPath, {
            compressionLevel: context.options.compressionLevel || 9,
        });

        // Get file stats
        const stats = await fs.stat(zipPath);

        // Cleanup export directory
        await fs.remove(context.exportDir);

        return {
            filePath: zipPath,
            fileName: zipFileName,
            fileSize: stats.size,
            format: this.format,
            success: true,
        };
    }

    /**
     * Get the base name for the export (without extension)
     */
    protected getExportName(context: ExportContext): string {
        const title = context.structure.meta.title || 'export';
        // Sanitize filename
        return title
            .replace(/[^a-zA-Z0-9\-_\s]/g, '')
            .replace(/\s+/g, '-')
            .toLowerCase()
            .substring(0, 50);
    }

    /**
     * Get resource prefix for HTML generation
     */
    protected getResourcePrefix(context: ExportContext): string {
        return context.options.resourcePrefix || '';
    }

    /**
     * Build preview URL
     */
    protected buildPreviewUrl(context: ExportContext): string {
        if (context.options.tempPath) {
            return `/api/ode-export/${context.sessionId}/preview/${context.options.tempPath}/index.html`;
        }
        return `/api/ode-export/${context.sessionId}/preview/index.html`;
    }

    /**
     * Write basic CSS assets
     */
    protected async writeBasicCss(exportDir: string): Promise<void> {
        const baseCss = `
body { font-family: sans-serif; margin: 0; padding: 0; }
#content { display: flex; flex-direction: column; min-height: 100vh; }
#header { background: #eee; padding: 20px; }
#siteNav { background: #333; color: #fff; padding: 20px; }
#siteNav a { color: #fff; text-decoration: none; display: block; margin: 5px 0; }
#siteNav .active { font-weight: bold; text-decoration: underline; }
#main { padding: 20px; flex: 1; }
.iDevice_wrapper { margin-bottom: 20px; border: 1px solid #ddd; padding: 10px; }
.pagination { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; }
.pagination a { margin-right: 10px; }
`;
        await fs.writeFile(path.join(exportDir, 'base.css'), baseCss);
        await fs.writeFile(path.join(exportDir, 'content.css'), '/* Content CSS */');
    }

    /**
     * Write basic JS placeholders
     */
    protected async writeBasicJs(exportDir: string): Promise<void> {
        await fs.writeFile(
            path.join(exportDir, 'exe_jquery.js'),
            '// jQuery placeholder',
        );
        await fs.writeFile(
            path.join(exportDir, 'common_i18n.js'),
            '// i18n placeholder',
        );
        await fs.writeFile(path.join(exportDir, 'common.js'), '// common.js placeholder');
        await fs.writeFile(
            path.join(exportDir, '_style_js.js'),
            '// Style JS placeholder',
        );
    }

    /**
     * Get all pages in flat order (for manifest generation)
     */
    protected getFlatPageList(context: ExportContext): NormalizedPage[] {
        return context.structure.pages;
    }

    /**
     * Generate a unique identifier
     */
    protected generateId(prefix: string = ''): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}${timestamp}${random}`.toUpperCase();
    }

    /**
     * Sanitize string for use in XML
     */
    protected sanitizeForXml(str: string): string {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Convert HTML filename to XHTML (for EPUB)
     */
    protected htmlToXhtml(filename: string): string {
        return filename.replace(/\.html$/, '.xhtml');
    }
}
