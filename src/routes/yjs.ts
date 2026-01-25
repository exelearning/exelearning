/**
 * Yjs Document Routes
 * Endpoints for saving and loading Yjs document state
 */
import { Elysia } from 'elysia';
import {
    findProjectByUuid,
    upsertSnapshot,
    findSnapshotByProjectId,
    updateProjectTitle,
    updateProjectTitleAndSave,
} from '../db/queries';
import { fromBinaryData } from '../db/helpers';
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
    updateProjectTitle: typeof updateProjectTitle;
    updateProjectTitleAndSave: typeof updateProjectTitleAndSave;
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
        updateProjectTitle,
        updateProjectTitleAndSave,
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
            .get('/uuid/:uuid/yjs-document', async ({ params }) => {
                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    console.log(`[Yjs GET] Project not found: ${params.uuid}`);
                    return new Response(JSON.stringify({ error: 'Not Found', message: 'Project not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                const snapshot = await queries.findSnapshotByProjectId(database, project.id);
                if (!snapshot) {
                    console.log(`[Yjs GET] No snapshot for project ${project.id} (uuid: ${params.uuid})`);
                    return new Response(JSON.stringify({ error: 'Not Found', message: 'No document saved' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }

                // Convert database data to Uint8Array
                // MySQL with Bun.SQL stores as base64, SQLite/PostgreSQL as binary
                const binaryData = fromBinaryData(snapshot.snapshot_data);

                // Return raw binary response - using Response object ensures proper binary handling
                return new Response(binaryData, {
                    status: 200,
                    headers: { 'Content-Type': 'application/octet-stream' },
                });
            })

            // POST - Save Yjs document state
            // Use ?markSaved=true to also mark the project as saved (for explicit user save)
            // Without this parameter, only persists data (for auto-save on page unload)
            .post('/uuid/:uuid/yjs-document', async ({ params, body, set, query, headers }) => {
                const project = await queries.findProjectByUuid(database, params.uuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                // body is ArrayBuffer from binary request
                const binaryData = new Uint8Array(body as ArrayBuffer);
                const version = Date.now().toString();

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

                await queries.upsertSnapshot(database, project.id, binaryData, version);

                // Only mark as saved if explicitly requested (user clicked Save)
                // Auto-persistence (beforeunload) should NOT mark as saved
                const markSaved = query.markSaved === 'true';
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
