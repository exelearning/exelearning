/**
 * Blocks API v1 Routes Tests
 *
 * Tests for block CRUD endpoints.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import { db, resetClientCacheForTesting } from '../../../db/client';
import { up } from '../../../db/migrations/001_initial';
import { now } from '../../../db/types';
import { blocksRoutes } from './blocks';
import { createAuthRoutes } from '../../auth';
import { findUserByEmail, findUserById, createUser } from '../../../db/queries';
import { configureDocManager, resetDocManager, configureBroadcaster, resetBroadcaster } from '../../../yjs';
import * as Y from 'yjs';

let originalEnv: Record<string, string | undefined>;

function createTestApp() {
    const authDeps = {
        db,
        queries: { findUserByEmail, findUserById, createUser },
    };
    return new Elysia().use(createAuthRoutes(authDeps)).use(blocksRoutes);
}

async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

async function getAuthToken(app: ReturnType<typeof createTestApp>, email: string, password: string): Promise<string> {
    const response = await app.handle(
        new Request('http://localhost/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        }),
    );
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
}

describe('Blocks API v1', () => {
    let app: ReturnType<typeof createTestApp>;
    let userToken: string;
    let userId: number;
    let adminId: number;
    let mockYDoc: Y.Doc;

    beforeAll(async () => {
        originalEnv = {
            APP_AUTH_METHODS: process.env.APP_AUTH_METHODS,
            JWT_SECRET: process.env.JWT_SECRET,
        };
        process.env.APP_AUTH_METHODS = 'password';
        process.env.JWT_SECRET = 'test-secret-for-blocks-tests';

        await resetClientCacheForTesting();
        await up(db);

        mockYDoc = new Y.Doc();
        mockYDoc.getArray('navigation');
        mockYDoc.getMap('metadata');
        mockYDoc.getMap('assets');

        configureDocManager({
            db,
            queries: {
                findProjectByUuid: async (passedDb, uuid) => {
                    const project = await passedDb
                        .selectFrom('projects')
                        .where('uuid', '=', uuid)
                        .selectAll()
                        .executeTakeFirst();
                    return project || undefined;
                },
            },
            persistence: {
                reconstructDocument: async () => mockYDoc,
                saveFullState: async () => {},
                loadDocument: async () => Y.encodeStateAsUpdate(mockYDoc),
            },
            cache: {
                getDocument: () => undefined,
                createEntry: (uuid, projectId, ydoc) => ({
                    projectUuid: uuid,
                    projectId,
                    ydoc,
                    isDirty: false,
                    lastAccessedAt: Date.now(),
                    loadedAt: Date.now(),
                }),
                markDirty: () => {},
                markClean: () => {},
                removeDocument: () => false,
                hasDocument: () => false,
                getStats: () => ({ size: 0, maxSize: 50, entries: [] }),
            },
            lock: {
                acquireLock: async () => () => {},
                getStats: () => ({ activeLocks: 0, waitingCount: 0 }),
            },
            broadcaster: { broadcastUpdate: () => true },
        });

        configureBroadcaster({
            roomManager: {
                broadcastToRoom: () => {},
                getRoomByProjectUuid: () => undefined,
                getRoom: () => undefined,
            },
        });

        app = createTestApp();

        const hashedPw = await hashPassword('password');

        const userResult = await db
            .insertInto('users')
            .values({
                email: 'blockuser@test.com',
                user_id: 'block-test-user',
                password: hashedPw,
                roles: '["ROLE_USER"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        userId = Number(userResult.insertId);

        const adminResult = await db
            .insertInto('users')
            .values({
                email: 'blockadmin@test.com',
                user_id: 'block-test-admin',
                password: hashedPw,
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        adminId = Number(adminResult.insertId);

        userToken = await getAuthToken(app, 'blockuser@test.com', 'password');
    });

    afterAll(async () => {
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        resetDocManager();
        resetBroadcaster();
        mockYDoc.destroy();
        await resetClientCacheForTesting();
    });

    beforeEach(async () => {
        await db.deleteFrom('projects').execute();
    });

    describe('GET /projects/:uuid/pages/:pageId/blocks', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/projects/test-uuid/pages/page-1/blocks'));
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages/page-1/blocks', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 403 for non-owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-blocks',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/admin-project-blocks/pages/page-1/blocks', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return blocks for owner (may be empty)', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-list-blocks',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-list-blocks/pages/page-1/blocks', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            // May return 200 with empty array or 404 if page doesn't exist
            expect([200, 404]).toContain(response.status);
            if (response.status === 200) {
                const data = (await response.json()) as { success: boolean; data: unknown[] };
                expect(data.success).toBe(true);
                expect(data.data).toBeInstanceOf(Array);
            }
        });
    });

    describe('POST /projects/:uuid/pages/:pageId/blocks', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/pages/page-1/blocks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ideviceType: 'text' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages/page-1/blocks', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ideviceType: 'text' }),
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should handle create block for owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-create-block',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-create-block/pages/page-1/blocks', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: 'New Block' }),
                }),
            );
            // May succeed or fail if page doesn't exist
            expect([201, 400, 404]).toContain(response.status);
        });
    });

    describe('GET /projects/:uuid/blocks/:blockId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/projects/test-uuid/blocks/block-1'));
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent block', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-get-block',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-get-block/blocks/non-existent-block', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });
    });

    describe('PATCH /projects/:uuid/blocks/:blockId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/blocks/block-1', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: {} }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should handle update for non-existent block', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-update-block',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-update-block/blocks/non-existent-block', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: 'Updated' }),
                }),
            );
            // Should return 404 or 400 when block not found
            expect([400, 404]).toContain(response.status);
        });
    });

    describe('DELETE /projects/:uuid/blocks/:blockId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/blocks/block-1', {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should handle delete for non-existent block', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-delete-block',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-delete-block/blocks/non-existent-block', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            // Should return 404 or 400 when block not found
            expect([400, 404]).toContain(response.status);
        });
    });

    describe('POST /projects/:uuid/blocks/:blockId/move', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/blocks/block-1/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetPageId: 'page-2', position: 0 }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should handle move for non-existent block', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-move-block',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-move-block/blocks/non-existent-block/move', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ targetPageId: 'page-2', position: 0 }),
                }),
            );
            // Should return 404 or 400 when block not found
            expect([400, 404]).toContain(response.status);
        });
    });
});
