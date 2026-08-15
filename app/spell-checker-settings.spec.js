const { describe, expect, test, mock } = require('bun:test');
const {
    SYSTEM_DEFAULT,
    SPELL_CHECKER_MODE_LANGUAGES,
    normalizeSpellCheckerSelection,
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

    test('prefers concrete languages when the system sentinel is also submitted', () => {
        expect(normalizeSpellCheckerSelection([SYSTEM_DEFAULT, 'es'])).toEqual({
            mode: SPELL_CHECKER_MODE_LANGUAGES,
            languages: ['es'],
        });
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
        expect(resolveSystemSpellCheckerLanguages('xx', ['es', 'en-US'])).toEqual(['en-US']);
        expect(resolveSystemSpellCheckerLanguages('xx', ['es'])).toEqual([]);
    });

    test('leaves spell checker language selection to macOS', () => {
        expect(getSpellCheckerSettings({}, 'darwin')).toEqual({
            supported: false,
            availableLanguages: [],
            selectedLanguages: [],
            systemDefault: true,
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

        const result = setSpellCheckerLanguages(electronSession, [SYSTEM_DEFAULT], 'linux', 'es-ES');
        expect(electronSession.setSpellCheckerLanguages).not.toHaveBeenCalled();
        expect(result.systemDefault).toBe(false);
        expect(result.applied).toBe(false);
    });
});
