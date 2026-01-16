/**
 * Assets REST API Endpoints
 *
 * CRUD operations for project assets (images, files, media).
 * Assets are stored on disk, metadata in the database, and synced via Y.Doc.
 *
 * Changes are automatically broadcast to WebSocket clients.
 */
import { Elysia, t } from 'elysia';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs-extra';

import { db } from '../../../db/client';
import {
    findProjectByUuid,
    createAsset,
    findAssetById,
    findAllAssetsForProject,
    findAssetByClientId,
    findAssetsByClientIds,
    deleteAsset as dbDeleteAsset,
    updateAsset,
} from '../../../db/queries';
import type { Asset } from '../../../db/types';
import { getProjectAssetsDir, fileExists, readFile, remove } from '../../../services/file-helper';
import { withDocument, setAssetMetadata, deleteAssetMetadata, type AssetMetadata } from '../../../yjs';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    type AuthenticatedUser,
    type ApiErrorResponse,
} from './types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verify user has access to the project (owner or admin)
 */
async function checkProjectAccess(
    uuid: string,
    auth: AuthenticatedUser,
): Promise<{ project: Awaited<ReturnType<typeof findProjectByUuid>>; error?: ApiErrorResponse }> {
    const project = await findProjectByUuid(db, uuid);

    if (!project) {
        return { project: null, error: errorResponse('NOT_FOUND', `Project not found: ${uuid}`) };
    }

    if (project.owner_id !== auth.userId && !isAdmin(auth)) {
        return { project: null, error: errorResponse('FORBIDDEN', 'You do not have access to this project') };
    }

    return { project };
}

/**
 * File with optional name property (for Blob/File uploads)
 */
interface FileWithName extends Blob {
    name?: string;
}

/**
 * Serialize asset for API response
 */
interface SerializedAsset {
    id: number;
    clientId: string | null;
    filename: string;
    mimeType: string | null;
    size: number;
    folderPath: string;
    createdAt: string;
    updatedAt: string;
}

function serializeAsset(asset: Asset): SerializedAsset {
    return {
        id: asset.id,
        clientId: asset.client_id,
        filename: asset.filename,
        mimeType: asset.mime_type,
        size: parseInt(asset.file_size || '0', 10),
        folderPath: asset.folder_path || '',
        createdAt: asset.created_at,
        updatedAt: asset.updated_at,
    };
}

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

// ============================================================================
// SCHEMAS
// ============================================================================

const AssetIdParam = t.Object({
    uuid: t.String(),
    assetId: t.String(),
});

const BulkDeleteBody = t.Object({
    clientIds: t.Array(t.String()),
});

// ============================================================================
// ROUTES
// ============================================================================

export const assetsRoutes = new Elysia({ prefix: '/projects' })
    // -------------------------------------------------------------------------
    // GET /:uuid/assets - List all assets in project
    // -------------------------------------------------------------------------
    .get(
        '/:uuid/assets',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const assets = await findAllAssetsForProject(db, project!.id);
            return successResponse(assets.map(serializeAsset));
        },
        {
            detail: {
                summary: 'List Assets',
                description: 'Get all assets in a project',
                tags: ['Assets'],
            },
        },
    )

    // -------------------------------------------------------------------------
    // POST /:uuid/assets - Upload new asset
    // -------------------------------------------------------------------------
    .post(
        '/:uuid/assets',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            // Extract file from multipart body
            const data = body as { file?: Blob | Buffer; clientId?: string; folderPath?: string };

            if (!data.file) {
                set.status = 400;
                return errorResponse('BAD_REQUEST', 'No file uploaded');
            }

            const file = data.file;
            const clientId = data.clientId || uuidv4();
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
                filename = 'uploaded_file';
                mimetype = 'application/octet-stream';
            } else {
                set.status = 400;
                return errorResponse('BAD_REQUEST', 'Invalid file format');
            }

            // Store file: assets/{projectUuid}/{clientId}.{ext}
            const baseStoragePath = getProjectAssetsDir(params.uuid);
            await fs.ensureDir(baseStoragePath);

            const ext = path.extname(filename).toLowerCase();
            const flatFilename = `${clientId}${ext}`;
            const filePath = path.join(baseStoragePath, flatFilename);

            // Write file
            if (typeof Bun !== 'undefined' && Bun.write) {
                await Bun.write(filePath, fileBuffer);
            } else {
                await fs.writeFile(filePath, fileBuffer);
            }

            // Check for existing asset (idempotent upload)
            const existingAsset = await findAssetByClientId(db, clientId, project!.id);

            let asset: Asset;
            if (existingAsset) {
                // Update existing in DB
                const updatedAsset = await updateAsset(db, existingAsset.id, {
                    filename: filename,
                    storage_path: filePath,
                    mime_type: mimetype,
                    file_size: String(fileBuffer.length),
                    folder_path: folderPath,
                });
                asset = updatedAsset!;
            } else {
                // Create new asset record in DB
                asset = await createAsset(db, {
                    project_id: project!.id,
                    filename: filename,
                    storage_path: filePath,
                    mime_type: mimetype,
                    file_size: String(fileBuffer.length),
                    component_id: null,
                    client_id: clientId,
                    folder_path: folderPath,
                });
            }

            // Update Y.Doc to sync with WebSocket clients
            const assetMetadata: AssetMetadata = {
                filename,
                folderPath,
                mime: mimetype,
                size: fileBuffer.length,
                uploaded: true,
                createdAt: new Date().toISOString(),
            };

            await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                setAssetMetadata(ydoc, clientId, assetMetadata),
            );

            set.status = existingAsset ? 200 : 201;
            return successResponse(serializeAsset(asset));
        },
        {
            detail: {
                summary: 'Upload Asset',
                description: 'Upload a new asset file to the project. Changes are broadcast to WebSocket clients.',
                tags: ['Assets'],
            },
        },
    )

    // -------------------------------------------------------------------------
    // GET /:uuid/assets/:assetId - Download asset file
    // -------------------------------------------------------------------------
    .get(
        '/:uuid/assets/:assetId',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const assetId = parseInt(params.assetId, 10);
            if (isNaN(assetId)) {
                set.status = 400;
                return errorResponse('BAD_REQUEST', 'Invalid asset ID');
            }

            const asset = await findAssetById(db, assetId);
            if (!asset || asset.project_id !== project!.id) {
                set.status = 404;
                return errorResponse('NOT_FOUND', 'Asset not found');
            }

            // Check if file exists
            if (!(await fileExists(asset.storage_path))) {
                set.status = 404;
                return errorResponse('NOT_FOUND', 'Asset file not found on disk');
            }

            // Return file
            const fileBuffer = await readFile(asset.storage_path);
            set.headers['content-type'] = asset.mime_type || 'application/octet-stream';
            set.headers['content-disposition'] = `attachment; filename="${asset.filename}"`;
            return fileBuffer;
        },
        {
            params: AssetIdParam,
            detail: {
                summary: 'Download Asset',
                description: 'Download an asset file by ID',
                tags: ['Assets'],
            },
        },
    )

    // -------------------------------------------------------------------------
    // GET /:uuid/assets/:assetId/metadata - Get asset metadata only
    // -------------------------------------------------------------------------
    .get(
        '/:uuid/assets/:assetId/metadata',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const assetId = parseInt(params.assetId, 10);
            if (isNaN(assetId)) {
                set.status = 400;
                return errorResponse('BAD_REQUEST', 'Invalid asset ID');
            }

            const asset = await findAssetById(db, assetId);
            if (!asset || asset.project_id !== project!.id) {
                set.status = 404;
                return errorResponse('NOT_FOUND', 'Asset not found');
            }

            return successResponse(serializeAsset(asset));
        },
        {
            detail: {
                summary: 'Get Asset Metadata',
                description: 'Get metadata for an asset without downloading the file',
                tags: ['Assets'],
            },
        },
    )

    // -------------------------------------------------------------------------
    // DELETE /:uuid/assets/:assetId - Delete asset
    // -------------------------------------------------------------------------
    .delete(
        '/:uuid/assets/:assetId',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const assetId = parseInt(params.assetId, 10);
            if (isNaN(assetId)) {
                set.status = 400;
                return errorResponse('BAD_REQUEST', 'Invalid asset ID');
            }

            const asset = await findAssetById(db, assetId);
            if (!asset || asset.project_id !== project!.id) {
                set.status = 404;
                return errorResponse('NOT_FOUND', 'Asset not found');
            }

            // Delete file from disk
            await remove(asset.storage_path).catch(() => {});

            // Delete database record
            await dbDeleteAsset(db, assetId);

            // Update Y.Doc to sync with WebSocket clients
            if (asset.client_id) {
                await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc =>
                    deleteAssetMetadata(ydoc, asset.client_id!),
                );
            }

            return successResponse({ message: 'Asset deleted' });
        },
        {
            params: AssetIdParam,
            detail: {
                summary: 'Delete Asset',
                description: 'Delete an asset by ID. Changes are broadcast to WebSocket clients.',
                tags: ['Assets'],
            },
        },
    )

    // -------------------------------------------------------------------------
    // POST /:uuid/assets/bulk-delete - Delete multiple assets
    // -------------------------------------------------------------------------
    .post(
        '/:uuid/assets/bulk-delete',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            const { project, error } = await checkProjectAccess(params.uuid, auth);
            if (error) {
                set.status = error.error.code === 'NOT_FOUND' ? 404 : 403;
                return error;
            }

            const { clientIds } = body as { clientIds: string[] };
            if (!clientIds || clientIds.length === 0) {
                return successResponse({ deleted: 0 });
            }

            const assets = await findAssetsByClientIds(db, clientIds, project!.id);

            // Delete files and database records
            for (const asset of assets) {
                await remove(asset.storage_path).catch(() => {});
                await dbDeleteAsset(db, asset.id);
            }

            // Update Y.Doc to sync with WebSocket clients (all deletions in one transaction)
            if (clientIds.length > 0) {
                await withDocument(params.uuid, { source: 'rest-api', userId: auth.userId }, ydoc => {
                    for (const clientId of clientIds) {
                        deleteAssetMetadata(ydoc, clientId);
                    }
                    return { success: true as const, data: { deleted: clientIds.length } };
                });
            }

            return successResponse({ deleted: assets.length });
        },
        {
            body: BulkDeleteBody,
            detail: {
                summary: 'Bulk Delete Assets',
                description: 'Delete multiple assets by their client IDs. Changes are broadcast to WebSocket clients.',
                tags: ['Assets'],
            },
        },
    );
