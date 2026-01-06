/**
 * File Manager Routes Tests
 * Tests for folder operations and file organization endpoints
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types';
import * as assetQueries from '../db/queries/assets';
import { findProjectByUuid, findAssetByClientId, updateAsset } from '../db/queries';
import { createFileManagerRoutes } from './filemanager';
import { createFolderManagerService } from '../services/folder-manager';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as fflate from 'fflate';

describe('File Manager Routes', () => {
    let db: Kysely<Database>;
    let testUserId: number;
    let testProjectId: number;
    let testProjectUuid: string;
    let tempDir: string;
    let app: ReturnType<typeof createFileManagerRoutes>;

    beforeAll(async () => {
        db = await createTestDb();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filemanager-routes-test-'));
    });

    afterAll(async () => {
        await destroyTestDb(db);
        await fs.remove(tempDir);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        testUserId = await seedTestUser(db);
        testProjectUuid = `test-proj-${Date.now()}`;
        testProjectId = await seedTestProject(db, testUserId, {
            uuid: testProjectUuid,
            title: 'Test Project',
        });

        // Create folder manager with injected dependencies
        const folderManager = createFolderManagerService({
            db,
            queries: assetQueries,
            fs,
            path,
            fflate,
            getProjectAssetsDir: (uuid: string) => path.join(tempDir, 'assets', uuid),
        });

        // Create routes with injected dependencies
        app = createFileManagerRoutes({
            db,
            folderManager,
            findProjectByUuid: (database, uuid) => findProjectByUuid(database as any, uuid) as any,
            findAssetByClientId: (database, clientId, projectId) =>
                findAssetByClientId(database as any, clientId, projectId) as any,
            updateAsset: (database, id, data) => updateAsset(database as any, id, data) as any,
        });

        // Clean temp project directory
        await fs.remove(path.join(tempDir, 'assets', testProjectUuid));
        await fs.ensureDir(path.join(tempDir, 'assets', testProjectUuid));
    });

    // ============================================================================
    // LIST FOLDER CONTENTS TESTS
    // ============================================================================

    describe('GET /api/projects/:projectId/filemanager', () => {
        it('should return folder contents at root', async () => {
            // Create some assets
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'root.png',
                storage_path: '/root.png',
                folder_path: '',
            });
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'nested.png',
                storage_path: '/nested.png',
                folder_path: 'images',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager`),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.currentPath).toBe('');
            expect(data.data.breadcrumbs).toEqual([]);
            expect(data.data.folders).toContain('images');
            expect(data.data.files.length).toBe(1);
            expect(data.data.files[0].filename).toBe('root.png');
        });

        it('should return folder contents with path query', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'icon.svg',
                storage_path: '/icon.svg',
                folder_path: 'images/icons',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager?path=images`),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.currentPath).toBe('images');
            expect(data.data.breadcrumbs).toEqual(['images']);
            expect(data.data.folders).toContain('icons');
        });

        it('should return 404 for non-existent project', async () => {
            const response = await app.handle(
                new Request('http://localhost/api/projects/non-existent-uuid/filemanager'),
            );

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.success).toBe(false);
        });

        it('should return 400 for invalid path', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager?path=invalid:path`),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toContain('Invalid');
        });
    });

    // ============================================================================
    // FOLDER OPERATIONS TESTS
    // ============================================================================

    describe('POST /api/projects/:projectId/filemanager/folder', () => {
        it('should create a folder', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/folder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'new-folder' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.path).toBe('new-folder');
        });

        it('should fail for invalid folder name', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/folder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'invalid:folder' }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
        });
    });

    describe('DELETE /api/projects/:projectId/filemanager/folder', () => {
        it('should delete a folder and its contents', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: 'delete-me',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/folder`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'delete-me' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.deletedCount).toBe(1);
        });

        it('should fail when trying to delete root (empty path)', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/folder`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: '' }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            // Empty path is treated as "no path provided"
            expect(data.error).toBe('Folder path is required');
        });
    });

    describe('PATCH /api/projects/:projectId/filemanager/folder', () => {
        it('should rename a folder', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: 'old-name',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/folder`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPath: 'old-name', newPath: 'new-name' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.updatedCount).toBe(1);
        });

        it('should fail if source folder does not exist', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/folder`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPath: 'nonexistent', newPath: 'new' }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
        });
    });

    // ============================================================================
    // MOVE OPERATIONS TESTS
    // ============================================================================

    describe('POST /api/projects/:projectId/filemanager/move', () => {
        it('should move files to destination', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'moveme.txt',
                storage_path: '/moveme.txt',
                folder_path: 'source',
                client_id: 'move-client-id',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [{ type: 'file', clientId: 'move-client-id' }],
                        destination: 'dest',
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.movedCount).toBe(1);
        });

        it('should move folders to destination', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: 'source-folder',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [{ type: 'folder', path: 'source-folder' }],
                        destination: 'parent',
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
        });

        it('should fail for empty items array', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/move`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: [],
                        destination: 'dest',
                    }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
        });
    });

    // ============================================================================
    // FILE OPERATIONS TESTS
    // ============================================================================

    describe('POST /api/projects/:projectId/filemanager/duplicate', () => {
        it('should duplicate an asset', async () => {
            // Create source file on disk
            const sourceDir = path.join(tempDir, 'assets', testProjectUuid, 'original');
            await fs.ensureDir(sourceDir);
            await fs.writeFile(path.join(sourceDir, 'test.txt'), 'test content');

            const asset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'test.txt',
                storage_path: path.join(sourceDir, 'test.txt'),
                folder_path: '',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/duplicate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assetId: asset.id }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.newAsset).toBeDefined();
            expect(data.newAsset.filename).toContain('(copy)');
        });

        it('should fail for non-existent asset', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/duplicate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assetId: 99999 }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
        });
    });

    describe('PATCH /api/projects/:projectId/filemanager/rename', () => {
        it('should rename a file', async () => {
            const asset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'old-name.txt',
                storage_path: '/old-name.txt',
                folder_path: '',
                client_id: 'rename-client-id',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/rename`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientId: 'rename-client-id',
                        newFilename: 'new-name.txt',
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.asset.filename).toBe('new-name.txt');
        });

        it('should fail for invalid filename', async () => {
            await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'file.txt',
                storage_path: '/file.txt',
                folder_path: '',
                client_id: 'invalid-rename-id',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/rename`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientId: 'invalid-rename-id',
                        newFilename: 'invalid:name.txt',
                    }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toContain('Invalid');
        });

        it('should fail for non-existent asset', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/rename`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientId: 'nonexistent-id',
                        newFilename: 'new-name.txt',
                    }),
                }),
            );

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.success).toBe(false);
        });
    });

    // ============================================================================
    // ZIP EXTRACTION TESTS
    // ============================================================================

    describe('POST /api/projects/:projectId/filemanager/extract-zip', () => {
        it('should extract ZIP contents', async () => {
            // Create a ZIP file
            const zipContent: Record<string, Uint8Array> = {
                'index.html': new TextEncoder().encode('<html></html>'),
                'css/style.css': new TextEncoder().encode('body {}'),
            };
            const zipped = fflate.zipSync(zipContent);

            // Save ZIP to disk
            const zipPath = path.join(tempDir, 'assets', testProjectUuid, 'website.zip');
            await fs.ensureDir(path.dirname(zipPath));
            await fs.writeFile(zipPath, Buffer.from(zipped));

            // Create ZIP asset record
            const zipAsset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'website.zip',
                storage_path: zipPath,
                folder_path: '',
                mime_type: 'application/zip',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/extract-zip`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assetId: zipAsset.id,
                        targetFolder: 'extracted',
                    }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.extractedCount).toBe(2);
            expect(data.folders).toContain('extracted/css');
        });

        it('should fail for non-ZIP asset', async () => {
            const asset = await assetQueries.createAsset(db, {
                project_id: testProjectId,
                filename: 'image.png',
                storage_path: '/image.png',
                folder_path: '',
                mime_type: 'image/png',
            });

            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/extract-zip`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assetId: asset.id,
                        targetFolder: 'extracted',
                    }),
                }),
            );

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toContain('ZIP');
        });
    });

    // ============================================================================
    // VALIDATION HELPERS TESTS
    // ============================================================================

    describe('POST /api/projects/:projectId/filemanager/validate-name', () => {
        it('should validate a valid name', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/validate-name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'valid-name' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.isValid).toBe(true);
            expect(data.sanitized).toBe('valid-name');
        });

        it('should sanitize an invalid name', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/validate-name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'invalid:name' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.isValid).toBe(false);
            expect(data.sanitized).toBe('invalid_name');
        });
    });

    describe('POST /api/projects/:projectId/filemanager/validate-path', () => {
        it('should validate a valid path', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/validate-path`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'valid/path/here' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.isValid).toBe(true);
        });

        it('should reject an invalid path', async () => {
            const response = await app.handle(
                new Request(`http://localhost/api/projects/${testProjectUuid}/filemanager/validate-path`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: 'invalid/path:here' }),
                }),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.isValid).toBe(false);
        });
    });
});
