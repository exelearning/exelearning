/**
 * mime-sniff Tests
 *
 * Unit tests for content-based MIME detection (magic bytes).
 * Used to recover the real type of assets whose filename lost its extension,
 * preventing PDFs (and other embeddable files) from being force-downloaded.
 */

const { sniffMimeFromBytes, extensionForMime } = require('./mime-sniff');

/** Build a Uint8Array from a list of byte values, padded with zeros to `len`. */
function bytes(values, len) {
    const arr = new Uint8Array(len ?? values.length);
    arr.set(values);
    return arr;
}

/** ASCII string → byte values. */
function ascii(str) {
    return Array.from(str, (c) => c.charCodeAt(0));
}

describe('sniffMimeFromBytes', () => {
    it('detects PDF from the %PDF- signature', () => {
        expect(sniffMimeFromBytes(bytes(ascii('%PDF-1.4'), 16))).toBe('application/pdf');
    });

    it('detects PNG', () => {
        expect(sniffMimeFromBytes(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 16))).toBe('image/png');
    });

    it('detects JPEG', () => {
        expect(sniffMimeFromBytes(bytes([0xff, 0xd8, 0xff, 0xe0], 16))).toBe('image/jpeg');
    });

    it('detects GIF', () => {
        expect(sniffMimeFromBytes(bytes(ascii('GIF89a'), 16))).toBe('image/gif');
    });

    it('detects WEBP (RIFF....WEBP)', () => {
        expect(sniffMimeFromBytes(bytes([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')], 16))).toBe('image/webp');
    });

    it('detects WAV (RIFF....WAVE) and not WEBP', () => {
        expect(sniffMimeFromBytes(bytes([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE')], 16))).toBe('audio/wav');
    });

    it('detects ZIP family (covers elp/elpx/docx/epub)', () => {
        expect(sniffMimeFromBytes(bytes([0x50, 0x4b, 0x03, 0x04], 16))).toBe('application/zip');
    });

    it('detects MP3 with ID3 tag', () => {
        expect(sniffMimeFromBytes(bytes(ascii('ID3'), 16))).toBe('audio/mpeg');
    });

    it('detects MP4 / ISO-BMFF (ftyp at offset 4)', () => {
        expect(sniffMimeFromBytes(bytes([0x00, 0x00, 0x00, 0x18, ...ascii('ftyp')], 16))).toBe('video/mp4');
    });

    it('detects OGG', () => {
        expect(sniffMimeFromBytes(bytes(ascii('OggS'), 16))).toBe('audio/ogg');
    });

    it('detects SVG from an <?xml prolog', () => {
        expect(sniffMimeFromBytes(bytes(ascii('<?xml version="1.0"?><svg'), 32))).toBe('image/svg+xml');
    });

    it('detects SVG from a leading <svg tag', () => {
        expect(sniffMimeFromBytes(bytes(ascii('<svg xmlns="...">'), 32))).toBe('image/svg+xml');
    });

    it('detects HTML from a DOCTYPE (case-insensitive)', () => {
        expect(sniffMimeFromBytes(bytes(ascii('<!DOCTYPE html>\n<html lang="es">'), 40))).toBe('text/html');
        expect(sniffMimeFromBytes(bytes(ascii('<!doctype HTML><body>'), 40))).toBe('text/html');
    });

    it('detects HTML from a leading <html tag', () => {
        expect(sniffMimeFromBytes(bytes(ascii('<html><head></head></html>'), 40))).toBe('text/html');
    });

    it('returns null for unrecognized bytes', () => {
        expect(sniffMimeFromBytes(bytes([0x01, 0x02, 0x03, 0x04], 16))).toBeNull();
    });

    it('returns null for empty / too-short input', () => {
        expect(sniffMimeFromBytes(new Uint8Array(0))).toBeNull();
        expect(sniffMimeFromBytes(bytes([0x25], 1))).toBeNull();
    });

    it('returns null for nullish input', () => {
        expect(sniffMimeFromBytes(null)).toBeNull();
        expect(sniffMimeFromBytes(undefined)).toBeNull();
    });

    it('accepts an ArrayBuffer as well as a Uint8Array', () => {
        const u8 = bytes(ascii('%PDF-1.7'), 16);
        expect(sniffMimeFromBytes(u8.buffer)).toBe('application/pdf');
    });
});

describe('extensionForMime', () => {
    it('maps known sniffable mimes to a bare extension (no dot)', () => {
        expect(extensionForMime('application/pdf')).toBe('pdf');
        expect(extensionForMime('image/png')).toBe('png');
        expect(extensionForMime('image/jpeg')).toBe('jpg');
        expect(extensionForMime('image/gif')).toBe('gif');
        expect(extensionForMime('image/webp')).toBe('webp');
        expect(extensionForMime('image/svg+xml')).toBe('svg');
        expect(extensionForMime('application/zip')).toBe('zip');
        expect(extensionForMime('audio/mpeg')).toBe('mp3');
        expect(extensionForMime('audio/wav')).toBe('wav');
        expect(extensionForMime('audio/ogg')).toBe('ogg');
        expect(extensionForMime('video/mp4')).toBe('mp4');
        expect(extensionForMime('text/html')).toBe('html');
    });

    it('is case-insensitive', () => {
        expect(extensionForMime('Application/PDF')).toBe('pdf');
    });

    it('returns null for unknown or empty mime', () => {
        expect(extensionForMime('application/octet-stream')).toBeNull();
        expect(extensionForMime('')).toBeNull();
        expect(extensionForMime(null)).toBeNull();
    });
});
