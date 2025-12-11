/**
 * Initial Migration: Create all tables
 * Compatible with SQLite, PostgreSQL, and MySQL
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
    // ========================================================================
    // USERS
    // ========================================================================
    await db.schema
        .createTable('users')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('email', 'varchar(180)', (col) => col.notNull().unique())
        .addColumn('user_id', 'varchar(40)', (col) => col.notNull())
        .addColumn('password', 'text', (col) => col.notNull())
        .addColumn('roles', 'text', (col) => col.notNull().defaultTo('[]'))
        .addColumn('is_lopd_accepted', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('quota_mb', 'integer')
        .addColumn('external_identifier', 'varchar(180)')
        .addColumn('api_token', 'varchar(255)')
        .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
        .execute();

    // ========================================================================
    // USER PREFERENCES
    // ========================================================================
    await db.schema
        .createTable('users_preferences')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('user_id', 'varchar(255)', (col) => col.notNull())
        .addColumn('preference_key', 'varchar(255)', (col) => col.notNull())
        .addColumn('value', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
        .execute();

    await db.schema
        .createIndex('idx_users_preferences_user_id')
        .on('users_preferences')
        .column('user_id')
        .execute();

    // ========================================================================
    // PROJECTS
    // ========================================================================
    await db.schema
        .createTable('projects')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('uuid', 'varchar(36)', (col) => col.notNull().unique())
        .addColumn('title', 'varchar(255)', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('owner_id', 'integer', (col) => col.notNull().references('users.id'))
        .addColumn('status', 'varchar(50)', (col) => col.notNull().defaultTo('active'))
        .addColumn('visibility', 'varchar(20)', (col) => col.notNull().defaultTo('private'))
        .addColumn('language', 'varchar(10)')
        .addColumn('author', 'varchar(255)')
        .addColumn('license', 'varchar(255)')
        .addColumn('last_accessed_at', 'text')
        .addColumn('saved_once', 'integer', (col) => col.notNull().defaultTo(0))
        .addColumn('is_active', 'integer', (col) => col.notNull().defaultTo(1))
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
        .execute();

    // ========================================================================
    // PROJECT COLLABORATORS (Join Table)
    // ========================================================================
    await db.schema
        .createTable('project_collaborators')
        .addColumn('project_id', 'integer', (col) =>
            col.notNull().references('projects.id').onDelete('cascade')
        )
        .addColumn('user_id', 'integer', (col) =>
            col.notNull().references('users.id').onDelete('cascade')
        )
        .execute();

    await db.schema
        .createIndex('idx_project_collaborators_pk')
        .on('project_collaborators')
        .columns(['project_id', 'user_id'])
        .unique()
        .execute();

    // ========================================================================
    // ASSETS
    // ========================================================================
    await db.schema
        .createTable('assets')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('project_id', 'integer', (col) =>
            col.notNull().references('projects.id').onDelete('cascade')
        )
        .addColumn('filename', 'varchar(255)', (col) => col.notNull())
        .addColumn('storage_path', 'varchar(500)', (col) => col.notNull())
        .addColumn('mime_type', 'varchar(100)')
        .addColumn('file_size', 'text') // bigint as text for cross-db compatibility
        .addColumn('client_id', 'varchar(36)')
        .addColumn('component_id', 'varchar(255)')
        .addColumn('content_hash', 'varchar(64)')
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
        .execute();

    await db.schema
        .createIndex('idx_asset_client_project')
        .on('assets')
        .columns(['client_id', 'project_id'])
        .unique()
        .execute();

    // ========================================================================
    // YJS DOCUMENTS (Snapshots)
    // ========================================================================
    await db.schema
        .createTable('yjs_documents')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('project_id', 'integer', (col) =>
            col.notNull().unique().references('projects.id').onDelete('cascade')
        )
        .addColumn('snapshot_data', 'blob', (col) => col.notNull())
        .addColumn('snapshot_version', 'text', (col) => col.notNull().defaultTo('0'))
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
        .execute();

    // ========================================================================
    // YJS UPDATES (Incremental)
    // ========================================================================
    await db.schema
        .createTable('yjs_updates')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('project_id', 'integer', (col) =>
            col.notNull().references('projects.id').onDelete('cascade')
        )
        .addColumn('update_data', 'blob', (col) => col.notNull())
        .addColumn('version', 'text', (col) => col.notNull())
        .addColumn('client_id', 'varchar(255)')
        .addColumn('created_at', 'text')
        .execute();

    await db.schema
        .createIndex('idx_yjs_updates_project_version')
        .on('yjs_updates')
        .columns(['project_id', 'version'])
        .execute();

    // ========================================================================
    // YJS VERSION HISTORY (Rollback support)
    // ========================================================================
    await db.schema
        .createTable('yjs_version_history')
        .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
        .addColumn('project_id', 'integer', (col) =>
            col.notNull().references('projects.id').onDelete('cascade')
        )
        .addColumn('snapshot_data', 'blob', (col) => col.notNull())
        .addColumn('version', 'text', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('created_by', 'integer', (col) => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'text')
        .execute();

    await db.schema
        .createIndex('idx_yjs_version_history_project')
        .on('yjs_version_history')
        .column('project_id')
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await db.schema.dropTable('yjs_version_history').ifExists().execute();
    await db.schema.dropTable('yjs_updates').ifExists().execute();
    await db.schema.dropTable('yjs_documents').ifExists().execute();
    await db.schema.dropTable('assets').ifExists().execute();
    await db.schema.dropTable('project_collaborators').ifExists().execute();
    await db.schema.dropTable('projects').ifExists().execute();
    await db.schema.dropTable('users_preferences').ifExists().execute();
    await db.schema.dropTable('users').ifExists().execute();
}
