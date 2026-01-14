/**
 * Scorm12Exporter tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Scorm12Exporter } from './Scorm12Exporter';
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
            title: 'Test SCORM Project',
            author: 'Test Author',
            language: 'en',
            description: 'A SCORM 1.2 test project',
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
        files.set('SCORM_API_wrapper.js', Buffer.from('// SCORM API'));
        files.set('SCOFunctions.js', Buffer.from('// SCO Functions'));
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
                        htmlContent: '<p>SCORM Introduction</p>',
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
                        type: 'MultipleChoiceIdevice',
                        order: 0,
                        htmlContent: '<div>Quiz content</div>',
                    },
                ],
            },
        ],
    },
];

describe('Scorm12Exporter', () => {
    let document: MockDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: MockZipProvider;
    let exporter: Scorm12Exporter;

    beforeEach(() => {
        document = new MockDocument({}, samplePages);
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new MockZipProvider();
        exporter = new Scorm12Exporter(document, resources, assets, zip);
    });

    describe('Basic Properties', () => {
        it('should return correct file suffix', () => {
            expect(exporter.getFileSuffix()).toBe('_scorm');
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

        it('should include SCORM API files', async () => {
            await exporter.export();

            // Check for SCORM libraries in libs/
            expect(zip.files.has('libs/SCORM_API_wrapper.js')).toBe(true);
            expect(zip.files.has('libs/SCOFunctions.js')).toBe(true);
        });
    });

    describe('SCORM Manifest', () => {
        it('should generate valid imsmanifest.xml', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('<?xml');
            expect(manifest).toContain('manifest');
        });

        it('should include SCORM 1.2 namespaces', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('ADL SCORM');
            expect(manifest).toContain('1.2');
        });

        it('should include project title in manifest', async () => {
            await exporter.export();

            const manifest = zip.files.get('imsmanifest.xml') as string;
            expect(manifest).toContain('Test SCORM Project');
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
    });

    describe('LOM Metadata', () => {
        it('should generate imslrm.xml with metadata', async () => {
            await exporter.export();

            const lom = zip.files.get('imslrm.xml') as string;
            expect(lom).toContain('<?xml');
            expect(lom).toContain('lom');
        });

        it('should include title in LOM', async () => {
            await exporter.export();

            const lom = zip.files.get('imslrm.xml') as string;
            expect(lom).toContain('Test SCORM Project');
        });
    });

    describe('SCORM Page HTML', () => {
        it('should generate SCORM-enabled HTML', () => {
            const html = exporter.generateScormPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('SCORM_API_wrapper');
            expect(html).toContain('SCOFunctions');
        });

        it('should include onload handler', () => {
            const html = exporter.generateScormPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('loadPage');
        });

        it('should include onunload handler', () => {
            const html = exporter.generateScormPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('unloadPage');
        });

        it('should have exe-scorm class', () => {
            const html = exporter.generateScormPageHtml(samplePages[0], samplePages, document.getMetadata(), true);

            expect(html).toContain('exe-scorm');
            expect(html).toContain('exe-scorm12');
        });
    });

    describe('SCORM Scripts', () => {
        it('should return correct head scripts for index page', () => {
            const scripts = exporter.getScormHeadScripts('');

            expect(scripts).toContain('SCORM_API_wrapper.js');
            expect(scripts).toContain('SCOFunctions.js');
        });

        it('should return correct head scripts for subpages', () => {
            const scripts = exporter.getScormHeadScripts('../');

            expect(scripts).toContain('../libs/SCORM_API_wrapper.js');
            expect(scripts).toContain('../libs/SCOFunctions.js');
        });
    });

    describe('Fallback SCORM API', () => {
        it('should provide SCORM API wrapper fallback', () => {
            const wrapper = exporter.getScormApiWrapper();

            expect(wrapper).toContain('pipwerks');
            expect(wrapper).toContain('SCORM');
            expect(wrapper).toContain('LMSInitialize');
            expect(wrapper).toContain('LMSFinish');
            expect(wrapper).toContain('LMSGetValue');
            expect(wrapper).toContain('LMSSetValue');
        });

        it('should provide SCO functions fallback', () => {
            const scoFunctions = exporter.getScoFunctions();

            expect(scoFunctions).toContain('loadPage');
            expect(scoFunctions).toContain('unloadPage');
            expect(scoFunctions).toContain('setComplete');
            expect(scoFunctions).toContain('setIncomplete');
            expect(scoFunctions).toContain('setScore');
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
        it('should produce valid SCORM ZIP package', async () => {
            const result = await exporter.export();

            const loadedZip = unzipSync(new Uint8Array(result.data!));
            expect(loadedZip['imsmanifest.xml']).toBeDefined();
            expect(loadedZip['index.html']).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle SCORM file fetch failure', async () => {
            resources.fetchScormFiles = async () => {
                throw new Error('SCORM files not found');
            };

            const result = await exporter.export();

            // Should succeed with fallback SCORM files
            expect(result.success).toBe(true);
            expect(zip.files.has('libs/SCORM_API_wrapper.js')).toBe(true);
            expect(zip.files.has('libs/SCOFunctions.js')).toBe(true);
        });
    });
});
