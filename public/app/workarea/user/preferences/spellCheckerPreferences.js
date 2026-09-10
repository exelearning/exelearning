export const SYSTEM_DEFAULT = '__system_default__';

export function spellCheckerSettingsToValue(settings) {
    return settings?.systemDefault ? [SYSTEM_DEFAULT] : settings?.selectedLanguages || [];
}

export function getSpellCheckerPreferenceCategory(preferences = {}) {
    if (preferences.locale?.category !== undefined) return preferences.locale.category;

    return Object.values(preferences).find(preference => preference?.category !== undefined)?.category;
}
