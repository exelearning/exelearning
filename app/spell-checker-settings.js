function filterSpellCheckerLanguages(selectedLanguages, availableLanguages) {
    if (!Array.isArray(selectedLanguages) || !Array.isArray(availableLanguages)) return [];

    const available = new Set(availableLanguages);
    return [...new Set(selectedLanguages)].filter(language => available.has(language));
}

const SYSTEM_DEFAULT = '__system_default__';

function resolveSystemSpellCheckerLanguages(systemLocale, availableLanguages) {
    if (!Array.isArray(availableLanguages) || availableLanguages.length === 0) return [];

    const normalizedLocale = String(systemLocale || '').replace('_', '-').toLowerCase();
    const baseLocale = normalizedLocale.split('-')[0];
    const exactMatch = availableLanguages.find(language => language.toLowerCase() === normalizedLocale);
    const baseMatch = availableLanguages.find(language => language.toLowerCase() === baseLocale);
    const regionalMatch = availableLanguages.find(language => language.toLowerCase().startsWith(`${baseLocale}-`));
    const electronFallback = availableLanguages.find(language => language.toLowerCase() === 'en-us');

    const resolvedLanguage = exactMatch || baseMatch || regionalMatch || electronFallback;
    return resolvedLanguage ? [resolvedLanguage] : [];
}

function getSpellCheckerSettings(electronSession, platform = process.platform, systemDefault = true) {
    if (platform === 'darwin') return { supported: false, availableLanguages: [], selectedLanguages: [] };

    const availableLanguages = electronSession.availableSpellCheckerLanguages || [];
    const selectedLanguages = filterSpellCheckerLanguages(
        electronSession.getSpellCheckerLanguages(),
        availableLanguages
    );

    return { supported: true, availableLanguages, selectedLanguages, systemDefault };
}

function setSpellCheckerLanguages(
    electronSession,
    selectedLanguages,
    platform = process.platform,
    systemLocale = ''
) {
    if (platform === 'darwin') return getSpellCheckerSettings(electronSession, platform);

    const availableLanguages = electronSession.availableSpellCheckerLanguages || [];
    const useSystemDefault = !Array.isArray(selectedLanguages)
        || selectedLanguages.length === 0
        || selectedLanguages.includes(SYSTEM_DEFAULT);
    const filtered = useSystemDefault
        ? resolveSystemSpellCheckerLanguages(systemLocale, availableLanguages)
        : filterSpellCheckerLanguages(selectedLanguages, availableLanguages);
    if (filtered.length > 0) electronSession.setSpellCheckerLanguages(filtered);
    return getSpellCheckerSettings(electronSession, platform, useSystemDefault);
}

module.exports = {
    SYSTEM_DEFAULT,
    filterSpellCheckerLanguages,
    resolveSystemSpellCheckerLanguages,
    getSpellCheckerSettings,
    setSpellCheckerLanguages,
};
