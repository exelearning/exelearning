/**
 * Admin Queries - Kysely ORM
 * Type-safe queries for admin operations
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database, User, Project } from '../types';
import { now, stringifyRoles, parseRoles } from '../types';
import { ROLES } from '../../utils/guards';
import { insertAndReturn, updateByIdAndReturn } from '../helpers';

// ============================================================================
// USER MANAGEMENT QUERIES
// ============================================================================

/**
 * Get paginated list of users with optional search
 */
export async function findUsersPaginated(
    db: Kysely<Database>,
    options: {
        limit?: number;
        offset?: number;
        search?: string;
        sortBy?: 'id' | 'email' | 'created_at';
        sortOrder?: 'asc' | 'desc';
    } = {},
): Promise<{ users: User[]; total: number }> {
    const { limit = 50, offset = 0, search, sortBy = 'id', sortOrder = 'asc' } = options;

    // Build base query
    let query = db.selectFrom('users').selectAll();

    // Add search filter if provided
    if (search) {
        query = query.where(eb => eb.or([eb('email', 'like', `%${search}%`), eb('user_id', 'like', `%${search}%`)]));
    }

    // Add sorting
    query = query.orderBy(sortBy, sortOrder);

    // Execute paginated query
    const users = await query.limit(limit).offset(offset).execute();

    // Get total count using sql template
    let countQuery = db.selectFrom('users').select(sql<number>`count(id)`.as('count'));

    if (search) {
        countQuery = countQuery.where(eb =>
            eb.or([eb('email', 'like', `%${search}%`), eb('user_id', 'like', `%${search}%`)]),
        );
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    return { users, total };
}

// ============================================================================
// PROJECT MANAGEMENT QUERIES
// ============================================================================

export type AdminProjectListItem = Project & {
    owner_email: string;
    owner_user_id: string;
};

/**
 * Get paginated list of projects with optional filters
 */
export async function findProjectsPaginated(
    db: Kysely<Database>,
    options: {
        limit?: number;
        offset?: number;
        owner?: string;
        title?: string;
        status?: string;
        visibility?: string;
        savedOnly?: boolean;
        sortBy?: 'id' | 'title' | 'created_at';
        sortOrder?: 'asc' | 'desc';
    } = {},
): Promise<{ projects: AdminProjectListItem[]; total: number }> {
    const {
        limit = 50,
        offset = 0,
        owner,
        title,
        status,
        visibility,
        savedOnly = true,
        sortBy = 'id',
        sortOrder = 'desc',
    } = options;

    let query = db
        .selectFrom('projects')
        .innerJoin('users', 'projects.owner_id', 'users.id')
        .selectAll('projects')
        .select(['users.email as owner_email', 'users.user_id as owner_user_id']);

    // Filter by saved_once (exclude unsaved projects by default)
    if (savedOnly) {
        query = query.where('projects.saved_once', '=', 1);
    }

    if (owner) {
        const ownerId = parseInt(owner, 10);
        query = query.where(eb => {
            const predicates = [eb('users.email', 'like', `%${owner}%`), eb('users.user_id', 'like', `%${owner}%`)];
            if (!Number.isNaN(ownerId)) {
                predicates.push(eb('users.id', '=', ownerId));
            }
            return eb.or(predicates);
        });
    }

    if (title) {
        query = query.where('projects.title', 'like', `%${title}%`);
    }

    if (status) {
        query = query.where('projects.status', '=', status);
    }

    if (visibility) {
        query = query.where('projects.visibility', '=', visibility);
    }

    const orderColumn =
        sortBy === 'title' ? 'projects.title' : sortBy === 'created_at' ? 'projects.created_at' : 'projects.id';
    query = query.orderBy(orderColumn, sortOrder);

    const projects = await query.limit(limit).offset(offset).execute();

    let countQuery = db
        .selectFrom('projects')
        .innerJoin('users', 'projects.owner_id', 'users.id')
        .select(sql<number>`count(projects.id)`.as('count'));

    // Filter by saved_once (exclude unsaved projects by default)
    if (savedOnly) {
        countQuery = countQuery.where('projects.saved_once', '=', 1);
    }

    if (owner) {
        const ownerId = parseInt(owner, 10);
        countQuery = countQuery.where(eb => {
            const predicates = [eb('users.email', 'like', `%${owner}%`), eb('users.user_id', 'like', `%${owner}%`)];
            if (!Number.isNaN(ownerId)) {
                predicates.push(eb('users.id', '=', ownerId));
            }
            return eb.or(predicates);
        });
    }

    if (title) {
        countQuery = countQuery.where('projects.title', 'like', `%${title}%`);
    }

    if (status) {
        countQuery = countQuery.where('projects.status', '=', status);
    }

    if (visibility) {
        countQuery = countQuery.where('projects.visibility', '=', visibility);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count ?? 0);

    return { projects: projects as AdminProjectListItem[], total };
}

/**
 * Count users with admin role
 * Note: Filters in memory since JSON search varies by database dialect
 */
export async function countAdmins(db: Kysely<Database>): Promise<number> {
    const allUsers = await db.selectFrom('users').select(['id', 'roles']).execute();

    let count = 0;
    for (const user of allUsers) {
        const roles = parseRoles(user.roles);
        if (roles.includes(ROLES.ADMIN)) {
            count++;
        }
    }

    return count;
}

/**
 * Update user status (active/inactive)
 */
export async function updateUserStatus(
    db: Kysely<Database>,
    userId: number,
    isActive: boolean,
): Promise<User | undefined> {
    return updateByIdAndReturn(db, 'users', userId, {
        is_active: isActive ? 1 : 0,
        updated_at: now(),
    });
}

/**
 * Create a new user with admin-specified roles
 */
export async function createUserAsAdmin(
    db: Kysely<Database>,
    data: {
        email: string;
        password: string;
        userId?: string; // Optional: only for SSO users (CAS/OIDC)
        roles: string[];
        quotaMb?: number;
    },
): Promise<User> {
    const timestamp = now();

    // Ensure ROLE_USER is always present
    const roles = data.roles.includes(ROLES.USER) ? data.roles : [ROLES.USER, ...data.roles];

    return insertAndReturn(db, 'users', {
        email: data.email,
        password: data.password,
        user_id: data.userId ?? null, // null for local users, only set for SSO
        roles: stringifyRoles(roles),
        quota_mb: data.quotaMb ?? null,
        is_lopd_accepted: 0,
        is_active: 1,
        created_at: timestamp,
        updated_at: timestamp,
    });
}

/**
 * Update user quota
 */
export async function updateUserQuota(
    db: Kysely<Database>,
    userId: number,
    quotaMb: number | null,
): Promise<User | undefined> {
    return updateByIdAndReturn(db, 'users', userId, {
        quota_mb: quotaMb,
        updated_at: now(),
    });
}

// ============================================================================
// STATISTICS QUERIES
// ============================================================================

/**
 * Get system statistics for admin dashboard
 */
export async function getSystemStats(db: Kysely<Database>): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    activeProjects: number;
}> {
    const [userStats, projectStats] = await Promise.all([
        db
            .selectFrom('users')
            .select([sql<number>`count(id)`.as('total'), sql<number>`sum(is_active)`.as('active')])
            .executeTakeFirst(),
        db
            .selectFrom('projects')
            .select([sql<number>`count(id)`.as('total')])
            .executeTakeFirst(),
    ]);

    // Count active projects (status = 'active')
    const activeProjectsResult = await db
        .selectFrom('projects')
        .select(sql<number>`count(id)`.as('count'))
        .where('status', '=', 'active')
        .executeTakeFirst();

    return {
        totalUsers: Number(userStats?.total ?? 0),
        activeUsers: Number(userStats?.active ?? 0),
        totalProjects: Number(projectStats?.total ?? 0),
        activeProjects: Number(activeProjectsResult?.count ?? 0),
    };
}

// ============================================================================
// APP SETTINGS QUERIES (for future use when migration is added)
// ============================================================================

/**
 * Get all app settings
 * Note: Requires app_settings table to be created via migration
 */
export async function getAllSettings(db: Kysely<Database & { app_settings: AppSettingsTable }>): Promise<AppSetting[]> {
    return db.selectFrom('app_settings').selectAll().execute();
}

/**
 * Get setting by key
 */
export async function getSetting(
    db: Kysely<Database & { app_settings: AppSettingsTable }>,
    key: string,
): Promise<AppSetting | undefined> {
    return db.selectFrom('app_settings').selectAll().where('key', '=', key).executeTakeFirst();
}

/**
 * Set or update a setting
 */
export async function setSetting(
    db: Kysely<Database & { app_settings: AppSettingsTable }>,
    key: string,
    value: string,
    type: 'string' | 'number' | 'boolean' | 'json' = 'string',
    updatedBy?: number,
): Promise<void> {
    const timestamp = now();

    // Upsert: try update first, then insert if not exists
    const existing = await getSetting(db, key);

    if (existing) {
        await db
            .updateTable('app_settings')
            .set({
                value,
                type,
                updated_at: timestamp,
                updated_by: updatedBy ?? null,
            })
            .where('key', '=', key)
            .execute();
    } else {
        await db
            .insertInto('app_settings')
            .values({
                key,
                value,
                type,
                updated_at: timestamp,
                updated_by: updatedBy ?? null,
            })
            .execute();
    }
}

// ============================================================================
// TYPES
// ============================================================================

interface AppSettingsTable {
    key: string;
    value: string;
    type: string;
    updated_at: string | null;
    updated_by: number | null;
}

export type AppSetting = {
    key: string;
    value: string;
    type: string;
    updated_at: string | null;
    updated_by: number | null;
};
