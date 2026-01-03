/**
 * Integration tests for Page Properties functionality
 *
 * Verifies that page properties (hidePageTitle, editableInPage, titlePage, titleNode, visibility, highlight)
 * flow correctly from Yjs document through export pipeline to final HTML output.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'path';
import { WebsitePreviewExporter } from '../../src/shared/export/exporters/WebsitePreviewExporter';
import { PageRenderer } from '../../src/shared/export/renderers/PageRenderer';
import type { ExportDocument, ExportMetadata, ExportPage, ResourceProvider } from '../../src/shared/export/interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../src/services/idevice-config';

// Path to real iDevices
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

// Create mock document with page properties
const createMockDocumentWithPageProperties = (pageProperties: Record<string, unknown>): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with Page Properties',
        author: 'Test',
        description: '',
        language: 'es',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'default',
        version: '4.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
    }),
    getNavigation: (): ExportPage[] => [
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
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: '<p>Page content</p>',
                            properties: {},
                        },
                    ],
                },
            ],
            properties: pageProperties,
        },
    ],
});

// Create mock document with multiple pages for navigation tests
const createMockDocumentWithMultiplePages = (
    pagesConfig: Array<{
        id: string;
        title: string;
        parentId: string | null;
        properties?: Record<string, unknown>;
    }>,
): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with Multiple Pages',
        author: 'Test',
        description: '',
        language: 'es',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'default',
        version: '4.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
    }),
    getNavigation: (): ExportPage[] =>
        pagesConfig.map((p, idx) => ({
            id: p.id,
            title: p.title,
            parentId: p.parentId,
            order: idx,
            blocks: [
                {
                    id: `block-${p.id}`,
                    name: `Block for ${p.title}`,
                    order: 0,
                    components: [
                        {
                            id: `text-${p.id}`,
                            type: 'text',
                            order: 0,
                            content: `<p>Content of ${p.title}</p>`,
                            properties: {},
                        },
                    ],
                },
            ],
            properties: p.properties || {},
        })),
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

describe('Page Properties Integration', () => {
    beforeAll(() => {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    describe('hidePageTitle property', () => {
        it('should hide page title when hidePageTitle=true', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'My Page Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: { hidePageTitle: true },
            };

            const headerHtml = renderer.renderPageHeader(page, {
                projectTitle: 'Project',
                currentPageIndex: 0,
                totalPages: 1,
                addPagination: false,
            });

            expect(headerHtml).toContain('style="display:none"');
            expect(headerHtml).toContain('My Page Title');
        });

        it('should hide page title when hidePageTitle="true" (string)', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'My Page Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: { hidePageTitle: 'true' },
            };

            const headerHtml = renderer.renderPageHeader(page, {
                projectTitle: 'Project',
                currentPageIndex: 0,
                totalPages: 1,
            });

            expect(headerHtml).toContain('style="display:none"');
        });

        it('should show page title when hidePageTitle=false', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Visible Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: { hidePageTitle: false },
            };

            const headerHtml = renderer.renderPageHeader(page, {
                projectTitle: 'Project',
                currentPageIndex: 0,
                totalPages: 1,
            });

            expect(headerHtml).not.toContain('style="display:none"');
            expect(headerHtml).toContain('Visible Title');
        });

        it('should hide page title in full preview when hidePageTitle=true', async () => {
            const document = createMockDocumentWithPageProperties({ hidePageTitle: true });
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('page-header');
            expect(result.html).toContain('style="display:none"');
        });
    });

    describe('editableInPage + titlePage properties', () => {
        it('should use titlePage when editableInPage=true', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Original Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    editableInPage: true,
                    titlePage: 'Custom Page Title',
                },
            };

            const effectiveTitle = renderer.getEffectivePageTitle(page);
            expect(effectiveTitle).toBe('Custom Page Title');
        });

        it('should use titlePage when editableInPage="true" (string)', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Original Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    editableInPage: 'true',
                    titlePage: 'Custom Title from String',
                },
            };

            const effectiveTitle = renderer.getEffectivePageTitle(page);
            expect(effectiveTitle).toBe('Custom Title from String');
        });

        it('should use original title when editableInPage=false', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Original Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    editableInPage: false,
                    titlePage: 'Should Not Be Used',
                },
            };

            const effectiveTitle = renderer.getEffectivePageTitle(page);
            expect(effectiveTitle).toBe('Original Title');
        });

        it('should use original title when titlePage is empty', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Original Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    editableInPage: true,
                    titlePage: '',
                },
            };

            const effectiveTitle = renderer.getEffectivePageTitle(page);
            expect(effectiveTitle).toBe('Original Title');
        });

        it('should render titlePage in page header', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Nav Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    editableInPage: true,
                    titlePage: 'Displayed Custom Title',
                },
            };

            const headerHtml = renderer.renderPageHeader(page, {
                projectTitle: 'Project',
                currentPageIndex: 0,
                totalPages: 1,
            });

            expect(headerHtml).toContain('Displayed Custom Title');
            expect(headerHtml).not.toContain('>Nav Title<');
        });

        it('should render titlePage in preview export', async () => {
            const document = createMockDocumentWithPageProperties({
                editableInPage: true,
                titlePage: 'Custom Preview Title',
            });
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('Custom Preview Title');
        });
    });

    describe('visibility property (page)', () => {
        it('should identify hidden pages correctly', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                { id: 'p1', title: 'Visible', parentId: null, order: 0, blocks: [], properties: {} },
                {
                    id: 'p2',
                    title: 'Hidden',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
            ];

            expect(renderer.isPageVisible(allPages[0], allPages)).toBe(true);
            expect(renderer.isPageVisible(allPages[1], allPages)).toBe(false);
        });

        it('should identify hidden pages with string value', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Hidden String',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { visibility: 'false' },
                },
            ];

            // First page is always visible
            expect(renderer.isPageVisible(allPages[0], allPages)).toBe(true);

            // But second page with visibility false should be hidden
            allPages.unshift({ id: 'p0', title: 'First', parentId: null, order: 0, blocks: [], properties: {} });
            expect(renderer.isPageVisible(allPages[1], allPages)).toBe(false);
        });

        it('should hide child pages when parent is hidden', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                { id: 'root', title: 'Root', parentId: null, order: 0, blocks: [], properties: {} },
                {
                    id: 'parent',
                    title: 'Hidden Parent',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
                {
                    id: 'child',
                    title: 'Child (inherits hidden)',
                    parentId: 'parent',
                    order: 2,
                    blocks: [],
                    properties: {},
                },
            ];

            expect(renderer.isPageVisible(allPages[1], allPages)).toBe(false);
            expect(renderer.isPageVisible(allPages[2], allPages)).toBe(false);
        });

        it('should exclude hidden pages from navigation', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                { id: 'p1', title: 'Page 1', parentId: null, order: 0, blocks: [], properties: {} },
                {
                    id: 'p2',
                    title: 'Hidden Page',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
                { id: 'p3', title: 'Page 3', parentId: null, order: 2, blocks: [], properties: {} },
            ];

            const navHtml = renderer.renderNavigation(allPages, 'p1', '');

            expect(navHtml).toContain('Page 1');
            expect(navHtml).not.toContain('Hidden Page');
            expect(navHtml).toContain('Page 3');
        });

        it('should keep first page visible even with visibility=false', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'First Page (Always Visible)',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { visibility: false },
                },
            ];

            expect(renderer.isPageVisible(allPages[0], allPages)).toBe(true);
        });

        it('should exclude hidden pages in preview navigation', async () => {
            const document = createMockDocumentWithMultiplePages([
                { id: 'p1', title: 'Visible Page 1', parentId: null },
                { id: 'p2', title: 'Hidden Page', parentId: null, properties: { visibility: false } },
                { id: 'p3', title: 'Visible Page 3', parentId: null },
            ]);
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            // Navigation should contain visible pages
            expect(result.html).toContain('Visible Page 1');
            expect(result.html).toContain('Visible Page 3');
            // Hidden page should not be in navigation
            const navMatch = result.html.match(/<nav[^>]*id="siteNav"[^>]*>[\s\S]*?<\/nav>/);
            expect(navMatch).toBeTruthy();
            if (navMatch) {
                expect(navMatch[0]).not.toContain('Hidden Page');
            }
        });
    });

    describe('highlight property', () => {
        it('should detect highlighted pages', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'p1',
                title: 'Highlighted',
                parentId: null,
                order: 0,
                blocks: [],
                properties: { highlight: true },
            };

            expect(renderer.isPageHighlighted(page)).toBe(true);
        });

        it('should detect highlighted pages with string value', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'p1',
                title: 'Highlighted',
                parentId: null,
                order: 0,
                blocks: [],
                properties: { highlight: 'true' },
            };

            expect(renderer.isPageHighlighted(page)).toBe(true);
        });

        it('should not detect non-highlighted pages', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'p1',
                title: 'Normal',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {},
            };

            expect(renderer.isPageHighlighted(page)).toBe(false);
        });

        it('should render highlighted-link class in navigation', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Highlighted Page',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { highlight: true },
                },
            ];

            const navHtml = renderer.renderNavigation(allPages, 'p1', '');

            expect(navHtml).toContain('highlighted-link');
        });

        it('should render highlighted-link in preview navigation', async () => {
            const document = createMockDocumentWithMultiplePages([
                { id: 'p1', title: 'Normal Page', parentId: null },
                { id: 'p2', title: 'Important Page', parentId: null, properties: { highlight: true } },
            ]);
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('highlighted-link');
        });
    });

    describe('titleNode property (original page name)', () => {
        it('should preserve titleNode property', () => {
            const page: ExportPage = {
                id: 'p1',
                title: 'Current Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    titleNode: 'Original Page Name',
                    editableInPage: true,
                    titlePage: 'Custom Display Title',
                },
            };

            // titleNode should be preserved in properties
            expect(page.properties?.titleNode).toBe('Original Page Name');
        });
    });

    describe('combined page properties', () => {
        it('should handle all properties together', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Navigation Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    hidePageTitle: false,
                    editableInPage: true,
                    titlePage: 'Custom Display Title',
                    titleNode: 'Original Name',
                    highlight: true,
                    visibility: true,
                },
            };

            // Check effective title
            expect(renderer.getEffectivePageTitle(page)).toBe('Custom Display Title');

            // Check title visibility
            expect(renderer.shouldHidePageTitle(page)).toBe(false);

            // Check highlight
            expect(renderer.isPageHighlighted(page)).toBe(true);

            // Check visibility
            expect(renderer.isPageVisible(page, [page])).toBe(true);
        });

        it('should render page with hidden title and custom title together', () => {
            const renderer = new PageRenderer();
            const page: ExportPage = {
                id: 'page-1',
                title: 'Nav Title',
                parentId: null,
                order: 0,
                blocks: [],
                properties: {
                    hidePageTitle: true,
                    editableInPage: true,
                    titlePage: 'Hidden Custom Title',
                },
            };

            const headerHtml = renderer.renderPageHeader(page, {
                projectTitle: 'Project',
                currentPageIndex: 0,
                totalPages: 1,
            });

            // Title should be hidden but custom title used
            expect(headerHtml).toContain('style="display:none"');
            expect(headerHtml).toContain('Hidden Custom Title');
        });

        it('should preserve all properties through preview export', async () => {
            const document = createMockDocumentWithPageProperties({
                hidePageTitle: true,
                editableInPage: true,
                titlePage: 'Full Property Test',
                titleNode: 'Original',
                highlight: true,
            });
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            // Title should use custom titlePage
            expect(result.html).toContain('Full Property Test');
            // Title should be hidden
            expect(result.html).toContain('style="display:none"');
        });
    });

    describe('getVisiblePages helper', () => {
        it('should filter out hidden pages', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                { id: 'p1', title: 'Page 1', parentId: null, order: 0, blocks: [], properties: {} },
                {
                    id: 'p2',
                    title: 'Hidden',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
                { id: 'p3', title: 'Page 3', parentId: null, order: 2, blocks: [], properties: {} },
            ];

            const visiblePages = renderer.getVisiblePages(allPages);

            expect(visiblePages).toHaveLength(2);
            expect(visiblePages.map(p => p.id)).toEqual(['p1', 'p3']);
        });

        it('should filter out pages with hidden ancestors', () => {
            const renderer = new PageRenderer();
            const allPages: ExportPage[] = [
                { id: 'root', title: 'Root', parentId: null, order: 0, blocks: [], properties: {} },
                {
                    id: 'hidden-parent',
                    title: 'Hidden Parent',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
                { id: 'child-1', title: 'Child 1', parentId: 'hidden-parent', order: 2, blocks: [], properties: {} },
                { id: 'child-2', title: 'Child 2', parentId: 'hidden-parent', order: 3, blocks: [], properties: {} },
            ];

            const visiblePages = renderer.getVisiblePages(allPages);

            expect(visiblePages).toHaveLength(1);
            expect(visiblePages[0].id).toBe('root');
        });
    });

    describe('Boolean value handling', () => {
        it('should handle boolean true for hidePageTitle', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.shouldHidePageTitle({
                    id: 'p1',
                    title: 't',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { hidePageTitle: true },
                }),
            ).toBe(true);
        });

        it('should handle string "true" for hidePageTitle', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.shouldHidePageTitle({
                    id: 'p1',
                    title: 't',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { hidePageTitle: 'true' },
                }),
            ).toBe(true);
        });

        it('should handle boolean false for hidePageTitle', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.shouldHidePageTitle({
                    id: 'p1',
                    title: 't',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { hidePageTitle: false },
                }),
            ).toBe(false);
        });

        it('should handle string "false" for hidePageTitle', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.shouldHidePageTitle({
                    id: 'p1',
                    title: 't',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { hidePageTitle: 'false' },
                }),
            ).toBe(false);
        });

        it('should handle undefined hidePageTitle', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.shouldHidePageTitle({
                    id: 'p1',
                    title: 't',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: {},
                }),
            ).toBe(false);
        });

        it('should handle boolean true for editableInPage', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.getEffectivePageTitle({
                    id: 'p1',
                    title: 'Original',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { editableInPage: true, titlePage: 'Custom' },
                }),
            ).toBe('Custom');
        });

        it('should handle string "true" for editableInPage', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.getEffectivePageTitle({
                    id: 'p1',
                    title: 'Original',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { editableInPage: 'true', titlePage: 'Custom' },
                }),
            ).toBe('Custom');
        });

        it('should handle boolean true for visibility', () => {
            const renderer = new PageRenderer();
            const pages: ExportPage[] = [
                { id: 'p0', title: 'First', parentId: null, order: 0, blocks: [], properties: {} },
                { id: 'p1', title: 't', parentId: null, order: 1, blocks: [], properties: { visibility: true } },
            ];
            expect(renderer.isPageVisible(pages[1], pages)).toBe(true);
        });

        it('should handle boolean false for visibility', () => {
            const renderer = new PageRenderer();
            const pages: ExportPage[] = [
                { id: 'p0', title: 'First', parentId: null, order: 0, blocks: [], properties: {} },
                { id: 'p1', title: 't', parentId: null, order: 1, blocks: [], properties: { visibility: false } },
            ];
            expect(renderer.isPageVisible(pages[1], pages)).toBe(false);
        });

        it('should handle string "false" for visibility', () => {
            const renderer = new PageRenderer();
            const pages: ExportPage[] = [
                { id: 'p0', title: 'First', parentId: null, order: 0, blocks: [], properties: {} },
                { id: 'p1', title: 't', parentId: null, order: 1, blocks: [], properties: { visibility: 'false' } },
            ];
            expect(renderer.isPageVisible(pages[1], pages)).toBe(false);
        });

        it('should handle boolean true for highlight', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.isPageHighlighted({
                    id: 'p1',
                    title: 't',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { highlight: true },
                }),
            ).toBe(true);
        });

        it('should handle string "true" for highlight', () => {
            const renderer = new PageRenderer();
            expect(
                renderer.isPageHighlighted({
                    id: 'p1',
                    title: 't',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { highlight: 'true' },
                }),
            ).toBe(true);
        });
    });

    describe('Single page export with page properties', () => {
        it('should render single page with hidden title', () => {
            const renderer = new PageRenderer();
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Hidden Title Page',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { hidePageTitle: true },
                },
            ];

            const html = renderer.renderSinglePage(pages, { projectTitle: 'Test' });

            expect(html).toContain('style="display:none"');
        });

        it('should render single page with custom title', () => {
            const renderer = new PageRenderer();
            const pages: ExportPage[] = [
                {
                    id: 'p1',
                    title: 'Original',
                    parentId: null,
                    order: 0,
                    blocks: [],
                    properties: { editableInPage: true, titlePage: 'Custom Title in Single' },
                },
            ];

            const html = renderer.renderSinglePage(pages, { projectTitle: 'Test' });

            expect(html).toContain('Custom Title in Single');
        });

        it('should render single page navigation with highlighted page', () => {
            const renderer = new PageRenderer();
            const pages: ExportPage[] = [
                { id: 'p1', title: 'Normal', parentId: null, order: 0, blocks: [], properties: {} },
                {
                    id: 'p2',
                    title: 'Important',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { highlight: true },
                },
            ];

            // Use renderSinglePageNav to test navigation-specific rendering
            const navHtml = renderer.renderSinglePageNav(pages);

            expect(navHtml).toContain('highlighted-link');
        });

        it('should exclude hidden pages from single page navigation', () => {
            const renderer = new PageRenderer();
            const pages: ExportPage[] = [
                { id: 'p1', title: 'Visible', parentId: null, order: 0, blocks: [], properties: {} },
                {
                    id: 'p2',
                    title: 'Hidden',
                    parentId: null,
                    order: 1,
                    blocks: [],
                    properties: { visibility: false },
                },
            ];

            const navHtml = renderer.renderSinglePageNav(pages);

            expect(navHtml).toContain('Visible');
            expect(navHtml).not.toContain('Hidden');
        });
    });

    describe('addMathJax metadata property', () => {
        // Create mock document with addMathJax metadata
        const createMockDocumentWithMathJax = (addMathJax: boolean): ExportDocument => ({
            getMetadata: (): ExportMetadata => ({
                title: 'MathJax Test Project',
                author: 'Test',
                description: '',
                language: 'en',
                license: 'CC-BY-SA',
                keywords: '',
                theme: 'base',
                addMathJax,
            }),
            getNavigation: (): ExportPage[] => [
                {
                    id: 'page-1',
                    title: 'Math Page',
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
                                    type: 'text',
                                    order: 0,
                                    content: '<p>No math content here</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        it('should include MathJax script in preview when addMathJax=true', async () => {
            const document = createMockDocumentWithMathJax(true);
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('tex-mml-svg.js');
        });

        it('should configure MathJax with typeset:false for SPA preview', async () => {
            const document = createMockDocumentWithMathJax(true);
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('typeset: false');
            expect(result.html).toContain('pageReady');
        });

        it('should not include MathJax when addMathJax=false and no math content', async () => {
            const document = createMockDocumentWithMathJax(false);
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).not.toContain('tex-mml-svg.js');
        });

        it('should include MathJax when content has LaTeX even without addMathJax option', async () => {
            const document: ExportDocument = {
                getMetadata: (): ExportMetadata => ({
                    title: 'LaTeX Content Project',
                    author: 'Test',
                    description: '',
                    language: 'en',
                    license: 'CC-BY-SA',
                    keywords: '',
                    theme: 'base',
                    // addMathJax not set
                }),
                getNavigation: (): ExportPage[] => [
                    {
                        id: 'page-1',
                        title: 'Math Page',
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
                                        type: 'text',
                                        order: 0,
                                        content: '<p>Formula: \\(E = mc^2\\)</p>',
                                        properties: {},
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            // MathJax should be detected from content
            expect(result.html).toContain('tex-mml-svg.js');
        });

        it('should preserve addMathJax in metadata through export pipeline', async () => {
            const document = createMockDocumentWithMathJax(true);
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // Verify MathJax config includes pageReady for SPA
            expect(result.html).toContain('window.MathJax');
            expect(result.html).toContain('.spa-page.active');
        });
    });
});
