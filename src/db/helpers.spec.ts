/**
 * Tests for Cross-Database Helper Functions
 * Tests run with SQLite (default test database)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from './types';
import {
    getDialect,
    supportsReturning,
    resetDialectCache,
    toBinaryData,
    tableExists,
    columnExists,
    getAutoIncrementType,
    addAutoIncrement,
    getBinaryType,
    insertAndReturn,
    insertManyAndReturn,
    updateByIdAndReturn,
    updateByColumnAndReturn,
    deleteByColumnAndReturn,
    deleteByIdAndReturn,
} from './helpers';

describe('Database Helpers', () => {
    let db: Kysely<Database>;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        resetDialectCache();
    });

    // ============================================================================
    // DIALECT DETECTION
    // ============================================================================

    describe('getDialect', () => {
        it('should return sqlite for test environment', () => {
            const dialect = getDialect();
            expect(dialect).toBe('sqlite');
        });

        it('should cache the dialect', () => {
            const first = getDialect();
            const second = getDialect();
            expect(first).toBe(second);
        });
    });

    describe('supportsReturning', () => {
        it('should return true for SQLite', () => {
            expect(supportsReturning()).toBe(true);
        });
    });

    describe('resetDialectCache', () => {
        it('should reset the cached dialect', () => {
            getDialect(); // Cache it
            resetDialectCache();
            // Should still work after reset
            expect(getDialect()).toBe('sqlite');
        });
    });

    // ============================================================================
    // BINARY DATA HELPERS
    // ============================================================================

    describe('toBinaryData', () => {
        it('should handle Uint8Array input', () => {
            const input = new Uint8Array([1, 2, 3, 4, 5]);
            const result = toBinaryData(input);
            // For SQLite, should return Uint8Array
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result).toEqual(input);
        });

        it('should handle Buffer input', () => {
            const input = Buffer.from([1, 2, 3, 4, 5]);
            const result = toBinaryData(input);
            // For SQLite, should convert to Uint8Array
            expect(result).toBeInstanceOf(Uint8Array);
        });
    });

    // ============================================================================
    // TABLE/COLUMN EXISTENCE CHECKS
    // ============================================================================

    describe('tableExists', () => {
        it('should return true for existing table', async () => {
            const exists = await tableExists(db, 'users');
            expect(exists).toBe(true);
        });

        it('should return false for non-existent table', async () => {
            const exists = await tableExists(db, 'non_existent_table_xyz');
            expect(exists).toBe(false);
        });

        it('should check multiple tables', async () => {
            expect(await tableExists(db, 'projects')).toBe(true);
            expect(await tableExists(db, 'assets')).toBe(true);
            expect(await tableExists(db, 'users_preferences')).toBe(true);
        });
    });

    describe('columnExists', () => {
        it('should return true for existing column', async () => {
            const exists = await columnExists(db, 'users', 'email');
            expect(exists).toBe(true);
        });

        it('should return false for non-existent column', async () => {
            const exists = await columnExists(db, 'users', 'non_existent_column_xyz');
            expect(exists).toBe(false);
        });

        it('should return false for non-existent table', async () => {
            const exists = await columnExists(db, 'non_existent_table_xyz', 'id');
            expect(exists).toBe(false);
        });

        it('should check multiple columns', async () => {
            expect(await columnExists(db, 'users', 'id')).toBe(true);
            expect(await columnExists(db, 'users', 'password')).toBe(true);
            expect(await columnExists(db, 'users', 'roles')).toBe(true);
            expect(await columnExists(db, 'projects', 'uuid')).toBe(true);
        });
    });

    // ============================================================================
    // SCHEMA HELPERS
    // ============================================================================

    describe('getAutoIncrementType', () => {
        it('should return integer for SQLite', () => {
            expect(getAutoIncrementType()).toBe('integer');
        });
    });

    describe('addAutoIncrement', () => {
        it('should add autoIncrement for SQLite', () => {
            // This is harder to test directly without schema building
            // but we can verify the function exists and doesn't throw
            const mockColBuilder = {
                autoIncrement: () => mockColBuilder,
            };
            const result = addAutoIncrement(mockColBuilder as any);
            expect(result).toBe(mockColBuilder);
        });
    });

    describe('getBinaryType', () => {
        it('should return blob for SQLite', () => {
            expect(getBinaryType()).toBe('blob');
        });
    });

    // ============================================================================
    // INSERT HELPERS
    // ============================================================================

    describe('insertAndReturn', () => {
        it('should insert and return a user', async () => {
            const user = await insertAndReturn(db, 'users', {
                email: 'test@example.com',
                user_id: 'test-user',
                password: 'hashed',
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: Date.now(),
                updated_at: Date.now(),
            });

            expect(user).toBeDefined();
            expect(user.id).toBeDefined();
            expect(user.email).toBe('test@example.com');
            expect(user.user_id).toBe('test-user');
        });

        it('should insert and return a project', async () => {
            const userId = await seedTestUser(db);
            const project = await insertAndReturn(db, 'projects', {
                uuid: 'test-uuid-123',
                title: 'Test Project',
                owner_id: userId,
                status: 'active',
                visibility: 'private',
                saved_once: 0,
                created_at: Date.now(),
                updated_at: Date.now(),
            });

            expect(project).toBeDefined();
            expect(project.id).toBeDefined();
            expect(project.uuid).toBe('test-uuid-123');
            expect(project.title).toBe('Test Project');
        });
    });

    describe('insertManyAndReturn', () => {
        it('should return empty array for empty input', async () => {
            const result = await insertManyAndReturn(db, 'users', []);
            expect(result).toEqual([]);
        });

        it('should insert multiple users and return them', async () => {
            const users = await insertManyAndReturn(db, 'users', [
                {
                    email: 'user1@example.com',
                    user_id: 'user-1',
                    password: 'hashed',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 1,
                    is_active: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                },
                {
                    email: 'user2@example.com',
                    user_id: 'user-2',
                    password: 'hashed',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 1,
                    is_active: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                },
            ]);

            expect(users).toHaveLength(2);
            expect(users[0].email).toBe('user1@example.com');
            expect(users[1].email).toBe('user2@example.com');
        });
    });

    // ============================================================================
    // UPDATE HELPERS
    // ============================================================================

    describe('updateByIdAndReturn', () => {
        it('should update user by ID and return updated row', async () => {
            const userId = await seedTestUser(db, { email: 'original@example.com' });

            const updated = await updateByIdAndReturn(db, 'users', userId, {
                email: 'updated@example.com',
                updated_at: Date.now(),
            });

            expect(updated).toBeDefined();
            expect(updated!.id).toBe(userId);
            expect(updated!.email).toBe('updated@example.com');
        });

        it('should return undefined for non-existent ID', async () => {
            const updated = await updateByIdAndReturn(db, 'users', 99999, {
                email: 'new@example.com',
            });
            expect(updated).toBeUndefined();
        });
    });

    describe('updateByColumnAndReturn', () => {
        it('should update project by UUID and return updated row', async () => {
            const userId = await seedTestUser(db);
            await seedTestProject(db, userId, { uuid: 'test-uuid-456', title: 'Original' });

            const updated = await updateByColumnAndReturn(db, 'projects', 'uuid', 'test-uuid-456', {
                title: 'Updated Title',
                updated_at: Date.now(),
            });

            expect(updated).toBeDefined();
            expect(updated!.uuid).toBe('test-uuid-456');
            expect(updated!.title).toBe('Updated Title');
        });

        it('should return undefined for non-existent column value', async () => {
            const updated = await updateByColumnAndReturn(db, 'projects', 'uuid', 'non-existent-uuid', {
                title: 'New Title',
            });
            expect(updated).toBeUndefined();
        });
    });

    // ============================================================================
    // DELETE HELPERS
    // ============================================================================

    describe('deleteByColumnAndReturn', () => {
        it('should delete and return deleted rows', async () => {
            const userId = await seedTestUser(db);
            await seedTestProject(db, userId, { uuid: 'delete-me-1', title: 'Delete Me 1' });
            await seedTestProject(db, userId, { uuid: 'delete-me-2', title: 'Delete Me 2' });

            // Delete by owner_id
            const deleted = await deleteByColumnAndReturn(db, 'projects', 'owner_id', userId);

            expect(deleted).toHaveLength(2);
            expect(deleted.map(p => p.title).sort()).toEqual(['Delete Me 1', 'Delete Me 2']);

            // Verify they're gone
            const remaining = await db.selectFrom('projects').where('owner_id', '=', userId).selectAll().execute();
            expect(remaining).toHaveLength(0);
        });

        it('should return empty array when nothing to delete', async () => {
            const deleted = await deleteByColumnAndReturn(db, 'projects', 'uuid', 'non-existent-uuid');
            expect(deleted).toEqual([]);
        });
    });

    describe('deleteByIdAndReturn', () => {
        it('should delete by ID and return deleted row', async () => {
            const userId = await seedTestUser(db, { email: 'todelete@example.com' });

            const deleted = await deleteByIdAndReturn(db, 'users', userId);

            expect(deleted).toBeDefined();
            expect(deleted!.id).toBe(userId);
            expect(deleted!.email).toBe('todelete@example.com');

            // Verify it's gone
            const remaining = await db.selectFrom('users').where('id', '=', userId).selectAll().execute();
            expect(remaining).toHaveLength(0);
        });

        it('should return undefined for non-existent ID', async () => {
            const deleted = await deleteByIdAndReturn(db, 'users', 99999);
            expect(deleted).toBeUndefined();
        });
    });
});
