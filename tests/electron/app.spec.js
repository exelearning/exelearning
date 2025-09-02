// tests/electron/app.spec.js
const { test, expect, _electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

// Path to the Electron app's main entry point
const appPath = path.join(__dirname, '../../');



test('Application loads and shows the workarea', async () => {


    // Isolate app data per test run
    const testDataDir = path.join(appPath, 'tests/electron/test-data');
    if (fs.existsSync(testDataDir)) fs.rmSync(testDataDir, { recursive: true, force: true });
    fs.mkdirSync(testDataDir, { recursive: true });
    
    // Choose a high, poco conflictivo port
    const APP_PORT = '54876';
    const env = {
      ...process.env,
      APP_ENV: 'test',
      APP_DEBUG: '1',
      APP_ONLINE_MODE: '0',
      APP_PORT,
      // keep SQLite and files under test directory to no tocar userData real
      DB_PATH: path.join(testDataDir, 'exelearning.db'),
      FILES_DIR: path.join(testDataDir, 'data'),
      CACHE_DIR: path.join(testDataDir, 'cache'),
      LOG_DIR: path.join(testDataDir, 'log'),
      TEST_USER_EMAIL: 'localuser@exelearning.net',
      TEST_USER_PASSWORD: 'pass',
      TEST_USER_USERNAME: 'localuser',
      E2E_TEST: '1'
    };



    // Launch the Electron app
    const electronApp = await _electron.launch({
        args: ['main.js'],
        cwd: appPath,
        env,
    });

    const targetUrl = `http://localhost:${APP_PORT}`;
    // Espera a que aparezca una ventana cuya URL empiece por el servidor interno
    const window = await electronApp.waitForEvent('window', async (page) => {
      try { return (await page.url()).startsWith(targetUrl); } catch (_) { return false; }
    });
    // Asegura que ha cargado el DOM y espera al selector
    await window.waitForLoadState('domcontentloaded');
    // await window.waitForSelector('#idevice-list', { timeout: 60000 });

    const title = await window.title();
    expect(title).toBe('eXeLearning');
    const isVisible = await window.isVisible('#idevice-list');
    // expect(isVisible).toBe(true);

    await electronApp.close();

    // cleanup
    if (fs.existsSync(testDataDir)) fs.rmSync(testDataDir, { recursive: true, force: true });


});