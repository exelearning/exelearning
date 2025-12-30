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
});
