/**
 * Tests for User Queries
 * Uses real in-memory SQLite database with dependency injection (no mocks)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../types';
import {
    findUserById,
    findUsersByIds,
    findUserByEmail,
    findUserByExternalId,
    findUserByApiToken,
    getAllUsers,
    countUsers,
    createUser,
    updateUser,
    deleteUser,
    findOrCreateExternalUser,
    updateApiToken,
    findFirstUser,
    updateUserRoles,
} from './users';

describe('User Queries', () => {
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
    // READ QUERIES
    // ============================================================================

    describe('findUserById', () => {
        it('should find user by ID', async () => {
            const created = await createUser(db, {
                email: 'test@example.com',
                user_id: 'user-1',
                password: 'hashed',
            });

            const found = await findUserById(db, created.id);

            expect(found).toBeDefined();
            expect(found!.id).toBe(created.id);
            expect(found!.email).toBe('test@example.com');
        });

        it('should return undefined for non-existent ID', async () => {
            const found = await findUserById(db, 99999);
            expect(found).toBeUndefined();
        });
    });

    describe('findUsersByIds', () => {
        it('should return empty array when given empty ids array', async () => {
            const users = await findUsersByIds(db, []);
            expect(users).toEqual([]);
        });

        it('should return matching users for given ids', async () => {
            const u1 = await createUser(db, { email: 'ids1@test.com', user_id: 'ids1', password: 'h' });
            const u2 = await createUser(db, { email: 'ids2@test.com', user_id: 'ids2', password: 'h' });
            await createUser(db, { email: 'ids3@test.com', user_id: 'ids3', password: 'h' });

            const found = await findUsersByIds(db, [u1.id, u2.id]);

            expect(found.length).toBe(2);
            expect(found.map(u => u.email).sort()).toEqual(['ids1@test.com', 'ids2@test.com']);
        });

        it('should not return users whose ids are not in the list', async () => {
            const u1 = await createUser(db, { email: 'only1@test.com', user_id: 'only1', password: 'h' });
            await createUser(db, { email: 'only2@test.com', user_id: 'only2', password: 'h' });

            const found = await findUsersByIds(db, [u1.id]);

            expect(found.length).toBe(1);
            expect(found[0].email).toBe('only1@test.com');
        });

        it('should work with a single id', async () => {
            const u1 = await createUser(db, { email: 'single@test.com', user_id: 'single', password: 'h' });

            const found = await findUsersByIds(db, [u1.id]);

            expect(found.length).toBe(1);
            expect(found[0].id).toBe(u1.id);
            expect(found[0].email).toBe('single@test.com');
        });
    });

    describe('findUserByEmail', () => {
        it('should find user by email', async () => {
            await createUser(db, {
                email: 'findme@example.com',
                user_id: 'user-find',
                password: 'hashed',
            });

            const found = await findUserByEmail(db, 'findme@example.com');

            expect(found).toBeDefined();
            expect(found!.email).toBe('findme@example.com');
        });

        it('should return undefined for non-existent email', async () => {
            const found = await findUserByEmail(db, 'nonexistent@example.com');
            expect(found).toBeUndefined();
        });

        it('should be case-sensitive for email', async () => {
            await createUser(db, {
                email: 'Test@Example.com',
                user_id: 'user-case',
                password: 'hashed',
            });

            const found = await findUserByEmail(db, 'test@example.com');
            expect(found).toBeUndefined();
        });
    });

    describe('findUserByExternalId', () => {
        it('should find user by external identifier', async () => {
            await createUser(db, {
                email: 'external@example.com',
                user_id: 'user-ext',
                password: 'hashed',
                external_identifier: 'ext-12345',
            });

            const found = await findUserByExternalId(db, 'ext-12345');

            expect(found).toBeDefined();
            expect(found!.external_identifier).toBe('ext-12345');
        });

        it('should return undefined for non-existent external ID', async () => {
            const found = await findUserByExternalId(db, 'nonexistent-ext');
            expect(found).toBeUndefined();
        });
    });

    describe('findUserByApiToken', () => {
        it('should find user by API token', async () => {
            const user = await createUser(db, {
                email: 'api@example.com',
                user_id: 'user-api',
                password: 'hashed',
            });
            await updateApiToken(db, user.id, 'token-abc123');

            const found = await findUserByApiToken(db, 'token-abc123');

            expect(found).toBeDefined();
            expect(found!.api_token).toBe('token-abc123');
        });

        it('should return undefined for non-existent token', async () => {
            const found = await findUserByApiToken(db, 'nonexistent-token');
            expect(found).toBeUndefined();
        });
    });

    describe('getAllUsers', () => {
        it('should return empty array when no users', async () => {
            const users = await getAllUsers(db);
            expect(users).toEqual([]);
        });

        it('should return all users', async () => {
            await createUser(db, { email: 'u1@test.com', user_id: 'u1', password: 'h' });
            await createUser(db, { email: 'u2@test.com', user_id: 'u2', password: 'h' });
            await createUser(db, { email: 'u3@test.com', user_id: 'u3', password: 'h' });

            const users = await getAllUsers(db);

            expect(users.length).toBe(3);
            expect(users.map(u => u.email).sort()).toEqual(['u1@test.com', 'u2@test.com', 'u3@test.com']);
        });
    });

    describe('countUsers', () => {
        it('should return 0 when no users', async () => {
            const count = await countUsers(db);
            expect(count).toBe(0);
        });

        it('should return correct count', async () => {
            await createUser(db, { email: 'c1@test.com', user_id: 'c1', password: 'h' });
            await createUser(db, { email: 'c2@test.com', user_id: 'c2', password: 'h' });

            const count = await countUsers(db);

            expect(count).toBe(2);
        });
    });

    // ============================================================================
    // WRITE QUERIES
    // ============================================================================

    describe('createUser', () => {
        it('should create user with minimal data', async () => {
            const user = await createUser(db, {
                email: 'new@example.com',
                user_id: 'new-user',
                password: 'hashed-pass',
            });

            expect(user.id).toBeDefined();
            expect(user.email).toBe('new@example.com');
            expect(user.user_id).toBe('new-user');
            expect(user.password).toBe('hashed-pass');
            expect(user.is_active).toBe(1);
            expect(user.is_lopd_accepted).toBe(0);
        });

        it('should create user with all fields', async () => {
            const user = await createUser(db, {
                email: 'full@example.com',
                user_id: 'full-user',
                password: 'hashed',
                roles: '["ROLE_USER","ROLE_ADMIN"]',
                external_identifier: 'ext-999',
                quota_mb: 2048,
                is_lopd_accepted: 1,
                is_active: 1,
            });

            expect(user.roles).toBe('["ROLE_USER","ROLE_ADMIN"]');
            expect(user.external_identifier).toBe('ext-999');
            expect(user.quota_mb).toBe(2048);
            expect(user.is_lopd_accepted).toBe(1);
        });

        it('should set created_at and updated_at timestamps', async () => {
            const before = Date.now();
            const user = await createUser(db, {
                email: 'time@example.com',
                user_id: 'time-user',
                password: 'h',
            });
            const after = Date.now();

            expect(user.created_at).toBeDefined();
            expect(user.updated_at).toBeDefined();
            expect(user.created_at!).toBeGreaterThanOrEqual(before);
            expect(user.created_at!).toBeLessThanOrEqual(after);
        });

        it('should throw on duplicate email', async () => {
            await createUser(db, {
                email: 'dupe@example.com',
                user_id: 'user-1',
                password: 'h',
            });

            await expect(
                createUser(db, {
                    email: 'dupe@example.com',
                    user_id: 'user-2',
                    password: 'h',
                }),
            ).rejects.toThrow();
        });
    });

    describe('updateUser', () => {
        it('should update user fields', async () => {
            const user = await createUser(db, {
                email: 'update@example.com',
                user_id: 'update-user',
                password: 'old-hash',
            });

            const updated = await updateUser(db, user.id, {
                email: 'updated@example.com',
                password: 'new-hash',
            });

            expect(updated).toBeDefined();
            expect(updated!.email).toBe('updated@example.com');
            expect(updated!.password).toBe('new-hash');
        });

        it('should update updated_at timestamp', async () => {
            const user = await createUser(db, {
                email: 'ts@example.com',
                user_id: 'ts-user',
                password: 'h',
            });
            const originalTimestamp = user.updated_at;

            // Wait a bit to ensure different timestamp
            await new Promise(r => setTimeout(r, 10));

            const updated = await updateUser(db, user.id, { quota_mb: 1000 });

            expect(updated!.updated_at! > originalTimestamp!).toBe(true);
        });

        it('should return undefined for non-existent user', async () => {
            const updated = await updateUser(db, 99999, { email: 'new@test.com' });
            expect(updated).toBeUndefined();
        });
    });

    describe('deleteUser', () => {
        it('should delete user', async () => {
            const user = await createUser(db, {
                email: 'delete@example.com',
                user_id: 'delete-user',
                password: 'h',
            });

            await deleteUser(db, user.id);

            const found = await findUserById(db, user.id);
            expect(found).toBeUndefined();
        });

        it('should not throw for non-existent user', async () => {
            // Should complete without error
            await deleteUser(db, 99999);
        });
    });

    // ============================================================================
    // SPECIALIZED QUERIES
    // ============================================================================

    describe('findOrCreateExternalUser', () => {
        it('should find existing user by external ID', async () => {
            const existing = await createUser(db, {
                email: 'existing@example.com',
                user_id: 'existing-user',
                password: 'h',
                external_identifier: 'ext-existing',
            });

            const found = await findOrCreateExternalUser(
                db,
                'ext-existing',
                'new@example.com', // Different email
                'new-user',
                'new-pass',
            );

            expect(found.id).toBe(existing.id);
            expect(found.email).toBe('existing@example.com');
        });

        it('should find existing user by email if external ID not found', async () => {
            const existing = await createUser(db, {
                email: 'email-match@example.com',
                user_id: 'email-user',
                password: 'h',
            });

            const found = await findOrCreateExternalUser(
                db,
                'new-ext-id',
                'email-match@example.com',
                'new-user',
                'new-pass',
            );

            expect(found.id).toBe(existing.id);
        });

        it('should create new user if not found', async () => {
            const countBefore = await countUsers(db);

            const user = await findOrCreateExternalUser(
                db,
                'brand-new-ext',
                'brand-new@example.com',
                'brand-new-user',
                'hashed-pw',
                ['ROLE_USER', 'ROLE_EDITOR'],
            );

            const countAfter = await countUsers(db);

            expect(countAfter).toBe(countBefore + 1);
            expect(user.email).toBe('brand-new@example.com');
            expect(user.external_identifier).toBe('brand-new-ext');
            expect(user.roles).toBe('["ROLE_USER","ROLE_EDITOR"]');
        });
    });

    describe('updateApiToken', () => {
        it('should set API token', async () => {
            const user = await createUser(db, {
                email: 'token@example.com',
                user_id: 'token-user',
                password: 'h',
            });

            await updateApiToken(db, user.id, 'my-api-token');

            const found = await findUserById(db, user.id);
            expect(found!.api_token).toBe('my-api-token');
        });

        it('should clear API token with null', async () => {
            const user = await createUser(db, {
                email: 'clear@example.com',
                user_id: 'clear-user',
                password: 'h',
            });
            await updateApiToken(db, user.id, 'temp-token');
            await updateApiToken(db, user.id, null);

            const found = await findUserById(db, user.id);
            expect(found!.api_token).toBeNull();
        });
    });

    describe('findFirstUser', () => {
        it('should return undefined when no users', async () => {
            const user = await findFirstUser(db);
            expect(user).toBeUndefined();
        });

        it('should return first user', async () => {
            await createUser(db, { email: 'first@test.com', user_id: 'first', password: 'h' });
            await createUser(db, { email: 'second@test.com', user_id: 'second', password: 'h' });

            const first = await findFirstUser(db);

            expect(first).toBeDefined();
            // Just verify it returns one user, don't rely on order
            expect(['first@test.com', 'second@test.com']).toContain(first!.email);
        });
    });

    describe('updateUserRoles', () => {
        it('should update user roles', async () => {
            const user = await createUser(db, {
                email: 'roles@example.com',
                user_id: 'roles-user',
                password: 'h',
                roles: '["ROLE_USER"]',
            });

            const updated = await updateUserRoles(db, user.id, ['ROLE_USER', 'ROLE_ADMIN']);

            expect(updated).toBeDefined();
            expect(updated!.roles).toBe('["ROLE_USER","ROLE_ADMIN"]');
        });

        it('should return undefined for non-existent user', async () => {
            const updated = await updateUserRoles(db, 99999, ['ROLE_USER']);
            expect(updated).toBeUndefined();
        });

        it('should handle empty roles array', async () => {
            const user = await createUser(db, {
                email: 'empty@example.com',
                user_id: 'empty-user',
                password: 'h',
            });

            const updated = await updateUserRoles(db, user.id, []);

            expect(updated!.roles).toBe('[]');
        });
    });
});
