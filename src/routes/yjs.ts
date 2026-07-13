/**
 * Yjs Document Routes
 * Endpoints for saving and loading Yjs document state
 */
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import {
    findProjectByUuid,
    upsertSnapshot,
    findSnapshotByProjectId,
    loadDocumentWithUpdates,
    updateProjectTitle,
    updateProjectTitleAndSave,
    checkProjectAccess,
    listVersionHistory,
} from '../db/queries';
import { fromBinaryData } from '../db/helpers';
import { db } from '../db/client';
import { getJwtSecret, type JwtPayload } from './auth';
import { hasRole, requireAdmin, ROLES } from '../utils/guards';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { getYjsVersionHistoryLimit } from '../config/yjs-version-history';
import { restoreVersionSnapshot, saveSnapshotWithHistory } from '../db/queries/yjs-history';

/**
 * Query dependencies for Yjs routes
 */
export interface YjsQueries {
    findProjectByUuid: typeof findProjectByUuid;
    findSnapshotByProjectId: typeof findSnapshotByProjectId;
    loadDocumentWithUpdates: typeof loadDocumentWithUpdates;
    upsertSnapshot: typeof upsertSnapshot;
    updateProjectTitle: typeof updateProjectTitle;
    updateProjectTitleAndSave: typeof updateProjectTitleAndSave;
    checkProjectAccess: typeof checkProjectAccess;
}

/**
 * Optional version-history dependencies. Production always provides these;
 * tests may omit them when exercising only the core document routes.
 */
export interface YjsHistoryDependencies {
    saveSnapshotWithHistory: typeof saveSnapshotWithHistory;
    listVersionHistory: typeof listVersionHistory;
    restoreVersionSnapshot: typeof restoreVersionSnapshot;
    getHistoryLimit: typeof getYjsVersionHistoryLimit;
}

/**
 * Dependencies for Yjs routes
 */
export interface YjsDependencies {
    db: Kysely<Database>;
    queries: YjsQueries;
    history?: YjsHistoryDependencies;
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
        updateProjectTitle,
        updateProjectTitleAndSave,
        checkProjectAccess,
    },
    history: {
        saveSnapshotWithHistory,
        listVersionHistory,
        restoreVersionSnapshot,
        getHistoryLimit: getYjsVersionHistoryLimit,
    },
};

/**
 * Factory function to create Yjs routes with injected dependencies
 */
export function createYjsRoutes(deps: YjsDependencies = defaultDependencies) {
    const { db: database, queries, history } = deps;

    return (
        new Elysia({ prefix: '/api/projects' })
            .use(cookie())
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

                // Fast path: a snapshot with no newer updates is returned as-is
                // (avoids decoding the Y.Doc on the common browser-save case).
                if (snapshot && updates.length === 0) {
                    return new Response(fromBinaryData(snapshot.snapshot_data), {
                        status: 200,
                        headers: { 'Content-Type': 'application/octet-stream' },
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
                    headers: { 'Content-Type': 'application/octet-stream' },
                });
            })

            // GET - List Yjs version history (administrators only)
            .get('/uuid/:uuid/yjs-history', async ({ params, jwtPayload, set }) => {
                const authorizationError = requireAdmin(jwtPayload);
                if (authorizationError) {
                    set.status = authorizationError.status;
                    return authorizationError;
                }
                if (!history) {
                    set.status = 503;
                    return { error: 'SERVICE_UNAVAILABLE', message: 'Yjs version history is unavailable' };
                }

                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'Project not found' };
                }

                const versions = await history.listVersionHistory(database, project.id);
                return {
                    success: true,
                    historyLimit: history.getHistoryLimit(),
                    versions: versions.map(version => {
                        const { snapshot_data: snapshotData, ...metadata } = version;
                        return { ...metadata, size: snapshotData.byteLength };
                    }),
                };
            })

            // POST - Restore a Yjs version (administrators only)
            .post('/uuid/:uuid/yjs-history/:versionId/restore', async ({ params, jwtPayload, set }) => {
                const authorizationError = requireAdmin(jwtPayload);
                if (authorizationError) {
                    set.status = authorizationError.status;
                    return authorizationError;
                }
                if (!history) {
                    set.status = 503;
                    return { error: 'SERVICE_UNAVAILABLE', message: 'Yjs version history is unavailable' };
                }

                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'Project not found' };
                }

                const versionId = Number(params.versionId);
                if (!Number.isSafeInteger(versionId) || versionId <= 0) {
                    set.status = 400;
                    return { error: 'BAD_REQUEST', message: 'Invalid version ID' };
                }

                const restored = await history.restoreVersionSnapshot(database, {
                    projectId: project.id,
                    versionId,
                    historyLimit: history.getHistoryLimit(),
                    createdBy: Number(jwtPayload!.sub),
                });
                if (!restored) {
                    set.status = 404;
                    return { error: 'NOT_FOUND', message: 'Version not found' };
                }

                return {
                    success: true,
                    message: 'Version restored',
                    version: restored.snapshot_version,
                };
            })

            // POST - Save Yjs document state
            // Use ?markSaved=true to also mark the project as saved (for explicit user save)
            // Without this parameter, only persists data (for auto-save on page unload)
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
                const binaryData = new Uint8Array(body as ArrayBuffer);
                const version = Date.now().toString();
                const markSaved = query.markSaved === 'true';

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

                if (markSaved && history) {
                    await history.saveSnapshotWithHistory(database, {
                        projectId: project.id,
                        snapshotData: binaryData,
                        snapshotVersion: version,
                        historyLimit: history.getHistoryLimit(),
                        createdBy: userId,
                        description: 'Previous snapshot before explicit save',
                    });
                } else {
                    await queries.upsertSnapshot(database, project.id, binaryData, version);
                }

                // Only mark as saved if explicitly requested (user clicked Save)
                // Auto-persistence (beforeunload) should NOT mark as saved
                if (markSaved) {
                    await queries.updateProjectTitleAndSave(database, project.id, title);
                } else {
                    await queries.updateProjectTitle(database, project.id, title);
                }

                return { success: true, message: 'Document saved', version, markedAsSaved: markSaved };
            })
    );
}

/**
 * Yjs routes with default (real) dependencies
 */
export const yjsRoutes = createYjsRoutes();
