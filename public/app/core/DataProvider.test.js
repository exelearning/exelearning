import DataProvider from './DataProvider.js';

describe('DataProvider', () => {
    let dataProvider;

    beforeEach(() => {
        // Reset window globals
        delete window.__EXE_STATIC_MODE__;
        delete window.__EXE_STATIC_DATA__;
        delete window.eXeLearning;
        delete window.AppLogger;

        // Mock fetch
        global.fetch = vi.fn();

        // Mock console for logger
        window.AppLogger = {
            log: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete window.__EXE_STATIC_MODE__;
        delete window.__EXE_STATIC_DATA__;
        delete window.eXeLearning;
        delete window.AppLogger;
    });

    describe('constructor', () => {
        it('should default to server mode', () => {
            dataProvider = new DataProvider();
            expect(dataProvider.mode).toBe('server');
            expect(dataProvider.isServerMode()).toBe(true);
            expect(dataProvider.isStaticMode()).toBe(false);
        });

        it('should accept static mode', () => {
            dataProvider = new DataProvider('static');
            expect(dataProvider.mode).toBe('static');
            expect(dataProvider.isStaticMode()).toBe(true);
            expect(dataProvider.isServerMode()).toBe(false);
        });

        it('should accept basePath option', () => {
            dataProvider = new DataProvider('server', { basePath: '/app' });
            expect(dataProvider.basePath).toBe('/app');
        });

        it('should accept staticData option', () => {
            const staticData = { parameters: { routes: { test: '/test' } } };
            dataProvider = new DataProvider('static', { staticData });
            expect(dataProvider.staticData).toBe(staticData);
        });

        it('should initialize empty cache', () => {
            dataProvider = new DataProvider();
            expect(dataProvider.cache.parameters).toBeNull();
            expect(dataProvider.cache.translations).toEqual({});
            expect(dataProvider.cache.idevices).toBeNull();
            expect(dataProvider.cache.themes).toBeNull();
            expect(dataProvider.cache.bundleManifest).toBeNull();
        });

        it('should not be initialized after construction', () => {
            dataProvider = new DataProvider();
            expect(dataProvider.initialized).toBe(false);
        });
    });

    describe('init', () => {
        it('should set initialized flag in server mode', async () => {
            dataProvider = new DataProvider('server');
            await dataProvider.init();
            expect(dataProvider.initialized).toBe(true);
        });

        it('should not reinitialize if already initialized', async () => {
            dataProvider = new DataProvider('static', {
                staticData: { parameters: {} },
            });
            await dataProvider.init();
            dataProvider.staticData = { modified: true };
            await dataProvider.init();
            expect(dataProvider.staticData.modified).toBe(true);
        });

        it('should use constructor-provided static data', async () => {
            const staticData = { parameters: { routes: { custom: true } } };
            dataProvider = new DataProvider('static', { staticData });
            await dataProvider.init();
            expect(dataProvider.staticData).toBe(staticData);
        });

        it('should use window.__EXE_STATIC_DATA__ if available', async () => {
            window.__EXE_STATIC_DATA__ = { parameters: { fromWindow: true } };
            dataProvider = new DataProvider('static');
            await dataProvider.init();
            expect(dataProvider.staticData.parameters.fromWindow).toBe(true);
        });

        it('should fetch bundle.json if no static data provided', async () => {
            const bundleData = { parameters: { fromBundle: true } };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(bundleData),
            });

            dataProvider = new DataProvider('static', { basePath: '/test' });
            await dataProvider.init();

            expect(global.fetch).toHaveBeenCalledWith('/test/data/bundle.json');
            expect(dataProvider.staticData.parameters.fromBundle).toBe(true);
        });

        it('should use empty defaults if bundle.json fetch fails', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            dataProvider = new DataProvider('static');
            await dataProvider.init();

            expect(dataProvider.staticData.parameters).toEqual({ routes: {} });
            expect(dataProvider.staticData.translations).toEqual({ en: { translations: {} } });
            expect(dataProvider.staticData.idevices).toEqual({ idevices: [] });
            expect(dataProvider.staticData.themes).toEqual({ themes: [] });
        });

        it('should use empty defaults if bundle.json returns non-ok response', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            dataProvider = new DataProvider('static');
            await dataProvider.init();

            expect(dataProvider.staticData.parameters).toEqual({ routes: {} });
        });
    });

    describe('getApiParameters', () => {
        it('should return cached parameters if available', async () => {
            dataProvider = new DataProvider('server');
            dataProvider.cache.parameters = { routes: { cached: true } };

            const result = await dataProvider.getApiParameters();

            expect(result.routes.cached).toBe(true);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should return static data in static mode', async () => {
            dataProvider = new DataProvider('static', {
                staticData: { parameters: { routes: { static: true } } },
            });
            await dataProvider.init();

            const result = await dataProvider.getApiParameters();

            expect(result.routes.static).toBe(true);
            expect(dataProvider.cache.parameters).toEqual({ routes: { static: true } });
        });

        it('should fetch from API in server mode', async () => {
            const apiData = { routes: { api: true } };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(apiData),
            });

            dataProvider = new DataProvider('server', { basePath: '/base' });
            const result = await dataProvider.getApiParameters();

            expect(global.fetch).toHaveBeenCalledWith('/base/api/parameter-management/parameters/data/list');
            expect(result.routes.api).toBe(true);
            expect(dataProvider.cache.parameters).toEqual(apiData);
        });

        it('should throw on fetch error in server mode', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            dataProvider = new DataProvider('server');

            await expect(dataProvider.getApiParameters()).rejects.toThrow('HTTP 500');
        });

        it('should return empty routes if static data is missing', async () => {
            dataProvider = new DataProvider('static', { staticData: {} });
            await dataProvider.init();

            const result = await dataProvider.getApiParameters();

            expect(result).toEqual({ routes: {} });
        });
    });

    describe('getTranslations', () => {
        it('should return cached translations if available', async () => {
            dataProvider = new DataProvider('server');
            dataProvider.cache.translations.en = { translations: { cached: 'Cached' } };

            const result = await dataProvider.getTranslations('en');

            expect(result.translations.cached).toBe('Cached');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should return static translations for exact locale', async () => {
            dataProvider = new DataProvider('static', {
                staticData: {
                    translations: {
                        es: { translations: { hello: 'Hola' } },
                    },
                },
            });
            await dataProvider.init();

            const result = await dataProvider.getTranslations('es');

            expect(result.translations.hello).toBe('Hola');
        });

        it('should fallback to base language in static mode', async () => {
            dataProvider = new DataProvider('static', {
                staticData: {
                    translations: {
                        es: { translations: { hello: 'Hola' } },
                    },
                },
            });
            await dataProvider.init();

            const result = await dataProvider.getTranslations('es-MX');

            expect(result.translations.hello).toBe('Hola');
        });

        it('should fallback to English in static mode', async () => {
            dataProvider = new DataProvider('static', {
                staticData: {
                    translations: {
                        en: { translations: { hello: 'Hello' } },
                    },
                },
            });
            await dataProvider.init();

            const result = await dataProvider.getTranslations('fr');

            expect(result.translations.hello).toBe('Hello');
        });

        it('should return empty translations if no fallback available', async () => {
            dataProvider = new DataProvider('static', {
                staticData: { translations: {} },
            });
            await dataProvider.init();

            const result = await dataProvider.getTranslations('fr');

            expect(result).toEqual({ translations: {} });
        });

        it('should fetch from API in server mode', async () => {
            const apiData = { translations: { api: 'From API' } };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(apiData),
            });

            dataProvider = new DataProvider('server', { basePath: '/base' });
            const result = await dataProvider.getTranslations('de');

            expect(global.fetch).toHaveBeenCalledWith('/base/api/translations/de');
            expect(result.translations.api).toBe('From API');
            expect(dataProvider.cache.translations.de).toEqual(apiData);
        });

        it('should return empty translations on fetch error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            dataProvider = new DataProvider('server');
            const result = await dataProvider.getTranslations('en');

            expect(result).toEqual({ translations: {} });
        });
    });

    describe('getInstalledIdevices', () => {
        it('should return cached idevices if available', async () => {
            dataProvider = new DataProvider('server');
            dataProvider.cache.idevices = { idevices: [{ id: 'cached' }] };

            const result = await dataProvider.getInstalledIdevices();

            expect(result.idevices[0].id).toBe('cached');
        });

        it('should return static idevices in static mode', async () => {
            dataProvider = new DataProvider('static', {
                staticData: {
                    idevices: { idevices: [{ id: 'text' }] },
                },
            });
            await dataProvider.init();

            const result = await dataProvider.getInstalledIdevices();

            expect(result.idevices[0].id).toBe('text');
            expect(dataProvider.cache.idevices).toEqual({ idevices: [{ id: 'text' }] });
        });

        it('should return empty list in server mode', async () => {
            dataProvider = new DataProvider('server');

            const result = await dataProvider.getInstalledIdevices();

            expect(result).toEqual({ idevices: [] });
        });

        it('should return empty list if static data missing', async () => {
            dataProvider = new DataProvider('static', { staticData: {} });
            await dataProvider.init();

            const result = await dataProvider.getInstalledIdevices();

            expect(result).toEqual({ idevices: [] });
        });
    });

    describe('getInstalledThemes', () => {
        it('should return cached themes if available', async () => {
            dataProvider = new DataProvider('server');
            dataProvider.cache.themes = { themes: [{ id: 'cached' }] };

            const result = await dataProvider.getInstalledThemes();

            expect(result.themes[0].id).toBe('cached');
        });

        it('should return static themes in static mode', async () => {
            dataProvider = new DataProvider('static', {
                staticData: {
                    themes: { themes: [{ id: 'base' }] },
                },
            });
            await dataProvider.init();

            const result = await dataProvider.getInstalledThemes();

            expect(result.themes[0].id).toBe('base');
            expect(dataProvider.cache.themes).toEqual({ themes: [{ id: 'base' }] });
        });

        it('should return empty list in server mode', async () => {
            dataProvider = new DataProvider('server');

            const result = await dataProvider.getInstalledThemes();

            expect(result).toEqual({ themes: [] });
        });
    });

    describe('getBundleManifest', () => {
        it('should return cached manifest', async () => {
            dataProvider = new DataProvider('server');
            dataProvider.cache.bundleManifest = { version: '1.0' };

            const result = await dataProvider.getBundleManifest();

            expect(result.version).toBe('1.0');
        });

        it('should return static manifest in static mode', async () => {
            dataProvider = new DataProvider('static', {
                staticData: {
                    bundleManifest: { themes: ['base', 'neo'] },
                },
            });
            await dataProvider.init();

            const result = await dataProvider.getBundleManifest();

            expect(result.themes).toContain('base');
        });

        it('should return null in server mode', async () => {
            dataProvider = new DataProvider('server');

            const result = await dataProvider.getBundleManifest();

            expect(result).toBeNull();
        });
    });

    describe('getUploadLimits', () => {
        it('should return default limits in static mode', async () => {
            dataProvider = new DataProvider('static');

            const result = await dataProvider.getUploadLimits();

            expect(result.maxFileSize).toBe(100 * 1024 * 1024);
            expect(result.maxFileSizeFormatted).toBe('100 MB');
            expect(result.limitingFactor).toBe('none');
            expect(result.details.isStatic).toBe(true);
        });

        it('should fetch limits from API in server mode', async () => {
            const apiData = {
                maxFileSize: 50 * 1024 * 1024,
                maxFileSizeFormatted: '50 MB',
                limitingFactor: 'php',
            };
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(apiData),
            });

            dataProvider = new DataProvider('server', { basePath: '/base' });
            const result = await dataProvider.getUploadLimits();

            expect(global.fetch).toHaveBeenCalledWith('/base/api/config/upload-limits');
            expect(result.maxFileSize).toBe(50 * 1024 * 1024);
        });

        it('should return defaults on fetch error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            dataProvider = new DataProvider('server');
            const result = await dataProvider.getUploadLimits();

            expect(result.maxFileSize).toBe(100 * 1024 * 1024);
            expect(result.limitingFactor).toBe('unknown');
        });
    });

    describe('getUserPreferences', () => {
        it('should return default preferences in static mode', async () => {
            // Mock navigator.language
            const originalLanguage = navigator.language;
            Object.defineProperty(navigator, 'language', {
                value: 'es-ES',
                configurable: true,
            });

            dataProvider = new DataProvider('static');

            const result = await dataProvider.getUserPreferences();

            expect(result.locale).toBe('es');
            expect(result.theme).toBe('light');

            // Restore
            Object.defineProperty(navigator, 'language', {
                value: originalLanguage,
                configurable: true,
            });
        });

        it('should return empty object in server mode', async () => {
            dataProvider = new DataProvider('server');

            const result = await dataProvider.getUserPreferences();

            expect(result).toEqual({});
        });

        it('should handle missing navigator.language', async () => {
            const originalLanguage = navigator.language;
            Object.defineProperty(navigator, 'language', {
                value: undefined,
                configurable: true,
            });

            dataProvider = new DataProvider('static');
            const result = await dataProvider.getUserPreferences();

            expect(result.locale).toBe('en');

            Object.defineProperty(navigator, 'language', {
                value: originalLanguage,
                configurable: true,
            });
        });
    });

    describe('clearCache', () => {
        it('should reset all cache values', () => {
            dataProvider = new DataProvider();
            dataProvider.cache.parameters = { some: 'data' };
            dataProvider.cache.translations = { en: { some: 'trans' } };
            dataProvider.cache.idevices = { idevices: [1, 2] };
            dataProvider.cache.themes = { themes: [1] };
            dataProvider.cache.bundleManifest = { manifest: true };

            dataProvider.clearCache();

            expect(dataProvider.cache.parameters).toBeNull();
            expect(dataProvider.cache.translations).toEqual({});
            expect(dataProvider.cache.idevices).toBeNull();
            expect(dataProvider.cache.themes).toBeNull();
            expect(dataProvider.cache.bundleManifest).toBeNull();
        });
    });

    describe('getStaticData', () => {
        it('should return the static data object', () => {
            const staticData = { test: true };
            dataProvider = new DataProvider('static', { staticData });

            expect(dataProvider.getStaticData()).toBe(staticData);
        });

        it('should return null if no static data', () => {
            dataProvider = new DataProvider('server');

            expect(dataProvider.getStaticData()).toBeNull();
        });
    });

    describe('detectMode (static method)', () => {
        beforeEach(() => {
            // Reset all mode indicators
            delete window.__EXE_STATIC_MODE__;
            delete window.eXeLearning;
        });

        it('should return static when __EXE_STATIC_MODE__ is true', () => {
            window.__EXE_STATIC_MODE__ = true;

            expect(DataProvider.detectMode()).toBe('static');
        });

        it('should return static for file:// protocol', () => {
            // Mock location.protocol
            const originalLocation = window.location;
            delete window.location;
            window.location = { protocol: 'file:' };

            expect(DataProvider.detectMode()).toBe('static');

            window.location = originalLocation;
        });

        it('should return static when no fullURL is configured', () => {
            window.eXeLearning = { config: {} };

            expect(DataProvider.detectMode()).toBe('static');
        });

        it('should return server when fullURL is configured', () => {
            window.eXeLearning = { config: { fullURL: 'http://localhost:8080' } };

            expect(DataProvider.detectMode()).toBe('server');
        });

        it('should return server by default', () => {
            window.eXeLearning = { config: { fullURL: 'http://example.com' } };

            expect(DataProvider.detectMode()).toBe('server');
        });

        it('should prioritize __EXE_STATIC_MODE__ over fullURL', () => {
            window.__EXE_STATIC_MODE__ = true;
            window.eXeLearning = { config: { fullURL: 'http://localhost:8080' } };

            expect(DataProvider.detectMode()).toBe('static');
        });
    });

    describe('integration scenarios', () => {
        it('should work correctly in a full static mode flow', async () => {
            window.__EXE_STATIC_MODE__ = true;
            window.__EXE_STATIC_DATA__ = {
                parameters: { routes: { test: '/api/test' } },
                translations: {
                    en: { translations: { hello: 'Hello' } },
                    es: { translations: { hello: 'Hola' } },
                },
                idevices: { idevices: [{ id: 'text', name: 'Free Text' }] },
                themes: { themes: [{ id: 'base', name: 'Base Theme' }] },
                bundleManifest: { version: '3.0' },
            };

            dataProvider = new DataProvider('static');
            await dataProvider.init();

            // Test all getters
            const params = await dataProvider.getApiParameters();
            expect(params.routes.test).toBe('/api/test');

            const transEn = await dataProvider.getTranslations('en');
            expect(transEn.translations.hello).toBe('Hello');

            const transEs = await dataProvider.getTranslations('es');
            expect(transEs.translations.hello).toBe('Hola');

            const idevices = await dataProvider.getInstalledIdevices();
            expect(idevices.idevices[0].name).toBe('Free Text');

            const themes = await dataProvider.getInstalledThemes();
            expect(themes.themes[0].name).toBe('Base Theme');

            const manifest = await dataProvider.getBundleManifest();
            expect(manifest.version).toBe('3.0');

            const limits = await dataProvider.getUploadLimits();
            expect(limits.details.isStatic).toBe(true);

            // Verify fetch was never called
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should work correctly in a full server mode flow', async () => {
            global.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ routes: { api: true } }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ translations: { hello: 'Hello' } }),
                });

            dataProvider = new DataProvider('server');
            await dataProvider.init();

            const params = await dataProvider.getApiParameters();
            expect(params.routes.api).toBe(true);

            const trans = await dataProvider.getTranslations('en');
            expect(trans.translations.hello).toBe('Hello');

            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });
});
