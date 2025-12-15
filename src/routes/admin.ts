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
} from '../db/queries/admin';
import { requireAdmin, hasRole, ROLES, PROTECTED_ROLE } from '../utils/guards';

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
}

/**
 * Dependencies for admin routes
 */
export interface AdminDependencies {
    db: Kysely<Database>;
    queries: AdminQueries;
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
    },
};

// Get JWT secret (same as auth.ts)
const getJwtSecret = () => {
    return process.env.JWT_SECRET || process.env.APP_SECRET || 'elysia-dev-secret-change-me';
};

// ============================================================================
// HELPERS
// ============================================================================

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

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create admin routes with dependency injection
 */
export function createAdminRoutes(deps: AdminDependencies = defaultDependencies) {
    const { db, queries } = deps;

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

                return {
                    users: users.map(sanitizeUser),
                    total,
                    limit,
                    offset,
                };
            })

            // GET /api/admin/users/:id - Get user by ID
            .get('/api/admin/users/:id', async ({ params, set }) => {
                const userId = parseInt(params.id, 10);

                if (isNaN(userId)) {
                    set.status = 400;
                    return { error: 'BAD_REQUEST', message: 'Invalid user ID' };
                }

                const user = await queries.findUserById(db, userId);
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
                    const userId = parseInt(params.id, 10);

                    if (isNaN(userId)) {
                        set.status = 400;
                        return { error: 'BAD_REQUEST', message: 'Invalid user ID' };
                    }

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
                    const userId = parseInt(params.id, 10);

                    if (isNaN(userId)) {
                        set.status = 400;
                        return { error: 'BAD_REQUEST', message: 'Invalid user ID' };
                    }

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
                    const userId = parseInt(params.id, 10);

                    if (isNaN(userId)) {
                        set.status = 400;
                        return { error: 'BAD_REQUEST', message: 'Invalid user ID' };
                    }

                    const updatedUser = await queries.updateUserQuota(db, userId, body.quota_mb);
                    if (!updatedUser) {
                        set.status = 404;
                        return { error: 'NOT_FOUND', message: 'User not found' };
                    }

                    return { user: sanitizeUser(updatedUser) };
                },
                { body: updateQuotaSchema },
            )

            // DELETE /api/admin/users/:id - Delete user
            .delete('/api/admin/users/:id', async ({ params, set, jwtPayload }) => {
                const userId = parseInt(params.id, 10);

                if (isNaN(userId)) {
                    set.status = 400;
                    return { error: 'BAD_REQUEST', message: 'Invalid user ID' };
                }

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

                await queries.deleteUser(db, userId);

                return { success: true, message: 'User deleted' };
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
