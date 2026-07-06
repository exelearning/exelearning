/**
 * Pure helpers for working with the in-memory preview file map
 * (`Record<path, ArrayBuffer|Uint8Array|string>` as produced by
 * `SharedExporters.generatePreviewForSW`). Extracted from PreviewPanelManager
 * so every preview transport (HTTP session, srcdoc, legacy Service Worker)
 * shares one lookup/decoding implementation.
 */

/**
 * Decode file content (ArrayBuffer/Uint8Array/string) to a string.
 * @param {ArrayBuffer|Uint8Array|string|null|undefined} content
 * @returns {string|null}
 */
export function decodeFileContent(content) {
    if (!content) return null;
    if (typeof content === 'string') return content;
    return new TextDecoder().decode(content);
}

/**
 * Normalize file content to a Uint8Array.
 * @param {ArrayBuffer|Uint8Array|string|null|undefined} content
 * @returns {Uint8Array|null}
 */
export function toUint8Array(content) {
    if (content instanceof Uint8Array) return content;
    if (content instanceof ArrayBuffer) return new Uint8Array(content);
    if (typeof content === 'string') return new TextEncoder().encode(content);
    return null;
}

/**
 * Resolve relative path segments (../, ./) in a path.
 * @param {string} path
 * @returns {string}
 */
export function resolveRelativePath(path) {
    const parts = path.split('/');
    const resolved = [];
    for (const part of parts) {
        if (part === '..') {
            resolved.pop();
        } else if (part !== '.' && part !== '') {
            resolved.push(part);
        }
    }
    return resolved.join('/');
}

/**
 * Look up a resource path in the files map with multiple fallback strategies:
 * 1. Direct match
 * 2. Remove leading ../ segments
 * 3. Extract content/resources/... from absolute URLs
 * 4. Match by filename against content/resources/ entries
 * @param {Object<string, ArrayBuffer|Uint8Array|string>} files
 * @param {string} path
 * @returns {ArrayBuffer|Uint8Array|string|undefined}
 */
export function findFileContent(files, path) {
    if (files[path] !== undefined) return files[path];

    const normalized = path.replace(/^(\.\.\/)+/, '');
    if (files[normalized] !== undefined) return files[normalized];

    const resourceMatch = path.match(/content\/resources\/(.+)$/);
    if (resourceMatch) {
        const resourcePath = `content/resources/${resourceMatch[1]}`;
        if (files[resourcePath] !== undefined) return files[resourcePath];

        const filename = resourceMatch[1].split('/').pop();
        if (filename) {
            for (const key of Object.keys(files)) {
                if (key.startsWith('content/resources/') && key.endsWith('/' + filename)) {
                    return files[key];
                }
                if (key === `content/resources/${filename}`) {
                    return files[key];
                }
            }
        }
    }

    return undefined;
}

/** MIME types for documents/media the preview offers to open outside the page flow. */
const DOCUMENT_MIME_MAP = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odp: 'application/vnd.oasis.opendocument.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
};

/**
 * MIME type for a document/media path opened from the preview.
 * @param {string} path
 * @returns {string}
 */
export function documentMimeFor(path) {
    const name = path.split('/').pop() || '';
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    return DOCUMENT_MIME_MAP[ext] || 'application/octet-stream';
}
