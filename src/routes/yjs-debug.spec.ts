/**
 * Tests for /api/yjs/debug/* endpoints.
 */
import { describe, it, expect, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { SignJWT, jwtVerify } from 'jose';
import { createYjsDebugRoutes, type YjsDebugDependencies } from './yjs-debug';

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

function makeDeps(): YjsDebugDependencies {
    const mockProject = {
        id: 1,
        uuid: 'uuid-owned',
        title: 'P',
        owner_id: 42,
        visibility: 'private',
        status: 'active',
    } as any;

    return {
        db: {} as any,
        queries: {
            findProjectByUuid: async (_db: any, uuid: string) => {
                if (uuid === 'uuid-owned') return mockProject;
                return undefined;
            },
            findSnapshotByProjectId: async (_db: any, projectId: number) => {
                if (projectId === 1) {
                    return {
                        id: 1,
                        project_id: 1,
                        snapshot_data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
                        version: 'v-123',
                    };
                }
                return undefined;
            },
            checkProjectAccess: async (_db: any, project: any, userId?: number) => {
                if (!project) return { hasAccess: false, reason: 'PROJECT_NOT_FOUND' };
                if (project.owner_id === userId) return { hasAccess: true };
                return { hasAccess: false, reason: 'ACCESS_DENIED' };
            },
        },
        getRoom: (docName: string) => {
            if (docName === 'project-uuid-owned') {
                return {
                    name: docName,
                    conns: new Set([{} as any, {} as any]),
                    projectUuid: 'uuid-owned',
                };
            }
            return undefined;
        },
        getConnectionsByUserId: (docName: string, userId: number) => {
            if (docName === 'project-uuid-owned' && userId === 42) {
                return [{} as any];
            }
            return [];
        },
    };
}

describe('Yjs debug routes', () => {
    let ownerToken: string;
    let strangerToken: string;
    let adminToken: string;
    let app: Elysia;

    beforeAll(async () => {
        ownerToken = await signToken(42, ['ROLE_USER']);
        strangerToken = await signToken(99, ['ROLE_USER']);
        adminToken = await signToken(7, ['ROLE_USER', 'ROLE_ADMIN']);
        app = new Elysia().use(createYjsDebugRoutes(makeDeps()));
    });

    describe('GET /api/yjs/debug/:projectUuid', () => {
        it('returns 401 without token', async () => {
            const res = await app.handle(new Request('http://localhost/api/yjs/debug/uuid-owned'));
            expect(res.status).toBe(401);
        });

        it('returns 403 for a stranger', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/yjs/debug/uuid-owned', {
                    headers: { Authorization: `Bearer ${strangerToken}` },
                }),
            );
            expect(res.status).toBe(403);
        });

        it('returns 404 when project does not exist', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/yjs/debug/uuid-missing', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );
            expect(res.status).toBe(404);
        });

        it('returns debug info for the owner', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/yjs/debug/uuid-owned', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );
            expect(res.status).toBe(200);
            const data = (await res.json()) as Record<string, unknown>;
            expect(data.projectUuid).toBe('uuid-owned');
            expect(data.roomExists).toBe(true);
            expect(data.connections).toBe(2);
            expect(data.myConnections).toBe(1);
            expect(data.snapshotSize).toBe(8);
            expect(data.lastVersion).toBe('v-123');
        });

        it('returns debug info for an admin who is not the owner', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/yjs/debug/uuid-owned', {
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/yjs/debug/:projectUuid/ws-url', () => {
        it('returns 401 without token', async () => {
            const res = await app.handle(new Request('http://localhost/api/yjs/debug/uuid-owned/ws-url'));
            expect(res.status).toBe(401);
        });

        it('returns 403 for a stranger', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/yjs/debug/uuid-owned/ws-url', {
                    headers: { Authorization: `Bearer ${strangerToken}` },
                }),
            );
            expect(res.status).toBe(403);
        });

        it('returns a ws URL with a short-lived token for the owner', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/yjs/debug/uuid-owned/ws-url', {
                    headers: { Authorization: `Bearer ${ownerToken}` },
                }),
            );
            expect(res.status).toBe(200);
            const data = (await res.json()) as { wsUrl: string; expiresInSeconds: number };
            expect(data.expiresInSeconds).toBe(300);
            expect(data.wsUrl).toContain('/yjs/project-uuid-owned?token=');

            const token = data.wsUrl.split('token=')[1];
            const secret = new TextEncoder().encode(TEST_SECRET);
            const { payload } = await jwtVerify(token, secret);
            expect(payload.sub).toBe(42);
            // Must be a short-lived token (≤ 5 min from now).
            const nowSec = Math.floor(Date.now() / 1000);
            expect((payload.exp as number) - nowSec).toBeLessThanOrEqual(300);
        });
    });
});
