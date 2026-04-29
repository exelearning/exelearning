/**
 * H5pExporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { H5pExporter } from './H5pExporter';
import { unzipSync, strToU8, zipSync } from 'fflate';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
} from '../interfaces';

// Mock document adapter
class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor(metadata: Partial<ExportMetadata> = {}, pages: ExportPage[] = []) {
        this.metadata = {
            title: 'Test H5P Project',
            author: 'Test Author',
            language: 'en',
            description: 'A test H5P project',
            license: 'CC-BY-SA',
            theme: 'base',
            ...metadata,
        };
        this.pages = pages;
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

// Mock resource provider
class MockResourceProvider implements ResourceProvider {
    async fetchTheme(_name: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchLibraryFiles(_files: string[]): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchScormFiles(_version: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    normalizeIdeviceType(ideviceType: string): string {
        return ideviceType.toLowerCase().replace(/idevice$/i, '');
    }

    async fetchExeLogo(): Promise<Buffer | null> {
        return null;
    }

    async fetchContentCss(): Promise<Map<string, Buffer>> {
        return new Map();
    }
}

// Mock asset provider with image support
class MockAssetProvider implements AssetProvider {
    private assets: Map<string, { id: string; filename: string; data: Buffer; mimeType: string }> = new Map();

    addAsset(id: string, filename: string, data: Buffer, mimeType: string) {
        this.assets.set(id, { id, filename, data, mimeType });
    }

    async getAsset(path: string): Promise<Buffer | null> {
        const asset = this.assets.get(path);
        return asset ? asset.data : null;
    }

    async getAllAssets(): Promise<
        Array<{
            id: string;
            filename: string;
            path: string;
            mimeType: string;
            data: Buffer;
            originalPath?: string;
        }>
    > {
        return Array.from(this.assets.values()).map(a => ({
            ...a,
            path: a.filename,
        }));
    }
}

// Mock zip provider that tracks files added
class MockZipProvider implements ZipProvider {
    files = new Map<string, string | Buffer>();

    addFile(path: string, content: string | Buffer): void {
        this.files.set(path, content);
    }

    async generateAsync(): Promise<Buffer> {
        const zipData: Record<string, Uint8Array> = {};
        for (const [path, content] of this.files) {
            const data = typeof content === 'string' ? strToU8(content) : new Uint8Array(content);
            zipData[path] = data;
        }
        const zipped = zipSync(zipData);
        return Buffer.from(zipped);
    }
}

// Sample pages for testing
const samplePages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Introduction',
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'block-1',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Welcome to the course.</p>',
                    },
                ],
            },
        ],
    },
    {
        id: 'page-2',
        title: 'Chapter 1',
        parentId: null,
        order: 1,
        blocks: [
            {
                id: 'block-2',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-2',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>This is chapter 1.</p>',
                    },
                ],
            },
        ],
    },
];

// Pages with image references
const pagesWithImages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Page with Image',
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'block-1',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Here is an image:</p><img src="asset://test-asset-id/image.png" alt="Test image">',
                    },
                ],
            },
        ],
    },
];

describe('H5pExporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: H5pExporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new H5pExporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file extension', () => {
            expect(exporter.getFileExtension()).toBe('.h5p');
        });

        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('_h5p');
        });
    });

    describe('Export Process', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data).toBeInstanceOf(Uint8Array);
        });

        it('should generate h5p.json manifest', async () => {
            await exporter.export();

            expect(zip.files.has('h5p.json')).toBe(true);
            const h5pJson = JSON.parse(zip.files.get('h5p.json') as string);
            expect(h5pJson.title).toBe('Test H5P Project');
            expect(h5pJson.mainLibrary).toBe('H5P.Column');
            expect(h5pJson.embedTypes).toContain('iframe');
        });

        it('should generate content/content.json', async () => {
            await exporter.export();

            expect(zip.files.has('content/content.json')).toBe(true);
            const contentJson = JSON.parse(zip.files.get('content/content.json') as string);
            expect(contentJson.content).toBeDefined();
            expect(Array.isArray(contentJson.content)).toBe(true);
        });

        it('should use custom filename when provided', async () => {
            const result = await exporter.export({ filename: 'my-content.h5p' });

            expect(result.success).toBe(true);
            expect(result.filename).toBe('my-content.h5p');
        });

        it('should build filename from metadata', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('test-h5p-project');
            expect(result.filename).toContain('_h5p');
            expect(result.filename).toContain('.h5p');
        });
    });

    describe('H5P Structure Validation', () => {
        it('should produce valid ZIP file', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify it's a valid ZIP by loading with fflate
            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(Object.keys(loadedZip).length).toBeGreaterThan(0);
        });

        it('should include h5p.json in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['h5p.json']).toBeDefined();
        });

        it('should include content directory', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['content/content.json']).toBeDefined();
        });

        it('should include H5P library stubs', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            // Check for H5P.Column library
            expect(loadedZip['H5P.Column-1.16/library.json']).toBeDefined();
            expect(loadedZip['H5P.Column-1.16/semantics.json']).toBeDefined();

            // Check for H5P.AdvancedText library
            expect(loadedZip['H5P.AdvancedText-1.1/library.json']).toBeDefined();
            expect(loadedZip['H5P.AdvancedText-1.1/semantics.json']).toBeDefined();

            // Check for H5P.Image library
            expect(loadedZip['H5P.Image-1.1/library.json']).toBeDefined();
            expect(loadedZip['H5P.Image-1.1/semantics.json']).toBeDefined();
        });
    });

    describe('H5P Manifest Generation', () => {
        it('should include metadata in h5p.json', async () => {
            await exporter.export();

            const h5pJson = JSON.parse(zip.files.get('h5p.json') as string);
            expect(h5pJson.title).toBe('Test H5P Project');
            expect(h5pJson.language).toBe('en');
        });

        it('should include author when available', async () => {
            await exporter.export();

            const h5pJson = JSON.parse(zip.files.get('h5p.json') as string);
            expect(h5pJson.authors).toBeDefined();
            expect(h5pJson.authors.length).toBeGreaterThan(0);
            expect(h5pJson.authors[0].name).toBe('Test Author');
        });

        it('should include preloaded dependencies', async () => {
            await exporter.export();

            const h5pJson = JSON.parse(zip.files.get('h5p.json') as string);
            expect(h5pJson.preloadedDependencies).toBeDefined();
            expect(Array.isArray(h5pJson.preloadedDependencies)).toBe(true);

            const machineNames = h5pJson.preloadedDependencies.map((d: { machineName: string }) => d.machineName);
            expect(machineNames).toContain('H5P.Column');
            expect(machineNames).toContain('H5P.AdvancedText');
            expect(machineNames).toContain('H5P.Image');
        });
    });

    describe('Content Generation', () => {
        it('should create H5P.AdvancedText items for page titles', async () => {
            await exporter.export();

            const contentJson = JSON.parse(zip.files.get('content/content.json') as string);
            const items = contentJson.content;

            // First item should be page title
            expect(items[0].content.library).toContain('H5P.AdvancedText');
            expect(items[0].content.params.text).toContain('Introduction');
        });

        it('should create H5P.AdvancedText items for content', async () => {
            await exporter.export();

            const contentJson = JSON.parse(zip.files.get('content/content.json') as string);
            const items = contentJson.content;

            // Should have text content
            const textItems = items.filter((item: { content: { library: string } }) =>
                item.content.library.includes('H5P.AdvancedText'),
            );
            expect(textItems.length).toBeGreaterThan(0);
        });

        it('should include subContentId for each item', async () => {
            await exporter.export();

            const contentJson = JSON.parse(zip.files.get('content/content.json') as string);
            const items = contentJson.content;

            for (const item of items) {
                expect(item.content.subContentId).toBeDefined();
                // UUID format check
                expect(item.content.subContentId).toMatch(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                );
            }
        });

        it('should process multiple pages', async () => {
            await exporter.export();

            const contentJson = JSON.parse(zip.files.get('content/content.json') as string);
            const items = contentJson.content;

            // Should have items for both pages
            const allText = items
                .map((item: { content: { params: { text?: string } } }) => item.content.params.text || '')
                .join(' ');
            expect(allText).toContain('Introduction');
            expect(allText).toContain('Chapter 1');
        });
    });

    describe('Image Handling', () => {
        it('should handle pages with image content', async () => {
            // Note: Full image extraction requires integration testing with real asset resolution
            // This test verifies the exporter handles pages with images without crashing
            document = new MockDocument({}, pagesWithImages);
            assets.addAsset('test-asset-id', 'image.png', Buffer.from('fake-png-data'), 'image/png');
            exporter = new H5pExporter(document, resources, assets, zip);

            const result = await exporter.export();

            // Should successfully export even with image references
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should include content directory for images', async () => {
            document = new MockDocument({}, pagesWithImages);
            exporter = new H5pExporter(document, resources, assets, zip);

            await exporter.export();

            // Verify content.json is created (images would be extracted to content/images/ in real scenarios)
            expect(zip.files.has('content/content.json')).toBe(true);
        });

        it('should preserve image tags in content', async () => {
            document = new MockDocument({}, pagesWithImages);
            exporter = new H5pExporter(document, resources, assets, zip);

            await exporter.export();

            const contentJson = JSON.parse(zip.files.get('content/content.json') as string);
            const items = contentJson.content;

            // Find item with image reference
            const textItems = items.filter((item: { content: { params: { text?: string } } }) =>
                item.content.params.text?.includes('img'),
            );

            // Should have preserved the image content (even if URL wasn't resolved)
            expect(textItems.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle empty pages array', async () => {
            document = new MockDocument({}, []);
            exporter = new H5pExporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should handle export with no title', async () => {
            document = new MockDocument({ title: '' }, samplePages);
            exporter = new H5pExporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should catch and return errors', async () => {
            // Create a failing zip provider
            const failingZip: ZipProvider = {
                addFile: () => {},
                generateAsync: async () => {
                    throw new Error('ZIP generation failed');
                },
            };
            exporter = new H5pExporter(document, resources, assets, failingZip);

            const result = await exporter.export();
            expect(result.success).toBe(false);
            expect(result.error).toContain('ZIP generation failed');
        });

        it('should handle missing assets gracefully', async () => {
            document = new MockDocument({}, pagesWithImages);
            // Don't add the asset
            exporter = new H5pExporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });
    });

    describe('Library Stubs', () => {
        it('should include valid H5P.Column library.json', async () => {
            await exporter.export();

            const libraryJson = JSON.parse(zip.files.get('H5P.Column-1.16/library.json') as string);
            expect(libraryJson.machineName).toBe('H5P.Column');
            expect(libraryJson.majorVersion).toBe(1);
            expect(libraryJson.minorVersion).toBe(16);
            expect(libraryJson.runnable).toBe(1);
        });

        it('should include valid H5P.AdvancedText library.json', async () => {
            await exporter.export();

            const libraryJson = JSON.parse(zip.files.get('H5P.AdvancedText-1.1/library.json') as string);
            expect(libraryJson.machineName).toBe('H5P.AdvancedText');
            expect(libraryJson.majorVersion).toBe(1);
            expect(libraryJson.minorVersion).toBe(1);
        });

        it('should include valid H5P.Image library.json', async () => {
            await exporter.export();

            const libraryJson = JSON.parse(zip.files.get('H5P.Image-1.1/library.json') as string);
            expect(libraryJson.machineName).toBe('H5P.Image');
            expect(libraryJson.majorVersion).toBe(1);
            expect(libraryJson.minorVersion).toBe(1);
        });

        it('should include semantics.json for all libraries', async () => {
            await exporter.export();

            expect(zip.files.has('H5P.Column-1.16/semantics.json')).toBe(true);
            expect(zip.files.has('H5P.AdvancedText-1.1/semantics.json')).toBe(true);
            expect(zip.files.has('H5P.Image-1.1/semantics.json')).toBe(true);

            // Verify semantics are valid JSON arrays
            const columnSemantics = JSON.parse(zip.files.get('H5P.Column-1.16/semantics.json') as string);
            expect(Array.isArray(columnSemantics)).toBe(true);
        });
    });

    describe('Metadata Handling', () => {
        it('should handle metadata with special characters', async () => {
            document = new MockDocument(
                {
                    title: 'Test & Project <Special>',
                    author: 'Author "Quote"',
                },
                samplePages,
            );
            exporter = new H5pExporter(document, resources, assets, zip);

            await exporter.export();

            const h5pJson = JSON.parse(zip.files.get('h5p.json') as string);
            expect(h5pJson.title).toBe('Test & Project <Special>');
        });

        it('should use default language when not provided', async () => {
            document = new MockDocument({ language: undefined }, samplePages);
            exporter = new H5pExporter(document, resources, assets, zip);

            await exporter.export();

            const h5pJson = JSON.parse(zip.files.get('h5p.json') as string);
            expect(h5pJson.language).toBe('en');
        });

        it('should handle empty author', async () => {
            document = new MockDocument({ author: '' }, samplePages);
            exporter = new H5pExporter(document, resources, assets, zip);

            await exporter.export();

            const h5pJson = JSON.parse(zip.files.get('h5p.json') as string);
            expect(h5pJson.authors).toEqual([]);
        });
    });
});
