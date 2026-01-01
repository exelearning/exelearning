/**
 * Initial Migration: Create all tables
 * Compatible with SQLite, PostgreSQL, and MySQL
 *
 * This consolidated migration creates the complete v3.1 schema:
 * - Core: users, users_preferences, projects, project_collaborators, assets
 * - Yjs: yjs_documents, yjs_updates, yjs_version_history
 * - Settings: app_settings
 * - Themes: themes, templates
 */
import { Kysely, sql } from 'kysely';
import { getAutoIncrementType, addAutoIncrement, getBinaryType } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
    // Get the correct types for the current database
    const idType = getAutoIncrementType();
    const binaryType = getBinaryType();
    const now = Date.now();

    // ========================================================================
    // USERS
    // ========================================================================
    await db.schema
        .createTable('users')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('email', 'varchar(180)', col => col.notNull().unique())
        .addColumn('user_id', 'varchar(40)', col => col.notNull())
        .addColumn('password', 'text', col => col.notNull())
        .addColumn('roles', 'text', col => col.notNull().defaultTo('[]'))
        .addColumn('is_lopd_accepted', 'integer', col => col.notNull().defaultTo(0))
        .addColumn('quota_mb', 'integer')
        .addColumn('external_identifier', 'varchar(180)')
        .addColumn('api_token', 'varchar(255)')
        .addColumn('is_active', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    // ========================================================================
    // USER PREFERENCES
    // ========================================================================
    await db.schema
        .createTable('users_preferences')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('user_id', 'varchar(255)', col => col.notNull())
        .addColumn('preference_key', 'varchar(255)', col => col.notNull())
        .addColumn('value', 'text', col => col.notNull())
        .addColumn('description', 'text')
        .addColumn('is_active', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    await db.schema
        .createIndex('idx_users_preferences_user_id')
        .ifNotExists()
        .on('users_preferences')
        .column('user_id')
        .execute();

    // ========================================================================
    // PROJECTS
    // ========================================================================
    await db.schema
        .createTable('projects')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('uuid', 'varchar(36)', col => col.notNull().unique())
        .addColumn('title', 'varchar(255)', col => col.notNull())
        .addColumn('description', 'text')
        .addColumn('owner_id', 'integer', col => col.notNull().references('users.id'))
        .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('active'))
        .addColumn('visibility', 'varchar(20)', col => col.notNull().defaultTo('private'))
        .addColumn('language', 'varchar(10)')
        .addColumn('author', 'varchar(255)')
        .addColumn('license', 'varchar(255)')
        .addColumn('last_accessed_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('saved_once', 'integer', col => col.notNull().defaultTo(0))
        .addColumn('platform_id', 'varchar(64)') // External platform ID (e.g., Moodle cmid)
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    await db.schema
        .createIndex('idx_projects_platform_id')
        .ifNotExists()
        .on('projects')
        .column('platform_id')
        .execute();

    // ========================================================================
    // PROJECT COLLABORATORS (Join Table)
    // ========================================================================
    await db.schema
        .createTable('project_collaborators')
        .ifNotExists()
        .addColumn('project_id', 'integer', col => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('user_id', 'integer', col => col.notNull().references('users.id').onDelete('cascade'))
        .execute();

    await db.schema
        .createIndex('idx_project_collaborators_pk')
        .ifNotExists()
        .on('project_collaborators')
        .columns(['project_id', 'user_id'])
        .unique()
        .execute();

    // ========================================================================
    // ASSETS
    // ========================================================================
    await db.schema
        .createTable('assets')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('project_id', 'integer', col => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('filename', 'varchar(255)', col => col.notNull())
        .addColumn('storage_path', 'varchar(500)', col => col.notNull())
        .addColumn('mime_type', 'varchar(100)')
        .addColumn('file_size', 'text') // bigint as text for cross-db compatibility
        .addColumn('client_id', 'varchar(36)')
        .addColumn('component_id', 'varchar(255)')
        .addColumn('content_hash', 'varchar(64)')
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    await db.schema
        .createIndex('idx_asset_client_project')
        .ifNotExists()
        .on('assets')
        .columns(['client_id', 'project_id'])
        .unique()
        .execute();

    // ========================================================================
    // YJS DOCUMENTS (Snapshots)
    // ========================================================================
    await db.schema
        .createTable('yjs_documents')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('project_id', 'integer', col => col.notNull().unique().references('projects.id').onDelete('cascade'))
        .addColumn('snapshot_data', binaryType, col => col.notNull())
        .addColumn('snapshot_version', 'text', col => col.notNull().defaultTo('0'))
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    // ========================================================================
    // YJS UPDATES (Incremental)
    // ========================================================================
    await db.schema
        .createTable('yjs_updates')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('project_id', 'integer', col => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('update_data', binaryType, col => col.notNull())
        .addColumn('version', 'varchar(255)', col => col.notNull())
        .addColumn('client_id', 'varchar(255)')
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    await db.schema
        .createIndex('idx_yjs_updates_project_version')
        .ifNotExists()
        .on('yjs_updates')
        .columns(['project_id', 'version'])
        .execute();

    // ========================================================================
    // YJS VERSION HISTORY (Rollback support)
    // ========================================================================
    await db.schema
        .createTable('yjs_version_history')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('project_id', 'integer', col => col.notNull().references('projects.id').onDelete('cascade'))
        .addColumn('snapshot_data', binaryType, col => col.notNull())
        .addColumn('version', 'varchar(255)', col => col.notNull())
        .addColumn('description', 'text')
        .addColumn('created_by', 'integer', col => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'bigint', col => col.notNull()) // Unix timestamp in milliseconds (required)
        .execute();

    await db.schema
        .createIndex('idx_yjs_version_history_project')
        .ifNotExists()
        .on('yjs_version_history')
        .column('project_id')
        .execute();

    // ========================================================================
    // APP SETTINGS
    // ========================================================================
    await db.schema
        .createTable('app_settings')
        .ifNotExists()
        .addColumn('key', 'varchar(255)', col => col.primaryKey())
        .addColumn('value', 'text', col => col.notNull())
        .addColumn('type', 'varchar(20)', col => col.notNull().defaultTo('string'))
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_by', 'integer')
        .execute();

    // ========================================================================
    // THEMES (unified table for base and site themes)
    // - is_builtin=1: Built-in themes from public/files/perm/themes/base/
    // - is_builtin=0: Admin-uploaded themes, stored in FILES_DIR/themes/site/
    // ========================================================================
    await db.schema
        .createTable('themes')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('dir_name', 'varchar(100)', col => col.notNull().unique())
        .addColumn('display_name', 'varchar(255)', col => col.notNull())
        .addColumn('description', 'text')
        .addColumn('version', 'varchar(50)')
        .addColumn('author', 'varchar(255)')
        .addColumn('license', 'varchar(255)')
        .addColumn('is_builtin', 'integer', col => col.notNull().defaultTo(0)) // 1=base, 0=site
        .addColumn('is_enabled', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('is_default', 'integer', col => col.notNull().defaultTo(0))
        .addColumn('sort_order', 'integer', col => col.notNull().defaultTo(0))
        .addColumn('storage_path', 'varchar(512)') // NULL for builtin (uses filesystem)
        .addColumn('file_size', 'integer')
        .addColumn('uploaded_by', 'integer', col => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    await db.schema
        .createIndex('idx_themes_enabled')
        .ifNotExists()
        .on('themes')
        .columns(['is_enabled', 'is_builtin', 'sort_order'])
        .execute();

    // ========================================================================
    // TEMPLATES (project templates for new projects)
    // ========================================================================
    await db.schema
        .createTable('templates')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('filename', 'varchar(255)', col => col.notNull())
        .addColumn('display_name', 'varchar(255)', col => col.notNull())
        .addColumn('description', 'text')
        .addColumn('locale', 'varchar(10)', col => col.notNull())
        .addColumn('is_enabled', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('sort_order', 'integer', col => col.notNull().defaultTo(0))
        .addColumn('storage_path', 'varchar(512)', col => col.notNull())
        .addColumn('file_size', 'integer')
        .addColumn('preview_image', 'varchar(512)')
        .addColumn('uploaded_by', 'integer', col => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'bigint') // Unix timestamp in milliseconds
        .addColumn('updated_at', 'bigint') // Unix timestamp in milliseconds
        .execute();

    // Unique constraint: same filename can exist in different locales
    await db.schema
        .createIndex('idx_templates_filename_locale')
        .ifNotExists()
        .on('templates')
        .columns(['filename', 'locale'])
        .unique()
        .execute();

    // Index for fast locale-based queries
    await db.schema
        .createIndex('idx_templates_locale')
        .ifNotExists()
        .on('templates')
        .columns(['locale', 'is_enabled', 'sort_order'])
        .execute();

    // ========================================================================
    // DEFAULT SETTINGS
    // ========================================================================
    // Insert default theme setting (base theme)
    await sql`
        INSERT INTO app_settings (key, value, type, updated_at)
        VALUES ('default_theme', '{"type":"base","dirName":"base"}', 'json', ${now})
    `
        .execute(db)
        .catch(() => {
            // Ignore if already exists (for databases that don't support ON CONFLICT)
        });
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Drop tables in reverse order (respecting foreign keys)
    await db.schema.dropTable('templates').ifExists().execute();
    await db.schema.dropTable('themes').ifExists().execute();
    await db.schema.dropTable('app_settings').ifExists().execute();
    await db.schema.dropTable('yjs_version_history').ifExists().execute();
    await db.schema.dropTable('yjs_updates').ifExists().execute();
    await db.schema.dropTable('yjs_documents').ifExists().execute();
    await db.schema.dropTable('assets').ifExists().execute();
    await db.schema.dropTable('project_collaborators').ifExists().execute();
    await db.schema.dropTable('projects').ifExists().execute();
    await db.schema.dropTable('users_preferences').ifExists().execute();
    await db.schema.dropTable('users').ifExists().execute();
}
