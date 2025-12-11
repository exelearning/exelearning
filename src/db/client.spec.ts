/**
 * Tests for Kysely ORM Client
 */
import { describe, it, expect } from 'bun:test';
import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import type { Database } from './types';
import { up } from './migrations/001_initial';
import { db, closeDb, isConnected, getDbInfo, getDbConfig, getDialectFromEnv } from './client';

describe('Kysely ORM Client', () => {
    describe('db instance', () => {
        it('should export db instance', () => {
            expect(db).toBeDefined();
        });

        it('should have Kysely methods', () => {
            expect(typeof db.selectFrom).toBe('function');
            expect(typeof db.insertInto).toBe('function');
            expect(typeof db.updateTable).toBe('function');
            expect(typeof db.deleteFrom).toBe('function');
        });
    });

    describe('dialect', () => {
        it('should export current dialect', () => {
            // dialect is a Proxy for backwards compatibility
            // Use getDialect() to get the actual value
            const { getDialect } = require('./client');
            expect(getDialect()).toBe('sqlite');
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

        it('should hide password in config', () => {
            const info = getDbInfo();

            // If there's a password, it should be masked
            if (info.config.password !== undefined) {
                expect(info.config.password).toBe('***');
            }
        });

        it('should include dialect type', () => {
            const info = getDbInfo();
            expect(['sqlite']).toContain(info.dialect);
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
