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
                        content: '<div class="gallery"><img src="asset://abc-123/image.png" /></div>',
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
                    id: 'abc-123',
                    filename: 'image.png',
                    path: 'content/resources/abc-123/image.png',
                    originalPath: 'content/resources/abc-123/image.png',
                    mimeType: 'image/png',
                    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // PNG header
                },
            ]);

            await exporter.exportComponent('block-1', 'idevice-2');

            expect(zip.files.has('content/resources/abc-123/image.png')).toBe(true);
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
                                    content:
                                        '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890/img1.png"/><img src="asset://b2c3d4e5-f6a7-8901-bcde-f12345678901/img2.jpg"/>',
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
                    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    filename: 'img1.png',
                    path: 'content/resources/a1b2c3d4-e5f6-7890-abcd-ef1234567890/img1.png',
                    originalPath: 'content/resources/a1b2c3d4-e5f6-7890-abcd-ef1234567890/img1.png',
                    mimeType: 'image/png',
                    data: new Uint8Array([1, 2, 3]),
                },
                {
                    id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                    filename: 'img2.jpg',
                    path: 'content/resources/b2c3d4e5-f6a7-8901-bcde-f12345678901/img2.jpg',
                    originalPath: 'content/resources/b2c3d4e5-f6a7-8901-bcde-f12345678901/img2.jpg',
                    mimeType: 'image/jpeg',
                    data: new Uint8Array([4, 5, 6]),
                },
            ]);

            await exporter.exportComponent('block-multi', 'idevice-multi');

            expect(zip.files.has('content/resources/a1b2c3d4-e5f6-7890-abcd-ef1234567890/img1.png')).toBe(true);
            expect(zip.files.has('content/resources/b2c3d4e5-f6a7-8901-bcde-f12345678901/img2.jpg')).toBe(true);
        });
    });
});
