/**
 * Configuration Routes Tests
 * Tests for configuration and translation endpoints
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import { configRoutes } from './config';
import { db } from '../db/client';
import { getSetting, setSetting } from '../db/queries/admin';
import { migrateToLatest } from '../db/migrations';

describe('Config Routes', () => {
    const app = configRoutes;

    beforeAll(async () => {
        // Ensure migrations are applied for in-memory test database
        await migrateToLatest(db);
    });

    describe('GET /api/config/upload-limits', () => {
        it('should return upload limits configuration', async () => {
            const response = await app.handle(new Request('http://localhost/api/config/upload-limits'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
            expect(data.maxFileSize).toBeDefined();
            expect(typeof data.maxFileSize).toBe('number');
        });

        it('should return formatted max file size', async () => {
            const response = await app.handle(new Request('http://localhost/api/config/upload-limits'));

            const data = await response.json();
            expect(data.maxFileSizeFormatted).toBeDefined();
            expect(typeof data.maxFileSizeFormatted).toBe('string');
            // Should be in format like "1024.00 MB"
            expect(data.maxFileSizeFormatted).toMatch(/\d+\.\d+ (B|KB|MB|GB|TB)/);
        });

        it('should return allowed MIME types', async () => {
            const response = await app.handle(new Request('http://localhost/api/config/upload-limits'));

            const data = await response.json();
            expect(data.allowedMimeTypes).toBeDefined();
            expect(Array.isArray(data.allowedMimeTypes)).toBe(true);
            expect(data.allowedMimeTypes).toContain('image/*');
            expect(data.allowedMimeTypes).toContain('audio/*');
            expect(data.allowedMimeTypes).toContain('video/*');
        });

        it('should return max upload size', async () => {
            const response = await app.handle(new Request('http://localhost/api/config/upload-limits'));

            const data = await response.json();
            expect(data.maxUploadSize).toBeDefined();
            expect(typeof data.maxUploadSize).toBe('number');
            expect(data.maxUploadSize).toBe(data.maxFileSize);
        });
    });

    describe('GET /api/parameter-management/parameters/data/list', () => {
        it('should return all parameter configurations', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        });

        it('should return user preferences config', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.userPreferencesConfig).toBeDefined();
            expect(data.userPreferencesConfig.locale).toBeDefined();
            expect(data.userPreferencesConfig.theme).toBeDefined();
            expect(data.userPreferencesConfig.defaultAI).toBeDefined();
        });

        it('should return iDevice info fields config', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.ideviceInfoFieldsConfig).toBeDefined();
            expect(data.ideviceInfoFieldsConfig.title).toBeDefined();
            expect(data.ideviceInfoFieldsConfig.description).toBeDefined();
        });

        it('should return theme info and edition fields config', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.themeInfoFieldsConfig).toBeDefined();
            expect(data.themeEditionFieldsConfig).toBeDefined();
        });

        it('should return ODE sync properties configs', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.odeComponentsSyncPropertiesConfig).toBeDefined();
            expect(data.odeNavStructureSyncPropertiesConfig).toBeDefined();
            expect(data.odePagStructureSyncPropertiesConfig).toBeDefined();
            expect(data.odeProjectSyncPropertiesConfig).toBeDefined();
            expect(data.odeProjectSyncCataloguingConfig).toBeDefined();
        });

        it('should return application settings', async () => {
            const prevThemes = await getSetting(db as any, 'ONLINE_THEMES_INSTALL');
            const prevIdevices = await getSetting(db as any, 'ONLINE_IDEVICES_INSTALL');
            const prevAutosaveInterval = await getSetting(db as any, 'PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL');

            await setSetting(db as any, 'ONLINE_THEMES_INSTALL', '0', 'boolean');
            await setSetting(db as any, 'ONLINE_IDEVICES_INSTALL', '0', 'boolean');
            await setSetting(db as any, 'PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL', '600', 'number');

            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.canInstallThemes).toBe(0);
            expect(data.canInstallIdevices).toBe(0);
            expect(data.autosaveOdeFilesFunction).toBe(true);
            expect(data.autosaveIntervalTime).toBe(600);

            if (prevThemes) {
                await setSetting(db as any, 'ONLINE_THEMES_INSTALL', prevThemes.value, prevThemes.type as any);
            } else {
                await db.deleteFrom('app_settings').where('key', '=', 'ONLINE_THEMES_INSTALL').execute();
            }
            if (prevIdevices) {
                await setSetting(db as any, 'ONLINE_IDEVICES_INSTALL', prevIdevices.value, prevIdevices.type as any);
            } else {
                await db.deleteFrom('app_settings').where('key', '=', 'ONLINE_IDEVICES_INSTALL').execute();
            }
            if (prevAutosaveInterval) {
                await setSetting(
                    db as any,
                    'PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL',
                    prevAutosaveInterval.value,
                    prevAutosaveInterval.type as any,
                );
            } else {
                await db
                    .deleteFrom('app_settings')
                    .where('key', '=', 'PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL')
                    .execute();
            }
        });

        it('should return API routes without BASE_PATH prefix when not set', async () => {
            const originalBasePath = process.env.BASE_PATH;
            delete process.env.BASE_PATH;

            try {
                const response = await app.handle(
                    new Request('http://localhost/api/parameter-management/parameters/data/list'),
                );

                const data = await response.json();
                expect(data.routes).toBeDefined();
                expect(typeof data.routes).toBe('object');
                // Check some key routes - should have no prefix
                expect(data.routes.api_auth_login).toBeDefined();
                expect(data.routes.api_auth_login.path).toBe('/api/auth/login');
                expect(data.routes.api_idevices_download_file_resources.path).toBe(
                    '/api/idevices/download-file-resources',
                );
            } finally {
                if (originalBasePath !== undefined) {
                    process.env.BASE_PATH = originalBasePath;
                }
            }
        });

        it('should prefix API routes with BASE_PATH when set', async () => {
            const originalBasePath = process.env.BASE_PATH;
            process.env.BASE_PATH = '/web/exelearning';

            try {
                const response = await app.handle(
                    new Request('http://localhost/api/parameter-management/parameters/data/list'),
                );

                const data = await response.json();
                expect(data.routes).toBeDefined();
                // Check routes have BASE_PATH prefix
                expect(data.routes.api_auth_login.path).toBe('/web/exelearning/api/auth/login');
                expect(data.routes.api_idevices_download_file_resources.path).toBe(
                    '/web/exelearning/api/idevices/download-file-resources',
                );
                expect(data.routes.api_export_html5.path).toBe('/web/exelearning/api/export/html5');
            } finally {
                if (originalBasePath !== undefined) {
                    process.env.BASE_PATH = originalBasePath;
                } else {
                    delete process.env.BASE_PATH;
                }
            }
        });

        it('should prefix API routes with single-level BASE_PATH', async () => {
            const originalBasePath = process.env.BASE_PATH;
            process.env.BASE_PATH = '/exelearning';

            try {
                const response = await app.handle(
                    new Request('http://localhost/api/parameter-management/parameters/data/list'),
                );

                const data = await response.json();
                expect(data.routes.api_auth_login.path).toBe('/exelearning/api/auth/login');
                expect(data.routes.api_idevices_download_file_resources.path).toBe(
                    '/exelearning/api/idevices/download-file-resources',
                );
            } finally {
                if (originalBasePath !== undefined) {
                    process.env.BASE_PATH = originalBasePath;
                } else {
                    delete process.env.BASE_PATH;
                }
            }
        });

        it('should handle BASE_PATH with trailing slash', async () => {
            const originalBasePath = process.env.BASE_PATH;
            process.env.BASE_PATH = '/web/exelearning/';

            try {
                const response = await app.handle(
                    new Request('http://localhost/api/parameter-management/parameters/data/list'),
                );

                const data = await response.json();
                // Trailing slash should be removed
                expect(data.routes.api_auth_login.path).toBe('/web/exelearning/api/auth/login');
            } finally {
                if (originalBasePath !== undefined) {
                    process.env.BASE_PATH = originalBasePath;
                } else {
                    delete process.env.BASE_PATH;
                }
            }
        });

        it('should generate unique item key', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.generateNewItemKey).toBeDefined();
            expect(data.generateNewItemKey).toMatch(/^item_\d+_[a-z0-9]+$/);
        });

        it('should apply translations based on Accept-Language header', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list', {
                    headers: {
                        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    },
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            // Translations should be applied (locale-specific values)
            expect(data.userPreferencesConfig).toBeDefined();
        });

        it('should handle missing Accept-Language header', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.userPreferencesConfig).toBeDefined();
        });
    });

    describe('GET /api/config/parameters', () => {
        it('should return parameters', async () => {
            const response = await app.handle(new Request('http://localhost/api/config/parameters'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        });
    });

    describe('GET /api/config', () => {
        it('should return configuration with upload limits and parameters', async () => {
            const response = await app.handle(new Request('http://localhost/api/config'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.uploadLimits).toBeDefined();
            expect(data.parameters).toBeDefined();
        });

        it('should include upload limits with size and formats', async () => {
            const response = await app.handle(new Request('http://localhost/api/config'));

            const data = await response.json();
            expect(data.uploadLimits).toBeDefined();
        });
    });

    describe('GET /api/translations/:locale', () => {
        it('should return translations for a valid locale', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/en'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locale).toBe('en');
            expect(data.translations).toBeDefined();
            expect(data.count).toBeDefined();
            expect(typeof data.count).toBe('number');
        });

        it('should return translations for Spanish locale', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/es'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locale).toBe('es');
            expect(data.count).toBeGreaterThan(0);
        });

        it('should handle non-existent locale with fallback message', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/xyz'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locale).toBe('xyz');
            expect(data.translations).toBeDefined();
        });
    });

    describe('GET /api/translations/lists', () => {
        it('should return available locales', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/lists'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locales).toBeDefined();
            expect(Array.isArray(data.locales)).toBe(true);
            expect(data.locales).toContain('en');
            expect(data.locales).toContain('es');
        });

        it('should return package locales', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/lists'));

            const data = await response.json();
            expect(data.packageLocales).toBeDefined();
            expect(Array.isArray(data.packageLocales)).toBe(true);
            expect(data.packageLocales.length).toBeGreaterThan(data.locales.length);
        });

        it('should return default locale', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/lists'));

            const data = await response.json();
            expect(data.defaultLocale).toBe('en'); // default (APP_LOCALE or 'en')
        });

        it('should return locale labels', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/lists'));

            const data = await response.json();
            expect(data.localesLabels).toBeDefined();
            expect(data.localesLabels.en).toBe('English');
            expect(data.localesLabels.es).toBe('Español');
            expect(data.packageLocalesLabels).toBeDefined();
        });
    });

    describe('GET /api/translations/detect', () => {
        it('should detect locale from Accept-Language header', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/detect', {
                    headers: {
                        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    },
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.detected).toBe('es');
            expect(data.header).toBe('es-ES,es;q=0.9,en;q=0.8');
            expect(data.available).toBeDefined();
        });

        it('should handle English Accept-Language header', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/detect', {
                    headers: {
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                }),
            );

            const data = await response.json();
            expect(data.detected).toBe('en');
        });

        it('should handle missing Accept-Language header', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/detect'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.detected).toBeDefined();
            expect(data.available).toBeDefined();
        });
    });

    describe('GET /api/translations/translated-params/:locale', () => {
        it('should return translated parameters for English locale', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/translated-params/en'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.userPreferencesConfig).toBeDefined();
            expect(data.ideviceInfoFieldsConfig).toBeDefined();
            expect(data.themeInfoFieldsConfig).toBeDefined();
        });

        it('should return translated parameters for Spanish locale', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/translated-params/es'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.userPreferencesConfig).toBeDefined();
            expect(data.odeComponentsSyncPropertiesConfig).toBeDefined();
            expect(data.odeNavStructureSyncPropertiesConfig).toBeDefined();
            expect(data.odePagStructureSyncPropertiesConfig).toBeDefined();
            expect(data.odeProjectSyncPropertiesConfig).toBeDefined();
            expect(data.odeProjectSyncCataloguingConfig).toBeDefined();
        });

        it('should return all configuration objects', async () => {
            const response = await app.handle(new Request('http://localhost/api/translations/translated-params/en'));

            const data = await response.json();
            const expectedKeys = [
                'userPreferencesConfig',
                'ideviceInfoFieldsConfig',
                'themeInfoFieldsConfig',
                'themeEditionFieldsConfig',
                'odeComponentsSyncPropertiesConfig',
                'odeNavStructureSyncPropertiesConfig',
                'odePagStructureSyncPropertiesConfig',
                'odeProjectSyncPropertiesConfig',
                'odeProjectSyncCataloguingConfig',
            ];

            for (const key of expectedKeys) {
                expect(data[key]).toBeDefined();
            }
        });
    });

    describe('GET /api/templates/:id/download', () => {
        it('should return 400 for invalid template ID', async () => {
            const response = await app.handle(new Request('http://localhost/api/templates/invalid/download'));

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Bad Request');
            expect(data.message).toBe('Invalid template ID');
        });

        it('should return 400 for negative template ID', async () => {
            const response = await app.handle(new Request('http://localhost/api/templates/-1/download'));

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Bad Request');
        });

        it('should return 400 for zero template ID', async () => {
            const response = await app.handle(new Request('http://localhost/api/templates/0/download'));

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error).toBe('Bad Request');
        });

        it('should return 404 for non-existent template', async () => {
            const response = await app.handle(new Request('http://localhost/api/templates/99999/download'));

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Not Found');
            expect(data.message).toBe('Template not found');
        });

        it('should return 404 for disabled template (security)', async () => {
            // Create a disabled template in database
            const now = Date.now();
            await db
                .insertInto('templates')
                .values({
                    filename: 'test-disabled-template',
                    display_name: 'Test Disabled Template',
                    description: 'A disabled template for testing',
                    locale: 'en',
                    is_enabled: 0, // Disabled
                    sort_order: 0,
                    storage_path: 'templates/en/test-disabled-template.elpx',
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            // Get the ID of the just-created template
            const template = await db
                .selectFrom('templates')
                .selectAll()
                .where('filename', '=', 'test-disabled-template')
                .executeTakeFirst();

            expect(template).toBeDefined();

            const response = await app.handle(new Request(`http://localhost/api/templates/${template!.id}/download`));

            // Should return 404 to not reveal the template exists
            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Not Found');
            expect(data.message).toBe('Template not found');

            // Cleanup
            await db.deleteFrom('templates').where('id', '=', template!.id).execute();
        });

        it('should return 404 when template file does not exist on disk', async () => {
            // Create an enabled template but don't create the file
            const now = Date.now();
            await db
                .insertInto('templates')
                .values({
                    filename: 'test-missing-file-template',
                    display_name: 'Test Missing File Template',
                    description: 'A template with missing file for testing',
                    locale: 'en',
                    is_enabled: 1, // Enabled
                    sort_order: 0,
                    storage_path: 'templates/en/test-missing-file-template.elpx',
                    created_at: now,
                    updated_at: now,
                })
                .execute();

            // Get the ID
            const template = await db
                .selectFrom('templates')
                .selectAll()
                .where('filename', '=', 'test-missing-file-template')
                .executeTakeFirst();

            expect(template).toBeDefined();

            const response = await app.handle(new Request(`http://localhost/api/templates/${template!.id}/download`));

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Not Found');
            expect(data.message).toBe('Template file not found');

            // Cleanup
            await db.deleteFrom('templates').where('id', '=', template!.id).execute();
        });
    });
});
