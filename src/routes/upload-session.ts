/**
 * Upload Session Routes for Elysia
 *
 * Provides optimized batch upload endpoint that bypasses normal auth middleware.
 * Uses session tokens generated via WebSocket for fast validation.
 *
 * Key features:
 * - Session token validation is O(1) - just JWT signature verification
 * - No database lookup for auth (token contains all needed info)
 * - Progress is emitted via WebSocket as files are written
 * - Supports mega-batches (up to 100MB or 200 files)
 */
import { Elysia } from 'elysia';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { Kysely } from 'kysely';

import { db } from '../db/client';
import type { Database } from '../db/types';
import { createAssets, findAssetsByClientIds, bulkUpdateAssets, findProjectByUuid } from '../db/queries';

import { getProjectAssetsDir } from '../services/file-helper';
import {
    uploadSessionManager,
    validateSession,
    emitProgress,
    emitBatchComplete,
    deleteSession,
    MAX_BATCH_BYTES,
    MAX_BATCH_FILES,
} from '../services/upload-session-manager';

/**
 * File with optional name property (for Blob/File uploads)
 */
interface FileWithName extends Blob {
    name?: string;
}

/**
 * Metadata entry from client
 */
interface MetadataEntry {
    clientId: string;
    filename: string;
    mimeType: string;
    folderPath?: string;
}

/**
 * Dependencies for upload session routes
 */
export interface UploadSessionDependencies {
    db: Kysely<Database>;
    queries: {
        createAssets: typeof createAssets;
        findAssetsByClientIds: typeof findAssetsByClientIds;
        bulkUpdateAssets: typeof bulkUpdateAssets;
        findProjectByUuid: typeof findProjectByUuid;
    };
}

const defaultDeps: UploadSessionDependencies = {
    db,
    queries: {
        createAssets,
        findAssetsByClientIds,
        bulkUpdateAssets,
        findProjectByUuid,
    },
};

/**
 * Sanitize folder path to prevent path traversal
 */
function sanitizeFolderPath(folderPath: string | undefined | null): string {
    if (!folderPath) return '';

    let sanitized = folderPath.trim().replace(/^\/+|\/+$/g, '');
    sanitized = sanitized.replace(/\.\./g, '').replace(/\/+/g, '/');
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_./]/g, '_');

    return sanitized;
}

/**
 * Factory function to create upload session routes
 */
export function createUploadSessionRoutes(deps: UploadSessionDependencies = defaultDeps) {
    const { db: database, queries } = deps;

    return (
        new Elysia({ prefix: '/api/upload-session' })
            // =====================================================
            // Mega-batch Upload (Session Token Auth)
            // =====================================================

            // POST /api/upload-session/:token/batch - Upload batch with session token
            // NO AUTH MIDDLEWARE - validates session token instead
            .post('/:token/batch', async ({ params, body, request, set }) => {
                const { token } = params;

                // Validate session token (O(1) - just JWT verification)
                const session = await validateSession(token);
                if (!session) {
                    set.status = 401;
                    return { success: false, error: 'Invalid or expired session token' };
                }

                // Also verify header token matches (defense in depth)
                const headerToken = request.headers.get('x-upload-session');
                if (headerToken && headerToken !== token) {
                    set.status = 401;
                    return { success: false, error: 'Token mismatch' };
                }

                try {
                    const data = body as {
                        metadata?: string | MetadataEntry[];
                        files?: Blob | Blob[];
                    };

                    // Parse metadata from JSON string
                    let metadata: MetadataEntry[] = [];
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

                    if (files.length === 0) {
                        set.status = 400;
                        return { success: false, error: 'No files provided' };
                    }

                    // Validate batch size
                    if (files.length > MAX_BATCH_FILES) {
                        set.status = 400;
                        return {
                            success: false,
                            error: `Too many files. Maximum is ${MAX_BATCH_FILES} files per batch.`,
                        };
                    }

                    // Get base storage path using project UUID
                    const baseStoragePath = getProjectAssetsDir(session.projectId);
                    await fs.ensureDir(baseStoragePath);

                    // =====================================================
                    // PHASE 1: Convert all files to buffers in parallel
                    // Emit progress for each file as we process it
                    // =====================================================
                    const fileDataPromises = files.map(async (file, i) => {
                        const fileMeta = metadata[i] || {
                            clientId: `file-${i}`,
                            filename: 'unknown',
                            mimeType: 'application/octet-stream',
                        };
                        let fileBuffer: Buffer;
                        let filename = fileMeta.filename || 'uploaded_file';
                        let mimeType = fileMeta.mimeType || 'application/octet-stream';
                        const folderPath = sanitizeFolderPath(fileMeta.folderPath);

                        if (file instanceof Blob) {
                            fileBuffer = Buffer.from(await file.arrayBuffer());
                            if ((file as FileWithName).name) filename = (file as FileWithName).name!;
                            if (file.type) mimeType = file.type;
                        } else if (Buffer.isBuffer(file)) {
                            fileBuffer = file;
                        } else {
                            fileBuffer = Buffer.from(file as unknown as ArrayBuffer);
                        }

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

                    // Check total batch size
                    const totalBatchBytes = fileData.reduce((sum, f) => sum + f.fileBuffer.length, 0);
                    if (totalBatchBytes > MAX_BATCH_BYTES) {
                        set.status = 400;
                        return {
                            success: false,
                            error: `Batch too large. Maximum is ${MAX_BATCH_BYTES / (1024 * 1024)}MB per batch.`,
                        };
                    }

                    // =====================================================
                    // PHASE 2: Write all files to disk
                    // Emit progress for each file as it's written
                    // =====================================================
                    const writeResults: Array<{ index: number; success: boolean; error?: string }> = [];

                    for (let i = 0; i < fileData.length; i++) {
                        const data = fileData[i];

                        try {
                            // Emit progress: writing
                            emitProgress(session.sessionId, {
                                clientId: data.clientId,
                                bytesWritten: 0,
                                totalBytes: data.fileBuffer.length,
                                status: 'writing',
                            });

                            // Write file using Bun.write for optimal performance
                            if (typeof Bun !== 'undefined' && Bun.write) {
                                await Bun.write(data.filePath, data.fileBuffer);
                            } else {
                                await fs.writeFile(data.filePath, data.fileBuffer);
                            }

                            // Emit progress: complete
                            emitProgress(session.sessionId, {
                                clientId: data.clientId,
                                bytesWritten: data.fileBuffer.length,
                                totalBytes: data.fileBuffer.length,
                                status: 'complete',
                            });

                            writeResults.push({ index: i, success: true });
                        } catch (err) {
                            const errMsg = err instanceof Error ? err.message : String(err);

                            // Emit progress: error
                            emitProgress(session.sessionId, {
                                clientId: data.clientId,
                                bytesWritten: 0,
                                totalBytes: data.fileBuffer.length,
                                status: 'error',
                                error: errMsg,
                            });

                            writeResults.push({ index: i, success: false, error: errMsg });
                        }
                    }

                    // =====================================================
                    // PHASE 3: Bulk lookup existing assets (1 query)
                    // =====================================================
                    const successfulWrites = writeResults.filter(r => r.success);
                    const clientIds = successfulWrites.map(r => fileData[r.index].clientId);

                    const existingAssets = await queries.findAssetsByClientIds(
                        database,
                        clientIds,
                        session.projectIdNum,
                    );
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

                    // Add failed writes to results
                    for (const result of writeResults) {
                        if (!result.success) {
                            results.push({
                                clientId: fileData[result.index].clientId,
                                success: false,
                                error: result.error,
                            });
                        }
                    }

                    // Process successful writes
                    for (const writeResult of successfulWrites) {
                        const data = fileData[writeResult.index];
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
                                project_id: session.projectIdNum,
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
                        const createdMap = new Map(created.map(a => [a.client_id, a.id]));

                        for (const asset of toCreate) {
                            const serverId = createdMap.get(asset.client_id);
                            results.push({
                                clientId: asset.client_id,
                                success: true,
                                serverId,
                            });
                        }
                    }

                    // Bulk update existing assets
                    if (toUpdate.length > 0) {
                        await queries.bulkUpdateAssets(database, toUpdate);
                    }

                    const successCount = results.filter(r => r.success).length;
                    const failCount = results.filter(r => !r.success).length;

                    // Emit batch complete via WebSocket
                    emitBatchComplete(session.sessionId, {
                        uploaded: successCount,
                        failed: failCount,
                        results,
                    });

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
            // Cancel Upload Session
            // =====================================================

            // DELETE /api/upload-session/:token - Cancel session
            .delete('/:token', async ({ params, set }) => {
                const { token } = params;

                // Validate session token
                const session = await validateSession(token);
                if (!session) {
                    set.status = 401;
                    return { success: false, error: 'Invalid or expired session token' };
                }

                // Delete the session
                deleteSession(session.sessionId);

                return { success: true, message: 'Session cancelled' };
            })

            // =====================================================
            // Get Upload Session Stats (for debugging)
            // =====================================================

            // GET /api/upload-session/stats - Get session manager stats
            .get('/stats', async () => {
                const stats = uploadSessionManager.getStats();
                return {
                    success: true,
                    data: stats,
                };
            })
    );
}

/**
 * Default routes instance
 */
export const uploadSessionRoutes = createUploadSessionRoutes();
