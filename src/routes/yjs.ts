/**
 * Yjs Document Routes
 * Endpoints for saving and loading Yjs document state
 */
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import {
    findProjectByUuid,
    upsertSnapshot,
    replaceSnapshotIfVersion,
    findSnapshotByProjectId,
    loadDocumentWithUpdates,
    updateProjectTitle,
    updateProjectTitleAndSave,
    checkProjectAccess,
} from '../db/queries';
import { fromBinaryData } from '../db/helpers';
import { db } from '../db/client';
import { getJwtSecret, type JwtPayload } from './auth';
import { hasRole, ROLES } from '../utils/guards';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

/**
 * Query dependencies for Yjs routes
 */
export interface YjsQueries {
    findProjectByUuid: typeof findProjectByUuid;
    findSnapshotByProjectId: typeof findSnapshotByProjectId;
    loadDocumentWithUpdates: typeof loadDocumentWithUpdates;
    upsertSnapshot: typeof upsertSnapshot;
    replaceSnapshotIfVersion: typeof replaceSnapshotIfVersion;
    updateProjectTitle: typeof updateProjectTitle;
    updateProjectTitleAndSave: typeof updateProjectTitleAndSave;
    checkProjectAccess: typeof checkProjectAccess;
}

/**
 * Dependencies for Yjs routes
 */
export interface YjsDependencies {
    db: Kysely<Database>;
    queries: YjsQueries;
}

/**
 * Default dependencies using real implementations
 */
const defaultDependencies: YjsDependencies = {
    db,
    queries: {
        findProjectByUuid,
        findSnapshotByProjectId,
        loadDocumentWithUpdates,
        upsertSnapshot,
        replaceSnapshotIfVersion,
        updateProjectTitle,
        updateProjectTitleAndSave,
        checkProjectAccess,
    },
};

/** Response/request header carrying the stored document version (#2615). */
export const DOCUMENT_VERSION_HEADER = 'X-Document-Version';
export const BASE_VERSION_HEADER = 'X-Base-Version';
/** Compare-and-set attempts before the save falls back to a merged replace. */
const MAX_SAVE_ATTEMPTS = 3;

type StoredDocument = Awaited<ReturnType<typeof loadDocumentWithUpdates>>;

/**
 * The version a client must echo back as `X-Base-Version`: the snapshot version
 * or, when newer incremental updates exist (REST API v1 writes), the latest of
 * those. Mirrors `getDocumentVersion()` but works from rows already loaded.
 */
function currentVersionOf(stored: StoredDocument): string | null {
    const snapshotVersion = stored.snapshot ? Number.parseInt(stored.snapshot.snapshot_version, 10) || 0 : 0;
    const updateVersion = stored.updates.reduce((max, u) => Math.max(max, Number.parseInt(u.version, 10) || 0), 0);
    const version = Math.max(snapshotVersion, updateVersion);
    return version > 0 ? String(version) : null;
}

/** Decode the stored rows into one Y.Doc state (snapshot + newer updates). */
async function mergeStoredState(stored: StoredDocument): Promise<Uint8Array | null> {
    if (!stored.snapshot && stored.updates.length === 0) return null;
    if (stored.snapshot && stored.updates.length === 0) return fromBinaryData(stored.snapshot.snapshot_data);
    const Y = await import('yjs');
    const ydoc = new Y.Doc();
    if (stored.snapshot) Y.applyUpdate(ydoc, fromBinaryData(stored.snapshot.snapshot_data));
    for (const update of stored.updates) Y.applyUpdate(ydoc, fromBinaryData(update.update_data));
    const state = Y.encodeStateAsUpdate(ydoc);
    ydoc.destroy();
    return state;
}

/**
 * Merge an incoming full state on top of the stored state (#2615). Yjs merges
 * are idempotent and commutative, so a client that saved from an older base
 * can never erase what another client stored meanwhile: both sets of edits
 * survive, and deletions keep winning through their tombstones.
 */
async function mergeIncoming(stored: Uint8Array, incoming: Uint8Array): Promise<Uint8Array> {
    const Y = await import('yjs');
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, stored);
    Y.applyUpdate(ydoc, incoming);
    const state = Y.encodeStateAsUpdate(ydoc);
    ydoc.destroy();
    return state;
}

/**
 * Factory function to create Yjs routes with injected dependencies
 */
export function createYjsRoutes(deps: YjsDependencies = defaultDependencies) {
    const { db: database, queries } = deps;

    return (
        new Elysia({ prefix: '/api/projects' })
            .use(
                jwt({
                    name: 'jwt',
                    secret: getJwtSecret(),
                    exp: '7d',
                }),
            )
            .derive(async ({ jwt: jwtPlugin, cookie, request }) => {
                let token: string | undefined;
                const authHeader = request.headers.get('authorization');
                if (authHeader?.startsWith('Bearer ')) {
                    token = authHeader.slice(7);
                } else if (cookie.auth?.value) {
                    token = cookie.auth.value;
                }
                if (!token) {
                    return { jwtPayload: null as JwtPayload | null };
                }
                try {
                    const payload = (await jwtPlugin.verify(token)) as JwtPayload | false;
                    return { jwtPayload: (payload || null) as JwtPayload | null };
                } catch {
                    return { jwtPayload: null as JwtPayload | null };
                }
            })

            // GET - Load Yjs document state
            .get('/uuid/:uuid/yjs-document', async ({ params, jwtPayload }) => {
                if (!jwtPayload?.sub) {
                    return new Response(JSON.stringify({ error: 'Unauthorized', message: 'Authentication required' }), {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    return new Response(JSON.stringify({ error: 'Not Found', message: 'Project not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                const userId = Number(jwtPayload.sub);
                const isAdmin = hasRole(jwtPayload.roles, ROLES.ADMIN);
                if (!isAdmin) {
                    const access = await queries.checkProjectAccess(database, project, userId);
                    if (!access.hasAccess) {
                        return new Response(JSON.stringify({ error: 'Forbidden', message: 'Access denied' }), {
                            status: 403,
                            headers: { 'Content-Type': 'application/json' },
                        });
                    }
                }

                // Read the canonical snapshot AND any incremental updates. The
                // previous code returned only the snapshot, so a project whose
                // server-side state lives in yjs_updates (e.g. edited via REST
                // API v1) loaded as empty / 404 even though content existed (H5).
                const { snapshot, updates } = await queries.loadDocumentWithUpdates(database, project.id);
                if (!snapshot && updates.length === 0) {
                    return new Response(JSON.stringify({ error: 'Not Found', message: 'No document saved' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                // The client echoes this back as X-Base-Version on save so the
                // server can tell a stale save from a current one (#2615).
                const versionHeader = currentVersionOf({ snapshot, updates }) ?? '0';

                // Fast path: a snapshot with no newer updates is returned as-is
                // (avoids decoding the Y.Doc on the common browser-save case).
                if (snapshot && updates.length === 0) {
                    return new Response(fromBinaryData(snapshot.snapshot_data), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/octet-stream',
                            [DOCUMENT_VERSION_HEADER]: versionHeader,
                        },
                    });
                }

                // Otherwise merge snapshot + updates into a single state vector.
                const Y = await import('yjs');
                const ydoc = new Y.Doc();
                if (snapshot) {
                    Y.applyUpdate(ydoc, fromBinaryData(snapshot.snapshot_data));
                }
                for (const update of updates) {
                    Y.applyUpdate(ydoc, fromBinaryData(update.update_data));
                }
                const mergedState = Y.encodeStateAsUpdate(ydoc);
                ydoc.destroy();

                return new Response(mergedState, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        [DOCUMENT_VERSION_HEADER]: versionHeader,
                    },
                });
            })

            // POST - Save Yjs document state
            // Use ?markSaved=true to also mark the project as saved (for explicit user save)
            // Without this parameter, only persists data (for auto-save on page unload)
            //
            // Save validation (#2615): the client sends X-Base-Version, the
            // version it last loaded/saved. When it matches the stored version
            // the snapshot is replaced as-is (fast path, no decoding). When it
            // does not match, or is absent (older bundles, sendBeacon), the
            // incoming state is MERGED on top of the stored one, so a client
            // that was offline while others saved can never overwrite them.
            // The write is a compare-and-set on the stored version, retried on
            // a concurrent save.
            .post('/uuid/:uuid/yjs-document', async ({ params, body, set, query, headers, jwtPayload }) => {
                if (!jwtPayload?.sub) {
                    set.status = 401;
                    return { error: 'Unauthorized', message: 'Authentication required' };
                }

                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                // Access rules match the WebSocket and the project access
                // model: owner, collaborator, or admin always have access; on
                // projects marked `visibility: 'public'`, any authenticated
                // user may also edit (wiki-style semantics).
                const userId = Number(jwtPayload.sub);
                const isAdmin = hasRole(jwtPayload.roles, ROLES.ADMIN);
                if (!isAdmin) {
                    const access = await queries.checkProjectAccess(database, project, userId);
                    if (!access.hasAccess) {
                        set.status = 403;
                        return { error: 'Forbidden', message: 'Access denied' };
                    }
                }

                // body is ArrayBuffer from binary request
                const incoming = new Uint8Array(body as ArrayBuffer);
                const baseVersion = headers['x-base-version'] ?? null;
                let version = Date.now().toString();
                let merged = false;
                let stored = false;

                for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS && !stored; attempt++) {
                    const current = await queries.loadDocumentWithUpdates(database, project.id);
                    const currentVersion = currentVersionOf(current);
                    const currentState = await mergeStoredState(current);
                    version = Date.now().toString();

                    if (!currentState || currentVersion === null) {
                        // Nothing stored yet: first save of the project.
                        await queries.upsertSnapshot(database, project.id, incoming, version);
                        stored = true;
                        break;
                    }

                    const isCurrent = baseVersion !== null && baseVersion === currentVersion;
                    const data = isCurrent ? incoming : await mergeIncoming(currentState, incoming);
                    merged = merged || !isCurrent;

                    if (!current.snapshot) {
                        // Updates-only document (REST API v1): no row to compare against.
                        await queries.upsertSnapshot(database, project.id, data, version);
                        stored = true;
                        break;
                    }

                    stored = await queries.replaceSnapshotIfVersion(
                        database,
                        project.id,
                        data,
                        version,
                        current.snapshot.snapshot_version,
                    );
                }

                if (!stored) {
                    // Three concurrent saves landed in between: merge once more
                    // against whatever is stored now and replace unconditionally.
                    const current = await queries.loadDocumentWithUpdates(database, project.id);
                    const currentState = await mergeStoredState(current);
                    version = Date.now().toString();
                    const data = currentState ? await mergeIncoming(currentState, incoming) : incoming;
                    merged = merged || currentState !== null;
                    await queries.upsertSnapshot(database, project.id, data, version);
                }

                // Get title from X-Project-Title header (sent by client to avoid server decoding Yjs)
                // This is a major performance optimization: avoids Y.applyUpdate() which can take
                // 500-2000ms for large documents (5-10MB)
                let title = project.title;
                const headerTitle = headers['x-project-title'];
                if (headerTitle) {
                    try {
                        const decodedTitle = decodeURIComponent(headerTitle);
                        if (decodedTitle.trim()) {
                            title = decodedTitle.trim();
                        }
                    } catch {
                        // If decoding fails, keep the existing project title
                    }
                }

                // Only mark as saved if explicitly requested (user clicked Save)
                // Auto-persistence (beforeunload) should NOT mark as saved
                const markSaved = query.markSaved === 'true';
                if (markSaved) {
                    await queries.updateProjectTitleAndSave(database, project.id, title);
                } else {
                    await queries.updateProjectTitle(database, project.id, title);
                }

                return { success: true, message: 'Document saved', version, markedAsSaved: markSaved, merged };
            })
    );
}

/**
 * Yjs routes with default (real) dependencies
 */
export const yjsRoutes = createYjsRoutes();
