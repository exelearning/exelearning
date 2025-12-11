import {
    Controller,
    Post,
    Get,
    Param,
    HttpCode,
    HttpStatus,
    Body,
    Req,
    BadRequestException,
    Logger,
    Optional,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { ProjectOpenService } from '../services/project-open.service';
import { LinkValidatorService, IdeviceContent } from '../services/link-validator.service';
import { UsedFilesService, IdeviceContent as UsedFilesIdeviceContent } from '../services/used-files.service';
import { ProjectsService } from '../../projects/services/projects.service';
import { ElpToYjsService } from '../../yjs-storage/services/elp-to-yjs.service';
import { ThemeService } from '../../theme/services/theme.service';
import { generateId } from '../../../utils/id-generator.util';
import * as fs from 'fs-extra';
import * as path from 'path';
import '../../../types/fastify';

/**
 * SymfonyCompatController
 *
 * Provides backward-compatible endpoints that match Symfony's URL structure.
 * This allows the existing frontend code to work without modification.
 */
@Controller()
export class SymfonyCompatController {
    private readonly logger = new Logger(SymfonyCompatController.name);

    constructor(
        private readonly fileHelperService: FileHelperService,
        private readonly projectOpenService: ProjectOpenService,
        private readonly linkValidatorService: LinkValidatorService,
        private readonly usedFilesService: UsedFilesService,
        @Optional() private readonly projectsService?: ProjectsService,
        @Optional() private readonly elpToYjsService?: ElpToYjsService,
        @Optional() private readonly themeService?: ThemeService,
    ) {}

    /**
     * Upload a chunk of an ELP file (Symfony-compatible endpoint)
     * POST /api/ode-management/odes/ode/local/large/elp/open
     *
     * Matches Symfony's uploadLargeOdeFilesAction endpoint.
     * Receives file chunks and appends them to build the complete file.
     *
     * Request params:
     * - odeFilePart: The file chunk (multipart)
     * - odeFileName: The target filename
     * - odeSessionId: The session ID for organizing chunks
     *
     * Returns:
     * - responseMessage: 'OK' if successful
     * - odeFilePath: Server path to the assembled file
     * - odeFileName: The filename
     */
    @Post('api/ode-management/odes/ode/local/large/elp/open')
    @HttpCode(HttpStatus.OK)
    async uploadChunk(@Req() req: FastifyRequest, @Body() body: any) {
        this.logger.debug('Chunked upload called');

        // Check if this is a multipart request
        let chunk: Buffer | null = null;
        let odeSessionId: string | undefined;
        let odeFileName: string | undefined;

        if (req.isMultipart && req.isMultipart()) {
            // Handle multipart request
            const data = await req.file();

            if (!data || data.fieldname !== 'odeFilePart') {
                this.logger.error('No odeFilePart found in multipart');
                throw new BadRequestException('No chunk uploaded (odeFilePart field required)');
            }

            chunk = await data.toBuffer();

            // Extract fields from multipart
            const fields = data.fields as Record<string, { value: string }>;
            odeSessionId = fields.odeSessionId?.value;
            odeFileName = fields.odeFileName?.value;
        } else {
            // Not a multipart request - this shouldn't happen for this endpoint
            throw new BadRequestException('Expected multipart/form-data request');
        }

        this.logger.debug(`Extracted odeSessionId: ${odeSessionId}`);
        this.logger.debug(`Extracted odeFileName: ${odeFileName}`);

        // If odeSessionId is empty, generate a new one (first chunk scenario)
        // Matches Symfony's behavior: generate UUID on first chunk, return it, frontend uses it for subsequent chunks
        if (!odeSessionId) {
            // Use the same generateId() function as ProjectOpenService to ensure consistent format
            // Format: YYYYMMDDHHmmss + 6 random uppercase letters (20 chars total)
            odeSessionId = generateId();
            this.logger.debug(`Generated new odeSessionId: ${odeSessionId}`);
        }

        if (!odeFileName) {
            this.logger.error(`Missing required field - odeFileName: ${odeFileName}`);
            throw new BadRequestException('odeFileName is required');
        }

        try {
            // Get session temp directory (creates if doesn't exist)
            const tempDir = this.fileHelperService.getOdeSessionTempDir(odeSessionId);
            await fs.ensureDir(tempDir);

            // Build target file path
            const targetPath = path.join(tempDir, odeFileName);

            // APPEND chunk to file (not overwrite!)
            // This is the key difference from regular upload
            await fs.appendFile(targetPath, chunk);

            // Return response in Symfony format
            // IMPORTANT: Return odeSessionId so frontend can use it for subsequent chunks
            return {
                responseMessage: 'OK',
                odeFilePath: targetPath,
                odeFileName: odeFileName,
                odeSessionId: odeSessionId, // Frontend will use this for next chunks
            };
        } catch (error) {
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        }
    }

    /**
     * Open an ELP file (Symfony-compatible endpoint)
     * POST /api/ode-management/odes/ode/local/elp/open
     *
     * Matches Symfony's /api/ode-management/odes/ode/local/elp/open endpoint
     * Called by frontend after chunked upload completes.
     *
     * Request params:
     * - odeFilePath: Server path to the assembled ELP file
     * - odeFileName: The filename
     * - openOdeFile: true (indicates opening a file)
     * - localOdeFile: true (indicates local file)
     * - odeNavStructureSyncId: Navigation structure ID (usually 'root')
     * - forceCloseOdeUserPreviousSession: '0' or '1'
     *
     * Returns:
     * - responseMessage: 'OK' if successful
     * - odeId: Database ODE ID (placeholder for now)
     * - odeVersionId: Database version ID (placeholder for now)
     * - odeSessionId: Generated session ID
     * - odeVersionName: Version name (default: '1')
     * - theme: Theme name (from structure or default)
     * - themeDir: Path to theme directory
     * - authorized: true
     */
    @Post('api/ode-management/odes/ode/local/elp/open')
    @HttpCode(HttpStatus.OK)
    async openElpFile(@Body() body: any, @Req() req: FastifyRequest) {
        this.logger.debug('/api/ode-management/odes/ode/local/elp/open called');
        this.logger.debug(`Body: ${JSON.stringify(body)}`);

        // Extract file path from body (sent as regular form parameter, NOT multipart)
        const odeFilePath = body.odeFilePath;
        const odeFileName = body.odeFileName || 'imported.elp';

        if (!odeFilePath) {
            throw new BadRequestException(
                'odeFilePath is required. This endpoint expects the file to already be assembled on the server.',
            );
        }

        // Verify file exists
        if (!(await fs.pathExists(odeFilePath))) {
            throw new BadRequestException(`File not found: ${odeFilePath}`);
        }

        const userId = (req as any).session?.userId;

        // Create Yjs project FIRST to get UUID
        let projectUuid: string | null = null;
        let elpImportPath: string | null = null;

        // First, parse the ELP to get the real title from metadata
        let realTitle: string | null = null;
        try {
            // Parse ELP to extract title from content.xml metadata
            const parseResult = await this.projectOpenService.openElpFile(odeFilePath, {
                validateXml: true,
                username: (req as any).user?.email || 'guest',
                forceCloseSession: false, // Don't close yet, just parse
            });

            // Extract title from parsed structure metadata
            realTitle = parseResult.structure?.meta?.title || null;
            this.logger.debug(`Extracted title from ELP: ${realTitle}`);
        } catch (parseError) {
            this.logger.warn(`Could not extract title from ELP: ${parseError.message}`);
        }

        if (this.projectsService && userId) {
            try {
                // Create new Yjs project with REAL title from ELP metadata
                // Fallback to filename only if no title found in ELP
                const projectTitle =
                    realTitle || odeFileName?.replace(/\.(elp|elpx)$/i, '') || 'Imported Project';
                const project = await this.projectsService.createQuick(userId, projectTitle);
                projectUuid = project.uuid;

                this.logger.log(`Created Yjs project ${projectUuid} with title: "${projectTitle}"`);

                // Move ELP file to project-specific directory for frontend to import
                // Path: /files/tmp/<uuid>/import.elp
                const projectTempDir = this.fileHelperService.getOdeSessionTempDir(projectUuid);
                await fs.ensureDir(projectTempDir);
                elpImportPath = path.join(projectTempDir, odeFileName);

                // Copy file to import location (don't move, in case we need original)
                await fs.copy(odeFilePath, elpImportPath);

                // Build URL path for frontend to fetch
                elpImportPath = `/files/tmp/${projectUuid}/${odeFileName}`;

                this.logger.log(`ELP file ready for import at: ${elpImportPath}`);
            } catch (projectError) {
                this.logger.warn(`Failed to create Yjs project: ${projectError.message}`);
                // Continue without project - fallback to legacy mode
            }
        } else {
            this.logger.debug(
                `Skipping Yjs project creation: projectsService=${!!this.projectsService}, userId=${userId}`,
            );
        }

        try {
            // Parse ELP file again for legacy compatibility and theme detection (or reuse previous result)
            // When creating a Yjs project, always force close legacy sessions since Yjs uses
            // separate IndexedDB storage per project
            const forceClose =
                body.forceCloseOdeUserPreviousSession === '1' ||
                body.forceCloseOdeUserPreviousSession === true ||
                !!projectUuid; // Force close when Yjs project created

            const result = await this.projectOpenService.openElpFile(odeFilePath, {
                validateXml: true,
                username: (req as any).user?.email || 'guest',
                forceCloseSession: forceClose,
            });

            // Return response with UUID and import path
            return {
                responseMessage: 'OK',
                // Legacy fields (use UUID as string)
                odeId: projectUuid || result.odeSessionId,
                odeVersionId: projectUuid || result.odeSessionId,
                odeSessionId: result.odeSessionId,
                odeVersionName: '1',
                theme: result.structure?.meta?.theme || 'default',
                themeDir: result.structure?.meta?.theme
                    ? `style/themes/${result.structure.meta.theme}`
                    : 'style/themes/default',
                authorized: true,
                // New Yjs fields
                projectUuid,
                elpImportPath, // Frontend will use this to fetch and import ELP
            };
        } catch (error) {
            this.logger.error(`Failed to open ELP file: ${error.message}`, error.stack);
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        } finally {
            // Clean up original temp file (we've copied it to project dir)
            try {
                if (await fs.pathExists(odeFilePath)) {
                    await fs.remove(odeFilePath);
                    this.logger.debug(`Cleaned up original temp file: ${odeFilePath}`);
                }
            } catch (cleanupError) {
                this.logger.warn(`Failed to cleanup temp file: ${cleanupError.message}`);
            }
        }
    }

    /**
     * Import theme from ELP file (Symfony-compatible endpoint)
     * POST /api/ode-management/odes/ode/theme/import
     *
     * Matches Symfony's importOdeThemeAction endpoint.
     * Copies the theme directory from the ELP session to user themes directory.
     *
     * Request params:
     * - odeSessionId: The session ID
     * - themeDirname: The theme directory name (e.g., "INTEF")
     *
     * Returns:
     * - responseMessage: 'OK' if successful
     * - themes: List of available themes (stub for now)
     */
    @Post('api/ode-management/odes/ode/theme/import')
    @HttpCode(HttpStatus.OK)
    async importOdeTheme(@Body() body: any) {
        this.logger.debug('/api/ode-management/odes/ode/theme/import called');
        this.logger.debug(`Body: ${JSON.stringify(body)}`);

        const odeSessionId = body.odeSessionId;
        const themeDirname = body.themeDirname;

        if (!odeSessionId || !themeDirname) {
            throw new BadRequestException('odeSessionId and themeDirname are required');
        }

        // Check if ThemeService is available
        if (!this.themeService) {
            this.logger.warn('ThemeService not available');
            return {
                responseMessage: 'Theme service not available',
                success: false,
            };
        }

        try {
            // Get session temp directory where ELP was extracted
            const sessionTempDir = this.fileHelperService.getOdeSessionTempDir(odeSessionId);

            // Use ThemeService to import the theme
            const result = await this.themeService.importThemeFromSession(
                sessionTempDir,
                themeDirname,
            );

            if (!result.success) {
                this.logger.warn(`Theme import failed: ${result.message}`);
                return {
                    responseMessage: result.message,
                    success: false,
                };
            }

            // Get updated list of all installed themes
            const allThemes = await this.themeService.getInstalledThemes();

            this.logger.log(`Theme "${themeDirname}" imported successfully`);

            return {
                responseMessage: 'OK',
                themes: {
                    themes: allThemes,
                },
            };
        } catch (error) {
            this.logger.error(`Failed to import theme: ${error.message}`, error.stack);
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        }
    }

    /**
     * Get ODE properties for a session (Symfony-compatible endpoint)
     * GET /api/ode-management/odes/properties/:sessionId/get
     *
     * DEPRECATED: ODE*Sync entities have been removed. Properties are now managed via Yjs.
     * This endpoint returns empty data for backward compatibility.
     */
    @Get('api/ode-management/odes/properties/:sessionId/get')
    async getOdeProperties(@Param('sessionId') sessionId: string) {
        this.logger.debug(
            `[DEPRECATED] /api/ode-management/odes/properties/${sessionId}/get called - ODE*Sync removed, use Yjs`,
        );

        // Return empty properties - Yjs is now the source of truth for metadata
        return {
            odeProperties: {},
            odeVersionName: 'v1',
        };
    }

    /**
     * Get navigation structure for a session (Symfony-compatible endpoint)
     * GET /api/nav-structure-management/nav-structures/:versionId/:sessionId/nav/structure/get
     *
     * DEPRECATED: ODE*Sync entities have been removed. Structure is now managed via Yjs.
     * This endpoint returns empty data for backward compatibility.
     */
    @Get('api/nav-structure-management/nav-structures/:versionId/:sessionId/nav/structure/get')
    async getNavigationStructure(
        @Param('versionId') versionId: string,
        @Param('sessionId') sessionId: string,
    ) {
        this.logger.debug(
            `[DEPRECATED] /api/nav-structure-management/nav-structures/${versionId}/${sessionId}/nav/structure/get called - ODE*Sync removed, use Yjs`,
        );

        // Return empty structure - Yjs is now the source of truth for document structure
        return {
            odeSessionId: sessionId,
            structure: [],
        };
    }

    /**
     * Get broken links for a session (Symfony-compatible endpoint)
     * POST /api/ode-management/odes/session/brokenlinks
     *
     * With Yjs architecture, the frontend sends the HTML content of idevices
     * for validation. This endpoint validates external links and internal files.
     *
     * Request params:
     * - odeSessionId: The session ID
     * - csv: Whether to return CSV format (optional)
     * - idevices: Array of idevice content with HTML (optional, for Yjs mode)
     *   Each idevice: { html: string, pageName?: string, blockName?: string, ideviceType?: string, order?: number }
     *
     * Returns:
     * - responseMessage: 'OK'
     * - brokenLinks: Array of broken link information
     */
    @Post('api/ode-management/odes/session/brokenlinks')
    @HttpCode(HttpStatus.OK)
    async getSessionBrokenLinks(@Body() body: any) {
        this.logger.debug('/api/ode-management/odes/session/brokenlinks called');
        this.logger.debug(`Body keys: ${Object.keys(body).join(', ')}`);

        const odeSessionId = body.odeSessionId;
        const idevices: IdeviceContent[] = body.idevices || [];

        // If idevices are provided, validate their links
        if (idevices.length > 0) {
            this.logger.debug(`Validating links in ${idevices.length} idevices`);

            try {
                const result = await this.linkValidatorService.validateLinks(
                    idevices,
                    odeSessionId,
                );

                return {
                    responseMessage: 'OK',
                    brokenLinks: result,
                };
            } catch (error) {
                this.logger.error(`Error validating links: ${error.message}`, error.stack);
                return {
                    responseMessage: `error: ${error.message}`,
                    brokenLinks: {
                        brokenLinks: [],
                    },
                };
            }
        }

        // No idevices provided - return empty result
        this.logger.debug('No idevices provided, returning empty result');
        return {
            responseMessage: 'OK',
            brokenLinks: {
                brokenLinks: [
                    {
                        brokenLinks: 'No broken links found',
                        nTimesBrokenLinks: null,
                        brokenLinksError: null,
                        pageNamesBrokenLinks: '',
                        blockNamesBrokenLinks: '',
                        typeComponentSyncBrokenLinks: '',
                        orderComponentSyncBrokenLinks: '',
                    },
                ],
            },
        };
    }

    /**
     * Get broken links for a page (Symfony-compatible endpoint)
     * GET /api/ode-management/odes/pag/:odePageId/brokenlinks
     */
    @Get('api/ode-management/odes/pag/:odePageId/brokenlinks')
    async getPageBrokenLinks(@Param('odePageId') odePageId: string) {
        this.logger.debug(`/api/ode-management/odes/pag/${odePageId}/brokenlinks called`);

        return {
            responseMessage: 'OK',
            brokenLinks: {
                brokenLinks: [
                    {
                        brokenLinks: 'No broken links found',
                        nTimesBrokenLinks: null,
                        brokenLinksError: null,
                        pageNamesBrokenLinks: '',
                        blockNamesBrokenLinks: '',
                        typeComponentSyncBrokenLinks: '',
                        orderComponentSyncBrokenLinks: '',
                    },
                ],
            },
        };
    }

    /**
     * Get broken links for a block (Symfony-compatible endpoint)
     * GET /api/ode-management/odes/block/:odeBlockId/brokenlinks
     */
    @Get('api/ode-management/odes/block/:odeBlockId/brokenlinks')
    async getBlockBrokenLinks(@Param('odeBlockId') odeBlockId: string) {
        this.logger.debug(`/api/ode-management/odes/block/${odeBlockId}/brokenlinks called`);

        return {
            responseMessage: 'OK',
            brokenLinks: {
                brokenLinks: [
                    {
                        brokenLinks: 'No broken links found',
                        nTimesBrokenLinks: null,
                        brokenLinksError: null,
                        pageNamesBrokenLinks: '',
                        blockNamesBrokenLinks: '',
                        typeComponentSyncBrokenLinks: '',
                        orderComponentSyncBrokenLinks: '',
                    },
                ],
            },
        };
    }

    /**
     * Get broken links for an idevice (Symfony-compatible endpoint)
     * GET /api/ode-management/odes/idevice/:odeIdeviceId/brokenlinks
     */
    @Get('api/ode-management/odes/idevice/:odeIdeviceId/brokenlinks')
    async getIdeviceBrokenLinks(@Param('odeIdeviceId') odeIdeviceId: string) {
        this.logger.debug(`/api/ode-management/odes/idevice/${odeIdeviceId}/brokenlinks called`);

        return {
            responseMessage: 'OK',
            brokenLinks: {
                brokenLinks: [
                    {
                        brokenLinks: 'No broken links found',
                        nTimesBrokenLinks: null,
                        brokenLinksError: null,
                        pageNamesBrokenLinks: '',
                        blockNamesBrokenLinks: '',
                        typeComponentSyncBrokenLinks: '',
                        orderComponentSyncBrokenLinks: '',
                    },
                ],
            },
        };
    }

    /**
     * Get used files for a session (Symfony-compatible endpoint)
     * POST /api/ode-management/odes/session/usedfiles
     *
     * With Yjs architecture, the frontend sends the HTML content of idevices
     * to find all internal file references.
     *
     * Request params:
     * - odeSessionId: The session ID
     * - resourceReport: 'true' (always true for this endpoint)
     * - idevices: Array of idevice content with HTML
     *
     * Returns:
     * - responseMessage: 'OK'
     * - usedFiles: Array of used file information
     */
    @Post('api/ode-management/odes/session/usedfiles')
    @HttpCode(HttpStatus.OK)
    async getSessionUsedFiles(@Body() body: any) {
        this.logger.debug('/api/ode-management/odes/session/usedfiles called');
        this.logger.debug(`Body keys: ${Object.keys(body).join(', ')}`);

        const odeSessionId = body.odeSessionId;
        const idevices: UsedFilesIdeviceContent[] = body.idevices || [];

        // If idevices are provided, find their used files
        if (idevices.length > 0) {
            this.logger.debug(`Finding used files in ${idevices.length} idevices`);

            try {
                const result = await this.usedFilesService.getUsedFiles(idevices);

                return {
                    responseMessage: 'OK',
                    usedFiles: result,
                };
            } catch (error) {
                this.logger.error(`Error finding used files: ${error.message}`, error.stack);
                return {
                    responseMessage: `error: ${error.message}`,
                    usedFiles: {
                        usedFiles: [],
                    },
                };
            }
        }

        // No idevices provided - return empty result
        this.logger.debug('No idevices provided, returning empty result');
        return {
            responseMessage: 'OK',
            usedFiles: {
                usedFiles: [
                    {
                        usedFiles: 'No files found',
                        usedFilesPath: '',
                        usedFilesSize: '',
                        pageNamesUsedFiles: '',
                        blockNamesUsedFiles: '',
                        typeComponentSyncUsedFiles: '',
                        orderComponentSyncUsedFiles: '',
                    },
                ],
            },
        };
    }
}
