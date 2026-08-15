function filterSpellCheckerLanguages(selectedLanguages, availableLanguages) {
    if (!Array.isArray(selectedLanguages) || !Array.isArray(availableLanguages)) return [];

    const available = new Set(availableLanguages);
    return [...new Set(selectedLanguages)].filter(language => available.has(language));
}

const SYSTEM_DEFAULT = '__system_default__';
const SPELL_CHECKER_MODE_SYSTEM = 'system';
const SPELL_CHECKER_MODE_LANGUAGES = 'languages';

function normalizeSpellCheckerSelection(selectedLanguages) {
    if (!Array.isArray(selectedLanguages) || selectedLanguages.length === 0) {
        return { mode: SPELL_CHECKER_MODE_SYSTEM, languages: [] };
    }

    const languages = selectedLanguages.filter(language => language !== SYSTEM_DEFAULT);
    return languages.length > 0
        ? { mode: SPELL_CHECKER_MODE_LANGUAGES, languages }
        : { mode: SPELL_CHECKER_MODE_SYSTEM, languages: [] };
}

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
    if (platform === 'darwin') {
        return { supported: false, availableLanguages: [], selectedLanguages: [], systemDefault: true };
    }

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
    const selection = normalizeSpellCheckerSelection(selectedLanguages);
    const useSystemDefault = selection.mode === SPELL_CHECKER_MODE_SYSTEM;
    const filtered = useSystemDefault
        ? resolveSystemSpellCheckerLanguages(systemLocale, availableLanguages)
        : filterSpellCheckerLanguages(selection.languages, availableLanguages);
    const applied = filtered.length > 0;
    if (applied) electronSession.setSpellCheckerLanguages(filtered);
    return { ...getSpellCheckerSettings(electronSession, platform, useSystemDefault && applied), applied };
}

function getPersistedSpellCheckerMode(settings = {}) {
    if (settings.spellChecker) {
        return settings.spellChecker.mode === SPELL_CHECKER_MODE_SYSTEM;
    }
    return settings.spellCheckerUseSystemDefault !== false;
}

function getPersistedSpellCheckerSelection(settings = {}) {
    if (settings.spellChecker?.mode === SPELL_CHECKER_MODE_LANGUAGES) {
        return Array.isArray(settings.spellChecker.languages) && settings.spellChecker.languages.length > 0
            ? settings.spellChecker.languages
            : null;
    }
    if (settings.spellChecker?.mode === SPELL_CHECKER_MODE_SYSTEM || settings.spellCheckerUseSystemDefault === true) {
        return [SYSTEM_DEFAULT];
    }
    return null;
}

function createSpellCheckerController({
    electronSession,
    platform = process.platform,
    systemLocale = '',
    readSettings,
    writeSettings,
}) {
    const getSettings = () => {
        const settings = readSettings();
        return getSpellCheckerSettings(
            electronSession,
            platform,
            getPersistedSpellCheckerMode(settings)
        );
    };

    const setLanguages = (languages = []) => {
        const settings = readSettings();
        const previousSystemDefault = getPersistedSpellCheckerMode(settings);
        const selection = normalizeSpellCheckerSelection(languages);
        const result = setSpellCheckerLanguages(
            electronSession,
            selection.mode === SPELL_CHECKER_MODE_SYSTEM ? [SYSTEM_DEFAULT] : selection.languages,
            platform,
            systemLocale
        );

        if (!result.applied) {
            return {
                ...getSpellCheckerSettings(electronSession, platform, previousSystemDefault),
                applied: false,
            };
        }

        settings.spellChecker = {
            mode: selection.mode,
            languages: result.selectedLanguages,
        };
        delete settings.spellCheckerUseSystemDefault;
        writeSettings(settings);
        return result;
    };

    const applyPersisted = () => {
        if (platform === 'darwin') return getSpellCheckerSettings(electronSession, platform);

        const selection = getPersistedSpellCheckerSelection(readSettings());
        if (!selection) return null;
        return setSpellCheckerLanguages(electronSession, selection, platform, systemLocale);
    };

    return { getSettings, setLanguages, applyPersisted };
}

function registerSpellCheckerIpc(ipcMain, controller) {
    ipcMain.handle('app:getSpellCheckerSettings', async () => controller.getSettings());
    ipcMain.handle('app:setSpellCheckerLanguages', async (_event, languages = []) =>
        controller.setLanguages(languages)
    );
}

module.exports = {
    SYSTEM_DEFAULT,
    SPELL_CHECKER_MODE_SYSTEM,
    SPELL_CHECKER_MODE_LANGUAGES,
    normalizeSpellCheckerSelection,
    filterSpellCheckerLanguages,
    resolveSystemSpellCheckerLanguages,
    getSpellCheckerSettings,
    setSpellCheckerLanguages,
    getPersistedSpellCheckerMode,
    getPersistedSpellCheckerSelection,
    createSpellCheckerController,
    registerSpellCheckerIpc,
};
