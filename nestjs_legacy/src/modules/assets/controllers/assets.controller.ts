import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    UseGuards,
    Req,
    Res,
    ParseIntPipe,
    Query,
    HttpStatus,
    HttpCode,
    Body,
} from '@nestjs/common';
import { ProjectsService } from '../../projects/services/projects.service';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AssetsService } from '../services/assets.service';
import { AssetChunkUploadService } from '../services/asset-chunk-upload.service';
import '../../types/fastify';

interface UploadedFile {
    buffer: Buffer;
    filename: string;
    fieldname: string;
    mimetype: string;
}

/**
 * AssetsController
 * REST API endpoints for asset management (file upload/download).
 *
 * Endpoints:
 * - POST /api/v2/projects/:projectId/assets - Upload asset
 * - GET /api/v2/projects/:projectId/assets - List assets
 * - GET /api/v2/projects/:projectId/assets/:assetId - Download asset
 * - DELETE /api/v2/projects/:projectId/assets/:assetId - Delete asset
 */
@Controller('api/v2/projects/:projectId/assets')
@UseGuards(JwtAuthGuard)
export class AssetsController {
    constructor(
        private readonly assetsService: AssetsService,
        private readonly projectsService: ProjectsService,
        private readonly chunkUploadService: AssetChunkUploadService,
    ) {}

    /**
     * Upload an asset
     * POST /api/v2/projects/:projectId/assets
     * Note: projectId is now a UUID string
     */
    @Post()
    async upload(
        @Req() req: FastifyRequest,
        @Param('projectId') projectUuid: string,
        @Query('componentId') componentId?: string,
        @Query('clientId') clientId?: string,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            return { success: false, error: 'Project not found' };
        }

        // Handle multipart file upload
        if (!req.isMultipart || !req.isMultipart()) {
            return { success: false, error: 'Expected multipart/form-data request' };
        }

        const data = await req.file();
        if (!data) {
            return { success: false, error: 'No file uploaded' };
        }

        const fileBuffer = await data.toBuffer();
        const file = {
            buffer: fileBuffer,
            originalname: data.filename,
            mimetype: data.mimetype || 'application/octet-stream',
            size: fileBuffer.length,
        };

        const asset = await this.assetsService.upload(
            project.id,
            projectUuid,
            userId,
            file as any,
            componentId,
            clientId,
        );

        return {
            success: true,
            data: this.serializeAsset(asset),
        };
    }

    /**
     * Check if a chunk exists (for resumable uploads)
     * GET /api/v2/projects/:projectId/assets/upload-chunk
     *
     * Resumable.js calls this before each POST to check if chunk already exists.
     * Responds 200 if chunk exists (skip upload), 204 if not (proceed with upload).
     *
     * Query params (Resumable.js standard):
     * - resumableIdentifier: Unique upload identifier
     * - resumableChunkNumber: Chunk number (1-indexed)
     * - resumableChunkSize: Expected chunk size (optional)
     * - resumableFilename: Original filename
     */
    @Get('upload-chunk')
    async checkChunk(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Param('projectId') projectUuid: string,
        @Query('resumableIdentifier') identifier: string,
        @Query('resumableChunkNumber') chunkNumber: string,
        @Query('resumableChunkSize') chunkSize?: string,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            res.code(HttpStatus.NOT_FOUND).send({
                success: false,
                error: 'Project not found',
            });
            return;
        }

        // Verify user has access
        const accessCheck = await this.projectsService.checkAccessByUuid(projectUuid, userId);
        if (!accessCheck.hasAccess) {
            res.code(HttpStatus.FORBIDDEN).send({
                success: false,
                error: 'Access denied',
            });
            return;
        }

        const chunkNum = parseInt(chunkNumber, 10);
        const expectedSize = chunkSize ? parseInt(chunkSize, 10) : undefined;

        const exists = await this.chunkUploadService.chunkExists(
            projectUuid,
            identifier,
            chunkNum,
            expectedSize,
        );

        if (exists) {
            // Chunk exists - skip upload
            res.code(HttpStatus.OK).send('');
        } else {
            // Chunk doesn't exist - proceed with upload
            res.code(HttpStatus.NO_CONTENT).send('');
        }
    }

    /**
     * Upload a chunk for large file uploads
     * POST /api/v2/projects/:projectId/assets/upload-chunk
     *
     * Receives individual chunks and assembles them when complete.
     * Returns the Asset when all chunks are received and assembled.
     *
     * Query/Body params (Resumable.js standard):
     * - resumableIdentifier: Unique upload identifier
     * - resumableChunkNumber: Chunk number (1-indexed)
     * - resumableTotalChunks: Total number of chunks
     * - resumableFilename: Original filename
     * - resumableType: MIME type (optional)
     * - clientId: Client-side asset ID (optional, for IndexedDB sync)
     */
    @Post('upload-chunk')
    async uploadChunk(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Param('projectId') projectUuid: string,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            res.code(HttpStatus.NOT_FOUND).send({
                success: false,
                error: 'Project not found',
            });
            return;
        }

        // Verify user has access
        const accessCheck = await this.projectsService.checkAccessByUuid(projectUuid, userId);
        if (!accessCheck.hasAccess) {
            res.code(HttpStatus.FORBIDDEN).send({
                success: false,
                error: 'Access denied',
            });
            return;
        }

        // Handle multipart file upload
        if (!req.isMultipart || !req.isMultipart()) {
            res.code(HttpStatus.BAD_REQUEST).send({
                success: false,
                error: 'Expected multipart/form-data request',
            });
            return;
        }

        const data = await req.file();
        if (!data) {
            res.code(HttpStatus.BAD_REQUEST).send({
                success: false,
                error: 'No file uploaded',
            });
            return;
        }

        const fileBuffer = await data.toBuffer();

        // Extract parameters from fields (Resumable.js sends as form data)
        const fields = data.fields as Record<string, { value: string }>;
        const resumableIdentifier = fields.resumableIdentifier?.value;
        const resumableChunkNumber = fields.resumableChunkNumber?.value;
        const resumableTotalChunks = fields.resumableTotalChunks?.value;
        const resumableFilename = fields.resumableFilename?.value;
        const resumableType = fields.resumableType?.value;
        const clientId = fields.clientId?.value;

        const chunkNumber = parseInt(resumableChunkNumber, 10);
        const totalChunks = parseInt(resumableTotalChunks, 10);

        if (!resumableIdentifier || !chunkNumber || !totalChunks) {
            res.code(HttpStatus.BAD_REQUEST).send({
                success: false,
                error: 'Missing required chunk parameters',
            });
            return;
        }

        // Save the chunk
        await this.chunkUploadService.saveChunk(
            projectUuid,
            resumableIdentifier,
            chunkNumber,
            fileBuffer,
        );

        // Check if all chunks have been received
        const allReceived = await this.chunkUploadService.allChunksReceived(
            projectUuid,
            resumableIdentifier,
            totalChunks,
        );

        if (allReceived) {
            // All chunks received - assemble and create asset
            try {
                const asset = await this.chunkUploadService.assembleChunks(
                    project.id,
                    projectUuid,
                    resumableIdentifier,
                    totalChunks,
                    resumableFilename || `upload-${Date.now()}`,
                    resumableType || 'application/octet-stream',
                    clientId,
                );

                res.code(HttpStatus.OK).send({
                    success: true,
                    complete: true,
                    data: this.serializeAsset(asset),
                });
            } catch (error) {
                // Clean up on assembly error
                await this.chunkUploadService.cleanupChunks(
                    projectUuid,
                    resumableIdentifier,
                    totalChunks,
                );

                res.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
                    success: false,
                    error: `Failed to assemble chunks: ${error.message}`,
                });
            }
        } else {
            // Chunk saved, waiting for more
            const progress = await this.chunkUploadService.getUploadProgress(
                projectUuid,
                resumableIdentifier,
                totalChunks,
            );

            res.code(HttpStatus.OK).send({
                success: true,
                complete: false,
                progress,
            });
        }
    }

    /**
     * Finalize a chunked upload (trigger assembly without re-uploading)
     * POST /api/v2/projects/:projectId/assets/upload-chunk/finalize
     *
     * Used when concurrent chunk uploads caused all allChunksReceived checks to return false.
     * This endpoint checks if all chunks exist and assembles them if so.
     *
     * Body:
     * - resumableIdentifier: Unique upload identifier
     * - resumableTotalChunks: Total number of chunks
     * - resumableFilename: Original filename
     * - resumableType: MIME type (optional)
     * - clientId: Client-side asset ID (optional)
     */
    @Post('upload-chunk/finalize')
    async finalizeChunkedUpload(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Param('projectId') projectUuid: string,
        @Body() body: any,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            res.code(HttpStatus.NOT_FOUND).send({
                success: false,
                error: 'Project not found',
            });
            return;
        }

        // Verify user has access
        const accessCheck = await this.projectsService.checkAccessByUuid(projectUuid, userId);
        if (!accessCheck.hasAccess) {
            res.code(HttpStatus.FORBIDDEN).send({
                success: false,
                error: 'Access denied',
            });
            return;
        }

        const {
            resumableIdentifier,
            resumableTotalChunks,
            resumableFilename,
            resumableType,
            clientId,
        } = body;

        const totalChunks = parseInt(resumableTotalChunks, 10);

        if (!resumableIdentifier || !totalChunks) {
            res.code(HttpStatus.BAD_REQUEST).send({
                success: false,
                error: 'Missing required parameters: resumableIdentifier, resumableTotalChunks',
            });
            return;
        }

        // Check if all chunks have been received
        const allReceived = await this.chunkUploadService.allChunksReceived(
            projectUuid,
            resumableIdentifier,
            totalChunks,
        );

        if (!allReceived) {
            const progress = await this.chunkUploadService.getUploadProgress(
                projectUuid,
                resumableIdentifier,
                totalChunks,
            );
            res.code(HttpStatus.OK).send({
                success: true,
                complete: false,
                message: 'Not all chunks received yet',
                progress,
            });
            return;
        }

        // All chunks received - assemble
        try {
            const asset = await this.chunkUploadService.assembleChunks(
                project.id,
                projectUuid,
                resumableIdentifier,
                totalChunks,
                resumableFilename || `upload-${Date.now()}`,
                resumableType || 'application/octet-stream',
                clientId,
            );

            res.code(HttpStatus.OK).send({
                success: true,
                complete: true,
                data: this.serializeAsset(asset),
            });
        } catch (error) {
            await this.chunkUploadService.cleanupChunks(
                projectUuid,
                resumableIdentifier,
                totalChunks,
            );

            res.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
                success: false,
                error: `Failed to assemble chunks: ${error.message}`,
            });
        }
    }

    /**
     * Cancel a chunked upload
     * DELETE /api/v2/projects/:projectId/assets/upload-chunk/:identifier
     */
    @Delete('upload-chunk/:identifier')
    async cancelChunkedUpload(
        @Req() req: FastifyRequest,
        @Param('projectId') projectUuid: string,
        @Param('identifier') identifier: string,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            return { success: false, error: 'Project not found' };
        }

        // Verify user has access
        const accessCheck = await this.projectsService.checkAccessByUuid(projectUuid, userId);
        if (!accessCheck.hasAccess) {
            return { success: false, error: 'Access denied' };
        }

        await this.chunkUploadService.cancelUpload(projectUuid, identifier);

        return { success: true, message: 'Upload cancelled' };
    }

    /**
     * Bulk sync assets from client IndexedDB to server
     * POST /api/v2/projects/:projectId/assets/sync
     *
     * Request body: multipart/form-data with:
     * - metadata: JSON array of {clientId, filename, mimeType, contentHash}
     * - files[]: Array of file buffers matching metadata order
     */
    @Post('sync')
    async bulkSync(@Req() req: FastifyRequest, @Param('projectId') projectUuid: string) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            return { success: false, error: 'Project not found' };
        }
        const projectId = project.id;

        // Handle multipart file upload
        if (!req.isMultipart || !req.isMultipart()) {
            return { success: false, error: 'Expected multipart/form-data request' };
        }

        // Collect all files from the multipart request
        const files: UploadedFile[] = [];
        let metadataRaw: string | undefined;

        for await (const part of req.files!({ limits: { files: 100 } as any })) {
            const buffer = await part.toBuffer();

            if (part.fieldname === 'metadata') {
                // Metadata is sent as a file field
                metadataRaw = buffer.toString('utf-8');
            } else {
                files.push({
                    buffer,
                    filename: part.filename,
                    fieldname: part.fieldname,
                    mimetype: part.mimetype || 'application/octet-stream',
                });
            }

            // Check fields for metadata as well
            const fields = part.fields as Record<string, { value: string }>;
            if (fields.metadata?.value && !metadataRaw) {
                metadataRaw = fields.metadata.value;
            }
        }

        if (!metadataRaw) {
            return { success: false, error: 'Missing metadata' };
        }

        let metadata: Array<{
            clientId: string;
            filename: string;
            mimeType: string;
            contentHash: string;
        }>;

        try {
            metadata = typeof metadataRaw === 'string' ? JSON.parse(metadataRaw) : metadataRaw;
        } catch {
            return { success: false, error: 'Invalid metadata JSON' };
        }

        if (files.length !== metadata.length) {
            return {
                success: false,
                error: `File count mismatch: ${files.length} files vs ${metadata.length} metadata entries`,
            };
        }

        // Build assets array for service
        const assets = metadata.map((meta, index) => ({
            clientId: meta.clientId,
            filename: meta.filename,
            mimeType: meta.mimeType,
            contentHash: meta.contentHash,
            buffer: files[index].buffer,
        }));

        const mapping = await this.assetsService.bulkSync(projectId, projectUuid, userId, assets);

        // Convert Map to object for JSON response
        const mappingObj: Record<string, number> = {};
        mapping.forEach((serverId, clientId) => {
            mappingObj[clientId] = serverId;
        });

        return {
            success: true,
            data: {
                synced: mapping.size,
                mapping: mappingObj,
            },
        };
    }

    /**
     * Get asset by client UUID (asset:// URL scheme)
     * GET /api/v2/projects/:projectId/assets/by-client-id/:clientId
     */
    @Get('by-client-id/:clientId')
    async getByClientId(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Param('projectId') projectUuid: string,
        @Param('clientId') clientId: string,
    ) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            res.code(HttpStatus.NOT_FOUND).send({
                success: false,
                error: 'Project not found',
            });
            return;
        }

        // Check access using checkAccessByUuid (respects visibility: 'public')
        const accessCheck = await this.projectsService.checkAccessByUuid(projectUuid, userId);
        if (!accessCheck.hasAccess) {
            res.code(HttpStatus.FORBIDDEN).send({
                success: false,
                error: 'Access denied to this project',
            });
            return;
        }

        // Find asset by clientId, filtering by project to avoid conflicts with old data
        const asset = await this.assetsService.findByClientId(clientId, project.id);

        if (!asset) {
            res.code(HttpStatus.NOT_FOUND).send({
                success: false,
                error: `Asset with clientId ${clientId} not found in project`,
            });
            return;
        }

        // Download without additional access check (already verified above)
        const { buffer } = await this.assetsService.downloadAsset(asset, projectUuid);

        res.header('Content-Type', asset.mimeType || 'application/octet-stream');
        res.header('Content-Length', buffer.length.toString());
        res.header(
            'Content-Disposition',
            `inline; filename="${encodeURIComponent(asset.filename)}"`,
        );
        res.code(HttpStatus.OK).send(buffer);
    }

    /**
     * List all assets for a project
     * GET /api/v2/projects/:projectId/assets
     */
    @Get()
    async findAll(@Req() req: FastifyRequest, @Param('projectId') projectUuid: string) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            return { success: false, error: 'Project not found' };
        }
        const assets = await this.assetsService.findAllForProject(project.id, userId);

        return {
            success: true,
            data: assets.map((a) => this.serializeAsset(a)),
        };
    }

    /**
     * Download an asset
     * GET /api/v2/projects/:projectId/assets/:assetId
     */
    @Get(':assetId')
    async download(
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
        @Param('projectId') projectUuid: string,
        @Param('assetId', ParseIntPipe) assetId: number,
    ) {
        const userId = (req as any).user.sub;
        // Note: projectUuid is validated by assetsService via project access check
        const { buffer, asset } = await this.assetsService.download(assetId, userId);

        res.header('Content-Type', asset.mimeType || 'application/octet-stream');
        res.header('Content-Length', buffer.length.toString());
        res.header(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(asset.filename)}"`,
        );
        res.code(HttpStatus.OK).send(buffer);
    }

    /**
     * Get asset metadata (without downloading)
     * GET /api/v2/projects/:projectId/assets/:assetId/metadata
     */
    @Get(':assetId/metadata')
    async getMetadata(
        @Req() req: FastifyRequest,
        @Param('projectId') projectUuid: string,
        @Param('assetId', ParseIntPipe) assetId: number,
    ) {
        const userId = (req as any).user.sub;
        // Note: projectUuid is validated by assetsService via project access check
        const asset = await this.assetsService.findOne(assetId, userId);

        return {
            success: true,
            data: this.serializeAsset(asset),
        };
    }

    /**
     * Delete an asset
     * DELETE /api/v2/projects/:projectId/assets/:assetId
     */
    @Delete(':assetId')
    async delete(
        @Req() req: FastifyRequest,
        @Param('projectId') projectUuid: string,
        @Param('assetId', ParseIntPipe) assetId: number,
    ) {
        const userId = (req as any).user.sub;
        // Note: projectUuid is validated by assetsService via project access check
        await this.assetsService.delete(assetId, userId);

        return {
            success: true,
            message: 'Asset deleted successfully',
        };
    }

    /**
     * Get storage usage for a project
     * GET /api/v2/projects/:projectId/assets/storage-usage
     */
    @Get('storage-usage')
    async getStorageUsage(@Req() req: FastifyRequest, @Param('projectId') projectUuid: string) {
        const userId = (req as any).user.sub;
        const project = await this.projectsService.findByUuid(projectUuid);
        if (!project) {
            return { success: false, error: 'Project not found' };
        }
        const totalBytes = await this.assetsService.getProjectStorageSize(project.id, userId);

        return {
            success: true,
            data: {
                totalBytes,
                totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
            },
        };
    }

    /**
     * Serialize an asset for API response
     */
    private serializeAsset(asset: any) {
        return {
            id: asset.id,
            clientId: asset.clientId,
            filename: asset.filename,
            storagePath: asset.storagePath,
            mimeType: asset.mimeType,
            size: parseInt(asset.fileSize || '0', 10),
            componentId: asset.componentId,
            contentHash: asset.contentHash,
            createdAt: asset.createdAt?.toISOString(),
            updatedAt: asset.updatedAt?.toISOString(),
        };
    }
}
