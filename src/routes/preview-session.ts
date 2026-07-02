/**
 * Editor preview session routes.
 *
 * Two deliberately separate plugins:
 *
 * - `previewSessionApiRoutes` (`/api/preview-session`, JWT-authenticated):
 *   create / sync (manifest-diff) / delete preview sessions. Only the session
 *   owner may touch it. Internal editor API — not part of `/api/v1`.
 *
 * - `previewServeRoutes` (`/preview/:previewId/*`, NO auth): serves the synced
 *   files to the opaque-origin preview iframe. An opaque iframe sends no
 *   SameSite cookies, so this is a capability URL (unguessable UUID + idle
 *   TTL), mirroring the authless `/files/tmp/*` precedent. Every response
 *   carries the hardening headers; HTML additionally gets the `sandbox`-first
 *   CSP so a directly opened preview URL stays opaque (paper R3).
 */
import { Elysia } from 'elysia';
import * as previewSessionManager from '../services/preview-session-manager';
import { previewCspHeader, previewPermissionsPolicy } from '../shared/security/previewSandbox';
import { requireAuth } from '../utils/guards';
import { withJwtAuth } from '../utils/route-auth';

/**
 * Advertised upper bound for one `/blobs` request. Bun's default request-body
 * cap is 128 MiB and oversized bodies die at the transport layer (connection
 * error, not a clean 413), so clients must batch uploads below it.
 */
export const RECOMMENDED_BATCH_BYTES = 64 * 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PreviewSessionRouteDeps {
    manager: typeof previewSessionManager;
}

const defaultDeps: PreviewSessionRouteDeps = { manager: previewSessionManager };

interface ManifestBody {
    files?: Record<string, { sha256: string; size: number }>;
}

interface BlobsBody {
    manifestId?: string;
    /** JSON string in the raw form encoding; Elysia may pre-parse it to an array. */
    hashes?: string | string[];
    files?: Blob | Blob[];
}

/** Authenticated management API: create, sync and delete preview sessions. */
export function createPreviewSessionApiRoutes(deps: PreviewSessionRouteDeps = defaultDeps) {
    const { manager } = deps;

    return new Elysia({ prefix: '/api/preview-session' })
        .use(withJwtAuth())
        .onBeforeHandle(({ jwtPayload, set }) => {
            const err = requireAuth(jwtPayload);
            if (err) {
                set.status = err.status;
                return err;
            }
        })
        .post('/', ({ jwtPayload, set }) => {
            const { previewId } = manager.createSession(Number(jwtPayload!.sub));
            const limits = manager.getLimits();
            set.status = 201;
            return {
                previewId,
                limits: {
                    maxFilesPerSession: limits.maxFilesPerSession,
                    maxBytesPerSession: limits.maxBytesPerSession,
                    recommendedBatchBytes: RECOMMENDED_BATCH_BYTES,
                },
            };
        })
        .post('/:previewId/manifest', ({ params, body, jwtPayload, set }) => {
            const owned = manager.getOwnedSession(params.previewId, Number(jwtPayload!.sub));
            if ('status' in owned) {
                set.status = owned.status;
                return { success: false, error: owned.status === 403 ? 'Access denied' : 'Preview session not found' };
            }
            const files = (body as ManifestBody | null)?.files;
            if (!files || typeof files !== 'object' || Array.isArray(files)) {
                set.status = 400;
                return { success: false, error: 'Body must be { files: { [path]: { sha256, size } } }' };
            }
            const staged = manager.stageManifest(owned.session, files);
            if ('status' in staged) {
                set.status = staged.status;
                return { success: false, error: staged.message };
            }
            return staged;
        })
        .post('/:previewId/blobs', async ({ params, body, jwtPayload, set }) => {
            const owned = manager.getOwnedSession(params.previewId, Number(jwtPayload!.sub));
            if ('status' in owned) {
                set.status = owned.status;
                return { success: false, error: owned.status === 403 ? 'Access denied' : 'Preview session not found' };
            }

            const data = (body ?? {}) as BlobsBody;
            if (typeof data.manifestId !== 'string' || data.manifestId === '') {
                set.status = 400;
                return { success: false, error: 'Missing manifestId' };
            }
            // The field is sent as a JSON string, but Elysia's multipart parser
            // may deliver it pre-parsed — accept both (same duck-typing as the
            // `metadata` field in upload-session.ts).
            let hashes: unknown = data.hashes;
            if (typeof hashes === 'string') {
                try {
                    hashes = JSON.parse(hashes);
                } catch {
                    set.status = 400;
                    return { success: false, error: 'Invalid hashes JSON' };
                }
            }
            if (!Array.isArray(hashes) || hashes.some(h => typeof h !== 'string')) {
                set.status = 400;
                return { success: false, error: 'hashes must be an array of sha256 strings' };
            }
            const files = data.files ? (Array.isArray(data.files) ? data.files : [data.files]) : [];
            if (files.length !== hashes.length) {
                set.status = 400;
                return { success: false, error: 'hashes and files must be index-aligned' };
            }

            // Enforce the session byte budget on declared Blob sizes BEFORE
            // buffering anything, so an oversized batch never amplifies memory
            // (same two-stage pattern as upload-session.ts).
            const limits = manager.getLimits();
            const remainingBudget = limits.maxBytesPerSession - owned.session.blobBytes;
            let declaredBytes = 0;
            for (const file of files) {
                declaredBytes += file.size;
                if (declaredBytes > remainingBudget) {
                    set.status = 413;
                    return { success: false, error: 'Upload exceeds the preview session byte budget' };
                }
            }

            const blobs: Array<{ declaredSha256: string; bytes: Uint8Array }> = [];
            let bufferedBytes = 0;
            for (let i = 0; i < files.length; i++) {
                const bytes = new Uint8Array(await files[i].arrayBuffer());
                // Abort as soon as the actual buffered total exceeds the declared
                // budget, in case a declared `.size` under-reported.
                bufferedBytes += bytes.length;
                if (bufferedBytes > remainingBudget) {
                    set.status = 413;
                    return { success: false, error: 'Upload exceeds the preview session byte budget' };
                }
                blobs.push({ declaredSha256: hashes[i] as string, bytes });
            }

            const result = await manager.storeBlobs(owned.session, data.manifestId, blobs);
            if ('status' in result) {
                set.status = result.status;
                return { success: false, error: result.message };
            }
            return result;
        })
        .delete('/:previewId', ({ params, jwtPayload, set }) => {
            const owned = manager.getOwnedSession(params.previewId, Number(jwtPayload!.sub));
            if ('status' in owned) {
                set.status = owned.status;
                return { success: false, error: owned.status === 403 ? 'Access denied' : 'Preview session not found' };
            }
            manager.deleteSession(params.previewId);
            return { success: true };
        });
}

/** Headers applied to every serving response, 404s included. */
function baseServeHeaders(): Record<string, string> {
    return {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Cache-Control': 'no-store',
        'Permissions-Policy': previewPermissionsPolicy(),
        // Fonts (@font-face) and module/`fetch()` requests from the opaque
        // frame are CORS-mode with `Origin: null`; the route is authless and
        // cookieless, so a wildcard grants nothing beyond what the capability
        // URL already serves.
        'Access-Control-Allow-Origin': '*',
    };
}

function notFound(): Response {
    return new Response('Not found', {
        status: 404,
        headers: { ...baseServeHeaders(), 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

/** Authless serving route for the opaque preview iframe (capability URL). */
export function createPreviewServeRoutes(deps: PreviewSessionRouteDeps = defaultDeps) {
    const { manager } = deps;

    const serve = (previewId: string, relPath: string): Response => {
        if (!UUID_RE.test(previewId)) return notFound();
        const session = manager.getSessionForServing(previewId);
        if (!session) return notFound();
        const file = manager.getFile(session, relPath);
        if (!file) return notFound();
        const headers: Record<string, string> = { ...baseServeHeaders(), 'Content-Type': file.contentType };
        if (file.isHtml) {
            headers['Content-Security-Policy'] = previewCspHeader();
        }
        return new Response(file.bytes, { headers });
    };

    return new Elysia({ prefix: '/preview' })
        .get('/:previewId', ({ params }) => serve(params.previewId, ''))
        .get('/:previewId/*', ({ params }) => serve(params.previewId, params['*'] ?? ''));
}

export const previewSessionApiRoutes = createPreviewSessionApiRoutes();
export const previewServeRoutes = createPreviewServeRoutes();
