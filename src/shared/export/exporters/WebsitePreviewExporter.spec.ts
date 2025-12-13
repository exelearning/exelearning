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

        it('should include page counter', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('page-counter');
            expect(result.html).toContain(
                '1</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">2',
            );
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

        it('should include author in footer', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('Test Author');
        });

        it('should include license in footer', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('CC-BY-SA');
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
});
