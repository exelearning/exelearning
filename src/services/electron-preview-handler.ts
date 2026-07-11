/**
 * Electron `app://` opaque preview handler (serving contract v2).
 *
 * In the desktop app the editor renderer is loaded from the privileged custom
 * scheme `app://localhost`, served by `protocol.handle('app', …)` in the main
 * process. There is no HTTP backend. This module lets Electron use the SAME
 * opaque HTTP preview transport as cloud (`HttpPreviewProvider`) instead of the
 * legacy same-origin Service Worker preview: `protocol.handle` routes
 * `app://localhost/api/preview-session*` and `app://localhost/preview/{id}/*`
 * here, backed by the shared `preview-session-manager` store.
 *
 * Why this matters: the SW preview runs the untrusted author content
 * SAME-ORIGIN with the renderer, which exposes `window.top.electronAPI`
 * (arbitrary `readFile` → `fs.readFileSync`). Serving the preview from an
 * opaque origin (the response CSP `sandbox` header, no `allow-same-origin`)
 * makes the preview cross-origin to the renderer, so `window.top.electronAPI`
 * throws — closing that arbitrary-local-file-read hole.
 *
 * Single-user desktop: there is no network socket (custom protocol is
 * in-process) and no login, so the management API runs on **local trust** — a
 * fixed local owner id, no JWT. `app://` is unreachable by other processes or
 * web pages, so there is nothing to authenticate against.
 *
 * The security-critical logic (layered store, atomic revisions, budgets, TTL,
 * tiered headers, ETag/Range) is REUSED from `preview-session-manager.ts` and
 * `preview-serving.ts`; the isolation policy (CSP + headers) from
 * `previewSandbox.ts`. Packaged builds must point the fixed-resource resolver
 * at the installed static distribution via `configureElectronPreview` (until
 * then the default public/ root serves dev runs). This file is bundled to
 * CommonJS for the Electron main process by the package.json script
 * `bundle:electron-preview` (bun build → app/preview/electron-preview.cjs).
 */
import path from 'node:path';
import * as fixedResources from './preview-fixed-resources';
import * as manager from './preview-session-manager';
import {
    createSessionResponse,
    defaultFixedResources,
    handleAssetsUpload,
    handleRevisionUpload,
    servePreviewFile,
} from './preview-serving';

/** Single desktop user — the management API is local-trust, not multi-tenant. */
const LOCAL_OWNER_ID = 0;

let initialized = false;

/**
 * Start the idle-TTL sweeper. Call once from the Electron main process before
 * handling requests. (v2 needs no hasher — asset identity is an opaque
 * client-declared token, never re-hashed.)
 */
export function initElectronPreview(): void {
    if (initialized) return;
    manager.startPreviewSessionSweeper();
    initialized = true;
}

/**
 * Point the fixed-resource layer at the distribution the Electron main process
 * actually serves (`dist/static` in dev, the asar copy when packaged). The
 * handler is bundled with a private module-instance of the resolver, so the
 * main process must call this export — configuring `preview-fixed-resources`
 * from server code would not reach the bundle.
 */
export function configureElectronPreview(options: { staticRoot: string }): void {
    fixedResources.configure({
        publicRoot: options.staticRoot,
        manifestPath: path.join(options.staticRoot, 'bundles', 'preview-fixed-resources.json'),
    });
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}

/** Extract the JSON field + index-aligned files[] from a multipart body. */
async function parseUploadForm(request: Request, fieldName: string): Promise<{ field: unknown; files: Blob[] }> {
    const form = await request.formData();
    const field = form.get(fieldName);
    const files = form.getAll('files').filter((f): f is Blob => f instanceof Blob);
    return { field, files };
}

async function handleAssets(previewId: string, request: Request): Promise<Response> {
    const owned = manager.getOwnedSession(previewId, LOCAL_OWNER_ID);
    if ('status' in owned) return json({ success: false, error: 'Preview session not found' }, owned.status);
    const { field, files } = await parseUploadForm(request, 'assets');
    const result = await handleAssetsUpload(owned.session, field, files, manager);
    return json(result.body, result.status);
}

async function handleRevision(previewId: string, request: Request): Promise<Response> {
    const owned = manager.getOwnedSession(previewId, LOCAL_OWNER_ID);
    if ('status' in owned) return json({ success: false, error: 'Preview session not found' }, owned.status);
    const { field, files } = await parseUploadForm(request, 'revision');
    const result = await handleRevisionUpload(owned.session, field, files, manager, defaultFixedResources());
    return json(result.body, result.status);
}

/**
 * Route an `app://` request to the preview transport. Returns a `Response` for
 * `/api/preview-session*` and `/preview/{id}/*`, or `null` for any other path so
 * the caller (the `protocol.handle('app')` static file server) can handle it.
 */
export async function handlePreviewRequest(request: Request): Promise<Response | null> {
    initElectronPreview();
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    const method = request.method.toUpperCase();

    // --- Serving route (authless capability URL) ---
    const serveMatch = pathname.match(/^\/preview\/([^/]+)(?:\/(.*))?$/);
    if (serveMatch) {
        if (method !== 'GET') return json({ success: false, error: 'Method not allowed' }, 405);
        // group2 is undefined for the no-slash bare root (`/preview/{id}`) and
        // '' for the trailing-slash bare root (`/preview/{id}/`). Preserve the
        // distinction ('' vs '/') so servePreviewFile emits the correct relative
        // redirect Location for each; a non-empty rest is a real served path.
        const rest = serveMatch[2];
        const relPath = rest === undefined ? '' : rest === '' ? '/' : rest;
        return servePreviewFile(
            serveMatch[1],
            relPath,
            {
                ifNoneMatch: request.headers.get('if-none-match'),
                range: request.headers.get('range'),
            },
            { manager, fixedResources: defaultFixedResources() },
        );
    }

    // --- Management API (local trust) ---
    if (pathname === '/api/preview-session' && method === 'POST') {
        const result = createSessionResponse(manager, LOCAL_OWNER_ID);
        return json(result.body, result.status);
    }
    const apiMatch = pathname.match(/^\/api\/preview-session\/([^/]+)(?:\/(assets|revisions))?$/);
    if (apiMatch) {
        const [, previewId, action] = apiMatch;
        if (action === 'assets' && method === 'POST') return handleAssets(previewId, request);
        if (action === 'revisions' && method === 'POST') return handleRevision(previewId, request);
        if (!action && method === 'DELETE') {
            manager.deleteSession(previewId);
            return json({ success: true });
        }
        return json({ success: false, error: 'Method not allowed' }, 405);
    }

    return null;
}
