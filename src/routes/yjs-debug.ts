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
import { jwt } from '@elysiajs/jwt';
import { SignJWT } from 'jose';
import {
    findProjectByUuid as findProjectByUuidDefault,
    findSnapshotByProjectId as findSnapshotByProjectIdDefault,
    checkProjectAccess as checkProjectAccessDefault,
} from '../db/queries';
import { db as defaultDb } from '../db/client';
import { getJwtSecret, type JwtPayload } from './auth';
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

            // GET /api/yjs/debug/:projectUuid
            .get('/:projectUuid', async ({ params, jwtPayload, set }) => {
                const authErr = requireAuth(jwtPayload);
                if (authErr) {
                    set.status = authErr.status;
                    return { error: authErr.error, message: authErr.message };
                }

                const project = await queries.findProjectByUuid(database, params.projectUuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                const userId = Number(jwtPayload!.sub);
                const isAdmin = hasRole(jwtPayload!.roles, ROLES.ADMIN);
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
                    lastVersion: snapshot?.version ?? null,
                };
            })

            // GET /api/yjs/debug/:projectUuid/ws-url
            // Returns a ws:// URL with a short-lived token to connect from a
            // browser console or curl-equivalent during development.
            .get('/:projectUuid/ws-url', async ({ params, jwtPayload, set, request }) => {
                const authErr = requireAuth(jwtPayload);
                if (authErr) {
                    set.status = authErr.status;
                    return { error: authErr.error, message: authErr.message };
                }

                const project = await queries.findProjectByUuid(database, params.projectUuid);
                if (!project) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Project not found' };
                }

                const userId = Number(jwtPayload!.sub);
                const isAdmin = hasRole(jwtPayload!.roles, ROLES.ADMIN);
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
                    sub: userId,
                    email: jwtPayload!.email,
                    roles: jwtPayload!.roles,
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
