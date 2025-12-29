/**
 * Tests for Legacy Symfony Migration (000_legacy_symfony)
 * Tests detection and cleanup of Symfony legacy database schema
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up, down } from './000_legacy_symfony';

describe('000_legacy_symfony Migration', () => {
    let db: Kysely<unknown>;

    beforeEach(() => {
        db = new Kysely({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });
    });

    afterEach(async () => {
        try {
            await db.destroy();
        } catch {
            // Already destroyed
        }
    });

    describe('Fresh installation (no Symfony legacy)', () => {
        beforeEach(async () => {
            // Create new schema (from 001_initial) - no Symfony indicators
            await sql`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, is_active INTEGER DEFAULT 1)`.execute(db);
            await sql`CREATE TABLE users_preferences (id INTEGER PRIMARY KEY, preference_key TEXT, value TEXT, is_active INTEGER DEFAULT 1)`.execute(
                db,
            );
        });

        it('should be a no-op for fresh installations', async () => {
            await up(db);

            // Verify users table still exists (not renamed)
            const usersTable = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`.execute(
                db,
            );
            expect(usersTable.rows).toHaveLength(1);

            // Verify users_preferences table still exists (not renamed)
            const prefsTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_preferences'`.execute(db);
            expect(prefsTable.rows).toHaveLength(1);

            // Verify no _legacy tables were created
            const legacyTables =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_legacy'`.execute(db);
            expect(legacyTables.rows).toHaveLength(0);
        });

        it('should not affect existing data', async () => {
            // Insert test data
            await sql`INSERT INTO users (email) VALUES ('test@example.com')`.execute(db);
            await sql`INSERT INTO users_preferences (preference_key, value) VALUES ('theme', 'dark')`.execute(db);

            await up(db);

            // Verify data is still there
            const users = await sql`SELECT * FROM users`.execute(db);
            expect(users.rows).toHaveLength(1);
            expect((users.rows[0] as { email: string }).email).toBe('test@example.com');

            const prefs = await sql`SELECT * FROM users_preferences`.execute(db);
            expect(prefs.rows).toHaveLength(1);
            expect((prefs.rows[0] as { preference_key: string }).preference_key).toBe('theme');
        });
    });

    describe('Symfony legacy database (has ode_files)', () => {
        beforeEach(async () => {
            // Create Symfony legacy schema with ode_files table
            await sql`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, is_active INTEGER DEFAULT 1)`.execute(db);
            await sql`CREATE TABLE users_preferences (id INTEGER PRIMARY KEY, user_preferences_key TEXT, user_preferences_value TEXT, is_active INTEGER DEFAULT 1)`.execute(
                db,
            );
            await sql`CREATE TABLE ode_files (id INTEGER PRIMARY KEY, ode_id TEXT)`.execute(db);
            await sql`CREATE TABLE ode_operations_log (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_properties_sync (id INTEGER PRIMARY KEY)`.execute(db);
        });

        it('should detect Symfony legacy database via ode_files table', async () => {
            await up(db);

            // ode_files should be dropped
            const tables = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='ode_files'`.execute(
                db,
            );
            expect(tables.rows).toHaveLength(0);
        });

        it('should rename users table to users_legacy', async () => {
            // Insert test data
            await sql`INSERT INTO users (email) VALUES ('old@symfony.com')`.execute(db);

            await up(db);

            // users should not exist
            const usersTable = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`.execute(
                db,
            );
            expect(usersTable.rows).toHaveLength(0);

            // users_legacy should exist with the old data
            const legacyTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_legacy'`.execute(db);
            expect(legacyTable.rows).toHaveLength(1);

            const legacyData = await sql`SELECT * FROM users_legacy`.execute(db);
            expect(legacyData.rows).toHaveLength(1);
            expect((legacyData.rows[0] as { email: string }).email).toBe('old@symfony.com');
        });

        it('should rename users_preferences table to users_preferences_legacy', async () => {
            // Insert test data
            await sql`INSERT INTO users_preferences (user_preferences_key, user_preferences_value) VALUES ('theme', 'dark')`.execute(
                db,
            );

            await up(db);

            // users_preferences should not exist
            const prefsTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_preferences'`.execute(db);
            expect(prefsTable.rows).toHaveLength(0);

            // users_preferences_legacy should exist with the old data
            const legacyTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_preferences_legacy'`.execute(
                    db,
                );
            expect(legacyTable.rows).toHaveLength(1);

            const legacyData = await sql`SELECT * FROM users_preferences_legacy`.execute(db);
            expect(legacyData.rows).toHaveLength(1);
            expect((legacyData.rows[0] as { user_preferences_key: string }).user_preferences_key).toBe('theme');
        });

        it('should drop all obsolete ode_* tables', async () => {
            await up(db);

            // All ode_* tables should be dropped
            const odeTables =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ode_%'`.execute(db);
            expect(odeTables.rows).toHaveLength(0);
        });
    });

    describe('Symfony legacy database (has user_preferences_key but no ode_files)', () => {
        beforeEach(async () => {
            // Create partial Symfony legacy schema (user_preferences with old column names, no ode_files)
            await sql`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, is_active INTEGER DEFAULT 1)`.execute(db);
            await sql`CREATE TABLE users_preferences (id INTEGER PRIMARY KEY, user_preferences_key TEXT, user_preferences_value TEXT, is_active INTEGER DEFAULT 1)`.execute(
                db,
            );
        });

        it('should detect Symfony legacy via user_preferences_key column', async () => {
            await up(db);

            // Tables should be renamed to _legacy
            const usersTable = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`.execute(
                db,
            );
            expect(usersTable.rows).toHaveLength(0);

            const legacyUsersTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_legacy'`.execute(db);
            expect(legacyUsersTable.rows).toHaveLength(1);

            const prefsTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_preferences'`.execute(db);
            expect(prefsTable.rows).toHaveLength(0);

            const legacyPrefsTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_preferences_legacy'`.execute(
                    db,
                );
            expect(legacyPrefsTable.rows).toHaveLength(1);
        });
    });

    describe('down() migration', () => {
        it('should be a no-op (one-way migration)', async () => {
            // Create some tables first
            await sql`CREATE TABLE users (id INTEGER PRIMARY KEY)`.execute(db);

            // down() should do nothing
            await down(db);

            // Tables should still exist
            const tables = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`.execute(db);
            expect(tables.rows).toHaveLength(1);
        });
    });

    describe('Edge cases', () => {
        it('should handle missing users_preferences table gracefully', async () => {
            // Only create users table and ode_files, no users_preferences
            await sql`CREATE TABLE users (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_files (id INTEGER PRIMARY KEY)`.execute(db);

            // Should not throw
            await up(db);

            // ode_files should be dropped
            const odeFilesTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='ode_files'`.execute(db);
            expect(odeFilesTable.rows).toHaveLength(0);

            // users should be renamed to users_legacy
            const usersTable = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`.execute(
                db,
            );
            expect(usersTable.rows).toHaveLength(0);

            const legacyUsersTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_legacy'`.execute(db);
            expect(legacyUsersTable.rows).toHaveLength(1);
        });

        it('should handle missing users table gracefully', async () => {
            // Only create ode_files, no users
            await sql`CREATE TABLE ode_files (id INTEGER PRIMARY KEY)`.execute(db);

            // Should not throw
            await up(db);

            // ode_files should be dropped
            const tables = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='ode_files'`.execute(
                db,
            );
            expect(tables.rows).toHaveLength(0);
        });

        it('should handle all ode_* tables', async () => {
            // Create all ode_* tables
            await sql`CREATE TABLE ode_files (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_operations_log (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_properties_sync (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_nav_structure_sync (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_nav_structure_sync_properties (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_pag_structure_sync (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_pag_structure_sync_properties (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_components_sync (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_components_sync_properties (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE current_ode_users (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE current_ode_users_sync_changes (id INTEGER PRIMARY KEY)`.execute(db);

            await up(db);

            // All should be dropped
            const allTables = await sql`SELECT name FROM sqlite_master WHERE type='table'`.execute(db);
            const tableNames = (allTables.rows as { name: string }[]).map(r => r.name);
            expect(tableNames).not.toContain('ode_files');
            expect(tableNames).not.toContain('ode_operations_log');
            expect(tableNames).not.toContain('ode_properties_sync');
            expect(tableNames).not.toContain('ode_nav_structure_sync');
            expect(tableNames).not.toContain('ode_nav_structure_sync_properties');
            expect(tableNames).not.toContain('ode_pag_structure_sync');
            expect(tableNames).not.toContain('ode_pag_structure_sync_properties');
            expect(tableNames).not.toContain('ode_components_sync');
            expect(tableNames).not.toContain('ode_components_sync_properties');
            expect(tableNames).not.toContain('current_ode_users');
            expect(tableNames).not.toContain('current_ode_users_sync_changes');
        });

        it('should handle already renamed tables gracefully', async () => {
            // Simulate already renamed tables (edge case)
            await sql`CREATE TABLE users_legacy (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE users_preferences_legacy (id INTEGER PRIMARY KEY)`.execute(db);
            await sql`CREATE TABLE ode_files (id INTEGER PRIMARY KEY)`.execute(db);

            // Should not throw (tables already renamed)
            await up(db);

            // ode_files should be dropped
            const odeFilesTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='ode_files'`.execute(db);
            expect(odeFilesTable.rows).toHaveLength(0);

            // Legacy tables should still exist
            const legacyUsersTable =
                await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users_legacy'`.execute(db);
            expect(legacyUsersTable.rows).toHaveLength(1);
        });
    });
});
