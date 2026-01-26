/**
 * Shared Translation (XLF) Parser
 *
 * Parses XLIFF (.xlf) translation files. Used by:
 * - Static build script (scripts/build-static-bundle.ts)
 * - Server translation routes (if needed)
 *
 * @module shared/parsers/translation-parser
 */

import { XMLParser } from 'fast-xml-parser';

/**
 * Translation map: source string -> target translation
 */
export type TranslationMap = Record<string, string>;

/**
 * Parsed translation file result
 */
export interface ParsedTranslations {
    translations: TranslationMap;
    count: number;
    locale?: string;
}

/**
 * File system abstraction for testing
 */
export interface TranslationFileSystemReader {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: 'utf-8'): string;
}

/**
 * Parse XLF (XLIFF) content string to extract translations
 *
 * @param content - The XLF file content as string
 * @returns Translation map (source -> target)
 *
 * @example
 * ```typescript
 * import { parseXlfContent } from '@/shared/parsers/translation-parser';
 *
 * const xlfContent = `<?xml version="1.0"?>
 * <xliff version="1.2">
 *   <file>
 *     <body>
 *       <trans-unit id="1">
 *         <source>Hello</source>
 *         <target>Hola</target>
 *       </trans-unit>
 *     </body>
 *   </file>
 * </xliff>`;
 *
 * const translations = parseXlfContent(xlfContent);
 * console.log(translations); // { 'Hello': 'Hola' }
 * ```
 */
export function parseXlfContent(content: string): TranslationMap {
    const translations: TranslationMap = {};

    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
    });

    try {
        const parsed = parser.parse(content);
        const transUnits = parsed?.xliff?.file?.body?.['trans-unit'];

        if (Array.isArray(transUnits)) {
            for (const unit of transUnits) {
                const source = unit.source;
                const target = unit.target;
                if (source && target) {
                    translations[source] = target;
                }
            }
        } else if (transUnits) {
            // Single translation
            if (transUnits.source && transUnits.target) {
                translations[transUnits.source] = transUnits.target;
            }
        }
    } catch {
        // Return empty translations on parse error
    }

    return translations;
}

/**
 * Parse XLF file to extract translations
 *
 * @param filePath - Path to the XLF file
 * @param fs - File system reader (defaults to Node's fs)
 * @returns Translation map or empty object if file not found
 *
 * @example
 * ```typescript
 * import { parseXlfFile } from '@/shared/parsers/translation-parser';
 * import * as fs from 'fs';
 *
 * const translations = parseXlfFile('./translations/messages.es.xlf', {
 *     existsSync: fs.existsSync,
 *     readFileSync: fs.readFileSync,
 * });
 * ```
 */
export function parseXlfFile(filePath: string, fs?: TranslationFileSystemReader): TranslationMap {
    // Use provided fs or try to require node's fs
    const fileSystem = fs || {
        existsSync: (_path: string) => false,
        readFileSync: (_path: string, _encoding: 'utf-8') => '',
    };

    if (!fileSystem.existsSync(filePath)) {
        console.warn(`Translation file not found: ${filePath}`);
        return {};
    }

    const content = fileSystem.readFileSync(filePath, 'utf-8');
    return parseXlfContent(content);
}

/**
 * Load translations for a specific locale
 *
 * @param locale - The locale code (e.g., 'es', 'en', 'fr')
 * @param translationsDir - Directory containing translation files
 * @param fs - File system reader
 * @param path - Path utilities for joining paths
 * @returns Parsed translations with count
 */
export function loadLocaleTranslations(
    locale: string,
    translationsDir: string,
    fs: TranslationFileSystemReader,
    path: { join: (...paths: string[]) => string },
): ParsedTranslations {
    const filePath = path.join(translationsDir, `messages.${locale}.xlf`);
    const translations = parseXlfFile(filePath, fs);

    return {
        translations,
        count: Object.keys(translations).length,
        locale,
    };
}

/**
 * Load all translations for multiple locales
 *
 * @param locales - Array of locale codes
 * @param translationsDir - Directory containing translation files
 * @param fs - File system reader
 * @param path - Path utilities
 * @returns Map of locale -> parsed translations
 */
export function loadAllTranslations(
    locales: string[],
    translationsDir: string,
    fs: TranslationFileSystemReader,
    path: { join: (...paths: string[]) => string },
): Record<string, ParsedTranslations> {
    const result: Record<string, ParsedTranslations> = {};

    for (const locale of locales) {
        result[locale] = loadLocaleTranslations(locale, translationsDir, fs, path);
    }

    return result;
}

/**
 * Merge multiple translation maps
 *
 * Later maps override earlier ones for duplicate keys.
 *
 * @param maps - Translation maps to merge
 * @returns Merged translation map
 */
export function mergeTranslations(...maps: TranslationMap[]): TranslationMap {
    return Object.assign({}, ...maps);
}
