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
    fromBinaryData,
    tableExists,
    columnExists,
    getAutoIncrementType,
    addAutoIncrement,
    getBinaryType,
    insertIgnore,
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

    async function withDbDriver<T>(driver: string, fn: () => Promise<T>): Promise<T> {
        const originalDriver = process.env.DB_DRIVER;
        try {
            process.env.DB_DRIVER = driver;
            resetDialectCache();
            return await fn();
        } finally {
            process.env.DB_DRIVER = originalDriver;
            resetDialectCache();
        }
    }

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

        it('should return Buffer for MySQL dialect', () => {
            const originalDriver = process.env.DB_DRIVER;
            try {
                process.env.DB_DRIVER = 'mysql';
                resetDialectCache();
                const input = new Uint8Array([9, 8, 7]);
                const result = toBinaryData(input);
                expect(Buffer.isBuffer(result)).toBe(true);
                expect([...result]).toEqual([9, 8, 7]);
            } finally {
                process.env.DB_DRIVER = originalDriver;
                resetDialectCache();
            }
        });
    });

    describe('fromBinaryData', () => {
        it('should handle Uint8Array input', () => {
            const input = new Uint8Array([1, 2, 3, 4, 5]);
            const result = fromBinaryData(input);
            expect(result).toBeInstanceOf(Uint8Array);
            expect([...result]).toEqual([1, 2, 3, 4, 5]);
        });

        it('should handle Buffer input', () => {
            const input = Buffer.from([1, 2, 3, 4, 5]);
            const result = fromBinaryData(input);
            expect(result).toBeInstanceOf(Uint8Array);
            expect([...result]).toEqual([1, 2, 3, 4, 5]);
        });

        it('should return empty array for unknown types', () => {
            const result = fromBinaryData(null);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(0);
        });

        it('should roundtrip through toBinaryData', () => {
            const input = new Uint8Array([100, 150, 200, 250, 0, 1, 255]);
            const stored = toBinaryData(input);
            const result = fromBinaryData(stored);
            expect([...result]).toEqual([100, 150, 200, 250, 0, 1, 255]);
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

        it('should handle postgres branch gracefully', async () => {
            await withDbDriver('postgres', async () => {
                const exists = await tableExists(db, 'users');
                expect(exists).toBe(false);
            });
        });

        it('should handle mysql branch for existing table', async () => {
            await withDbDriver('mysql', async () => {
                const exists = await tableExists(db, 'users');
                expect(exists).toBe(true);
            });
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

        it('should handle postgres branch gracefully', async () => {
            await withDbDriver('postgres', async () => {
                const exists = await columnExists(db, 'users', 'email');
                expect(exists).toBe(false);
            });
        });

        it('should handle mysql branch for existing column', async () => {
            await withDbDriver('mysql', async () => {
                const exists = await columnExists(db, 'users', 'email');
                expect(exists).toBe(true);
            });
        });
    });

    // ============================================================================
    // SCHEMA HELPERS
    // ============================================================================

    describe('getAutoIncrementType', () => {
        it('should return integer for SQLite', () => {
            expect(getAutoIncrementType()).toBe('integer');
        });

        it('should return serial for Postgres', async () => {
            await withDbDriver('postgres', async () => {
                expect(getAutoIncrementType()).toBe('serial');
            });
        });
    });

    describe('addAutoIncrement', () => {
        it('should add autoIncrement for SQLite', () => {
            // This is harder to test directly without schema building
            // but we can verify the function exists and doesn't throw
            const colBuilder = {
                autoIncrement: () => colBuilder,
            };
            const result = addAutoIncrement(colBuilder as any);
            expect(result).toBe(colBuilder);
        });

        it('should skip autoIncrement for Postgres', async () => {
            await withDbDriver('postgres', async () => {
                let called = false;
                const colBuilder = {
                    autoIncrement: () => {
                        called = true;
                        return colBuilder;
                    },
                };
                const result = addAutoIncrement(colBuilder as any);
                expect(result).toBe(colBuilder);
                expect(called).toBe(false);
            });
        });
    });

    describe('getBinaryType', () => {
        it('should return blob for SQLite', () => {
            expect(getBinaryType()).toBe('blob');
        });

        it('should return bytea for Postgres', async () => {
            await withDbDriver('postgres', async () => {
                expect(getBinaryType()).toBe('bytea');
            });
        });

        it('should return a SQL fragment for MySQL', async () => {
            await withDbDriver('mysql', async () => {
                const result = getBinaryType();
                expect(typeof result).toBe('object');
                expect(result).not.toBeNull();
                expect('toOperationNode' in (result as object)).toBe(true);
            });
        });
    });

    // ============================================================================
    // INSERT HELPERS
    // ============================================================================

    describe('insertIgnore', () => {
        it('should insert a row when no conflict exists', async () => {
            const ownerId = await seedTestUser(db, { email: 'owner@example.com' });
            const projectId = await seedTestProject(db, ownerId, { uuid: 'ignore-test-1' });
            const collaboratorId = await seedTestUser(db, { email: 'collab@example.com' });

            await insertIgnore(db, 'project_collaborators', {
                project_id: projectId,
                user_id: collaboratorId,
            });

            const result = await db
                .selectFrom('project_collaborators')
                .selectAll()
                .where('project_id', '=', projectId)
                .where('user_id', '=', collaboratorId)
                .executeTakeFirst();

            expect(result).toBeDefined();
            expect(result!.project_id).toBe(projectId);
            expect(result!.user_id).toBe(collaboratorId);
        });

        it('should silently ignore duplicate inserts (no error thrown)', async () => {
            const ownerId = await seedTestUser(db, { email: 'owner2@example.com' });
            const projectId = await seedTestProject(db, ownerId, { uuid: 'ignore-test-2' });
            const collaboratorId = await seedTestUser(db, { email: 'collab2@example.com' });

            // Insert first time
            await insertIgnore(db, 'project_collaborators', {
                project_id: projectId,
                user_id: collaboratorId,
            });

            // Insert second time - should not throw
            await insertIgnore(db, 'project_collaborators', {
                project_id: projectId,
                user_id: collaboratorId,
            });

            // Verify only one row exists
            const count = await db
                .selectFrom('project_collaborators')
                .select(eb => eb.fn.count<number>('project_id').as('count'))
                .where('project_id', '=', projectId)
                .where('user_id', '=', collaboratorId)
                .executeTakeFirstOrThrow();

            expect(Number(count.count)).toBe(1);
        });

        it('should use mysql dialect branch when dialect is mysql', async () => {
            // MySQL's INSERT IGNORE syntax isn't supported by SQLite, so we expect an error.
            // This test verifies the MySQL code path is actually executed.
            const ownerId = await seedTestUser(db, { email: 'mysql-owner@example.com' });
            const projectId = await seedTestProject(db, ownerId, { uuid: 'mysql-ignore-test' });
            const collaboratorId = await seedTestUser(db, { email: 'mysql-collab@example.com' });

            await withDbDriver('mysql', async () => {
                expect(getDialect()).toBe('mysql');
                // The MySQL branch uses "INSERT IGNORE INTO" which SQLite doesn't support,
                // so this will throw a syntax error - but it proves the branch is executed.
                try {
                    await insertIgnore(db, 'project_collaborators', {
                        project_id: projectId,
                        user_id: collaboratorId,
                    });
                    // If we get here on actual MySQL, that's fine
                } catch (error: unknown) {
                    // SQLite throws "no such column: IGNORE" error because it doesn't understand the syntax
                    expect((error as Error).message).toContain('IGNORE');
                }
            });
        });
    });

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

    // ============================================================================
    // MYSQL BRANCHES (DRIVER OVERRIDE)
    // ============================================================================

    describe('mysql branches', () => {
        it('should insert and return row using mysql branch', async () => {
            await withDbDriver('mysql', async () => {
                const user = await insertAndReturn(db, 'users', {
                    email: 'mysql-user@example.com',
                    user_id: 'mysql-user',
                    password: 'hashed',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 1,
                    is_active: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                });

                expect(user.email).toBe('mysql-user@example.com');
            });
        });

        it('should insert many rows using mysql branch', async () => {
            await withDbDriver('mysql', async () => {
                const users = await insertManyAndReturn(db, 'users', [
                    {
                        email: 'mysql-1@example.com',
                        user_id: 'mysql-1',
                        password: 'hashed',
                        roles: '["ROLE_USER"]',
                        is_lopd_accepted: 1,
                        is_active: 1,
                        created_at: Date.now(),
                        updated_at: Date.now(),
                    },
                    {
                        email: 'mysql-2@example.com',
                        user_id: 'mysql-2',
                        password: 'hashed',
                        roles: '["ROLE_USER"]',
                        is_lopd_accepted: 1,
                        is_active: 1,
                        created_at: Date.now(),
                        updated_at: Date.now(),
                    },
                ]);

                const emails = users.map(u => u.email).sort();
                expect(emails).toEqual(['mysql-1@example.com', 'mysql-2@example.com']);
            });
        });

        it('should update by ID using mysql branch', async () => {
            await withDbDriver('mysql', async () => {
                const user = await insertAndReturn(db, 'users', {
                    email: 'mysql-update@example.com',
                    user_id: 'mysql-update',
                    password: 'hashed',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 1,
                    is_active: 1,
                    created_at: Date.now(),
                    updated_at: Date.now(),
                });

                const updated = await updateByIdAndReturn(db, 'users', user.id, {
                    email: 'mysql-updated@example.com',
                    updated_at: Date.now(),
                });

                expect(updated?.email).toBe('mysql-updated@example.com');
            });
        });

        it('should return undefined when update affects no rows in mysql branch', async () => {
            await withDbDriver('mysql', async () => {
                const updated = await updateByIdAndReturn(db, 'users', 999999, {
                    email: 'missing@example.com',
                });
                expect(updated).toBeUndefined();
            });
        });

        it('should update by column using mysql branch', async () => {
            await withDbDriver('mysql', async () => {
                const userId = await seedTestUser(db);
                await seedTestProject(db, userId, { uuid: 'mysql-project', title: 'Original' });

                const updated = await updateByColumnAndReturn(db, 'projects', 'uuid', 'mysql-project', {
                    title: 'Updated',
                    updated_at: Date.now(),
                });

                expect(updated?.title).toBe('Updated');
            });
        });

        it('should delete by column using mysql branch', async () => {
            await withDbDriver('mysql', async () => {
                const userId = await seedTestUser(db);
                await seedTestProject(db, userId, { uuid: 'mysql-del-1', title: 'Delete 1' });
                await seedTestProject(db, userId, { uuid: 'mysql-del-2', title: 'Delete 2' });

                const deleted = await deleteByColumnAndReturn(db, 'projects', 'owner_id', userId);
                expect(deleted).toHaveLength(2);
            });
        });
    });
});
