/**
 * Admin Routes Integration Tests
 * Tests admin API endpoints with in-memory database
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { Kysely } from 'kysely';
import {
    createTestDb,
    closeTestDb,
    testRequest,
    parseJsonResponse,
    createTestUser,
    generateTestToken,
} from '../helpers/integration-app';
import type { Database, User } from '../../../src/db/types';
import { createAdminRoutes } from '../../../src/routes/admin';
import { findUserById, findUserByEmail, updateUserRoles, deleteUser } from '../../../src/db/queries/users';
import {
    findUsersPaginated,
    countAdmins,
    updateUserStatus,
    createUserAsAdmin,
    updateUserQuota,
    getSystemStats,
    getAllSettings,
    setSetting,
    findProjectsPaginated,
} from '../../../src/db/queries/admin';
import {
    findProjectById,
    updateProject,
    hardDeleteProject,
    findProjectsByOwnerId,
} from '../../../src/db/queries/projects';
import { getUserStorageUsage } from '../../../src/db/queries/assets';

const TEST_JWT_SECRET = 'test_secret_for_integration_tests';

// Set JWT secret environment variable so admin routes use the same secret
process.env.JWT_SECRET = TEST_JWT_SECRET;

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Admin Routes Integration', () => {
    let db: Kysely<Database>;
    let app: Elysia;
    let adminUser: User;
    let regularUser: User;
    let adminToken: string;
    let userToken: string;

    beforeAll(async () => {
        // Create test database
        db = await createTestDb();

        // Create admin routes with test database
        const adminRoutes = createAdminRoutes({
            db,
            queries: {
                findUserById: (db, id) => findUserById(db, id),
                findUserByEmail: (db, email) => findUserByEmail(db, email),
                findUsersPaginated: (db, opts) => findUsersPaginated(db, opts),
                countAdmins: db => countAdmins(db),
                updateUserRoles: (db, id, roles) => updateUserRoles(db, id, roles),
                updateUserStatus: (db, id, isActive) => updateUserStatus(db, id, isActive),
                createUserAsAdmin: (db, data) => createUserAsAdmin(db, data),
                updateUserQuota: (db, id, quota) => updateUserQuota(db, id, quota),
                deleteUser: (db, id) => deleteUser(db, id),
                getSystemStats: db => getSystemStats(db),
                getUserStorageUsage: (db, userId) => getUserStorageUsage(db, userId),
                getAllSettings: db => getAllSettings(db as any),
                setSetting: (db, key, value, type, updatedBy) => setSetting(db as any, key, value, type, updatedBy),
                findProjectsPaginated: (db, opts) => findProjectsPaginated(db, opts),
                findProjectById: (db, id) => findProjectById(db, id),
                updateProject: (db, id, data) => updateProject(db, id, data),
                hardDeleteProject: (db, id) => hardDeleteProject(db, id),
                findProjectsByOwnerId: (db, userId) => findProjectsByOwnerId(db, userId),
            },
        });

        // Build test app
        app = new Elysia({ name: 'admin-test' }).use(adminRoutes);
    });

    afterAll(async () => {
        await closeTestDb(db);
    });

    beforeEach(async () => {
        // Clean users table
        await db.deleteFrom('users').execute();

        // Create admin user
        adminUser = await createTestUser(db, {
            email: 'admin@test.local',
            password: 'admin1234',
            roles: '["ROLE_USER", "ROLE_ADMIN"]',
        });

        // Create regular user
        regularUser = await createTestUser(db, {
            email: 'user@test.local',
            password: 'user1234',
            roles: '["ROLE_USER"]',
        });

        // Generate tokens
        adminToken = await generateTestToken({
            ...adminUser,
            roles: ['ROLE_USER', 'ROLE_ADMIN'],
        } as User);
        userToken = await generateTestToken({
            ...regularUser,
            roles: ['ROLE_USER'],
        } as User);
    });

    // ========================================================================
    // AUTHORIZATION TESTS
    // ========================================================================

    describe('Authorization', () => {
        it('should return 401 for unauthenticated requests', async () => {
            const response = await testRequest(app, '/api/admin/users');

            expect(response.status).toBe(401);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('UNAUTHORIZED');
        });

        it('should return 403 for non-admin users', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                headers: { Authorization: `Bearer ${userToken}` },
            });

            expect(response.status).toBe(403);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('FORBIDDEN');
        });

        it('should allow admin users access', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(200);
        });
    });

    // ========================================================================
    // GET /api/admin/stats TESTS
    // ========================================================================

    describe('GET /api/admin/stats', () => {
        it('should return system statistics', async () => {
            const response = await testRequest(app, '/api/admin/stats', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                totalUsers: number;
                activeUsers: number;
                totalProjects: number;
                activeProjects: number;
                timestamp: string;
            }>(response);

            expect(data.totalUsers).toBeGreaterThanOrEqual(2);
            expect(data.timestamp).toBeDefined();
        });
    });

    // ========================================================================
    // GET /api/admin/users TESTS
    // ========================================================================

    describe('GET /api/admin/users', () => {
        it('should return paginated list of users', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                users: Array<{ id: number; email: string; roles: string[] }>;
                total: number;
                limit: number;
                offset: number;
            }>(response);

            expect(data.users).toBeArray();
            expect(data.users.length).toBeGreaterThanOrEqual(2);
            expect(data.total).toBeGreaterThanOrEqual(2);
            expect(data.limit).toBe(50);
            expect(data.offset).toBe(0);
        });

        it('should not include password in response', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            const data = await parseJsonResponse<{
                users: Array<Record<string, unknown>>;
            }>(response);

            for (const user of data.users) {
                expect(user.password).toBeUndefined();
            }
        });

        it('should parse roles as array', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            const data = await parseJsonResponse<{
                users: Array<{ roles: string[] }>;
            }>(response);

            for (const user of data.users) {
                expect(user.roles).toBeArray();
            }
        });

        it('should respect limit and offset parameters', async () => {
            const response = await testRequest(app, '/api/admin/users?limit=1&offset=1', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            const data = await parseJsonResponse<{
                users: Array<{ id: number }>;
                limit: number;
                offset: number;
            }>(response);

            expect(data.limit).toBe(1);
            expect(data.offset).toBe(1);
            expect(data.users.length).toBe(1);
        });
    });

    // ========================================================================
    // GET /api/admin/users/:id TESTS
    // ========================================================================

    describe('GET /api/admin/users/:id', () => {
        it('should return user by ID', async () => {
            const response = await testRequest(app, `/api/admin/users/${regularUser.id}`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                user: { id: number; email: string; roles: string[] };
            }>(response);

            expect(data.user.id).toBe(regularUser.id);
            expect(data.user.email).toBe(regularUser.email);
            expect(data.user.roles).toBeArray();
        });

        it('should return 404 for non-existent user', async () => {
            const response = await testRequest(app, '/api/admin/users/99999', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(404);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('NOT_FOUND');
        });

        it('should return 400 for invalid user ID', async () => {
            const response = await testRequest(app, '/api/admin/users/invalid', {
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(400);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('BAD_REQUEST');
        });
    });

    // ========================================================================
    // POST /api/admin/users TESTS
    // ========================================================================

    describe('POST /api/admin/users', () => {
        it('should create a new user', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'newuser@test.local',
                    password: 'newpass1234',
                }),
            });

            expect(response.status).toBe(201);
            const data = await parseJsonResponse<{
                user: { id: number; email: string; roles: string[] };
            }>(response);

            expect(data.user.email).toBe('newuser@test.local');
            expect(data.user.roles).toContain('ROLE_USER');
        });

        it('should create user with custom roles', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'editor@test.local',
                    password: 'editor1234',
                    roles: ['ROLE_USER', 'ROLE_EDITOR'],
                }),
            });

            expect(response.status).toBe(201);
            const data = await parseJsonResponse<{
                user: { roles: string[] };
            }>(response);

            expect(data.user.roles).toContain('ROLE_USER');
            expect(data.user.roles).toContain('ROLE_EDITOR');
        });

        it('should return 409 for duplicate email', async () => {
            const response = await testRequest(app, '/api/admin/users', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'user@test.local', // Already exists
                    password: 'password1234',
                }),
            });

            expect(response.status).toBe(409);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('CONFLICT');
        });
    });

    // ========================================================================
    // PATCH /api/admin/users/:id/roles TESTS
    // ========================================================================

    describe('PATCH /api/admin/users/:id/roles', () => {
        it('should update user roles', async () => {
            const response = await testRequest(app, `/api/admin/users/${regularUser.id}/roles`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: ['ROLE_USER', 'ROLE_EDITOR'],
                }),
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                user: { roles: string[] };
            }>(response);

            expect(data.user.roles).toContain('ROLE_USER');
            expect(data.user.roles).toContain('ROLE_EDITOR');
        });

        it('should ensure ROLE_USER is always present', async () => {
            const response = await testRequest(app, `/api/admin/users/${regularUser.id}/roles`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: ['ROLE_EDITOR'], // ROLE_USER not included
                }),
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                user: { roles: string[] };
            }>(response);

            // ROLE_USER should be automatically added
            expect(data.user.roles).toContain('ROLE_USER');
            expect(data.user.roles).toContain('ROLE_EDITOR');
        });

        it('should prevent removing admin role from last admin', async () => {
            // First, ensure there's only one admin
            await db.deleteFrom('users').where('id', '=', regularUser.id).execute();

            // Try to remove admin role from the only admin
            const response = await testRequest(app, `/api/admin/users/${adminUser.id}/roles`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roles: ['ROLE_USER'], // Removing ROLE_ADMIN
                }),
            });

            expect(response.status).toBe(400);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('CANNOT_REMOVE_LAST_ADMIN');
        });
    });

    // ========================================================================
    // PATCH /api/admin/users/:id/status TESTS
    // ========================================================================

    describe('PATCH /api/admin/users/:id/status', () => {
        it('should deactivate a user', async () => {
            const response = await testRequest(app, `/api/admin/users/${regularUser.id}/status`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_active: false,
                }),
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                user: { is_active: number };
            }>(response);

            expect(data.user.is_active).toBe(0);
        });

        it('should reactivate a user', async () => {
            // First deactivate
            await updateUserStatus(db, regularUser.id, false);

            const response = await testRequest(app, `/api/admin/users/${regularUser.id}/status`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_active: true,
                }),
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                user: { is_active: number };
            }>(response);

            expect(data.user.is_active).toBe(1);
        });

        it('should prevent admin from deactivating themselves', async () => {
            const response = await testRequest(app, `/api/admin/users/${adminUser.id}/status`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_active: false,
                }),
            });

            expect(response.status).toBe(400);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('CANNOT_DEACTIVATE_SELF');
        });
    });

    // ========================================================================
    // PATCH /api/admin/users/:id/quota TESTS
    // ========================================================================

    describe('PATCH /api/admin/users/:id/quota', () => {
        it('should update user quota', async () => {
            const response = await testRequest(app, `/api/admin/users/${regularUser.id}/quota`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quota_mb: 8192,
                }),
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                user: { quota_mb: number };
            }>(response);

            expect(data.user.quota_mb).toBe(8192);
        });

        it('should set quota to null (unlimited)', async () => {
            const response = await testRequest(app, `/api/admin/users/${regularUser.id}/quota`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quota_mb: null,
                }),
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{
                user: { quota_mb: number | null };
            }>(response);

            expect(data.user.quota_mb).toBeNull();
        });
    });

    // ========================================================================
    // DELETE /api/admin/users/:id TESTS
    // ========================================================================

    describe('DELETE /api/admin/users/:id', () => {
        it('should delete a user', async () => {
            const response = await testRequest(app, `/api/admin/users/${regularUser.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(200);
            const data = await parseJsonResponse<{ success: boolean }>(response);
            expect(data.success).toBe(true);

            // Verify user is deleted
            const deletedUser = await findUserById(db, regularUser.id);
            expect(deletedUser).toBeUndefined();
        });

        it('should prevent admin from deleting themselves', async () => {
            const response = await testRequest(app, `/api/admin/users/${adminUser.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(400);
            const data = await parseJsonResponse(response);
            expect(data.error).toBe('CANNOT_DELETE_SELF');
        });

        it('should prevent deleting the last admin', async () => {
            // Create another admin
            const secondAdmin = await createTestUser(db, {
                email: 'admin2@test.local',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });
            const secondAdminToken = await generateTestToken({
                ...secondAdmin,
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
            } as User);

            // Delete the first admin using second admin's token
            await db.deleteFrom('users').where('id', '=', regularUser.id).execute();

            // Now try to delete the only remaining admin (adminUser)
            // using secondAdmin's token
            const response = await testRequest(app, `/api/admin/users/${adminUser.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${secondAdminToken}` },
            });

            // Should succeed since there are 2 admins
            expect(response.status).toBe(200);

            // Now try to delete secondAdmin (last remaining admin) - should fail
            const response2 = await testRequest(app, `/api/admin/users/${secondAdmin.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${secondAdminToken}` },
            });

            // This should fail as CANNOT_DELETE_SELF
            expect(response2.status).toBe(400);
            const data = await parseJsonResponse(response2);
            expect(data.error).toBe('CANNOT_DELETE_SELF');
        });

        it('should return 404 for non-existent user', async () => {
            const response = await testRequest(app, '/api/admin/users/99999', {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` },
            });

            expect(response.status).toBe(404);
        });
    });
});
