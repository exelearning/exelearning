/**
 * Html5Exporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Html5Exporter } from './Html5Exporter';
import JSZip from 'jszip';
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
        // Create actual ZIP for realistic testing
        const zip = new JSZip();
        for (const [path, content] of this.files) {
            zip.file(path, content);
        }
        const buffer = await zip.generateAsync({ type: 'nodebuffer' });
        return buffer;
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
            const htmlFiles = Array.from(zip.files.keys()).filter((f) =>
                f.startsWith('html/')
            );
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
            const html = exporter.generatePageHtml(
                samplePages[0],
                samplePages,
                document.getMetadata(),
                true
            );

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html');
            expect(html).toContain('lang="en"');
            expect(html).toContain('<head>');
            expect(html).toContain('<body');
        });

        it('should include project title in page HTML', () => {
            const html = exporter.generatePageHtml(
                samplePages[0],
                samplePages,
                document.getMetadata(),
                true
            );

            expect(html).toContain('Test Project');
        });

        it('should include page content', () => {
            const html = exporter.generatePageHtml(
                samplePages[0],
                samplePages,
                document.getMetadata(),
                true
            );

            expect(html).toContain('Welcome to the course');
        });

        it('should use correct base path for index page', () => {
            const html = exporter.generatePageHtml(
                samplePages[0],
                samplePages,
                document.getMetadata(),
                true
            );

            // Index page should have no base path prefix
            expect(html).toContain('href="theme/');
            expect(html).not.toContain('href="../theme/');
        });

        it('should use correct base path for other pages', () => {
            const html = exporter.generatePageHtml(
                samplePages[1],
                samplePages,
                document.getMetadata(),
                false
            );

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

            // Verify it's a valid ZIP by loading with JSZip
            const loadedZip = await JSZip.loadAsync(result.data!);
            expect(Object.keys(loadedZip.files).length).toBeGreaterThan(0);
        });

        it('should include index.html in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = await JSZip.loadAsync(result.data!);

            expect(loadedZip.files['index.html']).toBeDefined();
        });

        it('should include content.xml in ZIP', async () => {
            const result = await exporter.export();
            const loadedZip = await JSZip.loadAsync(result.data!);

            expect(loadedZip.files['content.xml']).toBeDefined();
        });
    });

    describe('Theme and Library Integration', () => {
        it('should handle theme fetch failure gracefully', async () => {
            // Override fetchTheme to throw
            resources.fetchTheme = async () => {
                throw new Error('Theme not found');
            };

            const result = await exporter.export();

            // Should still succeed with fallback
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
});
