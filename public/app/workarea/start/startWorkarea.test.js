import {
    SEEN_KEY,
    SKIP_KEY,
    dismissStartScreen,
    getStartScreenStrings,
    maybeShowStartScreen,
    shouldShowStartScreen,
} from './startWorkarea.js';

function memoryStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, String(value)),
        removeItem: (key) => data.delete(key),
    };
}

const brokenStorage = {
    getItem: () => {
        throw new Error('blocked');
    },
    setItem: () => {
        throw new Error('blocked');
    },
    removeItem: () => {
        throw new Error('blocked');
    },
};

function makeApp(overrides = {}) {
    return {
        runtimeConfig: { isStaticMode: () => true },
        capabilities: { embedded: { enabled: false } },
        pendingStaticOpenFiles: [],
        pendingElectronOpenFiles: [],
        menus: { navbar: { file: { openLocalFile: vi.fn().mockResolvedValue(undefined) } } },
        ...overrides,
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('start screen in the static and desktop app', () => {
    let env;
    let screen;

    beforeEach(() => {
        window._ = (text) => text;
        env = { local: memoryStorage(), session: memoryStorage(), search: '' };
    });

    afterEach(() => {
        screen?.destroy();
        screen = null;
        document.body.replaceChildren();
        vi.restoreAllMocks();
    });

    describe('shouldShowStartScreen', () => {
        it('shows on a fresh launch of the static app', () => {
            expect(shouldShowStartScreen(makeApp(), env)).toBe(true);
        });

        it('never shows online, where the start page already did the asking', () => {
            expect(shouldShowStartScreen(makeApp({ runtimeConfig: { isStaticMode: () => false } }), env)).toBe(false);
            expect(shouldShowStartScreen(null, env)).toBe(false);
        });

        it('never shows inside an embedding host', () => {
            expect(shouldShowStartScreen(makeApp({ capabilities: { embedded: { enabled: true } } }), env)).toBe(false);
        });

        it('stays out of the way when the launch already names a file or a URL', () => {
            expect(shouldShowStartScreen(makeApp({ pendingStaticOpenFiles: [{}] }), env)).toBe(false);
            expect(shouldShowStartScreen(makeApp({ pendingElectronOpenFiles: ['/a.elpx'] }), env)).toBe(false);
            expect(shouldShowStartScreen(makeApp(), { ...env, search: '?url=https://example.org/a.elpx' })).toBe(false);
        });

        it('is offered once per window, so the reload after New or Open does not ask again', () => {
            env.session.setItem(SEEN_KEY, '1');
            expect(shouldShowStartScreen(makeApp(), env)).toBe(false);
        });

        it('respects the "skip" preference', () => {
            env.local.setItem(SKIP_KEY, '1');
            expect(shouldShowStartScreen(makeApp(), env)).toBe(false);
        });

        it('still shows when storage is blocked', () => {
            expect(shouldShowStartScreen(makeApp(), { local: brokenStorage, session: brokenStorage, search: '' })).toBe(
                true,
            );
        });

        it('reads the browser storage and URL by default', () => {
            window.sessionStorage.removeItem(SEEN_KEY);
            window.localStorage.removeItem(SKIP_KEY);
            expect(shouldShowStartScreen(makeApp())).toBe(true);
        });
    });

    describe('maybeShowStartScreen', () => {
        it('returns nothing when it should not show', () => {
            env.local.setItem(SKIP_KEY, '1');
            expect(maybeShowStartScreen(makeApp(), env)).toBeNull();
            expect(document.querySelector('.exe-start')).toBeNull();
        });

        it('opens a modal dialog without project lists and marks the window as asked', () => {
            screen = maybeShowStartScreen(makeApp(), env);

            const dialog = document.querySelector('dialog.exe-start');
            expect(dialog.open).toBe(true);
            expect(dialog.querySelector('.exe-start__main')).toBeNull();
            expect(env.session.getItem(SEEN_KEY)).toBe('1');
        });

        it('keeps the blank project when New project is chosen', async () => {
            const app = makeApp();
            screen = maybeShowStartScreen(app, env);

            document.querySelector('.exe-start__button--primary').click();
            await flush();

            expect(document.querySelector('.exe-start')).toBeNull();
            expect(app.menus.navbar.file.openLocalFile).not.toHaveBeenCalled();
        });

        it('opens a dropped file through File > Open and closes', async () => {
            const app = makeApp();
            screen = maybeShowStartScreen(app, env);
            const file = new File(['x'], 'unit.elpx');
            const drop = new Event('drop', { bubbles: true, cancelable: true });
            drop.dataTransfer = { types: ['Files'], files: [file] };

            document.querySelector('.exe-start').dispatchEvent(drop);
            await flush();

            expect(app.menus.navbar.file.openLocalFile).toHaveBeenCalledWith(file);
            expect(document.querySelector('.exe-start')).toBeNull();
        });

        it('stores and clears the skip preference from the checkbox', () => {
            screen = maybeShowStartScreen(makeApp(), env);
            const checkbox = document.querySelector('.exe-start__skip input');
            expect(checkbox.checked).toBe(false);

            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
            expect(env.local.getItem(SKIP_KEY)).toBe('1');

            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));
            expect(env.local.getItem(SKIP_KEY)).toBeNull();
        });

        it('works with blocked storage and with the browser defaults', () => {
            screen = maybeShowStartScreen(makeApp(), { local: brokenStorage, session: brokenStorage, search: '' });
            const checkbox = document.querySelector('.exe-start__skip input');
            checkbox.checked = true;
            expect(() => checkbox.dispatchEvent(new Event('change'))).not.toThrow();
            screen.destroy();

            window.sessionStorage.removeItem(SEEN_KEY);
            window.localStorage.removeItem(SKIP_KEY);
            screen = maybeShowStartScreen(makeApp());
            expect(window.sessionStorage.getItem(SEEN_KEY)).toBe('1');
            window.sessionStorage.removeItem(SEEN_KEY);
        });
    });

    describe('dismissStartScreen', () => {
        it('closes an open dialog and keeps it from being offered after the import reloads the page', () => {
            const app = makeApp();
            app.startScreen = maybeShowStartScreen(app, env);
            env.session.removeItem(SEEN_KEY);

            dismissStartScreen(app, env);

            expect(document.querySelector('.exe-start')).toBeNull();
            expect(shouldShowStartScreen(app, env)).toBe(false);
        });

        it('marks the window before the dialog was ever shown', () => {
            const app = makeApp();

            dismissStartScreen(app, env);

            expect(maybeShowStartScreen(app, env)).toBeNull();
        });

        it('tolerates a missing app and uses the browser session by default', () => {
            window.sessionStorage.removeItem(SEEN_KEY);
            expect(() => dismissStartScreen(null)).not.toThrow();
            expect(window.sessionStorage.getItem(SEEN_KEY)).toBe('1');
            window.sessionStorage.removeItem(SEEN_KEY);
        });
    });

    it('provides every string the dialog shows', () => {
        const strings = getStartScreenStrings();
        for (const key of ['title', 'newProject', 'openFromComputer', 'dropHint', 'skipNextTime', 'close']) {
            expect(strings[key]).toBeTruthy();
        }
    });
});
