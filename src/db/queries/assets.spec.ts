/**
 * Tests for Asset Queries
 * Uses real in-memory SQLite database with dependency injection (no mocks)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { createTestDb, cleanTestDb, destroyTestDb, seedTestUser, seedTestProject } from '../../../test/helpers/test-db';
import type { Kysely } from 'kysely';
import type { Database } from '../types';
import {
    findAssetById,
    findAssetByIdWithProject,
    findAssetByClientId,
    findAssetsByClientIds,
    findAssetByHash,
    findAssetsByHashes,
    findAllAssetsForProject,
    getProjectStorageSize,
    getUserStorageUsage,
    createAsset,
    createAssets,
    updateAsset,
    updateAssetClientId,
    deleteAsset,
    deleteAllAssetsForProject,
    bulkUpdateClientIds,
    // Folder queries
    findAssetsInFolder,
    findAssetByPath,
    getSubfolders,
    countAssetsInFolderRecursive,
    updateAssetFolderPath,
    updateFolderPathPrefix,
    deleteAssetsInFolderRecursive,
    bulkUpdateAssets,
} from './assets';
import { createUser } from './users';
import { createProject } from './projects';

describe('Asset Queries', () => {
    let db: Kysely<Database>;
    let testUserId: number;
    let testProjectId: number;

    beforeAll(async () => {
        db = await createTestDb();
    });

    afterAll(async () => {
        await destroyTestDb(db);
    });

    beforeEach(async () => {
        await cleanTestDb(db);
        testUserId = await seedTestUser(db);
        testProjectId = await seedTestProject(db, testUserId);
    });

    // ============================================================================
    // CREATE QUERIES
    // ============================================================================

    describe('createAsset', () => {
        it('should create an asset with required fields', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'image.png',
                storage_path: '/files/tmp/123/image.png',
            });

            expect(asset.id).toBeDefined();
            expect(asset.filename).toBe('image.png');
            expect(asset.storage_path).toBe('/files/tmp/123/image.png');
            expect(asset.project_id).toBe(testProjectId);
        });

        it('should create an asset with optional fields', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'document.pdf',
                storage_path: '/files/tmp/123/doc.pdf',
                mime_type: 'application/pdf',
                file_size: '1048576',
                client_id: 'client-123',
                component_id: 'idevice-456',
                content_hash: 'sha256-abc123',
            });

            expect(asset.mime_type).toBe('application/pdf');
            expect(asset.file_size).toBe('1048576');
            expect(asset.client_id).toBe('client-123');
            expect(asset.component_id).toBe('idevice-456');
            expect(asset.content_hash).toBe('sha256-abc123');
        });

        it('should set timestamps', async () => {
            const before = Date.now();
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'test.png',
                storage_path: '/path',
            });
            const after = Date.now();

            expect(asset.created_at).toBeDefined();
            expect(asset.updated_at).toBeDefined();
            expect(asset.created_at!).toBeGreaterThanOrEqual(before);
            expect(asset.created_at!).toBeLessThanOrEqual(after);
        });
    });

    describe('createAssets', () => {
        it('should create multiple assets', async () => {
            const assets = await createAssets(db, [
                { project_id: testProjectId, filename: 'a1.png', storage_path: '/a1' },
                { project_id: testProjectId, filename: 'a2.png', storage_path: '/a2' },
                { project_id: testProjectId, filename: 'a3.png', storage_path: '/a3' },
            ]);

            expect(assets.length).toBe(3);
            expect(assets.map(a => a.filename).sort()).toEqual(['a1.png', 'a2.png', 'a3.png']);
        });

        it('should return empty array for empty input', async () => {
            const assets = await createAssets(db, []);
            expect(assets).toEqual([]);
        });
    });

    // ============================================================================
    // READ QUERIES
    // ============================================================================

    describe('findAssetById', () => {
        it('should find existing asset', async () => {
            const created = await createAsset(db, {
                project_id: testProjectId,
                filename: 'find-me.png',
                storage_path: '/path/to/file',
            });

            const found = await findAssetById(db, created.id);

            expect(found).toBeDefined();
            expect(found?.filename).toBe('find-me.png');
        });

        it('should return undefined for non-existent ID', async () => {
            const found = await findAssetById(db, 99999);
            expect(found).toBeUndefined();
        });
    });

    describe('findAssetByIdWithProject', () => {
        it('should find asset with project data', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'with-project.png',
                storage_path: '/path',
            });

            const found = await findAssetByIdWithProject(db, asset.id);

            expect(found).toBeDefined();
            expect(found?.project).toBeDefined();
            expect(found?.project.id).toBe(testProjectId);
            expect(found?.project.title).toBeDefined();
        });

        it('should return undefined for non-existent asset', async () => {
            const found = await findAssetByIdWithProject(db, 99999);
            expect(found).toBeUndefined();
        });
    });

    describe('findAssetByClientId', () => {
        it('should find asset by client_id and project_id', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'client-asset.png',
                storage_path: '/path/file',
                client_id: 'unique-client-id',
            });

            const found = await findAssetByClientId(db, 'unique-client-id', testProjectId);

            expect(found).toBeDefined();
            expect(found?.client_id).toBe('unique-client-id');
        });

        it('should not find asset with wrong project_id', async () => {
            const otherProjectId = await seedTestProject(db, testUserId, {
                title: 'Other',
                uuid: `other-proj-${Date.now()}-1`,
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'asset.png',
                storage_path: '/path',
                client_id: 'client-abc',
            });

            const found = await findAssetByClientId(db, 'client-abc', otherProjectId);
            expect(found).toBeUndefined();
        });

        it('should find asset without project_id filter', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'any.png',
                storage_path: '/path',
                client_id: 'global-client',
            });

            const found = await findAssetByClientId(db, 'global-client');
            expect(found).toBeDefined();
        });
    });

    describe('findAssetsByClientIds', () => {
        it('should find multiple assets by client IDs', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                client_id: 'id-1',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.png',
                storage_path: '/b',
                client_id: 'id-2',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.png',
                storage_path: '/c',
                client_id: 'id-3',
            });

            const assets = await findAssetsByClientIds(db, ['id-1', 'id-3'], testProjectId);

            expect(assets.length).toBe(2);
            expect(assets.map(a => a.client_id).sort()).toEqual(['id-1', 'id-3']);
        });

        it('should return empty array for empty input', async () => {
            const assets = await findAssetsByClientIds(db, [], testProjectId);
            expect(assets).toEqual([]);
        });
    });

    describe('findAssetByHash', () => {
        it('should find asset by content hash', async () => {
            const hash = 'sha256-unique-hash';
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'hashed.png',
                storage_path: '/hash',
                content_hash: hash,
            });

            const found = await findAssetByHash(db, testProjectId, hash);

            expect(found).toBeDefined();
            expect(found?.content_hash).toBe(hash);
        });

        it('should enable content deduplication', async () => {
            const hash = 'sha256-dedupe';
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'original.png',
                storage_path: '/original',
                content_hash: hash,
            });

            // Check if same content already exists
            const existing = await findAssetByHash(db, testProjectId, hash);
            expect(existing).toBeDefined();
            expect(existing?.filename).toBe('original.png');
        });
    });

    describe('findAssetsByHashes', () => {
        it('should find multiple assets by hashes', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'h1.png',
                storage_path: '/h1',
                content_hash: 'hash-1',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'h2.png',
                storage_path: '/h2',
                content_hash: 'hash-2',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'h3.png',
                storage_path: '/h3',
                content_hash: 'hash-3',
            });

            const assets = await findAssetsByHashes(db, testProjectId, ['hash-1', 'hash-3']);

            expect(assets.length).toBe(2);
        });

        it('should return empty array for empty input', async () => {
            const assets = await findAssetsByHashes(db, testProjectId, []);
            expect(assets).toEqual([]);
        });
    });

    describe('findAllAssetsForProject', () => {
        it('should return all assets for a project', async () => {
            await createAsset(db, { project_id: testProjectId, filename: 'a1.png', storage_path: '/a1' });
            await createAsset(db, { project_id: testProjectId, filename: 'a2.png', storage_path: '/a2' });
            await createAsset(db, { project_id: testProjectId, filename: 'a3.png', storage_path: '/a3' });

            const assets = await findAllAssetsForProject(db, testProjectId);

            expect(assets.length).toBe(3);
        });

        it('should not include assets from other projects', async () => {
            const otherProjectId = await seedTestProject(db, testUserId, {
                title: 'Other',
                uuid: `other-proj-${Date.now()}-2`,
            });
            await createAsset(db, { project_id: testProjectId, filename: 'mine.png', storage_path: '/m' });
            await createAsset(db, { project_id: otherProjectId, filename: 'other.png', storage_path: '/o' });

            const assets = await findAllAssetsForProject(db, testProjectId);

            expect(assets.length).toBe(1);
            expect(assets[0].filename).toBe('mine.png');
        });

        it('should return empty array for project with no assets', async () => {
            const assets = await findAllAssetsForProject(db, testProjectId);
            expect(assets).toEqual([]);
        });
    });

    describe('getProjectStorageSize', () => {
        it('should return total size of assets', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                file_size: '1000',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.png',
                storage_path: '/b',
                file_size: '2000',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.png',
                storage_path: '/c',
                file_size: '3000',
            });

            const size = await getProjectStorageSize(db, testProjectId);

            expect(size).toBe(6000);
        });

        it('should return 0 for project with no assets', async () => {
            const size = await getProjectStorageSize(db, testProjectId);
            expect(size).toBe(0);
        });
    });

    describe('getUserStorageUsage', () => {
        it('should return total size of all user projects assets', async () => {
            // Create a second project for the same user
            const project2 = await createProject(db, {
                title: 'Project 2',
                owner_id: testUserId,
            });

            // Add assets to first project
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                file_size: '1000',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.png',
                storage_path: '/b',
                file_size: '2000',
            });

            // Add assets to second project
            await createAsset(db, {
                project_id: project2.id,
                filename: 'c.png',
                storage_path: '/c',
                file_size: '3000',
            });

            const totalSize = await getUserStorageUsage(db, testUserId);

            expect(totalSize).toBe(6000); // 1000 + 2000 + 3000
        });

        it('should return 0 for user with no projects', async () => {
            // Create a user with no projects
            const newUser = await createUser(db, {
                email: 'noassets@test.com',
                user_id: 'noassets',
                password: 'test',
            });

            const size = await getUserStorageUsage(db, newUser.id);
            expect(size).toBe(0);
        });

        it('should return 0 for user with projects but no assets', async () => {
            const size = await getUserStorageUsage(db, testUserId);
            expect(size).toBe(0);
        });

        it('should only count assets from user owned projects', async () => {
            // Create another user with a project
            const otherUser = await createUser(db, {
                email: 'other@test.com',
                user_id: 'other',
                password: 'test',
            });
            const otherProject = await createProject(db, {
                title: 'Other Project',
                owner_id: otherUser.id,
            });

            // Add assets to test user's project
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'mine.png',
                storage_path: '/mine',
                file_size: '1000',
            });

            // Add assets to other user's project
            await createAsset(db, {
                project_id: otherProject.id,
                filename: 'theirs.png',
                storage_path: '/theirs',
                file_size: '5000',
            });

            const testUserSize = await getUserStorageUsage(db, testUserId);
            const otherUserSize = await getUserStorageUsage(db, otherUser.id);

            expect(testUserSize).toBe(1000);
            expect(otherUserSize).toBe(5000);
        });
    });

    // ============================================================================
    // UPDATE QUERIES
    // ============================================================================

    describe('updateAsset', () => {
        it('should update asset fields', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'old.png',
                storage_path: '/old',
            });

            const updated = await updateAsset(db, asset.id, {
                filename: 'new.png',
                mime_type: 'image/png',
            });

            expect(updated?.filename).toBe('new.png');
            expect(updated?.mime_type).toBe('image/png');
        });

        it('should return undefined for non-existent asset', async () => {
            const updated = await updateAsset(db, 99999, { filename: 'test.png' });
            expect(updated).toBeUndefined();
        });
    });

    describe('updateAssetClientId', () => {
        it('should update only client_id', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'test.png',
                storage_path: '/path',
                client_id: 'old-client',
            });

            await updateAssetClientId(db, asset.id, 'new-client');

            const found = await findAssetById(db, asset.id);
            expect(found?.client_id).toBe('new-client');
        });
    });

    describe('bulkUpdateClientIds', () => {
        it('should update multiple client IDs', async () => {
            const a1 = await createAsset(db, { project_id: testProjectId, filename: 'a1.png', storage_path: '/a1' });
            const a2 = await createAsset(db, { project_id: testProjectId, filename: 'a2.png', storage_path: '/a2' });

            await bulkUpdateClientIds(db, [
                { id: a1.id, clientId: 'bulk-1' },
                { id: a2.id, clientId: 'bulk-2' },
            ]);

            const found1 = await findAssetById(db, a1.id);
            const found2 = await findAssetById(db, a2.id);

            expect(found1?.client_id).toBe('bulk-1');
            expect(found2?.client_id).toBe('bulk-2');
        });
    });

    // ============================================================================
    // DELETE QUERIES
    // ============================================================================

    describe('deleteAsset', () => {
        it('should delete asset', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'delete.png',
                storage_path: '/delete',
            });

            await deleteAsset(db, asset.id);

            const found = await findAssetById(db, asset.id);
            expect(found).toBeUndefined();
        });
    });

    describe('deleteAllAssetsForProject', () => {
        it('should delete all assets for project', async () => {
            await createAsset(db, { project_id: testProjectId, filename: 'a1.png', storage_path: '/a1' });
            await createAsset(db, { project_id: testProjectId, filename: 'a2.png', storage_path: '/a2' });
            await createAsset(db, { project_id: testProjectId, filename: 'a3.png', storage_path: '/a3' });

            const count = await deleteAllAssetsForProject(db, testProjectId);

            expect(count).toBe(3);

            const remaining = await findAllAssetsForProject(db, testProjectId);
            expect(remaining.length).toBe(0);
        });

        it('should not delete other projects assets', async () => {
            const otherProjectId = await seedTestProject(db, testUserId, {
                title: 'Other',
                uuid: `other-proj-${Date.now()}-3`,
            });
            await createAsset(db, { project_id: testProjectId, filename: 'mine.png', storage_path: '/m' });
            await createAsset(db, { project_id: otherProjectId, filename: 'other.png', storage_path: '/o' });

            await deleteAllAssetsForProject(db, testProjectId);

            const otherAssets = await findAllAssetsForProject(db, otherProjectId);
            expect(otherAssets.length).toBe(1);
        });

        it('should return 0 for project with no assets', async () => {
            const count = await deleteAllAssetsForProject(db, testProjectId);
            expect(count).toBe(0);
        });
    });

    // ============================================================================
    // FOLDER QUERIES
    // ============================================================================

    describe('findAssetsInFolder', () => {
        it('should find assets in root folder (empty string)', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'root.png',
                storage_path: '/root',
                folder_path: '',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'nested.png',
                storage_path: '/nested',
                folder_path: 'images',
            });

            const assets = await findAssetsInFolder(db, testProjectId, '');

            expect(assets.length).toBe(1);
            expect(assets[0].filename).toBe('root.png');
        });

        it('should find assets in specific folder', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                folder_path: 'images',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.png',
                storage_path: '/b',
                folder_path: 'images',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.png',
                storage_path: '/c',
                folder_path: 'images/icons',
            });

            const assets = await findAssetsInFolder(db, testProjectId, 'images');

            expect(assets.length).toBe(2);
            expect(assets.map(a => a.filename).sort()).toEqual(['a.png', 'b.png']);
        });

        it('should find assets in nested folder', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'icon.svg',
                storage_path: '/icon',
                folder_path: 'website/assets/icons',
            });

            const assets = await findAssetsInFolder(db, testProjectId, 'website/assets/icons');

            expect(assets.length).toBe(1);
            expect(assets[0].filename).toBe('icon.svg');
        });

        it('should return empty array for empty folder', async () => {
            const assets = await findAssetsInFolder(db, testProjectId, 'nonexistent');
            expect(assets).toEqual([]);
        });

        it('should sort assets by filename', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'zebra.png',
                storage_path: '/z',
                folder_path: 'sorted',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'alpha.png',
                storage_path: '/a',
                folder_path: 'sorted',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'beta.png',
                storage_path: '/b',
                folder_path: 'sorted',
            });

            const assets = await findAssetsInFolder(db, testProjectId, 'sorted');

            expect(assets.map(a => a.filename)).toEqual(['alpha.png', 'beta.png', 'zebra.png']);
        });
    });

    describe('findAssetByPath', () => {
        it('should find asset by folder_path and filename', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'style.css',
                storage_path: '/style',
                folder_path: 'website/css',
            });

            const found = await findAssetByPath(db, testProjectId, 'website/css', 'style.css');

            expect(found).toBeDefined();
            expect(found?.filename).toBe('style.css');
            expect(found?.folder_path).toBe('website/css');
        });

        it('should not find asset with same name in different folder', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'index.html',
                storage_path: '/idx1',
                folder_path: 'site1',
            });

            const found = await findAssetByPath(db, testProjectId, 'site2', 'index.html');

            expect(found).toBeUndefined();
        });

        it('should detect conflicts for duplicate filenames in same folder', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'app.js',
                storage_path: '/app',
                folder_path: 'js',
            });

            const existing = await findAssetByPath(db, testProjectId, 'js', 'app.js');

            expect(existing).toBeDefined();
            // This enables conflict detection before upload
        });

        it('should return undefined for non-existent path', async () => {
            const found = await findAssetByPath(db, testProjectId, 'fake/path', 'fake.txt');
            expect(found).toBeUndefined();
        });
    });

    describe('getSubfolders', () => {
        it('should get immediate subfolders from root', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                folder_path: 'images',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.css',
                storage_path: '/b',
                folder_path: 'css',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.js',
                storage_path: '/c',
                folder_path: 'js',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'd.png',
                storage_path: '/d',
                folder_path: 'images/icons', // Nested, should not appear as immediate subfolder
            });

            const subfolders = await getSubfolders(db, testProjectId, '');

            expect(subfolders.sort()).toEqual(['css', 'images', 'js']);
        });

        it('should get subfolders under a parent path', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                folder_path: 'website/images',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.css',
                storage_path: '/b',
                folder_path: 'website/css',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.js',
                storage_path: '/c',
                folder_path: 'website/js',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'd.png',
                storage_path: '/d',
                folder_path: 'website/images/icons', // Deep nested
            });

            const subfolders = await getSubfolders(db, testProjectId, 'website');

            expect(subfolders.sort()).toEqual(['css', 'images', 'js']);
        });

        it('should return unique subfolder names', async () => {
            // Multiple assets in same folder should only show folder once
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                folder_path: 'images',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.png',
                storage_path: '/b',
                folder_path: 'images',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.png',
                storage_path: '/c',
                folder_path: 'images',
            });

            const subfolders = await getSubfolders(db, testProjectId, '');

            expect(subfolders).toEqual(['images']);
        });

        it('should return empty array for leaf folder', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'icon.svg',
                storage_path: '/icon',
                folder_path: 'icons',
            });

            const subfolders = await getSubfolders(db, testProjectId, 'icons');

            expect(subfolders).toEqual([]);
        });

        it('should return sorted subfolder names', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.txt',
                storage_path: '/a',
                folder_path: 'zebra',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.txt',
                storage_path: '/b',
                folder_path: 'alpha',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.txt',
                storage_path: '/c',
                folder_path: 'beta',
            });

            const subfolders = await getSubfolders(db, testProjectId, '');

            expect(subfolders).toEqual(['alpha', 'beta', 'zebra']);
        });
    });

    describe('countAssetsInFolderRecursive', () => {
        it('should count all assets in folder and subfolders', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                folder_path: 'website',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.css',
                storage_path: '/b',
                folder_path: 'website/css',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.js',
                storage_path: '/c',
                folder_path: 'website/js',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'd.svg',
                storage_path: '/d',
                folder_path: 'website/images/icons',
            });

            const count = await countAssetsInFolderRecursive(db, testProjectId, 'website');

            expect(count).toBe(4);
        });

        it('should count only assets in specified folder tree', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.css',
                storage_path: '/a',
                folder_path: 'css',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.js',
                storage_path: '/b',
                folder_path: 'js',
            });

            const cssCount = await countAssetsInFolderRecursive(db, testProjectId, 'css');
            const jsCount = await countAssetsInFolderRecursive(db, testProjectId, 'js');

            expect(cssCount).toBe(1);
            expect(jsCount).toBe(1);
        });

        it('should return 0 for empty folder', async () => {
            const count = await countAssetsInFolderRecursive(db, testProjectId, 'nonexistent');
            expect(count).toBe(0);
        });

        it('should count all assets when starting from root', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'root.txt',
                storage_path: '/root',
                folder_path: '',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'nested.txt',
                storage_path: '/nested',
                folder_path: 'folder',
            });

            const count = await countAssetsInFolderRecursive(db, testProjectId, '');

            expect(count).toBe(2);
        });
    });

    describe('updateAssetFolderPath', () => {
        it('should move asset to new folder', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'moveme.png',
                storage_path: '/moveme',
                folder_path: 'old-folder',
            });

            const updated = await updateAssetFolderPath(db, asset.id, 'new-folder');

            expect(updated).toBeDefined();
            expect(updated?.folder_path).toBe('new-folder');
        });

        it('should move asset to root', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'toroot.png',
                storage_path: '/toroot',
                folder_path: 'some/deep/path',
            });

            const updated = await updateAssetFolderPath(db, asset.id, '');

            expect(updated?.folder_path).toBe('');
        });

        it('should update timestamp', async () => {
            const asset = await createAsset(db, {
                project_id: testProjectId,
                filename: 'timestamp.png',
                storage_path: '/ts',
                folder_path: '',
            });

            const originalUpdatedAt = asset.updated_at;

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            const updated = await updateAssetFolderPath(db, asset.id, 'new-folder');

            expect(updated?.updated_at).toBeGreaterThan(originalUpdatedAt!);
        });

        it('should return undefined for non-existent asset', async () => {
            const result = await updateAssetFolderPath(db, 99999, 'folder');
            expect(result).toBeUndefined();
        });
    });

    describe('updateFolderPathPrefix', () => {
        it('should rename folder by updating all asset prefixes', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                folder_path: 'old-name',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.css',
                storage_path: '/b',
                folder_path: 'old-name/css',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.js',
                storage_path: '/c',
                folder_path: 'old-name/js',
            });

            const count = await updateFolderPathPrefix(db, testProjectId, 'old-name', 'new-name');

            expect(count).toBe(3);

            // Verify all paths updated
            const inOld = await findAssetsInFolder(db, testProjectId, 'old-name');
            expect(inOld.length).toBe(0);

            const inNew = await findAssetsInFolder(db, testProjectId, 'new-name');
            expect(inNew.length).toBe(1);

            const inNewCss = await findAssetsInFolder(db, testProjectId, 'new-name/css');
            expect(inNewCss.length).toBe(1);
        });

        it('should move folder to new parent', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'icon.svg',
                storage_path: '/icon',
                folder_path: 'images/icons',
            });

            await updateFolderPathPrefix(db, testProjectId, 'images/icons', 'assets/icons');

            const moved = await findAssetsInFolder(db, testProjectId, 'assets/icons');
            expect(moved.length).toBe(1);
            expect(moved[0].filename).toBe('icon.svg');
        });

        it('should not affect assets in other projects', async () => {
            const otherProjectId = await seedTestProject(db, testUserId, {
                title: 'Other',
                uuid: `other-proj-${Date.now()}-4`,
            });

            await createAsset(db, {
                project_id: testProjectId,
                filename: 'mine.png',
                storage_path: '/mine',
                folder_path: 'shared-name',
            });
            await createAsset(db, {
                project_id: otherProjectId,
                filename: 'theirs.png',
                storage_path: '/theirs',
                folder_path: 'shared-name',
            });

            await updateFolderPathPrefix(db, testProjectId, 'shared-name', 'renamed');

            // My asset moved
            const myAssets = await findAssetsInFolder(db, testProjectId, 'renamed');
            expect(myAssets.length).toBe(1);

            // Their asset stayed
            const theirAssets = await findAssetsInFolder(db, otherProjectId, 'shared-name');
            expect(theirAssets.length).toBe(1);
        });

        it('should return 0 for non-existent folder', async () => {
            const count = await updateFolderPathPrefix(db, testProjectId, 'nonexistent', 'new');
            expect(count).toBe(0);
        });
    });

    describe('deleteAssetsInFolderRecursive', () => {
        it('should delete all assets in folder and subfolders', async () => {
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'a.png',
                storage_path: '/a',
                folder_path: 'delete-me',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'b.css',
                storage_path: '/b',
                folder_path: 'delete-me/css',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'c.js',
                storage_path: '/c',
                folder_path: 'delete-me/js/vendor',
            });
            await createAsset(db, {
                project_id: testProjectId,
                filename: 'keep.txt',
                storage_path: '/keep',
                folder_path: 'keep-me',
            });

            const count = await deleteAssetsInFolderRecursive(db, testProjectId, 'delete-me');

            expect(count).toBe(3);

            // Verify deleted
            const deleted = await findAssetsInFolder(db, testProjectId, 'delete-me');
            expect(deleted.length).toBe(0);

            // Verify kept
            const kept = await findAssetsInFolder(db, testProjectId, 'keep-me');
            expect(kept.length).toBe(1);
        });

        it('should return 0 for empty folder', async () => {
            const count = await deleteAssetsInFolderRecursive(db, testProjectId, 'nonexistent');
            expect(count).toBe(0);
        });

        it('should not delete assets from other projects', async () => {
            const otherProjectId = await seedTestProject(db, testUserId, {
                title: 'Other',
                uuid: `other-proj-${Date.now()}-5`,
            });

            await createAsset(db, {
                project_id: testProjectId,
                filename: 'mine.png',
                storage_path: '/mine',
                folder_path: 'shared-folder',
            });
            await createAsset(db, {
                project_id: otherProjectId,
                filename: 'theirs.png',
                storage_path: '/theirs',
                folder_path: 'shared-folder',
            });

            await deleteAssetsInFolderRecursive(db, testProjectId, 'shared-folder');

            // Their asset should remain
            const theirAssets = await findAssetsInFolder(db, otherProjectId, 'shared-folder');
            expect(theirAssets.length).toBe(1);
        });
    });

    describe('bulkUpdateAssets', () => {
        it('should update multiple assets at once', async () => {
            const a1 = await createAsset(db, {
                project_id: testProjectId,
                filename: 'a1.png',
                storage_path: '/a1',
            });
            const a2 = await createAsset(db, {
                project_id: testProjectId,
                filename: 'a2.png',
                storage_path: '/a2',
            });

            await bulkUpdateAssets(db, [
                { id: a1.id, data: { folder_path: 'folder1', filename: 'renamed1.png' } },
                { id: a2.id, data: { folder_path: 'folder2', filename: 'renamed2.png' } },
            ]);

            const found1 = await findAssetById(db, a1.id);
            const found2 = await findAssetById(db, a2.id);

            expect(found1?.folder_path).toBe('folder1');
            expect(found1?.filename).toBe('renamed1.png');
            expect(found2?.folder_path).toBe('folder2');
            expect(found2?.filename).toBe('renamed2.png');
        });

        it('should do nothing for empty input', async () => {
            // Should not throw
            await bulkUpdateAssets(db, []);
        });
    });
});
