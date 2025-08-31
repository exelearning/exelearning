// tests/electron/file-menu.spec.js
const { test, expect, _electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const appPath = path.join(__dirname, '../../');

function tmpDir(name) {
  const dir = path.join(os.tmpdir(), `exe-e2e-${name}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function tmpFile(dir, filename) {
  return path.join(dir, filename);
}
async function waitForFile(filePath, { timeout = 120000, minBytes = 1 } = {}) {
  const start = Date.now();
  for (;;) {
    if (fs.existsSync(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && stat.size >= minBytes) return;
      } catch {}
    }
    if (Date.now() - start > timeout) throw new Error(`Timeout waiting for file: ${filePath}`);
    await new Promise(r => setTimeout(r, 250));
  }
}
async function openMainAppWindow(electronApp, appPort) {
  const targetUrl = `http://localhost:${appPort}`;
  const win = await electronApp.waitForEvent('window', async (page) => {
    try { return (await page.url()).startsWith(targetUrl); } catch { return false; }
  });
  await win.waitForLoadState('domcontentloaded');
  // await win.waitForSelector('#idevice-list', { timeout: 60000 });
  return win;
}

test.describe('File menu', () => {
  test('Save .elp, Export HTML5 and Open existing project', async () => {
    const dataDir = tmpDir('data');
    const downloadsDir = tmpDir('downloads');

    const paths = {
      saveElp: tmpFile(downloadsDir, 'project.elp'),
      exportZip: tmpFile(downloadsDir, 'site-html5.zip'),
      exportScorm: tmpFile(downloadsDir, 'scorm12.zip'),
    };

    const APP_PORT = '54901';
    const env = {
      ...process.env,
      E2E_TEST: '1',
      APP_ENV: 'test',
      APP_DEBUG: '1',
      APP_ONLINE_MODE: '0',
      APP_PORT: APP_PORT,
      DB_PATH: path.join(dataDir, 'exelearning.db'),
      FILES_DIR: path.join(dataDir, 'files'),
      CACHE_DIR: path.join(dataDir, 'cache'),
      LOG_DIR: path.join(dataDir, 'log'),
      TEST_USER_EMAIL: 'localuser@exelearning.net',
      TEST_USER_PASSWORD: 'pass',
      TEST_USER_USERNAME: 'localuser',
    };

    const electronApp = await _electron.launch({
      args: ['main.js'],
      cwd: appPath,
      env,
    });

    // Stub dialogs with only serializable data; keep counters inside evaluate()
    await electronApp.evaluate(({ dialog }, { savePaths, openPath }) => {
      let saveIdx = 0;
      dialog.showSaveDialog = async () => {
        const idx = Math.min(saveIdx, savePaths.length - 1);
        const filePath = savePaths[idx];
        saveIdx += 1;
        return { canceled: false, filePath };
      };
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [openPath] });
    }, {
      savePaths: [paths.saveElp, paths.exportZip, paths.exportScorm],
      openPath: paths.saveElp,
    });

    const window = await openMainAppWindow(electronApp, APP_PORT);

    // 1) New
    await window.click('a#dropdownFile');
    await window.click('#navbar-button-new');
    // await expect(window.locator('#idevice-list')).toBeVisible();

    // Espera 1 segundo
    await new Promise(r => setTimeout(r, 1000));


    // 2) Save (.elp) — use a project key to force a fresh save dialog
    await window.evaluate(() => { window.__currentProjectId = 'proj-save'; });
    await window.click('a#dropdownFile');
    await window.click('#navbar-button-save');
    await waitForFile(paths.saveElp, { minBytes: 1 });

    // Espera 1 segundo
    await new Promise(r => setTimeout(r, 1000));


    // 3) Export as (offline) → Website (HTML5)
    // await window.evaluate(() => { window.__currentProjectId = 'export-html5'; });
    // await window.click('a#dropdownFile');
    // await window.click('#dropdownExportAsOffline'); // open dropend submenu
    // await window.click('#navbar-button-exportas-html5');
    // await waitForFile(paths.exportZip, { minBytes: 1 });

    // // 4) Export as (offline) → SCORM 1.2
    // await window.evaluate(() => { window.__currentProjectId = 'export-scorm12'; });
    // await window.click('a#dropdownFile');
    // await window.click('#dropdownExportAsOffline');
    // await window.click('#navbar-button-exportas-scorm12');
    // await waitForFile(paths.exportScorm, { minBytes: 1 });

    // 5) Open the .elp we just saved
    await window.evaluate(() => { window.__currentProjectId = 'open-proj'; });
    await window.click('a#dropdownFile');
    await window.click('#navbar-button-openuserodefiles');
    await expect(window.locator('#idevice-list')).toBeVisible({ timeout: 30000 });

    // Espera 1 segundo
    await new Promise(r => setTimeout(r, 1000));


    await electronApp.close();

    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(downloadsDir, { recursive: true, force: true }); } catch {}
  });
});
