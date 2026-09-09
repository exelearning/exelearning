import { describe, expect, it } from 'bun:test';
import {
    PREVIEW_RUNTIMES,
    PREVIEW_TRANSPORTS,
    resolvePreviewTransport,
    type PreviewRuntime,
} from './preview-mode-matrix';

describe('preview mode matrix', () => {
    it('is total: every runtime has a decision in both states', () => {
        for (const runtime of PREVIEW_RUNTIMES) {
            for (const enabled of [false, true]) {
                const decision = resolvePreviewTransport(runtime, enabled);
                expect(PREVIEW_TRANSPORTS, `${runtime}/${enabled}`).toContain(decision.transport);
                expect(decision.reason.length, `${runtime}/${enabled}`).toBeGreaterThan(0);
            }
        }
    });

    /**
     * The default is the same everywhere, and that uniformity is the point: filtering
     * is what makes the fast Service Worker path acceptable, so no runtime gets to opt
     * out of it before the user has asked for anything.
     */
    it('filters by default in every runtime', () => {
        for (const runtime of PREVIEW_RUNTIMES) {
            expect(resolvePreviewTransport(runtime, false).transport, runtime).toBe('sw-filtered');
            expect(resolvePreviewTransport(runtime, false).requiresConsentWarning, runtime).toBe(false);
        }
    });

    it('isolates in an opaque origin where a backend can mint a capability URL', () => {
        expect(resolvePreviewTransport('cloud', true).transport).toBe('opaque-capability');
        expect(resolvePreviewTransport('embedded', true).transport).toBe('opaque-capability');
        expect(resolvePreviewTransport('cloud', true).requiresConsentWarning).toBe(false);
    });

    /**
     * Static/PWA has no backend to mint a capability URL, and a sandboxed frame is
     * never Service Worker controlled (Phase 0, spike S3) — so there is no opaque
     * transport available. The residual risk is accepted explicitly, never silently.
     */
    it('falls to consented same-origin only where no backend exists, and warns', () => {
        const decision = resolvePreviewTransport('static', true);
        expect(decision.transport).toBe('consented-same-origin');
        expect(decision.requiresConsentWarning).toBe(true);
    });

    it('refuses to enable at all in Electron', () => {
        const decision = resolvePreviewTransport('electron', true);
        expect(decision.transport).toBe('blocked');
        expect(decision.requiresConsentWarning).toBe(false);
    });

    /** A warning is only ever attached to the one transport that carries residual risk. */
    it('warns for exactly one cell of the matrix', () => {
        const warned = PREVIEW_RUNTIMES.flatMap(runtime =>
            [false, true]
                .map(enabled => ({ runtime, enabled, decision: resolvePreviewTransport(runtime, enabled) }))
                .filter(entry => entry.decision.requiresConsentWarning),
        );
        expect(warned.map(w => `${w.runtime}/${w.enabled}`)).toEqual(['static/true']);
    });

    it('gives a machine-readable reason distinct per transport', () => {
        const reasons = new Map<string, string>();
        for (const runtime of PREVIEW_RUNTIMES) {
            for (const enabled of [false, true]) {
                const decision = resolvePreviewTransport(runtime, enabled);
                const previous = reasons.get(decision.transport);
                if (previous) expect(decision.reason).toBe(previous);
                reasons.set(decision.transport, decision.reason);
            }
        }
        expect(new Set(reasons.values()).size).toBe(reasons.size);
    });

    it('rejects a runtime it does not model instead of guessing', () => {
        expect(() => resolvePreviewTransport('playground' as PreviewRuntime, true)).toThrow();
    });
});
