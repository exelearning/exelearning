/**
 * Project Folder Manager Service
 *
 * Business logic for organizing projects into personal, per-user dashboard
 * folders: name validation, ownership checks on folders, and access checks
 * on the project being filed (owner or collaborator — not necessarily owner).
 *
 * Folders can nest up to MAX_FOLDER_DEPTH levels. Sibling name uniqueness,
 * depth limits, and cycle prevention are all enforced here rather than in
 * the DB — see the module comment in db/migrations/008_project_folders.ts
 * for why sibling uniqueness can't be a DB constraint.
 *
 * Uses the DI pattern (configure/resetDependencies) so routes and tests can
 * inject mocked query functions without mock.module().
 */
import type { Kysely } from 'kysely';
import type { Database, ProjectFolder } from '../db/types';
import {
    findFoldersWithCountsForUser,
    findChildFolders,
    findFolderByUuid,
    findFolderDepth,
    findDescendantFolderIds,
    findSubtreeHeight,
    createFolder as createFolderQuery,
    renameFolder as renameFolderQuery,
    updateFolderParent,
    deleteFolder as deleteFolderQuery,
    assignProjectToFolder,
    type ProjectFolderWithCount,
} from '../db/queries/project-folders';
import { findProjectByUuid, hasAccess } from '../db/queries/projects';

// ============================================================================
// TYPES
// ============================================================================

export type ProjectFolderErrorCode =
    | 'INVALID_NAME'
    | 'DUPLICATE_NAME'
    | 'FOLDER_NOT_FOUND'
    | 'FOLDER_FORBIDDEN'
    | 'PROJECT_NOT_FOUND'
    | 'PROJECT_ACCESS_DENIED'
    | 'PARENT_NOT_FOUND'
    | 'PARENT_FORBIDDEN'
    | 'MAX_DEPTH_EXCEEDED'
    | 'CYCLIC_PARENT';

export interface ProjectFolderServiceError {
    code: ProjectFolderErrorCode;
    message: string;
}

export type ProjectFolderResult<T> = { success: true; data: T } | { success: false; error: ProjectFolderServiceError };

/**
 * Maximum number of nesting levels (0-indexed): valid depths are 0
 * (top-level) through MAX_FOLDER_DEPTH - 1. This is a defensive sanity
 * bound, not a UX restriction — no real folder tree approaches it — kept
 * high enough to be invisible in practice while still protecting the
 * bounded-loop walks in src/db/queries/project-folders.ts (guard = 64)
 * from pathological data.
 */
export const MAX_FOLDER_DEPTH = 30;

const MAX_FOLDER_NAME_LENGTH = 255;

/** A folder decorated with its tree position, ready for an indented list UI. */
export interface ProjectFolderNode {
    uuid: string;
    name: string;
    parentUuid: string | null;
    depth: number;
    projectCount: number;
}

// ============================================================================
// DEPENDENCIES (DI pattern)
// ============================================================================

export interface ProjectFolderManagerDependencies {
    queries: {
        findFoldersWithCountsForUser: typeof findFoldersWithCountsForUser;
        findChildFolders: typeof findChildFolders;
        findFolderByUuid: typeof findFolderByUuid;
        findFolderDepth: typeof findFolderDepth;
        findDescendantFolderIds: typeof findDescendantFolderIds;
        findSubtreeHeight: typeof findSubtreeHeight;
        createFolder: typeof createFolderQuery;
        renameFolder: typeof renameFolderQuery;
        updateFolderParent: typeof updateFolderParent;
        deleteFolder: typeof deleteFolderQuery;
        assignProjectToFolder: typeof assignProjectToFolder;
    };
    projectQueries: {
        findProjectByUuid: typeof findProjectByUuid;
        hasAccess: typeof hasAccess;
    };
}

const defaultDeps: ProjectFolderManagerDependencies = {
    queries: {
        findFoldersWithCountsForUser,
        findChildFolders,
        findFolderByUuid,
        findFolderDepth,
        findDescendantFolderIds,
        findSubtreeHeight,
        createFolder: createFolderQuery,
        renameFolder: renameFolderQuery,
        updateFolderParent,
        deleteFolder: deleteFolderQuery,
        assignProjectToFolder,
    },
    projectQueries: {
        findProjectByUuid,
        hasAccess,
    },
};

let deps = defaultDeps;

export function configure(newDeps: Partial<ProjectFolderManagerDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Returns an error message when the name is invalid, or null when it's OK.
 * A folder name is a display label, not a filesystem path, so isPathSafe()
 * does not apply here — only trim/length checks.
 */
function validateFolderName(name: string): string | null {
    const trimmed = name.trim();
    if (trimmed === '') {
        return 'Folder name cannot be empty';
    }
    if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
        return `Folder name cannot exceed ${MAX_FOLDER_NAME_LENGTH} characters`;
    }
    return null;
}

/**
 * Whether a user already has a folder named `name` (case/whitespace
 * insensitive) directly under `parentFolderId`, other than `excludeFolderId`
 * itself (used by rename/move so a folder doesn't collide with itself).
 */
async function hasSiblingWithName(
    db: Kysely<Database>,
    userId: number,
    parentFolderId: number | null,
    name: string,
    excludeFolderId?: number,
): Promise<boolean> {
    const siblings = await deps.queries.findChildFolders(db, userId, parentFolderId);
    const normalized = name.trim().toLowerCase();
    return siblings.some(sibling => sibling.id !== excludeFolderId && sibling.name.trim().toLowerCase() === normalized);
}

/**
 * Arrange a flat folder+count list into tree order (each folder immediately
 * followed by its children, recursively) with a computed `depth`, so the
 * frontend only has to indent by `depth` — no tree-building on its side.
 * Siblings stay alphabetically sorted because the source query already
 * orders by name.
 *
 * Exported so src/routes/project.ts can reuse the exact same tree-building
 * logic when decorating GET /api/projects/user/list, without routing that
 * endpoint's already-injected query call through this service's own DI.
 */
export function sortIntoTreeOrder(folders: ProjectFolderWithCount[]): ProjectFolderNode[] {
    const uuidById = new Map(folders.map(folder => [folder.id, folder.uuid]));
    const childrenByParentId = new Map<number | null, ProjectFolderWithCount[]>();
    for (const folder of folders) {
        const bucket = childrenByParentId.get(folder.parentId);
        if (bucket) {
            bucket.push(folder);
        } else {
            childrenByParentId.set(folder.parentId, [folder]);
        }
    }

    const result: ProjectFolderNode[] = [];
    const visit = (parentId: number | null, depth: number): void => {
        for (const folder of childrenByParentId.get(parentId) ?? []) {
            result.push({
                uuid: folder.uuid,
                name: folder.name,
                parentUuid: folder.parentId !== null ? (uuidById.get(folder.parentId) ?? null) : null,
                depth,
                projectCount: folder.projectCount,
            });
            visit(folder.id, depth + 1);
        }
    };
    visit(null, 0);
    return result;
}

// ============================================================================
// SERVICE
// ============================================================================

export async function listFolders(db: Kysely<Database>, userId: number): Promise<ProjectFolderNode[]> {
    const flat = await deps.queries.findFoldersWithCountsForUser(db, userId);
    return sortIntoTreeOrder(flat);
}

export async function createFolder(
    db: Kysely<Database>,
    userId: number,
    name: string,
    parentFolderUuid: string | null = null,
): Promise<ProjectFolderResult<ProjectFolder>> {
    const validationError = validateFolderName(name);
    if (validationError) {
        return { success: false, error: { code: 'INVALID_NAME', message: validationError } };
    }
    const trimmedName = name.trim();

    let parentFolderId: number | null = null;
    if (parentFolderUuid !== null) {
        const parent = await deps.queries.findFolderByUuid(db, parentFolderUuid);
        if (!parent) {
            return { success: false, error: { code: 'PARENT_NOT_FOUND', message: 'Parent folder not found' } };
        }
        if (parent.user_id !== userId) {
            return { success: false, error: { code: 'PARENT_FORBIDDEN', message: 'You do not own the parent folder' } };
        }
        const parentDepth = await deps.queries.findFolderDepth(db, parent.id);
        if (parentDepth + 1 > MAX_FOLDER_DEPTH - 1) {
            return {
                success: false,
                error: {
                    code: 'MAX_DEPTH_EXCEEDED',
                    message: `Folders cannot be nested more than ${MAX_FOLDER_DEPTH} levels deep`,
                },
            };
        }
        parentFolderId = parent.id;
    }

    if (await hasSiblingWithName(db, userId, parentFolderId, trimmedName)) {
        return {
            success: false,
            error: { code: 'DUPLICATE_NAME', message: 'A folder with this name already exists here' },
        };
    }

    try {
        const folder = await deps.queries.createFolder(db, userId, trimmedName, parentFolderId);
        return { success: true, data: folder };
    } catch {
        return {
            success: false,
            error: { code: 'DUPLICATE_NAME', message: 'A folder with this name already exists here' },
        };
    }
}

export async function renameFolder(
    db: Kysely<Database>,
    userId: number,
    folderUuid: string,
    name: string,
): Promise<ProjectFolderResult<ProjectFolder>> {
    const validationError = validateFolderName(name);
    if (validationError) {
        return { success: false, error: { code: 'INVALID_NAME', message: validationError } };
    }
    const trimmedName = name.trim();

    const folder = await deps.queries.findFolderByUuid(db, folderUuid);
    if (!folder) {
        return { success: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
    }
    if (folder.user_id !== userId) {
        return { success: false, error: { code: 'FOLDER_FORBIDDEN', message: 'You do not own this folder' } };
    }

    if (await hasSiblingWithName(db, userId, folder.parent_folder_id, trimmedName, folder.id)) {
        return {
            success: false,
            error: { code: 'DUPLICATE_NAME', message: 'A folder with this name already exists here' },
        };
    }

    try {
        const updated = await deps.queries.renameFolder(db, folder.id, trimmedName);
        // updated is only undefined if the row vanished between the lookup
        // above and this update — treat that race the same as "not found".
        if (!updated) {
            return { success: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
        }
        return { success: true, data: updated };
    } catch {
        return {
            success: false,
            error: { code: 'DUPLICATE_NAME', message: 'A folder with this name already exists here' },
        };
    }
}

/**
 * Move a folder under a different parent (or to top-level, when
 * newParentFolderUuid is null). Rejects cycles (moving a folder into itself
 * or one of its own descendants) and moves that would push any part of the
 * folder's subtree past MAX_FOLDER_DEPTH.
 */
export async function moveFolder(
    db: Kysely<Database>,
    userId: number,
    folderUuid: string,
    newParentFolderUuid: string | null,
): Promise<ProjectFolderResult<ProjectFolder>> {
    const folder = await deps.queries.findFolderByUuid(db, folderUuid);
    if (!folder) {
        return { success: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
    }
    if (folder.user_id !== userId) {
        return { success: false, error: { code: 'FOLDER_FORBIDDEN', message: 'You do not own this folder' } };
    }

    let newParentId: number | null = null;
    let newParentDepth = -1; // so newParentDepth + 1 === 0 when moving to top-level
    if (newParentFolderUuid !== null) {
        const newParent = await deps.queries.findFolderByUuid(db, newParentFolderUuid);
        if (!newParent) {
            return { success: false, error: { code: 'PARENT_NOT_FOUND', message: 'Parent folder not found' } };
        }
        if (newParent.user_id !== userId) {
            return { success: false, error: { code: 'PARENT_FORBIDDEN', message: 'You do not own the parent folder' } };
        }
        if (newParent.id === folder.id) {
            return {
                success: false,
                error: { code: 'CYCLIC_PARENT', message: 'A folder cannot be moved into itself' },
            };
        }
        const descendantIds = await deps.queries.findDescendantFolderIds(db, folder.id);
        if (descendantIds.includes(newParent.id)) {
            return {
                success: false,
                error: { code: 'CYCLIC_PARENT', message: 'Cannot move a folder into one of its own subfolders' },
            };
        }
        newParentDepth = await deps.queries.findFolderDepth(db, newParent.id);
        newParentId = newParent.id;
    }

    const subtreeHeight = await deps.queries.findSubtreeHeight(db, folder.id);
    const newFolderDepth = newParentDepth + 1;
    if (newFolderDepth + subtreeHeight > MAX_FOLDER_DEPTH - 1) {
        return {
            success: false,
            error: {
                code: 'MAX_DEPTH_EXCEEDED',
                message: `Moving this folder here would exceed the maximum nesting depth of ${MAX_FOLDER_DEPTH}`,
            },
        };
    }

    if (await hasSiblingWithName(db, userId, newParentId, folder.name, folder.id)) {
        return {
            success: false,
            error: { code: 'DUPLICATE_NAME', message: 'A folder with this name already exists here' },
        };
    }

    const updated = await deps.queries.updateFolderParent(db, folder.id, newParentId);
    if (!updated) {
        return { success: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
    }
    return { success: true, data: updated };
}

export async function deleteFolder(
    db: Kysely<Database>,
    userId: number,
    folderUuid: string,
): Promise<ProjectFolderResult<void>> {
    const folder = await deps.queries.findFolderByUuid(db, folderUuid);
    if (!folder) {
        return { success: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
    }
    if (folder.user_id !== userId) {
        return { success: false, error: { code: 'FOLDER_FORBIDDEN', message: 'You do not own this folder' } };
    }

    await deps.queries.deleteFolder(db, folder.id);
    return { success: true, data: undefined };
}

/**
 * File (or unfile, when folderUuid is null) a project into a folder for the
 * given user. Only requires read access to the project (owner or
 * collaborator) — not ownership, since filing is a personal organization
 * action independent of who owns the underlying project. Nesting depth is
 * irrelevant here: a project can be filed into a folder at any depth.
 */
export async function assignProject(
    db: Kysely<Database>,
    userId: number,
    projectUuid: string,
    folderUuid: string | null,
): Promise<ProjectFolderResult<void>> {
    const project = await deps.projectQueries.findProjectByUuid(db, projectUuid);
    if (!project) {
        return { success: false, error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } };
    }

    const canAccessProject = await deps.projectQueries.hasAccess(db, project.id, userId);
    if (!canAccessProject) {
        return {
            success: false,
            error: { code: 'PROJECT_ACCESS_DENIED', message: 'You do not have access to this project' },
        };
    }

    let folderId: number | null = null;
    if (folderUuid !== null) {
        const folder = await deps.queries.findFolderByUuid(db, folderUuid);
        if (!folder) {
            return { success: false, error: { code: 'FOLDER_NOT_FOUND', message: 'Folder not found' } };
        }
        if (folder.user_id !== userId) {
            return { success: false, error: { code: 'FOLDER_FORBIDDEN', message: 'You do not own this folder' } };
        }
        folderId = folder.id;
    }

    await deps.queries.assignProjectToFolder(db, project.id, userId, folderId);
    return { success: true, data: undefined };
}
