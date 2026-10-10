/**
 * Serves `/files/tmp/*` and `/files/dist/*` straight from FILES_DIR.
 *
 * These files are user uploads and export output, served from the application's own origin. A document that can run
 * script (HTML, SVG, XML) gets the public view's sandbox CSP, so it runs in an opaque origin and cannot use the
 * visitor's session; nothing is MIME-sniffed, so an unknown extension is never rendered as a document.
 */
import * as fs from 'fs';
import * as path from 'path';
import { MIME_TYPES } from '../utils/mime-types';
import { publicViewCspHeader, resolvePublicViewCspProfile } from '../shared/security/publicViewSandbox';

const ACTIVE_DOCUMENT_TYPES = new Set(['text/html', 'image/svg+xml', 'application/xml']);

/**
 * Return the response for a `/files/tmp/*` or `/files/dist/*` request, or null when the path is not one of them or
 * the file does not exist, so the request falls through to the next handler.
 */
export function serveFilesDirFile(pathname: string, filesDir: string): Response | null {
    const filesMatch = pathname.match(/^\/files\/(tmp|dist)\/(.+)$/);
    if (!filesMatch) return null;

    const subPath = filesMatch[1]; // 'tmp' or 'dist'
    const relativePath = filesMatch[2]; // rest of the path

    // Prevent path traversal
    const cleanPath = relativePath.replace(/\.\./g, '');
    const filePath = path.join(filesDir, subPath, cleanPath);

    // Security: ensure path is within FILES_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(filesDir);
    if (!resolvedPath.startsWith(resolvedBase)) {
        return new Response('Forbidden', { status: 403 });
    }

    if (fs.existsSync(filePath)) {
        try {
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
                const content = fs.readFileSync(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';

                const headers: Record<string, string> = {
                    'Content-Type': contentType,
                    'Content-Length': stats.size.toString(),
                    'Cache-Control': 'public, max-age=3600', // 1 hour cache
                    'X-Content-Type-Options': 'nosniff',
                };
                if (ACTIVE_DOCUMENT_TYPES.has(contentType)) {
                    headers['Content-Security-Policy'] = publicViewCspHeader(resolvePublicViewCspProfile());
                }
                return new Response(content, { headers });
            }
        } catch (err) {
            console.error('[StaticFiles] Error serving file:', filePath, err);
        }
    }
    // File not found - let it fall through to 404
    return null;
}
