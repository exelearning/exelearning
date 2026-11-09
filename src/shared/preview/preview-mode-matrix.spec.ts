import { describe, expect, it } from 'bun:test';
import {
    BLOCKED_DECISION,
    PREVIEW_RUNTIMES,
    PREVIEW_TRANSPORTS,
    canEnableActiveContent,
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
        }
    });

    it('isolates in an opaque origin where a server can mint a capability URL', () => {
        expect(resolvePreviewTransport('cloud', true).transport).toBe('opaque-capability');
        expect(resolvePreviewTransport('embedded', true).transport).toBe('opaque-capability');
        // Electron's main process is that server: it answers the preview:// scheme.
        expect(resolvePreviewTransport('electron', true).transport).toBe('opaque-capability');
    });

    /**
     * Static/PWA has no backend to mint a capability URL, and a sandboxed frame is never
     * Service Worker controlled (Phase 0, spike S3) — so the inlined snapshot is loaded
     * through `srcdoc` into a sandbox without `allow-same-origin`, which the browser gives
     * an opaque origin on its own (ADR-2199-04).
     */
    it('isolates static/PWA through a sandboxed srcdoc document', () => {
        expect(resolvePreviewTransport('static', true).transport).toBe('opaque-srcdoc');
    });

    it('lets every modelled runtime grant; blocked is kept only for a preload without the scheme', () => {
        for (const runtime of PREVIEW_RUNTIMES) expect(canEnableActiveContent(runtime), runtime).toBe(true);
        expect(BLOCKED_DECISION.transport).toBe('blocked');
        expect(PREVIEW_TRANSPORTS).toContain('blocked');
    });

    /**
     * The whole point of the matrix: no cell lets enabled author code run with the editor's
     * origin. Every enabled transport is either opaque or blocked.
     */
    it('never runs enabled author code same-origin with the editor', () => {
        for (const runtime of PREVIEW_RUNTIMES) {
            const { transport } = resolvePreviewTransport(runtime, true);
            expect(['opaque-capability', 'opaque-srcdoc', 'blocked'], runtime).toContain(transport);
        }
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
