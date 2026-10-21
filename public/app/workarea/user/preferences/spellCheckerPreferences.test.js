import { describe, expect, it } from 'vitest';
import {
    SYSTEM_DEFAULT,
    getLanguageDisplayName,
    getSpellCheckerLanguageOptions,
    getSpellCheckerPreferenceCategory,
    spellCheckerSettingsToValue,
} from './spellCheckerPreferences.js';

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
        expect(getLanguageDisplayName('es', 'en')).toBe('Spanish');
        expect(getLanguageDisplayName('en-US', 'es')).toBe('inglés (Estados Unidos)');
    });

    it('falls back to the code when it cannot be named', () => {
        expect(getLanguageDisplayName('not a code', 'en')).toBe('not a code');
        expect(getLanguageDisplayName('es', 'not a locale!')).toBe('es');
    });

    it('sorts language options alphabetically by their name', () => {
        const options = getSpellCheckerLanguageOptions(['fr', 'de', 'en-GB'], 'en');
        expect(Object.keys(options)).toEqual(['en-GB', 'fr', 'de']);
        expect(Object.values(options)).toEqual(['English (United Kingdom)', 'French', 'German']);
    });

    it('names languages in Valencian, which Intl does not know as va', () => {
        expect(getLanguageDisplayName('es', 'va')).toBe(getLanguageDisplayName('es', 'ca-ES-valencia'));
        expect(getLanguageDisplayName('es', 'va')).toBe('espanyol');
    });

    it('keeps codes it cannot name when no interface language is given', () => {
        const options = getSpellCheckerLanguageOptions(['zz-invalid!', 'fr']);
        expect(options['zz-invalid!']).toBe('zz-invalid!');
        expect(options.fr).not.toBe('fr');
    });
});
