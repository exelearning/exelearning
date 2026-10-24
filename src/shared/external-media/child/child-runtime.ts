/**
 * The in-content runtime: announce, wait to be welcomed, then promote.
 *
 * This is ADR-2199-08 in canonical form. The runtime NEVER promotes on its own authority.
 * It announces itself to its parent and waits for an addressed `welcome`; without one
 * the author's document is left exactly as written, because a placeholder only the host
 * can fill is a permanent black box — strictly worse than an unprotected embed — and
 * this code ships inside content that is routinely opened where no host exists at all.
 */
import { EMBED_TYPE } from '../protocol/messages';
import { isFramed, isOpaqueOrigin, type RuntimeWindow } from './environment';
import type { EmbedRecord } from './embed-scanner';

/**
 * Delays between re-announcements, in ms. The host relay is loaded lazily by its page —
 * most previews embed nothing — so it may start listening after this document has
 * already run. Announcing more than once closes that race without ever promoting
 * unilaterally.
 */
export const ANNOUNCE_DELAYS = [250, 750, 1500, 3000] as const;

/** The window surface the runtime drives; injectable so the handshake is testable. */
export interface ChildHostWindow extends RuntimeWindow {
    parent: { postMessage(message: unknown, targetOrigin: string): void };
    addEventListener(type: string, listener: (event: MessageEvent) => void): void;
    setTimeout(handler: () => void, timeout: number): unknown;
}

export interface ChildRuntime {
    /** @returns false when this context can never host a handshake. */
    start(): boolean;
    isActivated(): boolean;
    handleHostMessage(event: { source?: unknown; data?: unknown }): void;
    /**
     * Re-report if the geometry moved. What the entry's scroll, resize and observer
     * wiring calls; inert while dormant.
     */
    refresh(): void;
    /**
     * Promote anything that arrived since the last pass, then re-report if that moved
     * anything. What the entry's mutation wiring calls; inert while dormant.
     */
    rescan(): void;
    /**
     * Report unconditionally, WITHOUT promoting. For the moments where the geometry can
     * be byte-identical to the last report and still be the one that matters — `load`,
     * once late images have settled the layout.
     *
     * The absence of promotion is deliberate and load-bearing: `load` can be dispatched
     * synchronously from inside a promotion (replacing the last pending iframe completes
     * the document load), so promoting from there re-enters it. Inert while dormant.
     */
    resync(): void;
}

/**
 * The DOM work the runtime delegates. Injecting it keeps this module free of any DOM
 * dependency, so the handshake — the part with the security consequences — is testable
 * without a DOM engine. The real implementation lives in `embed-scanner.ts`; the DOM
 * behaviour itself is covered end to end in three browsers by the artifact E2E.
 */
export interface EmbedScanner {
    /** Replace promotable iframes with placeholders. Called only after activation. */
    promote(): void;
    /** Current geometry of every placeholder. */
    collect(): EmbedRecord[];
}

export interface ChildRuntimeOptions {
    /** Called on activation, so the caller can attach observers it owns. */
    onActivate?(): void;
}

export function createChildRuntime(
    win: ChildHostWindow,
    scanner: EmbedScanner,
    options: ChildRuntimeOptions = {},
): ChildRuntime {
    let activated = false;
    let lastReported = '';

    function post(message: unknown): void {
        try {
            win.parent.postMessage(message, '*');
        } catch {
            // An unreachable parent is simply the no-host case.
        }
    }

    /**
     * `force` always posts — on activation and on an explicit host ping the host may
     * have just started listening or lost its state. Observer-driven reports skip an
     * unchanged geometry so an attribute-noisy page cannot spam the host.
     */
    function report(force: boolean): void {
        const embeds: EmbedRecord[] = scanner.collect();
        const serialised = JSON.stringify(embeds);
        if (!force && serialised === lastReported) return;
        lastReported = serialised;
        post({ type: EMBED_TYPE, action: 'sync', embeds });
    }

    function run(): void {
        scanner.promote();
        report(true);
    }

    function activate(): void {
        if (activated) return;
        activated = true;
        options.onActivate?.();
        run();
    }

    function announce(index: number): void {
        if (activated) return;
        post({ type: EMBED_TYPE, action: 'hello' });
        if (index < ANNOUNCE_DELAYS.length) {
            win.setTimeout(() => announce(index + 1), ANNOUNCE_DELAYS[index]);
        }
    }

    /**
     * Two inbound actions, deliberately distinct:
     *
     * - `welcome` is the host's ANSWER to this document, sent only after it resolved
     *   this exact window. It is the only thing that may unlock promotion.
     * - `request` is the geometry re-sync ping, BROADCAST to every content frame with
     *   no resolution at all. It must never unlock; while dormant it only prompts
     *   another `hello`, which recovers a host that started late.
     */
    function handleHostMessage(event: { source?: unknown; data?: unknown }): void {
        if (!event || event.source !== win.parent) return;
        const data = event.data as { type?: unknown; action?: unknown } | null | undefined;
        if (!data || data.type !== EMBED_TYPE) return;

        if (data.action === 'welcome') {
            if (activated) run();
            else activate();
            return;
        }
        if (data.action === 'request') {
            if (activated) report(true);
            else announce(0);
        }
    }

    function start(): boolean {
        if (!isFramed(win) || !isOpaqueOrigin(win)) return false;
        win.addEventListener('message', handleHostMessage as (event: MessageEvent) => void);
        announce(0);
        return true;
    }

    return {
        start,
        isActivated: () => activated,
        handleHostMessage,
        // Both gated on activation: an unhosted document must never be pushed into
        // promoting embeds nobody will ever fill.
        refresh() {
            if (activated) report(false);
        },
        rescan() {
            if (!activated) return;
            scanner.promote();
            report(false);
        },
        resync() {
            if (activated) report(true);
        },
    };
}
