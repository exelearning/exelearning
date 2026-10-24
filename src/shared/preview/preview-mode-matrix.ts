/**
 * The preview transport matrix — one table, one decision.
 *
 * Which isolation the editor preview uses is a security decision, and until now it was
 * spread across `previewContentPolicy.js`, the panel's refresh branches and the host
 * capability plumbing. This module is the canonical statement of it; a consistency spec
 * (`preview-mode-matrix.consistency.spec.ts`) executes the shipped client policy and
 * fails if it ever disagrees, so a second source of the decision cannot appear quietly.
 *
 * The governing principle: **the transport is decided by the RUNTIME, never by the
 * content.** There is no silent degradation between rows — if a transport cannot be
 * applied, the failure is visible and the preview stays filtered.
 *
 * | Runtime  | default        | active content enabled     |
 * |----------|----------------|----------------------------|
 * | cloud    | `sw-filtered`  | `opaque-capability`        |
 * | embedded | `sw-filtered`  | `opaque-capability` (host) |
 * | electron | `sw-filtered`  | `blocked` — cannot enable  |
 * | static   | `sw-filtered`  | `opaque-srcdoc`            |
 *
 * Why the default is Service Worker filtering and not opacity: it is the fast path —
 * no network, near-instant refresh, and nested provider iframes work natively because
 * no sandbox propagates to them. Filtering the author's active content is what makes
 * that acceptable, and Phase 0 measured its cost at 1–3 ms on an 8–10 ms generation.
 * Paying for opacity on every keystroke to protect against script that is not running
 * is a bad trade.
 *
 * Why opacity only on enable: the cost — a server round-trip and a full snapshot upload,
 * or a full inlining — is paid only by the user who asked to run author JavaScript, and
 * only while they ask.
 *
 * Why `static` is served differently and not by the Service Worker: a sandboxed frame
 * without `allow-same-origin` is **never controlled by a Service Worker** — verified in
 * Chromium, Firefox and WebKit (Phase 0, spike S3; re-verified by
 * `test/e2e/playwright/specs/preview-srcdoc-isolation.spec.ts`) — and a backend-less
 * deployment has no capability server. The sandbox attribute alone still yields an
 * opaque origin, so the snapshot is inlined into self-contained documents and loaded
 * through `srcdoc` (ADR-2199-16). No row runs author code with the editor's origin.
 */

export const PREVIEW_RUNTIMES = ['cloud', 'embedded', 'electron', 'static'] as const;
export type PreviewRuntime = (typeof PREVIEW_RUNTIMES)[number];

/**
 * `dedicated-origin` from the design brief is deliberately absent: spike S7 found that
 * Electron's custom scheme does not satisfy provider embedder checks without rewriting
 * `Referer`/`Origin`, so no code path can produce it today. A transport that cannot
 * occur would be a lie in the type.
 *
 * `playground` (PHP-WASM) is likewise not a runtime here: nothing in `RuntimeConfig`
 * can distinguish it, and it is backend-less, so it resolves as `static` — which is
 * also the right security answer for it.
 */
export const PREVIEW_TRANSPORTS = ['sw-filtered', 'opaque-capability', 'opaque-srcdoc', 'blocked'] as const;
export type PreviewTransport = (typeof PREVIEW_TRANSPORTS)[number];

export interface PreviewModeDecision {
    transport: PreviewTransport;
    /** Machine-readable, surfaced in the UI and in diagnostics. Stable per transport. */
    reason: string;
}

const FILTERED: PreviewModeDecision = {
    transport: 'sw-filtered',
    reason: 'author-active-content-filtered',
};

const OPAQUE: PreviewModeDecision = {
    transport: 'opaque-capability',
    reason: 'isolated-in-opaque-origin-via-capability-url',
};

const SRCDOC: PreviewModeDecision = {
    transport: 'opaque-srcdoc',
    reason: 'isolated-in-opaque-origin-via-sandboxed-srcdoc',
};

const BLOCKED: PreviewModeDecision = {
    transport: 'blocked',
    reason: 'runtime-cannot-isolate-active-content',
};

const ENABLED_BY_RUNTIME: Record<PreviewRuntime, PreviewModeDecision> = {
    cloud: OPAQUE,
    embedded: OPAQUE,
    electron: BLOCKED,
    static: SRCDOC,
};

/**
 * Resolve the transport for a runtime and grant state.
 *
 * @throws if the runtime is not one this matrix models — guessing would be exactly the
 *   silent degradation the matrix exists to prevent.
 */
export function resolvePreviewTransport(runtime: PreviewRuntime, activeContentEnabled: boolean): PreviewModeDecision {
    if (!(PREVIEW_RUNTIMES as readonly string[]).includes(runtime)) {
        throw new Error(`preview mode matrix: unmodelled runtime "${runtime}"`);
    }
    return activeContentEnabled ? ENABLED_BY_RUNTIME[runtime] : FILTERED;
}

/** Whether this runtime can grant the active-content permission at all. */
export function canEnableActiveContent(runtime: PreviewRuntime): boolean {
    return resolvePreviewTransport(runtime, true).transport !== 'blocked';
}
