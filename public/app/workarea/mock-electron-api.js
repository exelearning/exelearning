// ./public/app/workarea/mock-electron-api.js
Logger.log('Mock Electron API Loaded for E2E testing.');
// Expose a deterministic flag the tests can assert without relying on console logs
// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

window.__MockElectronLoaded = true;

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

window.electronAPI = {
    save: (options) => {
        Logger.log('MOCK [save] called with:', options);
        // In a test, we can check the console logs to verify this was called.
        return Promise.resolve(true);
    },
    saveAs: (options) => {
        Logger.log('MOCK [saveAs] called with:', options);
        return Promise.resolve(true);
    },
    setSavedPath: (options) => {
        Logger.log('MOCK [setSavedPath] called with:', options);
        return Promise.resolve(true);
    },
    openElp: () => {
        Logger.log('MOCK [openElp] called.');
        // Return a fake path or null to simulate cancellation
        return Promise.resolve('/fake/path/from/mock/test.elp');
    },
    readFile: (options) => {
        Logger.log('MOCK [readFile] called with:', options);
        // Return fake base64 content
        return Promise.resolve({
            ok: true,
            base64: 'dGVzdCBjb250ZW50', // "test content"
            mtimeMs: Date.now(),
        });
    },
    exportToFolder: (options) => {
        Logger.log('MOCK [exportToFolder] called with:', options);
        return Promise.resolve({ ok: true, dir: '/fake/export/dir' });
    },
};
