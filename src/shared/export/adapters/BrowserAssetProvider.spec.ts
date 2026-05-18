/**
 * BrowserAssetProvider tests
 */

import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { BrowserAssetProvider } from './BrowserAssetProvider';

// Create mock Blob
function createMockBlob(content: string | Uint8Array): Blob {
    if (typeof content === 'string') {
        return new Blob([content], { type: 'text/plain' });
    }
    return new Blob([content], { type: 'application/octet-stream' });
}

// Mock AssetManager interface
interface MockAssetManagerInterface {
    getProjectAssets(options?: { includeBlobs?: boolean }): Promise<
        Array<{
            id: string;
            blob: Blob;
            mime: string;
            filename?: string;
            originalPath?: string;
            folderPath?: string;
        }>
    >;
    getAllAssetsMetadata?(): Array<{
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
    }>;
    getAssetMetadata?(assetId: string): {
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
    } | null;
    getBlob?(assetId: string, options?: { restoreToMemory?: boolean }): Promise<Blob | null>;
    getAsset?(assetId: string): Promise<{ id: string; blob: Blob; mime: string } | null>;
    resolveAssetURL?(assetUrl: string): Promise<string | null>;
}

// Mock AssetManager
class MockAssetManager implements MockAssetManagerInterface {
    private assets: Map<
        string,
        { id: string; blob: Blob; mime: string; filename?: string; originalPath?: string; folderPath?: string }
    > = new Map();
    private urlMap: Map<string, string> = new Map();
    public getProjectAssetsCalls = 0;
    public getBlobCalls: Array<{ id: string; restoreToMemory?: boolean }> = [];

    addAsset(
        id: string,
        content: string | Uint8Array,
        options: {
            filename?: string;
            originalPath?: string;
            folderPath?: string;
            mime?: string;
            skipOriginalPath?: boolean;
        } = {},
    ): void {
        const blob = createMockBlob(content);
        this.assets.set(id, {
            id,
            blob,
            mime: options.mime || 'application/octet-stream',
            filename: options.filename,
            folderPath: options.folderPath,
            // Only set originalPath if explicitly provided or skipOriginalPath is not true
            originalPath: options.skipOriginalPath
                ? undefined
                : (options.originalPath ?? `${id}/${options.filename || 'file.bin'}`),
        });
    }

    setAssetUrl(assetId: string, url: string): void {
        this.urlMap.set(assetId, url);
    }

    async getProjectAssets(options?: { includeBlobs?: boolean }): Promise<
        Array<{
            id: string;
            blob: Blob;
            mime: string;
            filename?: string;
            originalPath?: string;
            folderPath?: string;
        }>
    > {
        this.getProjectAssetsCalls++;
        if (options?.includeBlobs === false) {
            return Array.from(this.assets.values()).map(asset => ({ ...asset, blob: null as any }));
        }
        return Array.from(this.assets.values());
    }

    getAllAssetsMetadata(): Array<{
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
    }> {
        return Array.from(this.assets.values()).map(asset => ({
            id: asset.id,
            filename: asset.filename,
            folderPath: asset.folderPath || asset.originalPath?.split('/').slice(0, -1).join('/'),
            mime: asset.mime,
        }));
    }

    getAssetMetadata(assetId: string): {
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
    } | null {
        const asset = this.assets.get(assetId);
        return asset
            ? {
                  id: asset.id,
                  filename: asset.filename,
                  folderPath: asset.folderPath || asset.originalPath?.split('/').slice(0, -1).join('/'),
                  mime: asset.mime,
              }
            : null;
    }

    async getBlob(assetId: string, options?: { restoreToMemory?: boolean }): Promise<Blob | null> {
        this.getBlobCalls.push({ id: assetId, restoreToMemory: options?.restoreToMemory });
        return this.assets.get(assetId)?.blob || null;
    }

    async getAsset(assetId: string): Promise<{ id: string; blob: Blob; mime: string } | null> {
        return this.assets.get(assetId) || null;
    }

    async resolveAssetURL(assetUrl: string): Promise<string | null> {
        // Extract ID from asset://uuid or asset://uuid/filename
        const id = assetUrl.replace('asset://', '').split('/')[0];
        return this.urlMap.get(id) || null;
    }
}

describe('BrowserAssetProvider', () => {
    let mockManager: MockAssetManager;
    let provider: BrowserAssetProvider;

    beforeEach(() => {
        mockManager = new MockAssetManager();
        provider = new BrowserAssetProvider(mockManager);
    });

    describe('Constructor', () => {
        it('should create provider with asset manager (single arg)', () => {
            const providerWithManager = new BrowserAssetProvider(mockManager);
            expect(providerWithManager).toBeDefined();
        });

        it('should create provider with null asset manager', () => {
            const providerWithNullManager = new BrowserAssetProvider(null);
            expect(providerWithNullManager).toBeDefined();
        });

        it('should use second arg (assetManager) when both args are provided', async () => {
            // Simulates the call pattern in browser/index.ts:
            // new BrowserAssetProvider(cache, manager)
            const content = 'test content';
            mockManager.addAsset('two-arg-test', content, { filename: 'file.txt', mime: 'text/plain' });

            const provider2 = new BrowserAssetProvider(null, mockManager);
            const result = await provider2.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].id).toBe('two-arg-test');
        });

        it('should ignore first arg when second arg is the real manager', async () => {
            // cache (first arg) has no getProjectAssets; manager (second arg) has the data
            const content = 'test';
            mockManager.addAsset('ignore-cache', content, { filename: 'f.txt' });

            const fakeCache = {} as any; // incompatible legacy object
            const provider2 = new BrowserAssetProvider(fakeCache, mockManager);
            const result = await provider2.getAllAssets();

            expect(result.length).toBe(1);
        });
    });

    describe('getAsset', () => {
        it('should return ExportAsset for existing asset', async () => {
            const content = 'Test asset content';
            mockManager.addAsset('abc123', content, { filename: 'image.png', mime: 'image/png' });

            const result = await provider.getAsset('abc123');

            expect(result).toBeDefined();
            expect(result!.id).toBe('abc123');
            expect(result!.filename).toBe('image.png');
            expect(result!.mime).toBe('image/png');
            expect(result!.data).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(result!.data as Uint8Array)).toBe(content);
        });

        it('should return null for missing asset', async () => {
            const result = await provider.getAsset('nonexistent');

            expect(result).toBeNull();
        });

        it('should handle binary content', async () => {
            const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
            mockManager.addAsset('binary-asset', binaryData, { filename: 'image.png' });

            const result = await provider.getAsset('binary-asset');
            const data = result!.data as Uint8Array;

            expect(data[0]).toBe(0x89);
            expect(data[1]).toBe(0x50);
            expect(data[2]).toBe(0x4e);
            expect(data[3]).toBe(0x47);
        });
    });

    describe('hasAsset', () => {
        it('should return true for existing asset', async () => {
            mockManager.addAsset('exists', 'content', { filename: 'file.txt' });

            const result = await provider.hasAsset('exists');

            expect(result).toBe(true);
        });

        it('should return false for missing asset', async () => {
            const result = await provider.hasAsset('missing');

            expect(result).toBe(false);
        });
    });

    describe('listAssets', () => {
        it('should return empty array for no assets', async () => {
            const emptyProvider = new BrowserAssetProvider(new MockAssetManager());
            const result = await emptyProvider.listAssets();

            expect(result).toEqual([]);
        });

        it('should return list of asset paths', async () => {
            mockManager.addAsset('asset1', 'content1', { filename: 'file1.png', originalPath: 'path1/file1.png' });
            mockManager.addAsset('asset2', 'content2', { filename: 'file2.jpg', originalPath: 'path2/file2.jpg' });
            mockManager.addAsset('asset3', 'content3', { filename: 'file3.gif', originalPath: 'path3/file3.gif' });

            const result = await provider.listAssets();

            expect(result).toContain('path1/file1.png');
            expect(result).toContain('path2/file2.jpg');
            expect(result).toContain('path3/file3.gif');
            expect(result).toHaveLength(3);
        });

        it('should handle assets without originalPath by using id/filename', async () => {
            mockManager.addAsset('asset1', 'content', { filename: 'file.png', skipOriginalPath: true });

            const result = await provider.listAssets();

            // Should use id/filename as fallback when originalPath is missing
            expect(result.length).toBe(1);
            expect(result[0]).toBe('asset1/file.png');
        });
    });

    describe('getAllAssets', () => {
        it('should return empty array for no assets', async () => {
            const emptyProvider = new BrowserAssetProvider(new MockAssetManager());
            const result = await emptyProvider.getAllAssets();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        it('should return all assets as ExportAsset array', async () => {
            mockManager.addAsset('asset1', 'content1', { filename: 'file1.png', mime: 'image/png' });
            mockManager.addAsset('asset2', 'content2', { filename: 'file2.jpg', mime: 'image/jpeg' });

            const result = await provider.getAllAssets();

            expect(result.length).toBe(2);
            expect(result.map(a => a.id)).toContain('asset1');
            expect(result.map(a => a.id)).toContain('asset2');
            expect(mockManager.getProjectAssetsCalls).toBe(0);
            expect(mockManager.getBlobCalls).toEqual([
                { id: 'asset1', restoreToMemory: false },
                { id: 'asset2', restoreToMemory: false },
            ]);
        });

        it('should convert blobs to Uint8Array', async () => {
            const content = 'Test content';
            mockManager.addAsset('test-asset', content, { filename: 'test.txt', mime: 'text/plain' });

            const result = await provider.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].data).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(result[0].data as Uint8Array)).toBe(content);
        });

        it('should use folderPath for originalPath when set', async () => {
            mockManager.addAsset('folder-asset', 'content', {
                filename: 'image.png',
                folderPath: 'images/subfolder',
                mime: 'image/png',
            });

            const result = await provider.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].originalPath).toBe('images/subfolder/image.png');
        });

        it('should use uuid/filename when no folderPath', async () => {
            mockManager.addAsset('uuid-asset', 'content', {
                filename: 'image.png',
                skipOriginalPath: true,
                mime: 'image/png',
            });

            const result = await provider.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].originalPath).toBe('uuid-asset/image.png');
        });
    });

    describe('getProjectAssets', () => {
        it('should be an alias for getAllAssets', async () => {
            mockManager.addAsset('test', 'content', { filename: 'test.txt' });

            const getAllResult = await provider.getAllAssets();
            const getProjectResult = await provider.getProjectAssets();

            expect(getProjectResult).toEqual(getAllResult);
        });
    });

    describe('resolveAssetUrl', () => {
        it('should resolve asset URL using assetManager', async () => {
            mockManager.addAsset('resolve-test', 'content', { filename: 'test.png' });
            mockManager.setAssetUrl('resolve-test', 'blob:http://localhost/resolved');

            const result = await provider.resolveAssetUrl('asset://resolve-test/test.png');

            expect(result).toBe('blob:http://localhost/resolved');
        });

        it('should return null for unresolved URL', async () => {
            const result = await provider.resolveAssetUrl('asset://nonexistent/file.png');

            expect(result).toBeNull();
        });
    });

    describe('Error handling', () => {
        it('should handle getAsset errors gracefully', async () => {
            const failingManager = {
                getAsset: async () => {
                    throw new Error('Get failed');
                },
                getProjectAssets: async () => [],
            };

            const errorProvider = new BrowserAssetProvider(failingManager as MockAssetManagerInterface);
            const result = await errorProvider.getAsset('test');

            expect(result).toBeNull();
        });

        it('should handle hasAsset errors gracefully', async () => {
            const failingManager = {
                getAsset: async () => {
                    throw new Error('Get failed');
                },
                getProjectAssets: async () => [],
            };

            const errorProvider = new BrowserAssetProvider(failingManager as MockAssetManagerInterface);
            const result = await errorProvider.hasAsset('test');

            expect(result).toBe(false);
        });

        it('should handle listAssets errors gracefully', async () => {
            const failingManager = {
                getProjectAssets: async () => {
                    throw new Error('List failed');
                },
            };

            const errorProvider = new BrowserAssetProvider(failingManager as MockAssetManagerInterface);
            const result = await errorProvider.listAssets();

            expect(result).toEqual([]);
        });

        it('should handle getAllAssets errors gracefully', async () => {
            const failingManager = {
                getProjectAssets: async () => {
                    throw new Error('Get all failed');
                },
            };

            const errorProvider = new BrowserAssetProvider(failingManager as MockAssetManagerInterface);
            const result = await errorProvider.getAllAssets();

            expect(result).toEqual([]);
        });

        it('should handle resolveAssetUrl errors gracefully', async () => {
            const failingManager = {
                getProjectAssets: async () => [],
                resolveAssetURL: async () => {
                    throw new Error('Resolve failed');
                },
            };

            const errorProvider = new BrowserAssetProvider(failingManager as MockAssetManagerInterface);
            const result = await errorProvider.resolveAssetUrl('asset://test');

            expect(result).toBeNull();
        });
    });

    describe('forEachAsset', () => {
        it('should process each asset sequentially', async () => {
            mockManager.addAsset('asset1', 'content1', { filename: 'file1.png', mime: 'image/png' });
            mockManager.addAsset('asset2', 'content2', { filename: 'file2.jpg', mime: 'image/jpeg' });

            const processed: string[] = [];
            const count = await provider.forEachAsset(async asset => {
                processed.push(asset.id);
            });

            expect(count).toBe(2);
            expect(processed).toContain('asset1');
            expect(processed).toContain('asset2');
            expect(mockManager.getProjectAssetsCalls).toBe(0);
        });

        it('should process each asset via callback', async () => {
            mockManager.addAsset('asset1', 'content1', { filename: 'file1.png', mime: 'image/png' });
            mockManager.addAsset('asset2', 'content2', { filename: 'file2.jpg', mime: 'image/jpeg' });

            const collected: Array<{ id: string; filename: string }> = [];
            const count = await provider.forEachAsset(async asset => {
                collected.push({ id: asset.id, filename: asset.filename });
            });

            expect(count).toBe(2);
            expect(collected.length).toBe(2);
            expect(collected.map(a => a.id)).toContain('asset1');
            expect(collected.map(a => a.id)).toContain('asset2');
        });

        it('should return 0 for empty asset manager', async () => {
            const emptyProvider = new BrowserAssetProvider(new MockAssetManager());
            const count = await emptyProvider.forEachAsset(async () => {});

            expect(count).toBe(0);
        });

        it('should return 0 for null asset manager', async () => {
            const nullProvider = new BrowserAssetProvider(null);
            const count = await nullProvider.forEachAsset(async () => {});

            expect(count).toBe(0);
        });

        it('should convert blobs to Uint8Array', async () => {
            const content = 'Test content';
            mockManager.addAsset('test-asset', content, { filename: 'test.txt', mime: 'text/plain' });

            let receivedData: Uint8Array | null = null;
            await provider.forEachAsset(async asset => {
                receivedData = asset.data as Uint8Array;
            });

            expect(receivedData).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(receivedData!)).toBe(content);
        });

        it('should use folderPath for originalPath when set', async () => {
            mockManager.addAsset('folder-asset', 'content', {
                filename: 'image.png',
                folderPath: 'images/subfolder',
                mime: 'image/png',
            });

            let receivedPath = '';
            await provider.forEachAsset(async asset => {
                receivedPath = asset.originalPath;
            });

            expect(receivedPath).toBe('images/subfolder/image.png');
        });

        it('should support async callbacks', async () => {
            mockManager.addAsset('async-asset', 'content', { filename: 'file.txt' });

            const collected: string[] = [];
            const count = await provider.forEachAsset(async asset => {
                await new Promise(resolve => setTimeout(resolve, 1));
                collected.push(asset.id);
            });

            expect(count).toBe(1);
            expect(collected).toEqual(['async-asset']);
        });

        it('should handle errors gracefully', async () => {
            const failingManager = {
                getProjectAssets: async () => {
                    throw new Error('Failed');
                },
            };

            const errorProvider = new BrowserAssetProvider(failingManager as MockAssetManagerInterface);
            const count = await errorProvider.forEachAsset(async () => {});

            expect(count).toBe(0);
        });
    });

    describe('listAssetMetadata', () => {
        it('should return metadata without binary data', async () => {
            mockManager.addAsset('asset1', 'content1', {
                filename: 'file1.png',
                mime: 'image/png',
                folderPath: 'images',
            });
            mockManager.addAsset('asset2', 'content2', { filename: 'file2.jpg', mime: 'image/jpeg' });

            const metadata = await provider.listAssetMetadata();

            expect(metadata.length).toBe(2);
            expect(metadata[0].id).toBe('asset1');
            expect(metadata[0].filename).toBe('file1.png');
            expect(metadata[0].folderPath).toBe('images');
            expect(metadata[0].mime).toBe('image/png');
            expect((metadata[0] as any).data).toBeUndefined();
        });

        it('should prefer getAllAssetsMetadata over getProjectAssets when available', async () => {
            let getProjectAssetsCalled = false;
            const managerWithMetadata = {
                getProjectAssets: async () => {
                    getProjectAssetsCalled = true;
                    return [] as any[];
                },
                getAllAssetsMetadata: () => [
                    { id: 'meta1', filename: 'file1.png', mime: 'image/png', folderPath: 'images', size: 100 },
                    { id: 'meta2', filename: 'file2.jpg', mime: 'image/jpeg', folderPath: '', size: 200 },
                ],
            };

            const metaProvider = new BrowserAssetProvider(managerWithMetadata as any);
            const metadata = await metaProvider.listAssetMetadata();

            expect(metadata.length).toBe(2);
            expect(metadata[0].id).toBe('meta1');
            expect(metadata[0].filename).toBe('file1.png');
            expect(metadata[1].id).toBe('meta2');
            expect(getProjectAssetsCalled).toBe(false);
        });

        it('should fall back to getProjectAssets when getAllAssetsMetadata returns empty', async () => {
            const managerWithEmptyMetadata = {
                getProjectAssets: async () => [
                    { id: 'fb1', blob: createMockBlob('data'), mime: 'image/png', filename: 'fallback.png' },
                ],
                getAllAssetsMetadata: () => [],
            };

            const fbProvider = new BrowserAssetProvider(managerWithEmptyMetadata as any);
            const metadata = await fbProvider.listAssetMetadata();

            expect(metadata.length).toBe(1);
            expect(metadata[0].id).toBe('fb1');
        });

        it('should return empty array for null asset manager', async () => {
            const nullProvider = new BrowserAssetProvider(null);
            const metadata = await nullProvider.listAssetMetadata();

            expect(metadata).toEqual([]);
        });

        it('should return empty array for empty asset manager', async () => {
            const emptyProvider = new BrowserAssetProvider(new MockAssetManager());
            const metadata = await emptyProvider.listAssetMetadata();

            expect(metadata).toEqual([]);
        });

        it('should handle errors gracefully', async () => {
            const failingManager = {
                getProjectAssets: async () => {
                    throw new Error('Failed');
                },
            };

            const errorProvider = new BrowserAssetProvider(failingManager as MockAssetManagerInterface);
            const metadata = await errorProvider.listAssetMetadata();

            expect(metadata).toEqual([]);
        });
    });

    describe('listAssetMetadata and forEachAsset consistency', () => {
        it('should return the same asset IDs from both methods', async () => {
            mockManager.addAsset('asset1', 'content1', { filename: 'file1.png', mime: 'image/png' });
            mockManager.addAsset('asset2', 'content2', { filename: 'file2.jpg', mime: 'image/jpeg' });

            const meta = await provider.listAssetMetadata();
            const idsFromMeta = new Set(meta.map(a => a.id));

            const iterated: string[] = [];
            await provider.forEachAsset(async asset => {
                iterated.push(asset.id);
            });

            expect(new Set(iterated)).toEqual(idsFromMeta);
        });

        it('should return the same asset IDs when using getAllAssetsRaw fallback', async () => {
            const projectId = 'test-project-id';
            const fallbackManager = {
                projectId,
                getProjectAssets: async () =>
                    [] as Array<{
                        id: string;
                        blob: Blob;
                        mime: string;
                        filename?: string;
                        originalPath?: string;
                        folderPath?: string;
                        projectId?: string;
                    }>,
                getAllAssetsRaw: async () => [
                    {
                        id: 'fallback-1',
                        blob: createMockBlob('data1'),
                        mime: 'image/png',
                        filename: 'img1.png',
                        projectId,
                    },
                    {
                        id: 'fallback-2',
                        blob: createMockBlob('data2'),
                        mime: 'image/jpeg',
                        filename: 'img2.jpg',
                        projectId,
                    },
                    {
                        id: 'other-project',
                        blob: createMockBlob('data3'),
                        mime: 'image/gif',
                        filename: 'img3.gif',
                        projectId: 'other-id',
                    },
                ],
            };

            const fallbackProvider = new BrowserAssetProvider(fallbackManager as any);

            const meta = await fallbackProvider.listAssetMetadata();
            const idsFromMeta = new Set(meta.map(a => a.id));

            const iterated: string[] = [];
            await fallbackProvider.forEachAsset(async asset => {
                iterated.push(asset.id);
            });

            expect(new Set(iterated)).toEqual(idsFromMeta);
            expect(idsFromMeta.size).toBe(2);
            expect(idsFromMeta.has('fallback-1')).toBe(true);
            expect(idsFromMeta.has('fallback-2')).toBe(true);
            expect(idsFromMeta.has('other-project')).toBe(false);
        });
    });

    describe('Missing blob handling (#1685)', () => {
        it('should skip assets with missing blobs and warn', async () => {
            // Simulate Cache API eviction: metadata exists but getBlob returns null
            const managerWithEvictedBlobs = {
                getProjectAssets: async () => [],
                getAllAssetsMetadata: () => [
                    { id: 'present-1', filename: 'img1.png', mime: 'image/png', folderPath: '' },
                    { id: 'evicted-2', filename: 'img2.png', mime: 'image/png', folderPath: '' },
                    { id: 'present-3', filename: 'img3.png', mime: 'image/png', folderPath: '' },
                ],
                getAssetMetadata: (id: string) => {
                    const map: Record<string, { id: string; filename: string; mime: string; folderPath: string }> = {
                        'present-1': { id: 'present-1', filename: 'img1.png', mime: 'image/png', folderPath: '' },
                        'evicted-2': { id: 'evicted-2', filename: 'img2.png', mime: 'image/png', folderPath: '' },
                        'present-3': { id: 'present-3', filename: 'img3.png', mime: 'image/png', folderPath: '' },
                    };
                    return map[id] || null;
                },
                getBlobForExport: async (id: string) => {
                    // Simulate: present-1 and present-3 have blobs, evicted-2 does not
                    if (id === 'evicted-2') return null;
                    return createMockBlob('data');
                },
            };

            const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
            const evictedProvider = new BrowserAssetProvider(managerWithEvictedBlobs as any);

            const collected: string[] = [];
            const count = await evictedProvider.forEachAsset(async asset => {
                collected.push(asset.id);
            });

            expect(count).toBe(2);
            expect(collected).toContain('present-1');
            expect(collected).toContain('present-3');
            expect(collected).not.toContain('evicted-2');

            // Should warn about the missing asset
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing 1/3 assets'));
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('evicted-2'));

            warnSpy.mockRestore();
        });

        it('should return all assets when none are missing', async () => {
            mockManager.addAsset('a1', 'data1', { filename: 'f1.png', mime: 'image/png' });
            mockManager.addAsset('a2', 'data2', { filename: 'f2.png', mime: 'image/png' });

            const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

            const count = await provider.forEachAsset(async () => {});

            expect(count).toBe(2);
            // Should NOT warn when all assets are present
            const missingWarns = warnSpy.mock.calls.filter(c => typeof c[0] === 'string' && c[0].includes('missing'));
            expect(missingWarns.length).toBe(0);

            warnSpy.mockRestore();
        });
    });

    describe('Null asset manager', () => {
        it('should return null from getAsset with no manager', async () => {
            const nullProvider = new BrowserAssetProvider(null);
            const result = await nullProvider.getAsset('test');

            expect(result).toBeNull();
        });

        it('should return false from hasAsset with no manager', async () => {
            const nullProvider = new BrowserAssetProvider(null);
            const result = await nullProvider.hasAsset('test');

            expect(result).toBe(false);
        });

        it('should return empty array from listAssets with no manager', async () => {
            const nullProvider = new BrowserAssetProvider(null);
            const result = await nullProvider.listAssets();

            expect(result).toEqual([]);
        });

        it('should return empty array from getAllAssets with no manager', async () => {
            const nullProvider = new BrowserAssetProvider(null);
            const result = await nullProvider.getAllAssets();

            expect(result).toEqual([]);
        });

        it('should return null from resolveAssetUrl with no manager', async () => {
            const nullProvider = new BrowserAssetProvider(null);
            const result = await nullProvider.resolveAssetUrl('asset://test');

            expect(result).toBeNull();
        });
    });
});
