// tests/electron/export-folder.spec.js
const { test, expect, _electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

function tmpDir(name) {
  const dir = path.join(os.tmpdir(), `exe-e2e-${name}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
  return win;
}

test.describe('Export to Folder (Unzipped Website)', () => {
  test('exports HTML5 into chosen directory (offline)', async () => {
    const appPath = path.join(__dirname, '../../');
    const dataDir = tmpDir('data');
    const exportDir = tmpDir('export');

    const APP_PORT = '54911';
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

    const electronApp = await _electron.launch({ args: ['main.js'], cwd: appPath, env });

    // Stub: openDirectory picker -> exportDir
    await electronApp.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
    }, exportDir);

    const window = await openMainAppWindow(electronApp, APP_PORT);

    // Create new project then export to folder
    await window.click('a#dropdownFile');
    await window.click('#navbar-button-new');
    await new Promise(r => setTimeout(r, 1000));

    await window.click('a#dropdownFile');
    await window.click('#dropdownExportAsOffline');
    await window.click('#navbar-button-exportas-html5-folder');

    // Expect an index.html in the chosen directory
    await waitForFile(path.join(exportDir, 'index.html'), { minBytes: 1 });

    await electronApp.close();
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(exportDir, { recursive: true, force: true }); } catch {}
  });
});

