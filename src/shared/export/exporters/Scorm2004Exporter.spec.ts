/**
 * Scorm2004Exporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Scorm2004Exporter } from './Scorm2004Exporter';
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
            title: 'Test SCORM 2004 Project',
            author: 'Test Author',
            language: 'en',
            description: 'A SCORM 2004 test project',
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
        const files = new Map<string, Buffer>();
        files.set('SCORM_API_wrapper.js', Buffer.from('// SCORM 2004 API'));
        files.set('SCOFunctions.js', Buffer.from('// SCO 2004 Functions'));
        return files;
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
                        htmlContent: '<p>SCORM 2004 Introduction</p>',
                    },
                ],
            },
        ],
    },
    {
        id: 'page-2',
        title: 'Module 1',
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
                        htmlContent: '<p>Module content</p>',
                    },
                ],
            },
        ],
    },
];

describe('Scorm2004Exporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: Scorm2004Exporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new Scorm2004Exporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('_scorm2004');
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

        it('should include imslrm.xml (LOM metadata)', async () => {
            await exporter.export();

            expect(zip.files.has('imslrm.xml')).toBe(true);
        });

        it('should include index.html', async () => {
            await exporter.export();

            expect(zip.files.has('index.html')).toBe(true);
        });

        it('should include SCORM 2004 API files', async () => {
            await exporter.export();

            expect(zip.files.has('libs/SCORM_API_wrapper.js')).toBe(true);
            expect(zip.files.has('libs/SCOFunctions.js')).toBe(true);
        });
    });

    describe('SCORM 2004 Manifest', () => {
        it('should generate valid imsmanifest.xml', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('<?xml');
            expect(manifest).toContain('manifest');
        });

        it('should include SCORM 2004 namespaces', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            // SCORM 2004 uses adlcp_v1p3
            expect(manifest).toContain('adlcp');
        });

        it('should include sequencing information', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('sequencing');
        });

        it('should include project title in manifest', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('Test SCORM 2004 Project');
        });
    });

    describe('SCORM 2004 Page HTML', () => {
        it('should generate SCORM 2004-enabled HTML', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('SCORM_API_wrapper');
            expect(html).toContain('SCOFunctions');
        });

        it('should include loadPage handler', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('loadPage');
        });

        it('should include unloadPage handler', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('unloadPage');
        });

        it('should have exe-scorm2004 class', () => {
            const html = exporter.generateScorm2004PageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('exe-scorm');
            expect(html).toContain('exe-scorm2004');
        });
    });

    describe('SCORM 2004 Scripts', () => {
        it('should return correct head scripts for index', () => {
            const scripts = exporter.getScorm2004HeadScripts('');

            expect(scripts).toContain('SCORM_API_wrapper.js');
            expect(scripts).toContain('SCOFunctions.js');
        });

        it('should return correct head scripts for subpages', () => {
            const scripts = exporter.getScorm2004HeadScripts('../');

            expect(scripts).toContain('../libs/');
        });
    });

    describe('Fallback SCORM 2004 API', () => {
        it('should provide SCORM 2004 API wrapper fallback', () => {
            const wrapper = exporter.getScorm2004ApiWrapper();

            expect(wrapper).toContain('pipwerks');
            expect(wrapper).toContain('SCORM');
            expect(wrapper).toContain('2004');
            expect(wrapper).toContain('API_1484_11'); // SCORM 2004 API name
            expect(wrapper).toContain('Initialize');
            expect(wrapper).toContain('Terminate');
            expect(wrapper).toContain('GetValue');
            expect(wrapper).toContain('SetValue');
        });

        it('should provide SCO 2004 functions fallback', () => {
            const scoFunctions = exporter.getSco2004Functions();

            expect(scoFunctions).toContain('loadPage');
            expect(scoFunctions).toContain('unloadPage');
            expect(scoFunctions).toContain('setComplete');
            expect(scoFunctions).toContain('setScore');
            // SCORM 2004 uses cmi.completion_status instead of cmi.core.lesson_status
            expect(scoFunctions).toContain('cmi.completion_status');
            expect(scoFunctions).toContain('cmi.success_status');
            expect(scoFunctions).toContain('cmi.score.scaled');
        });

        it('should use ISO 8601 duration format', () => {
            const scoFunctions = exporter.getSco2004Functions();

            // SCORM 2004 uses ISO 8601 format (PT#H#M#S)
            expect(scoFunctions).toContain('PT');
            expect(scoFunctions).toContain('cmi.session_time');
        });
    });

    describe('Project ID Generation', () => {
        it('should generate unique project IDs', () => {
            const id1 = exporter.generateProjectId();
            const id2 = exporter.generateProjectId();

            expect(id1).not.toBe(id2);
        });
    });

    describe('ZIP Validation', () => {
        it('should produce valid SCORM 2004 ZIP package', async () => {
            const result = await exporter.export();

            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(loadedZip['imsmanifest.xml']).toBeDefined();
            expect(loadedZip['index.html']).toBeDefined();
            expect(loadedZip['imslrm.xml']).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle SCORM file fetch failure', async () => {
            resources.fetchScormFiles = async () => {
                throw new Error('SCORM files not found');
            };

            const result = await exporter.export();

            // Should succeed with fallback
            expect(result.success).toBe(true);
            expect(zip.files.has('libs/SCORM_API_wrapper.js')).toBe(true);
        });

        it('should handle empty pages', async () => {
            document = new MockDocument({}, []);
            exporter = new Scorm2004Exporter(document, resources, assets, zip);

            const result = await exporter.export();
            expect(result.success).toBe(true);
        });
    });

    describe('Filename Generation', () => {
        it('should build filename with _scorm2004 suffix', async () => {
            const result = await exporter.export();

            expect(result.filename).toContain('_scorm2004');
        });
    });
});
