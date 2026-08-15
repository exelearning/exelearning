const { describe, expect, test, mock } = require('bun:test');
const {
    SYSTEM_DEFAULT,
    SPELL_CHECKER_MODE_LANGUAGES,
    normalizeSpellCheckerSelection,
    filterSpellCheckerLanguages,
    resolveSystemSpellCheckerLanguages,
    getSpellCheckerSettings,
    setSpellCheckerLanguages,
    getPersistedSpellCheckerSelection,
    createSpellCheckerController,
    registerSpellCheckerIpc,
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

    test('ignores an invalid persisted explicit-language selection at startup', () => {
        expect(getPersistedSpellCheckerSelection({
            spellChecker: { mode: SPELL_CHECKER_MODE_LANGUAGES, languages: [] },
        })).toBeNull();
    });

    test('registers pure-read and write IPC handlers', async () => {
        const handlers = new Map();
        const ipcMain = { handle: mock((channel, handler) => handlers.set(channel, handler)) };
        const controller = {
            getSettings: mock(() => ({ supported: true })),
            setLanguages: mock(languages => ({ selectedLanguages: languages })),
        };

        registerSpellCheckerIpc(ipcMain, controller);

        expect(await handlers.get('app:getSpellCheckerSettings')()).toEqual({ supported: true });
        expect(await handlers.get('app:setSpellCheckerLanguages')(null, ['es'])).toEqual({
            selectedLanguages: ['es'],
        });
        expect(controller.setLanguages).toHaveBeenCalledWith(['es']);
    });

    test('restores persisted languages once and keeps the getter free of session writes', () => {
        let selected = ['en-US'];
        const electronSession = {
            availableSpellCheckerLanguages: ['en-US', 'es'],
            getSpellCheckerLanguages: () => selected,
            setSpellCheckerLanguages: mock(languages => {
                selected = languages;
            }),
        };
        const controller = createSpellCheckerController({
            electronSession,
            platform: 'linux',
            systemLocale: 'en-US',
            readSettings: () => ({
                spellChecker: { mode: SPELL_CHECKER_MODE_LANGUAGES, languages: ['es'] },
            }),
            writeSettings: mock(() => {}),
        });

        controller.applyPersisted();
        expect(electronSession.setSpellCheckerLanguages).toHaveBeenCalledTimes(1);
        expect(electronSession.setSpellCheckerLanguages).toHaveBeenLastCalledWith(['es']);

        expect(controller.getSettings().selectedLanguages).toEqual(['es']);
        expect(electronSession.setSpellCheckerLanguages).toHaveBeenCalledTimes(1);
    });

    test('does not persist or report an unavailable requested mode', () => {
        const writeSettings = mock(() => {});
        const electronSession = {
            availableSpellCheckerLanguages: [],
            getSpellCheckerLanguages: () => [],
            setSpellCheckerLanguages: mock(() => {}),
        };
        const controller = createSpellCheckerController({
            electronSession,
            platform: 'linux',
            systemLocale: 'xx',
            readSettings: () => ({
                spellChecker: { mode: SPELL_CHECKER_MODE_LANGUAGES, languages: ['es'] },
            }),
            writeSettings,
        });

        const result = controller.setLanguages([SYSTEM_DEFAULT]);

        expect(result).toEqual(expect.objectContaining({ systemDefault: false, applied: false }));
        expect(writeSettings).not.toHaveBeenCalled();
        expect(electronSession.setSpellCheckerLanguages).not.toHaveBeenCalled();
    });

    test('persists an applied selection and removes the legacy setting', () => {
        let selected = ['en-US'];
        const settings = { spellCheckerUseSystemDefault: true };
        const writeSettings = mock(() => {});
        const controller = createSpellCheckerController({
            electronSession: {
                availableSpellCheckerLanguages: ['en-US', 'es'],
                getSpellCheckerLanguages: () => selected,
                setSpellCheckerLanguages: languages => {
                    selected = languages;
                },
            },
            platform: 'win32',
            readSettings: () => settings,
            writeSettings,
        });

        controller.setLanguages(['es']);

        expect(writeSettings).toHaveBeenCalledWith({
            spellChecker: { mode: SPELL_CHECKER_MODE_LANGUAGES, languages: ['es'] },
        });
    });
});
