/**
 * Child bundle entry: assemble the canonical modules and run them inside the content
 * document.
 *
 * Like the host entry, this is wiring only. The decisions live in the modules it imports —
 * what counts as promotable in `environment`, what a placeholder looks like in
 * `embed-scanner`, and the handshake itself in `child-runtime`.
 *
 * The load-bearing property is WHEN the observers are installed: not at load, but on
 * activation. A document with no host — a `file://` package, a third-party LMS, an ePub
 * reader — is left exactly as authored, and pays for no observers either (ADR-2199-08).
 *
 * It publishes two names:
 *
 *   window.exeExternalMediaChild   what new code should use
 *   window.exeEmbedShim            the legacy name, kept working, announced once (ADR-2199-11)
 */
import { createDeprecations, withDeprecationNotice, type DeprecationOptions } from './compatibility/legacy-globals';
import { createMediaBridge, type MediaBridge } from './media/media-child';
import { createChildRuntime, type ChildHostWindow, type ChildRuntime, type EmbedScanner } from './child/child-runtime';
import { collect, promote, type ScanCounter } from './child/embed-scanner';
import { contentBase, isFramed, isOpaqueOrigin, isPromotable, type RuntimeWindow } from './child/environment';

interface ObserverConstructor {
    new (callback: () => void): { observe(target: unknown, options?: unknown): void };
}

interface ChildWindow extends ChildHostWindow {
    document: ChildHostWindow['document'] & {
        documentElement?: unknown;
        body?: unknown;
        readyState?: string;
        addEventListener?(type: string, listener: () => void): void;
    };
    MutationObserver?: ObserverConstructor;
    ResizeObserver?: ObserverConstructor;
}

export interface ChildEntry {
    /** False when this context can never host a handshake — unframed, or same-origin. */
    started: boolean;
    runtime: ChildRuntime;
}

/**
 * The scanner over a real document, which is the only DOM the child half touches.
 *
 * Promotion is guarded against re-entry. A browser may dispatch an event SYNCHRONOUSLY
 * from inside a DOM mutation — replacing the last pending iframe completes the document
 * load and fires `load` right there, mid-replacement — and a listener that scans from
 * there re-enters this pass holding a node list captured before any of it happened. The
 * result is every embed promoted twice and a `replaceChild` against a node that is no
 * longer anyone's child. There is no useful meaning for a promotion that begins inside
 * another one, so the inner call simply does nothing.
 */
export function createDomScanner(win: ChildWindow): EmbedScanner {
    const counter: ScanCounter = { n: 0 };
    const root = () => (win.document.body ?? win.document) as ParentNode & { ownerDocument?: Document | null };
    let promoting = false;

    return {
        promote: () => {
            if (promoting) return;
            promoting = true;
            try {
                promote(root(), counter, win as unknown as RuntimeWindow);
            } finally {
                promoting = false;
            }
        },
        collect: () => collect(root()),
    };
}

/**
 * Build the runtime, wire the observers it will want, and announce to the host.
 *
 * The observers are created inside `onActivate`, so nothing is watched until a host has
 * proved it is listening.
 */
export function startChild(win: ChildWindow): ChildEntry {
    const scanner = createDomScanner(win);

    // `onActivate` fires exactly once, however many welcomes arrive — the runtime owns
    // that, and tests it. No second guard here, which would only be a second place for
    // the rule to be stated and drift.
    const runtime: ChildRuntime = createChildRuntime(win, scanner, { onActivate: observe });

    function observe(): void {
        // Attributes as well as childList: layout-affecting UI — an exported page's nav
        // toggle, an accordion — usually flips a class on an existing node, which reflows
        // the placeholders without adding or removing any.
        if (win.MutationObserver && win.document.documentElement) {
            new win.MutationObserver(() => runtime.rescan()).observe(win.document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
            });
        }

        win.addEventListener('scroll', () => runtime.refresh(), true as never);
        win.addEventListener('resize', () => runtime.refresh());
        // A class-toggled layout change usually ANIMATES: the mutation fires at the start,
        // so re-measure again when the transition lands to report the settled geometry.
        win.addEventListener('transitionend', () => runtime.refresh(), true as never);
        win.addEventListener('animationend', () => runtime.refresh(), true as never);

        // Catches content-box changes that fire no window resize: a drawer pushing the
        // content column, images loading late and growing the page.
        if (win.ResizeObserver) {
            const resize = new win.ResizeObserver(() => runtime.refresh());
            if (win.document.documentElement) resize.observe(win.document.documentElement);
            if (win.document.body) resize.observe(win.document.body);
        }

        // By `load`, late images have settled the layout. Force this one through rather
        // than letting it be skipped as unchanged.
        win.addEventListener('load', () => runtime.resync());
    }

    return { started: runtime.start(), runtime };
}

/**
 * Run `boot` as soon as the document has a body to scan, and not before.
 *
 * `DOMContentLoaded` rather than `load`: the placeholders must be in place before the
 * page is painted, or the reader watches the embeds pop in. Anything past `loading`
 * already has a body, so there is nothing left to wait for.
 */
export function bootWhenReady(
    doc: { readyState?: string; addEventListener(type: string, fn: () => void): void },
    boot: () => void,
): void {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
    else boot();
}

/**
 * Publish the child onto a window, under both its own name and the legacy one.
 *
 * The legacy surface is what the incumbent shim exposed and what the plugins' own tests
 * reach for: `createRuntime`, plus the environment predicates.
 */
export function publishChild(win: ChildWindow & Record<string, unknown>, options: DeprecationOptions = {}): void {
    const deprecations = createDeprecations(options);

    const media: MediaBridge = createMediaBridge({
        win: win as never,
        createHelloId: () => {
            const crypto = (win as { crypto?: { randomUUID?(): string } }).crypto;
            // A collision would pair a document with someone else's welcome, so prefer the
            // platform's generator and fall back only where it is unavailable.
            return crypto?.randomUUID?.() ?? `h-${Math.random().toString(36).slice(2)}`;
        },
    });

    win.exeExternalMediaChild = { start: () => startChild(win), createDomScanner, media };

    // The legacy media name, kept working over the canonical runtime (ADR-2199-11). Only the
    // programmatic path survives: the declarative scan was already unreachable whenever
    // the embed half is present, which in this bundle is always.
    const legacyMediaBridge = {
        openMedia: (request: Parameters<MediaBridge['openMedia']>[0]) => media.openMedia(request),
        ensureSession: () => media.session(),
        inIframe: () => isFramed(win as never),
        isSandboxedOpaque: () => isOpaqueOrigin(win as never),
    };
    win.exeMediaBridge = withDeprecationNotice(
        legacyMediaBridge,
        'exeMediaBridge',
        'window.exeExternalMediaChild.media.openMedia()',
        deprecations,
    );

    const legacyShim = {
        createRuntime: (target: ChildWindow = win) => startChild(target).runtime,
        isOpaqueOrigin,
        isFramed,
        isPromotable,
        contentBase,
    };

    win.exeEmbedShim = withDeprecationNotice(
        legacyShim,
        'exeEmbedShim',
        'window.exeExternalMediaChild.start()',
        deprecations,
    );
}
