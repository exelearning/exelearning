/**
 * Opaque preview snapshot routes (editor trust boundary — ADR-0002).
 *
 * Two deliberately separate plugins:
 *
 * - `previewSnapshotApiRoutes` (`/api/preview-snapshot`, JWT-authenticated):
 *   create/replace and delete snapshots. Only the snapshot owner may touch it.
 *   Internal editor API — not part of `/api/v1`. Cross-site requests are
 *   rejected outright (`Sec-Fetch-Site: cross-site`) as defense-in-depth on
 *   top of the `SameSite=Lax` auth cookie.
 *
 * - `previewSnapshotServeRoutes` (`/preview-snapshot/:previewId/*`, NO auth):
 *   serves snapshot files to the opaque-origin preview iframe. An opaque
 *   iframe sends no SameSite cookies, so this is a capability URL
 *   (server-minted 128-bit crypto-random id + TTL). Every response carries
 *   the hardening headers and `Cache-Control: no-store`; scriptable types
 *   additionally get the `sandbox`-first CSP so a directly opened snapshot
 *   URL stays opaque. The route never reads and never sets cookies.
 *
 * These plugins are registered only by the Bun server (`src/index.ts`). The
 * Electron app serves via its `app://` protocol handler and static/PWA builds
 * have no backend at all, so in those runtimes the transport is structurally
 * absent — the client resolves this via its runtime mode and never offers the
 * opaque transport there (no silent fallback).
 */
import { Elysia } from 'elysia';
import * as previewSnapshotStore from '../services/preview-snapshot-store';
import {
    isScriptableDocumentType,
    previewSnapshotCspHeader,
    previewSnapshotPermissionsPolicy,
} from '../shared/security/previewSandbox';
import { prefixPath } from '../utils/basepath.util';
import { requireAuth } from '../utils/guards';
import { withJwtAuth } from '../utils/route-auth';

export type PreviewSnapshotStore = typeof previewSnapshotStore;

export interface PreviewSnapshotRouteDeps {
    store: PreviewSnapshotStore;
}

function buildDefaultDeps(): PreviewSnapshotRouteDeps {
    return { store: previewSnapshotStore };
}

interface SnapshotUploadBody {
    snapshot?: Blob;
    previewId?: string;
}

/**
 * Reject requests a browser marks as cross-site. `SameSite=Lax` already keeps
 * the auth cookie off cross-site POSTs; this makes the policy explicit and
 * also covers tokens attached by other means.
 */
function isCrossSiteRequest(request: Request): boolean {
    return request.headers.get('sec-fetch-site') === 'cross-site';
}

/** Authenticated management API: create/replace and delete snapshots. */
export function createPreviewSnapshotApiRoutes(deps: PreviewSnapshotRouteDeps = buildDefaultDeps()) {
    const { store } = deps;

    return new Elysia({ prefix: '/api/preview-snapshot' })
        .use(withJwtAuth())
        .onBeforeHandle(({ jwtPayload, request, set }) => {
            if (isCrossSiteRequest(request)) {
                set.status = 403;
                return { success: false, error: 'Cross-site requests are not allowed' };
            }
            const err = requireAuth(jwtPayload);
            if (err) {
                set.status = err.status;
                return err;
            }
        })
        .post('/', async ({ body, jwtPayload, set }) => {
            const data = (body ?? {}) as SnapshotUploadBody;
            const blob = data.snapshot;
            if (!(blob instanceof Blob) || blob.size === 0) {
                set.status = 400;
                return { success: false, error: 'Missing snapshot archive' };
            }
            const limits = store.getLimits();
            if (blob.size > limits.maxSnapshotBytes) {
                set.status = 413;
                return { success: false, error: 'Snapshot exceeds the maximum allowed size' };
            }
            const unpacked = store.unpackSnapshotArchive(new Uint8Array(await blob.arrayBuffer()));
            if ('status' in unpacked) {
                set.status = unpacked.status;
                return { success: false, error: unpacked.error };
            }
            const previewId = typeof data.previewId === 'string' && data.previewId ? data.previewId : null;
            const result = store.createOrReplace(Number(jwtPayload!.sub), previewId, unpacked.files);
            if ('status' in result) {
                set.status = result.status;
                return { success: false, error: result.error };
            }
            return {
                previewId: result.snapshot.id,
                previewUrl: prefixPath(`/preview-snapshot/${result.snapshot.id}/index.html`),
            };
        })
        .delete('/:previewId', ({ params, jwtPayload, set }) => {
            const owned = store.getOwned(params.previewId, Number(jwtPayload!.sub));
            if ('status' in owned) {
                set.status = owned.status;
                return { success: false, error: owned.status === 403 ? 'Access denied' : 'Snapshot not found' };
            }
            store.deleteSnapshot(params.previewId);
            return { success: true };
        });
}

/**
 * Headers applied to every serving response, 404s included. `Set-Cookie` is
 * never emitted — the capability id is the only credential in play.
 * `Access-Control-Allow-Origin: *` is safe here: fonts and `fetch()` from the
 * opaque frame arrive CORS-mode with `Origin: null`, and the route is authless
 * and cookieless, so the wildcard grants nothing beyond what the capability
 * URL already serves.
 */
function baseServeHeaders(): Record<string, string> {
    return {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': previewSnapshotPermissionsPolicy(),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
    };
}

function notFound(): Response {
    return new Response('Not found', {
        status: 404,
        headers: { ...baseServeHeaders(), 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

/** Reference serving logic: id gate → snapshot lookup → file lookup → headers. */
export function serveSnapshotFile(previewId: string, relPath: string, store: PreviewSnapshotStore): Response {
    if (!previewSnapshotStore.PREVIEW_ID_RE.test(previewId)) return notFound();

    // Bare capability root → redirect to the canonical entry document so its
    // relative asset references resolve. The Location is RELATIVE so it
    // survives BASE_PATH. A trailing slash resolves `index.html` against
    // `/preview-snapshot/{id}/`; no slash resolves `{id}/index.html` against
    // `/preview-snapshot/{id}`. Stateless (before snapshot lookup): the
    // redirect target answers existence.
    if (relPath === '' || relPath === '/') {
        const location = relPath === '/' ? 'index.html' : `${previewId}/index.html`;
        return new Response(null, {
            status: 302,
            headers: { ...baseServeHeaders(), Location: location },
        });
    }

    const snapshot = store.getForServing(previewId);
    if (!snapshot) return notFound();
    const file = store.getFile(snapshot, relPath);
    if (!file) return notFound();

    const headers: Record<string, string> = { ...baseServeHeaders(), 'Content-Type': file.contentType };
    // Sandbox-first CSP on every scriptable document type (HTML, XHTML, SVG,
    // XML, PDF), not just HTML: an author SVG opened top-level would otherwise
    // run its inline <script> same-origin (nosniff does not help — SVG is
    // already a scriptable type).
    if (isScriptableDocumentType(file.contentType)) {
        headers['Content-Security-Policy'] = previewSnapshotCspHeader();
    }
    return new Response(file.bytes as BodyInit, { headers });
}

/** Authless serving route for the opaque preview iframe (capability URL). */
export function createPreviewSnapshotServeRoutes(deps: PreviewSnapshotRouteDeps = buildDefaultDeps()) {
    const serve = (previewId: string, rest: string, request: Request): Response => {
        // Elysia normalizes a trailing slash away in the route match
        // (`/preview-snapshot/{id}/` lands on the bare route with an empty
        // rest), so the bare-root redirect reads it from the real pathname.
        let relPath = rest;
        if (rest === '') {
            relPath = new URL(request.url).pathname.endsWith('/') ? '/' : '';
        }
        return serveSnapshotFile(previewId, relPath, deps.store);
    };

    return new Elysia({ prefix: '/preview-snapshot' })
        .get('/:previewId', ({ params, request }) => serve(params.previewId, '', request))
        .get('/:previewId/*', ({ params, request }) => serve(params.previewId, params['*'] ?? '', request));
}

export const previewSnapshotApiRoutes = createPreviewSnapshotApiRoutes();
export const previewSnapshotServeRoutes = createPreviewSnapshotServeRoutes();
