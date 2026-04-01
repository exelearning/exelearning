const { app, protocol, net, BrowserWindow, dialog, session, ipcMain, Menu, systemPreferences, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { pathToFileURL } = require('url');

const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const fflate = require('fflate');
const https = require('https');

const { initAutoUpdater } = require('./update-manager');
const contextMenu = require('electron-context-menu').default;

// Register custom protocol BEFORE app.whenReady()
// CRITICAL: This must be called before any window is created
// Enables Service Workers with custom protocols (supported in Electron 10.x+)
protocol.registerSchemesAsPrivileged([{
    scheme: 'app',
    privileges: {
        standard: true,           // URLs follow RFC 3986
        secure: true,             // Treated as HTTPS (required for SW)
        allowServiceWorkers: true, // CRITICAL: Enables Service Workers
        supportFetchAPI: true,    // Allows fetch() requests
        corsEnabled: true,        // Allows CORS
        stream: true,             // Enables streaming for media
    }
}]);

// Determine the base path depending on whether the app is packaged when we enable "asar" packaging
const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();

/**
 * Get the path to the static files directory.
 * In packaged mode, static files are inside the ASAR at dist/static/.
 * In dev mode, static files are in the project root's dist/static/ (parent of app/).
 */
function getStaticPath() {
    if (app.isPackaged) {
        return path.join(app.getAppPath(), 'dist', 'static');
    }
    // Dev mode: look in project root (parent of app/)
    const devPath = path.join(__dirname, '..', 'dist', 'static');
    if (fs.existsSync(devPath)) {
        return devPath;
    }
    // Fallback to app/dist/static if copied there
    return path.join(__dirname, 'dist', 'static');
}

/**
 * MIME types for common file extensions
 */
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.ogv': 'video/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.m4v': 'video/mp4',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml',
    '.xhtml': 'application/xhtml+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.zip': 'application/zip',
    '.swf': 'application/x-shockwave-flash',
    '.dtd': 'application/xml-dtd',
};

/**
 * Register the app:// protocol handler
 * Serves static files from the static directory
 * @returns {void}
 */
function registerProtocolHandler() {
    if (protocolHandlerRegistered) {
        return;
    }

    const staticDir = getStaticPath();

    protocol.handle('app', async (request) => {
        const url = new URL(request.url);
        let pathname = decodeURIComponent(url.pathname);

        // Default route
        if (pathname === '/' || pathname === '') {
            pathname = '/index.html';
        }

        // Security: prevent path traversal
        const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(staticDir, safePath);

        // Verify file is within static directory
        if (!filePath.startsWith(staticDir)) {
            return new Response('Forbidden', { status: 403 });
        }

        // SPA fallback: serve index.html for routes without file extensions
        const spaFallback = () => {
            if (!path.extname(pathname)) {
                const indexPath = path.join(staticDir, 'index.html');
                return net.fetch(pathToFileURL(indexPath).toString());
            }
            return new Response('Not Found', { status: 404 });
        };

        try {
            // net.fetch can read from ASAR archives
            const fileUrl = pathToFileURL(filePath).toString();
            let response;
            try {
                response = await net.fetch(fileUrl);
            } catch {
                // net.fetch throws ERR_FILE_NOT_FOUND for missing files
                return spaFallback();
            }

            if (!response.ok) {
                return spaFallback();
            }

            // Determine MIME type
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

            // Build headers
            const headers = { 'Content-Type': mimeType };

            // Special headers for Service Worker
            if (pathname === '/preview-sw.js') {
                headers['Service-Worker-Allowed'] = '/';
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            }

            return new Response(await response.arrayBuffer(), {
                status: 200,
                headers,
            });
        } catch (error) {
            console.error('[Protocol] Error serving file:', filePath, error);
            return new Response('Internal Server Error', { status: 500 });
        }
    });

    protocolHandlerRegistered = true;
    console.log('[Electron] Protocol handler registered for app://');
}

// Optional: force a predictable path/name
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log');

// files to open after app ready
let pendingOpenFiles = [];
// Pending .elpx path per renderer WebContents id (sent when renderer is ready)
const pendingOpenFileByWebContentsId = new Map();

autoUpdater.logger = log;
autoUpdater.allowPrerelease = false;
autoUpdater.forceDevUpdateConfig = false;
// We control the flow with our own dialogs
autoUpdater.autoDownload = false;

// Mirror console.* to electron-log so GUI builds persist logs to file
const origConsole = { log: console.log, error: console.error, warn: console.warn };
console.log = (...args) => {
    log.info(...args);
    origConsole.log(...args);
};
console.warn = (...args) => {
    log.warn(...args);
    origConsole.warn(...args);
};
console.error = (...args) => {
    log.error(...args);
    origConsole.error(...args);
};

// Safety: capture crashes/unhandled
process.on('uncaughtException', e => log.error('uncaughtException:', e));
process.on('unhandledRejection', e => log.error('unhandledRejection:', e));

// Locale detection for fallback strings
const defaultLocale = app.getLocale().startsWith('es') ? 'es' : 'en';
console.log(`Default locale: ${defaultLocale}.`);

let appDataPath;

let mainWindow;
let isShuttingDown = false; // Flag to ensure the app only shuts down once
let updaterInited = false; // guard
let youtubeHeadersConfigured = false;
let protocolHandlerRegistered = false;
const windowsClosingByConfirmation = new WeakSet();
const windowsCheckingUnsavedChanges = new WeakSet();
const UNSAVED_CHANGES_CLOSE_ACTION = Object.freeze({
    STAY: 0,
    DISCARD: 1,
});

// Environment variables container
let customEnv;
let env;

// ──────────────  Save/Export helpers  ──────────────
const DEFAULT_EXTENSION = '.elpx';

/**
 * Extract a file extension from a file path or suggested name.
 * Returns the lowercase extension (including the leading dot) if present, null otherwise.
 * @param {string} filePathOrName - File path or suggested filename
 * @returns {string|null} Extension (e.g., '.elpx', '.csv') or null
 */
function getExt(filePathOrName) {
    try {
        const ext = path.extname(filePathOrName || '') || '';
        if (!ext) return null;
        return ext.toLowerCase();
    } catch (_e) {
        return null;
    }
}

// Ensures the filePath has an extension; if missing, appends one inferred from suggestedName.
function ensureExt(filePath, suggestedName) {
    if (!filePath) return filePath;
    const currentExt = getExt(filePath);
    if (currentExt) return filePath;
    const inferred = getExt(suggestedName);
    return inferred ? filePath + inferred : filePath;
}

function getDialogFilterForExt(ext) {
    switch ((ext || '').toLowerCase()) {
        case '.elpx':
            return { name: 'eXeLearning project', extensions: ['elpx'] };
        case '.zip':
            return { name: 'ZIP archive', extensions: ['zip'] };
        case '.epub':
            return { name: 'EPUB', extensions: ['epub'] };
        case '.xml':
            return { name: 'XML document', extensions: ['xml'] };
        case '.csv':
            return { name: 'CSV file', extensions: ['csv'] };
        case '.idevice':
            return { name: 'eXeLearning iDevice', extensions: ['idevice'] };
        case '.block':
            return { name: 'eXeLearning block', extensions: ['block'] };
        default: {
            if (!ext) return null;
            const clean = ext.replace(/^\./, '');
            return { name: `${clean.toUpperCase()} file`, extensions: [clean] };
        }
    }
}

function proposeSavePath(lastDir, effectiveName = null) {
    try {
        const ext = getExt(effectiveName) || DEFAULT_EXTENSION;
        const dir = lastDir || app.getPath('documents');
        const base = effectiveName
            ? path.basename(effectiveName, path.extname(effectiveName))
            : 'document';
        return path.join(dir, `${base}${ext}`);
    } catch (_e) {
        return effectiveName || `document${DEFAULT_EXTENSION}`;
    }
}

async function promptSave(owner, suggestedName = null, lastDir = null, storedName = null) {
    // suggestedName (caller-computed, dynamic) takes priority over storedName (last saved filename).
    // lastDir is used as the directory regardless, so the remembered folder is preserved.
    const effectiveName = suggestedName || storedName;
    const inferredExt = getExt(effectiveName) || DEFAULT_EXTENSION;
    const filter = getDialogFilterForExt(inferredExt);
    const isProject = inferredExt === '.elpx';
    const { filePath, canceled } = await dialog.showSaveDialog(owner, {
        title: isProject
            ? tOrDefault('save.dialogTitle', defaultLocale === 'es' ? 'Guardar proyecto' : 'Save project')
            : tOrDefault('save.downloadTitle', defaultLocale === 'es' ? 'Guardar archivo' : 'Save file'),
        defaultPath: proposeSavePath(lastDir, effectiveName),
        buttonLabel: tOrDefault('save.button', defaultLocale === 'es' ? 'Guardar' : 'Save'),
        ...(filter ? { filters: [filter] } : {}),
    });
    if (canceled || !filePath) return null;
    return ensureExt(filePath, effectiveName || `document${DEFAULT_EXTENSION}`);
}

// ──────────────  Simple settings (no external deps)  ──────────────
// Persist user choices under userData/settings.json
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
    try {
        const p = SETTINGS_FILE();
        if (!fs.existsSync(p)) return {};
        const data = fs.readFileSync(p, 'utf8');
        return JSON.parse(data || '{}');
    } catch (_e) {
        return {};
    }
}

function writeSettings(obj) {
    try {
        fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
        fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(obj, null, 2), 'utf8');
    } catch (_e) {
        // Best-effort; ignore
    }
}

function getLastSaveDir(key) {
    const s = readSettings();
    return s.lastSaveDir?.[key] || null;
}

function setLastSaveDir(key, dirPath) {
    const s = readSettings();
    s.lastSaveDir = s.lastSaveDir || {};
    s.lastSaveDir[key] = dirPath;
    writeSettings(s);
}

function getLastSaveInfo(key) {
    const s = readSettings();
    return {
        dir: s.lastSaveDir?.[key] || null,
        name: s.lastSaveName?.[key] || null,
    };
}

function setLastSaveInfo(key, dirPath, fileName) {
    const s = readSettings();
    s.lastSaveDir = s.lastSaveDir || {};
    s.lastSaveDir[key] = dirPath;
    s.lastSaveName = s.lastSaveName || {};
    s.lastSaveName[key] = fileName;
    writeSettings(s);
}

// Map of webContents.id -> next projectKey override for the next download
const nextDownloadKeyByWC = new Map();
const nextDownloadNameByWC = new Map();
// Deduplicate bursts of downloads for the same WC/URL (prevents double pickers)
const lastDownloadByWC = new Map(); // wcId -> { url: string, time: number }

/**
 * Perform "run-once per version" maintenance.
 * Stores the current version in settings.json to avoid repeating the work.
 */
function ensurePerVersionSetup() {
    const currentVersion = app.getVersion();
    const s = readSettings();
    const previousVersion = s.appVersion || null;

    if (previousVersion !== currentVersion) {
        // Persist the current version to avoid repeating the maintenance on the next run
        s.appVersion = currentVersion;
        writeSettings(s);
    }
}

function initializePaths() {
    appDataPath = app.getPath('userData');
    console.log(`APP data path: ${appDataPath}`);
}
// Define environment variables after initializing paths
// Note: In static mode, everything is client-side (Yjs + IndexedDB), no server directories needed
function initializeEnv() {
    const isDev = determineDevMode();
    const appEnv = isDev ? 'dev' : 'prod';

    customEnv = {
        APP_ENV: process.env.APP_ENV || appEnv,
        APP_DEBUG: process.env.APP_DEBUG ?? (isDev ? 1 : 0),
        EXELEARNING_DEBUG_MODE: (process.env.EXELEARNING_DEBUG_MODE ?? (isDev ? '1' : '0')).toString(),
    };
}
/**
 * Determine if dev mode is enabled.
 *
 * Priority:
 * 1. CLI flag --dev=1/true
 * 2. APP_ENV=dev environment variable
 * 3. EXELEARNING_DEBUG_MODE (legacy fallback)
 *
 * @returns {boolean}
 */
function determineDevMode() {
    // Check CLI argument first: --dev=1 or --dev=true
    const cliArg = process.argv.find(arg => arg.startsWith('--dev='));
    if (cliArg) {
        const value = cliArg.split('=')[1].toLowerCase();
        return value === 'true' || value === '1';
    }

    // Check APP_ENV (primary method)
    if (process.env.APP_ENV) {
        return process.env.APP_ENV === 'dev';
    }

    // Legacy fallback: EXELEARNING_DEBUG_MODE
    const envVal = process.env.EXELEARNING_DEBUG_MODE;
    if (envVal) {
        const value = envVal.toLowerCase();
        return value === 'true' || value === '1';
    }

    return false;
}

/**
 * Determine if auto-update should be disabled.
 *
 * Priority:
 * 1. CLI flag (--no-update-check or --disable-updates)
 * 2. Environment variable (DISABLE_AUTO_UPDATE=1)
 * 3. CI environment (CI=1 or CI=true)
 * 4. Development version (0.0.0, *-alpha, *-beta, *-dev)
 *
 * @returns {{ disabled: boolean, reason: string }}
 */
function shouldDisableAutoUpdate() {
    // CLI flags
    const disableFlag = process.argv.some(arg =>
        arg === '--no-update-check' || arg === '--disable-updates'
    );
    if (disableFlag) {
        return { disabled: true, reason: 'CLI flag (--no-update-check or --disable-updates)' };
    }

    // Environment variable
    const envDisable = process.env.DISABLE_AUTO_UPDATE;
    if (envDisable === '1' || envDisable === 'true') {
        return { disabled: true, reason: 'Environment variable (DISABLE_AUTO_UPDATE=1)' };
    }

    // CI environment
    if (process.env.CI === '1' || process.env.CI === 'true') {
        return { disabled: true, reason: 'CI environment detected (CI=1)' };
    }

    // Development version
    const version = app.getVersion();
    if (version === '0.0.0' || version === '0.0.0-alpha' ||
        version.includes('-alpha') || version.includes('-beta') || version.includes('-dev')) {
        return { disabled: true, reason: `Development version detected (${version})` };
    }

    return { disabled: false, reason: '' };
}

function combineEnv() {
    // Merge process.env first, then customEnv, so customEnv takes priority
    // This ensures our corrected directory paths (with empty string handling) override system env vars
    env = Object.assign({}, process.env, customEnv);
}

function applyCombinedEnvToProcess() {
    // Ensure the spawned backend sees the combined env variables.
    Object.assign(process.env, env || {});
}


// Detecta si una URL es externa (debe abrirse en navegador del sistema)
function isExternalUrl(url) {
    try {
        const parsed = new URL(url);
        // URLs blob: y about: son internas (usadas por preview)
        if (parsed.protocol === 'blob:' || parsed.protocol === 'about:') {
            return false;
        }
        // app:// protocol is internal (our custom protocol)
        if (parsed.protocol === 'app:') {
            return false;
        }
        // URLs http/https que no sean localhost son externas
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            const host = parsed.hostname.toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1') {
                return false;
            }
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

// Handler factory: creates an identical handler for any window
function attachOpenHandler(win) {
    // Get parent size & position
    const { width, height } = win.getBounds();
    const [mainX, mainY] = win.getPosition();

    win.webContents.setWindowOpenHandler(({ url }) => {
        // URLs externas → abrir en navegador del sistema
        if (isExternalUrl(url)) {
            shell.openExternal(url);
            return { action: 'deny' };
        }

        // For internal URLs (blob:, about:blank, localhost), let Electron handle automatically
        // This ensures window.open() returns a proper reference so fallback code doesn't run
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                x: mainX + 10,
                y: mainY + 10,
                width,
                height,
                modal: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'preload.js'),
                },
                tabbingIdentifier: 'mainGroup',
            },
        };
    });

    // Attach open handler to child windows when they're created
    win.webContents.on('did-create-window', (childWindow) => {
        attachOpenHandler(childWindow);
    });

    // Interceptar navegación a URLs externas (enlaces sin target="_blank")
    win.webContents.on('will-navigate', (event, url) => {
        if (isExternalUrl(url)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });
}

/**
 * Ensure YouTube embeds receive HTTP headers required by their anti-abuse checks.
 * In Electron with custom protocols (app://), Referer can be missing/unsupported,
 * which may trigger YouTube error 153.
 */
function configureYouTubeEmbedHeaders() {
    if (youtubeHeadersConfigured) return;
    youtubeHeadersConfigured = true;

    const filter = {
        urls: [
            '*://youtube.com/*',
            '*://*.youtube.com/*',
            '*://youtube-nocookie.com/*',
            '*://*.youtube-nocookie.com/*',
        ],
    };

    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        const headers = details.requestHeaders || {};
        const referer = headers.Referer || headers.referer || '';

        // app:// and file:// referers are not accepted by YouTube embed checks.
        const hasInvalidReferer =
            !referer ||
            referer.startsWith('app://') ||
            referer.startsWith('file://');

        if (hasInvalidReferer) {
            headers.Referer = 'https://localhost/';
            headers.Origin = headers.Origin || headers.origin || 'https://localhost';
        }

        callback({ requestHeaders: headers });
    });
}

function confirmWindowCloseWithUnsavedChanges(ownerWindow, copy) {
    const response = dialog.showMessageBoxSync(ownerWindow, {
        type: 'warning',
        buttons: [copy.stayButtonLabel, copy.discardButtonLabel],
        defaultId: UNSAVED_CHANGES_CLOSE_ACTION.STAY,
        cancelId: UNSAVED_CHANGES_CLOSE_ACTION.STAY,
        noLink: true,
        normalizeAccessKeys: true,
        title: copy.title,
        message: copy.message,
        detail: copy.detail,
    });

    return response === UNSAVED_CHANGES_CLOSE_ACTION.DISCARD;
}

async function windowHasUnsavedChanges(win) {
    if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
        return false;
    }

    try {
        return await win.webContents.executeJavaScript(
            `(() => {
                const bridge = window.eXeLearning?.app?.project?._yjsBridge;
                const documentManager = bridge?.documentManager;
                const assetManager = bridge?.assetManager;
                const hasUnsavedAssets =
                    assetManager &&
                    typeof assetManager.hasUnsavedAssets === 'function' &&
                    assetManager.hasUnsavedAssets();
                return documentManager?.isDirty === true || Boolean(hasUnsavedAssets);
            })()`,
            true,
        );
    } catch (error) {
        console.warn('[Electron] Failed to read unsaved changes state from renderer:', error);
        return false;
    }
}

function getUnsavedChangesCloseCopy() {
    return {
        title: tOrDefault(
            'desktop.unsavedChanges.title',
            defaultLocale === 'es' ? 'Cambios sin guardar' : 'Unsaved changes',
        ),
        message: tOrDefault(
            'desktop.unsavedChanges.message',
            defaultLocale === 'es'
                ? 'Hay cambios sin guardar en este proyecto.'
                : 'This project has unsaved changes.',
        ),
        detail: tOrDefault(
            'desktop.unsavedChanges.detail',
            defaultLocale === 'es'
                ? 'Si cierras ahora, se perderán los cambios más recientes. Puedes quedarte para guardar el proyecto primero.'
                : 'If you close now, your latest changes will be lost. Stay to save the project first.',
        ),
        stayButtonLabel: tOrDefault(
            'desktop.unsavedChanges.stay',
            defaultLocale === 'es' ? 'Permanecer' : 'Stay',
        ),
        discardButtonLabel: tOrDefault(
            'desktop.unsavedChanges.discard',
            defaultLocale === 'es' ? 'Cerrar sin guardar' : 'Close without saving',
        ),
    };
}

/**
 * Ask the renderer for the translated close-dialog copy via IPC.
 * Falls back to null if the renderer does not respond within 3 seconds,
 * so the caller can use getUnsavedChangesCloseCopy() as a fallback.
 *
 * Requires preload.js to expose:
 *   onGetCloseCopy: (cb) => ipcRenderer.on('app:get-close-copy', (_e) => cb())
 *   sendCloseCopy:  (copy) => ipcRenderer.send('app:close-copy-response', copy)
 *
 * And app.js to register:
 *   window.electronAPI.onGetCloseCopy(() => {
 *       window.electronAPI.sendCloseCopy({ title, message, detail, stayButtonLabel, discardButtonLabel });
 *   });
 *
 * @param {BrowserWindow} win
 * @returns {Promise<object|null>}
 */
async function getCloseCopyFromRenderer(win) {
    if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
        return null;
    }

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.warn('[Electron] Renderer did not respond with close copy in time, using fallback');
            resolve(null);
        }, 3000);

        ipcMain.once('app:close-copy-response', (_event, copy) => {
            clearTimeout(timeout);
            resolve(copy || null);
        });

        win.webContents.send('app:get-close-copy');
    });
}
/**
 * Attaches a close guard to an editor window that intercepts the close event
 * and prompts the user to confirm if there are unsaved changes.
 *
 * @param {Electron.BrowserWindow} win - The window to attach the close guard to.
 * @returns {void}
 */
function attachEditorWindowCloseGuard(win) {
    win.on('close', async (event) => {
        if (isShuttingDown || windowsClosingByConfirmation.has(win)) return;
        if (windowsCheckingUnsavedChanges.has(win)) {
            event.preventDefault();
            return;
        }

        event.preventDefault();
        windowsCheckingUnsavedChanges.add(win);

        try {
            const hasUnsavedChanges = await windowHasUnsavedChanges(win);

            if (!hasUnsavedChanges) {
                windowsClosingByConfirmation.add(win);
                win.close();
                return;
            }

            const copy = (await getCloseCopyFromRenderer(win)) 
                      || getUnsavedChangesCloseCopy();

            const shouldProceed = confirmWindowCloseWithUnsavedChanges(win, copy);

            if (!shouldProceed) {
                console.log('[Electron] Close cancelled: unsaved changes');
                return;
            }

            console.log('[Electron] User confirmed closing with unsaved changes');
            windowsClosingByConfirmation.add(win);
            win.close();
        } finally {
            windowsCheckingUnsavedChanges.delete(win);
        }
    });

    win.on('closed', () => {
        windowsClosingByConfirmation.delete(win);
        windowsCheckingUnsavedChanges.delete(win);
    });
}

async function createWindow() {
    initializePaths(); // Initialize paths before using them
    initializeEnv(); // Initialize environment variables afterward
    combineEnv(); // Combine the environment
    applyCombinedEnvToProcess();

    // Run-once per version maintenance
    ensurePerVersionSetup();

    // Register the app:// protocol handler for serving static files
    // This replaces the HTTP server and enables Service Workers
    registerProtocolHandler();
    configureYouTubeEmbedHeaders();

    const isDev = determineDevMode();

    // Create the main window (no server needed - load static files directly)
    mainWindow = new BrowserWindow({
        width: 1250,
        height: 800,
        autoHideMenuBar: !isDev, // Windows / Linux
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        tabbingIdentifier: 'mainGroup',
        show: true,
    });

    // Show the menu bar in development mode, hide it in production
    mainWindow.setMenuBarVisibility(isDev);
    attachEditorWindowCloseGuard(mainWindow);

    // Maximize the window and open it
    mainWindow.maximize();
    mainWindow.show();

    // macOS: Ensure window controls are visible
    // Note: Tab bar visibility is controlled by AppleWindowTabbingMode preference set before window creation
    if (process.platform === 'darwin') {
        mainWindow.once('ready-to-show', () => {
            // Use setWindowButtonVisibility to ensure window controls are visible
            if (typeof mainWindow.setWindowButtonVisibility === 'function') {
                mainWindow.setWindowButtonVisibility(true);
            }
        });
    }

    if (process.env.CI === '1' || process.env.CI === 'true') {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.show();
        mainWindow.focus();
        setTimeout(() => mainWindow.setAlwaysOnTop(false), 2500);
    }

    // Allow the child windows to be created and ensure proper closing behavior
    mainWindow.webContents.on('did-create-window', childWindow => {
        console.log('Child window created');

        // Adjust child window position slightly offset from the main window
        const [mainWindowX, mainWindowY] = mainWindow.getPosition();
        const x = mainWindowX + 10;
        const y = mainWindowY + 10;
        childWindow.setPosition(x, y);

        // Remove preventDefault if you want the window to close when clicking the X button
        childWindow.on('close', () => {
            // Optional: Add any cleanup actions here if necessary
            console.log('Child window closed');
            childWindow.destroy();
        });
    });

    // Load static HTML via app:// custom protocol
    // Enables Service Workers (supported in Electron 10.x+ with registerSchemesAsPrivileged)
    mainWindow.loadURL('app://localhost/');

    // Check for updates and flush pending files
    mainWindow.webContents.on('did-finish-load', () => {
        // Flush pending files (opened via double-click or command line)
        // Delay to allow frontend JS to initialize and register IPC handlers
        if (pendingOpenFiles.length > 0) {
            const filesToOpen = [...pendingOpenFiles];
            pendingOpenFiles = [];
            console.log(`Flushing ${filesToOpen.length} pending file(s) to open:`, filesToOpen);

            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    // Open first file in main window
                    const firstFile = filesToOpen.shift();
                    if (firstFile) {
                        console.log('[main] Sending file to main window:', firstFile);
                        mainWindow.webContents.send('app:open-file', firstFile);
                    }
                    // Open remaining files in new windows/tabs
                    for (const filePath of filesToOpen) {
                        console.log('[main] Creating new window for file:', filePath);
                        createNewProjectWindow(filePath);
                    }
                }
            }, 1500); // Wait for frontend to fully initialize
        }

        if (!updaterInited) {
            const updateCheck = shouldDisableAutoUpdate();
            if (updateCheck.disabled) {
                log.info(`[AutoUpdate] Disabled: ${updateCheck.reason}`);
                updaterInited = true;
            } else {
                try {
                    const updater = initAutoUpdater({ mainWindow, autoUpdater, logger: log, streamToFile });
                    updaterInited = true;
                    void updater.checkForUpdatesAndNotify().catch(err => log.warn('update check failed', err));
                } catch (e) {
                    log.warn?.('Failed to init updater after load', e);
                }
            }
        }
    });

    // Intercept downloads: first time ask path, then overwrite same path
    session.defaultSession.on('will-download', async (event, item, webContents) => {
        try {
            // Use the filename from the request or our override
            const wc =
                webContents && !webContents.isDestroyed?.()
                    ? webContents
                    : mainWindow
                      ? mainWindow.webContents
                      : null;
            const wcId = wc && !wc.isDestroyed?.() ? wc.id : null;
            // Deduplicate same-URL downloads triggered within a short window
            try {
                const url = typeof item.getURL === 'function' ? item.getURL() : undefined;
                if (wcId && url) {
                    const now = Date.now();
                    const last = lastDownloadByWC.get(wcId);
                    if (last && last.url === url && now - last.time < 1500) {
                        // Cancel duplicate download attempt
                        event.preventDefault();
                        return;
                    }
                    lastDownloadByWC.set(wcId, { url, time: now });
                }
            } catch (_e) {}
            const overrideName = wcId ? nextDownloadNameByWC.get(wcId) : null;
            if (wcId && nextDownloadNameByWC.has(wcId)) nextDownloadNameByWC.delete(wcId);
            const suggestedName = overrideName || item.getFilename() || 'document.elpx';
            // Determine a safe target WebContents (can be null in some cases)
            // Allow renderer to define a project key (optional)
            let projectKey = 'default';
            if (wcId && nextDownloadKeyByWC.has(wcId)) {
                projectKey = nextDownloadKeyByWC.get(wcId) || 'default';
                nextDownloadKeyByWC.delete(wcId);
            } else if (wc) {
                try {
                    projectKey = await wc.executeJavaScript('window.__currentProjectId || "default"', true);
                } catch (_e) {
                    // ignore, fallback to default
                }
            }

            // Always prompt — no silent overwrite
            const owner = wc ? BrowserWindow.fromWebContents(wc) : mainWindow;
            const lastDir = getLastSaveDir(projectKey);
            const targetPath = await promptSave(owner, suggestedName, lastDir);
            if (!targetPath) {
                event.preventDefault();
                return;
            }
            setLastSaveDir(projectKey, path.dirname(targetPath));
            item.setSavePath(targetPath);

            // Progress feedback and auto-resume on interruption
            item.on('updated', (_e, state) => {
                if (state === 'progressing') {
                    if (wc && !wc.isDestroyed?.())
                        wc.send('download-progress', {
                            received: item.getReceivedBytes(),
                            total: item.getTotalBytes(),
                        });
                } else if (state === 'interrupted') {
                    try {
                        if (item.canResume()) item.resume();
                    } catch (_err) {}
                }
            });

            item.once('done', (_e, state) => {
                const send = payload => {
                    if (wc && !wc.isDestroyed?.()) wc.send('download-done', payload);
                    else if (mainWindow && !mainWindow.isDestroyed())
                        mainWindow.webContents.send('download-done', payload);
                };
                if (state === 'completed') {
                    send({ ok: true, path: targetPath });
                    return;
                }
                if (state === 'interrupted') {
                    try {
                        const total = item.getTotalBytes() || 0;
                        const exists = fs.existsSync(targetPath);
                        const size = exists ? fs.statSync(targetPath).size : 0;
                        if (exists && (total === 0 || size >= total)) {
                            send({ ok: true, path: targetPath });
                            return;
                        }
                    } catch (_err) {}
                }
                send({ ok: false, error: state });
            });
        } catch (err) {
            event.preventDefault();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-done', { ok: false, error: err.message });
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Listen for application exit events
    handleAppExit();
}


/**
 * Stream a URL to a file path using Node http/https, preserving Electron session cookies.
 * Sends 'download-progress' and 'download-done' events to the given webContents when available.
 *
 * @param {string} downloadUrl
 * @param {string} targetPath
 * @param {Electron.WebContents|null} wc
 * @param {number} [redirects]
 * @returns {Promise<boolean>}
 */
function streamToFile(downloadUrl, targetPath, wc, redirects = 0) {
    return new Promise(async resolve => {
        try {
            // Reject blob: URLs early - they only exist in browser context
            // and cannot be fetched via Node.js http/https modules.
            // Use saveBuffer/saveBufferAs for client-generated data instead.
            if (typeof downloadUrl === 'string' && downloadUrl.startsWith('blob:')) {
                const errorMsg = 'blob: URLs not supported in streamToFile. Use saveBuffer/saveBufferAs for client-side data.';
                console.error('[streamToFile]', errorMsg);
                if (wc && !wc.isDestroyed?.()) {
                    wc.send('download-done', { ok: false, error: errorMsg });
                }
                resolve(false);
                return;
            }

            // Resolve absolute URL (support relative paths from renderer)
            // In static mode with app:// protocol, we only support absolute URLs (https://)
            let baseOrigin = 'https://localhost/';
            try {
                if (wc && !wc.isDestroyed?.()) {
                    const current = wc.getURL?.();
                    // Skip file:// and app:// protocols as they can't be used as http base
                    if (current && !current.startsWith('file://') && !current.startsWith('app://')) {
                        baseOrigin = current;
                    }
                }
            } catch (_e) {}
            let urlObj;
            try {
                urlObj = new URL(downloadUrl);
            } catch (_e) {
                urlObj = new URL(downloadUrl, baseOrigin);
            }
            // Select HTTP or HTTPS client based on URL protocol
            const http = require('http');
            const client = urlObj.protocol === 'https:' ? https : http;
            // Build Cookie header from Electron session
            let cookieHeader = '';
            try {
                const cookieList = await session.defaultSession.cookies.get({
                    url: `${urlObj.protocol}//${urlObj.host}`,
                });
                cookieHeader = cookieList.map(c => `${c.name}=${c.value}`).join('; ');
            } catch (_e) {}

            const request = client.request(
                {
                    protocol: urlObj.protocol,
                    hostname: urlObj.hostname,
                    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                    path: urlObj.pathname + (urlObj.search || ''),
                    method: 'GET',
                    headers: Object.assign({}, cookieHeader ? { 'Cookie': cookieHeader } : {}),
                },
                res => {
                    // Handle redirects
                    if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        if (redirects > 5) {
                            if (wc && !wc.isDestroyed?.())
                                wc.send('download-done', { ok: false, error: 'Too many redirects' });
                            resolve(false);
                            return;
                        }
                        const nextUrl = new URL(res.headers.location, downloadUrl).toString();
                        res.resume(); // drain
                        streamToFile(nextUrl, targetPath, wc, redirects + 1).then(resolve);
                        return;
                    }
                    if (res.statusCode !== 200) {
                        if (wc && !wc.isDestroyed?.())
                            wc.send('download-done', { ok: false, error: `HTTP ${res.statusCode}` });
                        resolve(false);
                        return;
                    }
                    const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
                    let received = 0;
                    const out = fs.createWriteStream(targetPath);
                    res.on('data', chunk => {
                        received += chunk.length;
                        if (wc && !wc.isDestroyed?.()) wc.send('download-progress', { received, total });
                    });
                    res.on('error', err => {
                        try {
                            out.close();
                        } catch (_e) {}
                        if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: err.message });
                        resolve(false);
                    });
                    out.on('error', err => {
                        try {
                            res.destroy();
                        } catch (_e) {}
                        if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: err.message });
                        resolve(false);
                    });
                    out.on('finish', () => {
                        if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: true, path: targetPath });
                        resolve(true);
                    });
                    res.pipe(out);
                },
            );
            request.on('error', err => {
                if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: err.message });
                resolve(false);
            });
            request.end();
        } catch (err) {
            if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: err.message });
            resolve(false);
        }
    });
}

// Export a ZIP URL to a chosen folder by downloading and unzipping
ipcMain.handle('app:exportToFolder', async (e, { downloadUrl, projectKey, suggestedDirName }) => {
    const senderWindow = BrowserWindow.fromWebContents(e.sender);
    try {
        // Pick destination folder
        const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow, {
            title: tOrDefault(
                'export.folder.dialogTitle',
                defaultLocale === 'es' ? 'Exportar a carpeta' : 'Export to folder',
            ),
            properties: ['openDirectory', 'createDirectory'],
        });
        if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true };
        const destDir = filePaths[0];

        // Download ZIP to a temp path
        const wc = e?.sender ? e.sender : mainWindow ? mainWindow.webContents : null;
        const tmpZip = path.join(app.getPath('temp'), `exe-export-${Date.now()}.zip`);
        // Download silently (do not emit download-done for the temp file)
        const ok = await streamToFile(downloadUrl, tmpZip, null);
        if (!ok || !fs.existsSync(tmpZip)) {
            try {
                fs.existsSync(tmpZip) && fs.unlinkSync(tmpZip);
            } catch (_e) {}
            return { ok: false, error: 'download-failed' };
        }

        // Extract ZIP into chosen folder (overwrite) using fflate
        try {
            const zipData = fs.readFileSync(tmpZip);
            const uint8Data = new Uint8Array(zipData);
            const unzipped = fflate.unzipSync(uint8Data);

            for (const [relativePath, content] of Object.entries(unzipped)) {
                const fullPath = path.join(destDir, relativePath);
                // Skip directories (they end with /)
                if (relativePath.endsWith('/')) {
                    fs.mkdirSync(fullPath, { recursive: true });
                } else {
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    fs.writeFileSync(fullPath, Buffer.from(content));
                }
            }
        } finally {
            try {
                fs.unlinkSync(tmpZip);
            } catch (_e) {}
        }

        // Notify renderer with final destination (for toast path)
        try {
            if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: true, path: destDir });
        } catch (_e) {}
        return { ok: true, dir: destDir };
    } catch (err) {
        return { ok: false, error: err?.message ? err.message : 'unknown' };
    }
});

// Export base64 ZIP data to a chosen folder by unzipping (for client-side exports)
ipcMain.handle('app:exportBufferToFolder', async (e, { base64Data, suggestedDirName }) => {
    const senderWindow = BrowserWindow.fromWebContents(e.sender);
    try {
        // Pick destination folder
        const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow, {
            title: tOrDefault(
                'export.folder.dialogTitle',
                defaultLocale === 'es' ? 'Exportar a carpeta' : 'Export to folder',
            ),
            properties: ['openDirectory', 'createDirectory'],
        });
        if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true };
        const destDir = filePaths[0];

        // Decode base64 and unzip using fflate
        const buffer = Buffer.from(base64Data, 'base64');
        const uint8Data = new Uint8Array(buffer);
        const unzipped = fflate.unzipSync(uint8Data);

        for (const [relativePath, content] of Object.entries(unzipped)) {
            const fullPath = path.join(destDir, relativePath);
            if (relativePath.endsWith('/')) {
                fs.mkdirSync(fullPath, { recursive: true });
            } else {
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, Buffer.from(content));
            }
        }

        // Notify renderer with final destination
        const wc = e?.sender ? e.sender : mainWindow ? mainWindow.webContents : null;
        try {
            if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: true, path: destDir });
        } catch (_e) {}
        return { ok: true, dir: destDir };
    } catch (err) {
        return { ok: false, error: err?.message || 'unknown' };
    }
});

// Every time any window is created, we apply the handler to it
app.on('browser-window-created', (_event, window) => {
    attachOpenHandler(window);
});

bootstrapFileOpenHandlers();

/**
 * Creates macOS application menu with native tabs support.
 * The 'windowMenu' role automatically includes tab management options.
 */
function createMacOSMenu() {
    if (process.platform !== 'darwin') return;

    const template = [
        {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            role: 'editMenu',
        },
        {
            role: 'viewMenu',
        },
        {
            // windowMenu role automatically includes:
            // - Minimize, Zoom, Close
            // - Show Tab Bar, Show All Tabs (macOS 10.12+)
            // - Merge All Windows, Move Tab to New Window
            // - Bring All to Front
            role: 'windowMenu',
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// macOS: Handle new tab button click ('+' in tab bar)
app.on('new-window-for-tab', () => {
    if (process.platform !== 'darwin') return;

    const isDev = determineDevMode();

    // Get position from focused window or main window
    let x, y, width, height;
    const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    if (focusedWindow && !focusedWindow.isDestroyed()) {
        const bounds = focusedWindow.getBounds();
        x = bounds.x;
        y = bounds.y;
        width = bounds.width;
        height = bounds.height;
    } else {
        width = 1250;
        height = 800;
    }

    const newWindow = new BrowserWindow({
        x,
        y,
        width,
        height,
        autoHideMenuBar: !isDev,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        tabbingIdentifier: 'mainGroup',
        show: true,
    });

    newWindow.setMenuBarVisibility(isDev);
    attachEditorWindowCloseGuard(newWindow);
    newWindow.loadURL('app://localhost/');

    attachOpenHandler(newWindow);

    console.log('New tab window created');
});

app.whenReady().then(() => {
    // macOS: Always show tab bar (even with single window)
    if (process.platform === 'darwin') {
        systemPreferences.setUserDefault('AppleWindowTabbingMode', 'string', 'always');
    }

    // Initialize electron-context-menu for Chrome-like right-click menus
    contextMenu({
        showSaveImageAs: true,
        showCopyLink: true,
        showInspectElement: true,
    });

    createMacOSMenu();
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

/**
 * Function to handle app exit.
 */
function handleAppExit() {
    const cleanup = () => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        setTimeout(() => {
            if (BrowserWindow.getAllWindows().length === 0) {
                process.exit(0);
                return;
            }

            isShuttingDown = false;
        }, 500);

        app.quit();
    };

    process.on('SIGINT', cleanup); // Handle Ctrl + C
    process.on('SIGTERM', cleanup); // Handle kill command
}

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC for explicit Save / Save As (optional from renderer)
// Save URL-based download — always prompts for destination
async function saveUrlWithDialog(e, { downloadUrl, projectKey, suggestedName }) {
    if (typeof downloadUrl !== 'string' || !downloadUrl) return false;
    try {
        const wc = e?.sender ? e.sender : mainWindow ? mainWindow.webContents : null;
        const owner = wc ? BrowserWindow.fromWebContents(wc) : mainWindow;
        const key = projectKey || 'default';
        const { dir: lastDir, name: storedName } = getLastSaveInfo(key);

        const targetPath = await promptSave(owner, suggestedName, lastDir, storedName);
        if (!targetPath) return false;
        setLastSaveInfo(key, path.dirname(targetPath), path.basename(targetPath));

        return await streamToFile(downloadUrl, targetPath, wc);
    } catch (_e) {
        return false;
    }
}
ipcMain.handle('app:save', saveUrlWithDialog);
ipcMain.handle('app:saveAs', saveUrlWithDialog);

// No-ops: path-remembering removed — save always prompts for destination
ipcMain.handle('app:setSavedPath', async () => true);
ipcMain.handle('app:clearSavedPath', async () => true);

// Open system file picker for .elpx files (offline open)
ipcMain.handle('app:openElp', async e => {
    const senderWindow = BrowserWindow.fromWebContents(e.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow, {
        title: tOrDefault('open.dialogTitle', defaultLocale === 'es' ? 'Abrir proyecto' : 'Open project'),
        properties: ['openFile'],
        filters: [{ name: 'eXeLearning project', extensions: ['elpx', 'elp', 'zip'] }],
    });
    if (canceled || !filePaths || !filePaths.length) return null;
    return filePaths[0];
});

// Read file contents as base64 for upload (renderer builds a File)
ipcMain.handle('app:readFile', async (_e, { filePath }) => {
    try {
        if (!filePath) return { ok: false, error: 'No path' };
        const data = fs.readFileSync(filePath);
        const stat = fs.statSync(filePath);
        return { ok: true, base64: data.toString('base64'), mtimeMs: stat.mtimeMs };
    } catch (err) {
        return { ok: false, error: err.message };
    }
});

ipcMain.handle('app:getMemoryUsage', async (e) => {
    let renderer = null;
    try {
        if (e?.sender?.getProcessMemoryInfo) {
            renderer = await e.sender.getProcessMemoryInfo();
        }
    } catch (_err) {
        renderer = null;
    }

    return {
        process: process.memoryUsage(),
        renderer,
    };
});

function normalizeBinaryPayload(bufferData, base64Data) {
    if (bufferData instanceof Uint8Array) {
        return Buffer.from(bufferData);
    }

    if (bufferData instanceof ArrayBuffer) {
        return Buffer.from(new Uint8Array(bufferData));
    }

    if (Array.isArray(bufferData)) {
        return Buffer.from(bufferData);
    }

    if (base64Data) {
        return Buffer.from(base64Data, 'base64');
    }

    return null;
}

function createSaveBufferResponse({
    saved = false,
    canceled = false,
    canceledAt = null,
    filePath = null,
    error = null,
    promptMs = 0,
    normalizeMs = 0,
    writeMs = 0,
    totalMs = 0,
} = {}) {
    return {
        saved,
        canceled,
        canceledAt,
        filePath,
        error,
        timings: {
            totalMs: Math.round(totalMs),
            promptMs: Math.round(promptMs),
            normalizeMs: Math.round(normalizeMs),
            writeMs: Math.round(writeMs),
        },
    };
}

// Save binary data — always prompts for destination (no silent overwrite)
async function saveBufferWithDialog(e, { bufferData, base64Data, projectKey, suggestedName }) {
    const startedAt = globalThis.performance?.now ? globalThis.performance.now() : Date.now();
    let afterPromptAt = startedAt;
    let afterNormalizeAt = startedAt;
    let targetPath = null;

    if (!bufferData && !base64Data) {
        return createSaveBufferResponse({
            saved: false,
            canceled: false,
            canceledAt: 'write',
            error: 'Missing buffer data',
        });
    }
    try {
        const wc = e?.sender ? e.sender : mainWindow ? mainWindow.webContents : null;
        const owner = wc ? BrowserWindow.fromWebContents(wc) : mainWindow;
        const key = projectKey || 'default';
        const { dir: lastDir, name: storedName } = getLastSaveInfo(key);

        targetPath = await promptSave(owner, suggestedName, lastDir, storedName);
        afterPromptAt = globalThis.performance?.now ? globalThis.performance.now() : Date.now();
        if (!targetPath) {
            return createSaveBufferResponse({
                saved: false,
                canceled: true,
                canceledAt: 'dialog',
                promptMs: afterPromptAt - startedAt,
                totalMs: afterPromptAt - startedAt,
            });
        }
        setLastSaveInfo(key, path.dirname(targetPath), path.basename(targetPath));

        const buffer = normalizeBinaryPayload(bufferData, base64Data);
        afterNormalizeAt = globalThis.performance?.now ? globalThis.performance.now() : Date.now();
        if (!buffer) {
            return createSaveBufferResponse({
                saved: false,
                canceled: false,
                canceledAt: 'write',
                filePath: targetPath,
                error: 'Failed to normalize binary payload',
                promptMs: afterPromptAt - startedAt,
                normalizeMs: afterNormalizeAt - afterPromptAt,
                totalMs: afterNormalizeAt - startedAt,
            });
        }
        fs.writeFileSync(targetPath, buffer);
        const finishedAt = globalThis.performance?.now ? globalThis.performance.now() : Date.now();
        return createSaveBufferResponse({
            saved: true,
            canceled: false,
            canceledAt: null,
            filePath: targetPath,
            promptMs: afterPromptAt - startedAt,
            normalizeMs: afterNormalizeAt - afterPromptAt,
            writeMs: finishedAt - afterNormalizeAt,
            totalMs: finishedAt - startedAt,
        });
    } catch (err) {
        console.error('[app:saveBuffer] Error:', err);
        const failedAt = globalThis.performance?.now ? globalThis.performance.now() : Date.now();
        return createSaveBufferResponse({
            saved: false,
            canceled: false,
            canceledAt: 'write',
            filePath: targetPath,
            error: err?.message || String(err),
            promptMs: afterPromptAt - startedAt,
            normalizeMs: afterNormalizeAt - afterPromptAt,
            writeMs: failedAt - afterNormalizeAt,
            totalMs: failedAt - startedAt,
        });
    }
}
ipcMain.handle('app:saveBuffer', saveBufferWithDialog);
ipcMain.handle('app:saveBufferAs', saveBufferWithDialog);


/**
 * Create a new window for a project file
 * @param {string} filePath - Path to the .elpx file to open
 */
function createNewProjectWindow(filePath) {
    const isDev = determineDevMode();

    // Offset from main window
    let x, y, width, height;
    if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds();
        x = bounds.x + 30;
        y = bounds.y + 30;
        width = bounds.width;
        height = bounds.height;
    } else {
        width = 1250;
        height = 800;
    }

    const newWindow = new BrowserWindow({
        x,
        y,
        width,
        height,
        autoHideMenuBar: !isDev,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        tabbingIdentifier: 'mainGroup', // macOS native tabs support
        show: false,
    });

    newWindow.setMenuBarVisibility(isDev);
    newWindow.loadURL('app://localhost/');
    newWindow.once('ready-to-show', () => {
        if (!newWindow.isDestroyed()) {
            newWindow.show();
        }
    });

    // Note: Tab bar visibility is controlled by AppleWindowTabbingMode preference (set at app start)

    // Send the file only when renderer explicitly confirms it registered the open-file handler
    const newWindowWcId = newWindow.webContents.id;
    pendingOpenFileByWebContentsId.set(newWindowWcId, filePath);
    newWindow.on('closed', () => {
        pendingOpenFileByWebContentsId.delete(newWindowWcId);
    });

    attachOpenHandler(newWindow);

    return newWindow;
}

ipcMain.on('app:renderer-ready-for-open-file', (event) => {
    const wcId = event.sender.id;
    const filePath = pendingOpenFileByWebContentsId.get(wcId);
    if (!filePath) return;
    event.sender.send('app:open-file', filePath);
    pendingOpenFileByWebContentsId.delete(wcId);
});

/**
 * Handle opening an .elpx file
 * @param {string} filePath - Path to the file
 * @param {boolean} isAppStartup - True if app is just starting
 */
function handleFileOpen(filePath, isAppStartup = false) {
    if (isAppStartup) {
        // Queue for main window when ready
        pendingOpenFiles.push(filePath);
        return;
    }

    if (!mainWindow || mainWindow.isDestroyed()) {
        pendingOpenFiles.push(filePath);
        return;
    }

    // App running - always create new window
    createNewProjectWindow(filePath);
}

/**
 * Shows an error dialog.
 *
 * @param {string} message - The message to display.
 */
function showErrorDialog(message) {
    dialog.showErrorBox('Error', message);
}

/**
 * Handle files passed on startup (Windows/Linux: process.argv, macOS: 'open-file')
 */
function bootstrapFileOpenHandlers() {
    // Windows/Linux: file paths come in process.argv
    // argv[0] = exe, argv[1] = first arg (might be a file)
    if (process.platform !== 'darwin') {
        const args = process.argv.slice(1);
        for (const a of args) {
            if (a && /\.elp(x)?$/i.test(a) && !a.startsWith('-')) {
                pendingOpenFiles.push(a);
            }
        }
    }

    // macOS: 'open-file' is emitted for each file, before or after 'ready'
    app.on('open-file', (event, filePath) => {
        event.preventDefault(); // prevent default OS handling
        handleFileOpen(filePath, !app.isReady());
    });

    // Single instance lock: collect files from second invocations (Win/Linux)
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
        app.quit();
        return;
    }

    app.on('second-instance', (_event, argv) => {
        // Bring main window to front
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }

        // On Windows/Linux, file paths come in argv
        const files = argv.filter(a => /\.elp(x)?$/i.test(a) && !a.startsWith('-'));
        for (const f of files) {
            // App is running - create new window for each file
            handleFileOpen(f, false);
        }
    });
}

// Helper: returns fallback string (i18n removed to avoid Windows EPERM errors)
function tOrDefault(_key, fallback) {
    return fallback;
}
