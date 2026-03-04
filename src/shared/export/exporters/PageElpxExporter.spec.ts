/**
 * Unit tests for PageElpxExporter
 *
 * Tests that single page (subtree) export:
 * 1. Exports only the specified page and its descendants
 * 2. Generates valid ELPX format (content.xml + DTD + HTML)
 * 3. Includes ONLY assets referenced by the exported pages (not all project assets)
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { PageElpxExporter } from './PageElpxExporter';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ElpxExportOptions,
} from '../interfaces';

// Mock document with Tree Structure
// Root
//  |- Page 1 (has image asset-uuid-1)
//  |- Page 2 (has image asset-uuid-2)
//      |- Page 2-1 (has image asset-uuid-3)
//      |- Page 2-2
//  |- Page 3 (has image asset-uuid-4)
class MockTreeDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor() {
        this.metadata = {
            title: 'Test Tree Project',
            author: 'Test Author',
            language: 'es',
            description: 'A test project with hierarchy',
            license: 'CC-BY-SA 4.0',
            theme: 'base',
        };

        this.pages = [
            {
                id: 'root',
                title: 'Home',
                parentId: null,
                order: 0,
                blocks: [],
            },
            {
                id: 'page-1',
                title: 'Page 1',
                parentId: 'root',
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        components: [
                            {
                                id: 'comp-1',
                                type: 'text',
                                content:
                                    '<p>Page 1 content with image <img src="asset://aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/image1.jpg"></p>',
                            },
                        ],
                    },
                ],
            },
            {
                id: 'page-2',
                title: 'Page 2',
                parentId: 'root',
                order: 1,
                blocks: [
                    {
                        id: 'block-2',
                        components: [
                            {
                                id: 'comp-2',
                                type: 'text',
                                content:
                                    '<p>Page 2 content with image <img src="asset://11111111-2222-3333-4444-555555555555/image2.jpg"></p>',
                            },
                        ],
                    },
                ],
                properties: {
                    titleHtml: 'Page 2 HTML Title',
                    description: 'Page 2 Description',
                },
            },
            {
                id: 'page-2-1',
                title: 'Page 2-1',
                parentId: 'page-2',
                order: 0,
                blocks: [
                    {
                        id: 'block-2-1',
                        components: [
                            {
                                id: 'comp-2-1',
                                type: 'text',
                                content:
                                    '<p>Page 2-1 content with image <img src="asset://66666666-7777-8888-9999-aaaaaaaaaaaa/image3.jpg"></p>',
                            },
                        ],
                    },
                ],
            },
            {
                id: 'page-2-2',
                title: 'Page 2-2',
                parentId: 'page-2',
                order: 1,
                blocks: [],
            },
            {
                id: 'page-3',
                title: 'Page 3',
                parentId: 'root',
                order: 2,
                blocks: [
                    {
                        id: 'block-3',
                        components: [
                            {
                                id: 'comp-3',
                                type: 'text',
                                content:
                                    '<p>Page 3 content with image <img src="asset://bbbbbbbb-cccc-dddd-eeee-ffffffffffff/image4.jpg"></p>',
                            },
                        ],
                    },
                ],
            },
        ];
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

// Minimal Mocks
class MockResourceProvider implements ResourceProvider {
    async fetchTheme(): Promise<Map<string, Uint8Array>> {
        return new Map([
            ['style.css', new Uint8Array()],
            ['style.js', new Uint8Array()],
        ]);
    }
    async fetchIdeviceResources(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchBaseLibraries(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchLibraryFiles(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchScormFiles(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchContentCss(): Promise<Map<string, Uint8Array>> {
        return new Map([['content/css/base.css', new Uint8Array()]]);
    }
    async fetchExeLogo(): Promise<Uint8Array | null> {
        return null;
    }
    normalizeIdeviceType(type: string): string {
        return type;
    }

    async fetchI18nFile(_language: string): Promise<string> {
        return '';
    }

    async fetchI18nTranslations(_language: string): Promise<Map<string, string>> {
        return new Map();
    }
}

// Asset provider that returns test assets for filtering tests
class MockAssetProvider implements AssetProvider {
    // All project assets - some may not be referenced by all pages
    private allAssets = [
        { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', filename: 'image1.jpg', data: new Uint8Array([1, 2, 3]) },
        { id: '11111111-2222-3333-4444-555555555555', filename: 'image2.jpg', data: new Uint8Array([4, 5, 6]) },
        { id: '66666666-7777-8888-9999-aaaaaaaaaaaa', filename: 'image3.jpg', data: new Uint8Array([7, 8, 9]) },
        { id: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff', filename: 'image4.jpg', data: new Uint8Array([10, 11, 12]) },
    ];

    async getAsset(id: string): Promise<any | null> {
        return this.allAssets.find(a => a.id === id) || null;
    }
    async getAllAssets(): Promise<any[]> {
        return this.allAssets;
    }
    async getProjectAssets(): Promise<any[]> {
        return this.allAssets;
    }
}

class CapturingZipProvider implements ZipProvider {
    files = new Map<string, string | Uint8Array>();

    // Implement ZipArchive methods directly on provider for test simplicity
    addFile(path: string, content: string | Uint8Array) {
        this.files.set(path, content);
    }

    addFiles(files: Map<string, string | Uint8Array>) {
        files.forEach((v, k) => this.files.set(k, v));
    }

    hasFile(path: string) {
        return this.files.has(path);
    }

    getFilePaths() {
        return Array.from(this.files.keys());
    }

    async generate() {
        return new Uint8Array();
    }

    async generateAsync() {
        return new Uint8Array();
    }

    createZip() {
        return this as unknown as any;
    }

    // Test Helper
    getFileAsString(path: string): string | undefined {
        const content = this.files.get(path);
        if (!content) return undefined;
        if (typeof content === 'string') return content;
        return new TextDecoder().decode(content);
    }
}

describe('PageElpxExporter Unit Tests', () => {
    let document: MockTreeDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: CapturingZipProvider;
    let exporter: PageElpxExporter;

    beforeAll(() => {
        document = new MockTreeDocument();
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new CapturingZipProvider();
        exporter = new PageElpxExporter(document, resources, assets, zip);
    });

    describe('File Extension and Suffix', () => {
        it('should return .elpx as file extension', () => {
            expect(exporter.getFileExtension()).toBe('.elpx');
        });

        it('should return empty string as file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('');
        });
    });

    describe('Exporting Subtree (Page 2)', () => {
        it('should export only Page 2 and its children', async () => {
            zip.files.clear();

            const options: ElpxExportOptions = {
                rootPageId: 'page-2',
                filename: 'page2_export',
            };

            const result = await exporter.export(options);
            if (!result.success) console.error('Export failed:', result.error);
            expect(result.success).toBe(true);

            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toBeDefined();

            // Should contain Page 2 and its children
            expect(contentXml).toContain('Page 2');
            expect(contentXml).toContain('Page 2-1');
            expect(contentXml).toContain('Page 2-2');

            // Should contain properties
            expect(contentXml).toContain('<key>titleHtml</key>');
            expect(contentXml).toContain('<value>Page 2 HTML Title</value>');
            expect(contentXml).toContain('<key>description</key>');
            expect(contentXml).toContain('<value>Page 2 Description</value>');

            // Should NOT contain Page 1 or Page 3
            expect(contentXml).not.toContain('Page 1');
            expect(contentXml).not.toContain('Page 3');
        });

        it('should handle missing rootPageId by exporting all', async () => {
            zip.files.clear();
            const result = await exporter.export({});
            expect(result.success).toBe(true);

            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toContain('Page 1');
            expect(contentXml).toContain('Page 3');
        });

        it('should handle invalid rootPageId by exporting all (fallback)', async () => {
            zip.files.clear();
            const result = await exporter.export({ rootPageId: 'invalid-id' });
            expect(result.success).toBe(true);

            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toContain('Page 1');
        });
    });

    describe('Asset Filtering (Page Export)', () => {
        /**
         * These tests verify the fix for: Page export includes only referenced images
         *
         * The issue was that when exporting a single page, ALL project assets were
         * being included instead of just the assets referenced by that page.
         *
         * Tree structure with assets:
         *   Page 1 -> asset aaaaaaaa-... (image1.jpg)
         *   Page 2 -> asset 11111111-... (image2.jpg)
         *     Page 2-1 -> asset 66666666-... (image3.jpg)
         *     Page 2-2 -> (no assets)
         *   Page 3 -> asset bbbbbbbb-... (image4.jpg)
         */

        it('should only include assets used by exported page (Page 1)', async () => {
            zip.files.clear();

            const options: ElpxExportOptions = {
                rootPageId: 'page-1',
                filename: 'page1_export',
            };

            const result = await exporter.export(options);
            expect(result.success).toBe(true);

            // Get all resource files from ZIP
            const resourceFiles = zip.getFilePaths().filter(f => f.startsWith('content/resources/'));
            console.log('Page 1 export resources:', resourceFiles);

            // Should have Page 1's asset (image1.jpg)
            expect(resourceFiles.some(f => f.includes('image1.jpg'))).toBe(true);

            // Should NOT have assets from other pages
            expect(resourceFiles.some(f => f.includes('image2.jpg'))).toBe(false);
            expect(resourceFiles.some(f => f.includes('image3.jpg'))).toBe(false);
            expect(resourceFiles.some(f => f.includes('image4.jpg'))).toBe(false);
        });

        it('should include assets from page and its children (Page 2 subtree)', async () => {
            zip.files.clear();

            const options: ElpxExportOptions = {
                rootPageId: 'page-2',
                filename: 'page2_export',
            };

            const result = await exporter.export(options);
            expect(result.success).toBe(true);

            // Get all resource files from ZIP
            const resourceFiles = zip.getFilePaths().filter(f => f.startsWith('content/resources/'));
            console.log('Page 2 subtree export resources:', resourceFiles);

            // Should have Page 2's asset (image2.jpg)
            expect(resourceFiles.some(f => f.includes('image2.jpg'))).toBe(true);

            // Should have Page 2-1's asset (image3.jpg) - it's a child of Page 2
            expect(resourceFiles.some(f => f.includes('image3.jpg'))).toBe(true);

            // Should NOT have Page 1's asset
            expect(resourceFiles.some(f => f.includes('image1.jpg'))).toBe(false);

            // Should NOT have Page 3's asset
            expect(resourceFiles.some(f => f.includes('image4.jpg'))).toBe(false);
        });

        it('should include all assets when exporting full project (no rootPageId)', async () => {
            zip.files.clear();

            // Export without rootPageId = full project export
            const result = await exporter.export({});
            expect(result.success).toBe(true);

            // Get all resource files from ZIP
            const resourceFiles = zip.getFilePaths().filter(f => f.startsWith('content/resources/'));
            console.log('Full export resources:', resourceFiles);

            // Should have all assets
            expect(resourceFiles.some(f => f.includes('image1.jpg'))).toBe(true);
            expect(resourceFiles.some(f => f.includes('image2.jpg'))).toBe(true);
            expect(resourceFiles.some(f => f.includes('image3.jpg'))).toBe(true);
            expect(resourceFiles.some(f => f.includes('image4.jpg'))).toBe(true);
        });

        it('should handle page with no assets', async () => {
            zip.files.clear();

            // Page 2-2 has no assets
            const options: ElpxExportOptions = {
                rootPageId: 'page-2-2',
                filename: 'page2-2_export',
            };

            const result = await exporter.export(options);
            expect(result.success).toBe(true);

            // Get all resource files from ZIP
            const resourceFiles = zip.getFilePaths().filter(f => f.startsWith('content/resources/'));
            console.log('Page 2-2 (no assets) export resources:', resourceFiles);

            // Should have no image assets (only css/js resources might be included)
            const imageFiles = resourceFiles.filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f));
            expect(imageFiles.length).toBe(0);
        });
    });

    describe('Asset URL Format Support', () => {
        /**
         * These tests verify support for both asset URL formats:
         * - New format: asset://uuid.ext (e.g., asset://abc123.jpg)
         * - Legacy format: asset://uuid/filename (e.g., asset://abc123/image.jpg)
         *
         * The fix for GitHub issue #1058 added support for the new format
         * where AssetManager.js generates URLs like asset://uuid.ext
         */

        it('should extract assets with new format (asset://uuid.ext)', async () => {
            // Create a document with the new asset URL format
            const newFormatDocument: ExportDocument = {
                getMetadata: () => ({
                    title: 'New Format Test',
                    author: 'Test',
                    language: 'en',
                    description: '',
                    license: 'CC-BY-SA',
                    theme: 'base',
                }),
                getNavigation: () => [
                    {
                        id: 'root',
                        title: 'Root',
                        parentId: null,
                        order: 0,
                        blocks: [],
                    },
                    {
                        id: 'page-new-format',
                        title: 'Page with New Format',
                        parentId: 'root',
                        order: 0,
                        blocks: [
                            {
                                id: 'block-new',
                                components: [
                                    {
                                        id: 'comp-new',
                                        type: 'text',
                                        // New format: asset://uuid.ext (no path separator)
                                        content: '<p><img src="asset://new-format-asset-uuid.jpg" alt="test"></p>',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const newFormatAssets: AssetProvider = {
                getAsset: async (id: string) => {
                    if (id === 'new-format-asset-uuid') {
                        return { id, filename: 'test.jpg', data: new Uint8Array([1, 2, 3]) };
                    }
                    return null;
                },
                getAllAssets: async () => [
                    { id: 'new-format-asset-uuid', filename: 'test.jpg', data: new Uint8Array([1, 2, 3]) },
                ],
                getProjectAssets: async () => [
                    { id: 'new-format-asset-uuid', filename: 'test.jpg', data: new Uint8Array([1, 2, 3]) },
                ],
            };

            const newZip = new CapturingZipProvider();
            const newExporter = new PageElpxExporter(newFormatDocument, resources, newFormatAssets, newZip);

            const result = await newExporter.export({
                rootPageId: 'page-new-format',
                filename: 'new_format_test',
            });

            expect(result.success).toBe(true);

            // Verify the asset was extracted and included
            const resourceFiles = newZip.getFilePaths().filter(f => f.startsWith('content/resources/'));
            console.log('New format export resources:', resourceFiles);

            // The asset should be included
            expect(resourceFiles.some(f => f.includes('test.jpg'))).toBe(true);
        });

        it('should extract assets with legacy format (asset://uuid/filename)', async () => {
            // The existing tests use legacy format, but let's be explicit
            const legacyFormatDocument: ExportDocument = {
                getMetadata: () => ({
                    title: 'Legacy Format Test',
                    author: 'Test',
                    language: 'en',
                    description: '',
                    license: 'CC-BY-SA',
                    theme: 'base',
                }),
                getNavigation: () => [
                    {
                        id: 'root',
                        title: 'Root',
                        parentId: null,
                        order: 0,
                        blocks: [],
                    },
                    {
                        id: 'page-legacy-format',
                        title: 'Page with Legacy Format',
                        parentId: 'root',
                        order: 0,
                        blocks: [
                            {
                                id: 'block-legacy',
                                components: [
                                    {
                                        id: 'comp-legacy',
                                        type: 'text',
                                        // Legacy format: asset://uuid/filename
                                        content:
                                            '<p><img src="asset://legacy-format-asset-uuid/original-name.png" alt="test"></p>',
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const legacyFormatAssets: AssetProvider = {
                getAsset: async (id: string) => {
                    if (id === 'legacy-format-asset-uuid') {
                        return { id, filename: 'original-name.png', data: new Uint8Array([4, 5, 6]) };
                    }
                    return null;
                },
                getAllAssets: async () => [
                    { id: 'legacy-format-asset-uuid', filename: 'original-name.png', data: new Uint8Array([4, 5, 6]) },
                ],
                getProjectAssets: async () => [
                    { id: 'legacy-format-asset-uuid', filename: 'original-name.png', data: new Uint8Array([4, 5, 6]) },
                ],
            };

            const legacyZip = new CapturingZipProvider();
            const legacyExporter = new PageElpxExporter(legacyFormatDocument, resources, legacyFormatAssets, legacyZip);

            const result = await legacyExporter.export({
                rootPageId: 'page-legacy-format',
                filename: 'legacy_format_test',
            });

            expect(result.success).toBe(true);

            // Verify the asset was extracted and included
            const resourceFiles = legacyZip.getFilePaths().filter(f => f.startsWith('content/resources/'));
            console.log('Legacy format export resources:', resourceFiles);

            // The asset should be included
            expect(resourceFiles.some(f => f.includes('original-name.png'))).toBe(true);
        });

        it('should extract assets from JSON properties with new format', async () => {
            // Test that asset URLs in properties (not just content) are also extracted
            const propsDocument: ExportDocument = {
                getMetadata: () => ({
                    title: 'Props Test',
                    author: 'Test',
                    language: 'en',
                    description: '',
                    license: 'CC-BY-SA',
                    theme: 'base',
                }),
                getNavigation: () => [
                    {
                        id: 'root',
                        title: 'Root',
                        parentId: null,
                        order: 0,
                        blocks: [],
                    },
                    {
                        id: 'page-props',
                        title: 'Page with Asset in Props',
                        parentId: 'root',
                        order: 0,
                        blocks: [
                            {
                                id: 'block-props',
                                components: [
                                    {
                                        id: 'comp-props',
                                        type: 'image-gallery',
                                        content: '<div class="gallery"></div>',
                                        // Asset URL in properties (common for galleries, etc.)
                                        properties: {
                                            images: [{ src: 'asset://props-asset-uuid.png', caption: 'Test' }],
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };

            const propsAssets: AssetProvider = {
                getAsset: async (id: string) => {
                    if (id === 'props-asset-uuid') {
                        return { id, filename: 'gallery-image.png', data: new Uint8Array([7, 8, 9]) };
                    }
                    return null;
                },
                getAllAssets: async () => [
                    { id: 'props-asset-uuid', filename: 'gallery-image.png', data: new Uint8Array([7, 8, 9]) },
                ],
                getProjectAssets: async () => [
                    { id: 'props-asset-uuid', filename: 'gallery-image.png', data: new Uint8Array([7, 8, 9]) },
                ],
            };

            const propsZip = new CapturingZipProvider();
            const propsExporter = new PageElpxExporter(propsDocument, resources, propsAssets, propsZip);

            const result = await propsExporter.export({
                rootPageId: 'page-props',
                filename: 'props_test',
            });

            expect(result.success).toBe(true);

            // Verify the asset was extracted from properties and included
            const resourceFiles = propsZip.getFilePaths().filter(f => f.startsWith('content/resources/'));
            console.log('Props format export resources:', resourceFiles);

            // The asset should be included
            expect(resourceFiles.some(f => f.includes('gallery-image.png'))).toBe(true);
        });
    });
});
