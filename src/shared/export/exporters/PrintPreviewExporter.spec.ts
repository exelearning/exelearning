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
    fetchScormFiles: async () => new Map(),
    normalizeIdeviceType: (type: string) => type.toLowerCase().replace(/idevice$/i, ''),
    fetchExeLogo: async () => null,
    fetchContentCss: async () => new Map(),
    fetchGlobalFontFiles: async () => null,
    fetchI18nFile: async (_language: string): Promise<string> => '',
    fetchI18nTranslations: async (_language: string) => new Map<string, string>(),
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

        it('should render page sections with id attributes', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('<section id="section-');
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

        it('should inject new print CSS rules (spacing, hiding headers, map points)', async () => {
            const result = await exporter.generatePreview();

            // 1. Preview Spacing
            expect(result.html).toContain('body {');
            expect(result.html).toContain('padding: 40px;'); // Preview padding
            expect(result.html).toContain('.exe-single-page {');
            expect(result.html).toContain('max-width: 210mm;');

            // 2. Print Mode Reset
            expect(result.html).toContain('@media print {');
            expect(result.html).toContain('padding: 0 !important;'); // Reset padding

            // 3. Header Visibility
            // Package header (Project Title) should be visible and static
            expect(result.html).toContain('.package-header {');
            expect(result.html).toContain('display: block !important;');
            expect(result.html).toContain('visibility: visible !important;');
            expect(result.html).toContain('position: static !important;');

            // Node decorations should be hidden
            expect(result.html).toContain('#nodeDecoration {');
            expect(result.html).toContain('display: none !important;');

            // 4. Show Map Points (including js-hidden with parent selectors)
            expect(result.html).toContain('.mapa-LinkTextsPoints,');
            expect(result.html).toContain('.mapa-IDevice .js-hidden.mapa-LinkTextsPoints {');
            expect(result.html).toContain('display: block !important;');

            // 5. Definition List
            expect(result.html).toContain('.js .exe-dl dd {');
            expect(result.html).toContain('display: block !important;');

            expect(result.html).toContain('.exe-udlContent-block.js-hidden,');
            expect(result.html).toContain('.js .exe-udlContent-block.js-hidden {');
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
            expect(result.html).toContain('/files/perm/themes/base/base/style.css');
        });
    });

    describe('pre-rendering', () => {
        it('should call preRenderMermaid hook if provided', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
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
                                    order: 0,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="mermaid">graph TD; A-->B;</div>',
                                },
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const preRenderMermaid = async (html: string) => ({
                html: html.replace('<div class="mermaid">graph TD; A-->B;</div>', '<svg>Mock SVG</svg>'),
                mermaidRendered: true,
                count: 1,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ preRenderMermaid });

            expect(result.html).toContain('<svg>Mock SVG</svg>');
            expect(result.html).not.toContain('<div class="mermaid">graph TD; A-->B;</div>');
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

    describe('feedback visibility', () => {
        it('should remove display:none from hidden feedback elements', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page with feedback',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Text Block',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    order: 0,
                                    properties: {},
                                    type: 'text',
                                    content:
                                        '<div class="feedback js-feedback js-hidden" style="display: none;">Hidden Feedback</div>',
                                },
                                {
                                    id: 'c2',
                                    order: 1,
                                    properties: {},
                                    type: 'text',
                                    content:
                                        '<div class="CSP-FeedbackText feedback js-feedback js-hidden" style="display: none;">Another Hidden Feedback</div>',
                                },
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // Should still contain the content
            expect(result.html).toContain('Hidden Feedback');
            expect(result.html).toContain('Another Hidden Feedback');

            // Should NOT contain style="display: none;" for these elements
            // We use a regex to check that the specific div doesn't have the style anymore
            // Simple check: the exact string provided in content should not exist as-is
            expect(result.html).not.toContain('<div class="feedback js-feedback js-hidden" style="display: none;">');
            expect(result.html).not.toContain(
                '<div class="CSP-FeedbackText feedback js-feedback js-hidden" style="display: none;">',
            );

            // It should probably just be the div without the style or with style=""
            // checking that the class exists is enough to ensure we didn't wipe the element
            expect(result.html).toContain('class="feedback js-feedback js-hidden"');
        });
    });

    describe('hiding unwanted print elements', () => {
        it('should hide specific version/bns divs and image links', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page with extras',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Text Block',
                            order: 0,
                            components: [
                                // Version divs
                                {
                                    id: 'c1',
                                    order: 0,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="sopa-version js-hidden">Sopa Version</div>',
                                },
                                {
                                    id: 'c2',
                                    order: 1,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="candado-version js-hidden">Candado Version</div>',
                                },
                                // BNS divs
                                {
                                    id: 'c3',
                                    order: 2,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="selecciona-bns js-hidden">Selecciona BNS</div>',
                                },
                                {
                                    id: 'c4',
                                    order: 3,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="quext-bns js-hidden">Quext BNS</div>',
                                },
                                // Images/Links
                                {
                                    id: 'c5',
                                    order: 4,
                                    properties: {},
                                    type: 'text',
                                    content: '<img src="img.jpg" class="js-hidden mapa-LinkImagesMapas">',
                                },
                                {
                                    id: 'c6',
                                    order: 5,
                                    properties: {},
                                    type: 'text',
                                    content: '<img src="img2.jpg" class=" js-hidden mapa-LinkImagesSlides">',
                                },
                                {
                                    id: 'c7',
                                    order: 6,
                                    properties: {},
                                    type: 'text',
                                    content: '<img src="img3.jpg" class="js-hidden mapa-ImageMap">',
                                },
                                {
                                    id: 'c8',
                                    order: 7,
                                    properties: {},
                                    type: 'text',
                                    content: '<a href="#" class="js-hidden selecciona-LinkImages">Link 1</a>',
                                },
                                {
                                    id: 'c9',
                                    order: 8,
                                    properties: {},
                                    type: 'text',
                                    content: '<a href="#" class="js-hidden adivina-LinkImages">Link 2</a>',
                                },
                                // Control cases (should NOT be hidden)
                                {
                                    id: 'c10',
                                    order: 9,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="other-version">Visible Version</div>',
                                }, // No js-hidden
                                {
                                    id: 'c11',
                                    order: 10,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="js-hidden">Just Hidden Div</div>',
                                }, // No -version/-bns
                                {
                                    id: 'c12',
                                    order: 11,
                                    properties: {},
                                    type: 'text',
                                    content: '<img src="ok.jpg" class="mapa-ImageMap">',
                                }, // No js-hidden
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // Helper to check for display: none !important
            const checkHidden = (snippet: string) => {
                // Determine the tag type to construct the expectation
                const isImg = snippet.startsWith('<img');
                const isA = snippet.startsWith('<a');

                // We expect the style to be injected. The regex might produce slightly different attribute orders
                // but our tool usually appends/modifies style.
                // Let's check that the result string contains the content AND display: none
                // Since result.html is large, we can't easily isolate just this element without parsing.
                // But we know the content strings are unique enough.

                // Simplified check: Does the HTML contain the unique text/src AND style="...display: none..."?
                // For images, check src. For text, check text content.

                // Actually, let's just regex match the specific element in the result
                // We'll escape the snippet for regex and allow for inserted style
                // This is getting complicated to verify strictly with simple expectation.
                // Let's rely on finding `style="display: none !important"` near the identifying class/content.
                expect(result.html).toMatch(
                    new RegExp(snippet.replace('>', '.*style=.*display:\\s*none.*!important.*>')),
                );
            };

            // Can't easily use regex match on exact input string because attributes might move if we parsed them?
            // If we use string replace, attributes stay mostly put.
            // Let's check that the specific class combinations now have style="display: none !important" attached.

            // 1. Version divs
            expect(result.html).toContain('class="sopa-version js-hidden" style="display: none !important"');
            expect(result.html).toContain('class="candado-version js-hidden" style="display: none !important"');

            // 2. BNS divs
            expect(result.html).toContain('class="selecciona-bns js-hidden" style="display: none !important"');
            expect(result.html).toContain('class="quext-bns js-hidden" style="display: none !important"');

            // 3. Images/Links
            expect(result.html).toContain('class="js-hidden mapa-LinkImagesMapas" style="display: none !important"');
            // Note: snippet had " js-hidden"
            expect(result.html).toContain('class=" js-hidden mapa-LinkImagesSlides" style="display: none !important"');
            expect(result.html).toContain('class="js-hidden mapa-ImageMap" style="display: none !important"');
            expect(result.html).toContain('class="js-hidden selecciona-LinkImages" style="display: none !important"');
            expect(result.html).toContain('class="js-hidden adivina-LinkImages" style="display: none !important"');

            // 4. Controls (Should NOT have the style injected)
            expect(result.html).not.toContain('class="other-version" style="display: none !important"');
            expect(result.html).not.toContain('class="js-hidden" style="display: none !important"'); // Just Hidden Div
            expect(result.html).not.toContain('class="mapa-ImageMap" style="display: none !important"');
        });

        it('should hide audio/video links and specific data divs/paragraphs', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page with media extras',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Text Block',
                            order: 0,
                            components: [
                                // Audio links
                                {
                                    id: 'c1',
                                    order: 0,
                                    properties: {},
                                    type: 'text',
                                    content: '<a href="#" class="js-hidden seleccionamedias-LinkAudios-1">Audio 1</a>',
                                },
                                {
                                    id: 'c2',
                                    order: 1,
                                    properties: {},
                                    type: 'text',
                                    content: '<a href="#" class="js-hidden sopa-LinkAudios">Audio 2</a>',
                                },
                                // Video links
                                {
                                    id: 'c3',
                                    order: 2,
                                    properties: {},
                                    type: 'text',
                                    content: '<a href="#" class="js-hidden vquext-LinkLocalVideo">Video 1</a>',
                                },
                                // Specific P tag
                                {
                                    id: 'c4',
                                    order: 3,
                                    properties: {},
                                    type: 'text',
                                    content: '<p class="exe-mindmap-code">Mindmap Code</p>',
                                },
                                // Specific Divs
                                {
                                    id: 'c5',
                                    order: 4,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="form-Data js-hidden">Form Data</div>',
                                },
                                {
                                    id: 'c6',
                                    order: 5,
                                    properties: {},
                                    type: 'text',
                                    content: '<div class="completa-DataGame js-hidden">Completa DataGame</div>',
                                },
                                // Controls
                                {
                                    id: 'c7',
                                    order: 6,
                                    properties: {},
                                    type: 'text',
                                    content: '<a href="#" class="sopa-LinkAudios">Visible Audio</a>',
                                }, // No js-hidden
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // 1. Audio/Video
            expect(result.html).toContain(
                'class="js-hidden seleccionamedias-LinkAudios-1" style="display: none !important"',
            );
            expect(result.html).toContain('class="js-hidden sopa-LinkAudios" style="display: none !important"');
            expect(result.html).toContain('class="js-hidden vquext-LinkLocalVideo" style="display: none !important"');

            // 2. Specific Elements
            expect(result.html).toContain('class="exe-mindmap-code" style="display: none !important"');
            expect(result.html).toContain('class="form-Data js-hidden" style="display: none !important"');
            expect(result.html).toContain('class="completa-DataGame js-hidden" style="display: none !important"');

            // 3. Controls
            expect(result.html).not.toContain('class="sopa-LinkAudios" style="display: none !important"');
        });
    });

    describe('component deduplication', () => {
        it('should remove consecutive duplicate components with shared ID prefix', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page with duplicates',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Text Block',
                            order: 0,
                            components: [
                                // Sequence of duplicates (Simulating the Complete iDevice split)
                                // Shared prefix: 20251021091936 (14 chars)
                                {
                                    id: '20251021091936ZBADPV',
                                    order: 0,
                                    properties: {},
                                    type: 'complete',
                                    content: '<div>Component 1 (Keep)</div>',
                                },
                                {
                                    id: '20251021091936KBGQGU',
                                    order: 1,
                                    properties: {},
                                    type: 'complete',
                                    content: '<div>Component 2 (Drop)</div>',
                                },
                                {
                                    id: '20251021091936GSEMZX',
                                    order: 2,
                                    properties: {},
                                    type: 'complete',
                                    content: '<div>Component 3 (Drop)</div>',
                                },
                                // Another independent component (Different prefix)
                                {
                                    id: '20251021092000AAAAAA',
                                    order: 3,
                                    properties: {},
                                    type: 'complete',
                                    content: '<div>Component 4 (Keep - Different Prefix)</div>',
                                },
                                // Another sequence (Different prefix from first group)
                                {
                                    id: '20251021092000BBBBBB',
                                    order: 4,
                                    properties: {},
                                    type: 'complete',
                                    content: '<div>Component 5 (Drop - Duplicate of 4)</div>',
                                },
                                // Different Type (Should break chain even if prefix matches? Unlikely scenario but good control)
                                {
                                    id: '20251021092000CCCCCC',
                                    order: 5,
                                    properties: {},
                                    type: 'text',
                                    content: '<div>Component 6 (Keep - Different Type)</div>',
                                },
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // 1. First Group
            expect(result.html).toContain('Component 1 (Keep)');
            expect(result.html).not.toContain('Component 2 (Drop)');
            expect(result.html).not.toContain('Component 3 (Drop)');

            // 2. Second Group
            expect(result.html).toContain('Component 4 (Keep - Different Prefix)');
            expect(result.html).not.toContain('Component 5 (Drop - Duplicate of 4)');

            // 3. Different Type
            expect(result.html).toContain('Component 6 (Keep - Different Type)');
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
                            name: 'Text Block',
                            order: 0,
                            components: [
                                {
                                    id: 'c3',
                                    order: 0,
                                    properties: {},
                                    type: 'text',
                                    content: '<pre class="abc-music">X:1</pre>',
                                },
                                {
                                    id: 'c4',
                                    order: 1,
                                    properties: {},
                                    type: 'text',
                                    content: '<pre class="highlighted-code">code</pre>',
                                },
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

        it('should handle empty version string correctly (static mode)', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    parentId: null,
                    order: 0,
                    title: 'Title',
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Text Block',
                            order: 0,
                            components: [
                                {
                                    id: 'c1',
                                    type: 'text',
                                    order: 0,
                                    properties: {},
                                    content: '<script src="libs/jquery/jquery.min.js"></script>',
                                },
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({
                baseUrl: 'http://localhost:8080',
                basePath: '',
                version: '',
            });

            expect(result.html).toContain('src="http://localhost:8080/libs/jquery/jquery.min.js"');
            expect(result.html).not.toContain('/v1.0.0/');
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

    describe('Icon Resolution via setThemeIconFiles', () => {
        it('should resolve SVG icons when theme has SVG icon files', async () => {
            const pagesWithIcon = [
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

            const provider = createMockResourceProvider();
            provider.fetchTheme = async () => {
                const files = new Map<string, Uint8Array>();
                files.set('style.css', new Uint8Array(0));
                files.set('icons/activity.svg', new Uint8Array(0));
                return files;
            };

            const doc = createMockDocument(pagesWithIcon);
            const exp = new PrintPreviewExporter(doc, provider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('icons/activity.svg');
        });

        it('should fall back to .png when theme fetch fails', async () => {
            const pagesWithIcon = [
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

            const provider = createMockResourceProvider();
            provider.fetchTheme = async () => {
                throw new Error('Theme not available');
            };

            const doc = createMockDocument(pagesWithIcon);
            const exp = new PrintPreviewExporter(doc, provider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('icons/activity.png');
        });

        it('should fall back to .png when theme has no icon files', async () => {
            const pagesWithIcon = [
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

            const doc = createMockDocument(pagesWithIcon);
            const exp = new PrintPreviewExporter(doc, createMockResourceProvider());
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('icons/activity.png');
        });
    });

    describe('User Reported Broken Images', () => {
        // Helper to check if paths are patched to server paths (mocked as http://localhost:3000/...)
        const SERVER_BASE = 'http://localhost:3000';

        it('should patch "quick-questions" (hyphenated) iDevice images', async () => {
            const htmlSnippet =
                '<img src="idevices/quick-questions/quextHome.png" class="QXTP-Cover" id="quextCover-0" alt="Pregunta sin imágenes">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `${SERVER_BASE}/app/v1/files/perm/idevices/base/quick-questions/export/quextHome.png`,
            );
        });

        it('should patch iDevice paths that already include "export/" segment', async () => {
            // Some renderers or contexts might output src="idevices/guess/export/adivinaHome.png"
            // The current regex `idevices/TYPE/FILE` fails if there is an extra segment.
            const htmlSnippet = '<img src="idevices/guess/export/adivinaHome.png" alt="Test">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `${SERVER_BASE}/app/v1/files/perm/idevices/base/guess/export/adivinaHome.png`,
            );
        });

        it('should patch iDevice paths that start with "./" or "/"', async () => {
            // Example: <img src="./idevices/guess/adivinaHome.png">
            const htmlSnippet = '<img src="./idevices/guess/adivinaHome.png" alt="Test">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `${SERVER_BASE}/app/v1/files/perm/idevices/base/guess/export/adivinaHome.png`,
            );
        });

        it('should patch content/resources even if they are absolute URLs (e.g. localhost)', async () => {
            // Example from user: <img src="http://localhost:8080/content/resources/notacion_musical.png.png" alt="Notación musical" width="492" height="395">
            const htmlSnippet =
                '<img src="http://localhost:8080/content/resources/notacion_musical.png.png" alt="Notación musical">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(`${SERVER_BASE}/app/v1/content/resources/notacion_musical.png.png`);
        });

        it('should patch "guess" iDevice images', async () => {
            const htmlSnippet =
                '<img src="idevices/guess/adivinaHome.png" class="ADVNP-Cover" id="adivinaCover-0" alt="Pregunta sin imágenes">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `${SERVER_BASE}/app/v1/files/perm/idevices/base/guess/export/adivinaHome.png`,
            );
        });

        it('should identify and patch "identify" iDevice images', async () => {
            const htmlSnippet = '<img class="IDFP-Clue" src="idevices/identify/identificaPistaOpen.svg" alt="Clue 5">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `${SERVER_BASE}/app/v1/files/perm/idevices/base/identify/export/identificaPistaOpen.svg`,
            );
        });

        it('should patch "relate" iDevice images', async () => {
            const htmlSnippet = '<img src="idevices/relate/exequextplayaudio.svg" class="FLCDSP-RLCP" alt="Audio">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `${SERVER_BASE}/app/v1/files/perm/idevices/base/relate/export/exequextplayaudio.svg`,
            );
        });

        it('should patch "hidden-image" iDevice icon', async () => {
            const htmlSnippet = '<img src="idevices/hidden-image/hidden-image-icon.png" alt="Pulse aquí para jugar">';
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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `${SERVER_BASE}/app/v1/files/perm/idevices/base/hidden-image/export/hidden-image-icon.png`,
            );
        });

        it('should repair broken/versioned iDevice paths (User Scenario)', async () => {
            // Simulating the user's log: /v0.0.0-alpha.../files/perm/idevices/base/magnifier/export/hood.jpg
            // This needs to be repointed to the correct server base
            const brokenPath = '/v0.0.0-alpha/files/perm/idevices/base/magnifier/export/hood.jpg';
            const htmlSnippet = `<img src="${brokenPath}" alt="Hood">`;

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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            // We use a clean version setup for the "correct" output
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: '' });

            // Should strip the old version/base and use the new one
            // Expect: SERVER_BASE/app/files/perm/idevices/base/magnifier/export/hood.jpg
            const expectedPath = `${SERVER_BASE}/app/files/perm/idevices/base/magnifier/export/hood.jpg`;
            expect(result.html).toContain(expectedPath);
        });

        it('should patch "data-idevice-path" attribute for dynamic scripts', async () => {
            // Example: <div ... data-idevice-path="idevices/relate/">
            // This needs to be patched to absolute server path so JS can load assets
            const htmlSnippet = '<div class="iDevice_wrapper" data-idevice-path="idevices/relate/">Content</div>';

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
                                    content: htmlSnippet,
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview({ baseUrl: SERVER_BASE, basePath: '/app', version: 'v1' });

            expect(result.html).toContain(
                `data-idevice-path="${SERVER_BASE}/app/v1/files/perm/idevices/base/relate/export/"`,
            );
        });
    });
});
