/**
 * Migration: Consolidate admin_themes and builtin_theme_settings into themes table
 *
 * Changes:
 * - Creates unified `themes` table with is_builtin flag
 * - Migrates data from admin_themes (is_builtin=0, now called "site themes")
 * - Migrates data from builtin_theme_settings (is_builtin=1, "base themes")
 * - Updates default_theme in app_settings: "admin" → "site", "builtin" → "base"
 * - Drops old tables
 *
 * Theme categories after migration:
 * - base (is_builtin=1): Built-in themes from public/files/perm/themes/base/
 * - site (is_builtin=0): Admin-uploaded themes, stored in FILES_DIR/themes/site/
 * - user: Imported from ELP, stored in FILES_DIR/themes/users/ (no DB records)
 */
import { Kysely, sql } from 'kysely';
import { getAutoIncrementType, addAutoIncrement, tableExists } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
    const now = new Date().toISOString();
    const idType = getAutoIncrementType();

    // ========================================================================
    // 1. CREATE NEW UNIFIED THEMES TABLE
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
        .addColumn('created_at', 'text')
        .addColumn('updated_at', 'text')
        .execute();

    // Index for efficient queries
    await db.schema
        .createIndex('idx_themes_enabled')
        .ifNotExists()
        .on('themes')
        .columns(['is_enabled', 'is_builtin', 'sort_order'])
        .execute();

    // ========================================================================
    // 2. CHECK IF OLD TABLES EXIST BEFORE MIGRATING
    // ========================================================================
    // This handles the case where migration runs on a fresh database
    const adminThemesExists = await tableExists(db, 'admin_themes');
    const builtinSettingsExists = await tableExists(db, 'builtin_theme_settings');

    // ========================================================================
    // 3. MIGRATE DATA FROM admin_themes (site themes, is_builtin=0)
    // ========================================================================
    if (adminThemesExists) {
        // Update storage_path from 'admin/themes/{name}' to 'themes/site/{name}'
        await sql`
            INSERT INTO themes (
                dir_name, display_name, description, version, author, license,
                is_builtin, is_enabled, is_default, sort_order, storage_path,
                file_size, uploaded_by, created_at, updated_at
            )
            SELECT
                dir_name, display_name, description, version, author, license,
                0 as is_builtin, is_enabled, is_default, sort_order,
                REPLACE(storage_path, 'admin/themes/', 'themes/site/') as storage_path,
                file_size, uploaded_by, created_at, updated_at
            FROM admin_themes
        `.execute(db);
    }

    // ========================================================================
    // 4. MIGRATE DATA FROM builtin_theme_settings (base themes, is_builtin=1)
    // ========================================================================
    if (builtinSettingsExists) {
        // Only insert builtin themes that have custom settings (disabled)
        // Enabled builtin themes will be synced at startup
        await sql`
            INSERT INTO themes (
                dir_name, display_name, is_builtin, is_enabled, is_default,
                sort_order, created_at, updated_at
            )
            SELECT
                dir_name,
                dir_name as display_name,
                1 as is_builtin,
                is_enabled,
                0 as is_default,
                0 as sort_order,
                ${now} as created_at,
                updated_at
            FROM builtin_theme_settings
        `.execute(db);
    }

    // ========================================================================
    // 5. UPDATE DEFAULT THEME TYPE IN app_settings
    // ========================================================================
    // Change "admin" → "site" and "builtin" → "base"
    await db
        .updateTable('app_settings' as any)
        .set({
            value: sql`REPLACE(REPLACE(value, '"admin"', '"site"'), '"builtin"', '"base"')`,
            updated_at: now,
        })
        .where('key', '=', 'default_theme')
        .execute()
        .catch(() => {
            // Ignore if row doesn't exist
        });

    // ========================================================================
    // 6. DROP OLD TABLES
    // ========================================================================
    if (adminThemesExists) {
        await db.schema.dropTable('admin_themes').execute();
    }
    if (builtinSettingsExists) {
        await db.schema.dropTable('builtin_theme_settings').execute();
    }
}

export async function down(db: Kysely<unknown>): Promise<void> {
    const now = new Date().toISOString();
    const idType = getAutoIncrementType();

    // ========================================================================
    // 1. RECREATE OLD TABLES
    // ========================================================================

    // Recreate admin_themes
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

    // Recreate builtin_theme_settings
    await db.schema
        .createTable('builtin_theme_settings')
        .ifNotExists()
        .addColumn('dir_name', 'varchar(100)', col => col.primaryKey())
        .addColumn('is_enabled', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('updated_at', 'text')
        .execute();

    // ========================================================================
    // 2. MIGRATE DATA BACK
    // ========================================================================
    const themesExists = await tableExists(db, 'themes');

    if (themesExists) {
        // Migrate site themes back to admin_themes
        await sql`
            INSERT INTO admin_themes (
                dir_name, display_name, description, version, author, license,
                is_enabled, is_default, sort_order, storage_path,
                file_size, uploaded_by, created_at, updated_at
            )
            SELECT
                dir_name, display_name, description, version, author, license,
                is_enabled, is_default, sort_order,
                REPLACE(storage_path, 'themes/site/', 'admin/themes/') as storage_path,
                file_size, uploaded_by, created_at, updated_at
            FROM themes
            WHERE is_builtin = 0
        `.execute(db);

        // Migrate base themes back to builtin_theme_settings
        await sql`
            INSERT INTO builtin_theme_settings (dir_name, is_enabled, updated_at)
            SELECT dir_name, is_enabled, updated_at
            FROM themes
            WHERE is_builtin = 1
        `.execute(db);
    }

    // ========================================================================
    // 3. REVERT DEFAULT THEME TYPE
    // ========================================================================
    await db
        .updateTable('app_settings' as any)
        .set({
            value: sql`REPLACE(REPLACE(value, '"site"', '"admin"'), '"base"', '"builtin"')`,
            updated_at: now,
        })
        .where('key', '=', 'default_theme')
        .execute()
        .catch(() => {
            // Ignore if row doesn't exist
        });

    // ========================================================================
    // 4. DROP NEW TABLE
    // ========================================================================
    await db.schema.dropTable('themes').ifExists().execute();
}
