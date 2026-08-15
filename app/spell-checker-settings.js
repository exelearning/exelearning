function filterSpellCheckerLanguages(selectedLanguages, availableLanguages) {
    if (!Array.isArray(selectedLanguages) || !Array.isArray(availableLanguages)) return [];

    const available = new Set(availableLanguages);
    return [...new Set(selectedLanguages)].filter(language => available.has(language));
}

function getSpellCheckerSettings(electronSession, platform = process.platform) {
    if (platform === 'darwin') return { supported: false, availableLanguages: [], selectedLanguages: [] };

    const availableLanguages = electronSession.availableSpellCheckerLanguages || [];
    const selectedLanguages = filterSpellCheckerLanguages(
        electronSession.getSpellCheckerLanguages(),
        availableLanguages
    );

    return { supported: true, availableLanguages, selectedLanguages };
}

function setSpellCheckerLanguages(electronSession, selectedLanguages, platform = process.platform) {
    if (platform === 'darwin') return getSpellCheckerSettings(electronSession, platform);

    const filtered = filterSpellCheckerLanguages(
        selectedLanguages,
        electronSession.availableSpellCheckerLanguages || []
    );
    electronSession.setSpellCheckerLanguages(filtered);
    return getSpellCheckerSettings(electronSession, platform);
}

module.exports = {
    filterSpellCheckerLanguages,
    getSpellCheckerSettings,
    setSpellCheckerLanguages,
};
