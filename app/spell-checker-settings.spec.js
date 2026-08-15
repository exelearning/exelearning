const { describe, expect, test, mock } = require('bun:test');
const {
    SYSTEM_DEFAULT,
    filterSpellCheckerLanguages,
    resolveSystemSpellCheckerLanguages,
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
            systemDefault: true,
        });
    });

    test('resolves the system locale to an available dictionary', () => {
        expect(resolveSystemSpellCheckerLanguages('es-ES', ['en-US', 'es'])).toEqual(['es']);
        expect(resolveSystemSpellCheckerLanguages('pt-BR', ['en-US', 'pt-PT'])).toEqual(['pt-PT']);
        expect(resolveSystemSpellCheckerLanguages('xx', ['en-US', 'es'], ['es'])).toEqual(['es']);
    });

    test('leaves spell checker language selection to macOS', () => {
        expect(getSpellCheckerSettings({}, 'darwin')).toEqual({
            supported: false,
            availableLanguages: [],
            selectedLanguages: [],
        });
    });

    test('applies only available languages and resolves System default without passing an empty list', () => {
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

        const automatic = setSpellCheckerLanguages(
            electronSession,
            [SYSTEM_DEFAULT],
            'linux',
            'es-ES'
        );
        expect(automatic.selectedLanguages).toEqual(['es']);
        expect(automatic.systemDefault).toBe(true);
        expect(setSpellCheckerLanguagesMock).toHaveBeenLastCalledWith(['es']);
    });

    test('does not configure languages on macOS', () => {
        const electronSession = { setSpellCheckerLanguages: mock(() => {}) };
        setSpellCheckerLanguages(electronSession, ['es'], 'darwin');
        expect(electronSession.setSpellCheckerLanguages).not.toHaveBeenCalled();
    });

    test('does not pass an empty language list when no dictionaries are available', () => {
        const electronSession = {
            availableSpellCheckerLanguages: [],
            getSpellCheckerLanguages: () => [],
            setSpellCheckerLanguages: mock(() => {}),
        };

        setSpellCheckerLanguages(electronSession, [SYSTEM_DEFAULT], 'linux', 'es-ES');
        expect(electronSession.setSpellCheckerLanguages).not.toHaveBeenCalled();
    });
});
