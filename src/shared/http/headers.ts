/**
 * Helpers for HTTP response headers safe for Bun's Response constructor.
 *
 * Bun rejects header values containing bytes outside the printable ASCII
 * range, throwing `TypeError: Header '<n>' has invalid value: ...`. Any
 * value derived from user-supplied data (e.g. asset filenames with
 * accented characters) must be sanitised before assignment.
 */

const ASCII_PRINTABLE = /^[\x20-\x7E]*$/;

/**
 * Build an RFC 5987-compliant `Content-Disposition` header value.
 *
 * Emits both the legacy `filename="..."` (ASCII-only fallback for old
 * clients) and the modern `filename*=UTF-8''...` (full Unicode for
 * modern browsers). Control characters are stripped from the legacy
 * form to prevent header-injection vectors.
 */
export function buildContentDisposition(filename: string): string {
    const safeFilename = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
    const encodedFilename = encodeURIComponent(filename).replace(
        /['()*]/g,
        c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
    );
    return `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
}

/**
 * Encode an arbitrary string for use as a custom HTTP header value.
 *
 * ASCII-safe inputs pass through unchanged; anything else is
 * percent-encoded. Receivers should decode with `decodeURIComponent`
 * wrapped in `try/catch`.
 */
export function encodeHeaderValue(value: string): string {
    return ASCII_PRINTABLE.test(value) ? value : encodeURIComponent(value);
}
