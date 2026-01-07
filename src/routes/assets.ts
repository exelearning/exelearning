/**
 * Assets Routes for Elysia
 * Handles file upload, download, and management for project assets
 */
import { Elysia } from 'elysia';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as mimeTypes from 'mime-types';

import { db } from '../db/client';
import type { Asset, Database } from '../db/types';
import {
    createAsset,
    createAssets,
    findAssetById,
    findAllAssetsForProject,
    findAssetByClientId,
    findAssetsByClientIds,
    deleteAsset as dbDeleteAsset,
    updateAsset,
    bulkUpdateAssets,
    findProjectByUuid,
} from '../db/queries';
import type { Kysely } from 'kysely';

import {
    getOdeSessionTempDir as getOdeSessionTempDirDefault,
    getProjectAssetsDir as getProjectAssetsDirDefault,
    fileExists as fileExistsDefault,
    readFile as readFileDefault,
    writeFile as writeFileDefault,
    remove as removeDefault,
    getStats as getStatsDefault,
    listFiles as listFilesDefault,
    generateUniqueFilename as generateUniqueFilenameDefault,
} from '../services/file-helper';

import { getSession as getSessionDefault } from '../services/session-manager';
import { serverPriorityQueue as serverPriorityQueueDefault } from '../services/asset-priority-queue';
import type { AssetUploadRequest } from './types/request-payloads';

/**
 * File with optional name property (for Blob/File uploads)
 */
interface FileWithName extends Blob {
    name?: string;
}

/**
 * Query dependencies for assets routes
 */
export interface AssetsQueries {
    createAsset: typeof createAsset;
    createAssets: typeof createAssets;
    findAssetById: typeof findAssetById;
    findAllAssetsForProject: typeof findAllAssetsForProject;
    findAssetByClientId: typeof findAssetByClientId;
    findAssetsByClientIds: typeof findAssetsByClientIds;
    deleteAsset: typeof dbDeleteAsset;
    updateAsset: typeof updateAsset;
    bulkUpdateAssets: typeof bulkUpdateAssets;
    findProjectByUuid: typeof findProjectByUuid;
}

/**
 * File helper dependencies for assets routes
 */
export interface AssetsFileHelperDeps {
    getOdeSessionTempDir: typeof getOdeSessionTempDirDefault;
    getProjectAssetsDir: typeof getProjectAssetsDirDefault;
    fileExists: typeof fileExistsDefault;
    readFile: typeof readFileDefault;
    writeFile: typeof writeFileDefault;
    remove: typeof removeDefault;
    getStats: typeof getStatsDefault;
    listFiles: typeof listFilesDefault;
    generateUniqueFilename: typeof generateUniqueFilenameDefault;
}

/**
 * Session manager dependencies for assets routes
 */
export interface AssetsSessionManagerDeps {
    getSession: typeof getSessionDefault;
}

/**
 * Priority queue dependencies for assets routes
 */
export interface AssetsPriorityQueueDeps {
    shouldPreempt: (projectId: string, clientId: string) => { shouldPreempt: boolean; reason?: string };
    getStats: (projectId: string) => { queueLength: number; processingCount: number; completedCount: number };
}

/**
 * Dependencies for assets routes
 */
export interface AssetsDependencies {
    db: Kysely<Database>;
    queries: AssetsQueries;
    fileHelper?: AssetsFileHelperDeps;
    sessionManager?: AssetsSessionManagerDeps;
    priorityQueue?: AssetsPriorityQueueDeps;
}

/**
 * Default file helper dependencies
 */
const defaultFileHelper: AssetsFileHelperDeps = {
    getOdeSessionTempDir: getOdeSessionTempDirDefault,
    getProjectAssetsDir: getProjectAssetsDirDefault,
    fileExists: fileExistsDefault,
    readFile: readFileDefault,
    writeFile: writeFileDefault,
    remove: removeDefault,
    getStats: getStatsDefault,
    listFiles: listFilesDefault,
    generateUniqueFilename: generateUniqueFilenameDefault,
};

/**
 * Default session manager dependencies
 */
const defaultSessionManager: AssetsSessionManagerDeps = {
    getSession: getSessionDefault,
};

/**
 * Default priority queue dependencies
 */
const defaultPriorityQueue: AssetsPriorityQueueDeps = {
    shouldPreempt: serverPriorityQueueDefault.shouldPreempt.bind(serverPriorityQueueDefault),
    getStats: serverPriorityQueueDefault.getStats.bind(serverPriorityQueueDefault),
};

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: AssetsDependencies = {
    db,
    queries: {
        createAsset,
        createAssets,
        findAssetById,
        findAllAssetsForProject,
        findAssetByClientId,
        findAssetsByClientIds,
        deleteAsset: dbDeleteAsset,
        updateAsset,
        bulkUpdateAssets,
        findProjectByUuid,
    },
    fileHelper: defaultFileHelper,
    sessionManager: defaultSessionManager,
    priorityQueue: defaultPriorityQueue,
};

// In-memory storage for chunked uploads
const chunkUploads = new Map<
    string,
    {
        projectId: string;
        filename: string;
        totalChunks: number;
        uploadedChunks: Set<number>;
        chunkDir: string;
        createdAt: Date;
        initialized: boolean; // Flag to track if directory has been created
    }
>();

/**
 * Factory function to create assets routes with injected dependencies
 */
export function createAssetsRoutes(deps: AssetsDependencies = defaultDependencies) {
    const { db: database, queries } = deps;

    // Variable shadowing for file-helper functions
    const {
        getOdeSessionTempDir: _getOdeSessionTempDir, // Kept for DI interface, unused for asset storage
        getProjectAssetsDir,
        fileExists,
        readFile,
        writeFile,
        remove,
        getStats,
        generateUniqueFilename,
    } = deps.fileHelper ?? defaultFileHelper;

    // Variable shadowing for session-manager functions
    // Note: getSession is kept for DI interface but no longer used for asset storage decisions
    const { getSession: _getSession } = deps.sessionManager ?? defaultSessionManager;

    // Variable shadowing for priority queue
    const serverPriorityQueue = deps.priorityQueue ?? defaultPriorityQueue;

    /**
     * Helper to get numeric project ID from UUID or numeric string
     * @param projectIdOrUuid - Project UUID or numeric ID string
     * @returns Numeric project ID or null if not found
     */
    async function getNumericProjectId(projectIdOrUuid: string): Promise<number | null> {
        // Check if it's already a numeric ID (must be digits only to avoid UUID prefix collisions)
        if (/^\d+$/.test(projectIdOrUuid)) {
            const numericId = parseInt(projectIdOrUuid, 10);
            return numericId;
        }

        // It's a UUID - look up the project
        const project = await queries.findProjectByUuid(database, projectIdOrUuid);
        return project?.id ?? null;
    }

    return (
        new Elysia({ prefix: '/api/projects/:projectId/assets' })

            // =====================================================
            // Upload Asset (simple)
            // =====================================================

            // POST /api/projects/:projectId/assets - Upload asset
            .post('/', async ({ params, body, query, set }) => {
                try {
                    const { projectId } = params;
                    const data = body as AssetUploadRequest;

                    // Get numeric project ID (handles both UUID and numeric strings)
                    const projectIdNum = await getNumericProjectId(projectId);
                    if (projectIdNum === null) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!data.file) {
                        set.status = 400;
                        return { success: false, error: 'No file uploaded' };
                    }

                    const file = data.file;
                    const componentId = data.componentId;
                    // Support clientId from form body OR query parameter (bulk upload uses query param)
                    const clientId = data.clientId || (query as { clientId?: string }).clientId || uuidv4();
                    const folderPath = sanitizeFolderPath(data.folderPath);

                    // Get file data
                    let fileBuffer: Buffer;
                    let filename: string;
                    let mimetype: string;

                    if (file instanceof Blob) {
                        fileBuffer = Buffer.from(await file.arrayBuffer());
                        filename = (file as FileWithName).name || 'uploaded_file';
                        mimetype = file.type || 'application/octet-stream';
                    } else if (Buffer.isBuffer(file)) {
                        fileBuffer = file;
                        filename = data.filename || 'uploaded_file';
                        mimetype = data.mimetype || 'application/octet-stream';
                    } else {
                        fileBuffer = Buffer.from(file);
                        filename = data.filename || 'uploaded_file';
                        mimetype = data.mimetype || 'application/octet-stream';
                    }

                    // Flat UUID-based storage: assets/{projectUuid}/{clientId}.{ext}
                    // No folder hierarchy on disk - folderPath is only stored in database for UI/export
                    const baseStoragePath = getProjectAssetsDir(projectId);
                    await fs.ensureDir(baseStoragePath);

                    // Use clientId as filename with original extension
                    const ext = path.extname(filename).toLowerCase();
                    const flatFilename = `${clientId}${ext}`;
                    const filePath = path.join(baseStoragePath, flatFilename);

                    // Write file using Bun.write for optimal performance
                    if (typeof Bun !== 'undefined' && Bun.write) {
                        await Bun.write(filePath, fileBuffer);
                    } else {
                        await writeFile(filePath, fileBuffer);
                    }

                    // Check for existing asset with same clientId + projectId (idempotent upload)
                    // This can happen during bulk upload when 2nd client joins collaborative session
                    const existingAsset = await queries.findAssetByClientId(database, clientId, projectIdNum);

                    if (existingAsset) {
                        // Asset already exists - update it (idempotent)
                        const updatedAsset = await queries.updateAsset(database, existingAsset.id, {
                            filename: filename,
                            storage_path: filePath,
                            mime_type: mimetype,
                            file_size: String(fileBuffer.length),
                            folder_path: folderPath,
                        });

                        return {
                            success: true,
                            data: serializeAsset(updatedAsset!),
                        };
                    }

                    // Create new asset record
                    const asset = await queries.createAsset(database, {
                        project_id: projectIdNum,
                        filename: filename,
                        storage_path: filePath,
                        mime_type: mimetype,
                        file_size: String(fileBuffer.length),
                        component_id: componentId || null,
                        client_id: clientId,
                        folder_path: folderPath,
                    });

                    return {
                        success: true,
                        data: serializeAsset(asset),
                    };
                } catch (error: unknown) {
                    set.status = 500;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return { success: false, error: errorMessage };
                }
            })

            // =====================================================
            // Chunked Upload (Resumable.js compatible)
            // =====================================================

            // GET /upload-chunk - Check if chunk exists
            .get('/upload-chunk', async ({ params, query, set }) => {
                const { projectId } = params;
                const identifier = query.resumableIdentifier as string;
                const chunkNumber = parseInt(query.resumableChunkNumber as string, 10);

                if (!identifier || !chunkNumber) {
                    set.status = 400;
                    return { success: false, error: 'Missing required parameters' };
                }

                const upload = chunkUploads.get(`${projectId}:${identifier}`);
                if (upload?.uploadedChunks.has(chunkNumber)) {
                    // Chunk exists, skip upload
                    set.status = 200;
                    return { exists: true };
                }

                // Chunk doesn't exist, proceed with upload
                set.status = 204;
                return;
            })

            // POST /upload-chunk - Upload a chunk
            .post('/upload-chunk', async ({ params, body, set }) => {
                try {
                    const { projectId } = params;
                    const data = body as AssetUploadRequest;

                    const identifier = data.resumableIdentifier;
                    const chunkNumber = parseInt(data.resumableChunkNumber, 10);
                    const totalChunks = parseInt(data.resumableTotalChunks, 10);
                    const filename = data.resumableFilename;
                    const chunk = data.file;

                    if (!identifier || !chunkNumber || !chunk) {
                        set.status = 400;
                        return { success: false, error: 'Missing required parameters' };
                    }

                    const uploadKey = `${projectId}:${identifier}`;

                    // Initialize upload tracking SYNCHRONOUSLY to prevent race condition
                    // When multiple chunks arrive concurrently, we must set the Map entry
                    // BEFORE any async operation, otherwise multiple chunks enter the if block
                    // and overwrite each other's uploadedChunks Set
                    if (!chunkUploads.has(uploadKey)) {
                        const chunkDir = path.join(process.cwd(), 'data', 'chunks', projectId, identifier);
                        chunkUploads.set(uploadKey, {
                            projectId,
                            filename,
                            totalChunks,
                            uploadedChunks: new Set(),
                            chunkDir,
                            createdAt: new Date(),
                            initialized: false, // Directory not created yet
                        });
                    }

                    const upload = chunkUploads.get(uploadKey)!;

                    // Ensure directory exists (only once per upload)
                    if (!upload.initialized) {
                        await fs.ensureDir(upload.chunkDir);
                        upload.initialized = true;
                    }

                    // Get chunk buffer
                    let chunkBuffer: Buffer;
                    if (chunk instanceof Blob) {
                        chunkBuffer = Buffer.from(await chunk.arrayBuffer());
                    } else if (Buffer.isBuffer(chunk)) {
                        chunkBuffer = chunk;
                    } else {
                        chunkBuffer = Buffer.from(chunk);
                    }

                    // Write chunk to disk using Bun.write for optimal performance
                    const chunkPath = path.join(upload.chunkDir, `chunk_${chunkNumber}`);
                    if (typeof Bun !== 'undefined' && Bun.write) {
                        await Bun.write(chunkPath, chunkBuffer);
                    } else {
                        await writeFile(chunkPath, chunkBuffer);
                    }

                    // Mark chunk as uploaded
                    upload.uploadedChunks.add(chunkNumber);

                    // Check if all chunks uploaded
                    const allUploaded = upload.uploadedChunks.size === upload.totalChunks;

                    return {
                        success: true,
                        chunkNumber,
                        allUploaded,
                        uploadedChunks: upload.uploadedChunks.size,
                        totalChunks: upload.totalChunks,
                    };
                } catch (error: unknown) {
                    set.status = 500;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return { success: false, error: errorMessage };
                }
            })

            // POST /upload-chunk/finalize - Finalize chunked upload
            .post('/upload-chunk/finalize', async ({ params, body, set }) => {
                try {
                    const { projectId } = params;
                    const data = body as AssetUploadRequest;
                    const identifier = data.resumableIdentifier || data.identifier;
                    const componentId = data.componentId;
                    const clientId = data.clientId || uuidv4();

                    const uploadKey = `${projectId}:${identifier}`;
                    const upload = chunkUploads.get(uploadKey);

                    if (!upload) {
                        set.status = 404;
                        return { success: false, error: 'Upload not found' };
                    }

                    // Verify all chunks present
                    if (upload.uploadedChunks.size !== upload.totalChunks) {
                        set.status = 400;
                        return {
                            success: false,
                            error: `Missing chunks: ${upload.uploadedChunks.size}/${upload.totalChunks}`,
                        };
                    }

                    // Get numeric project ID (handles both UUID and numeric strings)
                    const projectIdNum = await getNumericProjectId(projectId);
                    if (projectIdNum === null) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    // Flat UUID-based storage: assets/{projectUuid}/{clientId}.{ext}
                    const storagePath = getProjectAssetsDir(projectId);
                    await fs.ensureDir(storagePath);

                    // Use clientId as filename with original extension
                    const ext = path.extname(upload.filename).toLowerCase();
                    const flatFilename = `${clientId}${ext}`;
                    const finalPath = path.join(storagePath, flatFilename);

                    // Write combined file with parallel chunk reads
                    const writeStream = fs.createWriteStream(finalPath);
                    const PARALLEL_CHUNK_READS = 8; // Read 8 chunks in parallel

                    for (let batchStart = 1; batchStart <= upload.totalChunks; batchStart += PARALLEL_CHUNK_READS) {
                        const batchEnd = Math.min(batchStart + PARALLEL_CHUNK_READS - 1, upload.totalChunks);

                        // Read batch of chunks in parallel using Bun.file for optimal performance
                        const chunkPromises: Promise<{ index: number; data: Buffer }>[] = [];
                        for (let i = batchStart; i <= batchEnd; i++) {
                            const chunkPath = path.join(upload.chunkDir, `chunk_${i}`);
                            chunkPromises.push(
                                (typeof Bun !== 'undefined'
                                    ? Bun.file(chunkPath)
                                          .arrayBuffer()
                                          .then(ab => Buffer.from(ab))
                                    : readFile(chunkPath)
                                ).then(data => ({ index: i, data })),
                            );
                        }

                        const chunks = await Promise.all(chunkPromises);

                        // Write chunks in order (they may have resolved out of order)
                        chunks.sort((a, b) => a.index - b.index);
                        for (const chunk of chunks) {
                            writeStream.write(chunk.data);
                        }
                    }
                    writeStream.end();

                    // Wait for write to complete
                    await new Promise((resolve, reject) => {
                        writeStream.on('finish', resolve);
                        writeStream.on('error', reject);
                    });

                    // Get file stats
                    const stats = await getStats(finalPath);
                    const mimetype = mimeTypes.lookup(upload.filename) || 'application/octet-stream';

                    // Check if asset already exists (for retries/re-uploads)
                    const existingAsset = await queries.findAssetByClientId(database, clientId, projectIdNum);

                    let asset: Asset | undefined;
                    if (existingAsset) {
                        // Update existing asset
                        asset = await queries.updateAsset(database, existingAsset.id, {
                            filename: upload.filename,
                            storage_path: finalPath,
                            mime_type: mimetype as string,
                            file_size: String(stats?.size || 0),
                            component_id: componentId || null,
                        });
                        // Fallback to existing asset if update doesn't return the record
                        if (!asset) {
                            asset = { ...existingAsset, storage_path: finalPath, file_size: String(stats?.size || 0) };
                        }
                    } else {
                        // Create new asset record
                        asset = await queries.createAsset(database, {
                            project_id: projectIdNum,
                            filename: upload.filename,
                            storage_path: finalPath,
                            mime_type: mimetype as string,
                            file_size: String(stats?.size || 0),
                            component_id: componentId || null,
                            client_id: clientId,
                        });
                    }

                    // Cleanup chunks
                    await fs.remove(upload.chunkDir);
                    chunkUploads.delete(uploadKey);

                    return {
                        success: true,
                        complete: true,
                        data: asset ? serializeAsset(asset) : { clientId, filename: upload.filename },
                    };
                } catch (error: unknown) {
                    set.status = 500;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return { success: false, error: errorMessage };
                }
            })

            // DELETE /upload-chunk/:identifier - Cancel chunked upload
            .delete('/upload-chunk/:identifier', async ({ params }) => {
                const { projectId, identifier } = params;
                const uploadKey = `${projectId}:${identifier}`;

                const upload = chunkUploads.get(uploadKey);
                if (upload) {
                    await fs.remove(upload.chunkDir).catch(() => {});
                    chunkUploads.delete(uploadKey);
                }

                return { success: true, message: 'Upload cancelled' };
            })

            // =====================================================
            // List & Get Assets
            // =====================================================

            // GET / - List project assets
            .get('/', async ({ params }) => {
                const { projectId } = params;

                // Get numeric project ID (handles both UUID and numeric strings)
                const projectIdNum = await getNumericProjectId(projectId);
                if (projectIdNum === null) {
                    return {
                        success: true,
                        data: [],
                    };
                }

                const assets = await queries.findAllAssetsForProject(database, projectIdNum);
                return {
                    success: true,
                    data: assets.map(serializeAsset),
                };
            })

            // GET /by-client-id/:clientId - Download asset by client ID (returns file blob)
            .get('/by-client-id/:clientId', async ({ params, set }) => {
                const { projectId, clientId } = params;

                // Get numeric project ID (handles both UUID and numeric strings)
                const projectIdNum = await getNumericProjectId(projectId);

                const asset = await queries.findAssetByClientId(database, clientId, projectIdNum ?? undefined);
                if (!asset) {
                    set.status = 404;
                    return { success: false, error: 'Asset not found' };
                }

                // Check if file exists
                if (!(await fileExists(asset.storage_path))) {
                    set.status = 404;
                    return { success: false, error: 'Asset file not found on disk' };
                }

                // Return file blob with metadata headers for collaborative sync
                const fileBuffer = await readFile(asset.storage_path);
                set.headers['content-type'] = asset.mime_type || 'application/octet-stream';
                set.headers['content-disposition'] = `attachment; filename="${asset.filename}"`;
                // Add metadata headers for AssetWebSocketHandler prefetch
                set.headers['x-original-mime'] = asset.mime_type || 'application/octet-stream';
                set.headers['x-filename'] = asset.filename;
                set.headers['x-folder-path'] = asset.folder_path || '';
                set.headers['x-file-size'] = asset.file_size || '0';
                return fileBuffer;
            })

            // GET /:assetId - Get/Download asset
            .get('/:assetId', async ({ params, set }) => {
                const assetId = parseInt(params.assetId, 10);

                if (isNaN(assetId)) {
                    set.status = 400;
                    return { success: false, error: 'Invalid asset ID' };
                }

                const asset = await queries.findAssetById(database, assetId);
                if (!asset) {
                    set.status = 404;
                    return { success: false, error: 'Asset not found' };
                }

                // Check if file exists
                if (!(await fileExists(asset.storage_path))) {
                    set.status = 404;
                    return { success: false, error: 'Asset file not found' };
                }

                // Return file
                const fileBuffer = await readFile(asset.storage_path);
                set.headers['content-type'] = asset.mime_type || 'application/octet-stream';
                set.headers['content-disposition'] = `attachment; filename="${asset.filename}"`;
                return fileBuffer;
            })

            // GET /:assetId/metadata - Get asset metadata
            .get('/:assetId/metadata', async ({ params, set }) => {
                const assetId = parseInt(params.assetId, 10);

                if (isNaN(assetId)) {
                    set.status = 400;
                    return { success: false, error: 'Invalid asset ID' };
                }

                const asset = await queries.findAssetById(database, assetId);
                if (!asset) {
                    set.status = 404;
                    return { success: false, error: 'Asset not found' };
                }

                return {
                    success: true,
                    data: serializeAsset(asset),
                };
            })

            // DELETE /by-client-id/:clientId - Delete asset by client ID (UUID)
            // Used by client-side AssetManager when deleting assets
            .delete('/by-client-id/:clientId', async ({ params, set }) => {
                const { projectId, clientId } = params;

                const projectIdNum = await getNumericProjectId(projectId);
                if (projectIdNum === null) {
                    set.status = 404;
                    return { success: false, error: 'Project not found' };
                }

                const asset = await queries.findAssetByClientId(database, clientId, projectIdNum);
                if (!asset) {
                    // Asset not on server - that's OK, just return success
                    // (asset may have been deleted locally but never uploaded)
                    return { success: true, message: 'Asset not found on server' };
                }

                // Delete file from disk
                await remove(asset.storage_path).catch(() => {});

                // Delete database record
                await queries.deleteAsset(database, asset.id);

                return { success: true, message: 'Asset deleted' };
            })

            // DELETE /bulk - Delete multiple assets by client IDs
            // Used for efficient folder deletion (single HTTP request instead of N)
            .delete('/bulk', async ({ params, body, set }) => {
                const { projectId } = params;
                const { clientIds } = (body || {}) as { clientIds?: string[] };

                if (!clientIds || clientIds.length === 0) {
                    return { success: true, deleted: 0 };
                }

                const projectIdNum = await getNumericProjectId(projectId);
                if (projectIdNum === null) {
                    set.status = 404;
                    return { success: false, error: 'Project not found' };
                }

                const assets = await queries.findAssetsByClientIds(database, clientIds, projectIdNum);

                // Delete files and database records
                for (const asset of assets) {
                    await remove(asset.storage_path).catch(() => {});
                    await queries.deleteAsset(database, asset.id);
                }

                return { success: true, deleted: assets.length };
            })

            // DELETE /:assetId - Delete asset by numeric ID (legacy)
            .delete('/:assetId', async ({ params, set }) => {
                const assetId = parseInt(params.assetId, 10);

                if (isNaN(assetId)) {
                    set.status = 400;
                    return { success: false, error: 'Invalid asset ID' };
                }

                const asset = await queries.findAssetById(database, assetId);
                if (!asset) {
                    set.status = 404;
                    return { success: false, error: 'Asset not found' };
                }

                // Delete file
                await remove(asset.storage_path).catch(() => {});

                // Delete record
                await queries.deleteAsset(database, assetId);

                return { success: true, message: 'Asset deleted' };
            })

            // GET /storage-usage - Get storage usage for project
            .get('/storage-usage', async ({ params }) => {
                const { projectId } = params;

                // Get numeric project ID (handles both UUID and numeric strings)
                const projectIdNum = await getNumericProjectId(projectId);
                if (projectIdNum === null) {
                    return {
                        success: true,
                        data: { totalAssets: 0, totalSize: 0, totalSizeMB: '0.00' },
                    };
                }

                const assets = await queries.findAllAssetsForProject(database, projectIdNum);
                const totalSize = assets.reduce((sum, a) => sum + parseInt(a.file_size || '0', 10), 0);

                return {
                    success: true,
                    data: {
                        totalAssets: assets.length,
                        totalSize,
                        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                    },
                };
            })

            // =====================================================
            // Batch Asset Sync (for SaveManager)
            // =====================================================

            // POST /sync - Upload batch of assets with metadata
            .post('/sync', async ({ params, body, set }) => {
                try {
                    const { projectId } = params;
                    const data = body as AssetUploadRequest;

                    // Get numeric project ID (handles both UUID and numeric strings)
                    const projectIdNum = await getNumericProjectId(projectId);
                    if (projectIdNum === null) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    // Parse metadata from JSON string
                    let metadata: Array<{
                        clientId: string;
                        filename: string;
                        mimeType: string;
                        contentHash?: string;
                        folderPath?: string;
                    }> = [];

                    if (typeof data.metadata === 'string') {
                        try {
                            metadata = JSON.parse(data.metadata);
                        } catch {
                            set.status = 400;
                            return { success: false, error: 'Invalid metadata JSON' };
                        }
                    } else if (Array.isArray(data.metadata)) {
                        metadata = data.metadata;
                    }

                    // Get files from FormData
                    let files: (Blob | Buffer)[] = [];
                    if (data.files) {
                        files = Array.isArray(data.files) ? data.files : [data.files];
                    }

                    // Get base storage path using project UUID
                    const baseStoragePath = getProjectAssetsDir(projectId);

                    await fs.ensureDir(baseStoragePath);

                    // =====================================================
                    // PHASE 1: Convert all files to buffers in parallel
                    // =====================================================
                    const fileDataPromises = files.map(async (file, i) => {
                        const fileMeta = metadata[i] || { clientId: `file-${i}`, filename: 'unknown' };
                        let fileBuffer: Buffer;
                        let filename = fileMeta.filename || 'uploaded_file';
                        let mimeType = fileMeta.mimeType || 'application/octet-stream';
                        const folderPath = sanitizeFolderPath(fileMeta.folderPath);

                        if (file instanceof Blob) {
                            fileBuffer = Buffer.from(await file.arrayBuffer());
                            if ((file as FileWithName).name) filename = (file as FileWithName).name;
                            if (file.type) mimeType = file.type;
                        } else if (Buffer.isBuffer(file)) {
                            fileBuffer = file;
                        } else {
                            fileBuffer = Buffer.from(file);
                        }

                        // Flat UUID-based storage: assets/{projectUuid}/{clientId}.{ext}
                        // folderPath is only stored in database for UI/export, not on disk

                        // Use clientId as filename with original extension
                        const ext = path.extname(filename).toLowerCase();
                        const flatFilename = `${fileMeta.clientId}${ext}`;
                        const filePath = path.join(baseStoragePath, flatFilename);

                        return {
                            clientId: fileMeta.clientId,
                            filename,
                            mimeType,
                            folderPath,
                            fileBuffer,
                            filePath,
                            flatFilename,
                        };
                    });

                    const fileData = await Promise.all(fileDataPromises);

                    // =====================================================
                    // PHASE 2: Write all files to disk in parallel (Bun.write)
                    // =====================================================
                    const writeResults = await Promise.allSettled(
                        fileData.map(({ filePath, fileBuffer }) =>
                            typeof Bun !== 'undefined' && Bun.write
                                ? Bun.write(filePath, fileBuffer)
                                : fs.writeFile(filePath, fileBuffer),
                        ),
                    );

                    // Track which files failed to write
                    const failedWrites = new Set<number>();
                    writeResults.forEach((result, idx) => {
                        if (result.status === 'rejected') {
                            failedWrites.add(idx);
                        }
                    });

                    // =====================================================
                    // PHASE 3: Bulk lookup existing assets (1 query)
                    // =====================================================
                    const clientIds = fileData.filter((_, idx) => !failedWrites.has(idx)).map(f => f.clientId);

                    const existingAssets = await queries.findAssetsByClientIds(database, clientIds, projectIdNum);
                    const existingMap = new Map(existingAssets.map(a => [a.client_id, a]));

                    // =====================================================
                    // PHASE 4: Separate new vs existing assets
                    // =====================================================
                    const toCreate: Array<{
                        project_id: number;
                        filename: string;
                        storage_path: string;
                        mime_type: string;
                        file_size: string;
                        component_id: null;
                        client_id: string;
                        folder_path: string;
                    }> = [];
                    const toUpdate: Array<{
                        id: number;
                        data: { storage_path: string; file_size: string; folder_path: string };
                    }> = [];
                    const results: Array<{
                        clientId: string;
                        success: boolean;
                        serverId?: number;
                        error?: string;
                    }> = [];

                    for (let i = 0; i < fileData.length; i++) {
                        const data = fileData[i];

                        // Check if file write failed
                        if (failedWrites.has(i)) {
                            const writeError = writeResults[i] as PromiseRejectedResult;
                            results.push({
                                clientId: data.clientId,
                                success: false,
                                error: writeError.reason?.message || 'File write failed',
                            });
                            continue;
                        }

                        const existing = existingMap.get(data.clientId);
                        if (existing) {
                            toUpdate.push({
                                id: existing.id,
                                data: {
                                    storage_path: data.filePath,
                                    file_size: String(data.fileBuffer.length),
                                    folder_path: data.folderPath,
                                },
                            });
                            results.push({
                                clientId: data.clientId,
                                success: true,
                                serverId: existing.id,
                            });
                        } else {
                            toCreate.push({
                                project_id: projectIdNum,
                                filename: data.filename,
                                storage_path: data.filePath,
                                mime_type: data.mimeType,
                                file_size: String(data.fileBuffer.length),
                                component_id: null,
                                client_id: data.clientId,
                                folder_path: data.folderPath,
                            });
                        }
                    }

                    // =====================================================
                    // PHASE 5: Bulk database operations
                    // =====================================================
                    // Bulk insert new assets
                    if (toCreate.length > 0) {
                        const created = await queries.createAssets(database, toCreate);
                        // Map created assets to results
                        const createdMap = new Map(created.map(a => [a.client_id, a.id]));
                        for (const asset of toCreate) {
                            const serverId = createdMap.get(asset.client_id);
                            const resultIdx = results.findIndex(
                                r => r.clientId === asset.client_id && r.serverId === undefined,
                            );
                            if (resultIdx === -1) {
                                results.push({
                                    clientId: asset.client_id,
                                    success: true,
                                    serverId,
                                });
                            }
                        }
                    }

                    // Bulk update existing assets (parallel)
                    if (toUpdate.length > 0) {
                        await queries.bulkUpdateAssets(database, toUpdate);
                    }

                    const successCount = results.filter(r => r.success).length;
                    const failCount = results.filter(r => !r.success).length;

                    return {
                        success: failCount === 0,
                        uploaded: successCount,
                        failed: failCount,
                        results,
                    };
                } catch (error: unknown) {
                    set.status = 500;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return { success: false, error: errorMessage };
                }
            })

            // =====================================================
            // Streaming Upload (Bun-optimized)
            // =====================================================

            // POST /stream - Stream upload directly to disk (optimal for large files)
            .post('/stream', async ({ params, request, set }) => {
                try {
                    const { projectId } = params;

                    // Get numeric project ID (handles both UUID and numeric strings)
                    const projectIdNum = await getNumericProjectId(projectId);
                    if (projectIdNum === null) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    const clientId = request.headers.get('x-client-id') || uuidv4();
                    const filename = request.headers.get('x-filename') || 'uploaded_file';
                    const priority = parseInt(request.headers.get('x-priority') || '0', 10);
                    const contentType = request.headers.get('content-type') || 'application/octet-stream';
                    const folderPath = sanitizeFolderPath(request.headers.get('x-folder-path'));

                    // Check if should be preempted (for priority queue integration)
                    if (priority > 0) {
                        const preemptResult = serverPriorityQueue.shouldPreempt(projectId, clientId);
                        if (preemptResult.shouldPreempt) {
                            set.status = 503;
                            set.headers['retry-after'] = '1';
                            return {
                                success: false,
                                error: 'preempted',
                                reason: preemptResult.reason,
                                retryAfter: 1000,
                            };
                        }
                    }

                    // Flat UUID-based storage: assets/{projectUuid}/{clientId}.{ext}
                    const baseStoragePath = getProjectAssetsDir(projectId);
                    await fs.ensureDir(baseStoragePath);

                    // Use clientId as filename with original extension
                    const ext = path.extname(filename).toLowerCase();
                    const flatFilename = `${clientId}${ext}`;
                    const filePath = path.join(baseStoragePath, flatFilename);

                    // Stream body directly to disk
                    const body = request.body;
                    if (!body) {
                        set.status = 400;
                        return { success: false, error: 'No body provided' };
                    }

                    // Use Bun's native streaming for optimal performance
                    if (typeof Bun !== 'undefined' && Bun.write) {
                        await Bun.write(filePath, body);
                    } else {
                        // Fallback for non-Bun environments
                        const chunks: Buffer[] = [];
                        const reader = body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(Buffer.from(value));
                        }
                        await writeFile(filePath, Buffer.concat(chunks));
                    }

                    // Get file stats
                    let fileSize = 0;
                    if (typeof Bun !== 'undefined') {
                        const file = Bun.file(filePath);
                        fileSize = file.size;
                    } else {
                        const stats = await getStats(filePath);
                        fileSize = stats?.size || 0;
                    }

                    // Create asset record with folder_path
                    const asset = await queries.createAsset(database, {
                        project_id: projectIdNum,
                        filename,
                        storage_path: filePath,
                        mime_type: contentType,
                        file_size: String(fileSize),
                        component_id: null,
                        client_id: clientId,
                        folder_path: folderPath,
                    });

                    return {
                        success: true,
                        data: serializeAsset(asset),
                    };
                } catch (error: unknown) {
                    set.status = 500;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    return { success: false, error: errorMessage };
                }
            })

            // =====================================================
            // Priority Queue Stats
            // =====================================================

            // GET /priority-stats - Get priority queue statistics
            .get('/priority-stats', async ({ params }) => {
                const { projectId } = params;
                const stats = serverPriorityQueue.getStats(projectId);
                return {
                    success: true,
                    data: stats,
                };
            })
    );
}

/**
 * Assets routes with default (real) dependencies
 */
export const assetsRoutes = createAssetsRoutes();

/**
 * Serialized asset for API response
 */
interface SerializedAsset {
    id: number;
    filename: string;
    mimeType: string | null;
    size: number;
    componentId: string | null;
    clientId: string | null;
    folderPath: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Helper: Serialize asset for API response
 */
function serializeAsset(asset: Asset): SerializedAsset {
    return {
        id: asset.id,
        filename: asset.filename,
        mimeType: asset.mime_type,
        size: parseInt(asset.file_size || '0', 10),
        componentId: asset.component_id,
        clientId: asset.client_id,
        folderPath: asset.folder_path || '',
        createdAt: asset.created_at,
        updatedAt: asset.updated_at,
    };
}

/**
 * Helper: Sanitize folder path to prevent path traversal
 * Returns empty string for root, or sanitized path like "images/icons"
 */
function sanitizeFolderPath(folderPath: string | undefined | null): string {
    if (!folderPath) return '';

    // Remove leading/trailing slashes and normalize
    let sanitized = folderPath.trim().replace(/^\/+|\/+$/g, '');

    // Remove any path traversal attempts
    sanitized = sanitized.replace(/\.\./g, '').replace(/\/+/g, '/');

    // Remove any invalid characters (keep alphanumeric, dash, underscore, dot, slash)
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_./]/g, '_');

    return sanitized;
}
