import { describe, expect, it } from 'bun:test';
import {
    contentBase,
    isCrossOriginHttps,
    isFramed,
    isOpaqueOrigin,
    isPdfUrl,
    isPromotable,
    isSandboxedOpaque,
    type RuntimeWindow,
} from './environment';

const BASE = 'https://lms.example/preview/page.html';
const win = (over: Partial<RuntimeWindow> = {}): RuntimeWindow => ({
    parent: {},
    origin: 'null',
    document: { cookie: '' },
    location: { href: BASE },
    ...over,
});

describe('isOpaqueOrigin', () => {
    it('recognises the opaque origin marker', () => {
        expect(isOpaqueOrigin(win())).toBe(true);
        expect(isOpaqueOrigin(win({ origin: 'https://lms.example' }))).toBe(false);
    });

    it('treats a throwing cookie access as opaque', () => {
        const throwing = {
            parent: {},
            origin: 'https://lms.example',
            get document(): { cookie: string } {
                throw new Error('SecurityError');
            },
        } as unknown as RuntimeWindow;
        expect(isOpaqueOrigin(throwing)).toBe(true);
    });
});

describe('isSandboxedOpaque', () => {
    it('is true for an opaque document served over http(s): only a sandbox does that', () => {
        expect(isSandboxedOpaque(win())).toBe(true);
        expect(isSandboxedOpaque(win({ location: { href: 'http://lms.example/x.html' } }))).toBe(true);
    });

    /** `file://` is opaque too, and there nested embeds load fine (ADR-2199-08). */
    it('is false for a package opened from file://', () => {
        expect(isSandboxedOpaque(win({ location: { href: 'file:///home/user/package/index.html' } }))).toBe(false);
    });

    it('is false for a document with a real origin', () => {
        expect(isSandboxedOpaque(win({ origin: 'https://lms.example' }))).toBe(false);
    });

    it('treats a throwing cookie access as sandboxed, wherever it is served from', () => {
        const throwing = {
            parent: {},
            origin: 'null',
            location: { href: 'file:///home/user/package/index.html' },
            get document(): { cookie: string } {
                throw new Error('SecurityError');
            },
        } as unknown as RuntimeWindow;
        expect(isSandboxedOpaque(throwing)).toBe(true);
    });

    it('is false when the location cannot be read', () => {
        expect(isSandboxedOpaque(win({ location: undefined }))).toBe(false);
    });
});

describe('isFramed', () => {
    it('is false only for a top-level window', () => {
        const top = win();
        (top as { parent: unknown }).parent = top;
        expect(isFramed(top)).toBe(false);
        expect(isFramed(win())).toBe(true);
    });

    it('treats an unreachable parent as framed, so it stays gated on the handshake', () => {
        const unreachable = {
            get parent(): unknown {
                throw new Error('cross-origin');
            },
        } as unknown as RuntimeWindow;
        expect(isFramed(unreachable)).toBe(true);
    });
});

describe('contentBase', () => {
    it('returns the content location, never the global one', () => {
        expect(contentBase(win())).toBe(BASE);
        expect(contentBase(win({ location: undefined }))).toBeUndefined();
    });
});

describe('isCrossOriginHttps', () => {
    it('accepts an https embed on another host', () => {
        expect(isCrossOriginHttps('https://www.youtube.com/embed/x', BASE)).toBe(true);
    });

    it('rejects the content own host, including the FQDN-root form', () => {
        expect(isCrossOriginHttps('https://lms.example/local.html', BASE)).toBe(false);
        expect(isCrossOriginHttps('https://lms.example./local.html', BASE)).toBe(false);
    });

    it('rejects non-https and unparseable values', () => {
        expect(isCrossOriginHttps('http://www.youtube.com/embed/x', BASE)).toBe(false);
        expect(isCrossOriginHttps('javascript:alert(1)', BASE)).toBe(false);
        expect(isCrossOriginHttps('https://www.youtube.com/embed/x', undefined)).toBe(false);
    });

    /** The bug this module exists to prevent: comparing against the wrong document. */
    it('compares against the CONTENT base, not any ambient location', () => {
        expect(isCrossOriginHttps('https://other.example/x', 'https://other.example/page.html')).toBe(false);
        expect(isCrossOriginHttps('https://other.example/x', 'https://lms.example/page.html')).toBe(true);
    });
});

describe('isPdfUrl / isPromotable', () => {
    it('detects a PDF by path, case-insensitively', () => {
        expect(isPdfUrl('handout.pdf', BASE)).toBe(true);
        expect(isPdfUrl('handout.PDF', BASE)).toBe(true);
        expect(isPdfUrl('notes.txt', BASE)).toBe(false);
    });

    it('promotes a same-origin PDF even though it is not cross-origin', () => {
        expect(isCrossOriginHttps('handout.pdf', BASE)).toBe(false);
        expect(isPromotable('handout.pdf', BASE)).toBe(true);
    });

    it('leaves ordinary same-origin content alone', () => {
        expect(isPromotable('./local.html', BASE)).toBe(false);
    });
});
