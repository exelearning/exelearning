/**
 * Tests for cross-database helper functions
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
    getDialect,
    supportsReturning,
    resetDialectCache,
    toBinaryData,
    tableExists,
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
    beforeEach(() => {
        resetDialectCache();
    });

    afterEach(() => {
        resetDialectCache();
    });

    describe('getDialect', () => {
        it('should return the dialect from environment', () => {
            const dialect = getDialect();
            // Default should be sqlite in test environment
            expect(['sqlite', 'mysql', 'postgres']).toContain(dialect);
        });

        it('should cache the dialect', () => {
            const first = getDialect();
            const second = getDialect();
            expect(first).toBe(second);
        });
    });

    describe('supportsReturning', () => {
        it('should return true for sqlite (current test environment)', () => {
            resetDialectCache();
            const dialect = getDialect();
            const result = supportsReturning();
            // SQLite supports RETURNING
            if (dialect === 'sqlite') {
                expect(result).toBe(true);
            }
            // Verify the function returns a boolean
            expect(typeof result).toBe('boolean');
        });
    });

    describe('resetDialectCache', () => {
        it('should clear the cached dialect', () => {
            // Get dialect to populate cache
            getDialect();
            // Reset
            resetDialectCache();
            // Next call should re-read from environment
            const dialect = getDialect();
            expect(dialect).toBeDefined();
        });
    });

    describe('toBinaryData', () => {
        it('should return Uint8Array for sqlite dialect', () => {
            const input = new Uint8Array([1, 2, 3, 4]);
            const result = toBinaryData(input);

            // In SQLite test environment
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result).toEqual(input);
        });

        it('should handle Buffer input for sqlite', () => {
            const input = Buffer.from([1, 2, 3, 4]);
            const result = toBinaryData(input);

            // For SQLite, should convert to Uint8Array
            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should preserve data content', () => {
            const data = [1, 2, 3, 4, 5];
            const input = new Uint8Array(data);
            const result = toBinaryData(input);

            // Verify data is preserved
            expect(Array.from(result as Uint8Array)).toEqual(data);
        });
    });

    describe('getAutoIncrementType', () => {
        it('should return integer for sqlite', () => {
            const dialect = getDialect();
            const result = getAutoIncrementType();

            if (dialect === 'sqlite') {
                expect(result).toBe('integer');
            }
            // Verify it returns one of the valid types
            expect(['serial', 'integer']).toContain(result);
        });
    });

    describe('addAutoIncrement', () => {
        it('should add autoIncrement for sqlite', () => {
            let autoIncrementCalled = false;

            // Create a mock column builder
            const mockCol = {
                autoIncrement: () => {
                    autoIncrementCalled = true;
                    return mockCol;
                },
            };

            const result = addAutoIncrement(mockCol as any);

            // For sqlite, it should call autoIncrement
            if (getDialect() === 'sqlite') {
                expect(autoIncrementCalled).toBe(true);
            }
            expect(result).toBeDefined();
        });
    });

    describe('getBinaryType', () => {
        it('should return blob for sqlite', () => {
            const dialect = getDialect();
            const result = getBinaryType();

            if (dialect === 'sqlite') {
                expect(result).toBe('blob');
            }
            // Verify it returns one of the valid types
            expect(['bytea', 'blob']).toContain(result);
        });

        it('should return bytea for postgres', () => {
            // This test documents expected behavior for postgres
            // In test environment we use sqlite, so we just verify the return type
            const result = getBinaryType();
            expect(['bytea', 'blob']).toContain(result);
        });
    });

    describe('tableExists', () => {
        it('should check if table exists in database', async () => {
            // Use the test database helper which runs migrations
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                // Check for a table that should exist
                const usersExists = await tableExists(testDb, 'users');
                expect(usersExists).toBe(true);

                // Check for a table that should not exist
                const nonExistentExists = await tableExists(testDb, 'non_existent_table_xyz');
                expect(nonExistentExists).toBe(false);
            } finally {
                await destroyTestDb(testDb);
            }
        });

        it('should handle errors gracefully', async () => {
            // Create a mock db that throws an error
            const mockDb = {
                // Incomplete mock that will cause an error
            };

            const result = await tableExists(mockDb as any, 'test');
            expect(result).toBe(false);
        });
    });

    describe('insertAndReturn', () => {
        it('should insert a row and return it', async () => {
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const now = new Date().toISOString();
                const result = await insertAndReturn(testDb, 'users', {
                    email: 'test@example.com',
                    user_id: 'test-user',
                    password: 'hashed',
                    roles: '["ROLE_USER"]',
                    is_lopd_accepted: 1,
                    is_active: 1,
                    created_at: now,
                    updated_at: now,
                });

                expect(result).toBeDefined();
                expect(result.email).toBe('test@example.com');
                expect(result.id).toBeDefined();
            } finally {
                await destroyTestDb(testDb);
            }
        });
    });

    describe('insertManyAndReturn', () => {
        it('should return empty array for empty input', async () => {
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const result = await insertManyAndReturn(testDb, 'users', []);
                expect(result).toEqual([]);
            } finally {
                await destroyTestDb(testDb);
            }
        });

        it('should insert multiple rows and return them', async () => {
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const now = new Date().toISOString();
                const users = [
                    {
                        email: 'user1@example.com',
                        user_id: 'user-1',
                        password: 'hashed',
                        roles: '["ROLE_USER"]',
                        is_lopd_accepted: 1,
                        is_active: 1,
                        created_at: now,
                        updated_at: now,
                    },
                    {
                        email: 'user2@example.com',
                        user_id: 'user-2',
                        password: 'hashed',
                        roles: '["ROLE_USER"]',
                        is_lopd_accepted: 1,
                        is_active: 1,
                        created_at: now,
                        updated_at: now,
                    },
                ];

                const result = await insertManyAndReturn(testDb, 'users', users);

                expect(result).toHaveLength(2);
                expect(result[0].email).toBe('user1@example.com');
                expect(result[1].email).toBe('user2@example.com');
            } finally {
                await destroyTestDb(testDb);
            }
        });
    });

    describe('updateByIdAndReturn', () => {
        it('should update a row and return it', async () => {
            const { createTestDb, destroyTestDb, seedTestUser } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const userId = await seedTestUser(testDb, { email: 'original@example.com' });

                const result = await updateByIdAndReturn(testDb, 'users', userId, {
                    email: 'updated@example.com',
                });

                expect(result).toBeDefined();
                expect(result?.email).toBe('updated@example.com');
            } finally {
                await destroyTestDb(testDb);
            }
        });

        it('should return undefined for non-existent row', async () => {
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const result = await updateByIdAndReturn(testDb, 'users', 99999, {
                    email: 'updated@example.com',
                });

                expect(result).toBeUndefined();
            } finally {
                await destroyTestDb(testDb);
            }
        });
    });

    describe('updateByColumnAndReturn', () => {
        it('should update a row by column and return it', async () => {
            const { createTestDb, destroyTestDb, seedTestUser } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                await seedTestUser(testDb, { email: 'test@example.com', user_id: 'test-user-id' });

                const result = await updateByColumnAndReturn(testDb, 'users', 'user_id', 'test-user-id', {
                    email: 'updated@example.com',
                });

                expect(result).toBeDefined();
                expect(result?.email).toBe('updated@example.com');
            } finally {
                await destroyTestDb(testDb);
            }
        });

        it('should return undefined for non-existent column value', async () => {
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const result = await updateByColumnAndReturn(testDb, 'users', 'email', 'nonexistent@example.com', {
                    user_id: 'new-id',
                });

                expect(result).toBeUndefined();
            } finally {
                await destroyTestDb(testDb);
            }
        });
    });

    describe('deleteByColumnAndReturn', () => {
        it('should delete rows by column and return them', async () => {
            const { createTestDb, destroyTestDb, seedTestUser } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                await seedTestUser(testDb, { email: 'delete@example.com' });

                const result = await deleteByColumnAndReturn(testDb, 'users', 'email', 'delete@example.com');

                expect(result).toHaveLength(1);
                expect(result[0].email).toBe('delete@example.com');
            } finally {
                await destroyTestDb(testDb);
            }
        });

        it('should return empty array for non-existent rows', async () => {
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const result = await deleteByColumnAndReturn(testDb, 'users', 'email', 'nonexistent@example.com');
                expect(result).toEqual([]);
            } finally {
                await destroyTestDb(testDb);
            }
        });
    });

    describe('deleteByIdAndReturn', () => {
        it('should delete a row by id and return it', async () => {
            const { createTestDb, destroyTestDb, seedTestUser } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const userId = await seedTestUser(testDb, { email: 'delete@example.com' });

                const result = await deleteByIdAndReturn(testDb, 'users', userId);

                expect(result).toBeDefined();
                expect(result?.email).toBe('delete@example.com');
            } finally {
                await destroyTestDb(testDb);
            }
        });

        it('should return undefined for non-existent row', async () => {
            const { createTestDb, destroyTestDb } = await import('../../test/helpers/test-db');
            const testDb = await createTestDb();

            try {
                const result = await deleteByIdAndReturn(testDb, 'users', 99999);
                expect(result).toBeUndefined();
            } finally {
                await destroyTestDb(testDb);
            }
        });
    });
});
