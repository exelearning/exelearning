import { describe, expect, it, mock } from 'bun:test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { guardIpcMain, isTrustedSender } = require('./ipc-sender-guard');

const mainFrame = { url: 'app://localhost/' };
const sender = { mainFrame };

describe('isTrustedSender', () => {
    it('accepts the main frame of a window loaded from the app origin', () => {
        expect(isTrustedSender({ sender, senderFrame: mainFrame })).toBe(true);
        expect(isTrustedSender({ sender, senderFrame: { url: 'app://localhost/viewer/index.html' } })).toBe(false);
    });

    it('rejects a subframe even when it carries the app origin', () => {
        const subframe = { url: 'app://localhost/viewer/index.html' };
        expect(isTrustedSender({ sender, senderFrame: subframe })).toBe(false);
    });

    it('rejects the opaque preview document and anything not loaded by the app', () => {
        for (const url of [
            'preview://0123456789abcdef0123456789abcdef/index.html',
            'https://localhost/',
            'about:srcdoc',
            'blob:app://localhost/123',
            'not a url',
        ]) {
            expect(isTrustedSender({ sender: { mainFrame: { url } }, senderFrame: { url } }), url).toBe(false);
        }
    });

    it('rejects an event without a frame or a sender', () => {
        expect(isTrustedSender({ sender, senderFrame: null })).toBe(false);
        expect(isTrustedSender({ sender: null, senderFrame: mainFrame })).toBe(false);
        expect(isTrustedSender(undefined)).toBe(false);
    });

    it('honours a custom trusted-origin list (development server)', () => {
        const dev = { url: 'http://localhost:3001/workarea' };
        expect(isTrustedSender({ sender: { mainFrame: dev }, senderFrame: dev })).toBe(false);
        expect(
            isTrustedSender({ sender: { mainFrame: dev }, senderFrame: dev }, { trustedOrigins: ['http://localhost:3001'] }),
        ).toBe(true);
    });
});

describe('guardIpcMain', () => {
    function fakeIpcMain() {
        const handlers = new Map<string, Function>();
        return {
            handlers,
            handle: (channel: string, listener: Function) => handlers.set(channel, listener),
            on: (channel: string, listener: Function) => handlers.set(channel, listener),
        };
    }

    it('passes trusted invocations through with their arguments', async () => {
        const ipcMain = fakeIpcMain();
        const listener = mock((_event: unknown, payload: unknown) => ({ got: payload }));
        guardIpcMain(ipcMain, { log: () => {} }).handle('app:x', listener);

        const result = await ipcMain.handlers.get('app:x')!({ sender, senderFrame: mainFrame }, { a: 1 });

        expect(result).toEqual({ got: { a: 1 } });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('rejects an untrusted invocation before the handler runs', async () => {
        const ipcMain = fakeIpcMain();
        const listener = mock(() => 'secret');
        const log = mock(() => {});
        guardIpcMain(ipcMain, { log }).handle('app:readFile', listener);
        const preview = { url: 'preview://0123456789abcdef0123456789abcdef/index.html' };

        expect(() => ipcMain.handlers.get('app:readFile')!({ sender: { mainFrame: preview }, senderFrame: preview })).toThrow(
            /not available to this frame/,
        );
        expect(listener).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledTimes(1);
    });

    it('a one-shot listener survives an untrusted message and fires once for the trusted one', () => {
        const listeners = new Map<string, Function>();
        const ipcMain = {
            on: (channel: string, listener: Function) => listeners.set(channel, listener),
            handle: () => {},
            removeListener: (channel: string, listener: Function) => {
                if (listeners.get(channel) === listener) listeners.delete(channel);
            },
        };
        const listener = mock(() => {});
        guardIpcMain(ipcMain, { log: () => {} }).once('app:close-copy-response', listener);

        listeners.get('app:close-copy-response')!({ sender, senderFrame: { url: 'about:srcdoc' } }, 'forged');
        expect(listener).not.toHaveBeenCalled();
        expect(listeners.has('app:close-copy-response')).toBe(true);

        listeners.get('app:close-copy-response')!({ sender, senderFrame: mainFrame }, 'real');
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listeners.has('app:close-copy-response')).toBe(false);
    });

    it('drops an untrusted message on a fire-and-forget channel', () => {
        const ipcMain = fakeIpcMain();
        const listener = mock(() => {});
        guardIpcMain(ipcMain, { log: () => {} }).on('app:ready', listener);

        ipcMain.handlers.get('app:ready')!({ sender, senderFrame: { url: 'about:srcdoc' } });
        ipcMain.handlers.get('app:ready')!({ sender, senderFrame: mainFrame });

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
