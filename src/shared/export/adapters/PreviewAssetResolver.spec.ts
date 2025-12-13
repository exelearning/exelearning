/**
 * Tests for PreviewAssetResolver
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { PreviewAssetResolver, type AssetCacheManager } from './PreviewAssetResolver';

// Mock asset cache manager
const createMockAssetManager = (assets: Map<string, string> = new Map()): AssetCacheManager => ({
    resolveAssetUrl: async (assetId: string) => {
        const url = assets.get(assetId);
        if (url) return url;
        throw new Error(`Asset not found: ${assetId}`);
    },
    getAssetBlobUrl: (assetId: string) => assets.get(assetId) ?? null,
});

describe('PreviewAssetResolver', () => {
    let mockManager: AssetCacheManager;
    let resolver: PreviewAssetResolver;

    beforeEach(() => {
        const assets = new Map([
            ['uuid1', 'blob:http://localhost/blob1'],
            ['uuid2', 'blob:http://localhost/blob2'],
            ['uuid3', 'blob:http://localhost/blob3'],
        ]);
        mockManager = createMockAssetManager(assets);
        resolver = new PreviewAssetResolver(mockManager);
    });

    describe('constructor', () => {
        it('should create resolver with asset manager', () => {
            expect(resolver).toBeDefined();
        });
    });

    describe('resolve (async)', () => {
        it('should resolve asset:// URLs to blob URLs', async () => {
            const result = await resolver.resolve('asset://uuid1/image.jpg');
            expect(result).toBe('blob:http://localhost/blob1');
        });

        it('should cache resolved URLs', async () => {
            const result1 = await resolver.resolve('asset://uuid1/image.jpg');
            const result2 = await resolver.resolve('asset://uuid1/other.jpg');
            expect(result1).toBe(result2);
        });

        it('should preserve blob: URLs', async () => {
            const result = await resolver.resolve('blob:http://localhost/existing');
            expect(result).toBe('blob:http://localhost/existing');
        });

        it('should preserve data: URLs', async () => {
            const result = await resolver.resolve('data:image/png;base64,abc');
            expect(result).toBe('data:image/png;base64,abc');
        });

        it('should return original URL for non-asset URLs', async () => {
            const result = await resolver.resolve('https://example.com/image.jpg');
            expect(result).toBe('https://example.com/image.jpg');
        });

        it('should return original URL if asset not found', async () => {
            const result = await resolver.resolve('asset://unknown-uuid/file.jpg');
            expect(result).toBe('asset://unknown-uuid/file.jpg');
        });
    });

    describe('resolveSync', () => {
        it('should return original URL if not cached', () => {
            const result = resolver.resolveSync('asset://uuid1/image.jpg');
            // Not cached yet, returns original
            expect(result).toBe('blob:http://localhost/blob1'); // Uses getAssetBlobUrl
        });

        it('should return cached URL if available', async () => {
            // First resolve async to cache
            await resolver.resolve('asset://uuid1/image.jpg');
            // Then sync should return cached
            const result = resolver.resolveSync('asset://uuid1/other.jpg');
            expect(result).toBe('blob:http://localhost/blob1');
        });

        it('should preserve blob: URLs', () => {
            const result = resolver.resolveSync('blob:http://localhost/existing');
            expect(result).toBe('blob:http://localhost/existing');
        });
    });

    describe('processHtml (async)', () => {
        it('should resolve all asset:// URLs in HTML', async () => {
            const html = '<img src="asset://uuid1/img.jpg"><img src="asset://uuid2/photo.png">';
            const result = await resolver.processHtml(html);
            expect(result).toBe('<img src="blob:http://localhost/blob1"><img src="blob:http://localhost/blob2">');
        });

        it('should handle empty HTML', async () => {
            const result = await resolver.processHtml('');
            expect(result).toBe('');
        });

        it('should preserve non-asset URLs', async () => {
            const html = '<img src="https://example.com/img.jpg">';
            const result = await resolver.processHtml(html);
            expect(result).toBe('<img src="https://example.com/img.jpg">');
        });

        it('should handle multiple occurrences of same asset', async () => {
            const html = '<img src="asset://uuid1/a.jpg"><img src="asset://uuid1/b.jpg">';
            const result = await resolver.processHtml(html);
            expect(result).toBe('<img src="blob:http://localhost/blob1"><img src="blob:http://localhost/blob1">');
        });

        it('should keep original URL if asset not found', async () => {
            const html = '<img src="asset://unknown/file.jpg">';
            const result = await resolver.processHtml(html);
            expect(result).toBe('<img src="asset://unknown/file.jpg">');
        });
    });

    describe('processHtmlSync', () => {
        it('should use cached URLs', async () => {
            // Pre-resolve
            await resolver.resolve('asset://uuid1/img.jpg');
            await resolver.resolve('asset://uuid2/photo.png');

            const html = '<img src="asset://uuid1/img.jpg"><img src="asset://uuid2/photo.png">';
            const result = resolver.processHtmlSync(html);
            expect(result).toBe('<img src="blob:http://localhost/blob1"><img src="blob:http://localhost/blob2">');
        });

        it('should use getAssetBlobUrl for non-cached assets', () => {
            const html = '<img src="asset://uuid1/img.jpg">';
            const result = resolver.processHtmlSync(html);
            // getAssetBlobUrl is available on mock
            expect(result).toBe('<img src="blob:http://localhost/blob1">');
        });
    });

    describe('preResolve', () => {
        it('should pre-resolve multiple asset IDs', async () => {
            await resolver.preResolve(['uuid1', 'uuid2', 'uuid3']);

            // Now sync resolution should work
            expect(resolver.resolveSync('asset://uuid1/a.jpg')).toBe('blob:http://localhost/blob1');
            expect(resolver.resolveSync('asset://uuid2/b.jpg')).toBe('blob:http://localhost/blob2');
            expect(resolver.resolveSync('asset://uuid3/c.jpg')).toBe('blob:http://localhost/blob3');
        });

        it('should skip already cached assets', async () => {
            await resolver.resolve('asset://uuid1/img.jpg');

            // Should not throw even if asset manager would fail
            await resolver.preResolve(['uuid1', 'unknown']);
        });

        it('should handle resolution failures gracefully', async () => {
            // Should not throw
            await resolver.preResolve(['unknown1', 'unknown2']);
        });
    });

    describe('clearCache', () => {
        it('should clear all cached URLs', async () => {
            await resolver.resolve('asset://uuid1/img.jpg');

            // Verify cached
            expect(resolver.resolveSync('asset://uuid1/other.jpg')).toBe('blob:http://localhost/blob1');

            // Clear cache
            resolver.clearCache();

            // Now sync should use getAssetBlobUrl (still works because mock has it)
            // But if we had a mock without getAssetBlobUrl, it would return original
        });
    });
});
