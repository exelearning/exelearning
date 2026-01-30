/**
 * Migration: Fix all user-related foreign key constraints
 *
 * This migration fixes 3 FK issues in one atomic operation:
 * 1. projects.owner_id - Add ON DELETE CASCADE (delete projects when user deleted)
 * 2. users_preferences - Convert user_id VARCHAR to owner_id INTEGER with FK CASCADE
 * 3. app_settings.updated_by - Add FK with ON DELETE SET NULL
 *
 * Context:
 * - projects.owner_id lacked CASCADE, causing FK constraint errors when deleting users
 * - users_preferences.user_id was VARCHAR without FK, causing orphaned preferences
 * - app_settings.updated_by lacked FK, leaving orphaned references
 *
 * SQLite handling: Requires table recreation since FK constraints cannot be altered.
 * MySQL/PostgreSQL: Use ALTER TABLE to modify constraints directly.
 */
import { Kysely, sql } from 'kysely';
import { getDialectFromEnv, type DbDialect } from '../dialect';

// ============================================================================
// DEPENDENCY INJECTION FOR TESTING
// ============================================================================

export interface MigrationDependencies {
    getDialect: () => DbDialect;
}

const defaultDeps: MigrationDependencies = {
    getDialect: getDialectFromEnv,
};

let deps = { ...defaultDeps };

/**
 * Configure dependencies for testing
 */
export function configure(newDeps: Partial<MigrationDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

/**
 * Reset dependencies to defaults
 */
export function resetDependencies(): void {
    deps = { ...defaultDeps };
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

export async function up(db: Kysely<unknown>): Promise<void> {
    const dialect = deps.getDialect();

    if (dialect === 'sqlite') {
        await migrateUpSqlite(db);
    } else if (dialect === 'mysql') {
        await migrateUpMysql(db);
    } else if (dialect === 'postgres') {
        await migrateUpPostgres(db);
    }
}

export async function down(db: Kysely<unknown>): Promise<void> {
    const dialect = deps.getDialect();

    if (dialect === 'sqlite') {
        await migrateDownSqlite(db);
    } else if (dialect === 'mysql') {
        await migrateDownMysql(db);
    } else if (dialect === 'postgres') {
        await migrateDownPostgres(db);
    }
}

// ============================================================================
// SQLITE MIGRATION
// ============================================================================

async function migrateUpSqlite(db: Kysely<unknown>): Promise<void> {
    // 1. Recreate projects table with ON DELETE CASCADE
    await recreateProjectsTableSqlite(db, true);

    // 2. Recreate users_preferences table with owner_id FK
    await recreatePreferencesTableSqlite(db, true);

    // 3. Recreate app_settings table with FK constraint
    await recreateAppSettingsTableSqlite(db, true);
}

async function migrateDownSqlite(db: Kysely<unknown>): Promise<void> {
    // Reverse order to handle dependencies
    // 3. Remove app_settings FK
    await recreateAppSettingsTableSqlite(db, false);

    // 2. Revert users_preferences to user_id VARCHAR
    await recreatePreferencesTableSqlite(db, false);

    // 1. Remove projects CASCADE
    await recreateProjectsTableSqlite(db, false);
}

// ============================================================================
// MYSQL MIGRATION
// ============================================================================

async function migrateUpMysql(db: Kysely<unknown>): Promise<void> {
    // 1. Fix projects.owner_id CASCADE
    await sql`ALTER TABLE projects DROP FOREIGN KEY projects_ibfk_1`.execute(db);
    await sql`ALTER TABLE projects ADD CONSTRAINT projects_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE`.execute(
        db,
    );

    // 2. Fix users_preferences: user_id VARCHAR -> owner_id INTEGER with FK
    await sql`ALTER TABLE users_preferences ADD COLUMN owner_id INTEGER`.execute(db);
    await sql`
        UPDATE users_preferences
        SET owner_id = CAST(user_id AS UNSIGNED)
        WHERE user_id REGEXP '^[0-9]+$'
    `.execute(db);
    await sql`
        DELETE FROM users_preferences
        WHERE owner_id IS NULL
           OR owner_id NOT IN (SELECT id FROM users)
    `.execute(db);
    await sql`ALTER TABLE users_preferences MODIFY COLUMN owner_id INTEGER NOT NULL`.execute(db);
    await sql`ALTER TABLE users_preferences DROP COLUMN user_id`.execute(db);
    await sql`
        ALTER TABLE users_preferences
        ADD CONSTRAINT users_preferences_owner_fk
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    `.execute(db);
    await sql`CREATE INDEX idx_users_preferences_owner_id ON users_preferences(owner_id)`.execute(db);

    // 3. Fix app_settings.updated_by FK with SET NULL
    await sql`
        UPDATE app_settings
        SET updated_by = NULL
        WHERE updated_by IS NOT NULL
          AND updated_by NOT IN (SELECT id FROM users)
    `.execute(db);
    await sql`
        ALTER TABLE app_settings
        ADD CONSTRAINT app_settings_updated_by_fk
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    `.execute(db);
}

async function migrateDownMysql(db: Kysely<unknown>): Promise<void> {
    // 3. Remove app_settings FK
    await sql`ALTER TABLE app_settings DROP FOREIGN KEY app_settings_updated_by_fk`.execute(db);

    // 2. Revert users_preferences to user_id VARCHAR
    await sql`ALTER TABLE users_preferences ADD COLUMN user_id VARCHAR(255)`.execute(db);
    await sql`UPDATE users_preferences SET user_id = CAST(owner_id AS CHAR)`.execute(db);
    await sql`ALTER TABLE users_preferences MODIFY COLUMN user_id VARCHAR(255) NOT NULL`.execute(db);
    await sql`ALTER TABLE users_preferences DROP FOREIGN KEY users_preferences_owner_fk`.execute(db);
    await sql`DROP INDEX idx_users_preferences_owner_id ON users_preferences`.execute(db);
    await sql`ALTER TABLE users_preferences DROP COLUMN owner_id`.execute(db);

    // 1. Remove projects CASCADE
    await sql`ALTER TABLE projects DROP FOREIGN KEY projects_owner_fk`.execute(db);
    await sql`ALTER TABLE projects ADD CONSTRAINT projects_ibfk_1 FOREIGN KEY (owner_id) REFERENCES users(id)`.execute(
        db,
    );
}

// ============================================================================
// POSTGRESQL MIGRATION
// ============================================================================

async function migrateUpPostgres(db: Kysely<unknown>): Promise<void> {
    // 1. Fix projects.owner_id CASCADE
    await sql`
        ALTER TABLE projects
        DROP CONSTRAINT IF EXISTS projects_owner_id_fkey
    `.execute(db);
    await sql`
        ALTER TABLE projects
        ADD CONSTRAINT projects_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    `.execute(db);

    // 2. Fix users_preferences: user_id VARCHAR -> owner_id INTEGER with FK
    await sql`ALTER TABLE users_preferences ADD COLUMN owner_id INTEGER`.execute(db);
    await sql`
        UPDATE users_preferences
        SET owner_id = CAST(user_id AS INTEGER)
        WHERE user_id ~ '^[0-9]+$'
    `.execute(db);
    await sql`
        DELETE FROM users_preferences
        WHERE owner_id IS NULL
           OR owner_id NOT IN (SELECT id FROM users)
    `.execute(db);
    await sql`ALTER TABLE users_preferences ALTER COLUMN owner_id SET NOT NULL`.execute(db);
    await sql`ALTER TABLE users_preferences DROP COLUMN user_id`.execute(db);
    await sql`
        ALTER TABLE users_preferences
        ADD CONSTRAINT users_preferences_owner_fk
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    `.execute(db);
    await sql`CREATE INDEX idx_users_preferences_owner_id ON users_preferences(owner_id)`.execute(db);

    // 3. Fix app_settings.updated_by FK with SET NULL
    await sql`
        UPDATE app_settings
        SET updated_by = NULL
        WHERE updated_by IS NOT NULL
          AND updated_by NOT IN (SELECT id FROM users)
    `.execute(db);
    await sql`
        ALTER TABLE app_settings
        ADD CONSTRAINT app_settings_updated_by_fk
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    `.execute(db);
}

async function migrateDownPostgres(db: Kysely<unknown>): Promise<void> {
    // 3. Remove app_settings FK
    await sql`ALTER TABLE app_settings DROP CONSTRAINT app_settings_updated_by_fk`.execute(db);

    // 2. Revert users_preferences to user_id VARCHAR
    await sql`ALTER TABLE users_preferences ADD COLUMN user_id VARCHAR(255)`.execute(db);
    await sql`UPDATE users_preferences SET user_id = CAST(owner_id AS VARCHAR)`.execute(db);
    await sql`ALTER TABLE users_preferences ALTER COLUMN user_id SET NOT NULL`.execute(db);
    await sql`ALTER TABLE users_preferences DROP CONSTRAINT users_preferences_owner_fk`.execute(db);
    await sql`DROP INDEX idx_users_preferences_owner_id`.execute(db);
    await sql`ALTER TABLE users_preferences DROP COLUMN owner_id`.execute(db);

    // 1. Remove projects CASCADE
    await sql`
        ALTER TABLE projects
        DROP CONSTRAINT IF EXISTS projects_owner_id_fkey
    `.execute(db);
    await sql`
        ALTER TABLE projects
        ADD CONSTRAINT projects_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES users(id)
    `.execute(db);
}

// ============================================================================
// SQLITE TABLE RECREATION HELPERS
// ============================================================================

/**
 * Recreate the projects table with/without CASCADE on owner_id
 */
async function recreateProjectsTableSqlite(db: Kysely<unknown>, withCascade: boolean): Promise<void> {
    const cascadeClause = withCascade ? 'ON DELETE CASCADE' : '';

    await sql`
        CREATE TABLE projects_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid VARCHAR(36) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            owner_id INTEGER NOT NULL REFERENCES users(id) ${sql.raw(cascadeClause)},
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

    await sql`
        INSERT INTO projects_new (
            id, uuid, title, description, owner_id, status, visibility,
            language, author, license, last_accessed_at, saved_once,
            platform_id, created_at, updated_at
        )
        SELECT
            id, uuid, title, description, owner_id, status, visibility,
            language, author, license, last_accessed_at, saved_once,
            platform_id, created_at, updated_at
        FROM projects
    `.execute(db);

    await sql`DROP TABLE projects`.execute(db);
    await sql`ALTER TABLE projects_new RENAME TO projects`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_platform_id ON projects(platform_id)`.execute(db);
}

/**
 * Recreate the users_preferences table with owner_id FK or revert to user_id
 */
async function recreatePreferencesTableSqlite(db: Kysely<unknown>, withFk: boolean): Promise<void> {
    if (withFk) {
        await sql`
            CREATE TABLE users_preferences_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                preference_key VARCHAR(255) NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at BIGINT,
                updated_at BIGINT
            )
        `.execute(db);

        // Copy data, converting user_id string to owner_id integer
        // Only migrate rows with valid numeric user_id that exist in users table
        await sql`
            INSERT INTO users_preferences_new (id, owner_id, preference_key, value, description, is_active, created_at, updated_at)
            SELECT id, CAST(user_id AS INTEGER), preference_key, value, description, is_active, created_at, updated_at
            FROM users_preferences
            WHERE user_id GLOB '[0-9]*'
              AND CAST(user_id AS INTEGER) IN (SELECT id FROM users)
        `.execute(db);
    } else {
        await sql`
            CREATE TABLE users_preferences_new (
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

        // Copy data, converting owner_id integer to user_id string
        await sql`
            INSERT INTO users_preferences_new (id, user_id, preference_key, value, description, is_active, created_at, updated_at)
            SELECT id, CAST(owner_id AS TEXT), preference_key, value, description, is_active, created_at, updated_at
            FROM users_preferences
        `.execute(db);
    }

    await sql`DROP TABLE users_preferences`.execute(db);
    await sql`ALTER TABLE users_preferences_new RENAME TO users_preferences`.execute(db);

    if (withFk) {
        await sql`CREATE INDEX IF NOT EXISTS idx_users_preferences_owner_id ON users_preferences(owner_id)`.execute(db);
    }
}

/**
 * Recreate the app_settings table with or without FK constraint
 */
async function recreateAppSettingsTableSqlite(db: Kysely<unknown>, withFk: boolean): Promise<void> {
    if (withFk) {
        await sql`
            CREATE TABLE app_settings_new (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL,
                type VARCHAR(20) NOT NULL DEFAULT 'string',
                updated_at BIGINT,
                updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            )
        `.execute(db);

        // Copy data, cleaning up orphaned updated_by references
        await sql`
            INSERT INTO app_settings_new (key, value, type, updated_at, updated_by)
            SELECT key, value, type, updated_at,
                   CASE WHEN updated_by IN (SELECT id FROM users) THEN updated_by ELSE NULL END
            FROM app_settings
        `.execute(db);
    } else {
        await sql`
            CREATE TABLE app_settings_new (
                key VARCHAR(255) PRIMARY KEY,
                value TEXT NOT NULL,
                type VARCHAR(20) NOT NULL DEFAULT 'string',
                updated_at BIGINT,
                updated_by INTEGER
            )
        `.execute(db);

        await sql`
            INSERT INTO app_settings_new (key, value, type, updated_at, updated_by)
            SELECT key, value, type, updated_at, updated_by
            FROM app_settings
        `.execute(db);
    }

    await sql`DROP TABLE app_settings`.execute(db);
    await sql`ALTER TABLE app_settings_new RENAME TO app_settings`.execute(db);
}
