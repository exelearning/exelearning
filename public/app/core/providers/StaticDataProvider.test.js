/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    StaticDataProvider,
    applyThemeRegistryOverride,
} from './StaticDataProvider.js';

describe('StaticDataProvider', () => {
    beforeEach(() => {
        // Clean up window.__EXE_STATIC_DATA__ before each test
        delete window.__EXE_STATIC_DATA__;
        delete window.eXeLearning;
    });

    afterEach(() => {
        delete window.__EXE_STATIC_DATA__;
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should create instance with null staticData', () => {
            const provider = new StaticDataProvider();
            expect(provider.staticData).toBeNull();
        });

        it('should create instance with provided staticData', () => {
            const data = { idevices: { idevices: [{ id: 'test' }] } };
            const provider = new StaticDataProvider(data);
            expect(provider.staticData).toBe(data);
        });
    });

    describe('setStaticData', () => {
        it('should update static data', () => {
            const provider = new StaticDataProvider();
            const data = { themes: { themes: [{ name: 'base' }] } };
            provider.setStaticData(data);
            expect(provider.staticData).toBe(data);
        });
    });

    describe('getLanguages', () => {
        it('should return empty array when no data', async () => {
            const provider = new StaticDataProvider();
            const result = await provider.getLanguages();
            expect(result).toEqual({ languages: [] });
        });

        it('should return data from constructor staticData', async () => {
            const provider = new StaticDataProvider({
                languages: { languages: [{ code: 'en' }, { code: 'es' }] }
            });
            const result = await provider.getLanguages();
            expect(result.languages).toHaveLength(2);
        });

        it('should prioritize window.__EXE_STATIC_DATA__', async () => {
            window.__EXE_STATIC_DATA__ = {
                languages: { languages: [{ code: 'fr' }] }
            };
            const provider = new StaticDataProvider({
                languages: { languages: [{ code: 'en' }] }
            });
            const result = await provider.getLanguages();
            expect(result.languages[0].code).toBe('fr');
        });
    });

    describe('getThemes', () => {
        it('should return empty array when no data', async () => {
            const provider = new StaticDataProvider();
            const result = await provider.getThemes();
            expect(result).toEqual({ themes: [] });
        });

        it('should return data from staticData', async () => {
            const provider = new StaticDataProvider({
                themes: { themes: [{ name: 'base' }, { name: 'neo' }] }
            });
            const result = await provider.getThemes();
            expect(result.themes).toHaveLength(2);
        });

        it('should hide built-in themes listed in disabledBuiltins override', async () => {
            window.eXeLearning = {
                config: { themeRegistryOverride: { disabledBuiltins: ['neo'] } },
            };
            const provider = new StaticDataProvider({
                themes: { themes: [{ name: 'base' }, { name: 'neo' }] },
            });
            const result = await provider.getThemes();
            expect(result.themes.map((t) => t.name)).toEqual(['base']);
        });

        it('should append uploaded themes from the override', async () => {
            window.eXeLearning = {
                config: {
                    themeRegistryOverride: {
                        uploaded: [
                            { name: 'acme', title: 'Acme', type: 'uploaded' },
                        ],
                    },
                },
            };
            const provider = new StaticDataProvider({
                themes: { themes: [{ name: 'base' }] },
            });
            const result = await provider.getThemes();
            expect(result.themes.map((t) => t.name)).toEqual(['base', 'acme']);
        });

        it('should let an uploaded theme shadow a built-in on id collision', async () => {
            window.eXeLearning = {
                config: {
                    themeRegistryOverride: {
                        uploaded: [{ name: 'base', title: 'Custom Base' }],
                    },
                },
            };
            const provider = new StaticDataProvider({
                themes: { themes: [{ name: 'base', title: 'Default' }] },
            });
            const result = await provider.getThemes();
            expect(result.themes).toHaveLength(1);
            expect(result.themes[0].title).toBe('Custom Base');
        });

        it('should ignore a malformed override and pass through the payload', async () => {
            window.eXeLearning = {
                config: { themeRegistryOverride: 'not-an-object' },
            };
            const provider = new StaticDataProvider({
                themes: { themes: [{ name: 'base' }] },
            });
            const result = await provider.getThemes();
            expect(result.themes).toHaveLength(1);
        });
    });

    describe('applyThemeRegistryOverride (unit)', () => {
        it('returns the original payload when no override is provided', () => {
            const payload = { themes: [{ name: 'base' }] };
            expect(applyThemeRegistryOverride(payload, null)).toEqual(payload);
        });

        it('copes with a null payload', () => {
            const result = applyThemeRegistryOverride(null, {
                uploaded: [{ name: 'a' }],
            });
            expect(result.themes.map((t) => t.name)).toEqual(['a']);
        });

        it('drops themes present in disabledBuiltins by id or name', () => {
            const payload = {
                themes: [
                    { id: 'a', name: 'alpha' },
                    { id: 'b', name: 'beta' },
                ],
            };
            const result = applyThemeRegistryOverride(payload, {
                disabledBuiltins: ['alpha', 'b'],
            });
            expect(result.themes).toEqual([]);
        });
    });

    describe('getIdevices', () => {
        it('should return empty array when no data', async () => {
            const provider = new StaticDataProvider();
            const result = await provider.getIdevices();
            expect(result).toEqual({ idevices: [] });
        });

        it('should return data from staticData', async () => {
            const provider = new StaticDataProvider({
                idevices: { idevices: [{ id: 'text' }, { id: 'quiz' }] }
            });
            const result = await provider.getIdevices();
            expect(result.idevices).toHaveLength(2);
        });
    });

    describe('getParameters', () => {
        it('should return empty routes when no data', async () => {
            const provider = new StaticDataProvider();
            const result = await provider.getParameters();
            expect(result).toEqual({ routes: {} });
        });

        it('should return data from staticData', async () => {
            const provider = new StaticDataProvider({
                parameters: { routes: { test: '/test' }, userPreferencesConfig: {} }
            });
            const result = await provider.getParameters();
            expect(result.routes.test).toBe('/test');
        });
    });

    describe('getTranslations', () => {
        it('should return empty translations when no data', async () => {
            const provider = new StaticDataProvider();
            const result = await provider.getTranslations('en');
            expect(result).toEqual({ translations: {} });
        });

        it('should return exact locale match', async () => {
            const provider = new StaticDataProvider({
                translations: {
                    en: { translations: { hello: 'Hello' } },
                    es: { translations: { hello: 'Hola' } }
                }
            });
            const result = await provider.getTranslations('es');
            expect(result.translations.hello).toBe('Hola');
        });

        it('should fall back to base language', async () => {
            const provider = new StaticDataProvider({
                translations: {
                    en: { translations: { hello: 'Hello' } }
                }
            });
            const result = await provider.getTranslations('en-US');
            expect(result.translations.hello).toBe('Hello');
        });

        it('should fall back to English when locale not found', async () => {
            const provider = new StaticDataProvider({
                translations: {
                    en: { translations: { hello: 'Hello' } }
                }
            });
            const result = await provider.getTranslations('fr');
            expect(result.translations.hello).toBe('Hello');
        });
    });

    describe('getUploadLimits', () => {
        it('should return static mode defaults', async () => {
            const provider = new StaticDataProvider();
            const result = await provider.getUploadLimits();
            expect(result.maxFileSize).toBe(100 * 1024 * 1024);
            expect(result.maxFileSizeFormatted).toBe('100 MB');
            expect(result.limitingFactor).toBe('none');
            expect(result.details.isStatic).toBe(true);
        });
    });
});
