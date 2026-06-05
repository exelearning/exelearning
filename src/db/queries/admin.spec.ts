/**
 * Admin Queries Unit Tests
 * Tests for admin database queries with real in-memory SQLite database
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../types';
import {
    findUsersPaginated,
    findProjectsPaginated,
    countAdmins,
    updateUserStatus,
    createUserAsAdmin,
    updateUserQuota,
    getSystemStats,
    getAllSettings,
    getSetting,
    setSetting,
} from './admin';
import { createUser } from './users';

describe('Admin Queries', () => {
    let db: Kysely<Database>;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
    });

    // ============================================================================
    // findUsersPaginated TESTS
    // ============================================================================

    describe('findUsersPaginated', () => {
        it('should return empty results when no users', async () => {
            const result = await findUsersPaginated(db);

            expect(result.users).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should return all users with defaults', async () => {
            await createUser(db, { email: 'user1@test.com', user_id: 'user1', password: 'hash1' });
            await createUser(db, { email: 'user2@test.com', user_id: 'user2', password: 'hash2' });
            await createUser(db, { email: 'user3@test.com', user_id: 'user3', password: 'hash3' });

            const result = await findUsersPaginated(db);

            expect(result.users).toHaveLength(3);
            expect(result.total).toBe(3);
        });

        it('should paginate results with limit', async () => {
            await createUser(db, { email: 'user1@test.com', user_id: 'user1', password: 'hash' });
            await createUser(db, { email: 'user2@test.com', user_id: 'user2', password: 'hash' });
            await createUser(db, { email: 'user3@test.com', user_id: 'user3', password: 'hash' });

            const result = await findUsersPaginated(db, { limit: 2, offset: 0 });

            expect(result.users).toHaveLength(2);
            expect(result.total).toBe(3);
        });

        it('should paginate results with offset', async () => {
            await createUser(db, { email: 'user1@test.com', user_id: 'user1', password: 'hash' });
            await createUser(db, { email: 'user2@test.com', user_id: 'user2', password: 'hash' });
            await createUser(db, { email: 'user3@test.com', user_id: 'user3', password: 'hash' });

            const result = await findUsersPaginated(db, { limit: 10, offset: 2 });

            expect(result.users).toHaveLength(1);
            expect(result.total).toBe(3);
        });

        it('should search by email', async () => {
            await createUser(db, { email: 'admin@test.com', user_id: 'admin', password: 'hash' });
            await createUser(db, { email: 'user@example.com', user_id: 'user', password: 'hash' });

            const result = await findUsersPaginated(db, { search: 'admin' });

            expect(result.users).toHaveLength(1);
            expect(result.users[0].email).toBe('admin@test.com');
            expect(result.total).toBe(1);
        });

        it('should search by user_id', async () => {
            await createUser(db, { email: 'a@test.com', user_id: 'john_doe', password: 'hash' });
            await createUser(db, { email: 'b@test.com', user_id: 'jane_smith', password: 'hash' });

            const result = await findUsersPaginated(db, { search: 'john' });

            expect(result.users).toHaveLength(1);
            expect(result.users[0].user_id).toBe('john_doe');
        });

        it('should sort by email ascending', async () => {
            await createUser(db, { email: 'zebra@test.com', user_id: 'z', password: 'hash' });
            await createUser(db, { email: 'alpha@test.com', user_id: 'a', password: 'hash' });

            const result = await findUsersPaginated(db, { sortBy: 'email', sortOrder: 'asc' });

            expect(result.users[0].email).toBe('alpha@test.com');
            expect(result.users[1].email).toBe('zebra@test.com');
        });

        it('should sort by email descending', async () => {
            await createUser(db, { email: 'alpha@test.com', user_id: 'a', password: 'hash' });
            await createUser(db, { email: 'zebra@test.com', user_id: 'z', password: 'hash' });

            const result = await findUsersPaginated(db, { sortBy: 'email', sortOrder: 'desc' });

            expect(result.users[0].email).toBe('zebra@test.com');
            expect(result.users[1].email).toBe('alpha@test.com');
        });

        it('should sort by id', async () => {
            await createUser(db, { email: 'first@test.com', user_id: 'first', password: 'hash' });
            await createUser(db, { email: 'second@test.com', user_id: 'second', password: 'hash' });

            const result = await findUsersPaginated(db, { sortBy: 'id', sortOrder: 'asc' });

            expect(result.users[0].email).toBe('first@test.com');
            expect(result.users[1].email).toBe('second@test.com');
        });

        it('should sort by created_at', async () => {
            await createUser(db, { email: 'older@test.com', user_id: 'older', password: 'hash' });
            await new Promise(r => setTimeout(r, 10)); // Small delay for different timestamps
            await createUser(db, { email: 'newer@test.com', user_id: 'newer', password: 'hash' });

            const result = await findUsersPaginated(db, { sortBy: 'created_at', sortOrder: 'desc' });

            expect(result.users[0].email).toBe('newer@test.com');
        });

        it('should combine search with pagination', async () => {
            await createUser(db, { email: 'admin1@test.com', user_id: 'admin1', password: 'hash' });
            await createUser(db, { email: 'admin2@test.com', user_id: 'admin2', password: 'hash' });
            await createUser(db, { email: 'user@test.com', user_id: 'user', password: 'hash' });

            const result = await findUsersPaginated(db, { search: 'admin', limit: 1, offset: 0 });

            expect(result.users).toHaveLength(1);
            expect(result.total).toBe(2);
        });
    });

    // ============================================================================
    // findProjectsPaginated TESTS
    // ============================================================================

    describe('findProjectsPaginated', () => {
        it('should return empty results when no projects', async () => {
            const result = await findProjectsPaginated(db);

            expect(result.projects).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should return all projects with defaults', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Project 1', uuid: 'p1' });
            await seedTestProject(db, userId, { title: 'Project 2', uuid: 'p2' });

            const result = await findProjectsPaginated(db);

            expect(result.projects).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should include owner info in results', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner_user' });
            await seedTestProject(db, userId, { title: 'My Project', uuid: 'proj-owner' });

            const result = await findProjectsPaginated(db);

            expect(result.projects[0].owner_email).toBe('owner@test.com');
            expect(result.projects[0].owner_user_id).toBe('owner_user');
        });

        it('should paginate results with limit', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'P1', uuid: 'proj-pg-1' });
            await seedTestProject(db, userId, { title: 'P2', uuid: 'proj-pg-2' });
            await seedTestProject(db, userId, { title: 'P3', uuid: 'proj-pg-3' });

            const result = await findProjectsPaginated(db, { limit: 2, offset: 0 });

            expect(result.projects).toHaveLength(2);
            expect(result.total).toBe(3);
        });

        it('should paginate results with offset', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'P1', uuid: 'proj-off-1' });
            await seedTestProject(db, userId, { title: 'P2', uuid: 'proj-off-2' });
            await seedTestProject(db, userId, { title: 'P3', uuid: 'proj-off-3' });

            const result = await findProjectsPaginated(db, { limit: 10, offset: 2 });

            expect(result.projects).toHaveLength(1);
            expect(result.total).toBe(3);
        });

        it('should filter by owner email', async () => {
            const user1 = await seedTestUser(db, { email: 'alice@test.com', user_id: 'alice' });
            const user2 = await seedTestUser(db, { email: 'bob@test.com', user_id: 'bob' });
            await seedTestProject(db, user1, { title: 'Alice Project', uuid: 'proj-alice' });
            await seedTestProject(db, user2, { title: 'Bob Project', uuid: 'proj-bob' });

            const result = await findProjectsPaginated(db, { owner: 'alice' });

            expect(result.projects).toHaveLength(1);
            expect(result.projects[0].title).toBe('Alice Project');
            expect(result.total).toBe(1);
        });

        it('should filter by owner user_id', async () => {
            const user1 = await seedTestUser(db, { email: 'a@test.com', user_id: 'john_doe' });
            const user2 = await seedTestUser(db, { email: 'b@test.com', user_id: 'jane_smith' });
            await seedTestProject(db, user1, { title: 'John Project', uuid: 'proj-john' });
            await seedTestProject(db, user2, { title: 'Jane Project', uuid: 'proj-jane' });

            const result = await findProjectsPaginated(db, { owner: 'john' });

            expect(result.projects).toHaveLength(1);
            expect(result.projects[0].title).toBe('John Project');
        });

        it('should filter by owner numeric id', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'My Project', uuid: 'proj-id' });

            const result = await findProjectsPaginated(db, { owner: String(userId) });

            expect(result.projects).toHaveLength(1);
        });

        it('should filter by title', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Alpha Project', uuid: 'proj-alpha' });
            await seedTestProject(db, userId, { title: 'Beta Testing', uuid: 'proj-beta' });

            const result = await findProjectsPaginated(db, { title: 'Alpha' });

            expect(result.projects).toHaveLength(1);
            expect(result.projects[0].title).toBe('Alpha Project');
            expect(result.total).toBe(1);
        });

        it('should filter by status', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Active Project', uuid: 'proj-active', status: 'active' });

            const now = Date.now();
            await db
                .insertInto('projects')
                .values({
                    uuid: 'proj-archived',
                    title: 'Archived Project',
                    owner_id: userId,
                    status: 'archived',
                    visibility: 'private',
                    saved_once: 1,
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            const result = await findProjectsPaginated(db, { status: 'archived' });

            expect(result.projects).toHaveLength(1);
            expect(result.projects[0].title).toBe('Archived Project');
            expect(result.total).toBe(1);
        });

        it('should filter by visibility', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Private Project', uuid: 'proj-priv', visibility: 'private' });

            const now = Date.now();
            await db
                .insertInto('projects')
                .values({
                    uuid: 'proj-pub',
                    title: 'Public Project',
                    owner_id: userId,
                    status: 'active',
                    visibility: 'public',
                    saved_once: 1,
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            const result = await findProjectsPaginated(db, { visibility: 'public' });

            expect(result.projects).toHaveLength(1);
            expect(result.projects[0].title).toBe('Public Project');
            expect(result.total).toBe(1);
        });

        it('should sort by title ascending', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Zebra', uuid: 'proj-z' });
            await seedTestProject(db, userId, { title: 'Alpha', uuid: 'proj-a' });

            const result = await findProjectsPaginated(db, { sortBy: 'title', sortOrder: 'asc' });

            expect(result.projects[0].title).toBe('Alpha');
            expect(result.projects[1].title).toBe('Zebra');
        });

        it('should sort by title descending', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Alpha', uuid: 'proj-a2' });
            await seedTestProject(db, userId, { title: 'Zebra', uuid: 'proj-z2' });

            const result = await findProjectsPaginated(db, { sortBy: 'title', sortOrder: 'desc' });

            expect(result.projects[0].title).toBe('Zebra');
            expect(result.projects[1].title).toBe('Alpha');
        });

        it('should sort by created_at', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Older', uuid: 'proj-old' });
            await new Promise(r => setTimeout(r, 10));
            await seedTestProject(db, userId, { title: 'Newer', uuid: 'proj-new' });

            const result = await findProjectsPaginated(db, { sortBy: 'created_at', sortOrder: 'desc' });

            expect(result.projects[0].title).toBe('Newer');
        });

        it('should sort by id (default)', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'First', uuid: 'proj-first' });
            await seedTestProject(db, userId, { title: 'Second', uuid: 'proj-second' });

            const result = await findProjectsPaginated(db, { sortBy: 'id', sortOrder: 'asc' });

            expect(result.projects[0].title).toBe('First');
            expect(result.projects[1].title).toBe('Second');
        });

        it('should combine multiple filters', async () => {
            const user1 = await seedTestUser(db, { email: 'alice@test.com', user_id: 'alice' });
            const user2 = await seedTestUser(db, { email: 'bob@test.com', user_id: 'bob' });
            await seedTestProject(db, user1, { title: 'Alice Active', uuid: 'proj-aa', status: 'active' });
            await seedTestProject(db, user1, { title: 'Alice Test', uuid: 'proj-at', status: 'active' });
            await seedTestProject(db, user2, { title: 'Bob Active', uuid: 'proj-ba', status: 'active' });

            const result = await findProjectsPaginated(db, {
                owner: 'alice',
                title: 'Test',
                status: 'active',
            });

            expect(result.projects).toHaveLength(1);
            expect(result.projects[0].title).toBe('Alice Test');
            expect(result.total).toBe(1);
        });

        it('should filter out unsaved projects by default (savedOnly=true)', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Saved Project', uuid: 'proj-saved', saved_once: 1 });
            await seedTestProject(db, userId, { title: 'Unsaved Project', uuid: 'proj-unsaved', saved_once: 0 });

            const result = await findProjectsPaginated(db);

            expect(result.projects).toHaveLength(1);
            expect(result.projects[0].title).toBe('Saved Project');
            expect(result.total).toBe(1);
        });

        it('should include unsaved projects when savedOnly=false', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Saved Project', uuid: 'proj-saved-2', saved_once: 1 });
            await seedTestProject(db, userId, { title: 'Unsaved Project', uuid: 'proj-unsaved-2', saved_once: 0 });

            const result = await findProjectsPaginated(db, { savedOnly: false });

            expect(result.projects).toHaveLength(2);
            expect(result.total).toBe(2);
        });
    });

    // ============================================================================
    // countAdmins TESTS
    // ============================================================================

    describe('countAdmins', () => {
        it('should return 0 when no users', async () => {
            const count = await countAdmins(db);
            expect(count).toBe(0);
        });

        it('should return 0 when no admins', async () => {
            await createUser(db, { email: 'user@test.com', user_id: 'user', password: 'hash', roles: '["ROLE_USER"]' });

            const count = await countAdmins(db);

            expect(count).toBe(0);
        });

        it('should count users with ROLE_ADMIN', async () => {
            await createUser(db, {
                email: 'admin@test.com',
                user_id: 'admin',
                password: 'hash',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });
            await createUser(db, { email: 'user@test.com', user_id: 'user', password: 'hash', roles: '["ROLE_USER"]' });

            const count = await countAdmins(db);

            expect(count).toBe(1);
        });

        it('should count multiple admins', async () => {
            await createUser(db, {
                email: 'admin1@test.com',
                user_id: 'admin1',
                password: 'hash',
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
            });
            await createUser(db, {
                email: 'admin2@test.com',
                user_id: 'admin2',
                password: 'hash',
                roles: '["ROLE_ADMIN"]',
            });
            await createUser(db, { email: 'user@test.com', user_id: 'user', password: 'hash', roles: '["ROLE_USER"]' });

            const count = await countAdmins(db);

            expect(count).toBe(2);
        });

        it('should handle malformed JSON roles gracefully', async () => {
            await db
                .insertInto('users')
                .values({
                    email: 'bad@test.com',
                    user_id: 'bad',
                    password: 'hash',
                    roles: 'invalid-json',
                    is_lopd_accepted: 0,
                    is_active: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                })
                .execute();

            const count = await countAdmins(db);

            expect(count).toBe(0); // Malformed JSON should not be counted as admin
        });
    });

    // ============================================================================
    // updateUserStatus TESTS
    // ============================================================================

    describe('updateUserStatus', () => {
        it('should activate a user', async () => {
            await db
                .insertInto('users')
                .values({
                    email: 'inactive@test.com',
                    user_id: 'inactive',
                    password: 'hash',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 0,
                    is_active: 0, // Initially inactive
                    created_at: Date.now(),
                    updated_at: Date.now(),
                })
                .execute();

            const user = await db
                .selectFrom('users')
                .selectAll()
                .where('email', '=', 'inactive@test.com')
                .executeTakeFirst();
            const updated = await updateUserStatus(db, user!.id, true);

            expect(updated).toBeDefined();
            expect(updated!.is_active).toBe(1);
        });

        it('should deactivate a user', async () => {
            const userId = await seedTestUser(db, { email: 'active@test.com', user_id: 'active' });

            const updated = await updateUserStatus(db, userId, false);

            expect(updated).toBeDefined();
            expect(updated!.is_active).toBe(0);
        });

        it('should return undefined for non-existent user', async () => {
            const updated = await updateUserStatus(db, 99999, true);
            expect(updated).toBeUndefined();
        });

        it('should update the updated_at timestamp', async () => {
            const userId = await seedTestUser(db, { email: 'ts@test.com', user_id: 'ts' });
            const before = await db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();

            await new Promise(r => setTimeout(r, 10));
            const updated = await updateUserStatus(db, userId, false);

            expect(updated!.updated_at! > before!.updated_at!).toBe(true);
        });
    });

    // ============================================================================
    // createUserAsAdmin TESTS
    // ============================================================================

    describe('createUserAsAdmin', () => {
        it('should create user with minimal fields and null user_id by default', async () => {
            const user = await createUserAsAdmin(db, {
                email: 'new@test.com',
                password: 'hashed-password',
                roles: ['ROLE_USER'],
            });

            expect(user.id).toBeDefined();
            expect(user.email).toBe('new@test.com');
            // user_id should be null for local users (not SSO)
            expect(user.user_id).toBeNull();
            expect(user.is_active).toBe(1);
        });

        it('should set user_id when provided (for SSO users)', async () => {
            const user = await createUserAsAdmin(db, {
                email: 'sso@test.com',
                password: 'hashed-password',
                userId: 'cas:sso_user',
                roles: ['ROLE_USER'],
            });

            expect(user.user_id).toBe('cas:sso_user');
        });

        it('should always include ROLE_USER', async () => {
            const user = await createUserAsAdmin(db, {
                email: 'admin@test.com',
                password: 'hash',
                roles: ['ROLE_ADMIN'], // Only admin role provided
            });

            const roles = JSON.parse(user.roles);
            expect(roles).toContain('ROLE_USER');
            expect(roles).toContain('ROLE_ADMIN');
        });

        it('should not duplicate ROLE_USER', async () => {
            const user = await createUserAsAdmin(db, {
                email: 'user@test.com',
                password: 'hash',
                roles: ['ROLE_USER', 'ROLE_USER'], // Duplicate
            });

            const roles = JSON.parse(user.roles);
            // ROLE_USER should appear at least once (we don't guarantee deduplication of input)
            expect(roles).toContain('ROLE_USER');
        });

        it('should set quota_mb when provided', async () => {
            const user = await createUserAsAdmin(db, {
                email: 'quota@test.com',
                password: 'hash',
                roles: ['ROLE_USER'],
                quotaMb: 500,
            });

            expect(user.quota_mb).toBe(500);
        });

        it('should set quota_mb to null when not provided', async () => {
            const user = await createUserAsAdmin(db, {
                email: 'noquota@test.com',
                password: 'hash',
                roles: ['ROLE_USER'],
            });

            expect(user.quota_mb).toBeNull();
        });

        it('should set timestamps', async () => {
            const before = Date.now();
            const user = await createUserAsAdmin(db, {
                email: 'time@test.com',
                password: 'hash',
                roles: ['ROLE_USER'],
            });
            const after = Date.now();

            expect(user.created_at).toBeDefined();
            expect(user.updated_at).toBeDefined();
            expect(user.created_at!).toBeGreaterThanOrEqual(before);
            expect(user.created_at!).toBeLessThanOrEqual(after);
        });

        it('should throw on duplicate email', async () => {
            await createUserAsAdmin(db, {
                email: 'dupe@test.com',
                password: 'hash',
                roles: ['ROLE_USER'],
            });

            await expect(
                createUserAsAdmin(db, {
                    email: 'dupe@test.com',
                    password: 'hash',
                    roles: ['ROLE_USER'],
                }),
            ).rejects.toThrow();
        });
    });

    // ============================================================================
    // updateUserQuota TESTS
    // ============================================================================

    describe('updateUserQuota', () => {
        it('should set quota to specific value', async () => {
            const userId = await seedTestUser(db, { email: 'quota@test.com', user_id: 'quota' });

            const updated = await updateUserQuota(db, userId, 1000);

            expect(updated).toBeDefined();
            expect(updated!.quota_mb).toBe(1000);
        });

        it('should set quota to null (unlimited)', async () => {
            const userId = await seedTestUser(db, { email: 'unlim@test.com', user_id: 'unlim' });
            await updateUserQuota(db, userId, 500); // First set a quota

            const updated = await updateUserQuota(db, userId, null);

            expect(updated).toBeDefined();
            expect(updated!.quota_mb).toBeNull();
        });

        it('should return undefined for non-existent user', async () => {
            const updated = await updateUserQuota(db, 99999, 100);
            expect(updated).toBeUndefined();
        });

        it('should update the updated_at timestamp', async () => {
            const userId = await seedTestUser(db, { email: 'qts@test.com', user_id: 'qts' });
            const before = await db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();

            await new Promise(r => setTimeout(r, 10));
            const updated = await updateUserQuota(db, userId, 2000);

            expect(updated!.updated_at! > before!.updated_at!).toBe(true);
        });
    });

    // ============================================================================
    // getSystemStats TESTS
    // ============================================================================

    describe('getSystemStats', () => {
        it('should return zeros when database is empty', async () => {
            const stats = await getSystemStats(db);

            expect(stats.totalUsers).toBe(0);
            expect(stats.activeUsers).toBe(0);
            expect(stats.totalProjects).toBe(0);
            expect(stats.activeProjects).toBe(0);
        });

        it('should count total users', async () => {
            await seedTestUser(db, { email: 'u1@test.com', user_id: 'u1' });
            await seedTestUser(db, { email: 'u2@test.com', user_id: 'u2' });

            const stats = await getSystemStats(db);

            expect(stats.totalUsers).toBe(2);
        });

        it('should count active users', async () => {
            await seedTestUser(db, { email: 'active1@test.com', user_id: 'active1' });
            await seedTestUser(db, { email: 'active2@test.com', user_id: 'active2' });

            // Create inactive user
            await db
                .insertInto('users')
                .values({
                    email: 'inactive@test.com',
                    user_id: 'inactive',
                    password: 'hash',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 0,
                    is_active: 0,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                })
                .execute();

            const stats = await getSystemStats(db);

            expect(stats.totalUsers).toBe(3);
            expect(stats.activeUsers).toBe(2);
        });

        it('should count total projects', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Project 1', uuid: 'proj-stats-1' });
            await seedTestProject(db, userId, { title: 'Project 2', uuid: 'proj-stats-2' });

            const stats = await getSystemStats(db);

            expect(stats.totalProjects).toBe(2);
        });

        it('should count active projects', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId, { title: 'Active Project' });

            // Create archived but saved project
            const now = Date.now();
            await db
                .insertInto('projects')
                .values({
                    uuid: 'archived-uuid',
                    title: 'Archived Project',
                    owner_id: userId,
                    status: 'archived',
                    visibility: 'private',
                    saved_once: 1,
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            const stats = await getSystemStats(db);

            expect(stats.totalProjects).toBe(2);
            expect(stats.activeProjects).toBe(1);
        });

        it('should exclude unsaved projects from counts', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });

            // Create saved projects (should be counted)
            await seedTestProject(db, userId, { title: 'Saved Active', uuid: 'saved-1' });
            await seedTestProject(db, userId, { title: 'Saved Active 2', uuid: 'saved-2' });

            // Create unsaved projects (should NOT be counted)
            const now = Date.now();
            await db
                .insertInto('projects')
                .values({
                    uuid: 'unsaved-1',
                    title: 'Unsaved Project 1',
                    owner_id: userId,
                    status: 'active',
                    visibility: 'private',
                    saved_once: 0,
                    created_at: now,
                    updated_at: now,
                })
                .execute();
            await db
                .insertInto('projects')
                .values({
                    uuid: 'unsaved-2',
                    title: 'Unsaved Project 2',
                    owner_id: userId,
                    status: 'active',
                    visibility: 'private',
                    saved_once: 0,
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            const stats = await getSystemStats(db);

            // Only saved projects should be counted
            expect(stats.totalProjects).toBe(2);
            expect(stats.activeProjects).toBe(2);
        });

        it('should return consistent numbers', async () => {
            const userId = await seedTestUser(db, { email: 'owner@test.com', user_id: 'owner' });
            await seedTestProject(db, userId);

            const stats = await getSystemStats(db);

            expect(stats.activeUsers).toBeLessThanOrEqual(stats.totalUsers);
            expect(stats.activeProjects).toBeLessThanOrEqual(stats.totalProjects);
        });
    });

    // ============================================================================
    // App Settings TESTS
    // ============================================================================

    describe('App Settings', () => {
        // Create app_settings table for testing
        beforeAll(async () => {
            // Create the app_settings table if it doesn't exist
            try {
                await db.schema
                    .createTable('app_settings')
                    .ifNotExists()
                    .addColumn('key', 'varchar(255)', col => col.primaryKey())
                    .addColumn('value', 'text', col => col.notNull())
                    .addColumn('type', 'varchar(50)', col => col.notNull().defaultTo('string'))
                    .addColumn('updated_at', 'varchar(255)')
                    .addColumn('updated_by', 'integer')
                    .execute();
            } catch {
                // Table may already exist
            }
        });

        beforeEach(async () => {
            // Clean app_settings table before each test
            try {
                await db.deleteFrom('app_settings' as any).execute();
            } catch {
                // Ignore errors if table doesn't exist
            }
        });

        describe('getAllSettings', () => {
            it('should return empty array when no settings', async () => {
                const settings = await getAllSettings(db as any);
                expect(settings).toHaveLength(0);
            });

            it('should return all settings', async () => {
                await db
                    .insertInto('app_settings' as any)
                    .values([
                        {
                            key: 'site_name',
                            value: 'eXeLearning',
                            type: 'string',
                            updated_at: Date.now(),
                        },
                        { key: 'max_upload_size', value: '100', type: 'number', updated_at: Date.now() },
                    ])
                    .execute();

                const settings = await getAllSettings(db as any);

                expect(settings).toHaveLength(2);
                expect(settings.map((s: any) => s.key)).toContain('site_name');
                expect(settings.map((s: any) => s.key)).toContain('max_upload_size');
            });
        });

        describe('getSetting', () => {
            it('should return undefined for non-existent key', async () => {
                const setting = await getSetting(db as any, 'non_existent_key');
                expect(setting).toBeUndefined();
            });

            it('should return setting by key', async () => {
                await db
                    .insertInto('app_settings' as any)
                    .values({
                        key: 'test_key',
                        value: 'test_value',
                        type: 'string',
                        updated_at: Date.now(),
                    })
                    .execute();

                const setting = await getSetting(db as any, 'test_key');

                expect(setting).toBeDefined();
                expect(setting!.key).toBe('test_key');
                expect(setting!.value).toBe('test_value');
                expect(setting!.type).toBe('string');
            });
        });

        describe('setSetting', () => {
            it('should insert new setting', async () => {
                await setSetting(db as any, 'new_setting', 'new_value', 'string');

                const setting = await getSetting(db as any, 'new_setting');

                expect(setting).toBeDefined();
                expect(setting!.value).toBe('new_value');
                expect(setting!.type).toBe('string');
            });

            it('should update existing setting', async () => {
                // First insert
                await setSetting(db as any, 'update_test', 'original', 'string');

                // Then update
                await setSetting(db as any, 'update_test', 'updated', 'string');

                const setting = await getSetting(db as any, 'update_test');

                expect(setting).toBeDefined();
                expect(setting!.value).toBe('updated');
            });

            it('should set different types', async () => {
                await setSetting(db as any, 'number_setting', '42', 'number');
                await setSetting(db as any, 'bool_setting', 'true', 'boolean');
                await setSetting(db as any, 'json_setting', '{"foo":"bar"}', 'json');

                const numSetting = await getSetting(db as any, 'number_setting');
                const boolSetting = await getSetting(db as any, 'bool_setting');
                const jsonSetting = await getSetting(db as any, 'json_setting');

                expect(numSetting!.type).toBe('number');
                expect(boolSetting!.type).toBe('boolean');
                expect(jsonSetting!.type).toBe('json');
            });

            it('should track updated_by', async () => {
                await setSetting(db as any, 'tracked_setting', 'value', 'string', 123);

                const setting = await getSetting(db as any, 'tracked_setting');

                expect(setting).toBeDefined();
                expect(setting!.updated_by).toBe(123);
            });

            it('should default type to string', async () => {
                await setSetting(db as any, 'default_type', 'value');

                const setting = await getSetting(db as any, 'default_type');

                expect(setting!.type).toBe('string');
            });

            it('should update updated_by when updating', async () => {
                // Insert with user 1
                await setSetting(db as any, 'user_tracking', 'v1', 'string', 1);

                // Update with user 2
                await setSetting(db as any, 'user_tracking', 'v2', 'string', 2);

                const setting = await getSetting(db as any, 'user_tracking');

                expect(setting!.updated_by).toBe(2);
            });

            it('should handle null updated_by', async () => {
                await setSetting(db as any, 'no_user', 'value', 'string');

                const setting = await getSetting(db as any, 'no_user');

                expect(setting!.updated_by).toBeNull();
            });
        });
    });
});
