/**
 * Tests for PrintPreviewExporter
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { PrintPreviewExporter } from './PrintPreviewExporter';
import type { ExportDocument, ExportMetadata, ExportPage, ResourceProvider } from '../interfaces';

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
    getThemeFiles: async () => [],
    getThemeFile: async () => null,
    getIdeviceFiles: async () => [],
    getIdeviceFile: async () => null,
    getLibraryFiles: async () => [],
    getLibraryFile: async () => null,
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
            expect(result.html).toContain('<title>Test Project - Print</title>');
        });

        it('should include exe-single-page class on body for print styling', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('exe-single-page');
            expect(result.html).toContain('exe-preview');
        });

        it('should render all pages as sections (not SPA)', async () => {
            const result = await exporter.generatePreview();
            // Both pages should be rendered as visible sections
            expect(result.html).toContain('id="section-page-1"');
            expect(result.html).toContain('id="section-page-2"');
            expect(result.html).toContain('class="single-page-section"');
        });

        it('should include all page content visible at once', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('Hello World');
            expect(result.html).toContain('About page content');
        });

        it('should include package header with project title', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('class="package-header"');
            expect(result.html).not.toContain('package-node');
            expect(result.html).toContain('class="package-title">Test Project</h1>');
        });

        it('should include page headers in sections', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('class="page-header"');
            expect(result.html).toContain('class="page-title">Home</h2>');
            expect(result.html).toContain('class="page-title">About</h2>');
        });
    });

    describe('single-page navigation', () => {
        it('should render navigation with anchor links (not SPA JavaScript)', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('id="siteNav"');
            expect(result.html).toContain('class="single-page-nav"');
            expect(result.html).toContain('href="#section-page-1"');
            expect(result.html).toContain('href="#section-page-2"');
        });

        it('should NOT include SPA navigation script', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).not.toContain('showPage');
            expect(result.html).not.toContain('data-page-id');
            expect(result.html).not.toContain('spa-page');
        });

        it('should NOT include prev/next navigation buttons', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).not.toContain('nav-button-left');
            expect(result.html).not.toContain('nav-button-right');
            expect(result.html).not.toContain('data-nav="prev"');
        });
    });

    describe('print-specific CSS', () => {
        it('should include @media print rules', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('@media print');
        });

        it('should hide navigation in print mode', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('@media print');
            expect(result.html).toContain('.single-page-nav');
            expect(result.html).toContain('display: none');
        });

        it('should prevent page breaks inside sections', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('page-break-inside: avoid');
        });

        it('should hide made-with-eXe in print mode', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('#made-with-eXe { display: none; }');
        });

        it('should include section border styling', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.single-page-section');
            expect(result.html).toContain('border-bottom');
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
        it('should include iDevice CSS links', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('/files/perm/idevices/base/text/export/text.css');
        });

        it('should include iDevice JS scripts', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('/files/perm/idevices/base/text/export/text.js');
        });

        it('should deduplicate iDevice resources', async () => {
            const docWithDuplicates = createMockDocument([
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
                                { id: 'c1', type: 'text', order: 0, content: 'Text 1', properties: {} },
                                { id: 'c2', type: 'text', order: 1, content: 'Text 2', properties: {} },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new PrintPreviewExporter(docWithDuplicates, mockResourceProvider);
            const result = await exp.generatePreview();

            // Count occurrences of text.css - should be exactly 1
            const matches = result.html!.match(/text\/export\/text\.css/g);
            expect(matches?.length).toBe(1);
        });
    });

    describe('metadata handling', () => {
        it('should use custom theme', async () => {
            const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                theme: 'darkmode',
            });
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('/themes/base/darkmode/style.css');
        });

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
            expect(result.html).toContain('id="packageLicense"');
            expect(result.html).toContain('CC-BY-SA');
        });
    });

    describe('nested navigation', () => {
        it('should render child pages nested in navigation', async () => {
            const docWithChildren = createMockDocument([
                { id: 'parent', title: 'Parent', parentId: null, order: 0, blocks: [] },
                { id: 'child', title: 'Child', parentId: 'parent', order: 1, blocks: [] },
            ]);
            const exp = new PrintPreviewExporter(docWithChildren, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.html).toContain('daddy');
            expect(result.html).toContain('class="other-section"');
            expect(result.html).toContain('href="#section-child"');
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
            expect(result.html).toContain('&lt;script&gt;xss&lt;/script&gt; - Print');
        });
    });

    describe('export options', () => {
        describe('addExeLink', () => {
            it('should include made-with-eXe by default', async () => {
                const result = await exporter.generatePreview();
                expect(result.html).toContain('id="made-with-eXe"');
            });

            it('should not include made-with-eXe when addExeLink is false', async () => {
                const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                    addExeLink: false,
                });
                const exp = new PrintPreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();
                expect(result.html).not.toContain('id="made-with-eXe"');
            });
        });

        describe('addAccessibilityToolbar', () => {
            it('should not include accessibility toolbar by default', async () => {
                const result = await exporter.generatePreview();
                expect(result.html).not.toContain('exe_atools');
            });

            it('should include accessibility toolbar when enabled', async () => {
                const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                    addAccessibilityToolbar: true,
                });
                const exp = new PrintPreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();
                expect(result.html).toContain('exe_atools.css');
                expect(result.html).toContain('exe_atools.js');
            });
        });
    });

    describe('visibility handling', () => {
        it('should hide pages with visibility=false', async () => {
            const docWithHidden = createMockDocument([
                { id: 'visible', title: 'Visible', parentId: null, order: 0, blocks: [] },
                {
                    id: 'hidden',
                    title: 'Hidden',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
            ]);
            const exp = new PrintPreviewExporter(docWithHidden, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.html).toContain('id="section-visible"');
            expect(result.html).not.toContain('id="section-hidden"');
        });

        it('should show first page even if visibility=false', async () => {
            const docWithHiddenFirst = createMockDocument([
                {
                    id: 'first',
                    title: 'First',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { visibility: false },
                },
                { id: 'second', title: 'Second', parentId: null, order: 1, blocks: [] },
            ]);
            const exp = new PrintPreviewExporter(docWithHiddenFirst, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.html).toContain('id="section-first"');
        });
    });

    describe('page title properties', () => {
        it('should hide page title when hidePageTitle is true', async () => {
            const doc = createMockDocument([
                { id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [], properties: { hidePageTitle: true } },
            ]);
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('style="display:none"');
        });

        it('should use titlePage when editableInPage is true', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Original Title',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { editableInPage: true, titlePage: 'Custom Title' },
                },
            ]);
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('Custom Title');
        });
    });

    describe('MathJax support', () => {
        it('should include MathJax when content has LaTeX', async () => {
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
                                    content: '<p>Math: \\(x^2\\)</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('tex-mml-svg.js');
        });

        it('should configure MathJax for full page typeset (not SPA)', async () => {
            const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                addMathJax: true,
            });
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            // For single-page, we want full page typeset
            expect(result.html).toContain('typeset: true');
        });
    });

    describe('exe_export.js integration', () => {
        it('should include exe_export.js for iDevice initialization', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('exe_export.js');
        });

        it('should call $exeExport.init()', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('$exeExport.init()');
        });
    });
});
