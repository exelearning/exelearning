/**
 * Tests for PrintPreviewExporter
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import { PrintPreviewExporter } from './PrintPreviewExporter';
import type { ExportDocument, ExportMetadata, ExportPage, ResourceProvider } from '../interfaces';

// Mock URL.createObjectURL
const originalCreateObjectURL = global.URL.createObjectURL;
beforeAll(() => {
    global.URL.createObjectURL = ((blob: Blob) => `blob:mock-url-${blob.size}`) as any;
});
afterAll(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
});

// Mock document
const createMockDocument = (pages: ExportPage[] = [], meta: Partial<ExportMetadata> = {}): ExportDocument => ({
    getMetadata: () => ({
        title: 'Test Project',
        author: 'Test Author',
        description: 'Test Description',
        language: 'en',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'base',
        version: '4.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        ...meta,
    }),
    getNavigation: () => pages,
});

// Mock resource provider
const createMockResourceProvider = (): ResourceProvider => ({
    fetchTheme: async () => new Map(),
    fetchIdeviceResources: async () => new Map(),
    fetchBaseLibraries: async () => new Map(),
    fetchLibraryFiles: async () => new Map(),
    normalizeIdeviceType: type => type,
    fetchExeLogo: async () => null,
    fetchContentCss: async () => new Map(),
    fetchScormFiles: async () => new Map(),
});

describe('PrintPreviewExporter', () => {
    let exporter: PrintPreviewExporter;
    let mockDocument: ExportDocument;
    let mockResourceProvider: ResourceProvider;

    beforeEach(() => {
        mockDocument = createMockDocument([
            {
                id: 'page-1',
                title: 'Home',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Block 1',
                        order: 0,
                        components: [
                            {
                                id: 'comp-1',
                                type: 'text',
                                order: 0,
                                content: '<p>Hello World</p>',
                                properties: {},
                            },
                        ],
                    },
                ],
            },
            {
                id: 'page-2',
                title: 'About',
                parentId: null,
                order: 1,
                blocks: [
                    {
                        id: 'block-2',
                        name: 'Block 2',
                        order: 0,
                        components: [
                            {
                                id: 'comp-2',
                                type: 'text',
                                order: 0,
                                content: '<p>About page content</p>',
                                properties: {},
                            },
                        ],
                    },
                ],
            },
        ]);
        mockResourceProvider = createMockResourceProvider();
        exporter = new PrintPreviewExporter(mockDocument, mockResourceProvider);
    });

    describe('constructor', () => {
        it('should create exporter with document and resource provider', () => {
            expect(exporter).toBeDefined();
        });
    });

    describe('generatePreview', () => {
        it('should generate preview HTML successfully', async () => {
            const result = await exporter.generatePreview();
            expect(result.success).toBe(true);
            expect(result.html).toBeDefined();
        });

        it('should return error when no pages exist', async () => {
            const emptyDoc = createMockDocument([]);
            const emptyExporter = new PrintPreviewExporter(emptyDoc, mockResourceProvider);
            const result = await emptyExporter.generatePreview();
            expect(result.success).toBe(false);
            expect(result.error).toBe('No pages to preview');
        });

        it('should include DOCTYPE declaration', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('<!DOCTYPE html>');
        });

        it('should include language attribute from metadata', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('lang="en"');
        });

        it('should include project title in head', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('<title>Test Project</title>');
        });

        it('should include exe-single-page class on body', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('exe-single-page');
            expect(result.html).toContain('exe-export');
        });

        it('should render page sections', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('<section>');
        });

        it('should include all page content visible at once', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('Hello World');
            expect(result.html).toContain('About page content');
        });

        it('should include package header with project title', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('class="package-header"');
            expect(result.html).toContain('class="package-title">Test Project</h1>');
        });

        it('should include page headers in sections', async () => {
            const result = await exporter.generatePreview();
            // PageRenderer generates: <header class="main-header"><div class="page-header">...
            expect(result.html).toContain('class="main-header"');
            expect(result.html).toContain('class="page-header"');
            expect(result.html).toContain('Home</h1>'); // PageRenderer uses h1 inside section headers
        });
    });

    describe('single-page navigation', () => {
        it('should NOT render navigation (PageRenderer single page logic)', async () => {
            const result = await exporter.generatePreview();
            // PageRenderer output for single page does not include keys like keys 'siteNav' in the body
            // It has siteNav-hidden class
            expect(result.html).toContain('siteNav-hidden');
            expect(result.html).not.toContain('<nav id="siteNav"');
        });

        it('should NOT include SPA navigation script', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).not.toContain('showPage');
            expect(result.html).not.toContain('data-page-id');
        });

        it('should NOT include prev/next navigation buttons', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).not.toContain('nav-button-left');
            expect(result.html).not.toContain('nav-button-right');
        });
    });

    describe('print mode', () => {
        it('should inject print script when printMode is true', async () => {
            const result = await exporter.generatePreview({ printMode: true });
            expect(result.html).toContain('window.print()');
            expect(result.html).toContain('@media print');
        });

        it('should NOT inject print script when printMode is false', async () => {
            const result = await exporter.generatePreview({ printMode: false });
            expect(result.html).not.toContain('window.print()');
        });

        it('should always inject max-width styles for horizontal scroll fix', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('max-width: 100%');
            expect(result.html).toContain('box-sizing: border-box');
            expect(result.html).toContain('@media print');
            expect(result.html).toContain('page-break-inside: avoid');
        });
    });

    describe('versioned paths', () => {
        it('should use versioned paths for resources', async () => {
            const result = await exporter.generatePreview({
                baseUrl: 'http://localhost:3001',
                basePath: '/app',
                version: 'v2.0.0',
            });
            expect(result.html).toContain('http://localhost:3001/app/v2.0.0/libs/jquery/jquery.min.js');
            expect(result.html).toContain('http://localhost:3001/app/v2.0.0/libs/bootstrap/bootstrap.min.css');
        });

        it('should include theme CSS path', async () => {
            const result = await exporter.generatePreview({
                baseUrl: 'http://localhost:3001',
                version: 'v1.0.0',
            });
            expect(result.html).toContain('/v1.0.0/files/perm/themes/base/base/style.css');
        });
    });

    describe('iDevice handling', () => {
        it('should include iDevice scripts/css (via PageRenderer)', async () => {
            // We can check if the html contains references to the text iDevice present in mock
            // With our patch, it should point to server files (including export/ folder)
            const result = await exporter.generatePreview();
            expect(result.html).toContain('idevices/base/text/export/text.js');
            expect(result.html).toContain('idevices/base/text/export/text.css');
        });
    });

    describe('metadata handling', () => {
        it('should include custom styles', async () => {
            const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                customStyles: '.my-class { color: red; }',
            });
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('.my-class { color: red; }');
        });

        it('should include proper footer structure with license', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('<footer id="siteFooter">');
            expect(result.html).toContain('CC-BY-SA');
        });
    });

    describe('HTML escaping', () => {
        it('should escape HTML in page titles', async () => {
            const doc = createMockDocument([
                { id: 'p1', title: '<script>alert("xss")</script>', parentId: null, order: 0, blocks: [] },
            ]);
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('&lt;script&gt;');
            expect(result.html).not.toContain('<script>alert("xss")</script>');
        });

        it('should escape HTML in project title', async () => {
            const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                title: '<script>xss</script>',
            });
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('&lt;script&gt;xss&lt;/script&gt;');
        });
    });

    describe('asset handling', () => {
        const mockAssetProvider = {
            getAllAssets: async () => [
                {
                    id: '1234-5678',
                    filename: 'image.png',
                    folderPath: '',
                    mime: 'image/png',
                    data: new Uint8Array([1, 2, 3]), // 3 bytes
                },
                {
                    id: '8765-4321',
                    filename: 'document.pdf',
                    folderPath: '',
                    mime: 'application/pdf',
                    data: new Uint8Array([1, 2]), // 2 bytes
                },
            ],
            getAsset: async () => null,
            hasAsset: async () => false,
            listAssets: async () => [],
            resolveAssetUrl: async () => null,
            getProjectAssets: async () => [],
        };

        it('should replace asset://UUID URLs with content/resources/FILENAME', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'text',
                                    order: 0,
                                    content: '<img src="asset://1234-5678" /> <a href="asset://8765-4321">Link</a>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exp = new PrintPreviewExporter(doc, mockResourceProvider, mockAssetProvider as any);
            const result = await exp.generatePreview();

            expect(result.html).toContain('blob:mock-url-3');
            expect(result.html).toContain('blob:mock-url-2');
            expect(result.html).not.toContain('asset://1234-5678');
        });

        it('should replace content/resources/ URL with blob URL', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'text',
                                    order: 0,
                                    content: '<img src="content/resources/1234-5678.png" />',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exp = new PrintPreviewExporter(doc, mockResourceProvider, mockAssetProvider as any);
            const result = await exp.generatePreview();

            // Should find asset 1234-5678 (mapped to blob:mock-url-3) even if input is content/resources/1234-5678.png
            // The mapping uses UUID as key, and filename as key.
            // Our mock uses filename 'image.png' for ID '1234-5678'.
            // The test input uses '1234-5678.png'.
            // The resolver tries removing extension: '1234-5678'.
            // This matches the asset ID.
            expect(result.html).toContain('blob:mock-url-3');
            expect(result.html).not.toContain('content/resources/1234-5678.png');
        });

        it('should handle multiple assets with same filename by generating unique blob URLs', async () => {
            const duplicateProvider = {
                ...mockAssetProvider,
                getAllAssets: async () => [
                    { id: '1', filename: 'image.png', folderPath: '', mime: 'image/png', data: new Uint8Array([1]) },
                    { id: '2', filename: 'image.png', folderPath: '', mime: 'image/png', data: new Uint8Array([1, 2]) },
                ],
            };
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
                    order: 0,
                    parentId: null,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'text',
                                    order: 0,
                                    properties: {},
                                    content: '<img src="asset://1" /> <img src="asset://2" />',
                                },
                            ],
                        },
                    ],
                },
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exp = new PrintPreviewExporter(doc, mockResourceProvider, duplicateProvider as any);
            const result = await exp.generatePreview();

            expect(result.html).toContain('blob:mock-url-1');
            expect(result.html).toContain('blob:mock-url-2');
        });

        it('should preserve asset:// URLs if asset not found in provider', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'text',
                                    order: 0,
                                    properties: {},
                                    content: '<img src="asset://unknown-uuid" />',
                                },
                            ],
                        },
                    ],
                },
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exp = new PrintPreviewExporter(doc, mockResourceProvider, mockAssetProvider as any);
            const result = await exp.generatePreview();

            // Should default to UUID or existing path if not found (implementation details: returns content/resources/UUID)
            expect(result.html).toContain('content/resources/unknown-uuid');
        });
    });

    describe('library path patching', () => {
        it('should patch paths for abcjs and highlighter', async () => {
            // Create a doc with content that triggers library detection
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page with libs',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            type: 'text',
                            components: [
                                { type: 'text', content: '<pre class="abc-music">X:1</pre>' },
                                { type: 'text', content: '<pre class="highlighted-code">code</pre>' },
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview(); // Uses default options (basePath='')

            // Check that libs/ paths are replaced with absolute server paths
            // We expect PrintPreviewExporter to use default version/basePath if not provided
            // Default version is usually 'v1.0.0' or similar in the code

            // abcjs mappings
            expect(result.html).toContain('/libs/abcjs/exe_abc_music.js"');
            expect(result.html).not.toContain('src="libs/abcjs/exe_abc_music.js"');

            // highlighter mappings
            expect(result.html).toContain('/app/common/exe_highlighter/exe_highlighter.js"');
            expect(result.html).not.toContain('src="libs/exe_highlighter/exe_highlighter.js"');
        });
    });

    describe('export options', () => {
        it('should include made-with-eXe by default', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('made-with-eXe');
        });
    });

    describe('visibility filtering', () => {
        it('should exclude pages with visibility=false', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Visible Page',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { visibility: true },
                },
                {
                    id: 'p2',
                    title: 'Hidden Page',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
            ]);
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.html).toContain('Visible Page');
            expect(result.html).not.toContain('Hidden Page');
        });

        it('should include pages with visibility=undefined (default)', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Default Page',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: {},
                },
            ]);
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.html).toContain('Default Page');
        });
    });

    describe('script execution', () => {
        it('should inject script force-initializing abcjs and highlighter', async () => {
            const result = await exporter.generatePreview();
            // Check for the specific script content
            expect(result.html).toContain('$exeABCmusic.init()');
            expect(result.html).toContain('$exeHighlighter.init()');
        });
    });
});
