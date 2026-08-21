/**
 * WebSocket info / introspection routes
 *
 * These endpoints used to be unauthenticated and returned the full list of
 * active project rooms and aggregate server stats. They are now gated so that:
 *
 *   - `/api/websocket/health` is the only fully public endpoint and returns
 *     a minimal liveness signal (no counts, no project identifiers).
 *   - `/api/websocket/my-rooms` requires authentication and lists only the
 *     rooms the current user is connected to.
 *   - `/api/websocket/info` and `/api/websocket/rooms` require ROLE_ADMIN and
 *     expose the full server-wide view.
 */
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { getJwtSecret, type JwtPayload } from './auth';
import { hasRole, ROLES, requireAdmin, requireAuth } from '../utils/guards';
import { getServerInfo, getActiveRooms } from '../websocket/yjs-websocket';
import * as roomManager from '../websocket/room-manager';

/**
 * Dependencies for testability.
 */
export interface WebSocketInfoDependencies {
    getServerInfo: typeof getServerInfo;
    getActiveRooms: typeof getActiveRooms;
    getRoomStats: typeof roomManager.getRoomStats;
    getConnectionsByUserId: typeof roomManager.getConnectionsByUserId;
}

const defaultDependencies: WebSocketInfoDependencies = {
    getServerInfo,
    getActiveRooms,
    getRoomStats: roomManager.getRoomStats,
    getConnectionsByUserId: roomManager.getConnectionsByUserId,
};

export function createWebSocketInfoRoutes(deps: WebSocketInfoDependencies = defaultDependencies) {
    return (
        new Elysia({ name: 'websocket-info-routes' })
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

            // Public liveness probe. Intentionally minimal: no counts, no project IDs.
            .get('/api/websocket/health', () => ({ ok: true }))

            // Admin-only: full server-wide info.
            .get('/api/websocket/info', ({ jwtPayload, set }) => {
                const err = requireAdmin(jwtPayload);
                if (err) {
                    set.status = err.status;
                    return { error: err.error, message: err.message };
                }
                return deps.getServerInfo();
            })

            // Admin-only: list of all active rooms.
            .get('/api/websocket/rooms', ({ jwtPayload, set }) => {
                const err = requireAdmin(jwtPayload);
                if (err) {
                    set.status = err.status;
                    return { error: err.error, message: err.message };
                }
                const stats = deps.getRoomStats();
                return {
                    rooms: stats.rooms,
                    totalRooms: stats.totalRooms,
                    totalConnections: stats.totalConnections,
                };
            })

            // Authenticated, per-user: only rooms where the caller is connected.
            // Does not leak connection counts of other users or other rooms.
            .get('/api/websocket/my-rooms', ({ jwtPayload, set }) => {
                const err = requireAuth(jwtPayload);
                if (err) {
                    set.status = err.status;
                    return { error: err.error, message: err.message };
                }
                const userId = Number(jwtPayload!.sub);
                const isAdmin = hasRole(jwtPayload!.roles, ROLES.ADMIN);
                const stats = deps.getRoomStats();
                const rooms: Array<{ projectUuid: string; myConnections: number }> = [];
                for (const room of stats.rooms) {
                    const myConns = deps.getConnectionsByUserId(room.name, userId).length;
                    if (myConns > 0 || isAdmin) {
                        rooms.push({ projectUuid: room.projectUuid, myConnections: myConns });
                    }
                }
                return { rooms };
            })
    );
}

export const webSocketInfoRoutes = createWebSocketInfoRoutes();
