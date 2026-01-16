/**
 * Metadata API v1 Routes Tests
 *
 * Tests for project metadata endpoints.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import { db, resetClientCacheForTesting } from '../../../db/client';
import { up } from '../../../db/migrations/001_initial';
import { now } from '../../../db/types';
import { metadataRoutes } from './metadata';
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
    return new Elysia().use(createAuthRoutes(authDeps)).use(metadataRoutes);
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

describe('Metadata API v1', () => {
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
        process.env.JWT_SECRET = 'test-secret-for-metadata-tests';

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
                email: 'metauser@test.com',
                user_id: 'meta-test-user',
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
                email: 'metaadmin@test.com',
                user_id: 'meta-test-admin',
                password: hashedPw,
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        adminId = Number(adminResult.insertId);

        userToken = await getAuthToken(app, 'metauser@test.com', 'password');
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

    describe('GET /projects/:uuid/metadata', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/projects/test-uuid/metadata'));
            expect(response.status).toBe(401);
            const data = (await response.json()) as { success: boolean; error: { code: string } };
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/metadata', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 403 for non-owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-meta',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/admin-project-meta/metadata', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return metadata for owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-get-meta',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-get-meta/metadata', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const data = (await response.json()) as { success: boolean; data: object };
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
        });
    });

    describe('PATCH /projects/:uuid/metadata', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/metadata', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: 'New Title' }),
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/metadata', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title: 'New Title' }),
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 403 for non-owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-meta-update',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/admin-meta-update/metadata', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title: 'Hacked' }),
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should update metadata for owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-update-meta',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-update-meta/metadata', {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ title: 'Updated Title', author: 'Test Author' }),
                }),
            );
            expect(response.status).toBe(200);
            const data = (await response.json()) as { success: boolean; data: object };
            expect(data.success).toBe(true);
        });
    });
});
