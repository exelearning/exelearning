import { describe, expect, it } from 'vitest';
import {
    SYSTEM_DEFAULT,
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
});
