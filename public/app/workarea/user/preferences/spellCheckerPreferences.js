export const SYSTEM_DEFAULT = '__system_default__';

export function spellCheckerSettingsToValue(settings) {
    return settings?.systemDefault ? [SYSTEM_DEFAULT] : settings?.selectedLanguages || [];
}

// eXeLearning locales that are not BCP 47 tags Intl understands
const INTL_LOCALES = { va: 'ca-ES-valencia' };

function toIntlLocales(uiLocale) {
    return uiLocale ? [INTL_LOCALES[uiLocale] || uiLocale] : [];
}

/**
 * Name a language code in the interface language, falling back to the code itself
 * @param {string} code - BCP 47 language code (es, en-US...)
 * @param {string} [uiLocale] - Interface language
 * @returns {string}
 */
export function getLanguageDisplayName(code, uiLocale) {
    try {
        // Standard display keeps regional variants together: "English (United States)"
        const name = new Intl.DisplayNames(toIntlLocales(uiLocale), {
            type: 'language',
            languageDisplay: 'standard',
        }).of(code);
        if (name && name !== code) return name;
    } catch {
        // Invalid code or locale: show the code
    }
    return code;
}

/**
 * Language options keyed by code, named in the interface language and sorted by name
 * @param {string[]} codes
 * @param {string} [uiLocale]
 * @returns {Object<string, string>}
 */
export function getSpellCheckerLanguageOptions(codes, uiLocale) {
    const collator = new Intl.Collator(toIntlLocales(uiLocale));
    return Object.fromEntries(
        codes
            .map(code => [code, getLanguageDisplayName(code, uiLocale)])
            .sort(([, a], [, b]) => collator.compare(a, b))
    );
}

export function getSpellCheckerPreferenceCategory(preferences = {}) {
    if (preferences.locale?.category !== undefined) return preferences.locale.category;

    return Object.values(preferences).find(preference => preference?.category !== undefined)?.category;
}
