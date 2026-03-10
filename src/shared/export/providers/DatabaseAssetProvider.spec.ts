import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { DatabaseAssetProvider, type DatabaseAssetProviderQueries } from './DatabaseAssetProvider';
import type { Kysely } from 'kysely';
import type { Database, Asset } from '../../../db/types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('DatabaseAssetProvider', () => {
    let tempDir: string;
    // Minimal mock database (actual queries are mocked)
    const mockDb = {} as Kysely<Database>;

    // Mock database asset
    const createMockDbAsset = (overrides: Partial<Asset> = {}): Asset => ({
        id: 1,
        project_id: 1,
        client_id: 'asset-uuid-123',
        filename: 'test-image.png',
        mime_type: 'image/png',
        storage_path: '',
        file_size: '1024',
        component_id: null,
        content_hash: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    });

    // Create mock queries that return nothing by default
    const createMockQueries = (
        overrides: Partial<DatabaseAssetProviderQueries> = {},
    ): DatabaseAssetProviderQueries => ({
        findAssetByClientId: async () => undefined,
        findAllAssetsForProject: async () => [],
        ...overrides,
    });

    beforeEach(async () => {
        // Create temp directory for test files
        tempDir = path.join(os.tmpdir(), `db-asset-provider-test-${Date.now()}`);
        await fs.ensureDir(tempDir);
        await fs.ensureDir(path.join(tempDir, 'assets'));

        // Create a test asset file in session directory
        const assetDir = path.join(tempDir, 'assets', 'asset-uuid-123');
        await fs.ensureDir(assetDir);
        await fs.writeFile(path.join(assetDir, 'test-image.png'), Buffer.from('mock image data'));
    });

    afterEach(async () => {
        // Clean up temp directory
        if (tempDir && (await fs.pathExists(tempDir))) {
            await fs.remove(tempDir);
        }
    });

    describe('constructor', () => {
        it('should create provider with database and project ID', () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());
            expect(provider).toBeDefined();
        });

        it('should create provider with optional session path', () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            expect(provider).toBeDefined();
        });
    });

    describe('getAsset', () => {
        it('should return null when asset not found in database or session', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());
            const result = await provider.getAsset('nonexistent-uuid/file.png');
            expect(result).toBeNull();
        });

        it('should find asset from database when storage_path exists', async () => {
            // Create asset file at storage path
            const storagePath = path.join(tempDir, 'db-storage', 'asset.png');
            await fs.ensureDir(path.dirname(storagePath));
            await fs.writeFile(storagePath, Buffer.from('db asset data'));

            const mockQueries = createMockQueries({
                findAssetByClientId: async () =>
                    createMockDbAsset({
                        client_id: 'db-asset-uuid',
                        filename: 'asset.png',
                        storage_path: storagePath,
                    }),
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, mockQueries);
            const result = await provider.getAsset('db-asset-uuid/asset.png');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('db-asset-uuid');
            expect(result?.data.toString()).toBe('db asset data');
        });

        it('should normalize path by removing leading slash', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAsset('/asset-uuid-123/test-image.png');
            expect(result).not.toBeNull();
        });

        it('should normalize path by removing content/resources prefix', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAsset('content/resources/asset-uuid-123/test-image.png');
            expect(result).not.toBeNull();
        });

        it('should find asset in session path assets directory', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAsset('asset-uuid-123/test-image.png');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('asset-uuid-123');
            expect(result?.filename).toBe('test-image.png');
            expect(result?.mime).toBe('image/png');
        });

        it('should cache assets after first lookup', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());

            // First lookup
            const result1 = await provider.getAsset('asset-uuid-123/test-image.png');
            expect(result1).not.toBeNull();

            // Second lookup should use cache (same result)
            const result2 = await provider.getAsset('asset-uuid-123/test-image.png');
            expect(result2).toBe(result1); // Same reference from cache
        });

        it('should find asset by client ID only (without filename)', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAsset('asset-uuid-123');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('asset-uuid-123');
        });

        it('should prefer database result over session path', async () => {
            // Create DB asset file
            const dbStoragePath = path.join(tempDir, 'db-storage', 'db-image.png');
            await fs.ensureDir(path.dirname(dbStoragePath));
            await fs.writeFile(dbStoragePath, Buffer.from('database content'));

            const mockQueries = createMockQueries({
                findAssetByClientId: async () =>
                    createMockDbAsset({
                        client_id: 'asset-uuid-123',
                        filename: 'db-image.png',
                        storage_path: dbStoragePath,
                    }),
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, mockQueries);
            const result = await provider.getAsset('asset-uuid-123/test-image.png');

            // Should get database content, not session content
            expect(result?.data.toString()).toBe('database content');
        });
    });

    describe('getAllAssets', () => {
        it('should return empty array when no assets found', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());
            const result = await provider.getAllAssets();
            expect(result).toEqual([]);
        });

        it('should return assets from database', async () => {
            const storagePath = path.join(tempDir, 'db-storage', 'db-asset.png');
            await fs.ensureDir(path.dirname(storagePath));
            await fs.writeFile(storagePath, Buffer.from('db asset content'));

            const mockQueries = createMockQueries({
                findAllAssetsForProject: async () => [
                    createMockDbAsset({
                        client_id: 'db-asset-1',
                        filename: 'db-asset.png',
                        storage_path: storagePath,
                    }),
                ],
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, mockQueries);
            const result = await provider.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].id).toBe('db-asset-1');
        });

        it('should collect assets from session path', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAllAssets();

            expect(result.length).toBeGreaterThan(0);
            const asset = result.find(a => a.id === 'asset-uuid-123');
            expect(asset).toBeDefined();
            expect(asset?.filename).toBe('test-image.png');
        });

        it('should skip directories without files', async () => {
            // Create empty asset directory
            await fs.ensureDir(path.join(tempDir, 'assets', 'empty-uuid'));

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAllAssets();

            // Should not include the empty directory
            const emptyAsset = result.find(a => a.id === 'empty-uuid');
            expect(emptyAsset).toBeUndefined();
        });

        it('should combine database and session assets', async () => {
            // Create DB asset
            const dbStoragePath = path.join(tempDir, 'db-storage', 'db-only.png');
            await fs.ensureDir(path.dirname(dbStoragePath));
            await fs.writeFile(dbStoragePath, Buffer.from('db only'));

            const mockQueries = createMockQueries({
                findAllAssetsForProject: async () => [
                    createMockDbAsset({
                        client_id: 'db-only-uuid',
                        filename: 'db-only.png',
                        storage_path: dbStoragePath,
                    }),
                ],
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, mockQueries);
            const result = await provider.getAllAssets();

            // Should have both DB asset and session asset
            const dbAsset = result.find(a => a.id === 'db-only-uuid');
            const sessionAsset = result.find(a => a.id === 'asset-uuid-123');

            expect(dbAsset).toBeDefined();
            expect(sessionAsset).toBeDefined();
        });

        it('should skip assets with missing storage files', async () => {
            const mockQueries = createMockQueries({
                findAllAssetsForProject: async () => [
                    createMockDbAsset({
                        client_id: 'missing-uuid',
                        filename: 'missing.png',
                        storage_path: '/nonexistent/path/missing.png',
                    }),
                ],
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, mockQueries);
            const result = await provider.getAllAssets();

            expect(result.length).toBe(0);
        });
    });

    describe('getProjectAssets', () => {
        it('should delegate to getAllAssets', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const allAssets = await provider.getAllAssets();
            const projectAssets = await provider.getProjectAssets();

            expect(projectAssets).toEqual(allAssets);
        });
    });

    describe('exists', () => {
        it('should return true when asset exists', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.exists('asset-uuid-123/test-image.png');
            expect(result).toBe(true);
        });

        it('should return false when asset does not exist', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.exists('nonexistent/file.png');
            expect(result).toBe(false);
        });
    });

    describe('getContent', () => {
        it('should return buffer content', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getContent('asset-uuid-123/test-image.png');

            expect(result).not.toBeNull();
            expect(Buffer.isBuffer(result)).toBe(true);
            expect(result?.toString()).toBe('mock image data');
        });

        it('should return null when asset not found', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getContent('nonexistent/file.png');
            expect(result).toBeNull();
        });
    });

    describe('getMimeType', () => {
        it('should return correct mime type for known extensions', () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());

            expect(provider.getMimeType('image.png')).toBe('image/png');
            expect(provider.getMimeType('image.jpg')).toBe('image/jpeg');
            expect(provider.getMimeType('image.jpeg')).toBe('image/jpeg');
            expect(provider.getMimeType('image.gif')).toBe('image/gif');
            expect(provider.getMimeType('image.webp')).toBe('image/webp');
            expect(provider.getMimeType('image.svg')).toBe('image/svg+xml');
            expect(provider.getMimeType('audio.mp3')).toBe('audio/mpeg');
            expect(provider.getMimeType('video.mp4')).toBe('video/mp4');
            expect(provider.getMimeType('doc.pdf')).toBe('application/pdf');
        });

        it('should return default mime type for unknown extensions', () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());
            expect(provider.getMimeType('file.xyz')).toBe('application/octet-stream');
            expect(provider.getMimeType('file.unknown')).toBe('application/octet-stream');
        });

        it('should handle paths with directories', () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());
            expect(provider.getMimeType('some/path/to/image.png')).toBe('image/png');
        });
    });

    describe('clearCache', () => {
        it('should clear the asset cache', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());

            // Populate cache
            await provider.getAsset('asset-uuid-123/test-image.png');

            // Clear cache
            provider.clearCache();

            // Modify the file
            const assetPath = path.join(tempDir, 'assets', 'asset-uuid-123', 'test-image.png');
            await fs.writeFile(assetPath, Buffer.from('modified data'));

            // Should read fresh data
            const result = await provider.getAsset('asset-uuid-123/test-image.png');
            expect(result?.data.toString()).toBe('modified data');
        });
    });

    describe('forEachAsset', () => {
        it('should iterate over session assets sequentially', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const processed: string[] = [];
            const count = await provider.forEachAsset(async asset => {
                processed.push(asset.id);
            });

            expect(count).toBeGreaterThan(0);
            expect(processed).toContain('asset-uuid-123');
        });

        it('should iterate over database assets', async () => {
            const storagePath = path.join(tempDir, 'db-storage', 'db-asset.png');
            await fs.ensureDir(path.dirname(storagePath));
            await fs.writeFile(storagePath, Buffer.from('db asset content'));

            const mockQueries = createMockQueries({
                findAllAssetsForProject: async () => [
                    createMockDbAsset({
                        client_id: 'db-asset-1',
                        filename: 'db-asset.png',
                        storage_path: storagePath,
                    }),
                ],
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, mockQueries);
            const processed: string[] = [];
            const count = await provider.forEachAsset(async asset => {
                processed.push(asset.id);
            });

            expect(count).toBe(1);
            expect(processed).toContain('db-asset-1');
        });

        it('should return 0 for empty provider', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());
            const count = await provider.forEachAsset(async () => {});
            expect(count).toBe(0);
        });
    });

    describe('listAssetMetadata', () => {
        it('should return metadata without binary data', async () => {
            const storagePath = path.join(tempDir, 'db-storage', 'meta-asset.png');
            await fs.ensureDir(path.dirname(storagePath));
            await fs.writeFile(storagePath, Buffer.from('meta content'));

            const mockQueries = createMockQueries({
                findAllAssetsForProject: async () => [
                    createMockDbAsset({
                        client_id: 'meta-uuid',
                        filename: 'meta-asset.png',
                        storage_path: storagePath,
                        mime_type: 'image/png',
                    }),
                ],
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, mockQueries);
            const metadata = await provider.listAssetMetadata();

            expect(metadata.length).toBe(1);
            expect(metadata[0].id).toBe('meta-uuid');
            expect(metadata[0].filename).toBe('meta-asset.png');
            expect(metadata[0].mime).toBe('image/png');
            expect((metadata[0] as any).data).toBeUndefined();
        });

        it('should return empty array for empty provider', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, undefined, createMockQueries());
            const metadata = await provider.listAssetMetadata();
            expect(metadata).toEqual([]);
        });
    });

    describe('listAssetMetadata and forEachAsset consistency', () => {
        it('should return the same asset IDs from both methods with session path assets', async () => {
            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());

            const meta = await provider.listAssetMetadata();
            const idsFromMeta = new Set(meta.map(a => a.id));

            const iterated: string[] = [];
            await provider.forEachAsset(async asset => {
                iterated.push(asset.id);
            });

            expect(new Set(iterated)).toEqual(idsFromMeta);
        });

        it('should return the same asset IDs with combined DB and session assets', async () => {
            const storagePath = path.join(tempDir, 'db-storage', 'db-asset.png');
            await fs.ensureDir(path.dirname(storagePath));
            await fs.writeFile(storagePath, Buffer.from('db asset content'));

            const mockQueries = createMockQueries({
                findAllAssetsForProject: async () => [
                    createMockDbAsset({
                        client_id: 'db-asset-1',
                        filename: 'db-asset.png',
                        storage_path: storagePath,
                    }),
                ],
            });

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, mockQueries);

            const meta = await provider.listAssetMetadata();
            const idsFromMeta = new Set(meta.map(a => a.id));

            const iterated: string[] = [];
            await provider.forEachAsset(async asset => {
                iterated.push(asset.id);
            });

            expect(new Set(iterated)).toEqual(idsFromMeta);
            expect(idsFromMeta.has('db-asset-1')).toBe(true);
            expect(idsFromMeta.has('asset-uuid-123')).toBe(true);
        });
    });

    describe('edge cases', () => {
        it('should handle asset paths with spaces', async () => {
            // Create asset with space in filename
            const assetDir = path.join(tempDir, 'assets', 'space-uuid');
            await fs.ensureDir(assetDir);
            await fs.writeFile(path.join(assetDir, 'my image.png'), Buffer.from('spaced data'));

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAsset('space-uuid/my image.png');

            expect(result).not.toBeNull();
            expect(result?.filename).toBe('my image.png');
        });

        it('should handle multiple files in asset directory (uses first)', async () => {
            // Create multiple files in one asset directory
            const assetDir = path.join(tempDir, 'assets', 'multi-uuid');
            await fs.ensureDir(assetDir);
            await fs.writeFile(path.join(assetDir, 'a-first.png'), Buffer.from('first'));
            await fs.writeFile(path.join(assetDir, 'b-second.png'), Buffer.from('second'));

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAsset('multi-uuid');

            expect(result).not.toBeNull();
            // Should get one of the files (first alphabetically)
            expect(['a-first.png', 'b-second.png']).toContain(result?.filename);
        });

        it('should handle missing session assets directory gracefully', async () => {
            // Remove assets directory
            await fs.remove(path.join(tempDir, 'assets'));

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAllAssets();

            expect(result).toEqual([]);
        });

        it('should handle asset as direct file (not in uuid directory)', async () => {
            // Create asset as direct file in resources
            const resourcesDir = path.join(tempDir, 'resources');
            await fs.ensureDir(resourcesDir);
            await fs.writeFile(path.join(resourcesDir, 'direct-file.png'), Buffer.from('direct content'));

            const provider = new DatabaseAssetProvider(mockDb, 1, tempDir, createMockQueries());
            const result = await provider.getAsset('direct-file.png');

            expect(result).not.toBeNull();
            expect(result?.data.toString()).toBe('direct content');
        });
    });
});
