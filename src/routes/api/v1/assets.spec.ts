/**
 * Assets API v1 Routes Tests
 *
 * Tests for asset CRUD endpoints.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as fs from 'fs-extra';
import { db, resetClientCacheForTesting } from '../../../db/client';
import { up } from '../../../db/migrations/001_initial';
import { up as up002 } from '../../../db/migrations/002_asset_folder_path';
import { now } from '../../../db/types';
import { assetsRoutes } from './assets';
import { createAuthRoutes } from '../../auth';
import { findUserByEmail, findUserById, createUser, createAsset } from '../../../db/queries';
import { configureDocManager, resetDocManager, configureBroadcaster, resetBroadcaster } from '../../../yjs';
import * as Y from 'yjs';

let originalEnv: Record<string, string | undefined>;
const TEST_FILES_DIR = '/tmp/exelearning-assets-test';

function createTestApp() {
    const authDeps = {
        db,
        queries: { findUserByEmail, findUserById, createUser },
    };
    return new Elysia().use(createAuthRoutes(authDeps)).use(assetsRoutes);
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

describe('Assets API v1', () => {
    let app: ReturnType<typeof createTestApp>;
    let userToken: string;
    let userId: number;
    let adminId: number;
    let adminToken: string;
    let mockYDoc: Y.Doc;

    beforeAll(async () => {
        originalEnv = {
            APP_AUTH_METHODS: process.env.APP_AUTH_METHODS,
            JWT_SECRET: process.env.JWT_SECRET,
            ELYSIA_FILES_DIR: process.env.ELYSIA_FILES_DIR,
        };
        process.env.APP_AUTH_METHODS = 'password';
        process.env.JWT_SECRET = 'test-secret-for-assets-tests';
        process.env.ELYSIA_FILES_DIR = TEST_FILES_DIR;

        await fs.ensureDir(TEST_FILES_DIR);
        await resetClientCacheForTesting();
        await up(db);
        await up002(db);

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
                email: 'assetuser@test.com',
                user_id: 'asset-test-user',
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
                email: 'assetadmin@test.com',
                user_id: 'asset-test-admin',
                password: hashedPw,
                roles: '["ROLE_USER", "ROLE_ADMIN"]',
                is_lopd_accepted: 1,
                is_active: 1,
                created_at: now(),
                updated_at: now(),
            })
            .executeTakeFirst();
        adminId = Number(adminResult.insertId);

        userToken = await getAuthToken(app, 'assetuser@test.com', 'password');
        adminToken = await getAuthToken(app, 'assetadmin@test.com', 'password');
    });

    afterAll(async () => {
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        resetDocManager();
        resetBroadcaster();
        mockYDoc.destroy();
        await fs.remove(TEST_FILES_DIR);
        await resetClientCacheForTesting();
    });

    beforeEach(async () => {
        await db.deleteFrom('assets').execute();
        await db.deleteFrom('projects').execute();
        await fs.emptyDir(TEST_FILES_DIR);
    });

    describe('GET /projects/:uuid/assets', () => {
        it('should return 401 without auth token', async () => {
            const response = await app.handle(new Request('http://localhost/projects/test-uuid/assets'));
            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent/assets', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 403 for non-owner', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-assets',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/admin-project-assets/assets', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return empty array for project with no assets', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-empty',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-empty/assets', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as { success: boolean; data: unknown[] };
            expect(body.success).toBe(true);
            expect(body.data).toEqual([]);
        });

        it('should return assets for project owner', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-with-assets',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            await createAsset(db, {
                project_id: projectId,
                filename: 'test.jpg',
                storage_path: '/tmp/test.jpg',
                mime_type: 'image/jpeg',
                file_size: '1024',
                client_id: 'client-id-1',
                folder_path: '',
            });

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-with-assets/assets', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as { success: boolean; data: unknown[] };
            expect(body.success).toBe(true);
            expect(body.data.length).toBe(1);
        });
    });

    describe('POST /projects/:uuid/assets', () => {
        it('should return 401 without auth token', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt');

            const response = await app.handle(
                new Request('http://localhost/projects/test-uuid/assets', {
                    method: 'POST',
                    body: formData,
                }),
            );
            expect(response.status).toBe(401);
        });

        it('should return 400 without file', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-upload',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const formData = new FormData();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-upload/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${userToken}` },
                    body: formData,
                }),
            );
            expect(response.status).toBe(400);
        });

        it('should upload file successfully', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-upload-success',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const formData = new FormData();
            formData.append('file', new Blob(['test image content'], { type: 'image/jpeg' }), 'test.jpg');

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-upload-success/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${userToken}` },
                    body: formData,
                }),
            );
            expect(response.status).toBe(201);
            const body = (await response.json()) as { success: boolean; data: { filename: string; clientId: string } };
            expect(body.success).toBe(true);
            expect(body.data.filename).toBe('test.jpg');
            expect(body.data.clientId).toBeTruthy();
        });

        it('should update existing asset with same clientId', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-update-asset',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            await createAsset(db, {
                project_id: projectId,
                filename: 'old.jpg',
                storage_path: '/tmp/old.jpg',
                mime_type: 'image/jpeg',
                file_size: '500',
                client_id: 'existing-client-id',
                folder_path: '',
            });

            const formData = new FormData();
            formData.append('file', new Blob(['new content'], { type: 'image/png' }), 'new.png');
            formData.append('clientId', 'existing-client-id');

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-update-asset/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${userToken}` },
                    body: formData,
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as { success: boolean; data: { filename: string } };
            expect(body.success).toBe(true);
            expect(body.data.filename).toBe('new.png');
        });
    });

    describe('GET /projects/:uuid/assets/:assetId', () => {
        it('should return 404 for non-existent asset', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-download',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-download/assets/999', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 400 for invalid asset ID', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-invalid-id',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-invalid-id/assets/invalid', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(400);
        });

        it('should download asset successfully', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-download-success',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            const filePath = path.join(TEST_FILES_DIR, 'assets', 'user-project-download-success', 'test-file.txt');
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, 'test content');

            const assetResult = await createAsset(db, {
                project_id: projectId,
                filename: 'test-file.txt',
                storage_path: filePath,
                mime_type: 'text/plain',
                file_size: '12',
                client_id: 'download-client-id',
                folder_path: '',
            });

            const response = await app.handle(
                new Request(`http://localhost/projects/user-project-download-success/assets/${assetResult.id}`, {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('text/plain');
            const content = await response.text();
            expect(content).toBe('test content');
        });
    });

    describe('GET /projects/:uuid/assets/:assetId/metadata', () => {
        it('should return asset metadata', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-metadata',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            const assetResult = await createAsset(db, {
                project_id: projectId,
                filename: 'metadata-test.jpg',
                storage_path: '/tmp/test.jpg',
                mime_type: 'image/jpeg',
                file_size: '2048',
                client_id: 'metadata-client-id',
                folder_path: 'images',
            });

            const response = await app.handle(
                new Request(`http://localhost/projects/user-project-metadata/assets/${assetResult.id}/metadata`, {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                success: boolean;
                data: { filename: string; mimeType: string; size: number; folderPath: string };
            };
            expect(body.success).toBe(true);
            expect(body.data.filename).toBe('metadata-test.jpg');
            expect(body.data.mimeType).toBe('image/jpeg');
            expect(body.data.size).toBe(2048);
            expect(body.data.folderPath).toBe('images');
        });
    });

    describe('DELETE /projects/:uuid/assets/:assetId', () => {
        it('should delete asset successfully', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-delete',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            const filePath = path.join(TEST_FILES_DIR, 'assets', 'user-project-delete', 'to-delete.txt');
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, 'to delete');

            const assetResult = await createAsset(db, {
                project_id: projectId,
                filename: 'to-delete.txt',
                storage_path: filePath,
                mime_type: 'text/plain',
                file_size: '9',
                client_id: 'delete-client-id',
                folder_path: '',
            });

            const response = await app.handle(
                new Request(`http://localhost/projects/user-project-delete/assets/${assetResult.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as { success: boolean; data: { message: string } };
            expect(body.success).toBe(true);
            expect(body.data.message).toBe('Asset deleted');

            // Verify file is deleted
            expect(await fs.pathExists(filePath)).toBe(false);
        });

        it('should return 404 for non-existent asset', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-delete-404',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-delete-404/assets/999', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });
    });

    describe('POST /projects/:uuid/assets/bulk-delete', () => {
        it('should delete multiple assets', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-bulk-delete',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            const assetsDir = path.join(TEST_FILES_DIR, 'assets', 'user-project-bulk-delete');
            await fs.ensureDir(assetsDir);

            const filePath1 = path.join(assetsDir, 'file1.txt');
            const filePath2 = path.join(assetsDir, 'file2.txt');
            await fs.writeFile(filePath1, 'content1');
            await fs.writeFile(filePath2, 'content2');

            await createAsset(db, {
                project_id: projectId,
                filename: 'file1.txt',
                storage_path: filePath1,
                mime_type: 'text/plain',
                file_size: '8',
                client_id: 'bulk-client-1',
                folder_path: '',
            });

            await createAsset(db, {
                project_id: projectId,
                filename: 'file2.txt',
                storage_path: filePath2,
                mime_type: 'text/plain',
                file_size: '8',
                client_id: 'bulk-client-2',
                folder_path: '',
            });

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-bulk-delete/assets/bulk-delete', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ clientIds: ['bulk-client-1', 'bulk-client-2'] }),
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as { success: boolean; data: { deleted: number } };
            expect(body.success).toBe(true);
            expect(body.data.deleted).toBe(2);

            // Verify files are deleted
            expect(await fs.pathExists(filePath1)).toBe(false);
            expect(await fs.pathExists(filePath2)).toBe(false);
        });

        it('should return 0 deleted for empty clientIds', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-bulk-empty',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-bulk-empty/assets/bulk-delete', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ clientIds: [] }),
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as { success: boolean; data: { deleted: number } };
            expect(body.success).toBe(true);
            expect(body.data.deleted).toBe(0);
        });
    });

    describe('Admin access', () => {
        it('admin should access any project assets', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-admin-access',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-admin-access/assets', {
                    headers: { Authorization: `Bearer ${adminToken}` },
                }),
            );
            expect(response.status).toBe(200);
        });
    });

    describe('Edge cases and error handling', () => {
        it('should sanitize folder path with path traversal attempts', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-sanitize',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const formData = new FormData();
            formData.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt');
            formData.append('folderPath', '../../../etc/passwd');

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-sanitize/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${userToken}` },
                    body: formData,
                }),
            );
            expect(response.status).toBe(201);
            const body = (await response.json()) as { success: boolean; data: { folderPath: string } };
            expect(body.success).toBe(true);
            // Path traversal should be sanitized
            expect(body.data.folderPath).not.toContain('..');
        });

        it('should return 404 when downloading asset with missing file on disk', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-missing-file',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            // Create asset record but don't create the actual file
            const assetResult = await createAsset(db, {
                project_id: projectId,
                filename: 'missing.txt',
                storage_path: '/tmp/nonexistent/missing-file.txt',
                mime_type: 'text/plain',
                file_size: '100',
                client_id: 'missing-client-id',
                folder_path: '',
            });

            const response = await app.handle(
                new Request(`http://localhost/projects/user-project-missing-file/assets/${assetResult.id}`, {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
            const body = (await response.json()) as { success: boolean; error: { code: string } };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('NOT_FOUND');
        });

        it('should return 404 for metadata of non-existent asset', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-metadata-404',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-metadata-404/assets/99999/metadata', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should return 400 for metadata with invalid asset ID', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-metadata-invalid',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-metadata-invalid/assets/not-a-number/metadata', {
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(400);
        });

        it('should return 403 for metadata of asset from another user project', async () => {
            const adminProjectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-metadata-forbidden',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const adminProjectId = Number(adminProjectResult.insertId);

            const assetResult = await createAsset(db, {
                project_id: adminProjectId,
                filename: 'admin-asset.txt',
                storage_path: '/tmp/admin.txt',
                mime_type: 'text/plain',
                file_size: '100',
                client_id: 'admin-client-id',
                folder_path: '',
            });

            const response = await app.handle(
                new Request(
                    `http://localhost/projects/admin-project-metadata-forbidden/assets/${assetResult.id}/metadata`,
                    {
                        headers: { Authorization: `Bearer ${userToken}` },
                    },
                ),
            );
            expect(response.status).toBe(403);
        });

        it('should delete asset even when file is already missing from disk', async () => {
            const projectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-delete-missing',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const projectId = Number(projectResult.insertId);

            // Create asset record but file doesn't exist
            const assetResult = await createAsset(db, {
                project_id: projectId,
                filename: 'already-deleted.txt',
                storage_path: '/tmp/nonexistent/already-deleted.txt',
                mime_type: 'text/plain',
                file_size: '100',
                client_id: 'delete-missing-client',
                folder_path: '',
            });

            const response = await app.handle(
                new Request(`http://localhost/projects/user-project-delete-missing/assets/${assetResult.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(200);
            const body = (await response.json()) as { success: boolean; data: { message: string } };
            expect(body.success).toBe(true);
        });

        it('should return 400 for delete with invalid asset ID', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-delete-invalid',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-delete-invalid/assets/invalid-id', {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(400);
        });

        it('should return 403 for delete of asset from another user project', async () => {
            const adminProjectResult = await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-delete-forbidden',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .executeTakeFirst();
            const adminProjectId = Number(adminProjectResult.insertId);

            const assetResult = await createAsset(db, {
                project_id: adminProjectId,
                filename: 'admin-delete.txt',
                storage_path: '/tmp/admin-delete.txt',
                mime_type: 'text/plain',
                file_size: '100',
                client_id: 'admin-delete-client',
                folder_path: '',
            });

            const response = await app.handle(
                new Request(`http://localhost/projects/admin-project-delete-forbidden/assets/${assetResult.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${userToken}` },
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return 403 for bulk delete on another user project', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'admin-project-bulk-forbidden',
                    title: 'Admin Project',
                    owner_id: adminId,
                    created_at: now(),
                })
                .execute();

            const response = await app.handle(
                new Request('http://localhost/projects/admin-project-bulk-forbidden/assets/bulk-delete', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ clientIds: ['some-id'] }),
                }),
            );
            expect(response.status).toBe(403);
        });

        it('should return 404 for bulk delete on non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/projects/non-existent-project/assets/bulk-delete', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${userToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ clientIds: ['some-id'] }),
                }),
            );
            expect(response.status).toBe(404);
        });

        it('should handle folderPath with special characters', async () => {
            await db
                .insertInto('projects')
                .values({
                    uuid: 'user-project-special-chars',
                    title: 'User Project',
                    owner_id: userId,
                    created_at: now(),
                })
                .execute();

            const formData = new FormData();
            formData.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.txt');
            formData.append('folderPath', 'images/<script>alert(1)</script>');

            const response = await app.handle(
                new Request('http://localhost/projects/user-project-special-chars/assets', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${userToken}` },
                    body: formData,
                }),
            );
            expect(response.status).toBe(201);
            const body = (await response.json()) as { success: boolean; data: { folderPath: string } };
            expect(body.success).toBe(true);
            // Special chars should be sanitized
            expect(body.data.folderPath).not.toContain('<');
            expect(body.data.folderPath).not.toContain('>');
        });
    });
});
