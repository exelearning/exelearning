/**
 * Start screen for the static (browser) and desktop application.
 *
 * There the blank project lives only in memory, so the screen opens as a
 * dialog over it: "New project" simply closes the dialog, and a file goes
 * through the same path as File > Open. The desktop app adds its recent files.
 */
import StartScreen from './startScreen.js';
import {
    isRecentHandlesSupported,
    listRecentHandles,
    openRecentHandle,
    pickProjectFile,
    rememberDroppedFile,
} from './recentHandles.js';

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
        tabRecent: _('Recent projects'),
        loading: _('Loading…'),
        loadError: _('The project list could not be loaded.'),
        empty: _('Projects you open or save will be listed here.'),
        onThisDevice: _('On this device'),
    };
}

/**
 * Recent project files, where the host keeps such a list (the desktop app).
 * The list holds names and opaque ids; the main process opens by id.
 * @param {Record<string, string>} strings
 * @param {Object} [api] - window.electronAPI
 * @returns {Object} Options for StartScreen, empty when there is no list
 */
export function getRecentFilesOptions(strings, api = window.electronAPI) {
    if (typeof api?.getRecentFiles !== 'function' || typeof api?.openRecentFile !== 'function') return {};
    return {
        tabs: [{ id: 'recent', label: strings.tabRecent }],
        loadItems: async () => {
            const files = (await api.getRecentFiles()) || [];
            return {
                recent: files.map((file) => ({ id: file.id, title: file.name, meta: file.folder, when: file.openedAt })),
            };
        },
        // The main process reloads this window and opens the file in the fresh page.
        onOpenItem: async (item) => {
            if ((await api.openRecentFile(item.id)) !== true) throw new Error('Recent file is not available');
        },
    };
}

/**
 * Recent project files in a browser that can keep file handles (Chromium).
 * Reopening one reads the same file from disk again; the browser asks for
 * permission when it no longer holds it.
 * @param {Record<string, string>} strings
 * @param {(file: File) => Promise<void>} openFile
 * @param {Object} [handles] - The recentHandles module (injectable for tests)
 * @returns {Object} Options for StartScreen, empty when not supported
 */
export function getRecentHandlesOptions(
    strings,
    openFile,
    handles = { isRecentHandlesSupported, listRecentHandles, openRecentHandle, pickProjectFile, rememberDroppedFile },
) {
    if (!handles.isRecentHandlesSupported()) return {};
    return {
        tabs: [{ id: 'recent', label: strings.tabRecent }],
        loadItems: async () => ({
            recent: (await handles.listRecentHandles()).map((record) => ({
                id: record.id,
                title: record.name,
                meta: strings.onThisDevice,
                when: record.openedAt,
            })),
        }),
        onOpenItem: async (item) => openFile(await handles.openRecentHandle(item.id)),
        pickFile: () => handles.pickProjectFile(),
        onFileDropped: (dataTransfer) => void handles.rememberDroppedFile(dataTransfer),
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

    const strings = getStartScreenStrings();
    const openFile = async (file) => {
        await app.menus.navbar.file.openLocalFile(file);
        screen.close();
    };
    const screen = new StartScreen({
        strings,
        modal: true,
        ...getRecentHandlesOptions(strings, openFile),
        ...getRecentFilesOptions(strings),
        // The blank project is already there: choosing it only closes the dialog.
        onNew: () => screen.close(),
        onOpenFile: openFile,
        skipOption: {
            get: () => read(local, SKIP_KEY) === '1',
            set: (skip) => write(local, SKIP_KEY, skip ? '1' : null),
        },
    });
    screen.mount();
    return screen;
}
