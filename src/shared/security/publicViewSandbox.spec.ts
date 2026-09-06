import { describe, it, expect } from 'bun:test';
import {
    PUBLIC_VIEW_SANDBOX,
    publicViewCspHeader,
    publicViewPermissionsPolicy,
    resolvePublicViewCspProfile,
} from './publicViewSandbox';

describe('PUBLIC_VIEW_SANDBOX', () => {
    it('grants scripts but never allow-same-origin (opaque origin)', () => {
        expect(PUBLIC_VIEW_SANDBOX).toContain('allow-scripts');
        expect(PUBLIC_VIEW_SANDBOX).not.toContain('allow-same-origin');
    });
});

describe('publicViewCspHeader', () => {
    const csp = publicViewCspHeader();

    it('emits the sandbox directive with the same tokens as the iframe attribute (R3)', () => {
        expect(csp).toContain(`sandbox ${PUBLIC_VIEW_SANDBOX}`);
        expect(csp).not.toContain('allow-same-origin');
    });

    it('locks down object-src, base-uri and frame-ancestors (R4)', () => {
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("base-uri 'none'");
        expect(csp).toContain("frame-ancestors 'self'");
    });

    it('keeps the compatible profile by default (external https resources allowed)', () => {
        expect(csp).toContain("default-src 'self' data: blob: https:");
        expect(csp).toContain("connect-src 'self' https:");
    });

    it('strict profile cuts external resources and exfiltration', () => {
        const strict = publicViewCspHeader('strict');
        expect(strict).toContain(`sandbox ${PUBLIC_VIEW_SANDBOX}`);
        expect(strict).toContain("connect-src 'none'");
        expect(strict).toContain("default-src 'self'");
        expect(strict).not.toContain('https:');
        expect(strict).not.toContain("'unsafe-eval'");
        expect(strict).toContain("object-src 'none'");
        expect(strict).toContain("frame-ancestors 'self'");
    });
});

describe('resolvePublicViewCspProfile', () => {
    it('defaults to compatible when unset or unknown', () => {
        expect(resolvePublicViewCspProfile({})).toBe('compatible');
        expect(resolvePublicViewCspProfile({ PUBLIC_VIEW_CSP_PROFILE: 'whatever' })).toBe('compatible');
    });

    it('selects strict (case-insensitive, trimmed)', () => {
        expect(resolvePublicViewCspProfile({ PUBLIC_VIEW_CSP_PROFILE: 'strict' })).toBe('strict');
        expect(resolvePublicViewCspProfile({ PUBLIC_VIEW_CSP_PROFILE: '  STRICT  ' })).toBe('strict');
    });
});

describe('publicViewPermissionsPolicy', () => {
    it('disables powerful features the content never needs (R4)', () => {
        const pp = publicViewPermissionsPolicy();
        expect(pp).toContain('camera=()');
        expect(pp).toContain('microphone=()');
        expect(pp).toContain('geolocation=()');
        expect(pp).toContain('payment=()');
    });
});
