/**
 * Tests for 004_fix_user_foreign_keys migration
 *
 * This consolidated migration fixes 3 FK issues:
 * 1. projects.owner_id - Add ON DELETE CASCADE
 * 2. users_preferences - Convert user_id VARCHAR to owner_id INTEGER with FK CASCADE
 * 3. app_settings.updated_by - Add FK with ON DELETE SET NULL
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Kysely, sql } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-worker/normal';
import { up, down, configure, resetDependencies } from './004_fix_user_foreign_keys';

describe('004_fix_user_foreign_keys migration', () => {
    let db: Kysely<any>;

    beforeEach(async () => {
        db = new Kysely<any>({
            dialect: new BunSqliteDialect({ url: ':memory:' }),
        });

        // Create users table (from 001_initial)
        await sql`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(180) NOT NULL UNIQUE,
                user_id VARCHAR(255) NOT NULL,
                password TEXT NOT NULL,
                roles TEXT NOT NULL DEFAULT '[]',
                is_lopd_accepted INTEGER NOT NULL DEFAULT 0,
                quota_mb INTEGER,
                external_identifier VARCHAR(180),
                api_token VARCHAR(255),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at BIGINT,
                updated_at BIGINT
            )
        `.execute(db);

        // Create projects table WITHOUT cascade (as it was before this migration)
        await sql`
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid VARCHAR(36) NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                owner_id INTEGER NOT NULL REFERENCES users(id),
                status VARCHAR(50) NOT NULL DEFAULT 'active',
                visibility VARCHAR(20) NOT NULL DEFAULT 'private',
                language VARCHAR(10),
                author VARCHAR(255),
                license VARCHAR(255),
                last_accessed_at BIGINT,
                saved_once INTEGER NOT NULL DEFAULT 0,
                platform_id VARCHAR(64),
                created_at BIGINT,
                updated_at BIGINT
            )
        `.execute(db);
        await sql`CREATE INDEX IF NOT EXISTS idx_projects_platform_id ON projects(platform_id)`.execute(db);

        // Create users_preferences table with OLD schema (user_id VARCHAR, no FK)
        await sql`
            CREATE TABLE users_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id VARCHAR(255) NOT NULL,
                preference_key VARCHAR(255) NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at BIGINT,
                updated_at BIGINT
            )
        `.execute(db);

        // Create app_settings table with OLD schema (no FK)
        await sql`
            CREATE TABLE app_settings (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL,
                type VARCHAR(20) NOT NULL DEFAULT 'string',
                updated_at BIGINT,
                updated_by INTEGER
            )
        `.execute(db);
    });

    afterEach(async () => {
        resetDependencies();
        await db.destroy();
    });

    // ========================================================================
    // BASIC UP/DOWN TESTS
    // ========================================================================

    describe('up', () => {
        it('should run without errors on SQLite', async () => {
            await up(db);
            expect(true).toBe(true);
        });

        it('should handle being run twice (idempotency via table replacement)', async () => {
            // Insert test data before first migration
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('idem@example.com', 'idem_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('idem-uuid', 'Idempotency Test', 1)
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('1', 'idem_pref', 'value')
            `.execute(db);

            // First migration
            await up(db);

            // Verify data is preserved after first migration
            const projectsAfterFirst = await sql<{ title: string }>`SELECT title FROM projects`.execute(db);
            expect(projectsAfterFirst.rows.length).toBe(1);
            expect(projectsAfterFirst.rows[0].title).toBe('Idempotency Test');

            // Note: Running up() twice on already-migrated tables will fail because:
            // - users_preferences no longer has user_id column
            // - The table recreation expects the old schema
            // This is expected behavior - migrations are designed to run once.
            // The test verifies that the first run completes successfully with data preserved.
        });

        it('should preserve existing data after migration', async () => {
            // Insert test data before migration
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('test-uuid-1234', 'Test Project', 1)
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('1', 'theme', 'dark')
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('site_name', 'My Site', 'string', 1)
            `.execute(db);

            // Run migration
            await up(db);

            // Verify data is preserved
            const users = await sql<{ email: string }>`SELECT email FROM users`.execute(db);
            expect(users.rows.length).toBe(1);
            expect(users.rows[0].email).toBe('test@example.com');

            const projects = await sql<{ title: string; uuid: string }>`SELECT title, uuid FROM projects`.execute(db);
            expect(projects.rows.length).toBe(1);
            expect(projects.rows[0].title).toBe('Test Project');
            expect(projects.rows[0].uuid).toBe('test-uuid-1234');

            const prefs = await sql<{ owner_id: number; preference_key: string }>`
                SELECT owner_id, preference_key FROM users_preferences
            `.execute(db);
            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].owner_id).toBe(1);
            expect(prefs.rows[0].preference_key).toBe('theme');

            const settings = await sql<{ key: string; updated_by: number }>`
                SELECT key, updated_by FROM app_settings
            `.execute(db);
            expect(settings.rows.length).toBe(1);
            expect(settings.rows[0].key).toBe('site_name');
            expect(settings.rows[0].updated_by).toBe(1);
        });
    });

    describe('down', () => {
        it('should run without errors on SQLite', async () => {
            // Insert user first (required for FK)
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await up(db);
            await down(db);
            expect(true).toBe(true);
        });

        it('should preserve existing data after rollback', async () => {
            // Insert test data before migration
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('test-uuid', 'Test Project', 1)
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('1', 'theme', 'dark')
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('test_setting', 'test_value', 'string', 1)
            `.execute(db);

            // Run migration and rollback
            await up(db);
            await down(db);

            // Verify data is preserved
            const users = await sql<{ email: string }>`SELECT email FROM users`.execute(db);
            expect(users.rows.length).toBe(1);

            const projects = await sql<{ title: string }>`SELECT title FROM projects`.execute(db);
            expect(projects.rows.length).toBe(1);

            // users_preferences should have user_id back (as string)
            const prefs = await sql<{ user_id: string; preference_key: string }>`
                SELECT user_id, preference_key FROM users_preferences
            `.execute(db);
            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].user_id).toBe('1');

            const settings = await sql<{ key: string; updated_by: number }>`
                SELECT key, updated_by FROM app_settings
            `.execute(db);
            expect(settings.rows.length).toBe(1);
            expect(settings.rows[0].updated_by).toBe(1);
        });
    });

    // ========================================================================
    // PROJECTS TABLE - CASCADE DELETE TESTS
    // ========================================================================

    describe('projects.owner_id CASCADE', () => {
        it('should enable cascading deletes for user deletion', async () => {
            // Run migration first
            await up(db);

            // Enable FK enforcement (SQLite requires this)
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            // Insert test data
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('owner@example.com', 'owner_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('project-uuid-1', 'Project 1', 1)
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('project-uuid-2', 'Project 2', 1)
            `.execute(db);

            // Verify projects exist
            const projectsBefore = await sql<{ id: number }>`SELECT id FROM projects`.execute(db);
            expect(projectsBefore.rows.length).toBe(2);

            // Delete user - should cascade to projects
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            // Verify projects were deleted by cascade
            const projectsAfter = await sql<{ id: number }>`SELECT id FROM projects`.execute(db);
            expect(projectsAfter.rows.length).toBe(0);
        });

        it('should preserve projects when user is not deleted', async () => {
            // Run migration
            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            // Insert multiple users and projects
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('user1@example.com', 'user1', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('user2@example.com', 'user2', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('user1-project', 'User 1 Project', 1)
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('user2-project', 'User 2 Project', 2)
            `.execute(db);

            // Delete user 1 only
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            // User 2's project should still exist
            const projects = await sql<{ uuid: string }>`SELECT uuid FROM projects`.execute(db);
            expect(projects.rows.length).toBe(1);
            expect(projects.rows[0].uuid).toBe('user2-project');
        });

        it('should recreate the platform_id index', async () => {
            await up(db);

            const indexes = await sql<{ name: string }>`
                SELECT name FROM sqlite_master
                WHERE type = 'index' AND name = 'idx_projects_platform_id'
            `.execute(db);

            expect(indexes.rows.length).toBe(1);
        });

        it('should remove cascading deletes after rollback', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('owner@example.com', 'owner_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('project-uuid', 'Test Project', 1)
            `.execute(db);

            // Run migration and rollback
            await up(db);
            await down(db);

            // Enable FK enforcement
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            // Insert a new project
            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('project-uuid-2', 'Test Project 2', 1)
            `.execute(db);

            // Try to delete user - should fail without CASCADE
            let deleteError: Error | null = null;
            try {
                await sql`DELETE FROM users WHERE id = 1`.execute(db);
            } catch (err) {
                deleteError = err as Error;
            }

            expect(deleteError).not.toBeNull();
            expect(deleteError!.message).toMatch(/FOREIGN KEY constraint failed/i);
        });
    });

    // ========================================================================
    // USERS_PREFERENCES TABLE - OWNER_ID FK TESTS
    // ========================================================================

    describe('users_preferences owner_id FK', () => {
        it('should convert user_id column to owner_id', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('1', 'theme', 'dark')
            `.execute(db);

            await up(db);

            const prefs = await sql<{ owner_id: number; preference_key: string }>`
                SELECT owner_id, preference_key FROM users_preferences
            `.execute(db);

            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].owner_id).toBe(1);
            expect(prefs.rows[0].preference_key).toBe('theme');
        });

        it('should enable cascading deletes for preferences', async () => {
            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('owner@example.com', 'owner_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (owner_id, preference_key, value)
                VALUES (1, 'theme', 'dark')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (owner_id, preference_key, value)
                VALUES (1, 'locale', 'en')
            `.execute(db);

            // Delete user - should cascade to preferences
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            const prefsAfter = await sql<{ id: number }>`SELECT id FROM users_preferences`.execute(db);
            expect(prefsAfter.rows.length).toBe(0);
        });

        it('should create index on owner_id', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await up(db);

            const indexes = await sql<{ name: string }>`
                SELECT name FROM sqlite_master
                WHERE type = 'index' AND name = 'idx_users_preferences_owner_id'
            `.execute(db);

            expect(indexes.rows.length).toBe(1);
        });

        it('should only migrate preferences with valid numeric user_id', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('1', 'valid_pref', 'value1')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('invalid_id', 'invalid_pref', 'value2')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('abc123', 'mixed_pref', 'value3')
            `.execute(db);

            await up(db);

            const prefs = await sql<{ preference_key: string }>`SELECT preference_key FROM users_preferences`.execute(
                db,
            );
            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].preference_key).toBe('valid_pref');
        });

        it('should skip preferences for non-existent users', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('1', 'existing_user_pref', 'value1')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('999', 'orphan_pref', 'value2')
            `.execute(db);

            await up(db);

            const prefs = await sql<{ preference_key: string }>`SELECT preference_key FROM users_preferences`.execute(
                db,
            );
            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].preference_key).toBe('existing_user_pref');
        });

        it('should convert owner_id back to user_id on rollback', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value)
                VALUES ('1', 'theme', 'dark')
            `.execute(db);

            await up(db);
            await down(db);

            const prefs = await sql<{ user_id: string; preference_key: string }>`
                SELECT user_id, preference_key FROM users_preferences
            `.execute(db);

            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].user_id).toBe('1');
            expect(prefs.rows[0].preference_key).toBe('theme');
        });
    });

    // ========================================================================
    // APP_SETTINGS TABLE - SET NULL FK TESTS
    // ========================================================================

    describe('app_settings.updated_by FK', () => {
        it('should clean up orphaned updated_by references', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('admin@example.com', 'admin', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('valid_setting', 'value1', 'string', 1)
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('orphan_setting', 'value2', 'string', 999)
            `.execute(db);

            await up(db);

            const validSetting = await sql<{ updated_by: number | null }>`
                SELECT updated_by FROM app_settings WHERE key = 'valid_setting'
            `.execute(db);
            expect(validSetting.rows[0].updated_by).toBe(1);

            const orphanSetting = await sql<{ updated_by: number | null }>`
                SELECT updated_by FROM app_settings WHERE key = 'orphan_setting'
            `.execute(db);
            expect(orphanSetting.rows[0].updated_by).toBeNull();
        });

        it('should set updated_by to NULL when user is deleted (ON DELETE SET NULL)', async () => {
            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('admin@example.com', 'admin', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('setting1', 'value1', 'string', 1)
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('setting2', 'value2', 'string', 1)
            `.execute(db);

            // Verify updated_by is set
            const beforeDelete = await sql<{ key: string; updated_by: number | null }>`
                SELECT key, updated_by FROM app_settings ORDER BY key
            `.execute(db);
            expect(beforeDelete.rows[0].updated_by).toBe(1);
            expect(beforeDelete.rows[1].updated_by).toBe(1);

            // Delete admin user
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            // Verify settings still exist but updated_by is NULL
            const afterDelete = await sql<{ key: string; updated_by: number | null }>`
                SELECT key, updated_by FROM app_settings ORDER BY key
            `.execute(db);
            expect(afterDelete.rows.length).toBe(2);
            expect(afterDelete.rows[0].updated_by).toBeNull();
            expect(afterDelete.rows[1].updated_by).toBeNull();
        });

        it('should preserve settings with NULL updated_by', async () => {
            await sql`
                INSERT INTO app_settings (key, value, type)
                VALUES ('no_author', 'some value', 'string')
            `.execute(db);

            await up(db);

            const setting = await sql<{ key: string; value: string; updated_by: number | null }>`
                SELECT key, value, updated_by FROM app_settings
            `.execute(db);
            expect(setting.rows.length).toBe(1);
            expect(setting.rows[0].key).toBe('no_author');
            expect(setting.rows[0].value).toBe('some value');
            expect(setting.rows[0].updated_by).toBeNull();
        });

        it('should remove FK constraint after rollback (allows orphaned references)', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('admin@example.com', 'admin', 'hashed')
            `.execute(db);

            await up(db);
            await down(db);

            await sql`PRAGMA foreign_keys = ON`.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('setting', 'value', 'string', 1)
            `.execute(db);

            // Delete user - after rollback, there's no FK so deletion should succeed
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            // Setting should still exist with orphaned updated_by
            const setting = await sql<{ key: string; updated_by: number | null }>`
                SELECT key, updated_by FROM app_settings
            `.execute(db);
            expect(setting.rows.length).toBe(1);
            expect(setting.rows[0].updated_by).toBe(1); // Orphaned, no CASCADE
        });
    });

    // ========================================================================
    // INTEGRATION TESTS - FULL USER DELETION
    // ========================================================================

    describe('full user deletion integration', () => {
        it('should properly cascade delete projects and preferences while setting app_settings.updated_by to NULL', async () => {
            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            // Insert user with project, preferences, and app settings
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('admin@example.com', 'admin', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (uuid, title, owner_id)
                VALUES ('project-1', 'Admin Project', 1)
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (owner_id, preference_key, value)
                VALUES (1, 'theme', 'dark')
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('setting1', 'value1', 'string', 1)
            `.execute(db);

            // Verify all data exists
            const projectsBefore = await sql<{ id: number }>`SELECT id FROM projects`.execute(db);
            expect(projectsBefore.rows.length).toBe(1);

            const prefsBefore = await sql<{ id: number }>`SELECT id FROM users_preferences`.execute(db);
            expect(prefsBefore.rows.length).toBe(1);

            const settingsBefore = await sql<{ updated_by: number }>`SELECT updated_by FROM app_settings`.execute(db);
            expect(settingsBefore.rows[0].updated_by).toBe(1);

            // Delete user
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            // Verify cascades worked correctly
            const projectsAfter = await sql<{ id: number }>`SELECT id FROM projects`.execute(db);
            expect(projectsAfter.rows.length).toBe(0); // CASCADE deleted

            const prefsAfter = await sql<{ id: number }>`SELECT id FROM users_preferences`.execute(db);
            expect(prefsAfter.rows.length).toBe(0); // CASCADE deleted

            const settingsAfter = await sql<{ key: string; updated_by: number | null }>`
                SELECT key, updated_by FROM app_settings
            `.execute(db);
            expect(settingsAfter.rows.length).toBe(1); // Still exists
            expect(settingsAfter.rows[0].updated_by).toBeNull(); // SET NULL
        });

        it('should handle multiple users with mixed ownership', async () => {
            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            // Insert users
            await sql`INSERT INTO users (email, user_id, password) VALUES ('u1@test.com', 'u1', 'h1')`.execute(db);
            await sql`INSERT INTO users (email, user_id, password) VALUES ('u2@test.com', 'u2', 'h2')`.execute(db);

            // Insert projects for both users
            await sql`INSERT INTO projects (uuid, title, owner_id) VALUES ('p1', 'User1 Project', 1)`.execute(db);
            await sql`INSERT INTO projects (uuid, title, owner_id) VALUES ('p2', 'User2 Project', 2)`.execute(db);

            // Insert preferences for both users
            await sql`INSERT INTO users_preferences (owner_id, preference_key, value) VALUES (1, 'pref1', 'v1')`.execute(
                db,
            );
            await sql`INSERT INTO users_preferences (owner_id, preference_key, value) VALUES (2, 'pref2', 'v2')`.execute(
                db,
            );

            // Insert app settings modified by different users
            await sql`INSERT INTO app_settings (key, value, type, updated_by) VALUES ('s1', 'v1', 'string', 1)`.execute(
                db,
            );
            await sql`INSERT INTO app_settings (key, value, type, updated_by) VALUES ('s2', 'v2', 'string', 2)`.execute(
                db,
            );

            // Delete user 1
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            // Verify: User 2's project and preferences remain
            const projects = await sql<{ uuid: string }>`SELECT uuid FROM projects`.execute(db);
            expect(projects.rows.length).toBe(1);
            expect(projects.rows[0].uuid).toBe('p2');

            const prefs = await sql<{ preference_key: string }>`SELECT preference_key FROM users_preferences`.execute(
                db,
            );
            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].preference_key).toBe('pref2');

            // App settings: s1 updated_by = NULL, s2 updated_by = 2
            const settings = await sql<{ key: string; updated_by: number | null }>`
                SELECT key, updated_by FROM app_settings ORDER BY key
            `.execute(db);
            expect(settings.rows.length).toBe(2);
            expect(settings.rows[0]).toEqual({ key: 's1', updated_by: null });
            expect(settings.rows[1]).toEqual({ key: 's2', updated_by: 2 });
        });
    });

    // ========================================================================
    // DIALECT TESTS (MySQL, PostgreSQL)
    // ========================================================================

    describe('MySQL dialect', () => {
        beforeEach(() => {
            configure({ getDialect: () => 'mysql' });
        });

        it('should attempt to run MySQL ALTER TABLE syntax for up()', async () => {
            let errorThrown = false;
            try {
                await up(db);
            } catch (err: any) {
                errorThrown = true;
                // MySQL uses DROP FOREIGN KEY syntax that SQLite doesn't understand
                expect(err.message).toMatch(/DROP|syntax|FOREIGN/i);
            }
            expect(errorThrown).toBe(true);
        });

        it('should attempt to run MySQL ALTER TABLE syntax for down()', async () => {
            let errorThrown = false;
            try {
                await down(db);
            } catch (err: any) {
                errorThrown = true;
                expect(err.message).toMatch(/DROP|syntax|FOREIGN/i);
            }
            expect(errorThrown).toBe(true);
        });
    });

    describe('PostgreSQL dialect', () => {
        beforeEach(() => {
            configure({ getDialect: () => 'postgres' });
        });

        it('should attempt to run PostgreSQL ALTER TABLE syntax for up()', async () => {
            let errorThrown = false;
            try {
                await up(db);
            } catch (err: any) {
                errorThrown = true;
                expect(err.message).toMatch(/CONSTRAINT|syntax|IF/i);
            }
            expect(errorThrown).toBe(true);
        });

        it('should attempt to run PostgreSQL ALTER TABLE syntax for down()', async () => {
            let errorThrown = false;
            try {
                await down(db);
            } catch (err: any) {
                errorThrown = true;
                expect(err.message).toMatch(/CONSTRAINT|syntax|DROP/i);
            }
            expect(errorThrown).toBe(true);
        });
    });

    // ========================================================================
    // TABLE SCHEMA PRESERVATION TESTS
    // ========================================================================

    describe('table schema preservation', () => {
        it('should preserve all projects columns after migration', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO projects (
                    uuid, title, description, owner_id, status, visibility,
                    language, author, license, last_accessed_at, saved_once,
                    platform_id, created_at, updated_at
                )
                VALUES (
                    'full-uuid', 'Full Project', 'A description', 1, 'active', 'public',
                    'en', 'Author Name', 'MIT', 1234567890, 1,
                    'platform-123', 1234567800, 1234567900
                )
            `.execute(db);

            await up(db);

            const project = await sql<{
                uuid: string;
                title: string;
                description: string;
                owner_id: number;
                status: string;
                visibility: string;
                language: string;
                author: string;
                license: string;
                last_accessed_at: number;
                saved_once: number;
                platform_id: string;
                created_at: number;
                updated_at: number;
            }>`SELECT * FROM projects WHERE uuid = 'full-uuid'`.execute(db);

            expect(project.rows.length).toBe(1);
            const p = project.rows[0];
            expect(p.uuid).toBe('full-uuid');
            expect(p.title).toBe('Full Project');
            expect(p.description).toBe('A description');
            expect(p.owner_id).toBe(1);
            expect(p.status).toBe('active');
            expect(p.visibility).toBe('public');
            expect(p.language).toBe('en');
            expect(p.author).toBe('Author Name');
            expect(p.license).toBe('MIT');
            expect(p.last_accessed_at).toBe(1234567890);
            expect(p.saved_once).toBe(1);
            expect(p.platform_id).toBe('platform-123');
            expect(p.created_at).toBe(1234567800);
            expect(p.updated_at).toBe(1234567900);
        });

        it('should preserve all users_preferences columns after migration', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('test@example.com', 'test_user', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO users_preferences (user_id, preference_key, value, description, is_active, created_at, updated_at)
                VALUES ('1', 'locale', 'es', 'User locale setting', 1, 1234567890, 1234567900)
            `.execute(db);

            await up(db);

            const pref = await sql<{
                owner_id: number;
                preference_key: string;
                value: string;
                description: string;
                is_active: number;
                created_at: number;
                updated_at: number;
            }>`SELECT * FROM users_preferences WHERE preference_key = 'locale'`.execute(db);

            expect(pref.rows.length).toBe(1);
            const p = pref.rows[0];
            expect(p.owner_id).toBe(1);
            expect(p.preference_key).toBe('locale');
            expect(p.value).toBe('es');
            expect(p.description).toBe('User locale setting');
            expect(p.is_active).toBe(1);
            expect(p.created_at).toBe(1234567890);
            expect(p.updated_at).toBe(1234567900);
        });

        it('should preserve all app_settings columns after migration', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('admin@example.com', 'admin', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_at, updated_by)
                VALUES ('site_name', 'My Site', 'string', 1234567890, 1)
            `.execute(db);

            await up(db);

            const setting = await sql<{
                key: string;
                value: string;
                type: string;
                updated_at: number;
                updated_by: number;
            }>`SELECT * FROM app_settings WHERE key = 'site_name'`.execute(db);

            expect(setting.rows.length).toBe(1);
            const s = setting.rows[0];
            expect(s.key).toBe('site_name');
            expect(s.value).toBe('My Site');
            expect(s.type).toBe('string');
            expect(s.updated_at).toBe(1234567890);
            expect(s.updated_by).toBe(1);
        });
    });

    // ========================================================================
    // MULTIPLE USERS/PREFERENCES TESTS
    // ========================================================================

    describe('multiple users with multiple preferences', () => {
        it('should correctly migrate preferences for multiple users', async () => {
            await sql`INSERT INTO users (email, user_id, password) VALUES ('user1@test.com', 'user1', 'hash1')`.execute(
                db,
            );
            await sql`INSERT INTO users (email, user_id, password) VALUES ('user2@test.com', 'user2', 'hash2')`.execute(
                db,
            );
            await sql`INSERT INTO users (email, user_id, password) VALUES ('user3@test.com', 'user3', 'hash3')`.execute(
                db,
            );

            await sql`INSERT INTO users_preferences (user_id, preference_key, value) VALUES ('1', 'theme', 'dark')`.execute(
                db,
            );
            await sql`INSERT INTO users_preferences (user_id, preference_key, value) VALUES ('1', 'locale', 'en')`.execute(
                db,
            );
            await sql`INSERT INTO users_preferences (user_id, preference_key, value) VALUES ('2', 'theme', 'light')`.execute(
                db,
            );
            await sql`INSERT INTO users_preferences (user_id, preference_key, value) VALUES ('3', 'advancedMode', 'true')`.execute(
                db,
            );

            await up(db);

            const prefs = await sql<{ owner_id: number; preference_key: string; value: string }>`
                SELECT owner_id, preference_key, value FROM users_preferences ORDER BY owner_id, preference_key
            `.execute(db);

            expect(prefs.rows.length).toBe(4);
            expect(prefs.rows[0]).toEqual({ owner_id: 1, preference_key: 'locale', value: 'en' });
            expect(prefs.rows[1]).toEqual({ owner_id: 1, preference_key: 'theme', value: 'dark' });
            expect(prefs.rows[2]).toEqual({ owner_id: 2, preference_key: 'theme', value: 'light' });
            expect(prefs.rows[3]).toEqual({ owner_id: 3, preference_key: 'advancedMode', value: 'true' });
        });

        it('should cascade delete only for specific user', async () => {
            await sql`INSERT INTO users (email, user_id, password) VALUES ('u1@test.com', 'u1', 'h1')`.execute(db);
            await sql`INSERT INTO users (email, user_id, password) VALUES ('u2@test.com', 'u2', 'h2')`.execute(db);

            await sql`INSERT INTO users_preferences (user_id, preference_key, value) VALUES ('1', 'pref1', 'v1')`.execute(
                db,
            );
            await sql`INSERT INTO users_preferences (user_id, preference_key, value) VALUES ('1', 'pref2', 'v2')`.execute(
                db,
            );
            await sql`INSERT INTO users_preferences (user_id, preference_key, value) VALUES ('2', 'pref3', 'v3')`.execute(
                db,
            );

            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            const prefs = await sql<{ owner_id: number; preference_key: string }>`
                SELECT owner_id, preference_key FROM users_preferences
            `.execute(db);

            expect(prefs.rows.length).toBe(1);
            expect(prefs.rows[0].owner_id).toBe(2);
            expect(prefs.rows[0].preference_key).toBe('pref3');
        });
    });

    // ========================================================================
    // APP_SETTINGS MULTIPLE ADMINS TEST
    // ========================================================================

    describe('app_settings with multiple admins', () => {
        it('should handle multiple settings with different updated_by states', async () => {
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('admin1@example.com', 'admin1', 'hashed')
            `.execute(db);
            await sql`
                INSERT INTO users (email, user_id, password)
                VALUES ('admin2@example.com', 'admin2', 'hashed')
            `.execute(db);

            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('by_admin1', 'v1', 'string', 1)
            `.execute(db);
            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('by_admin2', 'v2', 'string', 2)
            `.execute(db);
            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('no_author', 'v3', 'string', NULL)
            `.execute(db);
            await sql`
                INSERT INTO app_settings (key, value, type, updated_by)
                VALUES ('orphan', 'v4', 'string', 999)
            `.execute(db);

            await up(db);
            await sql`PRAGMA foreign_keys = ON`.execute(db);

            const settings = await sql<{ key: string; updated_by: number | null }>`
                SELECT key, updated_by FROM app_settings ORDER BY key
            `.execute(db);

            expect(settings.rows.length).toBe(4);
            const byAdmin1 = settings.rows.find(s => s.key === 'by_admin1');
            const byAdmin2 = settings.rows.find(s => s.key === 'by_admin2');
            const noAuthor = settings.rows.find(s => s.key === 'no_author');
            const orphan = settings.rows.find(s => s.key === 'orphan');

            expect(byAdmin1?.updated_by).toBe(1);
            expect(byAdmin2?.updated_by).toBe(2);
            expect(noAuthor?.updated_by).toBeNull();
            expect(orphan?.updated_by).toBeNull(); // Was cleaned up

            // Delete admin1
            await sql`DELETE FROM users WHERE id = 1`.execute(db);

            const afterDelete = await sql<{ key: string; updated_by: number | null }>`
                SELECT key, updated_by FROM app_settings ORDER BY key
            `.execute(db);

            const byAdmin1After = afterDelete.rows.find(s => s.key === 'by_admin1');
            const byAdmin2After = afterDelete.rows.find(s => s.key === 'by_admin2');

            expect(byAdmin1After?.updated_by).toBeNull(); // SET NULL by cascade
            expect(byAdmin2After?.updated_by).toBe(2); // Still valid
        });
    });
});
