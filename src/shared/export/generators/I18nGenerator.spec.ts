/**
 * I18nGenerator tests
 */

import { describe, it, expect } from 'bun:test';
import { parseXlfTranslations, generateI18nScript } from './I18nGenerator';

// Minimal XLIFF 1.2 fixture with a handful of Spanish translations
const SAMPLE_ES_XLF = `<?xml version="1.0" encoding="utf-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" version="1.2">
  <file source-language="en" target-language="es" datatype="plaintext" original="file.ext">
    <body>
      <trans-unit id="1" resname="Previous">
        <source>Previous</source>
        <target>Anterior</target>
      </trans-unit>
      <trans-unit id="2" resname="Next">
        <source>Next</source>
        <target>Siguiente</target>
      </trans-unit>
      <trans-unit id="3" resname="Menu">
        <source>Menu</source>
        <target>Menú</target>
      </trans-unit>
      <trans-unit id="4" resname="Toggle content">
        <source>Toggle content</source>
        <target>Ocultar/Mostrar contenido</target>
      </trans-unit>
      <trans-unit id="5" resname="block">
        <source>block</source>
        <target>bloque</target>
      </trans-unit>
      <trans-unit id="6" resname="abcdefghijklmnopqrstuvwxyz">
        <source>abcdefghijklmnopqrstuvwxyz</source>
        <target>abcdefghijklmnñopqrstuvwxyz</target>
      </trans-unit>
      <trans-unit id="7" resname="Reload game?">
        <source>Reload game?</source>
        <target>¿Recargar el juego?</target>
      </trans-unit>
      <trans-unit id="8" resname="Entities &amp; test">
        <source>Entities &amp; test</source>
        <target>Entidades &amp; prueba</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

// Minimal common_i18n.js template
const SAMPLE_TEMPLATE = `// The content of this file should be generated dynamically in the .elpx's language.
$exe_i18n = {
    "previous": c_("Previous"),
    "next": c_("Next"),
    "menu": c_("Menu"),
    "toggleContent": c_("Toggle content"),
    "block": c_("block")
};
$exe_i18n.exeGames = {
    "confirmReload": c_("Reload game?"),
    "az": c_("abcdefghijklmnopqrstuvwxyz")
};

// Export for Node.js/CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = $exe_i18n;
}`;

describe('parseXlfTranslations', () => {
    it('should parse source→target pairs from a valid XLF file', () => {
        const map = parseXlfTranslations(SAMPLE_ES_XLF);

        expect(map.get('Previous')).toBe('Anterior');
        expect(map.get('Next')).toBe('Siguiente');
        expect(map.get('Menu')).toBe('Menú');
        expect(map.get('Toggle content')).toBe('Ocultar/Mostrar contenido');
    });

    it('should decode XML entities in source and target', () => {
        const map = parseXlfTranslations(SAMPLE_ES_XLF);
        expect(map.get('Entities & test')).toBe('Entidades & prueba');
    });

    it('should return an empty Map for an empty XLF string', () => {
        const map = parseXlfTranslations('');
        expect(map.size).toBe(0);
    });

    it('should skip trans-unit elements without a <target>', () => {
        const xlfWithMissing = `<xliff>
  <body>
    <trans-unit id="1"><source>Hello</source></trans-unit>
    <trans-unit id="2"><source>World</source><target>Mundo</target></trans-unit>
  </body>
</xliff>`;
        const map = parseXlfTranslations(xlfWithMissing);
        expect(map.has('Hello')).toBe(false);
        expect(map.get('World')).toBe('Mundo');
    });

    it('should handle multiline source and target values', () => {
        const xlf = `<xliff>
  <body>
    <trans-unit id="1">
      <source>Line one</source>
      <target>Línea uno</target>
    </trans-unit>
  </body>
</xliff>`;
        const map = parseXlfTranslations(xlf);
        expect(map.get('Line one')).toBe('Línea uno');
    });
});

describe('generateI18nScript', () => {
    it('should replace c_("…") calls with Spanish translations', () => {
        const translations = parseXlfTranslations(SAMPLE_ES_XLF);
        const script = generateI18nScript(SAMPLE_TEMPLATE, translations);

        // The template has spaces around the value: "previous": c_("Previous"),
        // so the output retains the spacing: "previous": "Anterior",
        expect(script).toContain('"previous": "Anterior"');
        expect(script).toContain('"next": "Siguiente"');
        expect(script).toContain('"menu": "Menú"');
        expect(script).toContain('"toggleContent": "Ocultar/Mostrar contenido"');
    });

    it('should fall back to English source string for missing translations', () => {
        // Empty translations map → all values are the English source strings
        const script = generateI18nScript(SAMPLE_TEMPLATE, new Map());

        expect(script).toContain('"previous": "Previous"');
        expect(script).toContain('"next": "Next"');
        expect(script).toContain('"menu": "Menu"');
        expect(script).toContain('"toggleContent": "Toggle content"');
    });

    it('should replace the alphabet key correctly', () => {
        const translations = parseXlfTranslations(SAMPLE_ES_XLF);
        const script = generateI18nScript(SAMPLE_TEMPLATE, translations);

        expect(script).toContain('"az": "abcdefghijklmnñopqrstuvwxyz"');
    });

    it('should JSON-encode translated strings (handle special characters)', () => {
        const translations = new Map([['Menu', 'Menú']]);
        const script = generateI18nScript(SAMPLE_TEMPLATE, translations);

        // JSON.stringify("Menú") = '"Menú"' — should appear without broken encoding
        expect(script).toContain('"Menú"');
    });

    it('should not leave any c_("…") calls in the output', () => {
        const translations = parseXlfTranslations(SAMPLE_ES_XLF);
        const script = generateI18nScript(SAMPLE_TEMPLATE, translations);

        expect(script).not.toContain('c_(');
    });

    it('should preserve all non-c_() content unchanged (comments, structure)', () => {
        const translations = parseXlfTranslations(SAMPLE_ES_XLF);
        const script = generateI18nScript(SAMPLE_TEMPLATE, translations);

        expect(script).toContain('// The content of this file');
        expect(script).toContain('$exe_i18n =');
        expect(script).toContain('$exe_i18n.exeGames =');
        expect(script).toContain('module.exports');
    });

    it('should produce valid JavaScript (block key in Spanish)', () => {
        const translations = parseXlfTranslations(SAMPLE_ES_XLF);
        const script = generateI18nScript(SAMPLE_TEMPLATE, translations);

        expect(script).toContain('"block": "bloque"');
    });

    it('should use English fallback for an unknown language (empty map)', () => {
        const script = generateI18nScript(SAMPLE_TEMPLATE, new Map());
        expect(script).toContain('"block": "block"');
    });

    it('should strip leading ~ from translations marked as pending review', () => {
        const translations = new Map([
            ['Previous', '~translated'],
            ['Next', 'translated'],
        ]);
        const script = generateI18nScript(SAMPLE_TEMPLATE, translations);

        expect(script).not.toContain('~');
    });
});
