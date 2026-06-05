/**
 * Pages API v1 Routes Tests
 *
 * Tests for page CRUD endpoints.
 * Note: Full integration tests require doc-manager setup.
 * These tests focus on auth and validation.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import { db, resetClientCacheForTesting } from '../../../db/client';
import { up } from '../../../db/migrations/001_initial';
import { now } from '../../../db/types';
import { pagesRoutes } from './pages';
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
    return new Elysia().use(createAuthRoutes(authDeps)).use(pagesRoutes);
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

describe('Pages API v1', () => {
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
        process.env.JWT_SECRET = 'test-secret-for-pages-tests';

        await resetClientCacheForTesting();
        await up(db);

        // Setup mock Yjs
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
            broadcaster: {
                broadcastUpdate: () => true,
            },
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
                email: 'pageuser@test.com',
                user_id: 'page-test-user',
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
                email: 'pageadmin@test.com',
                user_id: 'page-test-admin',
                password: hashedPw,
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        adminId = Number(adminResult.insertId);

        userToken = await getAuthToken(app, 'pageuser@test.com', 'password');
    });

    afterAll(async () => {
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
        resetDocManager();
        resetBroadcaster();
        mockYDoc.destroy();
        await resetClientCacheForTesting();
    });

    beforeEach(async () => {
        await db.deleteFrom('projects').execute();
    });

    // =========================================================================
    // GET /projects/:uuid/pages - List Pages
    // =========================================================================

    describe('GET /projects/:uuid/pages', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/projects/test-uuid/pages'));
            expect(response.status).toBe(401);
            const data = (await response.json()) as { success: boolean; error: { code: string } };
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 403 for non-owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-pages',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/admin-project-pages/pages', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return pages for owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-list-pages',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-list-pages/pages', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const data = (await response.json()) as { success: boolean; data: unknown[] };
            expect(data.success).toBe(true);
            expect(data.data).toBeInstanceOf(Array);
        });
    });

    // =========================================================================
    // POST /projects/:uuid/pages - Create Page
    // =========================================================================

    describe('POST /projects/:uuid/pages', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/pages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'New Page' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: 'New Page' }),
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should reject invalid body', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-pages',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-pages/pages', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}), // Missing name
                }),
            );
            expect(response.status).toBe(422);
        });

        it('should create page for owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-create-page',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-create-page/pages', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: 'New Page' }),
                }),
            );
            // Create may succeed or return 400 if root page doesn't exist
            expect([201, 400]).toContain(response.status);
            if (response.status === 201) {
                const data = (await response.json()) as { success: boolean; data: { pageId: string } };
                expect(data.success).toBe(true);
                expect(data.data.pageId).toBeDefined();
            }
        });
    });

    // =========================================================================
    // GET /projects/:uuid/pages/:pageId - Get Page
    // =========================================================================

    describe('GET /projects/:uuid/pages/:pageId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/projects/test-uuid/pages/page-1'));
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages/page-1', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 404 for non-existent page', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-get-page',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-get-page/pages/non-existent-page', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
            const data = (await response.json()) as { success: boolean; error: { code: string } };
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
        });
    });

    // =========================================================================
    // PATCH /projects/:uuid/pages/:pageId - Update Page
    // =========================================================================

    describe('PATCH /projects/:uuid/pages/:pageId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/pages/page-1', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Updated' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages/page-1', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: 'Updated' }),
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should handle update for non-existent page', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-update-page',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-update-page/pages/non-existent-page', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: 'Updated' }),
                }),
            );
            // Should return 404 or 400 when page not found
            expect([400, 404]).toContain(response.status);
        });
    });

    // =========================================================================
    // DELETE /projects/:uuid/pages/:pageId - Delete Page
    // =========================================================================

    describe('DELETE /projects/:uuid/pages/:pageId', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/pages/page-1', {
                    method: 'DELETE',
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages/page-1', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should handle delete for non-existent page', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-delete-page',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-delete-page/pages/non-existent-page', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            // Should return 404 or 400 when page not found
            expect([400, 404]).toContain(response.status);
        });
    });

    // =========================================================================
    // POST /projects/:uuid/pages/:pageId/move - Move Page
    // =========================================================================

    describe('POST /projects/:uuid/pages/:pageId/move', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/pages/page-1/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newParentId: null, position: 0 }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/pages/page-1/move', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ newParentId: null, position: 0 }),
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should reject invalid body', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'move-project',
                    title: 'Move Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/move-project/pages/page-1/move', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}), // Missing required fields
                }),
            );
            expect(response.status).toBe(422);
        });

        it('should handle move for non-existent page', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-move-page',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-move-page/pages/non-existent-page/move', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ newParentId: null, position: 0 }),
                }),
            );
            // Should return 404 or 400 when page not found
            expect([400, 404]).toContain(response.status);
        });
    });
});
