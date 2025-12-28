/**
 * Admin Themes Routes for Elysia
 * CRUD endpoints for site-managed themes (formerly "admin themes")
 * Requires ROLE_ADMIN for all routes
 *
 * Theme categories:
 * - base (is_builtin=1): Built-in themes from public/files/perm/themes/base/
 * - site (is_builtin=0): Admin-uploaded themes, stored in FILES_DIR/themes/site/
 */
import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';
import * as path from 'path';
import { db as defaultDb } from '../db/client';
import type { Kysely } from 'kysely';
import type { Database, Theme } from '../db/types';
import type { JwtPayload } from './auth';
import {
    // Site theme queries (is_builtin=0)
    getSiteThemes as getSiteThemesDefault,
    getEnabledSiteThemes as getEnabledSiteThemesDefault,
    findThemeById as findThemeByIdDefault,
    findThemeByDirName as findThemeByDirNameDefault,
    createTheme as createThemeDefault,
    updateTheme as updateThemeDefault,
    deleteTheme as deleteThemeDefault,
    setDefaultThemeById as setDefaultThemeByIdDefault,
    clearDefaultTheme as clearDefaultThemeDefault,
    toggleThemeEnabled as toggleThemeEnabledDefault,
    themeDirNameExists as themeDirNameExistsDefault,
    getNextSiteThemeSortOrder as getNextSiteThemeSortOrderDefault,
    getDefaultThemeRecord as getDefaultThemeRecordDefault,
    // Base theme queries (is_builtin=1)
    getBaseThemes as getBaseThemesDefault,
    upsertBaseTheme as upsertBaseThemeDefault,
    // Default theme settings (app_settings)
    getDefaultTheme as getDefaultThemeDefault,
    setDefaultTheme as setDefaultThemeDefault,
    type DefaultThemeSetting,
    type ThemeType,
} from '../db/queries/themes';
import {
    validateThemeZip as validateThemeZipDefault,
    extractTheme as extractThemeDefault,
    slugify as slugifyDefault,
    BASE_THEME_NAMES,
} from '../services/admin-upload-validator';
import { requireAdmin } from '../utils/guards';
import { getFilesDir as getFilesDirDefault, getJwtSecret, deleteFileIfExists } from '../utils/admin-route-helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface ThemesQueries {
    // Site theme queries
    getSiteThemes: typeof getSiteThemesDefault;
    getEnabledSiteThemes: typeof getEnabledSiteThemesDefault;
    findThemeById: typeof findThemeByIdDefault;
    findThemeByDirName: typeof findThemeByDirNameDefault;
    createTheme: typeof createThemeDefault;
    updateTheme: typeof updateThemeDefault;
    deleteTheme: typeof deleteThemeDefault;
    setDefaultThemeById: typeof setDefaultThemeByIdDefault;
    clearDefaultTheme: typeof clearDefaultThemeDefault;
    toggleThemeEnabled: typeof toggleThemeEnabledDefault;
    themeDirNameExists: typeof themeDirNameExistsDefault;
    getNextSiteThemeSortOrder: typeof getNextSiteThemeSortOrderDefault;
    getDefaultThemeRecord: typeof getDefaultThemeRecordDefault;
    // Base theme queries
    getBaseThemes: typeof getBaseThemesDefault;
    upsertBaseTheme: typeof upsertBaseThemeDefault;
    // Default theme settings
    getDefaultTheme: typeof getDefaultThemeDefault;
    setDefaultTheme: typeof setDefaultThemeDefault;
}

export interface ThemesValidatorDeps {
    validateThemeZip: typeof validateThemeZipDefault;
    extractTheme: typeof extractThemeDefault;
    slugify: typeof slugifyDefault;
}

export interface ThemesDependencies {
    db: Kysely<Database>;
    queries: ThemesQueries;
    validator: ThemesValidatorDeps;
    getFilesDir: () => string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const defaultDependencies: ThemesDependencies = {
    db: defaultDb,
    queries: {
        // Site theme queries
        getSiteThemes: getSiteThemesDefault,
        getEnabledSiteThemes: getEnabledSiteThemesDefault,
        findThemeById: findThemeByIdDefault,
        findThemeByDirName: findThemeByDirNameDefault,
        createTheme: createThemeDefault,
        updateTheme: updateThemeDefault,
        deleteTheme: deleteThemeDefault,
        setDefaultThemeById: setDefaultThemeByIdDefault,
        clearDefaultTheme: clearDefaultThemeDefault,
        toggleThemeEnabled: toggleThemeEnabledDefault,
        themeDirNameExists: themeDirNameExistsDefault,
        getNextSiteThemeSortOrder: getNextSiteThemeSortOrderDefault,
        getDefaultThemeRecord: getDefaultThemeRecordDefault,
        // Base theme queries
        getBaseThemes: getBaseThemesDefault,
        upsertBaseTheme: upsertBaseThemeDefault,
        // Default theme settings
        getDefaultTheme: getDefaultThemeDefault,
        setDefaultTheme: setDefaultThemeDefault,
    },
    validator: {
        validateThemeZip: validateThemeZipDefault,
        extractTheme: extractThemeDefault,
        slugify: slugifyDefault,
    },
    getFilesDir: getFilesDirDefault,
};

// ============================================================================
// HELPERS
// ============================================================================

export interface SerializedTheme {
    id: number | null;
    dirName: string;
    displayName: string;
    description: string | null;
    version: string | null;
    author: string | null;
    license: string | null;
    isEnabled: boolean;
    isDefault: boolean;
    sortOrder: number;
    storagePath: string | null;
    fileSize: number | null;
    uploadedBy: number | null;
    createdAt: string | null;
    updatedAt: string | null;
    source: 'base' | 'site';
}

function serializeTheme(theme: Theme, source: 'base' | 'site' = 'site'): SerializedTheme {
    return {
        id: theme.id,
        dirName: theme.dir_name,
        displayName: theme.display_name,
        description: theme.description,
        version: theme.version,
        author: theme.author,
        license: theme.license,
        isEnabled: theme.is_enabled === 1,
        isDefault: theme.is_default === 1,
        sortOrder: theme.sort_order,
        storagePath: theme.storage_path,
        fileSize: theme.file_size,
        uploadedBy: theme.uploaded_by,
        createdAt: theme.created_at,
        updatedAt: theme.updated_at,
        source,
    };
}

/**
 * Get base themes from the database (is_builtin=1)
 * These are synced from public/files/perm/themes/base/ at startup
 * Returns serialized theme objects
 */
async function getBaseThemesAsSerializedThemes(
    database: Kysely<Database>,
    queries: ThemesQueries,
): Promise<SerializedTheme[]> {
    // Get base themes from database (synced at startup)
    const baseThemes = await queries.getBaseThemes(database);

    // Get default theme setting
    let defaultTheme: DefaultThemeSetting = { type: 'base', dirName: 'base' };
    try {
        defaultTheme = await queries.getDefaultTheme(database);
    } catch {
        // If table doesn't exist yet, use default
    }

    return baseThemes.map(theme => {
        const serialized = serializeTheme(theme, 'base');
        // Override isDefault based on global setting
        serialized.isDefault = defaultTheme.type === 'base' && defaultTheme.dirName === theme.dir_name;
        return serialized;
    });
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createAdminThemesRoutes(deps: ThemesDependencies = defaultDependencies) {
    const { db: database, queries, validator, getFilesDir: filesDir } = deps;

    return (
        new Elysia({ name: 'admin-themes-routes' })
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                }),
            )
            .use(cookie())

            // Global guard for admin routes
            .guard({
                async beforeHandle({ jwt, cookie, set }) {
                    const token = cookie.auth?.value;
                    if (!token) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'No authentication token' };
                    }

                    const payload = (await jwt.verify(token)) as JwtPayload | false;
                    if (!payload) {
                        set.status = 401;
                        return { error: 'Unauthorized', message: 'Invalid token' };
                    }

                    const authError = requireAdmin(payload);
                    if (authError) {
                        set.status = 403;
                        return { error: authError.error, message: authError.message };
                    }
                },
            })

            // =====================================================
            // GET /api/admin/themes - List all themes
            // Includes base themes (is_builtin=1) and site themes (is_builtin=0)
            // =====================================================
            .get('/api/admin/themes', async () => {
                // Get site themes from database (is_builtin=0)
                const siteThemes = await queries.getSiteThemes(database);

                // Get default theme setting
                let defaultTheme: DefaultThemeSetting = { type: 'base', dirName: 'base' };
                try {
                    defaultTheme = await queries.getDefaultTheme(database);
                } catch {
                    // Use default if table doesn't exist
                }

                // Serialize site themes with isDefault flag
                const serializedSite = siteThemes.map(t => {
                    const serialized = serializeTheme(t, 'site');
                    // Override isDefault based on global setting
                    serialized.isDefault = defaultTheme.type === 'site' && defaultTheme.dirName === t.dir_name;
                    return serialized;
                });

                // Get base themes from database (is_builtin=1, synced at startup)
                const baseThemes = await getBaseThemesAsSerializedThemes(database, queries);

                // Merge: base first, then site
                // Sort base by displayName
                baseThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));

                return {
                    themes: [...baseThemes, ...serializedSite],
                };
            })

            // =====================================================
            // GET /api/admin/themes/default - Get current default theme
            // =====================================================
            .get('/api/admin/themes/default', async () => {
                try {
                    const defaultTheme = await queries.getDefaultTheme(database);
                    return defaultTheme;
                } catch {
                    return { type: 'base', dirName: 'base' };
                }
            })

            // =====================================================
            // GET /api/admin/themes/:id - Get theme by ID
            // =====================================================
            .get('/api/admin/themes/:id', async ({ params, set }) => {
                const id = parseInt(params.id, 10);
                if (isNaN(id)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid theme ID' };
                }

                const theme = await queries.findThemeById(database, id);
                if (!theme) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Theme not found' };
                }

                const source = theme.is_builtin === 1 ? 'base' : 'site';
                return serializeTheme(theme, source);
            })

            // =====================================================
            // POST /api/admin/themes/upload - Upload new theme
            // =====================================================
            .post(
                '/api/admin/themes/upload',
                async ({ body, set, jwt, cookie }) => {
                    try {
                        const { file, displayName, isEnabled } = body;

                        if (!file) {
                            set.status = 400;
                            return { error: 'Bad Request', message: 'No file uploaded' };
                        }

                        // Get file buffer
                        const fileBuffer = Buffer.from(await file.arrayBuffer());

                        // Validate ZIP file
                        const validation = await validator.validateThemeZip(fileBuffer);
                        if (!validation.valid) {
                            set.status = 400;
                            return { error: 'Bad Request', message: validation.error };
                        }

                        // Generate dir name from theme name
                        const dirName = validator.slugify(validation.metadata!.name);
                        if (!dirName) {
                            set.status = 400;
                            return {
                                error: 'Bad Request',
                                message: 'Could not generate valid directory name from theme name',
                            };
                        }

                        // Check if dir name conflicts with base themes
                        if (BASE_THEME_NAMES.includes(dirName)) {
                            set.status = 400;
                            return {
                                error: 'Bad Request',
                                message: `Theme name "${dirName}" conflicts with a built-in theme`,
                            };
                        }

                        // Check if dir name already exists in themes (both base and site)
                        const exists = await queries.themeDirNameExists(database, dirName);
                        if (exists) {
                            set.status = 400;
                            return {
                                error: 'Bad Request',
                                message: `Theme with directory name "${dirName}" already exists`,
                            };
                        }

                        // Determine storage path (site themes go to themes/site/)
                        const storagePath = `themes/site/${dirName}`;
                        const targetDir = path.join(filesDir(), storagePath);

                        // Extract theme
                        await validator.extractTheme(fileBuffer, targetDir);

                        // Get current user ID from JWT
                        const token = cookie.auth?.value;
                        const payload = (await jwt.verify(token!)) as JwtPayload;

                        // Get next sort order
                        const sortOrder = await queries.getNextSiteThemeSortOrder(database);

                        // Create database record (is_builtin=0 for site themes)
                        const theme = await queries.createTheme(database, {
                            dir_name: dirName,
                            display_name: displayName || validation.metadata!.title || dirName,
                            description: validation.metadata!.description || null,
                            version: validation.metadata!.version || null,
                            author: validation.metadata!.author || null,
                            license: validation.metadata!.license || null,
                            is_builtin: 0, // Site theme
                            is_enabled: isEnabled === false ? 0 : 1,
                            is_default: 0,
                            sort_order: sortOrder,
                            storage_path: storagePath,
                            file_size: fileBuffer.length,
                            uploaded_by: payload.sub,
                        });

                        set.status = 201;
                        return serializeTheme(theme);
                    } catch (error) {
                        set.status = 500;
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        return { error: 'Internal Server Error', message };
                    }
                },
                {
                    body: t.Object({
                        file: t.File(),
                        displayName: t.Optional(t.String()),
                        isEnabled: t.Optional(t.Boolean()),
                    }),
                },
            )

            // =====================================================
            // PATCH /api/admin/themes/:id - Update theme metadata
            // =====================================================
            .patch(
                '/api/admin/themes/:id',
                async ({ params, body, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid theme ID' };
                    }

                    const theme = await queries.findThemeById(database, id);
                    if (!theme) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Theme not found' };
                    }

                    const updates: Parameters<typeof queries.updateTheme>[2] = {};

                    if (body.displayName !== undefined) {
                        updates.display_name = body.displayName;
                    }
                    if (body.description !== undefined) {
                        updates.description = body.description;
                    }
                    if (body.sortOrder !== undefined) {
                        updates.sort_order = body.sortOrder;
                    }

                    const updatedTheme = await queries.updateTheme(database, id, updates);
                    if (!updatedTheme) {
                        set.status = 500;
                        return { error: 'Internal Server Error', message: 'Failed to update theme' };
                    }

                    const source = updatedTheme.is_builtin === 1 ? 'base' : 'site';
                    return serializeTheme(updatedTheme, source);
                },
                {
                    body: t.Object({
                        displayName: t.Optional(t.String()),
                        description: t.Optional(t.String()),
                        sortOrder: t.Optional(t.Number()),
                    }),
                },
            )

            // =====================================================
            // PATCH /api/admin/themes/:id/enabled - Toggle enabled
            // =====================================================
            .patch(
                '/api/admin/themes/:id/enabled',
                async ({ params, body, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid theme ID' };
                    }

                    const theme = await queries.findThemeById(database, id);
                    if (!theme) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Theme not found' };
                    }

                    const updatedTheme = await queries.toggleThemeEnabled(database, id, body.isEnabled);
                    if (!updatedTheme) {
                        set.status = 500;
                        return { error: 'Internal Server Error', message: 'Failed to update theme' };
                    }

                    const source = updatedTheme.is_builtin === 1 ? 'base' : 'site';
                    return serializeTheme(updatedTheme, source);
                },
                {
                    body: t.Object({
                        isEnabled: t.Boolean(),
                    }),
                },
            )

            // =====================================================
            // PATCH /api/admin/themes/:id/default - Set theme as default
            // =====================================================
            .patch('/api/admin/themes/:id/default', async ({ params, set }) => {
                const id = parseInt(params.id, 10);
                if (isNaN(id)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid theme ID' };
                }

                const theme = await queries.findThemeById(database, id);
                if (!theme) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Theme not found' };
                }

                if (theme.is_enabled !== 1) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Cannot set disabled theme as default' };
                }

                // Determine theme type based on is_builtin flag
                const themeType: ThemeType = theme.is_builtin === 1 ? 'base' : 'site';

                // Set global default theme
                await queries.setDefaultTheme(database, themeType, theme.dir_name);

                // Also update the is_default flag in themes table
                const updatedTheme = await queries.setDefaultThemeById(database, id);
                if (!updatedTheme) {
                    set.status = 500;
                    return { error: 'Internal Server Error', message: 'Failed to set default theme' };
                }

                return serializeTheme(updatedTheme, themeType);
            })

            // =====================================================
            // DELETE /api/admin/themes/:id - Delete site theme
            // =====================================================
            .delete('/api/admin/themes/:id', async ({ params, set }) => {
                const id = parseInt(params.id, 10);
                if (isNaN(id)) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Invalid theme ID' };
                }

                const theme = await queries.findThemeById(database, id);
                if (!theme) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Theme not found' };
                }

                // Cannot delete base themes
                if (theme.is_builtin === 1) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Cannot delete built-in themes' };
                }

                // Check if this is the default theme
                try {
                    const defaultTheme = await queries.getDefaultTheme(database);
                    if (defaultTheme.type === 'site' && defaultTheme.dirName === theme.dir_name) {
                        // Reset to base theme 'base'
                        await queries.setDefaultTheme(database, 'base', 'base');
                    }
                } catch {
                    // Ignore if table doesn't exist
                }

                // Delete files (only if storage_path exists)
                if (theme.storage_path) {
                    const targetDir = path.join(filesDir(), theme.storage_path);
                    await deleteFileIfExists(targetDir);
                }

                // Delete database record
                await queries.deleteTheme(database, id);

                return { success: true, message: 'Theme deleted' };
            })

            // =====================================================
            // BASE THEME ENDPOINTS (legacy: builtin)
            // Base themes are now stored in the themes table with is_builtin=1
            // =====================================================

            // PATCH /api/admin/themes/builtin/:dirName/enabled - Toggle base theme enabled
            .patch(
                '/api/admin/themes/builtin/:dirName/enabled',
                async ({ params, body, set }) => {
                    const { dirName } = params;

                    // Find the base theme in database (synced at startup)
                    const baseThemes = await queries.getBaseThemes(database);
                    const theme = baseThemes.find(t => t.dir_name === dirName);

                    if (!theme) {
                        set.status = 404;
                        return { error: 'Not Found', message: `Base theme "${dirName}" not found` };
                    }

                    // Cannot disable the default theme
                    if (!body.isEnabled) {
                        try {
                            const defaultTheme = await queries.getDefaultTheme(database);
                            if (defaultTheme.type === 'base' && defaultTheme.dirName === dirName) {
                                set.status = 400;
                                return { error: 'Bad Request', message: 'Cannot disable the default theme' };
                            }
                        } catch {
                            // If table doesn't exist and trying to disable 'base', reject
                            if (dirName === 'base') {
                                set.status = 400;
                                return { error: 'Bad Request', message: 'Cannot disable the default theme' };
                            }
                        }
                    }

                    await queries.toggleThemeEnabled(database, theme.id, body.isEnabled);

                    return { success: true, dirName, isEnabled: body.isEnabled };
                },
                {
                    body: t.Object({
                        isEnabled: t.Boolean(),
                    }),
                },
            )

            // PATCH /api/admin/themes/builtin/:dirName/default - Set base theme as default
            .patch('/api/admin/themes/builtin/:dirName/default', async ({ params, set }) => {
                const { dirName } = params;

                // Find the base theme in database (synced at startup)
                const baseThemes = await queries.getBaseThemes(database);
                const theme = baseThemes.find(t => t.dir_name === dirName);

                if (!theme) {
                    set.status = 404;
                    return { error: 'Not Found', message: `Base theme "${dirName}" not found` };
                }

                // Check if the theme is enabled
                if (theme.is_enabled === 0) {
                    set.status = 400;
                    return { error: 'Bad Request', message: 'Cannot set disabled theme as default' };
                }

                // Clear is_default from all themes and set this one
                await queries.clearDefaultTheme(database);

                // Set global default theme
                await queries.setDefaultTheme(database, 'base', dirName);

                // Update is_default flag in themes table
                await queries.setDefaultThemeById(database, theme.id);

                return { success: true, type: 'base', dirName };
            })
    );
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export const adminThemesRoutes = createAdminThemesRoutes();
