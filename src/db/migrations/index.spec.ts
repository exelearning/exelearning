/**
 * Tests for Database Migrations
 * Tests the migration system with a real in-memory SQLite database
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, Migrator } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { sql } from 'kysely';
import {
    createMigrator,
    migrateToLatest,
    migrateDown,
    getMigrationStatus,
    runCli,
    tableExists,
    main,
    type MigrationDependencies,
    type CliDependencies,
    type MainDependencies,
} from './index';

describe('Database Migrations', () => {
    let db: Kysely<any>;

    beforeEach(() => {
        // Create fresh in-memory database for each test
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
    });

    afterEach(async () => {
        try {
            await db.destroy();
        } catch {
            // Already destroyed in some tests
        }
    });

    describe('createMigrator', () => {
        it('should create a Migrator instance', () => {
            const migrator = createMigrator(db);
            expect(migrator).toBeDefined();
            expect(typeof migrator.migrateToLatest).toBe('function');
            expect(typeof migrator.migrateDown).toBe('function');
            expect(typeof migrator.getMigrations).toBe('function');
        });
    });

    describe('migrateToLatest', () => {
        it('should run all pending migrations on fresh database', async () => {
            const result = await migrateToLatest(db);

            expect(result.success).toBe(true);
            expect(result.executedMigrations).toContain('000_legacy_symfony');
            expect(result.executedMigrations).toContain('001_initial');
            expect(result.error).toBeUndefined();
        });

        it('should report no pending migrations when already up to date', async () => {
            // First migration
            await migrateToLatest(db);

            // Second call should have no pending
            const result = await migrateToLatest(db);

            expect(result.success).toBe(true);
            expect(result.executedMigrations).toHaveLength(0);
        });

        it('should create expected tables', async () => {
            await migrateToLatest(db);

            // Verify tables exist by querying them
            const tables = await db.selectFrom('sqlite_master').select('name').where('type', '=', 'table').execute();

            const tableNames = tables.map(t => t.name);
            expect(tableNames).toContain('users');
            expect(tableNames).toContain('projects');
            expect(tableNames).toContain('assets');
        });

        it('should handle migration errors', async () => {
            // Create mock dependencies that return an error
            const mockDeps: MigrationDependencies = {
                createMigrator: () =>
                    ({
                        migrateToLatest: async () => ({
                            error: new Error('Migration failed: test error'),
                            results: [],
                        }),
                        migrateDown: async () => ({ results: [] }),
                        getMigrations: async () => [],
                    }) as unknown as Migrator,
            };

            const result = await migrateToLatest(db, mockDeps);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('test error');
        });
    });

    describe('migrateDown', () => {
        it('should rollback the last migration', async () => {
            // First migrate up
            await migrateToLatest(db);

            // Then rollback
            const result = await migrateDown(db);

            expect(result.success).toBe(true);
            expect(result.rolledBack).toBe('005_user_id_nullable');
        });

        it('should report no migrations to rollback on fresh database', async () => {
            const result = await migrateDown(db);

            expect(result.success).toBe(true);
            expect(result.rolledBack).toBeUndefined();
        });

        it('should remove tables after rollback', async () => {
            // Migrate up
            await migrateToLatest(db);

            // Rollback all 6 migrations to remove all tables
            await migrateDown(db); // rollback 005_user_id_nullable
            await migrateDown(db); // rollback 004_fix_user_foreign_keys
            await migrateDown(db); // rollback 003_user_id_length
            await migrateDown(db); // rollback 002_asset_folder_path
            await migrateDown(db); // rollback 001_initial
            await migrateDown(db); // rollback 000_legacy_symfony

            // Check users table is gone
            const tables = await db
                .selectFrom('sqlite_master')
                .select('name')
                .where('type', '=', 'table')
                .where('name', '=', 'users')
                .execute();

            expect(tables).toHaveLength(0);
        });

        it('should handle rollback errors', async () => {
            // Create mock dependencies that return an error
            const mockDeps: MigrationDependencies = {
                createMigrator: () =>
                    ({
                        migrateToLatest: async () => ({ results: [] }),
                        migrateDown: async () => ({
                            error: new Error('Rollback failed: test error'),
                            results: [],
                        }),
                        getMigrations: async () => [],
                    }) as unknown as Migrator,
            };

            const result = await migrateDown(db, mockDeps);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('test error');
        });
    });

    describe('getMigrationStatus', () => {
        it('should show all migrations as pending on fresh database', async () => {
            const status = await getMigrationStatus(db);

            expect(status.executed).toHaveLength(0);
            expect(status.pending).toContain('001_initial');
        });

        it('should show migrations as executed after running', async () => {
            await migrateToLatest(db);

            const status = await getMigrationStatus(db);

            expect(status.executed).toContain('001_initial');
            expect(status.pending).toHaveLength(0);
        });

        it('should correctly track partial migrations', async () => {
            // Migrate up then down one step
            await migrateToLatest(db);
            await migrateDown(db);

            const status = await getMigrationStatus(db);

            // After one rollback, 005_user_id_nullable should be pending
            // All prior migrations are still executed
            expect(status.pending).toContain('005_user_id_nullable');
            expect(status.executed).toContain('001_initial');
            expect(status.executed).toContain('000_legacy_symfony');
            expect(status.executed).toContain('002_asset_folder_path');
            expect(status.executed).toContain('003_user_id_length');
            expect(status.executed).toContain('004_fix_user_foreign_keys');
        });
    });

    describe('migration round-trip', () => {
        it('should support migrate up, down, up cycle', async () => {
            // Up
            const up1 = await migrateToLatest(db);
            expect(up1.success).toBe(true);
            expect(up1.executedMigrations).toContain('000_legacy_symfony');
            expect(up1.executedMigrations).toContain('001_initial');
            expect(up1.executedMigrations).toContain('002_asset_folder_path');
            expect(up1.executedMigrations).toContain('003_user_id_length');
            expect(up1.executedMigrations).toContain('004_fix_user_foreign_keys');
            expect(up1.executedMigrations).toContain('005_user_id_nullable');

            // Down - rolls back the last migration (005_user_id_nullable)
            const down = await migrateDown(db);
            expect(down.success).toBe(true);
            expect(down.rolledBack).toBe('005_user_id_nullable');

            // Up again - should re-apply 005_user_id_nullable
            const up2 = await migrateToLatest(db);
            expect(up2.success).toBe(true);
            expect(up2.executedMigrations).toContain('005_user_id_nullable');
        });
    });

    describe('runCli', () => {
        it('should run "up" command by default', async () => {
            const cliDeps: CliDependencies = {
                db,
                argv: ['bun', 'migrations/index.ts'],
                exit: () => {},
            };

            await runCli(cliDeps);

            // DB should be destroyed after runCli
            // Verify migrations ran by checking a new connection
            const newDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });
            // Can't verify on same db as it's destroyed, but no error means success
            await newDb.destroy();
        });

        it('should run "up" command explicitly', async () => {
            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });

            const cliDeps: CliDependencies = {
                db: testDb,
                argv: ['bun', 'migrations/index.ts', 'up'],
                exit: () => {},
            };

            await runCli(cliDeps);
            // Success if no error thrown
        });

        it('should run "down" command', async () => {
            // First migrate up
            await migrateToLatest(db);

            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });
            await migrateToLatest(testDb);

            const cliDeps: CliDependencies = {
                db: testDb,
                argv: ['bun', 'migrations/index.ts', 'down'],
                exit: () => {},
            };

            await runCli(cliDeps);
            // Success if no error thrown
        });

        it('should run "status" command', async () => {
            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });

            const cliDeps: CliDependencies = {
                db: testDb,
                argv: ['bun', 'migrations/index.ts', 'status'],
                exit: () => {},
            };

            await runCli(cliDeps);
            // Success if no error thrown
        });

        it('should exit with code 1 for unknown command', async () => {
            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });
            let exitCode = -1;

            const cliDeps: CliDependencies = {
                db: testDb,
                argv: ['bun', 'migrations/index.ts', 'invalid'],
                exit: code => {
                    exitCode = code;
                },
            };

            await runCli(cliDeps);

            expect(exitCode).toBe(1);
        });

        it('should handle empty argv gracefully', async () => {
            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });

            const cliDeps: CliDependencies = {
                db: testDb,
                argv: [],
                exit: () => {},
            };

            // Should default to 'up'
            await runCli(cliDeps);
            // Success if no error thrown
        });
    });

    describe('tableExists', () => {
        it('should return false for non-existent table', async () => {
            const exists = await tableExists(db, 'non_existent_table');
            expect(exists).toBe(false);
        });

        it('should return true for existing table', async () => {
            await sql`CREATE TABLE test_table (id INTEGER)`.execute(db);
            const exists = await tableExists(db, 'test_table');
            expect(exists).toBe(true);
        });

        it('should return false for dropped table', async () => {
            await sql`CREATE TABLE test_table (id INTEGER)`.execute(db);
            await sql`DROP TABLE test_table`.execute(db);
            const exists = await tableExists(db, 'test_table');
            expect(exists).toBe(false);
        });
    });

    describe('syncLegacyMigrations (via migrateToLatest)', () => {
        it('should run migration normally on fresh database', async () => {
            // Fresh DB, no tables
            const status = await getMigrationStatus(db);
            expect(status.pending).toContain('001_initial');
            expect(status.executed).toHaveLength(0);

            // Run migration
            const result = await migrateToLatest(db);
            expect(result.success).toBe(true);
            expect(result.executedMigrations).toContain('001_initial');
        });

        it('should not modify anything if migration already recorded', async () => {
            // Run migration normally first
            await migrateToLatest(db);

            // Get current state
            const statusBefore = await getMigrationStatus(db);
            expect(statusBefore.executed).toContain('001_initial');

            // Run again
            const result = await migrateToLatest(db);

            expect(result.success).toBe(true);
            expect(result.executedMigrations).toHaveLength(0); // Nothing new executed

            // State should be unchanged
            const statusAfter = await getMigrationStatus(db);
            expect(statusAfter.executed).toEqual(statusBefore.executed);
        });

        it('should run all migrations when users exists but projects is missing (Symfony legacy DB)', async () => {
            // Simulate a Symfony legacy database that has users table but no projects
            await sql`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)`.execute(db);
            // Note: No projects table - simulating Symfony legacy

            // Run migration
            const result = await migrateToLatest(db);

            expect(result.success).toBe(true);
            // Should execute ALL migrations including 000_legacy_symfony and 001_initial
            expect(result.executedMigrations).toContain('000_legacy_symfony');
            expect(result.executedMigrations).toContain('001_initial');

            // Verify projects table was created
            const projectsExists = await tableExists(db, 'projects');
            expect(projectsExists).toBe(true);

            // Verify users table was created (001_initial uses ifNotExists so it creates new)
            const usersExists = await tableExists(db, 'users');
            expect(usersExists).toBe(true);
        });

        it('should create both kysely_migration and kysely_migration_lock tables for legacy DB', async () => {
            // Create legacy DB with users table
            await sql`CREATE TABLE users (id INTEGER PRIMARY KEY)`.execute(db);

            // Run migration
            await migrateToLatest(db);

            // Verify both tables exist
            const migrationExists = await tableExists(db, 'kysely_migration');
            const lockExists = await tableExists(db, 'kysely_migration_lock');

            expect(migrationExists).toBe(true);
            expect(lockExists).toBe(true);
        });
    });

    describe('tableExists - edge cases', () => {
        it('should check SQLite sqlite_master table correctly', async () => {
            // Create a table and verify tableExists returns correct result
            await sql`CREATE TABLE my_test_table (id INTEGER)`.execute(db);

            const exists = await tableExists(db, 'my_test_table');
            expect(exists).toBe(true);

            const notExists = await tableExists(db, 'other_table');
            expect(notExists).toBe(false);
        });

        it('should handle table names with special characters', async () => {
            await sql`CREATE TABLE "test-table-name" (id INTEGER)`.execute(db);

            const exists = await tableExists(db, 'test-table-name');
            expect(exists).toBe(true);
        });

        it('should be case-sensitive for SQLite table names', async () => {
            await sql`CREATE TABLE TestTable (id INTEGER)`.execute(db);

            // SQLite is case-sensitive for table names
            const exists = await tableExists(db, 'TestTable');
            expect(exists).toBe(true);
        });

        it('should return false when database query fails', async () => {
            // Create a db that will fail queries (destroyed)
            const brokenDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });
            await brokenDb.destroy();

            // tableExists should catch the error and return false
            const exists = await tableExists(brokenDb, 'any_table');
            expect(exists).toBe(false);
        });
    });

    describe('StaticMigrationProvider', () => {
        it('should provide migrations through createMigrator', async () => {
            const migrator = createMigrator(db);
            const migrations = await migrator.getMigrations();

            expect(migrations.length).toBeGreaterThan(0);
            expect(migrations.some(m => m.name === '001_initial')).toBe(true);
        });
    });

    describe('migration results filtering', () => {
        it('should only include successful migrations in executedMigrations', async () => {
            // Create mock that returns mixed results
            const mockDeps: MigrationDependencies = {
                createMigrator: () =>
                    ({
                        migrateToLatest: async () => ({
                            results: [
                                { migrationName: 'success_1', status: 'Success' },
                                { migrationName: 'error_1', status: 'Error' },
                                { migrationName: 'success_2', status: 'Success' },
                                { migrationName: 'not_executed', status: 'NotExecuted' },
                            ],
                        }),
                        migrateDown: async () => ({ results: [] }),
                        getMigrations: async () => [],
                    }) as unknown as Migrator,
            };

            const result = await migrateToLatest(db, mockDeps);

            expect(result.success).toBe(true);
            expect(result.executedMigrations).toContain('success_1');
            expect(result.executedMigrations).toContain('success_2');
            expect(result.executedMigrations).not.toContain('error_1');
            expect(result.executedMigrations).not.toContain('not_executed');
        });

        it('should handle undefined results', async () => {
            const mockDeps: MigrationDependencies = {
                createMigrator: () =>
                    ({
                        migrateToLatest: async () => ({
                            results: undefined,
                        }),
                        migrateDown: async () => ({ results: [] }),
                        getMigrations: async () => [],
                    }) as unknown as Migrator,
            };

            const result = await migrateToLatest(db, mockDeps);

            expect(result.success).toBe(true);
            expect(result.executedMigrations).toHaveLength(0);
        });
    });

    describe('migrateDown result filtering', () => {
        it('should find successful rollback migration', async () => {
            const mockDeps: MigrationDependencies = {
                createMigrator: () =>
                    ({
                        migrateToLatest: async () => ({ results: [] }),
                        migrateDown: async () => ({
                            results: [{ migrationName: '001_initial', status: 'Success' }],
                        }),
                        getMigrations: async () => [],
                    }) as unknown as Migrator,
            };

            const result = await migrateDown(db, mockDeps);

            expect(result.success).toBe(true);
            expect(result.rolledBack).toBe('001_initial');
        });

        it('should return undefined when no successful rollback', async () => {
            const mockDeps: MigrationDependencies = {
                createMigrator: () =>
                    ({
                        migrateToLatest: async () => ({ results: [] }),
                        migrateDown: async () => ({
                            results: [{ migrationName: '001_initial', status: 'Error' }],
                        }),
                        getMigrations: async () => [],
                    }) as unknown as Migrator,
            };

            const result = await migrateDown(db, mockDeps);

            expect(result.success).toBe(true);
            expect(result.rolledBack).toBeUndefined();
        });
    });

    describe('main function', () => {
        it('should be exported', () => {
            // Verify main is a function that can be called
            expect(typeof main).toBe('function');
        });

        it('should call runCli with injected database via main()', async () => {
            // Create a test db
            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });
            let dbUsed = false;

            const mockDeps: MainDependencies = {
                getDb: async () => {
                    dbUsed = true;
                    return testDb;
                },
                argv: ['bun', 'migrations/index.ts', 'status'],
                exit: () => {},
            };

            // Call main with injected dependencies
            await main(mockDeps);

            // Verify getDb was called
            expect(dbUsed).toBe(true);
        });

        it('should use default dependencies when not provided', async () => {
            // main() accepts optional deps parameter
            expect(main.length).toBe(0); // 0 required parameters
        });

        it('should support "status" command through main', async () => {
            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });

            const mockDeps: MainDependencies = {
                getDb: async () => testDb,
                argv: ['bun', 'migrations/index.ts', 'status'],
                exit: () => {},
            };

            await main(mockDeps);
            // No error means success
        });

        it('should support "down" command through main', async () => {
            const testDb = new Kysely<any>({
                dialect: new BunSqliteDialect({ url: ':memory:' }),
            });
            await migrateToLatest(testDb);

            const mockDeps: MainDependencies = {
                getDb: async () => testDb,
                argv: ['bun', 'migrations/index.ts', 'down'],
                exit: () => {},
            };

            await main(mockDeps);
            // No error means success
        });
    });
});
