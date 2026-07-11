/**
 * Pure helpers for the preview file map.
 *
 * With the srcdoc transport removed, the only remaining consumer is the
 * panel's document opener (`_openDocumentBytes`), which needs a MIME type for
 * a document/media path fetched from the active provider. The former
 * content-lookup/decoding helpers (findFileContent/decodeFileContent/
 * toUint8Array/resolveRelativePath) belonged to the srcdoc inliner and were
 * removed with it.
 */

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
