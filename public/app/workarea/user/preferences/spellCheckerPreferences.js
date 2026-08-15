export const SYSTEM_DEFAULT = '__system_default__';

export function spellCheckerSettingsToValue(settings) {
    return settings?.systemDefault ? [SYSTEM_DEFAULT] : settings?.selectedLanguages || [];
}
