/**
 * Host bundle entry: assemble the canonical modules and publish them to the page.
 *
 * Everything here is wiring. The decisions live in the modules it imports — the policy in
 * `url-policy`, the isolation in `player-descriptor`, the geometry in `overlay-geometry`,
 * the trust anchor in `frame-registry` — which is why this file has no judgement calls
 * worth arguing about, and why the bundle it produces can replace the incumbent relay
 * without re-litigating any of them.
 *
 * It publishes two names:
 *
 *   window.exeExternalMediaHost   what new code should use
 *   window.exeEmbedRelay          the legacy name, kept working, announced once (ADR-2199-11)
 *
 * Built to a classic IIFE with no imports at runtime, so it stays loadable exactly where
 * the file it replaces was — including from `file://` inside an exported package.
 */
import { createDeprecations, withDeprecationNotice, type DeprecationOptions } from './compatibility/legacy-globals';
import { attachMediaHost, type AttachedMediaHost } from './media/media-host';
import { createDomOverlayAdapter, PLAYER_MARKER_ATTR, type AdapterFrame } from './host/dom-overlay-adapter';
import { createFrameRegistry, type FrameHandle } from './host/frame-registry';
import { createHostRuntime, type HostRuntime } from './host/host-runtime';
import type { HostLocation, ValidateOptions } from './host/url-policy';

/** How often to re-check for a frame that moved with no scroll or resize event. */
const DRIFT_INTERVAL_MS = 300;

/** A content frame in the page, as this entry needs to see it. */
interface HostFrame extends AdapterFrame {
    src?: string;
    getAttribute?(name: string): string | null;
    addEventListener?(type: string, listener: () => void): void;
    removeEventListener?(type: string, listener: () => void): void;
}

export interface HostOptions extends ValidateOptions {
    /** Defaults to the page's own location. */
    location?: HostLocation;
}

export interface AttachedFrame {
    /** Stop relaying for this frame and remove its players. */
    detach(): void;
}

export interface ExternalMediaHost {
    /** Register a content iframe and start relaying its embeds. */
    attach(iframe: HostFrame): AttachedFrame;
    /**
     * Register every content iframe currently in the document and ask each to report.
     *
     * The incumbent relay discovered frames this way and never had an `attach`, so hosts
     * that only ever called `init()` keep working. Idempotent: a frame already known is
     * pinged, not registered a second time.
     *
     * @returns how many frames were newly registered.
     */
    scan(): number;
    /** Re-place every overlay now, e.g. after a panel animation settles. */
    reflow(): void;
    /** Remove every player, keeping the registrations. */
    clear(): void;
    /** Tear everything down: overlays, players, listeners and the drift poll. */
    dispose(): void;
}

interface HostWindow {
    document: {
        getElementsByTagName?(tag: string): ArrayLike<HostFrame>;
    };
    addEventListener?(type: string, listener: (event?: unknown) => void, capture?: boolean): void;
    removeEventListener?(type: string, listener: (event?: unknown) => void, capture?: boolean): void;
    setInterval?(handler: () => void, ms: number): unknown;
    clearInterval?(handle: never): void;
    requestAnimationFrame?(callback: () => void): unknown;
    location?: { origin?: string; hostname?: string };
}

export function createExternalMediaHost(win: HostWindow, options: HostOptions = {}): ExternalMediaHost {
    const registry = createFrameRegistry();
    const frames = new Map<FrameHandle, HostFrame>();
    const frameLoadListeners = new Map<FrameHandle, () => void>();

    const adapter = createDomOverlayAdapter({
        doc: win.document as never,
        win: win as never,
        frameFor: handle => frames.get(handle) ?? null,
    });

    let runtime: HostRuntime | null = null;
    let driftTimer: unknown = null;
    let scheduled = false;

    /**
     * Find the content iframe a message came from, and register it if it is one we do not
     * know yet.
     *
     * Registration cannot only happen at `scan()` time. A host may install its listener
     * BEFORE the content frame exists — Moodle does exactly that, inlining `init()` ahead
     * of the iframe so the listener is ready before the frame can load — and a scan at
     * that moment finds nothing. Without this, such a frame is never welcomed, its child
     * waits forever, and the reader is left with embeds that were never promoted.
     *
     * The incumbent relay resolved senders this way on every message. Adopting late is
     * safe for the same reason adopting early is: only a window that IS an iframe of this
     * document can be adopted, and never a promoted player.
     */
    function adopt(source: unknown): void {
        if (!source || registry.resolve(source)) return;

        const found = win.document.getElementsByTagName?.('iframe') ?? [];
        for (let index = 0; index < found.length; index += 1) {
            const iframe = found[index];
            if (iframe.contentWindow !== source) continue;
            if (iframe.getAttribute?.(PLAYER_MARKER_ATTR)) return; // ours, not a peer
            register(iframe);
            return;
        }
    }

    function onMessage(event?: unknown): void {
        const message = (event ?? {}) as { source?: unknown; data?: unknown };
        if (runtime) adopt(message.source);
        runtime?.handleMessage(message);
    }

    function scheduleReflow(): void {
        if (scheduled) return;
        scheduled = true;
        const run = () => {
            scheduled = false;
            runtime?.checkDrift();
        };
        if (win.requestAnimationFrame) win.requestAnimationFrame(run);
        else run();
    }

    /**
     * Create the runtime and install the page-level listeners, once.
     *
     * Lazy rather than eager so a page that loads the bundle and never attaches anything
     * leaves no interval running.
     */
    function started(): HostRuntime {
        if (runtime) return runtime;

        runtime = createHostRuntime({
            location: {
                origin: win.location?.origin ?? '',
                hostname: win.location?.hostname ?? '',
            },
            registry,
            adapter,
            ...options,
            ...(options.location ? { location: options.location } : {}),
        });

        win.addEventListener?.('message', onMessage);
        // Scroll and resize move every overlay at once; coalescing them into one frame is
        // the difference between one re-place per frame and hundreds per second.
        win.addEventListener?.('scroll', scheduleReflow, true);
        win.addEventListener?.('resize', scheduleReflow);
        // A host layout change usually ANIMATES — a sidebar sliding, a panel opening — and
        // the frame's geometry at the start of that is not where it lands. These two catch
        // the settled position; the drift poll below catches a move with no event at all.
        win.addEventListener?.('transitionend', scheduleReflow, true);
        win.addEventListener?.('animationend', scheduleReflow, true);
        driftTimer = win.setInterval?.(() => runtime?.checkDrift(), DRIFT_INTERVAL_MS);

        return runtime;
    }

    function register(iframe: HostFrame): FrameHandle {
        const active = started();
        const handle = active.attach(iframe.contentWindow, iframe.src ?? '');
        frames.set(handle, iframe);

        /**
         * Re-gate only when the frame was pointed somewhere ELSE.
         *
         * `load` on its own does not mean a new document: the child announces itself while
         * the document is still parsing, so the load that completes it arrives after the
         * handshake it belongs to. Tearing down on every load would revoke the welcome of
         * the document that just earned it — measured in three browsers, and the reason
         * this compares `src` instead.
         *
         * What it does catch is the case that matters: the host re-pointing the frame at
         * another page, after which the arriving document must handshake for itself
         * rather than inherit the previous one's welcome.
         */
        const onLoad = () => {
            const current = iframe.src ?? '';
            if (registry.get(handle)?.contentSrc === current) return;
            active.notifyNavigated(handle, current);
        };
        iframe.addEventListener?.('load', onLoad);
        frameLoadListeners.set(handle, onLoad);

        return handle;
    }

    function release(handle: FrameHandle): void {
        const iframe = frames.get(handle);
        const onLoad = frameLoadListeners.get(handle);
        if (iframe && onLoad) iframe.removeEventListener?.('load', onLoad);
        runtime?.detach(handle);
        frames.delete(handle);
        frameLoadListeners.delete(handle);
    }

    return {
        attach(iframe) {
            const handle = register(iframe);
            return { detach: () => release(handle) };
        },

        scan() {
            const found = win.document.getElementsByTagName?.('iframe') ?? [];
            const known = new Set(frames.values());
            let added = 0;

            for (let index = 0; index < found.length; index += 1) {
                const iframe = found[index];
                // A promoted player is ours. Treating one as content would have the relay
                // talking to itself.
                if (iframe.getAttribute?.(PLAYER_MARKER_ATTR)) continue;
                if (!known.has(iframe)) {
                    register(iframe);
                    added += 1;
                }
            }

            // Ping unconditionally, including frames already known: the host may have lost
            // its state, and the child has no way to find that out on its own.
            started().requestSync();
            return added;
        },

        reflow() {
            runtime?.checkDrift();
        },

        clear() {
            for (const record of registry.all()) {
                for (const player of record.players) adapter.unmountPlayer(record.handle, player.id);
                registry.setPlayers(record.handle, []);
            }
        },

        dispose() {
            for (const handle of [...frames.keys()]) release(handle);

            win.removeEventListener?.('message', onMessage);
            win.removeEventListener?.('scroll', scheduleReflow, true);
            win.removeEventListener?.('resize', scheduleReflow);
            win.removeEventListener?.('transitionend', scheduleReflow, true);
            win.removeEventListener?.('animationend', scheduleReflow, true);
            if (driftTimer !== null) win.clearInterval?.(driftTimer as never);

            driftTimer = null;
            runtime = null;
        },
    };
}

/**
 * Publish the host onto a window, under both its own name and the legacy one.
 *
 * The legacy shape is `window.exeEmbedRelay.init(config)` returning a handle with
 * `clear`/`reflow`/`dispose` — measured from the five repositories that call it, not
 * guessed. That is why `init` scans: those callers never had an `attach` to call.
 */
/**
 * Attach the media half to one content frame.
 *
 * Separate from the embed half on purpose: they share a page and a content frame but
 * nothing else. Embeds are promoted and overlaid in place; media is driven through a
 * private port and played in a modal. Keeping the two attachments distinct is what lets a
 * host adopt one without the other.
 */
function attachMedia(win: HostWindow & Record<string, unknown>, iframe: HostFrame): AttachedMediaHost {
    const globals = win as unknown as {
        MessageChannel: new () => never;
        _?: (key: string) => string;
    };
    return attachMediaHost({
        contentWindow: (iframe as { contentWindow?: never }).contentWindow as never,
        doc: win.document as never,
        win: win as never,
        origin: win.location?.origin ?? '',
        // The page's own i18n if it has one; the key itself is a serviceable fallback and
        // beats shipping a second translation table.
        translate: key => globals._?.(key) ?? key,
        createChannel: () => new globals.MessageChannel() as never,
    });
}

export function publishHost(win: HostWindow & Record<string, unknown>, options: DeprecationOptions = {}): void {
    const deprecations = createDeprecations(options);

    win.exeExternalMediaHost = {
        create: (hostOptions: HostOptions = {}) => createExternalMediaHost(win, hostOptions),
        attachMedia: (iframe: HostFrame) => attachMedia(win, iframe),
    };

    // The legacy media name, kept working over the canonical runtime (ADR-2199-11). Its
    // `attach(iframe, opts)` shape is what the host plugins call today.
    const legacyMediaHost = {
        attach(iframe: HostFrame) {
            const attached = attachMedia(win, iframe);
            return { detach: () => attached.detach() };
        },
    };
    win.exeMediaHost = withDeprecationNotice(
        legacyMediaHost,
        'exeMediaHost',
        'window.exeExternalMediaHost.attachMedia(iframe)',
        deprecations,
    );

    const legacyRelay = {
        init(config: { mode?: string; whitelist?: string[] } = {}) {
            const host = createExternalMediaHost(win, {
                strict: config.mode === 'strict',
                allowlist: config.whitelist,
            });
            host.scan();
            return {
                clear: () => host.clear(),
                reflow: () => host.reflow(),
                dispose: () => host.dispose(),
                // The incumbent's `init()` was idempotent and returned itself; a second
                // call re-scans rather than stacking a second set of listeners.
                init() {
                    host.scan();
                    return this;
                },
            };
        },
    };

    win.exeEmbedRelay = withDeprecationNotice(
        legacyRelay,
        'exeEmbedRelay',
        'window.exeExternalMediaHost.create()',
        deprecations,
    );
}
