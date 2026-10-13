import { describe, expect, it, mock } from 'bun:test';
import { EventEmitter } from 'node:events';
const { printPreview } = require('./print-preview');

function setup(success = true, reason = '') {
    const win = Object.assign(new EventEmitter(), {
        loadURL: mock(async (_url: string) => {}),
        isDestroyed: mock(() => false),
        destroy: mock(() => {}),
        webContents: {
            executeJavaScript: mock(async (_code: string) => {}),
            print: mock((_options: object, callback: (ok: boolean, error: string) => void) =>
                callback(success, reason),
            ),
        },
    });
    return { win, createWindow: mock(() => win) };
}

describe('native print preview', () => {
    it('loads the snapshot, waits for fonts and reports native success', async () => {
        const deps = setup();
        expect(await printPreview('blob:preview', deps)).toEqual({ success: true, canceled: false });
        expect(deps.win.loadURL).toHaveBeenCalledWith('blob:preview');
        expect(deps.win.webContents.executeJavaScript).toHaveBeenCalledWith(
            'document.fonts.ready.then(() => undefined)',
        );
        expect(deps.win.webContents.print.mock.calls[0][0]).toEqual({ silent: false, printBackground: false });
        expect(deps.win.destroy).toHaveBeenCalledTimes(1);
        expect(deps.win.listenerCount('closed')).toBe(0);
    });

    it('waits for loading before asking the printer', async () => {
        const deps = setup();
        let loaded!: () => void;
        deps.win.loadURL = mock(
            () =>
                new Promise<void>(resolve => {
                    loaded = resolve;
                }),
        );
        const printing = printPreview('blob:preview', deps);
        expect(deps.win.webContents.print).not.toHaveBeenCalled();
        loaded();
        await printing;
        expect(deps.win.webContents.print).toHaveBeenCalledTimes(1);
    });

    for (const reason of ['No valid printers available', 'Failed to enumerate printers', 'Print job failed']) {
        it('reports the native error: ' + reason, async () => {
            const deps = setup(false, reason);
            expect(await printPreview('blob:preview', deps)).toEqual({
                success: false,
                canceled: false,
                error: reason,
            });
            expect(deps.win.destroy).toHaveBeenCalledTimes(1);
        });
    }

    it.each(['Print job canceled', 'Print job cancelled'])(
        'does not report a user cancellation as failure (%s)',
        async reason => {
            expect(await printPreview('blob:preview', setup(false, reason))).toEqual({
                success: false,
                canceled: true,
            });
        },
    );

    it.each([null, 'https://example.org', 'file:///private.html'])('rejects non-snapshot URLs (%s)', async url => {
        const deps = setup();
        expect(await printPreview(url, deps)).toEqual({
            success: false,
            canceled: false,
            error: 'Invalid print preview URL',
        });
        expect(deps.createWindow).not.toHaveBeenCalled();
    });

    it('handles window creation failure', async () => {
        const createWindow = () => {
            throw 'Window unavailable';
        };
        expect(await printPreview('blob:preview', { createWindow })).toEqual({
            success: false,
            canceled: false,
            error: 'Window unavailable',
        });
    });

    for (const stage of ['loadURL', 'executeJavaScript', 'print']) {
        it('releases the window after ' + stage + ' fails', async () => {
            const deps = setup();
            const target = stage === 'loadURL' ? deps.win : deps.win.webContents;
            (target as any)[stage] = mock(() => {
                throw new Error('Failed');
            });
            expect(await printPreview('blob:preview', deps)).toEqual({
                success: false,
                canceled: false,
                error: 'Failed',
            });
            expect(deps.win.destroy).toHaveBeenCalledTimes(1);
            expect(deps.win.listenerCount('closed')).toBe(0);
        });
    }

    it('finishes if the window closes while printing', async () => {
        const deps = setup();
        deps.win.webContents.print = mock(() => {
            deps.win.isDestroyed = mock(() => true);
            deps.win.emit('closed');
        });
        expect(await printPreview('blob:preview', deps)).toEqual({
            success: false,
            canceled: false,
            error: 'Print window closed',
        });
        expect(deps.win.destroy).not.toHaveBeenCalled();
    });

    describe('a print whose dialog never answers', () => {
        /** A window whose dialog never answers, and which closes when destroyed, as Electron's does. */
        function hanging() {
            const deps = setup();
            deps.win.webContents.print = mock(() => {});
            deps.win.destroy = mock(() => {
                deps.win.isDestroyed = mock(() => true);
                deps.win.emit('closed');
            });
            return deps;
        }
        const asked = (deps: ReturnType<typeof setup>) =>
            new Promise<void>(resolve => {
                const wait = () => (deps.win.webContents.print.mock.calls.length ? resolve() : setTimeout(wait, 1));
                wait();
            });

        it('is given up on when the same editor prints again, which releases its window', async () => {
            const stuck = hanging();
            const first = printPreview('blob:first', { ...stuck, owner: 1 });
            await asked(stuck);
            const next = setup();

            expect(await printPreview('blob:next', { ...next, owner: 1 })).toEqual({ success: true, canceled: false });
            expect(await first).toEqual({ success: false, canceled: true });
            expect(stuck.win.destroy).toHaveBeenCalledTimes(1);
            expect(stuck.win.listenerCount('closed')).toBe(0);
        });

        it('is given up on while still loading too', async () => {
            const stuck = hanging();
            stuck.win.loadURL = mock(
                () =>
                    new Promise<void>((_resolve, reject) =>
                        stuck.win.once('closed', () => reject(new Error('aborted'))),
                    ),
            );
            const first = printPreview('blob:first', { ...stuck, owner: 1 });
            await printPreview('blob:next', { ...setup(), owner: 1 });

            expect(await first).toEqual({ success: false, canceled: true });
        });

        it('is left alone when another editor prints', async () => {
            const stuck = hanging();
            const first = printPreview('blob:first', { ...stuck, owner: 1 });
            await asked(stuck);

            await printPreview('blob:other', { ...setup(), owner: 2 });

            expect(stuck.win.destroy).not.toHaveBeenCalled();
            // Settle it, so the test leaves nothing behind.
            await printPreview('blob:next', { ...setup(), owner: 1 });
            expect(await first).toEqual({ success: false, canceled: true });
        });
    });
});
