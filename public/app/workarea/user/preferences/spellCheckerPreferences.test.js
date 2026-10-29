import { describe, expect, it } from 'vitest';
import {
    SYSTEM_DEFAULT,
    getLanguageDisplayName,
    getSpellCheckerLanguageOptions,
    getSpellCheckerPreferenceCategory,
    spellCheckerSettingsToValue,
} from './spellCheckerPreferences.js';

// Expected names come from Intl itself so the tests survive ICU updates
const intlName = (code, locale) => {
    const name = new Intl.DisplayNames([locale], { type: 'language', languageDisplay: 'standard' }).of(code);
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
};

describe('spell checker renderer preferences', () => {
    it('maps System default to the shared sentinel', () => {
        expect(spellCheckerSettingsToValue({ systemDefault: true })).toEqual([SYSTEM_DEFAULT]);
    });

    it('maps explicit settings to selected languages', () => {
        expect(spellCheckerSettingsToValue({
            systemDefault: false,
            selectedLanguages: ['es', 'en-US'],
        })).toEqual(['es', 'en-US']);
    });

    it('uses the locale category verbatim when available', () => {
        expect(getSpellCheckerPreferenceCategory({
            locale: { category: 'Configuración general' },
            advancedMode: { category: 'General settings' },
        })).toBe('Configuración general');
    });

    it('uses an existing category when locale is unavailable', () => {
        expect(getSpellCheckerPreferenceCategory({
            advancedMode: { category: 'General settings' },
        })).toBe('General settings');
    });

    it('keeps the preference uncategorized when existing preferences are uncategorized', () => {
        expect(getSpellCheckerPreferenceCategory({
            locale: { value: 'en' },
            advancedMode: { value: 'true' },
        })).toBeUndefined();
    });

    it('names a language code in the interface language', () => {
        expect(getLanguageDisplayName('es', 'en')).toBe(intlName('es', 'en'));
        expect(getLanguageDisplayName('en-US', 'es')).toBe(intlName('en-US', 'es'));
        expect(getLanguageDisplayName('es', 'en')).not.toBe('es');
    });

    it('capitalizes names that ICU gives in lowercase', () => {
        for (const locale of ['es', 'ca', 'fr', 'it', 'pt']) {
            const name = getLanguageDisplayName('de', locale);
            expect(name.charAt(0)).toBe(name.charAt(0).toLocaleUpperCase(locale));
        }
    });

    it('falls back to the code when it cannot be named', () => {
        expect(getLanguageDisplayName('not a code', 'en')).toBe('not a code');
        expect(getLanguageDisplayName('es', 'not a locale!')).toBe('es');
    });

    it('sorts language options alphabetically by their name', () => {
        const codes = ['fr', 'de', 'en-GB'];
        const options = getSpellCheckerLanguageOptions(codes, 'en');
        const expected = codes.map(code => intlName(code, 'en')).sort(new Intl.Collator(['en']).compare);
        expect(Object.values(options)).toEqual(expected);
        expect(Object.keys(options).map(code => options[code])).toEqual(expected);
    });

    it('names languages in Valencian, which Intl does not know as va', () => {
        expect(getLanguageDisplayName('es', 'va')).toBe(getLanguageDisplayName('es', 'ca-ES-valencia'));
    });

    it('returns no options when no languages are available', () => {
        expect(getSpellCheckerLanguageOptions(undefined, 'en')).toEqual({});
    });

    it('keeps codes it cannot name when no interface language is given', () => {
        const options = getSpellCheckerLanguageOptions(['zz-invalid!', 'fr']);
        expect(options['zz-invalid!']).toBe('zz-invalid!');
        expect(options.fr).not.toBe('fr');
    });

    it('sorts with the default collation when the interface language is not a valid locale', () => {
        const options = getSpellCheckerLanguageOptions(['fr', 'de'], 'not a locale!');
        expect(Object.keys(options)).toEqual(['de', 'fr']);
    });
});
