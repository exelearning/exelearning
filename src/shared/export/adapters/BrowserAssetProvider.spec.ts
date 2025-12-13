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

describe('BrowserAssetProvider', () => {
    let mockCache: MockAssetCacheManager;
    let provider: BrowserAssetProvider;

    beforeEach(() => {
        mockCache = new MockAssetCacheManager();
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
});
