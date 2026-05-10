import { describe, expect, it } from 'bun:test';
import { buildContentDisposition, encodeHeaderValue } from './headers';

describe('buildContentDisposition', () => {
    it('emits ASCII filename verbatim with the filename* twin for plain names', () => {
        expect(buildContentDisposition('image.png')).toBe(
            `attachment; filename="image.png"; filename*=UTF-8''image.png`,
        );
    });

    it('replaces non-ASCII characters with underscores in the legacy filename', () => {
        const result = buildContentDisposition('San Marcial de Rubicón.png');
        expect(result).toContain(`filename="San Marcial de Rubic_n.png"`);
        expect(result).toContain(`filename*=UTF-8''San%20Marcial%20de%20Rubic%C3%B3n.png`);
    });

    it('percent-encodes the full UTF-8 filename for modern browsers', () => {
        const result = buildContentDisposition('Matemáticas y geografía.jpg');
        expect(result).toContain(`filename*=UTF-8''Matem%C3%A1ticas%20y%20geograf%C3%ADa.jpg`);
    });

    it('escapes characters that break the RFC 5987 attr-char production', () => {
        const result = buildContentDisposition(`it's (a) *test*.txt`);
        expect(result).toContain('%27');
        expect(result).toContain('%28');
        expect(result).toContain('%29');
        expect(result).toContain('%2A');
    });

    it('replaces double quotes in the legacy filename to keep the quoted-string valid', () => {
        const result = buildContentDisposition(`weird"name".txt`);
        expect(result).toContain(`filename="weird'name'.txt"`);
    });

    it('produces a header value accepted by the Response constructor (regression for issue #1749)', () => {
        const filename = 'Cenobio de Valerón.png';
        const value = buildContentDisposition(filename);
        expect(() => new Response('x', { headers: { 'content-disposition': value } })).not.toThrow();
    });

    it('strips CR/LF from the legacy filename so header injection cannot break out', () => {
        const result = buildContentDisposition('inject\r\nX-Evil: hacked.txt');
        expect(result).not.toContain('\r');
        expect(result).not.toContain('\n');
        expect(() => new Response('x', { headers: { 'content-disposition': result } })).not.toThrow();
    });
});

describe('encodeHeaderValue', () => {
    it('passes ASCII-safe values through unchanged', () => {
        expect(encodeHeaderValue('image.png')).toBe('image.png');
        expect(encodeHeaderValue('My File (1).png')).toBe('My File (1).png');
    });

    it('percent-encodes non-ASCII values', () => {
        expect(encodeHeaderValue('Rubicón.png')).toBe('Rubic%C3%B3n.png');
    });

    it('percent-encodes control characters that would break the header', () => {
        expect(encodeHeaderValue('a\nb')).not.toContain('\n');
    });

    it('produces values accepted by the Response constructor', () => {
        const encoded = encodeHeaderValue('Cenobio de Valerón.png');
        expect(() => new Response('x', { headers: { 'x-filename': encoded } })).not.toThrow();
    });

    it('round-trips with decodeURIComponent for non-ASCII inputs', () => {
        const original = 'Matemáticas.jpg';
        expect(decodeURIComponent(encodeHeaderValue(original))).toBe(original);
    });
});
