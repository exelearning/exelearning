/**
 * Migration: Make user_id nullable in users table
 *
 * The user_id column is only used for external SSO login identifiers:
 * - CAS users: "cas:{username}"
 * - OIDC users: "oidc:{subject}"
 *
 * Local/Guest users should have NULL for user_id (they're not SSO).
 *
 * Note: SQLite doesn't support ALTER COLUMN, so we need to recreate the table.
 * PostgreSQL and MySQL support altering column nullability directly.
 */
import { Kysely, sql } from 'kysely';
import { getDialect as getDialectHelper, columnExists as columnExistsHelper } from '../helpers';
import type { DbDialect } from '../dialect';

// Dependency injection for testing
interface MigrationDeps {
    getDialect: () => DbDialect;
    columnExists: (db: Kysely<unknown>, tableName: string, columnName: string) => Promise<boolean>;
}

const defaultDeps: MigrationDeps = {
    getDialect: getDialectHelper,
    columnExists: columnExistsHelper,
};

let deps = defaultDeps;

export function configure(newDeps: Partial<MigrationDeps>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

export async function up(db: Kysely<unknown>): Promise<void> {
    const dialect = deps.getDialect();

    // Check if user_id column exists (it might not exist if this is a legacy migration path
    // where the table was created by 001_initial but hasn't been populated with all columns)
    const hasUserIdColumn = await deps.columnExists(db, 'users', 'user_id');
    if (!hasUserIdColumn) {
        console.log('[Migration 005] user_id column does not exist, skipping migration');
        return;
    }

    if (dialect === 'sqlite') {
        // SQLite doesn't support ALTER COLUMN, need to recreate table
        // This is a careful process to preserve all data and constraints

        // 1. Create new table with nullable user_id
        await db.schema
            .createTable('users_new')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('email', 'varchar(180)', col => col.notNull().unique())
            .addColumn('user_id', 'varchar(255)') // Now nullable
            .addColumn('password', 'text', col => col.notNull())
            .addColumn('roles', 'text', col => col.notNull().defaultTo('[]'))
            .addColumn('is_lopd_accepted', 'integer', col => col.notNull().defaultTo(0))
            .addColumn('quota_mb', 'integer')
            .addColumn('external_identifier', 'varchar(180)')
            .addColumn('api_token', 'varchar(255)')
            .addColumn('is_active', 'integer', col => col.notNull().defaultTo(1))
            .addColumn('created_at', 'bigint')
            .addColumn('updated_at', 'bigint')
            .execute();

        // 2. Copy data from old table
        await sql`
            INSERT INTO users_new (id, email, user_id, password, roles, is_lopd_accepted, quota_mb, external_identifier, api_token, is_active, created_at, updated_at)
            SELECT id, email, user_id, password, roles, is_lopd_accepted, quota_mb, external_identifier, api_token, is_active, created_at, updated_at
            FROM users
        `.execute(db);

        // 3. Drop old table
        await db.schema.dropTable('users').execute();

        // 4. Rename new table to users
        await sql`ALTER TABLE users_new RENAME TO users`.execute(db);
    } else if (dialect === 'postgres') {
        // PostgreSQL: Simply drop NOT NULL constraint
        await sql`ALTER TABLE users ALTER COLUMN user_id DROP NOT NULL`.execute(db);
    } else if (dialect === 'mysql') {
        // MySQL/MariaDB: Modify column to allow NULL (need to specify full column definition)
        await sql`ALTER TABLE users MODIFY COLUMN user_id VARCHAR(255) NULL`.execute(db);
    }
}

export async function down(db: Kysely<unknown>): Promise<void> {
    const dialect = deps.getDialect();

    // Check if user_id column exists
    const hasUserIdColumn = await deps.columnExists(db, 'users', 'user_id');
    if (!hasUserIdColumn) {
        console.log('[Migration 005] user_id column does not exist, skipping rollback');
        return;
    }

    // Warning: This will fail if there are NULL values in user_id
    // Set a default value for any NULL user_id before rolling back
    await sql`UPDATE users SET user_id = email WHERE user_id IS NULL`.execute(db);

    if (dialect === 'sqlite') {
        // SQLite: recreate table with NOT NULL constraint

        // 1. Create table with NOT NULL user_id
        await db.schema
            .createTable('users_new')
            .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
            .addColumn('email', 'varchar(180)', col => col.notNull().unique())
            .addColumn('user_id', 'varchar(255)', col => col.notNull())
            .addColumn('password', 'text', col => col.notNull())
            .addColumn('roles', 'text', col => col.notNull().defaultTo('[]'))
            .addColumn('is_lopd_accepted', 'integer', col => col.notNull().defaultTo(0))
            .addColumn('quota_mb', 'integer')
            .addColumn('external_identifier', 'varchar(180)')
            .addColumn('api_token', 'varchar(255)')
            .addColumn('is_active', 'integer', col => col.notNull().defaultTo(1))
            .addColumn('created_at', 'bigint')
            .addColumn('updated_at', 'bigint')
            .execute();

        // 2. Copy data from old table
        await sql`
            INSERT INTO users_new (id, email, user_id, password, roles, is_lopd_accepted, quota_mb, external_identifier, api_token, is_active, created_at, updated_at)
            SELECT id, email, user_id, password, roles, is_lopd_accepted, quota_mb, external_identifier, api_token, is_active, created_at, updated_at
            FROM users
        `.execute(db);

        // 3. Drop old table
        await db.schema.dropTable('users').execute();

        // 4. Rename new table to users
        await sql`ALTER TABLE users_new RENAME TO users`.execute(db);
    } else if (dialect === 'postgres') {
        // PostgreSQL: Add NOT NULL constraint back
        await sql`ALTER TABLE users ALTER COLUMN user_id SET NOT NULL`.execute(db);
    } else if (dialect === 'mysql') {
        // MySQL/MariaDB: Modify column to NOT NULL
        await sql`ALTER TABLE users MODIFY COLUMN user_id VARCHAR(255) NOT NULL`.execute(db);
    }
}
