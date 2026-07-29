/**
 * Editor-side host for the embed relay.
 *
 * An opaque preview cannot embed YouTube/Vimeo itself: an opaque origin fails
 * the providers' embedder checks. The in-content shim demotes those iframes to
 * geometry placeholders and reports them to the parent; this host loads the
 * trusted-side runtime, which overlays the real player in place. It loads
 * lazily: most previews embed nothing.
 *
 * The editor loads the built ARTIFACT rather than a raw source file (ADR-0020
 * step 3). The artifact is versioned, hash-verified by
 * `check-external-media-artifacts`, and is the same thing host plugins vendor —
 * so what the editor exercises is what ships. It carries the same relay the raw
 * file did, minified, so this swap changes packaging and not behaviour; changing
 * the implementation inside it is a separate step that does not touch this file
 * again.
 *
 * It is produced by `bundle:external-media`, which `build:all` runs, so a built
 * tree always has it.
 */
const Logger = (typeof window !== 'undefined' && window.AppLogger) || console;

const RELAY_SCRIPT = 'app/common/exe_external_media/dist/exe-external-media-host.min.js';

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

export class PreviewEmbedHost {
    /**
     * @param {Object} [options]
     * @param {string} [options.basePath]
     * @param {Window} [options.win] Injectable for tests.
     * @param {(src: string) => Promise<void>} [options.loadScript]
     */
    constructor(options = {}) {
        this._basePath = options.basePath || '';
        this._win = options.win || window;
        this._loadScript = options.loadScript || defaultLoadScript(this._win);
        this._relayReady = null;
        this._relay = null;
    }

    /**
     * Start the relay. It is page-global and discovers preview iframes by
     * `event.source`, so it needs no per-iframe wiring and starting it once is
     * enough — it survives child reloads.
     * @returns {Promise<void>}
     */
    async start() {
        await this._ensureRelay();
        if (!this._win.exeEmbedRelay || this._win.__exePreviewEmbedRelayReady) return;
        try {
            this._relay = this._win.exeEmbedRelay.init({ mode: 'open' });
            this._win.__exePreviewEmbedRelayReady = true;
        } catch (error) {
            Logger.warn('[PreviewEmbedHost] relay init failed:', error);
        }
    }

    /**
     * Drop the overlays. Called when the preview is hidden/closed or swaps
     * iframes: the overlays live on the editor's own body (the panel only
     * slides away via transform, so the iframe keeps a live rect) and would
     * otherwise linger over the editor. They rebuild on the next sync.
     */
    hideOverlays() {
        try {
            this._relay?.clear();
        } catch (error) {
            Logger.warn('[PreviewEmbedHost] overlay teardown failed:', error);
        }
    }

    /**
     * Dispose the relay (panel destroy), removing its drift interval and window
     * listeners, and drop the once-guard so a later start gets a clean relay
     * instead of leaving the old timer running for the page lifetime.
     */
    stop() {
        try {
            this._relay?.dispose?.();
        } catch (error) {
            Logger.warn('[PreviewEmbedHost] relay dispose failed:', error);
        }
        this._relay = null;
        if (this._win) {
            this._win.__exePreviewEmbedRelayReady = false;
        }
    }

    _ensureRelay() {
        if (this._win.exeEmbedRelay) return Promise.resolve();
        if (!this._relayReady) {
            this._relayReady = this._loadScript(`${this._basePath}/${RELAY_SCRIPT}`);
        }
        return this._relayReady;
    }
}
