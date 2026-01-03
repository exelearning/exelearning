/**
 * Html5Exporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Html5Exporter } from './Html5Exporter';
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
        files.set('content.css', Buffer.from('/* theme css */'));
        files.set('default.js', Buffer.from('// theme js'));
        return files;
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('jquery/jquery.min.js', Buffer.from('// jquery'));
        files.set('common.js', Buffer.from('// common'));
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

    async fetchContentCss(): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        files.set('content/css/base.css', Buffer.from('/* base css */'));
        return files;
    }
}

// Mock asset provider
class MockAssetProvider implements AssetProvider {
    async getAsset(_path: string): Promise<Buffer | null> {
        return null;
    }

    async getAllAssets(): Promise<
        Array<{
            id: string;
            filename: string;
            path: string;
            mimeType: string;
            data: Buffer;
        }>
    > {
        return [];
    }
}

// Mock zip provider
class MockZipProvider implements ZipProvider {
    files = new Map<string, string | Buffer>();

    addFile(path: string, content: string | Buffer): void {
        this.files.set(path, content);
    }

    async generateAsync(): Promise<Buffer> {
        // Create actual ZIP for realistic testing using fflate
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
                    },
                ],
            },
        ],
    },
];

describe('Html5Exporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: Html5Exporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new Html5Exporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file extension', () => {
            expect(exporter.getFileExtension()).toBe('.zip');
        });

        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('_web');
        });
    });

    describe('Export Process', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data).toBeInstanceOf(Uint8Array);
        });

        it('should generate index.html for first page', async () => {
            await exporter.export();

            expect(zip.files.has('index.html')).toBe(true);
            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('<!DOCTYPE html>');
            expect(indexHtml).toContain('Introduction');
        });

        it('should generate HTML files for other pages', async () => {
            await exporter.export();

            // Second page should be in html/ directory
            const htmlFiles = Array.from(zip.files.keys()).filter(f => f.startsWith('html/'));
            expect(htmlFiles.length).toBe(1);
        });

        it('should include content.xml', async () => {
            await exporter.export();

            expect(zip.files.has('content.xml')).toBe(true);
            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<?xml');
            expect(contentXml).toContain('<ode');
        });

        it('should include base CSS', async () => {
            await exporter.export();

            expect(zip.files.has('content/css/base.css')).toBe(true);
        });

        it('should include theme files', async () => {
            await exporter.export();

            expect(zip.files.has('theme/content.css')).toBe(true);
            expect(zip.files.has('theme/default.js')).toBe(true);
        });

        it('should include library references in HTML', async () => {
            await exporter.export();

            // HTML should reference libs (even if mock doesn't fetch them)
            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('libs/jquery');
            expect(indexHtml).toContain('libs/common.js');
        });

        it('should use custom filename when provided', async () => {
            const result = await exporter.export({ filename: 'my-export.zip' });

            expect(result.success).toBe(true);
            expect(result.filename).toBe('my-export.zip');
        });

        it('should build filename from metadata', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('test-project');
            expect(result.filename).toContain('_web');
        });
    });

    describe('HTML Page Generation', () => {
        it('should generate page HTML with correct structure', () => {
            const html = exporter.generatePageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html');
            expect(html).toContain('lang="en"');
            expect(html).toContain('<head>');
            expect(html).toContain('<body');
        });

        it('should include project title in page HTML', () => {
            const html = exporter.generatePageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('Test Project');
        });

        it('should include page content', () => {
            const html = exporter.generatePageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('Welcome to the course');
        });

        it('should use correct base path for index page', () => {
            const html = exporter.generatePageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            // Index page should have no base path prefix
            expect(html).toContain('href="theme/');
            expect(html).not.toContain('href="../theme/');
        });

        it('should use correct base path for other pages', () => {
            const html = exporter.generatePageHtml(samplePages[1], samplePages, document.getMetadata(), false);

            // Other pages should have ../ prefix
            expect(html).toContain('href="../theme/');
        });
    });

    describe('Page Link Generation', () => {
        it('should generate link for first page', () => {
            const link = exporter.getPageLinkForHtml5(samplePages[0], samplePages, '');
            expect(link).toBe('index.html');
        });

        it('should generate link for first page with base path', () => {
            const link = exporter.getPageLinkForHtml5(samplePages[0], samplePages, '../');
            expect(link).toBe('../index.html');
        });

        it('should generate link for other pages', () => {
            const link = exporter.getPageLinkForHtml5(samplePages[1], samplePages, '');
            expect(link).toContain('html/');
            expect(link).toContain('.html');
        });
    });

    describe('Error Handling', () => {
        it('should handle empty pages array', async () => {
            document = new MockDocument({}, []);
            exporter = new Html5Exporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should handle export with metadata only (no title)', async () => {
            document = new MockDocument({ title: '' }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should catch and return errors', async () => {
            // Create a failing zip provider
            const failingZip: ZipProvider = {
                addFile: () => {},
                generateAsync: async () => {
                    throw new Error('ZIP generation failed');
                },
            };
            exporter = new Html5Exporter(document, resources, assets, failingZip);

            const result = await exporter.export();
            expect(result.success).toBe(false);
            expect(result.error).toContain('ZIP generation failed');
        });
    });

    describe('ZIP Validation', () => {
        it('should produce valid ZIP file', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify it's a valid ZIP by loading with fflate
            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(Object.keys(loadedZip).length).toBeGreaterThan(0);
        });

        it('should include index.html in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['index.html']).toBeDefined();
        });

        it('should include content.xml in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

            expect(loadedZip['content.xml']).toBeDefined();
        });
    });

    describe('Theme and Library Integration', () => {
        it('should handle theme fetch failure gracefully', async () => {
            // Override fetchTheme to throw
            resources.fetchTheme = async () => {
                throw new Error('Theme not found');
            };

            const result = await exporter.export();

            // Should still succeed with fallback (uses legacy names: content.css, default.js)
            expect(result.success).toBe(true);
            expect(zip.files.has('theme/content.css')).toBe(true);
        });

        it('should handle library fetch failure gracefully', async () => {
            // Override fetchLibraryFiles to throw
            resources.fetchLibraryFiles = async () => {
                throw new Error('Libraries not found');
            };

            const result = await exporter.export();

            // Should still succeed
            expect(result.success).toBe(true);
        });
    });

    describe('LaTeX Pre-Rendering', () => {
        it('should call preRenderLatex hook when provided', async () => {
            let preRenderCalled = false;
            let pagesProcessed = 0;

            const result = await exporter.export({
                preRenderLatex: async (html: string) => {
                    preRenderCalled = true;
                    pagesProcessed++;
                    return {
                        html: html.replace('<p>Welcome', '<p class="exe-math-rendered">Welcome'),
                        hasLatex: true,
                        latexRendered: true,
                        count: 1,
                    };
                },
            });

            expect(result.success).toBe(true);
            expect(preRenderCalled).toBe(true);
            expect(pagesProcessed).toBe(samplePages.length);
        });

        it('should include LaTeX CSS when preRenderLatex succeeds', async () => {
            await exporter.export({
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: true,
                    latexRendered: true,
                    count: 5,
                }),
            });

            // Check that base CSS includes LaTeX styles
            const baseCss = zip.files.get('content/css/base.css');
            expect(baseCss).toBeDefined();
            const cssContent = typeof baseCss === 'string' ? baseCss : new TextDecoder().decode(baseCss as Buffer);
            expect(cssContent).toContain('.exe-math-rendered');
        });

        it('should not include LaTeX CSS when no latex was rendered', async () => {
            await exporter.export({
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: false,
                    latexRendered: false,
                    count: 0,
                }),
            });

            // Check that base CSS does NOT include LaTeX styles
            const baseCss = zip.files.get('content/css/base.css');
            expect(baseCss).toBeDefined();
            const cssContent = typeof baseCss === 'string' ? baseCss : new TextDecoder().decode(baseCss as Buffer);
            expect(cssContent).not.toContain('.exe-math-rendered');
        });

        it('should handle preRenderLatex errors gracefully', async () => {
            const result = await exporter.export({
                preRenderLatex: async () => {
                    throw new Error('MathJax not available');
                },
            });

            // Should still succeed even if LaTeX pre-rendering fails
            expect(result.success).toBe(true);
        });

        it('should modify HTML content when LaTeX is rendered', async () => {
            await exporter.export({
                preRenderLatex: async (html: string) => ({
                    html: html.replace('<p>Welcome to the course.</p>', '<span class="exe-math-rendered">E=mc²</span>'),
                    hasLatex: true,
                    latexRendered: true,
                    count: 1,
                }),
            });

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('exe-math-rendered');
            expect(indexHtml).toContain('E=mc²');
        });

        it('should return correct CSS for pre-rendered LaTeX', () => {
            const css = exporter['getPreRenderedLatexCss']();

            expect(css).toContain('.exe-math-rendered');
            expect(css).toContain('display: inline-block');
            expect(css).toContain('svg');
            expect(css).toContain('math');
        });
    });

    describe('Asset Inclusion', () => {
        it('should include assets in content/resources/ folder', async () => {
            // Create asset provider that returns actual assets
            const assetsWithData: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'uuid-123',
                            filename: 'image.png',
                            originalPath: 'uuid-123/image.png',
                            mime: 'image/png',
                            data: Buffer.from('fake-image-data'),
                        },
                        {
                            id: 'uuid-456',
                            filename: 'photo.jpg',
                            originalPath: 'uuid-456/photo.jpg',
                            mime: 'image/jpeg',
                            data: Buffer.from('fake-photo-data'),
                        },
                    ];
                },
            };

            // Create new exporter with assets
            const exporterWithAssets = new Html5Exporter(document, resources, assetsWithData, zip);
            const result = await exporterWithAssets.export();

            expect(result.success).toBe(true);

            // Verify assets are in content/resources/ folder
            expect(zip.files.has('content/resources/uuid-123/image.png')).toBe(true);
            expect(zip.files.has('content/resources/uuid-456/photo.jpg')).toBe(true);

            // Verify asset data is correct
            const imageData = zip.files.get('content/resources/uuid-123/image.png') as Buffer;
            expect(imageData.toString()).toBe('fake-image-data');
        });

        it('should handle empty asset list gracefully', async () => {
            const result = await exporter.export();

            // Should succeed even with no assets
            expect(result.success).toBe(true);
        });

        it('should normalize asset paths correctly', async () => {
            // Asset with content/resources/ prefix already (from ELP import)
            const assetsWithPrefix: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'abc',
                            filename: 'file.pdf',
                            originalPath: 'content/resources/abc/file.pdf', // Already has prefix
                            mime: 'application/pdf',
                            data: Buffer.from('pdf-data'),
                        },
                    ];
                },
            };

            const exporterWithPrefixedAssets = new Html5Exporter(document, resources, assetsWithPrefix, zip);
            await exporterWithPrefixedAssets.export();

            // Should NOT double-prefix (not content/resources/content/resources/...)
            expect(zip.files.has('content/resources/abc/file.pdf')).toBe(true);
            expect(zip.files.has('content/resources/content/resources/abc/file.pdf')).toBe(false);
        });
    });

    describe('addMathJax export option', () => {
        it('should skip preRenderLatex when addMathJax=true', async () => {
            // Create document with addMathJax enabled
            document = new MockDocument({ addMathJax: true }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            let preRenderWasCalled = false;

            await exporter.export({
                preRenderLatex: async (html: string) => {
                    preRenderWasCalled = true;
                    return {
                        html,
                        hasLatex: true,
                        latexRendered: true,
                        count: 1,
                    };
                },
            });

            // preRenderLatex should NOT be called when addMathJax is true
            expect(preRenderWasCalled).toBe(false);
        });

        it('should call preRenderLatex when addMathJax=false', async () => {
            // Create document with addMathJax disabled
            document = new MockDocument({ addMathJax: false }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            let preRenderWasCalled = false;

            await exporter.export({
                preRenderLatex: async (html: string) => {
                    preRenderWasCalled = true;
                    return {
                        html,
                        hasLatex: true,
                        latexRendered: true,
                        count: 1,
                    };
                },
            });

            // preRenderLatex SHOULD be called when addMathJax is false
            expect(preRenderWasCalled).toBe(true);
        });

        it('should also skip preRenderDataGameLatex when addMathJax=true', async () => {
            document = new MockDocument({ addMathJax: true }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            let dataGamePreRenderCalled = false;

            await exporter.export({
                preRenderDataGameLatex: async (html: string) => {
                    dataGamePreRenderCalled = true;
                    return { html, count: 0 };
                },
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: false,
                    latexRendered: false,
                    count: 0,
                }),
            });

            // preRenderDataGameLatex should NOT be called when addMathJax is true
            expect(dataGamePreRenderCalled).toBe(false);
        });

        it('should call preRenderDataGameLatex when addMathJax=false', async () => {
            document = new MockDocument({ addMathJax: false }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            let dataGamePreRenderCalled = false;

            await exporter.export({
                preRenderDataGameLatex: async (html: string) => {
                    dataGamePreRenderCalled = true;
                    return { html, count: 0 };
                },
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: false,
                    latexRendered: false,
                    count: 0,
                }),
            });

            // preRenderDataGameLatex SHOULD be called when addMathJax is false
            expect(dataGamePreRenderCalled).toBe(true);
        });

        it('should not include pre-rendered LaTeX CSS when addMathJax=true', async () => {
            document = new MockDocument({ addMathJax: true }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export({
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: true,
                    latexRendered: true,
                    count: 5,
                }),
            });

            // Since preRenderLatex was skipped, CSS should NOT include LaTeX styles
            const baseCss = zip.files.get('content/css/base.css');
            expect(baseCss).toBeDefined();
            const cssContent = typeof baseCss === 'string' ? baseCss : new TextDecoder().decode(baseCss as Buffer);
            expect(cssContent).not.toContain('.exe-math-rendered');
        });
    });

    describe('Mermaid Pre-Rendering', () => {
        it('should call preRenderMermaid hook when provided', async () => {
            let preRenderCalled = false;
            let pagesProcessed = 0;

            const result = await exporter.export({
                preRenderMermaid: async (html: string) => {
                    preRenderCalled = true;
                    pagesProcessed++;
                    return {
                        html,
                        hasMermaid: true,
                        mermaidRendered: true,
                        count: 1,
                    };
                },
            });

            expect(result.success).toBe(true);
            expect(preRenderCalled).toBe(true);
            expect(pagesProcessed).toBe(samplePages.length);
        });

        it('should include Mermaid CSS when preRenderMermaid succeeds', async () => {
            await exporter.export({
                preRenderMermaid: async (html: string) => ({
                    html,
                    hasMermaid: true,
                    mermaidRendered: true,
                    count: 1,
                }),
            });

            const baseCss = zip.files.get('content/css/base.css');
            expect(baseCss).toBeDefined();
            const cssContent = typeof baseCss === 'string' ? baseCss : new TextDecoder().decode(baseCss as Buffer);
            expect(cssContent).toContain('.exe-mermaid-rendered');
        });

        it('should not include Mermaid CSS when no mermaid was rendered', async () => {
            await exporter.export({
                preRenderMermaid: async (html: string) => ({
                    html,
                    hasMermaid: false,
                    mermaidRendered: false,
                    count: 0,
                }),
            });

            const baseCss = zip.files.get('content/css/base.css');
            expect(baseCss).toBeDefined();
            const cssContent = typeof baseCss === 'string' ? baseCss : new TextDecoder().decode(baseCss as Buffer);
            expect(cssContent).not.toContain('.exe-mermaid-rendered');
        });

        it('should handle preRenderMermaid errors gracefully', async () => {
            const result = await exporter.export({
                preRenderMermaid: async () => {
                    throw new Error('Mermaid not available');
                },
            });

            // Should still succeed - errors are caught and logged
            expect(result.success).toBe(true);
        });

        it('should modify HTML content when Mermaid is rendered', async () => {
            await exporter.export({
                preRenderMermaid: async (html: string) => ({
                    html: html.replace('<pre class="mermaid">', '<div class="exe-mermaid-rendered"><svg>'),
                    hasMermaid: true,
                    mermaidRendered: true,
                    count: 1,
                }),
            });

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toBeDefined();
        });
    });

    describe('Download Source File Support (ELPX manifest)', () => {
        it('should not create manifest file when download-source-file is not used', async () => {
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // Should NOT have manifest script reference
            expect(indexHtml).not.toContain('elpx-manifest.js');
            // Should NOT have manifest file
            expect(zip.files.has('libs/elpx-manifest.js')).toBe(false);
        });

        it('should create manifest file when download-source-file iDevice is used (by type)', async () => {
            // Create pages with download-source-file iDevice
            const pagesWithDownload: ExportPage[] = [
                {
                    id: 'page1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp1',
                                    type: 'download-source-file',
                                    order: 0,
                                    content: '<p>Download content</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithDownload);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // Should have script tag referencing manifest file
            expect(indexHtml).toContain('<script src="libs/elpx-manifest.js">');

            // Should have manifest file
            expect(zip.files.has('libs/elpx-manifest.js')).toBe(true);
            const manifestJs = zip.files.get('libs/elpx-manifest.js') as string;
            expect(manifestJs).toContain('window.__ELPX_MANIFEST__');
            // Should contain file list
            expect(manifestJs).toContain('"files"');
            expect(manifestJs).toContain('"content.xml"');
            expect(manifestJs).toContain('"index.html"');
        });

        it('should create manifest file when download-source-file class is in content', async () => {
            // Create pages with download-source-file class in content
            const pagesWithDownloadClass: ExportPage[] = [
                {
                    id: 'page1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp1',
                                    type: 'FreeTextIdevice',
                                    order: 0,
                                    content: '<p class="exe-download-package-link"><a href="#">Download</a></p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithDownloadClass);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // Should have script tag referencing manifest file
            expect(indexHtml).toContain('<script src="libs/elpx-manifest.js">');
            // Should have manifest file
            expect(zip.files.has('libs/elpx-manifest.js')).toBe(true);
        });

        it('should not include content.xml in manifest when exportSource=false', async () => {
            // Create pages with download-source-file but exportSource disabled
            const pagesWithDownload: ExportPage[] = [
                {
                    id: 'page1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp1',
                                    type: 'download-source-file',
                                    order: 0,
                                    content: '<p>Download</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({ exportSource: false }, pagesWithDownload);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            // Should have manifest file
            expect(zip.files.has('libs/elpx-manifest.js')).toBe(true);
            const manifestJs = zip.files.get('libs/elpx-manifest.js') as string;
            expect(manifestJs).toContain('window.__ELPX_MANIFEST__');
            // But content.xml should NOT be in the file list
            expect(manifestJs).not.toContain('"content.xml"');
        });

        it('should properly escape special characters in manifest JSON', async () => {
            // Create pages with content containing special characters
            const pagesWithSpecialChars: ExportPage[] = [
                {
                    id: 'page1',
                    title: 'Test\'s "Project" <Symbols>',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp1',
                                    type: 'download-source-file',
                                    order: 0,
                                    content: '<p>Click to download</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({ title: 'Test\'s "Project"' }, pagesWithSpecialChars);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // Should have script reference
            expect(indexHtml).toContain('<script src="libs/elpx-manifest.js">');

            // Check manifest file
            expect(zip.files.has('libs/elpx-manifest.js')).toBe(true);
            const manifestJs = zip.files.get('libs/elpx-manifest.js') as string;
            expect(manifestJs).toContain('window.__ELPX_MANIFEST__');
            // Project title should be properly escaped in JSON (quotes escaped)
            expect(manifestJs).toContain('"projectTitle": "Test\'s \\"Project\\""');
        });

        it('should track all exported files in manifest', async () => {
            // Create pages with download-source-file iDevice
            const pagesWithDownload: ExportPage[] = [
                {
                    id: 'page1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp1',
                                    type: 'download-source-file',
                                    order: 0,
                                    content: '<p>Download content</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithDownload);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            // Check manifest file
            expect(zip.files.has('libs/elpx-manifest.js')).toBe(true);
            const manifestJs = zip.files.get('libs/elpx-manifest.js') as string;

            // Extract manifest from JS file
            const manifestMatch = manifestJs.match(/window\.__ELPX_MANIFEST__=(\{[\s\S]*?\});/);
            expect(manifestMatch).toBeTruthy();

            const manifest = JSON.parse(manifestMatch![1]);

            // Verify manifest structure
            expect(manifest.version).toBe(1);
            expect(manifest.files).toBeInstanceOf(Array);
            expect(manifest.projectTitle).toBe('Test Project');

            // Verify essential files are tracked
            expect(manifest.files).toContain('content.xml');
            expect(manifest.files).toContain('content/css/base.css');
            expect(manifest.files).toContain('index.html');
        });

        it('should only add manifest script to pages with download-source-file iDevice', async () => {
            // Create multiple pages, only one with download-source-file
            const mixedPages: ExportPage[] = [
                {
                    id: 'page1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp1',
                                    type: 'text',
                                    order: 0,
                                    content: '<p>Regular text content</p>',
                                },
                            ],
                        },
                    ],
                },
                {
                    id: 'page2',
                    title: 'Page 2',
                    parentId: null,
                    order: 1,
                    blocks: [
                        {
                            id: 'block2',
                            name: 'Block 2',
                            order: 0,
                            components: [
                                {
                                    id: 'comp2',
                                    type: 'download-source-file',
                                    order: 0,
                                    content: '<p class="exe-download-package-link">Download</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, mixedPages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            // Manifest file should exist
            expect(zip.files.has('libs/elpx-manifest.js')).toBe(true);

            // First page (no download-source-file) should NOT have manifest script
            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).not.toContain('elpx-manifest.js');

            // Second page (has download-source-file) SHOULD have manifest script
            // sanitizePageFilename converts "Page 2" to "page-2"
            const page2Html = zip.files.get('html/page-2.html') as string;
            expect(page2Html).toContain('elpx-manifest.js');
        });
    });

    describe('Search Box Support', () => {
        it('should create search_index.js when addSearchBox is enabled', async () => {
            // Create document with addSearchBox enabled
            document = new MockDocument({ addSearchBox: true }, [
                {
                    id: 'page1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [
                        {
                            id: 'block1',
                            name: 'Block 1',
                            order: 0,
                            components: [
                                {
                                    id: 'comp1',
                                    type: 'text',
                                    order: 0,
                                    content: '<p>Some searchable content</p>',
                                },
                            ],
                        },
                    ],
                },
            ]);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            // Should have search_index.js file
            expect(zip.files.has('search_index.js')).toBe(true);
            const searchIndex = zip.files.get('search_index.js') as string;
            expect(searchIndex).toContain('exeSearchData');
        });

        it('should not create search_index.js when addSearchBox is disabled', async () => {
            // Create document with addSearchBox disabled (default)
            document = new MockDocument({ addSearchBox: false }, [
                {
                    id: 'page1',
                    title: 'Page 1',
                    parentId: null,
                    order: 0,
                    blocks: [],
                },
            ]);
            exporter = new Html5Exporter(document, resources, assets, zip);

            await exporter.export();

            // Should NOT have search_index.js file
            expect(zip.files.has('search_index.js')).toBe(false);
        });
    });
});
