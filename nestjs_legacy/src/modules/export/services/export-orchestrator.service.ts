import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import { ProjectOpenService } from '../../project/services/project-open.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import {
    IExportStrategy,
    ExportContext,
    ExportFormatType,
    ExportResult,
    ExportOptions,
} from '../interfaces/export-strategy.interface';
import { Html5ExportStrategy } from './strategies/html5-export.strategy';
import { PageExportStrategy } from './strategies/page-export.strategy';
import { Scorm12ExportStrategy } from './strategies/scorm12-export.strategy';
import { ImsExportStrategy } from './strategies/ims-export.strategy';
import { Epub3ExportStrategy } from './strategies/epub3-export.strategy';
import { ElpxExportStrategy } from './strategies/elpx-export.strategy';
import { PreviewService } from './preview.service';

/**
 * Unified export result
 */
export interface OrchestratorExportResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    previewUrl?: string;
    format: ExportFormatType;
    error?: string;
}

/**
 * Export Orchestrator Service
 * Manages all export strategies and provides a unified interface for exports
 */
@Injectable()
export class ExportOrchestratorService {
    private readonly logger = new Logger(ExportOrchestratorService.name);
    private readonly strategies: Map<ExportFormatType, IExportStrategy>;

    constructor(
        private readonly projectOpenService: ProjectOpenService,
        private readonly fileHelper: FileHelperService,
        private readonly previewService: PreviewService,
        private readonly html5Strategy: Html5ExportStrategy,
        private readonly pageStrategy: PageExportStrategy,
        private readonly scorm12Strategy: Scorm12ExportStrategy,
        private readonly imsStrategy: ImsExportStrategy,
        private readonly epub3Strategy: Epub3ExportStrategy,
        private readonly elpxStrategy: ElpxExportStrategy,
    ) {
        // Register all strategies
        this.strategies = new Map<ExportFormatType, IExportStrategy>([
            [ExportFormatType.HTML5, html5Strategy],
            [ExportFormatType.PAGE, pageStrategy],
            [ExportFormatType.SCORM12, scorm12Strategy],
            [ExportFormatType.IMS, imsStrategy],
            [ExportFormatType.EPUB3, epub3Strategy],
            [ExportFormatType.ELPX, elpxStrategy],
        ]);

        this.logger.log(`Export Orchestrator initialized with ${this.strategies.size} strategies`);
    }

    /**
     * Get available export formats
     */
    getAvailableFormats(): ExportFormatType[] {
        return Array.from(this.strategies.keys());
    }

    /**
     * Get strategy for a specific format
     */
    getStrategy(format: ExportFormatType): IExportStrategy | undefined {
        return this.strategies.get(format);
    }

    /**
     * Check if a format supports preview mode
     */
    supportsPreview(format: ExportFormatType): boolean {
        const strategy = this.strategies.get(format);
        return strategy ? strategy.supportsPreview() : false;
    }

    /**
     * Export a project in preview mode
     */
    async exportPreview(
        sessionId: string,
        format: ExportFormatType,
        options: Partial<ExportOptions> = {},
    ): Promise<OrchestratorExportResult> {
        this.logger.debug(`Preview export requested: session=${sessionId}, format=${format}`);

        try {
            // Validate format supports preview
            if (!this.supportsPreview(format)) {
                return {
                    success: false,
                    format,
                    error: `Export format ${format} does not support preview mode`,
                };
            }

            // Get strategy
            const strategy = this.strategies.get(format);
            if (!strategy) {
                return {
                    success: false,
                    format,
                    error: `No strategy registered for format: ${format}`,
                };
            }

            // Build export context
            const context = await this.buildExportContext(sessionId, {
                ...options,
                preview: true,
            });

            // Execute export
            const result = await strategy.export(context);

            if (!result.success) {
                return {
                    success: false,
                    format,
                    error: result.error || 'Export failed',
                };
            }

            return {
                success: true,
                filePath: result.filePath,
                previewUrl: result.previewUrl,
                format,
            };
        } catch (error) {
            this.logger.error(`Preview export failed: ${error.message}`, error.stack);
            return {
                success: false,
                format,
                error: error.message,
            };
        }
    }

    /**
     * Export a project in download mode (creates archive)
     */
    async exportDownload(
        sessionId: string,
        format: ExportFormatType,
        options: Partial<ExportOptions> = {},
    ): Promise<OrchestratorExportResult> {
        this.logger.debug(`Download export requested: session=${sessionId}, format=${format}`);

        try {
            // Get strategy
            const strategy = this.strategies.get(format);
            if (!strategy) {
                return {
                    success: false,
                    format,
                    error: `No strategy registered for format: ${format}`,
                };
            }

            // Build export context
            const context = await this.buildExportContext(sessionId, {
                ...options,
                preview: false,
            });

            // Execute export
            const result = await strategy.export(context);

            if (!result.success) {
                return {
                    success: false,
                    format,
                    error: result.error || 'Export failed',
                };
            }

            return {
                success: true,
                filePath: result.filePath,
                fileName: result.fileName,
                fileSize: result.fileSize,
                format,
            };
        } catch (error) {
            this.logger.error(`Download export failed: ${error.message}`, error.stack);
            return {
                success: false,
                format,
                error: error.message,
            };
        }
    }

    /**
     * Build export context from session
     */
    private async buildExportContext(
        sessionId: string,
        options: Partial<ExportOptions>,
    ): Promise<ExportContext> {
        // Get session
        const session = this.projectOpenService.getSession(sessionId);
        if (!session) {
            throw new NotFoundException(`Session not found: ${sessionId}`);
        }

        // Generate temp path for preview isolation
        const tempPath = options.tempPath || this.previewService.generateRandomTempPath();

        // Determine export directory
        let exportDir: string;
        if (options.preview) {
            // Preview mode - use temp directory within session
            exportDir = path.join(session.sessionPath, 'preview', tempPath);
        } else {
            // Download mode - use dist directory
            const filesDir = this.fileHelper.getFilesDir();
            exportDir = path.join(filesDir, 'dist', sessionId, uuidv4());
        }

        // Ensure export directory exists
        await fs.ensureDir(exportDir);

        return {
            sessionId,
            structure: session.structure,
            sessionPath: session.sessionPath,
            exportDir,
            options: {
                ...options,
                tempPath,
            },
        };
    }

    /**
     * Convert export type string to ExportFormatType enum
     */
    parseExportType(exportType: string): ExportFormatType | null {
        const typeMap: Record<string, ExportFormatType> = {
            'html5': ExportFormatType.HTML5,
            'HTML5': ExportFormatType.HTML5,
            'web': ExportFormatType.HTML5,
            'page': ExportFormatType.PAGE,
            'PAGE': ExportFormatType.PAGE,
            'html5-sp': ExportFormatType.PAGE,
            'HTML5-SP': ExportFormatType.PAGE,
            'scorm12': ExportFormatType.SCORM12,
            'SCORM12': ExportFormatType.SCORM12,
            'scorm': ExportFormatType.SCORM12,
            'SCORM': ExportFormatType.SCORM12,
            'ims': ExportFormatType.IMS,
            'IMS': ExportFormatType.IMS,
            'epub3': ExportFormatType.EPUB3,
            'EPUB3': ExportFormatType.EPUB3,
            'epub': ExportFormatType.EPUB3,
            'EPUB': ExportFormatType.EPUB3,
            'elpx': ExportFormatType.ELPX,
            'ELPX': ExportFormatType.ELPX,
            'elp': ExportFormatType.ELPX,
            'ELP': ExportFormatType.ELPX,
            '.elpx': ExportFormatType.ELPX,
            '.elp': ExportFormatType.ELPX,
        };

        return typeMap[exportType] || null;
    }

    /**
     * Get file extension for format
     */
    getFileExtension(format: ExportFormatType): string {
        const strategy = this.strategies.get(format);
        return strategy ? strategy.fileExtension : '.zip';
    }

    /**
     * Get file suffix for format
     */
    getFileSuffix(format: ExportFormatType): string {
        const strategy = this.strategies.get(format);
        return strategy ? strategy.fileSuffix : '';
    }
}
