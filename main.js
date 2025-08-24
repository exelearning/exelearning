const { app, BrowserWindow, dialog }  = require('electron');
const { autoUpdater }                 = require('electron-updater');
const log                             = require('electron-log');
const path                            = require('path');
const i18n                            = require('i18n');
const { spawn, execFileSync }         = require('child_process');
const fs                              = require('fs');
const AdmZip                          = require('adm-zip');
const http                            = require('http'); // Import the http module to check server availability
       
// Determine the base path depending on whether the app is packaged when we enable "asar" packaging
const basePath = app.isPackaged
  ? process.resourcesPath
  : app.getAppPath();

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


// Logger
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Do not download until the user confirms
autoUpdater.autoDownload = false;

/**
 * Initialise listeners and launch the first check.
 * Call this once your main window is ready.
 * @param {BrowserWindow} win - Main renderer window.
 */
function initUpdates(win) {

// IMPORTANT! REMOVE THIS WHEN OPEN THE GH REPOSITORY!
if (!process.env.GH_TOKEN && app.isPackaged ) {
  log.warn('GH_TOKEN not present: updater disabled on this boot');
  return;
}
// IMPORTANT! REMOVE THIS WHEN OPEN THE GH REPOSITORY!

  const showBox = (opts) => dialog.showMessageBox(win, opts);

  autoUpdater.on('error', (err) => {
    dialog.showErrorBox(
      i18n.__('updater.errorTitle'),
      err == null ? 'unknown' : (err.stack || err).toString()
    );
  });

  autoUpdater.on('update-available', (info) => {
    showBox({
      type: 'info',
      title:   i18n.__('updater.updateAvailableTitle'),
      message: i18n.__('updater.updateAvailableMessage', { version: info.version }),
      buttons: [i18n.__('updater.download'), i18n.__('updater.later')],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('No update found');
  });

  autoUpdater.on('update-downloaded', () => {
    showBox({
      type: 'info',
      title:   i18n.__('updater.readyTitle'),
      message: i18n.__('updater.readyMessage'),
      buttons: [i18n.__('updater.restart'), i18n.__('updater.later')],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) setImmediate(() => autoUpdater.quitAndInstall());
    });
  });

  // Background check on every launch
  autoUpdater.checkForUpdates();
}


let phpBinaryPath;
let appDataPath;
let databasePath;

let databaseUrl;

let mainWindow;
let loadingWindow;
let phpServer;
let isShuttingDown = false; // Flag to ensure the app only shuts down once

// Environment variables container
let customEnv;
let env;

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
    APP_ENV: appEnv,
    APP_DEBUG: isDev ? 1 : 0,
    EXELEARNING_DEBUG_MODE: isDev.toString(),
    APP_SECRET: 'CHANGE_THIS_FOR_A_SECRET',
    APP_PORT: '41309',
    APP_ONLINE_MODE: 0,
    APP_AUTH_METHODS: 'none',
    TEST_USER_EMAIL: 'localuser@exelearning.net',
    TEST_USER_USERNAME: 'localuser',
    TEST_USER_PASSWORD: 'RANDOMUNUSEDPASSWORD',
    TRUSTED_PROXIES: '',
    MAILER_DSN: 'smtp://localhost',
    CAS_URL: '',
    DB_DRIVER: 'pdo_sqlite',
    DB_CHARSET: 'utf8',
    DB_PATH: databasePath,
    DB_SERVER_VERSION: '3.32',
    FILES_DIR: path.join(appDataPath, 'data'),
    CACHE_DIR: path.join(appDataPath, 'cache'),
    LOG_DIR: path.join(appDataPath, 'log'),
    MERCURE_URL: '',
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
  env = Object.assign({}, process.env, customEnv);
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

  // Ensure all required directories exist and try to set permissions
  ensureAllDirectoriesWritable(env);

  // Create the loading window
  createLoadingWindow();

  // Check if the database exists and run Symfony commands
  checkAndCreateDatabase();
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
      },
      tabbingIdentifier: 'mainGroup',
      show: false
      // titleBarStyle: 'customButtonsOnHover', // hidden title bar on macOS
    });
    
    // Show the menu bar in development mode, hide it in production
    mainWindow.setMenuBarVisibility(isDev);
    
    // Maximize the window and open it
    mainWindow.maximize();
    mainWindow.show();

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

    initUpdates(mainWindow);   // Init updater logic

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

// Every time any window is created, we apply the handler to it
app.on('browser-window-created', (_event, window) => {
  attachOpenHandler(window);
});

app.whenReady().then(createWindow);

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
      execFileSync(phpBinaryPath, ['bin/console', 'cache:clear'], {
        env: env,
        cwd: basePath,
        windowsHide: true,
        stdio: 'inherit',
      });
    } catch (cacheError) {
      console.error('Error clearing cache (non-critical):', cacheError.message);
    }

    console.log('Creating database tables in SQLite...');
    execFileSync(phpBinaryPath, ['bin/console', 'doctrine:schema:update', '--complete', '--force'], {
      env: env,
      cwd: basePath,
      windowsHide: true,
      stdio: 'inherit',
    });

    console.log('Installing assets in public...');
    execFileSync(phpBinaryPath, ['bin/console', 'assets:install', 'public'], {
      env: env,
      cwd: basePath,
      windowsHide: true,
      stdio: 'inherit',
    });

    console.log('Creating test user...');
    execFileSync(phpBinaryPath, [
      'bin/console',
      'app:create-user',
      customEnv.TEST_USER_EMAIL,
      customEnv.TEST_USER_PASSWORD,
      customEnv.TEST_USER_USERNAME,
      '--no-fail',
    ], {
      env: env,
      cwd: basePath,
      windowsHide: true,
      stdio: 'inherit',
    });

    console.log('Symfony commands executed successfully.');
  } catch (err) {
    showErrorDialog(`Error executing Symfony commands: ${err.message}`);
    app.quit();
  }
}

/**
 * Starts the embedded PHP server.
 */
function startPhpServer() {
  try {
    phpServer = spawn(
      phpBinaryPath,
      ['-S', `localhost:${customEnv.APP_PORT}`, '-t', 'public', 'public/router.php'],
      {
        env: Object.assign({}, process.env, customEnv),
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
      const errorMessage = data.toString();
      console.error(`PHP Error: ${errorMessage}`);
      if (errorMessage.includes('Address already in use')) {
        showErrorDialog(`Port ${customEnv.APP_PORT} is already in use. Close the process using it and try again.`);
        app.quit();
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

/**
 * Gets the path to the embedded PHP binary, extracting it if needed.
 * 
 * @returns {string} The path to the PHP executable.
 */
function getPhpBinaryPath() {
  const platform = process.platform;
  const arch = process.arch;

  // Directory where PHP binaries will be unzipped in userData
  const phpBinaryDir = path.join(app.getPath('userData'), 'php-bin', 'php-8.4');

  // Path of the zip file inside vendor
  const phpZipPath = path.join(
    basePath,
    'vendor',
    'nativephp',
    'php-bin',
    'bin',
    platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'linux',
    arch === 'arm64' && platform === 'darwin' ? 'arm64' : 'x64',
    'php-8.4.zip'
  );

  // If the PHP binary is not unzipped, unzip it
  if (!fs.existsSync(phpBinaryDir)) {
    console.log('Extracting PHP in', phpBinaryDir);
    const zip = new AdmZip(phpZipPath);
    zip.extractAllTo(phpBinaryDir, true);
    console.log('Extraction completed');

    // Apply execution permissions using fs.chmodSync on macOS and Linux
    if (platform !== 'win32') {
      const phpBinary = path.join(phpBinaryDir, 'php');
      try {
        fs.chmodSync(phpBinary, 0o755);
        console.log('Execution permissions applied successfully to the PHP binary');
      } catch (err) {
        showErrorDialog(`Error applying chmod to the PHP binary: ${err.message}`);
        app.quit();
      }
    }
  }

  // Path of the unzipped PHP binary
  const phpBinary = platform === 'win32' ? 'php.exe' : 'php';
  const phpBinaryPathFinal = path.join(phpBinaryDir, phpBinary);

  if (!fs.existsSync(phpBinaryPathFinal)) {
    showErrorDialog(`The PHP binary was not found at the path: ${phpBinaryPathFinal}`);
    app.quit();
  }

  return phpBinaryPathFinal;
}
