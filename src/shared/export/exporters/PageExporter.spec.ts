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

        it('should NOT include content.xml (only needed for ELP)', async () => {
            await exporter.export();

            expect(zip.files.has('content.xml')).toBe(false);
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
            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(Object.keys(loadedZip).length).toBeGreaterThan(0);
        });

        it('should have single index.html with all content', async () => {
            const result = await exporter.export();
            const loadedZip = unzipSync(new Uint8Array(result.data!));

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
            // Uses section-{id} to match the IDs generated in renderSinglePageSection
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
    });
});
