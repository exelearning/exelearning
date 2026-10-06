import { describe, expect, it } from 'vitest';
import {
    SYSTEM_DEFAULT,
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
});
