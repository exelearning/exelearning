/**
 * MIME Types Utility
 * Centralized MIME type mappings for static file serving
 */

/**
 * Mapping of file extensions to MIME types
 * Used for setting correct Content-Type headers when serving static files
 */
export const MIME_TYPES: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
};

/**
 * Get MIME type for a file extension
 * @param extension - File extension including the dot (e.g., '.svg')
 * @returns MIME type string, defaults to 'application/octet-stream' for unknown types
 */
export function getMimeType(extension: string): string {
    return MIME_TYPES[extension.toLowerCase()] || 'application/octet-stream';
}
