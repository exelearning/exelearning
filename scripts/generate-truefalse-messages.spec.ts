/**
 * Tests for the True/False message catalogue generator.
 *
 * The last test is the drift guard: it rebuilds the table from `translations/`
 * and fails if the committed module no longer matches, so a change in the XLF
 * catalogue can never silently diverge from what legacy imports write into a
 * project (issue #2252).
 */

import { describe, it, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import {
    TRANSLATIONS_DIR,
    GENERATED_MODULE_PATH,
    defaultIo,
    listTranslatedLocales,
    buildTranslationTable,
    buildTableFromCatalogues,
    renderTrueFalseMessagesModule,
    generateModuleSource,
    writeGeneratedModule,
} from './generate-truefalse-messages';
import {
    TRUE_FALSE_DEFAULT_MESSAGES,
    TRUE_FALSE_MESSAGE_TRANSLATIONS,
} from '../src/shared/import/legacy-handlers/trueFalseMessages';

const ROOT = path.join(import.meta.dir, '..');

/** An XLF document holding exactly the given source → target pairs. */
function xlf(units: Record<string, string>): string {
    const body = Object.entries(units)
        .map(([source, target]) => `<trans-unit><source>${source}</source><target>${target}</target></trans-unit>`)
        .join('');
    return `<xliff>${body}</xliff>`;
}

/** An XLF document translating every source string by prefixing it. */
function completeXlf(prefix: string): string {
    return xlf(Object.fromEntries(Object.values(TRUE_FALSE_DEFAULT_MESSAGES).map(s => [s, `${prefix}${s}`])));
}

/** A catalogue that translates every source string by prefixing it. */
function fullCatalogue(prefix: string): Map<string, string> {
    const catalogue = new Map<string, string>();
    for (const source of Object.values(TRUE_FALSE_DEFAULT_MESSAGES)) {
        catalogue.set(source, `${prefix}${source}`);
    }
    return catalogue;
}

describe('listTranslatedLocales', () => {
    it('should pick the catalogue locales and drop the English source', () => {
        const locales = listTranslatedLocales(['messages.es.xlf', 'messages.en.xlf', 'messages.ca.xlf', 'en.json']);

        expect(locales).toEqual(['ca', 'es']);
    });

    it('should cover the catalogues shipped in the repository', () => {
        const locales = listTranslatedLocales(fs.readdirSync(path.join(ROOT, TRANSLATIONS_DIR)));

        expect(locales).toContain('es');
        expect(locales).toContain('gl');
        expect(locales).not.toContain('en');
    });
});

describe('buildTranslationTable', () => {
    it('should resolve every message key through the catalogue', () => {
        const table = buildTranslationTable({ xx: fullCatalogue('T-') });

        expect(Object.keys(table)).toEqual(['xx']);
        expect(table.xx.msgTrue).toBe('T-True');
        expect(Object.keys(table.xx)).toEqual(Object.keys(TRUE_FALSE_DEFAULT_MESSAGES));
    });

    it('should throw naming the untranslated sources instead of silently emitting English', () => {
        const catalogue = fullCatalogue('T-');
        catalogue.delete('True');
        catalogue.delete('Suggestion');

        expect(() => buildTranslationTable({ xx: catalogue })).toThrow('xx.msgSuggestion, xx.msgTrue');
    });
});

describe('renderTrueFalseMessagesModule', () => {
    it('should mark the module as generated and point at the generator', () => {
        const source = renderTrueFalseMessagesModule({ xx: { msgTrue: 'Sí' } });

        expect(source).toContain('DO NOT EDIT');
        expect(source).toContain('generate-truefalse-messages');
        expect(source).toContain('export const TRUE_FALSE_MESSAGE_TRANSLATIONS');
        expect(source.endsWith('\n')).toBe(true);
    });

    it('should emit values that survive JavaScript string escaping', () => {
        // parseXlfTranslations decodes numeric character references, so a target
        // can legitimately carry a real newline, quotes or a backslash.
        const source = renderTrueFalseMessagesModule({
            xx: {
                msgTrue: 'Verdadero',
                msgYouLastScore: "L'ultimo punteggio",
                msgSuggestion: 'first\nsecond',
                msgFeedback: 'a "quoted" back\\slash',
            },
        });

        expect(source).toContain('msgTrue: "Verdadero",');
        expect(source).toContain('msgYouLastScore: "L\'ultimo punteggio",');
        expect(source).toContain('msgSuggestion: "first\\nsecond",');
        expect(source).toContain('msgFeedback: "a \\"quoted\\" back\\\\slash",');
    });
});

describe('generateModuleSource', () => {
    it('should read one catalogue per requested locale', () => {
        const requested: string[] = [];
        const readXlf = (lang: string) => {
            requested.push(lang);
            return completeXlf(`${lang}-`);
        };

        const source = generateModuleSource(readXlf, ['es', 'gl']);

        expect(requested).toEqual(['es', 'gl']);
        expect(source).toContain('    es: {');
        expect(source).toContain('    gl: {');
        expect(source).toContain('msgTrue: "gl-True",');
    });

    it('should refuse to emit a locale whose catalogue is incomplete', () => {
        const readXlf = () => xlf({ True: 'Cierto' });

        expect(() => generateModuleSource(readXlf, ['xx'])).toThrow('Untranslated True/False messages');
    });
});

describe('writeGeneratedModule', () => {
    it('should project every shipped catalogue into the generated module', () => {
        const written: Record<string, string> = {};
        const io = {
            listFiles: () => ['messages.es.xlf', 'messages.en.xlf', 'README.md'],
            readFile: () => completeXlf('es-'),
            writeFile: (file: string, content: string) => {
                written[file] = content;
            },
        };

        const langs = writeGeneratedModule('/repo', io);

        expect(langs).toEqual(['es']);
        expect(Object.keys(written)).toEqual([path.join('/repo', GENERATED_MODULE_PATH)]);
        expect(written[path.join('/repo', GENERATED_MODULE_PATH)]).toContain('msgTrue: "es-True",');
    });
});

describe('module graph', () => {
    // The generator must never depend on the module that imports its output:
    // that made regenerating a deleted trueFalseMessages.generated.ts impossible.
    it('should read the message keys from the leaf definition module only', () => {
        const generator = fs.readFileSync(path.join(ROOT, 'scripts/generate-truefalse-messages.ts'), 'utf-8');

        expect(generator).toContain("legacy-handlers/trueFalseMessages.definition'");
        expect(generator).not.toMatch(/from '[^']*legacy-handlers\/trueFalseMessages'/);
    });

    it('should keep the definition module free of imports', () => {
        const definition = fs.readFileSync(
            path.join(ROOT, 'src/shared/import/legacy-handlers/trueFalseMessages.definition.ts'),
            'utf-8',
        );

        expect(definition).not.toMatch(/^\s*import\s/m);
    });
});

describe('committed catalogue', () => {
    it('should still match `translations/` (regenerate with `bun run generate:truefalse-messages`)', () => {
        const translationsDir = path.join(ROOT, TRANSLATIONS_DIR);
        const langs = listTranslatedLocales(defaultIo.listFiles(translationsDir));

        const fromCatalogues = buildTableFromCatalogues(
            lang => defaultIo.readFile(path.join(translationsDir, `messages.${lang}.xlf`)),
            langs,
        );

        expect(TRUE_FALSE_MESSAGE_TRANSLATIONS).toEqual(fromCatalogues);
    });
});
