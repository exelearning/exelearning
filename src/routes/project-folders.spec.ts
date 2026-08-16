/**
 * Project Folder Routes Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { createProjectFoldersRoutes, errorCodeToStatus } from './project-folders';
import { MAX_FOLDER_DEPTH } from '../services/project-folder-manager';
import { SignJWT } from 'jose';

const TEST_JWT_SECRET = 'dev_secret_change_me';

async function signTestToken(sub: number, roles: string[] = ['ROLE_USER']): Promise<string> {
    const secret = new TextEncoder().encode(TEST_JWT_SECRET);
    return new SignJWT({ sub, email: `u${sub}@test.local`, roles })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

describe('errorCodeToStatus', () => {
    it('maps every known error code to its HTTP status', () => {
        expect(errorCodeToStatus('INVALID_NAME')).toBe(400);
        expect(errorCodeToStatus('DUPLICATE_NAME')).toBe(409);
        expect(errorCodeToStatus('FOLDER_NOT_FOUND')).toBe(404);
        expect(errorCodeToStatus('PROJECT_NOT_FOUND')).toBe(404);
        expect(errorCodeToStatus('FOLDER_FORBIDDEN')).toBe(403);
        expect(errorCodeToStatus('PROJECT_ACCESS_DENIED')).toBe(403);
        expect(errorCodeToStatus('PARENT_NOT_FOUND')).toBe(404);
        expect(errorCodeToStatus('PARENT_FORBIDDEN')).toBe(403);
        expect(errorCodeToStatus('MAX_DEPTH_EXCEEDED')).toBe(400);
        expect(errorCodeToStatus('CYCLIC_PARENT')).toBe(400);
    });
});

describe('Project Folder Routes', () => {
    let db: Kysely<Database>;
    let app: ReturnType<typeof createProjectFoldersRoutes>;
    let userId: number;
    let userToken: string;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        userId = await seedTestUser(db, { email: 'folders-route@test.com' });
        userToken = await signTestToken(userId);
        app = createProjectFoldersRoutes({ db });
    });

    function authed(path: string, init: RequestInit = {}): Request {
        return new Request(`http://localhost${path}`, {
            ...init,
            headers: { ...(init.headers || {}), Authorization: `Bearer ${userToken}` },
        });
    }

    describe('Authentication gate', () => {
        it('GET /folders returns 401 without a token', async () => {
            const res = await app.handle(new Request('http://localhost/api/projects/folders'));
            expect(res.status).toBe(401);
        });

        it('POST /folders returns 401 without a token', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Nope' }),
                }),
            );
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/projects/folders', () => {
        it('returns an empty list for a user with no folders', async () => {
            const res = await app.handle(authed('/api/projects/folders'));
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.folders).toEqual([]);
        });

        it('returns folders with project counts', async () => {
            await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Math 101' }),
                }),
            );

            const res = await app.handle(authed('/api/projects/folders'));
            const body = await res.json();
            expect(body.folders).toEqual([
                { uuid: expect.any(String), name: 'Math 101', parentUuid: null, depth: 0, projectCount: 0 },
            ]);
        });

        it('returns nested folders in tree order with parentUuid and depth', async () => {
            const parentRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Parent' }),
                }),
            );
            const { folder: parent } = await parentRes.json();

            const childRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Child', parentFolderUuid: parent.uuid }),
                }),
            );
            expect(childRes.status).toBe(201);
            const { folder: child } = await childRes.json();

            const res = await app.handle(authed('/api/projects/folders'));
            const body = await res.json();
            expect(body.folders).toEqual([
                { uuid: parent.uuid, name: 'Parent', parentUuid: null, depth: 0, projectCount: 0 },
                { uuid: child.uuid, name: 'Child', parentUuid: parent.uuid, depth: 1, projectCount: 0 },
            ]);
        });
    });

    describe('POST /api/projects/folders', () => {
        it('creates a folder', async () => {
            const res = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'My Folder' }),
                }),
            );
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.folder.name).toBe('My Folder');
        });

        it('returns 400 for an empty name', async () => {
            const res = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: '   ' }),
                }),
            );
            expect(res.status).toBe(400);
        });

        it('returns 409 for a duplicate name', async () => {
            const create = () =>
                app.handle(
                    authed('/api/projects/folders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: 'Dup' }),
                    }),
                );
            await create();
            const res = await create();
            expect(res.status).toBe(409);
        });

        async function createFolder(name: string, parentFolderUuid?: string): Promise<{ uuid: string; name: string }> {
            const res = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, parentFolderUuid }),
                }),
            );
            const { folder } = await res.json();
            return folder;
        }

        it('creates a folder nested under parentFolderUuid', async () => {
            const parent = await createFolder('Parent');

            const res = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Child', parentFolderUuid: parent.uuid }),
                }),
            );

            expect(res.status).toBe(201);
        });

        it('returns 404 when parentFolderUuid does not exist', async () => {
            const res = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Orphan', parentFolderUuid: 'missing-parent' }),
                }),
            );
            expect(res.status).toBe(404);
        });

        it('returns 403 when parentFolderUuid belongs to another user', async () => {
            const strangerId = await seedTestUser(db, { email: 'stranger-nest@test.com' });
            const strangerToken = await signTestToken(strangerId);
            const strangerFolderRes = await app.handle(
                new Request('http://localhost/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${strangerToken}` },
                    body: JSON.stringify({ name: "Stranger's Folder" }),
                }),
            );
            const { folder: strangerFolder } = await strangerFolderRes.json();

            const res = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Trying', parentFolderUuid: strangerFolder.uuid }),
                }),
            );
            expect(res.status).toBe(403);
        });

        it('returns 400 when nesting would exceed the maximum depth', async () => {
            // Build a chain down to the deepest allowed level (depth
            // MAX_FOLDER_DEPTH - 1), then prove one level further is rejected.
            let parentUuid: string | undefined;
            for (let depth = 0; depth < MAX_FOLDER_DEPTH; depth++) {
                const folder = await createFolder(`Level ${depth}`, parentUuid);
                parentUuid = folder.uuid;
            }

            const tooDeepRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Too Deep', parentFolderUuid: parentUuid }),
                }),
            );
            expect(tooDeepRes.status).toBe(400);
        });
    });

    describe('PATCH /api/projects/folders/:folderUuid', () => {
        it('renames a folder the caller owns', async () => {
            const createRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Old Name' }),
                }),
            );
            const { folder } = await createRes.json();

            const res = await app.handle(
                authed(`/api/projects/folders/${folder.uuid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'New Name' }),
                }),
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.folder.name).toBe('New Name');
        });

        it('returns 404 for a missing folder', async () => {
            const res = await app.handle(
                authed('/api/projects/folders/does-not-exist', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'New Name' }),
                }),
            );
            expect(res.status).toBe(404);
        });

        it("returns 403 when renaming another user's folder", async () => {
            const strangerId = await seedTestUser(db, { email: 'stranger-rename@test.com' });
            const strangerToken = await signTestToken(strangerId);
            const createRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Owner Only' }),
                }),
            );
            const { folder } = await createRes.json();

            const res = await app.handle(
                new Request(`http://localhost/api/projects/folders/${folder.uuid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${strangerToken}` },
                    body: JSON.stringify({ name: 'Hijacked' }),
                }),
            );
            expect(res.status).toBe(403);

            // Verify state after the rejected rename: folder name is unchanged.
            const listRes = await app.handle(authed('/api/projects/folders'));
            const { folders } = await listRes.json();
            expect(folders.find((f: { uuid: string }) => f.uuid === folder.uuid)?.name).toBe('Owner Only');
        });

        it('returns 400 when neither name nor parentFolderUuid is provided', async () => {
            const createRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Untouched' }),
                }),
            );
            const { folder } = await createRes.json();

            const res = await app.handle(
                authed(`/api/projects/folders/${folder.uuid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }),
            );
            expect(res.status).toBe(400);
        });

        it('reparents a folder via parentFolderUuid', async () => {
            const parentRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'New Parent' }),
                }),
            );
            const { folder: parent } = await parentRes.json();
            const childRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Movable' }),
                }),
            );
            const { folder: child } = await childRes.json();

            const res = await app.handle(
                authed(`/api/projects/folders/${child.uuid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentFolderUuid: parent.uuid }),
                }),
            );
            expect(res.status).toBe(200);

            const listRes = await app.handle(authed('/api/projects/folders'));
            const { folders } = await listRes.json();
            expect(folders.find((f: { uuid: string }) => f.uuid === child.uuid)?.parentUuid).toBe(parent.uuid);
        });

        it('moves a folder back to top-level when parentFolderUuid is explicitly null', async () => {
            const parentRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Parent Again' }),
                }),
            );
            const { folder: parent } = await parentRes.json();
            const childRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Nested', parentFolderUuid: parent.uuid }),
                }),
            );
            const { folder: child } = await childRes.json();

            const res = await app.handle(
                authed(`/api/projects/folders/${child.uuid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentFolderUuid: null }),
                }),
            );
            expect(res.status).toBe(200);

            const listRes = await app.handle(authed('/api/projects/folders'));
            const { folders } = await listRes.json();
            expect(folders.find((f: { uuid: string }) => f.uuid === child.uuid)?.parentUuid).toBeNull();
        });

        it('returns 400 when moving a folder into its own descendant', async () => {
            const parentRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Ancestor' }),
                }),
            );
            const { folder: ancestor } = await parentRes.json();
            const childRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Descendant', parentFolderUuid: ancestor.uuid }),
                }),
            );
            const { folder: descendant } = await childRes.json();

            const res = await app.handle(
                authed(`/api/projects/folders/${ancestor.uuid}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentFolderUuid: descendant.uuid }),
                }),
            );
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/projects/folders/:folderUuid', () => {
        it('deletes a folder the caller owns and unfiles its projects', async () => {
            const createRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Doomed' }),
                }),
            );
            const { folder } = await createRes.json();
            const projectUuid = `proj-${Date.now()}`;
            await seedTestProject(db, userId, { uuid: projectUuid });
            await app.handle(
                authed(`/api/projects/uuid/${projectUuid}/folder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderUuid: folder.uuid }),
                }),
            );

            const res = await app.handle(authed(`/api/projects/folders/${folder.uuid}`, { method: 'DELETE' }));
            expect(res.status).toBe(200);

            const listRes = await app.handle(authed('/api/projects/folders'));
            const { folders } = await listRes.json();
            expect(folders).toEqual([]);
        });

        it("returns 403 when deleting another user's folder, and the folder still exists", async () => {
            const strangerId = await seedTestUser(db, { email: 'stranger-delete@test.com' });
            const strangerToken = await signTestToken(strangerId);
            const createRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Protected' }),
                }),
            );
            const { folder } = await createRes.json();

            const res = await app.handle(
                new Request(`http://localhost/api/projects/folders/${folder.uuid}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${strangerToken}` },
                }),
            );
            expect(res.status).toBe(403);

            const listRes = await app.handle(authed('/api/projects/folders'));
            const { folders } = await listRes.json();
            expect(folders).toHaveLength(1);
        });
    });

    describe('PUT /api/projects/uuid/:projectUuid/folder', () => {
        it('files a project the caller owns', async () => {
            const createRes = await app.handle(
                authed('/api/projects/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Destination' }),
                }),
            );
            const { folder } = await createRes.json();
            const projectUuid = `proj-own-${Date.now()}`;
            await seedTestProject(db, userId, { uuid: projectUuid });

            const res = await app.handle(
                authed(`/api/projects/uuid/${projectUuid}/folder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderUuid: folder.uuid }),
                }),
            );
            expect(res.status).toBe(200);

            const listRes = await app.handle(authed('/api/projects/folders'));
            const { folders } = await listRes.json();
            expect(folders[0].projectCount).toBe(1);
        });

        it('returns 404 for a project that does not exist', async () => {
            const res = await app.handle(
                authed('/api/projects/uuid/does-not-exist/folder', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderUuid: null }),
                }),
            );
            expect(res.status).toBe(404);
        });

        it('returns 403 for a project the caller has no access to', async () => {
            const otherOwnerId = await seedTestUser(db, { email: 'other-owner@test.com' });
            const projectUuid = `proj-other-${Date.now()}`;
            await seedTestProject(db, otherOwnerId, { uuid: projectUuid, visibility: 'private' });

            const res = await app.handle(
                authed(`/api/projects/uuid/${projectUuid}/folder`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderUuid: null }),
                }),
            );
            expect(res.status).toBe(403);
        });
    });
});
