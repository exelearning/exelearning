import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Res,
    Req,
    NotFoundException,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Html5ExportService } from './services/html5-export.service';
import { ElpExportService } from './services/elp-export.service';
import { PreviewService } from './services/preview.service';
import { ExportOrchestratorService } from './services/export-orchestrator.service';
import { FileHelperService } from '../file-management/services/file-helper.service';
import { ProjectOpenService } from '../project/services/project-open.service';
import { PreviewResponse, DownloadResponse, ExportType, ExportResult } from './dto/export.dto';
import { ExportFormatType } from './interfaces/export-strategy.interface';
import * as fs from 'fs-extra';
import * as path from 'path';

@Controller('api/ode-export')
export class ExportController {
    private readonly logger = new Logger(ExportController.name);

    constructor(
        private readonly html5ExportService: Html5ExportService,
        private readonly elpExportService: ElpExportService,
        private readonly previewService: PreviewService,
        private readonly exportOrchestrator: ExportOrchestratorService,
        private readonly fileHelper: FileHelperService,
        private readonly projectOpenService: ProjectOpenService,
    ) {}

    /**
     * Generate preview export for a session
     * GET /api/ode-export/:odeSessionId/preview
     *
     * Generates HTML5 export in preview mode (no ZIP compression)
     * Returns URL to preview index.html
     */
    @Get(':odeSessionId/preview')
    async previewExport(@Param('odeSessionId') odeSessionId: string): Promise<PreviewResponse> {
        try {
            this.logger.debug(`Preview export requested for session: ${odeSessionId}`);

            // Validate session ID
            if (!odeSessionId || odeSessionId === 'undefined') {
                return {
                    responseMessage:
                        'error: No project session available. Please open or create a project first.',
                    error: 'INVALID_SESSION',
                };
            }

            // Generate random temp path for preview isolation
            const tempPath = this.previewService.generateRandomTempPath();

            // Export to HTML5 in preview mode
            const result = await this.html5ExportService.exportToHtml5(odeSessionId, {
                preview: true,
                tempPath,
                includeNavigation: true,
            });

            // Build preview URL
            const previewUrl = this.previewService.buildPreviewUrl(
                odeSessionId,
                tempPath,
                'index.html',
            );

            this.logger.log(`Preview generated successfully: ${previewUrl}`);

            return {
                responseMessage: 'OK',
                urlPreviewIndex: previewUrl,
            };
        } catch (error) {
            this.logger.error(`Preview export failed: ${error.message}`, error.stack);
            return {
                responseMessage: `error: ${error.message}`,
                error: 'EXPORT_FAILED',
            };
        }
    }

    /**
     * Generate download export for a session
     * GET /api/ode-export/:odeSessionId/:exportType/download
     *
     * Generates export file (ZIP/EPUB/ELPX) for download
     * Supports: HTML5, PAGE, SCORM12, IMS, EPUB3, ELPX
     */
    @Get(':odeSessionId/:exportType/download')
    async downloadExport(
        @Param('odeSessionId') odeSessionId: string,
        @Param('exportType') exportType: string,
    ): Promise<DownloadResponse> {
        try {
            this.logger.debug(
                `Download export requested for session: ${odeSessionId}, type: ${exportType}`,
            );

            // Validate session ID
            if (!odeSessionId || odeSessionId === 'undefined') {
                return {
                    responseMessage: 'error: No project session available.',
                    error: 'INVALID_SESSION',
                };
            }

            // Parse export type to format enum
            const format = this.exportOrchestrator.parseExportType(exportType);

            if (!format) {
                return {
                    responseMessage: `error: Unknown export type "${exportType}". Supported types: HTML5, PAGE, SCORM12, IMS, EPUB3, ELPX`,
                    error: 'UNSUPPORTED_EXPORT_TYPE',
                };
            }

            // Use orchestrator for export
            const result = await this.exportOrchestrator.exportDownload(odeSessionId, format, {
                includeNavigation: true,
                compressionLevel: 9,
            });

            if (!result.success) {
                return {
                    responseMessage: `error: ${result.error}`,
                    error: 'EXPORT_FAILED',
                };
            }

            this.logger.log(`Download export generated successfully: ${result.filePath}`);

            // Build download URL
            const filesDir = this.fileHelper.getFilesDir();
            const relativePath = path.relative(filesDir, result.filePath);
            // Ensure forward slashes for URL
            const normalizedPath = relativePath.replace(/\\/g, '/');
            const downloadUrl = `/files/${normalizedPath}`;

            return {
                responseMessage: 'OK',
                urlZipFile: downloadUrl,
                zipFileName: result.fileName,
                exportProjectName: result.fileName,
            };
        } catch (error) {
            this.logger.error(`Download export failed: ${error.message}`, error.stack);
            return {
                responseMessage: `error: ${error.message}`,
                error: 'EXPORT_FAILED',
            };
        }
    }

    /**
     * Generate download export for a Yjs session (with structure in body)
     * POST /api/ode-export/:odeSessionId/:exportType/download
     *
     * Used when the session is a Yjs session and needs the structure from frontend
     * Request body should contain: { structure: ParsedOdeStructure }
     */
    @Post(':odeSessionId/:exportType/download')
    async downloadExportWithStructure(
        @Param('odeSessionId') odeSessionId: string,
        @Param('exportType') exportType: string,
        @Body() body: { structure?: any },
    ): Promise<DownloadResponse> {
        try {
            this.logger.debug(
                `POST download export requested for session: ${odeSessionId}, type: ${exportType}`,
            );

            // Validate session ID
            if (!odeSessionId || odeSessionId === 'undefined') {
                return {
                    responseMessage: 'error: No project session available.',
                    error: 'INVALID_SESSION',
                };
            }

            // Parse export type to format enum
            const format = this.exportOrchestrator.parseExportType(exportType);

            if (!format) {
                return {
                    responseMessage: `error: Unknown export type "${exportType}". Supported types: HTML5, PAGE, SCORM12, IMS, EPUB3, ELPX`,
                    error: 'UNSUPPORTED_EXPORT_TYPE',
                };
            }

            // If structure is provided (Yjs session), register the session first
            if (body?.structure) {
                this.logger.debug(`Registering Yjs session with provided structure`);
                await this.projectOpenService.registerYjsSession(odeSessionId, body.structure);
            }

            // Use orchestrator for export
            const result = await this.exportOrchestrator.exportDownload(odeSessionId, format, {
                includeNavigation: true,
                compressionLevel: 9,
            });

            if (!result.success) {
                return {
                    responseMessage: `error: ${result.error}`,
                    error: 'EXPORT_FAILED',
                };
            }

            this.logger.log(`Download export generated successfully: ${result.filePath}`);

            // Build download URL
            const filesDir = this.fileHelper.getFilesDir();
            const relativePath = path.relative(filesDir, result.filePath);
            const normalizedPath = relativePath.replace(/\\/g, '/');
            const downloadUrl = `/files/${normalizedPath}`;

            return {
                responseMessage: 'OK',
                urlZipFile: downloadUrl,
                zipFileName: result.fileName,
                exportProjectName: result.fileName,
            };
        } catch (error) {
            this.logger.error(`POST download export failed: ${error.message}`, error.stack);
            return {
                responseMessage: `error: ${error.message}`,
                error: 'EXPORT_FAILED',
            };
        }
    }

    /**
     * Get available export formats
     * GET /api/ode-export/formats
     */
    @Get('formats')
    getAvailableFormats(): { formats: ExportFormatType[] } {
        return {
            formats: this.exportOrchestrator.getAvailableFormats(),
        };
    }
}
