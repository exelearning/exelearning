import { describe, expect, it } from 'bun:test';
import { circuitImageSource } from './circuitImage';

const CIRCUIT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10"/></svg>';

describe('circuitImageSource', () => {
    it('carries a drawing as something an img can load', () => {
        const src = circuitImageSource(CIRCUIT);

        expect(src?.startsWith('data:image/svg+xml,')).toBe(true);
        expect(decodeURIComponent(src!.slice('data:image/svg+xml,'.length))).toBe(CIRCUIT);
    });

    it('encodes whatever the drawing contains, so nothing closes the attribute it sits in', () => {
        // This is the rule that holds regardless of what the author's TikZ rendered into.
        const src = circuitImageSource('<svg><title>a" onload="alert(1)</title></svg>');

        expect(src).not.toContain('"');
        expect(src).not.toContain('<');
    });

    it('writes the media type itself rather than taking one from the payload', () => {
        expect(circuitImageSource('<svg/>')?.startsWith('data:image/svg+xml,')).toBe(true);
    });

    it('reads nothing out of something that is not a drawing', () => {
        expect(circuitImageSource('')).toBeNull();
        expect(circuitImageSource('   ')).toBeNull();
        expect(circuitImageSource('<p>Un circuito</p>')).toBeNull();
        expect(circuitImageSource(undefined)).toBeNull();
        expect(circuitImageSource(null)).toBeNull();
        expect(circuitImageSource({ svg: CIRCUIT })).toBeNull();
    });

    it('refuses a drawing large enough to bloat every copy of the sheet', () => {
        // A circuit diagram runs to a few kilobytes; this is a traced photograph.
        const huge = `<svg>${'M0 0h10'.repeat(100_000)}</svg>`;

        expect(huge.length).toBeGreaterThan(512 * 1024);
        expect(circuitImageSource(huge)).toBeNull();
    });

    it('takes a drawing that sits just inside the limit', () => {
        const wide = `<svg>${'a'.repeat(512 * 1024 - 12)}</svg>`;

        expect(wide.length).toBeLessThanOrEqual(512 * 1024);
        expect(circuitImageSource(wide)).not.toBeNull();
    });
});
