/**
 * Tests for WebsitePreviewExporter
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { WebsitePreviewExporter } from './WebsitePreviewExporter';
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

describe('WebsitePreviewExporter', () => {
    let exporter: WebsitePreviewExporter;
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
                blocks: [],
            },
        ]);
        mockResourceProvider = createMockResourceProvider();
        exporter = new WebsitePreviewExporter(mockDocument, mockResourceProvider);
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
            const emptyExporter = new WebsitePreviewExporter(emptyDoc, mockResourceProvider);
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
            expect(result.html).toContain('<title>Test Project - Preview</title>');
        });

        it('should include exe-preview class on body', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('class="exe-web-site exe-preview"');
        });

        it('should include js-hidden CSS rules for feedback toggle support', async () => {
            // The preview must include CSS to hide .js-hidden elements (feedback content)
            // and show .js-required elements (feedback buttons) when JS is enabled
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.js-hidden { display: none; }');
            expect(result.html).toContain('.js .js-required { display: block; }');
        });

        it('should include page counter when addPagination is true', async () => {
            // Create a new exporter with addPagination enabled
            const docWithPagination = createMockDocument(
                [
                    {
                        id: 'page-1',
                        title: 'Home',
                        parentId: null,
                        order: 0,
                        blocks: [],
                    },
                    {
                        id: 'page-2',
                        title: 'About',
                        parentId: null,
                        order: 1,
                        blocks: [],
                    },
                ],
                { addPagination: true },
            );
            const exporterWithPagination = new WebsitePreviewExporter(docWithPagination, mockResourceProvider);
            const result = await exporterWithPagination.generatePreview();

            expect(result.html).toContain('page-counter');
            expect(result.html).toContain(
                '1</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">2',
            );
        });

        it('should NOT include page counter when addPagination is false (default)', async () => {
            const result = await exporter.generatePreview();
            // Check that the HTML element with class page-counter is NOT present
            // (note: the JS code may reference .page-counter-current-page class, but the HTML element should not exist)
            expect(result.html).not.toContain('<p class="page-counter">');
        });

        it('should include made-with-eXe credit', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('id="made-with-eXe"');
            expect(result.html).toContain('exelearning.net');
        });

        it('should include navigation with page links', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('id="siteNav"');
            expect(result.html).toContain('data-page-id="page-1"');
            expect(result.html).toContain('data-page-id="page-2"');
        });

        it('should include navigation buttons', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('nav-button-left');
            expect(result.html).toContain('nav-button-right');
            expect(result.html).toContain('data-nav="prev"');
            expect(result.html).toContain('data-nav="next"');
        });

        it('should use English labels for navigation buttons', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('<span>Previous</span>');
            expect(result.html).toContain('<span>Next</span>');
            expect(result.html).toContain('title="Previous"');
            expect(result.html).toContain('title="Next"');
        });

        it('should render main-header wrapper with package/page headers', async () => {
            const result = await exporter.generatePreview();
            // Headers wrapped in main-header so theme JS (e.g., flux movePageTitle) can find them
            expect(result.html).toContain('<header class="main-header">');
            expect(result.html).toContain('<div class="package-header');
            expect(result.html).toContain('<div class="page-header"');
            // Headers should be outside articles (inside main.page)
            const htmlAfterMain = result.html!.split('<main class="page">')[1];
            const headerPos = htmlAfterMain.indexOf('<header class="main-header">');
            const articlePos = htmlAfterMain.indexOf('<article');
            // Header should come before articles
            expect(headerPos).toBeGreaterThan(-1);
            expect(articlePos).toBeGreaterThan(-1);
            expect(headerPos).toBeLessThan(articlePos);
        });

        it('should render header structure for theme JS to find and move title', async () => {
            const result = await exporter.generatePreview();
            // main-header wraps div elements (not header), theme JS looks for '.main-header .page-header'
            expect(result.html).toContain('<header class="main-header">');
            expect(result.html).toContain('<div class="package-header package-node">');
            expect(result.html).toContain('class="package-title"');
            expect(result.html).toContain('class="page-title"');
        });

        it('should store page title in data attribute for SPA navigation', async () => {
            const result = await exporter.generatePreview();
            // Articles should have data-page-title for JS to update header
            expect(result.html).toContain('data-page-title="Home"');
            expect(result.html).toContain('data-page-title="About"');
        });

        it('should include page header inside each article for pre-rendered LaTeX', async () => {
            const result = await exporter.generatePreview();
            // Each article should have its own page-header-spa with the title
            // This ensures LaTeX in titles is pre-rendered and preserved on navigation
            expect(result.html).toContain('class="page-header page-header-spa"');
            expect(result.html).toContain('class="page-title">Home</h2>');
            expect(result.html).toContain('class="page-title">About</h2>');
        });

        it('should hide shared header since page headers are inside articles', async () => {
            const result = await exporter.generatePreview();
            // Shared header is hidden (page headers are now inside each article)
            expect(result.html).toContain('<div class="page-header" style="display:none">');
            expect(result.html).toContain('id="page-title" class="page-title"></h2>');
        });

        it('should include SPA navigation script', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('SPA Navigation');
            expect(result.html).toContain('showPage');
        });

        it('should mark first page as active', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('id="page-page-1" class="spa-page active"');
        });

        it('should hide other pages', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('id="page-page-2"');
            expect(result.html).toContain('style="display:none"');
        });

        it('should include block content', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('Hello World');
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
            const exp = new WebsitePreviewExporter(docWithDuplicates, mockResourceProvider);
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
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('/themes/base/darkmode/style.css');
        });

        it('should include custom styles', async () => {
            const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                customStyles: '.my-class { color: red; }',
            });
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('.my-class { color: red; }');
        });

        it('should include proper footer structure with license', async () => {
            const result = await exporter.generatePreview();
            // Footer should have the correct structure matching PageRenderer
            expect(result.html).toContain('<footer id="siteFooter">');
            expect(result.html).toContain('<div id="siteFooterContent">');
            expect(result.html).toContain('id="packageLicense"');
            expect(result.html).toContain('class="license-label">Licencia: </span>');
            expect(result.html).toContain('class="license">CC-BY-SA</a>');
        });

        it('should include user footer content when provided', async () => {
            const docWithFooter = createMockDocument([{ id: 'page-1', title: 'Home', blocks: [] }]);
            // Override getMetadata to include footer
            docWithFooter.getMetadata = () => ({
                title: 'Test',
                author: 'Author',
                license: 'CC-BY-SA',
                footer: '<p>Custom footer content</p>',
            });
            const exp = new WebsitePreviewExporter(docWithFooter, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.html).toContain('id="siteUserFooter"');
            expect(result.html).toContain('<p>Custom footer content</p>');
        });

        it('should not include siteUserFooter when no custom footer content', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).not.toContain('id="siteUserFooter"');
        });
    });

    describe('nested navigation', () => {
        it('should render child pages nested in navigation', async () => {
            const docWithChildren = createMockDocument([
                { id: 'parent', title: 'Parent', parentId: null, order: 0, blocks: [] },
                { id: 'child', title: 'Child', parentId: 'parent', order: 1, blocks: [] },
            ]);
            const exp = new WebsitePreviewExporter(docWithChildren, mockResourceProvider);
            const result = await exp.generatePreview();

            // Parent should have class 'daddy' (may have 'active' too)
            expect(result.html).toContain('daddy');
            // Child should be in nested ul
            expect(result.html).toContain('class="other-section"');
        });
    });

    describe('HTML escaping', () => {
        it('should escape HTML in page titles', async () => {
            const doc = createMockDocument([
                { id: 'p1', title: '<script>alert("xss")</script>', parentId: null, order: 0, blocks: [] },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('&lt;script&gt;');
            expect(result.html).not.toContain('<script>alert("xss")</script>');
        });

        it('should escape HTML in project title', async () => {
            const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                title: '<script>xss</script>',
            });
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('&lt;script&gt;xss&lt;/script&gt; - Preview');
        });
    });

    describe('export options', () => {
        describe('addSearchBox', () => {
            it('should not include search box container by default', async () => {
                const result = await exporter.generatePreview();
                expect(result.html).not.toContain('id="exe-client-search"');
            });

            it('should include search box container when addSearchBox is true', async () => {
                const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                    addSearchBox: true,
                });
                const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();
                expect(result.html).toContain('id="exe-client-search"');
                // Search data is now in inline script instead of data-pages attribute
                expect(result.html).toContain('window.exeSearchData');
                expect(result.html).toContain('data-block-order-string="Caja %e"');
                expect(result.html).toContain('data-no-results-string="Sin resultados."');
                // Should NOT have data-pages attribute anymore
                expect(result.html).not.toContain('data-pages=');
            });

            it('should generate valid JSON search data in inline script', async () => {
                const doc = createMockDocument(
                    [
                        {
                            id: 'page-1',
                            title: 'Home Page',
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
                                            content: '<p>Test content</p>',
                                            properties: { key: 'value' },
                                        },
                                    ],
                                },
                            ],
                        },
                        { id: 'page-2', title: 'About', parentId: null, order: 1, blocks: [] },
                    ],
                    { addSearchBox: true },
                );
                const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();

                // Extract search data from inline script: window.exeSearchData = {...};
                const match = result.html!.match(/window\.exeSearchData\s*=\s*(\{[\s\S]*?\});/);
                expect(match).toBeTruthy();

                // Parse the JSON
                const data = JSON.parse(match![1]);

                // Verify structure
                expect(data['page-1']).toBeDefined();
                expect(data['page-1'].name).toBe('Home Page');
                expect(data['page-1'].isIndex).toBe(true);
                // SPA preview uses anchor-based URLs for search navigation
                expect(data['page-1'].fileName).toBe('#page-page-1');
                expect(data['page-1'].fileUrl).toBe('#page-page-1');
                expect(data['page-1'].blocks['block-1']).toBeDefined();
                expect(data['page-1'].blocks['block-1'].idevices['comp-1']).toBeDefined();

                expect(data['page-2']).toBeDefined();
                expect(data['page-2'].isIndex).toBe(false);
                expect(data['page-2'].fileName).toBe('#page-page-2');
                expect(data['page-2'].prePageId).toBe('page-1');
            });

            it('should handle special characters in search data', async () => {
                const doc = createMockDocument(
                    [
                        {
                            id: 'p1',
                            title: 'Page "with" <special> & chars',
                            parentId: null,
                            order: 0,
                            blocks: [],
                        },
                    ],
                    { addSearchBox: true },
                );
                const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();

                // Extract search data from inline script
                const match = result.html!.match(/window\.exeSearchData\s*=\s*(\{[\s\S]*?\});/);
                expect(match).toBeTruthy();

                // JSON.parse should work (special chars are properly escaped)
                const data = JSON.parse(match![1]);
                expect(data['p1'].name).toBe('Page "with" <special> & chars');
            });
        });

        describe('addExeLink', () => {
            it('should include made-with-eXe by default', async () => {
                const result = await exporter.generatePreview();
                expect(result.html).toContain('id="made-with-eXe"');
            });

            it('should not include made-with-eXe when addExeLink is false', async () => {
                const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                    addExeLink: false,
                });
                const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();
                expect(result.html).not.toContain('id="made-with-eXe"');
            });

            it('should include made-with-eXe CSS with correct positioning', async () => {
                const result = await exporter.generatePreview();
                // Check that CSS for made-with-eXe is included
                expect(result.html).toContain('#made-with-eXe');
                expect(result.html).toContain('position: fixed');
                expect(result.html).toContain('bottom: 0');
                expect(result.html).toContain('right: 0');
                expect(result.html).toContain('z-index: 9999');
            });

            it('should include exe logo path in made-with-eXe CSS', async () => {
                const result = await exporter.generatePreview({
                    baseUrl: 'http://test.com',
                    version: 'v1.0.0',
                });
                expect(result.html).toContain('exe_powered_logo.png');
            });

            it('should render made-with-eXe with span containing translated text', async () => {
                const result = await exporter.generatePreview();
                // Should have span structure for hover text
                expect(result.html).toContain('<span>Made with eXeLearning </span>');
            });

            it('should translate made-with-eXe text in Spanish', async () => {
                const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                    language: 'es',
                });
                const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();
                expect(result.html).toContain('Creado con eXeLearning');
            });

            it('should fall back to English for unknown language', async () => {
                const doc = createMockDocument([{ id: 'p1', title: 'Page', parentId: null, order: 0, blocks: [] }], {
                    language: 'zh',
                });
                const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();
                expect(result.html).toContain('Made with eXeLearning');
            });
        });

        describe('addPagination', () => {
            it('should not include pagination by default', async () => {
                const result = await exporter.generatePreview();
                // Navigation buttons may exist but should not show pagination numbers
                expect(result.html).not.toContain('class="pagination"');
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
                const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
                const result = await exp.generatePreview();
                expect(result.html).toContain('exe_atools.css');
                expect(result.html).toContain('exe_atools.js');
            });
        });

        describe('userThemeCss', () => {
            it('should use inline style tag when userThemeCss is provided', async () => {
                const userCss = '.custom-theme { background: red; color: white; }';
                const result = await exporter.generatePreview({
                    userThemeCss: userCss,
                });
                // Should contain the inline CSS
                expect(result.html).toContain('<!-- User theme CSS (inline) -->');
                expect(result.html).toContain(userCss);
                // Should NOT contain link tag for theme CSS (since using inline)
                expect(result.html).not.toContain('<!-- Theme from server');
            });

            it('should use link tag when userThemeCss is not provided', async () => {
                const result = await exporter.generatePreview({
                    baseUrl: 'http://test.com',
                    version: 'v1.0.0',
                });
                // Should contain link tag for theme CSS
                expect(result.html).toContain('<!-- Theme from server');
                expect(result.html).toContain('style.css');
                // Should NOT contain user theme inline CSS
                expect(result.html).not.toContain('<!-- User theme CSS (inline) -->');
            });

            it('should use link tag when userThemeCss is empty string', async () => {
                const result = await exporter.generatePreview({
                    userThemeCss: '',
                });
                // Empty string is falsy, so should fall back to link tag
                expect(result.html).toContain('<!-- Theme from server');
                expect(result.html).not.toContain('<!-- User theme CSS (inline) -->');
            });

            it('should preserve user theme CSS with special characters', async () => {
                const userCss = '.theme { content: "Hello <world>"; background: url("image.png"); }';
                const result = await exporter.generatePreview({
                    userThemeCss: userCss,
                });
                expect(result.html).toContain(userCss);
            });
        });

        describe('userThemeJs', () => {
            it('should use inline script tag when userThemeJs is provided', async () => {
                const userJs = 'var exampleStyle = { init: function() { console.log("loaded"); } };';
                const result = await exporter.generatePreview({
                    userThemeJs: userJs,
                });
                // Should contain the inline JS
                expect(result.html).toContain('<!-- User theme JS (inline) -->');
                expect(result.html).toContain(userJs);
                // Should NOT contain script src for theme
                expect(result.html).not.toContain('style.js" onerror');
            });

            it('should use script src when userThemeJs is not provided', async () => {
                const result = await exporter.generatePreview({
                    baseUrl: 'http://test.com',
                    version: 'v1.0.0',
                });
                // Should contain script src for theme
                expect(result.html).toContain('style.js" onerror="this.remove()');
                // Should NOT contain user theme inline JS
                expect(result.html).not.toContain('<!-- User theme JS (inline) -->');
            });

            it('should include both userThemeCss and userThemeJs when both provided', async () => {
                const userCss = '.custom { color: red; }';
                const userJs = 'var customTheme = {};';
                const result = await exporter.generatePreview({
                    userThemeCss: userCss,
                    userThemeJs: userJs,
                });
                expect(result.html).toContain('<!-- User theme CSS (inline) -->');
                expect(result.html).toContain(userCss);
                expect(result.html).toContain('<!-- User theme JS (inline) -->');
                expect(result.html).toContain(userJs);
            });
        });
    });

    describe('ELPX protocol handling', () => {
        it('should replace exe-package:elp protocol with onclick handler', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
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
                                    type: 'download-source-file',
                                    order: 0,
                                    content:
                                        '<a class="exe-download-package-link" href="exe-package:elp" download="exe-package:elp-name">Download</a>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // Should have onclick handler
            expect(result.html).toContain('onclick="if(typeof downloadElpx===');
            // Should have proper download filename
            expect(result.html).toContain('download="Test Project.elpx"');
            // Should NOT have original protocol
            expect(result.html).not.toContain('href="exe-package:elp"');
            // Preview mode uses inline postMessage script instead of exe_elpx_download.js
            expect(result.html).toContain('window.parent.postMessage');
            expect(result.html).toContain("type: 'exe-download-elpx'");
            // Should NOT include external exe_elpx_download.js in preview (uses postMessage instead)
            expect(result.html).not.toContain('exe_elpx_download/exe_elpx_download.js');
        });

        it('should not modify content without download-source-file iDevice', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
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
                                    content: '<a href="https://example.com">Regular link</a>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            expect(result.html).toContain('href="https://example.com"');
            // Should NOT include the elpx download script
            expect(result.html).not.toContain('exe_elpx_download.js');
        });
    });

    describe('CSS load order', () => {
        it('should load made-with-eXe CSS after theme CSS', async () => {
            const result = await exporter.generatePreview();
            const html = result.html!;

            // Find positions of theme CSS and made-with-eXe CSS
            const themeCssPos = html.indexOf('/themes/base/');
            const madeWithCssPos = html.indexOf('#made-with-eXe {');

            // Made-with-eXe CSS should come after theme CSS
            expect(themeCssPos).toBeGreaterThan(-1);
            expect(madeWithCssPos).toBeGreaterThan(-1);
            expect(madeWithCssPos).toBeGreaterThan(themeCssPos);
        });

        it('should have SPA preview CSS separate from made-with-eXe CSS', async () => {
            const result = await exporter.generatePreview();
            // SPA styles should be present
            expect(result.html).toContain('.spa-page');
            expect(result.html).toContain('.nav-buttons');
        });
    });

    describe('Library detection', () => {
        it('should include lightbox library when content has rel="lightbox"', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
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
                                    content: '<a href="image.jpg" rel="lightbox"><img src="thumb.jpg" /></a>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // Should include lightbox CSS and JS
            expect(result.html).toContain('exe_lightbox/exe_lightbox.css');
            expect(result.html).toContain('exe_lightbox/exe_lightbox.js');
        });

        it('should include magnify library when content has ImageMagnifierIdevice class', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
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
                                    type: 'magnifier',
                                    order: 0,
                                    content: '<div class="ImageMagnifierIdevice"><img src="image.jpg" /></div>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // Should include magnify JS (no CSS for this library)
            expect(result.html).toContain('exe_magnify/mojomagnify.js');
        });

        it('should include lightbox for image gallery class', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
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
                                    content: '<div class="imageGallery"><img src="img1.jpg" /></div>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // Should include lightbox CSS and JS (used for galleries too)
            expect(result.html).toContain('exe_lightbox/exe_lightbox.css');
            expect(result.html).toContain('exe_lightbox/exe_lightbox.js');
        });

        it('should not include libraries when content does not require them', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page',
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
                                    content: '<p>Simple text without special features</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            // Should NOT include these libraries
            expect(result.html).not.toContain('exe_lightbox');
            expect(result.html).not.toContain('exe_magnify');
            expect(result.html).not.toContain('mojomagnify');
        });
    });

    describe('visibility CSS rules', () => {
        it('should include CSS to hide novisible blocks', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.exe-export article.novisible.box');
            expect(result.html).toContain('display: none !important');
        });

        it('should include CSS to hide novisible iDevices', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.exe-export article.box .idevice_node.novisible');
        });

        it('should include CSS to hide minimized block content', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.exe-export article.minimized .box-content');
        });

        it('should include CSS to hide teacher-only content by default', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('html:not(.mode-teacher) .js .teacher-only');
        });
    });

    describe('LaTeX rendering support', () => {
        it('should include page header inside each article for LaTeX pre-rendering', async () => {
            const result = await exporter.generatePreview();
            // Page headers are inside articles so LatexPreRenderer can process them
            // This preserves pre-rendered LaTeX when navigating between pages
            expect(result.html).toContain('page-header-spa');
            expect(result.html).toContain('class="page-title">');
        });

        it('should not update shared header dynamically since page headers are in articles', async () => {
            const result = await exporter.generatePreview();
            // showPage() should NOT update pageTitleEl (header is inside each article)
            // Instead, it just shows/hides articles which display their own headers
            expect(result.html).toContain('Page header is inside each article');
            expect(result.html).not.toContain('pageTitleEl.textContent = title');
        });

        it('should preserve LaTeX delimiters in page title data attribute', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Fórmulas con \\(\\LaTeX\\)',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            // LaTeX delimiters should be preserved in data-page-title attribute
            expect(result.html).toContain('data-page-title="Fórmulas con \\(\\LaTeX\\)"');
        });

        it('should include LaTeX in page-header-spa for pre-rendering', async () => {
            const doc = createMockDocument([
                {
                    id: 'p1',
                    title: 'Page with \\(x^2\\)',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
            ]);
            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();
            // Page header inside article should contain the title with LaTeX
            // LatexPreRenderer will convert this to SVG
            expect(result.html).toContain('class="page-header page-header-spa"');
            expect(result.html).toContain('Page with \\(x^2\\)');
        });
    });

    describe('MathJax library inclusion', () => {
        it('should include MathJax script when meta.addMathJax=true', async () => {
            const doc = createMockDocument(
                [
                    {
                        id: 'page-1',
                        title: 'Test Page',
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
                                        content: '<p>No math content</p>',
                                        properties: {},
                                    },
                                ],
                            },
                        ],
                    },
                ],
                { addMathJax: true },
            );

            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('tex-mml-svg.js');
        });

        it('should configure MathJax for SPA with typeset:false when addMathJax=true', async () => {
            const doc = createMockDocument(
                [
                    {
                        id: 'page-1',
                        title: 'Test Page',
                        parentId: null,
                        order: 0,
                        blocks: [],
                    },
                ],
                { addMathJax: true },
            );

            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            // MathJax should be configured to not auto-typeset (for SPA pages)
            expect(result.html).toContain('typeset: false');
        });

        it('should include pageReady handler for active page only when addMathJax=true', async () => {
            const doc = createMockDocument(
                [
                    {
                        id: 'page-1',
                        title: 'Test Page',
                        parentId: null,
                        order: 0,
                        blocks: [],
                    },
                ],
                { addMathJax: true },
            );

            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            // pageReady should only process active page
            expect(result.html).toContain('pageReady');
            expect(result.html).toContain('.spa-page.active');
        });

        it('should not include MathJax script when addMathJax=false and no LaTeX content', async () => {
            const doc = createMockDocument(
                [
                    {
                        id: 'page-1',
                        title: 'Test Page',
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
                                        content: '<p>Plain text without math</p>',
                                        properties: {},
                                    },
                                ],
                            },
                        ],
                    },
                ],
                { addMathJax: false },
            );

            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            // MathJax script should NOT be included
            expect(result.html).not.toContain('tex-mml-svg.js');
        });

        it('should include MathJax when content has LaTeX even without addMathJax option', async () => {
            const doc = createMockDocument([
                {
                    id: 'page-1',
                    title: 'Test Page',
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
                                    content: '<p>Math: \\(x^2 + y^2 = z^2\\)</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ]);

            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            // MathJax should be detected from content
            expect(result.html).toContain('tex-mml-svg.js');
        });

        it('should call MathJax.typesetPromise on SPA page navigation', async () => {
            const doc = createMockDocument(
                [
                    {
                        id: 'page-1',
                        title: 'Page 1',
                        parentId: null,
                        order: 0,
                        blocks: [],
                    },
                    {
                        id: 'page-2',
                        title: 'Page 2',
                        parentId: null,
                        order: 1,
                        blocks: [],
                    },
                ],
                { addMathJax: true },
            );

            const exp = new WebsitePreviewExporter(doc, mockResourceProvider);
            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            // SPA navigation should trigger MathJax typeset
            expect(result.html).toContain('MathJax.typesetPromise');
        });
    });

    describe('YouTube preview transform script', () => {
        it('should include YouTube transform script in preview', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('YouTube Preview Transform');
        });

        it('should detect blob: context in transform script', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("href.startsWith('blob:')");
        });

        it('should detect file: context in transform script', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("window.location.protocol === 'file:'");
        });

        it('should include regex pattern to extract video ID from youtube.com/embed/', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('youtube\\.com\\/embed\\/');
            expect(result.html).toContain('[a-zA-Z0-9_-]{11}');
        });

        it('should include regex pattern to extract video ID from youtube-nocookie.com/embed/', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('youtube-nocookie\\.com\\/embed\\/');
        });

        it('should use youtube-preview.html wrapper path', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('/app/common/youtube-preview.html');
        });

        it('should include basePath in wrapper URL when provided', async () => {
            const result = await exporter.generatePreview({
                basePath: '/exelearning',
            });
            expect(result.html).toContain("var basePath = '/exelearning'");
        });

        it('should use empty basePath when not provided', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("var basePath = ''");
        });

        it('should extract HTTP origin from blob URL', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('match(/^blob:(https?:\\/\\/[^/]+)/)');
        });

        it('should pass through YouTube parameters to wrapper', async () => {
            const result = await exporter.generatePreview();
            // Should pass these parameters from original iframe to wrapper
            expect(result.html).toContain("'autoplay'");
            expect(result.html).toContain("'start'");
            expect(result.html).toContain("'end'");
            expect(result.html).toContain("'mute'");
            expect(result.html).toContain("'loop'");
            expect(result.html).toContain("'controls'");
        });

        it('should preserve iframe dimensions in wrapper URL', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("iframe.getAttribute('width')");
            expect(result.html).toContain("iframe.getAttribute('height')");
            expect(result.html).toContain("wrapperUrl += '&w='");
            expect(result.html).toContain("wrapperUrl += '&h='");
        });

        it('should mark transformed iframes with data attribute', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("iframe.dataset.youtubeTransformed = 'true'");
            expect(result.html).toContain('iframe.dataset.originalSrc = src');
        });

        it('should skip already transformed iframes', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("iframe.dataset.youtubeTransformed === 'true'");
        });

        it('should use MutationObserver for dynamically added iframes', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('MutationObserver');
            expect(result.html).toContain('childList: true');
            expect(result.html).toContain('subtree: true');
        });

        it('should check child iframes in added nodes', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("node.querySelectorAll('iframe')");
        });

        it('should run on DOMContentLoaded if document is still loading', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("document.readyState === 'loading'");
            expect(result.html).toContain('DOMContentLoaded');
        });

        it('should run immediately if document is already loaded', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('transformAllYouTubeIframes()');
        });

        it('should log console message when transforming iframes', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("console.log('[YouTube Preview]");
        });

        it('should warn if HTTP origin cannot be determined', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("console.warn('[YouTube Preview]");
        });

        it('should only run in blob: or file: contexts (not HTTP)', async () => {
            const result = await exporter.generatePreview();
            // Script should exit early for normal HTTP contexts
            expect(result.html).toContain('if (!isBlob && !isFile)');
            expect(result.html).toContain('return; // Normal HTTP context');
        });

        it('should check for youtube.com, youtube-nocookie.com, and youtu.be', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain("src.includes('youtube.com')");
            expect(result.html).toContain("src.includes('youtube-nocookie.com')");
            expect(result.html).toContain("src.includes('youtu.be')");
        });
    });
});
