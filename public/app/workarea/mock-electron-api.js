// ./public/app/workarea/mock-electron-api.js
console.log('Mock Electron API Loaded for E2E testing.');
// Expose a deterministic flag the tests can assert without relying on console logs
window.__MockElectronLoaded = true;

window.electronAPI = {
    save: (options) => {
        console.log('MOCK [save] called with:', options);
        // In a test, we can check the console logs to verify this was called.
        return Promise.resolve(true);
    },
    saveAs: (options) => {
        console.log('MOCK [saveAs] called with:', options);
        return Promise.resolve(true);
    },
    setSavedPath: (options) => {
        console.log('MOCK [setSavedPath] called with:', options);
        return Promise.resolve(true);
    },
    openElp: () => {
        console.log('MOCK [openElp] called.');
        // Return a fake path or null to simulate cancellation
        return Promise.resolve('/fake/path/from/mock/test.elp');
    },
    readFile: (options) => {
        console.log('MOCK [readFile] called with:', options);
        // Return fake base64 content
        return Promise.resolve({
            ok: true,
            base64: 'dGVzdCBjb250ZW50', // "test content"
            mtimeMs: Date.now(),
        });
    },
    exportToFolder: (options) => {
        console.log('MOCK [exportToFolder] called with:', options);
        return Promise.resolve({ ok: true, dir: '/fake/export/dir' });
    },
};
