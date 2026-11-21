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
import { hasRole, ROLES, requireAdmin, requireAuth } from '../utils/guards';
import { withJwtAuth } from '../utils/route-auth';
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
            .use(withJwtAuth())

            // Public liveness probe. Intentionally minimal: no counts, no project IDs.
            .get('/api/websocket/health', () => ({ ok: true }))

            // Admin-only: full server-wide info.
            .get('/api/websocket/info', ({ identity, set }) => {
                const err = requireAdmin(identity);
                if (err) {
                    set.status = err.status;
                    return { error: err.error, message: err.message };
                }
                return deps.getServerInfo();
            })

            // Admin-only: list of all active rooms.
            .get('/api/websocket/rooms', ({ identity, set }) => {
                const err = requireAdmin(identity);
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
            .get('/api/websocket/my-rooms', ({ identity, set }) => {
                const err = requireAuth(identity);
                if (err) {
                    set.status = err.status;
                    return { error: err.error, message: err.message };
                }
                const userId = identity!.userId;
                const isAdmin = hasRole(identity!.roles, ROLES.ADMIN);
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
