/**
 * Migration: Clean up legacy Symfony schema
 *
 * This migration runs ONLY when migrating from a Symfony-based eXeLearning installation.
 * Detection: Checks for Symfony-specific tables (ode_files) or columns (user_preferences_key).
 * If none exist, this is a fresh installation and the migration is a no-op.
 *
 * For Symfony legacy databases, it performs:
 * 1. Renames Symfony tables to _legacy suffix (users → users_legacy, etc.)
 * 2. Drops obsolete ode_* tables (replaced by Yjs architecture)
 *
 * Note: is_active column is kept on users and users_preferences tables
 * (same as Symfony schema).
 */
import { Kysely, sql } from 'kysely';
import { columnExists, tableExists } from '../helpers';

export async function up(db: Kysely<unknown>): Promise<void> {
    // ========================================================================
    // DETECT SYMFONY LEGACY DATABASE
    // ========================================================================
    // Symfony databases have specific tables/columns that new installations don't:
    // - ode_files table (for ODE file sync)
    // - user_preferences_key column in users_preferences (renamed to preference_key)
    //
    // If none of these exist, this is a fresh installation and we skip cleanup.
    const odeFilesExists = await tableExists(db, 'ode_files');
    const usersExists = await tableExists(db, 'users');
    const userPrefsExists = await tableExists(db, 'users_preferences');
    const hasSymfonyPrefsColumns = userPrefsExists
        ? await columnExists(db, 'users_preferences', 'user_preferences_key')
        : false;

    const isSymfonyLegacy = odeFilesExists || hasSymfonyPrefsColumns;

    if (!isSymfonyLegacy) {
        // Fresh installation - nothing to clean up
        return;
    }

    console.log('[Migration] Detected Symfony legacy database, cleaning up schema...');

    // ========================================================================
    // 1. RENAME LEGACY TABLES (users not migrated - all users will be new)
    // ========================================================================
    // Rename Symfony tables to _legacy so 001_initial creates fresh ones
    if (usersExists) {
        try {
            await sql`ALTER TABLE users RENAME TO users_legacy`.execute(db);
            console.log('[Migration] Renamed users → users_legacy');
        } catch {
            // Table might already be renamed
        }
    }

    if (userPrefsExists) {
        try {
            await sql`ALTER TABLE users_preferences RENAME TO users_preferences_legacy`.execute(db);
            console.log('[Migration] Renamed users_preferences → users_preferences_legacy');
        } catch {
            // Table might already be renamed
        }
    }

    // ========================================================================
    // 2. DROP OBSOLETE ODE_* TABLES (Symfony sync tables, replaced by Yjs)
    // ========================================================================
    const obsoleteTables = [
        'ode_files',
        'ode_operations_log',
        'ode_properties_sync',
        'ode_nav_structure_sync',
        'ode_nav_structure_sync_properties',
        'ode_pag_structure_sync',
        'ode_pag_structure_sync_properties',
        'ode_components_sync',
        'ode_components_sync_properties',
        'current_ode_users',
        'current_ode_users_sync_changes',
    ];

    for (const tableName of obsoleteTables) {
        const exists = await tableExists(db, tableName);
        if (exists) {
            await db.schema.dropTable(tableName).execute();
            console.log(`[Migration] Dropped obsolete table: ${tableName}`);
        }
    }
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // This migration cannot be fully reversed because:
    // 1. Dropped ode_* tables had data that is lost
    // 2. Column renames could be reversed but datetime conversion cannot
    //
    // For safety, we do nothing in down() - this is a one-way migration.
    // If someone needs to go back to Symfony, they should restore from backup.
}
