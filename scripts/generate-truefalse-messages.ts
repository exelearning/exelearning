#!/usr/bin/env bun
/**
 * Generate the True/False message catalogue used by legacy imports.
 *
 * eXeLearning 2.x packages do not store the interface texts of the True/False
 * iDevice, so the importer has to supply them in the language declared by the
 * package (issue #2252). Those strings already exist in
 * `translations/messages.<lang>.xlf` — the same catalogue the editor resolves
 * through `c_()` — but the importer cannot read them at run time: it is bundled
 * for the browser (no `fs`) and `LegacyXmlParser.parse()` is synchronous, so it
 * cannot await a catalogue fetch either.
 *
 * This script therefore projects the XLF catalogue into a plain TypeScript
 * module that the importer can import directly. The generated file is
 * committed so `bun test` and esbuild work with no build step, and
 * `generate-truefalse-messages.spec.ts` fails if it ever drifts from
 * `translations/`.
 *
 * It reads the message keys from `trueFalseMessages.definition.ts`, never from
 * `trueFalseMessages.ts`: the latter imports the generated module, so depending
 * on it would make the generator unable to recreate a deleted output.
 *
 * Usage:
 *   bun run generate:truefalse-messages && make fix
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseXlfTranslations } from '../src/shared/export/generators/I18nGenerator';
import {
    TRUE_FALSE_DEFAULT_MESSAGES,
    type TrueFalseMessages,
} from '../src/shared/import/legacy-handlers/trueFalseMessages.definition';

/** Repository-relative directory holding the XLF catalogues. */
export const TRANSLATIONS_DIR = 'translations';

/** Repository-relative path of the module this script writes. */
export const GENERATED_MODULE_PATH = 'src/shared/import/legacy-handlers/trueFalseMessages.generated.ts';

/**
 * Pick the catalogue locales out of a `translations/` listing.
 *
 * English is excluded: it is the source language, already held by
 * TRUE_FALSE_DEFAULT_MESSAGES.
 *
 * @param fileNames - Directory listing of `translations/`
 */
export function listTranslatedLocales(fileNames: string[]): string[] {
    return fileNames
        .map(name => /^messages\.([A-Za-z-]+)\.xlf$/.exec(name)?.[1])
        .filter((lang): lang is string => !!lang && lang !== 'en')
        .sort();
}

/** A message table: language code → message key → translated text. */
export type TranslationTable = Record<string, Partial<TrueFalseMessages>>;

/**
 * Resolve every message key against each language catalogue.
 *
 * Throws when a source string has no translation: emitting the English
 * fallback for a locale that is supposed to be covered would hide a gap in the
 * catalogue behind plausible-looking output.
 *
 * @param catalogues - Language code → source string → translated text
 */
export function buildTranslationTable(catalogues: Record<string, Map<string, string>>): TranslationTable {
    const table: TranslationTable = {};
    const missing: string[] = [];

    for (const [lang, catalogue] of Object.entries(catalogues)) {
        const messages: Record<string, string> = {};

        for (const [key, source] of Object.entries(TRUE_FALSE_DEFAULT_MESSAGES)) {
            const translated = catalogue.get(source);
            if (translated === undefined) {
                missing.push(`${lang}.${key}`);
                continue;
            }
            messages[key] = translated;
        }

        table[lang] = messages as Partial<TrueFalseMessages>;
    }

    if (missing.length > 0) {
        throw new Error(`Untranslated True/False messages: ${missing.join(', ')}`);
    }

    return table;
}

/**
 * Render the generated module source for a translation table.
 *
 * Values go through JSON.stringify rather than hand-rolled quoting: XLF targets
 * can carry quotes, backslashes and — since parseXlfTranslations decodes numeric
 * character references — real control characters. Biome rewrites the resulting
 * double quotes to the project style on `make fix`, which is harmless because
 * the drift test compares the table data, not the file bytes.
 */
export function renderTrueFalseMessagesModule(table: TranslationTable): string {
    const lines: string[] = [
        '/**',
        ' * Translations of the True/False interface texts, by language code.',
        ' *',
        ' * DO NOT EDIT — generated from `translations/messages.<lang>.xlf` by',
        ' * `scripts/generate-truefalse-messages.ts`. Run',
        ' * `bun run generate:truefalse-messages && make fix` after the catalogue changes.',
        ' *',
        ' * English is absent on purpose: it is the source language, held by',
        ' * TRUE_FALSE_DEFAULT_MESSAGES.',
        ' */',
        '',
        "import type { TrueFalseMessages } from './trueFalseMessages.definition';",
        '',
        'export const TRUE_FALSE_MESSAGE_TRANSLATIONS: Record<string, TrueFalseMessages> = {',
    ];

    for (const [lang, messages] of Object.entries(table)) {
        lines.push(`    ${lang}: {`);
        for (const [key, value] of Object.entries(messages)) {
            lines.push(`        ${key}: ${JSON.stringify(value)},`);
        }
        lines.push('    },');
    }

    lines.push('};', '');

    return lines.join('\n');
}

/**
 * Build the translation table straight from the XLF catalogues.
 *
 * The drift test compares this against the committed module, so it must stay
 * the single path from `translations/` to the table.
 *
 * @param readXlf - Returns the raw content of `messages.<lang>.xlf`
 * @param langs - Locales to project, as returned by listTranslatedLocales()
 */
export function buildTableFromCatalogues(readXlf: (lang: string) => string, langs: string[]): TranslationTable {
    const catalogues: Record<string, Map<string, string>> = {};

    for (const lang of langs) {
        catalogues[lang] = parseXlfTranslations(readXlf(lang));
    }

    return buildTranslationTable(catalogues);
}

/**
 * Generate the module source from the XLF catalogues.
 *
 * The emitted source is Biome-formatted afterwards by `make fix`, so the drift
 * test compares the resulting data rather than the exact bytes.
 *
 * @param readXlf - Returns the raw content of `messages.<lang>.xlf`
 * @param langs - Locales to project, as returned by listTranslatedLocales()
 */
export function generateModuleSource(readXlf: (lang: string) => string, langs: string[]): string {
    return renderTrueFalseMessagesModule(buildTableFromCatalogues(readXlf, langs));
}

/** Filesystem access, injected so the generator can be exercised without touching disk. */
export interface GeneratorIo {
    listFiles(dir: string): string[];
    readFile(file: string): string;
    writeFile(file: string, content: string): void;
}

export const defaultIo: GeneratorIo = {
    listFiles: dir => fs.readdirSync(dir),
    readFile: file => fs.readFileSync(file, 'utf-8'),
    writeFile: (file, content) => fs.writeFileSync(file, content, 'utf-8'),
};

/**
 * Project every catalogue found in `translations/` into the generated module.
 *
 * @param root - Repository root
 * @param io - Filesystem access
 * @returns The locales written
 */
export function writeGeneratedModule(root: string, io: GeneratorIo = defaultIo): string[] {
    const translationsDir = path.join(root, TRANSLATIONS_DIR);
    const langs = listTranslatedLocales(io.listFiles(translationsDir));
    const source = generateModuleSource(lang => io.readFile(path.join(translationsDir, `messages.${lang}.xlf`)), langs);

    io.writeFile(path.join(root, GENERATED_MODULE_PATH), source);

    return langs;
}

if (import.meta.main) {
    const langs = writeGeneratedModule(path.join(import.meta.dir, '..'));
    console.log(`Generated ${GENERATED_MODULE_PATH} for ${langs.length} locales`);
}
