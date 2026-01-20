/**
 * Tests for FileSystemAssetProvider
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileSystemAssetProvider } from './FileSystemAssetProvider';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('FileSystemAssetProvider', () => {
    let provider: FileSystemAssetProvider;
    let testDir: string;

    beforeEach(async () => {
        // Create temp directory structure simulating extracted ELP
        testDir = path.join(os.tmpdir(), `test-assets-${Date.now()}`);
        await fs.ensureDir(testDir);

        // Create test asset structure
        // v3.0 format: user assets in content/resources/
        await fs.ensureDir(path.join(testDir, 'content', 'resources'));
        // Legacy format: assets in resources/
        await fs.ensureDir(path.join(testDir, 'resources', 'images'));
        await fs.ensureDir(path.join(testDir, 'resources', 'media'));

        // Create test files
        await fs.writeFile(path.join(testDir, 'resources', 'images', 'photo.jpg'), Buffer.from([0xff, 0xd8, 0xff])); // JPEG magic bytes
        await fs.writeFile(
            path.join(testDir, 'resources', 'images', 'icon.png'),
            Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        ); // PNG magic bytes
        await fs.writeFile(path.join(testDir, 'resources', 'media', 'video.mp4'), Buffer.from('fake mp4 content'));
        // v3.0 format: PDF in content/resources/
        await fs.writeFile(path.join(testDir, 'content', 'resources', 'document.pdf'), Buffer.from('fake pdf content'));

        provider = new FileSystemAssetProvider(testDir);
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('getAsset', () => {
        it('should return asset with correct properties', async () => {
            const asset = await provider.getAsset('resources/images/photo.jpg');

            expect(asset).not.toBeNull();
            expect(asset?.id).toBe('resources/images/photo.jpg');
            expect(asset?.originalPath).toBe('resources/images/photo.jpg');
            expect(asset?.filename).toBe('photo.jpg');
            expect(asset?.mime).toBe('image/jpeg');
            expect(asset?.data).toBeInstanceOf(Buffer);
        });

        it('should normalize path with leading slash', async () => {
            const asset = await provider.getAsset('/resources/images/photo.jpg');

            expect(asset).not.toBeNull();
            expect(asset?.originalPath).toBe('resources/images/photo.jpg');
        });

        it('should return null for non-existent asset', async () => {
            const asset = await provider.getAsset('resources/nonexistent.jpg');

            expect(asset).toBeNull();
        });

        it('should cache assets', async () => {
            const asset1 = await provider.getAsset('resources/images/photo.jpg');
            const asset2 = await provider.getAsset('resources/images/photo.jpg');

            expect(asset1).toBe(asset2); // Same reference
        });

        it('should detect correct MIME type for PNG', async () => {
            const asset = await provider.getAsset('resources/images/icon.png');

            expect(asset?.mime).toBe('image/png');
        });

        it('should detect correct MIME type for MP4', async () => {
            const asset = await provider.getAsset('resources/media/video.mp4');

            expect(asset?.mime).toBe('video/mp4');
        });

        it('should detect correct MIME type for PDF', async () => {
            const asset = await provider.getAsset('content/resources/document.pdf');

            expect(asset?.mime).toBe('application/pdf');
        });
    });

    describe('getAllAssets', () => {
        it('should return all assets from standard directories', async () => {
            const assets = await provider.getAllAssets();

            expect(assets.length).toBeGreaterThanOrEqual(4);
        });

        it('should include assets from resources/images', async () => {
            const assets = await provider.getAllAssets();
            const imagePaths = assets.map(a => a.originalPath);

            expect(imagePaths).toContain('resources/images/photo.jpg');
            expect(imagePaths).toContain('resources/images/icon.png');
        });

        it('should include assets from resources/media', async () => {
            const assets = await provider.getAllAssets();
            const mediaPaths = assets.map(a => a.originalPath);

            expect(mediaPaths).toContain('resources/media/video.mp4');
        });

        it('should include assets from content/resources directory', async () => {
            const assets = await provider.getAllAssets();
            const contentPaths = assets.map(a => a.originalPath);

            expect(contentPaths).toContain('content/resources/document.pdf');
        });
    });

    describe('getAssetsFromDirectory', () => {
        it('should return assets from specific directory', async () => {
            const assets = await provider.getAssetsFromDirectory('resources/images');

            expect(assets.length).toBe(2);
            expect(assets.map(a => a.originalPath)).toContain('resources/images/photo.jpg');
            expect(assets.map(a => a.originalPath)).toContain('resources/images/icon.png');
        });

        it('should return empty array for non-existent directory', async () => {
            const assets = await provider.getAssetsFromDirectory('nonexistent');

            expect(assets).toEqual([]);
        });
    });

    describe('exists', () => {
        it('should return true for existing asset', async () => {
            const exists = await provider.exists('resources/images/photo.jpg');

            expect(exists).toBe(true);
        });

        it('should return false for non-existent asset', async () => {
            const exists = await provider.exists('nonexistent.jpg');

            expect(exists).toBe(false);
        });

        it('should handle paths with leading slash', async () => {
            const exists = await provider.exists('/resources/images/photo.jpg');

            expect(exists).toBe(true);
        });
    });

    describe('getContent', () => {
        it('should return Buffer content', async () => {
            const content = await provider.getContent('resources/images/photo.jpg');

            expect(content).toBeInstanceOf(Buffer);
        });

        it('should return null for non-existent file', async () => {
            const content = await provider.getContent('nonexistent.jpg');

            expect(content).toBeNull();
        });
    });

    describe('getMimeType', () => {
        it('should return correct MIME type for common extensions', () => {
            expect(provider.getMimeType('file.jpg')).toBe('image/jpeg');
            expect(provider.getMimeType('file.jpeg')).toBe('image/jpeg');
            expect(provider.getMimeType('file.png')).toBe('image/png');
            expect(provider.getMimeType('file.gif')).toBe('image/gif');
            expect(provider.getMimeType('file.svg')).toBe('image/svg+xml');
            expect(provider.getMimeType('file.mp3')).toBe('audio/mpeg');
            expect(provider.getMimeType('file.mp4')).toBe('video/mp4');
            expect(provider.getMimeType('file.pdf')).toBe('application/pdf');
            expect(provider.getMimeType('file.html')).toBe('text/html');
            expect(provider.getMimeType('file.css')).toBe('text/css');
            expect(provider.getMimeType('file.js')).toBe('application/javascript');
        });

        it('should return octet-stream for unknown extensions', () => {
            expect(provider.getMimeType('file.xyz')).toBe('application/octet-stream');
        });
    });

    describe('clearCache', () => {
        it('should clear cached assets', async () => {
            // Load asset to cache it
            const asset1 = await provider.getAsset('resources/images/photo.jpg');

            // Clear cache
            provider.clearCache();

            // Load again - should be different reference
            const asset2 = await provider.getAsset('resources/images/photo.jpg');

            expect(asset1).not.toBe(asset2); // Different reference after cache clear
            expect(asset1?.originalPath).toBe(asset2?.originalPath); // Same content
        });
    });

    describe('getBasePath', () => {
        it('should return the base path', () => {
            expect(provider.getBasePath()).toBe(testDir);
        });
    });

    describe('nested directories', () => {
        it('should handle deeply nested asset directories', async () => {
            // Create nested structure
            await fs.ensureDir(path.join(testDir, 'resources', 'images', 'level1', 'level2'));
            await fs.writeFile(
                path.join(testDir, 'resources', 'images', 'level1', 'level2', 'deep.jpg'),
                Buffer.from([0xff, 0xd8, 0xff]),
            );

            const asset = await provider.getAsset('resources/images/level1/level2/deep.jpg');

            expect(asset).not.toBeNull();
            expect(asset?.originalPath).toBe('resources/images/level1/level2/deep.jpg');
        });
    });
});
