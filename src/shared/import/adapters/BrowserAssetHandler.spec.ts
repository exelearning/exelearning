/**
 * BrowserAssetHandler Unit Tests
 *
 * Tests for the browser-specific asset handler adapter.
 * This adapter wraps the browser's AssetManager for use with the unified ElpxImporter.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { BrowserAssetHandler, createBrowserAssetHandler } from './BrowserAssetHandler';

describe('BrowserAssetHandler', () => {
    let mockAssetManager: ReturnType<typeof createMockAssetManager>;

    // Helper to create a mock AssetManager
    function createMockAssetManager() {
        return {
            init: mock(() => Promise.resolve()),
            storeBlob: mock(() => Promise.resolve('stored-id')),
            setAssetMetadata: mock(() => {}),
            getAssetUrl: mock((id: string, filename: string) => `asset://${id}/${filename}`),
            calculateHash: mock(() => Promise.resolve('mock-hash')),
            hashToUUID: mock(() => 'mock-uuid'),
            getAssetByHash: mock(() => Promise.resolve(null)),
            extractAssetsFromZip: mock(() => Promise.resolve(new Map([['test.jpg', 'asset-1']]))),
            convertContextPathToAssetRefs: mock((html: string) => html.replace('{{context_path}}', 'asset://1')),
            preloadAllAssets: mock(() => Promise.resolve(5)),
        };
    }

    beforeEach(() => {
        mockAssetManager = createMockAssetManager();
    });

    afterEach(() => {
        mockAssetManager = null as unknown as ReturnType<typeof createMockAssetManager>;
    });

    describe('constructor', () => {
        it('should create instance with asset manager', () => {
            const handler = new BrowserAssetHandler(mockAssetManager);
            expect(handler).toBeDefined();
        });

        it('should accept optional logger', () => {
            const mockLogger = {
                log: () => {},
                warn: () => {},
                error: () => {},
            };
            const handler = new BrowserAssetHandler(mockAssetManager, mockLogger);
            expect(handler).toBeDefined();
        });
    });

    describe('storeAsset', () => {
        it('should store asset and return ID', async () => {
            const handler = new BrowserAssetHandler(mockAssetManager);
            const data = new Uint8Array([1, 2, 3, 4]);
            const metadata = {
                filename: 'test.jpg',
                mimeType: 'image/jpeg',
                folderPath: 'images/',
            };

            const result = await handler.storeAsset('asset-id', data, metadata);

            expect(result).toBe('asset-id');
            expect(mockAssetManager.init).toHaveBeenCalled();
            expect(mockAssetManager.storeBlob).toHaveBeenCalledTimes(1);
            expect(mockAssetManager.setAssetMetadata).toHaveBeenCalledTimes(1);
        });

        it('should initialize manager on first call', async () => {
            const handler = new BrowserAssetHandler(mockAssetManager);

            // First call should init
            await handler.storeAsset('id1', new Uint8Array([1]), { filename: 'a.jpg', mimeType: 'image/jpeg' });
            expect(mockAssetManager.init).toHaveBeenCalledTimes(1);

            // Second call should not init again
            await handler.storeAsset('id2', new Uint8Array([2]), { filename: 'b.jpg', mimeType: 'image/jpeg' });
            expect(mockAssetManager.init).toHaveBeenCalledTimes(1);
        });

        it('should pass correct metadata to setAssetMetadata', async () => {
            const handler = new BrowserAssetHandler(mockAssetManager);
            const data = new Uint8Array([1, 2, 3]);
            const metadata = {
                filename: 'document.pdf',
                mimeType: 'application/pdf',
                folderPath: 'docs/',
            };

            await handler.storeAsset('doc-id', data, metadata);

            const call = mockAssetManager.setAssetMetadata.mock.calls[0];
            expect(call[0]).toBe('doc-id');
            expect(call[1]).toMatchObject({
                filename: 'document.pdf',
                folderPath: 'docs/',
                mime: 'application/pdf',
                size: 3,
                uploaded: false,
            });
        });
    });

    describe('extractAssetsFromZip', () => {
        it('should delegate to asset manager', async () => {
            const handler = new BrowserAssetHandler(mockAssetManager);
            const zipContents = {
                'image.jpg': new Uint8Array([1, 2, 3]),
            };

            const result = await handler.extractAssetsFromZip(zipContents);

            expect(mockAssetManager.init).toHaveBeenCalled();
            expect(mockAssetManager.extractAssetsFromZip).toHaveBeenCalledWith(zipContents);
            expect(result.get('test.jpg')).toBe('asset-1');
        });
    });

    describe('convertContextPathToAssetRefs', () => {
        it('should delegate to asset manager', () => {
            const handler = new BrowserAssetHandler(mockAssetManager);
            const html = '<img src="{{context_path}}/image.jpg">';
            const assetMap = new Map([['image.jpg', 'asset-123']]);

            const result = handler.convertContextPathToAssetRefs(html, assetMap);

            expect(mockAssetManager.convertContextPathToAssetRefs).toHaveBeenCalledWith(html, assetMap);
            expect(result).toBe('<img src="asset://1/image.jpg">');
        });
    });

    describe('preloadAllAssets', () => {
        it('should delegate to asset manager', async () => {
            const handler = new BrowserAssetHandler(mockAssetManager);

            await handler.preloadAllAssets();

            expect(mockAssetManager.init).toHaveBeenCalled();
            expect(mockAssetManager.preloadAllAssets).toHaveBeenCalled();
        });
    });

    describe('clear', () => {
        it('should not throw when called', async () => {
            const handler = new BrowserAssetHandler(mockAssetManager);

            // Should not throw, just logs
            await expect(handler.clear()).resolves.toBeUndefined();
        });
    });
});

describe('createBrowserAssetHandler', () => {
    it('should return null for null asset manager', () => {
        const result = createBrowserAssetHandler(null);
        expect(result).toBeNull();
    });

    it('should return null for undefined asset manager', () => {
        const result = createBrowserAssetHandler(undefined);
        expect(result).toBeNull();
    });

    it('should create handler for valid asset manager', () => {
        const mockManager = {
            init: () => Promise.resolve(),
            storeBlob: () => Promise.resolve('id'),
            setAssetMetadata: () => {},
            getAssetUrl: () => 'url',
            calculateHash: () => Promise.resolve('hash'),
            hashToUUID: () => 'uuid',
            getAssetByHash: () => Promise.resolve(null),
            extractAssetsFromZip: () => Promise.resolve(new Map()),
            convertContextPathToAssetRefs: (h: string) => h,
            preloadAllAssets: () => Promise.resolve(0),
        };

        const result = createBrowserAssetHandler(mockManager);

        expect(result).toBeInstanceOf(BrowserAssetHandler);
    });
});
