/**
 * BaseExporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BaseExporter, resolveMaterialIconDataUris } from './BaseExporter';
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

    setLibraryFiles(files: Map<string, Buffer>): void {
        this.libraryFiles = files;
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

// Mock asset provider with forEachAsset support (for memory-efficient export tests)
class MockAssetProviderWithForEach extends MockAssetProvider {
    async forEachAsset(
        callback: (asset: {
            id: string;
            filename: string;
            originalPath: string;
            folderPath?: string;
            mime: string;
            data: Uint8Array | Blob;
        }) => void | Promise<void>,
    ): Promise<void> {
        const assets = await this.getAllAssets();
        for (const asset of assets) {
            await callback({
                id: asset.id,
                filename: asset.filename,
                originalPath: asset.path,
                folderPath: asset.folderPath,
                mime: asset.mime,
                data: asset.data,
            });
        }
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

    testEnsureElpxDownloadLibraries(
        addFile: (path: string, content: Uint8Array | string) => void,
        commonFiles?: string[],
    ): Promise<void> {
        return this.ensureElpxDownloadLibraries(addFile, commonFiles);
    }

    testAddElpxManifestToZip(fileList: string[], pageFileUrls: string[], commonFiles?: string[]): void {
        this.addElpxManifestToZip(fileList, pageFileUrls, commonFiles);
    }

    testInjectElpxScripts(html: string, page: ExportPage, isIndex: boolean): string {
        return this.injectElpxScripts(html, page, isIndex);
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

        // Defense-in-depth (#1941): an unresolved asset reference means the ZIP will ship a
        // dangling URL with no binary behind it (the collaborative image-loss bug:
        // exported `content/resources/<uuid>` with no file). The exporter must RECORD
        // these so the save/export flow can surface them instead of losing data silently.
        it('records unresolved asset references so silent data loss is detectable', async () => {
            const content = '<img src="asset://12345678-1234-1234-1234-123456789012">';
            await exporter.addFilenamesToAssetUrls(content);

            expect(exporter.getUnresolvedAssetRefs()).toContain('12345678-1234-1234-1234-123456789012');
        });

        it('does not record resolved asset references', async () => {
            assets.addAsset('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'image.jpg', 'image/jpeg', Buffer.from(''));
            await exporter.addFilenamesToAssetUrls('<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890">');

            expect(exporter.getUnresolvedAssetRefs()).toHaveLength(0);
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

        describe('extension-less filename handling', () => {
            it('appends the MIME extension when a stored filename has none (prevents lossy PDF export)', async () => {
                // Reproduces the real bug: a PDF stored as `asset-<uuid>` with no extension.
                assets.addAsset(
                    'e9e79be2-7b98-3e8c-0143-91e790c196f8',
                    'asset-e9e79be2-7b98-3e8c-0143-91e790c196f8',
                    'application/pdf',
                    Buffer.from('%PDF-1.4'),
                );

                const content = '<iframe src="asset://e9e79be2-7b98-3e8c-0143-91e790c196f8"></iframe>';
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).toContain('content/resources/asset-e9e79be2-7b98-3e8c-0143-91e790c196f8.pdf');
            });

            it('does not append .bin for an unknown MIME (leaves the name unchanged)', async () => {
                assets.addAsset(
                    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                    'asset-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                    'application/octet-stream',
                    Buffer.from([1, 2, 3]),
                );

                const content = '<a href="asset://aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee">x</a>';
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).toContain('content/resources/asset-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"');
                expect(result).not.toContain('.bin');
            });

            it('leaves a well-formed filename untouched', async () => {
                assets.addAsset(
                    'ffffffff-1111-2222-3333-444444444444',
                    'report.pdf',
                    'application/pdf',
                    Buffer.from('%PDF-1.4'),
                );

                const content = '<a href="asset://ffffffff-1111-2222-3333-444444444444.pdf">Download</a>';
                const result = await exporter.addFilenamesToAssetUrls(content);

                expect(result).toContain('content/resources/report.pdf');
                expect(result).not.toContain('report.pdf.pdf');
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

    describe('addAssetsToZipWithResourcePath', () => {
        it('should use forEachAsset when available for memory-efficient export', async () => {
            const forEachAssets = new MockAssetProviderWithForEach();
            forEachAssets.addAsset('uuid-a', 'img.png', 'image/png', Buffer.from('png-data'));
            forEachAssets.addAsset('uuid-b', 'doc.pdf', 'application/pdf', Buffer.from('pdf-data'));

            const forEachZip = new MockZipProvider();
            const forEachDoc = new MockDocument({}, []);
            const forEachExporter = new TestExporter(forEachDoc, new MockResourceProvider(), forEachAssets, forEachZip);

            const count = await forEachExporter.addAssetsToZipWithResourcePath();

            expect(count).toBe(2);
            expect(forEachZip.files.has('content/resources/img.png')).toBe(true);
            expect(forEachZip.files.has('content/resources/doc.pdf')).toBe(true);
        });

        it('should fall back to getAllAssets when forEachAsset is not available', async () => {
            assets.addAsset('uuid-c', 'style.css', 'text/css', Buffer.from('css'));

            const count = await exporter.addAssetsToZipWithResourcePath();

            expect(count).toBe(1);
            expect(zip.files.has('content/resources/style.css')).toBe(true);
        });

        it('should populate tracking list when provided', async () => {
            const forEachAssets = new MockAssetProviderWithForEach();
            forEachAssets.addAsset('uuid-d', 'track.txt', 'text/plain', Buffer.from('txt'));

            const forEachZip = new MockZipProvider();
            const forEachDoc = new MockDocument({}, []);
            const forEachExporter = new TestExporter(forEachDoc, new MockResourceProvider(), forEachAssets, forEachZip);

            const trackingList: string[] = [];
            const count = await forEachExporter.addAssetsToZipWithResourcePath(trackingList);

            expect(count).toBe(1);
            expect(trackingList).toContain('content/resources/track.txt');
        });

        it('should warn and skip assets with no export path in forEachAsset path', async () => {
            // Create a forEachAsset provider with an asset that won't have an export path
            const customForEachAssets = new MockAssetProviderWithForEach();
            customForEachAssets.addAsset('uuid-known', 'known.png', 'image/png', Buffer.from('png'));

            // Override forEachAsset to also yield an unknown asset not in the export path map
            const origForEach = customForEachAssets.forEachAsset.bind(customForEachAssets);
            customForEachAssets.forEachAsset = async (callback: (asset: any) => void | Promise<void>) => {
                await origForEach(callback);
                // Yield an extra asset that has no metadata (won't be in export path map)
                await callback({
                    id: 'uuid-orphan',
                    filename: 'orphan.txt',
                    originalPath: 'orphan.txt',
                    mime: 'text/plain',
                    data: Buffer.from('orphan'),
                });
            };

            const forEachZip = new MockZipProvider();
            const forEachDoc = new MockDocument({}, []);
            const forEachExporter = new TestExporter(
                forEachDoc,
                new MockResourceProvider(),
                customForEachAssets,
                forEachZip,
            );

            const count = await forEachExporter.addAssetsToZipWithResourcePath();

            // Only the known asset should be added (orphan has no export path)
            expect(count).toBe(1);
            expect(forEachZip.files.has('content/resources/known.png')).toBe(true);
        });

        it('should warn and skip assets with no export path in getAllAssets fallback', async () => {
            // Create a regular asset provider (no forEachAsset)
            const regularAssets = new MockAssetProvider();
            regularAssets.addAsset('uuid-ok', 'ok.png', 'image/png', Buffer.from('ok'));

            const regularZip = new MockZipProvider();
            const regularDoc = new MockDocument({}, []);
            const regularExporter = new TestExporter(regularDoc, new MockResourceProvider(), regularAssets, regularZip);

            // First call builds the export path map from getAllAssets (which has uuid-ok)
            // Then override getAllAssets to also return an orphan that isn't in the map
            await regularExporter.buildAssetExportPathMap(); // Cache the map with only uuid-ok
            const origGetAll = regularAssets.getAllAssets.bind(regularAssets);
            regularAssets.getAllAssets = async () => {
                const result = await origGetAll();
                result.push({
                    id: 'uuid-orphan2',
                    filename: 'orphan2.txt',
                    path: 'orphan2.txt',
                    mime: 'text/plain',
                    data: Buffer.from('orphan2'),
                });
                return result;
            };

            const count = await regularExporter.addAssetsToZipWithResourcePath();

            // Only the known asset should be added (orphan has no export path in cached map)
            expect(count).toBe(1);
            expect(regularZip.files.has('content/resources/ok.png')).toBe(true);
        });

        it('should populate tracking list in getAllAssets fallback path', async () => {
            const regularAssets = new MockAssetProvider();
            regularAssets.addAsset('uuid-track', 'track.css', 'text/css', Buffer.from('css'));

            const regularZip = new MockZipProvider();
            const regularDoc = new MockDocument({}, []);
            const regularExporter = new TestExporter(regularDoc, new MockResourceProvider(), regularAssets, regularZip);

            const trackingList: string[] = [];
            const count = await regularExporter.addAssetsToZipWithResourcePath(trackingList);

            expect(count).toBe(1);
            expect(trackingList).toContain('content/resources/track.css');
        });

        // Regression coverage for exelearning/exelearning#1769 (hotfix/duplicate-assets):
        // saving and exporting must NOT write each asset twice (once under the friendly
        // filename and again under the literal `<assetId><ext>` UUID path). The earlier
        // "defensive" fallback (PR #1740) did exactly that, leaving every saved .elpx and
        // every .html5/.scorm/.ims/.epub3 export with duplicated `content/resources/`
        // entries. The fix in this PR keeps a single, friendly entry per asset.
        it('should not duplicate each asset under the <id><ext> UUID path', async () => {
            const forEachAssets = new MockAssetProviderWithForEach();
            forEachAssets.addAsset(
                '12345678-1234-1234-1234-123456789012',
                'pie_pagina_FEDER_2027.png',
                'image/png',
                Buffer.from('png-data'),
            );
            forEachAssets.addAsset(
                '49d44e76-3d6a-4b21-b911-41746ab60814',
                'photo_2024-09-05_12-31-44.jpg',
                'image/jpeg',
                Buffer.from('jpg-data'),
            );

            const forEachZip = new MockZipProvider();
            const forEachDoc = new MockDocument({}, []);
            const forEachExporter = new TestExporter(forEachDoc, new MockResourceProvider(), forEachAssets, forEachZip);

            const trackingList: string[] = [];
            const count = await forEachExporter.addAssetsToZipWithResourcePath(trackingList);

            // Each asset must be written exactly once, under its friendly path.
            expect(count).toBe(2);
            expect(forEachZip.files.size).toBe(2);
            expect(forEachZip.files.has('content/resources/pie_pagina_FEDER_2027.png')).toBe(true);
            expect(forEachZip.files.has('content/resources/photo_2024-09-05_12-31-44.jpg')).toBe(true);

            // The UUID-named duplicates that PR #1740 used to write must NOT be present.
            expect(forEachZip.files.has('content/resources/12345678-1234-1234-1234-123456789012.png')).toBe(false);
            expect(forEachZip.files.has('content/resources/49d44e76-3d6a-4b21-b911-41746ab60814.jpg')).toBe(false);

            // Tracking list (used by the ELPX manifest) must list each entry exactly once.
            expect(trackingList).toEqual([
                'content/resources/pie_pagina_FEDER_2027.png',
                'content/resources/photo_2024-09-05_12-31-44.jpg',
            ]);
        });

        it('should write a single entry when an asset filename equals its UUID', async () => {
            // Edge case: the asset metadata already yields a UUID-shaped filename. Before
            // the fix this branch happened to write a single entry only because the
            // resolved path matched the fallback path; the test still pins the invariant.
            const forEachAssets = new MockAssetProviderWithForEach();
            forEachAssets.addAsset(
                'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
                'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png',
                'image/png',
                Buffer.from('png'),
            );

            const trackingList: string[] = [];
            const forEachZip = new MockZipProvider();
            const forEachDoc = new MockDocument({}, []);
            const forEachExporter = new TestExporter(forEachDoc, new MockResourceProvider(), forEachAssets, forEachZip);

            await forEachExporter.addAssetsToZipWithResourcePath(trackingList);

            const hits = trackingList.filter(p => p === 'content/resources/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png');
            expect(hits.length).toBe(1);
            expect(forEachZip.files.size).toBe(1);
        });

        it('should not write a UUID-named copy when the filename is missing', async () => {
            // Even when only the MIME type is available to derive the export filename,
            // the export must still produce a single `content/resources/<derived>` entry
            // and never the UUID-suffixed duplicate.
            const forEachAssets = new MockAssetProviderWithForEach();
            forEachAssets.addAsset('99999999-1111-2222-3333-444444444444', '', 'image/jpeg', Buffer.from('jpg'));

            const forEachZip = new MockZipProvider();
            const forEachDoc = new MockDocument({}, []);
            const forEachExporter = new TestExporter(forEachDoc, new MockResourceProvider(), forEachAssets, forEachZip);

            await forEachExporter.addAssetsToZipWithResourcePath();

            const uuidPath = 'content/resources/99999999-1111-2222-3333-444444444444.jpg';
            expect(forEachZip.files.has(uuidPath)).toBe(false);
            expect(forEachZip.files.size).toBe(1);
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

            expect(result).toContain('var p=window.parent');
            expect(result).toContain("p.postMessage({type:'exe-download-elpx'},'*')");
            expect(result).toContain("if(typeof downloadElpx==='function')downloadElpx()");
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

        describe('ensureElpxDownloadLibraries', () => {
            it('should fetch missing ELPX libraries and call addFile', async () => {
                const addedFiles: string[] = [];
                const addFile = (path: string, _content: Uint8Array | string) => {
                    addedFiles.push(path);
                };
                resources.setLibraryFiles(
                    new Map([
                        ['fflate/fflate.umd.js', Buffer.from('fflate')],
                        ['exe_elpx_download/exe_elpx_download.js', Buffer.from('elpx')],
                    ]),
                );

                await exporter.testEnsureElpxDownloadLibraries(addFile);
                expect(addedFiles).toContain('libs/fflate/fflate.umd.js');
                expect(addedFiles).toContain('libs/exe_elpx_download/exe_elpx_download.js');
            });

            it('should update commonFiles when provided', async () => {
                const commonFiles: string[] = [];
                const addFile = (path: string, _content: Uint8Array | string) => {};
                resources.setLibraryFiles(
                    new Map([
                        ['fflate/fflate.umd.js', Buffer.from('fflate')],
                        ['exe_elpx_download/exe_elpx_download.js', Buffer.from('elpx')],
                    ]),
                );

                await exporter.testEnsureElpxDownloadLibraries(addFile, commonFiles);
                expect(commonFiles).toContain('libs/fflate/fflate.umd.js');
                expect(commonFiles).toContain('libs/exe_elpx_download/exe_elpx_download.js');
            });

            it('should skip libraries already in the ZIP', async () => {
                zip.addFile('libs/fflate/fflate.umd.js', Buffer.from('already'));
                zip.addFile('libs/exe_elpx_download/exe_elpx_download.js', Buffer.from('already'));
                const addedFiles: string[] = [];
                const addFile = (path: string, _content: Uint8Array | string) => {
                    addedFiles.push(path);
                };

                await exporter.testEnsureElpxDownloadLibraries(addFile);
                expect(addedFiles).toEqual([]);
            });
        });

        describe('addElpxManifestToZip', () => {
            it('should generate manifest and add to ZIP', () => {
                const fileList = ['content/css/base.css', 'theme/style.css'];
                exporter.testAddElpxManifestToZip(fileList, ['index.html', 'html/page.html']);

                expect(zip.hasFile('libs/elpx-manifest.js')).toBe(true);
                expect(fileList).toContain('index.html');
                expect(fileList).toContain('html/page.html');
                expect(fileList).toContain('libs/elpx-manifest.js');
            });

            it('should update commonFiles when provided', () => {
                const fileList = ['content/css/base.css'];
                const commonFiles: string[] = [];
                exporter.testAddElpxManifestToZip(fileList, ['index.html'], commonFiles);
                expect(commonFiles).toContain('libs/elpx-manifest.js');
            });

            it('should not duplicate page URLs already in fileList', () => {
                const fileList = ['index.html', 'content/css/base.css'];
                exporter.testAddElpxManifestToZip(fileList, ['index.html']);
                const count = fileList.filter(f => f === 'index.html').length;
                expect(count).toBe(1);
            });
        });

        describe('injectElpxScripts', () => {
            const pageWithDownload: ExportPage = {
                id: 'p1',
                title: 'Page',
                blocks: [
                    {
                        id: 'b1',
                        name: 'Block',
                        order: 0,
                        components: [
                            {
                                id: 'c1',
                                type: 'download-source-file',
                                order: 0,
                                content: '<a href="exe-package:elp">Download</a>',
                            },
                        ],
                    },
                ],
            };

            const pageWithoutDownload: ExportPage = {
                id: 'p2',
                title: 'Normal',
                blocks: [
                    {
                        id: 'b2',
                        name: 'Block',
                        order: 0,
                        components: [{ id: 'c2', type: 'text', order: 0, content: '<p>Hello</p>' }],
                    },
                ],
            };

            it('should inject scripts for pages with download-source-file', () => {
                const html = '<html><body><p>Content</p></body></html>';
                const result = exporter.testInjectElpxScripts(html, pageWithDownload, true);
                expect(result).toContain('libs/fflate/fflate.umd.js');
                expect(result).toContain('libs/exe_elpx_download/exe_elpx_download.js');
                expect(result).toContain('libs/elpx-manifest.js');
            });

            it('should use relative paths for non-index pages', () => {
                const html = '<html><body><p>Content</p></body></html>';
                const result = exporter.testInjectElpxScripts(html, pageWithDownload, false);
                expect(result).toContain('../libs/fflate/fflate.umd.js');
                expect(result).toContain('../libs/elpx-manifest.js');
            });

            it('should return HTML unchanged for pages without download-source-file', () => {
                const html = '<html><body><p>Content</p></body></html>';
                const result = exporter.testInjectElpxScripts(html, pageWithoutDownload, true);
                expect(result).toBe(html);
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

        it('should produce collision-safe filenames for duplicate titles', () => {
            const pages: ExportPage[] = [
                { id: 'page-1', title: 'Home', parentId: null, order: 0, blocks: [] },
                { id: 'page-2', title: 'Test', parentId: null, order: 1, blocks: [] },
                { id: 'page-3', title: 'Test', parentId: null, order: 2, blocks: [] },
            ];

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('index.html');
            expect(map.get('page-2')).toBe('test.html');
            expect(map.get('page-3')).toBe('test-2.html');
        });

        it('should give every page a unique filename beyond 20 duplicates (no overwrite)', () => {
            // Create 31 pages: 1 index + 30 pages all titled "Test". Past the old
            // 20-attempt cap, distinct pages used to collapse onto a single
            // filename, silently overwriting each other in the export ZIP.
            const pages: ExportPage[] = [{ id: 'page-0', title: 'Home', parentId: null, order: 0, blocks: [] }];

            for (let i = 1; i <= 30; i++) {
                pages.push({
                    id: `page-${i}`,
                    title: 'Test',
                    parentId: null,
                    order: i,
                    blocks: [],
                });
            }

            const map = exporter.testBuildPageFilenameMap(pages);

            // First page is index.html, first "Test" page gets test.html (no suffix).
            expect(map.get('page-0')).toBe('index.html');
            expect(map.get('page-1')).toBe('test.html');

            // Every subsequent duplicate gets a deterministic, incrementing name
            // with no cap: test-2.html … test-30.html.
            for (let i = 2; i <= 30; i++) {
                expect(map.get(`page-${i}`)).toBe(`test-${i}.html`);
            }

            // Crucially, every page maps to a distinct filename (one ZIP entry
            // per page — no silent drops).
            const filenames = Array.from(map.values());
            expect(new Set(filenames).size).toBe(filenames.length);
        });

        it('should give non-Latin-script titles unique filenames (no empty-name collisions)', () => {
            // CJK/Arabic/etc. titles sanitize to an empty base; they must still
            // each receive a distinct filename rather than all collapsing.
            const pages: ExportPage[] = [{ id: 'page-0', title: 'Home', parentId: null, order: 0, blocks: [] }];
            for (let i = 1; i <= 25; i++) {
                pages.push({ id: `page-${i}`, title: '中文页面', parentId: null, order: i, blocks: [] });
            }

            const map = exporter.testBuildPageFilenameMap(pages);

            expect(map.get('page-1')).toBe('page.html');
            expect(map.get('page-2')).toBe('page-2.html');
            expect(map.get('page-25')).toBe('page-25.html');

            const filenames = Array.from(map.values());
            expect(new Set(filenames).size).toBe(filenames.length);
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

    describe('Subtitle track SRT to VTT conversion (issue #2034)', () => {
        // Real fixture text (test/fixtures/subtitles/test-subtitle.srt), byte-identical
        // to the file attached to the GitHub issue.
        const srtBytes = Buffer.from(
            '1\n00:00:02,360 --> 00:00:05,760\nEste es un vídeo de prueba para\nprobar los subtítulos en EXeLearning.\n',
            'utf-8',
        );

        it('rewrites a .srt subtitle asset export path to .vtt', async () => {
            assets.addAsset(
                '11111111-1111-1111-1111-111111111111',
                'test-subtitle.srt',
                'application/x-subrip',
                srtBytes,
            );

            const pathMap = await exporter.buildAssetExportPathMap();
            const exportPath = pathMap.get('11111111-1111-1111-1111-111111111111');

            expect(exportPath).toBeDefined();
            expect(exportPath?.endsWith('.vtt')).toBe(true);
            expect(exportPath?.endsWith('.srt')).toBe(false);
        });

        it('rewrites <track src="asset://...srt"> HTML references to the .vtt export path and keeps other track attributes intact', async () => {
            assets.addAsset(
                '22222222-2222-2222-2222-222222222222',
                'test-subtitle.srt',
                'application/x-subrip',
                srtBytes,
            );

            const html =
                '<video controls><source src="video.mp4" type="video/mp4" />' +
                '<track kind="subtitles" srclang="es" label="Español" default ' +
                'src="asset://22222222-2222-2222-2222-222222222222.srt" />' +
                '</video>';

            const result = await exporter.addFilenamesToAssetUrls(html);

            expect(result).toContain('content/resources/test-subtitle.vtt');
            expect(result).not.toContain('.srt');
            expect(result).toContain('kind="subtitles"');
            expect(result).toContain('srclang="es"');
            expect(result).toContain('label="Español"');
            expect(result).toContain('default');
        });

        it('writes converted WebVTT bytes into the ZIP under the .vtt path (not the raw .srt bytes)', async () => {
            assets.addAsset(
                '33333333-3333-3333-3333-333333333333',
                'test-subtitle.srt',
                'application/x-subrip',
                srtBytes,
            );

            await exporter.addAssetsToZipWithResourcePath();

            expect(zip.hasFile('content/resources/test-subtitle.vtt')).toBe(true);
            expect(zip.hasFile('content/resources/test-subtitle.srt')).toBe(false);

            const written = zip.files.get('content/resources/test-subtitle.vtt');
            const writtenText = Buffer.isBuffer(written) ? written.toString('utf-8') : String(written ?? '');

            expect(writtenText.startsWith('WEBVTT')).toBe(true);
            expect(writtenText).toContain('00:00:02.360 --> 00:00:05.760');
            expect(writtenText).not.toContain(',360');
            // UTF-8 accented text must survive the conversion
            expect(writtenText).toContain('vídeo');
            expect(writtenText).toContain('subtítulos');
        });

        it('toWebVttExportFilename forces a .vtt extension across all input shapes', () => {
            const toVtt = (name: string) =>
                (exporter as unknown as { toWebVttExportFilename(n: string): string }).toWebVttExportFilename(name);
            expect(toVtt('subs.srt')).toBe('subs.vtt'); // .srt -> .vtt
            expect(toVtt('subs.vtt')).toBe('subs.vtt'); // already .vtt, unchanged
            expect(toVtt('asset-noext')).toBe('asset-noext.vtt'); // MIME-detected, no extension -> append
        });

        it('keeps a legacy filename-form <track src="asset://name.srt"> reference pointing at the .vtt name', async () => {
            // Filename-form reference (not a 36-char UUID) with no matching asset in
            // the map -> the "use as-is" fallback. buildAssetExportPathMap always
            // renames .srt -> .vtt, so the reference must be rewritten too or the
            // <track src> 404s (issue #2034, /review finding).
            const html = '<video controls><track kind="subtitles" src="asset://orphan-subtitle.srt" /></video>';

            const result = await exporter.addFilenamesToAssetUrls(html);

            expect(result).toContain('content/resources/orphan-subtitle.vtt');
            expect(result).not.toContain('orphan-subtitle.srt');
        });

        it('decodes a Windows-1252/Latin-1 encoded .srt so accented captions survive (not U+FFFD)', async () => {
            // Same text as the UTF-8 fixture, but encoded as Windows-1252 (latin1
            // shares byte values for these accents). A non-fatal UTF-8 decode would
            // turn every accented byte into the replacement character.
            const win1252Srt = Buffer.from(
                '1\n00:00:02,360 --> 00:00:05,760\nEste es un vídeo de prueba para\nprobar los subtítulos en EXeLearning.\n',
                'latin1',
            );
            assets.addAsset(
                '66666666-6666-6666-6666-666666666666',
                'latin1-subtitle.srt',
                'application/x-subrip',
                win1252Srt,
            );

            await exporter.addAssetsToZipWithResourcePath();

            const written = zip.files.get('content/resources/latin1-subtitle.vtt');
            const writtenText = Buffer.isBuffer(written) ? written.toString('utf-8') : String(written ?? '');

            expect(writtenText.startsWith('WEBVTT')).toBe(true);
            expect(writtenText).toContain('vídeo');
            expect(writtenText).toContain('subtítulos');
            expect(writtenText).not.toContain('�');
        });

        it('renames and converts a subtitle detected by a non-canonical MIME (text/srt) even without a .srt extension', async () => {
            assets.addAsset('77777777-7777-7777-7777-777777777777', 'asset-noext', 'text/srt', srtBytes);

            const pathMap = await exporter.buildAssetExportPathMap();
            const exportPath = pathMap.get('77777777-7777-7777-7777-777777777777');
            expect(exportPath?.endsWith('.vtt')).toBe(true);

            await exporter.addAssetsToZipWithResourcePath();
            const written = zip.files.get(`content/resources/${exportPath}`);
            const writtenText = Buffer.isBuffer(written) ? written.toString('utf-8') : String(written ?? '');
            expect(writtenText.startsWith('WEBVTT')).toBe(true);
            expect(writtenText).not.toMatch(/\d{2}:\d{2}:\d{2},\d{3}/);
        });

        it('leaves an already-.vtt subtitle asset untouched (no double conversion, no .srt path)', async () => {
            const vttBytes = Buffer.from('WEBVTT\n\n00:00:02.360 --> 00:00:05.760\nAlready valid VTT\n', 'utf-8');
            assets.addAsset('44444444-4444-4444-4444-444444444444', 'already-valid.vtt', 'text/vtt', vttBytes);

            const pathMap = await exporter.buildAssetExportPathMap();
            expect(pathMap.get('44444444-4444-4444-4444-444444444444')).toBe('already-valid.vtt');

            await exporter.addAssetsToZipWithResourcePath();
            const written = zip.files.get('content/resources/already-valid.vtt');
            const writtenText = Buffer.isBuffer(written) ? written.toString('utf-8') : String(written ?? '');
            expect(writtenText).toContain('WEBVTT');
            expect(writtenText).toContain('Already valid VTT');
        });

        it('degrades to a valid empty WebVTT document (never raw .srt bytes) when the .srt asset data cannot be decoded as text', async () => {
            // Not a real Buffer/TypedArray -- TextDecoder.decode() throws on this,
            // exercising resolveAssetExportData's catch-and-fall-back branch.
            const undecodable = {} as unknown as Buffer;
            assets.addAsset(
                '55555555-5555-5555-5555-555555555555',
                'broken-subtitle.srt',
                'application/x-subrip',
                undecodable,
            );

            // Resolves without throwing -- if resolveAssetExportData's catch branch
            // didn't swallow the decode error, this await would reject and fail the test.
            await exporter.addAssetsToZipWithResourcePath();

            // The export path is renamed .srt -> .vtt (filename-driven, independent
            // of the data), so the written bytes MUST also be valid WebVTT. Falling
            // back to the raw (SRT/undecodable) bytes here would ship a .vtt file the
            // <track> engine parses to zero cues -- the exact issue #2034 failure.
            // Graceful degradation = a valid, empty WebVTT document instead.
            expect(zip.hasFile('content/resources/broken-subtitle.vtt')).toBe(true);
            expect(zip.files.get('content/resources/broken-subtitle.vtt')).toBe('WEBVTT\n');
        });
    });
});

describe('resolveMaterialIconDataUris', () => {
    // Sprite with alarm + help, but deliberately WITHOUT lightbulb.
    const SPRITE = [
        '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
        '<symbol id="alarm" viewBox="0 -960 960 960"><path d="M40-200Z"/></symbol>',
        '<symbol id="help" viewBox="0 -960 960 960"><path d="M1-1Z"/></symbol>',
        '</svg>',
    ].join('\n');

    const pageWithMaterialIcons = (...iconNames: string[]): ExportPage[] => [
        {
            id: 'p1',
            title: 'Page',
            blocks: iconNames.map((iconName, i) => ({
                id: `b${i}`,
                name: 'Block',
                order: i,
                components: [],
                iconName,
            })),
        } as ExportPage,
    ];

    const spriteResources = (): ResourceProvider => {
        const resources = new MockResourceProvider();
        resources.setLibraryFiles(new Map([['material-icons/material-icons.svg', Buffer.from(SPRITE)]]));
        return resources;
    };

    const decode = (uri: string): string => decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));

    it('resolves a known material icon to its own SVG data URI', async () => {
        const { dataUris } = await resolveMaterialIconDataUris(spriteResources(), pageWithMaterialIcons('mi-alarm'));
        expect(decode(dataUris.get('alarm')!)).toContain('<path d="M40-200Z"/>');
    });

    it('resolves an unknown material icon name to the help glyph (not a dead path)', async () => {
        const { dataUris } = await resolveMaterialIconDataUris(
            spriteResources(),
            pageWithMaterialIcons('mi-lightbulb'),
        );

        // The unknown name must map to a real, inlined data URI (the help glyph),
        // never to a missing libs/.../icons/lightbulb.svg file.
        const uri = dataUris.get('lightbulb');
        expect(uri).toBeDefined();
        expect(uri).toStartWith('data:image/svg+xml;utf8,');
        expect(uri).not.toContain('/icons/');
        expect(decode(uri!)).toContain('<path d="M1-1Z"/>');
    });

    it('returns an empty map (no dead paths) when the sprite cannot be fetched', async () => {
        // No library files registered -> fetchLibraryFiles yields no sprite.
        const resources = new MockResourceProvider();
        const { files, dataUris } = await resolveMaterialIconDataUris(resources, pageWithMaterialIcons('mi-lightbulb'));
        expect(dataUris.size).toBe(0);
        expect(files.size).toBe(0);
    });
});
