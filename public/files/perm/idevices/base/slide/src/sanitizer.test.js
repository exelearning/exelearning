/**
 * Tests for the Slide iDevice SVG sanitizer.
 */

/* eslint-disable no-undef */
import { describe, it, expect, vi } from 'vitest';
import { sanitizeSvg, scrubSvg } from './sanitizer.ts';

describe('scrubSvg', () => {
    it('returns empty string for non-string inputs', () => {
        expect(scrubSvg(null)).toBe('');
        expect(scrubSvg(undefined)).toBe('');
        expect(scrubSvg(42)).toBe('');
        expect(scrubSvg('')).toBe('');
    });

    it('removes <script> blocks (multiline)', () => {
        const out = scrubSvg('<svg><script>\nalert(1)\n</script><rect/></svg>');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('alert(1)');
    });

    it('removes inline event handlers (single, double, unquoted)', () => {
        expect(scrubSvg('<svg><rect onclick="x"/></svg>')).not.toContain('onclick');
        expect(scrubSvg("<svg><rect onmouseover='x'/></svg>")).not.toContain('onmouseover');
        expect(scrubSvg('<svg><rect onload=evil width="10"/></svg>')).not.toContain('onload');
    });

    it('keeps benign attributes intact', () => {
        const out = scrubSvg('<svg><rect width="10" fill="red"/></svg>');
        expect(out).toContain('width="10"');
        expect(out).toContain('fill="red"');
    });

    it('strips javascript: URLs', () => {
        expect(scrubSvg('<svg><a href="javascript:alert(1)"></a></svg>')).not.toContain('javascript:');
    });

    it('strips foreignObject blocks (HTML smuggling vector)', () => {
        const out = scrubSvg('<svg><foreignObject><div onclick="x"/></foreignObject></svg>');
        expect(out).not.toContain('foreignObject');
    });
});

describe('sanitizeSvg', () => {
    it('returns scrubbed svg when no purifier is provided', () => {
        const out = sanitizeSvg('<svg><script>alert(1)</script><rect/></svg>');
        expect(out).not.toContain('<script');
        expect(out).toContain('<rect');
    });

    it('ignores any purifier passed in (regex scrubbing is the only pass)', () => {
        // We accept a purifier argument for back-compat but no longer call it
        // because DOMPurify's SVG profile strips attributes Fabric needs.
        const purifier = { sanitize: vi.fn(s => s.replace(/<rect[^>]*\/>/g, '<rect data-purified="1"/>')) };
        const out = sanitizeSvg('<svg><script>x</script><rect/></svg>', purifier);
        expect(purifier.sanitize).not.toHaveBeenCalled();
        expect(out).not.toContain('data-purified');
        expect(out).not.toContain('<script');
        expect(out).toContain('<rect');
    });

    it('does not throw even if a faulty purifier would', () => {
        const purifier = {
            sanitize: vi.fn(() => {
                throw new Error('boom');
            }),
        };
        const out = sanitizeSvg('<svg><rect/></svg>', purifier);
        expect(out).toContain('<rect');
        expect(purifier.sanitize).not.toHaveBeenCalled();
    });

    it('returns empty string for empty input even with a purifier', () => {
        const purifier = { sanitize: vi.fn() };
        expect(sanitizeSvg('', purifier)).toBe('');
        expect(purifier.sanitize).not.toHaveBeenCalled();
    });

    it('returns empty string for non-string input', () => {
        expect(sanitizeSvg(null)).toBe('');
        expect(sanitizeSvg(undefined)).toBe('');
        expect(sanitizeSvg(42)).toBe('');
    });
});
