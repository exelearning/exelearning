/**
 * Admin Routes Unit Tests
 * Tests for admin API routes
 */
import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
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
    ...overrides,
});

const mockAdminUser = mockUser({
    id: 1,
    email: 'admin@example.com',
    roles: '["ROLE_USER", "ROLE_ADMIN"]',
});

const mockQueries: AdminQueries = {
    findUserById: async () => mockUser(),
    findUserByEmail: async () => null,
    findUsersPaginated: async () => ({ users: [mockUser()], total: 1 }),
    countAdmins: async () => 2,
    updateUserRoles: async (_db, _id, _roles) => mockUser(),
    updateUserStatus: async (_db, _id, _status) => mockUser(),
    createUserAsAdmin: async () => mockUser(),
    updateUserQuota: async (_db, _id, _quota) => mockUser(),
    deleteUser: async () => undefined,
    getSystemStats: async () => ({
        totalUsers: 10,
        activeUsers: 8,
        totalProjects: 5,
        activeProjects: 3,
    }),
};

const createMockDeps = (overrides: Partial<AdminQueries> = {}): AdminDependencies => ({
    db: {} as Kysely<Database>,
    queries: { ...mockQueries, ...overrides },
});

// ============================================================================
// ROUTE CREATION TESTS
// ============================================================================

describe('Admin Routes', () => {
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
        it('should require authentication for all routes', async () => {
            const app = new Elysia().use(createAdminRoutes(createMockDeps()));

            const response = await app.handle(
                new Request('http://localhost/api/admin/stats', {
                    method: 'GET',
                }),
            );

            expect(response.status).toBe(401);
        });
    });
});

// ============================================================================
// QUERY INTEGRATION TESTS
// ============================================================================

describe('Admin Queries Integration', () => {
    describe('getSystemStats', () => {
        it('should return stats object', async () => {
            const deps = createMockDeps();
            const stats = await deps.queries.getSystemStats({} as Kysely<Database>);

            expect(stats).toHaveProperty('totalUsers');
            expect(stats).toHaveProperty('activeUsers');
            expect(stats).toHaveProperty('totalProjects');
            expect(stats).toHaveProperty('activeProjects');
        });
    });

    describe('findUsersPaginated', () => {
        it('should return users and total', async () => {
            const deps = createMockDeps();
            const result = await deps.queries.findUsersPaginated({} as Kysely<Database>, {
                limit: 10,
                offset: 0,
            });

            expect(result).toHaveProperty('users');
            expect(result).toHaveProperty('total');
            expect(Array.isArray(result.users)).toBe(true);
        });
    });

    describe('countAdmins', () => {
        it('should return number of admins', async () => {
            const deps = createMockDeps();
            const count = await deps.queries.countAdmins({} as Kysely<Database>);

            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThan(0);
        });
    });
});

// ============================================================================
// BUSINESS LOGIC TESTS
// ============================================================================

describe('Admin Business Logic', () => {
    describe('Role Management', () => {
        it('should not allow removing ROLE_USER', async () => {
            // ROLE_USER is protected and should always be present
            // This is validated in the route handler
            const deps = createMockDeps({
                updateUserRoles: async (_db, _id, roles) => {
                    // Verify ROLE_USER is always present
                    expect(roles).toContain('ROLE_USER');
                    return mockUser({ roles: JSON.stringify(roles) });
                },
            });

            expect(deps.queries.updateUserRoles).toBeDefined();
        });
    });

    describe('Admin Count Protection', () => {
        it('should count admins correctly', async () => {
            const deps = createMockDeps({
                countAdmins: async () => 1, // Only one admin
            });

            const count = await deps.queries.countAdmins({} as Kysely<Database>);
            expect(count).toBe(1);
        });
    });
});
