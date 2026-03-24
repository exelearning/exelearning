// ./public/app/workarea/mock-electron-api.js
// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

Logger.log('Mock Electron API Loaded for E2E testing.');
// Expose a deterministic flag the tests can assert without relying on console logs
window.__MockElectronLoaded = true;

const createMockSaveResult = (suggestedName) => ({
    saved: true,
    canceled: false,
    canceledAt: null,
    filePath: suggestedName || '/fake/export/mock-file.elpx',
    error: null,
    timings: {
        totalMs: 12,
        promptMs: 5,
        normalizeMs: 1,
        writeMs: 6,
    },
});

window.electronAPI = {
    save: (downloadUrl, projectKey, suggestedName) => {
        Logger.log('MOCK [save] called with:', { downloadUrl, projectKey, suggestedName });
        return Promise.resolve(true);
    },
    saveBuffer: (bufferData, projectKey, suggestedName) => {
        Logger.log('MOCK [saveBuffer] called with:', {
            projectKey,
            suggestedName,
            dataLength: bufferData?.byteLength ?? bufferData?.length ?? 0,
        });
        return Promise.resolve(createMockSaveResult(suggestedName));
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
    getMemoryUsage: () => {
        Logger.log('MOCK [getMemoryUsage] called.');
        return Promise.resolve({
            process: {
                rss: 123456789,
                heapTotal: 22334455,
                heapUsed: 11223344,
                external: 556677,
                arrayBuffers: 778899,
            },
            renderer: {
                workingSetSize: 99887766,
                peakWorkingSetSize: 123123123,
                privateBytes: 45645645,
                sharedBytes: 7897897,
            },
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
