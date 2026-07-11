/**
 * Editor preview session routes (serving contract v2 —
 * doc/development/preview-serving-contract.md).
 *
 * Two deliberately separate plugins:
 *
 * - `previewSessionApiRoutes` (`/api/preview-session`, JWT-authenticated):
 *   create sessions, upload assets, publish revisions, delete. Only the
 *   session owner may touch it. Internal editor API — not part of `/api/v1`.
 *
 * - `previewServeRoutes` (`/preview/:previewId/*`, NO auth): serves the
 *   session's three layers to the opaque-origin preview iframe. An opaque
 *   iframe sends no SameSite cookies, so this is a capability URL (unguessable
 *   UUID + idle TTL), mirroring the authless `/files/tmp/*` precedent. Every
 *   response carries the hardening headers; scriptable types additionally get
 *   the `sandbox`-first CSP so a directly opened preview URL stays opaque.
 *
 * Protocol semantics live in `src/services/preview-serving.ts`, shared with
 * the Electron `app://` adapter so the two transports cannot drift.
 */
import { Elysia } from 'elysia';
import * as previewSessionManager from '../services/preview-session-manager';
import {
    createSessionResponse,
    defaultFixedResources,
    handleAssetsUpload,
    handleRevisionUpload,
    servePreviewFile,
} from '../services/preview-serving';
import { requireAuth } from '../utils/guards';
import { withJwtAuth } from '../utils/route-auth';

export { PROTOCOL_VERSION, RECOMMENDED_BATCH_BYTES } from '../services/preview-serving';

export interface PreviewSessionRouteDeps {
    manager: typeof previewSessionManager;
    fixedResources: previewSessionManager.FixedResourceResolver;
}

function buildDefaultDeps(): PreviewSessionRouteDeps {
    return { manager: previewSessionManager, fixedResources: defaultFixedResources() };
}

interface AssetsBody {
    /** JSON string in the raw form encoding; Elysia may pre-parse it to an array. */
    assets?: unknown;
    files?: Blob | Blob[];
}

interface RevisionBody {
    /** JSON string in the raw form encoding; Elysia may pre-parse it to an object. */
    revision?: unknown;
    files?: Blob | Blob[];
}

function toBlobArray(files: Blob | Blob[] | undefined): Blob[] {
    return files ? (Array.isArray(files) ? files : [files]) : [];
}

/** Authenticated management API: create, sync and delete preview sessions. */
export function createPreviewSessionApiRoutes(deps: PreviewSessionRouteDeps = buildDefaultDeps()) {
    const { manager, fixedResources } = deps;

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
            const result = createSessionResponse(manager, Number(jwtPayload!.sub));
            set.status = result.status;
            return result.body;
        })
        .post('/:previewId/assets', async ({ params, body, jwtPayload, set }) => {
            const owned = manager.getOwnedSession(params.previewId, Number(jwtPayload!.sub));
            if ('status' in owned) {
                set.status = owned.status;
                return { success: false, error: owned.status === 403 ? 'Access denied' : 'Preview session not found' };
            }
            const data = (body ?? {}) as AssetsBody;
            const result = await handleAssetsUpload(owned.session, data.assets, toBlobArray(data.files), manager);
            set.status = result.status;
            return result.body;
        })
        .post('/:previewId/revisions', async ({ params, body, jwtPayload, set }) => {
            const owned = manager.getOwnedSession(params.previewId, Number(jwtPayload!.sub));
            if ('status' in owned) {
                set.status = owned.status;
                return { success: false, error: owned.status === 403 ? 'Access denied' : 'Preview session not found' };
            }
            const data = (body ?? {}) as RevisionBody;
            const result = await handleRevisionUpload(
                owned.session,
                data.revision,
                toBlobArray(data.files),
                manager,
                fixedResources,
            );
            set.status = result.status;
            return result.body;
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

/** Authless serving route for the opaque preview iframe (capability URL). */
export function createPreviewServeRoutes(deps: PreviewSessionRouteDeps = buildDefaultDeps()) {
    const serve = (previewId: string, relPath: string, request: Request): Response =>
        servePreviewFile(
            previewId,
            relPath,
            {
                ifNoneMatch: request.headers.get('if-none-match'),
                range: request.headers.get('range'),
            },
            deps,
        );

    return new Elysia({ prefix: '/preview' })
        .get('/:previewId', ({ params, request }) => serve(params.previewId, '', request))
        .get('/:previewId/*', ({ params, request }) => serve(params.previewId, params['*'] ?? '', request));
}

// The "preview host" wrapper page for opening a preview in a new tab is a plain
// same-origin static asset — public/app/common/preview-tab/preview-tab.html —
// served VERBATIM at /preview-tab.html by an explicit route in src/index.ts (the
// Bun dev server would otherwise claim and rewrite its classic bridge scripts)
// and copied to the distribution root by static/PWA builds. It frames the opaque
// content in a sandboxed iframe and runs the embed relay so external video plays
// in the new tab (a top-level opaque document has no parent, so the shim
// self-disables and the media is blocked).

export const previewSessionApiRoutes = createPreviewSessionApiRoutes();
export const previewServeRoutes = createPreviewServeRoutes();
