/**
 * Project Folder Routes for Elysia
 * CRUD for a user's personal "My Projects" dashboard folders (including
 * nesting), and filing/unfiling a project into one of them.
 *
 * Uses Dependency Injection pattern for testability
 */
import { Elysia } from 'elysia';
import type { Kysely } from 'kysely';
import type { Database, ProjectFolder } from '../db/types';
import { db as dbDefault } from '../db/client';
import { withJwtAuth } from '../utils/route-auth';
import { requireAuth } from '../utils/guards';
import {
    listFolders as listFoldersDefault,
    createFolder as createFolderDefault,
    renameFolder as renameFolderDefault,
    moveFolder as moveFolderDefault,
    deleteFolder as deleteFolderDefault,
    assignProject as assignProjectDefault,
    type ProjectFolderErrorCode,
} from '../services/project-folder-manager';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ProjectFolderRouteService {
    listFolders: typeof listFoldersDefault;
    createFolder: typeof createFolderDefault;
    renameFolder: typeof renameFolderDefault;
    moveFolder: typeof moveFolderDefault;
    deleteFolder: typeof deleteFolderDefault;
    assignProject: typeof assignProjectDefault;
}

export interface ProjectFoldersDependencies {
    db: Kysely<Database>;
    service?: ProjectFolderRouteService;
}

const defaultService: ProjectFolderRouteService = {
    listFolders: listFoldersDefault,
    createFolder: createFolderDefault,
    renameFolder: renameFolderDefault,
    moveFolder: moveFolderDefault,
    deleteFolder: deleteFolderDefault,
    assignProject: assignProjectDefault,
};

const defaultDependencies: ProjectFoldersDependencies = {
    db: dbDefault,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Serializes a raw folder row for a mutation response (create/rename/move).
 * Deliberately does not include parentUuid/depth: those require tree
 * context that only the GET /folders (and GET /api/projects/user/list)
 * endpoints compute, and the frontend already refetches the full list after
 * every mutation, so a second lookup here would be wasted work.
 */
function serializeFolder(folder: ProjectFolder, projectCount = 0) {
    return {
        uuid: folder.uuid,
        name: folder.name,
        projectCount,
    };
}

/**
 * Maps a service error code to the HTTP status that best represents it.
 * Kept as a pure function so the mapping itself is directly testable.
 */
export function errorCodeToStatus(code: ProjectFolderErrorCode): number {
    switch (code) {
        case 'INVALID_NAME':
            return 400;
        case 'MAX_DEPTH_EXCEEDED':
            return 400;
        case 'CYCLIC_PARENT':
            return 400;
        case 'DUPLICATE_NAME':
            return 409;
        case 'FOLDER_NOT_FOUND':
        case 'PROJECT_NOT_FOUND':
        case 'PARENT_NOT_FOUND':
            return 404;
        case 'FOLDER_FORBIDDEN':
        case 'PROJECT_ACCESS_DENIED':
        case 'PARENT_FORBIDDEN':
            return 403;
        default:
            return 400;
    }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createProjectFoldersRoutes(deps: ProjectFoldersDependencies = defaultDependencies) {
    const db = deps.db;
    const service = deps.service ?? defaultService;

    return (
        new Elysia({ prefix: '/api/projects' })
            .use(withJwtAuth())

            // GET /api/projects/folders - list the caller's folders, in tree order
            .get('/folders', async ({ jwtPayload, set }) => {
                const authErr = requireAuth(jwtPayload);
                if (authErr) {
                    set.status = authErr.status;
                    return { success: false, error: authErr.error, message: authErr.message };
                }

                const folders = await service.listFolders(db, Number(jwtPayload!.sub));
                return {
                    success: true,
                    folders: folders.map(f => ({
                        uuid: f.uuid,
                        name: f.name,
                        parentUuid: f.parentUuid,
                        depth: f.depth,
                        projectCount: f.projectCount,
                    })),
                };
            })

            // POST /api/projects/folders - create a folder, optionally nested under parentFolderUuid
            .post('/folders', async ({ jwtPayload, body, set }) => {
                const authErr = requireAuth(jwtPayload);
                if (authErr) {
                    set.status = authErr.status;
                    return { success: false, error: authErr.error, message: authErr.message };
                }

                const parsedBody = (body as { name?: string; parentFolderUuid?: string | null } | null) ?? {};
                const name = parsedBody.name ?? '';
                const parentFolderUuid = parsedBody.parentFolderUuid ?? null;
                const result = await service.createFolder(db, Number(jwtPayload!.sub), name, parentFolderUuid);
                if (!result.success) {
                    set.status = errorCodeToStatus(result.error.code);
                    return { success: false, error: result.error.code, message: result.error.message };
                }

                set.status = 201;
                return { success: true, folder: serializeFolder(result.data) };
            })

            // PATCH /api/projects/folders/:folderUuid - rename and/or reparent a folder.
            // At least one of `name` / `parentFolderUuid` must be present in the body;
            // `parentFolderUuid: null` explicitly moves the folder to top-level, while
            // omitting the key entirely leaves its current parent untouched.
            .patch('/folders/:folderUuid', async ({ jwtPayload, params, body, set }) => {
                const authErr = requireAuth(jwtPayload);
                if (authErr) {
                    set.status = authErr.status;
                    return { success: false, error: authErr.error, message: authErr.message };
                }

                const parsedBody = (body as { name?: string; parentFolderUuid?: string | null } | null) ?? {};
                const userId = Number(jwtPayload!.sub);
                const hasName = typeof parsedBody.name === 'string';
                const hasParent = Object.hasOwn(parsedBody, 'parentFolderUuid');

                if (!hasName && !hasParent) {
                    set.status = 400;
                    return {
                        success: false,
                        error: 'INVALID_REQUEST',
                        message: 'Provide a name and/or parentFolderUuid to update',
                    };
                }

                let folder: ProjectFolder | undefined;

                if (hasName) {
                    const renameResult = await service.renameFolder(db, userId, params.folderUuid, parsedBody.name!);
                    if (!renameResult.success) {
                        set.status = errorCodeToStatus(renameResult.error.code);
                        return { success: false, error: renameResult.error.code, message: renameResult.error.message };
                    }
                    folder = renameResult.data;
                }

                if (hasParent) {
                    const moveResult = await service.moveFolder(
                        db,
                        userId,
                        params.folderUuid,
                        parsedBody.parentFolderUuid ?? null,
                    );
                    if (!moveResult.success) {
                        set.status = errorCodeToStatus(moveResult.error.code);
                        return { success: false, error: moveResult.error.code, message: moveResult.error.message };
                    }
                    folder = moveResult.data;
                }

                return { success: true, folder: serializeFolder(folder!) };
            })

            // DELETE /api/projects/folders/:folderUuid - delete a folder and its
            // subfolders (unfiles their projects, never deletes them)
            .delete('/folders/:folderUuid', async ({ jwtPayload, params, set }) => {
                const authErr = requireAuth(jwtPayload);
                if (authErr) {
                    set.status = authErr.status;
                    return { success: false, error: authErr.error, message: authErr.message };
                }

                const result = await service.deleteFolder(db, Number(jwtPayload!.sub), params.folderUuid);
                if (!result.success) {
                    set.status = errorCodeToStatus(result.error.code);
                    return { success: false, error: result.error.code, message: result.error.message };
                }

                return { success: true };
            })

            // PUT /api/projects/uuid/:projectUuid/folder - file/unfile a project
            .put('/uuid/:projectUuid/folder', async ({ jwtPayload, params, body, set }) => {
                const authErr = requireAuth(jwtPayload);
                if (authErr) {
                    set.status = authErr.status;
                    return { success: false, error: authErr.error, message: authErr.message };
                }

                const folderUuid = (body as { folderUuid?: string | null } | null)?.folderUuid ?? null;
                const result = await service.assignProject(db, Number(jwtPayload!.sub), params.projectUuid, folderUuid);
                if (!result.success) {
                    set.status = errorCodeToStatus(result.error.code);
                    return { success: false, error: result.error.code, message: result.error.message };
                }

                return { success: true };
            })
    );
}

export const projectFoldersRoutes = createProjectFoldersRoutes();
