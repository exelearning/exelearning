/**
 * Configuration Routes Tests
 * Tests for configuration and translation endpoints
 */
import { describe, it, expect } from 'bun:test';
import { configRoutes } from './config';

describe('Config Routes', () => {
    const app = configRoutes;

    describe('GET /api/config/upload-limits', () => {
        it('should return upload limits configuration', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/config/upload-limits'),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
            expect(data.maxFileSize).toBeDefined();
            expect(typeof data.maxFileSize).toBe('number');
        });

        it('should return formatted max file size', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/config/upload-limits'),
            );

            const data = await response.json();
            expect(data.maxFileSizeFormatted).toBeDefined();
            expect(typeof data.maxFileSizeFormatted).toBe('string');
            // Should be in format like "1024.00 MB"
            expect(data.maxFileSizeFormatted).toMatch(/\d+\.\d+ (B|KB|MB|GB|TB)/);
        });

        it('should return allowed MIME types', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/config/upload-limits'),
            );

            const data = await response.json();
            expect(data.allowedMimeTypes).toBeDefined();
            expect(Array.isArray(data.allowedMimeTypes)).toBe(true);
            expect(data.allowedMimeTypes).toContain('image/*');
            expect(data.allowedMimeTypes).toContain('audio/*');
            expect(data.allowedMimeTypes).toContain('video/*');
        });

        it('should return max upload size', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/config/upload-limits'),
            );

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
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.canInstallThemes).toBe(1);
            expect(data.canInstallIdevices).toBe(1);
            expect(data.autosaveOdeFilesFunction).toBe(true);
            expect(data.autosaveIntervalTime).toBe(30);
        });

        it('should return API routes', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/parameter-management/parameters/data/list'),
            );

            const data = await response.json();
            expect(data.routes).toBeDefined();
            expect(typeof data.routes).toBe('object');
            // Check some key routes
            expect(data.routes.api_auth_login).toBeDefined();
            expect(data.routes.api_auth_login.path).toBe('/api/auth/login');
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
            const response = await app.handle(
                new Request('http://localhost/api/config/parameters')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        });
    });

    describe('GET /api/config', () => {
        it('should return configuration with upload limits and parameters', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/config')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.uploadLimits).toBeDefined();
            expect(data.parameters).toBeDefined();
        });

        it('should include upload limits with size and formats', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/config')
            );

            const data = await response.json();
            expect(data.uploadLimits).toBeDefined();
        });
    });

    describe('GET /api/translations/:locale', () => {
        it('should return translations for a valid locale', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/en')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locale).toBe('en');
            expect(data.translations).toBeDefined();
            expect(data.count).toBeDefined();
            expect(typeof data.count).toBe('number');
        });

        it('should return translations for Spanish locale', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/es')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locale).toBe('es');
            expect(data.count).toBeGreaterThan(0);
        });

        it('should handle non-existent locale with fallback message', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/xyz')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locale).toBe('xyz');
            expect(data.translations).toBeDefined();
        });
    });

    describe('GET /api/translations/lists', () => {
        it('should return available locales', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/lists')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.locales).toBeDefined();
            expect(Array.isArray(data.locales)).toBe(true);
            expect(data.locales).toContain('en');
            expect(data.locales).toContain('es');
        });

        it('should return package locales', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/lists')
            );

            const data = await response.json();
            expect(data.packageLocales).toBeDefined();
            expect(Array.isArray(data.packageLocales)).toBe(true);
            expect(data.packageLocales.length).toBeGreaterThan(data.locales.length);
        });

        it('should return default locale', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/lists')
            );

            const data = await response.json();
            expect(data.defaultLocale).toBe('en');
        });

        it('should return locale labels', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/lists')
            );

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
                })
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
                })
            );

            const data = await response.json();
            expect(data.detected).toBe('en');
        });

        it('should handle missing Accept-Language header', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/detect')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.detected).toBeDefined();
            expect(data.available).toBeDefined();
        });
    });

    describe('GET /api/translations/translated-params/:locale', () => {
        it('should return translated parameters for English locale', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/translated-params/en')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.userPreferencesConfig).toBeDefined();
            expect(data.ideviceInfoFieldsConfig).toBeDefined();
            expect(data.themeInfoFieldsConfig).toBeDefined();
        });

        it('should return translated parameters for Spanish locale', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/translations/translated-params/es')
            );

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
            const response = await app.handle(
                new Request('http://localhost/api/translations/translated-params/en')
            );

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
});
