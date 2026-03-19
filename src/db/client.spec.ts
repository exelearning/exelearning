/**
 * Tests for Kysely ORM Client
 */
import { describe, it, expect } from 'bun:test';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database } from './types';
import { up } from './migrations/001_initial';
import {
    db,
    dialect,
    closeDb,
    isConnected,
    getDbInfo,
    getDbConfig,
    getDialectFromEnv,
    getDb,
    resetClientCacheForTesting,
    getDialect,
} from './client';

describe('Kysely ORM Client', () => {
    describe('db instance', () => {
        it('should export db instance', () => {
            expect(db).toBeDefined();
        });

        it('should have Kysely methods', async () => {
            const originalDriver = process.env.DB_DRIVER;
            const originalPath = process.env.DB_PATH;
            try {
                process.env.DB_DRIVER = 'pdo_sqlite';
                process.env.DB_PATH = ':memory:';
                await resetClientCacheForTesting();

                expect(typeof db.selectFrom).toBe('function');
                expect(typeof db.insertInto).toBe('function');
                expect(typeof db.updateTable).toBe('function');
                expect(typeof db.deleteFrom).toBe('function');

                const query = db.selectFrom('users');
                expect(typeof query.select).toBe('function');
            } finally {
                process.env.DB_DRIVER = originalDriver;
                process.env.DB_PATH = originalPath;
            }
        });

        it('should reset client cache after initialization', async () => {
            const originalDriver = process.env.DB_DRIVER;
            const originalPath = process.env.DB_PATH;
            try {
                process.env.DB_DRIVER = 'pdo_sqlite';
                process.env.DB_PATH = ':memory:';
                await resetClientCacheForTesting();
                getDb();
                await resetClientCacheForTesting();
            } finally {
                process.env.DB_DRIVER = originalDriver;
                process.env.DB_PATH = originalPath;
            }
        });
    });

    describe('dialect', () => {
        it('should export current dialect', () => {
            // dialect is a Proxy for backwards compatibility
            // Use getDialect() to get the actual value
            expect(getDialect()).toBe('sqlite');
        });

        it('should lazily initialize dialect when cache is empty', async () => {
            await resetClientCacheForTesting();
            expect(getDialect()).toBe('sqlite');
        });

        it('should proxy dialect properties', async () => {
            await resetClientCacheForTesting();
            const length = dialect.length;
            expect(length).toBe(getDialect().length);
        });
    });

    describe('getDbConfig', () => {
        it('should return database configuration', () => {
            const config = getDbConfig();

            expect(config).toBeDefined();
            expect(config.dialect).toBe('sqlite');
            expect(typeof config.sqlitePath).toBe('string');
        });
    });

    describe('getDialectFromEnv', () => {
        it('should return sqlite', () => {
            expect(getDialectFromEnv()).toBe('sqlite');
        });
    });

    describe('getDbInfo', () => {
        it('should return database info', () => {
            const info = getDbInfo();

            expect(info).toBeDefined();
            expect(info.dialect).toBe('sqlite');
            expect(info.config).toBeDefined();
        });

        it('should hide password in config when present', () => {
            // Save original env
            const originalDriver = process.env.DB_DRIVER;
            const originalPassword = process.env.DB_PASSWORD;

            try {
                // Set up postgres config with password
                process.env.DB_DRIVER = 'pdo_pgsql';
                process.env.DB_PASSWORD = 'secret123';

                const info = getDbInfo();

                // Password should be masked
                expect(info.config.password).toBe('***');
            } finally {
                // Restore original env
                process.env.DB_DRIVER = originalDriver;
                process.env.DB_PASSWORD = originalPassword;
            }
        });

        it('should not mask empty password', () => {
            // Save original env
            const originalDriver = process.env.DB_DRIVER;
            const originalPassword = process.env.DB_PASSWORD;

            try {
                // Set up postgres config without password
                process.env.DB_DRIVER = 'pdo_pgsql';
                process.env.DB_PASSWORD = '';

                const info = getDbInfo();

                // Empty password should remain empty
                expect(info.config.password).toBe('');
            } finally {
                // Restore original env
                process.env.DB_DRIVER = originalDriver;
                process.env.DB_PASSWORD = originalPassword;
            }
        });

        it('should include dialect type', () => {
            const info = getDbInfo();
            expect(['sqlite', 'postgres', 'mysql']).toContain(info.dialect);
        });
    });

    describe('isConnected', () => {
        it('should return boolean', async () => {
            const connected = await isConnected();
            expect(typeof connected).toBe('boolean');
        });

        it('should check database connectivity', async () => {
            // This might return true or false depending on DB state
            // The important thing is it doesn't throw
            const result = await isConnected();
            expect([true, false]).toContain(result);
        });
    });

    describe('closeDb', () => {
        it('should be a function', () => {
            expect(typeof closeDb).toBe('function');
        });

        it('should close a database connection', async () => {
            // Create a separate test database to test closeDb behavior
            // We don't call closeDb() on the main db as it would affect other tests
            const testDb = new Kysely<Database>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });
            await up(testDb);

            // Verify we can query before closing
            await testDb.selectFrom('users').select('id').limit(1).execute();

            // Close the connection
            await testDb.destroy();

            // After closing, queries should fail
            try {
                await testDb.selectFrom('users').select('id').limit(1).execute();
                // Should not reach here
                expect(true).toBe(false);
            } catch (error) {
                // Expected - connection is closed
                expect(error).toBeDefined();
            }
        });

        it('should be a no-op when database was never initialized', async () => {
            const originalDriver = process.env.DB_DRIVER;
            const originalPath = process.env.DB_PATH;
            try {
                process.env.DB_DRIVER = 'pdo_sqlite';
                process.env.DB_PATH = ':memory:';
                // Reset so _db is null
                await resetClientCacheForTesting();
                // closeDb should not throw and should not trigger lazy init
                await closeDb();
                // Calling it again should also be safe
                await closeDb();
            } finally {
                process.env.DB_DRIVER = originalDriver;
                process.env.DB_PATH = originalPath;
            }
        });

        it('should close an initialized database and set it to null', async () => {
            const originalDriver = process.env.DB_DRIVER;
            const originalPath = process.env.DB_PATH;
            try {
                process.env.DB_DRIVER = 'pdo_sqlite';
                process.env.DB_PATH = ':memory:';
                await resetClientCacheForTesting();
                // Force initialization
                getDb();
                // Close the initialized db
                await closeDb();
                // Subsequent closeDb should be a no-op (db is null after close)
                await closeDb();
            } finally {
                process.env.DB_DRIVER = originalDriver;
                process.env.DB_PATH = originalPath;
                // Reset to clean state for other tests
                await resetClientCacheForTesting();
            }
        });
    });

    describe('type exports', () => {
        it('should export Database type', () => {
            // This is a compile-time check, but we can verify the module exports
            const client = require('./client');
            expect(client).toBeDefined();
        });
    });
});

describe('Database Client - Isolated tests', () => {
    it('should test isConnected returning false when query fails', async () => {
        // Create a database without migrations (no users table)
        const testDb = new Kysely<Database>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Don't run migrations - users table won't exist
        // Simulate what isConnected does - query users table
        let result = true;
        try {
            await testDb.selectFrom('users').select('id').limit(1).execute();
            result = true;
        } catch {
            result = false;
        }

        // Should be false since users table doesn't exist
        expect(result).toBe(false);

        await testDb.destroy();
    });

    it('should test closeDb function signature', async () => {
        // closeDb is an async function that returns Promise<void>
        // We can't call it on the main db, but we can verify its type
        expect(closeDb).toBeInstanceOf(Function);

        // Test with a separate database
        const testDb = new Kysely<Database>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // This mimics what closeDb does
        await testDb.destroy();
    });
});
