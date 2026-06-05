/**
 * Admin Routes Unit Tests
 * Tests for admin API routes with DI and JWT authentication
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import {
    createAdminRoutes,
    sanitizeCustomHeadHtml,
    ALLOWED_ASSET_MIME_TYPES,
    type AdminDependencies,
    type AdminQueries,
} from './admin';
import type { Kysely } from 'kysely';
import type { Database, User, Project } from '../db/types';
import type { FileHelper } from '../services/file-helper';

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

const mockProject = (overrides: Partial<Project> = {}): Project => ({
    id: 1,
    uuid: 'test-project-uuid',
    title: 'Test Project',
    description: null,
    owner_id: 1,
    status: 'active',
    visibility: 'private',
    language: null,
    author: null,
    license: null,
    last_accessed_at: null,
    saved_once: 1,
    platform_id: null,
    created_at: Date.now(),
    updated_at: null,
    ...overrides,
});

// Create mock file helper for unit tests
const createMockFileHelper = (overrides: Partial<FileHelper> = {}): FileHelper => ({
    getFilesDir: () => '/mock/data',
    getTempPath: (subPath?: string) => (subPath ? `/mock/data/tmp/${subPath}` : '/mock/data/tmp'),
    getPreviewExportPath: () => '/mock/preview',
    getOdeSessionDistDir: () => '/mock/dist',
    getOdeSessionTempDir: () => '/mock/tmp',
    getProjectAssetsDir: (uuid: string) => `/mock/data/assets/${uuid}`,
    getPublicDirectory: () => '/mock/public',
    getLibsDir: () => '/mock/public/libs',
    getThemesDir: () => '/mock/public/style/themes',
    getIdevicesDir: () => '/mock/public/app/idevice',
    createSessionDirectories: async () => undefined,
    cleanupSessionDirectories: async () => undefined,
    isPathSafe: () => true,
    getContentXmlPath: () => '/mock/content.xml',
    fileExists: async () => false,
    readFile: async () => Buffer.from(''),
    readFileAsString: async () => '',
    writeFile: async () => undefined,
    appendFile: async () => undefined,
    copyFile: async () => undefined,
    copyDir: async () => undefined,
    remove: async () => undefined,
    listFiles: async () => [],
    getStats: async () => null,
    generateUniqueFilename: (name: string) => name,
    ...overrides,
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
            user_id: data.userId ?? null, // null for local users, only set for SSO
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
    findProjectsByOwnerId: async () => [],
    createImpersonationAuditSession: async () => undefined,
    getActiveUserMetrics: async () => ({ dau: 5, wau: 20, mau: 50 }),
    getActivityTimeSeries: async () => ({
        labels: ['2024-01-01', '2024-01-02'],
        logins: [3, 5],
        projectsCreated: [1, 2],
    }),
    getPeakUsage: async () => ({
        peakHour: 14,
        peakDay: 'Monday',
        peakHourCount: 10,
        peakDayCount: 30,
    }),
    ...overrides,
});

const createMockDeps = (
    queryOverrides: Partial<AdminQueries> = {},
    fileHelperOverrides: Partial<FileHelper> = {},
    getConnectedClientsDetailOverride?: () => Array<{ userId: number; projectUuid: string; connectedAt: number }>,
): AdminDependencies => ({
    db: {} as Kysely<Database>,
    queries: createMockQueries(queryOverrides),
    fileHelper: createMockFileHelper(fileHelperOverrides),
    getConnectedClientsDetail: getConnectedClientsDetailOverride,
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
            expect(Number.isInteger(body.os.cpus)).toBe(true);
            expect(body.os.cpus).toBeGreaterThanOrEqual(0);

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

        it('should return count of deleted projects', async () => {
            const userProjects = [
                mockProject({ id: 1, uuid: 'project-uuid-1' }),
                mockProject({ id: 2, uuid: 'project-uuid-2' }),
                mockProject({ id: 3, uuid: 'project-uuid-3' }),
            ];
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectsByOwnerId: async () => userProjects,
                    }),
                ),
            );
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
            expect(body.deletedProjectsCount).toBe(3);
        });

        it('should clean up asset directories when deleting user with projects', async () => {
            const userProjects = [
                mockProject({ id: 1, uuid: 'project-uuid-1' }),
                mockProject({ id: 2, uuid: 'project-uuid-2' }),
            ];
            const removedPaths: string[] = [];

            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps(
                        {
                            findProjectsByOwnerId: async () => userProjects,
                        },
                        {
                            fileExists: async () => true,
                            remove: async (path: string) => {
                                removedPaths.push(path);
                            },
                        },
                    ),
                ),
            );
            const adminToken = await generateAdminToken();

            await app.handle(
                new Request('http://localhost/api/admin/users/2', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            // Verify both project asset directories were cleaned up
            expect(removedPaths.length).toBe(2);
            expect(removedPaths).toContain('/mock/data/assets/project-uuid-1');
            expect(removedPaths).toContain('/mock/data/assets/project-uuid-2');
        });

        it('should delete user even if asset cleanup fails', async () => {
            const userProjects = [mockProject({ id: 1, uuid: 'project-uuid-1' })];
            let deleteUserCalled = false;

            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps(
                        {
                            findProjectsByOwnerId: async () => userProjects,
                            deleteUser: async () => {
                                deleteUserCalled = true;
                            },
                        },
                        {
                            fileExists: async () => true,
                            remove: async () => {
                                throw new Error('Disk error');
                            },
                        },
                    ),
                ),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/users/2', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            // User deletion should succeed even if asset cleanup fails
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(deleteUserCalled).toBe(true);
        });

        it('should skip asset cleanup for non-existent directories', async () => {
            const userProjects = [mockProject({ id: 1, uuid: 'project-uuid-1' })];
            let removeCalled = false;

            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps(
                        {
                            findProjectsByOwnerId: async () => userProjects,
                        },
                        {
                            fileExists: async () => false, // Directory doesn't exist
                            remove: async () => {
                                removeCalled = true;
                            },
                        },
                    ),
                ),
            );
            const adminToken = await generateAdminToken();

            await app.handle(
                new Request('http://localhost/api/admin/users/2', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            // Remove should not be called if directory doesn't exist
            expect(removeCalled).toBe(false);
        });

        it('should handle user with no projects', async () => {
            let deleteUserCalled = false;

            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectsByOwnerId: async () => [], // No projects
                        deleteUser: async () => {
                            deleteUserCalled = true;
                        },
                    }),
                ),
            );
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
            expect(body.deletedProjectsCount).toBe(0);
            expect(deleteUserCalled).toBe(true);
        });
    });

    // ============================================================================
    // EDGE CASES
    // ============================================================================

    describe('POST /api/admin/impersonation/start', () => {
        it('should start impersonation for non-admin user', async () => {
            let auditCalled = false;
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findUserById: async (_db, id) => {
                            if (id === 2) {
                                return mockUser({ id: 2, email: 'target@example.com', roles: '["ROLE_USER"]' });
                            }
                            return mockAdminUser;
                        },
                        createImpersonationAuditSession: async () => {
                            auditCalled = true;
                        },
                    }),
                ),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/impersonation/start', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: 2 }),
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.impersonation.email).toBe('target@example.com');
            expect(auditCalled).toBe(true);

            const setCookie = response.headers.get('set-cookie') || '';
            expect(setCookie).toContain('auth=');
        });

        it('should prevent self impersonation', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/impersonation/start', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: 1 }),
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('CANNOT_IMPERSONATE_SELF');
        });

        it('should reject impersonating admin users', async () => {
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findUserById: async (_db, id) => {
                            if (id === 2) return mockAdminUser;
                            return mockAdminUser;
                        },
                    }),
                ),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/impersonation/start', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ user_id: 2 }),
                }),
            );

            expect(response.status).toBe(403);
            const body = await response.json();
            expect(body.error).toBe('CANNOT_IMPERSONATE_ADMIN');
        });
    });

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
    // CUSTOM HEAD HTML SANITIZATION TESTS
    // ========================================================================

    describe('sanitizeCustomHeadHtml', () => {
        it('should return empty string for empty input', () => {
            expect(sanitizeCustomHeadHtml('')).toBe('');
        });

        it('should keep allowed tags: style, meta, link, script', () => {
            const html = `<style>body{color:red}</style>
<meta charset="utf-8">
<link rel="stylesheet" href="custom.css">
<script src="custom.js"></script>
<base href="/">`;
            const result = sanitizeCustomHeadHtml(html);
            expect(result).toContain('<style>');
            expect(result).toContain('<meta charset="utf-8">');
            expect(result).toContain('<link rel="stylesheet"');
            expect(result).toContain('<script src="custom.js">');
            expect(result).not.toContain('<base');
        });

        it('should remove <title> tag and its content', () => {
            const html = '<title>My Custom Title</title>';
            expect(sanitizeCustomHeadHtml(html)).toBe('');
        });

        it('should remove title but keep allowed tags', () => {
            const html = '<title>Bad</title>\n<style>body{margin:0}</style>';
            const result = sanitizeCustomHeadHtml(html);
            expect(result).not.toContain('<title>');
            expect(result).not.toContain('Bad');
            expect(result).toContain('<style>');
        });

        it('should remove disallowed block elements including their content', () => {
            const html = '<div class="x">content</div><style>a{color:blue}</style>';
            const result = sanitizeCustomHeadHtml(html);
            expect(result).not.toContain('<div');
            expect(result).not.toContain('content');
            expect(result).toContain('<style>');
        });

        it('should remove content of disallowed elements', () => {
            // The key bug: <ejemplo>contenido</ejemplo> should not leave "contenido" behind
            expect(sanitizeCustomHeadHtml('<ejemplo>contenido</ejemplo>')).toBe('');
            expect(sanitizeCustomHeadHtml('<custom>some text here</custom>')).toBe('');
            expect(sanitizeCustomHeadHtml('<div>text</div><style>body{}</style>')).not.toContain('text');
        });

        it('should remove void/self-closing disallowed tags', () => {
            const html = '<br/><hr><img src="x.png"><style>p{}</style>';
            const result = sanitizeCustomHeadHtml(html);
            expect(result).not.toContain('<br');
            expect(result).not.toContain('<hr');
            expect(result).not.toContain('<img');
            expect(result).toContain('<style>');
        });

        it('should preserve allowed tags with attributes', () => {
            const html = '<meta name="description" content="test"><link rel="icon" href="/favicon.ico">';
            const result = sanitizeCustomHeadHtml(html);
            expect(result).toContain('<meta name="description"');
            expect(result).toContain('<link rel="icon"');
        });

        it('should handle inline script correctly', () => {
            const html = '<script>window.foo = 1;</script>';
            expect(sanitizeCustomHeadHtml(html)).toContain('<script>');
        });

        it('should remove orphaned closing tags', () => {
            const html = '</title></div>';
            const result = sanitizeCustomHeadHtml(html);
            expect(result).toBe('');
        });
    });

    describe('PUT /api/admin/settings - CUSTOM_HEAD_HTML sanitization', () => {
        it('should sanitize CUSTOM_HEAD_HTML before saving', async () => {
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
                        settings: [
                            {
                                key: 'CUSTOM_HEAD_HTML',
                                value: '<title>Bad</title><style>body{}</style>',
                                type: 'string',
                            },
                        ],
                    }),
                }),
            );

            expect(response.status).toBe(200);
            expect(savedSettings).toHaveLength(1);
            expect(savedSettings[0].key).toBe('CUSTOM_HEAD_HTML');
            expect(savedSettings[0].value).not.toContain('<title>');
            expect(savedSettings[0].value).toContain('<style>');
        });

        it('should return sanitizedValues with the cleaned CUSTOM_HEAD_HTML', async () => {
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
                        settings: [
                            {
                                key: 'CUSTOM_HEAD_HTML',
                                value: '<ejemplo>contenido</ejemplo><style>body{}</style>',
                                type: 'string',
                            },
                        ],
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.sanitizedValues).toBeDefined();
            expect(data.sanitizedValues.CUSTOM_HEAD_HTML).not.toContain('contenido');
            expect(data.sanitizedValues.CUSTOM_HEAD_HTML).not.toContain('<ejemplo>');
            expect(data.sanitizedValues.CUSTOM_HEAD_HTML).toContain('<style>');
        });

        it('should save empty CUSTOM_HEAD_HTML when all tags are disallowed', async () => {
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
                        settings: [{ key: 'CUSTOM_HEAD_HTML', value: '<title>My Title</title>', type: 'string' }],
                    }),
                }),
            );

            expect(response.status).toBe(200);
            expect(savedSettings[0].value).toBe('');
        });
    });

    describe('ALLOWED_ASSET_MIME_TYPES', () => {
        it('should allow common image MIME types', () => {
            expect(ALLOWED_ASSET_MIME_TYPES.has('image/jpeg')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('image/png')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('image/svg+xml')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('image/webp')).toBe(true);
        });

        it('should allow font MIME types', () => {
            expect(ALLOWED_ASSET_MIME_TYPES.has('font/ttf')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('font/woff')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('font/woff2')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('application/vnd.ms-fontobject')).toBe(true);
        });

        it('should allow audio/video MIME types', () => {
            expect(ALLOWED_ASSET_MIME_TYPES.has('audio/mpeg')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('video/mp4')).toBe(true);
            expect(ALLOWED_ASSET_MIME_TYPES.has('video/webm')).toBe(true);
        });

        it('should not allow executable or unknown MIME types', () => {
            expect(ALLOWED_ASSET_MIME_TYPES.has('application/x-executable')).toBe(false);
            expect(ALLOWED_ASSET_MIME_TYPES.has('application/octet-stream')).toBe(false);
            expect(ALLOWED_ASSET_MIME_TYPES.has('image/tiff')).toBe(false);
        });
    });

    describe('POST /api/admin/customization/assets - MIME type validation', () => {
        it('should reject a file with disallowed MIME type', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const file = new File([Buffer.from('data')], 'malware.exe', {
                type: 'application/x-msdownload',
            });
            const formData = new FormData();
            formData.append('file', file);

            const response = await app.handle(
                new Request('http://localhost/api/admin/customization/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('Bad Request');
            expect(body.message).toContain('not allowed');
        });

        it('should reject application/octet-stream', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const file = new File([Buffer.from('data')], 'file.bin', {
                type: 'application/octet-stream',
            });
            const formData = new FormData();
            formData.append('file', file);

            const response = await app.handle(
                new Request('http://localhost/api/admin/customization/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('Bad Request');
        });

        it('should accept a valid image MIME type', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const file = new File([Buffer.from('png-data')], 'logo.png', { type: 'image/png' });
            const formData = new FormData();
            formData.append('file', file);

            const response = await app.handle(
                new Request('http://localhost/api/admin/customization/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
        });

        it('should accept font/woff2 MIME type', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const file = new File([Buffer.from('woff2-data')], 'font.woff2', { type: 'font/woff2' });
            const formData = new FormData();
            formData.append('file', file);

            const response = await app.handle(
                new Request('http://localhost/api/admin/customization/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
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

    describe('GET /api/admin/projects/:id/download', () => {
        it('should return 400 for invalid project id', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/invalid/download', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error).toBe('BAD_REQUEST');
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
                new Request('http://localhost/api/admin/projects/999/download', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.error).toBe('NOT_FOUND');
        });

        it('should return 403 for private project', async () => {
            const token = await generateAdminToken();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        findProjectById: async () => mockProject({ id: 1, visibility: 'private' }),
                    }),
                ),
            );

            const response = await app.handle(
                new Request('http://localhost/api/admin/projects/1/download', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${token}` },
                }),
            );

            expect(response.status).toBe(403);
            const body = await response.json();
            expect(body.error).toBe('FORBIDDEN');
        });
    });

    describe('Customization endpoints', () => {
        describe('POST /api/admin/customization/favicon', () => {
            it('should return 400 for invalid file type', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps()));

                const file = new File([Buffer.from('text content')], 'favicon.txt', {
                    type: 'text/plain',
                });
                const formData = new FormData();
                formData.append('file', file);

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/favicon', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    }),
                );

                expect(response.status).toBe(400);
                const body = await response.json();
                expect(body.error).toBe('Bad Request');
            });

            it('should upload a valid PNG favicon', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps()));

                const file = new File([Buffer.from('fake-png-data')], 'favicon.png', {
                    type: 'image/png',
                });
                const formData = new FormData();
                formData.append('file', file);

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/favicon', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    }),
                );

                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);
                expect(body.filename).toBe('favicon.png');
            });

            it('should upload a valid ICO favicon', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps()));

                const file = new File([Buffer.from('fake-ico-data')], 'favicon.ico', {
                    type: 'image/x-icon',
                });
                const formData = new FormData();
                formData.append('file', file);

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/favicon', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    }),
                );

                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);
                expect(body.filename).toBe('favicon.ico');
            });
        });

        describe('DELETE /api/admin/customization/favicon', () => {
            it('should delete the custom favicon and return success', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps()));

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/favicon', {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                );

                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);
            });

            it('should clear setting even when favicon dir has existing files', async () => {
                const token = await generateAdminToken();
                const removedFiles: string[] = [];
                const app = new Elysia().use(
                    createAdminRoutes(
                        createMockDeps(
                            {},
                            {
                                listFiles: async () => ['old-favicon.png'],
                                remove: async (path: string) => {
                                    removedFiles.push(path);
                                },
                            },
                        ),
                    ),
                );

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/favicon', {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                );

                expect(response.status).toBe(200);
                expect(removedFiles.length).toBe(1);
            });
        });

        describe('GET /api/admin/customization/assets', () => {
            it('should return empty list when no assets exist', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps()));

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/assets', {
                        method: 'GET',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                );

                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.assets).toEqual([]);
            });

            it('should return list of assets with size and url', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(
                    createAdminRoutes(
                        createMockDeps(
                            {},
                            {
                                listFiles: async () => ['logo.png'],
                                getStats: async () => ({ size: 2048 }) as any,
                            },
                        ),
                    ),
                );

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/assets', {
                        method: 'GET',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                );

                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.assets).toHaveLength(1);
                expect(body.assets[0].filename).toBe('logo.png');
                expect(body.assets[0].size).toBe(2048);
                expect(body.assets[0].url).toContain('/customization/assets/logo.png');
            });
        });

        describe('POST /api/admin/customization/assets', () => {
            it('should upload a valid asset file', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps()));

                const file = new File([Buffer.from('font-data')], 'font.woff2', {
                    type: 'font/woff2',
                });
                const formData = new FormData();
                formData.append('file', file);

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/assets', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    }),
                );

                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);
                expect(body.filename).toBe('font.woff2');
                expect(body.url).toContain('/customization/assets/font.woff2');
            });

            it('should return 400 when path is unsafe', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps({}, { isPathSafe: () => false })));

                const file = new File([Buffer.from('data')], 'evil.png', { type: 'image/png' });
                const formData = new FormData();
                formData.append('file', file);

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/assets', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    }),
                );

                expect(response.status).toBe(400);
                const body = await response.json();
                expect(body.error).toBe('Bad Request');
            });
        });

        describe('DELETE /api/admin/customization/assets/:filename', () => {
            it('should return 400 for unsafe filename', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps({}, { isPathSafe: () => false })));

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/assets/evil.png', {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                );

                expect(response.status).toBe(400);
                const body = await response.json();
                expect(body.error).toBe('Bad Request');
            });

            it('should return 404 when asset file does not exist', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps({}, { fileExists: async () => false })));

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/assets/logo.png', {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                );

                expect(response.status).toBe(404);
                const body = await response.json();
                expect(body.error).toBe('Not Found');
            });

            it('should delete the asset and return success', async () => {
                const token = await generateAdminToken();
                const app = new Elysia().use(createAdminRoutes(createMockDeps({}, { fileExists: async () => true })));

                const response = await app.handle(
                    new Request('http://localhost/api/admin/customization/assets/logo.png', {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                );

                expect(response.status).toBe(200);
                const body = await response.json();
                expect(body.success).toBe(true);
            });
        });
    });

    // ============================================================================
    // ANALYTICS ROUTES
    // ============================================================================

    describe('GET /api/admin/analytics/activity', () => {
        it('should return activity time series with default 30 days', async () => {
            let capturedDays: number | undefined;
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        getActivityTimeSeries: async (_db, days) => {
                            capturedDays = days;
                            return {
                                labels: ['2024-01-01', '2024-01-02'],
                                logins: [3, 5],
                                projectsCreated: [1, 2],
                            };
                        },
                    }),
                ),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/analytics/activity', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            expect(capturedDays).toBe(30);
            const body = await response.json();
            expect(Array.isArray(body.labels)).toBe(true);
            expect(body.datasets).toBeDefined();
            expect(Array.isArray(body.datasets.logins)).toBe(true);
            expect(Array.isArray(body.datasets.projectsCreated)).toBe(true);
        });

        it('should clamp days parameter between 1 and 365', async () => {
            const capturedDaysArr: number[] = [];
            const mockFn = async (_db: any, days: number) => {
                capturedDaysArr.push(days);
                return { labels: [], logins: [], projectsCreated: [] };
            };

            const app = new Elysia().use(createAdminRoutes(createMockDeps({ getActivityTimeSeries: mockFn })));
            const adminToken = await generateAdminToken();

            // days=1 is the minimum allowed
            await app.handle(
                new Request('http://localhost/api/admin/analytics/activity?days=1', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
            // days=999 should clamp to 365
            await app.handle(
                new Request('http://localhost/api/admin/analytics/activity?days=999', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(capturedDaysArr[0]).toBe(1);
            expect(capturedDaysArr[1]).toBe(365);
        });

        it('should use custom days parameter', async () => {
            let capturedDays: number | undefined;
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        getActivityTimeSeries: async (_db, days) => {
                            capturedDays = days;
                            return { labels: [], logins: [], projectsCreated: [] };
                        },
                    }),
                ),
            );
            const adminToken = await generateAdminToken();

            await app.handle(
                new Request('http://localhost/api/admin/analytics/activity?days=7', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(capturedDays).toBe(7);
        });
    });

    describe('GET /api/admin/analytics/users', () => {
        it('should return user metrics', async () => {
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({
                        getActiveUserMetrics: async () => ({ dau: 5, wau: 20, mau: 50 }),
                        getPeakUsage: async () => ({
                            peakHour: 14,
                            peakDay: 'Monday',
                            peakHourCount: 10,
                            peakDayCount: 30,
                        }),
                    }),
                ),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/analytics/users', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.dau).toBe(5);
            expect(body.wau).toBe(20);
            expect(body.mau).toBe(50);
            expect(body.peakHour).toBe(14);
            expect(body.peakDay).toBe('Monday');
            expect(body.peakHourCount).toBe(10);
            expect(body.peakDayCount).toBe(30);
        });
    });

    // ============================================================================
    // ONLINE USERS ROUTE
    // ============================================================================

    describe('GET /api/admin/online-users', () => {
        it('should return connected users with email resolution', async () => {
            const now = Date.now();
            const mockClients = [
                { userId: 1, projectUuid: 'proj-uuid-1', connectedAt: now },
                { userId: 2, projectUuid: 'proj-uuid-2', connectedAt: now },
            ];

            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps(
                        {
                            findUsersByIds: async () => [
                                mockUser({ id: 1, email: 'user1@example.com' }),
                                mockUser({ id: 2, email: 'user2@example.com' }),
                            ],
                        },
                        {},
                        () => mockClients,
                    ),
                ),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/online-users', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.count).toBe(2);
            expect(Array.isArray(body.users)).toBe(true);
            expect(body.users[0].userId).toBe(1);
            expect(body.users[0].email).toBe('user1@example.com');
            expect(body.users[0].projectUuid).toBe('proj-uuid-1');
            expect(body.users[0].connectedSince).toBe(now);
            expect(body.users[1].userId).toBe(2);
            expect(body.users[1].email).toBe('user2@example.com');
        });

        it('should handle empty client list', async () => {
            const app = new Elysia().use(
                createAdminRoutes(createMockDeps({ findUsersByIds: async () => [] }, {}, () => [])),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/online-users', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.count).toBe(0);
            expect(body.users).toEqual([]);
        });

        it('should set email to null when user not found', async () => {
            const now = Date.now();
            const app = new Elysia().use(
                createAdminRoutes(
                    createMockDeps({ findUsersByIds: async () => [] }, {}, () => [
                        { userId: 99, projectUuid: 'proj-uuid', connectedAt: now },
                    ]),
                ),
            );
            const adminToken = await generateAdminToken();

            const response = await app.handle(
                new Request('http://localhost/api/admin/online-users', {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.count).toBe(1);
            expect(body.users[0].email).toBeNull();
        });
    });
});
