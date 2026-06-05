/**
 * ComponentExporter tests
 * Tests for exporting individual blocks or iDevices
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ComponentExporter } from './ComponentExporter';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ExportAsset,
} from '../interfaces';
import { unzipSync } from '../providers/FflateZipProvider';

// Mock document adapter
class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor(metadata: Partial<ExportMetadata> = {}, pages: ExportPage[] = []) {
        this.metadata = {
            title: 'Test Project',
            author: 'Test Author',
            language: 'en',
            description: 'A test project',
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
    async fetchTheme(_name: string): Promise<Map<string, Uint8Array>> {
        return new Map();
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Uint8Array>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }

    async fetchLibraryFiles(_files: string[]): Promise<Map<string, Uint8Array>> {
        return new Map();
    }

    async fetchScormFiles(_version: string): Promise<Map<string, Uint8Array>> {
        return new Map();
    }

    normalizeIdeviceType(ideviceType: string): string {
        return ideviceType.toLowerCase().replace(/idevice$/i, '');
    }

    async fetchExeLogo(): Promise<Uint8Array | null> {
        return null;
    }

    async fetchContentCss(): Promise<Map<string, Uint8Array>> {
        const files = new Map<string, Uint8Array>();
        files.set('content/css/base.css', new TextEncoder().encode('/* base css */'));
        return files;
    }

    async fetchI18nFile(_language: string): Promise<string> {
        return '';
    }

    async fetchI18nTranslations(_language: string): Promise<Map<string, string>> {
        return new Map();
    }
}

// Mock asset provider
class MockAssetProvider implements AssetProvider {
    private assets: ExportAsset[] = [];

    setAssets(assets: ExportAsset[]): void {
        this.assets = assets;
    }

    async getAsset(_path: string): Promise<Uint8Array | null> {
        return null;
    }

    async getAllAssets(): Promise<ExportAsset[]> {
        return this.assets;
    }
}

// Mock zip provider
class MockZipProvider implements ZipProvider {
    files = new Map<string, Uint8Array>();

    addFile(path: string, content: Uint8Array | string): void {
        if (typeof content === 'string') {
            this.files.set(path, new TextEncoder().encode(content));
        } else {
            this.files.set(path, content);
        }
    }

    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    getFilePaths(): string[] {
        return Array.from(this.files.keys());
    }

    async generate(): Promise<Uint8Array> {
        // Simple mock that returns a minimal valid zip
        const { zipSync } = await import('fflate');
        const files: Record<string, Uint8Array> = {};
        for (const [path, content] of this.files) {
            files[path] = content;
        }
        return zipSync(files);
    }
}

// Valid 36-char UUID for testing
const SAMPLE_ASSET_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

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
                name: 'Content Block',
                order: 0,
                properties: { layout: 'default' },
                components: [
                    {
                        id: 'idevice-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Welcome to the course.</p>',
                        properties: { title: 'Welcome' },
                    },
                    {
                        id: 'idevice-2',
                        type: 'ImageGalleryIdevice',
                        order: 1,
                        content: `<div class="gallery"><img src="asset://${SAMPLE_ASSET_UUID}" /></div>`,
                        properties: { columns: 3 },
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
                name: 'Chapter Content',
                order: 0,
                components: [
                    {
                        id: 'idevice-3',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>This is chapter 1.</p>',
                    },
                ],
            },
        ],
    },
];

describe('ComponentExporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: ComponentExporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new ComponentExporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file extension', () => {
            expect(exporter.getFileExtension()).toBe('.elp');
        });

        it('should return empty file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('');
        });
    });

    describe('export() method', () => {
        it('should fail when blockId is not provided', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(false);
            expect(result.error).toBe('blockId is required for component export');
        });

        it('should succeed when blockId is provided', async () => {
            const result = await exporter.export({ blockId: 'block-1' });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should export specific idevice when ideviceId is provided', async () => {
            const result = await exporter.export({ blockId: 'block-1', ideviceId: 'idevice-1' });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });
    });

    describe('exportComponent() - Block Export', () => {
        it('should export entire block successfully', async () => {
            const result = await exporter.exportComponent('block-1', null);

            expect(result.success).toBe(true);
            expect(result.filename).toBe('block-1.block');
            expect(result.data).toBeDefined();
        });

        it('should include content.xml in ZIP', async () => {
            await exporter.exportComponent('block-1', null);

            expect(zip.files.has('content.xml')).toBe(true);
        });

        it('should generate valid XML structure', async () => {
            await exporter.exportComponent('block-1', null);

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<?xml version="1.0"');
            expect(contentXml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');
            expect(contentXml).toContain('<key>odeComponentsResources</key>');
            expect(contentXml).toContain('<value>true</value>');
        });

        it('should include block info in XML', async () => {
            await exporter.exportComponent('block-1', null);

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<odeBlockId>block-1</odeBlockId>');
            expect(contentXml).toContain('<blockName>Content Block</blockName>');
        });

        it('should include all components when exporting block', async () => {
            await exporter.exportComponent('block-1', null);

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<odeIdeviceId>idevice-1</odeIdeviceId>');
            expect(contentXml).toContain('<odeIdeviceId>idevice-2</odeIdeviceId>');
        });

        it('should fail when block not found', async () => {
            const result = await exporter.exportComponent('nonexistent-block', null);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Block not found');
        });
    });

    describe('exportComponent() - iDevice Export', () => {
        it('should export single idevice successfully', async () => {
            const result = await exporter.exportComponent('block-1', 'idevice-1');

            expect(result.success).toBe(true);
            expect(result.filename).toBe('idevice-1.idevice');
        });

        it('should only include specified idevice', async () => {
            await exporter.exportComponent('block-1', 'idevice-1');

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<odeIdeviceId>idevice-1</odeIdeviceId>');
            expect(contentXml).not.toContain('<odeIdeviceId>idevice-2</odeIdeviceId>');
        });

        it('should fail when idevice not found', async () => {
            const result = await exporter.exportComponent('block-1', 'nonexistent-idevice');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Component not found');
        });

        it('should treat "null" string as block export', async () => {
            const result = await exporter.exportComponent('block-1', 'null');

            expect(result.success).toBe(true);
            expect(result.filename).toBe('block-1.block');
        });
    });

    describe('XML Generation', () => {
        it('should include component type', async () => {
            await exporter.exportComponent('block-1', 'idevice-1');

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>');
        });

        it('should include component content in CDATA', async () => {
            await exporter.exportComponent('block-1', 'idevice-1');

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<htmlView><![CDATA[<p>Welcome to the course.</p>]]></htmlView>');
        });

        it('should include component properties as JSON', async () => {
            await exporter.exportComponent('block-1', 'idevice-1');

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<jsonProperties><![CDATA[');
            expect(contentXml).toContain('"title":"Welcome"');
        });

        it('should include page ID', async () => {
            await exporter.exportComponent('block-1', 'idevice-1');

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<odePageId>page-1</odePageId>');
        });

        it('should include component order', async () => {
            await exporter.exportComponent('block-1', 'idevice-2');

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<odeComponentsOrder>1</odeComponentsOrder>');
        });

        it('should include block properties', async () => {
            await exporter.exportComponent('block-1', null);

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));

            expect(contentXml).toContain('<odePagStructureProperties>');
            expect(contentXml).toContain('layout');
        });
    });

    describe('Asset Handling', () => {
        it('should include referenced assets in ZIP', async () => {
            assets.setAssets([
                {
                    id: SAMPLE_ASSET_UUID,
                    filename: 'image.png',
                    path: `content/resources/${SAMPLE_ASSET_UUID}/image.png`,
                    originalPath: `content/resources/${SAMPLE_ASSET_UUID}/image.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // PNG header
                    // No folderPath - export path will be just filename
                },
            ]);

            await exporter.exportComponent('block-1', 'idevice-2');

            // When folderPath is not set, path is just the filename
            expect(zip.files.has('content/resources/image.png')).toBe(true);
        });

        it('should not include unreferenced assets', async () => {
            assets.setAssets([
                {
                    id: 'xyz-999',
                    filename: 'unused.jpg',
                    path: 'content/resources/xyz-999/unused.jpg',
                    originalPath: 'content/resources/xyz-999/unused.jpg',
                    mimeType: 'image/jpeg',
                    data: new Uint8Array([0xff, 0xd8]),
                },
            ]);

            await exporter.exportComponent('block-1', 'idevice-1');

            expect(zip.files.has('content/resources/xyz-999/unused.jpg')).toBe(false);
        });

        it('should handle components without asset references', async () => {
            await exporter.exportComponent('block-1', 'idevice-1');

            // Should complete without error
            expect(zip.files.has('content.xml')).toBe(true);
        });

        it('should handle empty asset provider', async () => {
            assets.setAssets([]);

            const result = await exporter.exportComponent('block-1', 'idevice-2');

            expect(result.success).toBe(true);
        });
    });

    describe('ZIP Output', () => {
        it('should produce valid ZIP data', async () => {
            const result = await exporter.exportComponent('block-1', null);

            expect(result.success).toBe(true);
            expect(result.data).toBeInstanceOf(Uint8Array);
            expect(result.data!.length).toBeGreaterThan(0);
        });

        it('should be extractable', async () => {
            const result = await exporter.exportComponent('block-1', null);

            const extracted = unzipSync(result.data!);
            expect(extracted['content.xml']).toBeDefined();
        });
    });

    describe('exportAndDownload()', () => {
        it('should return export result', async () => {
            // Note: downloadBlob won't work in test environment (no window/document)
            const result = await exporter.exportAndDownload('block-1', null);

            expect(result.success).toBe(true);
            expect(result.filename).toBe('block-1.block');
        });

        it('should handle idevice export', async () => {
            const result = await exporter.exportAndDownload('block-1', 'idevice-1');

            expect(result.success).toBe(true);
            expect(result.filename).toBe('idevice-1.idevice');
        });
    });

    describe('Edge Cases', () => {
        it('should handle component with empty content', async () => {
            const pagesWithEmptyContent: ExportPage[] = [
                {
                    id: 'page-empty',
                    title: 'Empty Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-empty',
                            name: 'Empty Block',
                            order: 0,
                            components: [
                                {
                                    id: 'idevice-empty',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithEmptyContent);
            exporter = new ComponentExporter(document, resources, assets, zip);

            const result = await exporter.exportComponent('block-empty', 'idevice-empty');

            expect(result.success).toBe(true);
        });

        it('should handle block without name', async () => {
            const pagesWithoutBlockName: ExportPage[] = [
                {
                    id: 'page-noname',
                    title: 'No Name Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-noname',
                            order: 0,
                            components: [
                                {
                                    id: 'idevice-noname',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Test</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithoutBlockName);
            exporter = new ComponentExporter(document, resources, assets, zip);

            const result = await exporter.exportComponent('block-noname', null);

            expect(result.success).toBe(true);

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));
            expect(contentXml).toContain('<blockName>Block</blockName>');
        });

        it('should handle component without type', async () => {
            const pagesWithoutType: ExportPage[] = [
                {
                    id: 'page-notype',
                    title: 'No Type Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-notype',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'idevice-notype',
                                    order: 0,
                                    content: '<p>Test</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithoutType);
            exporter = new ComponentExporter(document, resources, assets, zip);

            const result = await exporter.exportComponent('block-notype', 'idevice-notype');

            expect(result.success).toBe(true);

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));
            expect(contentXml).toContain('<odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>');
        });

        it('should handle special characters in content', async () => {
            const pagesWithSpecialChars: ExportPage[] = [
                {
                    id: 'page-special',
                    title: 'Special Chars',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-special',
                            name: 'Block <with> "special" & chars',
                            order: 0,
                            components: [
                                {
                                    id: 'idevice-special',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Content with <tags> & "quotes"</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithSpecialChars);
            exporter = new ComponentExporter(document, resources, assets, zip);

            const result = await exporter.exportComponent('block-special', null);

            expect(result.success).toBe(true);

            const contentXml = new TextDecoder().decode(zip.files.get('content.xml'));
            // Block name should be escaped
            expect(contentXml).toContain('&lt;with&gt;');
            expect(contentXml).toContain('&amp;');
            // Content in CDATA should not be escaped
            expect(contentXml).toContain('<![CDATA[<p>Content with <tags>');
        });

        it('should handle block with empty components array', async () => {
            const pagesWithEmptyComponents: ExportPage[] = [
                {
                    id: 'page-empty-comps',
                    title: 'Empty Components',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-empty-comps',
                            name: 'Empty Block',
                            order: 0,
                            components: [],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithEmptyComponents);
            exporter = new ComponentExporter(document, resources, assets, zip);

            const result = await exporter.exportComponent('block-empty-comps', null);

            expect(result.success).toBe(true);
        });

        it('should find block in nested pages', async () => {
            const nestedPages: ExportPage[] = [
                {
                    id: 'page-parent',
                    title: 'Parent Page',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'page-child',
                    title: 'Child Page',
                    parentId: 'page-parent',
                    order: 0,
                    blocks: [
                        {
                            id: 'block-nested',
                            name: 'Nested Block',
                            order: 0,
                            components: [
                                {
                                    id: 'idevice-nested',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Nested content</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, nestedPages);
            exporter = new ComponentExporter(document, resources, assets, zip);

            const result = await exporter.exportComponent('block-nested', null);

            expect(result.success).toBe(true);
            expect(result.filename).toBe('block-nested.block');
        });
    });

    describe('Multiple Asset References', () => {
        it('should handle multiple assets in single component', async () => {
            const asset1Id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            const asset2Id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

            const pagesWithMultipleAssets: ExportPage[] = [
                {
                    id: 'page-multi',
                    title: 'Multi Assets',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-multi',
                            name: 'Multi Block',
                            order: 0,
                            components: [
                                {
                                    id: 'idevice-multi',
                                    type: 'ImageGalleryIdevice',
                                    order: 0,
                                    content: `<img src="asset://${asset1Id}"/><img src="asset://${asset2Id}"/>`,
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithMultipleAssets);
            exporter = new ComponentExporter(document, resources, assets, zip);

            assets.setAssets([
                {
                    id: asset1Id,
                    filename: 'img1.png',
                    path: `content/resources/${asset1Id}/img1.png`,
                    originalPath: `content/resources/${asset1Id}/img1.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([1, 2, 3]),
                    // No folderPath - export path will be just filename
                },
                {
                    id: asset2Id,
                    filename: 'img2.jpg',
                    path: `content/resources/${asset2Id}/img2.jpg`,
                    originalPath: `content/resources/${asset2Id}/img2.jpg`,
                    mimeType: 'image/jpeg',
                    data: new Uint8Array([4, 5, 6]),
                    // No folderPath - export path will be just filename
                },
            ]);

            await exporter.exportComponent('block-multi', 'idevice-multi');

            // When folderPath is not set, path is just the filename
            expect(zip.files.has('content/resources/img1.png')).toBe(true);
            expect(zip.files.has('content/resources/img2.jpg')).toBe(true);
        });
    });
});

/**
 * Test class to expose protected/private methods for testing
 */
class TestComponentExporter extends ComponentExporter {
    async testPreprocessBlockForExport(
        block: import('../interfaces').ExportBlock,
        singleComponent: import('../interfaces').ExportComponent | null,
    ): Promise<import('../interfaces').ExportBlock> {
        // Access the private method via any cast
        return (this as any).preprocessBlockForExport(block, singleComponent);
    }

    async testAddComponentAssetsToZip(
        block: import('../interfaces').ExportBlock,
        singleComponent: import('../interfaces').ExportComponent | null,
    ): Promise<void> {
        return (this as any).addComponentAssetsToZip(block, singleComponent);
    }
}

describe('ComponentExporter - preprocessBlockForExport()', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: TestComponentExporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new TestComponentExporter(document, resources, assets, zip);
    });

    describe('Asset URL Conversion', () => {
        it('should convert asset:// URLs to {{context_path}} format in content', async () => {
            const assetId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'image.png',
                    path: `content/resources/${assetId}/image.png`,
                    originalPath: `content/resources/${assetId}/image.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([1, 2, 3]),
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: `<p>Image: <img src="asset://${assetId}" /></p>`,
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            expect(result.components![0].content).toContain('{{context_path}}/content/resources/');
            expect(result.components![0].content).not.toContain('asset://');
        });

        it('should convert asset:// URLs in properties JSON', async () => {
            const assetId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'background.jpg',
                    path: `content/resources/${assetId}/background.jpg`,
                    originalPath: `content/resources/${assetId}/background.jpg`,
                    mimeType: 'image/jpeg',
                    data: new Uint8Array([4, 5, 6]),
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'CustomIdevice',
                        order: 0,
                        content: '<p>Hello</p>',
                        properties: {
                            backgroundImage: `asset://${assetId}`,
                            title: 'My Title',
                        },
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            expect(result.components![0].properties!.backgroundImage).toContain('{{context_path}}/content/resources/');
            expect(result.components![0].properties!.backgroundImage).not.toContain('asset://');
            expect(result.components![0].properties!.title).toBe('My Title'); // Non-asset property unchanged
        });

        it('should handle nested asset URLs in properties', async () => {
            const assetId1 = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
            const assetId2 = 'd4e5f6a7-b8c9-0123-def0-234567890123';
            assets.setAssets([
                {
                    id: assetId1,
                    filename: 'file1.png',
                    path: `content/resources/${assetId1}/file1.png`,
                    originalPath: `content/resources/${assetId1}/file1.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([1]),
                },
                {
                    id: assetId2,
                    filename: 'file2.png',
                    path: `content/resources/${assetId2}/file2.png`,
                    originalPath: `content/resources/${assetId2}/file2.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([2]),
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'GalleryIdevice',
                        order: 0,
                        content: '',
                        properties: {
                            images: [
                                { src: `asset://${assetId1}`, caption: 'Image 1' },
                                { src: `asset://${assetId2}`, caption: 'Image 2' },
                            ],
                        },
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            const images = result.components![0].properties!.images as Array<{ src: string; caption: string }>;
            expect(images[0].src).toContain('{{context_path}}/content/resources/');
            expect(images[1].src).toContain('{{context_path}}/content/resources/');
            expect(images[0].caption).toBe('Image 1');
            expect(images[1].caption).toBe('Image 2');
        });
    });

    describe('Deep Clone Immutability', () => {
        it('should not mutate the original block', async () => {
            const assetId = 'e5f6a7b8-c9d0-1234-ef01-345678901234';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'test.png',
                    path: `content/resources/${assetId}/test.png`,
                    originalPath: `content/resources/${assetId}/test.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([1]),
                },
            ]);

            const originalContent = `<img src="asset://${assetId}" />`;
            const originalProps = { image: `asset://${assetId}` };

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: originalContent,
                        properties: { ...originalProps },
                    },
                ],
            };

            await exporter.testPreprocessBlockForExport(block, null);

            // Original block should be unchanged
            expect(block.components![0].content).toBe(originalContent);
            expect(block.components![0].content).toContain('asset://');
            expect(block.components![0].properties!.image).toBe(originalProps.image);
        });
    });

    describe('Single Component Filtering', () => {
        it('should only process single component when specified', async () => {
            const assetId = 'f6a7b8c9-d0e1-2345-f012-456789012345';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'img.png',
                    path: `content/resources/${assetId}/img.png`,
                    originalPath: `content/resources/${assetId}/img.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([1]),
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'idevice-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: `<img src="asset://${assetId}" />`,
                    },
                    {
                        id: 'idevice-2',
                        type: 'FreeTextIdevice',
                        order: 1,
                        content: `<img src="asset://${assetId}" />`,
                    },
                ],
            };

            const singleComponent = block.components![0];
            const result = await exporter.testPreprocessBlockForExport(block, singleComponent);

            // Result should only have 1 component
            expect(result.components!.length).toBe(1);
            expect(result.components![0].id).toBe('idevice-1');
            expect(result.components![0].content).toContain('{{context_path}}/content/resources/');
        });

        it('should process all components when singleComponent is null', async () => {
            const assetId = 'a7b8c9d0-e1f2-3456-0123-567890123456';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'img.png',
                    path: `content/resources/${assetId}/img.png`,
                    originalPath: `content/resources/${assetId}/img.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([1]),
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'idevice-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: `<img src="asset://${assetId}" />`,
                    },
                    {
                        id: 'idevice-2',
                        type: 'FreeTextIdevice',
                        order: 1,
                        content: `<img src="asset://${assetId}" />`,
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            // All components should be processed
            expect(result.components!.length).toBe(2);
            expect(result.components![0].content).toContain('{{context_path}}/content/resources/');
            expect(result.components![1].content).toContain('{{context_path}}/content/resources/');
        });
    });

    describe('Empty/Null Content Handling', () => {
        it('should handle empty content', async () => {
            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'idevice-empty',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '',
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            expect(result.components![0].content).toBe('');
        });

        it('should handle undefined content', async () => {
            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'idevice-no-content',
                        type: 'FreeTextIdevice',
                        order: 0,
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            // Should not throw, content should remain undefined
            expect(result.success !== false).toBe(true);
        });

        it('should handle empty properties', async () => {
            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'idevice-empty-props',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Hello</p>',
                        properties: {},
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            expect(result.components![0].properties).toEqual({});
        });

        it('should handle undefined properties', async () => {
            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'idevice-no-props',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Hello</p>',
                    },
                ],
            };

            const result = await exporter.testPreprocessBlockForExport(block, null);

            // Should not throw, properties should remain undefined
            expect(result.success !== false).toBe(true);
        });
    });
});

describe('ComponentExporter - addComponentAssetsToZip with buildAssetExportPathMap', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: TestComponentExporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new TestComponentExporter(document, resources, assets, zip);
    });

    describe('Asset Path Map Usage', () => {
        it('should use buildAssetExportPathMap for consistent paths', async () => {
            const assetId = 'b8c9d0e1-f2a3-4567-1234-678901234567';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'document.pdf',
                    path: `content/resources/${assetId}/document.pdf`,
                    originalPath: `content/resources/${assetId}/document.pdf`,
                    mimeType: 'application/pdf',
                    data: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF header
                    // No folderPath means path will just be filename
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: `<a href="asset://${assetId}">Download PDF</a>`,
                    },
                ],
            };

            await exporter.testAddComponentAssetsToZip(block, null);

            // When folderPath is not set, path is just the filename
            expect(zip.files.has('content/resources/document.pdf')).toBe(true);
        });

        it('should extract asset IDs from properties JSON', async () => {
            const assetId = 'c9d0e1f2-a3b4-5678-2345-789012345678';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'icon.svg',
                    path: `content/resources/${assetId}/icon.svg`,
                    originalPath: `content/resources/${assetId}/icon.svg`,
                    mimeType: 'image/svg+xml',
                    data: new Uint8Array([0x3c, 0x73, 0x76, 0x67]), // <svg
                    // No folderPath means path will just be filename
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'CustomIdevice',
                        order: 0,
                        content: '<p>No asset in content</p>',
                        properties: {
                            customIcon: `asset://${assetId}`,
                            label: 'Custom Label',
                        },
                    },
                ],
            };

            await exporter.testAddComponentAssetsToZip(block, null);

            // Asset should be included even though it's only in properties (path is just filename)
            expect(zip.files.has('content/resources/icon.svg')).toBe(true);
        });

        it('should handle assets with folderPath metadata', async () => {
            const assetId = 'd0e1f2a3-b4c5-6789-3456-890123456789';
            assets.setAssets([
                {
                    id: assetId,
                    filename: 'photo.jpg',
                    path: `content/resources/images/${assetId}/photo.jpg`,
                    originalPath: `content/resources/images/${assetId}/photo.jpg`,
                    mimeType: 'image/jpeg',
                    data: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), // JPEG header
                    folderPath: 'images',
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: `<img src="asset://${assetId}" />`,
                    },
                ],
            };

            await exporter.testAddComponentAssetsToZip(block, null);

            // Asset with folderPath should use that path structure
            const filePaths = Array.from(zip.files.keys());
            const assetPath = filePaths.find(p => p.includes('photo.jpg'));
            expect(assetPath).toBeDefined();
            expect(assetPath).toContain('content/resources/');
        });

        it('should only include assets referenced in content or properties', async () => {
            const usedAssetId = 'e1f2a3b4-c5d6-7890-4567-901234567890';
            const unusedAssetId = 'f2a3b4c5-d6e7-8901-5678-012345678901';

            assets.setAssets([
                {
                    id: usedAssetId,
                    filename: 'used.png',
                    path: `content/resources/${usedAssetId}/used.png`,
                    originalPath: `content/resources/${usedAssetId}/used.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
                    // No folderPath - export path will be just filename
                },
                {
                    id: unusedAssetId,
                    filename: 'unused.png',
                    path: `content/resources/${unusedAssetId}/unused.png`,
                    originalPath: `content/resources/${unusedAssetId}/unused.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
                    // No folderPath - export path will be just filename
                },
            ]);

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: `<img src="asset://${usedAssetId}" />`,
                    },
                ],
            };

            await exporter.testAddComponentAssetsToZip(block, null);

            // Only the used asset should be included (path is just filename)
            expect(zip.files.has('content/resources/used.png')).toBe(true);
            expect(zip.files.has('content/resources/unused.png')).toBe(false);
        });

        it('should handle single component and only extract its assets', async () => {
            const asset1Id = 'a2b3c4d5-e6f7-8901-6789-012345678901';
            const asset2Id = 'b3c4d5e6-f7a8-9012-7890-123456789012';

            assets.setAssets([
                {
                    id: asset1Id,
                    filename: 'comp1.png',
                    path: `content/resources/${asset1Id}/comp1.png`,
                    originalPath: `content/resources/${asset1Id}/comp1.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([1]),
                    // No folderPath - export path will be just filename
                },
                {
                    id: asset2Id,
                    filename: 'comp2.png',
                    path: `content/resources/${asset2Id}/comp2.png`,
                    originalPath: `content/resources/${asset2Id}/comp2.png`,
                    mimeType: 'image/png',
                    data: new Uint8Array([2]),
                    // No folderPath - export path will be just filename
                },
            ]);

            const component1: import('../interfaces').ExportComponent = {
                id: 'idevice-1',
                type: 'FreeTextIdevice',
                order: 0,
                content: `<img src="asset://${asset1Id}" />`,
            };

            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    component1,
                    {
                        id: 'idevice-2',
                        type: 'FreeTextIdevice',
                        order: 1,
                        content: `<img src="asset://${asset2Id}" />`,
                    },
                ],
            };

            // Pass only component1
            await exporter.testAddComponentAssetsToZip(block, component1);

            // Only asset1 should be included (from the single component, path is just filename)
            expect(zip.files.has('content/resources/comp1.png')).toBe(true);
            expect(zip.files.has('content/resources/comp2.png')).toBe(false);
        });

        it('should handle component with no assets gracefully', async () => {
            const block: import('../interfaces').ExportBlock = {
                id: 'test-block',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'test-idevice',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Plain text with no assets</p>',
                        properties: { title: 'No assets here' },
                    },
                ],
            };

            // Should not throw
            await exporter.testAddComponentAssetsToZip(block, null);

            // Only content.xml should exist (no assets)
            const assetPaths = Array.from(zip.files.keys()).filter(p => p.startsWith('content/resources/'));
            expect(assetPaths.length).toBe(0);
        });
    });
});
