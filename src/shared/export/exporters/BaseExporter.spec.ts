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
}

// Mock asset provider
class MockAssetProvider implements AssetProvider {
    private assets: Array<{
        id: string;
        filename: string;
        path: string;
        mimeType: string;
        data: Buffer;
    }> = [];

    addAsset(id: string, filename: string, mimeType: string, data: Buffer): void {
        this.assets.push({
            id,
            filename,
            path: `${id}/${filename}`,
            mimeType,
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
            mimeType: string;
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

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');
            expect(xml).toContain('<odeProperties>');
            expect(xml).toContain('<pp_title>Test Project</pp_title>');
            expect(xml).toContain('<odeNavStructure');
            expect(xml).toContain('odeNavStructureId="p1"');
            expect(xml).toContain('<odePagStructure');
            expect(xml).toContain('<odeComponent');
            expect(xml).toContain('FreeTextIdevice');
            expect(xml).toContain('<![CDATA[<p>Test content</p>]]>');
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

        it('should add filenames to asset URLs', async () => {
            assets.addAsset('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'image.jpg', 'image/jpeg', Buffer.from(''));

            const content = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            expect(result).toBe('<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890/image.jpg">');
        });

        it('should replace existing paths with correct export path based on folderPath', async () => {
            assets.addAsset('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'image.jpg', 'image/jpeg', Buffer.from(''));

            const content = '<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890/existing.png">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            // Should replace with correct export path (folderPath/filename or just filename if no folderPath)
            expect(result).toBe('<img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890/image.jpg">');
        });

        it('should return empty string for empty content', async () => {
            const result = await exporter.addFilenamesToAssetUrls('');
            expect(result).toBe('');
        });

        it('should return content unchanged when no assets', async () => {
            const content = '<p>No assets here</p>';
            const result = await exporter.addFilenamesToAssetUrls(content);
            expect(result).toBe(content);
        });

        it('should not modify unknown asset UUIDs', async () => {
            assets.addAsset('known-uuid', 'file.txt', 'text/plain', Buffer.from(''));

            const content = '<img src="asset://unknown-uuid-here">';
            const result = await exporter.addFilenamesToAssetUrls(content);

            // Should not modify unknown UUID
            expect(result).toBe(content);
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
                const fileList = [
                    'index.html',
                    'html/page2.html',
                    'content.xml',
                    'theme/content.css',
                    'libs/jquery.js',
                ];
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
});
