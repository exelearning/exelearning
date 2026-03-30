/**
 * Translation Service for Elysia
 * Parses XLF files and provides translation functions
 *
 * Ported from NestJS TranslationService
 */
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

const DEBUG = process.env.APP_DEBUG === '1';

/**
 * Interface translations - locales with XLF files
 */
export const LOCALES: Record<string, string> = {
    ca: 'Català',
    en: 'English',
    de: 'Deutsch',
    eo: 'Esperanto',
    es: 'Español',
    eu: 'Euskara',
    gl: 'Galego',
    it: 'Italiano',
    pt: 'Português',
    ro: 'Română',
    va: 'Valencià',
};

/**
 * Default locale: uses APP_LOCALE env var if set, otherwise defaults to 'en' (English)
 */
export const DEFAULT_LOCALE = process.env.APP_LOCALE || 'en';

/**
 * Package export locales - extended list for content packages
 */
export const PACKAGE_LOCALES: Record<string, string> = {
    am: 'አማርኛ',
    ar: 'العربية',
    ast: 'asturianu',
    bg: 'Български',
    bn: 'বাংলা',
    br: 'Brezhoneg',
    ca: 'Català',
    va: 'Valencià',
    cs: 'Čeština, český jazyk',
    da: 'Dansk',
    de: 'Deutsch',
    dz: 'རྫོང་ཁ་',
    ee: 'Eʋegbe',
    el: 'Ελληνικά',
    en: 'English',
    eo: 'Esperanto',
    es: 'Español',
    et: 'Eesti',
    eu: 'Euskara',
    fa: 'فارسی',
    fi: 'Suomi',
    fr: 'Français',
    gl: 'Galego',
    he: 'עברית',
    hr: 'Hrvatski',
    hu: 'Magyar',
    id: 'Bahasa Indonesia',
    ig: 'Asụsụ Igbo',
    is: 'Íslenska',
    it: 'Italiano',
    ja: '日本語',
    km: 'ភាសាខ្មែរ',
    lo: 'ພາສາລາວ',
    mi: 'Māori',
    nb: 'Norsk bokmål',
    nl: 'Nederlands',
    pl: 'Język polski',
    pt: 'Português',
    pt_br: 'Português do Brazil',
    ro: 'Română',
    ru: 'Русский',
    sk: 'Slovenčina',
    sl: 'Slovenščina',
    sr: 'Српски / srpski',
    sv: 'Svenska',
    th: 'ไทย',
    tl: 'Wikang Tagalog',
    tg: 'тоҷикӣ',
    tr: 'Türkçe',
    tw: 'Twi',
    uk: 'Українська',
    vi: 'Tiếng Việt',
    yo: 'Yorùbá',
    zh_CN: '简体中文',
    zh_TW: '正體中文（台灣)',
    zu: 'isiZulu',
};

/**
 * Translatable text prefix - used to mark strings that need translation
 */
export const TRANS_PREFIX = 'TRANSLATABLE_TEXT:';

/**
 * XLF parse result interface
 */
interface XlfParseResult {
    sourceLanguage: string;
    targetLanguage: string;
    translations: Map<string, string>;
}

/**
 * Translation catalogues - Map<locale, Map<sourceKey, translatedValue>>
 */
const catalogues: Map<string, Map<string, string>> = new Map();

/**
 * Current locale for the session (default: from APP_LOCALE env or 'en')
 */
let currentLocale: string = process.env.APP_LOCALE || DEFAULT_LOCALE;

/**
 * Global parameters for translations
 */
let globalParameters: Record<string, string> = {};

/**
 * XML Parser instance
 */
const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
});

/**
 * Extract text from an XML node
 */
function extractText(node: unknown): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'object' && node !== null && '#text' in node) {
        return (node as { '#text': string })['#text'];
    }
    return '';
}

/**
 * Parse XLF file content
 */
function parseXlfContent(content: string): XlfParseResult {
    const parsed = xmlParser.parse(content);
    const xliff = parsed.xliff;
    const file = xliff?.file;
    const body = file?.body;

    if (!body) {
        return {
            sourceLanguage: 'en',
            targetLanguage: 'en',
            translations: new Map(),
        };
    }

    const sourceLanguage = file['@_source-language'] || 'en';
    const targetLanguage = file['@_target-language'] || sourceLanguage;

    const translations = new Map<string, string>();

    // Handle both single trans-unit and array of trans-units
    let transUnits = body['trans-unit'];
    if (!Array.isArray(transUnits)) {
        transUnits = transUnits ? [transUnits] : [];
    }

    for (const unit of transUnits) {
        const source = extractText(unit.source);
        const target = extractText(unit.target);
        // Use resname or id as key (for error.page_not_found style keys)
        const resname = unit['@_resname'];
        const id = unit['@_id'];

        if (source) {
            // Use source as primary key, target as value (fallback to source if target is empty)
            translations.set(source, target || source);

            // Also register by resname/id for keys like 'error.page_not_found'
            if (resname && resname !== source) {
                translations.set(resname, target || source);
            }
            if (id && id !== source && id !== resname) {
                translations.set(id, target || source);
            }
        }
    }

    return {
        sourceLanguage,
        targetLanguage,
        translations,
    };
}

/**
 * Get the translations directory path
 */
function getTranslationsDir(): string {
    const resourcesPath = process.env.RESOURCES_PATH;
    if (resourcesPath) {
        return path.join(resourcesPath, 'translations');
    }
    return path.join(process.cwd(), 'translations');
}

/**
 * Load all XLF translation files
 */
export function loadAllTranslations(): void {
    const translationsDir = getTranslationsDir();

    if (DEBUG) console.log(`[Translation] Loading translations from: ${translationsDir}`);

    for (const locale of Object.keys(LOCALES)) {
        const filePath = path.join(translationsDir, `messages.${locale}.xlf`);

        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const result = parseXlfContent(content);
                catalogues.set(locale, result.translations);
                if (DEBUG)
                    console.log(`[Translation] Loaded ${result.translations.size} translations for locale: ${locale}`);
            } else {
                if (DEBUG) console.log(`[Translation] Translation file not found: ${filePath}`);
                catalogues.set(locale, new Map());
            }
        } catch (error) {
            console.error(`[Translation] Error loading translations for ${locale}:`, error);
            catalogues.set(locale, new Map());
        }
    }

    console.log(`[Translation] Loaded ${catalogues.size} locales`);
}

/**
 * Apply special string transformations (elp -> elpx, remove ~ prefix)
 */
function applyTransformations(text: string): string {
    let result = text;

    // elp -> elpx transformations
    result = result.replace(/ \(elp\)/g, ' (elpx)');
    result = result.replace(/ \.elp /g, ' .elpx ');
    result = result.replace(/ elp /g, ' elpx ');
    if (result.endsWith('.elp')) {
        result += 'x';
    }

    // Remove ~ prefix if present
    if (result.startsWith('~')) {
        result = result.substring(1);
    }

    return result;
}

/**
 * Replace parameters in translation string
 * Supports both %param% and {param} formats
 */
function replaceParameters(text: string, params: Record<string, string>): string {
    let result = text;

    for (const [key, value] of Object.entries(params)) {
        // Replace %key% format (Symfony style)
        result = result.replace(new RegExp(`%${key}%`, 'g'), value);
        // Replace {key} format
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        // Replace %key format (for printf-like %s, %d, etc)
        result = result.replace(new RegExp(`%${key}\\b`, 'g'), value);
    }

    return result;
}

/**
 * Translate a message with fallback to English
 */
export function trans(id: string, parameters: Record<string, string> = {}, locale?: string): string {
    const targetLocale = locale || currentLocale;
    const mergedParams = { ...globalParameters, ...parameters };

    // Try to translate in the target locale
    let translated = catalogues.get(targetLocale)?.get(id);

    // Fallback to English if translation is empty or same as the key
    if (!translated || translated === id) {
        translated = catalogues.get('en')?.get(id);
    }

    // If still no translation, return the original id
    if (!translated || translated === id) {
        translated = id;
    }

    // Apply special transformations
    translated = applyTransformations(translated);

    // Replace parameters
    translated = replaceParameters(translated, mergedParams);

    return translated;
}

/**
 * Translate a value that may have TRANSLATABLE_TEXT: prefix
 */
export function translateValue(value: string, locale?: string): string {
    if (typeof value !== 'string') return value;

    if (value.startsWith(TRANS_PREFIX)) {
        const key = value.substring(TRANS_PREFIX.length);
        return trans(key, {}, locale);
    }

    return value;
}

/**
 * Recursively translate all TRANSLATABLE_TEXT: values in an object
 */
export function translateObject<T extends Record<string, unknown>>(obj: T, locale?: string): T {
    if (!obj || typeof obj !== 'object') return obj;

    const result = (Array.isArray(obj) ? [] : {}) as Record<string, unknown>;

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            result[key] = translateValue(value, locale);
        } else if (typeof value === 'object' && value !== null) {
            result[key] = translateObject(value as Record<string, unknown>, locale);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

/**
 * Get the full translation catalogue for a locale
 */
export function getCatalogue(locale?: string): Record<string, string> {
    const targetLocale = locale || currentLocale;
    const catalogue = catalogues.get(targetLocale);

    if (!catalogue) {
        return {};
    }

    // Convert Map to plain object
    const result: Record<string, string> = {};
    for (const [key, value] of catalogue.entries()) {
        result[key] = value;
    }

    return result;
}

/**
 * Get catalogue with fallback - returns translations from target locale
 * with English fallback for missing keys
 */
export function getCatalogueWithFallback(locale: string): Record<string, string> {
    const targetCatalogue = catalogues.get(locale) || new Map();
    const fallbackCatalogue = catalogues.get('en') || new Map();

    const result: Record<string, string> = {};

    // First, add all English translations as base
    for (const [key, value] of fallbackCatalogue.entries()) {
        result[key] = value;
    }

    // Then override with target locale translations
    for (const [key, value] of targetCatalogue.entries()) {
        if (value && value !== key) {
            result[key] = value;
        }
    }

    return result;
}

/**
 * Set the current locale
 */
export function setLocale(locale: string): void {
    if (LOCALES[locale] || locale === DEFAULT_LOCALE) {
        currentLocale = locale;
    }
}

/**
 * Get the current locale
 */
export function getLocale(): string {
    return currentLocale;
}

/**
 * Get available interface locales
 */
export function getAvailableLocales(): string[] {
    return Object.keys(LOCALES);
}

/**
 * Get available package locales
 */
export function getAvailablePackageLocales(): string[] {
    return Object.keys(PACKAGE_LOCALES);
}

/**
 * Set global parameters for translations
 */
export function setGlobalParameters(params: Record<string, string>): void {
    globalParameters = { ...globalParameters, ...params };
}

/**
 * Get the number of loaded translations for a locale
 */
export function getTranslationCount(locale: string): number {
    return catalogues.get(locale)?.size || 0;
}

/**
 * Check if a locale is loaded
 */
export function isLocaleLoaded(locale: string): boolean {
    return catalogues.has(locale);
}

/**
 * Detect locale from Accept-Language header
 */
export function detectLocaleFromHeader(acceptLanguage: string | null): string {
    if (!acceptLanguage) {
        return currentLocale;
    }

    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
    const languages = acceptLanguage.split(',').map(lang => {
        const [code, qValue] = lang.trim().split(';q=');
        return {
            code: code.split('-')[0].toLowerCase(), // Take just the language code, not the region
            q: qValue ? parseFloat(qValue) : 1.0,
        };
    });

    // Sort by quality value
    languages.sort((a, b) => b.q - a.q);

    // Find the first matching locale
    for (const lang of languages) {
        if (LOCALES[lang.code]) {
            return lang.code;
        }
    }

    return currentLocale;
}

/**
 * Reload translations (useful for development)
 */
export function reloadTranslations(): void {
    catalogues.clear();
    loadAllTranslations();
}

// Load translations on module initialization
loadAllTranslations();
