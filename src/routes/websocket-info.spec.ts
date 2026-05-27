/**
 * Tests for /api/websocket/* introspection routes.
 *
 * These endpoints used to be unauthenticated and would leak the full set of
 * active project UUIDs and aggregate server stats. The tests below pin down
 * the new contract: only an admin sees the global view, users see only their
 * own rooms, and the public liveness probe returns no operational detail.
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import { createWebSocketInfoRoutes, type WebSocketInfoDependencies } from './websocket-info';

// Match getJwtSecret()'s fallback so we don't have to mutate process.env
// (which would race with other test suites in the same Bun process).
const TEST_SECRET = 'dev_secret_change_me';

async function signToken(sub: number, roles: string[]): Promise<string> {
    const secret = new TextEncoder().encode(TEST_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

function makeDeps(): WebSocketInfoDependencies {
    return {
        getServerInfo: () => ({
            port: 3002,
            isRunning: true,
            roomsCount: 2,
            totalConnections: 3,
            mode: 'stateless-relay',
        }),
        getActiveRooms: () => ['project-uuid-a', 'project-uuid-b'],
        getRoomStats: () => ({
            totalRooms: 2,
            totalConnections: 3,
            rooms: [
                { name: 'project-uuid-a', connections: 2, projectUuid: 'uuid-a' },
                { name: 'project-uuid-b', connections: 1, projectUuid: 'uuid-b' },
            ],
        }),
        getConnectionsByUserId: (docName: string, userId: number) => {
            // user 42 is connected to project-uuid-a only
            if (userId === 42 && docName === 'project-uuid-a') {
                return [{} as any];
            }
            return [];
        },
    };
}

describe('WebSocket info routes', () => {
    let userToken: string;
    let adminToken: string;
    let app: Elysia;

    beforeAll(async () => {
        userToken = await signToken(42, ['ROLE_USER']);
        adminToken = await signToken(7, ['ROLE_USER', 'ROLE_ADMIN']);
        app = new Elysia().use(createWebSocketInfoRoutes(makeDeps()));
    });

    describe('GET /api/websocket/health (public)', () => {
        it('returns minimal liveness without auth and without leaking counts', async () => {
            const res = await app.handle(new Request('http://localhost/api/websocket/health'));
            expect(res.status).toBe(200);
            const data = (await res.json()) as Record<string, unknown>;
            expect(data).toEqual({ ok: true });
            expect(data).not.toHaveProperty('roomsCount');
            expect(data).not.toHaveProperty('totalConnections');
            expect(data).not.toHaveProperty('port');
            expect(data).not.toHaveProperty('mode');
        });
    });

    describe('GET /api/websocket/info', () => {
        it('returns 401 without token', async () => {
            const res = await app.handle(new Request('http://localhost/api/websocket/info'));
            expect(res.status).toBe(401);
        });

        it('returns 403 for non-admin user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/websocket/info', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(res.status).toBe(403);
        });

        it('returns server info for admin', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/websocket/info', {
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
            expect(res.status).toBe(200);
            const data = (await res.json()) as Record<string, unknown>;
            expect(data.port).toBe(3002);
            expect(data.roomsCount).toBe(2);
            expect(data.totalConnections).toBe(3);
        });
    });

    describe('GET /api/websocket/rooms', () => {
        it('returns 401 without token', async () => {
            const res = await app.handle(new Request('http://localhost/api/websocket/rooms'));
            expect(res.status).toBe(401);
        });

        it('returns 403 for non-admin user', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/websocket/rooms', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(res.status).toBe(403);
        });

        it('returns the full room list for admin', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/websocket/rooms', {
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
            expect(res.status).toBe(200);
            const data = (await res.json()) as { rooms: Array<Record<string, unknown>> };
            expect(data.rooms.length).toBe(2);
            expect(data.rooms[0].projectUuid).toBe('uuid-a');
        });
    });

    describe('GET /api/websocket/my-rooms', () => {
        it('returns 401 without token', async () => {
            const res = await app.handle(new Request('http://localhost/api/websocket/my-rooms'));
            expect(res.status).toBe(401);
        });

        it('returns only rooms the user is connected to', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/websocket/my-rooms', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(res.status).toBe(200);
            const data = (await res.json()) as { rooms: Array<{ projectUuid: string; myConnections: number }> };
            expect(data.rooms).toEqual([{ projectUuid: 'uuid-a', myConnections: 1 }]);
        });
    });
});
