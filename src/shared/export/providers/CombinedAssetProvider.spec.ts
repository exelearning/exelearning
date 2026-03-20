import { describe, expect, it } from 'bun:test';
import { CombinedAssetProvider } from './CombinedAssetProvider';
import type { AssetProvider, ExportAsset } from '../interfaces';

describe('CombinedAssetProvider', () => {
    // Mock asset for testing
    const mockAsset1: ExportAsset = {
        id: 'asset-1',
        filename: 'image1.png',
        originalPath: 'asset-1/image1.png',
        mime: 'image/png',
        data: Buffer.from('mock image data 1'),
    };

    const mockAsset2: ExportAsset = {
        id: 'asset-2',
        filename: 'image2.jpg',
        originalPath: 'asset-2/image2.jpg',
        mime: 'image/jpeg',
        data: Buffer.from('mock image data 2'),
    };

    const _mockAsset3: ExportAsset = {
        id: 'asset-3',
        filename: 'document.pdf',
        originalPath: 'asset-3/document.pdf',
        mime: 'application/pdf',
        data: Buffer.from('mock pdf data'),
    };

    // Create mock providers
    function createMockProvider(assets: ExportAsset[]): AssetProvider {
        return {
            getAsset: async (path: string) => {
                return assets.find(a => a.originalPath === path || a.id === path.split('/')[0]) || null;
            },
            getAllAssets: async () => assets,
            getProjectAssets: async () => assets,
            exists: async (path: string) => {
                return assets.some(a => a.originalPath === path || a.id === path.split('/')[0]);
            },
            getContent: async (path: string) => {
                const asset = assets.find(a => a.originalPath === path);
                return asset ? Buffer.from(asset.data as Uint8Array) : null;
            },
            getMimeType: (path: string) => {
                const asset = assets.find(a => a.originalPath === path);
                return asset?.mime || 'application/octet-stream';
            },
            clearCache: () => {},
        };
    }

    describe('constructor', () => {
        it('should create provider with empty array', () => {
            const provider = new CombinedAssetProvider([]);
            expect(provider).toBeDefined();
        });

        it('should create provider with multiple providers', () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);
            expect(combined).toBeDefined();
        });
    });

    describe('getAsset', () => {
        it('should return null when no providers have the asset', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider1]);

            const result = await combined.getAsset('nonexistent/file.png');
            expect(result).toBeNull();
        });

        it('should return asset from first provider that has it', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const result = await combined.getAsset('asset-1/image1.png');
            expect(result).toEqual(mockAsset1);
        });

        it('should search second provider if first does not have asset', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const result = await combined.getAsset('asset-2/image2.jpg');
            expect(result).toEqual(mockAsset2);
        });

        it('should return asset from first provider when both have it (priority)', async () => {
            const modifiedAsset: ExportAsset = { ...mockAsset1, data: Buffer.from('modified') };
            const provider1 = createMockProvider([modifiedAsset]);
            const provider2 = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const result = await combined.getAsset('asset-1/image1.png');
            expect(result?.data).toEqual(Buffer.from('modified'));
        });

        it('should handle provider errors gracefully', async () => {
            const errorProvider: AssetProvider = {
                getAsset: async () => {
                    throw new Error('Provider error');
                },
                getAllAssets: async () => [],
                getProjectAssets: async () => [],
            };
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([errorProvider, provider2]);

            const result = await combined.getAsset('asset-2/image2.jpg');
            expect(result).toEqual(mockAsset2);
        });
    });

    describe('getAllAssets', () => {
        it('should return empty array when no providers', async () => {
            const combined = new CombinedAssetProvider([]);
            const result = await combined.getAllAssets();
            expect(result).toEqual([]);
        });

        it('should return all assets from single provider', async () => {
            const provider = createMockProvider([mockAsset1, mockAsset2]);
            const combined = new CombinedAssetProvider([provider]);

            const result = await combined.getAllAssets();
            expect(result).toHaveLength(2);
            expect(result).toContainEqual(mockAsset1);
            expect(result).toContainEqual(mockAsset2);
        });

        it('should combine assets from multiple providers', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const result = await combined.getAllAssets();
            expect(result).toHaveLength(2);
        });

        it('should deduplicate assets by id', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset1, mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const result = await combined.getAllAssets();
            expect(result).toHaveLength(2);
            const ids = result.map(a => a.id);
            expect(ids.filter(id => id === 'asset-1')).toHaveLength(1);
        });

        it('should handle provider errors gracefully', async () => {
            const errorProvider: AssetProvider = {
                getAsset: async () => null,
                getAllAssets: async () => {
                    throw new Error('Provider error');
                },
                getProjectAssets: async () => [],
            };
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([errorProvider, provider2]);

            const result = await combined.getAllAssets();
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(mockAsset2);
        });
    });

    describe('getProjectAssets', () => {
        it('should delegate to getAllAssets', async () => {
            const provider = createMockProvider([mockAsset1, mockAsset2]);
            const combined = new CombinedAssetProvider([provider]);

            const result = await combined.getProjectAssets();
            expect(result).toHaveLength(2);
        });
    });

    describe('exists', () => {
        it('should return true when asset exists in any provider', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const result = await combined.exists('asset-2/image2.jpg');
            expect(result).toBe(true);
        });

        it('should return false when asset does not exist', async () => {
            const provider = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider]);

            const result = await combined.exists('nonexistent/file.png');
            expect(result).toBe(false);
        });
    });

    describe('getContent', () => {
        it('should return buffer content', async () => {
            const provider = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider]);

            const result = await combined.getContent('asset-1/image1.png');
            expect(result).toEqual(Buffer.from('mock image data 1'));
        });

        it('should return null when asset not found', async () => {
            const provider = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider]);

            const result = await combined.getContent('nonexistent/file.png');
            expect(result).toBeNull();
        });
    });

    describe('getMimeType', () => {
        it('should return mime type from first provider with method', () => {
            const provider = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider]);

            const result = combined.getMimeType('asset-1/image1.png');
            expect(result).toBe('image/png');
        });

        it('should return default mime type when no provider has method', () => {
            const providerWithoutMime: AssetProvider = {
                getAsset: async () => null,
                getAllAssets: async () => [],
                getProjectAssets: async () => [],
            };
            const combined = new CombinedAssetProvider([providerWithoutMime]);

            const result = combined.getMimeType('any/file.xyz');
            expect(result).toBe('application/octet-stream');
        });
    });

    describe('clearCache', () => {
        it('should call clearCache on all providers that have it', () => {
            let clearedCount = 0;
            const provider1 = createMockProvider([mockAsset1]);
            provider1.clearCache = () => {
                clearedCount++;
            };
            const provider2 = createMockProvider([mockAsset2]);
            provider2.clearCache = () => {
                clearedCount++;
            };

            const combined = new CombinedAssetProvider([provider1, provider2]);
            combined.clearCache();

            expect(clearedCount).toBe(2);
        });

        it('should handle providers without clearCache method', () => {
            const providerWithoutClear: AssetProvider = {
                getAsset: async () => null,
                getAllAssets: async () => [],
                getProjectAssets: async () => [],
            };
            const combined = new CombinedAssetProvider([providerWithoutClear]);

            expect(() => combined.clearCache()).not.toThrow();
        });
    });

    describe('forEachAsset', () => {
        it('should iterate over all assets across providers', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const processed: string[] = [];
            const count = await combined.forEachAsset(async asset => {
                processed.push(asset.id);
            });

            expect(count).toBe(2);
            expect(processed).toContain('asset-1');
            expect(processed).toContain('asset-2');
        });

        it('should deduplicate by id', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset1, mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const processed: string[] = [];
            await combined.forEachAsset(async asset => {
                processed.push(asset.id);
            });

            expect(processed.filter(id => id === 'asset-1')).toHaveLength(1);
        });

        it('should fall back to getAllAssets for providers without forEachAsset', async () => {
            // createMockProvider doesn't have forEachAsset
            const provider1 = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider1]);

            const processed: string[] = [];
            const count = await combined.forEachAsset(async asset => {
                processed.push(asset.id);
            });

            expect(count).toBe(1);
            expect(processed).toContain('asset-1');
        });
    });

    describe('listAssetMetadata', () => {
        it('should return metadata from all providers', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const metadata = await combined.listAssetMetadata();

            expect(metadata).toHaveLength(2);
            expect(metadata.map(m => m.id)).toContain('asset-1');
            expect(metadata.map(m => m.id)).toContain('asset-2');
        });

        it('should deduplicate by id', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset1, mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const metadata = await combined.listAssetMetadata();

            expect(metadata.filter(m => m.id === 'asset-1')).toHaveLength(1);
        });
    });

    describe('listAssetMetadata and forEachAsset consistency', () => {
        it('should return the same asset IDs from both methods', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const meta = await combined.listAssetMetadata();
            const idsFromMeta = new Set(meta.map(a => a.id));

            const iterated: string[] = [];
            await combined.forEachAsset(async asset => {
                iterated.push(asset.id);
            });

            expect(new Set(iterated)).toEqual(idsFromMeta);
        });

        it('should return the same deduplicated asset IDs from both methods', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset1, mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const meta = await combined.listAssetMetadata();
            const idsFromMeta = new Set(meta.map(a => a.id));

            const iterated: string[] = [];
            await combined.forEachAsset(async asset => {
                iterated.push(asset.id);
            });

            expect(new Set(iterated)).toEqual(idsFromMeta);
            expect(idsFromMeta.size).toBe(2);
        });
    });

    describe('getProviders', () => {
        it('should return copy of providers array', () => {
            const provider1 = createMockProvider([mockAsset1]);
            const provider2 = createMockProvider([mockAsset2]);
            const combined = new CombinedAssetProvider([provider1, provider2]);

            const providers = combined.getProviders();
            expect(providers).toHaveLength(2);
            expect(providers[0]).toBe(provider1);
            expect(providers[1]).toBe(provider2);

            // Verify it's a copy, not the original
            providers.push(createMockProvider([]));
            expect(combined.getProviders()).toHaveLength(2);
        });
    });

    describe('addProvider', () => {
        it('should add provider to end of list', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider1]);

            const provider2 = createMockProvider([mockAsset2]);
            combined.addProvider(provider2);

            const providers = combined.getProviders();
            expect(providers).toHaveLength(2);
            expect(providers[1]).toBe(provider2);
        });
    });

    describe('prependProvider', () => {
        it('should add provider to beginning of list', async () => {
            const provider1 = createMockProvider([mockAsset1]);
            const combined = new CombinedAssetProvider([provider1]);

            const provider2 = createMockProvider([mockAsset2]);
            combined.prependProvider(provider2);

            const providers = combined.getProviders();
            expect(providers).toHaveLength(2);
            expect(providers[0]).toBe(provider2);
        });

        it('should give prepended provider priority', async () => {
            const originalData = Buffer.from('original');
            const newData = Buffer.from('new data');

            const asset1: ExportAsset = { ...mockAsset1, data: originalData };
            const asset2: ExportAsset = { ...mockAsset1, data: newData };

            const provider1 = createMockProvider([asset1]);
            const combined = new CombinedAssetProvider([provider1]);

            const provider2 = createMockProvider([asset2]);
            combined.prependProvider(provider2);

            const result = await combined.getAsset('asset-1/image1.png');
            expect(result?.data).toEqual(newData);
        });
    });
});
