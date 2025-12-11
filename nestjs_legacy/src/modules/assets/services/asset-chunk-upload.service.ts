import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Asset } from '../../../entities/asset.entity';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mime from 'mime-types';

/**
 * AssetChunkUploadService
 *
 * Handles chunked uploads for large assets (>20MB).
 * Uses Resumable.js compatible protocol for resumable uploads.
 *
 * Chunk files are stored temporarily until all chunks arrive,
 * then assembled into the final asset file.
 */
@Injectable()
export class AssetChunkUploadService {
    private readonly logger = new Logger(AssetChunkUploadService.name);
    private readonly filesDir: string;

    // Default chunk size (1MB) - should match frontend
    readonly CHUNK_SIZE = 1 * 1024 * 1024;

    constructor(
        @InjectRepository(Asset)
        private readonly assetRepository: Repository<Asset>,
        private readonly configService: ConfigService,
    ) {
        this.filesDir = this.configService.get<string>('FILES_DIR') || '/tmp/exelearning-files';
    }

    /**
     * Get the temporary directory for chunks
     */
    private getChunksDir(projectUuid: string): string {
        const prefix1 = projectUuid[0].toLowerCase();
        const prefix2 = projectUuid[1].toLowerCase();
        return path.join(this.filesDir, 'projects', prefix1, prefix2, projectUuid, 'chunks');
    }

    /**
     * Get the asset storage directory for a project
     */
    private getProjectAssetsDir(projectUuid: string): string {
        const prefix1 = projectUuid[0].toLowerCase();
        const prefix2 = projectUuid[1].toLowerCase();
        return path.join(this.filesDir, 'projects', prefix1, prefix2, projectUuid, 'assets');
    }

    /**
     * Generate chunk file path
     * Pattern: {identifier}_{chunkNumber}.part
     */
    private getChunkPath(projectUuid: string, identifier: string, chunkNumber: number): string {
        const chunksDir = this.getChunksDir(projectUuid);
        // Sanitize identifier (only alphanumeric, underscore, and hyphen)
        const sanitizedIdentifier = identifier.replace(/[^0-9a-zA-Z_-]/g, '');
        const chunkFilename = `${sanitizedIdentifier}_${chunkNumber}.part`;
        return path.join(chunksDir, chunkFilename);
    }

    /**
     * Check if a chunk exists (for Resumable.js GET request)
     * Returns true if chunk exists and has correct size
     */
    async chunkExists(
        projectUuid: string,
        identifier: string,
        chunkNumber: number,
        expectedSize?: number,
    ): Promise<boolean> {
        const chunkPath = this.getChunkPath(projectUuid, identifier, chunkNumber);

        if (!(await fs.pathExists(chunkPath))) {
            return false;
        }

        // If expected size is provided, verify chunk size
        if (expectedSize !== undefined) {
            const stats = await fs.stat(chunkPath);
            return stats.size === expectedSize;
        }

        return true;
    }

    /**
     * Save a chunk
     */
    async saveChunk(
        projectUuid: string,
        identifier: string,
        chunkNumber: number,
        chunkData: Buffer,
    ): Promise<void> {
        const chunksDir = this.getChunksDir(projectUuid);
        await fs.ensureDir(chunksDir);

        const chunkPath = this.getChunkPath(projectUuid, identifier, chunkNumber);
        await fs.writeFile(chunkPath, chunkData);

        this.logger.debug(
            `Saved chunk ${chunkNumber} for identifier ${identifier} (${chunkData.length} bytes)`,
        );
    }

    /**
     * Check if all chunks have been received
     */
    async allChunksReceived(
        projectUuid: string,
        identifier: string,
        totalChunks: number,
    ): Promise<boolean> {
        for (let i = 1; i <= totalChunks; i++) {
            const chunkPath = this.getChunkPath(projectUuid, identifier, i);
            if (!(await fs.pathExists(chunkPath))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Assemble chunks into final file and create Asset record
     * Returns the created Asset
     */
    async assembleChunks(
        projectId: number,
        projectUuid: string,
        identifier: string,
        totalChunks: number,
        filename: string,
        mimeType: string,
        clientId?: string,
    ): Promise<Asset> {
        // Check if asset was already created by a concurrent chunk (race condition fix)
        // This makes the operation idempotent when multiple chunks finish simultaneously
        if (clientId) {
            const existing = await this.assetRepository.findOne({
                where: { clientId, projectId },
            });
            if (existing) {
                this.logger.debug(
                    `Asset with clientId ${clientId} already exists (id: ${existing.id}), returning existing`,
                );
                // Clean up chunks since asset was already created by another concurrent request
                await this.cleanupChunks(projectUuid, identifier, totalChunks);
                return existing;
            }
        }

        const assetsDir = this.getProjectAssetsDir(projectUuid);
        await fs.ensureDir(assetsDir);

        // Generate unique storage name
        const ext = path.extname(filename);
        const randomId = Math.random().toString(36).substring(2, 8);
        const storageName = `${Date.now()}-${randomId}${ext}`;
        const finalPath = path.join(assetsDir, storageName);

        // Create hash calculator
        const hash = crypto.createHash('sha256');

        // Create write stream for final file
        const writeStream = fs.createWriteStream(finalPath);
        let totalSize = 0;

        try {
            // Read and append each chunk in order
            for (let i = 1; i <= totalChunks; i++) {
                const chunkPath = this.getChunkPath(projectUuid, identifier, i);

                if (!(await fs.pathExists(chunkPath))) {
                    throw new Error(`Missing chunk ${i} of ${totalChunks}`);
                }

                const chunkData = await fs.readFile(chunkPath);
                hash.update(chunkData);
                totalSize += chunkData.length;
                writeStream.write(chunkData);
            }

            writeStream.end();

            // Wait for write to complete
            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', () => resolve());
                writeStream.on('error', (err) => reject(err));
            });

            // Clean up chunks
            await this.cleanupChunks(projectUuid, identifier, totalChunks);

            // Create asset record
            const contentHash = hash.digest('hex');
            const asset = new Asset();
            asset.projectId = projectId;
            asset.filename = filename;
            asset.storagePath = storageName;
            asset.mimeType = mimeType || mime.lookup(filename) || 'application/octet-stream';
            asset.fileSize = totalSize.toString();
            asset.contentHash = contentHash;
            asset.clientId = clientId || null;

            let savedAsset: Asset;
            try {
                savedAsset = await this.assetRepository.save(asset);
            } catch (saveError) {
                // Handle UNIQUE constraint violation (race condition with concurrent chunks)
                if (
                    saveError.message?.includes('UNIQUE constraint failed') &&
                    clientId
                ) {
                    this.logger.debug(
                        `UNIQUE constraint hit for clientId ${clientId}, looking up existing asset`,
                    );
                    const existing = await this.assetRepository.findOne({
                        where: { clientId, projectId },
                    });
                    if (existing) {
                        // Clean up the duplicate file we just created
                        if (await fs.pathExists(finalPath)) {
                            await fs.remove(finalPath);
                        }
                        this.logger.debug(
                            `Returning existing asset ${existing.id} after UNIQUE constraint`,
                        );
                        return existing;
                    }
                }
                // Re-throw if not a handled race condition
                throw saveError;
            }

            this.logger.log(
                `Assembled ${totalChunks} chunks into asset ${savedAsset.id}: ${filename} (${(totalSize / (1024 * 1024)).toFixed(2)} MB)`,
            );

            return savedAsset;
        } catch (error) {
            writeStream.destroy();
            // Clean up partial file on error
            if (await fs.pathExists(finalPath)) {
                await fs.remove(finalPath);
            }
            throw error;
        }
    }

    /**
     * Clean up chunk files after assembly or on error
     */
    async cleanupChunks(
        projectUuid: string,
        identifier: string,
        totalChunks: number,
    ): Promise<void> {
        for (let i = 1; i <= totalChunks; i++) {
            const chunkPath = this.getChunkPath(projectUuid, identifier, i);
            if (await fs.pathExists(chunkPath)) {
                await fs.remove(chunkPath);
            }
        }
        this.logger.debug(`Cleaned up ${totalChunks} chunks for identifier ${identifier}`);
    }

    /**
     * Cancel an upload (clean up any existing chunks)
     */
    async cancelUpload(projectUuid: string, identifier: string): Promise<void> {
        const chunksDir = this.getChunksDir(projectUuid);

        if (!(await fs.pathExists(chunksDir))) {
            return;
        }

        // Find and delete all chunks for this identifier
        const sanitizedIdentifier = identifier.replace(/[^0-9a-zA-Z_-]/g, '');
        const files = await fs.readdir(chunksDir);

        for (const file of files) {
            if (file.startsWith(`${sanitizedIdentifier}_`)) {
                await fs.remove(path.join(chunksDir, file));
            }
        }

        this.logger.debug(`Cancelled upload for identifier ${identifier}`);
    }

    /**
     * Get upload progress (how many chunks received)
     */
    async getUploadProgress(
        projectUuid: string,
        identifier: string,
        totalChunks: number,
    ): Promise<{ received: number; total: number; percentage: number }> {
        let received = 0;

        for (let i = 1; i <= totalChunks; i++) {
            const chunkPath = this.getChunkPath(projectUuid, identifier, i);
            if (await fs.pathExists(chunkPath)) {
                received++;
            }
        }

        return {
            received,
            total: totalChunks,
            percentage: Math.round((received / totalChunks) * 100),
        };
    }
}
