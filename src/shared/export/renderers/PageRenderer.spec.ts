/**
 * Tests for PageRenderer
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PageRenderer } from './PageRenderer';
import type { ExportPage, PageRenderOptions } from '../interfaces';

describe('PageRenderer', () => {
    let renderer: PageRenderer;

    beforeEach(() => {
        renderer = new PageRenderer();
    });

    // Helper to create test pages
    function createTestPage(overrides: Partial<ExportPage> = {}): ExportPage {
        return {
            id: 'page-1',
            title: 'Test Page',
            parentId: null,
            order: 0,
            blocks: [],
            ...overrides,
        };
    }

    function createDefaultOptions(overrides: Partial<PageRenderOptions> = {}): PageRenderOptions {
        return {
            projectTitle: 'Test Project',
            language: 'en',
            theme: 'base',
            allPages: [],
            basePath: '',
            isIndex: false,
            usedIdevices: [],
            author: 'Test Author',
            license: 'CC-BY-SA',
            ...overrides,
        };
    }

    describe('render', () => {
        it('should render a complete HTML page', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page] });

            const html = renderer.render(page, options);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html lang="en"');
            expect(html).toContain('<title>Test Page</title>');
            expect(html).toContain('class="page"'); // main element with page class
            expect(html).toContain('id="siteNav"'); // navigation present
        });

        it('should set correct html id for index page', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page], isIndex: true });

            const html = renderer.render(page, options);

            expect(html).toContain('id="exe-index"');
        });

        it('should set correct html id for non-index page', () => {
            const page = createTestPage({ id: 'my-page-id' });
            const options = createDefaultOptions({ allPages: [page], isIndex: false });

            const html = renderer.render(page, options);

            expect(html).toContain('id="exe-my-page-id"');
        });

        it('should include CSS links in head', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page] });

            const html = renderer.render(page, options);

            expect(html).toContain('bootstrap/bootstrap.min.css');
            expect(html).toContain('content/css/base.css');
            expect(html).toContain('theme/content.css');
        });

        it('should include custom styles when provided', () => {
            const page = createTestPage();
            const options = createDefaultOptions({
                allPages: [page],
                customStyles: '.custom { color: red; }',
            });

            const html = renderer.render(page, options);

            expect(html).toContain('<style>');
            expect(html).toContain('.custom { color: red; }');
        });

        it('should include footer with license', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page] });

            const html = renderer.render(page, options);

            expect(html).toContain('id="siteFooter"');
            expect(html).toContain('id="siteFooterContent"');
            expect(html).toContain('id="packageLicense"');
        });

        it('should include page header with page counter when addPagination is true', () => {
            const pages = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];
            const options = createDefaultOptions({ allPages: pages, isIndex: false, addPagination: true });

            const html = renderer.render(pages[1], options);

            expect(html).toContain('class="page-header"');
            expect(html).toContain('class="page-counter"');
            expect(html).toContain('class="page-counter-current-page">2</strong>');
            expect(html).toContain('class="page-counter-total">2</strong>');
            expect(html).toContain('class="package-title"');
            expect(html).toContain('class="page-title"');
        });

        it('should NOT include page counter when addPagination is false (default)', () => {
            const pages = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];
            const options = createDefaultOptions({ allPages: pages, isIndex: false });

            const html = renderer.render(pages[1], options);

            expect(html).toContain('class="page-header"');
            expect(html).not.toContain('class="page-counter"');
        });

        it('should include page content wrapper', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page] });

            const html = renderer.render(page, options);

            expect(html).toContain('class="page-content"');
            expect(html).toContain('id="page-content-page-1"');
        });

        it('should include made-with-eXe credit', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page] });

            const html = renderer.render(page, options);

            expect(html).toContain('id="made-with-eXe"');
            expect(html).toContain('exelearning.net');
        });

        it('should include JavaScript scripts', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page] });

            const html = renderer.render(page, options);

            expect(html).toContain('jquery/jquery.min.js');
            expect(html).toContain('exe_export.js');
            expect(html).toContain('common.js');
        });

        it('should apply basePath to resource URLs', () => {
            const page = createTestPage();
            const options = createDefaultOptions({
                allPages: [page],
                basePath: '../',
            });

            const html = renderer.render(page, options);

            expect(html).toContain('href="../libs/bootstrap/bootstrap.min.css"');
            expect(html).toContain('src="../libs/jquery/jquery.min.js"');
        });

        it('should add SCORM-specific attributes', () => {
            const page = createTestPage();
            const options = createDefaultOptions({
                allPages: [page],
                isScorm: true,
                onLoadScript: 'initScorm()',
                onUnloadScript: 'terminateScorm()',
            });

            const html = renderer.render(page, options);

            expect(html).toContain('onload="initScorm()"');
            expect(html).toContain('onunload="terminateScorm()"');
        });
    });

    describe('renderNavigation', () => {
        it('should render navigation with root pages', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderNavigation(pages, 'page-1', '');

            expect(html).toContain('<nav id="siteNav">');
            expect(html).toContain('First');
            expect(html).toContain('Second');
        });

        it('should mark current page as active with id and class', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderNavigation(pages, 'page-2', '');

            expect(html).toContain('id="active"');
            expect(html).toContain('class="active"');
        });

        it('should render nested navigation for child pages', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'parent', title: 'Parent' }),
                createTestPage({ id: 'child', title: 'Child', parentId: 'parent' }),
            ];

            const html = renderer.renderNavigation(pages, 'child', '');

            expect(html).toContain('class="other-section"');
            expect(html).toContain('Child');
        });

        it('should add daddy class for pages with children', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'parent', title: 'Parent' }),
                createTestPage({ id: 'child', title: 'Child', parentId: 'parent' }),
            ];

            const html = renderer.renderNavigation(pages, 'parent', '');

            // First page gets main-node class too
            expect(html).toContain('class="active main-node daddy"');
        });
    });

    describe('renderNavButtons', () => {
        it('should render prev/next nav buttons', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
                createTestPage({ id: 'page-3', title: 'Third' }),
            ];

            const html = renderer.renderNavButtons(pages[1], pages, '');

            expect(html).toContain('class="nav-buttons"');
            expect(html).toContain('nav-button-left');
            expect(html).toContain('nav-button-right');
            expect(html).toContain('Previous');
            expect(html).toContain('Next');
        });

        it('should render disabled prev button for first page', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderNavButtons(pages[0], pages, '');

            // First page: disabled prev (span), enabled next (anchor)
            expect(html).toContain('nav-button-left');
            expect(html).toContain('nav-button-right');
            expect(html).toContain('<span class="nav-button nav-button-left"');
            expect(html).toContain('<a href=');
        });

        it('should render disabled next button for last page', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderNavButtons(pages[1], pages, '');

            // Last page: enabled prev (anchor), disabled next (span)
            expect(html).toContain('nav-button-left');
            expect(html).toContain('nav-button-right');
            expect(html).toContain('<span class="nav-button nav-button-right"');
            expect(html).toContain('<a href=');
        });

        it('should render both buttons disabled for single page', () => {
            const pages: ExportPage[] = [createTestPage({ id: 'page-1', title: 'Only' })];

            const html = renderer.renderNavButtons(pages[0], pages, '');

            // Single page: both buttons disabled (spans)
            expect(html).toContain('nav-buttons');
            expect(html).toContain('<span class="nav-button nav-button-left"');
            expect(html).toContain('<span class="nav-button nav-button-right"');
            expect(html).not.toContain('<a href=');
        });
    });

    describe('renderPagination (deprecated)', () => {
        it('should delegate to renderNavButtons', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const paginationHtml = renderer.renderPagination(pages[0], pages, '');
            const navButtonsHtml = renderer.renderNavButtons(pages[0], pages, '');

            expect(paginationHtml).toBe(navButtonsHtml);
        });
    });

    describe('renderPageHeader', () => {
        it('should render page header with counter and titles when addPagination is true', () => {
            const page = createTestPage({ id: 'test-page', title: 'My Page' });

            const html = renderer.renderPageHeader(page, {
                projectTitle: 'My Project',
                currentPageIndex: 2,
                totalPages: 10,
                addPagination: true,
            });

            // Headers wrapped in main-header so theme JS can find and move title
            expect(html).toContain('<header class="main-header">');
            expect(html).toContain('<div class="package-header');
            expect(html).toContain('<div class="page-header"');
            expect(html).toContain('class="page-counter"');
            expect(html).toContain('class="page-counter-current-page">3</strong>'); // 2 + 1
            expect(html).toContain('class="page-counter-total">10</strong>');
            expect(html).toContain('class="package-title">My Project</h1>');
            expect(html).toContain('class="page-title">My Page</h2>');
        });

        it('should NOT render page counter when addPagination is false (default)', () => {
            const page = createTestPage({ id: 'test-page', title: 'My Page' });

            const html = renderer.renderPageHeader(page, {
                projectTitle: 'My Project',
                currentPageIndex: 2,
                totalPages: 10,
            });

            expect(html).toContain('class="page-header"');
            expect(html).not.toContain('class="page-counter"');
        });

        it('should show Página label in Spanish when addPagination is true', () => {
            const page = createTestPage();

            const html = renderer.renderPageHeader(page, {
                projectTitle: 'Test',
                currentPageIndex: 0,
                totalPages: 1,
                addPagination: true,
            });

            expect(html).toContain('Página');
        });
    });

    describe('renderFooterSection', () => {
        it('should render footer with license', () => {
            const html = renderer.renderFooterSection({
                license: 'Creative Commons',
                licenseUrl: 'https://example.com/license',
            });

            expect(html).toContain('<footer id="siteFooter">');
            expect(html).toContain('<div id="siteFooterContent">');
            expect(html).toContain('id="packageLicense"');
            expect(html).toContain('class="license-label">Licencia: </span>');
            expect(html).toContain('class="license">Creative Commons</a>');
            expect(html).toContain('href="https://example.com/license"');
        });

        it('should include user footer content when provided', () => {
            const html = renderer.renderFooterSection({
                license: 'CC',
                userFooterContent: '<p>Custom footer</p>',
            });

            expect(html).toContain('id="siteUserFooter"');
            expect(html).toContain('<p>Custom footer</p>');
        });

        it('should not include siteUserFooter when no custom content', () => {
            const html = renderer.renderFooterSection({
                license: 'CC',
            });

            expect(html).not.toContain('id="siteUserFooter"');
        });
    });

    describe('renderMadeWithEXe', () => {
        it('should render made-with-eXe credit', () => {
            const html = renderer.renderMadeWithEXe();

            expect(html).toContain('id="made-with-eXe"');
            expect(html).toContain('href="https://exelearning.net/"');
            expect(html).toContain('Creado con eXeLearning');
            expect(html).toContain('target="_blank"');
            expect(html).toContain('rel="noopener"');
        });
    });

    describe('renderSinglePage', () => {
        it('should render all pages in a single document', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderSinglePage(pages, { projectTitle: 'Test' });

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('exe-single-page');
            expect(html).toContain('section-page-1');
            expect(html).toContain('section-page-2');
            expect(html).toContain('First');
            expect(html).toContain('Second');
        });

        it('should NOT include navigation tree (single page has siteNav-hidden)', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderSinglePage(pages, {});

            // Single page export should NOT have nav tree, only sections
            expect(html).toContain('siteNav-hidden');
            expect(html).not.toContain('<nav id="siteNav"');
        });

        it('should render all pages as sections (no nested nav)', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'parent', title: 'Parent' }),
                createTestPage({ id: 'child', title: 'Child', parentId: 'parent' }),
            ];

            const html = renderer.renderSinglePage(pages, {});

            // No nav tree with nested structure
            expect(html).not.toContain('class="other-section"');
            // But sections should exist with proper IDs
            expect(html).toContain('id="section-child"');
        });
    });

    describe('sanitizeFilename', () => {
        it('should convert to lowercase', () => {
            expect(renderer.sanitizeFilename('Hello World')).toBe('hello-world');
        });

        it('should replace spaces with dashes', () => {
            expect(renderer.sanitizeFilename('hello world')).toBe('hello-world');
        });

        it('should remove special characters', () => {
            expect(renderer.sanitizeFilename('hello@world!')).toBe('helloworld');
        });

        it('should remove accents', () => {
            expect(renderer.sanitizeFilename('café résumé')).toBe('cafe-resume');
        });

        it('should truncate to 50 characters', () => {
            const longTitle = 'a'.repeat(100);
            expect(renderer.sanitizeFilename(longTitle).length).toBe(50);
        });

        it('should return page for empty string', () => {
            expect(renderer.sanitizeFilename('')).toBe('page');
        });
    });

    describe('getPageLink', () => {
        it('should return index.html for first page', () => {
            const pages = [
                createTestPage({ id: 'first', title: 'First' }),
                createTestPage({ id: 'second', title: 'Second' }),
            ];

            const link = renderer.getPageLink(pages[0], pages, '');

            expect(link).toBe('index.html');
        });

        it('should return html/filename.html for non-first pages', () => {
            const pages = [
                createTestPage({ id: 'first', title: 'First' }),
                createTestPage({ id: 'second', title: 'Second Page' }),
            ];

            const link = renderer.getPageLink(pages[1], pages, '');

            expect(link).toBe('html/second-page.html');
        });

        it('should apply basePath', () => {
            const pages = [createTestPage({ id: 'first', title: 'First' })];

            const link = renderer.getPageLink(pages[0], pages, '../');

            expect(link).toBe('../index.html');
        });
    });

    describe('isAncestorOf', () => {
        it('should return true for direct parent', () => {
            const pages = [
                createTestPage({ id: 'parent', title: 'Parent' }),
                createTestPage({ id: 'child', title: 'Child', parentId: 'parent' }),
            ];

            expect(renderer.isAncestorOf('parent', 'child', pages)).toBe(true);
        });

        it('should return true for grandparent', () => {
            const pages = [
                createTestPage({ id: 'grandparent', title: 'Grandparent' }),
                createTestPage({ id: 'parent', title: 'Parent', parentId: 'grandparent' }),
                createTestPage({ id: 'child', title: 'Child', parentId: 'parent' }),
            ];

            expect(renderer.isAncestorOf('grandparent', 'child', pages)).toBe(true);
        });

        it('should return false for non-ancestors', () => {
            const pages = [
                createTestPage({ id: 'page-1', title: 'Page 1' }),
                createTestPage({ id: 'page-2', title: 'Page 2' }),
            ];

            expect(renderer.isAncestorOf('page-1', 'page-2', pages)).toBe(false);
        });

        it('should return false for same page', () => {
            const pages = [createTestPage({ id: 'page-1', title: 'Page 1' })];

            expect(renderer.isAncestorOf('page-1', 'page-1', pages)).toBe(false);
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(renderer.escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(renderer.escapeHtml('a & b')).toBe('a &amp; b');
        });

        it('should handle empty string', () => {
            expect(renderer.escapeHtml('')).toBe('');
        });
    });

    describe('escapeAttr', () => {
        it('should escape attribute special characters', () => {
            expect(renderer.escapeAttr('<script>')).toBe('&lt;script&gt;');
            expect(renderer.escapeAttr('a & b')).toBe('a &amp; b');
            expect(renderer.escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
        });

        it('should handle empty string', () => {
            expect(renderer.escapeAttr('')).toBe('');
        });

        it('should handle null/undefined gracefully', () => {
            expect(renderer.escapeAttr(null as unknown as string)).toBe('');
            expect(renderer.escapeAttr(undefined as unknown as string)).toBe('');
        });
    });

    describe('renderFooter (deprecated)', () => {
        it('should delegate to renderLicense', () => {
            const html = renderer.renderFooter({
                author: 'Test Author',
                license: 'CC-BY-SA',
            });

            expect(html).toContain('id="packageLicense"');
            expect(html).toContain('CC-BY-SA');
            expect(html).toContain('creativecommons.org/licenses/by-sa/4.0/');
        });
    });

    describe('generateSearchData', () => {
        it('should generate search data JSON for pages', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First Page' }),
                createTestPage({ id: 'page-2', title: 'Second Page' }),
            ];

            const json = renderer.generateSearchData(pages, '');
            const data = JSON.parse(json);

            expect(data['page-1']).toBeDefined();
            expect(data['page-1'].name).toBe('First Page');
            expect(data['page-1'].isIndex).toBe(true);
            expect(data['page-1'].fileName).toBe('index.html');
            expect(data['page-1'].fileUrl).toBe('index.html');
            expect(data['page-1'].prePageId).toBeNull();
            expect(data['page-1'].nextPageId).toBe('page-2');

            expect(data['page-2']).toBeDefined();
            expect(data['page-2'].name).toBe('Second Page');
            expect(data['page-2'].isIndex).toBe(false);
            expect(data['page-2'].fileName).toBe('second-page.html');
            expect(data['page-2'].fileUrl).toBe('html/second-page.html');
            expect(data['page-2'].prePageId).toBe('page-1');
            expect(data['page-2'].nextPageId).toBeNull();
        });

        it('should include block data with idevices', () => {
            const pages: ExportPage[] = [
                createTestPage({
                    id: 'page-1',
                    title: 'Test Page',
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Block One',
                            order: 1,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: '<p>Hello World</p>',
                                    properties: { foo: 'bar' },
                                },
                            ],
                        },
                    ],
                }),
            ];

            const json = renderer.generateSearchData(pages, '');
            const data = JSON.parse(json);

            expect(data['page-1'].blocks['block-1']).toBeDefined();
            expect(data['page-1'].blocks['block-1'].name).toBe('Block One');
            expect(data['page-1'].blocks['block-1'].order).toBe(1);
            expect(data['page-1'].blocks['block-1'].idevices['comp-1']).toBeDefined();
            expect(data['page-1'].blocks['block-1'].idevices['comp-1'].order).toBe(1);
            expect(data['page-1'].blocks['block-1'].idevices['comp-1'].htmlView).toBe('<p>Hello World</p>');
            expect(data['page-1'].blocks['block-1'].idevices['comp-1'].jsonProperties).toBe('{"foo":"bar"}');
        });

        it('should handle pages without blocks', () => {
            const pages: ExportPage[] = [createTestPage({ id: 'page-1', title: 'Empty Page', blocks: [] })];

            const json = renderer.generateSearchData(pages, '');
            const data = JSON.parse(json);

            expect(data['page-1'].blocks).toEqual({});
        });

        it('should handle blocks without components', () => {
            const pages: ExportPage[] = [
                createTestPage({
                    id: 'page-1',
                    title: 'Test',
                    blocks: [
                        {
                            id: 'block-1',
                            name: 'Empty Block',
                            order: 1,
                            components: [],
                        },
                    ],
                }),
            ];

            const json = renderer.generateSearchData(pages, '');
            const data = JSON.parse(json);

            expect(data['page-1'].blocks['block-1'].idevices).toEqual({});
        });

        it('should handle component with missing content and properties', () => {
            const pages: ExportPage[] = [
                createTestPage({
                    id: 'page-1',
                    title: 'Test',
                    blocks: [
                        {
                            id: 'block-1',
                            name: '',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-1',
                                    type: 'text',
                                    order: 0,
                                    content: undefined as unknown as string,
                                    properties: undefined as unknown as Record<string, unknown>,
                                },
                            ],
                        },
                    ],
                }),
            ];

            const json = renderer.generateSearchData(pages, '');
            const data = JSON.parse(json);

            expect(data['page-1'].blocks['block-1'].name).toBe('');
            expect(data['page-1'].blocks['block-1'].order).toBe(1); // defaults to 1 when 0
            expect(data['page-1'].blocks['block-1'].idevices['comp-1'].htmlView).toBe('');
            expect(data['page-1'].blocks['block-1'].idevices['comp-1'].jsonProperties).toBe('{}');
        });
    });

    describe('generateSearchIndexFile', () => {
        it('should generate JavaScript file content with window.exeSearchData', () => {
            const pages: ExportPage[] = [createTestPage({ id: 'page-1', title: 'Test Page' })];

            const content = renderer.generateSearchIndexFile(pages, '');

            expect(content).toStartWith('window.exeSearchData = ');
            expect(content).toContain('"page-1"');
            expect(content).toContain('"Test Page"');
        });

        it('should produce valid JavaScript', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const content = renderer.generateSearchIndexFile(pages, '');

            // Extract JSON part and parse it to verify it's valid
            const jsonPart = content.replace('window.exeSearchData = ', '').replace(/;$/, '');
            const parsed = JSON.parse(jsonPart);

            expect(parsed['page-1']).toBeDefined();
            expect(parsed['page-2']).toBeDefined();
        });
    });

    describe('renderPageContent', () => {
        it('should render blocks with components', () => {
            const page = createTestPage({
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Test Block',
                        order: 0,
                        components: [
                            {
                                id: 'comp-1',
                                type: 'text',
                                order: 0,
                                content: '<p>Hello</p>',
                                properties: {},
                            },
                        ],
                    },
                ],
            });

            const html = renderer.renderPageContent(page, '');

            expect(html).toContain('id="block-1"');
            expect(html).toContain('Test Block');
            expect(html).toContain('<p>Hello</p>');
        });

        it('should handle empty blocks array', () => {
            const page = createTestPage({ blocks: [] });

            const html = renderer.renderPageContent(page, '');

            expect(html).toBe('');
        });
    });

    describe('page visibility', () => {
        it('should always show first page regardless of visibility setting', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First', properties: { visibility: false } }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            expect(renderer.isPageVisible(pages[0], pages)).toBe(true);
        });

        it('should hide page when visibility is false', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second', properties: { visibility: false } }),
            ];

            expect(renderer.isPageVisible(pages[1], pages)).toBe(false);
        });

        it('should hide page when visibility is string "false"', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second', properties: { visibility: 'false' } }),
            ];

            expect(renderer.isPageVisible(pages[1], pages)).toBe(false);
        });

        it('should show page when visibility is not set', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            expect(renderer.isPageVisible(pages[1], pages)).toBe(true);
        });

        it('should hide child page when parent is hidden', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Parent', properties: { visibility: false } }),
                createTestPage({ id: 'page-3', title: 'Child', parentId: 'page-2' }),
            ];

            expect(renderer.isPageVisible(pages[2], pages)).toBe(false);
        });

        it('should not show hidden pages in navigation', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Hidden', properties: { visibility: false } }),
                createTestPage({ id: 'page-3', title: 'Third' }),
            ];

            const html = renderer.renderNavigation(pages, 'page-1', '');

            expect(html).toContain('First');
            expect(html).not.toContain('Hidden');
            expect(html).toContain('Third');
        });

        it('should filter visible pages correctly', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Hidden', properties: { visibility: false } }),
                createTestPage({ id: 'page-3', title: 'Third' }),
            ];

            const visible = renderer.getVisiblePages(pages);

            expect(visible.length).toBe(2);
            expect(visible.map(p => p.id)).toEqual(['page-1', 'page-3']);
        });
    });

    describe('page highlight', () => {
        it('should detect highlighted page with boolean true', () => {
            const page = createTestPage({ properties: { highlight: true } });
            expect(renderer.isPageHighlighted(page)).toBe(true);
        });

        it('should detect highlighted page with string "true"', () => {
            const page = createTestPage({ properties: { highlight: 'true' } });
            expect(renderer.isPageHighlighted(page)).toBe(true);
        });

        it('should not detect highlight when false', () => {
            const page = createTestPage({ properties: { highlight: false } });
            expect(renderer.isPageHighlighted(page)).toBe(false);
        });

        it('should not detect highlight when not set', () => {
            const page = createTestPage();
            expect(renderer.isPageHighlighted(page)).toBe(false);
        });

        it('should add highlighted-link class in navigation for highlighted page', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Important', properties: { highlight: true } }),
            ];

            const html = renderer.renderNavigation(pages, 'page-1', '');

            expect(html).toContain('highlighted-link');
            // The highlighted class should be in the anchor for page-2
            expect(html).toMatch(/Important.*highlighted-link|highlighted-link.*Important/s);
        });

        it('should not add highlighted-link class for non-highlighted page', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Normal' }),
            ];

            const html = renderer.renderNavigation(pages, 'page-1', '');

            expect(html).not.toContain('highlighted-link');
        });
    });

    describe('detectContentLibraries', () => {
        it('should detect exe_highlighter by class pattern', () => {
            const html = '<pre class="highlighted-code language-python">print("hello")</pre>';
            const libs = renderer.detectContentLibraries(html);
            expect(libs).toContain('exe_highlighter');
        });

        it('should detect exe_effects by class pattern', () => {
            const html = '<div class="exe-fx-flip">Content</div>';
            const libs = renderer.detectContentLibraries(html);
            expect(libs).toContain('exe_effects');
        });

        it('should detect exe_lightbox by rel attribute', () => {
            const html = '<a rel="lightbox" href="img.jpg"><img src="thumb.jpg"></a>';
            const libs = renderer.detectContentLibraries(html);
            expect(libs).toContain('exe_lightbox');
        });

        it('should detect multiple libraries in same content', () => {
            const html = `
                <pre class="highlighted-code">code</pre>
                <div class="exe-fx-flip">flip</div>
            `;
            const libs = renderer.detectContentLibraries(html);
            expect(libs).toContain('exe_highlighter');
            expect(libs).toContain('exe_effects');
        });

        it('should return empty array when no libraries detected', () => {
            const html = '<p>Simple text content</p>';
            const libs = renderer.detectContentLibraries(html);
            expect(libs).toEqual([]);
        });

        it('should detect class pattern with multiple classes', () => {
            const html = '<div class="other-class highlighted-code another-class">Code</div>';
            const libs = renderer.detectContentLibraries(html);
            expect(libs).toContain('exe_highlighter');
        });
    });

    describe('renderHead with detected libraries', () => {
        it('should include exe_highlighter scripts when detected', () => {
            const head = renderer.renderHead({
                pageTitle: 'Test',
                basePath: '',
                usedIdevices: [],
                detectedLibraries: ['exe_highlighter'],
            });

            expect(head).toContain('libs/exe_highlighter/exe_highlighter.js');
            expect(head).toContain('libs/exe_highlighter/exe_highlighter.css');
        });

        it('should not duplicate exe_lightbox when detected', () => {
            const head = renderer.renderHead({
                pageTitle: 'Test',
                basePath: '',
                usedIdevices: [],
                detectedLibraries: ['exe_lightbox'],
            });

            // exe_lightbox is already hardcoded, so should only appear once
            const matches = head.match(/exe_lightbox\/exe_lightbox\.js/g) || [];
            expect(matches.length).toBe(1);
        });

        it('should include multiple detected libraries', () => {
            const head = renderer.renderHead({
                pageTitle: 'Test',
                basePath: '',
                usedIdevices: [],
                detectedLibraries: ['exe_highlighter', 'exe_effects'],
            });

            expect(head).toContain('libs/exe_highlighter/exe_highlighter.js');
            expect(head).toContain('libs/exe_effects/exe_effects.js');
        });

        it('should use correct basePath for detected libraries', () => {
            const head = renderer.renderHead({
                pageTitle: 'Test',
                basePath: '../',
                usedIdevices: [],
                detectedLibraries: ['exe_highlighter'],
            });

            expect(head).toContain('../libs/exe_highlighter/exe_highlighter.js');
        });
    });
});
