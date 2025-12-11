import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseExportStrategy } from './base-export.strategy';
import {
    ExportContext,
    ExportResult,
    ExportFormatType,
} from '../../interfaces/export-strategy.interface';
import { ZipService } from '../../../file-management/services/zip.service';
import { HtmlGeneratorHelper } from '../../helpers/html-generator.helper';
import { FILE_EXTENSIONS, FILE_SUFFIXES, ELPX } from '../../constants/export.constants';

/**
 * ELPX export strategy
 * Creates an eXeLearning package file (.elpx) containing the project
 * with all resources and the content.xml file
 */
@Injectable()
export class ElpxExportStrategy extends BaseExportStrategy {
    readonly format = ExportFormatType.ELPX;
    readonly fileExtension = FILE_EXTENSIONS[ExportFormatType.ELPX];
    readonly fileSuffix = FILE_SUFFIXES[ExportFormatType.ELPX];

    constructor(zipService: ZipService, htmlGenerator: HtmlGeneratorHelper) {
        super(zipService, htmlGenerator);
    }

    /**
     * Override export to handle ELPX-specific logic
     * ELPX does not generate HTML files, it preserves the project structure
     */
    async export(context: ExportContext): Promise<ExportResult> {
        this.logger.debug(
            `Starting ELPX export for session ${context.sessionId}`,
        );

        try {
            // Ensure export directory exists
            await fs.ensureDir(context.exportDir);

            // Copy project files (including content.xml)
            await this.copyProjectFiles(context);

            // Generate format-specific files
            await this.generateFormatSpecificFiles(context);

            // Create ELPX archive
            return await this.createElpxArchive(context);
        } catch (error) {
            this.logger.error(`ELPX export failed: ${error.message}`, error.stack);
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
     * ELPX does not generate HTML files
     */
    async generateHtmlFiles(context: ExportContext): Promise<void> {
        // ELPX format does not include HTML files
        // Content is stored as XML only
    }

    /**
     * Generate format-specific files for ELPX
     * Currently no additional files needed beyond content.xml
     */
    async generateFormatSpecificFiles(context: ExportContext): Promise<void> {
        // Ensure content.xml exists in export
        const contentXmlSource = path.join(context.sessionPath, ELPX.CONTENT_FILE);
        const contentXmlDest = path.join(context.exportDir, ELPX.CONTENT_FILE);

        if (await fs.pathExists(contentXmlSource)) {
            await fs.copyFile(contentXmlSource, contentXmlDest);
        } else {
            // Check for legacy format
            const legacySource = path.join(context.sessionPath, ELPX.LEGACY_CONTENT_FILE);
            if (await fs.pathExists(legacySource)) {
                await fs.copyFile(legacySource, path.join(context.exportDir, ELPX.LEGACY_CONTENT_FILE));
            } else {
                this.logger.warn('No content.xml found in session');
            }
        }
    }

    /**
     * ELPX does not support preview mode
     */
    supportsPreview(): boolean {
        return false;
    }

    /**
     * ELPX requires no base assets
     */
    getRequiredAssets(): string[] {
        return [];
    }

    /**
     * Copy project files to export directory
     */
    private async copyProjectFiles(context: ExportContext): Promise<void> {
        const { sessionPath, exportDir } = context;

        if (!(await fs.pathExists(sessionPath))) {
            throw new Error(`Session path not found: ${sessionPath}`);
        }

        const entries = await fs.readdir(sessionPath);

        for (const entry of entries) {
            if (this.shouldSkipForElpx(entry)) continue;

            const sourcePath = path.join(sessionPath, entry);
            const destPath = path.join(exportDir, entry);

            // Safety check
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
     * Check if file/directory should be skipped for ELPX export
     */
    private shouldSkipForElpx(name: string): boolean {
        const skipList = [
            'export',
            'preview',
            'tmp',
            'temp',
            '.git',
            '.DS_Store',
            'Thumbs.db',
        ];

        // Skip existing archives
        if (
            name.endsWith('.zip') ||
            name.endsWith('.elpx') ||
            name.endsWith('.elp')
        ) {
            return true;
        }

        return skipList.includes(name);
    }

    /**
     * Create ELPX archive
     */
    private async createElpxArchive(context: ExportContext): Promise<ExportResult> {
        const exportName = this.getExportName(context);
        const elpxFileName = `${exportName}${this.fileExtension}`;
        const elpxPath = path.join(path.dirname(context.exportDir), elpxFileName);

        // Create ELPX (which is just a ZIP with .elpx extension)
        await this.zipService.create(context.exportDir, elpxPath, {
            compressionLevel: context.options.compressionLevel || 9,
        });

        // Get file stats
        const stats = await fs.stat(elpxPath);

        // Cleanup export directory
        await fs.remove(context.exportDir);

        return {
            filePath: elpxPath,
            fileName: elpxFileName,
            fileSize: stats.size,
            format: this.format,
            success: true,
        };
    }

    /**
     * Get export name for ELPX
     */
    protected getExportName(context: ExportContext): string {
        const title = context.structure.meta.title || 'project';
        return title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
    }
}
