import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewEmbedHost } from './previewEmbedHost.js';

// The editor loads the built, hash-verified ARTIFACT, not a raw source file
// (ADR-0020 step 3). The artifact carries the same relay plus the media half.
const RELAY_SRC = 'app/common/exe_external_media/dist/exe-external-media-host.min.js';

describe('PreviewEmbedHost', () => {
    let win;
    let loadedScripts;
    let loadScript;
    let relayClear;
    let relayDispose;
    let relayInit;

    beforeEach(() => {
        loadedScripts = [];
        win = { document: {} };
        relayClear = vi.fn();
        relayDispose = vi.fn();
        relayInit = vi.fn(() => ({ clear: relayClear, dispose: relayDispose }));
        loadScript = vi.fn(async (src) => {
            loadedScripts.push(src);
            // Loading the relay defines window.exeEmbedRelay; init() returns the instance.
            if (src.includes('exe-external-media-host')) win.exeEmbedRelay = { init: relayInit };
        });
    });

    it('loads the relay script once and inits it exactly once', async () => {
        const host = new PreviewEmbedHost({ basePath: '/exe', win, loadScript });

        await host.start();
        await host.start();

        expect(loadedScripts).toEqual([`/exe/${RELAY_SRC}`]);
        expect(relayInit).toHaveBeenCalledTimes(1);
        expect(relayInit).toHaveBeenCalledWith({ mode: 'open' });
    });

    it('skips script loading when the relay is already present', async () => {
        win.exeEmbedRelay = { init: relayInit };
        const host = new PreviewEmbedHost({ basePath: '', win, loadScript });

        await host.start();

        expect(loadScript).not.toHaveBeenCalled();
        expect(relayInit).toHaveBeenCalledTimes(1);
    });

    it('hideOverlays() tears down the overlays (preview close / iframe swap)', async () => {
        const host = new PreviewEmbedHost({ basePath: '', win, loadScript });
        await host.start();

        host.hideOverlays();

        expect(relayClear).toHaveBeenCalledTimes(1);
    });

    it('hideOverlays() is a no-op when the relay never started', () => {
        const host = new PreviewEmbedHost({ basePath: '', win, loadScript });

        expect(() => host.hideOverlays()).not.toThrow();
        expect(relayClear).not.toHaveBeenCalled();
    });

    it('stop() disposes the relay and clears the once-guard so a later start re-inits', async () => {
        const host = new PreviewEmbedHost({ basePath: '', win, loadScript });
        await host.start();

        host.stop();

        expect(relayDispose).toHaveBeenCalledTimes(1);
        expect(win.__exePreviewEmbedRelayReady).toBe(false);

        await host.start();
        expect(relayInit).toHaveBeenCalledTimes(2);
    });

    it('stop() is a no-op when the relay never started', () => {
        const host = new PreviewEmbedHost({ basePath: '', win, loadScript });

        expect(() => host.stop()).not.toThrow();
        expect(relayDispose).not.toHaveBeenCalled();
    });

    it('survives a relay that fails to init', async () => {
        win.exeEmbedRelay = { init: vi.fn(() => { throw new Error('boom'); }) };
        const host = new PreviewEmbedHost({ basePath: '', win, loadScript });

        await expect(host.start()).resolves.toBeUndefined();
        expect(() => host.hideOverlays()).not.toThrow();
    });

    it('injects a <script> element for the relay via the default loader', async () => {
        const appended = [];
        const w = {
            document: {
                createElement: () => ({ set src(v) { this._src = v; } }),
                head: {
                    appendChild(el) {
                        appended.push(el);
                        // Simulate a successful load on the next tick.
                        Promise.resolve().then(() => {
                            w.exeEmbedRelay = { init: relayInit };
                            el.onload && el.onload();
                        });
                    },
                },
            },
        };
        const host = new PreviewEmbedHost({ basePath: '/exe', win: w });

        await host.start();

        expect(appended.map((el) => el._src)).toEqual([`/exe/${RELAY_SRC}`]);
        expect(relayInit).toHaveBeenCalledTimes(1);
    });
});
