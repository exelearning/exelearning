/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServerDataProvider } from './ServerDataProvider.js';

describe('ServerDataProvider', () => {
    let mockFunctions;
    let mockEndpoints;
    let provider;

    beforeEach(() => {
        mockFunctions = {
            get: vi.fn(),
        };

        mockEndpoints = {
            api_languages_installed: { path: '/api/languages' },
            api_themes_installed: { path: '/api/themes' },
            api_idevices_installed: { path: '/api/idevices' },
            api_translations_list_by_locale: { path: '/api/translations/{locale}' },
        };

        provider = new ServerDataProvider(mockFunctions, mockEndpoints);
    });

    describe('getLanguages', () => {
        it('should fetch from API endpoint', async () => {
            const expected = { languages: [{ code: 'en' }, { code: 'es' }] };
            mockFunctions.get.mockResolvedValue(expected);

            const result = await provider.getLanguages();

            expect(mockFunctions.get).toHaveBeenCalledWith('/api/languages');
            expect(result).toEqual(expected);
        });

        it('should return empty array when endpoint not configured', async () => {
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            provider = new ServerDataProvider(mockFunctions, {});

            const result = await provider.getLanguages();

            expect(result).toEqual({ languages: [] });
            expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('api_languages_installed'));
            consoleWarn.mockRestore();
        });
    });

    describe('getThemes', () => {
        it('should fetch from API endpoint', async () => {
            const expected = { themes: [{ name: 'base' }] };
            mockFunctions.get.mockResolvedValue(expected);

            const result = await provider.getThemes();

            expect(mockFunctions.get).toHaveBeenCalledWith('/api/themes');
            expect(result).toEqual(expected);
        });

        it('should return empty array when endpoint not configured', async () => {
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            provider = new ServerDataProvider(mockFunctions, {});

            const result = await provider.getThemes();

            expect(result).toEqual({ themes: [] });
            consoleWarn.mockRestore();
        });
    });

    describe('getIdevices', () => {
        it('should fetch from API endpoint', async () => {
            const expected = { idevices: [{ id: 'text' }] };
            mockFunctions.get.mockResolvedValue(expected);

            const result = await provider.getIdevices();

            expect(mockFunctions.get).toHaveBeenCalledWith('/api/idevices');
            expect(result).toEqual(expected);
        });

        it('should return empty array when endpoint not configured', async () => {
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            provider = new ServerDataProvider(mockFunctions, {});

            const result = await provider.getIdevices();

            expect(result).toEqual({ idevices: [] });
            consoleWarn.mockRestore();
        });
    });

    describe('getParameters', () => {
        it('should fetch from provided URL', async () => {
            const expected = { routes: { test: '/test' } };
            mockFunctions.get.mockResolvedValue(expected);

            const result = await provider.getParameters('/api/params');

            expect(mockFunctions.get).toHaveBeenCalledWith('/api/params');
            expect(result).toEqual(expected);
        });
    });

    describe('getTranslations', () => {
        it('should fetch with locale substitution', async () => {
            const expected = { translations: { hello: 'Hola' } };
            mockFunctions.get.mockResolvedValue(expected);

            const result = await provider.getTranslations('es');

            expect(mockFunctions.get).toHaveBeenCalledWith('/api/translations/es');
            expect(result).toEqual(expected);
        });

        it('should return empty translations when endpoint not configured', async () => {
            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            provider = new ServerDataProvider(mockFunctions, {});

            const result = await provider.getTranslations('en');

            expect(result).toEqual({ translations: {} });
            consoleWarn.mockRestore();
        });
    });

    describe('getUploadLimits', () => {
        it('should fetch from provided URL', async () => {
            const expected = { maxFileSize: 50000000, maxFileSizeFormatted: '50 MB' };
            mockFunctions.get.mockResolvedValue(expected);

            const result = await provider.getUploadLimits('/api/upload-limits');

            expect(mockFunctions.get).toHaveBeenCalledWith('/api/upload-limits');
            expect(result).toEqual(expected);
        });
    });
});
