/**
 * BrowserAssetProvider tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BrowserAssetProvider } from './BrowserAssetProvider';

// Mock AssetCacheManager interface
interface MockAssetCacheManagerInterface {
    getAllAssets(): Promise<
        Array<{
            assetId: number | string;
            blob: Blob;
            metadata: {
                originalPath?: string;
                filename?: string;
                mimeType?: string;
            };
        }>
    >;
    getAssetByPath(path: string): Promise<{ blob: Blob; metadata: Record<string, unknown> } | null>;
    resolveAssetUrl(path: string): Promise<string | null>;
}

// Create mock Blob
function createMockBlob(content: string | Uint8Array): Blob {
    if (typeof content === 'string') {
        return new Blob([content], { type: 'text/plain' });
    }
    return new Blob([content], { type: 'application/octet-stream' });
}

// Mock AssetCacheManager
class MockAssetCacheManager implements MockAssetCacheManagerInterface {
    private assets: Map<string, { blob: Blob; metadata: Record<string, unknown> }> = new Map();
    private assetList: Array<{
        assetId: number | string;
        blob: Blob;
        metadata: {
            originalPath?: string;
            filename?: string;
            mimeType?: string;
        };
    }> = [];

    // Setup methods
    addAsset(path: string, content: string | Uint8Array, metadata: Record<string, unknown> = {}): void {
        const blob = createMockBlob(content);
        this.assets.set(path, { blob, metadata: { originalPath: path, ...metadata } });
        this.assetList.push({
            assetId: path,
            blob,
            metadata: { originalPath: path, ...metadata },
        });
    }

    setAssetUrl(path: string, url: string): void {
        const existing = this.assets.get(path);
        if (existing) {
            existing.metadata.url = url;
        }
    }

    // Interface methods
    async getAllAssets(): Promise<
        Array<{
            assetId: number | string;
            blob: Blob;
            metadata: {
                originalPath?: string;
                filename?: string;
                mimeType?: string;
            };
        }>
    > {
        return this.assetList;
    }

    async getAssetByPath(path: string): Promise<{ blob: Blob; metadata: Record<string, unknown> } | null> {
        return this.assets.get(path) || null;
    }

    async resolveAssetUrl(path: string): Promise<string | null> {
        const asset = this.assets.get(path);
        return (asset?.metadata.url as string) || null;
    }
}

// Mock AssetManager interface (new style, preferred for exports)
interface MockAssetManagerInterface {
    getProjectAssets(): Promise<
        Array<{
            id: string;
            blob: Blob;
            mime: string;
            filename?: string;
            originalPath?: string;
        }>
    >;
    getAsset?(assetId: string): Promise<{ id: string; blob: Blob; mime: string } | null>;
    resolveAssetURL?(assetUrl: string): Promise<string | null>;
}

// Mock AssetManager (new style)
class MockAssetManager implements MockAssetManagerInterface {
    private assets: Map<string, { id: string; blob: Blob; mime: string; filename?: string; originalPath?: string }> =
        new Map();
    private urlMap: Map<string, string> = new Map();

    addAsset(
        id: string,
        content: string | Uint8Array,
        options: { filename?: string; originalPath?: string; mime?: string; skipOriginalPath?: boolean } = {},
    ): void {
        const blob = createMockBlob(content);
        this.assets.set(id, {
            id,
            blob,
            mime: options.mime || 'application/octet-stream',
            filename: options.filename,
            // Only set originalPath if explicitly provided or skipOriginalPath is not true
            originalPath: options.skipOriginalPath
                ? undefined
                : (options.originalPath ?? `${id}/${options.filename || 'file.bin'}`),
        });
    }

    setAssetUrl(assetId: string, url: string): void {
        this.urlMap.set(assetId, url);
    }

    async getProjectAssets(): Promise<
        Array<{
            id: string;
            blob: Blob;
            mime: string;
            filename?: string;
            originalPath?: string;
        }>
    > {
        return Array.from(this.assets.values());
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
    let mockCache: MockAssetCacheManager;
    let mockManager: MockAssetManager;
    let provider: BrowserAssetProvider;

    beforeEach(() => {
        mockCache = new MockAssetCacheManager();
        mockManager = new MockAssetManager();
        provider = new BrowserAssetProvider(mockCache);
    });

    describe('Constructor', () => {
        it('should create provider with cache manager', () => {
            expect(provider).toBeDefined();
        });

        it('should create provider with optional asset manager', () => {
            const providerWithManager = new BrowserAssetProvider(mockCache, null);
            expect(providerWithManager).toBeDefined();
        });

        it('should create provider with only asset manager (null assetCache)', () => {
            const providerWithManagerOnly = new BrowserAssetProvider(null, mockManager);
            expect(providerWithManagerOnly).toBeDefined();
        });

        it('should create provider with both assetCache and assetManager', () => {
            const providerWithBoth = new BrowserAssetProvider(mockCache, mockManager);
            expect(providerWithBoth).toBeDefined();
        });
    });

    describe('AssetManager preference', () => {
        it('should prefer assetManager over assetCache for getAllAssets', async () => {
            // Add asset only to assetManager
            mockManager.addAsset('manager-asset', 'from manager', {
                filename: 'manager.png',
                mime: 'image/png',
            });

            const providerWithManager = new BrowserAssetProvider(mockCache, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].id).toBe('manager-asset');
            expect(result[0].mime).toBe('image/png');
            expect(new TextDecoder().decode(result[0].data as Uint8Array)).toBe('from manager');
        });

        it('should use assetManager when assetCache is null', async () => {
            mockManager.addAsset('only-manager', 'only from manager', {
                filename: 'only.png',
                mime: 'image/png',
            });

            const providerOnlyManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerOnlyManager.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].id).toBe('only-manager');
        });

        it('should NOT fallback to assetCache when assetManager returns empty (trust assetManager)', async () => {
            // Add asset only to assetCache
            mockCache.addAsset('cache-asset', 'from cache', { filename: 'cache.png', mimeType: 'image/png' });

            // Use empty assetManager - when assetManager is available, we trust it completely
            // Legacy assetCache fallback is ONLY used when assetManager is NOT available
            // This prevents blocked database errors in multi-tab scenarios
            const emptyManager = new MockAssetManager();
            const providerWithBoth = new BrowserAssetProvider(mockCache, emptyManager);
            const result = await providerWithBoth.getAllAssets();

            // Should return empty because assetManager is available and returned empty
            expect(result.length).toBe(0);
        });

        it('should use assetManager for listAssets when available', async () => {
            mockManager.addAsset('list-test', 'content', {
                filename: 'test.png',
                originalPath: 'manager/test.png',
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.listAssets();

            expect(result.length).toBe(1);
            expect(result[0]).toBe('manager/test.png');
        });

        it('should use assetManager.resolveAssetURL when available', async () => {
            mockManager.addAsset('resolve-test', 'content', { filename: 'test.png' });
            mockManager.setAssetUrl('resolve-test', 'blob:http://localhost/resolved');

            const providerWithManager = new BrowserAssetProvider(mockCache, mockManager);
            const result = await providerWithManager.resolveAssetUrl('asset://resolve-test/test.png');

            expect(result).toBe('blob:http://localhost/resolved');
        });
    });

    describe('getAsset', () => {
        it('should return ExportAsset for existing asset', async () => {
            const content = 'Test asset content';
            mockCache.addAsset('abc123/image.png', content, { filename: 'image.png', mimeType: 'image/png' });

            const result = await provider.getAsset('abc123/image.png');

            expect(result).toBeDefined();
            expect(result!.id).toBe('abc123/image.png');
            expect(result!.filename).toBe('image.png');
            expect(result!.mime).toBe('image/png');
            expect(result!.data).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(result!.data as Uint8Array)).toBe(content);
        });

        it('should return null for missing asset', async () => {
            const result = await provider.getAsset('nonexistent/file.png');

            expect(result).toBeNull();
        });

        it('should handle binary content', async () => {
            const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
            mockCache.addAsset('binary/image.png', binaryData);

            const result = await provider.getAsset('binary/image.png');
            const data = result!.data as Uint8Array;

            expect(data[0]).toBe(0x89);
            expect(data[1]).toBe(0x50);
            expect(data[2]).toBe(0x4e);
            expect(data[3]).toBe(0x47);
        });
    });

    describe('hasAsset', () => {
        it('should return true for existing asset', async () => {
            mockCache.addAsset('exists/file.txt', 'content');

            const result = await provider.hasAsset('exists/file.txt');

            expect(result).toBe(true);
        });

        it('should return false for missing asset', async () => {
            const result = await provider.hasAsset('missing/file.txt');

            expect(result).toBe(false);
        });
    });

    describe('listAssets', () => {
        it('should return empty array for no assets', async () => {
            const result = await provider.listAssets();

            expect(result).toEqual([]);
        });

        it('should return list of asset paths', async () => {
            mockCache.addAsset('path1/file1.png', 'content1');
            mockCache.addAsset('path2/file2.jpg', 'content2');
            mockCache.addAsset('path3/file3.gif', 'content3');

            const result = await provider.listAssets();

            expect(result).toContain('path1/file1.png');
            expect(result).toContain('path2/file2.jpg');
            expect(result).toContain('path3/file3.gif');
            expect(result).toHaveLength(3);
        });

        it('should filter assets without originalPath', async () => {
            mockCache.addAsset('valid/path.png', 'content');
            // Add asset without originalPath
            mockCache['assetList'].push({
                assetId: 'no-path',
                blob: createMockBlob('no path'),
                metadata: {},
            });

            const result = await provider.listAssets();

            expect(result).toHaveLength(1);
            expect(result[0]).toBe('valid/path.png');
        });
    });

    describe('getAllAssets', () => {
        it('should return empty array for no assets', async () => {
            const result = await provider.getAllAssets();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        it('should return array of ExportAsset', async () => {
            mockCache.addAsset('image1.png', 'Image 1', { filename: 'image1.png', mimeType: 'image/png' });
            mockCache.addAsset('image2.jpg', 'Image 2', { filename: 'image2.jpg', mimeType: 'image/jpeg' });

            const result = await provider.getAllAssets();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);

            const asset1 = result.find(a => a.originalPath === 'image1.png');
            const asset2 = result.find(a => a.originalPath === 'image2.jpg');

            expect(asset1).toBeDefined();
            expect(asset1!.filename).toBe('image1.png');
            expect(new TextDecoder().decode(asset1!.data as Uint8Array)).toBe('Image 1');

            expect(asset2).toBeDefined();
            expect(asset2!.filename).toBe('image2.jpg');
            expect(new TextDecoder().decode(asset2!.data as Uint8Array)).toBe('Image 2');
        });

        it('should handle multiple assets concurrently', async () => {
            for (let i = 0; i < 10; i++) {
                mockCache.addAsset(`asset${i}.png`, `Content ${i}`);
            }

            const result = await provider.getAllAssets();

            expect(result.length).toBe(10);
            for (let i = 0; i < 10; i++) {
                const asset = result.find(a => a.originalPath === `asset${i}.png`);
                expect(asset).toBeDefined();
                expect(new TextDecoder().decode(asset!.data as Uint8Array)).toBe(`Content ${i}`);
            }
        });

        it('should convert blob to ArrayBuffer in parallel (not sequentially)', async () => {
            // Track when each arrayBuffer() call starts and ends
            const callLog: { id: string; event: 'start' | 'end'; time: number }[] = [];
            const startTime = Date.now();

            // Create mock assets with delayed arrayBuffer() to detect parallel vs sequential
            const delayMs = 20;
            const mockAssetManagerWithDelay = {
                projectId: 'parallel-test',
                async getProjectAssets() {
                    return [
                        { id: 'p1', filename: 'a.png', mime: 'image/png' },
                        { id: 'p2', filename: 'b.png', mime: 'image/png' },
                        { id: 'p3', filename: 'c.png', mime: 'image/png' },
                        { id: 'p4', filename: 'd.png', mime: 'image/png' },
                        { id: 'p5', filename: 'e.png', mime: 'image/png' },
                    ].map(asset => ({
                        ...asset,
                        blob: {
                            async arrayBuffer() {
                                callLog.push({ id: asset.id, event: 'start', time: Date.now() - startTime });
                                await new Promise(resolve => setTimeout(resolve, delayMs));
                                callLog.push({ id: asset.id, event: 'end', time: Date.now() - startTime });
                                return new Uint8Array([1, 2, 3]).buffer;
                            },
                        },
                    }));
                },
            };

            const providerParallel = new BrowserAssetProvider(null, mockAssetManagerWithDelay as never);
            const result = await providerParallel.getAllAssets();

            expect(result.length).toBe(5);

            // Verify parallel execution: all 'start' events should occur before any 'end' event
            const startEvents = callLog.filter(e => e.event === 'start');
            const endEvents = callLog.filter(e => e.event === 'end');

            expect(startEvents.length).toBe(5);
            expect(endEvents.length).toBe(5);

            // In parallel: all starts happen before first end
            // In sequential: start1, end1, start2, end2, ...
            const lastStartTime = Math.max(...startEvents.map(e => e.time));
            const firstEndTime = Math.min(...endEvents.map(e => e.time));

            // All starts should happen before (or very close to) the first end
            // Allow small margin for execution overhead
            expect(lastStartTime).toBeLessThanOrEqual(firstEndTime + 5);

            // Total time should be ~delayMs (parallel) not ~5*delayMs (sequential)
            const totalTime = Math.max(...endEvents.map(e => e.time));
            expect(totalTime).toBeLessThan(delayMs * 3); // Should be ~20-30ms, not 100ms+
        });
    });

    describe('getProjectAssets', () => {
        it('should return same result as getAllAssets', async () => {
            mockCache.addAsset('test/file.png', 'content');

            const allAssets = await provider.getAllAssets();
            const projectAssets = await provider.getProjectAssets();

            expect(allAssets.length).toBe(projectAssets.length);
            expect(allAssets[0].id).toBe(projectAssets[0].id);
        });
    });

    describe('originalPath UUID folder handling (AssetManager)', () => {
        let mockManager: MockAssetManager;

        beforeEach(() => {
            mockManager = new MockAssetManager();
        });

        it('should construct originalPath with UUID folder when originalPath is just filename', async () => {
            // Simulates old ELP import where originalPath is just "elcid.png" without UUID folder
            mockManager.addAsset('abc123', 'image data', {
                filename: 'elcid.png',
                originalPath: 'elcid.png', // Missing UUID folder - old ELP format
                mime: 'image/png',
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(1);
            // Should construct correct path: uuid/filename
            expect(result[0].originalPath).toBe('abc123/elcid.png');
            expect(result[0].id).toBe('abc123');
            expect(result[0].filename).toBe('elcid.png');
        });

        it('should keep originalPath when it already includes UUID', async () => {
            // New format where originalPath already has UUID folder
            mockManager.addAsset('def456', 'image data', {
                filename: 'photo.jpg',
                originalPath: 'def456/photo.jpg', // Correct format
                mime: 'image/jpeg',
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].originalPath).toBe('def456/photo.jpg');
        });

        it('should keep originalPath when it includes content/resources prefix with UUID', async () => {
            // ELP import format with full path
            mockManager.addAsset('ghi789', 'pdf data', {
                filename: 'document.pdf',
                originalPath: 'content/resources/ghi789/document.pdf', // Full path format
                mime: 'application/pdf',
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].originalPath).toBe('content/resources/ghi789/document.pdf');
        });

        it('should handle undefined originalPath by constructing uuid/filename', async () => {
            mockManager.addAsset('jkl012', 'data', {
                filename: 'file.txt',
                // No originalPath - should use fallback
                mime: 'text/plain',
                skipOriginalPath: true,
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(1);
            expect(result[0].originalPath).toBe('jkl012/file.txt');
        });

        it('should generate filename with extension from MIME when filename is missing', async () => {
            mockManager.addAsset('mno345', 'data', {
                // No filename, no originalPath - test fallback (uses MIME to derive extension)
                mime: 'application/octet-stream',
                skipOriginalPath: true,
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(1);
            // Fallback filename now includes extension derived from MIME type
            expect(result[0].filename).toBe('asset-mno345.bin');
            expect(result[0].originalPath).toBe('mno345/asset-mno345.bin');
        });

        it('should generate filename with proper extension when filename is "unknown"', async () => {
            mockManager.addAsset('pqr678', 'image data', {
                filename: 'unknown',
                mime: 'image/jpeg',
                skipOriginalPath: true,
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(1);
            // 'unknown' filename should be replaced with MIME-derived name
            expect(result[0].filename).toBe('asset-pqr678.jpg');
            expect(result[0].originalPath).toBe('pqr678/asset-pqr678.jpg');
        });

        it('should handle multiple assets with mixed originalPath formats', async () => {
            // Mix of old and new formats
            mockManager.addAsset('id1', 'data1', {
                filename: 'file1.png',
                originalPath: 'file1.png', // Old format - no UUID
                mime: 'image/png',
            });
            mockManager.addAsset('id2', 'data2', {
                filename: 'file2.jpg',
                originalPath: 'id2/file2.jpg', // New format - has UUID
                mime: 'image/jpeg',
            });
            mockManager.addAsset('id3', 'data3', {
                filename: 'file3.gif',
                // No originalPath - fallback
                mime: 'image/gif',
                skipOriginalPath: true,
            });

            const providerWithManager = new BrowserAssetProvider(null, mockManager);
            const result = await providerWithManager.getAllAssets();

            expect(result.length).toBe(3);

            const asset1 = result.find(a => a.id === 'id1');
            const asset2 = result.find(a => a.id === 'id2');
            const asset3 = result.find(a => a.id === 'id3');

            // All should have UUID in path
            expect(asset1!.originalPath).toBe('id1/file1.png');
            expect(asset2!.originalPath).toBe('id2/file2.jpg');
            expect(asset3!.originalPath).toBe('id3/file3.gif');
        });
    });

    describe('resolveAssetUrl', () => {
        it('should return URL for existing asset', async () => {
            mockCache.addAsset('my/asset.png', 'content');
            mockCache.setAssetUrl('my/asset.png', 'blob:http://localhost/abc123');

            const result = await provider.resolveAssetUrl('my/asset.png');

            expect(result).toBe('blob:http://localhost/abc123');
        });

        it('should return null for asset without URL', async () => {
            mockCache.addAsset('no-url/asset.png', 'content');

            const result = await provider.resolveAssetUrl('no-url/asset.png');

            expect(result).toBeNull();
        });

        it('should return null for missing asset', async () => {
            const result = await provider.resolveAssetUrl('nonexistent.png');

            expect(result).toBeNull();
        });
    });

    describe('Error handling', () => {
        it('should handle getAsset errors gracefully', async () => {
            // Create cache that throws
            const failingCache: MockAssetCacheManagerInterface = {
                async getAllAssets() {
                    return [];
                },
                async getAssetByPath() {
                    throw new Error('Cache error');
                },
                async resolveAssetUrl() {
                    return null;
                },
            };

            const failingProvider = new BrowserAssetProvider(failingCache);
            const result = await failingProvider.getAsset('any.png');

            expect(result).toBeNull();
        });

        it('should handle hasAsset errors gracefully', async () => {
            const failingCache: MockAssetCacheManagerInterface = {
                async getAllAssets() {
                    return [];
                },
                async getAssetByPath() {
                    throw new Error('Cache error');
                },
                async resolveAssetUrl() {
                    return null;
                },
            };

            const failingProvider = new BrowserAssetProvider(failingCache);
            const result = await failingProvider.hasAsset('any.png');

            expect(result).toBe(false);
        });

        it('should handle listAssets errors gracefully', async () => {
            const failingCache: MockAssetCacheManagerInterface = {
                async getAllAssets() {
                    throw new Error('Cache error');
                },
                async getAssetByPath() {
                    return null;
                },
                async resolveAssetUrl() {
                    return null;
                },
            };

            const failingProvider = new BrowserAssetProvider(failingCache);
            const result = await failingProvider.listAssets();

            expect(result).toEqual([]);
        });

        it('should handle getAllAssets errors gracefully', async () => {
            const failingCache: MockAssetCacheManagerInterface = {
                async getAllAssets() {
                    throw new Error('Cache error');
                },
                async getAssetByPath() {
                    return null;
                },
                async resolveAssetUrl() {
                    return null;
                },
            };

            const failingProvider = new BrowserAssetProvider(failingCache);
            const result = await failingProvider.getAllAssets();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });

        it('should handle resolveAssetUrl errors gracefully', async () => {
            const failingCache: MockAssetCacheManagerInterface = {
                async getAllAssets() {
                    return [];
                },
                async getAssetByPath() {
                    return null;
                },
                async resolveAssetUrl() {
                    throw new Error('URL error');
                },
            };

            const failingProvider = new BrowserAssetProvider(failingCache);
            const result = await failingProvider.resolveAssetUrl('any.png');

            expect(result).toBeNull();
        });
    });

    describe('Blob to Uint8Array conversion', () => {
        it('should correctly convert text Blob to Uint8Array', async () => {
            const textContent = 'Hello World from asset';
            mockCache.addAsset('text/file.txt', textContent);

            const result = await provider.getAsset('text/file.txt');
            const data = result!.data as Uint8Array;

            expect(new TextDecoder().decode(data)).toBe(textContent);
        });

        it('should correctly convert large binary Blob to Uint8Array', async () => {
            // Create 1KB of binary data
            const binaryData = new Uint8Array(1024);
            for (let i = 0; i < 1024; i++) {
                binaryData[i] = i % 256;
            }
            mockCache.addAsset('large/binary.bin', binaryData);

            const result = await provider.getAsset('large/binary.bin');
            const data = result!.data as Uint8Array;

            expect(data.length).toBe(1024);
            for (let i = 0; i < 1024; i++) {
                expect(data[i]).toBe(i % 256);
            }
        });
    });

    describe('Project isolation (cross-project contamination prevention)', () => {
        it('should only return assets matching the expected projectId in fallback', async () => {
            // Create mock that returns empty from getProjectAssets but has assets in getAllAssetsRaw
            const mockAssetManagerWithFallback = {
                projectId: 'project-A',
                async getProjectAssets() {
                    return []; // Returns empty to trigger fallback
                },
                async getAllAssetsRaw() {
                    return [
                        {
                            id: 'asset-1',
                            projectId: 'project-A',
                            blob: createMockBlob('content A'),
                            mime: 'text/plain',
                            filename: 'a.txt',
                        },
                        {
                            id: 'asset-2',
                            projectId: 'project-B',
                            blob: createMockBlob('content B'),
                            mime: 'text/plain',
                            filename: 'b.txt',
                        },
                        {
                            id: 'asset-3',
                            projectId: 'project-C',
                            blob: createMockBlob('content C'),
                            mime: 'text/plain',
                            filename: 'c.txt',
                        },
                    ];
                },
            };

            const providerWithFallback = new BrowserAssetProvider(null, mockAssetManagerWithFallback as never);
            const assets = await providerWithFallback.getAllAssets();

            // Should only include asset from project-A
            expect(assets).toHaveLength(1);
            expect(assets[0].id).toBe('asset-1');
            expect(new TextDecoder().decode(assets[0].data as Uint8Array)).toBe('content A');
        });

        it('should not include any assets when projectId does not match in fallback', async () => {
            const mockAssetManagerNoMatch = {
                projectId: 'project-X', // No assets for this project
                async getProjectAssets() {
                    return []; // Returns empty to trigger fallback
                },
                async getAllAssetsRaw() {
                    return [
                        {
                            id: 'asset-1',
                            projectId: 'project-A',
                            blob: createMockBlob('content A'),
                            mime: 'text/plain',
                            filename: 'a.txt',
                        },
                        {
                            id: 'asset-2',
                            projectId: 'project-B',
                            blob: createMockBlob('content B'),
                            mime: 'text/plain',
                            filename: 'b.txt',
                        },
                    ];
                },
            };

            const providerNoMatch = new BrowserAssetProvider(null, mockAssetManagerNoMatch as never);
            const assets = await providerNoMatch.getAllAssets();

            // Should return empty array - no cross-contamination
            expect(assets).toHaveLength(0);
        });

        it('should return all project assets when getProjectAssets succeeds (no fallback needed)', async () => {
            // This test ensures the normal flow still works when getProjectAssets returns assets
            const mockAssetManagerNormal = {
                projectId: 'project-A',
                async getProjectAssets() {
                    return [
                        {
                            id: 'asset-1',
                            projectId: 'project-A',
                            blob: createMockBlob('content A1'),
                            mime: 'text/plain',
                            filename: 'a1.txt',
                        },
                        {
                            id: 'asset-2',
                            projectId: 'project-A',
                            blob: createMockBlob('content A2'),
                            mime: 'text/plain',
                            filename: 'a2.txt',
                        },
                    ];
                },
                // getAllAssetsRaw should NOT be called when getProjectAssets succeeds
                async getAllAssetsRaw() {
                    return [
                        // Include assets from other projects - these should NOT appear
                        {
                            id: 'asset-other',
                            projectId: 'project-B',
                            blob: createMockBlob('content B'),
                            mime: 'text/plain',
                            filename: 'b.txt',
                        },
                    ];
                },
            };

            const providerNormal = new BrowserAssetProvider(null, mockAssetManagerNormal as never);
            const assets = await providerNormal.getAllAssets();

            // Should return only the 2 assets from getProjectAssets, not the fallback
            expect(assets).toHaveLength(2);
            expect(assets.map(a => a.id)).toEqual(['asset-1', 'asset-2']);
        });

        it('should filter multiple assets correctly in fallback', async () => {
            const mockAssetManagerMultiple = {
                projectId: 'target-project',
                async getProjectAssets() {
                    return []; // Trigger fallback
                },
                async getAllAssetsRaw() {
                    return [
                        // Target project assets
                        {
                            id: 'target-1',
                            projectId: 'target-project',
                            blob: createMockBlob('target 1'),
                            mime: 'image/png',
                            filename: 'image1.png',
                        },
                        {
                            id: 'target-2',
                            projectId: 'target-project',
                            blob: createMockBlob('target 2'),
                            mime: 'image/jpg',
                            filename: 'image2.jpg',
                        },
                        // Other project assets - should be filtered out
                        {
                            id: 'other-1',
                            projectId: 'other-project-1',
                            blob: createMockBlob('other 1'),
                            mime: 'text/plain',
                            filename: 'file1.txt',
                        },
                        {
                            id: 'other-2',
                            projectId: 'other-project-2',
                            blob: createMockBlob('other 2'),
                            mime: 'text/plain',
                            filename: 'file2.txt',
                        },
                        {
                            id: 'target-3',
                            projectId: 'target-project',
                            blob: createMockBlob('target 3'),
                            mime: 'application/pdf',
                            filename: 'document.pdf',
                        },
                    ];
                },
            };

            const providerMultiple = new BrowserAssetProvider(null, mockAssetManagerMultiple as never);
            const assets = await providerMultiple.getAllAssets();

            // Should only include 3 assets from target-project
            expect(assets).toHaveLength(3);
            const ids = assets.map(a => a.id);
            expect(ids).toContain('target-1');
            expect(ids).toContain('target-2');
            expect(ids).toContain('target-3');
            expect(ids).not.toContain('other-1');
            expect(ids).not.toContain('other-2');
        });
    });
});
