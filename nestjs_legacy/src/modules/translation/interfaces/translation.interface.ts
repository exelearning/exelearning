/**
 * Represents a single translation unit from an XLF file
 */
export interface TransUnit {
    id: string;
    source: string;
    target: string;
}

/**
 * Result of parsing an XLF file
 */
export interface XlfParseResult {
    sourceLanguage: string;
    targetLanguage: string;
    translations: Map<string, string>;
}

/**
 * Translation catalogue for a single locale
 */
export interface TranslationCatalogue {
    locale: string;
    translations: Record<string, string>;
}
