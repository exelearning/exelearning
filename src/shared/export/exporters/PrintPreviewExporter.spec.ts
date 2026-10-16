/**
 * Tests for PrintPreviewExporter
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, spyOn } from 'bun:test';
import { PrintPreviewExporter, type PrintPreviewOptions } from './PrintPreviewExporter';
import { PageRenderer } from '../renderers/PageRenderer';
import { PRERENDERED_LATEX_CSS } from '../constants';
import { encryptDataGame } from '../utils/dataGameCipher';
import type {
    AssetProvider,
    ExportAsset,
    ExportBlock,
    ExportComponent,
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
} from '../interfaces';

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
    fetchLibraryFiles: async (files: string[]) => {
        const result = new Map<string, Buffer>();
        if (files.includes('material-icons/material-icons.svg')) {
            result.set(
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
        return result;
    },
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

    describe('dispose', () => {
        const originalRevokeObjectURL = global.URL.revokeObjectURL;
        let revoked: string[];

        /** An image asset whose blob URL, under the mock above, is told apart by its size. */
        const imageAsset = (id: string, filename: string, size: number): ExportAsset => ({
            id,
            filename,
            originalPath: filename,
            mime: 'image/png',
            data: new Uint8Array(size),
        });

        const createAssets = (assets: ExportAsset[]): AssetProvider => ({
            getProjectAssets: async () => assets,
            getAllAssets: async () => assets,
            getAsset: async (id: string) => assets.find(asset => asset.id === id) ?? null,
        });

        const twoAssets = () => createAssets([imageAsset('a1', 'one.png', 3), imageAsset('a2', 'two.png', 5)]);

        beforeEach(() => {
            revoked = [];
            global.URL.revokeObjectURL = ((url: string) => {
                revoked.push(url);
            }) as typeof URL.revokeObjectURL;
            // Only the assets the document uses are copied, so it uses both.
            mockDocument.getNavigation()[0].blocks[0].components[0].content =
                '<img src="asset://a1"><img src="asset://a2">';
        });

        afterEach(() => {
            global.URL.revokeObjectURL = originalRevokeObjectURL;
        });

        describe('copying only the assets the document uses', () => {
            it('leaves out one nothing points at, and one only a hidden page does', async () => {
                const pages = mockDocument.getNavigation();
                pages[0].blocks[0].components[0].content = '<img src="asset://a1">';
                pages[1].properties = { visibility: false };
                pages[1].blocks[0].components[0].content = '<img src="asset://a2">';
                const assets = createAssets([
                    imageAsset('a1', 'one.png', 3),
                    imageAsset('a2', 'two.png', 5),
                    imageAsset('a3', 'three.png', 7),
                ]);

                const result = await new PrintPreviewExporter(
                    createMockDocument(pages),
                    mockResourceProvider,
                    assets,
                ).generatePreview();
                result.dispose?.();

                expect(result.html).toContain('<img src="blob:mock-url-3">');
                expect(revoked).toEqual(['blob:mock-url-3']);
            });

            it('still copies the picture of an exercise drawn from an encrypted payload', async () => {
                // No sidecar link carries it, so the picture only appears once the payload is read.
                const payload = JSON.stringify({
                    typeGame: 'Adivina',
                    wordsGame: [
                        { type: 1, url: 'asset://a2', definition: 'Castillo', word: 'Loarre', percentageShow: 0 },
                    ],
                });
                const pages = mockDocument.getNavigation();
                pages[0].blocks[0].components[0] = {
                    id: 'guess-1',
                    type: 'guess',
                    order: 0,
                    content: `<div class="adivina-IDevice"><div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`,
                    properties: {},
                };

                const result = await new PrintPreviewExporter(
                    createMockDocument(pages),
                    mockResourceProvider,
                    twoAssets(),
                ).generatePreview({ activities: { mode: 'in-place', labels: {}, ideviceTitles: {} } });
                result.dispose?.();

                expect(result.html).toContain('blob:mock-url-5');
                expect(result.html).not.toContain('asset://a2');
                expect(revoked).toEqual(['blob:mock-url-5']);
            });

            it.each([
                ['left out', { mode: 'omit' }],
                ['left unticked', { mode: 'appendix', selectedActivities: [] }],
            ])('leaves out the pictures of an activity %s', async (_label, choice) => {
                const pages = mockDocument.getNavigation();
                pages[0].blocks[0].components[0].content = '<img src="asset://a1">';
                pages[1].blocks[0].components[0] = {
                    id: 'guess-1',
                    type: 'guess',
                    order: 0,
                    content: '<div class="adivina-IDevice"><img src="asset://a2"></div>',
                    properties: {},
                };

                const result = await new PrintPreviewExporter(
                    createMockDocument(pages),
                    mockResourceProvider,
                    twoAssets(),
                ).generatePreview({
                    activities: { labels: {}, ideviceTitles: {}, ...choice } as PrintPreviewOptions['activities'],
                });
                result.dispose?.();

                expect(revoked).toEqual(['blob:mock-url-3']);
            });
        });

        it('hands back a way to release the asset URLs, and releases nothing while the document is shown', async () => {
            const withAssets = new PrintPreviewExporter(mockDocument, mockResourceProvider, twoAssets());

            const result = await withAssets.generatePreview();

            expect(result.success).toBe(true);
            expect(typeof result.dispose).toBe('function');
            expect(revoked).toHaveLength(0);
        });

        it('releases every URL it made, and only those', async () => {
            const withAssets = new PrintPreviewExporter(mockDocument, mockResourceProvider, twoAssets());
            const result = await withAssets.generatePreview();

            result.dispose?.();

            expect(revoked.sort()).toEqual(['blob:mock-url-3', 'blob:mock-url-5']);
        });

        it('releases them once, however many times it is called', async () => {
            const withAssets = new PrintPreviewExporter(mockDocument, mockResourceProvider, twoAssets());
            const result = await withAssets.generatePreview();

            result.dispose?.();
            result.dispose?.();

            expect(revoked).toHaveLength(2);
        });

        it('has nothing to release when the project has no assets', async () => {
            const result = await exporter.generatePreview();

            result.dispose?.();

            expect(revoked).toHaveLength(0);
        });

        it('keeps the URLs of one preview apart from those of the next', async () => {
            const first = await new PrintPreviewExporter(
                mockDocument,
                mockResourceProvider,
                twoAssets(),
            ).generatePreview();
            const second = await new PrintPreviewExporter(
                mockDocument,
                mockResourceProvider,
                twoAssets(),
            ).generatePreview();

            first.dispose?.();

            expect(revoked).toHaveLength(2);
            second.dispose?.();
            expect(revoked).toHaveLength(4);
        });

        it('releases the URLs it made when generating fails, and offers nothing to release later', async () => {
            const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
            const withAssets = new PrintPreviewExporter(mockDocument, mockResourceProvider, twoAssets());
            const renderSpy = spyOn(PageRenderer.prototype, 'renderSinglePage').mockImplementationOnce(() => {
                throw new Error('render failed');
            });

            const result = await withAssets.generatePreview();

            expect(result.success).toBe(false);
            expect(result.error).toBe('render failed');
            expect(result.dispose).toBeUndefined();
            expect(revoked).toHaveLength(2);
            renderSpy.mockRestore();
            errorSpy.mockRestore();
        });
    });

    describe('reusing an exporter', () => {
        let mockedCreateObjectURL: typeof URL.createObjectURL;
        let results: Awaited<ReturnType<PrintPreviewExporter['generatePreview']>>[];

        beforeEach(() => {
            mockedCreateObjectURL = URL.createObjectURL;
            URL.createObjectURL = originalCreateObjectURL;
            results = [];
            const asset: ExportAsset = {
                id: 'picture',
                filename: 'picture.png',
                originalPath: 'picture.png',
                mime: 'image/png',
                data: new Uint8Array([1, 2, 3]),
            };
            const assets: AssetProvider = {
                getAllAssets: async () => [asset],
                getProjectAssets: async () => [asset],
                getAsset: async () => asset,
            };
            const pages = mockDocument.getNavigation();
            pages[0].blocks[0].components[0].content = '<img src="asset://picture">';
            exporter = new PrintPreviewExporter(createMockDocument(pages), mockResourceProvider, assets);
        });

        afterEach(() => {
            for (const result of results) result.dispose?.();
            URL.createObjectURL = mockedCreateObjectURL;
        });

        const imageUrl = (result: Awaited<ReturnType<PrintPreviewExporter['generatePreview']>>) => {
            expect(result.success).toBe(true);
            const match = result.html?.match(/src="(blob:[^"]+)"/);
            expect(match).not.toBeNull();
            return match![1];
        };
        const readable = (url: string) =>
            fetch(url)
                .then(response => response.ok)
                .catch(() => false);

        it.each([false, true])('isolates results when concurrent generation is %s', async concurrent => {
            results = concurrent
                ? await Promise.all([exporter.generatePreview(), exporter.generatePreview()])
                : [await exporter.generatePreview(), await exporter.generatePreview()];
            const [first, second] = results;
            const firstUrl = imageUrl(first);
            const secondUrl = imageUrl(second);
            expect(firstUrl).not.toBe(secondUrl);

            first.dispose?.();
            expect(await readable(firstUrl)).toBe(false);
            expect(await readable(secondUrl)).toBe(true);
            second.dispose?.();
            expect(await readable(secondUrl)).toBe(false);
        });

        it('can generate fresh resources after a previous result was disposed', async () => {
            const first = await exporter.generatePreview();
            results.push(first);
            first.dispose?.();
            const second = await exporter.generatePreview();
            results.push(second);
            expect(await readable(imageUrl(second))).toBe(true);
            // A repeated disposal of the old result must not touch newly generated resources.
            first.dispose?.();
            expect(await readable(imageUrl(second))).toBe(true);
        });

        it('preserves an existing result when a later generation fails', async () => {
            const first = await exporter.generatePreview();
            results.push(first);
            const renderSpy = spyOn(PageRenderer.prototype, 'renderSinglePage').mockImplementationOnce(() => {
                throw new Error('render failed');
            });
            const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
            try {
                const failed = await exporter.generatePreview();
                expect(failed.success).toBe(false);
                expect(await readable(imageUrl(first))).toBe(true);
            } finally {
                renderSpy.mockRestore();
                errorSpy.mockRestore();
            }
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

        it('should inline material icon SVGs in print preview HTML', async () => {
            const doc = createMockDocument([
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
                            iconName: 'mi-lightbulb',
                            icon: { source: 'material', value: 'lightbulb' },
                            components: [],
                        },
                    ],
                },
            ]);
            const exp = new PrintPreviewExporter(doc, mockResourceProvider);

            const result = await exp.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toContain('data:image/svg+xml;utf8,');
            expect(result.html).not.toContain('libs/material-icons/icons/lightbulb.svg');
        });

        it('should include package header with project title', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('class="package-header"');
            expect(result.html).toContain('class="package-title">Test Project</p>');
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

            // 6. No appendix pagination: a document that converts no activity has no appendix.
            expect(result.html).not.toContain('#section-worksheet-appendix');
        });
    });

    describe('print options', () => {
        it('should not inject page numbers or a watermark (browser print headers own them)', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).not.toContain('@bottom-center');
            expect(result.html).not.toContain('counter(page)');
            expect(result.html).not.toContain('@bottom-right');
            expect(result.html).not.toContain('Created with eXeLearning');
        });

        it('should include link URL CSS by default', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('a[href^="http"]::after');
            expect(result.html).toContain('content: " [" attr(href) "]"');
        });

        it.each([false, true])(
            'should override theme and iframe URL rules when disabled (printMode: %s)',
            async printMode => {
                const result = await exporter.generatePreview({ showLinkUrls: false, printMode });
                expect(result.success).toBe(true);
                expect(result.html).not.toContain('content: " [" attr(href) "]"');
                expect(result.html).toContain('a[href^="http"]::after { content: none !important; }');
                expect(result.html).toContain('.external-iframe-src { display: none !important; }');

                // Override the base/theme print rules on screen as well as on paper.
                const style = result.html!.slice(result.html!.indexOf('/* PREVIEW MODE (Screen) */'));
                const before = style.slice(0, style.indexOf('a[href^="http"]::after'));
                expect(before.split('{').length).toBe(before.split('}').length);
            },
        );

        it('should apply link URL CSS on screen too, so the preview shows what will print', async () => {
            const result = await exporter.generatePreview();
            const style = result.html!.slice(result.html!.indexOf('/* PREVIEW MODE (Screen) */'));
            const before = style.slice(0, style.indexOf('a[href^="http"]::after'));
            // Balanced braces before the rule = top level, not nested inside @media print
            expect(before.split('{').length).toBe(before.split('}').length);
        });

        describe('the preview shows what goes on paper', () => {
            /** The preview's own styles, from the screen section on. */
            const previewStyles = async () => {
                const { html } = await exporter.generatePreview();
                return html!.slice(html!.indexOf('/* PREVIEW MODE (Screen) */'));
            };
            /** Whether a rule is in the styles outside any @media, so that it holds on screen too. */
            const onScreen = (styles: string, rule: string) => {
                const before = styles.slice(0, styles.indexOf(rule));
                return styles.includes(rule) && before.split('{').length === before.split('}').length;
            };

            it('leaves out the link to eXe, which never prints', async () => {
                expect(onScreen(await previewStyles(), '#made-with-eXe { display: none !important; }')).toBe(true);
            });

            it('opens folded blocks, and leaves out their toggles, unless printing the page as it is shown', async () => {
                const styles = await previewStyles();

                expect(
                    onScreen(
                        styles,
                        'html:not(.exe-print-as-shown) .exe-export article.box.minimized > .box-content { display: block !important; }',
                    ),
                ).toBe(true);
                expect(
                    onScreen(
                        styles,
                        'html:not(.exe-print-as-shown) .exe-export .box-toggle { display: none !important; }',
                    ),
                ).toBe(true);
            });

            it('styles external links as they print: in the colour of the text around them, underlined', async () => {
                const styles = await previewStyles();

                expect(
                    onScreen(
                        styles,
                        '.exe-content a[href^="http"] {\n    color: inherit;\n    text-decoration: underline;\n}',
                    ),
                ).toBe(true);
                // Not every anchor: a control an iDevice builds from a link keeps the style of its class.
                expect(styles).not.toContain('\na[href] {');
            });

            it('wraps long lines of code, and leaves quotes in their normal flow', async () => {
                const styles = await previewStyles();

                expect(onScreen(styles, 'pre {\n    white-space: pre-wrap;\n    overflow-wrap: anywhere;\n}')).toBe(
                    true,
                );
                // pre-wrap would keep the line breaks of a quote's source and print them as blank lines.
                expect(styles).not.toMatch(/blockquote[^{]*\{[^}]*white-space/);
            });

            it('hides the MathML that pre-rendered formulas carry, as the exports do', async () => {
                const styles = await previewStyles();

                // The preview links the editor's base.css, which lacks it: every formula showed twice.
                expect(onScreen(styles, PRERENDERED_LATEX_CSS)).toBe(true);
                expect(styles).toContain('.exe-math-rendered math { position: absolute;');
            });

            it('gives the paper the margin the base styles print with, and no other', async () => {
                const styles = await previewStyles();

                // Outweighs a style's own body rule (body.exe-export), which took the margin away.
                expect(styles).toMatch(/html body\.exe-single-page \{[^}]*padding: 15mm;/);
                expect(onScreen(styles, 'html body.exe-single-page .exe-content {\n    padding: 0;\n}')).toBe(true);
            });
        });

        it('should not append the URL again to the external iframe source link', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.external-iframe-src a::after { content: none; }');
        });

        describe('a link whose text already is its address', () => {
            /** The preview of a page with this content, and the links in it marked as showing their address. */
            const preview = async (content: string, showLinkUrls = true) => {
                const page: ExportPage = {
                    id: 'page-links',
                    title: 'Links',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block-links',
                            name: 'Links',
                            order: 0,
                            components: [{ id: 'comp-links', type: 'text', order: 0, content, properties: {} }],
                        },
                    ],
                };
                const linksExporter = new PrintPreviewExporter(
                    createMockDocument([page]),
                    createMockResourceProvider(),
                );
                const { html } = await linksExporter.generatePreview({ showLinkUrls });
                return { html: html!, marked: html!.match(/<a data-exe-text-is-url[^>]*>[\s\S]*?<\/a>/g) ?? [] };
            };

            it('is not followed by its address a second time', async () => {
                const { html, marked } = await preview(
                    '<p><a href="https://example.com/a?b=1&amp;c=2">https://example.com/a?b=1&amp;c=2</a></p>',
                );

                expect(marked).toEqual([
                    '<a data-exe-text-is-url href="https://example.com/a?b=1&amp;c=2">https://example.com/a?b=1&amp;c=2</a>',
                ]);
                expect(html).toContain('a[href^="http"][data-exe-text-is-url]::after { content: none; }');
            });

            it.each([
                ['without the protocol or the trailing slash', '<a href="https://example.com/">example.com</a>'],
                [
                    'with its host in other letter case',
                    '<a href="https://Example.COM/Page">https://example.com/Page</a>',
                ],
                [
                    'inside other markup',
                    '<a class="x" href="http://example.com"><strong> http://example.com </strong></a>',
                ],
                [
                    'with its characters as other entities',
                    '<a href="https://example.com/?a=1&amp;b=2">https://example.com/?a=1&#38;b=2</a>',
                ],
                [
                    'with its href percent-encoded',
                    '<a href="https://es.wikipedia.org/wiki/Le%C3%B3n">https://es.wikipedia.org/wiki/León</a>',
                ],
                // A pattern would start at the anchor never closed and swallow the link after it.
                [
                    'after an anchor that is never closed',
                    '<a name="top"/>Intro <a href="https://example.org/">https://example.org/</a>',
                ],
                // The parser's places have to be the document's, line breaks and all.
                ['after Windows line breaks', 'One\r\ntwo\r\n<a href="https://example.org/">https://example.org/</a>'],
                [
                    'with its text percent-encoded',
                    '<a href="https://example.org/León">https://example.org/Le%C3%B3n</a>',
                ],
                [
                    'with an encoded literal percent sign',
                    '<a href="https://example.org/100%25">https://example.org/100%</a>',
                ],
                ['with a malformed percent escape', '<a href="https://example.org/%ZZ">https://example.org/%ZZ</a>'],
                [
                    'inside a custom element starting with a',
                    '<a-widget>Intro <a href="https://example.org/">https://example.org/</a></a-widget>',
                ],
                [
                    'with a closing angle bracket inside an attribute',
                    '<a title="x > y" href="https://example.org/">https://example.org/</a>',
                ],
            ])('is recognised with its address written %s', async (_label, link) => {
                expect((await preview(`<p>${link}</p>`)).marked).toHaveLength(1);
            });

            it('marks the link where it starts, and leaves the rest of the document as it was', async () => {
                const content = '<p>Intro <a href="https://example.org/">https://example.org/</a> and more.</p>';
                const { html, marked } = await preview(content);

                expect(marked).toEqual([
                    '<a data-exe-text-is-url href="https://example.org/">https://example.org/</a>',
                ]);
                expect(html.replace(' data-exe-text-is-url', '')).toContain(content);
            });

            it('leaves alone a link written inside a script', async () => {
                const script = `<script>var link = '<a href="https://example.org/">https://example.org/</a>';</script>`;
                const { html, marked } = await preview(`<p>Text</p>${script}`);

                expect(html).toContain(script);
                expect(marked).toEqual([]);
            });

            it.each(['style', 'textarea', 'title', 'noscript'])(
                'leaves link-shaped text inside %s unchanged',
                async tag => {
                    const content = `<${tag}><a href="https://example.org/">https://example.org/</a></${tag}>`;
                    const { html, marked } = await preview(content);

                    expect(html).toContain(content);
                    expect(marked).toEqual([]);
                },
            );

            it('does not treat a custom element as an anchor', async () => {
                const content = '<a-widget href="https://example.org/">https://example.org/</a-widget>';
                const { html, marked } = await preview(content);

                expect(html).toContain(content);
                expect(marked).toEqual([]);
            });

            it('marks multiple start tags without changing their case, attributes or surrounding source', async () => {
                const content = [
                    '<p>🙂\r\n',
                    "<A HREF='https://example.org/one' title='x > y'>https://example.org/one</A>",
                    '<!-- <a href="https://example.org/">https://example.org/</a> -->',
                    '<a href="https://example.org/two"><strong>https://example.org/two</strong></a>',
                    '<a href="https://example.org/three">Named link</a></p>',
                ].join('');
                const expected = content
                    .replace('<A HREF=', '<A data-exe-text-is-url HREF=')
                    .replace(
                        '<a href="https://example.org/two"',
                        '<a data-exe-text-is-url href="https://example.org/two"',
                    );
                const { html } = await preview(content);

                expect(html).toContain(expected);
                expect(html.replaceAll(' data-exe-text-is-url', '')).toContain(content);
            });

            it.each([
                ['before', 'Read', 'https://example.org/'],
                ['after', 'https://example.org/', 'Read'],
            ])(
                'keeps the address visible when a reconstructed named link comes %s the URL text',
                async (_order, first, second) => {
                    // HTML reconstruction creates two anchors sharing this source start tag: one
                    // says "Read", the other shows the address. A source attribute reaches both.
                    const content = `<p><a href="https://example.org/">${first}<div>${second}</a></div>`;
                    const { html, marked } = await preview(content);

                    expect(marked).toEqual([]);
                    expect(html).toContain(content);
                },
            );

            it('marks a shared start tag once when every reconstructed link shows its address', async () => {
                const content =
                    '<p><a href="https://example.org/">https://example.org/<div>https://example.org/</a></div>';
                const { html, marked } = await preview(content);

                expect(marked).toHaveLength(1);
                expect(html).toContain(content.replace('<a ', '<a data-exe-text-is-url '));
            });

            it('preserves a long sequence of URL links interspersed with named links', async () => {
                const entries = Array.from({ length: 1000 }, (_, index) => {
                    const url = `https://example.org/page-${index}`;
                    return `<p><a href="${url}">${url}</a> <a href="${url}">Read ${index}</a></p>`;
                });
                const content = entries.join('\r\n');
                const { html, marked } = await preview(content);

                expect(marked).toHaveLength(entries.length);
                expect(html).toContain(
                    entries.map(entry => entry.replace('<a ', '<a data-exe-text-is-url ')).join('\r\n'),
                );
                expect(html.replaceAll(' data-exe-text-is-url', '')).toContain(content);
            });

            it.each([
                ['text of its own', '<a href="https://example.com">Example site</a>'],
                ['another address', '<a href="https://example.com">https://example.org</a>'],
                // A path and a query can tell two addresses apart by case alone.
                [
                    'an address whose path differs in case',
                    '<a href="https://example.com/Page?ID=A">https://example.com/page?id=a</a>',
                ],
                ['only an image', '<a href="https://example.com"><img src="https://example.com/x.png" alt=""></a>'],
                [
                    'an address that is not its href',
                    '<a data-href="https://example.com" href="#top">https://example.com</a>',
                ],
                ['an internal address', '<a href="#top">#top</a>'],
                [
                    'an encoded slash instead of a path separator',
                    '<a href="https://example.org/a%2Fb">https://example.org/a/b</a>',
                ],
                [
                    'an encoded question mark instead of a query separator',
                    '<a href="https://example.org/a%3Fb">https://example.org/a?b</a>',
                ],
                [
                    'a percent-encoded path whose decoded case differs',
                    '<a href="https://example.org/%50age">https://example.org/page</a>',
                ],
            ])('is told apart from a link with %s', async (_label, link) => {
                expect((await preview(`<p>${link}</p>`)).marked).toEqual([]);
            });

            it('is left unmarked when no address is written after links', async () => {
                expect(
                    (await preview('<p><a href="https://example.com">https://example.com</a></p>', false)).marked,
                ).toEqual([]);
            });

            it('is not left to a selector only Firefox knows, nor to rules repeated for https', async () => {
                // A selector Chromium does not know drops its whole rule, and ^="http" covers https.
                const { html } = await preview('<p>No links</p>');

                expect(html).not.toContain('-moz-only-whitespace');
                expect(html).not.toContain('a[href^="https"]');
            });
        });

        it('should include external-iframe-src display rule when link URLs are on', async () => {
            const result = await exporter.generatePreview({ showLinkUrls: true });
            expect(result.html).toContain('.external-iframe-src');
        });

        it('should keep showing link URLs alongside the styles of converted activities', async () => {
            const result = await exporter.generatePreview({
                activities: { mode: 'appendix', labels: {} } as PrintPreviewOptions['activities'],
            });
            expect(result.html).toContain('a[href^="http"]::after');
        });

        it('should hide toggle content buttons in print CSS', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.box-toggle { display: none !important; }');
        });

        it('should hide game toolbar icons in print (background images do not print by default)', async () => {
            const result = await exporter.generatePreview();
            const rule = '[class*="exeQuextIcons"], .SopaIcons, .IDFPIcons { display: none !important; }';
            const at = result.html!.indexOf(rule);
            expect(at).toBeGreaterThan(-1);
            const before = result.html!.slice(result.html!.indexOf('/* PREVIEW MODE (Screen) */'), at);
            // Nested inside @media print, so the icons stay usable on screen
            expect(before.split('{').length).toBeGreaterThan(before.split('}').length);
        });

        it('should leave teacher-only content to the teacher mode, which decides whether it prints', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).not.toContain('.teacher-only { display: none !important; }');
        });

        it('should hide map iDevice image overlays in print CSS', async () => {
            const result = await exporter.generatePreview();
            expect(result.html).toContain('.mapa-IDevice img.js-hidden { display: none !important; }');
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

        it('should resolve custom block icon assets to blob URLs in print preview HTML', async () => {
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
                            iconName: 'asset://1234-5678',
                            icon: { source: 'asset', value: 'asset://1234-5678' },
                            components: [
                                {
                                    id: 'c1',
                                    type: 'text',
                                    order: 0,
                                    content: '<p>Content</p>',
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
            expect(result.html).not.toContain('asset://1234-5678');
            expect(result.html).not.toContain('content/resources/1234-5678');
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

        it('keeps feedback open while printing everything, and lets its button fold it while printing as shown', async () => {
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
                                    content: '<div class="feedback js-feedback js-hidden">Feedback</div>',
                                },
                            ],
                        },
                    ],
                    properties: {},
                },
            ]);

            const result = await new PrintPreviewExporter(doc, mockResourceProvider).generatePreview();

            // Printing everything, no style the button writes can fold it.
            expect(result.html).toMatch(
                /html:not\(\.exe-print-as-shown\) \.feedback\.js-hidden \{\s*display: block !important;\s*\}/,
            );
            // Printing as shown, it starts open over `.js .js-hidden`, but yields to that style.
            expect(result.html).toMatch(/html\.exe-print-as-shown \.feedback\.js-hidden \{\s*display: block;\s*\}/);
            expect(result.html).not.toMatch(/(^|\n)\.feedback\.js-hidden \{/);
        });
    });

    // The export scripts read $exe_i18n as they load. Linked to the editor's template, whose c_()
    // calls fail outside the editor, it was never defined, and the Text iDevice never started: its
    // feedback button did nothing.
    describe('the translated strings the export scripts read', () => {
        const TRANSLATED = '$exe_i18n = { "showFeedback": "Mostrar retroalimentación" };';
        const pages = (): ExportPage[] => [
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
                        components: [{ id: 'c1', type: 'text', order: 0, content: '<p>Text</p>', properties: {} }],
                    },
                ],
                properties: {},
            },
        ];

        /** The preview, with the translated file the resources give for each language. */
        async function preview(fetchI18nFile: ResourceProvider['fetchI18nFile'], language = 'es') {
            const resources = { ...createMockResourceProvider(), fetchI18nFile };
            const result = await new PrintPreviewExporter(
                createMockDocument(pages(), { language }),
                resources,
            ).generatePreview();
            expect(result.success).toBe(true);
            return result.html ?? '';
        }

        it("go into the page in the project's language, instead of a link to the template", async () => {
            const asked: string[] = [];
            const html = await preview(async language => {
                asked.push(language);
                return TRANSLATED;
            });

            expect(asked).toEqual(['es']);
            expect(html).toContain(`<script>${TRANSLATED}</script>`);
            expect(html).not.toContain('common_i18n.js');
        });

        it('cannot close their script early', async () => {
            const html = await preview(async () => '$exe_i18n = { "x": "</script><b>" };');

            expect(html).toContain('$exe_i18n = { "x": "<\\/script><b>" };');
        });

        it('leave the link as it was when the resources have none, or fail to give them', async () => {
            const warn = spyOn(console, 'warn').mockImplementation(() => {});

            for (const fetchI18nFile of [
                async () => '',
                async () => {
                    throw new Error('Offline');
                },
            ]) {
                const html = await preview(fetchI18nFile);
                expect(html).toContain('app/common/common_i18n.js');
                expect(html).not.toContain(TRANSLATED);
            }
            expect(warn).toHaveBeenCalled();
            warn.mockRestore();
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

    // Two components of one type, one after the other in a block, used to lose the second when
    // their ids began with the same 14 characters, taken for pieces of one split Complete. Nothing
    // splits an iDevice that way, and those characters only say when an id was made: the Manual of
    // eXeLearning 3.0 holds the three Complete below in one block, one per mode, and two Text
    // iDevices added to a block within hours of each other share them too.
    describe('components of the same type in a block', () => {
        /** A Text iDevice's markup, its feedback folded behind its button as the editor writes it. */
        const textWithFeedback = (text: string, feedback: string) =>
            `<p>${text}</p><div class="iDevice_buttons feedback-button js-required">` +
            '<input type="button" class="feedbacktooglebutton" value="Show feedback"></div>' +
            `<div class="feedback js-feedback js-hidden" style="display: none;"><p>${feedback}</p></div>`;

        /** A project with one page holding one block of the given components. */
        function blockOf(components: { id: string; type: string; content: string }[]): ExportDocument {
            return createMockDocument([
                {
                    id: 'p1',
                    title: 'Alike',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'b1',
                            name: 'Block',
                            order: 0,
                            components: components.map((component, order) => ({ ...component, order, properties: {} })),
                        },
                    ],
                    properties: {},
                },
            ]);
        }

        it('prints every one, legacy ids made in the same second included', async () => {
            const doc = blockOf([
                { id: '20251021091936ZBADPV', type: 'complete', content: '<div>Complete to write</div>' },
                { id: '20251021091936KBGQGU', type: 'complete', content: '<div>Complete to drag</div>' },
                { id: '20251021091936GSEMZX', type: 'complete', content: '<div>Complete to choose</div>' },
                { id: '20251021091936QALZGN', type: 'udl-content', content: '<p>First UDL content</p>' },
                { id: '20251021091936TCNYKR', type: 'udl-content', content: '<p>Second UDL content</p>' },
            ]);

            const result = await new PrintPreviewExporter(doc, mockResourceProvider).generatePreview();

            expect(result.success).toBe(true);
            for (const text of [
                'Complete to write',
                'Complete to drag',
                'Complete to choose',
                'First UDL content',
                'Second UDL content',
            ])
                expect(result.html).toContain(text);
        });

        it('prints two Text iDevices of a block with their feedback, ids as the editor makes them', async () => {
            const doc = blockOf([
                {
                    id: 'idevice-1792142548773-k5l2boxls',
                    type: 'text',
                    content: textWithFeedback('First text', 'First feedback'),
                },
                {
                    id: 'idevice-1792142582173-47ljbrp27',
                    type: 'text',
                    content: textWithFeedback('Second text', 'Second feedback'),
                },
            ]);

            const result = await new PrintPreviewExporter(doc, mockResourceProvider).generatePreview();

            expect(result.success).toBe(true);
            for (const text of ['First text', 'First feedback', 'Second text', 'Second feedback'])
                expect(result.html).toContain(text);
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

        it("links an older style's content.css and default.js from where the style is served", async () => {
            const provider = createMockResourceProvider();
            provider.fetchTheme = async () =>
                new Map([
                    ['content.css', new Uint8Array(0)],
                    ['default.js', new Uint8Array(0)],
                    ['img/logo.png', new Uint8Array(0)],
                ]);
            const page = { id: 'page-1', title: 'Test Page', parentId: null, order: 0, blocks: [] };
            const exp = new PrintPreviewExporter(createMockDocument([page]), provider);

            const result = await exp.generatePreview({ themeUrl: 'https://example.org/site-files/themes/old/' });

            expect(result.success).toBe(true);
            expect(result.html).toContain('href="https://example.org/site-files/themes/old/content.css"');
            expect(result.html).toContain('src="https://example.org/site-files/themes/old/default.js"');
            expect(result.html).not.toContain('style.css');
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

    describe('where the style is loaded from', () => {
        /** One block that shows an icon from the style. */
        const pagesWithIcon = (content = ''): ExportPage[] => [
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
                        iconName: 'activity',
                        components: content ? [{ id: 'comp-1', type: 'text', order: 0, content, properties: {} }] : [],
                    },
                ],
            },
        ];
        const preview = (options: PrintPreviewOptions = {}, content = '') =>
            new PrintPreviewExporter(
                createMockDocument(pagesWithIcon(content)),
                createMockResourceProvider(),
            ).generatePreview(options);

        it('loads the stylesheet, the script and the icons from where the style is served', async () => {
            const { html } = await preview({ themeUrl: 'https://exe.example.test/v1/site-files/themes/custom/' });

            expect(html).toContain('href="https://exe.example.test/v1/site-files/themes/custom/style.css"');
            expect(html).toContain('src="https://exe.example.test/v1/site-files/themes/custom/style.js"');
            expect(html).toContain('src="https://exe.example.test/v1/site-files/themes/custom/icons/activity.png"');
        });

        it('looks for a base style when not told where the style is', async () => {
            const { html } = await preview({ baseUrl: 'http://localhost:3001', version: 'v2' });

            expect(html).toContain('href="http://localhost:3001/v2/files/perm/themes/base/base/style.css"');
            expect(html).toContain('src="http://localhost:3001/v2/files/perm/themes/base/base/icons/activity.png"');
        });

        it('leaves no path relative to the style, which a blob: document could not resolve', async () => {
            const { html } = await preview();

            expect(html).not.toMatch(/\s(?:src|href)="theme\//);
        });

        it('leaves alone an attribute that only ends in src', async () => {
            const { html } = await preview({}, '<p><img data-src="theme/lazy.png" alt=""></p>');

            expect(html).toContain('data-src="theme/lazy.png"');
        });

        describe('a style kept with the project', () => {
            /** Preview a project whose style is made of the given files. */
            const previewWith = (files: Record<string, string> | null, options: PrintPreviewOptions) => {
                const provider = createMockResourceProvider();
                provider.fetchTheme = async () => {
                    if (!files) throw new Error('Theme not available');
                    return new Map(Object.entries(files).map(([path, text]) => [path, new TextEncoder().encode(text)]));
                };
                return new PrintPreviewExporter(createMockDocument(pagesWithIcon()), provider).generatePreview(options);
            };
            const STYLE = { 'style.css': '.exe-content{color:red}', 'icons/activity.png': 'png' };

            it('is taken from its own files when it is served from nowhere', async () => {
                const { html } = await previewWith(STYLE, { themeFromFiles: true });

                expect(html).toMatch(
                    /<link rel="stylesheet" href="blob:[^"]+" data-exe-theme-href="theme\/style.css">/,
                );
                expect(html).toMatch(/<img src="blob:[^"]+"/);
                expect(html).toContain('data-exe-theme-src="theme/icons/activity.png"');
                expect(html).not.toContain('files/perm/themes/base/base/');
            });

            it('gives back the URLs of its files with the preview', async () => {
                const revoke = spyOn(URL, 'revokeObjectURL');
                try {
                    const result = await previewWith(STYLE, { themeFromFiles: true });
                    const handedOut = [...(result.html ?? '').matchAll(/"(blob:[^"]+)"/g)].map(match => match[1]);

                    result.dispose?.();

                    const released = revoke.mock.calls.map(([url]) => url);
                    expect(handedOut.length).toBeGreaterThan(0);
                    for (const url of handedOut) expect(released).toContain(url);
                } finally {
                    revoke.mockRestore();
                }
            });

            it('is loaded from its URL when it has one', async () => {
                const { html } = await previewWith(STYLE, {
                    themeFromFiles: true,
                    themeUrl: 'https://exe.example.test/site-files/themes/custom/',
                });

                expect(html).toContain('href="https://exe.example.test/site-files/themes/custom/style.css"');
            });

            it('is looked for among the base styles when its files cannot be had', async () => {
                const { html } = await previewWith(null, { themeFromFiles: true });

                expect(html).toContain('/files/perm/themes/base/base/style.css"');
            });
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

describe('PrintPreviewExporter and interactive activities', () => {
    const resources = createMockResourceProvider();

    /** Component HTML the Guess editor writes, with one answerable question. */
    function guessHtml(): string {
        const payload = JSON.stringify({
            typeGame: 'Adivina',
            wordsGame: [{ definition: 'Ciudad conquistada', word: 'Valencia', percentageShow: 0 }],
        });
        return `<div class="adivina-IDevice"><div class="adivina-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;
    }

    /** A project with one page holding some prose and one Guess activity. */
    function projectWithActivity(): ExportDocument {
        return createMockDocument([
            {
                id: 'page-1',
                title: 'El Poema de Mio Cid',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Bloque',
                        order: 0,
                        components: [
                            { id: 'c1', type: 'text', order: 0, content: '<p>El Cid</p>', properties: {} },
                            { id: 'c2', type: 'guess', order: 1, content: guessHtml(), properties: {} },
                        ],
                    },
                ],
            },
        ]);
    }

    async function preview(activities?: PrintPreviewOptions['activities']): Promise<string> {
        const result = await new PrintPreviewExporter(projectWithActivity(), resources).generatePreview({
            activities,
        });

        expect(result.success).toBe(true);
        return result.html ?? '';
    }

    for (const mode of ['in-place', 'appendix'] as const) {
        it(`prints a selected activity with a shared legacy id prefix in ${mode} mode`, async () => {
            const pages = projectWithActivity().getNavigation();
            const component = pages[0].blocks[0].components[1];
            pages[0].blocks[0].components = [
                { ...component, id: '20251021091936FIRST', order: 0 },
                { ...component, id: '20251021091936SECOND', order: 1 },
            ];

            const result = await new PrintPreviewExporter(createMockDocument(pages), resources).generatePreview({
                activities: { mode, selectedActivities: ['20251021091936SECOND'] },
            });

            expect(result.success).toBe(true);
            expect(result.html).toContain('Ciudad conquistada');
            expect(result.html).toContain('20251021091936SECOND');
            expect(result.html).not.toContain('20251021091936FIRST');
        });

        it(`keeps both listed activities with a shared legacy id prefix in ${mode} mode`, async () => {
            const pages = projectWithActivity().getNavigation();
            const component = pages[0].blocks[0].components[1];
            pages[0].blocks[0].components = [
                { ...component, id: '20251021091936FIRST', order: 0 },
                { ...component, id: '20251021091936SECOND', order: 1 },
            ];

            const result = await new PrintPreviewExporter(createMockDocument(pages), resources).generatePreview({
                activities: { mode },
            });

            expect(result.success).toBe(true);
            expect(result.html?.match(/Ciudad conquistada/g)).toHaveLength(2);
        });
    }

    it('leaves the activities of a teacher-only block out of the document, keeping its other content', async () => {
        for (const mode of [undefined, 'omit', 'in-place', 'appendix'] as const) {
            const pages = projectWithActivity().getNavigation();
            pages[0].blocks.push({
                id: 'teacher-block',
                name: 'For the teacher',
                order: 1,
                properties: { teacherOnly: 'true' },
                components: [
                    { id: 'teacher-notes', type: 'text', order: 0, content: '<p>Teacher notes</p>', properties: {} },
                    { id: 'teacher-guess', type: 'guess', order: 1, content: guessHtml(), properties: {} },
                ],
            } as ExportBlock);

            const result = await new PrintPreviewExporter(createMockDocument(pages), resources).generatePreview({
                activities: mode ? { mode } : undefined,
            });

            expect(result.success).toBe(true);
            expect(result.html).toContain('id="teacher-notes"');
            expect(result.html).not.toContain('id="teacher-guess"');
        }
    });

    it('treats the activities of a teacher-only block as any other once that content prints', async () => {
        const withTeacherBlock = () => {
            const pages = projectWithActivity().getNavigation();
            pages[0].blocks.push({
                id: 'teacher-block',
                name: 'For the teacher',
                order: 1,
                properties: { teacherOnly: 'true' },
                components: [{ id: 'teacher-guess', type: 'guess', order: 0, content: guessHtml(), properties: {} }],
            } as ExportBlock);
            return createMockDocument(pages);
        };
        const preview = async (mode: 'omit' | 'in-place' | 'appendix') => {
            const result = await new PrintPreviewExporter(withTeacherBlock(), resources).generatePreview({
                teacherOnly: true,
                activities: { mode },
            });
            expect(result.success).toBe(true);
            return result.html ?? '';
        };

        // In place, an exercise, which the raw game would not be.
        const inPlace = await preview('in-place');
        expect(inPlace).toContain('id="teacher-guess"');
        expect(inPlace.match(/Ciudad conquistada/g)).toHaveLength(2);
        // At the back with the others, a pointer left where it was.
        expect(await preview('appendix')).toContain('id="teacher-guess-appendix"');
        // And left out with the others.
        expect(await preview('omit')).not.toContain('id="teacher-guess"');
    });

    for (const mode of ['omit', 'in-place', 'appendix'] as const) {
        it(`prints two Text iDevices of a block whose ids begin alike in ${mode} mode`, async () => {
            const pages = projectWithActivity().getNavigation();
            const [text, activity] = pages[0].blocks[0].components;
            pages[0].blocks[0].components = [
                { ...text, id: 'idevice-1792142548773-k5l2boxls', order: 0, content: '<p>First text</p>' },
                { ...text, id: 'idevice-1792142582173-47ljbrp27', order: 1, content: '<p>Second text</p>' },
                { ...activity, order: 2 },
            ];

            const result = await new PrintPreviewExporter(createMockDocument(pages), resources).generatePreview({
                activities: { mode },
            });

            expect(result.success).toBe(true);
            expect(result.html).toContain('First text');
            expect(result.html).toContain('Second text');
        });
    }

    for (const mode of [undefined, 'omit', 'in-place', 'appendix'] as const) {
        it(`excludes descendants absent from the selector in ${mode ?? 'default'} mode`, async () => {
            const [visible] = projectWithActivity().getNavigation();
            const hidden = { ...visible, id: 'hidden', properties: { visibility: false } };
            const child = { ...visible, id: 'hidden-child', title: 'Hidden child', parentId: hidden.id };
            const grandchild = { ...child, id: 'hidden-grandchild', parentId: child.id };
            const pages = [visible, hidden, child, grandchild];

            const result = await new PrintPreviewExporter(createMockDocument(pages), resources).generatePreview({
                activities: mode ? { mode } : undefined,
            });

            expect(result.success).toBe(true);
            expect(result.html).not.toContain('Hidden child');
            expect(result.html).not.toContain('section-hidden');
            if (mode === 'in-place' || mode === 'appendix')
                expect(result.html?.match(/Ciudad conquistada/g)).toHaveLength(1);
        });
    }

    it('prints the game board when asked nothing, as it always did', async () => {
        const html = await preview();

        expect(html).toContain('adivina-DataGame');
        expect(html).toContain('guess.js');
        expect(html).not.toContain('worksheet-activity');
    });

    it('carries none of the worksheet styling unless an exercise needs it', async () => {
        expect(await preview()).not.toContain('.worksheet-box {');
        expect(await preview({ mode: 'omit' })).not.toContain('.worksheet-box {');
        expect(await preview({ mode: 'in-place' })).toContain('.worksheet-box {');
        // The appendix's page breaks are part of that styling, not of every printed document.
        expect(await preview()).not.toContain('#section-worksheet-appendix');
        expect(await preview({ mode: 'omit' })).not.toContain('#section-worksheet-appendix');
    });

    it('leaves the activity out when asked to', async () => {
        const html = await preview({ mode: 'omit' });

        expect(html).not.toContain('adivina-DataGame');
        expect(html).toContain('El Cid');
    });

    it('prints the exercise in place of the game board', async () => {
        const html = await preview({ mode: 'in-place' });

        expect(html).toContain('worksheet-activity');
        expect(html).toContain('Ciudad conquistada');
        expect(html).not.toContain('adivina-DataGame');
        expect(html).toContain('El Cid');
    });

    it('points into an appendix and prints the exercise there', async () => {
        const html = await preview({ mode: 'appendix', labels: { appendixTitle: 'Anexo' } });

        expect(html).toContain('See appendix, activity 1');
        expect(html).toContain('Anexo');
        expect(html).toContain('Ciudad conquistada');
        expect(html).toContain('#section-worksheet-appendix {');
        expect(html).toContain(
            '#section-worksheet-appendix .box-content > :not(:first-child):not(:has(.worksheet-activity-unprintable)) {',
        );
    });

    it('asks for no iDevice files for markup that needs none', async () => {
        const html = await preview({ mode: 'in-place' });

        // The converted component carries finished markup; a script or stylesheet for it would
        // be a 404 in the printed document.
        expect(html).not.toContain('worksheet-activity.js');
        expect(html).not.toContain('worksheet-activity.css');
        // The activity it replaced no longer needs its own script either.
        expect(html).not.toContain('guess.js');
    });
});

describe('the printing context in the document', () => {
    const page = (): ExportPage => ({
        id: 'page-1',
        title: 'Home',
        parentId: null,
        order: 0,
        blocks: [],
    });

    it('tells a script that this document was built to be printed', async () => {
        const exporter = new PrintPreviewExporter(createMockDocument([page()]), createMockResourceProvider());
        const { html = '' } = await exporter.generatePreview();

        expect(html).toContain('"kind":"document"');
        expect(html).toContain("root.setAttribute('data-exe-print'");
    });

    it('says what became of the interactive activities', async () => {
        const exporter = new PrintPreviewExporter(createMockDocument([page()]), createMockResourceProvider());
        const { html = '' } = await exporter.generatePreview({
            activities: { mode: 'appendix', labels: {}, ideviceTitles: {} },
        });

        expect(html).toContain('"activities":"appendix"');
    });

    it('reports no activity mode when the author was never asked', async () => {
        const exporter = new PrintPreviewExporter(createMockDocument([page()]), createMockResourceProvider());
        const { html = '' } = await exporter.generatePreview();

        expect(html).toContain('"activities":null');
    });

    it('sets it after the runtime has defined itself, never before', async () => {
        // exe_export.js builds the whole runtime only when the global is absent, so a stub set
        // ahead of it would leave the resource with no runtime at all.
        const exporter = new PrintPreviewExporter(createMockDocument([page()]), createMockResourceProvider());
        const { html = '' } = await exporter.generatePreview();

        expect(html.indexOf('libs/exe_export.js')).toBeLessThan(html.indexOf('runtime.printing'));
        expect(html.indexOf('runtime.printing')).toBeLessThan(html.indexOf('</head>'));
        expect(html.indexOf('runtime.printing')).toBeLessThan(html.indexOf('/style.js'));
        expect(html.indexOf('runtime.printing')).toBeLessThan(html.indexOf('bootstrap.bundle.min.js'));
    });

    it('provides the context before an iDevice script executes', async () => {
        const withActivity = page();
        withActivity.blocks = [{ id: 'b', order: 0, components: [{ id: 'c', type: 'relate', order: 0, content: '' }] }];
        const exporter = new PrintPreviewExporter(createMockDocument([withActivity]), createMockResourceProvider());
        const { html = '' } = await exporter.generatePreview();
        expect(html).toContain('relate.js');
        expect(html.indexOf('runtime.printing')).toBeLessThan(html.indexOf('relate.js'));
    });
});

describe('the molecules the document has to draw before it can convert them', () => {
    const MODEL = '\n  Mrv  \n\n  1  0  0  0  0  0            999 V2000\n';
    const PICTURE = 'data:image/png;base64,iVBORw0KGgo=';

    /** Component HTML as the 3D molecules editor writes it: a model, and no picture of it. */
    function moleculeHtml(): string {
        const payload = JSON.stringify({
            typeGame: '3DMol',
            activityMode: 'show',
            selectsGame: [{ modelData: MODEL, modelFormat: 'sdf', description: 'Glucosa' }],
        });
        return `<div class="dmole-IDevice"><div class="dmole-DataGame js-hidden">${encryptDataGame(payload)}</div></div>`;
    }

    /** One block with a molecule activity for each of the given components. */
    function projectWithMolecule(components: Partial<ExportComponent>[] = [{ id: 'c1' }]): ExportDocument {
        return createMockDocument([
            {
                id: 'page-1',
                title: 'Química',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'b1',
                        name: 'Bloque',
                        order: 0,
                        components: components.map((component, order) => ({
                            id: `c${order + 1}`,
                            type: '3dmol',
                            order,
                            content: moleculeHtml(),
                            properties: {},
                            ...component,
                        })),
                    },
                ],
            },
        ]);
    }

    async function preview(options: PrintPreviewOptions, components?: Partial<ExportComponent>[]): Promise<string> {
        const result = await new PrintPreviewExporter(
            projectWithMolecule(components),
            createMockResourceProvider(),
        ).generatePreview(options);

        expect(result.success).toBe(true);
        return result.html ?? '';
    }

    it('draws each molecule before the activity is converted', async () => {
        const html = await preview({
            activities: { mode: 'in-place', labels: {}, ideviceTitles: {} },
            captureMolecule: async () => PICTURE,
        });

        expect(html).toContain('worksheet-activity');
        expect(html).toContain(PICTURE);
        expect(html).toContain('Glucosa');
    });

    it('draws nothing when the document is printing as it stands', async () => {
        // There is no exercise to put a picture in: the page carries the viewer itself.
        let asked = 0;
        const html = await preview({
            captureMolecule: async () => (asked++, PICTURE),
        });

        expect(asked).toBe(0);
        expect(html).toContain('dmole-DataGame');
    });

    it('draws nothing when the activities are left out', async () => {
        const drawn: unknown[] = [];
        await preview({
            activities: { mode: 'omit', labels: {}, ideviceTitles: {} },
            captureMolecule: async view => {
                drawn.push(view);
                return PICTURE;
            },
        });

        expect(drawn).toEqual([]);
    });

    it('draws only the molecules of the activities it converts', async () => {
        // Left unticked, hidden or for teachers only, an activity prints as it is or not at all,
        // so a picture of its molecule would go nowhere. Each drawing costs a graphics context.
        const drawn: unknown[] = [];
        const html = await preview(
            {
                activities: { mode: 'in-place', labels: {}, ideviceTitles: {}, selectedActivities: ['c2', 'c3', 'c4'] },
                captureMolecule: async view => {
                    drawn.push(view);
                    return PICTURE;
                },
            },
            [
                {},
                {},
                { structureProperties: { visibility: 'false' } },
                { structureProperties: { teacherOnly: 'true' } },
            ],
        );

        expect(drawn).toHaveLength(1);
        expect(html).toContain(PICTURE);
        // The hidden one still carries its own payload, with no picture written into it. The one for
        // teachers is not in the document at all: teacher-only activities never print.
        expect(html.match(/dmole-DataGame/g)).toHaveLength(1);
    });

    it('converts what it can when nothing is there to draw', async () => {
        const html = await preview({ activities: { mode: 'in-place', labels: {}, ideviceTitles: {} } });

        expect(html).not.toContain('dmole-DataGame');
        expect(html).not.toContain(PICTURE);
    });
});
