/**
 * Epub3Exporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Epub3Exporter } from './Epub3Exporter';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ExportAsset,
} from '../interfaces';

// Mock document adapter
class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];
    private contentXml: string | null;

    constructor(metadata: Partial<ExportMetadata> = {}, pages: ExportPage[] = [], contentXml: string | null = null) {
        this.metadata = {
            title: 'Test EPUB Project',
            author: 'Test Author',
            language: 'en',
            description: 'A test EPUB project',
            license: 'CC-BY-SA',
            theme: 'base',
            ...metadata,
        };
        this.pages = pages;
        this.contentXml = contentXml;
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }

    async getContentXml(): Promise<string | null> {
        return this.contentXml;
    }
}

// Mock resource provider
class MockResourceProvider implements ResourceProvider {
    async fetchTheme(_name: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        // Theme files keep their original names (style.css, style.js)
        files.set('style.css', Buffer.from('/* theme css */'));
        files.set('style.js', Buffer.from('// theme js'));
        return files;
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('jquery/jquery.min.js', Buffer.from('// jquery'));
        files.set('common.js', Buffer.from('// common'));
        return files;
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
        const files = new Map<string, Buffer>();
        files.set('content/css/base.css', Buffer.from('/* base css */'));
        return files;
    }

    async fetchGlobalFontFiles(_fontName: string): Promise<Map<string, Buffer> | null> {
        return null;
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
    async getAsset(_path: string): Promise<Buffer | null> {
        return null;
    }

    async getProjectAssets(): Promise<ExportAsset[]> {
        return [];
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
        return [];
    }
}

// Mock zip provider that tracks files added
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
        // Create actual ZIP for realistic testing using fflate
        const zipData: Record<string, Uint8Array | [Uint8Array, { level: 0 | 1 }]> = {};
        for (const [path, content] of this.files) {
            const data = typeof content === 'string' ? strToU8(content) : new Uint8Array(content);
            // EPUB requires mimetype to be first and uncompressed (level 0)
            if (path === 'mimetype') {
                zipData[path] = [data, { level: 0 as 0 }];
            } else {
                zipData[path] = data;
            }
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

// Hierarchical pages with children
const hierarchicalPages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Part 1',
        parentId: null,
        order: 0,
        blocks: [],
    },
    {
        id: 'page-2',
        title: 'Chapter 1.1',
        parentId: 'page-1',
        order: 0,
        blocks: [],
    },
    {
        id: 'page-3',
        title: 'Chapter 1.2',
        parentId: 'page-1',
        order: 1,
        blocks: [],
    },
    {
        id: 'page-4',
        title: 'Part 2',
        parentId: null,
        order: 1,
        blocks: [],
    },
];

describe('Epub3Exporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: Epub3Exporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new Epub3Exporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file extension', () => {
            expect(exporter.getFileExtension()).toBe('.epub');
        });

        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('');
        });
    });

    describe('Export Process', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data).toBeInstanceOf(Uint8Array);
        });

        it('should generate mimetype file', async () => {
            await exporter.export();

            expect(zip.files.has('mimetype')).toBe(true);
            const mimetype = zip.files.get('mimetype') as string;
            expect(mimetype).toBe('application/epub+zip');
        });

        it('should generate container.xml', async () => {
            await exporter.export();

            expect(zip.files.has('META-INF/container.xml')).toBe(true);
            const containerXml = zip.files.get('META-INF/container.xml') as string;
            expect(containerXml).toContain('<?xml');
            expect(containerXml).toContain('container');
            expect(containerXml).toContain('EPUB/package.opf');
        });

        it('should generate package.opf manifest', async () => {
            await exporter.export();

            expect(zip.files.has('EPUB/package.opf')).toBe(true);
            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('<?xml');
            expect(packageOpf).toContain('<package');
            expect(packageOpf).toContain('<metadata');
            expect(packageOpf).toContain('<manifest');
            expect(packageOpf).toContain('<spine');
        });

        it('should generate nav.xhtml navigation document', async () => {
            await exporter.export();

            expect(zip.files.has('EPUB/nav.xhtml')).toBe(true);
            const navXhtml = zip.files.get('EPUB/nav.xhtml') as string;
            expect(navXhtml).toContain('<!DOCTYPE html>');
            expect(navXhtml).toContain('<nav');
            expect(navXhtml).toContain('epub:type="toc"');
        });

        it('should generate XHTML files for pages', async () => {
            await exporter.export();

            // First page is index.xhtml
            expect(zip.files.has('EPUB/index.xhtml')).toBe(true);
            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            expect(indexXhtml).toContain('<!DOCTYPE html>');
            expect(indexXhtml).toContain('xmlns="http://www.w3.org/1999/xhtml"');
            expect(indexXhtml).toContain('Introduction');
        });

        it('should use custom filename when provided', async () => {
            const result = await exporter.export({ filename: 'my-book.epub' });

            expect(result.success).toBe(true);
            expect(result.filename).toBe('my-book.epub');
        });

        it('should build filename from metadata', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('test-epub-project');
            expect(result.filename).toContain('.epub');
        });
    });

    describe('EPUB Structure Validation', () => {
        it('should produce valid ZIP file', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify it's a valid ZIP by loading with fflate
            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(Object.keys(loadedZip).length).toBeGreaterThan(0);
        });

        it('should include mimetype file in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['mimetype']).toBeDefined();
            const mimetypeContent = new TextDecoder().decode(loadedZip['mimetype']);
            expect(mimetypeContent).toBe('application/epub+zip');
        });

        it('should include META-INF directory', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['META-INF/container.xml']).toBeDefined();
        });

        it('should include EPUB directory with content', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['EPUB/package.opf']).toBeDefined();
            expect(loadedZip['EPUB/nav.xhtml']).toBeDefined();
            expect(loadedZip['EPUB/index.xhtml']).toBeDefined();
        });
    });

    describe('Package OPF Generation', () => {
        it('should include metadata in package.opf', async () => {
            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('<dc:title>Test EPUB Project</dc:title>');
            expect(packageOpf).toContain('<dc:creator>Test Author</dc:creator>');
            expect(packageOpf).toContain('<dc:language>en</dc:language>');
        });

        it('should include manifest items for all pages', async () => {
            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('id="nav"');
            expect(packageOpf).toContain('id="page-0"');
            expect(packageOpf).toContain('id="page-1"');
        });

        it('should include spine references for all pages', async () => {
            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('<spine');
            expect(packageOpf).toContain('idref="page-0"');
            expect(packageOpf).toContain('idref="page-1"');
        });
    });

    describe('Navigation Document Generation', () => {
        it('should generate nav.xhtml with table of contents', async () => {
            await exporter.export();

            const navXhtml = zip.files.get('EPUB/nav.xhtml') as string;
            expect(navXhtml).toContain('Introduction');
            expect(navXhtml).toContain('Chapter 1');
        });

        it('should handle hierarchical navigation', async () => {
            document = new MockDocument({}, hierarchicalPages);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            const navXhtml = zip.files.get('EPUB/nav.xhtml') as string;
            expect(navXhtml).toContain('Part 1');
            expect(navXhtml).toContain('Chapter 1.1');
            expect(navXhtml).toContain('Chapter 1.2');
            expect(navXhtml).toContain('Part 2');
        });

        it('should include correct links in navigation', async () => {
            await exporter.export();

            const navXhtml = zip.files.get('EPUB/nav.xhtml') as string;
            expect(navXhtml).toContain('href="index.xhtml"');
            expect(navXhtml).toMatch(/href="html\/[^"]+\.xhtml"/);
        });

        it('should exclude hidden pages from navigation but keep them in export', async () => {
            const hiddenPages: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Visible Page',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
                {
                    id: 'page-2',
                    title: 'Hidden Page',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: {
                        visibility: 'false', // String "false" as per interface inspection or common pattern
                    },
                },
                {
                    id: 'page-3',
                    title: 'Hidden Page Boolean',
                    parentId: null,
                    order: 2,
                    blocks: [],
                    properties: {
                        visibility: false,
                    },
                },
            ];
            document = new MockDocument({}, hiddenPages);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            const navXhtml = zip.files.get('EPUB/nav.xhtml') as string;

            // Should contain visible page
            expect(navXhtml).toContain('Visible Page');

            // Should NOT contain hidden pages in TOC
            expect(navXhtml).not.toContain('Hidden Page');
            expect(navXhtml).not.toContain('Hidden Page Boolean');

            // Should be in spine/manifest even if hidden in usage
            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            // Check that files are in the manifest
            expect(packageOpf).toContain('href="html/hidden-page.xhtml"');
            expect(packageOpf).toContain('href="html/hidden-page-boolean.xhtml"');

            // Check spine has all 3 pages
            const spineMatches = packageOpf.match(/<itemref/g);
            expect(spineMatches?.length).toBe(3);

            // And file should exist
            expect(zip.files.has('EPUB/html/hidden-page.xhtml')).toBe(true);
        });
    });

    describe('XHTML Page Generation', () => {
        it('should generate valid XHTML pages', async () => {
            await exporter.export();

            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            // Check XHTML requirements
            expect(indexXhtml).toContain('xmlns="http://www.w3.org/1999/xhtml"');
            expect(indexXhtml).toContain('<!DOCTYPE html>');
        });

        it('should use self-closing void elements in XHTML', async () => {
            // Create document with void elements
            const pagesWithVoid: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Test',
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
                                    content: '<p>Line 1<br>Line 2</p><hr><img src="test.png">',
                                },
                            ],
                        },
                    ],
                },
            ];
            document = new MockDocument({}, pagesWithVoid);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            const xhtml = zip.files.get('EPUB/index.xhtml') as string;
            // Void elements should be self-closing in XHTML
            expect(xhtml).toMatch(/<br\s*\/>/);
            expect(xhtml).toMatch(/<hr\s*\/>/);
            expect(xhtml).toMatch(/<img[^>]+\/>/);
        });

        it('should include page content', async () => {
            await exporter.export();

            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            expect(indexXhtml).toContain('Welcome to the course');
        });

        it('should include made-with-eXe link by default', async () => {
            await exporter.export();

            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            expect(indexXhtml).toContain('made-with-eXe');
        });

        it('should NOT include made-with-eXe link when addExeLink is false', async () => {
            document = new MockDocument({ addExeLink: false }, samplePages);
            exporter = new Epub3Exporter(document, resources, assets, zip);
            await exporter.export();

            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            expect(indexXhtml).not.toContain('made-with-eXe');
        });

        it('should include exe_powered_logo.png when addExeLink is true (default)', async () => {
            resources.fetchExeLogo = async () => Buffer.from('fake-logo-data');
            await exporter.export();

            expect(zip.files.has('EPUB/content/img/exe_powered_logo.png')).toBe(true);
        });

        it('should NOT include exe_powered_logo.png when addExeLink is false', async () => {
            document = new MockDocument({ addExeLink: false }, samplePages);
            resources.fetchExeLogo = async () => Buffer.from('fake-logo-data');
            exporter = new Epub3Exporter(document, resources, assets, zip);
            await exporter.export();

            expect(zip.files.has('EPUB/content/img/exe_powered_logo.png')).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle empty pages array', async () => {
            document = new MockDocument({}, []);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should handle export with no title', async () => {
            document = new MockDocument({ title: '' }, samplePages);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should catch and return errors', async () => {
            // Create a failing zip provider
            const failingZip: ZipProvider = {
                addFile: () => {},
                hasFile: () => false,
                getFilePaths: () => [],
                generateAsync: async () => {
                    throw new Error('ZIP generation failed');
                },
                createZip: () => ({
                    addFile: () => {},
                    addFiles: () => {},
                    hasFile: () => false,
                    getFilePaths: () => [],
                    generate: async () => new Uint8Array(),
                }),
            };
            exporter = new Epub3Exporter(document, resources, assets, failingZip);

            const result = await exporter.export();
            expect(result.success).toBe(false);
            expect(result.error).toContain('ZIP generation failed');
        });
    });

    describe('Theme and Library Integration', () => {
        it('should handle theme fetch failure gracefully', async () => {
            // Override fetchTheme to throw
            resources.fetchTheme = async () => {
                throw new Error('Theme not found');
            };

            const result = await exporter.export();

            // Should still succeed
            expect(result.success).toBe(true);
        });

        it('should handle library fetch failure gracefully', async () => {
            // Override fetchBaseLibraries to throw
            resources.fetchBaseLibraries = async () => {
                throw new Error('Libraries not found');
            };

            const result = await exporter.export();

            // Should still succeed
            expect(result.success).toBe(true);
        });

        it('should include CSS files when available', async () => {
            await exporter.export();

            // Check for base CSS
            expect(zip.files.has('EPUB/content/css/base.css')).toBe(true);
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
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('Test &amp; Project');
            expect(packageOpf).toContain('Author');
        });

        it('should generate unique book identifier', async () => {
            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('<dc:identifier');
            expect(packageOpf).toContain('urn:uuid:');
        });

        it('should include modification date', async () => {
            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('dcterms:modified');
        });
    });

    describe('Favicon Handling', () => {
        it('should detect theme favicon.ico and use it in pages', async () => {
            // Override fetchTheme to include a favicon
            resources.fetchTheme = async (_name: string) => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* theme css */'));
                files.set('style.js', Buffer.from('// theme js'));
                files.set('img/favicon.ico', Buffer.from('fake-ico-data'));
                return files;
            };

            await exporter.export();

            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            expect(indexXhtml).toContain('<link rel="icon" type="image/x-icon" href="theme/img/favicon.ico"');
        });

        it('should detect theme favicon.png and use it in pages', async () => {
            // Override fetchTheme to include a PNG favicon
            resources.fetchTheme = async (_name: string) => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* theme css */'));
                files.set('style.js', Buffer.from('// theme js'));
                files.set('img/favicon.png', Buffer.from('fake-png-data'));
                return files;
            };

            await exporter.export();

            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            expect(indexXhtml).toContain('<link rel="icon" type="image/png" href="theme/img/favicon.png"');
        });

        it('should use default libs/favicon.ico when theme has no favicon', async () => {
            await exporter.export();

            const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
            expect(indexXhtml).toContain('<link rel="icon" type="image/x-icon" href="libs/favicon.ico"');
        });

        it('should always include libs/favicon.ico in export regardless of theme favicon', async () => {
            // Override fetchBaseLibraries to include favicon
            resources.fetchBaseLibraries = async () => {
                const files = new Map<string, Buffer>();
                files.set('jquery/jquery.min.js', Buffer.from('// jquery'));
                files.set('common.js', Buffer.from('// common'));
                files.set('favicon.ico', Buffer.from('default-favicon-data'));
                return files;
            };

            await exporter.export();

            // libs/favicon.ico should be in the ZIP
            expect(zip.files.has('EPUB/libs/favicon.ico')).toBe(true);
        });

        it('should include favicon.ico in EPUB manifest', async () => {
            // Override fetchBaseLibraries to include favicon
            resources.fetchBaseLibraries = async () => {
                const files = new Map<string, Buffer>();
                files.set('jquery/jquery.min.js', Buffer.from('// jquery'));
                files.set('common.js', Buffer.from('// common'));
                files.set('favicon.ico', Buffer.from('default-favicon-data'));
                return files;
            };

            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('libs/favicon.ico');
        });

        it('should use correct relative path for favicon in sub-pages', async () => {
            // Override fetchTheme to include a favicon
            resources.fetchTheme = async (_name: string) => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* theme css */'));
                files.set('style.js', Buffer.from('// theme js'));
                files.set('img/favicon.ico', Buffer.from('fake-ico-data'));
                return files;
            };

            await exporter.export();

            // Check sub-page (chapter-1.xhtml) has correct relative path
            const chapter1Xhtml = zip.files.get('EPUB/html/chapter-1.xhtml') as string;
            expect(chapter1Xhtml).toContain('<link rel="icon" type="image/x-icon" href="../theme/img/favicon.ico"');
        });
    });

    describe('Content XML and DTD Handling', () => {
        it('should include content.xml in EPUB when document provides it', async () => {
            const sampleContentXml = '<?xml version="1.0"?><content><test>data</test></content>';
            document = new MockDocument({}, samplePages, sampleContentXml);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            expect(zip.files.has('EPUB/content.xml')).toBe(true);
            const contentXml = zip.files.get('EPUB/content.xml') as string;
            expect(contentXml).toContain('<test>data</test>');
        });

        it('should include content.dtd alongside content.xml', async () => {
            const sampleContentXml = '<?xml version="1.0"?><content><test>data</test></content>';
            document = new MockDocument({}, samplePages, sampleContentXml);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            expect(zip.files.has('EPUB/content.dtd')).toBe(true);
        });

        it('should include content.xml in EPUB manifest', async () => {
            const sampleContentXml = '<?xml version="1.0"?><content><test>data</test></content>';
            document = new MockDocument({}, samplePages, sampleContentXml);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            const packageOpf = zip.files.get('EPUB/package.opf') as string;
            expect(packageOpf).toContain('id="content-xml"');
            expect(packageOpf).toContain('href="content.xml"');
        });

        it('should NOT include content.xml when exportSource is false', async () => {
            const sampleContentXml = '<?xml version="1.0"?><content><test>data</test></content>';
            document = new MockDocument({ exportSource: false }, samplePages, sampleContentXml);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            expect(zip.files.has('EPUB/content.xml')).toBe(false);
            expect(zip.files.has('EPUB/content.dtd')).toBe(false);
        });

        it('should include content.xml when exportSource is true', async () => {
            const sampleContentXml = '<?xml version="1.0"?><content><test>data</test></content>';
            document = new MockDocument({ exportSource: true }, samplePages, sampleContentXml);
            exporter = new Epub3Exporter(document, resources, assets, zip);

            await exporter.export();

            expect(zip.files.has('EPUB/content.xml')).toBe(true);
            expect(zip.files.has('EPUB/content.dtd')).toBe(true);
        });

        it('should not fail when getContentXml returns null', async () => {
            // Default MockDocument with null contentXml
            const result = await exporter.export();

            expect(result.success).toBe(true);
            // content.xml should not be in the archive when not provided
            expect(zip.files.has('EPUB/content.xml')).toBe(false);
        });
    });
});

describe('Library Transformations', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: Epub3Exporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new Epub3Exporter(document, resources, assets, zip);
    });

    it('should patch exe_effects.js for EPUB export', async () => {
        const originalJs = `
function test() {
var k = "exe";
$("." + k + "-accordion").each(function (i) {
    // HTML generation
    h2.eq(y).wrap('<a class="fx-accordion-title" href="#' + id + '" id="' + id + '-trigger"></a>');

    // Click handler
    var currentAttrValue = $(this).attr('href');

    // IE7 retrieves link#hash instead of #hash
    currentAttrValue = currentAttrValue.split("#");
    currentAttrValue = "#" + currentAttrValue[1];
    // / IE7
    
    // more code
});
}`;
        // Setup page with accordion to trigger library detection
        const pageWithAccordion: ExportPage[] = [
            {
                id: 'p1',
                title: 'T',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'b1',
                        name: 'd',
                        order: 0,
                        components: [
                            {
                                id: 'c1',
                                type: 'text',
                                order: 0,
                                content: '<div class="exe-accordion">test</div>',
                            },
                        ],
                    },
                ],
            },
        ];

        document = new MockDocument({}, pageWithAccordion);
        exporter = new Epub3Exporter(document, resources, assets, zip);

        // Mock library fetch to return our sample JS
        resources.fetchLibraryFiles = async files => {
            const result = new Map<string, Buffer>();
            // The exporter might request full paths, but we just need to ensuring we provide the file
            // when requested. The key in the map should match what the exporter expects.
            result.set('exe_effects/exe_effects.js', Buffer.from(originalJs));
            return result;
        };

        // Also override fetchBaseLibraries just in case
        resources.fetchBaseLibraries = async () => {
            return new Map();
        };

        await exporter.export();

        // Check if file exists in ZIP
        const zipPath = 'EPUB/libs/exe_effects/exe_effects.js';
        expect(zip.files.has(zipPath)).toBe(true);

        const content = zip.files.get(zipPath);
        const contentStr = typeof content === 'string' ? content : new TextDecoder().decode(content as Buffer);

        // Verify transformations
        // 1. Click handler patch
        expect(contentStr).not.toContain("$(this).attr('href')");
        expect(contentStr).toContain('var targetId = this.id.replace("-trigger", "").replace(/_/g, "-");');

        // 2. Link generation patch (javascript:void(0))
        expect(contentStr).not.toContain('href="#\' + id + \'"');
        expect(contentStr).toContain('href="javascript:void(0)"');
    });
});

describe('Icon Resolution via setThemeIconFiles', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: Epub3Exporter;

    beforeEach(() => {
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
    });

    it('should resolve SVG icons when theme has SVG icon files', async () => {
        const pagesWithIcon: ExportPage[] = [
            {
                id: 'page-1',
                title: 'Test Page',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Block with Icon',
                        order: 0,
                        components: [],
                        iconName: 'activity',
                    },
                ],
            },
        ];

        document = new MockDocument({}, pagesWithIcon);

        resources.fetchTheme = async (_name: string) => {
            const files = new Map<string, Buffer>();
            files.set('style.css', Buffer.from('/* theme css */'));
            files.set('icons/activity.svg', Buffer.from('<svg></svg>'));
            return files;
        };

        exporter = new Epub3Exporter(document, resources, assets, zip);
        await exporter.export();

        const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
        expect(indexXhtml).toContain('theme/icons/activity.svg');
    });

    it('should fall back to .png when theme has no icon files', async () => {
        const pagesWithIcon: ExportPage[] = [
            {
                id: 'page-1',
                title: 'Test Page',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Block with Icon',
                        order: 0,
                        components: [],
                        iconName: 'activity',
                    },
                ],
            },
        ];

        document = new MockDocument({}, pagesWithIcon);
        exporter = new Epub3Exporter(document, resources, assets, zip);
        await exporter.export();

        const indexXhtml = zip.files.get('EPUB/index.xhtml') as string;
        expect(indexXhtml).toContain('theme/icons/activity.png');
    });
});
