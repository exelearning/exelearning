import { MIME_TO_EXTENSION } from './shared/export/constants';

/**
 * Allowed upload extensions exposed in runtime config.
 */
export const ALLOWED_EXTENSIONS: string[] = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'svg',
    'webp',
    'mp3',
    'ogg',
    'wav',
    'm4a',
    'mp4',
    'webm',
    'ogv',
    'pdf',
    'zip',
    'txt',
    'html',
    'htm',
    'css',
    'js',
    'json',
    'xml',
    'ttf',
    'woff',
    'woff2',
    'eot',
];

/**
 * Get extension from MIME type.
 */
export function getExtensionFromMimeType(mime: string, withDot = false): string {
    const normalizedMime = (mime || '').toLowerCase();
    const extWithDot = MIME_TO_EXTENSION[normalizedMime] || '.bin';
    return withDot ? extWithDot : extWithDot.slice(1);
}

/**
 * Build fallback filename from asset ID and MIME type.
 */
export function deriveFilenameFromMime(assetId: string, mime: string): string {
    const ext = getExtensionFromMimeType(mime);
    return `asset-${assetId.substring(0, 8)}.${ext}`;
}
