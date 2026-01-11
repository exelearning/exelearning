import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StaticCatalogAdapter } from './StaticCatalogAdapter.js';

describe('StaticCatalogAdapter', () => {
    let adapter;
    let mockBundleData;
    let mockDataProvider;

    beforeEach(() => {
        mockBundleData = {
            idevices: [
                { id: 'text', name: 'text', displayName: 'Free Text' },
                { id: 'quiz', name: 'quiz', displayName: 'Quiz' },
            ],
            themes: [
                { id: 'base', name: 'base', displayName: 'Base Theme' },
                { id: 'flux', name: 'flux', displayName: 'Flux Theme' },
            ],
            locales: [
                { code: 'en', name: 'English' },
                { code: 'es', name: 'Spanish' },
            ],
            licenses: [
                { id: 'cc-by', name: 'CC BY 4.0' },
            ],
            translations: {
                en: { 'Hello': 'Hello' },
                es: { 'Hello': 'Hola' },
            },
            apiParameters: {
                routes: { test: '/api/test' },
            },
        };

        mockDataProvider = {
            getInstalledIdevices: vi.fn(),
            getInstalledThemes: vi.fn(),
            getApiParameters: vi.fn(),
            getUploadLimits: vi.fn(),
        };

        adapter = new StaticCatalogAdapter(mockBundleData, mockDataProvider);

        // Mock fetch
        global.fetch = vi.fn();
    });

    describe('constructor', () => {
        it('should store bundle data and dataProvider', () => {
            expect(adapter.bundle).toBe(mockBundleData);
            expect(adapter.dataProvider).toBe(mockDataProvider);
        });

        it('should initialize cache', () => {
            expect(adapter._cache).toBeInstanceOf(Map);
            expect(adapter._cache.size).toBe(0);
        });

        it('should default to empty bundle if not provided', () => {
            const adapterWithoutBundle = new StaticCatalogAdapter();
            expect(adapterWithoutBundle.bundle).toEqual({});
        });
    });

    describe('_getData', () => {
        it('should return cached data if available', async () => {
            adapter._cache.set('testKey', 'cachedValue');
            const result = await adapter._getData('testKey');
            expect(result).toBe('cachedValue');
        });

        it('should return bundle data and cache it', async () => {
            const result = await adapter._getData('idevices');
            expect(result).toEqual(mockBundleData.idevices);
            expect(adapter._cache.get('idevices')).toEqual(mockBundleData.idevices);
        });

        it('should return fallback if not in bundle or dataProvider', async () => {
            const result = await adapter._getData('nonexistent', 'fallbackValue');
            expect(result).toBe('fallbackValue');
        });
    });

    describe('getIDevices', () => {
        it('should return idevices from bundle', async () => {
            const result = await adapter.getIDevices();
            expect(result).toEqual(mockBundleData.idevices);
        });

        it('should fallback to dataProvider if not in bundle', async () => {
            const adapterWithoutBundle = new StaticCatalogAdapter({}, mockDataProvider);
            mockDataProvider.getInstalledIdevices.mockResolvedValue([{ id: 'fromProvider' }]);

            const result = await adapterWithoutBundle.getIDevices();

            expect(mockDataProvider.getInstalledIdevices).toHaveBeenCalled();
            expect(result).toEqual([{ id: 'fromProvider' }]);
        });

        it('should return empty array if no data available', async () => {
            const adapterWithoutData = new StaticCatalogAdapter();
            const result = await adapterWithoutData.getIDevices();
            expect(result).toEqual([]);
        });
    });

    describe('getThemes', () => {
        it('should return themes from bundle', async () => {
            const result = await adapter.getThemes();
            expect(result).toEqual(mockBundleData.themes);
        });

        it('should fallback to dataProvider if not in bundle', async () => {
            const adapterWithoutBundle = new StaticCatalogAdapter({}, mockDataProvider);
            mockDataProvider.getInstalledThemes.mockResolvedValue([{ id: 'themeFromProvider' }]);

            const result = await adapterWithoutBundle.getThemes();

            expect(mockDataProvider.getInstalledThemes).toHaveBeenCalled();
            expect(result).toEqual([{ id: 'themeFromProvider' }]);
        });

        it('should return empty array if no data available', async () => {
            const adapterWithoutData = new StaticCatalogAdapter();
            const result = await adapterWithoutData.getThemes();
            expect(result).toEqual([]);
        });
    });

    describe('getLocales', () => {
        it('should return locales from bundle', async () => {
            const result = await adapter.getLocales();
            expect(result).toEqual(mockBundleData.locales);
        });

        it('should return default locales if not in bundle', async () => {
            const adapterWithoutBundle = new StaticCatalogAdapter();
            const result = await adapterWithoutBundle.getLocales();

            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThan(0);
            expect(result.some(l => l.code === 'en')).toBe(true);
        });
    });

    describe('getTranslations', () => {
        it('should return translations from bundle', async () => {
            const result = await adapter.getTranslations('es');
            expect(result).toEqual({ 'Hello': 'Hola' });
        });

        it('should try fetching translations if not in bundle', async () => {
            const adapterWithoutTranslations = new StaticCatalogAdapter({});
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ 'Test': 'Prueba' }),
            });

            const result = await adapterWithoutTranslations.getTranslations('es');

            expect(global.fetch).toHaveBeenCalledWith('./translations/es.json');
            expect(result).toEqual({ 'Test': 'Prueba' });
        });

        it('should return empty object if fetch fails', async () => {
            const adapterWithoutTranslations = new StaticCatalogAdapter({});
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await adapterWithoutTranslations.getTranslations('fr');

            expect(result).toEqual({});
        });
    });

    describe('getIDevice', () => {
        it('should find iDevice by id', async () => {
            const result = await adapter.getIDevice('text');
            expect(result).toEqual({ id: 'text', name: 'text', displayName: 'Free Text' });
        });

        it('should find iDevice by name', async () => {
            const result = await adapter.getIDevice('quiz');
            expect(result).toEqual({ id: 'quiz', name: 'quiz', displayName: 'Quiz' });
        });

        it('should return null if not found', async () => {
            const result = await adapter.getIDevice('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('getTheme', () => {
        it('should find theme by id', async () => {
            const result = await adapter.getTheme('base');
            expect(result).toEqual({ id: 'base', name: 'base', displayName: 'Base Theme' });
        });

        it('should return null if not found', async () => {
            const result = await adapter.getTheme('nonexistent');
            expect(result).toBeNull();
        });
    });

    describe('getLicenses', () => {
        it('should return licenses from bundle', async () => {
            const result = await adapter.getLicenses();
            expect(result).toEqual(mockBundleData.licenses);
        });

        it('should return default licenses if not in bundle', async () => {
            const adapterWithoutBundle = new StaticCatalogAdapter();
            const result = await adapterWithoutBundle.getLicenses();

            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThan(0);
            expect(result.some(l => l.id === 'cc-by')).toBe(true);
        });
    });

    describe('getExportFormats', () => {
        it('should return default export formats', async () => {
            const result = await adapter.getExportFormats();

            expect(result).toBeInstanceOf(Array);
            expect(result.some(f => f.id === 'html5')).toBe(true);
            expect(result.some(f => f.id === 'scorm12')).toBe(true);
            expect(result.some(f => f.id === 'epub3')).toBe(true);
        });
    });

    describe('getApiParameters', () => {
        it('should return apiParameters from bundle', async () => {
            const adapterWithoutProvider = new StaticCatalogAdapter(mockBundleData);
            const result = await adapterWithoutProvider.getApiParameters();
            expect(result).toEqual(mockBundleData.apiParameters);
        });

        it('should use dataProvider if available', async () => {
            mockDataProvider.getApiParameters.mockResolvedValue({ routes: { fromProvider: '/test' } });

            const result = await adapter.getApiParameters();

            expect(mockDataProvider.getApiParameters).toHaveBeenCalled();
            expect(result).toEqual({ routes: { fromProvider: '/test' } });
        });
    });

    describe('getUploadLimits', () => {
        it('should return sensible defaults', async () => {
            const adapterWithoutProvider = new StaticCatalogAdapter(mockBundleData);
            const result = await adapterWithoutProvider.getUploadLimits();

            expect(result.maxFileSize).toBe(100 * 1024 * 1024);
            expect(result.maxFileSizeFormatted).toBe('100 MB');
        });

        it('should use dataProvider if available', async () => {
            mockDataProvider.getUploadLimits.mockResolvedValue({ maxFileSize: 50000000 });

            const result = await adapter.getUploadLimits();

            expect(mockDataProvider.getUploadLimits).toHaveBeenCalled();
            expect(result).toEqual({ maxFileSize: 50000000 });
        });
    });

    describe('getTemplates', () => {
        it('should return empty templates in static mode', async () => {
            const result = await adapter.getTemplates('es');
            expect(result).toEqual({ templates: [], locale: 'en' });
        });
    });

    describe('getChangelog', () => {
        it('should fetch local CHANGELOG.md', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('# Changelog\n## v1.0.0'),
            });

            const result = await adapter.getChangelog();

            expect(global.fetch).toHaveBeenCalledWith('./CHANGELOG.md');
            expect(result).toBe('# Changelog\n## v1.0.0');
        });

        it('should return empty string on fetch error', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await adapter.getChangelog();

            expect(result).toBe('');
        });
    });

    describe('getComponentHtmlTemplate', () => {
        it('should return empty template in static mode', async () => {
            const result = await adapter.getComponentHtmlTemplate('comp-123');
            expect(result).toEqual({ responseMessage: 'OK', htmlTemplate: '' });
        });
    });

    describe('createTheme', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.createTheme({ name: 'test' });
            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('updateTheme', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.updateTheme('theme-id', { name: 'updated' });
            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('getSaveHtmlView', () => {
        it('should return empty htmlView in static mode', async () => {
            const result = await adapter.getSaveHtmlView('comp-456');
            expect(result).toEqual({ responseMessage: 'OK', htmlView: '' });
        });
    });

    describe('getIdevicesBySessionId', () => {
        it('should return NOT_SUPPORTED with empty idevices', async () => {
            const result = await adapter.getIdevicesBySessionId('session-789');
            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED', idevices: [] });
        });
    });
});
