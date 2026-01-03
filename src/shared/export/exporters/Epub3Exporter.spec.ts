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
} from '../interfaces';

// Mock document adapter
class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor(metadata: Partial<ExportMetadata> = {}, pages: ExportPage[] = []) {
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
        const files = new Map<string, Buffer>();
        files.set('content.css', Buffer.from('/* theme css */'));
        files.set('default.js', Buffer.from('// theme js'));
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
}

// Mock asset provider
class MockAssetProvider implements AssetProvider {
    async getAsset(_path: string): Promise<Buffer | null> {
        return null;
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

    async generateAsync(): Promise<Buffer> {
        // Create actual ZIP for realistic testing using fflate
        const zipData: Record<string, Uint8Array | [Uint8Array, { level: number }]> = {};
        for (const [path, content] of this.files) {
            const data = typeof content === 'string' ? strToU8(content) : new Uint8Array(content);
            // EPUB requires mimetype to be first and uncompressed (level 0)
            if (path === 'mimetype') {
                zipData[path] = [data, { level: 0 }];
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
                generateAsync: async () => {
                    throw new Error('ZIP generation failed');
                },
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
});
