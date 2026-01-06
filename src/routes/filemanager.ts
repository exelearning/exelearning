/**
 * File Manager Routes for Elysia
 * Handles folder operations and file organization
 */
import { Elysia, t } from 'elysia';

import { db } from '../db/client';
import type { Database } from '../db/types';
import { findProjectByUuid, findAssetByClientId, updateAsset } from '../db/queries';
import type { Kysely } from 'kysely';

import { createFolderManagerService, type FolderManagerService, type MoveItem } from '../services/folder-manager';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Dependencies for filemanager routes
 */
export interface FileManagerDependencies {
    db: Kysely<Database>;
    folderManager?: FolderManagerService;
    findProjectByUuid: typeof findProjectByUuid;
    findAssetByClientId: typeof findAssetByClientId;
    updateAsset: typeof updateAsset;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: FileManagerDependencies = {
    db,
    findProjectByUuid,
    findAssetByClientId,
    updateAsset,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get numeric project ID from UUID
 */
async function getNumericProjectId(
    database: Kysely<Database>,
    findProject: typeof findProjectByUuid,
    projectIdOrUuid: string,
): Promise<{ id: number; uuid: string } | null> {
    // Check if it's already a numeric ID
    if (/^\d+$/.test(projectIdOrUuid)) {
        // For numeric IDs, we still need to look up the project to get UUID
        // This is a simplified path - in practice, routes use UUID
        return null;
    }

    // It's a UUID - look up the project
    const project = await findProject(database, projectIdOrUuid);
    return project ? { id: project.id, uuid: project.uuid } : null;
}

// ============================================================================
// Route Factory
// ============================================================================

/**
 * Factory function to create filemanager routes with injected dependencies
 */
export function createFileManagerRoutes(deps: FileManagerDependencies = defaultDependencies) {
    const {
        db: database,
        findProjectByUuid: findProject,
        findAssetByClientId: findAsset,
        updateAsset: doUpdateAsset,
    } = deps;

    // Create folder manager service with injected db
    const folderManager = deps.folderManager ?? createFolderManagerService({ db: database });

    return (
        new Elysia({ prefix: '/api/projects/:projectId/filemanager' })

            // =====================================================
            // List Folder Contents
            // =====================================================

            // GET / - List folder contents
            .get(
                '/',
                async ({ params, query, set }) => {
                    const { projectId } = params;
                    const folderPath = (query.path as string) || '';

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    // Validate path
                    if (!folderManager.isValidFolderPath(folderPath)) {
                        set.status = 400;
                        return { success: false, error: 'Invalid folder path' };
                    }

                    const contents = await folderManager.getFolderContents(project.id, folderPath);

                    return {
                        success: true,
                        data: {
                            ...contents,
                            files: contents.files.map(asset => ({
                                id: asset.id,
                                clientId: asset.client_id,
                                filename: asset.filename,
                                mimeType: asset.mime_type,
                                size: parseInt(asset.file_size || '0', 10),
                                folderPath: asset.folder_path,
                                createdAt: asset.created_at,
                                updatedAt: asset.updated_at,
                            })),
                        },
                    };
                },
                {
                    query: t.Object({
                        path: t.Optional(t.String()),
                    }),
                },
            )

            // =====================================================
            // Folder Operations
            // =====================================================

            // POST /folder - Create folder
            .post(
                '/folder',
                async ({ params, body, set }) => {
                    const { projectId } = params;
                    const { path: folderPath } = body as { path: string };

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!folderPath) {
                        set.status = 400;
                        return { success: false, error: 'Folder path is required' };
                    }

                    const result = await folderManager.createFolder(project.id, folderPath);

                    if (!result.success) {
                        set.status = 400;
                        return { success: false, error: result.error };
                    }

                    return { success: true, path: folderPath };
                },
                {
                    body: t.Object({
                        path: t.String(),
                    }),
                },
            )

            // DELETE /folder - Delete folder
            .delete(
                '/folder',
                async ({ params, body, set }) => {
                    const { projectId } = params;
                    const { path: folderPath } = body as { path: string };

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!folderPath) {
                        set.status = 400;
                        return { success: false, error: 'Folder path is required' };
                    }

                    const result = await folderManager.deleteFolder(project.id, folderPath);

                    if (!result.success) {
                        set.status = 400;
                        return { success: false, error: result.error };
                    }

                    return { success: true, deletedCount: result.affectedCount };
                },
                {
                    body: t.Object({
                        path: t.String(),
                    }),
                },
            )

            // PATCH /folder - Rename folder
            .patch(
                '/folder',
                async ({ params, body, set }) => {
                    const { projectId } = params;
                    const { oldPath, newPath } = body as { oldPath: string; newPath: string };

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!oldPath || !newPath) {
                        set.status = 400;
                        return { success: false, error: 'Both oldPath and newPath are required' };
                    }

                    const result = await folderManager.renameFolder(project.id, oldPath, newPath);

                    if (!result.success) {
                        set.status = 400;
                        return { success: false, error: result.error };
                    }

                    return { success: true, updatedCount: result.affectedCount };
                },
                {
                    body: t.Object({
                        oldPath: t.String(),
                        newPath: t.String(),
                    }),
                },
            )

            // =====================================================
            // Move Operations
            // =====================================================

            // POST /move - Move files/folders
            .post(
                '/move',
                async ({ params, body, set }) => {
                    const { projectId } = params;
                    const { items, destination } = body as { items: MoveItem[]; destination: string };

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!items || items.length === 0) {
                        set.status = 400;
                        return { success: false, error: 'Items are required' };
                    }

                    const result = await folderManager.moveAssets(project.id, items, destination);

                    if (!result.success) {
                        set.status = 400;
                        return { success: false, error: result.error };
                    }

                    return { success: true, movedCount: result.affectedCount };
                },
                {
                    body: t.Object({
                        items: t.Array(
                            t.Object({
                                type: t.Union([t.Literal('file'), t.Literal('folder')]),
                                clientId: t.Optional(t.String()),
                                path: t.Optional(t.String()),
                            }),
                        ),
                        destination: t.String(),
                    }),
                },
            )

            // =====================================================
            // File Operations
            // =====================================================

            // POST /duplicate - Duplicate file
            .post(
                '/duplicate',
                async ({ params, body, set }) => {
                    const { projectId } = params;
                    const { assetId } = body as { assetId: number };

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!assetId) {
                        set.status = 400;
                        return { success: false, error: 'Asset ID is required' };
                    }

                    const result = await folderManager.duplicateAsset(project.id, project.uuid, assetId);

                    if (!result.success) {
                        set.status = 400;
                        return { success: false, error: result.error };
                    }

                    const newAsset = result.newAsset!;
                    return {
                        success: true,
                        newAsset: {
                            id: newAsset.id,
                            clientId: newAsset.client_id,
                            filename: newAsset.filename,
                            mimeType: newAsset.mime_type,
                            size: parseInt(newAsset.file_size || '0', 10),
                            folderPath: newAsset.folder_path,
                            createdAt: newAsset.created_at,
                            updatedAt: newAsset.updated_at,
                        },
                    };
                },
                {
                    body: t.Object({
                        assetId: t.Number(),
                    }),
                },
            )

            // PATCH /rename - Rename file
            .patch(
                '/rename',
                async ({ params, body, set }) => {
                    const { projectId } = params;
                    const { clientId, newFilename } = body as { clientId: string; newFilename: string };

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!clientId || !newFilename) {
                        set.status = 400;
                        return { success: false, error: 'Client ID and new filename are required' };
                    }

                    // Validate new filename (use folder name validation since same rules apply)
                    if (!folderManager.isValidFolderName(newFilename)) {
                        set.status = 400;
                        return { success: false, error: 'Invalid filename' };
                    }

                    // Find the asset
                    const asset = await findAsset(database, clientId, project.id);
                    if (!asset) {
                        set.status = 404;
                        return { success: false, error: 'Asset not found' };
                    }

                    // Update filename
                    const updated = await doUpdateAsset(database, asset.id, { filename: newFilename });

                    if (!updated) {
                        set.status = 500;
                        return { success: false, error: 'Failed to update asset' };
                    }

                    return {
                        success: true,
                        asset: {
                            id: updated.id,
                            clientId: updated.client_id,
                            filename: updated.filename,
                            mimeType: updated.mime_type,
                            size: parseInt(updated.file_size || '0', 10),
                            folderPath: updated.folder_path,
                            updatedAt: updated.updated_at,
                        },
                    };
                },
                {
                    body: t.Object({
                        clientId: t.String(),
                        newFilename: t.String(),
                    }),
                },
            )

            // =====================================================
            // ZIP Extraction
            // =====================================================

            // POST /extract-zip - Extract ZIP file
            .post(
                '/extract-zip',
                async ({ params, body, set }) => {
                    const { projectId } = params;
                    const { assetId, targetFolder } = body as { assetId: number; targetFolder: string };

                    const project = await getNumericProjectId(database, findProject, projectId);
                    if (!project) {
                        set.status = 404;
                        return { success: false, error: 'Project not found' };
                    }

                    if (!assetId) {
                        set.status = 400;
                        return { success: false, error: 'Asset ID is required' };
                    }

                    const result = await folderManager.extractZipAsset(
                        project.id,
                        project.uuid,
                        assetId,
                        targetFolder || '',
                    );

                    if (!result.success) {
                        set.status = 400;
                        return { success: false, error: result.error };
                    }

                    return {
                        success: true,
                        extractedCount: result.extractedCount,
                        folders: result.folders,
                        assets: result.assets.map(asset => ({
                            id: asset.id,
                            clientId: asset.client_id,
                            filename: asset.filename,
                            mimeType: asset.mime_type,
                            size: parseInt(asset.file_size || '0', 10),
                            folderPath: asset.folder_path,
                        })),
                    };
                },
                {
                    body: t.Object({
                        assetId: t.Number(),
                        targetFolder: t.Optional(t.String()),
                    }),
                },
            )

            // =====================================================
            // Validation Helpers (for frontend)
            // =====================================================

            // POST /validate-name - Validate folder/file name
            .post(
                '/validate-name',
                async ({ body }) => {
                    const { name } = body as { name: string };
                    const isValid = folderManager.isValidFolderName(name);
                    const sanitized = isValid ? name : folderManager.sanitizeFolderName(name);

                    return {
                        success: true,
                        isValid,
                        sanitized,
                    };
                },
                {
                    body: t.Object({
                        name: t.String(),
                    }),
                },
            )

            // POST /validate-path - Validate folder path
            .post(
                '/validate-path',
                async ({ body }) => {
                    const { path: folderPath } = body as { path: string };
                    const isValid = folderManager.isValidFolderPath(folderPath);

                    return {
                        success: true,
                        isValid,
                    };
                },
                {
                    body: t.Object({
                        path: t.String(),
                    }),
                },
            )
    );
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * File manager routes with default (real) dependencies
 */
export const fileManagerRoutes = createFileManagerRoutes();
