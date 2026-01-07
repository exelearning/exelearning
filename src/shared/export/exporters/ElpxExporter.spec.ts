/**
 * ElpxExporter tests
 *
 * Tests for the ELPX exporter which generates exe_document format (v3.0).
 * The exe_document format uses:
 * - <exe_document> as root element
 * - <meta> for metadata (title, author, etc.)
 * - <navigation> containing nested <page> elements with components
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ElpxExporter } from './ElpxExporter';
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
            title: 'Test ELPX Project',
            author: 'Test Author',
            language: 'en',
            description: 'A test ELPX project',
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
        // Use original names to trigger renaming logic
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
        return Buffer.from('fake-logo-data');
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

    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    async generateAsync(): Promise<Buffer> {
        // Create actual ZIP for realistic testing using fflate
        const zipData: Record<string, Uint8Array> = {};
        for (const [path, content] of this.files) {
            if (typeof content === 'string') {
                zipData[path] = strToU8(content);
            } else {
                zipData[path] = new Uint8Array(content);
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
                name: 'Content Block',
                order: 0,
                properties: {
                    visibility: true,
                    minimized: false,
                },
                components: [
                    {
                        id: 'comp-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Welcome to the course.</p>',
                        properties: {
                            showTitle: true,
                            title: 'Welcome',
                        },
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
                name: 'Main Content',
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
];

describe('ElpxExporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: ElpxExporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new ElpxExporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file extension', () => {
            expect(exporter.getFileExtension()).toBe('.elpx');
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

        it('should generate content.xml with exe_document format', async () => {
            await exporter.export();

            expect(zip.files.has('content.xml')).toBe(true);
            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<?xml');
            expect(contentXml).toContain('<!DOCTYPE exe_document');
            expect(contentXml).toContain('<exe_document>');
        });

        it('should use custom filename when provided', async () => {
            const result = await exporter.export({ filename: 'my-project.elpx' });

            expect(result.success).toBe(true);
            expect(result.filename).toBe('my-project.elpx');
        });

        it('should build filename from metadata', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('test-elpx-project');
            expect(result.filename).toContain('.elpx');
        });
    });

    describe('exe_document XML Structure', () => {
        it('should include exe_document root element', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<exe_document>');
            expect(contentXml).toContain('</exe_document>');
        });

        it('should include meta section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<meta>');
            expect(contentXml).toContain('</meta>');
        });

        it('should include navigation section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<navigation>');
            expect(contentXml).toContain('</navigation>');
        });

        it('should include DOCTYPE declaration referencing DTD', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<!DOCTYPE exe_document SYSTEM "content.dtd">');
        });
    });

    describe('Meta Section', () => {
        it('should include title element', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<title>Test ELPX Project</title>');
        });

        it('should include author element', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<author>Test Author</author>');
        });

        it('should include language element', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<language>en</language>');
        });

        it('should include theme element', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<theme>base</theme>');
        });

        it('should handle special characters in metadata', async () => {
            document = new MockDocument(
                {
                    title: 'Test & Project <Special>',
                    author: 'Author "Quote"',
                },
                samplePages,
            );
            exporter = new ElpxExporter(document, resources, assets, zip);

            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            // XML builder should escape special characters
            expect(contentXml).toContain('Test &amp; Project');
            expect(contentXml).toContain('&lt;Special&gt;');
        });
    });

    describe('Navigation Structure', () => {
        it('should include page with id attribute', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('id="page-1"');
        });

        it('should include page with title attribute', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('title="Introduction"');
        });

        it('should include nested pages for hierarchical structure', async () => {
            document = new MockDocument({}, hierarchicalPages);
            exporter = new ElpxExporter(document, resources, assets, zip);

            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            // Parent page should contain nested child pages
            expect(contentXml).toContain('id="page-1"');
            expect(contentXml).toContain('title="Part 1"');
            expect(contentXml).toContain('id="page-2"');
            expect(contentXml).toContain('title="Chapter 1.1"');
        });

        it('should include multiple pages', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('id="page-1"');
            expect(contentXml).toContain('id="page-2"');
        });
    });

    describe('Components (iDevices)', () => {
        it('should include component elements', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<component');
        });

        it('should include component type attribute', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('type="FreeTextIdevice"');
        });

        it('should include component id attribute', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('id="comp-1"');
        });

        it('should include content element with HTML', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<content>');
            expect(contentXml).toContain('Welcome to the course');
        });

        it('should include position attribute', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('position="0"');
        });
    });

    describe('ZIP Validation', () => {
        it('should produce valid ZIP file', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify it's a valid ZIP by loading with fflate
            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(Object.keys(loadedZip).length).toBeGreaterThan(0);
        });

        it('should include content.xml in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['content.xml']).toBeDefined();
            const contentXml = new TextDecoder().decode(loadedZip['content.xml']);
            expect(contentXml).toContain('<exe_document>');
        });

        it('should include content.dtd in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['content.dtd']).toBeDefined();
            const dtd = new TextDecoder().decode(loadedZip['content.dtd']);
            expect(dtd).toContain('<!ELEMENT exe_document');
        });

        it('should include theme files in ZIP with original names', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            // Theme file names are preserved as-is (style.css, not renamed to content.css)
            expect(loadedZip['theme/style.css']).toBeDefined();
        });

        it('should include library files in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['libs/jquery/jquery.min.js']).toBeDefined();
            expect(loadedZip['libs/common.js']).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should fail for empty pages array (invalid structure - requires at least one page)', async () => {
            document = new MockDocument({}, []);
            exporter = new ElpxExporter(document, resources, assets, zip);

            const result = await exporter.export();
            // Empty pages array produces invalid exe_document XML (DTD requires at least one page)
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle export with no title', async () => {
            document = new MockDocument({ title: '' }, samplePages);
            exporter = new ElpxExporter(document, resources, assets, zip);

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
            exporter = new ElpxExporter(document, resources, assets, failingZip);

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
    });

    describe('Search Box Feature', () => {
        it('should include search_index.js when addSearchBox is true', async () => {
            document = new MockDocument(
                {
                    addSearchBox: true,
                },
                samplePages,
            );
            exporter = new ElpxExporter(document, resources, assets, zip);

            await exporter.export();

            expect(zip.files.has('search_index.js')).toBe(true);
            const searchIndex = zip.files.get('search_index.js') as string;
            expect(searchIndex).toContain('exeSearchData');
        });

        it('should not include search_index.js when addSearchBox is false', async () => {
            document = new MockDocument(
                {
                    addSearchBox: false,
                },
                samplePages,
            );
            exporter = new ElpxExporter(document, resources, assets, zip);

            await exporter.export();

            expect(zip.files.has('search_index.js')).toBe(false);
        });
    });

    describe('Base CSS Error Handling', () => {
        it('should fail when base.css is not available', async () => {
            // Override fetchContentCss to return empty map
            resources.fetchContentCss = async () => {
                return new Map(); // No base.css
            };

            const result = await exporter.export();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to fetch content/css/base.css');
        });
    });

    describe('Library File Deduplication', () => {
        it('should not add duplicate library files', async () => {
            // Set up fetchLibraryFiles to return a file that's already in base libraries
            resources.fetchLibraryFiles = async () => {
                const files = new Map<string, Buffer>();
                // This file is already added by fetchBaseLibraries
                files.set('jquery/jquery.min.js', Buffer.from('// duplicate jquery'));
                // This file is new
                files.set('new-lib.js', Buffer.from('// new library'));
                return files;
            };

            await exporter.export();

            // The duplicate should be ignored, but new-lib.js should be added
            expect(zip.files.has('libs/new-lib.js')).toBe(true);
            // jQuery should still be the original version from base libraries
            const jquery = zip.files.get('libs/jquery/jquery.min.js');
            expect(jquery?.toString()).toBe('// jquery');
        });
    });

    describe('Logo Handling', () => {
        it('should include logo when fetchExeLogo returns data', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(zip.files.has('content/img/exe_powered_logo.png')).toBe(true);
        });

        it('should continue export when fetchExeLogo throws', async () => {
            // Override fetchExeLogo to throw
            resources.fetchExeLogo = async () => {
                throw new Error('Logo not found');
            };

            const result = await exporter.export();

            // Should still succeed despite logo error
            expect(result.success).toBe(true);
            // Logo file should not be in ZIP
            expect(zip.files.has('content/img/exe_powered_logo.png')).toBe(false);
        });

        it('should not include logo when fetchExeLogo returns null', async () => {
            // Override fetchExeLogo to return null
            resources.fetchExeLogo = async () => null;

            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(zip.files.has('content/img/exe_powered_logo.png')).toBe(false);
        });
    });

    describe('iDevice Resources', () => {
        it('should add iDevice resource files when available', async () => {
            // Override fetchIdeviceResources to return files
            resources.fetchIdeviceResources = async (_type: string) => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* idevice css */'));
                files.set('script.js', Buffer.from('// idevice js'));
                return files;
            };

            await exporter.export();

            // FreeTextIdevice normalized to 'freetext'
            expect(zip.files.has('idevices/freetext/style.css')).toBe(true);
            expect(zip.files.has('idevices/freetext/script.js')).toBe(true);
        });
    });

    describe('Theme File Name Preservation', () => {
        it('should preserve original theme file names (style.css, style.js)', async () => {
            await exporter.export();

            // Original names should be preserved
            expect(zip.files.has('theme/style.css')).toBe(true);
            expect(zip.files.has('theme/style.js')).toBe(true);
            // Old renamed names should NOT exist
            expect(zip.files.has('theme/content.css')).toBe(false);
            expect(zip.files.has('theme/default.js')).toBe(false);
        });
    });

    describe('Version Information', () => {
        it('should include version in meta section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<version>');
        });

        it('should include exelearning_version in meta section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<exelearning_version>');
        });
    });

    describe('Date Fields', () => {
        it('should include created date in meta section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<created>');
        });

        it('should include modified date in meta section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<modified>');
        });
    });

    describe('Custom Directory', () => {
        it('should include custom directory marker', async () => {
            await exporter.export();

            expect(zip.files.has('custom/.gitkeep')).toBe(true);
        });
    });
});
