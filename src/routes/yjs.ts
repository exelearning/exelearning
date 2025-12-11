/**
 * Yjs Document Routes
 * Endpoints for saving and loading Yjs document state
 */
import { Elysia } from 'elysia';
import { findProjectByUuid, upsertSnapshot, findSnapshotByProjectId, markProjectAsSaved } from '../db/queries';
import { db } from '../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

/**
 * Query dependencies for Yjs routes
 */
export interface YjsQueries {
    findProjectByUuid: typeof findProjectByUuid;
    findSnapshotByProjectId: typeof findSnapshotByProjectId;
    upsertSnapshot: typeof upsertSnapshot;
    markProjectAsSaved: typeof markProjectAsSaved;
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
        upsertSnapshot,
        markProjectAsSaved,
    },
};

/**
 * Factory function to create Yjs routes with injected dependencies
 */
export function createYjsRoutes(deps: YjsDependencies = defaultDependencies) {
    const { db: database, queries } = deps;

    return (
        new Elysia({ prefix: '/api/projects' })

            // GET - Load Yjs document state
            .get('/uuid/:uuid/yjs-document', async ({ params, set }) => {
                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                const snapshot = await queries.findSnapshotByProjectId(database, project.id);
                if (!snapshot) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'No document saved' };
                }

                set.headers['Content-Type'] = 'application/octet-stream';
                return snapshot.snapshot_data;
            })

            // POST - Save Yjs document state
            .post('/uuid/:uuid/yjs-document', async ({ params, body, set }) => {
                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                // body is ArrayBuffer from binary request
                const binaryData = new Uint8Array(body as ArrayBuffer);
                const version = Date.now().toString();

                await queries.upsertSnapshot(database, project.id, binaryData, version);

                // Mark project as saved so it appears in the project list
                await queries.markProjectAsSaved(database, project.id);

                return { success: true, message: 'Document saved', version };
            })
    );
}

/**
 * Yjs routes with default (real) dependencies
 */
export const yjsRoutes = createYjsRoutes();
