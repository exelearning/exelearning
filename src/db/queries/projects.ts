/**
 * Project Queries - Kysely ORM
 * Type-safe queries for SQLite, PostgreSQL, and MySQL
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, Project, NewProject, ProjectUpdate, User } from '../types';
import { now } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supportsReturning, updateByColumnAndReturn, updateByIdAndReturn } from '../helpers';

// ============================================================================
// HELPER TYPES AND FUNCTIONS
// ============================================================================

/**
 * Result type from a project + owner join query.
 * Owner fields are aliased with 'owner_' prefix to avoid conflicts.
 */
type ProjectWithOwnerRow = Project & {
    owner_id_join: number;
    owner_email: string;
    owner_user_id: string;
    owner_password: string;
    owner_roles: string;
    owner_is_lopd_accepted: number;
    owner_quota_mb: number | null;
    owner_external_identifier: string | null;
    owner_api_token: string | null;
    owner_is_active: number;
    owner_created_at: string | number | null;
    owner_updated_at: string | number | null;
};

/**
 * Extract User object from a joined project+owner query result.
 * The owner fields are prefixed with 'owner_' to avoid column name conflicts.
 */
function extractOwnerFromResult(result: ProjectWithOwnerRow): User {
    return {
        id: result.owner_id_join,
        email: result.owner_email,
        user_id: result.owner_user_id,
        password: result.owner_password,
        roles: result.owner_roles,
        is_lopd_accepted: result.owner_is_lopd_accepted,
        quota_mb: result.owner_quota_mb,
        external_identifier: result.owner_external_identifier,
        api_token: result.owner_api_token,
        is_active: result.owner_is_active,
        created_at: result.owner_created_at,
        updated_at: result.owner_updated_at,
    };
}

/**
 * Build ProjectWithOwner object from joined query result.
 * Separates the flat joined row into nested Project + owner structure.
 */
function buildProjectWithOwner(result: ProjectWithOwnerRow): Project & { owner: User } {
    return {
        id: result.id,
        uuid: result.uuid,
        title: result.title,
        description: result.description,
        owner_id: result.owner_id,
        status: result.status,
        visibility: result.visibility,
        language: result.language,
        author: result.author,
        license: result.license,
        last_accessed_at: result.last_accessed_at,
        saved_once: result.saved_once,
        created_at: result.created_at,
        updated_at: result.updated_at,
        owner: extractOwnerFromResult(result),
    };
}

/**
 * Deduplicate projects by ID and sort by updated_at descending.
 * Used when combining owned and collaborating projects.
 */
function deduplicateAndSortProjects(owned: Project[], collaborating: Project[]): Project[] {
    const seen = new Set<number>();
    const result: Project[] = [];

    for (const p of [...owned, ...collaborating]) {
        if (!seen.has(p.id)) {
            seen.add(p.id);
            result.push(p);
        }
    }

    return result.sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA;
    });
}

// ============================================================================
// READ QUERIES
// ============================================================================

export async function findProjectById(db: Kysely<Database>, id: number): Promise<Project | undefined> {
    return db.selectFrom('projects').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findProjectByUuid(db: Kysely<Database>, uuid: string): Promise<Project | undefined> {
    return db.selectFrom('projects').selectAll().where('uuid', '=', uuid).executeTakeFirst();
}

export async function findProjectByPlatformId(db: Kysely<Database>, platformId: string): Promise<Project | undefined> {
    return db.selectFrom('projects').selectAll().where('platform_id', '=', platformId).executeTakeFirst();
}

export async function findProjectWithOwner(
    db: Kysely<Database>,
    id: number,
): Promise<(Project & { owner: User }) | undefined> {
    const result = await db
        .selectFrom('projects')
        .innerJoin('users', 'projects.owner_id', 'users.id')
        .selectAll('projects')
        .select([
            'users.id as owner_id_join',
            'users.email as owner_email',
            'users.user_id as owner_user_id',
            'users.password as owner_password',
            'users.roles as owner_roles',
            'users.is_lopd_accepted as owner_is_lopd_accepted',
            'users.quota_mb as owner_quota_mb',
            'users.external_identifier as owner_external_identifier',
            'users.api_token as owner_api_token',
            'users.is_active as owner_is_active',
            'users.created_at as owner_created_at',
            'users.updated_at as owner_updated_at',
        ])
        .where('projects.id', '=', id)
        .executeTakeFirst();

    if (!result) return undefined;
    return buildProjectWithOwner(result as ProjectWithOwnerRow);
}

export async function findProjectByUuidWithOwner(
    db: Kysely<Database>,
    uuid: string,
): Promise<(Project & { owner: User }) | undefined> {
    const result = await db
        .selectFrom('projects')
        .innerJoin('users', 'projects.owner_id', 'users.id')
        .selectAll('projects')
        .select([
            'users.id as owner_id_join',
            'users.email as owner_email',
            'users.user_id as owner_user_id',
            'users.password as owner_password',
            'users.roles as owner_roles',
            'users.is_lopd_accepted as owner_is_lopd_accepted',
            'users.quota_mb as owner_quota_mb',
            'users.external_identifier as owner_external_identifier',
            'users.api_token as owner_api_token',
            'users.is_active as owner_is_active',
            'users.created_at as owner_created_at',
            'users.updated_at as owner_updated_at',
        ])
        .where('projects.uuid', '=', uuid)
        .executeTakeFirst();

    if (!result) return undefined;
    return buildProjectWithOwner(result as ProjectWithOwnerRow);
}

// ============================================================================
// COLLABORATORS
// ============================================================================

export async function getProjectCollaborators(db: Kysely<Database>, projectId: number): Promise<User[]> {
    return db
        .selectFrom('project_collaborators')
        .innerJoin('users', 'project_collaborators.user_id', 'users.id')
        .selectAll('users')
        .where('project_collaborators.project_id', '=', projectId)
        .execute();
}

export async function addCollaborator(db: Kysely<Database>, projectId: number, userId: number): Promise<void> {
    await db
        .insertInto('project_collaborators')
        .values({ project_id: projectId, user_id: userId })
        .onConflict(oc => oc.doNothing())
        .execute();
}

export async function removeCollaborator(db: Kysely<Database>, projectId: number, userId: number): Promise<void> {
    await db
        .deleteFrom('project_collaborators')
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .execute();
}

export async function isCollaborator(db: Kysely<Database>, projectId: number, userId: number): Promise<boolean> {
    const result = await db
        .selectFrom('project_collaborators')
        .select('project_id')
        .where('project_id', '=', projectId)
        .where('user_id', '=', userId)
        .executeTakeFirst();
    return !!result;
}

// ============================================================================
// PROJECT LISTS
// ============================================================================

export async function findProjectsByOwner(
    db: Kysely<Database>,
    ownerId: number,
    statuses: string[] = ['active', 'archived'],
): Promise<Project[]> {
    return db
        .selectFrom('projects')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('status', 'in', statuses)
        .orderBy('updated_at', 'desc')
        .execute();
}

export async function findProjectsAsCollaborator(
    db: Kysely<Database>,
    userId: number,
    statuses: string[] = ['active', 'archived'],
): Promise<Project[]> {
    const projectIds = await db
        .selectFrom('project_collaborators')
        .select('project_id')
        .where('user_id', '=', userId)
        .execute();

    if (projectIds.length === 0) return [];

    return db
        .selectFrom('projects')
        .selectAll()
        .where(
            'id',
            'in',
            projectIds.map(p => p.project_id),
        )
        .where('status', 'in', statuses)
        .orderBy('updated_at', 'desc')
        .execute();
}

export async function findAllProjectsForUser(db: Kysely<Database>, userId: number): Promise<Project[]> {
    const owned = await findProjectsByOwner(db, userId);
    const collaborating = await findProjectsAsCollaborator(db, userId);
    return deduplicateAndSortProjects(owned, collaborating);
}

export async function findSavedProjectsForUser(db: Kysely<Database>, userId: number): Promise<Project[]> {
    const owned = await db
        .selectFrom('projects')
        .selectAll()
        .where('owner_id', '=', userId)
        .where('status', 'in', ['active', 'archived'])
        .where('saved_once', '=', 1)
        .orderBy('updated_at', 'desc')
        .execute();

    const projectIds = await db
        .selectFrom('project_collaborators')
        .select('project_id')
        .where('user_id', '=', userId)
        .execute();

    let collaborating: Project[] = [];
    if (projectIds.length > 0) {
        collaborating = await db
            .selectFrom('projects')
            .selectAll()
            .where(
                'id',
                'in',
                projectIds.map(p => p.project_id),
            )
            .where('status', 'in', ['active', 'archived'])
            .where('saved_once', '=', 1)
            .orderBy('updated_at', 'desc')
            .execute();
    }

    return deduplicateAndSortProjects(owned, collaborating);
}

// ============================================================================
// WRITE QUERIES
// ============================================================================

export async function createProject(db: Kysely<Database>, data: Omit<NewProject, 'uuid'>): Promise<Project> {
    const timestamp = now();
    const uuid = uuidv4();
    const values = {
        ...data,
        uuid,
        created_at: timestamp,
        updated_at: timestamp,
    };

    if (supportsReturning()) {
        return db.insertInto('projects').values(values).returningAll().executeTakeFirstOrThrow();
    }

    await db.insertInto('projects').values(values).executeTakeFirstOrThrow();
    return db.selectFrom('projects').selectAll().where('uuid', '=', uuid).executeTakeFirstOrThrow();
}

export async function updateProject(
    db: Kysely<Database>,
    id: number,
    data: ProjectUpdate,
): Promise<Project | undefined> {
    return updateByIdAndReturn(db, 'projects', id, {
        ...data,
        updated_at: now(),
    });
}

export async function updateProjectByUuid(
    db: Kysely<Database>,
    uuid: string,
    data: ProjectUpdate,
): Promise<Project | undefined> {
    return updateByColumnAndReturn(db, 'projects', 'uuid', uuid, {
        ...data,
        updated_at: now(),
    });
}

export async function markProjectAsSaved(db: Kysely<Database>, projectId: number): Promise<void> {
    await db
        .updateTable('projects')
        .set({
            saved_once: 1,
            updated_at: now(),
        })
        .where('id', '=', projectId)
        .execute();
}

/**
 * Update project title only (without marking as saved)
 * Used for auto-persistence of Yjs documents when user navigates away
 */
export async function updateProjectTitle(db: Kysely<Database>, projectId: number, title: string): Promise<void> {
    await db
        .updateTable('projects')
        .set({
            title,
            updated_at: now(),
        })
        .where('id', '=', projectId)
        .execute();
}

/**
 * Update project title and mark as saved in a single operation
 * Used when user explicitly saves the project
 */
export async function updateProjectTitleAndSave(db: Kysely<Database>, projectId: number, title: string): Promise<void> {
    await db
        .updateTable('projects')
        .set({
            title,
            saved_once: 1,
            updated_at: now(),
        })
        .where('id', '=', projectId)
        .execute();
}

export async function updateLastAccessed(db: Kysely<Database>, projectId: number): Promise<void> {
    await db
        .updateTable('projects')
        .set({
            last_accessed_at: now(),
        })
        .where('id', '=', projectId)
        .execute();
}

export async function softDeleteProject(db: Kysely<Database>, id: number): Promise<void> {
    await db
        .updateTable('projects')
        .set({
            status: 'inactive',
            updated_at: now(),
        })
        .where('id', '=', id)
        .execute();
}

export async function hardDeleteProject(db: Kysely<Database>, id: number): Promise<void> {
    // Collaborators are deleted via cascade
    await db.deleteFrom('projects').where('id', '=', id).execute();
}

// ============================================================================
// ACCESS CONTROL
// ============================================================================

export async function hasAccess(db: Kysely<Database>, projectId: number, userId: number): Promise<boolean> {
    const project = await findProjectById(db, projectId);
    if (!project) return false;

    // Owner always has access
    if (project.owner_id === userId) return true;

    // Check if collaborator
    return isCollaborator(db, projectId, userId);
}

export async function checkProjectAccess(
    db: Kysely<Database>,
    project: Project | undefined,
    userId?: number,
): Promise<{
    hasAccess: boolean;
    reason?: string;
}> {
    if (!project) {
        return { hasAccess: false, reason: 'PROJECT_NOT_FOUND' };
    }

    if (project.status === 'inactive') {
        return { hasAccess: false, reason: 'PROJECT_INACTIVE' };
    }

    // Public projects are accessible to everyone
    if (project.visibility === 'public') {
        return { hasAccess: true };
    }

    // Private projects require authentication
    if (!userId) {
        return { hasAccess: false, reason: 'AUTHENTICATION_REQUIRED' };
    }

    // Check if owner
    if (project.owner_id === userId) {
        return { hasAccess: true };
    }

    // Check if collaborator
    if (await isCollaborator(db, project.id, userId)) {
        return { hasAccess: true };
    }

    return { hasAccess: false, reason: 'ACCESS_DENIED' };
}

// ============================================================================
// ADDITIONAL PROJECT QUERIES (for Symfony compatibility)
// ============================================================================

export async function findSavedProjectsByOwner(db: Kysely<Database>, ownerId: number): Promise<Project[]> {
    return db
        .selectFrom('projects')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('saved_once', '=', 1)
        .where('status', 'in', ['active', 'archived'])
        .orderBy('updated_at', 'desc')
        .execute();
}

/**
 * Find all projects owned by a user (regardless of status)
 * Used for cleanup when deleting a user - need to clean up asset directories
 * before the database cascade deletes the project records.
 *
 * @param db - Kysely database instance
 * @param ownerId - The user ID to find projects for
 * @returns Array of all projects owned by the user
 */
export async function findProjectsByOwnerId(db: Kysely<Database>, ownerId: number): Promise<Project[]> {
    return db.selectFrom('projects').selectAll().where('owner_id', '=', ownerId).execute();
}

export async function createProjectWithUuid(
    db: Kysely<Database>,
    uuid: string,
    data: Omit<NewProject, 'uuid'>,
): Promise<Project> {
    const timestamp = now();
    const values = {
        ...data,
        uuid,
        created_at: timestamp,
        updated_at: timestamp,
    };

    if (supportsReturning()) {
        return db.insertInto('projects').values(values).returningAll().executeTakeFirstOrThrow();
    }

    await db.insertInto('projects').values(values).executeTakeFirstOrThrow();
    return db.selectFrom('projects').selectAll().where('uuid', '=', uuid).executeTakeFirstOrThrow();
}

/**
 * Result of a project ownership transfer
 */
export interface TransferOwnershipResult {
    success: boolean;
    previousOwnerId: number;
    newOwnerId: number;
}

/**
 * Transfer project ownership with full collaborator management
 * - Verifies new owner is a current collaborator
 * - Removes new owner from collaborators (they become owner)
 * - Adds previous owner as collaborator
 * - Updates owner_id
 *
 * @throws Error if project not found
 * @throws Error if new owner is current owner
 * @throws Error if new owner is not a collaborator
 */
export async function transferOwnership(
    db: Kysely<Database>,
    projectId: number,
    newOwnerId: number,
): Promise<TransferOwnershipResult> {
    // 1. Get current project to find previous owner
    const project = await findProjectById(db, projectId);
    if (!project) {
        throw new Error('Project not found');
    }

    const previousOwnerId = project.owner_id;

    // 2. Cannot transfer to self
    if (previousOwnerId === newOwnerId) {
        throw new Error('Cannot transfer ownership to current owner');
    }

    // 3. Verify new owner is a collaborator
    const newOwnerIsCollaborator = await isCollaborator(db, projectId, newOwnerId);
    if (!newOwnerIsCollaborator) {
        throw new Error('New owner must be a current collaborator');
    }

    // 4. Remove new owner from collaborators (they become owner)
    await removeCollaborator(db, projectId, newOwnerId);

    // 5. Add previous owner as collaborator
    await addCollaborator(db, projectId, previousOwnerId);

    // 6. Update owner_id
    await db
        .updateTable('projects')
        .set({
            owner_id: newOwnerId,
            updated_at: now(),
        })
        .where('id', '=', projectId)
        .execute();

    return {
        success: true,
        previousOwnerId,
        newOwnerId,
    };
}

/**
 * Transfer project ownership by UUID
 * Delegates to transferOwnership() for full collaborator management
 *
 * @throws Error if project not found
 * @throws Error if new owner is current owner
 * @throws Error if new owner is not a collaborator
 */
export async function transferOwnershipByUuid(
    db: Kysely<Database>,
    uuid: string,
    newOwnerId: number,
): Promise<TransferOwnershipResult> {
    const project = await findProjectByUuid(db, uuid);
    if (!project) {
        throw new Error('Project not found');
    }
    return transferOwnership(db, project.id, newOwnerId);
}

export async function updateProjectVisibility(
    db: Kysely<Database>,
    projectId: number,
    visibility: string,
): Promise<void> {
    await db
        .updateTable('projects')
        .set({
            visibility,
            updated_at: now(),
        })
        .where('id', '=', projectId)
        .execute();
}

export async function updateProjectVisibilityByUuid(
    db: Kysely<Database>,
    uuid: string,
    visibility: string,
): Promise<void> {
    await db
        .updateTable('projects')
        .set({
            visibility,
            updated_at: now(),
        })
        .where('uuid', '=', uuid)
        .execute();
}

// ============================================================================
// CLEANUP QUERIES
// ============================================================================

/**
 * Find unsaved projects older than specified age
 * Used for cleanup of abandoned projects that were never saved
 *
 * @param db - Kysely database instance
 * @param maxAgeMs - Maximum age in milliseconds (projects older than this will be returned)
 * @returns Array of projects with saved_once = 0 older than maxAgeMs
 */
export async function findUnsavedProjectsOlderThan(db: Kysely<Database>, maxAgeMs: number): Promise<Project[]> {
    const cutoffTime = now() - maxAgeMs;
    return db
        .selectFrom('projects')
        .selectAll()
        .where('saved_once', '=', 0)
        .where('created_at', '<', cutoffTime)
        .execute();
}

/**
 * Find projects owned by guest users older than specified age
 * Guest users have email pattern: guest_*@guest.local
 *
 * @param db - Kysely database instance
 * @param maxAgeMs - Maximum age in milliseconds (projects older than this will be returned)
 * @returns Array of projects owned by guest users older than maxAgeMs
 */
export async function findGuestProjectsOlderThan(db: Kysely<Database>, maxAgeMs: number): Promise<Project[]> {
    const cutoffTime = now() - maxAgeMs;
    return db
        .selectFrom('projects')
        .innerJoin('users', 'projects.owner_id', 'users.id')
        .selectAll('projects')
        .where('users.email', 'like', 'guest_%@guest.local')
        .where('projects.updated_at', '<', cutoffTime)
        .execute();
}

/**
 * Delete project and all related data in a transaction
 * Handles foreign key constraints by deleting in correct order
 *
 * @param db - Kysely database instance
 * @param projectId - Project ID to delete
 */
export async function deleteProjectWithRelatedData(db: Kysely<Database>, projectId: number): Promise<void> {
    await db.transaction().execute(async trx => {
        // Delete in order respecting foreign keys
        await trx.deleteFrom('yjs_version_history').where('project_id', '=', projectId).execute();
        await trx.deleteFrom('yjs_updates').where('project_id', '=', projectId).execute();
        await trx.deleteFrom('yjs_documents').where('project_id', '=', projectId).execute();
        await trx.deleteFrom('assets').where('project_id', '=', projectId).execute();
        await trx.deleteFrom('project_collaborators').where('project_id', '=', projectId).execute();
        await trx.deleteFrom('projects').where('id', '=', projectId).execute();
    });
}
