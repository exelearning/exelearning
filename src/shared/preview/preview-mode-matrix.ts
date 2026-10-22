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
 * | static   | `sw-filtered`  | `consented-same-origin` ⚠  |
 *
 * Why the default is Service Worker filtering and not opacity: it is the fast path —
 * no network, near-instant refresh, and nested provider iframes work natively because
 * no sandbox propagates to them. Filtering the author's active content is what makes
 * that acceptable, and Phase 0 measured its cost at 1–3 ms on an 8–10 ms generation.
 * Paying for opacity on every keystroke to protect against script that is not running
 * is a bad trade.
 *
 * Why opacity only on enable: the cost — a server round-trip, a full snapshot upload —
 * is paid only by the user who asked to run author JavaScript, and only while they ask.
 *
 * Why `static` is the exception, and why the cause is NOT missing HTTP headers: the
 * `sandbox` attribute alone already yields an opaque origin without touching the
 * server. The real blocker is that a sandboxed frame without `allow-same-origin` is
 * **never controlled by a Service Worker** — verified in Chromium, Firefox and WebKit
 * (Phase 0, spike S3) — and in a backend-less deployment the preview has nothing else
 * to serve from. Spike S2 separately found that `online.exelearning.net` is plain nginx
 * and *can* set headers, which is why the exception survives regardless.
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
export const PREVIEW_TRANSPORTS = ['sw-filtered', 'opaque-capability', 'consented-same-origin', 'blocked'] as const;
export type PreviewTransport = (typeof PREVIEW_TRANSPORTS)[number];

export interface PreviewModeDecision {
    transport: PreviewTransport;
    /** Machine-readable, surfaced in the UI and in diagnostics. Stable per transport. */
    reason: string;
    /** True only where residual risk is accepted rather than removed. */
    requiresConsentWarning: boolean;
}

const FILTERED: PreviewModeDecision = {
    transport: 'sw-filtered',
    reason: 'author-active-content-filtered',
    requiresConsentWarning: false,
};

const OPAQUE: PreviewModeDecision = {
    transport: 'opaque-capability',
    reason: 'isolated-in-opaque-origin-via-capability-url',
    requiresConsentWarning: false,
};

const CONSENTED: PreviewModeDecision = {
    transport: 'consented-same-origin',
    reason: 'no-backend-for-capability-url-consent-required',
    requiresConsentWarning: true,
};

const BLOCKED: PreviewModeDecision = {
    transport: 'blocked',
    reason: 'runtime-cannot-isolate-active-content',
    requiresConsentWarning: false,
};

const ENABLED_BY_RUNTIME: Record<PreviewRuntime, PreviewModeDecision> = {
    cloud: OPAQUE,
    embedded: OPAQUE,
    electron: BLOCKED,
    static: CONSENTED,
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
