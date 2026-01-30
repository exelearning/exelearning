/**
 * Admin Routes for Elysia
 * Protected endpoints for system administration
 * Requires ROLE_ADMIN for all routes
 */
import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import * as bcrypt from 'bcryptjs';
import { db as defaultDb } from '../db/client';
import type { Kysely } from 'kysely';
import type { Database, User } from '../db/types';
import { parseRoles } from '../db/types';
import type { JwtPayload } from './auth';
import {
    findUserById as findUserByIdDefault,
    findUserByEmail as findUserByEmailDefault,
    updateUserRoles as updateUserRolesDefault,
    deleteUser as deleteUserDefault,
} from '../db/queries/users';
import {
    findUsersPaginated as findUsersPaginatedDefault,
    countAdmins as countAdminsDefault,
    updateUserStatus as updateUserStatusDefault,
    createUserAsAdmin as createUserAsAdminDefault,
    updateUserQuota as updateUserQuotaDefault,
    getSystemStats as getSystemStatsDefault,
    getAllSettings as getAllSettingsDefault,
    setSetting as setSettingDefault,
    findProjectsPaginated as findProjectsPaginatedDefault,
} from '../db/queries/admin';
import {
    findProjectById as findProjectByIdDefault,
    updateProject as updateProjectDefault,
    hardDeleteProject as hardDeleteProjectDefault,
    findProjectsByOwnerId as findProjectsByOwnerIdDefault,
} from '../db/queries/projects';
import { getUserStorageUsage as getUserStorageUsageDefault } from '../db/queries/assets';
import { requireAdmin, hasRole, ROLES, PROTECTED_ROLE } from '../utils/guards';
import { getSystemInfo } from '../services/system-info';
import { createFileHelper, type FileHelper } from '../services/file-helper';

type AppSettingsTable = {
    key: string;
    value: string;
    type: string;
    updated_at: number | null; // Unix timestamp in milliseconds
    updated_by: number | null;
};

type AppSettingsDb = Kysely<Database & { app_settings: AppSettingsTable }>;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Query dependencies for admin routes
 */
export interface AdminQueries {
    findUserById: typeof findUserByIdDefault;
    findUserByEmail: typeof findUserByEmailDefault;
    findUsersPaginated: typeof findUsersPaginatedDefault;
    countAdmins: typeof countAdminsDefault;
    updateUserRoles: typeof updateUserRolesDefault;
    updateUserStatus: typeof updateUserStatusDefault;
    createUserAsAdmin: typeof createUserAsAdminDefault;
    updateUserQuota: typeof updateUserQuotaDefault;
    deleteUser: typeof deleteUserDefault;
    getSystemStats: typeof getSystemStatsDefault;
    getUserStorageUsage: typeof getUserStorageUsageDefault;
    getAllSettings: typeof getAllSettingsDefault;
    setSetting: typeof setSettingDefault;
    findProjectsPaginated: typeof findProjectsPaginatedDefault;
    findProjectById: typeof findProjectByIdDefault;
    updateProject: typeof updateProjectDefault;
    hardDeleteProject: typeof hardDeleteProjectDefault;
    findProjectsByOwnerId: typeof findProjectsByOwnerIdDefault;
}

/**
 * Dependencies for admin routes
 */
export interface AdminDependencies {
    db: Kysely<Database>;
    queries: AdminQueries;
    fileHelper?: FileHelper;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const defaultDependencies: AdminDependencies = {
    db: defaultDb,
    queries: {
        findUserById: findUserByIdDefault,
        findUserByEmail: findUserByEmailDefault,
        findUsersPaginated: findUsersPaginatedDefault,
        countAdmins: countAdminsDefault,
        updateUserRoles: updateUserRolesDefault,
        updateUserStatus: updateUserStatusDefault,
        createUserAsAdmin: createUserAsAdminDefault,
        updateUserQuota: updateUserQuotaDefault,
        deleteUser: deleteUserDefault,
        getSystemStats: getSystemStatsDefault,
        getUserStorageUsage: getUserStorageUsageDefault,
        getAllSettings: getAllSettingsDefault,
        setSetting: setSettingDefault,
        findProjectsPaginated: findProjectsPaginatedDefault,
        findProjectById: findProjectByIdDefault,
        updateProject: updateProjectDefault,
        hardDeleteProject: hardDeleteProjectDefault,
        findProjectsByOwnerId: findProjectsByOwnerIdDefault,
    },
    fileHelper: createFileHelper(),
};

// Get JWT secret (same as auth.ts)
const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse and validate an ID parameter from route params.
 * Returns the parsed number if valid, or null if invalid.
 * Sets status 400 and returns error response if invalid.
 */
function parseAndValidateId(
    paramsId: string,
    set: { status: number },
): { id: number } | { error: string; message: string } {
    const id = parseInt(paramsId, 10);
    if (isNaN(id)) {
        set.status = 400;
        return { error: 'BAD_REQUEST', message: 'Invalid ID' };
    }
    return { id };
}

/**
 * Sanitize user for API response (remove password)
 */
function sanitizeUser(user: User): Omit<User, 'password'> & { roles: string[] } {
    const { password: _password, ...rest } = user;
    return {
        ...rest,
        roles: parseRoles(user.roles),
    };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createUserSchema = t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 4 }),
    roles: t.Optional(t.Array(t.String())),
    quota_mb: t.Optional(t.Number()),
});

const updateRolesSchema = t.Object({
    roles: t.Array(t.String()),
});

const updateStatusSchema = t.Object({
    is_active: t.Boolean(),
});

const updateQuotaSchema = t.Object({
    quota_mb: t.Union([t.Number(), t.Null()]),
});

const updateProjectStatusSchema = t.Object({
    status: t.Union([t.Literal('active'), t.Literal('inactive'), t.Literal('archived')]),
});

const updateSettingsSchema = t.Object({
    settings: t.Array(
        t.Object({
            key: t.String(),
            value: t.String(),
            type: t.Union([t.Literal('string'), t.Literal('number'), t.Literal('boolean'), t.Literal('json')]),
        }),
    ),
});

const ADMIN_SETTINGS_DEFAULTS: Record<
    string,
    { value: string | number | boolean; type: 'string' | 'number' | 'boolean' | 'json' }
> = {
    ONLINE_THEMES_INSTALL: { value: process.env.ONLINE_THEMES_INSTALL ?? '0', type: 'boolean' },
    ONLINE_IDEVICES_INSTALL: { value: process.env.ONLINE_IDEVICES_INSTALL ?? '0', type: 'boolean' },
    APP_AUTH_METHODS: { value: process.env.APP_AUTH_METHODS || 'password,cas,openid,guest', type: 'string' },
    VERSION_CONTROL: { value: process.env.VERSION_CONTROL ?? 'true', type: 'boolean' },
    DEFAULT_PROJECT_VISIBILITY: { value: process.env.DEFAULT_PROJECT_VISIBILITY || 'private', type: 'string' },
    USER_RECENT_ODE_FILES_AMOUNT: { value: process.env.USER_RECENT_ODE_FILES_AMOUNT ?? '3', type: 'number' },
    COLLABORATIVE_BLOCK_LEVEL: { value: process.env.COLLABORATIVE_BLOCK_LEVEL || 'idevice', type: 'string' },
    USER_STORAGE_MAX_DISK_SPACE: { value: process.env.USER_STORAGE_MAX_DISK_SPACE ?? '1024', type: 'number' },
    DEFAULT_QUOTA: { value: process.env.DEFAULT_QUOTA ?? '4096', type: 'number' },
    COUNT_USER_AUTOSAVE_SPACE_ODE_FILES: {
        value: process.env.COUNT_USER_AUTOSAVE_SPACE_ODE_FILES ?? 'true',
        type: 'boolean',
    },
    FILE_UPLOAD_MAX_SIZE: { value: process.env.FILE_UPLOAD_MAX_SIZE ?? '1024', type: 'number' },
    PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL: {
        value: process.env.PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL ?? '600',
        type: 'number',
    },
    PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES: {
        value: process.env.PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES ?? '10',
        type: 'number',
    },
    AUTOSAVE_ODE_FILES_FUNCTION: { value: process.env.AUTOSAVE_ODE_FILES_FUNCTION ?? 'true', type: 'boolean' },
    CAS_URL: { value: process.env.CAS_URL || 'https://casserverpac4j.herokuapp.com', type: 'string' },
    CAS_VALIDATE_PATH: { value: process.env.CAS_VALIDATE_PATH || '/p3/serviceValidate', type: 'string' },
    CAS_LOGIN_PATH: { value: process.env.CAS_LOGIN_PATH || '/login', type: 'string' },
    CAS_LOGOUT_PATH: { value: process.env.CAS_LOGOUT_PATH || '/logout', type: 'string' },
    OIDC_ISSUER: { value: process.env.OIDC_ISSUER || 'https://demo.duendesoftware.com', type: 'string' },
    OIDC_AUTHORIZATION_ENDPOINT: {
        value: process.env.OIDC_AUTHORIZATION_ENDPOINT || 'https://demo.duendesoftware.com/connect/authorize',
        type: 'string',
    },
    OIDC_TOKEN_ENDPOINT: {
        value: process.env.OIDC_TOKEN_ENDPOINT || 'https://demo.duendesoftware.com/connect/token',
        type: 'string',
    },
    OIDC_USERINFO_ENDPOINT: {
        value: process.env.OIDC_USERINFO_ENDPOINT || 'https://demo.duendesoftware.com/connect/userinfo',
        type: 'string',
    },
    OIDC_SCOPE: { value: process.env.OIDC_SCOPE || 'openid email', type: 'string' },
    OIDC_CLIENT_ID: { value: process.env.OIDC_CLIENT_ID || 'interactive.confidential', type: 'string' },
    OIDC_CLIENT_SECRET: { value: process.env.OIDC_CLIENT_SECRET || 'secret', type: 'string' },
    GOOGLE_CLIENT_ID: {
        value: process.env.GOOGLE_CLIENT_ID || 'example.com.apps.googleusercontent.com',
        type: 'string',
    },
    GOOGLE_CLIENT_SECRET: { value: process.env.GOOGLE_CLIENT_SECRET || 'example.com', type: 'string' },
    DROPBOX_CLIENT_ID: { value: process.env.DROPBOX_CLIENT_ID || 'example.com', type: 'string' },
    DROPBOX_CLIENT_SECRET: { value: process.env.DROPBOX_CLIENT_SECRET || 'example.com', type: 'string' },
    OPENEQUELLA_CLIENT_ID: { value: process.env.OPENEQUELLA_CLIENT_ID || 'example.com', type: 'string' },
    OPENEQUELLA_CLIENT_SECRET: { value: process.env.OPENEQUELLA_CLIENT_SECRET || 'example.com', type: 'string' },
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create admin routes with dependency injection
 */
export function createAdminRoutes(deps: AdminDependencies = defaultDependencies) {
    const { db, queries, fileHelper = createFileHelper() } = deps;

    return (
        new Elysia({ name: 'admin-routes' })
            .use(cookie())
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )

            // Derive JWT payload from request
            .derive(async ({ jwt: jwtPlugin, cookie, request }) => {
                let token: string | undefined;

                // Get token from Authorization header
                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }

                if (!token) {
                    return { jwtPayload: null as JwtPayload | null };
                }

                try {
                    const payload = (await jwtPlugin.verify(token)) as JwtPayload | false;
                    return { jwtPayload: payload || null };
                } catch {
                    return { jwtPayload: null as JwtPayload | null };
                }
            })

            // Global guard: Require ROLE_ADMIN for all routes in this group
            .onBeforeHandle(({ set, jwtPayload }) => {
                const authError = requireAdmin(jwtPayload);
                if (authError) {
                    set.status = authError.status;
                    return {
                        error: authError.error,
                        message: authError.message,
                    };
                }
            })

            // =====================================================
            // DASHBOARD / STATS
            // =====================================================

            // GET /api/admin/stats - Get system statistics
            .get('/api/admin/stats', async () => {
                const stats = await queries.getSystemStats(db);
                return {
                    ...stats,
                    timestamp: new Date().toISOString(),
                };
            })

            // GET /api/admin/system-info - Get system information (runtime, db, memory, etc.)
            .get('/api/admin/system-info', async () => {
                return await getSystemInfo();
            })

            // =====================================================
            // APP SETTINGS
            // =====================================================

            // GET /api/admin/settings - Get admin settings (defaults + overrides)
            .get('/api/admin/settings', async () => {
                const stored = await queries.getAllSettings(db as unknown as AppSettingsDb);
                const storedMap = new Map(stored.map(item => [item.key, item]));

                const settings: Record<string, { value: string | number | boolean; type: string }> = {};
                for (const [key, def] of Object.entries(ADMIN_SETTINGS_DEFAULTS)) {
                    const override = storedMap.get(key);
                    settings[key] = {
                        value: override ? override.value : def.value,
                        type: override ? override.type : def.type,
                    };
                }

                return { settings };
            })

            // PUT /api/admin/settings - Update admin settings
            .put(
                '/api/admin/settings',
                async ({ body, set, jwtPayload }) => {
                    const data = body as { settings: Array<{ key: string; value: string; type: string }> };

                    for (const setting of data.settings) {
                        const def = ADMIN_SETTINGS_DEFAULTS[setting.key];
                        if (!def) {
                            set.status = 400;
                            return { error: 'Bad Request', message: `Unknown setting: ${setting.key}` };
                        }

                        if (setting.key === 'APP_AUTH_METHODS') {
                            const methods = setting.value
                                .split(',')
                                .map(m => m.trim())
                                .filter(Boolean);
                            const allowedMethods = new Set(['password', 'cas', 'openid', 'guest']);
                            const invalid = methods.filter(method => !allowedMethods.has(method));
                            if (methods.length === 0) {
                                set.status = 400;
                                return {
                                    error: 'Bad Request',
                                    message: 'APP_AUTH_METHODS must include at least one method',
                                };
                            }
                            if (invalid.length > 0) {
                                set.status = 400;
                                return {
                                    error: 'Bad Request',
                                    message: `APP_AUTH_METHODS has invalid values: ${invalid.join(', ')}`,
                                };
                            }
                        }

                        try {
                            await queries.setSetting(
                                db as unknown as AppSettingsDb,
                                setting.key,
                                setting.value,
                                setting.type as 'string' | 'number' | 'boolean' | 'json',
                                jwtPayload?.sub ? Number(jwtPayload.sub) : undefined,
                            );
                        } catch (error) {
                            set.status = 500;
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            return {
                                error: 'Internal Server Error',
                                message: `Failed to save ${setting.key}: ${errorMessage}`,
                            };
                        }
                    }

                    return { success: true };
                },
                { body: updateSettingsSchema },
            )

            // =====================================================
            // USER MANAGEMENT
            // =====================================================

            // GET /api/admin/users - List all users (paginated)
            .get('/api/admin/users', async ({ query }) => {
                const limit = Math.min(parseInt((query.limit as string) || '50', 10), 100);
                const offset = parseInt((query.offset as string) || '0', 10);
                const search = query.search as string | undefined;
                const sortBy = (query.sortBy as 'id' | 'email' | 'created_at') || 'id';
                const sortOrder = (query.sortOrder as 'asc' | 'desc') || 'asc';

                const { users, total } = await queries.findUsersPaginated(db, {
                    limit,
                    offset,
                    search,
                    sortBy,
                    sortOrder,
                });

                // Calculate storage usage for each user
                const usersWithStorage = await Promise.all(
                    users.map(async user => {
                        const storageBytes = await queries.getUserStorageUsage(db, user.id);
                        const storageMB = Math.round(storageBytes / (1024 * 1024));
                        return {
                            ...sanitizeUser(user),
                            storage_used_mb: storageMB,
                        };
                    }),
                );

                return {
                    users: usersWithStorage,
                    total,
                    limit,
                    offset,
                };
            })

            // GET /api/admin/users/:id - Get user by ID
            .get('/api/admin/users/:id', async ({ params, set }) => {
                const parsed = parseAndValidateId(params.id, set);
                if ('error' in parsed) return parsed;

                const user = await queries.findUserById(db, parsed.id);
                if (!user) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'User not found' };
                }

                return { user: sanitizeUser(user) };
            })

            // POST /api/admin/users - Create new user
            .post(
                '/api/admin/users',
                async ({ body, set }) => {
                    // Check if email already exists
                    const existing = await queries.findUserByEmail(db, body.email);
                    if (existing) {
                        set.status = 409;
                        return { error: 'CONFLICT', message: 'Email already registered' };
                    }

                    // Hash password
                    const hashedPassword = await bcrypt.hash(body.password, 10);

                    // Default roles if not provided
                    const roles = body.roles || [ROLES.USER];

                    // Generate user_id from email
                    const userId = body.email.split('@')[0] + '_' + Date.now();

                    const user = await queries.createUserAsAdmin(db, {
                        email: body.email,
                        password: hashedPassword,
                        userId,
                        roles,
                        quotaMb: body.quota_mb,
                    });

                    set.status = 201;
                    return { user: sanitizeUser(user) };
                },
                { body: createUserSchema },
            )

            // PATCH /api/admin/users/:id/roles - Update user roles
            .patch(
                '/api/admin/users/:id/roles',
                async ({ params, body, set, jwtPayload }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;
                    const userId = parsed.id;

                    // Get target user
                    const targetUser = await queries.findUserById(db, userId);
                    if (!targetUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    let newRoles = body.roles;

                    // Ensure ROLE_USER is always present
                    if (!newRoles.includes(PROTECTED_ROLE)) {
                        newRoles = [PROTECTED_ROLE, ...newRoles];
                    }

                    // Check for self-degradation (removing own admin role)
                    const currentUserId = jwtPayload!.sub;
                    const isRemovingOwnAdminRole =
                        currentUserId === userId &&
                        hasRole(jwtPayload!.roles, ROLES.ADMIN) &&
                        !newRoles.includes(ROLES.ADMIN);

                    if (isRemovingOwnAdminRole) {
                        // Check if this is the last admin
                        const adminCount = await queries.countAdmins(db);
                        if (adminCount <= 1) {
                            set.status = 400;
                            return {
                                error: 'CANNOT_REMOVE_LAST_ADMIN',
                                message: 'Cannot remove admin role from the last administrator',
                            };
                        }
                    }

                    const updatedUser = await queries.updateUserRoles(db, userId, newRoles);
                    if (!updatedUser) {
                        set.status = 500;
                        return { error: 'UPDATE_FAILED', message: 'Failed to update roles' };
                    }

                    return { user: sanitizeUser(updatedUser) };
                },
                { body: updateRolesSchema },
            )

            // PATCH /api/admin/users/:id/status - Activate/deactivate user
            .patch(
                '/api/admin/users/:id/status',
                async ({ params, body, set, jwtPayload }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;
                    const userId = parsed.id;

                    // Prevent deactivating yourself
                    if (jwtPayload!.sub === userId && !body.is_active) {
                        set.status = 400;
                        return { error: 'CANNOT_DEACTIVATE_SELF', message: 'Cannot deactivate your own account' };
                    }

                    const updatedUser = await queries.updateUserStatus(db, userId, body.is_active);
                    if (!updatedUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    return { user: sanitizeUser(updatedUser) };
                },
                { body: updateStatusSchema },
            )

            // PATCH /api/admin/users/:id/quota - Update user quota
            .patch(
                '/api/admin/users/:id/quota',
                async ({ params, body, set }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;

                    const updatedUser = await queries.updateUserQuota(db, parsed.id, body.quota_mb);
                    if (!updatedUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    return { user: sanitizeUser(updatedUser) };
                },
                { body: updateQuotaSchema },
            )

            // =====================================================
            // PROJECT MANAGEMENT
            // =====================================================

            // GET /api/admin/projects - List projects with filters
            .get('/api/admin/projects', async ({ query }) => {
                const limit = Math.min(parseInt((query.limit as string) || '50', 10), 100);
                const offset = parseInt((query.offset as string) || '0', 10);
                const owner = (query.owner as string | undefined)?.trim();
                const title = (query.title as string | undefined)?.trim();
                const status = (query.status as string | undefined)?.trim();
                const visibility = (query.visibility as string | undefined)?.trim();
                const sortByRaw = (query.sortBy as string | undefined)?.trim();
                const sortOrderRaw = (query.sortOrder as string | undefined)?.trim();
                const allowedSortBy = new Set(['id', 'title', 'created_at']);
                const allowedSortOrder = new Set(['asc', 'desc']);
                const sortBy = (sortByRaw && allowedSortBy.has(sortByRaw) ? sortByRaw : 'id') as
                    | 'id'
                    | 'title'
                    | 'created_at';
                const sortOrder = (sortOrderRaw && allowedSortOrder.has(sortOrderRaw) ? sortOrderRaw : 'desc') as
                    | 'asc'
                    | 'desc';

                const allowedStatuses = new Set(['active', 'inactive', 'archived']);
                const allowedVisibility = new Set(['public', 'private']);

                const parsedStatus = status && allowedStatuses.has(status) ? status : undefined;
                const parsedVisibility = visibility && allowedVisibility.has(visibility) ? visibility : undefined;

                const { projects, total } = await queries.findProjectsPaginated(db, {
                    limit,
                    offset,
                    owner,
                    title,
                    status: parsedStatus,
                    visibility: parsedVisibility,
                    sortBy,
                    sortOrder,
                });

                return { projects, total };
            })

            // PATCH /api/admin/projects/:id/status - Update project status
            .patch(
                '/api/admin/projects/:id/status',
                async ({ params, body, set }) => {
                    const parsed = parseAndValidateId(params.id, set);
                    if ('error' in parsed) return parsed;

                    const updated = await queries.updateProject(db, parsed.id, {
                        status: body.status,
                    });

                    if (!updated) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'Project not found' };
                    }

                    return { project: updated };
                },
                { body: updateProjectStatusSchema },
            )

            // DELETE /api/admin/projects/:id - Hard delete project
            .delete('/api/admin/projects/:id', async ({ params, set }) => {
                const parsed = parseAndValidateId(params.id, set);
                if ('error' in parsed) return parsed;

                const project = await queries.findProjectById(db, parsed.id);
                if (!project) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'Project not found' };
                }

                await queries.hardDeleteProject(db, parsed.id);
                return { success: true };
            })

            // DELETE /api/admin/users/:id - Delete user
            .delete('/api/admin/users/:id', async ({ params, set, jwtPayload }) => {
                const parsed = parseAndValidateId(params.id, set);
                if ('error' in parsed) return parsed;
                const userId = parsed.id;

                // Prevent deleting yourself
                if (jwtPayload!.sub === userId) {
                    set.status = 400;
                    return { error: 'CANNOT_DELETE_SELF', message: 'Cannot delete your own account' };
                }

                // Check if user exists
                const user = await queries.findUserById(db, userId);
                if (!user) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'User not found' };
                }

                // Check if deleting last admin
                const userRoles = parseRoles(user.roles);
                if (hasRole(userRoles, ROLES.ADMIN)) {
                    const adminCount = await queries.countAdmins(db);
                    if (adminCount <= 1) {
                        set.status = 400;
                        return {
                            error: 'CANNOT_DELETE_LAST_ADMIN',
                            message: 'Cannot delete the last administrator',
                        };
                    }
                }

                // Get all projects owned by user before deletion
                // (needed to clean up asset directories - DB cascade will delete records)
                const userProjects = await queries.findProjectsByOwnerId(db, userId);
                const deletedProjectsCount = userProjects.length;

                // Clean up asset directories for each project
                // Continue even if some cleanups fail - the DB cascade will still remove records
                for (const project of userProjects) {
                    try {
                        const assetsDir = fileHelper.getProjectAssetsDir(project.uuid);
                        const exists = await fileHelper.fileExists(assetsDir);
                        if (exists) {
                            await fileHelper.remove(assetsDir);
                        }
                    } catch (err) {
                        console.error(`Failed to clean up assets for project ${project.uuid}:`, err);
                        // Continue with deletion - DB cascade will handle records
                    }
                }

                // Delete user - DB cascade will delete projects and related records
                await queries.deleteUser(db, userId);

                return {
                    success: true,
                    message: 'User deleted',
                    deletedProjectsCount,
                };
            })
    );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Admin routes with default (real) dependencies
 */
export const adminRoutes = createAdminRoutes();
