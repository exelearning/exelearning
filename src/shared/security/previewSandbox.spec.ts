/**
 * Sandbox policy tests: token invariants, CSP shape, scriptable-type
 * classification, and the client/server drift check.
 */
import { describe, expect, it } from 'bun:test';
// The browser client's iframe sandbox constant — imported directly from the
// vanilla JS module so the drift test compares the real shipped values.
import { EMBEDDED_PREVIEW_SANDBOX } from '../../../public/app/workarea/interface/elements/preview/EmbeddedPreviewSnapshot.js';
import {
    PREVIEW_SNAPSHOT_SANDBOX,
    PREVIEW_SNAPSHOT_SANDBOX_TOKENS,
    isScriptableDocumentType,
    previewSnapshotCspHeader,
    previewSnapshotPermissionsPolicy,
} from './previewSandbox';

describe('previewSandbox', () => {
    it('never includes allow-same-origin (that absence IS the opaque origin)', () => {
        expect(PREVIEW_SNAPSHOT_SANDBOX_TOKENS).not.toContain('allow-same-origin');
        expect(PREVIEW_SNAPSHOT_SANDBOX).not.toContain('allow-same-origin');
    });

    it('grants scripts, forms and popups (content must stay functional)', () => {
        for (const token of ['allow-scripts', 'allow-forms', 'allow-popups']) {
            expect(PREVIEW_SNAPSHOT_SANDBOX_TOKENS).toContain(token);
        }
    });

    it('includes allow-popups-to-escape-sandbox (decision D2)', () => {
        expect(PREVIEW_SNAPSHOT_SANDBOX_TOKENS).toContain('allow-popups-to-escape-sandbox');
    });

    it('matches the client iframe sandbox attribute exactly (no drift)', () => {
        expect(PREVIEW_SNAPSHOT_SANDBOX).toBe(EMBEDDED_PREVIEW_SANDBOX);
    });

    it('emits a sandbox-first CSP whose token set equals the attribute set', () => {
        const csp = previewSnapshotCspHeader();
        expect(csp.startsWith('sandbox ')).toBe(true);
        expect(csp).toBe(`sandbox ${PREVIEW_SNAPSHOT_SANDBOX}`);
    });

    it('disables powerful features in the Permissions-Policy', () => {
        const policy = previewSnapshotPermissionsPolicy();
        for (const directive of ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()']) {
            expect(policy).toContain(directive);
        }
    });

    describe('isScriptableDocumentType', () => {
        it('classifies every scriptable document type, with or without charset', () => {
            for (const type of [
                'text/html',
                'text/html; charset=utf-8',
                'application/xhtml+xml',
                'image/svg+xml; charset=utf-8',
                'application/xml',
                'text/xml',
                'application/pdf',
                'TEXT/HTML',
            ]) {
                expect(isScriptableDocumentType(type)).toBe(true);
            }
        });

        it('does not classify passive types', () => {
            for (const type of [
                'text/css; charset=utf-8',
                'application/javascript; charset=utf-8',
                'image/png',
                'audio/mpeg',
                'application/json; charset=utf-8',
                'text/plain; charset=utf-8',
                'application/zip',
            ]) {
                expect(isScriptableDocumentType(type)).toBe(false);
            }
        });
    });
});
