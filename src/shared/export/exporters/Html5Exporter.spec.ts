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
    faviconToReturn: string | null = null;

    async fetchTheme(_name: string): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        // Theme files keep their original names (style.css, style.js)
        files.set('style.css', Buffer.from('/* theme css */'));
        files.set('style.js', Buffer.from('// theme js'));

        if (this.faviconToReturn === 'ico') {
            files.set('img/favicon.ico', Buffer.from('ico-data'));
        } else if (this.faviconToReturn === 'png') {
            files.set('img/favicon.png', Buffer.from('png-data'));
        }

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

    async fetchScormSchemas(_version: '1.2' | '2004'): Promise<Map<string, Uint8Array>> {
        return new Map();
    }

    async fetchGlobalFontFiles(fontId: string): Promise<Map<string, Buffer>> {
        if (!fontId || fontId === 'default') {
            return new Map();
        }
        const files = new Map<string, Buffer>();
        if (fontId === 'opendyslexic') {
            files.set('fonts/global/opendyslexic/OpenDyslexic-Regular.woff', Buffer.from('mock-font-data'));
            files.set('fonts/global/opendyslexic/OFL.txt', Buffer.from('SIL OFL License'));
        } else if (fontId === 'playwrite-es') {
            files.set('fonts/global/playwrite-es/PlaywriteES-Regular.woff2', Buffer.from('mock-playwrite-font'));
            files.set('fonts/global/playwrite-es/OFL.txt', Buffer.from('SIL OFL License'));
        }
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
            originalPath: string;
            folderPath?: string;
            mime: string;
            data: Buffer;
        }>
    > {
        return [];
    }

    async getProjectAssets(): Promise<
        Array<{
            id: string;
            filename: string;
            originalPath: string;
            folderPath?: string;
            mime: string;
            data: Buffer;
        }>
    > {
        return this.getAllAssets();
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

        it('should include theme files with original names (not renamed)', async () => {
            await exporter.export();

            // Theme file names should be preserved as-is
            expect(zip.files.has('theme/style.css')).toBe(true);
            expect(zip.files.has('theme/style.js')).toBe(true);
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

    describe('Favicon Detection', () => {
        it('should detect theme favicon.ico in export', async () => {
            resources.faviconToReturn = 'ico';
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('<link rel="icon" type="image/x-icon" href="theme/img/favicon.ico">');
        });

        it('should detect theme favicon.png in export', async () => {
            resources.faviconToReturn = 'png';
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('<link rel="icon" type="image/png" href="theme/img/favicon.png">');
        });

        it('should detect theme favicon.ico in generateForPreview', async () => {
            resources.faviconToReturn = 'ico';
            const files = await exporter.generateForPreview();

            const indexHtmlBytes = files.get('index.html') as Uint8Array;
            const indexHtml = new TextDecoder().decode(indexHtmlBytes);
            expect(indexHtml).toContain('<link rel="icon" type="image/x-icon" href="theme/img/favicon.ico">');
        });

        it('should use default favicon when theme one is missing', async () => {
            resources.faviconToReturn = null;
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('<link rel="icon" type="image/x-icon" href="libs/favicon.ico">');
        });

        it('should allow overriding favicon in options', async () => {
            await exporter.export({
                faviconPath: 'custom/favicon.png',
                faviconType: 'image/png',
            } as any);

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('<link rel="icon" type="image/png" href="custom/favicon.png">');
        });
    });

    describe('Theme and Library Integration', () => {
        it('should handle theme fetch failure gracefully', async () => {
            // Override fetchTheme to throw
            resources.fetchTheme = async () => {
                throw new Error('Theme not found');
            };

            const result = await exporter.export();

            // Should still succeed with fallback (uses style.css, style.js)
            expect(result.success).toBe(true);
            expect(zip.files.has('theme/style.css')).toBe(true);
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
        it('should include assets in content/resources/ folder using folderPath', async () => {
            // Create asset provider that returns actual assets with folderPath
            const assetsWithData: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'uuid-123',
                            filename: 'image.png',
                            originalPath: 'images/image.png',
                            folderPath: 'images',
                            mime: 'image/png',
                            data: Buffer.from('fake-image-data'),
                        },
                        {
                            id: 'uuid-456',
                            filename: 'photo.jpg',
                            originalPath: 'photo.jpg',
                            folderPath: '', // Root level
                            mime: 'image/jpeg',
                            data: Buffer.from('fake-photo-data'),
                        },
                    ];
                },
                async getProjectAssets() {
                    return this.getAllAssets();
                },
            };

            // Create new exporter with assets
            const exporterWithAssets = new Html5Exporter(document, resources, assetsWithData, zip);
            const result = await exporterWithAssets.export();

            expect(result.success).toBe(true);

            // Verify assets are in content/resources/ folder using folderPath structure
            expect(zip.files.has('content/resources/images/image.png')).toBe(true);
            expect(zip.files.has('content/resources/photo.jpg')).toBe(true);

            // Verify asset data is correct
            const imageData = zip.files.get('content/resources/images/image.png') as Buffer;
            expect(imageData.toString()).toBe('fake-image-data');
        });

        it('should handle empty asset list gracefully', async () => {
            const result = await exporter.export();

            // Should succeed even with no assets
            expect(result.success).toBe(true);
        });

        it('should export root assets directly under content/resources/', async () => {
            // Assets without folderPath (at root level)
            const assetsWithoutFolder: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'abc',
                            filename: 'file.pdf',
                            originalPath: 'file.pdf',
                            folderPath: '', // Root level
                            mime: 'application/pdf',
                            data: Buffer.from('pdf-data'),
                        },
                    ];
                },
                async getProjectAssets() {
                    return this.getAllAssets();
                },
            };

            const exporterWithRootAssets = new Html5Exporter(document, resources, assetsWithoutFolder, zip);
            await exporterWithRootAssets.export();

            // Should be directly under content/resources/ (no subfolder)
            expect(zip.files.has('content/resources/file.pdf')).toBe(true);
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

        it('should include libs/elpx-manifest.js in the manifest file list', async () => {
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

            const manifestJs = zip.files.get('libs/elpx-manifest.js') as string;
            const manifestMatch = manifestJs.match(/window\.__ELPX_MANIFEST__=(\{[\s\S]*?\});/);
            expect(manifestMatch).toBeTruthy();

            const manifest = JSON.parse(manifestMatch![1]);
            expect(manifest.files).toContain('libs/elpx-manifest.js');
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

    describe('FolderPath-based Asset Export', () => {
        it('should export assets using folderPath structure', async () => {
            // Create asset provider that returns assets with folderPath
            const assetsWithFolderPath: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'uuid-img-1',
                            filename: 'photo.jpg',
                            originalPath: 'images/photo.jpg',
                            folderPath: 'images',
                            mime: 'image/jpeg',
                            data: Buffer.from('photo-data'),
                        },
                        {
                            id: 'uuid-css-1',
                            filename: 'custom.css',
                            originalPath: 'css/custom.css',
                            folderPath: 'css',
                            mime: 'text/css',
                            data: Buffer.from('css-data'),
                        },
                        {
                            id: 'uuid-root-1',
                            filename: 'logo.png',
                            originalPath: 'logo.png',
                            folderPath: '', // Root level
                            mime: 'image/png',
                            data: Buffer.from('logo-data'),
                        },
                    ];
                },
                async getProjectAssets() {
                    return this.getAllAssets();
                },
            };

            const exporterWithFolderAssets = new Html5Exporter(document, resources, assetsWithFolderPath, zip);
            const result = await exporterWithFolderAssets.export();

            expect(result.success).toBe(true);

            // Assets with folderPath should be at content/resources/{folderPath}/{filename}
            expect(zip.files.has('content/resources/images/photo.jpg')).toBe(true);
            expect(zip.files.has('content/resources/css/custom.css')).toBe(true);

            // Root assets (empty folderPath) should be at content/resources/{filename}
            expect(zip.files.has('content/resources/logo.png')).toBe(true);

            // Should NOT use UUID folders
            expect(zip.files.has('content/resources/uuid-img-1/photo.jpg')).toBe(false);
            expect(zip.files.has('content/resources/uuid-css-1/custom.css')).toBe(false);
            expect(zip.files.has('content/resources/uuid-root-1/logo.png')).toBe(false);
        });

        it('should handle filename collisions in same folder', async () => {
            // Create assets with same filename in same folder
            const assetsWithCollisions: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'uuid-1',
                            filename: 'image.png',
                            originalPath: 'images/image.png',
                            folderPath: 'images',
                            mime: 'image/png',
                            data: Buffer.from('first-image'),
                        },
                        {
                            id: 'uuid-2',
                            filename: 'image.png', // Same filename!
                            originalPath: 'images/image.png',
                            folderPath: 'images',
                            mime: 'image/png',
                            data: Buffer.from('second-image'),
                        },
                        {
                            id: 'uuid-3',
                            filename: 'image.png', // Third with same name!
                            originalPath: 'images/image.png',
                            folderPath: 'images',
                            mime: 'image/png',
                            data: Buffer.from('third-image'),
                        },
                    ];
                },
                async getProjectAssets() {
                    return this.getAllAssets();
                },
            };

            const exporterWithCollisions = new Html5Exporter(document, resources, assetsWithCollisions, zip);
            const result = await exporterWithCollisions.export();

            expect(result.success).toBe(true);

            // First file should have original name
            expect(zip.files.has('content/resources/images/image.png')).toBe(true);
            // Second file should have _1 suffix
            expect(zip.files.has('content/resources/images/image_1.png')).toBe(true);
            // Third file should have _2 suffix
            expect(zip.files.has('content/resources/images/image_2.png')).toBe(true);

            // Verify content is correct
            const firstImage = zip.files.get('content/resources/images/image.png') as Buffer;
            expect(firstImage.toString()).toBe('first-image');
            const secondImage = zip.files.get('content/resources/images/image_1.png') as Buffer;
            expect(secondImage.toString()).toBe('second-image');
        });

        it('should handle case-insensitive filename collisions (Windows compatibility)', async () => {
            // Create assets with same filename but different case
            const assetsWithCaseCollisions: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'uuid-a',
                            filename: 'Photo.JPG',
                            originalPath: 'Photo.JPG',
                            folderPath: '',
                            mime: 'image/jpeg',
                            data: Buffer.from('uppercase'),
                        },
                        {
                            id: 'uuid-b',
                            filename: 'photo.jpg', // Same name, different case
                            originalPath: 'photo.jpg',
                            folderPath: '',
                            mime: 'image/jpeg',
                            data: Buffer.from('lowercase'),
                        },
                    ];
                },
                async getProjectAssets() {
                    return this.getAllAssets();
                },
            };

            const exporterWithCaseCollisions = new Html5Exporter(document, resources, assetsWithCaseCollisions, zip);
            const result = await exporterWithCaseCollisions.export();

            expect(result.success).toBe(true);

            // Both files should be exported (one with suffix)
            expect(zip.files.has('content/resources/Photo.JPG')).toBe(true);
            expect(zip.files.has('content/resources/photo_1.jpg')).toBe(true);
        });

        it('should handle nested folder paths', async () => {
            const assetsWithNestedFolders: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'uuid-nested',
                            filename: 'chart.svg',
                            originalPath: 'images/charts/sales/chart.svg',
                            folderPath: 'images/charts/sales',
                            mime: 'image/svg+xml',
                            data: Buffer.from('svg-data'),
                        },
                    ];
                },
                async getProjectAssets() {
                    return this.getAllAssets();
                },
            };

            const exporterWithNested = new Html5Exporter(document, resources, assetsWithNestedFolders, zip);
            const result = await exporterWithNested.export();

            expect(result.success).toBe(true);
            expect(zip.files.has('content/resources/images/charts/sales/chart.svg')).toBe(true);
        });

        it('should transform asset URLs in content to use folderPath structure', async () => {
            // Create pages with asset references (using realistic UUID format)
            const pagesWithAssets: ExportPage[] = [
                {
                    id: 'page-1',
                    title: 'Test Page',
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
                                        '<p><img src="asset://a1b2c3d4-e5f6-7890-abcd-ef1234567890/photo.jpg" /></p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            const assetsForUrlTest: AssetProvider = {
                async getAsset() {
                    return null;
                },
                async getAllAssets() {
                    return [
                        {
                            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                            filename: 'photo.jpg',
                            originalPath: 'images/photo.jpg',
                            folderPath: 'images',
                            mime: 'image/jpeg',
                            data: Buffer.from('photo-bytes'),
                        },
                    ];
                },
                async getProjectAssets() {
                    return this.getAllAssets();
                },
            };

            document = new MockDocument({}, pagesWithAssets);
            const exporterWithUrls = new Html5Exporter(document, resources, assetsForUrlTest, zip);
            await exporterWithUrls.export();

            // Check that the HTML contains the transformed URL
            const indexHtml = zip.files.get('index.html') as string;
            // After preprocessing: asset://uuid/photo.jpg → asset://uuid/images/photo.jpg
            // After fixAssetUrls: asset://uuid/images/photo.jpg → content/resources/images/photo.jpg
            expect(indexHtml).toContain('content/resources/images/photo.jpg');
            // Should NOT contain UUID-based path
            expect(indexHtml).not.toContain('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
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

    describe('Global Font Support', () => {
        let resources: MockResourceProvider;
        let assets: MockAssetProvider;
        let zip: MockZipProvider;

        const simplePage: ExportPage = {
            id: 'page1',
            title: 'Page 1',
            parentId: null,
            order: 0,
            blocks: [],
        };

        function createExporter(globalFont: string, res = resources): Html5Exporter {
            const doc = new MockDocument({ globalFont }, [simplePage]);
            return new Html5Exporter(doc, res, assets, zip);
        }

        beforeEach(() => {
            resources = new MockResourceProvider();
            assets = new MockAssetProvider();
            zip = new MockZipProvider();
        });

        it('should include global font files when globalFont is set', async () => {
            await createExporter('opendyslexic').export();

            expect(zip.files.has('fonts/global/opendyslexic/OpenDyslexic-Regular.woff')).toBe(true);
            expect(zip.files.has('fonts/global/opendyslexic/OFL.txt')).toBe(true);
        });

        it('should include Playwrite ES Guides font files when selected', async () => {
            await createExporter('playwrite-es').export();

            expect(zip.files.has('fonts/global/playwrite-es/PlaywriteES-Regular.woff2')).toBe(true);
            expect(zip.files.has('fonts/global/playwrite-es/OFL.txt')).toBe(true);
        });

        it('should not include global font files when globalFont is default', async () => {
            await createExporter('default').export();

            expect(zip.files.has('fonts/global/opendyslexic/OpenDyslexic-Regular.woff')).toBe(false);
            expect(zip.files.has('fonts/global/playwrite-es/PlaywriteES-Regular.woff2')).toBe(false);
        });

        it('should include global font CSS in rendered pages', async () => {
            await createExporter('opendyslexic').export();

            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('OpenDyslexic');
        });

        it('should handle fetchGlobalFontFiles errors gracefully', async () => {
            const errorResources = new MockResourceProvider();
            errorResources.fetchGlobalFontFiles = async () => {
                throw new Error('Font fetch failed');
            };

            const result = await createExporter('opendyslexic', errorResources).export();
            expect(result.success).toBe(true);
        });
    });

    describe('generateForPreview', () => {
        it('should generate preview files as a Map', async () => {
            const files = await exporter.generateForPreview();

            expect(files).toBeInstanceOf(Map);
            expect(files.size).toBeGreaterThan(0);
        });

        it('should generate index.html', async () => {
            const files = await exporter.generateForPreview();

            expect(files.has('index.html')).toBe(true);
            const indexHtml = files.get('index.html');
            expect(indexHtml).toBeInstanceOf(Uint8Array);

            // Decode and verify content
            const decoder = new TextDecoder();
            const html = decoder.decode(indexHtml as Uint8Array);
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Introduction');
        });

        it('should generate HTML files for other pages', async () => {
            const files = await exporter.generateForPreview();

            // Find HTML files in html/ directory
            const htmlFiles = Array.from(files.keys()).filter(f => f.startsWith('html/'));
            expect(htmlFiles.length).toBe(1);
        });

        it('should NOT include content.xml (not needed for preview)', async () => {
            const files = await exporter.generateForPreview();

            // Preview should not include content.xml to save space
            expect(files.has('content.xml')).toBe(false);
        });

        it('should include base CSS', async () => {
            const files = await exporter.generateForPreview();

            expect(files.has('content/css/base.css')).toBe(true);
        });

        it('should include theme files', async () => {
            const files = await exporter.generateForPreview();

            expect(files.has('theme/style.css')).toBe(true);
            expect(files.has('theme/style.js')).toBe(true);
        });

        it('should include base libraries', async () => {
            const files = await exporter.generateForPreview();

            expect(files.has('libs/jquery/jquery.min.js')).toBe(true);
            expect(files.has('libs/common.js')).toBe(true);
        });

        it('should return Uint8Array content for all files', async () => {
            const files = await exporter.generateForPreview();

            for (const [path, content] of files) {
                expect(content).toBeInstanceOf(Uint8Array);
            }
        });

        it('should handle empty pages array', async () => {
            document = new MockDocument({}, []);
            exporter = new Html5Exporter(document, resources, assets, zip);

            const files = await exporter.generateForPreview();

            // Should still generate theme and library files
            expect(files.size).toBeGreaterThan(0);
        });

        it('should handle theme fetch failure gracefully', async () => {
            resources.fetchTheme = async () => {
                throw new Error('Theme not found');
            };

            const files = await exporter.generateForPreview();

            // Should use fallback theme
            expect(files.has('theme/style.css')).toBe(true);
            expect(files.has('theme/style.js')).toBe(true);
        });

        it('should use custom theme when provided in options', async () => {
            const files = await exporter.generateForPreview({ theme: 'custom-theme' });

            // Theme files should be included (from mock)
            expect(files.has('theme/style.css')).toBe(true);
        });

        it('should generate search_index.js when addSearchBox is enabled', async () => {
            document = new MockDocument({ addSearchBox: true }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            const files = await exporter.generateForPreview();

            expect(files.has('search_index.js')).toBe(true);
        });

        it('should call preRenderLatex hook when provided', async () => {
            let hookCalled = false;

            const files = await exporter.generateForPreview({
                preRenderLatex: async (html: string) => {
                    hookCalled = true;
                    return {
                        html: html.replace('Welcome', 'Welcome (LaTeX rendered)'),
                        hasLatex: true,
                        latexRendered: true,
                        count: 1,
                    };
                },
            });

            expect(hookCalled).toBe(true);
            expect(files.has('index.html')).toBe(true);
        });

        it('should call preRenderMermaid hook when provided', async () => {
            let hookCalled = false;

            const files = await exporter.generateForPreview({
                preRenderMermaid: async (html: string) => {
                    hookCalled = true;
                    return {
                        html: html.replace('Welcome', 'Welcome (Mermaid rendered)'),
                        hasMermaid: true,
                        mermaidRendered: true,
                        count: 1,
                    };
                },
            });

            expect(hookCalled).toBe(true);
            expect(files.has('index.html')).toBe(true);
        });

        it('should handle preRenderLatex hook error gracefully', async () => {
            const files = await exporter.generateForPreview({
                preRenderLatex: async () => {
                    throw new Error('LaTeX render failed');
                },
            });

            // Should still succeed, just without LaTeX pre-rendering
            expect(files.size).toBeGreaterThan(0);
            expect(files.has('index.html')).toBe(true);
        });

        it('should handle preRenderMermaid hook error gracefully', async () => {
            const files = await exporter.generateForPreview({
                preRenderMermaid: async () => {
                    throw new Error('Mermaid render failed');
                },
            });

            // Should still succeed, just without Mermaid pre-rendering
            expect(files.size).toBeGreaterThan(0);
            expect(files.has('index.html')).toBe(true);
        });

        it('should include project assets in preview files', async () => {
            // Create asset provider with assets
            const assetsWithFiles = new (class extends MockAssetProvider {
                async getAllAssets() {
                    return [
                        {
                            id: 'asset-1',
                            filename: 'image.png',
                            originalPath: 'images/image.png',
                            folderPath: 'images',
                            mime: 'image/png',
                            mimeType: 'image/png',
                            data: Buffer.from('PNG data'),
                        },
                    ];
                }
            })();

            exporter = new Html5Exporter(document, resources, assetsWithFiles, zip);
            const files = await exporter.generateForPreview();

            expect(files.has('content/resources/images/image.png')).toBe(true);
        });

        it('should handle asset fetch failure gracefully', async () => {
            // Create asset provider that throws
            const failingAssets = new (class extends MockAssetProvider {
                async getAllAssets() {
                    throw new Error('Asset fetch failed');
                }
            })();

            exporter = new Html5Exporter(document, resources, failingAssets, zip);
            const files = await exporter.generateForPreview();

            // Should still generate HTML and theme files
            expect(files.has('index.html')).toBe(true);
            expect(files.has('theme/style.css')).toBe(true);
        });

        it('should handle base CSS fetch failure gracefully', async () => {
            resources.fetchContentCss = async () => {
                return new Map(); // Empty map, no base.css
            };

            const files = await exporter.generateForPreview();

            // Should still generate other files
            expect(files.has('index.html')).toBe(true);
            expect(files.has('theme/style.css')).toBe(true);
            // base.css should not be present since fetch returned empty
            expect(files.has('content/css/base.css')).toBe(false);
        });

        it('should handle base libraries fetch failure gracefully', async () => {
            resources.fetchBaseLibraries = async () => {
                throw new Error('Libraries not found');
            };

            const files = await exporter.generateForPreview();

            // Should still succeed
            expect(files.has('index.html')).toBe(true);
        });

        it('should handle library files fetch failure gracefully', async () => {
            resources.fetchLibraryFiles = async () => {
                throw new Error('Additional libraries not found');
            };

            const files = await exporter.generateForPreview();

            // Should still succeed
            expect(files.has('index.html')).toBe(true);
        });

        it('should append pre-rendered CSS to base CSS when LaTeX is rendered', async () => {
            const files = await exporter.generateForPreview({
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: true,
                    latexRendered: true,
                    count: 1,
                }),
            });

            const baseCss = files.get('content/css/base.css');
            expect(baseCss).toBeDefined();

            const decoder = new TextDecoder();
            const cssText = decoder.decode(baseCss as Uint8Array);
            expect(cssText).toContain('exe-math-rendered');
        });

        it('should append pre-rendered CSS to base CSS when Mermaid is rendered', async () => {
            const files = await exporter.generateForPreview({
                preRenderMermaid: async (html: string) => ({
                    html,
                    hasMermaid: true,
                    mermaidRendered: true,
                    count: 1,
                }),
            });

            const baseCss = files.get('content/css/base.css');
            expect(baseCss).toBeDefined();

            const decoder = new TextDecoder();
            const cssText = decoder.decode(baseCss as Uint8Array);
            expect(cssText).toContain('exe-mermaid-rendered');
        });

        it('should call preRenderDataGameLatex hook when provided', async () => {
            let hookCalled = false;

            const files = await exporter.generateForPreview({
                preRenderDataGameLatex: async (html: string) => {
                    hookCalled = true;
                    return {
                        html: html.replace('Welcome', 'Welcome (DataGame LaTeX)'),
                        hasLatex: true,
                        count: 1,
                    };
                },
            });

            expect(hookCalled).toBe(true);
            expect(files.has('index.html')).toBe(true);
        });

        it('should handle preRenderDataGameLatex hook error gracefully', async () => {
            const files = await exporter.generateForPreview({
                preRenderDataGameLatex: async () => {
                    throw new Error('DataGame LaTeX failed');
                },
            });

            // Should still succeed
            expect(files.size).toBeGreaterThan(0);
            expect(files.has('index.html')).toBe(true);
        });

        it('should create ELPX manifest when download-source-file is used', async () => {
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

            document = new MockDocument({}, pagesWithDownload);
            exporter = new Html5Exporter(document, resources, assets, zip);

            const files = await exporter.generateForPreview();

            // Should have manifest file
            expect(files.has('libs/elpx-manifest.js')).toBe(true);

            const manifestContent = files.get('libs/elpx-manifest.js');
            const manifestJs =
                typeof manifestContent === 'string'
                    ? manifestContent
                    : new TextDecoder().decode(manifestContent as Uint8Array);
            expect(manifestJs).toContain('window.__ELPX_MANIFEST__');
            expect(manifestJs).toContain('"files"');
        });

        it('should include libs/elpx-manifest.js in the manifest file list for preview', async () => {
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

            document = new MockDocument({}, pagesWithDownload);
            exporter = new Html5Exporter(document, resources, assets, zip);

            const files = await exporter.generateForPreview();

            const manifestContent = files.get('libs/elpx-manifest.js');
            const manifestJs =
                typeof manifestContent === 'string'
                    ? manifestContent
                    : new TextDecoder().decode(manifestContent as Uint8Array);

            const manifestMatch = manifestJs.match(/window\.__ELPX_MANIFEST__=(\{[\s\S]*?\});/);
            expect(manifestMatch).toBeTruthy();

            const manifest = JSON.parse(manifestMatch![1]);
            expect(manifest.files).toContain('libs/elpx-manifest.js');
        });

        it('should create ELPX manifest when exe-package:elp class is in content', async () => {
            const pagesWithElpClass: ExportPage[] = [
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
                                    content: '<p class="exe-download-package-link">Download</p>',
                                },
                            ],
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithElpClass);
            exporter = new Html5Exporter(document, resources, assets, zip);

            const files = await exporter.generateForPreview();

            // Should have manifest file
            expect(files.has('libs/elpx-manifest.js')).toBe(true);
        });

        it('should include eXeLearning logo when available', async () => {
            resources.fetchExeLogo = async () => new Uint8Array([1, 2, 3, 4]);

            const files = await exporter.generateForPreview();

            expect(files.has('content/img/exe_powered_logo.png')).toBe(true);
        });

        it('should handle eXeLearning logo fetch failure gracefully', async () => {
            resources.fetchExeLogo = async () => {
                throw new Error('Logo not found');
            };

            const files = await exporter.generateForPreview();

            // Should still succeed
            expect(files.has('index.html')).toBe(true);
            // Logo should not be present
            expect(files.has('content/img/exe_powered_logo.png')).toBe(false);
        });

        it('should handle iDevice resource fetch failure gracefully', async () => {
            resources.fetchIdeviceResources = async () => {
                throw new Error('iDevice resources not found');
            };

            const files = await exporter.generateForPreview();

            // Should still succeed
            expect(files.has('index.html')).toBe(true);
        });

        it('should not skip LaTeX pre-rendering when addMathJax is true', async () => {
            document = new MockDocument({ addMathJax: true }, samplePages);
            exporter = new Html5Exporter(document, resources, assets, zip);

            let latexHookCalled = false;
            const files = await exporter.generateForPreview({
                preRenderLatex: async (html: string) => {
                    latexHookCalled = true;
                    return { html, hasLatex: true, latexRendered: true, count: 1 };
                },
            });

            // LaTeX hook should NOT be called when addMathJax is true
            expect(latexHookCalled).toBe(false);
            expect(files.has('index.html')).toBe(true);
        });
    });

    describe('detectFavicon', () => {
        it('should prioritize favicon.ico over favicon.png', () => {
            // Create theme files with both ico and png
            const themeFiles = new Map<string, Uint8Array>();
            themeFiles.set('img/favicon.ico', new Uint8Array([1, 2, 3]));
            themeFiles.set('img/favicon.png', new Uint8Array([4, 5, 6]));

            // Access protected method via indexing
            const result = (exporter as any).detectFavicon(themeFiles);

            // Should prefer .ico over .png
            expect(result).toEqual({ path: 'theme/img/favicon.ico', type: 'image/x-icon' });
        });

        it('should return png favicon when ico is not present', () => {
            const themeFiles = new Map<string, Uint8Array>();
            themeFiles.set('img/favicon.png', new Uint8Array([4, 5, 6]));

            const result = (exporter as any).detectFavicon(themeFiles);

            expect(result).toEqual({ path: 'theme/img/favicon.png', type: 'image/png' });
        });

        it('should return null when no favicon is present', () => {
            const themeFiles = new Map<string, Uint8Array>();
            themeFiles.set('style.css', new Uint8Array([1, 2, 3]));

            const result = (exporter as any).detectFavicon(themeFiles);

            expect(result).toBeNull();
        });
    });

    describe('prepareThemeData', () => {
        it('should extract root-level CSS and JS files', async () => {
            resources.fetchTheme = async (): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* css */'));
                files.set('style.js', Buffer.from('// js'));
                files.set('extra.css', Buffer.from('/* extra */'));
                files.set('subfolder/nested.css', Buffer.from('/* nested */'));
                files.set('subfolder/nested.js', Buffer.from('// nested js'));
                return files;
            };

            const result = await (exporter as any).prepareThemeData('test-theme');

            // Should only include root-level CSS/JS files (no path separator)
            expect(result.themeRootFiles).toContain('style.css');
            expect(result.themeRootFiles).toContain('style.js');
            expect(result.themeRootFiles).toContain('extra.css');
            // Should NOT include nested files
            expect(result.themeRootFiles).not.toContain('subfolder/nested.css');
            expect(result.themeRootFiles).not.toContain('subfolder/nested.js');
        });

        it('should use fallback when theme fetch fails', async () => {
            resources.fetchTheme = async (): Promise<Map<string, Buffer>> => {
                throw new Error('Theme not found');
            };

            const result = await (exporter as any).prepareThemeData('nonexistent-theme');

            // Should use fallback files
            expect(result.themeRootFiles).toContain('style.css');
            expect(result.themeRootFiles).toContain('style.js');
            expect(result.themeFilesMap).toBeNull();
            expect(result.faviconInfo).toBeNull();
        });

        it('should detect favicon from theme files', async () => {
            resources.fetchTheme = async (): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* css */'));
                files.set('img/favicon.ico', Buffer.from('ico-data'));
                return files;
            };

            const result = await (exporter as any).prepareThemeData('theme-with-favicon');

            expect(result.faviconInfo).toEqual({ path: 'theme/img/favicon.ico', type: 'image/x-icon' });
        });
    });

    describe('Combined LaTeX and Mermaid CSS', () => {
        it('should append both LaTeX and Mermaid CSS when both are rendered', async () => {
            await exporter.export({
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: true,
                    latexRendered: true,
                    count: 1,
                }),
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

            // Should contain both LaTeX and Mermaid CSS
            expect(cssContent).toContain('.exe-math-rendered');
            expect(cssContent).toContain('.exe-mermaid-rendered');
        });

        it('should append both LaTeX and Mermaid CSS in generateForPreview', async () => {
            const files = await exporter.generateForPreview({
                preRenderLatex: async (html: string) => ({
                    html,
                    hasLatex: true,
                    latexRendered: true,
                    count: 1,
                }),
                preRenderMermaid: async (html: string) => ({
                    html,
                    hasMermaid: true,
                    mermaidRendered: true,
                    count: 1,
                }),
            });

            const baseCss = files.get('content/css/base.css');
            expect(baseCss).toBeDefined();

            const decoder = new TextDecoder();
            const cssText = decoder.decode(baseCss as Uint8Array);

            // Should contain both LaTeX and Mermaid CSS
            expect(cssText).toContain('.exe-math-rendered');
            expect(cssText).toContain('.exe-mermaid-rendered');
        });
    });

    describe('Icon Resolution via setThemeIconFiles', () => {
        it('should configure IdeviceRenderer with theme icon files', async () => {
            // Override fetchTheme to include icon files
            resources.fetchTheme = async (_name: string): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* theme css */'));
                files.set('icons/activity.svg', Buffer.from('<svg></svg>'));
                files.set('icons/check.png', Buffer.from('png-data'));
                files.set('icons/star.gif', Buffer.from('gif-data'));
                return files;
            };

            await exporter.export();

            // Verify icon files are copied to theme/icons/
            expect(zip.files.has('theme/icons/activity.svg')).toBe(true);
            expect(zip.files.has('theme/icons/check.png')).toBe(true);
            expect(zip.files.has('theme/icons/star.gif')).toBe(true);
        });

        it('should only resolve image files from icons/ folder', async () => {
            // Override fetchTheme to include various file types
            resources.fetchTheme = async (_name: string): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* css */'));
                files.set('icons/info.svg', Buffer.from('<svg></svg>'));
                files.set('icons/readme.txt', Buffer.from('text file')); // Not an image
                files.set('icons/config.json', Buffer.from('{}')); // Not an image
                return files;
            };

            await exporter.export();

            // Only SVG should be in theme/icons/ as an image file
            expect(zip.files.has('theme/icons/info.svg')).toBe(true);
            // Non-image files should still be copied (they're in the theme)
            expect(zip.files.has('theme/icons/readme.txt')).toBe(true);
        });

        it('should handle theme with no icon files', async () => {
            // Override fetchTheme with no icons
            resources.fetchTheme = async (_name: string): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* css */'));
                files.set('style.js', Buffer.from('// js'));
                return files;
            };

            const result = await exporter.export();

            expect(result.success).toBe(true);
            // Should work fine without icons
        });

        it('should map icon baseName to filename with extension', async () => {
            // Create a page with a block that has an icon using baseName
            const pagesWithIcon: ExportPage[] = [
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
                            iconName: 'lightbulb', // baseName without extension
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithIcon);

            // Override fetchTheme to return icon with extension
            resources.fetchTheme = async (_name: string): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* css */'));
                files.set('icons/lightbulb.svg', Buffer.from('<svg></svg>'));
                return files;
            };

            exporter = new Html5Exporter(document, resources, assets, zip);
            await exporter.export();

            // The generated HTML should have the resolved icon name with extension
            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).toContain('theme/icons/lightbulb.svg');
            expect(indexHtml).not.toContain('lightbulb.png');
        });

        it('should handle multiple icon formats in different themes', async () => {
            // Test that the same icon baseName can resolve to different extensions
            const pagesWithIcon: ExportPage[] = [
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
                            iconName: 'star', // baseName
                        },
                    ],
                },
            ];

            document = new MockDocument({}, pagesWithIcon);

            // Theme with PNG icon
            resources.fetchTheme = async (_name: string): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* css */'));
                files.set('icons/star.png', Buffer.from('png-data'));
                return files;
            };

            exporter = new Html5Exporter(document, resources, assets, zip);
            await exporter.export();

            const indexHtml = zip.files.get('index.html') as string;
            // Should resolve to PNG (whatever the theme provides)
            expect(indexHtml).toContain('theme/icons/star.png');
        });

        it('should support all common image extensions for icon resolution', async () => {
            // Override fetchTheme with various image formats
            resources.fetchTheme = async (_name: string): Promise<Map<string, Buffer>> => {
                const files = new Map<string, Buffer>();
                files.set('style.css', Buffer.from('/* css */'));
                files.set('icons/icon1.svg', Buffer.from('svg'));
                files.set('icons/icon2.png', Buffer.from('png'));
                files.set('icons/icon3.gif', Buffer.from('gif'));
                files.set('icons/icon4.jpg', Buffer.from('jpg'));
                files.set('icons/icon5.jpeg', Buffer.from('jpeg'));
                files.set('icons/icon6.webp', Buffer.from('webp'));
                return files;
            };

            await exporter.export();

            // All image formats should be included
            expect(zip.files.has('theme/icons/icon1.svg')).toBe(true);
            expect(zip.files.has('theme/icons/icon2.png')).toBe(true);
            expect(zip.files.has('theme/icons/icon3.gif')).toBe(true);
            expect(zip.files.has('theme/icons/icon4.jpg')).toBe(true);
            expect(zip.files.has('theme/icons/icon5.jpeg')).toBe(true);
            expect(zip.files.has('theme/icons/icon6.webp')).toBe(true);
        });
    });
});
