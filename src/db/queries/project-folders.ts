/**
 * Project Folder Queries - Kysely ORM
 * Type-safe queries for SQLite, PostgreSQL, and MySQL
 * All functions accept db as first parameter for dependency injection
 *
 * Folders are personal per-user: a project can be filed into at most one
 * folder per user (the "one folder per project" semantics, not tags).
 * "Unfiled" is represented by the absence of a row in
 * project_folder_assignments — there is no sentinel folder.
 */
import type { Kysely } from 'kysely';
import type { Database, ProjectFolder } from '../types';
import { now } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { insertAndReturn, updateByIdAndReturn } from '../helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectFolderWithCount {
    id: number;
    uuid: string;
    name: string;
    parentId: number | null;
    projectCount: number;
}

// ============================================================================
// READ QUERIES
// ============================================================================

export async function findFoldersForUser(db: Kysely<Database>, userId: number): Promise<ProjectFolder[]> {
    return db.selectFrom('project_folders').selectAll().where('user_id', '=', userId).orderBy('name', 'asc').execute();
}

/**
 * A user's immediate children of a folder (or top-level folders, when
 * parentFolderId is null).
 */
export async function findChildFolders(
    db: Kysely<Database>,
    userId: number,
    parentFolderId: number | null,
): Promise<ProjectFolder[]> {
    let query = db.selectFrom('project_folders').selectAll().where('user_id', '=', userId);
    query =
        parentFolderId === null
            ? query.where('parent_folder_id', 'is', null)
            : query.where('parent_folder_id', '=', parentFolderId);
    return query.orderBy('name', 'asc').execute();
}

/**
 * List a user's folders together with how many projects are currently
 * filed in each — a single grouped query instead of N+1 count lookups.
 * Includes the raw `parentId` FK; building tree order / depth from it is
 * the service layer's job (see project-folder-manager.ts) so this stays a
 * simple, portable query with no recursive SQL.
 */
export async function findFoldersWithCountsForUser(
    db: Kysely<Database>,
    userId: number,
): Promise<ProjectFolderWithCount[]> {
    const rows = await db
        .selectFrom('project_folders')
        .leftJoin('project_folder_assignments', 'project_folder_assignments.folder_id', 'project_folders.id')
        .select(eb => [
            'project_folders.id as id',
            'project_folders.uuid as uuid',
            'project_folders.name as name',
            'project_folders.parent_folder_id as parentId',
            eb.fn.count<number>('project_folder_assignments.project_id').as('projectCount'),
        ])
        .where('project_folders.user_id', '=', userId)
        .groupBy([
            'project_folders.id',
            'project_folders.uuid',
            'project_folders.name',
            'project_folders.parent_folder_id',
        ])
        .orderBy('project_folders.name', 'asc')
        .execute();

    return rows.map(row => ({
        id: row.id,
        uuid: row.uuid,
        name: row.name,
        parentId: row.parentId,
        projectCount: Number(row.projectCount),
    }));
}

export async function findFolderById(db: Kysely<Database>, id: number): Promise<ProjectFolder | undefined> {
    return db.selectFrom('project_folders').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findFolderByUuid(db: Kysely<Database>, uuid: string): Promise<ProjectFolder | undefined> {
    return db.selectFrom('project_folders').selectAll().where('uuid', '=', uuid).executeTakeFirst();
}

/**
 * Depth of a folder in its tree: 0 for a top-level folder, 1 for its
 * children, etc. Walks parent_folder_id upward with a bounded loop rather
 * than a recursive CTE, to stay portable across SQLite/PostgreSQL/MySQL.
 * The bound (64) is a defensive cap comfortably above MAX_FOLDER_DEPTH (30)
 * — real trees never approach it because the service rejects deeper
 * nesting on write.
 */
export async function findFolderDepth(db: Kysely<Database>, folderId: number): Promise<number> {
    let depth = 0;
    let currentId: number | null = folderId;
    const guard = 64;
    for (let i = 0; i < guard; i++) {
        const folder = await db
            .selectFrom('project_folders')
            .select('parent_folder_id')
            .where('id', '=', currentId as number)
            .executeTakeFirst();
        if (!folder || folder.parent_folder_id === null) break;
        depth++;
        currentId = folder.parent_folder_id;
    }
    return depth;
}

/**
 * All descendant folder ids of a folder (children, grandchildren, ...),
 * breadth-first, bounded the same way as findFolderDepth. Used to cascade
 * folder deletion to subfolders.
 */
export async function findDescendantFolderIds(db: Kysely<Database>, folderId: number): Promise<number[]> {
    const descendants: number[] = [];
    let frontier = [folderId];
    const guard = 64;
    for (let i = 0; i < guard && frontier.length > 0; i++) {
        const children = await db
            .selectFrom('project_folders')
            .select('id')
            .where('parent_folder_id', 'in', frontier)
            .execute();
        if (children.length === 0) break;
        const childIds = children.map(c => c.id);
        descendants.push(...childIds);
        frontier = childIds;
    }
    return descendants;
}

/**
 * Height of a folder's own subtree: 0 if it has no children, 1 if its
 * deepest branch is one level of children, etc. Used when reparenting a
 * folder to check that its whole subtree still fits under the depth limit
 * at the new location. Same bounded-loop approach as findDescendantFolderIds.
 */
export async function findSubtreeHeight(db: Kysely<Database>, folderId: number): Promise<number> {
    let height = 0;
    let frontier = [folderId];
    const guard = 64;
    for (let i = 0; i < guard; i++) {
        const children = await db
            .selectFrom('project_folders')
            .select('id')
            .where('parent_folder_id', 'in', frontier)
            .execute();
        if (children.length === 0) break;
        height++;
        frontier = children.map(c => c.id);
    }
    return height;
}

export async function countProjectsInFolder(db: Kysely<Database>, folderId: number): Promise<number> {
    const result = await db
        .selectFrom('project_folder_assignments')
        .select(eb => eb.fn.countAll<number>().as('count'))
        .where('folder_id', '=', folderId)
        .executeTakeFirst();
    return Number(result?.count ?? 0);
}

/**
 * Map of projectId -> folder uuid for every project a user has filed.
 * Used to decorate a project list response without an N+1 query per project.
 */
export async function findFolderAssignmentsForUser(db: Kysely<Database>, userId: number): Promise<Map<number, string>> {
    const rows = await db
        .selectFrom('project_folder_assignments')
        .innerJoin('project_folders', 'project_folders.id', 'project_folder_assignments.folder_id')
        .select(['project_folder_assignments.project_id as projectId', 'project_folders.uuid as folderUuid'])
        .where('project_folder_assignments.user_id', '=', userId)
        .execute();

    return new Map(rows.map(row => [row.projectId, row.folderUuid]));
}

// ============================================================================
// WRITE QUERIES
// ============================================================================

export async function createFolder(
    db: Kysely<Database>,
    userId: number,
    name: string,
    parentFolderId: number | null = null,
): Promise<ProjectFolder> {
    const timestamp = now();
    return insertAndReturn(db, 'project_folders', {
        uuid: uuidv4(),
        user_id: userId,
        parent_folder_id: parentFolderId,
        name,
        created_at: timestamp,
        updated_at: timestamp,
    });
}

export async function renameFolder(
    db: Kysely<Database>,
    folderId: number,
    name: string,
): Promise<ProjectFolder | undefined> {
    return updateByIdAndReturn(db, 'project_folders', folderId, {
        name,
        updated_at: now(),
    });
}

/**
 * Reparent a folder (move it under a different folder, or to top-level
 * when newParentId is null). Callers are responsible for cycle/depth
 * validation (see moveFolder in project-folder-manager.ts) — this is a
 * plain, unchecked write.
 */
export async function updateFolderParent(
    db: Kysely<Database>,
    folderId: number,
    newParentId: number | null,
): Promise<ProjectFolder | undefined> {
    return updateByIdAndReturn(db, 'project_folders', folderId, {
        parent_folder_id: newParentId,
        updated_at: now(),
    });
}

/**
 * Delete a folder, all of its descendant folders, and every assignment
 * pointing to any of them, in a transaction. Projects that were filed in
 * the folder or its subfolders simply become unfiled — they are never
 * deleted by this call.
 */
export async function deleteFolder(db: Kysely<Database>, folderId: number): Promise<void> {
    const descendantIds = await findDescendantFolderIds(db, folderId);
    const allFolderIds = [folderId, ...descendantIds];

    await db.transaction().execute(async trx => {
        await trx.deleteFrom('project_folder_assignments').where('folder_id', 'in', allFolderIds).execute();
        await trx.deleteFrom('project_folders').where('id', 'in', allFolderIds).execute();
    });
}

/**
 * File (or unfile) a project into a folder for a given user.
 * A project has at most one folder per user, so this replaces any existing
 * assignment for that (project, user) pair. Pass `folderId: null` to unfile.
 */
export async function assignProjectToFolder(
    db: Kysely<Database>,
    projectId: number,
    userId: number,
    folderId: number | null,
): Promise<void> {
    await db.transaction().execute(async trx => {
        await trx
            .deleteFrom('project_folder_assignments')
            .where('project_id', '=', projectId)
            .where('user_id', '=', userId)
            .execute();

        if (folderId !== null) {
            const timestamp = now();
            await trx
                .insertInto('project_folder_assignments')
                .values({
                    project_id: projectId,
                    user_id: userId,
                    folder_id: folderId,
                    created_at: timestamp,
                    updated_at: timestamp,
                })
                .execute();
        }
    });
}

export async function removeFolderAssignmentsForProject(db: Kysely<Database>, projectId: number): Promise<void> {
    await db.deleteFrom('project_folder_assignments').where('project_id', '=', projectId).execute();
}

export async function removeFolderAssignmentForUserAndProject(
    db: Kysely<Database>,
    projectId: number,
    userId: number,
): Promise<void> {
    await db
        .deleteFrom('project_folder_assignments')
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .execute();
}
