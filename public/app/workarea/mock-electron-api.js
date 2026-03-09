// ./public/app/workarea/mock-electron-api.js
// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

Logger.log('Mock Electron API Loaded for E2E testing.');
// Expose a deterministic flag the tests can assert without relying on console logs
window.__MockElectronLoaded = true;

window.electronAPI = {
    save: (downloadUrl, projectKey, suggestedName) => {
        Logger.log('MOCK [save] called with:', { downloadUrl, projectKey, suggestedName });
        return Promise.resolve(true);
    },
    saveBuffer: (base64Data, projectKey, suggestedName) => {
        Logger.log('MOCK [saveBuffer] called with:', { projectKey, suggestedName, dataLength: base64Data?.length });
        return Promise.resolve(true);
    },
    openElp: () => {
        Logger.log('MOCK [openElp] called.');
        return Promise.resolve('/fake/path/from/mock/test.elp');
    },
    readFile: (options) => {
        Logger.log('MOCK [readFile] called with:', options);
        return Promise.resolve({
            ok: true,
            base64: 'dGVzdCBjb250ZW50', // "test content"
            mtimeMs: Date.now(),
        });
    },
    notifyRendererReadyForOpenFile: () => {
        Logger.log('MOCK [notifyRendererReadyForOpenFile] called.');
    },
    exportToFolder: (options) => {
        Logger.log('MOCK [exportToFolder] called with:', options);
        return Promise.resolve({ ok: true, dir: '/fake/export/dir' });
    },
};
