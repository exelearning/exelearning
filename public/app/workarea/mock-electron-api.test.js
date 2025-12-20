import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('mock-electron-api.js', () => {
    beforeEach(async () => {
        vi.resetModules();
        window.AppLogger = { log: vi.fn() };
        delete window.__MockElectronLoaded;
        delete window.electronAPI;
        await import('./mock-electron-api.js');
    });

    afterEach(() => {
        delete window.AppLogger;
        delete window.__MockElectronLoaded;
        delete window.electronAPI;
    });

    it('exposes a deterministic loaded flag', () => {
        expect(window.__MockElectronLoaded).toBe(true);
    });

    it('creates electronAPI handlers that resolve successfully', async () => {
        await expect(window.electronAPI.save({ path: 'one.elp' })).resolves.toBe(true);
        await expect(window.electronAPI.saveAs({ path: 'two.elp' })).resolves.toBe(true);
        await expect(window.electronAPI.setSavedPath({ path: 'three.elp' })).resolves.toBe(true);
        await expect(window.electronAPI.openElp()).resolves.toBe('/fake/path/from/mock/test.elp');
        await expect(window.electronAPI.exportToFolder({ dest: '/tmp' })).resolves.toEqual({
            ok: true,
            dir: '/fake/export/dir',
        });
    });

    it('returns deterministic readFile payloads', async () => {
        const response = await window.electronAPI.readFile({ path: 'file.elp' });

        expect(response.ok).toBe(true);
        expect(response.base64).toBe('dGVzdCBjb250ZW50');
        expect(response.mtimeMs).toBeTypeOf('number');
    });

    it('logs mocked operations through AppLogger', async () => {
        await window.electronAPI.save({ path: 'log.elp' });
        await window.electronAPI.openElp();

        expect(window.AppLogger.log).toHaveBeenCalled();
    });
});
