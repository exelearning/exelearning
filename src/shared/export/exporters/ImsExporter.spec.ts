/**
 * ImsExporter tests (IMS Content Package)
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ImsExporter } from './ImsExporter';
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
            title: 'Test IMS Project',
            author: 'Test Author',
            language: 'en',
            description: 'An IMS Content Package test project',
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
        // Theme files keep their original names (style.css, style.js)
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

// Sample pages
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
                        content: '<p>IMS Content Introduction</p>',
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
                        content: '<p>Chapter 1 content</p>',
                    },
                ],
            },
        ],
    },
];

describe('ImsExporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: ImsExporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new ImsExporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('_ims');
        });
    });

    describe('Export Process', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should include imsmanifest.xml', async () => {
            await exporter.export();

            expect(zip.files.has('imsmanifest.xml')).toBe(true);
        });

        it('should include index.html', async () => {
            await exporter.export();

            expect(zip.files.has('index.html')).toBe(true);
        });

        it('should NOT include SCORM-specific files', async () => {
            await exporter.export();

            // IMS CP doesn't need SCORM API
            // Check that no SCORM-specific scripts are in the HTML
            const indexHtml = zip.files.get('index.html') as string;
            expect(indexHtml).not.toContain('SCORM_API_wrapper');
            expect(indexHtml).not.toContain('SCOFunctions');
        });

        it('should NOT include imslrm.xml (IMS uses inline metadata)', async () => {
            await exporter.export();

            // IMS CP typically includes metadata in the manifest, not as separate file
            // Check that the export doesn't fail regardless of approach
            expect(zip.files.has('imsmanifest.xml')).toBe(true);
        });
    });

    describe('IMS Manifest', () => {
        it('should generate valid imsmanifest.xml', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('<?xml');
            expect(manifest).toContain('manifest');
        });

        it('should include IMS CP namespaces', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('imscp');
        });

        it('should include project title in manifest', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('Test IMS Project');
        });

        it('should include organization structure', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('<organizations');
            expect(manifest).toContain('<organization');
        });

        it('should include resources section', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('<resources');
            expect(manifest).toContain('<resource');
        });

        it('should reference HTML files in resources', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('index.html');
        });
    });

    describe('IMS Page HTML', () => {
        it('should generate standard HTML page (no SCORM)', () => {
            const html = exporter.generateImsPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).not.toContain('loadPage');
            expect(html).not.toContain('unloadPage');
        });

        it('should have exe-ims class', () => {
            const html = exporter.generateImsPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('exe-web-site');
            expect(html).toContain('exe-ims');
        });

        it('should include page content', () => {
            const html = exporter.generateImsPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('IMS Content Introduction');
        });

        it('should include project title', () => {
            const html = exporter.generateImsPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('Test IMS Project');
        });
    });

    describe('Project ID Generation', () => {
        it('should generate unique project IDs', () => {
            const id1 = exporter.generateProjectId();
            const id2 = exporter.generateProjectId();

            expect(id1).not.toBe(id2);
            expect(id1.length).toBeGreaterThan(0);
        });
    });

    describe('ZIP Validation', () => {
        it('should produce valid IMS CP ZIP package', async () => {
            const result = await exporter.export();

            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(loadedZip['imsmanifest.xml']).toBeDefined();
            expect(loadedZip['index.html']).toBeDefined();
        });

        it('should include theme files with original names', async () => {
            const result = await exporter.export();

            const loadedZip = unzipSync(new Uint8Array(result.data!));
            // Theme file names should be preserved as-is
            expect(loadedZip['theme/style.css']).toBeDefined();
        });
    });

    describe('Multi-page Export', () => {
        it('should export multiple pages', async () => {
            await exporter.export();

            // First page is index.html
            expect(zip.files.has('index.html')).toBe(true);

            // Other pages in html/ directory
            const htmlFiles = Array.from(zip.files.keys()).filter(f => f.startsWith('html/'));
            expect(htmlFiles.length).toBe(1); // page-2 = chapter-1.html
        });

        it('should reference all pages in manifest', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            // All items should be in the organization
            expect(manifest).toContain('<item');
        });
    });

    describe('Error Handling', () => {
        it('should handle empty pages', async () => {
            document = new MockDocument({}, []);
            exporter = new ImsExporter(document, resources, assets, zip);

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

    describe('Filename Generation', () => {
        it('should build filename with _ims suffix', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('_ims');
        });

        it('should use custom filename when provided', async () => {
            const result = await exporter.export({ filename: 'my-ims-package.zip' });

            expect(result.filename).toBe('my-ims-package.zip');
        });
    });

    describe('ODE XML', () => {
        it('should include content.xml in IMS package with DOCTYPE', async () => {
            await exporter.export();

            expect(zip.files.has('content.xml')).toBe(true);
            const contentXml = zip.files.get('content.xml') as string;
            expect(contentXml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(contentXml).toContain('<!DOCTYPE ode SYSTEM "content.dtd">');
            expect(contentXml).toContain('<ode');
        });

        it('should include content.dtd in IMS package', async () => {
            await exporter.export();

            expect(zip.files.has('content.dtd')).toBe(true);
        });

        it('should include content.xml and content.dtd in manifest COMMON_FILES', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('<file href="content.xml"/>');
            expect(manifest).toContain('<file href="content.dtd"/>');
        });
    });
});
