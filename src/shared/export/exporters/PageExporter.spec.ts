/**
 * PageExporter tests (Single Page HTML export)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../../services/idevice-config';
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
        const files = new Map<string, Buffer>();
        if (_files.includes('material-icons/material-icons.svg')) {
            files.set(
                'material-icons/material-icons.svg',
                Buffer.from(
                    [
                        '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
                        '<symbol id="lightbulb" viewBox="0 -960 960 960"><path d="M0Z"/></symbol>',
                        '<symbol id="alarm" viewBox="0 -960 960 960"><path d="M1Z"/></symbol>',
                        '<symbol id="filter_5" viewBox="0 -960 960 960"><path d="M2Z"/></symbol>',
                        '<symbol id="help" viewBox="0 -960 960 960"><path d="M3Z"/></symbol>',
                        '</svg>',
                    ].join('\n'),
                ),
            );
        }
        return files;
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

    // Every JSON iDevice that carries LaTeX now pre-renders it to SVG, so the only
    // remaining trigger for bundling MathJax is the author explicitly requesting it
    // (addMathJax: true). A form with raw LaTeX keeps its delimiters in that case.
    const mathJaxRequestedPages = (): ExportPage[] => [
        {
            id: 'page-explicit-mathjax',
            title: 'Explicit MathJax',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-explicit-mathjax',
                    name: 'Content',
                    order: 0,
                    components: [
                        {
                            id: 'comp-explicit-mathjax',
                            type: 'form',
                            order: 0,
                            content: '',
                            properties: { questionsGame: [{ question: 'Solve \\(x^2 = 1\\)' }] },
                        },
                    ],
                },
            ],
        },
    ];

    // adaptative-quiz keeps pre-rendered math through runtime escaping, so it must
    // be pre-rendered to SVG at export (never bundles MathJax).
    const recursiveJsonLatexPages = (): ExportPage[] => [
        {
            id: 'page-recursive-json',
            title: 'Recursive JSON',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-recursive-json',
                    name: 'Content',
                    order: 0,
                    components: [
                        {
                            id: 'comp-recursive-json',
                            type: 'adaptative-quiz',
                            order: 0,
                            content: '',
                            properties: { questionsGame: [{ question: 'Solve \\(x^2 = 1\\)' }] },
                        },
                    ],
                },
            ],
        },
    ];

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new PageExporter(document, resources, assets, zip);
    });

    describe('MathJax when explicitly requested (addMathJax)', () => {
        beforeAll(() => {
            resetIdeviceConfigCache(); // discard any base path leaked by another spec
            loadIdeviceConfigs(); // load the real iDevice configs from the default cwd path
        });
        afterAll(() => resetIdeviceConfigCache());

        it('bundles and references MathJax in the single-page export', async () => {
            document = new MockDocument({ addMathJax: true }, mathJaxRequestedPages());
            exporter = new PageExporter(document, resources, assets, zip);
            let requestedFiles: string[] = [];
            resources.fetchLibraryFiles = async files => {
                requestedFiles = files;
                return new Map(
                    files.map(file => [
                        file === 'exe_math' ? 'exe_math/tex-mml-svg.js' : file,
                        Buffer.from('// mock lib'),
                    ]),
                );
            };

            await exporter.export();

            expect(requestedFiles.some(file => file.includes('exe_math'))).toBe(true);
            expect(zip.files.has('libs/exe_math/tex-mml-svg.js')).toBe(true);
            expect(zip.files.get('index.html') as string).toContain('libs/exe_math/tex-mml-svg.js');
        });

        it('pre-renders LaTeX and skips MathJax for recursive JSON iDevices (adaptative-quiz)', async () => {
            document = new MockDocument({ addMathJax: false }, recursiveJsonLatexPages());
            exporter = new PageExporter(document, resources, assets, zip);
            let mathJaxRequested = false;
            resources.fetchLibraryFiles = async files => {
                if (files.some(file => file.includes('exe_math'))) mathJaxRequested = true;
                return new Map();
            };

            // The hook stands in for the real LaTeX pre-renderer: it bakes the SVG
            // marker into the HTML so we can assert the exporter actually applies it.
            let hookCalled = false;
            const result = await exporter.export({
                preRenderLatex: async (html: string) => {
                    hookCalled = true;
                    return {
                        html: `${html}<span class="exe-math-rendered">x^2</span>`,
                        hasLatex: true,
                        latexRendered: true,
                        count: 1,
                    };
                },
            });

            expect(result.success).toBe(true);
            expect(hookCalled).toBe(true);
            // MathJax engine is never bundled for these iDevices.
            expect(mathJaxRequested).toBe(false);
            expect(zip.files.has('libs/exe_math/tex-mml-svg.js')).toBe(false);
            // The baked SVG and its supporting CSS are present in the export.
            expect(zip.files.get('index.html') as string).toContain('exe-math-rendered');
            const baseCss = zip.files.get('content/css/base.css');
            const baseCssText = typeof baseCss === 'string' ? baseCss : new TextDecoder().decode(baseCss as Buffer);
            expect(baseCssText).toContain('.exe-math-rendered');
        });
    });

    describe('Accessibility toolbar (addAccessibilityToolbar)', () => {
        // Regression test for #1978: when the author enables the accessibility toolbar,
        // the single-page export must load exe_atools (JS + CSS) in its <head> and
        // bundle the files alongside the page.
        const mockToolbarLibFiles = () => {
            resources.fetchLibraryFiles = async files => new Map(files.map(file => [file, Buffer.from('// mock lib')]));
        };

        it('references the toolbar JS and CSS in the page head when enabled', async () => {
            document = new MockDocument({ addAccessibilityToolbar: true }, samplePages);
            exporter = new PageExporter(document, resources, assets, zip);
            mockToolbarLibFiles();

            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('libs/exe_atools/exe_atools.js');
            expect(indexHtml).toContain('libs/exe_atools/exe_atools.css');
        });

        it('bundles the toolbar files when enabled', async () => {
            document = new MockDocument({ addAccessibilityToolbar: true }, samplePages);
            exporter = new PageExporter(document, resources, assets, zip);
            mockToolbarLibFiles();

            await exporter.export();

            expect(zip.files.has('libs/exe_atools/exe_atools.js')).toBe(true);
            expect(zip.files.has('libs/exe_atools/exe_atools.css')).toBe(true);
        });

        it('does not reference the toolbar when disabled (default)', async () => {
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).not.toContain('exe_atools');
        });
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

        it('should add only used material icon SVGs to the ZIP and inline them in HTML', async () => {
            const pagesWithBootstrapIcon: ExportPage[] = [
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
                            iconName: 'mi-lightbulb',
                            icon: { source: 'material', value: 'lightbulb' },
                            components: [],
                        },
                    ],
                },
            ];
            document = new MockDocument({}, pagesWithBootstrapIcon);
            exporter = new PageExporter(document, resources, assets, zip);

            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(zip.files.has('libs/material-icons/icons/lightbulb.svg')).toBe(true);
            expect(zip.files.has('libs/material-icons/icons/alarm.svg')).toBe(false);
            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('data:image/svg+xml;utf8,');
            expect(indexHtml).not.toContain('libs/material-icons/icons/lightbulb.svg');
        });

        it('falls back to the inlined help data URI when the material icon sprite cannot be fetched', async () => {
            // The loose per-icon SVG files were removed, so a sprite-fetch failure
            // must NOT leave a dangling libs/material-icons/icons/{name}.svg URL in
            // the HTML — the renderer emits a self-contained help data: URI instead.
            const pagesWithMaterialIcon: ExportPage[] = [
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
                            iconName: 'mi-lightbulb',
                            icon: { source: 'material', value: 'lightbulb' },
                            components: [],
                        },
                    ],
                },
            ];
            document = new MockDocument({}, pagesWithMaterialIcon);
            resources.fetchLibraryFiles = async (files: string[]) => {
                if (files.includes('material-icons/material-icons.svg')) {
                    throw new Error('material icon fetch failed');
                }
                return new Map();
            };
            exporter = new PageExporter(document, resources, assets, zip);

            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(zip.files.has('libs/material-icons/icons/lightbulb.svg')).toBe(false);
            const indexHtml = zip.files.get('index.html') as string;
            // No dead /icons/ path anywhere, and a real inlined icon is emitted.
            expect(indexHtml).not.toContain('libs/material-icons/icons/');
            expect(indexHtml).toContain('--exe-material-icon-url:url(');
            expect(indexHtml).toContain('data:image/svg+xml;utf8,');
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

        it('should inline material icon SVGs as data URIs in single-page HTML', () => {
            const pagesWithBootstrapIcon: ExportPage[] = [
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
                            iconName: 'mi-lightbulb',
                            icon: { source: 'material', value: 'lightbulb' },
                            components: [],
                        },
                    ],
                },
            ];

            const html = exporter.generateSinglePageHtml(
                pagesWithBootstrapIcon,
                document.getMetadata(),
                [],
                null,
                [],
                false,
                undefined,
                new Map([['lightbulb', 'data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E']]),
            );

            expect(html).toContain('data:image/svg+xml;utf8,');
            expect(html).not.toContain('libs/material-icons/icons/lightbulb.svg');
        });

        it('should render license as a link when licenseUrl is present in metadata', () => {
            const meta: ExportMetadata = {
                ...document.getMetadata(),
                license: 'creative commons: attribution 4.0',
                licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
            };
            const html = exporter.generateSinglePageHtml(samplePages, meta, []);

            expect(html).toContain('id="packageLicense"');
            expect(html).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
            expect(html).toContain('class="license"');
            expect(html).not.toContain('<span class="license">');
        });

        it('should render license as a span when licenseUrl is absent in metadata', () => {
            const meta: ExportMetadata = {
                ...document.getMetadata(),
                license: 'creative commons: attribution 4.0',
                licenseUrl: '',
            };
            const html = exporter.generateSinglePageHtml(samplePages, meta, []);

            expect(html).toContain('id="packageLicense"');
            expect(html).toContain('<span class="license">');
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

    // Note: the single-page exe-node: → anchor rewrite and named-anchor namespacing now
    // live in PageRenderer (replaceSinglePageInternalLinks / namespaceSinglePageAnchors) and
    // are unit-tested there. The tests below cover the end-to-end single-page export behaviour.
    describe('Internal Link Handling (Single Page)', () => {
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

// Regression coverage for #1927: the single-page content.xml must keep raw exe-node:
// internal links so they survive an export -> re-import round trip. The exported
// single HTML page still resolves them to in-page anchors at render time.
const internalLinkPages: ExportPage[] = [
    {
        id: 'page-1',
        title: 'Home',
        parentId: null,
        order: 0,
        blocks: [
            {
                id: 'block-1',
                name: 'Content Block',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content:
                            '<p>Go to <a href="exe-node:page-2">About</a> and <a href="exe-node:page-2#sec">a section</a>.</p>',
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
                name: 'Content Block',
                order: 0,
                components: [
                    {
                        id: 'comp-2',
                        type: 'FreeTextIdevice',
                        order: 0,
                        content: '<p>Back to <a href="exe-node:page-1">Home</a>.</p>',
                    },
                ],
            },
        ],
    },
];

async function exportPageZip(pages: ExportPage[]): Promise<MockZipProvider> {
    const zip = new MockZipProvider();
    const exporter = new PageExporter(
        new MockDocument({}, pages),
        new MockResourceProvider(),
        new MockAssetProvider(),
        zip,
    );
    await exporter.export();
    return zip;
}

describe('PageExporter — internal link round-trip (#1927)', () => {
    it('keeps exe-node: internal links in content.xml', async () => {
        const zip = await exportPageZip(internalLinkPages);
        const contentXml = zip.files.get('content.xml') as string;

        expect(contentXml).toContain('exe-node:page-2');
        expect(contentXml).toContain('exe-node:page-1');
        expect(contentXml).toContain('exe-node:page-2#sec');
        // Single-page rewrite must not leak into the persisted XML.
        expect(contentXml).not.toContain('#section-page-2');
        expect(contentXml).not.toContain('#page-2--sec');
    });

    it('still renders in-page anchors in the exported single HTML page', async () => {
        const zip = await exportPageZip(internalLinkPages);
        const indexHtml = zip.files.get('index.html') as string;

        expect(indexHtml).toContain('href="#section-page-2"');
        expect(indexHtml).toContain('href="#page-2--sec"');
        expect(indexHtml).toContain('href="#section-page-1"');
        expect(indexHtml).not.toContain('exe-node:');
    });
});
