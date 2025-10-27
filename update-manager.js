// update-manager.js
// Central update manager for electron-updater (generic provider).
// Usage: const { initAutoUpdater } = require('./update-manager');
// initAutoUpdater({ mainWindow, autoUpdater, logger: log, streamToFile });

const { dialog, app, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const url = require('url');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

/**
 * Initialize auto update handlers.
 *
 * @param {Object} opts
 * @param {BrowserWindow} opts.mainWindow - main BrowserWindow (required to show dialogs and send IPC)
 * @param {AutoUpdater} opts.autoUpdater - electron-updater.autoUpdater instance (required)
 * @param {Object} [opts.logger] - logger (defaults to console)
 * @param {Function} [opts.streamToFile] - optional download function (downloadUrl, targetPath, progressCb) => Promise<boolean>
 * @param {string} [opts.genericBaseUrl] - base URL for generic provider (defaults to GitHub latest download URL)
 */
function initAutoUpdater({ mainWindow, autoUpdater, logger = console, streamToFile = null, genericBaseUrl = null }) {
  if (!mainWindow) throw new Error('mainWindow is required');
  if (!autoUpdater) throw new Error('autoUpdater is required');

  // default generic URL that points to "latest" release assets
  const DEFAULT_GENERIC_BASE = 'https://github.com/exelearning/exelearning/releases/latest/download/';
  const baseUrl = (typeof genericBaseUrl === 'string' && genericBaseUrl.length) ? genericBaseUrl : DEFAULT_GENERIC_BASE;

  // Configure autoUpdater for generic provider (we keep autoDownload=false so user decides)
  try {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: baseUrl,
    });
  } catch (err) {
    logger.warn && logger.warn('Could not set feed URL on autoUpdater:', err);
  }

  // If a custom streamToFile wasn't provided, use a small internal downloader that reports progress.
  const defaultStreamToFile = (downloadUrl, targetPath, progressCb = () => {}) => {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(downloadUrl);
        const client = parsed.protocol === 'https:' ? https : http;
        const request = client.get(parsed, (res) => {
          // handle redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return defaultStreamToFile(new URL(res.headers.location, downloadUrl).toString(), targetPath, progressCb).then(resolve);
          }
          if (res.statusCode !== 200) {
            logger.warn && logger.warn('Download HTTP status', res.statusCode, downloadUrl);
            resolve(false);
            return;
          }
          const total = parseInt(res.headers['content-length'] || '0', 10) || 0;
          let received = 0;
          const out = fs.createWriteStream(targetPath);
          res.on('data', (chunk) => {
            received += chunk.length;
            try { progressCb({ received, total }); } catch (_) {}
          });
          res.on('error', (err) => {
            try { out.close(); } catch (_) {}
            resolve(false);
          });
          out.on('error', (err) => {
            try { res.destroy(); } catch (_) {}
            resolve(false);
          });
          out.on('finish', () => resolve(true));
          res.pipe(out);
        });
        request.on('error', () => resolve(false));
      } catch (err) {
        resolve(false);
      }
    });
  };

  const downloadFn = streamToFile || defaultStreamToFile;

  // Utility: pick best Linux asset (.deb/.rpm) or return first valid file
  function pickLinuxAsset(files = []) {
    // files entries could be either { url, name } or {name, url} or {path}
    const arr = Array.isArray(files) ? files : [];
    const findByExt = (ext) => arr.find(f => (f.url||f.path||f.name||'').toLowerCase().endsWith(ext));
    return findByExt('.deb') || findByExt('.rpm') || arr[0] || null;
  }

  // Utility: build a download url from base + name if asset lacks url
  function buildDownloadUrl(asset) {
    if (!asset) return null;
    if (asset.url) return asset.url;
    // some providers put 'path' or 'name'
    const name = asset.name || asset.path || null;
    if (!name) return null;
    // use baseUrl which should point to "latest/download/"
    return baseUrl.endsWith('/') ? (baseUrl + name) : (baseUrl + '/' + name);
  }

  // Notify renderer helper
  function sendToRenderer(channel, payload) {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
    } catch (err) {
      logger.warn && logger.warn('sendToRenderer failed', err);
    }
  }

  // ---- Handlers ----
  autoUpdater.on('checking-for-update', () => logger.info && logger.info('AU: checking-for-update'));
  autoUpdater.on('update-not-available', () => {
    logger.info && logger.info('AU: update-not-available');
    sendToRenderer('update-not-available', {});
  });

  // When the updater finds a release
  autoUpdater.on('update-available', async (info) => {
    logger.info && logger.info('AU: update-available', info && info.version);

    // If we didn't get files metadata, try to still ask user; asset discovery may be provider-specific
    const files = info && info.files ? info.files : [];

    // If platform is linux, prefer .deb/.rpm and handle download manually
    if (process.platform === 'linux') {
      const asset = pickLinuxAsset(files);
      const downloadUrl = buildDownloadUrl(asset);

      // Ask user whether to download now
      const resp = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update available',
        message: `Version ${info.version} is available.`,
        detail: asset && (asset.name || asset.path) ? `Found package: ${asset.name || asset.path}` : 'A new release is available.',
        buttons: ['Download now', 'Remind me later'],
        defaultId: 0,
        cancelId: 1,
      });

      if (resp.response !== 0) {
        // user delayed
        sendToRenderer('update-available', info);
        return;
      }

      // Proceed with download. Determine destination (Downloads folder)
      const downloadsDir = app.getPath && app.getPath('downloads') ? app.getPath('downloads') : path.join(os.homedir(), 'Downloads');
      try { fs.mkdirSync(downloadsDir, { recursive: true }); } catch (_) {}
      const filename = (asset && (asset.name || asset.path)) ? (asset.name || asset.path) : `update-${Date.now()}`;
      const targetPath = path.join(downloadsDir, filename);

      // Start download and send progress events to renderer
      sendToRenderer('update-download-started', { path: targetPath, version: info.version });

      const ok = await downloadFn(downloadUrl, targetPath, (p) => {
        // Progress callback -> forward to renderer
        sendToRenderer('update-download-progress', p);
      });

      if (!ok) {
        dialog.showErrorBox('Update download failed', `Could not download the update from ${downloadUrl}`);
        sendToRenderer('update-download-failed', { url: downloadUrl });
        return;
      }

      // Download finished. On Linux we DO NOT auto-install — we show instructions.
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update downloaded',
        message: 'The update package has been downloaded.',
        detail: `File: ${targetPath}\nTo install it, open it with your package manager (double-click) or install using the terminal.`,
        buttons: ['Open folder', 'Show install instructions', 'Close'],
        defaultId: 0,
        cancelId: 2,
      });

      if (choice.response === 0) {
        shell.showItemInFolder(targetPath);
      } else if (choice.response === 1) {
        // Show simple instructions depending on extension
        if (/\.deb$/i.test(targetPath)) {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Install instructions (.deb)',
            message: 'Install the .deb package using the terminal:',
            detail: `sudo dpkg -i "${targetPath}"\nsudo apt-get install -f\n(Or double-click the .deb to open the installer)`,
            buttons: ['OK']
          });
        } else if (/\.rpm$/i.test(targetPath)) {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Install instructions (.rpm)',
            message: 'Install the .rpm package using the terminal:',
            detail: `sudo rpm -Uvh "${targetPath}"\n(Or use your software installer)`,
            buttons: ['OK']
          });
        } else {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Install instructions',
            message: 'Open the downloaded file and install it with your package manager.',
            detail: `File: ${targetPath}`,
            buttons: ['OK']
          });
        }
      }

      // Notify renderer that download is completed and where file is
      sendToRenderer('update-download-complete', { ok: true, path: targetPath, version: info.version });
      return;
    }

    // For macOS / Windows default behaviour: ask user and allow autoUpdater.downloadUpdate()
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update available',
      message: `Version ${info.version} is available. Do you want to download it now?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      try {
        // will trigger 'download-progress' and 'update-downloaded' events from autoUpdater
        await autoUpdater.downloadUpdate();
      } catch (err) {
        logger.warn && logger.warn('autoUpdater.downloadUpdate failed', err);
      }
    } else {
      sendToRenderer('update-available', info);
    }
  });

  // Forward download progress events to renderer (used by mac/windows)
  autoUpdater.on('download-progress', (progressObj) => {
    logger.info && logger.info('AU progress', progressObj);
    sendToRenderer('update-download-progress', progressObj);
  });

  // When autoUpdater downloaded an update (mac/windows)
  autoUpdater.on('update-downloaded', async (info) => {
    logger.info && logger.info('AU: update-downloaded', info && info.version);

    // On Linux we should never reach here because we handled downloads manually above.
    if (process.platform === 'linux') {
      // just in case: inform renderer
      sendToRenderer('update-downloaded', info);
      return;
    }

    // Ask user whether to install and restart
    const buttons = ['Install and Restart', 'Later'];
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded. Install and restart now?`,
      buttons,
      defaultId: 0,
      cancelId: 1,
    });

    if (response === 0) {
      // For mac/win, quitAndInstall is usually safe
      try {
        autoUpdater.quitAndInstall(true, true);
      } catch (err) {
        try { autoUpdater.quitAndInstall(); } catch (_) {
          logger.warn && logger.warn('quitAndInstall failed', err);
        }
      }
    } else {
      sendToRenderer('update-postponed', info);
    }
  });

  // Error handler
  autoUpdater.on('error', (err) => {
    const msg = err && err.message ? err.message : String(err);
    logger.warn && logger.warn('AU error event:', msg);
    // Optionally show user a non-fatal notification for certain errors:
    // dialog.showMessageBox(mainWindow, { type: 'error', title: 'Updater error', message: msg, buttons: ['OK'] });
    sendToRenderer('update-error', { message: msg });
  });

  // Expose a small helper API on return value so main.js can trigger checks
  return {
    /**
     * Trigger a check for updates (returns the autoUpdater promise).
     * Prefer to call this after app is ready and you have a mainWindow reference.
     */
    checkForUpdates: async () => {
      try {
        // we return the promise so caller can log/catch
        return await autoUpdater.checkForUpdates();
      } catch (err) {
        logger.warn && logger.warn('checkForUpdates failed', err);
        throw err;
      }
    },
    // convenience to call checkForUpdatesAndNotify if desired
    checkForUpdatesAndNotify: async () => {
      try {
        return await autoUpdater.checkForUpdatesAndNotify();
      } catch (err) {
        logger.warn && logger.warn('checkForUpdatesAndNotify failed', err);
        throw err;
      }
    }
  };
}

module.exports = { initAutoUpdater };

