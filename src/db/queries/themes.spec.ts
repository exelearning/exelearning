/**
 * Tests for Theme Queries
 * Uses real in-memory SQLite database (no mocks)
 */
import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../types';
import {
    findThemeById,
    findThemeByDirName,
    getAllThemes,
    getEnabledThemes,
    countThemes,
    themeDirNameExists,
    getSiteThemes,
    getEnabledSiteThemes,
    countSiteThemes,
    getBaseThemes,
    getEnabledBaseThemes,
    findBaseThemeByDirName,
    createTheme,
    updateTheme,
    deleteTheme,
    getDefaultThemeRecord,
    setDefaultThemeById,
    clearDefaultTheme,
    toggleThemeEnabled,
    getNextSiteThemeSortOrder,
    getDefaultTheme,
    setDefaultTheme,
} from './themes';

describe('Theme Queries', () => {
    let db: Kysely<Database>;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
    });

    describe('createTheme', () => {
        test('should create a new site theme (is_builtin=0)', async () => {
            const theme = await createTheme(db, {
                dir_name: 'test-theme',
                display_name: 'Test Theme',
                description: 'A test theme',
                version: '1.0.0',
                author: 'Test Author',
                license: 'MIT',
                is_builtin: 0,
                is_enabled: 1,
                is_default: 0,
                sort_order: 1,
                storage_path: 'themes/site/test-theme',
                file_size: 12345,
                uploaded_by: null,
            });

            expect(theme.id).toBeDefined();
            expect(theme.dir_name).toBe('test-theme');
            expect(theme.is_builtin).toBe(0);
            expect(theme.is_enabled).toBe(1);
        });

        test('should create a new base theme (is_builtin=1)', async () => {
            const theme = await createTheme(db, {
                dir_name: 'base-theme',
                display_name: 'Base Theme',
                is_builtin: 1,
                is_enabled: 1,
            });

            expect(theme.id).toBeDefined();
            expect(theme.dir_name).toBe('base-theme');
            expect(theme.is_builtin).toBe(1);
        });
    });

    describe('getAllThemes', () => {
        test('should return all themes sorted by is_builtin desc, sort_order, display_name', async () => {
            await createTheme(db, {
                dir_name: 'site-theme-1',
                display_name: 'Site Theme 1',
                is_builtin: 0,
                sort_order: 1,
            });
            await createTheme(db, {
                dir_name: 'base-theme-1',
                display_name: 'Base Theme 1',
                is_builtin: 1,
                sort_order: 1,
            });

            const themes = await getAllThemes(db);
            expect(themes.length).toBe(2);
            // Base themes should come first
            expect(themes[0].is_builtin).toBe(1);
            expect(themes[1].is_builtin).toBe(0);
        });

        test('should return empty array when no themes', async () => {
            const themes = await getAllThemes(db);
            expect(themes).toEqual([]);
        });
    });

    describe('getEnabledThemes', () => {
        test('should only return enabled themes', async () => {
            await createTheme(db, {
                dir_name: 'enabled-theme',
                display_name: 'Enabled Theme',
                is_enabled: 1,
            });
            await createTheme(db, {
                dir_name: 'disabled-theme',
                display_name: 'Disabled Theme',
                is_enabled: 0,
            });

            const themes = await getEnabledThemes(db);
            expect(themes.length).toBe(1);
            expect(themes[0].dir_name).toBe('enabled-theme');
        });
    });

    describe('countThemes', () => {
        test('should count all themes', async () => {
            await createTheme(db, { dir_name: 'theme-1', display_name: 'Theme 1' });
            await createTheme(db, { dir_name: 'theme-2', display_name: 'Theme 2' });

            const count = await countThemes(db);
            expect(count).toBe(2);
        });

        test('should return 0 when no themes', async () => {
            const count = await countThemes(db);
            expect(count).toBe(0);
        });
    });

    describe('findThemeById', () => {
        test('should find theme by id', async () => {
            const created = await createTheme(db, {
                dir_name: 'find-me',
                display_name: 'Find Me',
            });

            const found = await findThemeById(db, created.id);
            expect(found).toBeDefined();
            expect(found?.dir_name).toBe('find-me');
        });

        test('should return undefined for non-existent id', async () => {
            const found = await findThemeById(db, 99999);
            expect(found).toBeUndefined();
        });
    });

    describe('findThemeByDirName', () => {
        test('should find theme by dir_name', async () => {
            await createTheme(db, {
                dir_name: 'my-theme',
                display_name: 'My Theme',
            });

            const found = await findThemeByDirName(db, 'my-theme');
            expect(found).toBeDefined();
            expect(found?.display_name).toBe('My Theme');
        });

        test('should return undefined for non-existent dir_name', async () => {
            const found = await findThemeByDirName(db, 'non-existent');
            expect(found).toBeUndefined();
        });
    });

    describe('themeDirNameExists', () => {
        test('should return true for existing dir_name', async () => {
            await createTheme(db, { dir_name: 'exists', display_name: 'Exists' });

            const exists = await themeDirNameExists(db, 'exists');
            expect(exists).toBe(true);
        });

        test('should return false for non-existent dir_name', async () => {
            const exists = await themeDirNameExists(db, 'does-not-exist');
            expect(exists).toBe(false);
        });
    });

    describe('getSiteThemes', () => {
        test('should only return site themes (is_builtin=0)', async () => {
            await createTheme(db, {
                dir_name: 'site-theme',
                display_name: 'Site Theme',
                is_builtin: 0,
            });
            await createTheme(db, {
                dir_name: 'base-theme',
                display_name: 'Base Theme',
                is_builtin: 1,
            });

            const themes = await getSiteThemes(db);
            expect(themes.length).toBe(1);
            expect(themes[0].is_builtin).toBe(0);
        });
    });

    describe('getEnabledSiteThemes', () => {
        test('should only return enabled site themes', async () => {
            await createTheme(db, {
                dir_name: 'enabled-site',
                display_name: 'Enabled Site',
                is_builtin: 0,
                is_enabled: 1,
            });
            await createTheme(db, {
                dir_name: 'disabled-site',
                display_name: 'Disabled Site',
                is_builtin: 0,
                is_enabled: 0,
            });
            await createTheme(db, {
                dir_name: 'enabled-base',
                display_name: 'Enabled Base',
                is_builtin: 1,
                is_enabled: 1,
            });

            const themes = await getEnabledSiteThemes(db);
            expect(themes.length).toBe(1);
            expect(themes[0].dir_name).toBe('enabled-site');
        });
    });

    describe('countSiteThemes', () => {
        test('should only count site themes', async () => {
            await createTheme(db, { dir_name: 'site-1', display_name: 'Site 1', is_builtin: 0 });
            await createTheme(db, { dir_name: 'site-2', display_name: 'Site 2', is_builtin: 0 });
            await createTheme(db, { dir_name: 'base-1', display_name: 'Base 1', is_builtin: 1 });

            const count = await countSiteThemes(db);
            expect(count).toBe(2);
        });
    });

    describe('getBaseThemes', () => {
        test('should only return base themes (is_builtin=1)', async () => {
            await createTheme(db, {
                dir_name: 'site-theme',
                display_name: 'Site Theme',
                is_builtin: 0,
            });
            await createTheme(db, {
                dir_name: 'base-theme',
                display_name: 'Base Theme',
                is_builtin: 1,
            });

            const themes = await getBaseThemes(db);
            expect(themes.length).toBe(1);
            expect(themes[0].is_builtin).toBe(1);
        });
    });

    describe('getEnabledBaseThemes', () => {
        test('should only return enabled base themes', async () => {
            await createTheme(db, {
                dir_name: 'enabled-base',
                display_name: 'Enabled Base',
                is_builtin: 1,
                is_enabled: 1,
            });
            await createTheme(db, {
                dir_name: 'disabled-base',
                display_name: 'Disabled Base',
                is_builtin: 1,
                is_enabled: 0,
            });

            const themes = await getEnabledBaseThemes(db);
            expect(themes.length).toBe(1);
            expect(themes[0].dir_name).toBe('enabled-base');
        });
    });

    describe('findBaseThemeByDirName', () => {
        test('should find base theme by dir_name', async () => {
            await createTheme(db, {
                dir_name: 'my-base-theme',
                display_name: 'My Base Theme',
                is_builtin: 1,
            });
            await createTheme(db, {
                dir_name: 'my-site-theme',
                display_name: 'My Site Theme',
                is_builtin: 0,
            });

            const found = await findBaseThemeByDirName(db, 'my-base-theme');
            expect(found).toBeDefined();
            expect(found?.is_builtin).toBe(1);

            // Should not find site theme
            const notFound = await findBaseThemeByDirName(db, 'my-site-theme');
            expect(notFound).toBeUndefined();
        });
    });

    describe('updateTheme', () => {
        test('should update theme fields', async () => {
            const created = await createTheme(db, {
                dir_name: 'to-update',
                display_name: 'Original Name',
            });

            const updated = await updateTheme(db, created.id, {
                display_name: 'Updated Name',
                description: 'Added description',
            });

            expect(updated?.display_name).toBe('Updated Name');
            expect(updated?.description).toBe('Added description');
        });

        test('should return undefined for non-existent id', async () => {
            const updated = await updateTheme(db, 99999, { display_name: 'New Name' });
            expect(updated).toBeUndefined();
        });
    });

    describe('deleteTheme', () => {
        test('should delete theme', async () => {
            const created = await createTheme(db, {
                dir_name: 'to-delete',
                display_name: 'Delete Me',
            });

            await deleteTheme(db, created.id);

            const found = await findThemeById(db, created.id);
            expect(found).toBeUndefined();
        });
    });

    describe('toggleThemeEnabled', () => {
        test('should toggle theme enabled state', async () => {
            const created = await createTheme(db, {
                dir_name: 'toggle-me',
                display_name: 'Toggle Me',
                is_enabled: 1,
            });

            const disabled = await toggleThemeEnabled(db, created.id, false);
            expect(disabled?.is_enabled).toBe(0);

            const enabled = await toggleThemeEnabled(db, created.id, true);
            expect(enabled?.is_enabled).toBe(1);
        });

        test('should clear default when disabling default theme', async () => {
            const created = await createTheme(db, {
                dir_name: 'default-toggle',
                display_name: 'Default Toggle',
                is_enabled: 1,
                is_default: 1,
            });

            const disabled = await toggleThemeEnabled(db, created.id, false);
            expect(disabled?.is_enabled).toBe(0);
            expect(disabled?.is_default).toBe(0);
        });
    });

    describe('getDefaultThemeRecord', () => {
        test('should return the theme marked as default', async () => {
            await createTheme(db, {
                dir_name: 'not-default',
                display_name: 'Not Default',
                is_default: 0,
                is_enabled: 1,
            });
            await createTheme(db, {
                dir_name: 'is-default',
                display_name: 'Is Default',
                is_default: 1,
                is_enabled: 1,
            });

            const defaultTheme = await getDefaultThemeRecord(db);
            expect(defaultTheme).toBeDefined();
            expect(defaultTheme?.dir_name).toBe('is-default');
        });

        test('should return undefined if no default theme', async () => {
            await createTheme(db, {
                dir_name: 'not-default',
                display_name: 'Not Default',
                is_default: 0,
            });

            const defaultTheme = await getDefaultThemeRecord(db);
            expect(defaultTheme).toBeUndefined();
        });
    });

    describe('setDefaultThemeById', () => {
        test('should set a theme as default', async () => {
            const theme1 = await createTheme(db, {
                dir_name: 'theme-1',
                display_name: 'Theme 1',
                is_default: 1,
            });
            const theme2 = await createTheme(db, {
                dir_name: 'theme-2',
                display_name: 'Theme 2',
                is_default: 0,
            });

            // Set theme2 as default
            await setDefaultThemeById(db, theme2.id);

            // Verify theme2 is now default
            const newDefault = await getDefaultThemeRecord(db);
            expect(newDefault?.dir_name).toBe('theme-2');

            // Verify theme1 is no longer default
            const theme1Updated = await findThemeById(db, theme1.id);
            expect(theme1Updated?.is_default).toBe(0);
        });
    });

    describe('clearDefaultTheme', () => {
        test('should clear all default flags', async () => {
            await createTheme(db, {
                dir_name: 'default-theme',
                display_name: 'Default Theme',
                is_default: 1,
            });

            await clearDefaultTheme(db);

            const defaultTheme = await getDefaultThemeRecord(db);
            expect(defaultTheme).toBeUndefined();
        });
    });

    describe('getNextSiteThemeSortOrder', () => {
        test('should return 1 when no site themes exist', async () => {
            // Add a base theme (shouldn't affect site theme sort order)
            await createTheme(db, {
                dir_name: 'base-theme',
                display_name: 'Base Theme',
                is_builtin: 1,
                sort_order: 5,
            });

            const nextOrder = await getNextSiteThemeSortOrder(db);
            expect(nextOrder).toBe(1);
        });

        test('should return max+1 when site themes exist', async () => {
            await createTheme(db, {
                dir_name: 'site-1',
                display_name: 'Site 1',
                is_builtin: 0,
                sort_order: 3,
            });
            await createTheme(db, {
                dir_name: 'site-2',
                display_name: 'Site 2',
                is_builtin: 0,
                sort_order: 7,
            });

            const nextOrder = await getNextSiteThemeSortOrder(db);
            expect(nextOrder).toBe(8);
        });
    });

    describe('getDefaultTheme (from app_settings)', () => {
        test('should return default when no setting exists', async () => {
            const setting = await getDefaultTheme(db);
            expect(setting).toEqual({ type: 'base', dirName: 'base' });
        });

        test('should return stored setting', async () => {
            await setDefaultTheme(db, 'site', 'my-custom-theme');

            const setting = await getDefaultTheme(db);
            expect(setting).toEqual({ type: 'site', dirName: 'my-custom-theme' });
        });
    });

    describe('setDefaultTheme (to app_settings)', () => {
        test('should store default theme setting', async () => {
            await setDefaultTheme(db, 'site', 'custom-theme');

            const setting = await getDefaultTheme(db);
            expect(setting.type).toBe('site');
            expect(setting.dirName).toBe('custom-theme');
        });

        test('should update existing setting', async () => {
            await setDefaultTheme(db, 'base', 'theme-1');
            await setDefaultTheme(db, 'site', 'theme-2');

            const setting = await getDefaultTheme(db);
            expect(setting.type).toBe('site');
            expect(setting.dirName).toBe('theme-2');
        });
    });
});
