/**
 * PageExporter tests (Single Page HTML export)
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PageExporter } from './PageExporter';
import { zipSync, unzipSync, strToU8 } from 'fflate';
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
            title: 'Test Project',
            author: 'Test Author',
            language: 'en',
            description: 'A test project',
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
        // PageExporter uses original names (style.css, style.js)
        files.set('style.css', Buffer.from('/* theme css */'));
        files.set('style.js', Buffer.from('// theme js'));
        return files;
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('jquery/jquery.min.js', Buffer.from('// jquery'));
        return files;
    }

    async fetchLibraryFiles(_files: string[]): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchScormFiles(_version: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    normalizeIdeviceType(ideviceType: string): string {
        return ideviceType.toLowerCase().replace(/idevice$/i, '');
    }

    async fetchExeLogo(): Promise<Buffer | null> {
        return null;
    }

    async fetchGlobalFontFiles(_font: string): Promise<Map<string, Buffer> | null> {
        return null;
    }

    async fetchContentCss(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('content/css/base.css', Buffer.from('/* base css */'));
        return files;
    }

    async fetchI18nFile(_language: string): Promise<string> {
        return '';
    }

    async fetchI18nTranslations(_language: string): Promise<Map<string, string>> {
        return new Map();
    }
}

// Mock asset provider
class MockAssetProvider implements AssetProvider {
    async getAsset(
        _path: string,
    ): Promise<{ id: string; filename: string; originalPath: string; mime: string; data: Buffer } | null> {
        return null;
    }

    async getAllAssets(): Promise<
        Array<{
            id: string;
            filename: string;
            originalPath: string;
            mime: string;
            data: Buffer;
        }>
    > {
        return [];
    }

    async getProjectAssets(): Promise<any[]> {
        return [];
    }
}

// Mock zip provider
class MockZipProvider implements ZipProvider {
    files = new Map<string, string | Buffer>();

    addFile(path: string, content: string | Buffer): void {
        this.files.set(path, content);
    }

    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    getFilePaths(): string[] {
        return Array.from(this.files.keys());
    }

    async generateAsync(): Promise<Buffer> {
        // Create actual ZIP using fflate
        const zipData: Record<string, Uint8Array> = {};
        for (const [path, content] of this.files) {
            if (typeof content === 'string') {
                zipData[path] = strToU8(content);
            } else {
                zipData[path] = new Uint8Array(content);
            }
        }
        const zipped = zipSync(zipData);
        return Buffer.from(zipped);
    }

    createZip(): any {
        return this;
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
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Welcome to the course.</p>',
                        properties: {},
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
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-2',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>This is chapter 1.</p>',
                        properties: {},
                    },
                ],
            },
        ],
    },
    {
        id: 'page-3',
        title: 'Chapter 2',
        parentId: null,
        order: 2,
        blocks: [
            {
                id: 'block-3',
                name: 'Content',
                order: 0,
                components: [
                    {
                        id: 'comp-3',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>This is chapter 2.</p>',
                        properties: {},
                    },
                ],
            },
        ],
    },
];

describe('PageExporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: PageExporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new PageExporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('_page');
        });

        it('should return .zip extension (inherited)', () => {
            expect(exporter.getFileExtension()).toBe('.zip');
        });
    });

    describe('Export Process', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should generate only index.html (single page)', async () => {
            await exporter.export();

            // Should have index.html
            expect(zip.files.has('index.html')).toBe(true);

            // Should NOT have separate HTML files in html/ directory
            const htmlDirFiles = Array.from(zip.files.keys()).filter(f => f.startsWith('html/'));
            expect(htmlDirFiles.length).toBe(0);
        });

        it('should include all page content in single HTML', async () => {
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;

            // All page content should be in the single file
            expect(indexHtml).toContain('Welcome to the course');
            expect(indexHtml).toContain('chapter 1');
            expect(indexHtml).toContain('chapter 2');
        });

        it('should include content.xml by default (exportSource not disabled)', async () => {
            await exporter.export();

            expect(zip.files.has('content.xml')).toBe(true);
            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<?xml');
            expect(contentXml).toContain('<ode');
        });

        it('should NOT include content.xml when exportSource is false', async () => {
            document = new MockDocument({ exportSource: false }, samplePages);
            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            expect(zip.files.has('content.xml')).toBe(false);
        });

        it('should include exe_powered_logo.png when logo is available', async () => {
            resources.fetchExeLogo = async () => Buffer.from('fake-logo-data');
            await exporter.export();

            expect(zip.files.has('content/img/exe_powered_logo.png')).toBe(true);
        });

        it('should NOT include exe_powered_logo.png when addExeLink is false', async () => {
            document = new MockDocument({ addExeLink: false }, samplePages);
            resources.fetchExeLogo = async () => Buffer.from('fake-logo-data');
            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            expect(zip.files.has('content/img/exe_powered_logo.png')).toBe(false);
        });

        it('should NOT include made-with-eXe link in HTML when addExeLink is false', async () => {
            document = new MockDocument({ addExeLink: false }, samplePages);
            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).not.toContain('made-with-eXe');
        });

        it('should include made-with-eXe link in HTML when addExeLink is true (default)', async () => {
            document = new MockDocument({}, samplePages);
            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('made-with-eXe');
        });

        it('should handle logo fetch failure gracefully', async () => {
            resources.fetchExeLogo = async () => {
                throw new Error('Logo not found');
            };

            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(zip.files.has('content/img/exe_powered_logo.png')).toBe(false);
        });

        it('should include base CSS', async () => {
            await exporter.export();

            expect(zip.files.has('content/css/base.css')).toBe(true);
        });

        it('should include single-page CSS', async () => {
            await exporter.export();

            expect(zip.files.has('content/css/single-page.css')).toBe(true);
        });
    });

    describe('Single Page HTML Generation', () => {
        it('should generate single page HTML with all pages', () => {
            const usedIdevices = ['FreeTextIdevice'];
            const html = exporter.generateSinglePageHtml(samplePages, document.getMetadata(), usedIdevices);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Introduction');
            expect(html).toContain('Chapter 1');
            expect(html).toContain('Chapter 2');
        });

        it('should include project title', () => {
            const html = exporter.generateSinglePageHtml(samplePages, document.getMetadata(), []);

            expect(html).toContain('Test Project');
        });

        it('should include exe-single-page class', () => {
            const html = exporter.generateSinglePageHtml(samplePages, document.getMetadata(), []);

            expect(html).toContain('exe-single-page');
        });
    });

    describe('Single Page CSS', () => {
        it('should provide single page specific CSS', () => {
            const css = exporter.getSinglePageCss();

            expect(css).toContain('.exe-single-page');
            expect(css).toContain('single-page-section');
            expect(css).toContain('scroll-behavior: smooth');
        });

        it('should include print styles', () => {
            const css = exporter.getSinglePageCss();

            expect(css).toContain('@media print');
        });

        it('should include scroll margin for anchor navigation', () => {
            const css = exporter.getSinglePageCss();

            expect(css).toContain('scroll-margin-top');
        });
    });

    describe('ZIP Validation', () => {
        it('should produce valid ZIP file', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            const loadedZip = unzipSync(result.data as Uint8Array);
            expect(Object.keys(loadedZip).length).toBeGreaterThan(0);
        });

        it('should have single index.html with all content', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(result.data as Uint8Array);

            // Only one HTML file should exist
            const htmlFiles = Object.keys(loadedZip).filter(f => f.endsWith('.html'));
            expect(htmlFiles).toEqual(['index.html']);
        });
    });

    describe('Filename Generation', () => {
        it('should build filename with _page suffix', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('_page');
        });

        it('should use custom filename when provided', async () => {
            const result = await exporter.export({ filename: 'custom-single-page.zip' });

            expect(result.filename).toBe('custom-single-page.zip');
        });
    });

    describe('Error Handling', () => {
        it('should handle empty pages array', async () => {
            document = new MockDocument({}, []);
            exporter = new PageExporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should handle theme fetch failure', async () => {
            resources.fetchTheme = async () => {
                throw new Error('Theme not found');
            };

            const result = await exporter.export();

            // Should succeed with fallback
            expect(result.success).toBe(true);
        });
    });

    describe('Internal Link Handling (Single Page)', () => {
        it('should build page URL map with anchor fragments', () => {
            const pages = [
                { id: 'page-1', title: 'Home', blocks: [] },
                { id: 'page-2', title: 'About', blocks: [] },
                { id: 'page-3', title: 'Contact', blocks: [] },
            ];
            const map = (exporter as any).buildPageUrlMap(pages);

            // All pages should use anchor fragments for single-page export
            // Uses section-{id} to match IDs from renderSinglePageSection
            expect(map.get('page-1')).toEqual({
                url: '#section-page-1',
                urlFromSubpage: '#section-page-1',
            });
            expect(map.get('page-2')).toEqual({
                url: '#section-page-2',
                urlFromSubpage: '#section-page-2',
            });
            expect(map.get('page-3')).toEqual({
                url: '#section-page-3',
                urlFromSubpage: '#section-page-3',
            });
        });

        it('should convert exe-node links to anchor fragments', () => {
            const pageUrlMap = new Map([
                ['page-1', { url: '#section-page-1', urlFromSubpage: '#section-page-1' }],
                ['page-2', { url: '#section-page-2', urlFromSubpage: '#section-page-2' }],
            ]);

            const content = '<a href="exe-node:page-2">Go to About</a>';
            const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);

            expect(result).toBe('<a href="#section-page-2">Go to About</a>');
        });

        it('should use same anchor format regardless of page position', () => {
            const pageUrlMap = new Map([['page-1', { url: '#section-page-1', urlFromSubpage: '#section-page-1' }]]);

            // From first page
            const result1 = (exporter as any).replaceInternalLinks(
                '<a href="exe-node:page-1">Link</a>',
                pageUrlMap,
                true,
            );
            // From other page (doesn't matter for single page)
            const result2 = (exporter as any).replaceInternalLinks(
                '<a href="exe-node:page-1">Link</a>',
                pageUrlMap,
                false,
            );

            // Both should produce the same anchor link
            expect(result1).toBe('<a href="#section-page-1">Link</a>');
            expect(result2).toBe('<a href="#section-page-1">Link</a>');
        });

        it('should namespace anchor fragment with page id when exe-node link has an anchor', () => {
            const pageUrlMap = new Map([['page-2', { url: '#section-page-2', urlFromSubpage: '#section-page-2' }]]);

            // exe-node:pageId#anchor → #pageId--anchor (namespaced to avoid collisions)
            const content = '<a href="exe-node:page-2#section1">Jump to section</a>';
            const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);

            expect(result).toBe('<a href="#page-2--section1">Jump to section</a>');
        });

        it('should namespace anchor regardless of isFromIndex when anchor is present', () => {
            const pageUrlMap = new Map([['page-1', { url: '#section-page-1', urlFromSubpage: '#section-page-1' }]]);

            const content = '<a href="exe-node:page-1#intro">Go to Intro</a>';
            const resultFromIndex = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);
            const resultFromSubpage = (exporter as any).replaceInternalLinks(content, pageUrlMap, false);

            expect(resultFromIndex).toBe('<a href="#page-1--intro">Go to Intro</a>');
            expect(resultFromSubpage).toBe('<a href="#page-1--intro">Go to Intro</a>');
        });

        it('should not mangle content without exe-node links', () => {
            const pageUrlMap = new Map([['page-1', { url: '#section-page-1', urlFromSubpage: '#section-page-1' }]]);
            const content = '<a href="https://example.com">External</a>';
            const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);
            expect(result).toBe('<a href="https://example.com">External</a>');
        });

        it('should leave unknown exe-node links unchanged', () => {
            const pageUrlMap = new Map<string, { url: string; urlFromSubpage: string }>();
            const content = '<a href="exe-node:unknown-page">Link</a>';
            const result = (exporter as any).replaceInternalLinks(content, pageUrlMap, true);
            expect(result).toBe('<a href="exe-node:unknown-page">Link</a>');
        });

        it('should generate sections with section-{id} IDs in single-page HTML', () => {
            const html = exporter.generateSinglePageHtml(samplePages, document.getMetadata(), []);

            expect(html).toContain('id="section-page-1"');
            expect(html).toContain('id="section-page-2"');
            expect(html).toContain('id="section-page-3"');
        });

        it('should resolve exe-node links in exported single-page HTML content', async () => {
            const pagesWithLink: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Home',
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
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p><a href="exe-node:page-2">Go to page 2</a></p>',
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
                            name: 'Content',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-2',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p><a id="myanchor">Anchor</a> content here</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithLink);
            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // exe-node:page-2 should become #section-page-2
            expect(indexHtml).toContain('href="#section-page-2"');
            // Should NOT contain the raw exe-node: reference
            expect(indexHtml).not.toContain('href="exe-node:page-2"');
        });

        it('should resolve exe-node:pageId#anchor links with namespaced anchors in exported HTML', async () => {
            const pagesWithAnchorLink: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Home',
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
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p><a href="exe-node:page-2#myanchor">Jump to anchor</a></p>',
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
                            name: 'Content',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-2',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p><a id="myanchor">Anchor</a> content here</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithAnchorLink);
            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // Link: exe-node:page-2#myanchor → #page-2--myanchor (namespaced)
            expect(indexHtml).toContain('href="#page-2--myanchor"');
            // Named anchor: id="myanchor" on page-2 → id="page-2--myanchor"
            expect(indexHtml).toContain('id="page-2--myanchor"');
            // Should NOT contain raw exe-node: or un-namespaced anchor
            expect(indexHtml).not.toContain('href="exe-node:page-2#myanchor"');
        });
    });

    describe('namespaceSinglePageAnchors', () => {
        it('should prefix id on named anchors (a without href)', () => {
            const content = '<p><a id="intro">Introduction</a></p>';
            const result = (exporter as any).namespaceSinglePageAnchors(content, 'page-2');
            expect(result).toBe('<p><a id="page-2--intro">Introduction</a></p>');
        });

        it('should prefix name on named anchors', () => {
            const content = '<p><a name="section1">Section 1</a></p>';
            const result = (exporter as any).namespaceSinglePageAnchors(content, 'page-2');
            expect(result).toBe('<p><a name="page-2--section1">Section 1</a></p>');
        });

        it('should NOT modify anchors that have href (regular links)', () => {
            const content = '<a href="https://example.com" id="link1">External</a>';
            const result = (exporter as any).namespaceSinglePageAnchors(content, 'page-2');
            expect(result).toBe('<a href="https://example.com" id="link1">External</a>');
        });

        it('should NOT modify non-anchor elements with id', () => {
            const content = '<div id="mydiv">Content</div>';
            const result = (exporter as any).namespaceSinglePageAnchors(content, 'page-2');
            expect(result).toBe('<div id="mydiv">Content</div>');
        });

        it('should handle empty/null content', () => {
            expect((exporter as any).namespaceSinglePageAnchors('', 'page-1')).toBe('');
            expect((exporter as any).namespaceSinglePageAnchors(null, 'page-1')).toBe(null);
        });

        it('should handle content without any anchors', () => {
            const content = '<p>Just text</p>';
            const result = (exporter as any).namespaceSinglePageAnchors(content, 'page-1');
            expect(result).toBe('<p>Just text</p>');
        });
    });

    describe('Duplicate anchors across pages', () => {
        it('should namespace duplicate anchor ids so links resolve to the correct page', async () => {
            const pagesWithDuplicateAnchors: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Home',
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
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content:
                                        '<p><a id="intro">Page 1 intro</a></p>' +
                                        '<p><a href="exe-node:page-2#intro">Go to Page 2 intro</a></p>',
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
                            name: 'Content',
                            order: 0,
                            components: [
                                {
                                    id: 'comp-2',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p><a id="intro">Page 2 intro</a></p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithDuplicateAnchors);
            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // Page 1's anchor should be namespaced
            expect(indexHtml).toContain('id="page-1--intro"');
            // Page 2's anchor should be namespaced
            expect(indexHtml).toContain('id="page-2--intro"');
            // Link should point to the correct namespaced anchor
            expect(indexHtml).toContain('href="#page-2--intro"');
            // No un-namespaced "intro" anchors should remain
            expect(indexHtml).not.toContain('id="intro"');
        });
    });

    describe('Library Detection', () => {
        it('should detect and include required libraries (MathJax, Tooltips)', async () => {
            // Setup page with content that requires libraries
            const pagesWithLibs: ExportPage[] = [
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
                                    type: 'Text',
                                    order: 0,
                                    // Contains MathJax (\(...\)) and Tooltip class
                                    content: '<p>Math: \\( x^2 \\)</p><p class="exe-tooltip">Tooltip</p>',
                                    properties: {},
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({ addMathJax: true }, pagesWithLibs);

            // Mock resource provider to return library files
            resources.fetchLibraryFiles = async (files: string[]) => {
                const map = new Map<string, Buffer>();
                for (const file of files) {
                    map.set(file, Buffer.from(`// content of ${file}`));
                }
                return map;
            };

            exporter = new PageExporter(document, resources, assets, zip);
            await exporter.export();

            // Should check for library files in the zip
            // We expect the library detector to find these and the exporter to add them

            // Check for MathJax file (just one representative file)
            const hasMathJax = Array.from(zip.files.keys()).some(f => f.includes('exe_math'));
            expect(hasMathJax).toBe(true);

            // Check for Tooltips file
            const hasTooltips = Array.from(zip.files.keys()).some(f => f.includes('exe_tooltips'));
            expect(hasTooltips).toBe(true);

            // Check that index.html contains the script tags and has correct ID for common.js
            const fileContent = zip.files.get('index.html');
            const indexHtml =
                typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent as Uint8Array);

            expect(indexHtml).toContain('id="exe-index"');
            expect(indexHtml).toContain('libs/exe_math/tex-mml-svg.js');
            expect(indexHtml).toContain('libs/exe_tooltips/exe_tooltips.js');
        });
    });
});
