import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerCatalogAdapter } from './ServerCatalogAdapter.js';

describe('ServerCatalogAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
        };

        mockEndpoints = {
            api_idevices_installed: { path: '/api/idevices/installed' },
            api_themes_installed: { path: '/api/themes/installed' },
            api_locales: { path: '/api/locales' },
            api_translations: { path: '/api/translations/{locale}' },
            api_licenses: { path: '/api/licenses' },
            api_export_formats: { path: '/api/export/formats' },
            api_idevices_html_template_get: { path: '/api/idevices/{odeComponentsSyncId}/template' },
            api_themes_new: { path: '/api/themes/new' },
            api_themes_edit: { path: '/api/themes/{themeId}' },
            api_idevices_html_view_get: { path: '/api/idevices/{odeComponentsSyncId}/htmlview' },
            api_games_session_idevices: { path: '/api/games/session/{odeSessionId}/idevices' },
        };

        adapter = new ServerCatalogAdapter(mockHttpClient, mockEndpoints);

        // Mock window.eXeLearning for methods that use it
        window.eXeLearning = {
            config: {
                basePath: '',
                baseURL: 'http://localhost:8083',
                changelogURL: '/CHANGELOG.md',
            },
            version: 'v1.0.0',
        };
    });

    describe('constructor', () => {
        it('should store http client and endpoints', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.endpoints).toBe(mockEndpoints);
        });

        it('should default to empty endpoints if not provided', () => {
            const adapterWithoutEndpoints = new ServerCatalogAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('api_idevices_installed')).toBe('/api/idevices/installed');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('getIDevices', () => {
        it('should call http.get with correct URL', async () => {
            const mockIdevices = [{ id: '1', name: 'text' }];
            mockHttpClient.get.mockResolvedValue(mockIdevices);

            const result = await adapter.getIDevices();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/idevices/installed');
            expect(result).toEqual(mockIdevices);
        });

        it('should return empty array if endpoint not found', async () => {
            const adapterWithoutEndpoints = new ServerCatalogAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.getIDevices();

            expect(result).toEqual([]);
        });
    });

    describe('getThemes', () => {
        it('should call http.get with correct URL', async () => {
            const mockThemes = { themes: [{ name: 'base' }] };
            mockHttpClient.get.mockResolvedValue(mockThemes);

            const result = await adapter.getThemes();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/themes/installed');
            expect(result).toEqual(mockThemes);
        });

        it('should return empty array if endpoint not found', async () => {
            const adapterWithoutEndpoints = new ServerCatalogAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.getThemes();

            expect(result).toEqual([]);
        });
    });

    describe('getLocales', () => {
        it('should call http.get with endpoint URL', async () => {
            const mockLocales = ['en', 'es'];
            mockHttpClient.get.mockResolvedValue(mockLocales);

            const result = await adapter.getLocales();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/locales');
            expect(result).toEqual(mockLocales);
        });

        it('should fallback to constructed URL if endpoint not found', async () => {
            const adapterWithoutEndpoints = new ServerCatalogAdapter(mockHttpClient, {});
            mockHttpClient.get.mockResolvedValue(['en']);

            await adapterWithoutEndpoints.getLocales();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/locales');
        });
    });

    describe('getTranslations', () => {
        it('should replace locale placeholder in URL', async () => {
            const mockTranslations = { 'Hello': 'Hola' };
            mockHttpClient.get.mockResolvedValue(mockTranslations);

            const result = await adapter.getTranslations('es');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/translations/es');
            expect(result).toEqual(mockTranslations);
        });

        it('should fallback to constructed URL if endpoint not found', async () => {
            const adapterWithoutEndpoints = new ServerCatalogAdapter(mockHttpClient, {});
            mockHttpClient.get.mockResolvedValue({});

            await adapterWithoutEndpoints.getTranslations('fr');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/translations/fr');
        });
    });

    describe('getIDevice', () => {
        it('should find iDevice by id', async () => {
            const mockIdevices = [
                { id: '1', name: 'text' },
                { id: '2', name: 'quiz' },
            ];
            mockHttpClient.get.mockResolvedValue(mockIdevices);

            const result = await adapter.getIDevice('1');

            expect(result).toEqual({ id: '1', name: 'text' });
        });

        it('should find iDevice by name', async () => {
            const mockIdevices = [
                { id: '1', name: 'text' },
                { id: '2', name: 'quiz' },
            ];
            mockHttpClient.get.mockResolvedValue(mockIdevices);

            const result = await adapter.getIDevice('quiz');

            expect(result).toEqual({ id: '2', name: 'quiz' });
        });

        it('should return null if not found', async () => {
            mockHttpClient.get.mockResolvedValue([]);

            const result = await adapter.getIDevice('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('getTheme', () => {
        it('should find theme by id', async () => {
            const mockThemes = [
                { id: 'base', name: 'base' },
                { id: 'flux', name: 'flux' },
            ];
            mockHttpClient.get.mockResolvedValue(mockThemes);

            const result = await adapter.getTheme('base');

            expect(result).toEqual({ id: 'base', name: 'base' });
        });

        it('should return null if not found', async () => {
            mockHttpClient.get.mockResolvedValue([]);

            const result = await adapter.getTheme('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('getLicenses', () => {
        it('should call http.get with endpoint URL', async () => {
            const mockLicenses = [{ id: 'cc-by' }];
            mockHttpClient.get.mockResolvedValue(mockLicenses);

            const result = await adapter.getLicenses();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/licenses');
            expect(result).toEqual(mockLicenses);
        });

        it('should fallback to constructed URL', async () => {
            const adapterWithoutEndpoints = new ServerCatalogAdapter(mockHttpClient, {});
            mockHttpClient.get.mockResolvedValue([]);

            await adapterWithoutEndpoints.getLicenses();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/licenses');
        });
    });

    describe('getExportFormats', () => {
        it('should call http.get with endpoint URL', async () => {
            const mockFormats = ['html5', 'scorm12'];
            mockHttpClient.get.mockResolvedValue(mockFormats);

            const result = await adapter.getExportFormats();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/export/formats');
            expect(result).toEqual(mockFormats);
        });
    });

    describe('getApiParameters', () => {
        it('should call http.get with correct URL', async () => {
            const mockParams = { routes: {} };
            mockHttpClient.get.mockResolvedValue(mockParams);

            const result = await adapter.getApiParameters();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/parameter-management/parameters/data/list');
            expect(result).toEqual(mockParams);
        });
    });

    describe('getUploadLimits', () => {
        it('should call http.get with correct URL', async () => {
            const mockLimits = { maxFileSize: 1000000 };
            mockHttpClient.get.mockResolvedValue(mockLimits);

            const result = await adapter.getUploadLimits();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/config/upload-limits');
            expect(result).toEqual(mockLimits);
        });
    });

    describe('getTemplates', () => {
        it('should call http.get with locale param', async () => {
            const mockTemplates = [{ id: 'blank' }];
            mockHttpClient.get.mockResolvedValue(mockTemplates);

            const result = await adapter.getTemplates('es');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/templates?locale=es');
            expect(result).toEqual(mockTemplates);
        });
    });

    describe('getComponentHtmlTemplate', () => {
        it('should replace component ID in URL', async () => {
            const mockTemplate = { htmlTemplate: '<div></div>' };
            mockHttpClient.get.mockResolvedValue(mockTemplate);

            const result = await adapter.getComponentHtmlTemplate('comp-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/idevices/comp-123/template');
            expect(result).toEqual(mockTemplate);
        });
    });

    describe('createTheme', () => {
        it('should call http.post with correct URL and params', async () => {
            const params = { name: 'newtheme' };
            mockHttpClient.post.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.createTheme(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/themes/new', params);
            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('updateTheme', () => {
        it('should replace theme ID in URL', async () => {
            const params = { name: 'updated' };
            mockHttpClient.put.mockResolvedValue({ responseMessage: 'OK' });

            const result = await adapter.updateTheme('mytheme', params);

            expect(mockHttpClient.put).toHaveBeenCalledWith('/api/themes/mytheme', params);
            expect(result).toEqual({ responseMessage: 'OK' });
        });
    });

    describe('getSaveHtmlView', () => {
        it('should replace component ID in URL', async () => {
            const mockView = { htmlView: '<div>content</div>' };
            mockHttpClient.get.mockResolvedValue(mockView);

            const result = await adapter.getSaveHtmlView('comp-456');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/idevices/comp-456/htmlview');
            expect(result).toEqual(mockView);
        });
    });

    describe('getIdevicesBySessionId', () => {
        it('should replace session ID in URL', async () => {
            const mockIdevices = { idevices: [] };
            mockHttpClient.get.mockResolvedValue(mockIdevices);

            const result = await adapter.getIdevicesBySessionId('session-789');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/games/session/session-789/idevices');
            expect(result).toEqual(mockIdevices);
        });
    });
});
