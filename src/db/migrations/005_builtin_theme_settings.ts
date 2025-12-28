/**
 * Migration: Add builtin_theme_settings table
 * Stores enabled/disabled state for builtin themes and global default theme setting.
 *
 * Builtin themes are in public/files/perm/themes/base/
 * By default, all builtin themes are enabled and "base" is the default theme.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // ========================================================================
    // BUILTIN THEME SETTINGS
    // Stores enabled/disabled state for themes in public/files/perm/themes/base/
    // ========================================================================
    await db.schema
        .createTable('builtin_theme_settings')
        .addColumn('dir_name', 'varchar(100)', col => col.primaryKey())
        .addColumn('is_enabled', 'integer', col => col.notNull().defaultTo(1))
        .addColumn('updated_at', 'text')
        .execute();

    // ========================================================================
    // GLOBAL DEFAULT THEME SETTING
    // Stored in app_settings table: key = 'default_theme', value = JSON
    // Value format: { "type": "builtin"|"admin", "dirName": "theme-name" }
    // ========================================================================
    // Insert default theme setting (base theme)
    await sql`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ('default_theme', '{"type":"builtin","dirName":"base"}', datetime('now'))
        ON CONFLICT (key) DO NOTHING
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable('builtin_theme_settings').ifExists().execute();
    await sql`DELETE FROM app_settings WHERE key = 'default_theme'`.execute(db);
}
