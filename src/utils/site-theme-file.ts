/**
 * Site Theme File Resolver / Server
 *
 * Resolves and serves files under the admin-uploaded ("site") themes directory
 * (`FILES_DIR/themes/site`).
 *
 * Site themes are reachable through two URL shapes:
 *   - versioned, cache-busted:  `/v{appVersion}-{ts}/site-files/themes/{dir}/...`
 *   - plain:                    `/site-files/themes/{dir}/...`
 *
 * The plain shape is what the admin panel emits for theme screenshots
 * (`views/admin/index.njk`), prefixed with BASE_PATH. Behind a subdirectory
 * proxy the BASE_PATH segment is stripped before this runs, so both shapes
 * funnel through the same lookup here. Centralising the path matching, the
 * traversal guard, and the file read keeps `src/index.ts` free of duplicated
 * (and hard-to-test) logic.
 */
import * as fs from 'fs';
import * as path from 'path';
import { MIME_TYPES } from './mime-types';

/** Matches both the versioned and the plain site-theme URL shapes. */
const SITE_THEME_PATH_RE = /^\/(?:v[\d.]+[^/]*\/)?site-files\/themes\/(.+)$/;

/**
 * Resolve a (BASE_PATH-stripped) request pathname to an absolute file path
 * within the site themes directory.
 *
 * @param pathname - request pathname, with any BASE_PATH prefix already removed
 * @param filesDir - resolved FILES_DIR root (from getFilesDir())
 * @returns the validated absolute file path, or `null` when the pathname is not
 *          a site-theme request or would escape the themes/site directory
 *          (path traversal).
 */
export function resolveSiteThemeFile(pathname: string, filesDir: string): string | null {
    const match = pathname.match(SITE_THEME_PATH_RE);
    if (!match) {
        return null;
    }

    const relativePath = match[1];
    const baseDir = path.join(filesDir, 'themes', 'site');
    const filePath = path.join(baseDir, relativePath);

    // Security: ensure the resolved path stays within themes/site.
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);
    if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(resolvedBase + path.sep)) {
        return null;
    }

    return filePath;
}

/**
 * Serve a site-theme file for the given (BASE_PATH-stripped) pathname.
 *
 * @returns a `Response` with the file contents and a 1-year cache header, or
 *          `null` when the pathname is not a site-theme request, fails the
 *          traversal guard, or the file does not exist. Callers fall through
 *          to their own not-found handling on `null`.
 */
export function serveSiteThemeFile(pathname: string, filesDir: string): Response | null {
    const filePath = resolveSiteThemeFile(pathname, filesDir);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return null;
    }

    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new Response(content, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        },
    });
}
