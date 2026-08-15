const { describe, expect, test, mock } = require('bun:test');
const {
    filterSpellCheckerLanguages,
    getSpellCheckerSettings,
    setSpellCheckerLanguages,
} = require('./spell-checker-settings');

describe('spell checker settings', () => {
    test('filters unavailable and duplicate persisted languages', () => {
        expect(filterSpellCheckerLanguages(['es', 'xx', 'es', 'en-US'], ['en-US', 'es'])).toEqual([
            'es',
            'en-US',
        ]);
        expect(filterSpellCheckerLanguages(null, ['es'])).toEqual([]);
    });

    test('returns available and valid selected languages on Windows and Linux', () => {
        const electronSession = {
            availableSpellCheckerLanguages: ['en-US', 'es'],
            getSpellCheckerLanguages: () => ['es', 'unavailable'],
        };

        expect(getSpellCheckerSettings(electronSession, 'linux')).toEqual({
            supported: true,
            availableLanguages: ['en-US', 'es'],
            selectedLanguages: ['es'],
        });
    });

    test('leaves spell checker language selection to macOS', () => {
        expect(getSpellCheckerSettings({}, 'darwin')).toEqual({
            supported: false,
            availableLanguages: [],
            selectedLanguages: [],
        });
    });

    test('applies only available languages and supports the automatic empty selection', () => {
        let selected = ['en-US'];
        const setSpellCheckerLanguagesMock = mock(languages => {
            selected = languages;
        });
        const electronSession = {
            availableSpellCheckerLanguages: ['en-US', 'es'],
            getSpellCheckerLanguages: () => selected,
            setSpellCheckerLanguages: setSpellCheckerLanguagesMock,
        };

        expect(setSpellCheckerLanguages(electronSession, ['es', 'xx'], 'win32').selectedLanguages).toEqual([
            'es',
        ]);
        expect(setSpellCheckerLanguagesMock).toHaveBeenLastCalledWith(['es']);

        expect(setSpellCheckerLanguages(electronSession, [], 'linux').selectedLanguages).toEqual([]);
        expect(setSpellCheckerLanguagesMock).toHaveBeenLastCalledWith([]);
    });

    test('does not configure languages on macOS', () => {
        const electronSession = { setSpellCheckerLanguages: mock(() => {}) };
        setSpellCheckerLanguages(electronSession, ['es'], 'darwin');
        expect(electronSession.setSpellCheckerLanguages).not.toHaveBeenCalled();
    });
});
