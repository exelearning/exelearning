/**
 * Admin Routes Unit Tests
 * Tests for admin API routes with DI and JWT authentication
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { createAdminRoutes, type AdminDependencies, type AdminQueries } from './admin';
import type { Kysely } from 'kysely';
import type { Database, User } from '../db/types';

// ============================================================================
// TEST HELPERS
// ============================================================================

const mockUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    email: 'test@example.com',
    password: 'hashed_password',
    user_id: 'test_user',
    roles: '["ROLE_USER"]',
    is_active: 1,
    quota_mb: null,
    created_at: new Date().toISOString(),
    updated_at: null,
    last_login: null,
    auth_method: 'local',
    is_lopd_accepted: 0,
    external_identifier: null,
    api_token: null,
    ...overrides,
});

const mockAdminUser = mockUser({
    id: 1,
    email: 'admin@example.com',
    roles: '["ROLE_USER", "ROLE_ADMIN"]',
});

// Create mock queries for unit tests
const createMockQueries = (overrides: Partial<AdminQueries> = {}): AdminQueries => ({
    findUserById: async () => mockUser(),
    findUserByEmail: async () => null,
    findUsersPaginated: async () => ({ users: [mockUser()], total: 1 }),
    countAdmins: async () => 2,
    updateUserRoles: async (_db, _id, roles) => mockUser({ roles: JSON.stringify(roles) }),
    updateUserStatus: async (_db, _id, status) => mockUser({ is_active: status ? 1 : 0 }),
    createUserAsAdmin: async (_db, data) =>
        mockUser({
            email: data.email,
            user_id: data.userId,
            roles: JSON.stringify(data.roles),
            quota_mb: data.quotaMb ?? null,
        }),
    updateUserQuota: async (_db, _id, quota) => mockUser({ quota_mb: quota }),
    deleteUser: async () => undefined,
    getSystemStats: async () => ({
        totalUsers: 10,
        activeUsers: 8,
        totalProjects: 5,
        activeProjects: 3,
    }),
    getUserStorageUsage: async () => 0,
    getAllSettings: async () => [],
    setSetting: async () => undefined,
    findProjectsPaginated: async () => ({ projects: [], total: 0 }),
    findProjectById: async () => undefined,
    updateProject: async () => undefined,
    hardDeleteProject: async () => undefined,
    ...overrides,
});

const createMockDeps = (overrides: Partial<AdminQueries> = {}): AdminDependencies => ({
    db: {} as Kysely<Database>,
    queries: createMockQueries(overrides),
});

// Helper to generate admin JWT token
async function generateAdminToken(): Promise<string> {
    const jwtInstance = jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'test-secret',
    });
    const tempApp = new Elysia().use(jwtInstance);

    return tempApp.decorator.jwt.sign({
        sub: 1,
        email: 'admin@example.com',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        isGuest: false,
    });
}

// Helper to generate regular user JWT token
async function generateUserToken(): Promise<string> {
    const jwtInstance = jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'test-secret',
    });
    const tempApp = new Elysia().use(jwtInstance);

    return tempApp.decorator.jwt.sign({
        sub: 2,
        email: 'user@example.com',
        roles: ['ROLE_USER'],
        isGuest: false,
    });
}

// ============================================================================
// ROUTE CREATION TESTS
// ============================================================================

describe('Admin Routes', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        process.env.JWT_SECRET = 'test-secret';
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('createAdminRoutes', () => {
        it('should create Elysia instance', () => {
            const routes = createAdminRoutes(createMockDeps());
            expect(routes).toBeDefined();
        });

        it('should have correct route name', () => {
            const routes = createAdminRoutes(createMockDeps());
            expect((routes as any).config?.name).toBe('admin-routes');
        });
    });

    describe('Authorization', () => {
        it('should return 401 when no token provided', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                }),
            );

            expect(response.status).toBe(401);
            const body = await response.json();
            expect(body.error).toBe('UNAUTHORIZED');
        });

        it('should return 401 with invalid token', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                    headers: { Authorization: 'Bearer invalid-token' },
                }),
            );

            expect(response.status).toBe(401);
        });

        it('should return 403 when user is not admin', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const userToken = await generateUserToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );

            expect(response.status).toBe(403);
            const body = await response.json();
            expect(body.error).toBe('FORBIDDEN');
        });

        it('should accept token from cookie', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                    headers: { Cookie: `auth=${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
        });
    });

    // ============================================================================
    // STATS ENDPOINT
    // ============================================================================

    describe('GET /api/admin/stats', () => {
        it('should return system statistics', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.totalUsers).toBe(10);
            expect(body.activeUsers).toBe(8);
            expect(body.totalProjects).toBe(5);
            expect(body.activeProjects).toBe(3);
            expect(body.timestamp).toBeDefined();
        });
    });

    // ============================================================================
    // SYSTEM INFO ENDPOINT
    // ============================================================================

    describe('GET /api/admin/system-info', () => {
        it('should return system information', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/system-info', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();

            // Verify all sections are present
            expect(body.runtime).toBeDefined();
            expect(body.runtime.name).toBeDefined();
            expect(body.runtime.version).toBeDefined();
            expect(body.runtime.platform).toBeDefined();
            expect(body.runtime.arch).toBeDefined();

            expect(body.database).toBeDefined();
            expect(body.database.engine).toBeDefined();

            expect(body.application).toBeDefined();
            expect(body.application.version).toBeDefined();
            expect(body.application.environment).toBeDefined();

            expect(body.memory).toBeDefined();
            expect(body.memory.total).toBeGreaterThan(0);

            expect(body.os).toBeDefined();
            expect(body.os.platform).toBeDefined();
            expect(body.os.cpus).toBeGreaterThan(0);

            expect(body.docker).toBeDefined();
            expect(typeof body.docker.isDocker).toBe('boolean');

            expect(body.disk).toBeDefined();
            expect(body.disk.path).toBeDefined();

            expect(body.timestamp).toBeDefined();
        });

        it('should require admin role', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const userToken = await generateUserToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/system-info', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );

            expect(response.status).toBe(403);
        });
    });

    // ============================================================================
    // LIST USERS ENDPOINT
    // ============================================================================

    describe('GET /api/admin/users', () => {
        it('should return paginated users', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.users).toBeDefined();
            expect(Array.isArray(body.users)).toBe(true);
            expect(body.total).toBe(1);
            expect(body.limit).toBe(50);
            expect(body.offset).toBe(0);
        });

        it('should handle pagination parameters', async () => {
            const mockQueries = createMockQueries({
                findUsersPaginated: async (_db, options) => {
                    // Verify parameters are passed correctly
                    expect(options?.limit).toBe(10);
                    expect(options?.offset).toBe(20);
                    return { users: [], total: 100 };
                },
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users?limit=10&offset=20', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.limit).toBe(10);
            expect(body.offset).toBe(20);
        });

        it('should handle search parameter', async () => {
            const mockQueries = createMockQueries({
                findUsersPaginated: async (_db, options) => {
                    expect(options?.search).toBe('admin');
                    return { users: [mockAdminUser], total: 1 };
                },
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users?search=admin', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
        });

        it('should handle sort parameters', async () => {
            const mockQueries = createMockQueries({
                findUsersPaginated: async (_db, options) => {
                    expect(options?.sortBy).toBe('email');
                    expect(options?.sortOrder).toBe('desc');
                    return { users: [], total: 0 };
                },
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users?sortBy=email&sortOrder=desc', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
        });

        it('should cap limit at 100', async () => {
            const mockQueries = createMockQueries({
                findUsersPaginated: async (_db, options) => {
                    expect(options?.limit).toBe(100); // Capped at 100
                    return { users: [], total: 0 };
                },
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            await app.handle(
                new Request('http://localhost/api/admin/users?limit=500', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
        });

        it('should sanitize user data (remove password)', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            const body = await response.json();
            expect(body.users[0].password).toBeUndefined();
            expect(body.users[0].roles).toEqual(['ROLE_USER']); // Parsed from JSON
        });
    });

    // ============================================================================
    // GET USER BY ID
    // ============================================================================

    describe('GET /api/admin/users/:id', () => {
        it('should return user by ID', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/1', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.user).toBeDefined();
            expect(body.user.id).toBe(1);
        });

        it('should return 400 for invalid ID', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/invalid', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('BAD_REQUEST');
        });

        it('should return 404 for non-existent user', async () => {
            const mockQueries = createMockQueries({
                findUserById: async () => undefined,
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/99999', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.error).toBe('NOT_FOUND');
        });
    });

    // ============================================================================
    // CREATE USER
    // ============================================================================

    describe('POST /api/admin/users', () => {
        it('should create a new user', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: 'newuser@example.com',
                        password: 'password123',
                    }),
                }),
            );

            expect(response.status).toBe(201);
            const body = await response.json();
            expect(body.user).toBeDefined();
            expect(body.user.email).toBe('newuser@example.com');
        });

        it('should create user with roles', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: 'editor@example.com',
                        password: 'password123',
                        roles: ['ROLE_USER', 'ROLE_EDITOR'],
                    }),
                }),
            );

            expect(response.status).toBe(201);
            const body = await response.json();
            expect(body.user.roles).toContain('ROLE_EDITOR');
        });

        it('should create user with quota', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: 'quota@example.com',
                        password: 'password123',
                        quota_mb: 500,
                    }),
                }),
            );

            expect(response.status).toBe(201);
            const body = await response.json();
            expect(body.user.quota_mb).toBe(500);
        });

        it('should return 409 for duplicate email', async () => {
            const mockQueries = createMockQueries({
                findUserByEmail: async () => mockUser(), // User exists
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: 'existing@example.com',
                        password: 'password123',
                    }),
                }),
            );

            expect(response.status).toBe(409);
            const body = await response.json();
            expect(body.error).toBe('CONFLICT');
        });

        it('should validate email format', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: 'invalid-email',
                        password: 'password123',
                    }),
                }),
            );

            expect(response.status).toBe(422); // Validation error
        });

        it('should validate password length', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: 'test@example.com',
                        password: '123', // Too short (min 4)
                    }),
                }),
            );

            expect(response.status).toBe(422);
        });
    });

    // ============================================================================
    // UPDATE USER ROLES
    // ============================================================================

    describe('PATCH /api/admin/users/:id/roles', () => {
        it('should update user roles', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2/roles', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roles: ['ROLE_USER', 'ROLE_ADMIN'],
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.user).toBeDefined();
        });

        it('should always include ROLE_USER', async () => {
            let receivedRoles: string[] = [];
            const mockQueries = createMockQueries({
                updateUserRoles: async (_db, _id, roles) => {
                    receivedRoles = roles;
                    return mockUser({ roles: JSON.stringify(roles) });
                },
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            await app.handle(
                new Request('http://localhost/api/admin/users/2/roles', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roles: ['ROLE_ADMIN'], // No ROLE_USER provided
                    }),
                }),
            );

            expect(receivedRoles).toContain('ROLE_USER');
        });

        it('should return 400 for invalid user ID', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/invalid/roles', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ roles: ['ROLE_USER'] }),
                }),
            );

            expect(response.status).toBe(400);
        });

        it('should return 404 for non-existent user', async () => {
            const mockQueries = createMockQueries({
                findUserById: async () => undefined,
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/99999/roles', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ roles: ['ROLE_USER'] }),
                }),
            );

            expect(response.status).toBe(404);
        });

        it('should prevent removing admin role when last admin', async () => {
            const mockQueries = createMockQueries({
                findUserById: async () => mockAdminUser,
                countAdmins: async () => 1, // Only one admin
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/1/roles', {
                    // Same user ID as token
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ roles: ['ROLE_USER'] }), // Remove admin
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('CANNOT_REMOVE_LAST_ADMIN');
        });

        it('should return 500 when update fails', async () => {
            const mockQueries = createMockQueries({
                updateUserRoles: async () => undefined, // Update fails
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2/roles', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ roles: ['ROLE_USER'] }),
                }),
            );

            expect(response.status).toBe(500);
            const body = await response.json();
            expect(body.error).toBe('UPDATE_FAILED');
        });
    });

    // ============================================================================
    // UPDATE USER STATUS
    // ============================================================================

    describe('PATCH /api/admin/users/:id/status', () => {
        it('should activate user', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2/status', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ is_active: true }),
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.user.is_active).toBe(1);
        });

        it('should deactivate user', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2/status', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ is_active: false }),
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.user.is_active).toBe(0);
        });

        it('should return 400 for invalid user ID', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/invalid/status', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ is_active: true }),
                }),
            );

            expect(response.status).toBe(400);
        });

        it('should prevent deactivating yourself', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/1/status', {
                    // Same user ID as token
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ is_active: false }),
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('CANNOT_DEACTIVATE_SELF');
        });

        it('should return 404 for non-existent user', async () => {
            const mockQueries = createMockQueries({
                updateUserStatus: async () => undefined,
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/99999/status', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ is_active: true }),
                }),
            );

            expect(response.status).toBe(404);
        });
    });

    // ============================================================================
    // UPDATE USER QUOTA
    // ============================================================================

    describe('PATCH /api/admin/users/:id/quota', () => {
        it('should update user quota', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2/quota', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ quota_mb: 1000 }),
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.user.quota_mb).toBe(1000);
        });

        it('should set quota to null (unlimited)', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2/quota', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ quota_mb: null }),
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.user.quota_mb).toBeNull();
        });

        it('should return 400 for invalid user ID', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/invalid/quota', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ quota_mb: 1000 }),
                }),
            );

            expect(response.status).toBe(400);
        });

        it('should return 404 for non-existent user', async () => {
            const mockQueries = createMockQueries({
                updateUserQuota: async () => undefined,
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/99999/quota', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ quota_mb: 1000 }),
                }),
            );

            expect(response.status).toBe(404);
        });
    });

    // ============================================================================
    // DELETE USER
    // ============================================================================

    describe('DELETE /api/admin/users/:id', () => {
        it('should delete user', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        it('should return 400 for invalid user ID', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/invalid', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(400);
        });

        it('should prevent deleting yourself', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/1', {
                    // Same user ID as token
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('CANNOT_DELETE_SELF');
        });

        it('should return 404 for non-existent user', async () => {
            const mockQueries = createMockQueries({
                findUserById: async () => undefined,
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/99999', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(404);
        });

        it('should prevent deleting last admin', async () => {
            const mockQueries = createMockQueries({
                findUserById: async () => mockAdminUser,
                countAdmins: async () => 1,
            });
            const app = new Elysia().use(createAdminRoutes({ db: {} as any, queries: mockQueries }));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2', {
                    // Different user
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('CANNOT_DELETE_LAST_ADMIN');
        });
    });

    // ============================================================================
    // EDGE CASES
    // ============================================================================

    describe('Edge Cases', () => {
        it('should handle JWT without sub', async () => {
            const jwtInstance = jwt({
                name: 'jwt',
                secret: 'test-secret',
            });
            const tempApp = new Elysia().use(jwtInstance);

            // Create token without sub
            const token = await tempApp.decorator.jwt.sign({
                email: 'admin@example.com',
                roles: ['ROLE_USER', 'ROLE_ADMIN'],
            } as any);

            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(401);
        });

        it('should handle JWT with null roles', async () => {
            const jwtInstance = jwt({
                name: 'jwt',
                secret: 'test-secret',
            });
            const tempApp = new Elysia().use(jwtInstance);

            const token = await tempApp.decorator.jwt.sign({
                sub: 1,
                email: 'admin@example.com',
                roles: null,
            } as any);

            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(403);
        });
    });

    // ========================================================================
    // SETTINGS TESTS
    // ========================================================================

    describe('GET /api/admin/settings', () => {
        it('should return settings with defaults', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        getAllSettings: async () => [],
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/settings', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.settings).toBeDefined();
        });

        it('should merge stored settings with defaults', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        getAllSettings: async () => [{ key: 'ONLINE_THEMES_INSTALL', value: '0', type: 'boolean' }],
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/settings', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.settings.ONLINE_THEMES_INSTALL.value).toBe('0');
        });
    });

    describe('PUT /api/admin/settings', () => {
        it('should update settings successfully', async () => {
            const token = await generateAdminToken();
            const savedSettings: Array<{ key: string; value: string }> = [];
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        setSetting: async (_db, key, value) => {
                            savedSettings.push({ key, value });
                        },
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        settings: [{ key: 'ONLINE_THEMES_INSTALL', value: '1', type: 'boolean' }],
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(savedSettings).toHaveLength(1);
            expect(savedSettings[0].key).toBe('ONLINE_THEMES_INSTALL');
        });

        it('should reject unknown setting key', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        settings: [{ key: 'UNKNOWN_KEY', value: 'test', type: 'string' }],
                    }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('Unknown setting');
        });

        it('should validate APP_AUTH_METHODS requires at least one method', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        settings: [{ key: 'APP_AUTH_METHODS', value: '', type: 'string' }],
                    }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('at least one method');
        });

        it('should validate APP_AUTH_METHODS for invalid values', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        settings: [{ key: 'APP_AUTH_METHODS', value: 'password,invalid_method', type: 'string' }],
                    }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.message).toContain('invalid values');
        });

        it('should handle setSetting failure', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        setSetting: async () => {
                            throw new Error('Database error');
                        },
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/settings', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        settings: [{ key: 'ONLINE_THEMES_INSTALL', value: '1', type: 'boolean' }],
                    }),
                }),
            );

            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Internal Server Error');
        });
    });

    // ========================================================================
    // PROJECT MANAGEMENT TESTS
    // ========================================================================

    describe('GET /api/admin/projects', () => {
        it('should return paginated projects list', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectsPaginated: async () => ({
                            projects: [{ id: 1, title: 'Test Project', status: 'active' } as any],
                            total: 1,
                        }),
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.projects).toHaveLength(1);
            expect(data.total).toBe(1);
        });

        it('should pass filter parameters', async () => {
            const token = await generateAdminToken();
            let receivedOpts: any = {};
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectsPaginated: async (_db, opts) => {
                            receivedOpts = opts;
                            return { projects: [], total: 0 };
                        },
                    }),
                ),
            );

            await app.handle(
                new Request(
                    'http://localhost/api/admin/projects?owner=alice&title=test&status=active&visibility=public&sortBy=title&sortOrder=asc',
                    {
                        method: 'GET',
                        headers: { Authorization: `Bearer ${token}` },
                    },
                ),
            );

            expect(receivedOpts.owner).toBe('alice');
            expect(receivedOpts.title).toBe('test');
            expect(receivedOpts.status).toBe('active');
            expect(receivedOpts.visibility).toBe('public');
            expect(receivedOpts.sortBy).toBe('title');
            expect(receivedOpts.sortOrder).toBe('asc');
        });

        it('should sanitize invalid sort parameters', async () => {
            const token = await generateAdminToken();
            let receivedOpts: any = {};
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectsPaginated: async (_db, opts) => {
                            receivedOpts = opts;
                            return { projects: [], total: 0 };
                        },
                    }),
                ),
            );

            await app.handle(
                new Request('http://localhost/api/admin/projects?sortBy=invalid&sortOrder=invalid', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(receivedOpts.sortBy).toBe('id');
            expect(receivedOpts.sortOrder).toBe('desc');
        });
    });

    describe('PATCH /api/admin/projects/:id/status', () => {
        it('should update project status', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        updateProject: async () => ({ id: 1, status: 'archived' }) as any,
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/1/status', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: 'archived' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.project.status).toBe('archived');
        });

        it('should return 400 for invalid project id', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/invalid/status', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: 'archived' }),
                }),
            );

            expect(response.status).toBe(400);
        });

        it('should return 404 for non-existent project', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        updateProject: async () => undefined,
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/999/status', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: 'archived' }),
                }),
            );

            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /api/admin/projects/:id', () => {
        it('should delete project successfully', async () => {
            const token = await generateAdminToken();
            let deletedId: number | null = null;
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectById: async () => ({ id: 1, title: 'Test' }) as any,
                        hardDeleteProject: async (_db, id) => {
                            deletedId = id;
                        },
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/1', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(deletedId).toBe(1);
        });

        it('should return 400 for invalid project id', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/invalid', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(400);
        });

        it('should return 404 for non-existent project', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectById: async () => undefined,
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/999', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(404);
        });
    });
});
