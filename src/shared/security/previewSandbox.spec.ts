import { describe, expect, it } from 'bun:test';
import {
    isScriptableDocumentType,
    PREVIEW_SANDBOX,
    PREVIEW_SANDBOX_TOKENS,
    previewCspHeader,
    previewPermissionsPolicy,
} from './previewSandbox';

describe('previewSandbox', () => {
    it('exposes exactly the ecosystem-wide opaque token set', () => {
        // Regression guard: the editor preview must NOT copy the public viewer's
        // looser set (allow-downloads / allow-popups-to-escape-sandbox) and must
        // never regain allow-same-origin — that token is what de-isolates
        // untrusted package content.
        expect(PREVIEW_SANDBOX_TOKENS).toEqual(['allow-scripts', 'allow-popups', 'allow-forms']);
        expect(PREVIEW_SANDBOX).toBe('allow-scripts allow-popups allow-forms');
        expect(PREVIEW_SANDBOX).not.toContain('allow-same-origin');
        expect(PREVIEW_SANDBOX).not.toContain('allow-downloads');
        expect(PREVIEW_SANDBOX).not.toContain('allow-popups-to-escape-sandbox');
        expect(PREVIEW_SANDBOX).not.toContain('allow-top-navigation');
        expect(PREVIEW_SANDBOX).not.toContain('allow-modals');
    });

    it('leads the CSP with the sandbox directive so direct navigation stays opaque', () => {
        expect(previewCspHeader().startsWith('sandbox allow-scripts allow-popups allow-forms; ')).toBe(true);
    });

    it('keeps the resource directives restrictive', () => {
        const csp = previewCspHeader();
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("connect-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'none'");
        expect(csp).toContain("frame-ancestors 'self'");
        expect(csp).toContain("form-action 'self'");
        expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
        expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('keeps frame-src minimal (embeds are promoted to the parent relay, not framed here)', () => {
        const csp = previewCspHeader();
        // Only the interactive-video iDevice fallback hosts; plain external embeds
        // are promoted out to the trusted parent relay by the embed shim.
        expect(csp).toContain("frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com");
        expect(csp).toContain("child-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com");
        // Not the raw youtube.com host — that would let the opaque child frame it inline.
        expect(csp).not.toContain('https://www.youtube.com ');
        expect(csp).toContain("img-src 'self' data: blob: https:");
        expect(csp).toContain("media-src 'self' data: blob: https:");
        expect(csp).toContain("font-src 'self' data:");
        // No open https: for scripts/connect — exfiltration surface stays closed.
        expect(csp).not.toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' https:");
        expect(csp).not.toContain("connect-src 'self' https:");
    });

    it('denies powerful features via Permissions-Policy', () => {
        expect(previewPermissionsPolicy()).toBe('camera=(), microphone=(), geolocation=(), payment=()');
    });

    describe('isScriptableDocumentType', () => {
        it('flags every scriptable document type — HTML, SVG and XML, not just HTML', () => {
            // The SVG case is the security-critical one: an author SVG opened
            // top-level runs its inline <script> same-origin without the CSP.
            expect(isScriptableDocumentType('text/html')).toBe(true);
            expect(isScriptableDocumentType('text/html; charset=utf-8')).toBe(true);
            expect(isScriptableDocumentType('image/svg+xml')).toBe(true);
            expect(isScriptableDocumentType('image/svg+xml; charset=utf-8')).toBe(true);
            expect(isScriptableDocumentType('application/xml')).toBe(true);
            expect(isScriptableDocumentType('text/xml')).toBe(true);
            expect(isScriptableDocumentType('application/xhtml+xml')).toBe(true);
        });

        it('is case- and whitespace-insensitive on the media type', () => {
            expect(isScriptableDocumentType('IMAGE/SVG+XML')).toBe(true);
            expect(isScriptableDocumentType('  text/html ; charset=utf-8')).toBe(true);
        });

        it('does not flag passive resource types (no CSP wasted on them)', () => {
            expect(isScriptableDocumentType('text/css')).toBe(false);
            expect(isScriptableDocumentType('application/javascript')).toBe(false);
            expect(isScriptableDocumentType('image/png')).toBe(false);
            expect(isScriptableDocumentType('image/jpeg')).toBe(false);
            expect(isScriptableDocumentType('application/json')).toBe(false);
            expect(isScriptableDocumentType('font/woff2')).toBe(false);
            expect(isScriptableDocumentType('application/pdf')).toBe(false);
            expect(isScriptableDocumentType('application/octet-stream')).toBe(false);
        });
    });
});
