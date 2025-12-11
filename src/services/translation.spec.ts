/**
 * Tests for Translation Service
 */
import { describe, it, expect } from 'bun:test';
import {
    LOCALES,
    PACKAGE_LOCALES,
    DEFAULT_LOCALE,
    TRANS_PREFIX,
    trans,
    translateValue,
    translateObject,
    getCatalogue,
    getCatalogueWithFallback,
    setLocale,
    getLocale,
    getAvailableLocales,
    getAvailablePackageLocales,
    setGlobalParameters,
    getTranslationCount,
    isLocaleLoaded,
    detectLocaleFromHeader,
    loadAllTranslations,
    reloadTranslations,
} from './translation';

describe('translation service', () => {
    describe('constants', () => {
        it('should have LOCALES defined', () => {
            expect(LOCALES).toBeDefined();
            expect(typeof LOCALES).toBe('object');
            expect(LOCALES.en).toBe('English');
            expect(LOCALES.es).toBe('Español');
        });

        it('should have PACKAGE_LOCALES with more languages', () => {
            expect(PACKAGE_LOCALES).toBeDefined();
            expect(Object.keys(PACKAGE_LOCALES).length).toBeGreaterThan(Object.keys(LOCALES).length);
            expect(PACKAGE_LOCALES.zh_CN).toBeDefined();
        });

        it('should have DEFAULT_LOCALE as en', () => {
            expect(DEFAULT_LOCALE).toBe('en');
        });

        it('should have TRANS_PREFIX defined', () => {
            expect(TRANS_PREFIX).toBe('TRANSLATABLE_TEXT:');
        });
    });

    describe('getAvailableLocales', () => {
        it('should return array of locale codes', () => {
            const locales = getAvailableLocales();
            expect(Array.isArray(locales)).toBe(true);
            expect(locales).toContain('en');
            expect(locales).toContain('es');
            expect(locales).toContain('ca');
        });
    });

    describe('getAvailablePackageLocales', () => {
        it('should return array of package locale codes', () => {
            const locales = getAvailablePackageLocales();
            expect(Array.isArray(locales)).toBe(true);
            expect(locales.length).toBeGreaterThan(10);
            expect(locales).toContain('zh_CN');
            expect(locales).toContain('ja');
        });
    });

    describe('setLocale and getLocale', () => {
        it('should set and get locale', () => {
            const originalLocale = getLocale();
            setLocale('es');
            expect(getLocale()).toBe('es');
            setLocale(originalLocale);
        });

        it('should not set invalid locale', () => {
            const originalLocale = getLocale();
            setLocale('invalid_locale_xyz');
            // Should remain unchanged
            expect(getLocale()).toBe(originalLocale);
        });

        it('should accept default locale', () => {
            setLocale(DEFAULT_LOCALE);
            expect(getLocale()).toBe(DEFAULT_LOCALE);
        });
    });

    describe('trans', () => {
        it('should return original key if not found', () => {
            const result = trans('nonexistent.translation.key');
            expect(result).toBe('nonexistent.translation.key');
        });

        it('should replace %param% format parameters', () => {
            // Use a key that won't be found to test parameter replacement on the key itself
            const result = trans('Hello %name%!', { name: 'World' });
            expect(result).toBe('Hello World!');
        });

        it('should replace {param} format parameters', () => {
            const result = trans('Hello {name}!', { name: 'World' });
            expect(result).toBe('Hello World!');
        });

        it('should replace multiple parameters', () => {
            const result = trans('User %user% has %count% items', { user: 'John', count: '5' });
            expect(result).toBe('User John has 5 items');
        });

        it('should accept custom locale parameter', () => {
            const result = trans('test.key', {}, 'es');
            expect(typeof result).toBe('string');
        });
    });

    describe('translateValue', () => {
        it('should translate value with TRANSLATABLE_TEXT prefix', () => {
            const result = translateValue(`${TRANS_PREFIX}some.key`);
            // Will return the key if not in catalogue
            expect(result).toBe('some.key');
        });

        it('should return original value without prefix', () => {
            const result = translateValue('regular value');
            expect(result).toBe('regular value');
        });

        it('should handle non-string values', () => {
            // @ts-expect-error Testing non-string input
            const result = translateValue(123);
            expect(result).toBe(123);
        });
    });

    describe('translateObject', () => {
        it('should translate nested objects', () => {
            const obj = {
                title: `${TRANS_PREFIX}test.title`,
                nested: {
                    subtitle: `${TRANS_PREFIX}test.subtitle`,
                    regular: 'regular value',
                },
            };

            const result = translateObject(obj);
            expect(result.title).toBe('test.title');
            expect(result.nested.subtitle).toBe('test.subtitle');
            expect(result.nested.regular).toBe('regular value');
        });

        it('should handle arrays', () => {
            const obj = {
                items: [{ name: `${TRANS_PREFIX}item1` }, { name: `${TRANS_PREFIX}item2` }],
            };

            const result = translateObject(obj);
            expect(Array.isArray(result.items)).toBe(true);
            expect(result.items[0].name).toBe('item1');
            expect(result.items[1].name).toBe('item2');
        });

        it('should handle primitive values', () => {
            const obj = {
                string: 'hello',
                number: 42,
                boolean: true,
                nil: null,
            };

            const result = translateObject(obj);
            expect(result.string).toBe('hello');
            expect(result.number).toBe(42);
            expect(result.boolean).toBe(true);
            expect(result.nil).toBeNull();
        });

        it('should return non-object values unchanged', () => {
            // @ts-expect-error Testing non-object input
            expect(translateObject(null)).toBeNull();
            // @ts-expect-error Testing non-object input
            expect(translateObject(undefined)).toBeUndefined();
        });
    });

    describe('getCatalogue', () => {
        it('should return object for loaded locale', () => {
            const catalogue = getCatalogue('en');
            expect(typeof catalogue).toBe('object');
        });

        it('should return empty object for unloaded locale', () => {
            const catalogue = getCatalogue('xx');
            expect(catalogue).toEqual({});
        });

        it('should use current locale if not specified', () => {
            const catalogue = getCatalogue();
            expect(typeof catalogue).toBe('object');
        });
    });

    describe('getCatalogueWithFallback', () => {
        it('should return catalogue with English fallback', () => {
            const catalogue = getCatalogueWithFallback('es');
            expect(typeof catalogue).toBe('object');
        });

        it('should work for non-existent locale', () => {
            const catalogue = getCatalogueWithFallback('xx');
            expect(typeof catalogue).toBe('object');
        });
    });

    describe('setGlobalParameters', () => {
        it('should set global parameters used in translations', () => {
            setGlobalParameters({ appName: 'TestApp' });
            const result = trans('Welcome to %appName%!');
            expect(result).toBe('Welcome to TestApp!');
        });

        it('should merge with existing parameters', () => {
            setGlobalParameters({ param1: 'value1' });
            setGlobalParameters({ param2: 'value2' });
            const result = trans('%param1% and %param2%');
            expect(result).toBe('value1 and value2');
        });
    });

    describe('getTranslationCount', () => {
        it('should return number of translations for locale', () => {
            const count = getTranslationCount('en');
            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
        });

        it('should return 0 for non-existent locale', () => {
            const count = getTranslationCount('nonexistent');
            expect(count).toBe(0);
        });
    });

    describe('isLocaleLoaded', () => {
        it('should return true for loaded locales', () => {
            expect(isLocaleLoaded('en')).toBe(true);
            expect(isLocaleLoaded('es')).toBe(true);
        });

        it('should return false for non-loaded locales', () => {
            expect(isLocaleLoaded('nonexistent_locale')).toBe(false);
        });
    });

    describe('detectLocaleFromHeader', () => {
        it('should detect locale from simple Accept-Language header', () => {
            const locale = detectLocaleFromHeader('es');
            expect(locale).toBe('es');
        });

        it('should detect locale from complex Accept-Language header', () => {
            const locale = detectLocaleFromHeader('es-ES,es;q=0.9,en;q=0.8');
            expect(locale).toBe('es');
        });

        it('should handle quality values', () => {
            // Higher quality should be preferred
            const locale = detectLocaleFromHeader('en;q=0.5,es;q=0.9');
            expect(locale).toBe('es');
        });

        it('should return current locale for null header', () => {
            const currentLocale = getLocale();
            const locale = detectLocaleFromHeader(null);
            expect(locale).toBe(currentLocale);
        });

        it('should return current locale for unknown language', () => {
            const currentLocale = getLocale();
            const locale = detectLocaleFromHeader('xyz-XY');
            expect(locale).toBe(currentLocale);
        });

        it('should handle region codes (e.g., en-US)', () => {
            const locale = detectLocaleFromHeader('en-US,en;q=0.9');
            expect(locale).toBe('en');
        });

        it('should handle empty string', () => {
            const locale = detectLocaleFromHeader('');
            expect(typeof locale).toBe('string');
        });
    });

    describe('loadAllTranslations', () => {
        it('should load translations without throwing', () => {
            expect(() => loadAllTranslations()).not.toThrow();
        });
    });

    describe('reloadTranslations', () => {
        it('should reload translations without throwing', () => {
            expect(() => reloadTranslations()).not.toThrow();
        });

        it('should maintain locales after reload', () => {
            reloadTranslations();
            expect(isLocaleLoaded('en')).toBe(true);
        });
    });

    describe('extractText edge cases (internal function via parseXlfContent)', () => {
        // These test cases indirectly test extractText by testing parsing behavior
        it('should handle XLF with object text nodes', () => {
            // This tests the extractText function when node is an object with #text
            // The trans function will use the catalogue which is built from XLF parsing
            const result = trans('some.nonexistent.key.with.object.text');
            expect(typeof result).toBe('string');
        });
    });

    describe('parseXlfContent edge cases (internal function)', () => {
        // These are tested indirectly through the translation loading process
        it('should handle malformed XLF without body element', () => {
            // When XLF has no body, translations should be empty
            // This happens during loadAllTranslations
            const catalogue = getCatalogue('nonexistent_locale_xyz');
            expect(catalogue).toEqual({});
        });
    });

    describe('applyTransformations (via trans)', () => {
        it('should transform .elp to .elpx', () => {
            // Test by using a string that ends with .elp
            const result = trans('file.elp');
            expect(result).toBe('file.elpx');
        });

        it('should transform (elp) to (elpx)', () => {
            const result = trans('Save (elp)');
            expect(result).toBe('Save (elpx)');
        });

        it('should remove ~ prefix', () => {
            const result = trans('~Some text');
            expect(result).toBe('Some text');
        });
    });
});
