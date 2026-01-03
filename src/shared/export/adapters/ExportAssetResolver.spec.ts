/**
 * Tests for ExportAssetResolver
 */
import { describe, it, expect } from 'bun:test';
import { ExportAssetResolver } from './ExportAssetResolver';

describe('ExportAssetResolver', () => {
    describe('constructor', () => {
        it('should use default options', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.resolve('asset://uuid/file.jpg')).toBe('content/resources/uuid/file.jpg');
        });

        it('should use custom basePath', () => {
            const resolver = new ExportAssetResolver({ basePath: '../' });
            expect(resolver.resolve('asset://uuid/file.jpg')).toBe('../content/resources/uuid/file.jpg');
        });

        it('should use custom resourceDir', () => {
            const resolver = new ExportAssetResolver({ resourceDir: 'assets' });
            expect(resolver.resolve('asset://uuid/file.jpg')).toBe('assets/uuid/file.jpg');
        });
    });

    describe('resolve', () => {
        it('should resolve asset:// URLs to relative paths', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.resolve('asset://abc123/image.jpg')).toBe('content/resources/abc123/image.jpg');
        });

        it('should handle files with spaces in names', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.resolve('asset://abc123/my image.jpg')).toBe('content/resources/abc123/my image.jpg');
        });

        it('should preserve blob: URLs', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.resolve('blob:http://localhost/abc123')).toBe('blob:http://localhost/abc123');
        });

        it('should preserve data: URLs', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.resolve('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
        });

        it('should handle {{context_path}} placeholders', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.resolve('{{context_path}}/uuid/file.jpg')).toBe('content/resources/uuid/file.jpg');
        });

        it('should return unchanged for other URLs', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.resolve('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
        });
    });

    describe('resolveSync', () => {
        it('should work identically to resolve', () => {
            const resolver = new ExportAssetResolver({ basePath: '../' });
            expect(resolver.resolveSync('asset://uuid/file.jpg')).toBe('../content/resources/uuid/file.jpg');
        });
    });

    describe('processHtml', () => {
        it('should resolve all asset:// URLs in HTML', () => {
            const resolver = new ExportAssetResolver();
            const html = '<img src="asset://uuid1/img.jpg"><img src="asset://uuid2/photo.png">';
            const result = resolver.processHtml(html);
            expect(result).toBe(
                '<img src="content/resources/uuid1/img.jpg"><img src="content/resources/uuid2/photo.png">',
            );
        });

        it('should resolve {{context_path}} placeholders in HTML', () => {
            const resolver = new ExportAssetResolver();
            const html = '<img src="{{context_path}}/uuid/file.jpg">';
            const result = resolver.processHtml(html);
            expect(result).toBe('<img src="content/resources/uuid/file.jpg">');
        });

        it('should handle empty HTML', () => {
            const resolver = new ExportAssetResolver();
            expect(resolver.processHtml('')).toBe('');
        });

        it('should preserve blob: URLs in HTML', () => {
            const resolver = new ExportAssetResolver();
            const html = '<img src="blob:http://localhost/abc123">';
            const result = resolver.processHtml(html);
            expect(result).toBe('<img src="blob:http://localhost/abc123">');
        });

        it('should apply basePath to all resolved URLs', () => {
            const resolver = new ExportAssetResolver({ basePath: '../' });
            const html = '<img src="asset://uuid/file.jpg">';
            const result = resolver.processHtml(html);
            expect(result).toBe('<img src="../content/resources/uuid/file.jpg">');
        });

        it('should handle files/tmp paths', () => {
            const resolver = new ExportAssetResolver();
            const html = '<img src="files/tmp/session123/uuid/file.jpg">';
            const result = resolver.processHtml(html);
            expect(result).toBe('<img src="content/resources/uuid/file.jpg">');
        });
    });

    describe('processHtmlSync', () => {
        it('should work identically to processHtml', () => {
            const resolver = new ExportAssetResolver();
            const html = '<img src="asset://uuid/file.jpg">';
            const result = resolver.processHtmlSync(html);
            expect(result).toBe('<img src="content/resources/uuid/file.jpg">');
        });
    });

    describe('withBasePath', () => {
        it('should create a new resolver with different basePath', () => {
            const resolver = new ExportAssetResolver({ resourceDir: 'assets' });
            const subpageResolver = resolver.withBasePath('../');

            expect(resolver.resolve('asset://uuid/file.jpg')).toBe('assets/uuid/file.jpg');
            expect(subpageResolver.resolve('asset://uuid/file.jpg')).toBe('../assets/uuid/file.jpg');
        });

        it('should preserve resourceDir when creating new resolver', () => {
            const resolver = new ExportAssetResolver({ resourceDir: 'custom' });
            const subpageResolver = resolver.withBasePath('../../');

            expect(subpageResolver.resolve('asset://uuid/file.jpg')).toBe('../../custom/uuid/file.jpg');
        });
    });
});
