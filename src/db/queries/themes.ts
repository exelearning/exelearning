/**
 * Theme Queries - Kysely ORM
 * Unified queries for both base (builtin) and site themes
 *
 * Theme categories:
 * - base (is_builtin=1): Built-in themes from public/files/perm/themes/base/
 * - site (is_builtin=0): Admin-uploaded themes, stored in FILES_DIR/themes/site/
 *
 * All functions accept db as first parameter for dependency injection
 */
import type { Kysely } from 'kysely';
import type { Database, Theme, NewTheme, ThemeUpdate } from '../types';
import { now } from '../types';
import { insertAndReturn, updateByIdAndReturn } from '../helpers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ThemeType = 'base' | 'site';

export interface DefaultThemeSetting {
    type: ThemeType;
    dirName: string;
}

// ============================================================================
// READ QUERIES - ALL THEMES
// ============================================================================

export async function findThemeById(db: Kysely<Database>, id: number): Promise<Theme | undefined> {
    return db.selectFrom('themes').selectAll().where('id', '=', id).executeTakeFirst();
}

export async function findThemeByDirName(db: Kysely<Database>, dirName: string): Promise<Theme | undefined> {
    return db.selectFrom('themes').selectAll().where('dir_name', '=', dirName).executeTakeFirst();
}

export async function getAllThemes(db: Kysely<Database>): Promise<Theme[]> {
    return db
        .selectFrom('themes')
        .selectAll()
        .orderBy('is_builtin', 'desc') // Base themes first
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function getEnabledThemes(db: Kysely<Database>): Promise<Theme[]> {
    return db
        .selectFrom('themes')
        .selectAll()
        .where('is_enabled', '=', 1)
        .orderBy('is_builtin', 'desc')
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function countThemes(db: Kysely<Database>): Promise<number> {
    const result = await db
        .selectFrom('themes')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .executeTakeFirst();
    return result?.count ?? 0;
}

export async function themeDirNameExists(db: Kysely<Database>, dirName: string): Promise<boolean> {
    const result = await db
        .selectFrom('themes')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('dir_name', '=', dirName)
        .executeTakeFirst();
    return (result?.count ?? 0) > 0;
}

// ============================================================================
// READ QUERIES - SITE THEMES (is_builtin=0)
// ============================================================================

export async function getSiteThemes(db: Kysely<Database>): Promise<Theme[]> {
    return db
        .selectFrom('themes')
        .selectAll()
        .where('is_builtin', '=', 0)
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function getEnabledSiteThemes(db: Kysely<Database>): Promise<Theme[]> {
    return db
        .selectFrom('themes')
        .selectAll()
        .where('is_builtin', '=', 0)
        .where('is_enabled', '=', 1)
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function countSiteThemes(db: Kysely<Database>): Promise<number> {
    const result = await db
        .selectFrom('themes')
        .select(eb => eb.fn.count<number>('id').as('count'))
        .where('is_builtin', '=', 0)
        .executeTakeFirst();
    return result?.count ?? 0;
}

// ============================================================================
// READ QUERIES - BASE THEMES (is_builtin=1)
// ============================================================================

export async function getBaseThemes(db: Kysely<Database>): Promise<Theme[]> {
    return db
        .selectFrom('themes')
        .selectAll()
        .where('is_builtin', '=', 1)
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function getEnabledBaseThemes(db: Kysely<Database>): Promise<Theme[]> {
    return db
        .selectFrom('themes')
        .selectAll()
        .where('is_builtin', '=', 1)
        .where('is_enabled', '=', 1)
        .orderBy('sort_order', 'asc')
        .orderBy('display_name', 'asc')
        .execute();
}

export async function findBaseThemeByDirName(db: Kysely<Database>, dirName: string): Promise<Theme | undefined> {
    return db
        .selectFrom('themes')
        .selectAll()
        .where('dir_name', '=', dirName)
        .where('is_builtin', '=', 1)
        .executeTakeFirst();
}

// ============================================================================
// WRITE QUERIES
// ============================================================================

export async function createTheme(db: Kysely<Database>, data: NewTheme): Promise<Theme> {
    const timestamp = now();
    return insertAndReturn(db, 'themes', {
        ...data,
        is_builtin: data.is_builtin ?? 0,
        is_enabled: data.is_enabled ?? 1,
        is_default: data.is_default ?? 0,
        sort_order: data.sort_order ?? 0,
        created_at: timestamp,
        updated_at: timestamp,
    });
}

export async function updateTheme(db: Kysely<Database>, id: number, data: ThemeUpdate): Promise<Theme | undefined> {
    return updateByIdAndReturn(db, 'themes', id, {
        ...data,
        updated_at: now(),
    });
}

export async function deleteTheme(db: Kysely<Database>, id: number): Promise<void> {
    await db.deleteFrom('themes').where('id', '=', id).execute();
}

// ============================================================================
// SPECIALIZED QUERIES - DEFAULT THEME
// ============================================================================

/**
 * Get the theme marked as default in the themes table
 */
export async function getDefaultThemeRecord(db: Kysely<Database>): Promise<Theme | undefined> {
    return db
        .selectFrom('themes')
        .selectAll()
        .where('is_default', '=', 1)
        .where('is_enabled', '=', 1)
        .executeTakeFirst();
}

/**
 * Set a theme as default, clearing default from all other themes
 */
export async function setDefaultThemeById(db: Kysely<Database>, id: number): Promise<Theme | undefined> {
    // Clear default from all themes
    await db.updateTable('themes').set({ is_default: 0, updated_at: now() }).execute();

    // Set the new default
    return updateByIdAndReturn(db, 'themes', id, { is_default: 1, updated_at: now() });
}

/**
 * Clear the default theme (no theme is default)
 */
export async function clearDefaultTheme(db: Kysely<Database>): Promise<void> {
    await db.updateTable('themes').set({ is_default: 0, updated_at: now() }).execute();
}

// ============================================================================
// SPECIALIZED QUERIES - ENABLED/DISABLED
// ============================================================================

/**
 * Toggle enabled status
 */
export async function toggleThemeEnabled(
    db: Kysely<Database>,
    id: number,
    isEnabled: boolean,
): Promise<Theme | undefined> {
    // If disabling a default theme, also clear the default flag
    const theme = await findThemeById(db, id);
    const updates: ThemeUpdate = {
        is_enabled: isEnabled ? 1 : 0,
        updated_at: now(),
    };

    // If disabling a default theme, also remove default status
    if (!isEnabled && theme?.is_default === 1) {
        updates.is_default = 0;
    }

    return updateByIdAndReturn(db, 'themes', id, updates);
}

// ============================================================================
// SPECIALIZED QUERIES - SORT ORDER
// ============================================================================

/**
 * Get the next sort order value for site themes
 */
export async function getNextSiteThemeSortOrder(db: Kysely<Database>): Promise<number> {
    const result = await db
        .selectFrom('themes')
        .select(eb => eb.fn.max<number>('sort_order').as('max_order'))
        .where('is_builtin', '=', 0)
        .executeTakeFirst();
    return (result?.max_order ?? 0) + 1;
}

// ============================================================================
// DEFAULT THEME SETTINGS (stored in app_settings)
// Uses 'base' and 'site' as type values
// ============================================================================

/**
 * Get the default theme setting from app_settings
 * Returns { type: 'base', dirName: 'base' } if not set
 */
export async function getDefaultTheme(db: Kysely<Database>): Promise<DefaultThemeSetting> {
    const result = await db
        .selectFrom('app_settings')
        .select('value')
        .where('key', '=', 'default_theme')
        .executeTakeFirst();

    if (result?.value) {
        try {
            return JSON.parse(result.value) as DefaultThemeSetting;
        } catch {
            // Invalid JSON, return default
        }
    }

    return { type: 'base', dirName: 'base' };
}

/**
 * Set the default theme in app_settings
 */
export async function setDefaultTheme(db: Kysely<Database>, themeType: ThemeType, dirName: string): Promise<void> {
    const value = JSON.stringify({ type: themeType, dirName });

    // Try to update existing
    const updated = await db
        .updateTable('app_settings')
        .set({
            value,
            updated_at: now(),
        })
        .where('key', '=', 'default_theme')
        .executeTakeFirst();

    // If no rows updated, insert new
    if (!updated.numUpdatedRows || updated.numUpdatedRows === BigInt(0)) {
        await db
            .insertInto('app_settings')
            .values({
                key: 'default_theme',
                value,
                type: 'json',
                updated_at: now(),
            })
            .execute();
    }
}

// ============================================================================
// BUILTIN THEME SYNC
// Syncs filesystem themes with database records
// ============================================================================

/**
 * Upsert a base theme record
 * Used by startup sync to register builtin themes from filesystem
 */
export async function upsertBaseTheme(
    db: Kysely<Database>,
    data: {
        dir_name: string;
        display_name: string;
        description?: string | null;
        version?: string | null;
        author?: string | null;
        license?: string | null;
    },
): Promise<void> {
    await db
        .insertInto('themes')
        .values({
            dir_name: data.dir_name,
            display_name: data.display_name,
            description: data.description ?? null,
            version: data.version ?? null,
            author: data.author ?? null,
            license: data.license ?? null,
            is_builtin: 1,
            is_enabled: 1,
            is_default: 0,
            sort_order: 0,
            storage_path: null,
            created_at: now(),
            updated_at: now(),
        })
        .onConflict(oc =>
            oc.column('dir_name').doUpdateSet({
                display_name: data.display_name,
                description: data.description ?? null,
                version: data.version ?? null,
                author: data.author ?? null,
                license: data.license ?? null,
                is_builtin: 1,
                updated_at: now(),
            }),
        )
        .execute();
}

/**
 * Remove base themes that no longer exist in filesystem
 */
export async function removeOrphanedBaseThemes(db: Kysely<Database>, existingDirNames: string[]): Promise<void> {
    if (existingDirNames.length === 0) {
        // If no themes provided, don't delete anything (safety)
        return;
    }

    await db.deleteFrom('themes').where('is_builtin', '=', 1).where('dir_name', 'not in', existingDirNames).execute();
}
