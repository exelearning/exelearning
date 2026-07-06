/**
 * Electron `app://` opaque preview handler.
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
 * The security-critical logic (content-addressed store, server-side re-hash,
 * atomic swap, budgets, TTL) is REUSED from `preview-session-manager.ts`; the
 * isolation policy (CSP + headers) is REUSED from `previewSandbox.ts`. This file
 * is bundled to CommonJS for the Electron main process by
 * `scripts/build-electron-preview.ts`.
 */
import { createHash } from 'node:crypto';
import * as manager from './preview-session-manager';
import {
    isScriptableDocumentType,
    previewCspHeader,
    previewPermissionsPolicy,
} from '../shared/security/previewSandbox';

/** Single desktop user — the management API is local-trust, not multi-tenant. */
const LOCAL_OWNER_ID = 0;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Portable SHA-256 (works under both Node and Bun, unlike `Bun.CryptoHasher`). */
async function nodeSha256(bytes: Uint8Array): Promise<string> {
    return createHash('sha256').update(bytes).digest('hex');
}

let initialized = false;

/**
 * Configure the shared manager with a portable hasher and start the idle-TTL
 * sweeper. Call once from the Electron main process before handling requests.
 */
export function initElectronPreview(): void {
    if (initialized) return;
    manager.configure({ sha256: nodeSha256 });
    manager.startPreviewSessionSweeper();
    initialized = true;
}

/** Headers applied to every serving response, 404s included. */
function baseServeHeaders(): Record<string, string> {
    return {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store',
        'Permissions-Policy': previewPermissionsPolicy(),
        'Access-Control-Allow-Origin': '*',
    };
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
}

function serveNotFound(): Response {
    return new Response('Not found', {
        status: 404,
        headers: { ...baseServeHeaders(), 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

function serveFile(previewId: string, relPath: string): Response {
    if (!UUID_RE.test(previewId)) return serveNotFound();
    const session = manager.getSessionForServing(previewId);
    if (!session) return serveNotFound();
    const file = manager.getFile(session, relPath);
    if (!file) return serveNotFound();
    const headers: Record<string, string> = { ...baseServeHeaders(), 'Content-Type': file.contentType };
    if (isScriptableDocumentType(file.contentType)) {
        headers['Content-Security-Policy'] = previewCspHeader();
    }
    return new Response(file.bytes, { headers });
}

async function handleManifest(previewId: string, request: Request): Promise<Response> {
    const owned = manager.getOwnedSession(previewId, LOCAL_OWNER_ID);
    if ('status' in owned) return json({ success: false, error: 'Preview session not found' }, owned.status);
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: 'Invalid JSON' }, 400);
    }
    const files = (body as { files?: Record<string, { sha256: string; size: number }> } | null)?.files;
    if (!files || typeof files !== 'object' || Array.isArray(files)) {
        return json({ success: false, error: 'Body must be { files: { [path]: { sha256, size } } }' }, 400);
    }
    const staged = manager.stageManifest(owned.session, files);
    if ('status' in staged) return json({ success: false, error: staged.message }, staged.status);
    return json(staged);
}

async function handleBlobs(previewId: string, request: Request): Promise<Response> {
    const owned = manager.getOwnedSession(previewId, LOCAL_OWNER_ID);
    if ('status' in owned) return json({ success: false, error: 'Preview session not found' }, owned.status);

    const form = await request.formData();
    const manifestId = form.get('manifestId');
    if (typeof manifestId !== 'string' || manifestId === '') {
        return json({ success: false, error: 'Missing manifestId' }, 400);
    }
    let hashes: unknown;
    try {
        hashes = JSON.parse(String(form.get('hashes') ?? ''));
    } catch {
        return json({ success: false, error: 'Invalid hashes JSON' }, 400);
    }
    if (!Array.isArray(hashes) || hashes.some(h => typeof h !== 'string')) {
        return json({ success: false, error: 'hashes must be an array of sha256 strings' }, 400);
    }
    const files = form.getAll('files').filter((f): f is Blob => f instanceof Blob);
    if (files.length !== hashes.length) {
        return json({ success: false, error: 'hashes and files must be index-aligned' }, 400);
    }

    // Two-stage byte-budget enforcement (mirrors preview-session.ts): declared
    // sizes before buffering, actual bytes while buffering.
    const limits = manager.getLimits();
    const remainingBudget = limits.maxBytesPerSession - owned.session.blobBytes;
    const blobs: Array<{ declaredSha256: string; bytes: Uint8Array }> = [];
    let bufferedBytes = 0;
    for (let i = 0; i < files.length; i++) {
        const bytes = new Uint8Array(await files[i].arrayBuffer());
        bufferedBytes += bytes.length;
        if (bufferedBytes > remainingBudget) {
            return json({ success: false, error: 'Upload exceeds the preview session byte budget' }, 413);
        }
        blobs.push({ declaredSha256: hashes[i] as string, bytes });
    }

    const result = await manager.storeBlobs(owned.session, manifestId, blobs);
    if ('status' in result) return json({ success: false, error: result.message }, result.status);
    return json(result);
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
        return serveFile(serveMatch[1], serveMatch[2] ?? '');
    }

    // --- Management API (local trust) ---
    if (pathname === '/api/preview-session' && method === 'POST') {
        const { previewId } = manager.createSession(LOCAL_OWNER_ID);
        const limits = manager.getLimits();
        return json(
            {
                previewId,
                limits: {
                    maxFilesPerSession: limits.maxFilesPerSession,
                    maxBytesPerSession: limits.maxBytesPerSession,
                    recommendedBatchBytes: 64 * 1024 * 1024,
                },
            },
            201,
        );
    }
    const apiMatch = pathname.match(/^\/api\/preview-session\/([^/]+)(?:\/(manifest|blobs))?$/);
    if (apiMatch) {
        const [, previewId, action] = apiMatch;
        if (action === 'manifest' && method === 'POST') return handleManifest(previewId, request);
        if (action === 'blobs' && method === 'POST') return handleBlobs(previewId, request);
        if (!action && method === 'DELETE') {
            manager.deleteSession(previewId);
            return json({ success: true });
        }
        return json({ success: false, error: 'Method not allowed' }, 405);
    }

    return null;
}
