/**
 * Migration: Add admin_themes and templates tables
 * Stores metadata for admin-managed themes and project templates
 *
 * - Themes: ZIP files containing config.xml, style.css, etc.
 * - Templates: ELPX files organized by locale
 *
 * Files are stored in filesystem (FILES_DIR/), metadata in database.
 */
import { Kysely } from 'kysely';
import { getAutoIncrementType, addAutoIncrement } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
    const idType = getAutoIncrementType();

    // ========================================================================
    // ADMIN THEMES
    // ========================================================================
    await db.schema
        .createTable('admin_themes')
        .ifNotExists()
        .addColumn('id', idType, col => addAutoIncrement(col.primaryKey()))
        .addColumn('dir_name', 'varchar(100)', col => col.notNull().unique())
        .addColumn('display_name', 'varchar(255)', col => col.notNull())
        .addColumn('description', 'text')
        .addColumn('version', 'varchar(50)')
        .addColumn('author', 'varchar(255)')
        .addColumn('license', 'varchar(255)')
        .addColumn('is_enabled', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('is_default', 'integer', col => col.notNull().defaultTo(0))
        .addColumn('sort_order', 'integer', col => col.notNull().defaultTo(0))
        .addColumn('storage_path', 'varchar(512)', col => col.notNull())
        .addColumn('file_size', 'integer')
        .addColumn('uploaded_by', 'integer', col => col.references('users.id').onDelete('set null'))
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
        .execute();

    await db.schema
        .createIndex('idx_admin_themes_enabled')
        .ifNotExists()
        .on('admin_themes')
        .columns(['is_enabled', 'sort_order'])
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
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('templates').ifExists().execute();
    await db.schema.dropTable('admin_themes').ifExists().execute();
}
