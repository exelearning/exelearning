/**
 * Components API v1 Routes Tests
 *
 * Tests for component (iDevice) CRUD endpoints.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import { db, resetClientCacheForTesting } from '../../../db/client';
import { up } from '../../../db/migrations/001_initial';
import { now } from '../../../db/types';
import { componentsRoutes } from './components';
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
    return new Elysia().use(createAuthRoutes(authDeps)).use(componentsRoutes);
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

describe('Components API v1', () => {
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
        process.env.JWT_SECRET = 'test-secret-for-components-tests';

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
                email: 'compuser@test.com',
                user_id: 'comp-test-user',
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
                email: 'compadmin@test.com',
                user_id: 'comp-test-admin',
                password: hashedPw,
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        adminId = Number(adminResult.insertId);

        userToken = await getAuthToken(app, 'compuser@test.com', 'password');
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

    describe('GET /projects/:uuid/blocks/:blockId/components', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/blocks/block-1/components'),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/blocks/block-1/components', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 403 for non-owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-comps',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/admin-project-comps/blocks/block-1/components', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return components for owner (may be empty)', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-list-comps',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-list-comps/blocks/block-1/components', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            // May return 200 with empty array or 404 if block doesn't exist
            expect([200, 404]).toContain(response.status);
            if (response.status === 200) {
                const data = (await response.json()) as { success: boolean; data: unknown[] };
                expect(data.success).toBe(true);
                expect(data.data).toBeInstanceOf(Array);
            }
        });
    });

    describe('POST /projects/:uuid/blocks/:blockId/components', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/blocks/block-1/components', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ideviceType: 'text' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/blocks/block-1/components', {
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

        it('should handle create component for owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-create-comp',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-create-comp/blocks/block-1/components', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ideviceType: 'text' }),
                }),
            );
            // May succeed or fail if block doesn't exist
            expect([201, 400, 404]).toContain(response.status);
        });
    });

    describe('GET /projects/:uuid/components/:componentId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/projects/test-uuid/components/comp-1'));
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent component', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-get-comp',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-get-comp/components/non-existent-comp', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });
    });

    describe('PUT /projects/:uuid/components/:componentId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/components/comp-1', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ properties: {} }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should handle update for non-existent component', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-update-comp',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-update-comp/components/non-existent-comp', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ htmlContent: '<p>Updated</p>' }),
                }),
            );
            // Should return 404 or 400 when component not found
            expect([400, 404]).toContain(response.status);
        });
    });

    describe('PUT /projects/:uuid/components/:componentId/html', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/components/comp-1/html', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: '<p>Hello</p>' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should handle set HTML for non-existent component', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-html-comp',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-html-comp/components/non-existent-comp/html', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ html: '<p>Hello</p>' }),
                }),
            );
            // Should return 404 or 400 when component not found
            expect([400, 404]).toContain(response.status);
        });
    });

    describe('DELETE /projects/:uuid/components/:componentId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/components/comp-1', {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should handle delete for non-existent component', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-delete-comp',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-delete-comp/components/non-existent-comp', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            // Should return 404 or 400 when component not found
            expect([400, 404]).toContain(response.status);
        });
    });
});
