/**
 * Content-based MIME detection (magic bytes).
 *
 * Recovers the real type of an asset whose stored filename lost its extension.
 * The static viewer decides how to serve/render a resource from its extension;
 * an extension-less PDF is served as application/octet-stream and gets
 * force-downloaded (issue: PDFs embedded in iframes auto-download in the static
 * editor). Sniffing the bytes lets us restore the correct MIME/extension.
 *
 * Delivery is dual:
 * - CommonJS (`module.exports`) under Vitest, so specs can `require()` it.
 * - `window.eXeMimeSniff` in the browser, where this file is loaded as a classic
 *   <script> by yjs-loader.js (no module system). Everything is wrapped in an
 *   IIFE so NO top-level identifiers leak into the shared classic-script scope
 *   (avoids "Identifier already declared" collisions with sibling scripts).
 *
 * NOTE: a minimal twin of `sniffMimeFromBytes` also lives in
 * `public/preview-sw.js` (the service worker cannot import app modules). The
 * twin intentionally omits the text/html signature: the SW injects helper
 * scripts into anything served as text/html, which is wrong for asset HTML —
 * the editor recovers HTML via this module + AssetManager._isHtmlAsset instead.
 *
 * @author eXeLearning Team
 * @license AGPL-3.0
 */
(function () {
    'use strict';

    /** Canonical extension (without dot) for each MIME this module can detect. */
    const MIME_TO_BARE_EXTENSION = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
        'application/zip': 'zip',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'video/mp4': 'mp4',
        'text/html': 'html',
    };

    /**
     * Coerce supported inputs to a Uint8Array view (no copy when already one).
     * @param {Uint8Array|ArrayBuffer|number[]|null|undefined} input
     * @returns {Uint8Array|null}
     */
    function toBytes(input) {
        if (input == null) return null;
        if (input instanceof Uint8Array) return input;
        if (input instanceof ArrayBuffer) return new Uint8Array(input);
        if (Array.isArray(input)) return Uint8Array.from(input);
        return null;
    }

    /** True if `bytes` matches the ASCII `text` starting at `offset`. */
    function matchesAscii(bytes, text, offset) {
        const at = offset || 0;
        if (bytes.length < at + text.length) return false;
        for (let i = 0; i < text.length; i++) {
            if (bytes[at + i] !== text.charCodeAt(i)) return false;
        }
        return true;
    }

    /** True if `bytes` starts with the given byte values. */
    function startsWithBytes(bytes, signature) {
        if (bytes.length < signature.length) return false;
        for (let i = 0; i < signature.length; i++) {
            if (bytes[i] !== signature[i]) return false;
        }
        return true;
    }

    /**
     * Detect a MIME type from the leading bytes of a file.
     *
     * @param {Uint8Array|ArrayBuffer|number[]|null|undefined} input
     * @returns {string|null} MIME type, or null if not recognized.
     */
    function sniffMimeFromBytes(input) {
        const bytes = toBytes(input);
        if (!bytes || bytes.length < 3) return null;

        if (matchesAscii(bytes, '%PDF-')) return 'application/pdf';
        if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
        if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
        if (matchesAscii(bytes, 'GIF87a') || matchesAscii(bytes, 'GIF89a')) return 'image/gif';

        // RIFF containers: bytes 0-3 = "RIFF", bytes 8-11 = format tag.
        if (matchesAscii(bytes, 'RIFF')) {
            if (matchesAscii(bytes, 'WEBP', 8)) return 'image/webp';
            if (matchesAscii(bytes, 'WAVE', 8)) return 'audio/wav';
        }

        // ZIP family (PK\x03\x04, plus empty-archive / spanned variants).
        if (
            startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
            startsWithBytes(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
            startsWithBytes(bytes, [0x50, 0x4b, 0x07, 0x08])
        ) {
            return 'application/zip';
        }

        if (matchesAscii(bytes, 'OggS')) return 'audio/ogg';
        if (matchesAscii(bytes, 'ID3')) return 'audio/mpeg';
        // ISO Base Media (mp4, m4a, mov...): "ftyp" box at offset 4.
        if (matchesAscii(bytes, 'ftyp', 4)) return 'video/mp4';

        // Text-based formats: allow a leading UTF-8 BOM.
        let textStart = 0;
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) textStart = 3;
        if (matchesAscii(bytes, '<svg', textStart)) return 'image/svg+xml';
        // HTML detection is case-insensitive (<!DOCTYPE html…> or a leading <html tag).
        let head = '';
        for (let i = textStart; i < bytes.length && i < textStart + 14; i++) {
            head += String.fromCharCode(bytes[i]);
        }
        head = head.toLowerCase();
        if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'text/html';
        // An XML prolog with no <svg/<html nearby — treat as SVG (legacy behaviour).
        if (matchesAscii(bytes, '<?xml', textStart)) return 'image/svg+xml';

        return null;
    }

    /**
     * Map a (sniffable) MIME type to its canonical bare extension.
     *
     * @param {string|null|undefined} mime
     * @returns {string|null} extension without a leading dot, or null if unknown.
     */
    function extensionForMime(mime) {
        if (!mime) return null;
        return MIME_TO_BARE_EXTENSION[mime.toLowerCase()] || null;
    }

    const api = { sniffMimeFromBytes, extensionForMime, MIME_TO_BARE_EXTENSION };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else if (typeof window !== 'undefined') {
        window.eXeMimeSniff = api;
    }
})();
