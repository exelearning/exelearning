/**
 * Editor-side host for the external media bridge.
 *
 * Inside an opaque preview the child bridge (exe_media_bridge.js, shipped in
 * the preview files) cannot embed YouTube/Vimeo itself; it asks the parent to
 * play the video in a trusted modal. The editor workarea therefore attaches
 * the parent relay (exe-media-host.js) to its preview iframes. Bridge scripts
 * and provider SDKs load lazily: most previews never play external media.
 */
const Logger = (typeof window !== 'undefined' && window.AppLogger) || console;

const BRIDGE_SCRIPTS = [
    'app/common/exe_media_bridge/exe_media_policy.js',
    'app/common/exe_media_bridge/exe-media-host.js',
    // Parent-side relay: overlays cross-origin embeds (promoted by exe_embed_shim.js
    // inside the opaque preview) with the real player in-place, automatically, no click.
    'app/common/exe_embed_bridge/exe_embed_relay.js',
];

function defaultLoadScript(win) {
    return (src) =>
        new Promise((resolve, reject) => {
            const script = win.document.createElement('script');
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            win.document.head.appendChild(script);
        });
}

function defaultSdkLoaders(win, loadScript) {
    return {
        youtube: () =>
            new Promise((resolve, reject) => {
                if (win.YT?.Player) return resolve();
                const previous = win.onYouTubeIframeAPIReady;
                win.onYouTubeIframeAPIReady = () => {
                    if (typeof previous === 'function') previous();
                    resolve();
                };
                loadScript('https://www.youtube.com/iframe_api').catch(reject);
            }),
        vimeo: async () => {
            if (win.Vimeo?.Player) return;
            await loadScript('https://player.vimeo.com/api/player.js');
        },
    };
}

export class PreviewMediaHost {
    /**
     * @param {Object} [options]
     * @param {string} [options.basePath]
     * @param {Window} [options.win] Injectable for tests.
     * @param {(src: string) => Promise<void>} [options.loadScript]
     * @param {{youtube?: () => Promise<void>, vimeo?: () => Promise<void>}} [options.sdkLoaders]
     */
    constructor(options = {}) {
        this._basePath = options.basePath || '';
        this._win = options.win || window;
        this._loadScript = options.loadScript || defaultLoadScript(this._win);
        this._sdkLoaders = { ...defaultSdkLoaders(this._win, this._loadScript), ...(options.sdkLoaders || {}) };
        this._bridgeReady = null;
        this._handles = [];
        this._embedRelay = null;
    }

    /**
     * Attach the media relay to a preview iframe. The relay survives child
     * reloads (hello re-pairing), so one attach per iframe is enough.
     * @param {HTMLIFrameElement} iframe
     * @returns {Promise<{detach: Function}>}
     */
    async attach(iframe) {
        await this._ensureBridge();
        // Start the page-global embed relay once: it overlays the real player in-place
        // over embeds the shim promotes from inside the (opaque) preview iframe — no
        // click. It discovers content iframes by event.source, so no per-iframe attach.
        if (this._win.exeEmbedRelay && !this._win.__exePreviewEmbedRelayReady) {
            try {
                this._embedRelay = this._win.exeEmbedRelay.init({ mode: 'open' });
                this._win.__exePreviewEmbedRelayReady = true;
            } catch (error) {
                Logger.warn('[PreviewMediaHost] embed relay init failed:', error);
            }
        }
        const handle = this._win.exeMediaHost.attach(iframe, {
            youtubeFactory: this._lazyFactory('youtube', '_youtubeAdapter'),
            vimeoFactory: this._lazyFactory('vimeo', '_vimeoAdapter'),
        });
        this._handles.push(handle);
        return handle;
    }

    /**
     * Tear down the embed-relay overlays. Called when the preview is hidden/closed:
     * the overlays live on the editor's own body (the panel only slides away via
     * transform, so the iframe keeps a live rect), and would otherwise linger over
     * the editor. They rebuild on the next sync after the iframe reloads on reopen.
     */
    hideEmbedOverlays() {
        try {
            this._embedRelay?.clear();
        } catch (error) {
            Logger.warn('[PreviewMediaHost] embed overlay teardown failed:', error);
        }
    }

    /**
     * Re-place the embed overlays over the current preview iframe box. Called after the
     * panel slides in / pins (a CSS transform that fires no scroll/resize), so an overlay
     * placed mid-animation snaps back over its embed once the panel settles.
     */
    reflowEmbedOverlays() {
        try {
            this._embedRelay?.reflow();
        } catch (error) {
            Logger.warn('[PreviewMediaHost] embed overlay reflow failed:', error);
        }
    }

    /** Detach every attached relay (panel destroy). */
    detachAll() {
        for (const handle of this._handles) {
            try {
                handle.detach();
            } catch (error) {
                Logger.warn('[PreviewMediaHost] detach failed:', error);
            }
        }
        this._handles = [];
        // Fully dispose the page-global embed relay (removes its drift interval and
        // window listeners), and drop the once-guard so a later attach re-inits a
        // clean relay instead of leaving the old timer running for the page lifetime.
        try {
            this._embedRelay?.dispose?.();
        } catch (error) {
            Logger.warn('[PreviewMediaHost] embed relay dispose failed:', error);
        }
        this._embedRelay = null;
        if (this._win) {
            this._win.__exePreviewEmbedRelayReady = false;
        }
    }

    _ensureBridge() {
        if (this._win.exeMediaHost && this._win.exeEmbedRelay) return Promise.resolve();
        if (!this._bridgeReady) {
            this._bridgeReady = (async () => {
                for (const path of BRIDGE_SCRIPTS) {
                    await this._loadScript(`${this._basePath}/${path}`);
                }
            })();
        }
        return this._bridgeReady;
    }

    /**
     * Wrap a real provider adapter (exe-media-host's `_youtubeAdapter` /
     * `_vimeoAdapter`) behind a facade that loads the provider SDK on first
     * use and queues playback commands until it is ready.
     * @param {'youtube'|'vimeo'} provider
     * @param {string} adapterKey
     */
    _lazyFactory(provider, adapterKey) {
        return (container, videoId, cb) => {
            let controller = null;
            let destroyed = false;
            const queue = [];

            const run = (method, ...args) => {
                if (controller) {
                    controller[method]?.(...args);
                } else {
                    queue.push([method, args]);
                }
            };

            this._sdkLoaders[provider]()
                .then(() => {
                    if (destroyed) return;
                    controller = this._win.exeMediaHost[adapterKey](container, videoId, cb);
                    for (const [method, args] of queue) controller[method]?.(...args);
                    queue.length = 0;
                })
                .catch((error) => {
                    Logger.warn(`[PreviewMediaHost] ${provider} SDK load failed:`, error);
                    if (cb.onError) cb.onError('sdk_load_failed');
                });

            return {
                play: () => run('play'),
                pause: () => run('pause'),
                seek: (t) => run('seek', t),
                getCurrentTime: () => (controller ? controller.getCurrentTime() : 0),
                getDuration: () => (controller ? controller.getDuration() : 0),
                destroy: () => {
                    destroyed = true;
                    if (controller) controller.destroy?.();
                    controller = null;
                    queue.length = 0;
                },
            };
        };
    }
}
