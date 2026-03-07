/**
 * BaseExporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BaseExporter } from './BaseExporter';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ExportResult,
} from '../interfaces';

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
    private themeFiles = new Map<string, Buffer>();
    private libraryFiles = new Map<string, Buffer>();
    private scormFiles = new Map<string, Buffer>();

    async fetchTheme(_name: string): Promise<Map<string, Buffer>> {
        return this.themeFiles;
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        return this.libraryFiles;
    }

    async fetchLibraryFiles(_files: string[]): Promise<Map<string, Buffer>> {
        return this.libraryFiles;
    }

    async fetchScormFiles(_version: string): Promise<Map<string, Buffer>> {
        return this.scormFiles;
    }

    normalizeIdeviceType(ideviceType: string): string {
        return ideviceType.toLowerCase().replace(/idevice$/i, '');
    }

    async fetchExeLogo(): Promise<Buffer | null> {
        return null;
    }

    async fetchContentCss(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('content/css/base.css', Buffer.from('/* base css */'));
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
    private assets: Array<{
        id: string;
        filename: string;
        path: string;
        folderPath: string;
        mimeType: string;
        mime: string;
        data: Buffer;
    }> = [];

    addAsset(id: string, filename: string, mimeType: string, data: Buffer, folderPath = ''): void {
        this.assets.push({
            id,
            filename,
            path: `${id}/${filename}`,
            folderPath,
            mimeType,
            mime: mimeType,
            data,
        });
    }

    async getAsset(path: string): Promise<Buffer | null> {
        const asset = this.assets.find(a => a.path === path);
        return asset ? asset.data : null;
    }

    async getAllAssets(): Promise<
        Array<{
            id: string;
            filename: string;
            path: string;
            folderPath: string;
            mimeType: string;
            mime: string;
            data: Buffer;
        }>
    > {
        return this.assets;
    }
}

// Mock zip provider
class MockZipProvider implements ZipProvider {
    files = new Map<string, string | Buffer>();

    addFile(path: string, content: string | Buffer): void {
        this.files.set(path, content);
    }

    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    getFilePaths(): string[] {
        return Array.from(this.files.keys());
    }

    async generateAsync(): Promise<Buffer> {
        // Return a mock buffer
        return Buffer.from('mock-zip-content');
    }
}

// Concrete test implementation of BaseExporter
class TestExporter extends BaseExporter {
    getFileExtension(): string {
        return '.zip';
    }

    getFileSuffix(): string {
        return '_test';
    }

    async export(): Promise<ExportResult> {
        return { success: true, filename: 'test.zip' };
    }

    // Expose protected methods for testing
    testGenerateElpxManifestFile(fileList: string[]): string {
        return this.generateElpxManifestFile(fileList);
    }

    testBuildPageFilenameMap(pages: ExportPage[]): Map<string, string> {
        return this.buildPageFilenameMap(pages);
    }

    testPreprocessPagesForExport(pages: ExportPage[]): Promise<ExportPage[]> {
        return this.preprocessPagesForExport(pages);
    }
}

describe('BaseExporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: TestExporter;

    beforeEach(() => {
        document = new MockDocument();
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new TestExporter(document, resources, assets, zip);
    });

    describe('Structure Access', () => {
        it('should get metadata from document', () => {
            const meta = exporter.getMetadata();
            expect(meta.title).toBe('Test Project');
            expect(meta.author).toBe('Test Author');
        });

        it('should get navigation from document', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
            ];
            document = new MockDocument({}, pages);
            exporter = new TestExporter(document, resources, assets, zip);

            const nav = exporter.getNavigation();
            expect(nav.length).toBe(1);
            expect(nav[0].title).toBe('Page 1');
        });

        it('should build page list', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'p2',
                    title: 'Page 2',
                    parentId: null,
                    order: 1,
                    blocks: [],
                },
            ];
            document = new MockDocument({}, pages);
            exporter = new TestExporter(document, resources, assets, zip);

            const list = exporter.buildPageList();
            expect(list.length).toBe(2);
        });

        it('should get used iDevices from pages', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Hello</p>',
                                },
                                {
                                    id: 'c2',
                                    type: 'MultipleChoiceIdevice',
                                    order: 1,
                                    content: '<div>Quiz</div>',
                                },
                            ],
                        },
                    ],
                },
            ];
            document = new MockDocument({}, pages);
            exporter = new TestExporter(document, resources, assets, zip);

            const usedIdevices = exporter.getUsedIdevices(pages);
            expect(usedIdevices).toContain('FreeTextIdevice');
            expect(usedIdevices).toContain('MultipleChoiceIdevice');
            expect(usedIdevices.length).toBe(2);
        });

        it('should get root pages', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Root 1',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'p2',
                    title: 'Child 1',
                    parentId: 'p1',
                    order: 1,
                    blocks: [],
                },
                {
                    id: 'p3',
                    title: 'Root 2',
                    parentId: null,
                    order: 2,
                    blocks: [],
                },
            ];

            const rootPages = exporter.getRootPages(pages);
            expect(rootPages.length).toBe(2);
            expect(rootPages[0].title).toBe('Root 1');
            expect(rootPages[1].title).toBe('Root 2');
        });

        it('should get child pages', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Root',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'p2',
                    title: 'Child 1',
                    parentId: 'p1',
                    order: 1,
                    blocks: [],
                },
                {
                    id: 'p3',
                    title: 'Child 2',
                    parentId: 'p1',
                    order: 2,
                    blocks: [],
                },
            ];

            const children = exporter.getChildPages('p1', pages);
            expect(children.length).toBe(2);
        });
    });

    describe('String Utilities', () => {
        it('should escape XML special characters', () => {
            expect(exporter.escapeXml('Hello & World')).toBe('Hello &amp; World');
            expect(exporter.escapeXml('<script>')).toBe('&lt;script&gt;');
            expect(exporter.escapeXml('"quoted"')).toBe('&quot;quoted&quot;');
            expect(exporter.escapeXml("it's")).toBe('it&apos;s');
            expect(exporter.escapeXml(null)).toBe('');
            expect(exporter.escapeXml(undefined)).toBe('');
        });

        it('should escape HTML special characters', () => {
            expect(exporter.escapeHtml('Hello & World')).toBe('Hello &amp; World');
            expect(exporter.escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(exporter.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
            expect(exporter.escapeHtml("it's")).toBe('it&#039;s');
        });

        it('should escape CDATA content', () => {
            // Normal content passes through
            expect(exporter.escapeCdata('Hello World')).toBe('Hello World');
            expect(exporter.escapeCdata('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
            // The ]]> sequence is split to prevent premature CDATA close
            expect(exporter.escapeCdata('content]]>more')).toBe('content]]]]><![CDATA[>more');
            expect(exporter.escapeCdata('a]]>b]]>c')).toBe('a]]]]><![CDATA[>b]]]]><![CDATA[>c');
            // Edge cases
            expect(exporter.escapeCdata(null)).toBe('');
            expect(exporter.escapeCdata(undefined)).toBe('');
            expect(exporter.escapeCdata('')).toBe('');
        });

        it('should sanitize filenames', () => {
            expect(exporter.sanitizeFilename('Hello World')).toBe('hello-world');
            expect(exporter.sanitizeFilename('Test@#$%File!')).toBe('testfile');
            expect(exporter.sanitizeFilename('  Spaces  ')).toBe('-spaces-');
            expect(exporter.sanitizeFilename('Normal Title')).toBe('normal-title');
            expect(exporter.sanitizeFilename(null)).toBe('export');
            expect(exporter.sanitizeFilename('')).toBe('export');
        });

        it('should sanitize filenames with accent removal', () => {
            expect(exporter.sanitizeFilename('Documento sin título')).toBe('documento-sin-titulo');
            expect(exporter.sanitizeFilename('Álgebra Básica')).toBe('algebra-basica');
            expect(exporter.sanitizeFilename('Educación Física')).toBe('educacion-fisica');
            expect(exporter.sanitizeFilename('Café & Música')).toBe('cafe-musica');
            expect(exporter.sanitizeFilename('Résumé')).toBe('resume');
            expect(exporter.sanitizeFilename('Niño')).toBe('nino');
        });

        it('should sanitize page filenames with accent removal', () => {
            expect(exporter.sanitizePageFilename('Résumé')).toBe('resume');
            expect(exporter.sanitizePageFilename('Niño')).toBe('nino');
            expect(exporter.sanitizePageFilename('Über')).toBe('uber');
            expect(exporter.sanitizePageFilename('')).toBe('page');
        });

        it('should generate unique IDs', () => {
            const id1 = exporter.generateId('PRE_');
            const id2 = exporter.generateId('PRE_');
            expect(id1).not.toBe(id2);
            expect(id1.startsWith('PRE_')).toBe(true);
        });
    });

    describe('File Handling', () => {
        it('should build filename from metadata', () => {
            const filename = exporter.buildFilename();
            expect(filename).toBe('test-project_test.zip');
        });

        it('should build filename with default when no title', () => {
            document = new MockDocument({ title: '' });
            exporter = new TestExporter(document, resources, assets, zip);
            const filename = exporter.buildFilename();
            expect(filename).toBe('export_test.zip');
        });
    });

    describe('Navigation Helpers', () => {
        const pages: ExportPage[] = [
            { id: 'p1', title: 'Page 1', parentId: null, order: 0, blocks: [] },
            { id: 'p2', title: 'Page 2', parentId: null, order: 1, blocks: [] },
            { id: 'p3', title: 'Page 3', parentId: null, order: 2, blocks: [] },
        ];

        it('should get page link for first page', () => {
            const link = exporter.getPageLink(pages[0], pages);
            expect(link).toBe('index.html');
        });

        it('should get page link for other pages', () => {
            const link = exporter.getPageLink(pages[1], pages);
            expect(link).toBe('p2.html');
        });

        it('should get previous page', () => {
            const prev = exporter.getPreviousPage(pages[1], pages);
            expect(prev?.id).toBe('p1');
        });

        it('should return null for previous page of first page', () => {
            const prev = exporter.getPreviousPage(pages[0], pages);
            expect(prev).toBeNull();
        });

        it('should get next page', () => {
            const next = exporter.getNextPage(pages[1], pages);
            expect(next?.id).toBe('p3');
        });

        it('should return null for next page of last page', () => {
            const next = exporter.getNextPage(pages[2], pages);
            expect(next).toBeNull();
        });

        it('should check ancestor relationship', () => {
            const hierarchicalPages: ExportPage[] = [
                {
                    id: 'root',
                    title: 'Root',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'child',
                    title: 'Child',
                    parentId: 'root',
                    order: 1,
                    blocks: [],
                },
                {
                    id: 'grandchild',
                    title: 'Grandchild',
                    parentId: 'child',
                    order: 2,
                    blocks: [],
                },
            ];

            expect(exporter.isAncestorOf(hierarchicalPages[0], 'child', hierarchicalPages)).toBe(true);
            expect(exporter.isAncestorOf(hierarchicalPages[0], 'grandchild', hierarchicalPages)).toBe(true);
            expect(exporter.isAncestorOf(hierarchicalPages[1], 'root', hierarchicalPages)).toBe(false);
        });
    });

    describe('MIME Type Utilities', () => {
        it('should get extension from MIME type', () => {
            expect(exporter.getExtensionFromMime('image/jpeg')).toBe('.jpg');
            expect(exporter.getExtensionFromMime('image/png')).toBe('.png');
            expect(exporter.getExtensionFromMime('image/svg+xml')).toBe('.svg');
            expect(exporter.getExtensionFromMime('application/pdf')).toBe('.pdf');
            expect(exporter.getExtensionFromMime('video/mp4')).toBe('.mp4');
            expect(exporter.getExtensionFromMime('audio/mpeg')).toBe('.mp3');
            expect(exporter.getExtensionFromMime('unknown/type')).toBe('.bin');
        });
    });

    describe('Content XML Generation', () => {
        it('should generate valid content.xml structure', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Test content</p>',
                                },
                            ],
                        },
                    ],
                },
            ];
            document = new MockDocument({}, pages);
            exporter = new TestExporter(document, resources, assets, zip);

            const xml = exporter.generateContentXml();

            // Check XML declaration and DOCTYPE
            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<!DOCTYPE ode SYSTEM "content.dtd">');
            expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');

            // Check ODE structure sections
            expect(xml).toContain('<userPreferences>');
            expect(xml).toContain('<odeResources>');
            expect(xml).toContain('<odeProperties>');
            expect(xml).toContain('<key>pp_title</key>');
            expect(xml).toContain('<value>Test Project</value>');

            // Check navigation structure (pages)
            expect(xml).toContain('<odeNavStructures>');
            expect(xml).toContain('<odeNavStructure>');
            expect(xml).toContain('<odePageId>p1</odePageId>');
            expect(xml).toContain('<pageName>Page 1</pageName>');

            // Check block structure
            expect(xml).toContain('<odePagStructures>');
            expect(xml).toContain('<odePagStructure>');
            expect(xml).toContain('<odeBlockId>b1</odeBlockId>');

            // Check component structure
            expect(xml).toContain('<odeComponents>');
            expect(xml).toContain('<odeComponent>');
            expect(xml).toContain('<odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>');
            expect(xml).toContain('<htmlView><![CDATA[<p>Test content</p>]]></htmlView>');
        });

        it('should escape special characters in XML', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Page & Title',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
            ];
            document = new MockDocument({ title: 'Project <Test>' }, pages);
            exporter = new TestExporter(document, resources, assets, zip);

            const xml = exporter.generateContentXml();
            expect(xml).toContain('&lt;Test&gt;');
            expect(xml).toContain('Page &amp; Title');
        });
    });

    describe('HTML Content Collection', () => {
        it('should collect all HTML content from pages', () => {
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Content 1</p>',
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'p2',
                    title: 'Page 2',
                    parentId: null,
                    order: 1,
                    blocks: [
                        {
                            id: 'b2',
                            name: 'Block 2',
                            order: 0,
                            components: [
                                {
                                    id: 'c2',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p>Content 2</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            const html = exporter.collectAllHtmlContent(pages);
            expect(html).toContain('Content 1');
            expect(html).toContain('Content 2');
        });
    });

    describe('Asset Handling', () => {
        it('should add assets to ZIP', async () => {
            assets.addAsset('uuid-123', 'image.png', 'image/png', Buffer.from('image-data'));
            assets.addAsset('uuid-456', 'doc.pdf', 'application/pdf', Buffer.from('pdf-data'));

            const count = await exporter.addAssetsToZip();

            expect(count).toBe(2);
            expect(zip.files.has('uuid-123/image.png')).toBe(true);
            expect(zip.files.has('uuid-456/doc.pdf')).toBe(true);
        });

        it('should add assets with prefix', async () => {
            assets.addAsset('uuid-789', 'file.txt', 'text/plain', Buffer.from('text'));

            const count = await exporter.addAssetsToZip('content/');

            expect(count).toBe(1);
            expect(zip.files.has('content/uuid-789/file.txt')).toBe(true);
        });

        it('should handle empty assets gracefully', async () => {
            const count = await exporter.addAssetsToZip();
            expect(count).toBe(0);
        });

        it('should convert asset://uuid.ext to {{context_path}} format when resolved', async () => {
            assets.addAsset('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'image.jpg', 'image/jpeg', Buffer.from(''));

            const content = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            expect(result).toBe('<img src="{{context_path}}/content/resources/image.jpg">');
        });

        it('should convert asset://uuid without extension when resolved', async () => {
            assets.addAsset('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'image.jpg', 'image/jpeg', Buffer.from(''));

            const content = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            expect(result).toBe('<img src="{{context_path}}/content/resources/image.jpg">');
        });

        it('should convert unresolved asset://uuid.ext preserving UUID as filename', async () => {
            // Asset not in map
            const content = '<img src="asset://12345678-1234-1234-1234-123456789012.png">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            expect(result).toBe(
                '<img src="{{context_path}}/content/resources/12345678-1234-1234-1234-123456789012.png">',
            );
        });

        it('should convert unresolved asset://uuid without extension', async () => {
            const content = '<img src="asset://12345678-1234-1234-1234-123456789012">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            expect(result).toBe('<img src="{{context_path}}/content/resources/12345678-1234-1234-1234-123456789012">');
        });

        it('should return empty string for empty content', async () => {
            const result = await exporter.addFilenamesToAssetUrls('');
            expect(result).toBe('');
        });

        it('should return content unchanged when no asset:// URLs', async () => {
            const content = '<p>No assets here</p>';
            const result = await exporter.addFilenamesToAssetUrls(content);
            expect(result).toBe(content);
        });

        it('should handle multiple asset URLs in same content', async () => {
            assets.addAsset('11111111-1111-1111-1111-111111111111', 'img1.jpg', 'image/jpeg', Buffer.from(''));
            assets.addAsset('22222222-2222-2222-2222-222222222222', 'img2.png', 'image/png', Buffer.from(''));

            const content =
                '<img src="asset://11111111-1111-1111-1111-111111111111.jpg"><img src="asset://22222222-2222-2222-2222-222222222222.png">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            expect(result).not.toContain('asset://');
            expect(result).toContain('{{context_path}}/content/resources/img1.jpg');
            expect(result).toContain('{{context_path}}/content/resources/img2.png');
        });

        it('should use folderPath in export path when available', async () => {
            assets.addAsset(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'photo.jpg',
                'image/jpeg',
                Buffer.from(''),
                'images',
            );

            const content = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            expect(result).toBe('<img src="{{context_path}}/content/resources/images/photo.jpg">');
        });

        describe('unknown filename handling', () => {
            it('should replace "unknown" filename with MIME-derived name', async () => {
                assets.addAsset('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'unknown', 'image/jpeg', Buffer.from(''));

                const content = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg">';
                const result = await exporter.addFilenamesToAssetUrls(content);

                // Should use MIME-derived name instead of "unknown"
                expect(result).toContain('asset-a1b2c3d4.jpg');
                expect(result).not.toContain('unknown');
            });

            it('should replace "unknown" filename with "bin" extension for unknown MIME', async () => {
                assets.addAsset(
                    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                    'unknown',
                    'application/octet-stream',
                    Buffer.from(''),
                );

                const content = '<img src="asset://b2c3d4e5-f6a7-8901-bcde-f12345678901">';
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).toContain('asset-b2c3d4e5.bin');
                expect(result).not.toContain('unknown');
            });

            it('should use pdf extension for application/pdf with unknown filename', async () => {
                assets.addAsset('c3d4e5f6-a7b8-9012-cdef-123456789012', 'unknown', 'application/pdf', Buffer.from(''));

                const content = '<a href="asset://c3d4e5f6-a7b8-9012-cdef-123456789012">Download</a>';
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).toContain('asset-c3d4e5f6.pdf');
                expect(result).not.toContain('unknown');
            });
        });

        describe('asset path duplication fix', () => {
            it('should fix folderPath that equals filename (file.pdf → root)', async () => {
                // This simulates corrupted ELPX where folderPath was set to the filename
                // e.g., content/resources/contrato.pdf/contrato.pdf → content/resources/contrato.pdf
                assets.addAsset(
                    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                    'contrato.pdf',
                    'application/pdf',
                    Buffer.from(''),
                    'contrato.pdf', // folderPath incorrectly set to filename
                );

                const content = '<a href="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf">Download</a>';
                const result = await exporter.addFilenamesToAssetUrls(content);

                // Should NOT produce content/resources/contrato.pdf/contrato.pdf
                expect(result).not.toContain('contrato.pdf/contrato.pdf');
                // Should produce content/resources/contrato.pdf
                expect(result).toBe('<a href="{{context_path}}/content/resources/contrato.pdf">Download</a>');
            });

            it('should fix folderPath that ends with /filename', async () => {
                // This simulates a path like images/photo.jpg/photo.jpg
                assets.addAsset(
                    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                    'photo.jpg',
                    'image/jpeg',
                    Buffer.from(''),
                    'images/photo.jpg', // folderPath incorrectly includes the filename
                );

                const content = '<img src="asset://b2c3d4e5-f6a7-8901-bcde-f12345678901.jpg">';
                const result = await exporter.addFilenamesToAssetUrls(content);

                // Should NOT produce content/resources/images/photo.jpg/photo.jpg
                expect(result).not.toContain('photo.jpg/photo.jpg');
                // Should produce content/resources/images/photo.jpg
                expect(result).toBe('<img src="{{context_path}}/content/resources/images/photo.jpg">');
            });

            it('should fix existing duplicated paths in content', async () => {
                // Content already has duplicated paths (from corrupted ELPX content.xml)
                const content =
                    '<a href="{{context_path}}/content/resources/contrato-de-trabajo.pdf/contrato-de-trabajo.pdf">Download</a>';
                const result = await exporter.addFilenamesToAssetUrls(content);

                // Should fix the duplicated path
                expect(result).not.toContain('contrato-de-trabajo.pdf/contrato-de-trabajo.pdf');
                expect(result).toBe(
                    '<a href="{{context_path}}/content/resources/contrato-de-trabajo.pdf">Download</a>',
                );
            });

            it('should fix multiple duplicated paths in same content', async () => {
                const content = `
                    <a href="{{context_path}}/content/resources/file1.pdf/file1.pdf">Download 1</a>
                    <img src="{{context_path}}/content/resources/image.jpg/image.jpg">
                    <a href="{{context_path}}/content/resources/doc.docx/doc.docx">Download 2</a>
                `;
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).not.toContain('file1.pdf/file1.pdf');
                expect(result).not.toContain('image.jpg/image.jpg');
                expect(result).not.toContain('doc.docx/doc.docx');
                expect(result).toContain('content/resources/file1.pdf"');
                expect(result).toContain('content/resources/image.jpg"');
                expect(result).toContain('content/resources/doc.docx"');
            });

            it('should not affect valid nested paths', async () => {
                // Valid path: content/resources/images/photo.jpg (images ≠ photo.jpg)
                assets.addAsset(
                    'c3d4e5f6-a7b8-9012-cdef-123456789012',
                    'photo.jpg',
                    'image/jpeg',
                    Buffer.from(''),
                    'images', // Valid folderPath
                );

                const content = '<img src="asset://c3d4e5f6-a7b8-9012-cdef-123456789012.jpg">';
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).toBe('<img src="{{context_path}}/content/resources/images/photo.jpg">');
            });

            it('should handle root-level assets correctly (empty folderPath)', async () => {
                assets.addAsset(
                    'd4e5f6a7-b8c9-0123-def0-123456789012',
                    'readme.txt',
                    'text/plain',
                    Buffer.from(''),
                    '', // Empty folderPath - asset at root of content/resources
                );

                const content = '<a href="asset://d4e5f6a7-b8c9-0123-def0-123456789012.txt">Read</a>';
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).toBe('<a href="{{context_path}}/content/resources/readme.txt">Read</a>');
            });
        });
    });

    describe('Fallback Styles', () => {
        it('should provide fallback theme CSS', () => {
            const css = exporter.getFallbackThemeCss();
            expect(css).toContain('body');
            expect(css).toContain('font-family');
        });

        it('should provide fallback theme JS', () => {
            const js = exporter.getFallbackThemeJs();
            expect(js).toContain('DOMContentLoaded');
        });
    });

    describe('replaceElpxProtocol', () => {
        it('should replace exe-package:elp href with onclick handler', () => {
            const content = '<a download="exe-package:elp-name" href="exe-package:elp">Download</a>';
            const result = exporter.replaceElpxProtocol(content, 'My Project');

            expect(result).toContain('onclick="if(typeof downloadElpx===\'function\')downloadElpx();return false;"');
            expect(result).not.toContain('href="exe-package:elp"');
        });

        it('should replace download attribute with project name', () => {
            const content = '<a download="exe-package:elp-name" href="exe-package:elp">Download</a>';
            const result = exporter.replaceElpxProtocol(content, 'My Project');

            expect(result).toContain('download="My Project.elpx"');
            expect(result).not.toContain('download="exe-package:elp-name"');
        });

        it('should handle special characters in project title', () => {
            const content = '<a download="exe-package:elp-name" href="exe-package:elp">Download</a>';
            const result = exporter.replaceElpxProtocol(content, 'Project <Test> & "Quotes"');

            // Should escape special XML characters
            expect(result).toContain('download="Project &lt;Test&gt; &amp; &quot;Quotes&quot;.elpx"');
        });

        it('should return content unchanged if no exe-package:elp', () => {
            const content = '<a href="normal-link.html">Normal Link</a>';
            const result = exporter.replaceElpxProtocol(content, 'Project');

            expect(result).toBe(content);
        });

        it('should return empty string for empty content', () => {
            const result = exporter.replaceElpxProtocol('', 'Project');
            expect(result).toBe('');
        });

        it('should handle multiple exe-package:elp links', () => {
            const content = `
                <a download="exe-package:elp-name" href="exe-package:elp">First</a>
                <a download="exe-package:elp-name" href="exe-package:elp">Second</a>
            `;
            const result = exporter.replaceElpxProtocol(content, 'Project');

            // Count occurrences of onclick
            const onclickCount = (result.match(/onclick=/g) || []).length;
            expect(onclickCount).toBe(2);

            // Count occurrences of .elpx
            const elpxCount = (result.match(/\.elpx/g) || []).length;
            expect(elpxCount).toBe(2);
        });

        it('should work with download-source-file iDevice HTML structure', () => {
            const content = `
                <div class="exe-download-package-instructions">
                    <table class="exe-table exe-package-info">
                        <caption>General information</caption>
                        <tbody>
                            <tr><th>Title</th><td>My Course</td></tr>
                        </tbody>
                    </table>
                </div>
                <p class="exe-download-package-link">
                    <a download="exe-package:elp-name" href="exe-package:elp" style="background-color:#107275;color:#ffffff;">
                        Download .elp file
                    </a>
                </p>
            `;
            const result = exporter.replaceElpxProtocol(content, 'My Course');

            expect(result).toContain('onclick=');
            expect(result).toContain('download="My Course.elpx"');
            expect(result).toContain('style="background-color:#107275;color:#ffffff;"');
            expect(result).toContain('Download .elp file');
        });
    });

    describe('ELPX Manifest Generation', () => {
        describe('generateElpxManifestFile', () => {
            it('should generate standalone JS file content', () => {
                const fileList = ['index.html', 'libs/jquery.js'];
                const result = exporter.testGenerateElpxManifestFile(fileList);

                expect(result).toContain('ELPX Manifest');
                expect(result).toContain('window.__ELPX_MANIFEST__=');
                expect(result).toContain('"version": 1');
                expect(result).toContain('"projectTitle": "Test Project"');
            });

            it('should include all files in manifest', () => {
                const fileList = ['index.html', 'html/page2.html', 'content.xml', 'theme/style.css', 'libs/jquery.js'];
                const result = exporter.testGenerateElpxManifestFile(fileList);

                for (const file of fileList) {
                    expect(result).toContain(`"${file}"`);
                }
            });

            it('should be valid JavaScript that sets window property', () => {
                const fileList = ['index.html'];
                const result = exporter.testGenerateElpxManifestFile(fileList);

                // Should start with a comment
                expect(result.trim().startsWith('/**')).toBe(true);
                // Should set window.__ELPX_MANIFEST__
                expect(result).toContain('window.__ELPX_MANIFEST__=');
            });

            it('should use default project title when not set', () => {
                const docNoTitle = new MockDocument({ title: '' });
                const exporterNoTitle = new TestExporter(docNoTitle, resources, assets, zip);
                const result = exporterNoTitle.testGenerateElpxManifestFile(['index.html']);

                expect(result).toContain('"projectTitle": "eXeLearning-project"');
            });

            it('should format JSON with indentation', () => {
                const fileList = ['index.html'];
                const result = exporter.testGenerateElpxManifestFile(fileList);

                // JSON.stringify with indent should have newlines
                expect(result).toContain('\n');
                // Should have 2-space indentation
                expect(result).toMatch(/"files": \[/);
            });
        });
    });

    describe('Internal Link Handling', () => {
        describe('buildPageUrlMap', () => {
            it('should map first page to index.html', () => {
                const pages = [
                    { id: 'page-1', title: 'Home', blocks: [] },
                    { id: 'page-2', title: 'About', blocks: [] },
                ];
                const map = (exporter as any).buildPageUrlMap(pages);

                expect(map.get('page-1')).toEqual({
                    url: 'index.html',
                    urlFromSubpage: '../index.html',
                });
            });

            it('should map other pages to html/ directory', () => {
                const pages = [
                    { id: 'page-1', title: 'Home', blocks: [] },
                    { id: 'page-2', title: 'About Us', blocks: [] },
                    { id: 'page-3', title: 'Contact', blocks: [] },
                ];
                const map = (exporter as any).buildPageUrlMap(pages);

                expect(map.get('page-2')).toEqual({
                    url: 'html/about-us.html',
                    urlFromSubpage: 'about-us.html',
                });
                expect(map.get('page-3')).toEqual({
                    url: 'html/contact.html',
                    urlFromSubpage: 'contact.html',
                });
            });

            it('should sanitize page titles with special characters', () => {
                const pages = [
                    { id: 'page-1', title: 'Home', blocks: [] },
                    { id: 'page-2', title: 'Capítulo 1: Introducción', blocks: [] },
                ];
                const map = (exporter as any).buildPageUrlMap(pages);

                expect(map.get('page-2')).toEqual({
                    url: 'html/capitulo-1-introduccion.html',
                    urlFromSubpage: 'capitulo-1-introduccion.html',
                });
            });
        });

        describe('replaceInternalLinks', () => {
            it('should replace exe-node links with page URLs from index', () => {
                const pageUrlMap = new Map([
                    ['page-1', { url: 'index.html', urlFromSubpage: '../index.html' }],
                    ['page-2', { url: 'html/about.html', urlFromSubpage: 'about.html' }],
                ]);

                const content = '<a href="exe-node:page-2">Go to About</a>';
                const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);

                expect(result).toBe('<a href="html/about.html">Go to About</a>');
            });

            it('should replace exe-node links with relative URLs from subpage', () => {
                const pageUrlMap = new Map([
                    ['page-1', { url: 'index.html', urlFromSubpage: '../index.html' }],
                    ['page-2', { url: 'html/about.html', urlFromSubpage: 'about.html' }],
                ]);

                const content = '<a href="exe-node:page-1">Go to Home</a>';
                const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, false);

                expect(result).toBe('<a href="../index.html">Go to Home</a>');
            });

            it('should handle multiple links in content', () => {
                const pageUrlMap = new Map([
                    ['page-1', { url: 'index.html', urlFromSubpage: '../index.html' }],
                    ['page-2', { url: 'html/about.html', urlFromSubpage: 'about.html' }],
                    ['page-3', { url: 'html/contact.html', urlFromSubpage: 'contact.html' }],
                ]);

                const content = '<a href="exe-node:page-2">About</a> and <a href="exe-node:page-3">Contact</a>';
                const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);

                expect(result).toBe('<a href="html/about.html">About</a> and <a href="html/contact.html">Contact</a>');
            });

            it('should leave non-matching links unchanged', () => {
                const pageUrlMap = new Map([['page-1', { url: 'index.html', urlFromSubpage: '../index.html' }]]);

                const content = '<a href="exe-node:unknown-page">Unknown</a>';
                const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);

                expect(result).toBe('<a href="exe-node:unknown-page">Unknown</a>');
            });

            it('should handle content without exe-node links', () => {
                const pageUrlMap = new Map([['page-1', { url: 'index.html', urlFromSubpage: '../index.html' }]]);

                const content = '<a href="https://example.com">External</a>';
                const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);

                expect(result).toBe('<a href="https://example.com">External</a>');
            });

            it('should handle empty content', () => {
                const pageUrlMap = new Map();
                const result = (exporter as any).replaceInternalLinks('', pageUrlMap, true);

                expect(result).toBe('');
            });

            it('should handle links with single quotes', () => {
                const pageUrlMap = new Map([['page-2', { url: 'html/about.html', urlFromSubpage: 'about.html' }]]);

                const content = "<a href='exe-node:page-2'>About</a>";
                const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);

                expect(result).toBe('<a href="html/about.html">About</a>');
            });
        });
    });

    describe('buildPageFilenameMap', () => {
        it('should map first page to index.html', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'About', parentId: null, order: 1, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('index.html');
        });

        it('should generate unique filenames for pages with same title', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'Nueva página', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: 'Nueva página', parentId: null, order: 2, blocks: [] },
                { id: 'page-4', title: 'Nueva página', parentId: null, order: 3, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('index.html');
            expect(map.get('page-2')).toBe('nueva-pagina.html');
            expect(map.get('page-3')).toBe('nueva-pagina-2.html');
            expect(map.get('page-4')).toBe('nueva-pagina-3.html');
        });

        it('should append numbers in order (-2, -3, -4...)', () => {
            const pages: ExportPage[] = [
                { id: 'page-0', title: 'Index', parentId: null, order: 0, blocks: [] },
                { id: 'page-1', title: 'Test', parentId: null, order: 1, blocks: [] },
                { id: 'page-2', title: 'Test', parentId: null, order: 2, blocks: [] },
                { id: 'page-3', title: 'Test', parentId: null, order: 3, blocks: [] },
                { id: 'page-4', title: 'Test', parentId: null, order: 4, blocks: [] },
                { id: 'page-5', title: 'Test', parentId: null, order: 5, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('test.html');
            expect(map.get('page-2')).toBe('test-2.html');
            expect(map.get('page-3')).toBe('test-3.html');
            expect(map.get('page-4')).toBe('test-4.html');
            expect(map.get('page-5')).toBe('test-5.html');
        });

        it('should handle mixed titles (some duplicates, some unique)', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'Chapter 1', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: 'Activity', parentId: null, order: 2, blocks: [] },
                { id: 'page-4', title: 'Chapter 2', parentId: null, order: 3, blocks: [] },
                { id: 'page-5', title: 'Activity', parentId: null, order: 4, blocks: [] },
                { id: 'page-6', title: 'Activity', parentId: null, order: 5, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('index.html');
            expect(map.get('page-2')).toBe('chapter-1.html');
            expect(map.get('page-3')).toBe('activity.html');
            expect(map.get('page-4')).toBe('chapter-2.html');
            expect(map.get('page-5')).toBe('activity-2.html');
            expect(map.get('page-6')).toBe('activity-3.html');
        });

        it('should use "page" for empty titles', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: '', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: '', parentId: null, order: 2, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('index.html');
            expect(map.get('page-2')).toBe('page.html');
            expect(map.get('page-3')).toBe('page-2.html');
        });

        it('should normalize special characters in titles', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'Capítulo 1: Introducción', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: 'Capítulo 1: Introducción', parentId: null, order: 2, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-2')).toBe('capitulo-1-introduccion.html');
            expect(map.get('page-3')).toBe('capitulo-1-introduccion-2.html');
        });

        it('should handle case where first page has duplicate title', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Nueva página', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'Nueva página', parentId: null, order: 1, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            // First page is always index.html regardless of title
            expect(map.get('page-1')).toBe('index.html');
            // Second page gets the normal filename
            expect(map.get('page-2')).toBe('nueva-pagina.html');
        });

        it('should work correctly with buildPageUrlMap integration', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'Test', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: 'Test', parentId: null, order: 2, blocks: [] },
            ];

            // buildPageUrlMap internally uses buildPageFilenameMap
            const urlMap = (exporter as any).buildPageUrlMap(pages);

            expect(urlMap.get('page-1')).toEqual({
                url: 'index.html',
                urlFromSubpage: '../index.html',
            });
            expect(urlMap.get('page-2')).toEqual({
                url: 'html/test.html',
                urlFromSubpage: 'test.html',
            });
            expect(urlMap.get('page-3')).toEqual({
                url: 'html/test-2.html',
                urlFromSubpage: 'test-2.html',
            });
        });

        it('should handle more than 20 pages with same title (maxAttempts limit)', () => {
            // Create 23 pages: 1 index + 22 pages all titled "Test"
            const pages: ExportPage[] = [{ id: 'page-0', title: 'Home', parentId: null, order: 0, blocks: [] }];

            for (let i = 1; i <= 22; i++) {
                pages.push({
                    id: `page-${i}`,
                    title: 'Test',
                    parentId: null,
                    order: i,
                    blocks: [],
                });
            }

            const map = exporter.testBuildPageFilenameMap(pages);

            // First page is index.html
            expect(map.get('page-0')).toBe('index.html');

            // First "Test" page gets test.html (no suffix)
            expect(map.get('page-1')).toBe('test.html');

            // Pages 2-21 get test-2.html through test-21.html (collisions start at 2)
            for (let i = 2; i <= 21; i++) {
                expect(map.get(`page-${i}`)).toBe(`test-${i}.html`);
            }

            // Page 22 exceeds maxAttempts (20), falls back to last attempted filename
            // This is intentional - after 20 attempts, the algorithm gives up
            expect(map.get('page-22')).toBe('test-21.html');
        });

        it('should increment trailing numbers in filename on collision', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'New page 1', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: 'New page 1', parentId: null, order: 2, blocks: [] },
                { id: 'page-4', title: 'New page 1', parentId: null, order: 3, blocks: [] },
                { id: 'page-5', title: 'New page 1', parentId: null, order: 4, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('index.html');
            expect(map.get('page-2')).toBe('new-page-1.html');
            expect(map.get('page-3')).toBe('new-page-2.html'); // Increment, not "new-page-11"
            expect(map.get('page-4')).toBe('new-page-3.html');
            expect(map.get('page-5')).toBe('new-page-4.html');
        });

        it('should handle titles ending with numbers without hyphen', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'Chapter5', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: 'Chapter5', parentId: null, order: 2, blocks: [] },
                { id: 'page-4', title: 'Chapter5', parentId: null, order: 3, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('index.html');
            expect(map.get('page-2')).toBe('chapter5.html');
            expect(map.get('page-3')).toBe('chapter-6.html'); // Increment from 5
            expect(map.get('page-4')).toBe('chapter-7.html');
        });
    });

    describe('preprocessPagesForExport', () => {
        it('should convert asset URLs to {{context_path}} format in component content', async () => {
            // Setup mock asset provider that returns assets with folderPath
            assets.addAsset(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'photo.jpg',
                'image/jpeg',
                Buffer.from(''),
                'images',
            );

            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg">',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ];

            const processed = await exporter.testPreprocessPagesForExport(pages);

            expect(processed[0].blocks[0].components[0].content).toBe(
                '<img src="{{context_path}}/content/resources/images/photo.jpg">',
            );
        });

        it('should convert asset URLs to {{context_path}} format in component properties', async () => {
            // Setup mock asset provider that returns assets with folderPath
            assets.addAsset(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'photo.jpg',
                'image/jpeg',
                Buffer.from(''),
                'images',
            );

            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'gallery',
                                    order: 0,
                                    content: '',
                                    properties: {
                                        imageUrl: 'asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            const processed = await exporter.testPreprocessPagesForExport(pages);

            // Properties should have the {{context_path}} format
            expect(processed[0].blocks[0].components[0].properties.imageUrl).toBe(
                '{{context_path}}/content/resources/images/photo.jpg',
            );
        });

        it('should process multiple assets in properties', async () => {
            assets.addAsset(
                '11111111-2222-3333-4444-555555555555',
                'img1.jpg',
                'image/jpeg',
                Buffer.from(''),
                'gallery',
            );
            assets.addAsset(
                'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                'img2.png',
                'image/png',
                Buffer.from(''),
                'gallery',
            );

            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'image-gallery',
                                    order: 0,
                                    content: '',
                                    properties: {
                                        images: [
                                            { img: 'asset://11111111-2222-3333-4444-555555555555.jpg' },
                                            { img: 'asset://aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png' },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            const processed = await exporter.testPreprocessPagesForExport(pages);

            const images = processed[0].blocks[0].components[0].properties.images;
            expect(images[0].img).toBe('{{context_path}}/content/resources/gallery/img1.jpg');
            expect(images[1].img).toBe('{{context_path}}/content/resources/gallery/img2.png');
        });

        it('should not modify original pages (immutability)', async () => {
            assets.addAsset(
                'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                'photo.jpg',
                'image/jpeg',
                Buffer.from(''),
                'images',
            );

            const originalPages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg">',
                                    properties: {
                                        imageUrl: 'asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ];

            // Keep a copy of original content and properties
            const originalContent = originalPages[0].blocks[0].components[0].content;
            const originalImageUrl = originalPages[0].blocks[0].components[0].properties?.imageUrl;

            await exporter.testPreprocessPagesForExport(originalPages);

            // Original pages should not be modified
            expect(originalPages[0].blocks[0].components[0].content).toBe(originalContent);
            expect(originalPages[0].blocks[0].components[0].properties?.imageUrl).toBe(originalImageUrl);
        });

        it('should handle empty properties', async () => {
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: '<p>No assets</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ];

            const processed = await exporter.testPreprocessPagesForExport(pages);

            expect(processed[0].blocks[0].components[0].content).toBe('<p>No assets</p>');
            expect(processed[0].blocks[0].components[0].properties).toEqual({});
        });

        it('should handle component with undefined properties', async () => {
            const pages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: '<p>No properties</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            const processed = await exporter.testPreprocessPagesForExport(pages);

            expect(processed[0].blocks[0].components[0].content).toBe('<p>No properties</p>');
        });
    });
});
