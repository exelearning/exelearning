/**
 * Start screen for the static (browser) and desktop application.
 *
 * There the blank project lives only in memory, so the screen opens as a
 * dialog over it: "New project" simply closes the dialog, and a file goes
 * through the same path as File > Open.
 */
import StartScreen from './startScreen.js';

/** localStorage: the author asked to start with a new project from now on. */
export const SKIP_KEY = 'exe-start-screen-skip';
/** sessionStorage: already offered in this window (New and Open reload the page). */
export const SEEN_KEY = 'exe-start-screen-seen';

function read(storage, key) {
    try {
        return storage.getItem(key);
    } catch (_e) {
        // Storage can be blocked (private mode, policy): behave as if unset.
        return null;
    }
}

function write(storage, key, value) {
    try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
    } catch (_e) {
        // Nothing to remember then; the screen is simply offered again.
    }
}

/**
 * Whether this launch should offer the start screen.
 * @param {Object} app
 * @param {{local?: Storage, session?: Storage, search?: string}} [env]
 * @returns {boolean}
 */
export function shouldShowStartScreen(app, env = {}) {
    const local = env.local || window.localStorage;
    const session = env.session || window.sessionStorage;
    const search = env.search ?? window.location.search;

    if (!app?.runtimeConfig?.isStaticMode?.()) return false;
    // An embedding host (LMS, CMS) decides which project is loaded.
    if (app.capabilities?.embedded?.enabled) return false;
    // The launch already names what to open: a file from the OS or a URL.
    if (app.pendingStaticOpenFiles?.length > 0 || app.pendingElectronOpenFiles?.length > 0) return false;
    if (new URLSearchParams(search).has('url')) return false;
    if (read(session, SEEN_KEY) === '1') return false;
    return read(local, SKIP_KEY) !== '1';
}

/**
 * A project file arrived from outside the dialog (OS file association, dock,
 * PWA launch): that answers the question. Close the dialog if it is open and
 * do not offer it in this window, not even after the reload the import does.
 * @param {Object} app
 * @param {{session?: Storage}} [env]
 */
export function dismissStartScreen(app, env = {}) {
    write(env.session || window.sessionStorage, SEEN_KEY, '1');
    app?.startScreen?.close();
}

/**
 * Translated strings. Kept as literal `_()` calls so they are extracted.
 * @returns {Record<string, string>}
 */
export function getStartScreenStrings() {
    return {
        appName: 'eXeLearning',
        title: _('Create a project or open one to get started'),
        newProject: _('New project'),
        openFromComputer: _('Open from this computer…'),
        dropHint: _('Or drop a project anywhere in this window'),
        dropFormats: _('.elpx, .elp, .zip'),
        dropNow: _('Drop to open this project'),
        dropNowDetail: _('It opens in this window.'),
        skipNextTime: _('Skip this and start with a new project'),
        close: _('Close'),
        invalidFile: _('Only project files can be opened (.elpx, .elp, .zip).'),
        actionError: _('That did not work. Please try again.'),
    };
}

/**
 * Offer the start screen once per window, unless this launch should not.
 * @param {Object} app
 * @param {{local?: Storage, session?: Storage, search?: string}} [env]
 * @returns {StartScreen|null}
 */
export function maybeShowStartScreen(app, env = {}) {
    if (!shouldShowStartScreen(app, env)) return null;
    const local = env.local || window.localStorage;
    const session = env.session || window.sessionStorage;
    write(session, SEEN_KEY, '1');

    const screen = new StartScreen({
        strings: getStartScreenStrings(),
        modal: true,
        // The blank project is already there: choosing it only closes the dialog.
        onNew: () => screen.close(),
        onOpenFile: async (file) => {
            await app.menus.navbar.file.openLocalFile(file);
            screen.close();
        },
        skipOption: {
            get: () => read(local, SKIP_KEY) === '1',
            set: (skip) => write(local, SKIP_KEY, skip ? '1' : null),
        },
    });
    screen.mount();
    return screen;
}
