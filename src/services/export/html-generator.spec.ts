/**
 * Tests for HTML Generator Helper
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { generatePageHtml, generateIndexHtml } from './html-generator';
import type { ParsedOdeStructure, NormalizedPage, NormalizedComponent } from '../xml/interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../idevice-config';

// Path to real iDevices for integration testing
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

// Load real iDevice configs before all tests
beforeAll(() => {
    if (fs.existsSync(REAL_IDEVICES_PATH)) {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    }
});

afterAll(() => {
    resetIdeviceConfigCache();
});

// Helper to create a minimal valid structure
function createMinimalStructure(overrides: Partial<ParsedOdeStructure> = {}): ParsedOdeStructure {
    return {
        meta: {
            title: 'Test Project',
            description: '',
            author: '',
            language: 'en',
            exelearning_version: '3.0',
            id: 'test-ode',
        },
        pages: [],
        ...overrides,
    };
}

// Helper to create a minimal page
function createPage(overrides: Partial<NormalizedPage> = {}): NormalizedPage {
    return {
        id: 'page-1',
        title: 'Test Page',
        parent_id: null,
        order: 0,
        components: [],
        ...overrides,
    };
}

// Helper to create a component
function createComponent(overrides: Partial<NormalizedComponent> = {}): NormalizedComponent {
    return {
        id: 'comp-1',
        type: 'text',
        content: '<p>Test content</p>',
        order: 0,
        blockName: null,
        properties: {},
        ...overrides,
    };
}

describe('HTML Generator Helper', () => {
    describe('generatePageHtml', () => {
        it('should generate valid HTML5 document structure', () => {
            const page = createPage({ title: 'My Page' });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html lang="en"');
            expect(html).toContain('<head>');
            expect(html).toContain('</head>');
            expect(html).toContain('<body');
            expect(html).toContain('</body>');
            expect(html).toContain('</html>');
        });

        it('should use structure language', () => {
            const page = createPage();
            const structure = createMinimalStructure({
                pages: [page],
                meta: { ...createMinimalStructure().meta, language: 'es' },
            });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('<html lang="es"');
        });

        it('should include project title in header', () => {
            const page = createPage({ title: 'My Custom Page' });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            // New format uses project title in <title> for index page
            expect(html).toContain('<title>Test Project</title>');
        });

        it('should escape HTML in title', () => {
            const page = createPage({ title: '<script>alert("xss")</script>' });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).not.toContain('<script>alert("xss")</script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('should have exe-export exe-web-site classes on body', () => {
            const page = createPage();
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, { preview: true });

            // New legacy-compatible format uses exe-export exe-web-site
            expect(html).toContain('exe-export');
            expect(html).toContain('exe-web-site');
        });

        it('should include exe-client-search div', () => {
            const page = createPage();
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            // New format uses exe-client-search with data-pages
            expect(html).toContain('exe-client-search');
        });

        it('should use resources prefix for CSS/JS paths', () => {
            const page = createPage();
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {}, '/custom/path/');

            // New format uses libs/ and content/css/ paths
            expect(html).toContain('href="/custom/path/content/css/base.css"');
            expect(html).toContain('src="/custom/path/libs/jquery/jquery.min.js"');
        });

        it('should render components in page content', () => {
            const component = createComponent({
                id: 'text-1',
                type: 'text',
                content: '<p>Hello World</p>',
            });
            const page = createPage({ components: [component] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('Hello World');
            expect(html).toContain('id="text-1"');
        });

        it('should group components by block', () => {
            const comp1 = createComponent({ id: 'c1', blockName: 'Block A', order: 0 });
            const comp2 = createComponent({ id: 'c2', blockName: 'Block A', order: 1 });
            const comp3 = createComponent({ id: 'c3', blockName: 'Block B', order: 2 });
            const page = createPage({ components: [comp1, comp2, comp3] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('Block A');
            expect(html).toContain('Block B');
            expect(html).toContain('class="box"');
        });

        it('should add no-header class for blocks without name', () => {
            const comp = createComponent({ id: 'c1', blockName: null });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('no-header');
        });

        it('should handle empty components array', () => {
            const page = createPage({ components: [] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            // New format uses <main> with page class
            expect(html).toContain('<main');
            expect(html).toContain('class="page"');
        });

        it('should generate navigation with multiple pages', () => {
            const page1 = createPage({ id: 'page-1', title: 'Home', order: 0 });
            const page2 = createPage({ id: 'page-2', title: 'About', order: 1 });
            const structure = createMinimalStructure({ pages: [page1, page2] });

            const html = generatePageHtml(page1, structure, {});

            expect(html).toContain('href="index.html"');
            // New format uses html/ directory for non-index pages
            expect(html).toContain('href="html/about.html"');
            expect(html).toContain('Home');
            expect(html).toContain('About');
        });

        it('should mark current page as active in navigation', () => {
            const page1 = createPage({ id: 'page-1', title: 'Home' });
            const page2 = createPage({ id: 'page-2', title: 'About' });
            const structure = createMinimalStructure({ pages: [page1, page2] });

            const html = generatePageHtml(page2, structure, {});

            expect(html).toContain('class="active"');
        });

        it('should generate nested navigation for child pages', () => {
            const parent = createPage({ id: 'parent', title: 'Parent' });
            const child = createPage({ id: 'child', title: 'Child', parent_id: 'parent' });
            const structure = createMinimalStructure({ pages: [parent, child] });

            const html = generatePageHtml(parent, structure, {});

            // Child should be in a nested ul
            expect(html).toContain('<ul>');
            expect(html).toContain('Child');
        });

        it('should generate nav buttons with language-based text', () => {
            const page1 = createPage({ id: 'page-1', title: 'First' });
            const page2 = createPage({ id: 'page-2', title: 'Second' });
            const page3 = createPage({ id: 'page-3', title: 'Third' });
            // Default language is 'en'
            const structure = createMinimalStructure({ pages: [page1, page2, page3] });

            const html = generatePageHtml(page2, structure, {});

            expect(html).toContain('class="nav-buttons"');
            expect(html).toContain('nav-button-left');
            expect(html).toContain('nav-button-right');
            expect(html).toContain('Previous');
            expect(html).toContain('Next');
        });

        it('should translate nav buttons to Spanish when language is es', () => {
            const page1 = createPage({ id: 'page-1', title: 'First' });
            const page2 = createPage({ id: 'page-2', title: 'Second' });
            const page3 = createPage({ id: 'page-3', title: 'Third' });
            const structure = createMinimalStructure({
                pages: [page1, page2, page3],
                meta: { ...createMinimalStructure().meta, language: 'es' },
            });

            const html = generatePageHtml(page2, structure, {});

            expect(html).toContain('Anterior');
            expect(html).toContain('Siguiente');
        });

        it('should not show prev button on first page', () => {
            const page1 = createPage({ id: 'page-1', title: 'First' });
            const page2 = createPage({ id: 'page-2', title: 'Second' });
            const structure = createMinimalStructure({ pages: [page1, page2] });

            const html = generatePageHtml(page1, structure, {});

            expect(html).not.toContain('nav-button-left');
            expect(html).toContain('nav-button-right');
        });

        it('should not show next button on last page', () => {
            const page1 = createPage({ id: 'page-1', title: 'First' });
            const page2 = createPage({ id: 'page-2', title: 'Second' });
            const structure = createMinimalStructure({ pages: [page1, page2] });

            const html = generatePageHtml(page2, structure, {});

            expect(html).toContain('nav-button-left');
            expect(html).not.toContain('nav-button-right');
        });

        it('should include page header with page counter when addPagination is true', () => {
            const page1 = createPage({ id: 'page-1', title: 'First' });
            const page2 = createPage({ id: 'page-2', title: 'Second' });
            const structure = createMinimalStructure({
                pages: [page1, page2],
                meta: {
                    title: 'Test Project',
                    description: '',
                    author: '',
                    language: 'en',
                    exelearning_version: '3.0',
                    id: 'test-ode',
                    addPagination: true,
                },
            });

            const html = generatePageHtml(page2, structure, {});

            expect(html).toContain('class="page-header"');
            expect(html).toContain('class="page-counter"');
            expect(html).toContain('class="page-counter-current-page">2</strong>');
            expect(html).toContain('class="page-counter-total">2</strong>');
            expect(html).toContain('class="package-title"');
            expect(html).toContain('class="page-title"');
        });

        it('should NOT include page counter when addPagination is false (default)', () => {
            const page1 = createPage({ id: 'page-1', title: 'First' });
            const page2 = createPage({ id: 'page-2', title: 'Second' });
            const structure = createMinimalStructure({ pages: [page1, page2] });

            const html = generatePageHtml(page2, structure, {});

            expect(html).toContain('class="page-header"');
            expect(html).not.toContain('class="page-counter"');
        });

        it('should include page content wrapper', () => {
            const page = createPage({ id: 'my-page' });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('class="page-content"');
            expect(html).toContain('id="page-content-my-page"');
        });

        it('should include footer section with license', () => {
            const page = createPage();
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('<footer id="siteFooter">');
            expect(html).toContain('id="siteFooterContent"');
            expect(html).toContain('id="packageLicense"');
            expect(html).toContain('class="license-label">Licencia: </span>');
        });

        it('should generate correct CSS class for different licenses', () => {
            const licenses = [
                { name: 'creative commons: attribution 4.0', class: 'cc' },
                { name: 'creative commons: attribution - share alike 4.0', class: 'cc cc-by-sa' },
                { name: 'creative commons: attribution - non derived work 4.0', class: 'cc cc-by-nd' },
                { name: 'creative commons: attribution - non commercial 4.0', class: 'cc cc-by-nc' },
                { name: 'creative commons: attribution - non commercial - share alike 4.0', class: 'cc cc-by-nc-sa' },
                {
                    name: 'creative commons: attribution - non derived work - non commercial 4.0',
                    class: 'cc cc-by-nc-nd',
                },
                { name: 'public domain', class: 'cc cc-0' },
                { name: 'propietary license', class: 'propietary' },
            ];

            for (const lic of licenses) {
                const page = createPage();
                const structure = createMinimalStructure({
                    pages: [page],
                    meta: { ...createMinimalStructure().meta, license: lic.name },
                });
                const html = generatePageHtml(page, structure, {});
                expect(html).toContain(`class="${lic.class}"`);
            }
        });

        it('should include made-with-eXe credit', () => {
            const page = createPage();
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('id="made-with-eXe"');
            expect(html).toContain('exelearning.net');
        });

        it('should add idevice-specific data attributes', () => {
            const comp = createComponent({
                id: 'quiz-1',
                type: 'QuizActivity',
                properties: { questions: [{ text: 'Q1' }] },
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('data-idevice-type="QuizActivity"');
            expect(html).toContain('data-idevice-path="idevices/QuizActivity/"');
        });

        it('should add visibility classes for hidden components', () => {
            const comp = createComponent({
                properties: { visibility: 'false' },
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('novisible');
        });

        it('should add teacher-only class', () => {
            const comp = createComponent({
                properties: { teacherOnly: 'true' },
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('teacher-only');
        });

        it('should add custom CSS class from properties', () => {
            const comp = createComponent({
                properties: { cssClass: 'my-custom-class' },
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('my-custom-class');
        });

        it('should wrap text idevice content in exe-text div', () => {
            const comp = createComponent({
                type: 'text',
                content: '<p>Some text</p>',
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('<div class="exe-text">');
        });

        it('should fix asset:// protocol URLs in rendered content', () => {
            const comp = createComponent({
                content: '<img src="asset://image.png">',
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            // Asset URLs are fixed in the rendered iDevice content
            expect(html).toContain('content/resources/image.png');
            // Note: asset:// may still appear in the exe-client-search JSON (source data)
            // The important check is that rendered content has the fixed path
        });

        it('should escape attributes properly', () => {
            const comp = createComponent({
                id: 'test"id',
                properties: { data: '{"key":"value"}' },
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('id="test&quot;id"');
        });
    });

    describe('generateIndexHtml', () => {
        it('should generate HTML for first page', () => {
            const page1 = createPage({ id: 'intro', title: 'Introduction' });
            const page2 = createPage({ id: 'chapter-1', title: 'Chapter 1' });
            const structure = createMinimalStructure({ pages: [page1, page2] });

            const html = generateIndexHtml(structure, {});

            expect(html).toContain('Introduction');
            expect(html).toContain('<html');
        });

        it('should return empty string if no pages', () => {
            const structure = createMinimalStructure({ pages: [] });

            const html = generateIndexHtml(structure, {});

            expect(html).toBe('');
        });

        it('should pass options to generatePageHtml', () => {
            const page = createPage();
            const structure = createMinimalStructure({ pages: [page] });

            const html = generateIndexHtml(structure, { preview: true });

            // Uses exe-export class in legacy-compatible format
            expect(html).toContain('exe-export');
        });

        it('should pass resources prefix', () => {
            const page = createPage();
            const structure = createMinimalStructure({ pages: [page] });

            const html = generateIndexHtml(structure, {}, '/assets/');

            // New format uses content/css/base.css path
            expect(html).toContain('/assets/content/css/base.css');
        });
    });

    describe('iDevice rendering', () => {
        it('should render known iDevice types with correct CSS class', () => {
            // Use iDevice types that exist in config.xml
            const ideviceTypes = [
                { type: 'text', cssClass: 'text' },
                { type: 'form', cssClass: 'form' },
                { type: 'trueorfalse', cssClass: 'trueorfalse' },
                { type: 'crossword', cssClass: 'crossword' },
            ];

            for (const { type, cssClass } of ideviceTypes) {
                const comp = createComponent({ type });
                const page = createPage({ components: [comp] });
                const structure = createMinimalStructure({ pages: [page] });

                const html = generatePageHtml(page, structure, {});

                expect(html).toContain(`class="idevice_node ${cssClass}`);
            }
        });

        it('should handle unknown iDevice types gracefully', () => {
            const comp = createComponent({ type: 'CustomUnknownIdevice' });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('data-idevice-type="CustomUnknownIdevice"');
            expect(html).toContain('customunknown'); // lowercase without 'idevice'
        });

        it('should add db-no-data class for empty content', () => {
            const comp = createComponent({ content: '' });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('db-no-data');
        });

        it('should serialize JSON properties for non-text iDevices', () => {
            // Use 'form' which is a real JSON iDevice type from config.xml
            const comp = createComponent({
                type: 'form',
                properties: { questions: [{ id: 1, text: 'What is 2+2?' }] },
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('data-idevice-json-data=');
            expect(html).toContain('data-idevice-template=');
        });
    });

    describe('HTML escaping', () => {
        it('should escape special characters in page title', () => {
            const page = createPage({ title: 'Test & Demo <1>' });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('Test &amp; Demo &lt;1&gt;');
        });

        it('should escape special characters in block name', () => {
            const comp = createComponent({ blockName: 'Block "A" & <B>' });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('Block &quot;A&quot; &amp; &lt;B&gt;');
        });

        it('should escape attributes with special characters', () => {
            const comp = createComponent({
                id: 'id-with-"quotes"-and-<brackets>',
            });
            const page = createPage({ components: [comp] });
            const structure = createMinimalStructure({ pages: [page] });

            const html = generatePageHtml(page, structure, {});

            expect(html).toContain('&quot;');
            expect(html).toContain('&lt;');
            expect(html).toContain('&gt;');
        });
    });
});
