/**
 * ElpxExporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ElpxExporter } from './ElpxExporter';
import JSZip from 'jszip';
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
        // Create actual ZIP for realistic testing
        const zip = new JSZip();
        for (const [path, content] of this.files) {
            zip.file(path, content);
        }
        const buffer = await zip.generateAsync({ type: 'nodebuffer' });
        return buffer;
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

        it('should generate content.xml', async () => {
            await exporter.export();

            expect(zip.files.has('content.xml')).toBe(true);
            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<?xml');
            expect(contentXml).toContain('<ode');
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

    describe('ODE XML Structure', () => {
        it('should include ode root element with version', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<ode');
            expect(contentXml).toContain('xmlns="http://www.intef.es/xsd/ode"');
            expect(contentXml).toContain('version="2.0"');
        });

        it('should include userPreferences section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<userPreferences>');
            expect(contentXml).toContain('<key>theme</key>');
            expect(contentXml).toContain('<value>base</value>');
        });

        it('should include odeResources section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeResources>');
            expect(contentXml).toContain('<key>odeId</key>');
            expect(contentXml).toContain('<key>odeVersionId</key>');
            expect(contentXml).toContain('<key>exe_version</key>');
        });

        it('should include odeProperties section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeProperties>');
            expect(contentXml).toContain('<key>pp_title</key>');
            expect(contentXml).toContain('<value>Test ELPX Project</value>');
        });

        it('should include odeNavStructures section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeNavStructures>');
            expect(contentXml).toContain('<odeNavStructure>');
        });
    });

    describe('ODE Properties', () => {
        it('should include title property', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<key>pp_title</key>');
            expect(contentXml).toContain('<value>Test ELPX Project</value>');
        });

        it('should include author property', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<key>pp_author</key>');
            expect(contentXml).toContain('<value>Test Author</value>');
        });

        it('should include language property', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<key>pp_lang</key>');
            expect(contentXml).toContain('<value>en</value>');
        });

        it('should include theme property', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<key>pp_theme</key>');
            expect(contentXml).toContain('<value>base</value>');
        });

        it('should handle special characters in properties', async () => {
            document = new MockDocument(
                {
                    title: 'Test & Project <Special>',
                    author: 'Author "Quote"',
                },
                samplePages
            );
            exporter = new ElpxExporter(document, resources, assets, zip);

            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('Test &amp; Project');
            expect(contentXml).toContain('&lt;Special&gt;');
        });
    });

    describe('Navigation Structures', () => {
        it('should include page ID', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odePageId>page-1</odePageId>');
        });

        it('should include page name', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<pageName>Introduction</pageName>');
        });

        it('should include parent page ID for nested pages', async () => {
            document = new MockDocument({}, hierarchicalPages);
            exporter = new ElpxExporter(document, resources, assets, zip);

            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeParentPageId>page-1</odeParentPageId>');
        });

        it('should include page order', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeNavStructureOrder>0</odeNavStructureOrder>');
            expect(contentXml).toContain('<odeNavStructureOrder>1</odeNavStructureOrder>');
        });

        it('should include page properties', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeNavStructureProperties>');
            expect(contentXml).toContain('<key>titlePage</key>');
        });
    });

    describe('Page Structures (Blocks)', () => {
        it('should include odePagStructures section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odePagStructures>');
            expect(contentXml).toContain('<odePagStructure>');
        });

        it('should include block ID', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeBlockId>block-1</odeBlockId>');
        });

        it('should include block name', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<blockName>Content Block</blockName>');
        });

        it('should include block order', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odePagStructureOrder>0</odePagStructureOrder>');
        });

        it('should include block properties', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odePagStructureProperties>');
            expect(contentXml).toContain('<key>visibility</key>');
        });
    });

    describe('Components (iDevices)', () => {
        it('should include odeComponents section', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeComponents>');
            expect(contentXml).toContain('<odeComponent>');
        });

        it('should include iDevice ID', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeIdeviceId>comp-1</odeIdeviceId>');
        });

        it('should include iDevice type', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>');
        });

        it('should include HTML content in CDATA', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<htmlView><![CDATA[');
            expect(contentXml).toContain('Welcome to the course');
            expect(contentXml).toContain(']]></htmlView>');
        });

        it('should include JSON properties in CDATA', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<jsonProperties><![CDATA[');
            expect(contentXml).toContain('showTitle');
            expect(contentXml).toContain(']]></jsonProperties>');
        });

        it('should include component order', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<odeComponentsOrder>0</odeComponentsOrder>');
        });
    });

    describe('ZIP Validation', () => {
        it('should produce valid ZIP file', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify it's a valid ZIP by loading with JSZip
            const loadedZip = await JSZip.loadAsync(result.data!);
            expect(Object.keys(loadedZip.files).length).toBeGreaterThan(0);
        });

        it('should include content.xml in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = await JSZip.loadAsync(result.data!);

            expect(loadedZip.files['content.xml']).toBeDefined();
            const contentXml = await loadedZip.files['content.xml'].async('string');
            expect(contentXml).toContain('<ode');
        });

        it('should include theme files in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = await JSZip.loadAsync(result.data!);

            expect(loadedZip.files['style/base/content.css']).toBeDefined();
        });

        it('should include library files in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = await JSZip.loadAsync(result.data!);

            expect(loadedZip.files['libs/jquery/jquery.min.js']).toBeDefined();
            expect(loadedZip.files['libs/common.js']).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle empty pages array', async () => {
            document = new MockDocument({}, []);
            exporter = new ElpxExporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
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

    describe('ODE ID Generation', () => {
        it('should generate valid ODE ID format', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            // ODE ID format: YYYYMMDDHHmmss + 6 alphanumeric
            const odeIdMatch = contentXml.match(/<key>odeId<\/key>\s*<value>(\d{14}[A-Z0-9]{6})<\/value>/);
            expect(odeIdMatch).toBeTruthy();
        });

        it('should generate valid version ID format', async () => {
            await exporter.export();

            const contentXml = zip.files.get('content.xml') as string;
            // Version ID format: YYYYMMDDHHmmss + 6 alphanumeric
            const versionIdMatch = contentXml.match(
                /<key>odeVersionId<\/key>\s*<value>(\d{14}[A-Z0-9]{6})<\/value>/
            );
            expect(versionIdMatch).toBeTruthy();
        });
    });
});
