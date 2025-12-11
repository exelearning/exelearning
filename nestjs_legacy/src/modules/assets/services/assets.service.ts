import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Asset } from '../../../entities/asset.entity';
import { ProjectsService } from '../../projects/services/projects.service';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import * as mime from 'mime-types';

/**
 * AssetsService
 * Handles file upload/download and asset management for projects.
 * Assets are stored in the filesystem and metadata in the database.
 */
@Injectable()
export class AssetsService {
    private readonly logger = new Logger(AssetsService.name);
    private readonly filesDir: string;

    constructor(
        @InjectRepository(Asset)
        private readonly assetRepository: Repository<Asset>,
        private readonly projectsService: ProjectsService,
        private readonly configService: ConfigService,
    ) {
        this.filesDir = this.configService.get<string>('FILES_DIR') || '/tmp/exelearning-files';
    }

    /**
     * Get the asset storage directory for a project
     * Uses hierarchical structure: {prefix1}/{prefix2}/{uuid}/assets/
     * This prevents filesystem performance issues with many projects
     */
    private getProjectAssetsDir(projectUuid: string): string {
        const prefix1 = projectUuid[0].toLowerCase();
        const prefix2 = projectUuid[1].toLowerCase();
        return path.join(this.filesDir, 'projects', prefix1, prefix2, projectUuid, 'assets');
    }

    /**
     * Upload an asset for a project
     */
    async upload(
        projectId: number,
        projectUuid: string,
        userId: number,
        file: Express.Multer.File,
        componentId?: string,
        clientId?: string,
    ): Promise<Asset> {
        // Verify user has access to project
        await this.projectsService.findOne(projectId, userId);

        // Check if asset with this clientId already exists IN THIS PROJECT (idempotent upload)
        if (clientId) {
            const existing = await this.findByClientId(clientId, projectId);
            if (existing) {
                this.logger.log(
                    `Asset with clientId ${clientId} already exists in project ${projectId} (id: ${existing.id}), returning existing`,
                );
                return existing;
            }
        }

        // Create assets directory if it doesn't exist
        const assetsDir = this.getProjectAssetsDir(projectUuid);
        await fs.ensureDir(assetsDir);

        // Generate unique storage path
        const ext = path.extname(file.originalname);
        const hash = this.computeHash(file.buffer);
        const storageName = `${Date.now()}-${hash.substring(0, 8)}${ext}`;
        const storagePath = componentId ? path.join(componentId, storageName) : storageName;
        const fullPath = path.join(assetsDir, storagePath);

        // Ensure subdirectory exists
        await fs.ensureDir(path.dirname(fullPath));

        // Write file
        await fs.writeFile(fullPath, file.buffer);

        // Create asset record
        const asset = new Asset();
        asset.projectId = projectId;
        asset.filename = file.originalname;
        asset.storagePath = storagePath;
        asset.mimeType =
            file.mimetype || mime.lookup(file.originalname) || 'application/octet-stream';
        asset.fileSize = file.size.toString();
        asset.componentId = componentId || null;
        asset.contentHash = hash;
        asset.clientId = clientId || null;

        const savedAsset = await this.assetRepository.save(asset);

        this.logger.log(
            `Uploaded asset ${savedAsset.id} for project ${projectId}: ${file.originalname}`,
        );

        return savedAsset;
    }

    /**
     * Find asset by client-side UUID (asset:// URL scheme)
     * @param clientId - The client-side UUID
     * @param projectId - Optional project ID to filter by (recommended to avoid conflicts)
     */
    async findByClientId(clientId: string, projectId?: number): Promise<Asset | null> {
        const where: any = { clientId };
        if (projectId !== undefined) {
            where.projectId = projectId;
        }
        return this.assetRepository.findOne({
            where,
        });
    }

    /**
     * Batch find assets by multiple client-side UUIDs
     * Much more efficient than calling findByClientId N times
     * @param clientIds - Array of client-side UUIDs
     * @param projectId - Project ID to filter by
     */
    async findByClientIds(clientIds: string[], projectId: number): Promise<Asset[]> {
        if (clientIds.length === 0) return [];
        return this.assetRepository
            .createQueryBuilder('asset')
            .where('asset.projectId = :projectId', { projectId })
            .andWhere('asset.clientId IN (:...clientIds)', { clientIds })
            .getMany();
    }

    /**
     * Batch find assets by multiple content hashes
     * Much more efficient than calling findByHash N times
     * @param projectId - Project ID to filter by
     * @param hashes - Array of content hashes
     */
    async findByHashes(projectId: number, hashes: string[]): Promise<Asset[]> {
        if (hashes.length === 0) return [];
        return this.assetRepository
            .createQueryBuilder('asset')
            .where('asset.projectId = :projectId', { projectId })
            .andWhere('asset.contentHash IN (:...hashes)', { hashes })
            .getMany();
    }

    /**
     * Bulk sync assets from client IndexedDB to server
     * Optimized with batch queries and parallel file writes
     * Returns mapping of clientId -> serverId
     */
    async bulkSync(
        projectId: number,
        projectUuid: string,
        userId: number,
        assets: Array<{
            clientId: string;
            filename: string;
            mimeType: string;
            contentHash: string;
            buffer: Buffer;
        }>,
    ): Promise<Map<string, number>> {
        // Verify user has access to project
        await this.projectsService.findOne(projectId, userId);

        const assetsDir = this.getProjectAssetsDir(projectUuid);
        await fs.ensureDir(assetsDir);

        const WRITE_CONCURRENCY = 10; // Parallel file writes
        const mapping = new Map<string, number>();

        // Step 1: Batch query for existing assets by clientId (1 query vs N)
        const clientIds = assets.map(a => a.clientId).filter(id => id);
        const existingByClientId = await this.findByClientIds(clientIds, projectId);
        const existingClientIdMap = new Map(existingByClientId.map(a => [a.clientId, a]));

        // Step 2: Batch query for duplicates by hash (1 query vs N)
        const hashes = assets.map(a => a.contentHash).filter(h => h);
        const existingByHash = await this.findByHashes(projectId, hashes);
        const existingHashMap = new Map(existingByHash.map(a => [a.contentHash, a]));

        // Step 3: Filter - only process assets that need to be saved
        const toProcess: typeof assets = [];
        const duplicatesToUpdate: Array<{ asset: Asset; clientId: string }> = [];

        for (const assetData of assets) {
            // Already exists by clientId
            if (existingClientIdMap.has(assetData.clientId)) {
                mapping.set(assetData.clientId, existingClientIdMap.get(assetData.clientId)!.id);
                continue;
            }

            // Duplicate by hash exists
            const hashDuplicate = existingHashMap.get(assetData.contentHash);
            if (hashDuplicate) {
                mapping.set(assetData.clientId, hashDuplicate.id);
                // Queue for clientId update if needed
                if (!hashDuplicate.clientId) {
                    duplicatesToUpdate.push({ asset: hashDuplicate, clientId: assetData.clientId });
                }
                continue;
            }

            // Needs to be created
            toProcess.push(assetData);
        }

        // Step 4: Update duplicates that need clientId (batch)
        if (duplicatesToUpdate.length > 0) {
            for (const { asset, clientId } of duplicatesToUpdate) {
                asset.clientId = clientId;
            }
            await this.assetRepository.save(duplicatesToUpdate.map(d => d.asset));
        }

        // Step 5: Write new files in parallel (chunks of WRITE_CONCURRENCY)
        const entitiesToSave: Asset[] = [];
        const chunks = this.chunkArray(toProcess, WRITE_CONCURRENCY);

        for (const chunk of chunks) {
            await Promise.all(
                chunk.map(async (assetData) => {
                    const ext = path.extname(assetData.filename);
                    // Add random component to prevent collisions with parallel writes
                    const randomId = Math.random().toString(36).substring(2, 8);
                    const storageName = `${Date.now()}-${randomId}-${assetData.contentHash.substring(0, 8)}${ext}`;
                    const fullPath = path.join(assetsDir, storageName);

                    // Write file
                    await fs.writeFile(fullPath, assetData.buffer);

                    // Create asset entity (will be batch-saved later)
                    const asset = new Asset();
                    asset.projectId = projectId;
                    asset.filename = assetData.filename;
                    asset.storagePath = storageName;
                    asset.mimeType = assetData.mimeType;
                    asset.fileSize = assetData.buffer.length.toString();
                    asset.contentHash = assetData.contentHash;
                    asset.clientId = assetData.clientId;

                    entitiesToSave.push(asset);
                }),
            );
        }

        // Step 6: Batch insert all new assets (1 operation vs N)
        if (entitiesToSave.length > 0) {
            const savedAssets = await this.assetRepository.save(entitiesToSave);
            for (const saved of savedAssets) {
                mapping.set(saved.clientId!, saved.id);
            }
            this.logger.log(
                `Bulk synced ${savedAssets.length} new assets for project ${projectId}`,
            );
        }

        this.logger.log(
            `bulkSync completed: ${mapping.size} total mappings (${entitiesToSave.length} new, ${assets.length - toProcess.length} existing/deduped)`,
        );

        return mapping;
    }

    /**
     * Helper to split array into chunks for controlled parallelism
     */
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * List all assets for a project
     */
    async findAllForProject(projectId: number, userId: number): Promise<Asset[]> {
        // Verify user has access to project
        await this.projectsService.findOne(projectId, userId);

        return this.assetRepository.find({
            where: { projectId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Get an asset by ID (with project relation for UUID)
     */
    async findOne(assetId: number, userId: number): Promise<Asset> {
        const asset = await this.assetRepository.findOne({
            where: { id: assetId },
            relations: ['project'],
        });

        if (!asset) {
            throw new NotFoundException(`Asset with ID ${assetId} not found`);
        }

        // Verify user has access to project
        await this.projectsService.findOne(asset.projectId, userId);

        return asset;
    }

    /**
     * Get the full filesystem path for an asset
     */
    async getAssetPath(assetId: number, userId: number): Promise<string> {
        const asset = await this.findOne(assetId, userId);
        const assetsDir = this.getProjectAssetsDir(asset.project.uuid);
        const fullPath = path.join(assetsDir, asset.storagePath);

        if (!(await fs.pathExists(fullPath))) {
            throw new NotFoundException(`Asset file not found on disk`);
        }

        return fullPath;
    }

    /**
     * Download an asset (returns file buffer and metadata)
     */
    async download(assetId: number, userId: number): Promise<{ buffer: Buffer; asset: Asset }> {
        const fullPath = await this.getAssetPath(assetId, userId);
        const asset = await this.findOne(assetId, userId);
        const buffer = await fs.readFile(fullPath);

        return { buffer, asset };
    }

    /**
     * Download an asset without access check (access already verified by controller)
     * Use this when access has been verified using checkAccessByUuid()
     */
    async downloadAsset(
        asset: Asset,
        projectUuid: string,
    ): Promise<{ buffer: Buffer; asset: Asset }> {
        const assetsDir = this.getProjectAssetsDir(projectUuid);
        const fullPath = path.join(assetsDir, asset.storagePath);

        if (!(await fs.pathExists(fullPath))) {
            throw new NotFoundException(`Asset file not found on disk`);
        }

        const buffer = await fs.readFile(fullPath);
        return { buffer, asset };
    }

    /**
     * Delete an asset
     */
    async delete(assetId: number, userId: number): Promise<void> {
        const asset = await this.findOne(assetId, userId);
        const assetsDir = this.getProjectAssetsDir(asset.project.uuid);
        const fullPath = path.join(assetsDir, asset.storagePath);

        // Delete file from disk
        if (await fs.pathExists(fullPath)) {
            await fs.unlink(fullPath);
        }

        // Delete record from database
        await this.assetRepository.remove(asset);

        this.logger.log(`Deleted asset ${assetId}`);
    }

    /**
     * Delete all assets for a project
     */
    async deleteAllForProject(
        projectId: number,
        projectUuid: string,
        userId: number,
    ): Promise<void> {
        // Verify user has access to project
        await this.projectsService.findOne(projectId, userId);

        const assetsDir = this.getProjectAssetsDir(projectUuid);

        // Delete all files
        if (await fs.pathExists(assetsDir)) {
            await fs.remove(assetsDir);
        }

        // Delete all records
        await this.assetRepository.delete({ projectId });

        this.logger.log(`Deleted all assets for project ${projectId}`);
    }

    /**
     * Compute SHA-256 hash of a buffer
     */
    private computeHash(buffer: Buffer): string {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * Check if a file with the same hash already exists for a project
     * (for deduplication)
     */
    async findByHash(projectId: number, hash: string): Promise<Asset | null> {
        return this.assetRepository.findOne({
            where: { projectId, contentHash: hash },
        });
    }

    /**
     * Get total storage used by a project (in bytes)
     */
    async getProjectStorageSize(projectId: number, userId: number): Promise<number> {
        // Verify user has access to project
        await this.projectsService.findOne(projectId, userId);

        const result = await this.assetRepository
            .createQueryBuilder('asset')
            .select('SUM(CAST(asset.fileSize AS INTEGER))', 'totalSize')
            .where('asset.projectId = :projectId', { projectId })
            .getRawOne();

        return parseInt(result?.totalSize || '0', 10);
    }
}
