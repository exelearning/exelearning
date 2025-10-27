const { app, BrowserWindow, dialog, session, ipcMain }  = require('electron');
const { autoUpdater }                 = require('electron-updater');

const log                             = require('electron-log');
const path                            = require('path');
const i18n                            = require('i18n');
const { spawn, execFileSync }         = require('child_process');
const fs                              = require('fs');
const AdmZip                          = require('adm-zip');
const http                            = require('http'); // Import the http module to check server availability and downloads
const https                           = require('https');

const { initAutoUpdater }             = require('./update-manager');

// Determine the base path depending on whether the app is packaged when we enable "asar" packaging
const basePath = app.isPackaged
  ? process.resourcesPath
  : app.getAppPath();

// Optional: force a predictable path/name
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'main.log');

 // files to open after app ready
let pendingOpenFiles = [];

autoUpdater.logger = log;
autoUpdater.allowPrerelease = true;
autoUpdater.forceDevUpdateConfig = false;
// We control the flow with our own dialogs
autoUpdater.autoDownload = false;

// Mirror console.* to electron-log so GUI builds persist logs to file
const origConsole = { log: console.log, error: console.error, warn: console.warn };
console.log = (...args) => { log.info(...args); origConsole.log(...args); };
console.warn = (...args) => { log.warn(...args); origConsole.warn(...args); };
console.error = (...args) => { log.error(...args); origConsole.error(...args); };

// Safety: capture crashes/unhandled
process.on('uncaughtException', (e) => log.error('uncaughtException:', e));
process.on('unhandledRejection', (e) => log.error('unhandledRejection:', e));

// ──────────────  i18n bootstrap  ──────────────
// Pick correct path depending on whether the app is packaged.
const translationsDir = app.isPackaged
  ? path.join(process.resourcesPath, 'translations')
  : path.join(__dirname, 'translations');

const defaultLocale = app.getLocale().startsWith('es') ? 'es' : 'en';
console.log(`Default locale: ${defaultLocale}.`);

i18n.configure({
  locales: ['en', 'es'],
  directory: translationsDir,
  defaultLocale: defaultLocale,
  objectNotation: true
});

i18n.setLocale(defaultLocale);

let phpBinaryPath;
let appDataPath;
let databasePath;

let databaseUrl;

let mainWindow;
let loadingWindow;
let phpServer;
let isShuttingDown = false; // Flag to ensure the app only shuts down once
let updaterInited = false; // guard

// Environment variables container
let customEnv;
let env;

// ──────────────  Save/Export helpers  ──────────────
// Returns a known extension (including the leading dot) inferred from a suggested name.
function inferKnownExt(suggestedName) {
  try {
    const ext = (path.extname(suggestedName || '') || '').toLowerCase().replace(/^\./, '');
    if (!ext) return null;
    if (ext === 'elpx' || ext === 'zip' || ext === 'epub' || ext === 'xml') return `.${ext}`;
    return null;
  } catch (_e) {
    return null;
  }
}

// Ensures the filePath has an extension; if missing, appends one inferred from suggestedName.
function ensureExt(filePath, suggestedName) {
  if (!filePath) return filePath;
  const hasExt = !!path.extname(filePath);
  if (hasExt) return filePath;
  const inferred = inferKnownExt(suggestedName);
  return inferred ? (filePath + inferred) : filePath;
}

function isLegacyElp(p) {
  try { return typeof p === 'string' && /\.elp$/i.test(p); } catch (_) { return false; }
}

function proposeElpxPath(currentPath) {
  try {
    const dir  = currentPath ? path.dirname(currentPath) : app.getPath('documents');
    const base = currentPath ? path.basename(currentPath, path.extname(currentPath)) : 'document';
    return path.join(dir, `${base}.elpx`);
  } catch (_e) {
    return 'document.elpx';
  }
}

async function promptElpxSave(owner, currentPath, titleKey, buttonKey) {
  const { filePath, canceled } = await dialog.showSaveDialog(owner, {
    title: tOrDefault(titleKey, defaultLocale === 'es' ? 'Guardar como…' : 'Save as…'),
    defaultPath: proposeElpxPath(currentPath),
    buttonLabel: tOrDefault(buttonKey, defaultLocale === 'es' ? 'Guardar' : 'Save'),
    filters: [{ name: 'eXeLearning project', extensions: ['elpx'] }],
  });
  if (canceled || !filePath) return null;
  // force .elpx if not incluted
  return ensureExt(filePath, 'document.elpx');
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

function getSavedPath(key) {
  const s = readSettings();
  return (s.savePath && s.savePath[key]) || null;
}

function setSavedPath(key, filePath) {
  const s = readSettings();
  s.savePath = s.savePath || {};
  s.savePath[key] = filePath;
  writeSettings(s);
}

function clearSavedPath(key) {
  const s = readSettings();
  if (s.savePath && key in s.savePath) {
    delete s.savePath[key];
    writeSettings(s);
  }
}

// Map of webContents.id -> next projectKey override for the next download
const nextDownloadKeyByWC = new Map();
const nextDownloadNameByWC = new Map();
// Deduplicate bursts of downloads for the same WC/URL (prevents double pickers)
const lastDownloadByWC = new Map(); // wcId -> { url: string, time: number }

/**
 * Creates a directory recursively if it does not exist and attempts to set 0o777 permissions.
 * 
 * @param {string} dirPath - The path of the directory to ensure.
 */
function ensureWritableDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory does not exist: ${dirPath}. Creating it...`);
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directory created: ${dirPath}`);
  } else {
    console.log(`Directory already exists: ${dirPath}`);
  }

  try {
    // Attempt to set wide-open permissions (on Windows, this might be ignored).
    fs.chmodSync(dirPath, 0o777);
    console.log(`Permissions set to 0777 for: ${dirPath}`);
  } catch (error) {
    console.warn(`Could not set permissions on ${dirPath}: ${error.message}`);
  }
}

/**
 * Perform "run-once per version" maintenance.
 * - Cleans cache on version change (optional but helps avoid stale code/data).
 * - Rotates logs (optional).
 * Stores the current version in settings.json to avoid repeating the work.
 */
function ensurePerVersionSetup() {
  const currentVersion = app.getVersion();
  const s = readSettings();
  const previousVersion = s.appVersion || null;

  if (previousVersion !== currentVersion) {
    try {
      // Clean cache folder when the app version changes
      if (customEnv && customEnv.CACHE_DIR && fs.existsSync(customEnv.CACHE_DIR)) {
        fs.rmSync(customEnv.CACHE_DIR, { recursive: true, force: true });
        fs.mkdirSync(customEnv.CACHE_DIR, { recursive: true });
        console.log(`Cache cleared for version change: ${previousVersion} -> ${currentVersion}`);
      }
    } catch (e) {
      console.warn(`Cache cleanup failed: ${e.message}`);
    }

    try {
      // Optional: truncate logs on version change (keep folder)
      if (customEnv && customEnv.LOG_DIR && fs.existsSync(customEnv.LOG_DIR)) {
        for (const file of fs.readdirSync(customEnv.LOG_DIR)) {
          const full = path.join(customEnv.LOG_DIR, file);
          try {
            if (fs.statSync(full).isFile()) fs.truncateSync(full, 0);
          } catch (_e) {}
        }
      }
    } catch (e) {
      console.warn(`Log rotation failed: ${e.message}`);
    }

    // Persist the current version to avoid repeating the maintenance on the next run
    s.appVersion = currentVersion;
    writeSettings(s);
  }
}

/**
 * Ensures all required directories exist and are (attempted to be) writable.
 * 
 * @param {object} env - The environment object that contains your directory paths.
 */
function ensureAllDirectoriesWritable(env) {
  ensureWritableDirectory(env.FILES_DIR);
  ensureWritableDirectory(env.CACHE_DIR);
  ensureWritableDirectory(env.LOG_DIR);

  // For any subfolders you know must exist:
  const idevicesAdminDir = path.join(env.FILES_DIR, 'perm', 'idevices', 'users', 'admin');
  ensureWritableDirectory(idevicesAdminDir);

  // ...Add additional directories as needed.
}

function initializePaths() {
  phpBinaryPath = getPhpBinaryPath(); 
  appDataPath = app.getPath('userData');
  databasePath = path.join(appDataPath, 'exelearning.db')

  console.log(`PHP binary path: ${phpBinaryPath}`);
  console.log(`APP data path: ${appDataPath}`);
  console.log('Database path:', databasePath);
}
// Define environment variables after initializing paths
function initializeEnv() {

  const isDev = determineDevMode();
  const appEnv  = isDev ? 'dev' : 'prod';

  // Get the appropriate app data path based on platform
customEnv = {
  APP_ENV: process.env.APP_ENV || appEnv,
  APP_DEBUG: process.env.APP_DEBUG ?? (isDev ? 1 : 0),
  EXELEARNING_DEBUG_MODE: (process.env.EXELEARNING_DEBUG_MODE ?? (isDev ? '1' : '0')).toString(),
  APP_SECRET: process.env.APP_SECRET || 'CHANGE_THIS_FOR_A_SECRET',
  APP_PORT: process.env.APP_PORT || '41309',
  APP_ONLINE_MODE: process.env.APP_ONLINE_MODE ?? 0,
  APP_AUTH_METHODS: process.env.APP_AUTH_METHODS || 'none',
  TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || 'localuser@exelearning.net',
  TEST_USER_USERNAME: process.env.TEST_USER_USERNAME || 'localuser',
  TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || 'RANDOMUNUSEDPASSWORD',
  TRUSTED_PROXIES: process.env.TRUSTED_PROXIES || '',
  MAILER_DSN: process.env.MAILER_DSN || 'smtp://localhost',
  CAS_URL: process.env.CAS_URL || '',
  DB_DRIVER: process.env.DB_DRIVER || 'pdo_sqlite',
  DB_CHARSET: process.env.DB_CHARSET || 'utf8',
  DB_PATH: process.env.DB_PATH || databasePath,
  DB_SERVER_VERSION: process.env.DB_SERVER_VERSION || '3.32',
  FILES_DIR: process.env.FILES_DIR || path.join(appDataPath, 'data'),
  CACHE_DIR: process.env.CACHE_DIR || path.join(appDataPath, 'cache'),
  LOG_DIR: process.env.LOG_DIR || path.join(appDataPath, 'log'),
  MERCURE_URL: process.env.MERCURE_URL || '',
  API_JWT_SECRET: process.env.API_JWT_SECRET || 'CHANGE_THIS_FOR_A_SECRET',
  ONLINE_THEMES_INSTALL: 1,
  ONLINE_IDEVICES_INSTALL: 0, // To do (see #381)
};
}
/**
 * Determine if dev mode is enabled.
 * 
 * Supports CLI flag --dev=1/true/True and env var EXELEARNING_DEV_MODE=1/true/True.
 * @returns {boolean}
 */
function determineDevMode() {
  // Check CLI argument first
  const cliArg = process.argv.find(arg => arg.startsWith('--dev='));
  if (cliArg) {
    const value = cliArg.split('=')[1].toLowerCase();
    return value === 'true' || value === '1';
  }

  // Fallback to environment variable
  const envVal = process.env.EXELEARNING_DEBUG_MODE;
  if (envVal) {
    const value = envVal.toLowerCase();
    return value === 'true' || value === '1';
  }

  return false;
}

function combineEnv() {
  env = Object.assign({}, customEnv, process.env);
}

// Handler factory: creates an identical handler for any window
function attachOpenHandler(win) {
  // Get parent size & position
  let { width, height } = win.getBounds();
  let [mainX, mainY] = win.getPosition();

  win.webContents.setWindowOpenHandler(({ url }) => {

    // Create a completely independent child
    let childWindow = new BrowserWindow({
      x:   mainX + 10, // offset 10px right
      y:   mainY + 10,    // offset 10px down
      width,
      height,
      modal: false,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
      tabbingIdentifier: 'mainGroup',
      // titleBarStyle: 'customButtonsOnHover', // hidden title bar on macOS
    });

    childWindow.loadURL(url);

    // Destroy when closed
    childWindow.on('close', () => {
      // Optional: Add any cleanup actions here if necessary
      console.log("Child window closed");
      childWindow.destroy();
    });

    // Recursively attach the same logic so grandchildren also get it
    attachOpenHandler(childWindow);

    return { action: 'deny' }; // Prevents automatic creation and lets you manage the window manually
  });

}

function createWindow() {

  initializePaths(); // Initialize paths before using them
  initializeEnv();   // Initialize environment variables afterward
  combineEnv();      // Combine the environment

  // Run-once per version maintenance (cache/logs cleanup, etc.)
  ensurePerVersionSetup();

  // Ensure all required directories exist and try to set permissions
  ensureAllDirectoriesWritable(env);

  // Create the loading window
  createLoadingWindow();

  // Check if the database exists and run Symfony commands
  checkAndCreateDatabase();

  // Check if the php binary is runable exists and run Symfony commands
  assertWindowsPhpUsableOrGuide();

  runSymfonyCommands();

  // Start the embedded PHP server
  startPhpServer();

  // Wait for the PHP server to be available before loading the main window
  waitForServer(() => {
    // Close the loading window
    if (loadingWindow) {
      loadingWindow.close();
    }

    const isDev = determineDevMode();

    // Create the main window
    mainWindow = new BrowserWindow({
      width: 1250,
      height: 800,
      autoHideMenuBar: !isDev,  // Windows / Linux
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      tabbingIdentifier: 'mainGroup',
      show: true,
      // titleBarStyle: 'customButtonsOnHover', // hidden title bar on macOS
    });
    
    // Show the menu bar in development mode, hide it in production
    mainWindow.setMenuBarVisibility(isDev);
    
    // Maximize the window and open it
    mainWindow.maximize();
    mainWindow.show();

    if (process.env.CI === '1' || process.env.CI === 'true') {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.show();
      mainWindow.focus();
      setTimeout(() => mainWindow.setAlwaysOnTop(false), 2500);
    }



    // Allow the child windows to be created and ensure proper closing behavior
    mainWindow.webContents.on('did-create-window', (childWindow) => {
      console.log("Child window created");

      // Adjust child window position slightly offset from the main window
      const [mainWindowX, mainWindowY] = mainWindow.getPosition();
      let x = mainWindowX + 10;
      let y = mainWindowY + 10;
      childWindow.setPosition(x, y);

      // Remove preventDefault if you want the window to close when clicking the X button
      childWindow.on('close', () => {
        // Optional: Add any cleanup actions here if necessary
        console.log("Child window closed");
        childWindow.destroy();
      });
    });

    mainWindow.loadURL(`http://localhost:${customEnv.APP_PORT}`);

    // Check for updates
    mainWindow.webContents.on('did-finish-load', () => {
      if (!updaterInited) {
        try {
          const updater = initAutoUpdater({ mainWindow, autoUpdater, logger: log, streamToFile });
          // Init updater once
          updaterInited = true;
          void updater.checkForUpdatesAndNotify().catch(err => log.warn('update check failed', err));
        } catch (e) {
          log.warn && log.warn('Failed to init updater after load', e);
        }
      }
    });

    // Intercept downloads: first time ask path, then overwrite same path
    session.defaultSession.on('will-download', async (event, item, webContents) => {
      try {
        // Use the filename from the request or our override
        const wc = webContents && !webContents.isDestroyed?.() ? webContents : (mainWindow ? mainWindow.webContents : null);
        const wcId = wc && !wc.isDestroyed?.() ? wc.id : null;
        // Deduplicate same-URL downloads triggered within a short window
        try {
          const url = (typeof item.getURL === 'function') ? item.getURL() : undefined;
          if (wcId && url) {
            const now = Date.now();
            const last = lastDownloadByWC.get(wcId);
            if (last && last.url === url && (now - last.time) < 1500) {
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

        let targetPath = getSavedPath(projectKey);

        if (!targetPath) {
          const owner = wc ? BrowserWindow.fromWebContents(wc) : mainWindow;
          const { filePath, canceled } = await dialog.showSaveDialog(owner, {
            title: tOrDefault('save.dialogTitle', defaultLocale === 'es' ? 'Guardar proyecto' : 'Save project'),
            defaultPath: suggestedName,
            buttonLabel: tOrDefault('save.button', defaultLocale === 'es' ? 'Guardar' : 'Save')
          });
          if (canceled || !filePath) {
            event.preventDefault();
            return;
          }
          targetPath = ensureExt(filePath, suggestedName);
          setSavedPath(projectKey, targetPath);
        } else {
          // If remembered path has no extension, append inferred one
          const fixed = ensureExt(targetPath, suggestedName);
          if (fixed !== targetPath) {
            targetPath = fixed;
            setSavedPath(projectKey, targetPath);
          }
        }

        // Save directly (overwrite without prompting)
        item.setSavePath(targetPath);

        // Progress feedback and auto-resume on interruption
        item.on('updated', (_e, state) => {
          if (state === 'progressing') {
            if (wc && !wc.isDestroyed?.()) wc.send('download-progress', {
              received: item.getReceivedBytes(),
              total: item.getTotalBytes()
            });
          } else if (state === 'interrupted') {
            try {
              if (item.canResume()) item.resume();
            } catch (_err) {}
          }
        });

        item.once('done', (_e, state) => {
          const send = (payload) => {
            if (wc && !wc.isDestroyed?.()) wc.send('download-done', payload);
            else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('download-done', payload);
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
  
    // If any event blocks window closing, remove it
    mainWindow.on('close', (e) => {
      // This is to ensure any preventDefault() won't stop the closing
      console.log('Window is being forced to close...');
      e.preventDefault();  // Optional: Prevent default close event
      mainWindow.destroy(); // Force destroy the window
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    // Listen for application exit events
    handleAppExit();
  });
}




function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false, // No title bar
    transparent: true, // Make the window transparent
    alwaysOnTop: true, // Always on top
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the loading.html file
  loadingWindow.loadFile(path.join(basePath, 'public', 'loading.html'));
}

function waitForServer(callback) {
  const options = {
    host: 'localhost',
    port: customEnv.APP_PORT,
    timeout: 1000, // 1-second timeout
  };

  const checkServer = () => {
    const req = http.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode <= 400) {
        console.log('PHP server available.');
        callback();  // Call the callback to continue opening the window
      } else {
        console.log(`Server status: ${res.statusCode}. Retrying...`);
        setTimeout(checkServer, 1000);  // Try again in 1 second
      }
    });

    req.on('error', () => {
      console.log('PHP server not available, retrying...');
      setTimeout(checkServer, 1000);  // Try again in 1 second
    });

    req.end();
  };

  checkServer();
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
  return new Promise(async (resolve) => {
    try {
      // Resolve absolute URL (support relative paths from renderer)
      let baseOrigin = `http://localhost:${(customEnv && customEnv.APP_PORT) ? customEnv.APP_PORT : 80}/`;
      try {
        if (wc && !wc.isDestroyed?.()) {
          const current = wc.getURL && wc.getURL();
          if (current) baseOrigin = current;
        }
      } catch (_e) {}
      let urlObj;
      try {
        urlObj = new URL(downloadUrl);
      } catch (_e) {
        urlObj = new URL(downloadUrl, baseOrigin);
      }
      const client = urlObj.protocol === 'https:' ? https : http;
      // Build Cookie header from Electron session
      let cookieHeader = '';
      try {
        const cookieList = await session.defaultSession.cookies.get({ url: `${urlObj.protocol}//${urlObj.host}` });
        cookieHeader = cookieList.map(c => `${c.name}=${c.value}`).join('; ');
      } catch (_e) {}

      const request = client.request({
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'GET',
        headers: Object.assign({}, cookieHeader ? { 'Cookie': cookieHeader } : {})
      }, (res) => {
        // Handle redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects > 5) {
            if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: 'Too many redirects' });
            resolve(false);
            return;
          }
          const nextUrl = new URL(res.headers.location, downloadUrl).toString();
          res.resume(); // drain
          streamToFile(nextUrl, targetPath, wc, redirects + 1).then(resolve);
          return;
        }
        if (res.statusCode !== 200) {
          if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: `HTTP ${res.statusCode}` });
          resolve(false);
          return;
        }
        const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
        let received = 0;
        const out = fs.createWriteStream(targetPath);
        res.on('data', (chunk) => {
          received += chunk.length;
          if (wc && !wc.isDestroyed?.()) wc.send('download-progress', { received, total });
        });
        res.on('error', (err) => {
          try { out.close(); } catch (_e) {}
          if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: err.message });
          resolve(false);
        });
        out.on('error', (err) => {
          try { res.destroy(); } catch (_e) {}
          if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: false, error: err.message });
          resolve(false);
        });
        out.on('finish', () => {
          if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: true, path: targetPath });
          resolve(true);
        });
        res.pipe(out);
      });
      request.on('error', (err) => {
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
      title: tOrDefault('export.folder.dialogTitle', defaultLocale === 'es' ? 'Exportar a carpeta' : 'Export to folder'),
      properties: ['openDirectory', 'createDirectory']
    });
    if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true };
    const destDir = filePaths[0];

    // Download ZIP to a temp path
    const wc = e && e.sender ? e.sender : (mainWindow ? mainWindow.webContents : null);
    const tmpZip = path.join(app.getPath('temp'), `exe-export-${Date.now()}.zip`);
    // Download silently (do not emit download-done for the temp file)
    const ok = await streamToFile(downloadUrl, tmpZip, null);
    if (!ok || !fs.existsSync(tmpZip)) {
      try { fs.existsSync(tmpZip) && fs.unlinkSync(tmpZip); } catch (_e) {}
      return { ok: false, error: 'download-failed' };
    }

    // Extract ZIP into chosen folder (overwrite)
    try {
      const zip = new AdmZip(tmpZip);
      zip.extractAllTo(destDir, true);
    } finally {
      try { fs.unlinkSync(tmpZip); } catch (_e) {}
    }

    // Notify renderer with final destination (for toast path)
    try {
      if (wc && !wc.isDestroyed?.()) wc.send('download-done', { ok: true, path: destDir });
    } catch (_e) {}
    return { ok: true, dir: destDir };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'unknown' };
  }
});

// Every time any window is created, we apply the handler to it
app.on('browser-window-created', (_event, window) => {
  attachOpenHandler(window);
});

// Prevent running two instances at the same time (e.g., old install + new install).
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Focus existing window if user tries to start a second instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

bootstrapFileOpenHandlers();

app.whenReady().then(() => {
  createWindow();

  // Flush queued files after UI is ready
  if (pendingOpenFiles.length && mainWindow && !mainWindow.isDestroyed()) {
    for (const f of pendingOpenFiles) {
      mainWindow.webContents.send('app:open-file', f);
    }
    pendingOpenFiles = [];
  }
});


app.on('window-all-closed', function () {
  if (phpServer) {
    phpServer.kill('SIGTERM');
    console.log('Closed PHP server.');
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Function to handle app exit, including killing the PHP server.
 */
function handleAppExit() {
  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Terminate PHP server if running
    if (phpServer) {
      phpServer.kill('SIGTERM');
      phpServer = null;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }

    // Exit the process after a short delay
    setTimeout(() => {
      process.exit(0);  // Exit the process forcefully
    }, 500); // Delay for cleanup
  };

  process.on('SIGINT', cleanup);  // Handle Ctrl + C
  process.on('SIGTERM', cleanup); // Handle kill command
  process.on('exit', cleanup);    // Handle exit event
  app.on('window-all-closed', cleanup);
  app.on('before-quit', cleanup);
}

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC for explicit Save / Save As (optional from renderer)
ipcMain.handle('app:save', async (e, { downloadUrl, projectKey, suggestedName }) => {
  if (typeof downloadUrl !== 'string' || !downloadUrl) return false;
  try {
    const wc = e && e.sender ? e.sender : (mainWindow ? mainWindow.webContents : null);
    let key = projectKey || 'default';
    try {
      if (!projectKey && wc && !wc.isDestroyed?.()) {
        key = await wc.executeJavaScript('window.__currentProjectId || "default"', true);
      }
    } catch (_er) {}

    let targetPath = getSavedPath(key);
    const owner = wc ? BrowserWindow.fromWebContents(wc) : mainWindow;

    if (!targetPath) {
      // non remembered path → ask
      const picked = await promptElpxSave(owner, null, 'save.dialogTitle', 'save.button');
      if (!picked) return false;
      targetPath = picked;
      setSavedPath(key, targetPath);
    } else if (isLegacyElp(targetPath)) {
      // remembered path is .elp → forzar "Save as...” to .elpx
      const picked = await promptElpxSave(owner, targetPath, 'saveAs.dialogTitle', 'save.button');
      if (!picked) return false;
      targetPath = picked;
      setSavedPath(key, targetPath);
    } else {
      // remembered path not .elp; ensure ext
      const fixed = ensureExt(targetPath, suggestedName || 'document.elpx');
      if (fixed !== targetPath) {
        targetPath = fixed;
        setSavedPath(key, targetPath);
      }
    }

    return await streamToFile(downloadUrl, targetPath, wc);
  } catch (_e) {
    return false;
  }
});


ipcMain.handle('app:saveAs', async (e, { downloadUrl, projectKey, suggestedName }) => {
  const senderWindow = BrowserWindow.fromWebContents(e.sender);
  const wc = e && e.sender ? e.sender : (mainWindow ? mainWindow.webContents : null);
  const key = projectKey || 'default';
  const { filePath, canceled } = await dialog.showSaveDialog(senderWindow, {
    title: tOrDefault('saveAs.dialogTitle', defaultLocale === 'es' ? 'Guardar como…' : 'Save as…'),
    defaultPath: suggestedName || 'document.elpx',
    buttonLabel: tOrDefault('save.button', defaultLocale === 'es' ? 'Guardar' : 'Save')
  });
  if (canceled || !filePath) return false;
  const finalPath = ensureExt(filePath, suggestedName || 'document.elpx');
  setSavedPath(key, finalPath);
  if (typeof downloadUrl === 'string' && downloadUrl && wc) {
    return await streamToFile(downloadUrl, finalPath, wc);
  }
  return false;
});

// Explicitly set the remembered save path for a given project key
ipcMain.handle('app:setSavedPath', async (_e, { projectKey, filePath }) => {
  if (!projectKey || !filePath) return false;
  setSavedPath(projectKey, filePath);
  return true;
});

// Open system file picker for .elpx files (offline open)
ipcMain.handle('app:openElp', async (e) => {
  const senderWindow = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow, {
    title: tOrDefault('open.dialogTitle', defaultLocale === 'es' ? 'Abrir proyecto' : 'Open project'),
    properties: ['openFile'],
    filters: [{ name: 'eXeLearning project', extensions: ['elpx', 'elp', 'zip'] }]
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

function checkAndCreateDatabase() {
  if (!fs.existsSync(databasePath)) {
    console.log('The database does not exist. Creating the database...');
    // Add code to create the database if necessary
    fs.openSync(databasePath, 'w'); // Allow read and write for all users
  } else {
    console.log('The database already exists.');
  }
}

/**
 * Runs Symfony commands using the integrated PHP binary.
 */
function runSymfonyCommands() {
  try {
    // We already created FILES_DIR in ensureAllDirectoriesWritable().
    // Also check other required directories if needed.

    const iniArgs = phpIniArgs();

    const publicDir = path.join(basePath, 'public');
    if (!fs.existsSync(publicDir)) {
      showErrorDialog(`The public directory was not found at the path: ${publicDir}`);
      app.quit();
    }

    const consolePath = path.join(basePath, 'bin', 'console');
    if (!fs.existsSync(consolePath)) {
      showErrorDialog(`The bin/console file was not found at the path: ${consolePath}`);
      app.quit();
    }
    try {
      console.log('Clearing Symfony cache...');
      execFileSync(phpBinaryPath, [...iniArgs, 'bin/console', 'cache:clear'], {
        env: env,
        cwd: basePath,
        windowsHide: true,
        stdio: 'inherit',
      });
    } catch (cacheError) {
      console.error('Error clearing cache (non-critical):', cacheError.message);
    }

    console.log('Creating database tables in SQLite...');
    execFileSync(phpBinaryPath, [...iniArgs, 'bin/console', 'doctrine:schema:update', '--force'], {
      env: env,
      cwd: basePath,
      windowsHide: true,
      stdio: 'inherit',
    });

    // Do NOT run assets:install when packaged: the directory is read-only
    if (!app.isPackaged) {
      try {
        console.log('Installing assets in public (dev/local only)...');
        execFileSync(
          phpBinaryPath,
          [...iniArgs, 'bin/console', 'assets:install', 'public', '--no-debug', '--env=prod'],
          {
            env, cwd: basePath, windowsHide: true, stdio: 'inherit',
          },
        );
      } catch (e) {
        console.warn('Skipping assets:install:', e.message);
      }
    } else {
      console.log('Skipping assets:install (packaged app is read-only).');
    }

    console.log('Creating test user...');
    execFileSync(
      phpBinaryPath,
      [
        ...iniArgs,
        'bin/console',
        'app:create-user',
        customEnv.TEST_USER_EMAIL,
        customEnv.TEST_USER_PASSWORD,
        customEnv.TEST_USER_USERNAME,
        '--no-fail',
      ],
      {
        env, cwd: basePath, windowsHide: true, stdio: 'inherit',
      },
    );

    console.log('Symfony commands executed successfully.');
  } catch (err) {
    showErrorDialog(`Error executing Symfony commands: ${err.message}`);
    app.quit();
  }
}

function phpIniArgs() {
  const maxExecutionTime = String(process.env.PHP_MAX_EXECUTION_TIME ?? '600');
  const maxInputTime = String(process.env.PHP_MAX_INPUT_TIME ?? maxExecutionTime);
  const memoryLimit = String(process.env.PHP_MEMORY_LIMIT ?? '512M');
  const uploadMaxFilesize = String(process.env.PHP_UPLOAD_MAX_FILESIZE ?? '512M');
  let postMaxSize = String(process.env.PHP_POST_MAX_SIZE ?? uploadMaxFilesize);

  // Ensure POST payload limit is never lower than the upload limit.
  const parseSize = (value) => {
    if (!value) return 0;
    const match = String(value).trim().match(/^(\d+)([KMG]?)/i);
    if (!match) return Number(value) || 0;
    const quantity = Number(match[1]);
    const unit = match[2]?.toUpperCase();
    switch (unit) {
      case 'G': return quantity * 1024 * 1024 * 1024;
      case 'M': return quantity * 1024 * 1024;
      case 'K': return quantity * 1024;
      default: return quantity;
    }
  };

  if (parseSize(postMaxSize) < parseSize(uploadMaxFilesize)) {
    postMaxSize = uploadMaxFilesize;
  }

  return [
    '-dopcache.enable=1',
    '-dopcache.enable_cli=1',
    '-dopcache.memory_consumption=128',
    '-dopcache.interned_strings_buffer=16',
    '-dopcache.max_accelerated_files=20000',
    '-dopcache.validate_timestamps=0',
    '-drealpath_cache_size=4096k',
    '-drealpath_cache_ttl=600',
    `-dmax_execution_time=${maxExecutionTime}`,
    `-dmax_input_time=${maxInputTime}`,
    `-dmemory_limit=${memoryLimit}`,
    `-dupload_max_filesize=${uploadMaxFilesize}`,
    `-dpost_max_size=${postMaxSize}`,
  ];
}

/**
 * Starts the embedded PHP server.
 */
function startPhpServer() {
  try {
    phpServer = spawn(
      phpBinaryPath,
      [...phpIniArgs(), '-S', `localhost:${customEnv.APP_PORT}`, '-t', 'public', 'public/router.php'],
      {
        // env: Object.assign({}, process.env, customEnv),
        env, // usa el env ya combinado por combineEnv()
        cwd: basePath,
        windowsHide: true,
      }
    );

    phpServer.on('error', (err) => {
      console.error('Error starting PHP server:', err.message);
      if (err.message.includes('EADDRINUSE')) {
        showErrorDialog(`Port ${customEnv.APP_PORT} is already in use. Close the process using it and try again.`);
      } else {
        showErrorDialog(`Error starting PHP server: ${err.message}`);
      }
      app.quit();
    });

    phpServer.stdout.on('data', (data) => {
      console.log(`PHP: ${data}`);
    });

    phpServer.stderr.on('data', (data) => {
      // Normalize to string
      const text = data instanceof Buffer ? data.toString() : String(data);

      // Process line by line (chunks can arrive concatenated)
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;

        // Silence php -S noise: "[::1]:64324 Accepted" / "[::1]:64324 Closing"
        if (/\[(?:::1|127\.0\.0\.1)\]:\d+\s+(?:Accepted|Closing)\s*$/i.test(line)) {
          continue;
        }

        // Hide simple succesful access logs like [200] or [301]
        // Example: "[::1]:64331 [200]: GET /path" | "[::1]:64335 [301]: POST /path"
        if (/\[\s*(?:200|301)\s*\]:\s+(GET|POST|PUT|DELETE|HEAD|OPTIONS)\s+/i.test(line)) {
          continue;
        }

        // Detect "Address already in use" and stop the app
        if (line.includes('Address already in use')) {
          showErrorDialog(`Port ${customEnv.APP_PORT} is already in use. Close the process using it and try again.`);
          app.quit();
          return;
        }

        // Keep useful stderr
        console.warn(`${line}`);
      }
    });

    phpServer.on('close', (code) => {
      console.log(`The PHP server closed with code ${code}`);
      if (code !== 0) {
        app.quit();
      }
    });
  } catch (err) {
    showErrorDialog(`Error starting PHP server: ${err.message}`);
    app.quit();
  }
}

/**
 * Shows an error dialog.
 * 
 * @param {string} message - The message to display.
 */
function showErrorDialog(message) {
  dialog.showErrorBox('Error', message);
}

// Helper: resolve platform and arch folders used in extraResources
function resolvePhpRuntimeRoot() {
  const plat = process.platform === 'win32' ? 'win' : (process.platform === 'darwin' ? 'mac' : 'linux');
  // En mac "universal" de Electron puede ejecutarse como arm64 o x64 (Rosetta).
  const arch = (process.platform === 'darwin')
    ? (process.arch === 'arm64' ? 'arm64' : 'x64')
    : 'x64';

  // Todo lo que copies con extraResources vive fuera del asar, bajo resourcesPath.
  // Estructura final esperada: <resources>/php/<plat>/<arch>/(php.exe|php)
  return path.join(process.resourcesPath, 'php', plat, arch);
}

/**
 * Pick the first existing file from candidates.
 * @param {string[]} candidates
 */
function pickExisting(candidates) {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
    } catch (_) {}
  }
  return null;
}

/**
 * Ensure exec bit on POSIX.
 * @param {string} p
 */
function ensureExecIfNeeded(p) {
  if (process.platform !== 'win32') {
    try { fs.chmodSync(p, 0o755); } catch (_) {}
  }
}

/**
 * Try to resolve system PHP for dev.
 */
function findSystemPhp() {
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(which, ['php'], { windowsHide: true, stdio: 'pipe' })
      .toString().split(/\r?\n/)[0].trim();
    return out || null;
  } catch (_) { return null; }
}

/**
 * Resolve the embedded PHP binary path across mac (universal), Linux, and Windows.
 * - macOS packaged: <Resources>/php/mac/php  (fat binary)
 * - Linux packaged: <Resources>/php/linux/<arch>/php
 * - Windows packaged: <Resources>/php/win/x64/php.exe
 * - dev: ./runtime/php/... or fallback to system "php"
 */
function getPhpBinaryPath() {
  const isPackaged = app.isPackaged;
  const binWin = 'php.exe';
  const binNix = 'php';

  if (process.platform === 'darwin') {
    // Universal: single FAT binary path in packaged app
    const prod = path.join(process.resourcesPath, 'php', 'mac', binNix);
    // In dev, keep arch layout from runtime/php/mac/<arch>/*
    const devArch = (process.arch === 'arm64') ? 'arm64' : 'x64';
    const dev = [
      path.join(app.getAppPath(), 'runtime', 'php', 'mac', devArch, binNix),
      path.join(app.getAppPath(), 'runtime', 'php', 'mac', devArch, 'php-8.4', 'bin', binNix),
      path.join(app.getAppPath(), 'runtime', 'php', 'mac', devArch, 'php-8.4', binNix)
    ];
    const chosen = pickExisting(isPackaged ? [prod] : [...dev, prod]);
    if (chosen) { ensureExecIfNeeded(chosen); return chosen; }
    if (!isPackaged) { const sys = findSystemPhp(); if (sys) return sys; }
    throw new Error('php-runtime-missing (mac): ' + [prod, ...dev].join(' | '));
  }

  if (process.platform === 'linux') {
    // Keep per-arch layout; default to x64. If someday arm64 is present, it will just work.
    const arch = (process.arch === 'arm64') ? 'arm64' : 'x64';
    const prod = path.join(process.resourcesPath, 'php', 'linux', arch, binNix);
    const dev = [
      path.join(app.getAppPath(), 'runtime', 'php', 'linux', arch, binNix),
      path.join(app.getAppPath(), 'runtime', 'php', 'linux', arch, 'php-8.4', 'bin', binNix),
      // Fallback to x64 in dev if you’re on arm64 but only prepared x64 runtime
      ...(arch === 'arm64' ? [
        path.join(app.getAppPath(), 'runtime', 'php', 'linux', 'x64', binNix),
        path.join(app.getAppPath(), 'runtime', 'php', 'linux', 'x64', 'php-8.4', 'bin', binNix),
      ] : []),
    ];
    const chosen = pickExisting(isPackaged ? [prod] : [...dev, prod]);
    if (chosen) { ensureExecIfNeeded(chosen); return chosen; }
    if (!isPackaged) { const sys = findSystemPhp(); if (sys) return sys; }
    throw new Error('php-runtime-missing (linux): ' + [prod, ...dev].join(' | '));
  }

  if (process.platform === 'win32') {
    // We ship x64 on Windows
    const prod = path.join(process.resourcesPath, 'php', 'win', 'x64', binWin);
    const dev = [
      path.join(app.getAppPath(), 'runtime', 'php', 'win', 'x64', binWin),
      path.join(app.getAppPath(), 'runtime', 'php', 'win', 'x64', 'php-8.4', 'php.exe'),
      path.join(app.getAppPath(), 'runtime', 'php', 'win', 'x64', 'php-8.4', 'bin', 'php.exe'),
    ];
    const chosen = pickExisting(isPackaged ? [prod] : [...dev, prod]);
    if (chosen) return chosen;
    if (!isPackaged) { const sys = findSystemPhp(); if (sys) return sys; }
    throw new Error('php-runtime-missing (win): ' + [prod, ...dev].join(' | '));
  }

  throw new Error(`unsupported platform: ${process.platform}`);
}

// --- Windows-only VC++ runtime check for embedded PHP ---
function assertWindowsPhpUsableOrGuide() {
  // Run only on Windows
  if (process.platform !== 'win32') return;

  const VC_REDIST_URL = 'https://aka.ms/vs/17/release/vc_redist.x64.exe';

  try {
    // Quick probe: if PHP starts, dependencies are fine.
    execFileSync(phpBinaryPath, ['-v'], { windowsHide: true, stdio: 'pipe' });
    return;
  } catch (err) {
    // Optional: check registry to see if the VC++ 2015–2022 (x64) runtime is installed
    let vcredistInstalled = false;
    try {
      const out = execFileSync('reg', [
        'query',
        'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64',
        '/v',
        'Installed'
      ], { windowsHide: true, stdio: 'pipe' }).toString();
      vcredistInstalled = /\bInstalled\s+REG_DWORD\s+0x1\b/i.test(out);
    } catch (_) {
      // If the key is missing or unreadable, assume it's not installed.
      vcredistInstalled = false;
    }

    // Build a user-friendly message
    const message = vcredistInstalled
      ? 'PHP could not be started. The embedded PHP binary may be corrupted or incompatible.'
      : 'Microsoft Visual C++ 2015–2022 (x64) is required to run the embedded PHP on Windows.';

    const detail = vcredistInstalled
      ? 'Please reinstall eXeLearning or replace the embedded PHP runtime.'
      : 'Click “Install VC++ now” to download it from Microsoft. After installing, reopen eXeLearning.';

    // Offer to open the official installer link
    const { shell } = require('electron');
    const buttons = vcredistInstalled ? ['Exit'] : ['Install VC++ now', 'Exit'];
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1,
      message,
      detail
    });

    if (!vcredistInstalled && choice === 0) {
      shell.openExternal(VC_REDIST_URL);
    }
    app.quit();
  }
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
      if (a && /\.elpx$/i.test(a) && !a.startsWith('-')) {
        pendingOpenFiles.push(a);
      }
    }
  }

  // macOS: 'open-file' is emitted for each file, before or after 'ready'
  app.on('open-file', (event, filePath) => {
    event.preventDefault(); // prevent default OS handling
    if (app.isReady() && mainWindow) {
      // Send immediately if UI is ready
      mainWindow.webContents.send('app:open-file', filePath);
    } else {
      // Queue until UI is ready
      pendingOpenFiles.push(filePath);
    }
  });

  // Single instance lock: collect files from second invocations (Win/Linux)
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', (_event, argv) => {
    // Bring to front
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // On Windows, file path is usually the last arg
    const files = argv.filter(a => /\.elpx$/i.test(a));
    for (const f of files) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app:open-file', f);
      } else {
        pendingOpenFiles.push(f);
      }
    }
  });
}



// Helper: translated or default fallback (handles missing/bad translations)
function tOrDefault(key, fallback) {
  try {
    const val = i18n.__(key);
    if (!val || val === key) return fallback;
    return val;
  } catch (_e) {
    return fallback;
  }
}
