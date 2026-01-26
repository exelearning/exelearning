/**
 * Tests for Translation (XLF) Parser
 */
import { describe, it, expect } from 'bun:test';
import {
    parseXlfContent,
    parseXlfFile,
    loadLocaleTranslations,
    loadAllTranslations,
    mergeTranslations,
    type TranslationFileSystemReader,
} from './translation-parser';

describe('translation-parser', () => {
    // Mock file system for testing
    const createMockFs = (files: Record<string, string> = {}): TranslationFileSystemReader => ({
        existsSync: (path: string) => path in files,
        readFileSync: (path: string, _encoding: 'utf-8') => files[path] || '',
    });

    // Mock path utilities
    const mockPath = {
        join: (...paths: string[]) => paths.filter(Boolean).join('/'),
    };

    describe('parseXlfContent', () => {
        it('should parse XLF with multiple translations', () => {
            const xlfContent = `<?xml version="1.0" encoding="utf-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
    <file source-language="en" target-language="es">
        <body>
            <trans-unit id="1">
                <source>Hello</source>
                <target>Hola</target>
            </trans-unit>
            <trans-unit id="2">
                <source>Goodbye</source>
                <target>Adiós</target>
            </trans-unit>
            <trans-unit id="3">
                <source>Thank you</source>
                <target>Gracias</target>
            </trans-unit>
        </body>
    </file>
</xliff>`;

            const translations = parseXlfContent(xlfContent);

            expect(translations).toEqual({
                Hello: 'Hola',
                Goodbye: 'Adiós',
                'Thank you': 'Gracias',
            });
        });

        it('should parse XLF with single translation', () => {
            const xlfContent = `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Save</source>
                <target>Guardar</target>
            </trans-unit>
        </body>
    </file>
</xliff>`;

            const translations = parseXlfContent(xlfContent);

            expect(translations).toEqual({
                Save: 'Guardar',
            });
        });

        it('should return empty object for empty XLF', () => {
            const xlfContent = `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
        </body>
    </file>
</xliff>`;

            const translations = parseXlfContent(xlfContent);

            expect(translations).toEqual({});
        });

        it('should skip translations without source or target', () => {
            const xlfContent = `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Complete</source>
                <target>Completo</target>
            </trans-unit>
            <trans-unit id="2">
                <source>No Target</source>
            </trans-unit>
            <trans-unit id="3">
                <target>No Source</target>
            </trans-unit>
        </body>
    </file>
</xliff>`;

            const translations = parseXlfContent(xlfContent);

            expect(translations).toEqual({
                Complete: 'Completo',
            });
        });

        it('should return empty object for invalid XML', () => {
            const xlfContent = 'not valid xml';

            const translations = parseXlfContent(xlfContent);

            expect(translations).toEqual({});
        });

        it('should return empty object for malformed XLF structure', () => {
            const xlfContent = `<?xml version="1.0"?>
<root>
    <item>something</item>
</root>`;

            const translations = parseXlfContent(xlfContent);

            expect(translations).toEqual({});
        });

        it('should handle translations with special characters', () => {
            const xlfContent = `<?xml version="1.0" encoding="utf-8"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Save &amp; Continue</source>
                <target>Guardar y Continuar</target>
            </trans-unit>
            <trans-unit id="2">
                <source>"Quoted"</source>
                <target>"Citado"</target>
            </trans-unit>
        </body>
    </file>
</xliff>`;

            const translations = parseXlfContent(xlfContent);

            expect(translations['Save & Continue']).toBe('Guardar y Continuar');
            expect(translations['"Quoted"']).toBe('"Citado"');
        });
    });

    describe('parseXlfFile', () => {
        it('should read and parse XLF file', () => {
            const mockFs = createMockFs({
                '/translations/messages.es.xlf': `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Hello</source>
                <target>Hola</target>
            </trans-unit>
        </body>
    </file>
</xliff>`,
            });

            const translations = parseXlfFile('/translations/messages.es.xlf', mockFs);

            expect(translations).toEqual({
                Hello: 'Hola',
            });
        });

        it('should return empty object for non-existent file', () => {
            const mockFs = createMockFs({});

            // Suppress console.warn for this test
            const originalWarn = console.warn;
            console.warn = () => {};

            const translations = parseXlfFile('/translations/missing.xlf', mockFs);

            console.warn = originalWarn;

            expect(translations).toEqual({});
        });
    });

    describe('loadLocaleTranslations', () => {
        it('should load translations for a specific locale', () => {
            const mockFs = createMockFs({
                '/translations/messages.fr.xlf': `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Yes</source>
                <target>Oui</target>
            </trans-unit>
            <trans-unit id="2">
                <source>No</source>
                <target>Non</target>
            </trans-unit>
        </body>
    </file>
</xliff>`,
            });

            const result = loadLocaleTranslations('fr', '/translations', mockFs, mockPath);

            expect(result.locale).toBe('fr');
            expect(result.count).toBe(2);
            expect(result.translations).toEqual({
                Yes: 'Oui',
                No: 'Non',
            });
        });

        it('should return empty result for missing locale', () => {
            const mockFs = createMockFs({});

            // Suppress console.warn for this test
            const originalWarn = console.warn;
            console.warn = () => {};

            const result = loadLocaleTranslations('missing', '/translations', mockFs, mockPath);

            console.warn = originalWarn;

            expect(result.locale).toBe('missing');
            expect(result.count).toBe(0);
            expect(result.translations).toEqual({});
        });
    });

    describe('loadAllTranslations', () => {
        it('should load translations for multiple locales', () => {
            const mockFs = createMockFs({
                '/translations/messages.en.xlf': `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Hello</source>
                <target>Hello</target>
            </trans-unit>
        </body>
    </file>
</xliff>`,
                '/translations/messages.es.xlf': `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Hello</source>
                <target>Hola</target>
            </trans-unit>
        </body>
    </file>
</xliff>`,
                '/translations/messages.fr.xlf': `<?xml version="1.0"?>
<xliff version="1.2">
    <file>
        <body>
            <trans-unit id="1">
                <source>Hello</source>
                <target>Bonjour</target>
            </trans-unit>
        </body>
    </file>
</xliff>`,
            });

            const result = loadAllTranslations(['en', 'es', 'fr'], '/translations', mockFs, mockPath);

            expect(Object.keys(result)).toEqual(['en', 'es', 'fr']);
            expect(result.en.translations.Hello).toBe('Hello');
            expect(result.es.translations.Hello).toBe('Hola');
            expect(result.fr.translations.Hello).toBe('Bonjour');
        });
    });

    describe('mergeTranslations', () => {
        it('should merge multiple translation maps', () => {
            const map1 = { Hello: 'Hola', Goodbye: 'Adiós' };
            const map2 = { 'Thank you': 'Gracias' };
            const map3 = { Yes: 'Sí', No: 'No' };

            const merged = mergeTranslations(map1, map2, map3);

            expect(merged).toEqual({
                Hello: 'Hola',
                Goodbye: 'Adiós',
                'Thank you': 'Gracias',
                Yes: 'Sí',
                No: 'No',
            });
        });

        it('should override earlier values with later ones', () => {
            const map1 = { Hello: 'Hola', Goodbye: 'Adiós' };
            const map2 = { Hello: 'Saludos' }; // Override

            const merged = mergeTranslations(map1, map2);

            expect(merged.Hello).toBe('Saludos');
            expect(merged.Goodbye).toBe('Adiós');
        });

        it('should handle empty maps', () => {
            const map1 = { Hello: 'Hola' };
            const map2 = {};
            const map3 = { Goodbye: 'Adiós' };

            const merged = mergeTranslations(map1, map2, map3);

            expect(merged).toEqual({
                Hello: 'Hola',
                Goodbye: 'Adiós',
            });
        });

        it('should return empty object for no inputs', () => {
            const merged = mergeTranslations();

            expect(merged).toEqual({});
        });
    });
});
