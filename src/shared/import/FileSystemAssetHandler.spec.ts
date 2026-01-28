/**
 * FileSystemAssetHandler Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

import { FileSystemAssetHandler } from './FileSystemAssetHandler';

describe('FileSystemAssetHandler', () => {
    let testDir: string;

    beforeEach(() => {
        testDir = path.join('/tmp', `asset-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(testDir)) {
            mkdirSync(testDir, { recursive: true });
        }
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('constructor', () => {
        it('should create instance with extract path', () => {
            const handler = new FileSystemAssetHandler(testDir);
            expect(handler.getExtractPath()).toBe(testDir);
        });
    });

    describe('storeAsset', () => {
        it('should store asset to filesystem', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const assetId = 'test-asset-123';
            const assetData = new Uint8Array([1, 2, 3, 4, 5]);
            const metadata = {
                filename: 'test.bin',
                mimeType: 'application/octet-stream',
            };

            const result = await handler.storeAsset(assetId, assetData, metadata);
            expect(result).toBe(assetId);

            // Verify file was created
            const filePath = path.join(testDir, 'resources', 'test.bin');
            expect(existsSync(filePath)).toBe(true);

            const storedData = await fs.readFile(filePath);
            expect(storedData.length).toBe(5);
        });

        it('should create resources directory if it does not exist', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const resourcesDir = path.join(testDir, 'resources');
            expect(existsSync(resourcesDir)).toBe(false);

            await handler.storeAsset('id', new Uint8Array([1]), {
                filename: 'test.txt',
                mimeType: 'text/plain',
            });

            expect(existsSync(resourcesDir)).toBe(true);
        });

        it('should handle duplicate filenames', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const metadata = {
                filename: 'duplicate.txt',
                mimeType: 'text/plain',
            };

            await handler.storeAsset('id1', new Uint8Array([1]), metadata);
            await handler.storeAsset('id2', new Uint8Array([2]), metadata);

            // Both files should exist
            expect(existsSync(path.join(testDir, 'resources', 'duplicate.txt'))).toBe(true);
            expect(existsSync(path.join(testDir, 'resources', 'duplicate_1.txt'))).toBe(true);
        });

        it('should store multiple assets with different names', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            await handler.storeAsset('id1', new Uint8Array([1]), {
                filename: 'file1.txt',
                mimeType: 'text/plain',
            });
            await handler.storeAsset('id2', new Uint8Array([2]), {
                filename: 'file2.txt',
                mimeType: 'text/plain',
            });

            expect(existsSync(path.join(testDir, 'resources', 'file1.txt'))).toBe(true);
            expect(existsSync(path.join(testDir, 'resources', 'file2.txt'))).toBe(true);
        });
    });

    describe('extractAssetsFromZip', () => {
        it('should extract assets from ZIP object', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/image.png': new Uint8Array([137, 80, 78, 71]), // PNG header
                'resources/doc.pdf': new Uint8Array([37, 80, 68, 70]), // PDF header
                'content.xml': new Uint8Array([60, 63, 120, 109, 108]), // XML
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            // Should extract resources but not content.xml
            expect(assetMap.size).toBeGreaterThan(0);
            expect(assetMap.has('resources/image.png')).toBe(true);
            expect(assetMap.has('resources/doc.pdf')).toBe(true);
        });

        it('should skip root-level files', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'content.xml': new Uint8Array([60, 63]),
                'metadata.json': new Uint8Array([123, 125]),
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            expect(assetMap.size).toBe(0);
        });

        it('should skip non-asset directories', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'some-other-dir/file.txt': new Uint8Array([1, 2, 3]),
                'content.xml': new Uint8Array([60, 63]),
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            // Should not extract from non-asset directories
            expect(assetMap.has('some-other-dir/file.txt')).toBe(false);
        });

        it('should skip directories (paths ending with /)', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/': new Uint8Array([]),
                'resources/file.txt': new Uint8Array([1, 2, 3]),
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            expect(assetMap.has('resources/')).toBe(false);
            expect(assetMap.has('resources/file.txt')).toBe(true);
        });

        it('should extract from multiple asset directories', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/file1.txt': new Uint8Array([1]),
                'images/file2.png': new Uint8Array([2]),
                'media/file3.mp4': new Uint8Array([3]),
                'files/file4.pdf': new Uint8Array([4]),
                'attachments/file5.doc': new Uint8Array([5]),
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            expect(assetMap.has('resources/file1.txt')).toBe(true);
            expect(assetMap.has('images/file2.png')).toBe(true);
            expect(assetMap.has('media/file3.mp4')).toBe(true);
            expect(assetMap.has('files/file4.pdf')).toBe(true);
            expect(assetMap.has('attachments/file5.doc')).toBe(true);
        });

        it('should also map filename without path', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/image.png': new Uint8Array([137, 80]),
            };

            const assetMap = await handler.extractAssetsFromZip(zip);

            // Should have both full path and filename-only mapping
            expect(assetMap.has('resources/image.png')).toBe(true);
            expect(assetMap.has('image.png')).toBe(true);
        });

        it('should call progress callback for each asset', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/file1.txt': new Uint8Array([1]),
                'resources/file2.txt': new Uint8Array([2]),
                'resources/file3.txt': new Uint8Array([3]),
            };

            const progressCalls: { current: number; total: number; filename: string }[] = [];

            await handler.extractAssetsFromZip(zip, (current, total, filename) => {
                progressCalls.push({ current, total, filename });
            });

            expect(progressCalls.length).toBe(3);
            expect(progressCalls[0]).toEqual({ current: 1, total: 3, filename: 'file1.txt' });
            expect(progressCalls[1]).toEqual({ current: 2, total: 3, filename: 'file2.txt' });
            expect(progressCalls[2]).toEqual({ current: 3, total: 3, filename: 'file3.txt' });
        });

        it('should not fail when progress callback is null', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            const zip = {
                'resources/image.png': new Uint8Array([137, 80]),
            };

            // Should not throw when callback is not provided
            const assetMap = await handler.extractAssetsFromZip(zip);
            expect(assetMap.has('resources/image.png')).toBe(true);
        });
    });

    describe('convertContextPathToAssetRefs', () => {
        it('should convert context_path references to asset URLs', () => {
            const handler = new FileSystemAssetHandler(testDir);

            const assetMap = new Map<string, string>();
            assetMap.set('resources/image.png', 'uuid-123');
            assetMap.set('image.png', 'uuid-123');

            const html = '<img src="{{context_path}}/resources/image.png" />';
            const result = handler.convertContextPathToAssetRefs(html, assetMap);

            // The asset URL format is just asset://assetId (no filename suffix)
            // The export system resolves the full path using buildAssetExportPathMap
            expect(result).toContain('asset://uuid-123');
            expect(result).not.toContain('{{context_path}}');
        });

        it('should return unchanged html if no assets', () => {
            const handler = new FileSystemAssetHandler(testDir);

            const html = '<p>No assets here</p>';
            const result = handler.convertContextPathToAssetRefs(html, new Map());

            expect(result).toBe(html);
        });

        it('should handle null/undefined input', () => {
            const handler = new FileSystemAssetHandler(testDir);

            expect(handler.convertContextPathToAssetRefs(null as unknown as string, new Map())).toBe(null);
            expect(handler.convertContextPathToAssetRefs(undefined as unknown as string, new Map())).toBe(undefined);
        });

        it('should handle empty string', () => {
            const handler = new FileSystemAssetHandler(testDir);

            expect(handler.convertContextPathToAssetRefs('', new Map())).toBe('');
        });

        it('should convert multiple references in same html', () => {
            const handler = new FileSystemAssetHandler(testDir);

            const assetMap = new Map<string, string>();
            assetMap.set('resources/img1.png', 'uuid-1');
            assetMap.set('resources/img2.png', 'uuid-2');
            assetMap.set('img1.png', 'uuid-1');
            assetMap.set('img2.png', 'uuid-2');

            const html = `
                <img src="{{context_path}}/resources/img1.png" />
                <img src="{{context_path}}/resources/img2.png" />
            `;
            const result = handler.convertContextPathToAssetRefs(html, assetMap);

            // The asset URL format is just asset://assetId (no filename suffix)
            expect(result).toContain('asset://uuid-1');
            expect(result).toContain('asset://uuid-2');
        });
    });

    describe('getExtractPath', () => {
        it('should return the extract path', () => {
            const handler = new FileSystemAssetHandler(testDir);
            expect(handler.getExtractPath()).toBe(testDir);
        });
    });

    describe('preloadAllAssets', () => {
        it('should complete without error (no-op for filesystem)', async () => {
            const handler = new FileSystemAssetHandler(testDir);
            await expect(handler.preloadAllAssets()).resolves.toBeUndefined();
        });
    });

    describe('clear', () => {
        it('should remove resources directory', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            // Create some assets first
            await handler.storeAsset('id', new Uint8Array([1]), {
                filename: 'test.txt',
                mimeType: 'text/plain',
            });

            const resourcesDir = path.join(testDir, 'resources');
            expect(existsSync(resourcesDir)).toBe(true);

            await handler.clear();

            expect(existsSync(resourcesDir)).toBe(false);
        });

        it('should handle clearing when no resources directory exists', async () => {
            const handler = new FileSystemAssetHandler(testDir);

            // Don't create any assets
            await expect(handler.clear()).resolves.toBeUndefined();
        });
    });
});
