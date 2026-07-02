import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewMediaHost } from './previewMediaHost.js';

describe('PreviewMediaHost', () => {
    let win;
    let loadedScripts;
    let attachSpy;
    let detachSpy;
    let loadScript;

    beforeEach(() => {
        loadedScripts = [];
        detachSpy = vi.fn();
        attachSpy = vi.fn().mockReturnValue({ detach: detachSpy });
        win = { document: {}, setTimeout, clearTimeout };
        loadScript = vi.fn(async (src) => {
            loadedScripts.push(src);
            // Loading the host bridge script defines window.exeMediaHost.
            if (src.includes('exe-media-host')) {
                win.exeMediaHost = { attach: attachSpy, _youtubeAdapter: vi.fn(), _vimeoAdapter: vi.fn() };
            }
        });
    });

    it('loads the bridge scripts once and attaches per iframe', async () => {
        const host = new PreviewMediaHost({ basePath: '/exe', win, loadScript });
        const iframeA = {};
        const iframeB = {};

        await host.attach(iframeA);
        await host.attach(iframeB);

        expect(loadedScripts).toEqual([
            '/exe/app/common/exe_media_bridge/exe_media_policy.js',
            '/exe/app/common/exe_media_bridge/exe-media-host.js',
        ]);
        expect(attachSpy).toHaveBeenCalledTimes(2);
        expect(attachSpy.mock.calls[0][0]).toBe(iframeA);
        const opts = attachSpy.mock.calls[0][1];
        expect(typeof opts.youtubeFactory).toBe('function');
        expect(typeof opts.vimeoFactory).toBe('function');
    });

    it('skips script loading when the bridge is already present', async () => {
        win.exeMediaHost = { attach: attachSpy, _youtubeAdapter: vi.fn(), _vimeoAdapter: vi.fn() };
        const host = new PreviewMediaHost({ basePath: '', win, loadScript });
        await host.attach({});
        expect(loadScript).not.toHaveBeenCalled();
        expect(attachSpy).toHaveBeenCalledTimes(1);
    });

    it('detachAll detaches every attached iframe', async () => {
        const host = new PreviewMediaHost({ basePath: '', win, loadScript });
        await host.attach({});
        await host.attach({});
        host.detachAll();
        expect(detachSpy).toHaveBeenCalledTimes(2);
        host.detachAll();
        expect(detachSpy).toHaveBeenCalledTimes(2);
    });

    it('buffers playback commands until the provider SDK is ready', async () => {
        const controller = { play: vi.fn(), pause: vi.fn(), seek: vi.fn(), destroy: vi.fn() };
        const realAdapter = vi.fn().mockReturnValue(controller);
        let resolveSdk;
        const sdkLoader = vi.fn(() => new Promise((resolve) => (resolveSdk = resolve)));

        const host = new PreviewMediaHost({ basePath: '', win, loadScript, sdkLoaders: { youtube: sdkLoader } });
        win.exeMediaHost = { attach: attachSpy, _youtubeAdapter: realAdapter, _vimeoAdapter: vi.fn() };
        await host.attach({});

        const { youtubeFactory } = attachSpy.mock.calls[0][1];
        const container = {};
        const cb = { onReady: vi.fn() };
        const facade = youtubeFactory(container, 'vid123', cb);

        facade.play();
        facade.seek(12);
        expect(realAdapter).not.toHaveBeenCalled();

        resolveSdk();
        await Promise.resolve();
        await Promise.resolve();

        expect(realAdapter).toHaveBeenCalledWith(container, 'vid123', cb);
        expect(controller.play).toHaveBeenCalled();
        expect(controller.seek).toHaveBeenCalledWith(12);
    });

    it('ignores queued commands when the facade was destroyed before SDK readiness', async () => {
        const controller = { play: vi.fn(), destroy: vi.fn() };
        const realAdapter = vi.fn().mockReturnValue(controller);
        let resolveSdk;
        const sdkLoader = vi.fn(() => new Promise((resolve) => (resolveSdk = resolve)));

        const host = new PreviewMediaHost({ basePath: '', win, loadScript, sdkLoaders: { youtube: sdkLoader } });
        win.exeMediaHost = { attach: attachSpy, _youtubeAdapter: realAdapter, _vimeoAdapter: vi.fn() };
        await host.attach({});

        const { youtubeFactory } = attachSpy.mock.calls[0][1];
        const facade = youtubeFactory({}, 'vid123', {});
        facade.play();
        facade.destroy();

        resolveSdk();
        await Promise.resolve();
        await Promise.resolve();

        expect(realAdapter).not.toHaveBeenCalled();
    });

    describe('default script + SDK loaders (no injection)', () => {
        function fakeWin() {
            const appended = [];
            return {
                appended,
                document: {
                    createElement: () => ({ set src(v) { this._src = v; } }),
                    head: {
                        appendChild(el) {
                            appended.push(el);
                            // Simulate a successful load on the next tick.
                            Promise.resolve().then(() => el.onload && el.onload());
                        },
                    },
                },
            };
        }

        it('injects a <script> element for each bridge file via the default loader', async () => {
            const w = fakeWin();
            w.exeMediaHost = { attach: attachSpy, _youtubeAdapter: vi.fn(), _vimeoAdapter: vi.fn() };
            // exeMediaHost present → bridge scripts skipped; force loading by clearing it first.
            delete w.exeMediaHost;
            const host = new PreviewMediaHost({ basePath: '/exe', win: w });
            const attachPromise = host.attach({});
            // After the two bridge scripts "load", define exeMediaHost so attach can proceed.
            await Promise.resolve();
            w.exeMediaHost = { attach: attachSpy, _youtubeAdapter: vi.fn(), _vimeoAdapter: vi.fn() };
            await attachPromise;
            expect(w.appended.map((el) => el._src)).toEqual([
                '/exe/app/common/exe_media_bridge/exe_media_policy.js',
                '/exe/app/common/exe_media_bridge/exe-media-host.js',
            ]);
        });

        it('default youtube SDK loader resolves immediately when window.YT is present', async () => {
            const w = fakeWin();
            w.YT = { Player: function () {} };
            w.exeMediaHost = { attach: attachSpy, _youtubeAdapter: vi.fn(), _vimeoAdapter: vi.fn() };
            const host = new PreviewMediaHost({ win: w });
            await host.attach({});
            const { youtubeFactory } = attachSpy.mock.calls[0][1];
            const cb = { onReady: vi.fn() };
            youtubeFactory({}, 'v', cb).play();
            await Promise.resolve();
            await Promise.resolve();
            expect(w.exeMediaHost._youtubeAdapter).toHaveBeenCalled();
        });

        it('default youtube SDK loader resolves via onYouTubeIframeAPIReady after script load', async () => {
            const w = fakeWin();
            w.exeMediaHost = { attach: attachSpy, _youtubeAdapter: vi.fn(), _vimeoAdapter: vi.fn() };
            const host = new PreviewMediaHost({ win: w });
            await host.attach({});
            const { youtubeFactory } = attachSpy.mock.calls[0][1];
            youtubeFactory({}, 'v', {}).play();
            // The default loader appended the IFrame API script and set the global callback.
            await Promise.resolve();
            expect(typeof w.onYouTubeIframeAPIReady).toBe('function');
            w.onYouTubeIframeAPIReady();
            await Promise.resolve();
            await Promise.resolve();
            expect(w.exeMediaHost._youtubeAdapter).toHaveBeenCalled();
        });

        it('default vimeo SDK loader resolves immediately when window.Vimeo is present', async () => {
            const w = fakeWin();
            w.Vimeo = { Player: function () {} };
            w.exeMediaHost = { attach: attachSpy, _youtubeAdapter: vi.fn(), _vimeoAdapter: vi.fn() };
            const host = new PreviewMediaHost({ win: w });
            await host.attach({});
            const { vimeoFactory } = attachSpy.mock.calls[0][1];
            vimeoFactory({}, 'v', {}).play();
            await Promise.resolve();
            await Promise.resolve();
            expect(w.exeMediaHost._vimeoAdapter).toHaveBeenCalled();
        });
    });
});
