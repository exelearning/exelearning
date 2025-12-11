import {
    Controller,
    Post,
    Get,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    BadRequestException,
    NotFoundException,
    Req,
    Logger,
    Res,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectOpenService } from '../services/project-open.service';
import { Html5ExportService } from '../../export/services/html5-export.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { ZipService } from '../../file-management/services/zip.service';
import { XmlParserService } from '../../xml/services/xml-parser.service';
import { ProjectsService } from '../../projects/services/projects.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import '../../../types/fastify';

@Controller('api/project')
export class ProjectController {
    private readonly logger = new Logger(ProjectController.name);

    constructor(
        private readonly projectOpenService: ProjectOpenService,
        private readonly html5ExportService: Html5ExportService,
        private readonly fileHelperService: FileHelperService,
        private readonly zipService: ZipService,
        private readonly xmlParserService: XmlParserService,
        private readonly projectsService: ProjectsService,
    ) {}

    /**
     * Upload a chunk of an ELP file
     * POST /api/project/upload-chunk
     * POST /api/ode-management/odes/ode/local/large/elp/open (Symfony alias)
     *
     * Matches Symfony's /api/ode-management/odes/ode/local/large/elp/open endpoint
     *
     * This endpoint receives file chunks and appends them to build the complete file.
     * The frontend sends chunks sequentially until the entire file is assembled.
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
    @Post('upload-chunk')
    @HttpCode(HttpStatus.OK)
    async uploadChunk(@Req() req: FastifyRequest, @Body() body: any) {
        // Handle multipart file upload with Fastify
        if (!req.isMultipart || !req.isMultipart()) {
            throw new BadRequestException('Expected multipart/form-data request');
        }

        // Collect all files and fields
        let chunk: Buffer | null = null;
        let odeSessionId: string | undefined;
        let odeFileName: string | undefined;

        for await (const part of req.files!({ limits: { files: 10 } as any })) {
            if (part.fieldname === 'odeFilePart') {
                chunk = await part.toBuffer();
            }
            // Fields come through the parts iterator too
            const fields = part.fields as Record<string, { value: string }>;
            if (fields.odeSessionId?.value) odeSessionId = fields.odeSessionId.value;
            if (fields.odeFileName?.value) odeFileName = fields.odeFileName.value;
        }

        // Also check body for fields (in case they come separately)
        if (!odeSessionId) {
            odeSessionId = Array.isArray(body.odeSessionId)
                ? body.odeSessionId[0]
                : body.odeSessionId;
        }
        if (!odeFileName) {
            odeFileName = Array.isArray(body.odeFileName)
                ? body.odeFileName[0]
                : body.odeFileName;
        }

        if (!chunk) {
            throw new BadRequestException('No chunk uploaded (odeFilePart field required)');
        }

        if (!odeSessionId || !odeFileName) {
            throw new BadRequestException('odeSessionId and odeFileName are required');
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
            return {
                responseMessage: 'OK',
                odeFilePath: targetPath,
                odeFileName: odeFileName,
            };
        } catch (error) {
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        }
    }

    /**
     * Open an ELP file
     * POST /api/project/open
     *
     * Supports two modes:
     * 1. Direct file upload - Client sends file via multipart/form-data
     * 2. Server-side path - Client provides path to assembled file (after chunked upload)
     *
     * Request params (Mode 1 - Direct upload):
     * - file: The ELP file (multipart)
     *
     * Request params (Mode 2 - Server path):
     * - odeFilePath: Server path to the assembled ELP file
     * - odeFileName: The filename
     */
    @Post('open')
    @HttpCode(HttpStatus.OK)
    async openElpFile(
        @Req() req: FastifyRequest,
        @Body() body: any,
    ) {
        // Log request details at DEBUG level
        this.logger.debug('/api/project/open called');
        this.logger.debug(`Body: ${JSON.stringify(body)}`);

        let filePath: string;
        let shouldCleanup = false;
        let uploadedFileName: string | undefined;

        // Mode 1: Direct file upload (multipart)
        if (req.isMultipart && req.isMultipart()) {
            let uploadedBuffer: Buffer | null = null;

            for await (const part of req.files!({ limits: { files: 10 } as any })) {
                if (part.fieldname === 'file' || part.fieldname === 'odeFilePart') {
                    uploadedBuffer = await part.toBuffer();
                    uploadedFileName = body.odeFileName || part.filename;
                    break;
                }
            }

            if (uploadedBuffer) {
                // Save uploaded file temporarily
                const tempDir = path.join(process.cwd(), 'temp');
                await fs.ensureDir(tempDir);
                filePath = path.join(tempDir, `${Date.now()}-${uploadedFileName}`);

                await fs.writeFile(filePath, uploadedBuffer);
                shouldCleanup = true; // We created this temp file, so clean it up
            }
            // Mode 2: Server-side file path (after chunked upload)
            else if (body.odeFilePath) {
                // Extract from array if needed (frontend sends as array)
                filePath = Array.isArray(body.odeFilePath) ? body.odeFilePath[0] : body.odeFilePath;

                // Verify file exists
                if (!(await fs.pathExists(filePath))) {
                    throw new BadRequestException(`File not found: ${filePath}`);
                }

                shouldCleanup = true; // Chunked upload temp file should also be cleaned
            }
            // No file provided
            else {
                throw new BadRequestException(
                    'No file uploaded. Provide either a file upload or odeFilePath parameter',
                );
            }
        }
        // Mode 2: Server-side file path (non-multipart request)
        else if (body.odeFilePath) {
            filePath = Array.isArray(body.odeFilePath) ? body.odeFilePath[0] : body.odeFilePath;

            if (!(await fs.pathExists(filePath))) {
                throw new BadRequestException(`File not found: ${filePath}`);
            }

            shouldCleanup = true;
        }
        else {
            throw new BadRequestException(
                'No file uploaded. Provide either a file upload or odeFilePath parameter',
            );
        }

        try {
            // Open the ELP file
            // Pass username to enable database persistence
            // Handle forceCloseOdeUserPreviousSession parameter (can be sent as '0', '1', or boolean)
            const forceClose =
                body.forceCloseOdeUserPreviousSession === '1' ||
                body.forceCloseOdeUserPreviousSession === true;

            const result = await this.projectOpenService.openElpFile(filePath, {
                validateXml: true,
                username: (req as any).user?.email || 'guest',
                forceCloseSession: forceClose,
            });

            // Return response in format expected by frontend
            // Frontend expects 'responseMessage' field
            return {
                responseMessage: 'OK',
                success: true,
                data: {
                    sessionId: result.odeSessionId,
                    structure: result.structure,
                    sessionPath: result.sessionPath,
                    contentPath: result.contentPath,
                },
            };
        } catch (error) {
            // Return error in format expected by frontend
            return {
                responseMessage: `error: ${error.message}`,
                success: false,
            };
        } finally {
            // Cleanup temp file if we created it
            if (shouldCleanup && (await fs.pathExists(filePath))) {
                await fs.remove(filePath);
            }
        }
    }

    /**
     * Export a session to HTML5
     * POST /api/project/export
     */
    @Post('export')
    @HttpCode(HttpStatus.OK)
    async exportToHtml5(@Body() body: { sessionId: string; options?: any }) {
        if (!body.sessionId) {
            throw new BadRequestException('sessionId is required');
        }

        const result = await this.html5ExportService.exportToHtml5(
            body.sessionId,
            body.options || {},
        );

        return {
            success: true,
            data: result,
        };
    }

    /**
     * List all active sessions
     * GET /api/project/sessions
     */
    @Get('sessions')
    async listSessions() {
        const sessions = this.projectOpenService.listActiveSessions();

        const sessionsData = sessions.map((sessionId) => {
            const session = this.projectOpenService.getSession(sessionId);
            return {
                sessionId,
                created: session?.created,
                modified: session?.modified,
                title: session?.structure.meta.title,
                pageCount: session?.structure.pages.length,
            };
        });

        return {
            success: true,
            data: sessionsData,
        };
    }

    /**
     * Get a specific session
     * GET /api/project/sessions/:id
     */
    @Get('sessions/:id')
    async getSession(@Param('id') sessionId: string) {
        const session = this.projectOpenService.getSession(sessionId);

        if (!session) {
            throw new NotFoundException(`Session not found: ${sessionId}`);
        }

        return {
            success: true,
            data: {
                sessionId: session.odeSessionId,
                created: session.created,
                modified: session.modified,
                structure: session.structure,
                sessionPath: session.sessionPath,
            },
        };
    }

    /**
     * Close a session
     * DELETE /api/project/sessions/:id
     */
    @Delete('sessions/:id')
    @HttpCode(HttpStatus.OK)
    async closeSession(@Param('id') sessionId: string, @Body() body?: { save?: boolean }) {
        await this.projectOpenService.closeSession(sessionId, body?.save || false);

        return {
            success: true,
            message: `Session ${sessionId} closed successfully`,
        };
    }

    /**
     * Get a file from a session
     * GET /api/project/sessions/:id/files/:filePath
     */
    @Get('sessions/:id/files/*')
    async getSessionFile(@Param('id') sessionId: string, @Param() params: any) {
        // Extract file path from remaining params
        const filePath = params[0] || '';

        const fileBuffer = await this.projectOpenService.getSessionFile(sessionId, filePath);

        if (!fileBuffer) {
            throw new NotFoundException(`File not found: ${filePath}`);
        }

        return fileBuffer;
    }

    /**
     * Get user ODE files list
     * GET /api/project/get/user/ode/list
     *
     * TODO: This is a stub implementation. Full implementation requires:
     * - Database integration with OdeFiles entity
     * - User authentication to get current user
     * - File disk space calculations
     */
    @Get('get/user/ode/list')
    async getUserOdeList() {
        // Stub implementation - return empty list
        // This prevents the frontend JavaScript error while we work on full migration
        return {
            odeFiles: [],
        };
    }

    /**
     * Get navigation structure for a session
     * GET /api/project/version/:odeVersionId/session/:odeSessionId/structure
     *
     * Returns the flat navigation structure array for the workarea
     */
    @Get('version/:odeVersionId/session/:odeSessionId/structure')
    async getNavigationStructure(
        @Param('odeVersionId') odeVersionId: string,
        @Param('odeSessionId') odeSessionId: string,
    ) {
        this.logger.log(
            `⭐ PROJECT CONTROLLER: Getting navigation structure for session: ${odeSessionId}`,
        );

        try {
            // Get session from memory
            const session = this.projectOpenService.getSession(odeSessionId);

            if (!session) {
                this.logger.warn(`Session not found: ${odeSessionId}`);
                return {
                    structure: [],
                    navStructure: { id: 'root', title: 'New page', children: [], level: 0, order: 0 },
                };
            }

            this.logger.debug(`Session found with ${session.structure.pages?.length || 0} pages`);

            // If no pages in structure, return empty array with root navStructure
            if (!session.structure.pages || session.structure.pages.length === 0) {
                this.logger.debug('No pages in structure');
                return {
                    structure: [],
                    navStructure: { id: 'root', title: 'New page', children: [], level: 0, order: 0 },
                };
            }

            // Debug: Log first few pages to verify hierarchy
            if (session.structure.pages.length > 0) {
                const samplePages = session.structure.pages.slice(0, 3);
                this.logger.debug(
                    `Sample pages from XML parser: ${JSON.stringify(samplePages, null, 2)}`,
                );
            }

            // Transform flat pages array to frontend format
            // Frontend expects: { id, pageId, pageName, parent, order, level }
            // XML parser provides: { id, title, parent_id, position, level }
            const structure = session.structure.pages.map((page) => ({
                id: page.id,
                pageId: page.id,
                pageName: page.title || 'Untitled',
                parent: page.parent_id || 'root', // Frontend expects 'root' for null parent
                order: page.position + 1, // Frontend uses 1-based indexing
                level: page.level, // Hierarchy level (0 = root, 1 = child, etc.)
            }));

            // Build a tree-shaped navigation structure for frontend compatibility
            const nodeMap = new Map<string, any>();
            const roots: any[] = [];

            structure.forEach((node) => {
                const treeNode = {
                    id: node.pageId,
                    title: node.pageName,
                    parent: node.parent,
                    level: node.level,
                    order: node.order,
                    children: [] as any[],
                };
                nodeMap.set(node.pageId, treeNode);
            });

            nodeMap.forEach((node) => {
                if (node.parent && nodeMap.has(node.parent)) {
                    nodeMap.get(node.parent).children.push(node);
                } else {
                    roots.push(node);
                }
            });

            const navStructure =
                roots.length === 1
                    ? roots[0]
                    : { id: 'root', title: 'root', children: roots, level: 0, order: 0 };

            // Debug: Log transformed structure
            this.logger.debug(`Returning flat structure with ${structure.length} nodes`);
            if (structure.length > 0) {
                const sampleStructure = structure.slice(0, 3);
                this.logger.debug(
                    `Sample transformed nodes: ${JSON.stringify(sampleStructure, null, 2)}`,
                );
            }

            return {
                structure,
                navStructure,
            };
        } catch (error) {
            this.logger.error(`Failed to get navigation structure: ${error.message}`, error.stack);
            // If there's an error, return empty array with root navStructure
            return {
                structure: [],
                navStructure: { id: 'root', title: 'New page', children: [], level: 0, order: 0 },
            };
        }
    }

    /**
     * Cleanup temporary import file
     * DELETE /api/project/cleanup-import?path=/files/tmp/uuid/file.elp
     *
     * Called by frontend after successfully importing an ELP file via ElpxImporter.
     * Removes the temporary ELP file from the server.
     */
    @Delete('cleanup-import')
    @HttpCode(HttpStatus.OK)
    async cleanupImportFile(@Req() req: FastifyRequest) {
        const importPath = (req.query as any)?.path;

        if (!importPath) {
            throw new BadRequestException('Path parameter is required');
        }

        this.logger.log(`Cleanup request for import file: ${importPath}`);

        try {
            // Extract the UUID from the path to validate it's a temp file
            // Expected format: /files/tmp/<uuid>/<filename>
            const pathMatch = importPath.match(/\/files\/tmp\/([a-f0-9-]+)\//i);
            if (!pathMatch) {
                throw new BadRequestException('Invalid import path format');
            }

            const projectUuid = pathMatch[1];

            // Get the actual file system path
            const tempDir = this.fileHelperService.getOdeSessionTempDir(projectUuid);
            const fileName = importPath.split('/').pop();
            const cleanupFilePath = path.join(tempDir, fileName);

            // Verify the path is safe (within temp directory)
            if (!this.fileHelperService.isPathSafe(tempDir, cleanupFilePath)) {
                throw new BadRequestException('Invalid file path');
            }

            // Check if file exists and delete it
            if (await fs.pathExists(cleanupFilePath)) {
                await fs.remove(cleanupFilePath);
                this.logger.log(`Deleted temp import file: ${cleanupFilePath}`);

                // Try to remove the directory if empty
                try {
                    const files = await fs.readdir(tempDir);
                    if (files.length === 0) {
                        await fs.rmdir(tempDir);
                        this.logger.log(`Removed empty temp directory: ${tempDir}`);
                    }
                } catch (e) {
                    // Ignore if directory removal fails
                }

                return { success: true, message: 'File cleaned up successfully' };
            } else {
                this.logger.warn(`Temp file not found: ${cleanupFilePath}`);
                return { success: true, message: 'File already cleaned up' };
            }
        } catch (error) {
            this.logger.error(`Failed to cleanup import file: ${error.message}`);
            throw new BadRequestException(`Failed to cleanup file: ${error.message}`);
        }
    }

    /**
     * Create a new project quickly (for client-side ELP import)
     * POST /api/project/create-quick
     *
     * Creates a new Yjs project with minimal setup, returning the UUID
     * for client-side file processing.
     */
    @Post('create-quick')
    @HttpCode(HttpStatus.OK)
    async createQuickProject(@Body() body: { title?: string }, @Req() req: FastifyRequest) {
        const userId = (req as any).session?.userId;

        if (!userId) {
            throw new BadRequestException('User not authenticated');
        }

        try {
            const title = body.title || 'Untitled';
            const project = await this.projectsService.createQuick(userId, title);

            this.logger.log(`Created quick project: ${project.uuid} for user ${userId}`);

            return {
                uuid: project.uuid,
                title: project.title,
            };
        } catch (error) {
            this.logger.error(`Failed to create quick project: ${error.message}`);
            throw new BadRequestException(`Failed to create project: ${error.message}`);
        }
    }

    /**
     * Convert legacy .elp file (contentv3.xml with Python pickle format) to standard JSON
     * POST /api/project/convert-legacy
     *
     * This endpoint handles legacy .elp files that use the Python pickle serialization
     * format (contentv3.xml with <instance>/<dictionary> root elements).
     * These files cannot be parsed in the browser and need server-side conversion.
     *
     * The endpoint:
     * 1. Receives the .elp file
     * 2. Extracts and parses contentv3.xml using LegacyXmlParserService
     * 3. Extracts embedded assets (images, media)
     * 4. Returns JSON structure and base64-encoded assets for client-side import
     */
    @Post('convert-legacy')
    @HttpCode(HttpStatus.OK)
    async convertLegacyElp(
        @Req() req: FastifyRequest,
        @Body() body: { sessionId?: string },
    ) {
        if (!req.isMultipart || !req.isMultipart()) {
            throw new BadRequestException('Expected multipart/form-data request');
        }

        let fileBuffer: Buffer | null = null;
        let originalFilename = 'legacy.elp';

        const data = await req.file();
        if (data) {
            fileBuffer = await data.toBuffer();
            originalFilename = data.filename || originalFilename;
        }

        if (!fileBuffer) {
            throw new BadRequestException('No file uploaded');
        }

        this.logger.log(`Converting legacy .elp file: ${originalFilename}`);

        let tempDir: string | null = null;

        try {
            // Create temp directory for extraction
            tempDir = await this.fileHelperService.getTempPath();
            const extractPath = path.join(tempDir, `legacy_${Date.now()}`);
            await fs.ensureDir(extractPath);

            // Save uploaded file
            const savePath = path.join(extractPath, originalFilename);
            await fs.writeFile(savePath, fileBuffer);

            // Extract ZIP
            await this.zipService.extract(savePath, extractPath);

            // Parse XML (will auto-detect legacy format)
            const structure = await this.xmlParserService.parseFromFile(
                path.join(extractPath, 'contentv3.xml'),
            );

            // Extract assets from the ZIP
            const assets: Array<{ path: string; base64: string; mime: string }> = [];
            const contentDir = path.join(extractPath, 'content');

            if (await fs.pathExists(contentDir)) {
                const assetFiles = await this.findAllFiles(contentDir);

                for (const assetPath of assetFiles) {
                    // Skip XML files
                    if (assetPath.endsWith('.xml')) continue;

                    try {
                        const relativePath = path.relative(extractPath, assetPath);
                        const buffer = await fs.readFile(assetPath);
                        const base64 = buffer.toString('base64');
                        const mime = this.getMimeType(assetPath);

                        assets.push({
                            path: relativePath,
                            base64,
                            mime,
                        });
                    } catch (e) {
                        this.logger.warn(`Failed to read asset: ${assetPath}`);
                    }
                }
            }

            this.logger.log(
                `Legacy conversion complete: ${structure.pages.length} pages, ${assets.length} assets`,
            );

            return {
                success: true,
                structure: {
                    pages: structure.pages,
                    meta: structure.meta,
                    raw: structure.raw, // Include raw for full structure access
                },
                assets,
            };
        } catch (error) {
            this.logger.error(`Legacy conversion failed: ${error.message}`, error.stack);
            return {
                success: false,
                error: error.message,
            };
        } finally {
            // Cleanup temp directory
            if (tempDir && (await fs.pathExists(tempDir))) {
                try {
                    await fs.remove(tempDir);
                } catch (e) {
                    this.logger.warn(`Failed to cleanup temp dir: ${e.message}`);
                }
            }
        }
    }

    /**
     * Recursively find all files in a directory
     */
    private async findAllFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await this.findAllFiles(fullPath);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        }

        return files;
    }

    /**
     * Get MIME type from file extension
     */
    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase().slice(1);
        const mimeTypes: Record<string, string> = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            webp: 'image/webp',
            mp4: 'video/mp4',
            webm: 'video/webm',
            ogg: 'video/ogg',
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            pdf: 'application/pdf',
            css: 'text/css',
            js: 'application/javascript',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}
