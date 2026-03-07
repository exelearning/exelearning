/**
 * I18nGenerator
 *
 * Generates the common_i18n.js file for exports by:
 *   1. Reading the template `public/app/common/common_i18n.js` (which uses c_("…") calls).
 *   2. Looking up each source string in an XLIFF translation map for the target language.
 *   3. Replacing every c_("source") occurrence with the translated plain string.
 *
 * Falls back to the English source string when no translation exists.
 *
 * NOTE: This file must remain browser-compatible — no Node.js-only imports.
 */

/**
 * Decode basic XML entities in a string.
 * Handles the five predefined XML entities plus numeric character references.
 */
function decodeXmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Parse an XLIFF 1.2 translation file and return a Map of source → target strings.
 *
 * Only <trans-unit> entries that have both <source> and <target> elements are
 * included.  The lookup key is the decoded source string (English), so callers
 * can resolve any string with `translations.get(englishString)`.
 *
 * @param xlfContent - Raw UTF-8 content of a messages.{locale}.xlf file
 * @returns Map<sourceString, targetString>
 */
export function parseXlfTranslations(xlfContent: string): Map<string, string> {
    const translations = new Map<string, string>();

    // Match complete <trans-unit> blocks (including multi-line content)
    const unitRegex = /<trans-unit[^>]*>([\s\S]*?)<\/trans-unit>/g;
    const sourceRegex = /<source>([\s\S]*?)<\/source>/;
    const targetRegex = /<target>([\s\S]*?)<\/target>/;

    let match;
    while ((match = unitRegex.exec(xlfContent)) !== null) {
        const unitBody = match[1];
        const sourceMatch = sourceRegex.exec(unitBody);
        const targetMatch = targetRegex.exec(unitBody);

        if (sourceMatch && targetMatch) {
            const source = decodeXmlEntities(sourceMatch[1].trim());
            const target = decodeXmlEntities(targetMatch[1].trim());
            if (source && target) {
                translations.set(source, target);
            }
        }
    }

    return translations;
}

/**
 * Generate the common_i18n.js content for a specific export language.
 *
 * Takes the template content (the source `common_i18n.js` which uses `c_("…")`
 * calls) and replaces every `c_("source string")` occurrence with the translated
 * value from `translations`.  When no translation is found, the source (English)
 * string is used as-is.
 *
 * The result is a self-contained JS file with plain string values — no `c_()`
 * runtime dependency — suitable for inclusion in HTML/SCORM/EPUB exports.
 *
 * @param templateContent - Raw content of `public/app/common/common_i18n.js`
 * @param translations    - Map<englishSource, translatedTarget> for the export language
 * @returns Generated JavaScript content
 */
export function generateI18nScript(templateContent: string, translations: Map<string, string>): string {
    // Replace every c_("…") call.
    // The inner group captures the string literal content, handling \" escapes.
    return templateContent.replace(/c_\("((?:[^"\\]|\\.)*)"\)/g, (_match, escaped: string) => {
        // Unescape JS string escapes to get the raw English source string
        const source = escaped.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        let translated = translations.get(source) ?? source;
        if (translated.startsWith('~')) translated = translated.slice(1);
        return JSON.stringify(translated);
    });
}
