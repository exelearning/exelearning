/**
 * Yjs debug helpers.
 *
 * Small authenticated endpoints under `/api/yjs/debug/*` that make it easy to
 * inspect the WebSocket state of a project during development without leaking
 * information about other users or other projects.
 *
 * Access rules mirror the WebSocket itself: project owner, an explicit
 * collaborator, or any admin.
 */
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import {
    findProjectByUuid as findProjectByUuidDefault,
    findSnapshotByProjectId as findSnapshotByProjectIdDefault,
    checkProjectAccess as checkProjectAccessDefault,
} from '../db/queries';
import { db as defaultDb } from '../db/client';
import { getJwtSecret } from './auth';
import { withJwtAuth } from '../utils/route-auth';
import { hasRole, ROLES, requireAuth } from '../utils/guards';
import * as roomManager from '../websocket/room-manager';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';

export interface YjsDebugQueries {
    findProjectByUuid: typeof findProjectByUuidDefault;
    findSnapshotByProjectId: typeof findSnapshotByProjectIdDefault;
    checkProjectAccess: typeof checkProjectAccessDefault;
}

export interface YjsDebugDependencies {
    db: Kysely<Database>;
    queries: YjsDebugQueries;
    getRoom: typeof roomManager.getRoom;
    getConnectionsByUserId: typeof roomManager.getConnectionsByUserId;
}

const defaultDependencies: YjsDebugDependencies = {
    db: defaultDb,
    queries: {
        findProjectByUuid: findProjectByUuidDefault,
        findSnapshotByProjectId: findSnapshotByProjectIdDefault,
        checkProjectAccess: checkProjectAccessDefault,
    },
    getRoom: roomManager.getRoom,
    getConnectionsByUserId: roomManager.getConnectionsByUserId,
};

const DEBUG_TOKEN_TTL_SECONDS = 5 * 60;

export function createYjsDebugRoutes(deps: YjsDebugDependencies = defaultDependencies) {
    const { db: database, queries } = deps;

    return (
        new Elysia({ name: 'yjs-debug-routes', prefix: '/api/yjs/debug' })
            .use(withJwtAuth())

            // GET /api/yjs/debug/:projectUuid
            .get('/:projectUuid', async ({ params, identity, set }) => {
                const authErr = requireAuth(identity);
                if (authErr) {
                    set.status = authErr.status;
                    return { error: authErr.error, message: authErr.message };
                }

                const project = await queries.findProjectByUuid(database, params.projectUuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                const userId = identity!.userId;
                const isAdmin = hasRole(identity!.roles, ROLES.ADMIN);
                if (!isAdmin) {
                    const access = await queries.checkProjectAccess(database, project, userId);
                    if (!access.hasAccess) {
                        set.status = 403;
                        return { error: 'Forbidden', message: 'Access denied' };
                    }
                }

                const docName = `project-${params.projectUuid}`;
                const room = deps.getRoom(docName);
                const myConnections = deps.getConnectionsByUserId(docName, userId).length;

                const snapshot = await queries.findSnapshotByProjectId(database, project.id);
                const snapshotSize =
                    snapshot?.snapshot_data instanceof Uint8Array
                        ? snapshot.snapshot_data.byteLength
                        : typeof snapshot?.snapshot_data === 'string'
                          ? (snapshot.snapshot_data as string).length
                          : 0;

                return {
                    projectUuid: params.projectUuid,
                    roomExists: !!room,
                    connections: room ? room.conns.size : 0,
                    myConnections,
                    snapshotSize,
                    lastVersion: snapshot?.snapshot_version ?? null,
                };
            })

            // GET /api/yjs/debug/:projectUuid/ws-url
            // Returns a ws:// URL with a short-lived token to connect from a
            // browser console or curl-equivalent during development.
            .get('/:projectUuid/ws-url', async ({ params, identity, set, request }) => {
                const authErr = requireAuth(identity);
                if (authErr) {
                    set.status = authErr.status;
                    return { error: authErr.error, message: authErr.message };
                }

                const project = await queries.findProjectByUuid(database, params.projectUuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                const userId = identity!.userId;
                const isAdmin = hasRole(identity!.roles, ROLES.ADMIN);
                if (!isAdmin) {
                    const access = await queries.checkProjectAccess(database, project, userId);
                    if (!access.hasAccess) {
                        set.status = 403;
                        return { error: 'Forbidden', message: 'Access denied' };
                    }
                }

                // Sign a short-lived token reusing the application JWT secret.
                const secret = new TextEncoder().encode(getJwtSecret());
                const shortToken = await new SignJWT({
                    sub: String(userId),
                    email: identity!.email,
                    roles: identity!.roles,
                    isGuest: false,
                    authMethod: 'local',
                    debug: true,
                })
                    .setProtectedHeader({ alg: 'HS256' })
                    .setIssuedAt()
                    .setExpirationTime(`${DEBUG_TOKEN_TTL_SECONDS}s`)
                    .sign(secret);

                const url = new URL(request.url);
                const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${wsProto}//${url.host}/yjs/project-${params.projectUuid}?token=${shortToken}`;

                return {
                    wsUrl,
                    expiresInSeconds: DEBUG_TOKEN_TTL_SECONDS,
                };
            })
    );
}

export const yjsDebugRoutes = createYjsDebugRoutes();
