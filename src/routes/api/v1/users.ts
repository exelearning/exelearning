/**
 * Users REST API Endpoints (Admin Only)
 *
 * CRUD operations for user management.
 * Only accessible by users with ROLE_ADMIN.
 */
import { Elysia } from 'elysia';
import { db } from '../../../db/client';
import {
    findUserById,
    findUserByEmail,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
} from '../../../db/queries/users';
import {
    authenticateRequest,
    errorResponse,
    successResponse,
    isAdmin,
    CreateUserBody,
    UpdateUserBody,
    UserIdParam,
} from './types';

// ============================================================================
// HELPERS
// ============================================================================

function parseRoles(roles: string | string[] | null): string[] {
    if (!roles) return [];
    if (Array.isArray(roles)) return roles;
    try {
        return JSON.parse(roles);
    } catch {
        return [];
    }
}

// ============================================================================
// ROUTES
// ============================================================================

export const usersRoutes = new Elysia({ prefix: '/users' })
    // List all users (admin only)
    .get(
        '/',
        async ({ headers, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            if (!isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'Admin access required');
            }

            const users = await getAllUsers(db);

            return successResponse(
                users.map(u => ({
                    id: u.id,
                    email: u.email,
                    roles: parseRoles(u.roles),
                    created_at: u.created_at,
                    updated_at: u.updated_at,
                })),
            );
        },
        {
            detail: {
                summary: 'List Users',
                description: 'Get all users (admin only)',
                tags: ['Users'],
            },
        },
    )

    // Create a new user (admin only)
    .post(
        '/',
        async ({ headers, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            if (!isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'Admin access required');
            }

            // Check if email already exists
            const existing = await findUserByEmail(db, body.email);
            if (existing) {
                set.status = 409;
                return errorResponse('CONFLICT', 'User with this email already exists');
            }

            // Hash password
            const hashedPassword = await Bun.password.hash(body.password, { algorithm: 'bcrypt' });

            // Create user
            // user_id: not set for API-created users (null) - they're not SSO
            const roles = body.roles || ['ROLE_USER'];
            const result = await createUser(db, {
                email: body.email,
                password: hashedPassword,
                roles: JSON.stringify(roles),
                is_lopd_accepted: 1,
                quota_mb: 4096, // Default quota
                is_active: 1,
            });

            const newUser = await findUserById(db, Number(result.insertId));

            set.status = 201;
            return successResponse({
                id: newUser!.id,
                email: newUser!.email,
                roles: parseRoles(newUser!.roles),
                created_at: newUser!.created_at,
                updated_at: newUser!.updated_at,
            });
        },
        {
            body: CreateUserBody,
            detail: {
                summary: 'Create User',
                description: 'Create a new user (admin only)',
                tags: ['Users'],
            },
        },
    )

    // Get a specific user (admin only)
    .get(
        '/:id',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            if (!isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'Admin access required');
            }

            const user = await findUserById(db, params.id);

            if (!user) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `User not found: ${params.id}`);
            }

            return successResponse({
                id: user.id,
                email: user.email,
                roles: parseRoles(user.roles),
                created_at: user.created_at,
                updated_at: user.updated_at,
            });
        },
        {
            params: UserIdParam,
            detail: {
                summary: 'Get User',
                description: 'Get a specific user by ID (admin only)',
                tags: ['Users'],
            },
        },
    )

    // Update a user (admin only)
    .patch(
        '/:id',
        async ({ headers, params, body, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            if (!isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'Admin access required');
            }

            const user = await findUserById(db, params.id);

            if (!user) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `User not found: ${params.id}`);
            }

            // Build updates
            const updates: Record<string, unknown> = {};

            if (body.email !== undefined) {
                // Check for email conflict
                const existing = await findUserByEmail(db, body.email);
                if (existing && existing.id !== params.id) {
                    set.status = 409;
                    return errorResponse('CONFLICT', 'Email already in use');
                }
                updates.email = body.email;
            }

            if (body.password !== undefined) {
                updates.password = await Bun.password.hash(body.password, { algorithm: 'bcrypt' });
            }

            if (body.roles !== undefined) {
                updates.roles = JSON.stringify(body.roles);
            }

            if (Object.keys(updates).length > 0) {
                await updateUser(db, params.id, updates);
            }

            const updatedUser = await findUserById(db, params.id);

            return successResponse({
                id: updatedUser!.id,
                email: updatedUser!.email,
                roles: parseRoles(updatedUser!.roles),
                created_at: updatedUser!.created_at,
                updated_at: updatedUser!.updated_at,
            });
        },
        {
            params: UserIdParam,
            body: UpdateUserBody,
            detail: {
                summary: 'Update User',
                description: 'Update user details (admin only)',
                tags: ['Users'],
            },
        },
    )

    // Delete a user (admin only)
    .delete(
        '/:id',
        async ({ headers, params, set }) => {
            const authResult = await authenticateRequest(headers);
            if (!authResult.success) {
                set.status = authResult.status;
                return authResult.response;
            }
            const auth = authResult.user;

            if (!isAdmin(auth)) {
                set.status = 403;
                return errorResponse('FORBIDDEN', 'Admin access required');
            }

            const user = await findUserById(db, params.id);

            if (!user) {
                set.status = 404;
                return errorResponse('NOT_FOUND', `User not found: ${params.id}`);
            }

            // Prevent self-deletion
            if (user.id === auth.userId) {
                set.status = 400;
                return errorResponse('BAD_REQUEST', 'Cannot delete your own account');
            }

            await deleteUser(db, params.id);

            return successResponse({ deleted: true, id: params.id });
        },
        {
            params: UserIdParam,
            detail: {
                summary: 'Delete User',
                description: 'Delete a user (admin only)',
                tags: ['Users'],
            },
        },
    );
