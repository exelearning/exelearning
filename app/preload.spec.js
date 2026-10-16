const { describe, expect, test, mock } = require('bun:test');

let exposedApi;
const invoke = mock((channel, payload) => Promise.resolve({ channel, payload }));

mock.module('electron', () => ({
    contextBridge: {
        exposeInMainWorld: (_name, api) => {
            exposedApi = api;
        },
    },
    ipcRenderer: { invoke, send: mock(() => {}), on: mock(() => {}) },
    webUtils: { getPathForFile: mock(() => '/tmp/example.elpx') },
}));

require('./preload');

describe('spell checker preload bridge', () => {
    test('reads spell checker settings through the expected IPC channel', async () => {
        await exposedApi.getSpellCheckerSettings();
        expect(invoke).toHaveBeenLastCalledWith('app:getSpellCheckerSettings');
    });

    test('forwards selected spell checker languages', async () => {
        await exposedApi.setSpellCheckerLanguages(['es', 'en-US']);
        expect(invoke).toHaveBeenLastCalledWith('app:setSpellCheckerLanguages', ['es', 'en-US']);
    });
});
