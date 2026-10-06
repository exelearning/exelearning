/**
 * Pure validator / normalizer functions shared across WebMCP modules.
 * These are extracted from WebMCPService so they can be used independently
 * by WebMCPContext and other helpers without pulling in the full service.
 */

// String validation

/**
 * Returns the trimmed string if non-empty, otherwise null.
 * Non-string values always return null.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function optionalString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * Asserts that value is a non-empty string and returns it trimmed.
 * Throws if the assertion fails.
 *
 * @param {unknown} value
 * @param {string} fieldName  - used in the error message
 * @returns {string}
 */
export function requireString(value, fieldName) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${fieldName} is required`);
    }
    return value.trim();
}

/**
 * Returns the value as a finite number, or null when not parseable.
 * Handles both numeric and numeric-string inputs.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
export function optionalNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return null;
}

/**
 * Returns a boolean from the value, falling back to defaultValue when the
 * input cannot be unambiguously parsed.
 * Accepts boolean true/false and string "true"/"1"/"yes"/"false"/"0"/"no".
 *
 * @param {unknown} value
 * @param {boolean} [defaultValue=false]
 * @returns {boolean}
 */
export function optionalBoolean(value, defaultValue = false) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
        if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
    return defaultValue;
}

// Metadata

/**
 * Normalises a metadata field value: trims strings, returns '' for everything else.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMetadataValue(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
}

/**
 * Returns an array of required metadata field names that are missing or empty.
 *
 * @param {{ title?: string, author?: string, description?: string }} metadata
 * @returns {string[]}
 */
export function getMissingRequiredMetadataFields(metadata) {
    const missing = [];
    if (!metadata.title) missing.push('title');
    if (!metadata.author) missing.push('author');
    if (!metadata.description) missing.push('description');
    return missing;
}

// JSON

/**
 * Normalises a jsonProperties value for storage as a JSON string.
 * Accepts object or JSON string input; rejects arrays.
 *
 * @param {unknown} value
 * @param {string} [fieldName='jsonProperties']
 * @returns {string}
 */
export function normalizeJsonPropertiesForStorage(value, fieldName = 'jsonProperties') {
    if (value === undefined || value === null) {
        return '{}';
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return '{}';
        }

        try {
            const parsed = JSON.parse(trimmed);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error(`${fieldName} must be a JSON object`);
            }
            return JSON.stringify(parsed);
        } catch (error) {
            if (error?.message === `${fieldName} must be a JSON object`) {
                throw error;
            }
            throw new Error(`${fieldName} is not valid JSON`);
        }
    }

    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            throw new Error(`${fieldName} must be a JSON object`);
        }
        return JSON.stringify(value);
    }

    throw new Error(`${fieldName} must be a JSON object or JSON string`);
}

/**
 * Parses a value into a plain object.
 * Accepts object or JSON string input; rejects arrays.
 * Returns {} for falsy values.
 *
 * @param {unknown} value
 * @param {string} [fieldName='jsonProperties']
 * @returns {object}
 */
export function parseJsonObject(value, fieldName = 'jsonProperties') {
    if (!value) return {};
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            throw new Error(`${fieldName} must be a JSON object`);
        }
        return { ...value };
    }
    if (typeof value !== 'string') {
        return {};
    }

    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { ...parsed };
        }
        throw new Error(`${fieldName} must be a JSON object`);
    } catch {
        throw new Error(`${fieldName} is not valid JSON`);
    }
}

/**
 * Returns value as an array. Accepts arrays or JSON strings that parse to arrays.
 * Throws when value cannot be converted to an array.
 *
 * @param {unknown} value
 * @param {string} fieldName
 * @returns {unknown[]}
 */
export function parseArrayValue(value, fieldName) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch {
            // Continue to error below.
        }
    }

    throw new Error(`${fieldName} must be an array`);
}

// URLs and images

/**
 * Determines whether a URL hostname points at a loopback, private, link-local
 * or otherwise internal address. Such hosts must never be fetched on behalf of
 * an MCP agent (SSRF protection: e.g. the cloud-metadata endpoint at
 * 169.254.169.254, or services bound to localhost / a private LAN).
 *
 * Note: `URL.hostname` is already lowercased; IPv6 literals are returned wrapped
 * in brackets (e.g. "[::1]"), which we strip before inspection.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
export function isBlockedImageHost(hostname) {
    if (!hostname) {
        return true;
    }
    // Strip IPv6 brackets: URL.hostname returns "[::1]" for ipv6 literals.
    const host = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '');

    // localhost and internal-only TLDs / bare (dot-less) hostnames.
    if (host === 'localhost' || host.endsWith('.localhost')) {
        return true;
    }
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.intranet')) {
        return true;
    }

    // IPv4 literals.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        const parts = host.split('.').map((p) => Number(p));
        const [a, b] = parts;
        if (a === 127) return true; // loopback 127.0.0.0/8
        if (a === 10) return true; // private 10.0.0.0/8
        if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16
        if (a === 192 && b === 168) return true; // private 192.168.0.0/16
        if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16.0.0/12
        if (a === 0) return true; // 0.0.0.0/8 (unspecified)
        return false;
    }

    // IPv6 literals (brackets already stripped by URL parsing).
    if (host.includes(':')) {
        if (host === '::1' || host === '::') return true; // loopback / unspecified
        if (host.startsWith('fe80:') || host.startsWith('fe80::')) return true; // link-local
        // Unique-local fc00::/7 → first hextet starts with fc or fd.
        if (/^f[cd][0-9a-f]*:/.test(host)) return true;
        // IPv4-mapped loopback, e.g. ::ffff:127.0.0.1
        if (host.includes('127.0.0.1')) return true;
        return false;
    }

    // A registered hostname with at least one dot (e.g. example.com) is allowed;
    // a bare hostname with no dot (e.g. "intranet") is treated as internal.
    if (!host.includes('.')) {
        return true;
    }

    return false;
}

/**
 * Parses a URL string and returns it as a string when it uses http or https.
 * Returns null for any other protocol, invalid URLs, or hosts that resolve to
 * internal / loopback / private addresses (SSRF protection).
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function tryParseHttpImageUrl(value) {
    try {
        const parsed = new URL(String(value));
        const protocol = parsed.protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') {
            return null;
        }
        if (isBlockedImageHost(parsed.hostname)) {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * Asserts that value is a valid http/https URL and returns it.
 * Throws if the assertion fails.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function requireHttpImageUrl(value) {
    const parsed = tryParseHttpImageUrl(value);
    if (!parsed) {
        throw new Error('imageUrl must be a valid absolute URL (http/https)');
    }
    return parsed;
}

/**
 * Builds a picsum.photos URL for a given seed and dimensions.
 *
 * @param {unknown} seed
 * @param {unknown} width
 * @param {unknown} height
 * @returns {string}
 */
export function buildPicsumImageUrl(seed, width, height) {
    const normalizedSeed = optionalString(seed) || `img-${Date.now()}`;
    const normalizedWidth = clampNumber(optionalNumber(width), 64, 4096, 1280);
    const normalizedHeight = clampNumber(optionalNumber(height), 64, 4096, 720);
    return `https://picsum.photos/seed/${encodeURIComponent(normalizedSeed)}/${normalizedWidth}/${normalizedHeight}`;
}

/**
 * Resolves an image URL from a raw value or picsum options.
 * Accepts http/https URLs directly, or falls back to picsum when
 * options.allowTextAsPicsumSeed is true.
 *
 * @param {unknown} value
 * @param {{ allowTextAsPicsumSeed?: boolean, picsumSeed?: unknown, picsumWidth?: unknown, picsumHeight?: unknown }} [options]
 * @returns {string}
 */
export function resolveImageUrlFromInput(value, options = {}) {
    const raw = optionalString(value);
    if (raw) {
        const parsed = tryParseHttpImageUrl(raw);
        if (parsed) {
            return parsed;
        }

        if (!optionalBoolean(options.allowTextAsPicsumSeed, false)) {
            throw new Error('imageUrl must be a valid absolute URL (http/https)');
        }

        return buildPicsumImageUrl(raw, options.picsumWidth, options.picsumHeight);
    }

    const picsumSeed = optionalString(options.picsumSeed);
    if (!picsumSeed) {
        throw new Error('imageUrl is required (or provide picsumSeed)');
    }

    return buildPicsumImageUrl(picsumSeed, options.picsumWidth, options.picsumHeight);
}

// Numbers

/**
 * Clamps value to [min, max]. Returns defaultValue when value is not finite.
 *
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} defaultValue
 * @returns {number}
 */
export function clampNumber(value, min, max, defaultValue) {
    if (!Number.isFinite(value)) {
        return defaultValue;
    }
    return Math.min(max, Math.max(min, value));
}

/**
 * Parses value into an array of integer numbers.
 * Accepts arrays or JSON strings that parse to arrays.
 * Non-integer items are filtered out.
 *
 * @param {unknown} value
 * @returns {number[]}
 */
export function parseOptionalNumberArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => optionalNumber(item)).filter((item) => Number.isInteger(item));
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => optionalNumber(item)).filter((item) => Number.isInteger(item));
            }
        } catch {
            return [];
        }
    }
    return [];
}

// HTML

/**
 * Escapes &, <, >, ", and ' for safe HTML attribute / text insertion.
 *
 * @param {unknown} text
 * @returns {string}
 */
export function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Normalises an insert position value to 'append', 'prepend', or 'replace'.
 * Throws on unrecognised input.
 *
 * @param {unknown} value
 * @returns {'append'|'prepend'|'replace'}
 */
export function normalizeInsertPosition(value) {
    const raw = optionalString(value);
    if (!raw) return 'append';
    const normalized = raw.toLowerCase();
    if (normalized === 'append' || normalized === 'after') {
        return 'append';
    }
    if (normalized === 'prepend' || normalized === 'before') {
        return 'prepend';
    }
    if (normalized === 'replace') {
        return normalized;
    }
    throw new Error('position must be append/after, prepend/before or replace');
}

/**
 * Merges an HTML fragment into existing HTML at the given position.
 *
 * @param {string} currentHtml
 * @param {string} fragment
 * @param {'append'|'prepend'|'replace'} position
 * @returns {string}
 */
export function mergeHtmlContent(currentHtml, fragment, position) {
    if (position === 'replace') {
        return fragment;
    }
    if (position === 'prepend') {
        return `${fragment}${currentHtml || ''}`;
    }
    return `${currentHtml || ''}${fragment}`;
}

/**
 * Normalises a question HTML value.
 * Returns raw value when it contains HTML tags, otherwise wraps plain text in <p>.
 * Throws when value is empty.
 *
 * @param {unknown} value
 * @param {string} fieldPrefix - used in error message
 * @returns {string}
 */
export function normalizeQuestionHtml(value, fieldPrefix) {
    const raw = optionalString(value);
    if (!raw) {
        throw new Error(`${fieldPrefix}.baseText is required`);
    }
    if (raw.includes('<')) {
        return raw;
    }
    return `<p>${escapeHtml(raw)}</p>`;
}

// Files

/**
 * Detects the MIME type from a filename extension.
 * Falls back to 'application/octet-stream' for unknown extensions.
 *
 * @param {string} filename
 * @returns {string}
 */
export function detectMimeType(filename) {
    const ext = getFileExtension(filename);
    const map = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        avif: 'image/avif',
    };
    return map[ext] || 'application/octet-stream';
}

/**
 * Returns the file extension for a given MIME type, or '' for unknown types.
 *
 * @param {string} mimeType
 * @returns {string}
 */
export function extensionFromMimeType(mimeType) {
    const map = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/svg+xml': 'svg',
        'image/avif': 'avif',
    };
    return map[String(mimeType || '').toLowerCase()] || '';
}

/**
 * Returns the lowercased file extension from a filename, or '' when none found.
 *
 * @param {string} filename
 * @returns {string}
 */
export function getFileExtension(filename) {
    if (typeof filename !== 'string') return '';
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : '';
}

/**
 * Removes filesystem-unsafe characters and limits length to 120 chars.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeFilename(value) {
    if (typeof value !== 'string') return '';
    const cleaned = value.replace(/[\\/:*?"<>|]/g, '-').trim();
    return cleaned.slice(0, 120);
}

/**
 * Derives a safe filename from an image URL. Falls back to a timestamped name
 * when the URL path has no usable filename.
 *
 * @param {string} imageUrl
 * @param {string} [mimeType='']
 * @returns {string}
 */
export function filenameFromImageUrl(imageUrl, mimeType = '') {
    try {
        const parsed = new URL(imageUrl);
        const raw = decodeURIComponent(parsed.pathname.split('/').pop() || '');
        const safe = sanitizeFilename(raw);
        if (safe && getFileExtension(safe)) {
            return safe;
        }
        const ext = extensionFromMimeType(mimeType) || 'png';
        const name = safe || `internet-image-${Date.now()}`;
        return getFileExtension(name) ? name : `${name}.${ext}`;
    } catch {
        const ext = extensionFromMimeType(mimeType) || 'png';
        return `internet-image-${Date.now()}.${ext}`;
    }
}

/**
 * Normalises a CSS size value to a string with unit.
 * Bare numbers become pixels; valid CSS size strings are returned as-is.
 * Returns '' for empty or unrecognised values.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeCssSize(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return `${value}px`;
    }
    if (typeof value !== 'string') return '';

    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^\d+(\.\d+)?(px|%|rem|em|vw|vh)?$/i.test(trimmed)) {
        if (/^\d+(\.\d+)?$/i.test(trimmed)) {
            return `${trimmed}px`;
        }
        return trimmed;
    }
    return '';
}

/**
 * Maps an alignment keyword to the corresponding CSS class.
 * Returns '' for unrecognised values.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeImageAlign(value) {
    const raw = optionalString(value);
    if (!raw) return '';
    const normalized = raw.toLowerCase();
    if (normalized === 'left') return 'exe-image-left';
    if (normalized === 'right') return 'exe-image-right';
    if (normalized === 'center') return 'exe-image-center';
    if (normalized === 'inline') return 'exe-image-inline';
    return '';
}

/**
 * Asserts that value is a valid base64 data URL (data:<mime>;base64,...).
 * Throws if the assertion fails.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function requireDataUrl(value) {
    const raw = requireString(value, 'dataUrl');
    if (!/^data:[^;]+;base64,/.test(raw)) {
        throw new Error('dataUrl must be a valid base64 data URL');
    }
    return raw;
}

/**
 * Extracts the MIME type from a data URL string.
 * Returns '' when the input is not a valid data URL.
 *
 * @param {unknown} dataUrl
 * @returns {string}
 */
export function detectDataUrlMimeType(dataUrl) {
    if (typeof dataUrl !== 'string') return '';
    const match = dataUrl.match(/^data:([^;]+);base64,/i);
    return match && match[1] ? match[1].toLowerCase() : '';
}

// Binary

/**
 * Decodes a base64 string (with or without data URL prefix) into a Uint8Array.
 *
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToUint8Array(base64) {
    const normalized = base64.includes(',')
        ? base64.substring(base64.indexOf(',') + 1)
        : base64;

    const binary = atob(normalized);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

/**
 * Creates a File (or Blob fallback) from a byte array.
 *
 * @param {Uint8Array} bytes
 * @param {string} filename
 * @param {string} mimeType
 * @returns {File|Blob}
 */
export function createFileFromBytes(bytes, filename, mimeType) {
    if (typeof File !== 'undefined') {
        return new File([bytes], filename, { type: mimeType });
    }

    const blob = new Blob([bytes], { type: mimeType });
    blob.name = filename;
    return blob;
}

/**
 * Creates a File (or Blob fallback) from an existing Blob.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {string} mimeType
 * @returns {File|Blob}
 */
export function createFileFromBlob(blob, filename, mimeType) {
    if (typeof File !== 'undefined') {
        return new File([blob], filename, {
            type: mimeType || blob.type || 'application/octet-stream',
        });
    }

    if (mimeType && blob.type !== mimeType) {
        const rewritten = new Blob([blob], { type: mimeType });
        rewritten.name = filename;
        return rewritten;
    }
    blob.name = filename;
    return blob;
}

// iDevice type check

/**
 * Returns true when ideviceType string is exactly 'text' (canonical post-import type).
 * Exported here so both WebMCPContext and callers share the same predicate.
 *
 * @param {unknown} ideviceType
 * @returns {boolean}
 */
export function isTextIdeviceType(ideviceType) {
    return String(ideviceType || '').toLowerCase() === 'text';
}

/**
 * Returns true when the component's ideviceType indicates a text iDevice.
 *
 * @param {{ ideviceType?: unknown }|null|undefined} component
 * @returns {boolean}
 */
export function isTextIdeviceComponent(component) {
    return isTextIdeviceType(component?.ideviceType);
}

// ID generation

/**
 * Generates a canonical ODE identifier: 14-digit UTC timestamp (YYYYMMDDHHmmss)
 * followed by 6 random characters from [A-Z0-9].
 * Matches the format produced by OdeXmlGenerator.ts:315–332.
 *
 * @returns {string}
 */
export function generateOdeId() {
    const now = new Date();
    const timestamp =
        now.getUTCFullYear().toString() +
        String(now.getUTCMonth() + 1).padStart(2, '0') +
        String(now.getUTCDate()).padStart(2, '0') +
        String(now.getUTCHours()).padStart(2, '0') +
        String(now.getUTCMinutes()).padStart(2, '0') +
        String(now.getUTCSeconds()).padStart(2, '0');

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let random = '';
    for (let i = 0; i < 6; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return timestamp + random;
}

/**
 * @deprecated Use generateOdeId() instead.
 * Kept for backward compatibility; ignores the prefix parameter.
 *
 * @returns {string}
 */
export function generateLocalId() {
    return generateOdeId();
}

// Asset URLs

/**
 * Asserts that value is a valid Yjs internal asset URL:
 *   asset://<uuid>  or  asset://<uuid>.<ext>
 * where uuid matches the 8-4-4-4-12 hex pattern (case-insensitive).
 * Throws on failure; returns the trimmed value on success.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function requireAssetUuidUrl(value) {
    if (typeof value !== 'string') {
        throw new Error('assetId must be a valid asset:// URL with a UUID identifier');
    }
    const trimmed = value.trim();
    const UUID_RE =
        /^asset:\/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-zA-Z0-9]+)?$/i;
    if (!UUID_RE.test(trimmed)) {
        throw new Error('assetId must be a valid asset:// URL with a UUID identifier');
    }
    return trimmed;
}

// Text encoding

/**
 * Encodes a string using the legacy escape() function, falling back to
 * encodeURIComponent when escape is not available.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function encodeLegacyText(value) {
    const text = String(value || '');
    if (typeof globalThis.escape === 'function') {
        return globalThis.escape(text);
    }
    return encodeURIComponent(text);
}

// MCP result wrapper

/**
 * Wraps an arbitrary payload in the MCP text-content envelope.
 *
 * Pass `{ isError: true }` to mark the envelope as an error per MCP spec.
 *
 * @param {unknown} payload
 * @param {{ isError?: boolean }} [options]
 * @returns {{ content: Array<{ type: 'text', text: string }>, isError?: boolean }}
 */
export function wrapResult(payload, options = {}) {
    const envelope = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
    if (options.isError === true) {
        envelope.isError = true;
    }
    return envelope;
}
