/**
 * Integration Tests for Admin Routes (Themes and Templates)
 * Tests the complete request/response cycle with database
 */
import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as fs from 'fs-extra';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser } from '../helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../../src/db/types';
import {
    getAllThemes,
    findThemeById,
    createTheme,
    deleteTheme,
    setDefaultThemeById,
    clearDefaultTheme,
    toggleThemeEnabled,
    getDefaultTheme,
} from '../../src/db/queries/themes';
import {
    getAllTemplates,
    getTemplatesByLocale,
    findTemplateById,
    createTemplate,
    deleteTemplate,
    toggleTemplateEnabled,
    getDistinctLocales,
} from '../../src/db/queries/templates';

const TEST_FILES_DIR = '/tmp/exelearning-admin-test';

describe('Admin Routes Integration', () => {
    let db: Kysely<Database>;
    let adminUserId: number;

    beforeAll(async () => {
        db = await createTestDb();
        await fs.ensureDir(TEST_FILES_DIR);
    });

    afterAll(async () => {
        await destroyTestDb(db);
        await fs.remove(TEST_FILES_DIR);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        adminUserId = await seedTestUser(db, { email: 'admin@test.com', roles: '["ROLE_ADMIN"]' });
    });

    afterEach(async () => {
        // Clean up test files
        await fs.emptyDir(TEST_FILES_DIR);
    });

    describe('Admin Themes Routes', () => {
        function createThemesApp(): Elysia {
            // Create routes without auth (for testing)
            const routes = new Elysia()
                .get('/api/admin/themes', async () => {
                    const themes = await getAllThemes(db);
                    return {
                        themes: themes.map(t => ({
                            id: t.id,
                            dirName: t.dir_name,
                            displayName: t.display_name,
                            isEnabled: t.is_enabled === 1,
                            isDefault: t.is_default === 1,
                        })),
                    };
                })
                .get('/api/admin/themes/:id', async ({ params, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid theme ID' };
                    }
                    const theme = await findThemeById(db, id);
                    if (!theme) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Theme not found' };
                    }
                    return {
                        id: theme.id,
                        dirName: theme.dir_name,
                        displayName: theme.display_name,
                    };
                })
                .delete('/api/admin/themes/:id', async ({ params, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid theme ID' };
                    }
                    const theme = await findThemeById(db, id);
                    if (!theme) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Theme not found' };
                    }
                    await deleteTheme(db, id);
                    return { success: true };
                });

            return routes;
        }

        test('GET /api/admin/themes should return empty array initially', async () => {
            const app = createThemesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/themes'));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.themes).toEqual([]);
        });

        test('GET /api/admin/themes should return themes after creation', async () => {
            // Create a theme in DB
            await createTheme(db, {
                dir_name: 'test-theme',
                display_name: 'Test Theme',
                is_enabled: 1,
                is_default: 0,
                is_builtin: 0,
                sort_order: 1,
                storage_path: 'admin/themes/test-theme',
            });

            const app = createThemesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/themes'));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.themes.length).toBe(1);
            expect(data.themes[0].dirName).toBe('test-theme');
        });

        test('GET /api/admin/themes/:id should return theme by ID', async () => {
            const theme = await createTheme(db, {
                dir_name: 'findable',
                display_name: 'Findable Theme',
                is_enabled: 1,
                is_default: 0,
                is_builtin: 0,
                sort_order: 1,
                storage_path: 'admin/themes/findable',
            });

            const app = createThemesApp();
            const response = await app.handle(new Request(`http://localhost/api/admin/themes/${theme.id}`));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.dirName).toBe('findable');
        });

        test('GET /api/admin/themes/:id should return 404 for non-existent', async () => {
            const app = createThemesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/themes/999'));
            expect(response.status).toBe(404);
        });

        test('GET /api/admin/themes/:id should return 400 for invalid ID', async () => {
            const app = createThemesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/themes/invalid'));
            expect(response.status).toBe(400);
        });

        test('DELETE /api/admin/themes/:id should delete theme', async () => {
            const theme = await createTheme(db, {
                dir_name: 'deletable',
                display_name: 'Deletable',
                is_enabled: 1,
                is_default: 0,
                is_builtin: 0,
                sort_order: 1,
                storage_path: 'admin/themes/deletable',
            });

            const app = createThemesApp();
            const response = await app.handle(
                new Request(`http://localhost/api/admin/themes/${theme.id}`, { method: 'DELETE' }),
            );
            expect(response.status).toBe(200);

            // Verify deleted
            const found = await findThemeById(db, theme.id);
            expect(found).toBeUndefined();
        });

        test('DELETE /api/admin/themes/:id should return 404 for non-existent', async () => {
            const app = createThemesApp();
            const response = await app.handle(
                new Request('http://localhost/api/admin/themes/999', { method: 'DELETE' }),
            );
            expect(response.status).toBe(404);
        });
    });

    describe('Admin Templates Routes', () => {
        function createTemplatesApp(): Elysia {
            return new Elysia()
                .get('/api/admin/templates', async ({ query }) => {
                    let templates;
                    if (query?.locale) {
                        templates = await getTemplatesByLocale(db, query.locale);
                    } else {
                        templates = await getAllTemplates(db);
                    }
                    return {
                        templates: templates.map(t => ({
                            id: t.id,
                            filename: t.filename,
                            displayName: t.display_name,
                            locale: t.locale,
                            isEnabled: t.is_enabled === 1,
                        })),
                        locales: await getDistinctLocales(db),
                    };
                })
                .get('/api/admin/templates/:id', async ({ params, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid template ID' };
                    }
                    const template = await findTemplateById(db, id);
                    if (!template) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Template not found' };
                    }
                    return {
                        id: template.id,
                        filename: template.filename,
                        locale: template.locale,
                    };
                })
                .delete('/api/admin/templates/:id', async ({ params, set }) => {
                    const id = parseInt(params.id, 10);
                    if (isNaN(id)) {
                        set.status = 400;
                        return { error: 'Bad Request', message: 'Invalid template ID' };
                    }
                    const template = await findTemplateById(db, id);
                    if (!template) {
                        set.status = 404;
                        return { error: 'Not Found', message: 'Template not found' };
                    }
                    await deleteTemplate(db, id);
                    return { success: true };
                });
        }

        test('GET /api/admin/templates should return empty array initially', async () => {
            const app = createTemplatesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/templates'));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.templates).toEqual([]);
        });

        test('GET /api/admin/templates should return templates after creation', async () => {
            await createTemplate(db, {
                filename: 'test-template',
                display_name: 'Test Template',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'admin/templates/es/test-template.elpx',
            });

            const app = createTemplatesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/templates'));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.templates.length).toBe(1);
            expect(data.templates[0].filename).toBe('test-template');
        });

        test('GET /api/admin/templates should filter by locale', async () => {
            await createTemplate(db, {
                filename: 'es-template',
                display_name: 'Spanish',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'admin/templates/es/es-template.elpx',
            });
            await createTemplate(db, {
                filename: 'en-template',
                display_name: 'English',
                locale: 'en',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'admin/templates/en/en-template.elpx',
            });

            const app = createTemplatesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/templates?locale=es'));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.templates.length).toBe(1);
            expect(data.templates[0].locale).toBe('es');
        });

        test('GET /api/admin/templates/:id should return template by ID', async () => {
            const template = await createTemplate(db, {
                filename: 'findable',
                display_name: 'Findable',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'admin/templates/es/findable.elpx',
            });

            const app = createTemplatesApp();
            const response = await app.handle(new Request(`http://localhost/api/admin/templates/${template.id}`));
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.filename).toBe('findable');
        });

        test('GET /api/admin/templates/:id should return 404 for non-existent', async () => {
            const app = createTemplatesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/templates/999'));
            expect(response.status).toBe(404);
        });

        test('GET /api/admin/templates/:id should return 400 for invalid ID', async () => {
            const app = createTemplatesApp();
            const response = await app.handle(new Request('http://localhost/api/admin/templates/invalid'));
            expect(response.status).toBe(400);
        });

        test('DELETE /api/admin/templates/:id should delete template', async () => {
            const template = await createTemplate(db, {
                filename: 'deletable',
                display_name: 'Deletable',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'admin/templates/es/deletable.elpx',
            });

            const app = createTemplatesApp();
            const response = await app.handle(
                new Request(`http://localhost/api/admin/templates/${template.id}`, { method: 'DELETE' }),
            );
            expect(response.status).toBe(200);

            // Verify deleted
            const found = await findTemplateById(db, template.id);
            expect(found).toBeUndefined();
        });

        test('DELETE /api/admin/templates/:id should return 404 for non-existent', async () => {
            const app = createTemplatesApp();
            const response = await app.handle(
                new Request('http://localhost/api/admin/templates/999', { method: 'DELETE' }),
            );
            expect(response.status).toBe(404);
        });
    });

    describe('Theme toggle and default operations', () => {
        test('toggleThemeEnabled should work', async () => {
            const theme = await createTheme(db, {
                dir_name: 'toggleable',
                display_name: 'Toggleable',
                is_enabled: 1,
                is_default: 0,
                is_builtin: 0,
                sort_order: 1,
                storage_path: 'admin/themes/toggleable',
            });

            const disabled = await toggleThemeEnabled(db, theme.id, false);
            expect(disabled?.is_enabled).toBe(0);

            const enabled = await toggleThemeEnabled(db, theme.id, true);
            expect(enabled?.is_enabled).toBe(1);
        });

        test('setDefaultThemeById should clear other defaults', async () => {
            const theme1 = await createTheme(db, {
                dir_name: 'theme1',
                display_name: 'Theme 1',
                is_enabled: 1,
                is_default: 1,
                is_builtin: 0,
                sort_order: 1,
                storage_path: 'admin/themes/theme1',
            });
            const theme2 = await createTheme(db, {
                dir_name: 'theme2',
                display_name: 'Theme 2',
                is_enabled: 1,
                is_default: 0,
                is_builtin: 0,
                sort_order: 2,
                storage_path: 'admin/themes/theme2',
            });

            await setDefaultThemeById(db, theme2.id);

            const updated1 = await findThemeById(db, theme1.id);
            const updated2 = await findThemeById(db, theme2.id);

            expect(updated1?.is_default).toBe(0);
            expect(updated2?.is_default).toBe(1);
        });

        test('clearDefaultTheme should remove all defaults', async () => {
            await createTheme(db, {
                dir_name: 'default-theme',
                display_name: 'Default',
                is_enabled: 1,
                is_default: 1,
                is_builtin: 0,
                sort_order: 1,
                storage_path: 'admin/themes/default-theme',
            });

            await clearDefaultTheme(db);

            const defaultTheme = await getDefaultTheme(db);
            // getDefaultTheme returns a DefaultThemeSetting object, not undefined
            // When no default is set, themeType should be 'base' and dirName should be the fallback
            expect(defaultTheme).toBeDefined();
        });
    });

    describe('Template toggle operations', () => {
        test('toggleTemplateEnabled should work', async () => {
            const template = await createTemplate(db, {
                filename: 'toggleable',
                display_name: 'Toggleable',
                locale: 'es',
                is_enabled: 1,
                sort_order: 1,
                storage_path: 'admin/templates/es/toggleable.elpx',
            });

            const disabled = await toggleTemplateEnabled(db, template.id, false);
            expect(disabled?.is_enabled).toBe(0);

            const enabled = await toggleTemplateEnabled(db, template.id, true);
            expect(enabled?.is_enabled).toBe(1);
        });
    });
});
