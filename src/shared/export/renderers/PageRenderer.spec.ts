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
            expect(html).toContain('<title>Test Page | Test Project</title>');
            expect(html).toContain('class="page-title"');
            expect(html).toContain('Test Page</h2>');
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
            expect(html).toContain('theme/style.css');
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

        it('should include footer with author and license', () => {
            const page = createTestPage();
            const options = createDefaultOptions({ allPages: [page] });

            const html = renderer.render(page, options);

            expect(html).toContain('id="packageLicense"');
            expect(html).toContain('Test Author');
            expect(html).toContain('CC-BY-SA');
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

        it('should mark current page as active', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderNavigation(pages, 'page-2', '');

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

            expect(html).toContain('class="active daddy"');
        });
    });

    describe('renderPagination', () => {
        it('should render prev/next links', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
                createTestPage({ id: 'page-3', title: 'Third' }),
            ];

            const html = renderer.renderPagination(pages[1], pages, '');

            expect(html).toContain('class="prev"');
            expect(html).toContain('class="next"');
            expect(html).toContain('First');
            expect(html).toContain('Third');
        });

        it('should not render prev for first page', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderPagination(pages[0], pages, '');

            expect(html).not.toContain('class="prev"');
            expect(html).toContain('class="next"');
        });

        it('should not render next for last page', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderPagination(pages[1], pages, '');

            expect(html).toContain('class="prev"');
            expect(html).not.toContain('class="next"');
        });

        it('should return empty for single page', () => {
            const pages: ExportPage[] = [createTestPage({ id: 'page-1', title: 'Only' })];

            const html = renderer.renderPagination(pages[0], pages, '');

            expect(html).toBe('');
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

        it('should use anchor links for navigation', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'page-1', title: 'First' }),
                createTestPage({ id: 'page-2', title: 'Second' }),
            ];

            const html = renderer.renderSinglePage(pages, {});

            expect(html).toContain('href="#section-page-1"');
            expect(html).toContain('href="#section-page-2"');
        });

        it('should render nested navigation for child pages', () => {
            const pages: ExportPage[] = [
                createTestPage({ id: 'parent', title: 'Parent' }),
                createTestPage({ id: 'child', title: 'Child', parentId: 'parent' }),
            ];

            const html = renderer.renderSinglePage(pages, {});

            expect(html).toContain('class="other-section"');
            expect(html).toContain('#section-child');
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
});
