/**
 * Integration tests for client-side ELPX download feature
 *
 * Tests that exports with download-source-file iDevice:
 * 1. Include fflate.umd.js in libs/
 * 2. Include exe_elpx_download.js in libs/
 * 3. Replace exe-package:elp protocol with onclick handler
 * 4. Have content.xml accessible at root
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { Html5Exporter } from '../../../src/shared/export/exporters/Html5Exporter';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
} from '../../../src/shared/export/interfaces';
import * as path from 'path';
import * as fs from 'fs-extra';

// Mock document with download-source-file iDevice
class MockDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor() {
        this.metadata = {
            title: 'Test Project with Download',
            author: 'Test Author',
            language: 'es',
            description: 'A test project with download-source-file iDevice',
            license: 'CC-BY-SA 4.0',
            theme: 'base',
        };

        this.pages = [
            {
                id: 'page-1',
                title: 'Home Page',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Download Block',
                        order: 0,
                        components: [
                            {
                                id: 'idevice-1',
                                type: 'download-source-file',
                                order: 0,
                                content: `
                                    <div class="exe-download-package-instructions">
                                        <table class="exe-table exe-package-info">
                                            <caption>General information about this educational resource</caption>
                                            <tbody>
                                                <tr><th>Title</th><td>Test Project with Download</td></tr>
                                                <tr><th>Description</th><td>A test project</td></tr>
                                                <tr><th>Author</th><td>Test Author</td></tr>
                                                <tr><th>License</th><td>CC-BY-SA 4.0</td></tr>
                                            </tbody>
                                        </table>
                                        <p>This content was created with eXeLearning.</p>
                                    </div>
                                    <p class="exe-download-package-link">
                                        <a download="exe-package:elp-name" href="exe-package:elp" style="background-color:#107275;color:#ffffff;">
                                            Download .elp file
                                        </a>
                                    </p>
                                `,
                            },
                        ],
                    },
                ],
            },
        ];
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

// Resource provider that reads from actual public directory
class FileResourceProvider implements ResourceProvider {
    private publicDir: string;

    constructor() {
        this.publicDir = path.join(__dirname, '../../../public');
    }

    async fetchTheme(_name: string): Promise<Map<string, Buffer>> {
        // Return minimal theme files
        return new Map([
            ['style.css', Buffer.from('/* Theme CSS */')],
            ['style.js', Buffer.from('// Theme JS')],
        ]);
    }

    async fetchIdeviceResources(_type: string): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchBaseLibraries(): Promise<Map<string, Buffer>> {
        return new Map([['jquery/jquery.min.js', Buffer.from('// jQuery mock')]]);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async fetchLibraryFiles(files: string[], patterns?: unknown): Promise<Map<string, Buffer>> {
        const result = new Map<string, Buffer>();

        for (const file of files) {
            const fullPath = path.join(this.publicDir, 'libs', file);
            if (await fs.pathExists(fullPath)) {
                const content = await fs.readFile(fullPath);
                result.set(file, content);
            }
        }

        return result;
    }

    async fetchScormFiles(): Promise<Map<string, Buffer>> {
        return new Map();
    }

    async fetchContentCss(): Promise<Map<string, Buffer>> {
        const cssPath = path.join(this.publicDir, 'style', 'content', 'css', 'base.css');
        if (await fs.pathExists(cssPath)) {
            const content = await fs.readFile(cssPath);
            return new Map([['content/css/base.css', content]]);
        }
        return new Map([['content/css/base.css', Buffer.from('/* Test base CSS */')]]);
    }

    normalizeIdeviceType(type: string): string {
        return type.toLowerCase().replace(/idevice$/i, '');
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

// Capturing zip provider to inspect added files
class CapturingZipProvider implements ZipProvider {
    files = new Map<string, string | Buffer>();

    addFile(path: string, content: string | Buffer): void {
        this.files.set(path, content);
    }

    async generateAsync(): Promise<Buffer> {
        return Buffer.from('mock-zip');
    }

    hasFile(path: string): boolean {
        return this.files.has(path);
    }

    getFileContent(path: string): string | Buffer | undefined {
        return this.files.get(path);
    }

    getFileAsString(path: string): string | undefined {
        const content = this.files.get(path);
        if (!content) return undefined;
        return content instanceof Buffer ? content.toString('utf-8') : content;
    }
}

// Mock document with ONLY manual exe-package:elp link (no download-source-file iDevice)
class MockDocumentWithManualLink implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor() {
        this.metadata = {
            title: 'Test Project Manual Link',
            author: 'Test Author',
            language: 'es',
            description: 'A test project with manual exe-package:elp link in text iDevice',
            license: 'CC-BY-SA 4.0',
            theme: 'base',
        };

        this.pages = [
            {
                id: 'page-1',
                title: 'Home Page',
                parentId: null,
                order: 0,
                blocks: [
                    {
                        id: 'block-1',
                        name: 'Text Block',
                        order: 0,
                        components: [
                            {
                                id: 'idevice-1',
                                type: 'text', // NOT download-source-file!
                                order: 0,
                                // Manual link without the CSS class
                                content: `<p>Click <a href="exe-package:elp" download="exe-package:elp-name">here</a> to download the source file.</p>`,
                            },
                        ],
                    },
                ],
            },
        ];
    }

    getMetadata(): ExportMetadata {
        return this.metadata;
    }

    getNavigation(): ExportPage[] {
        return this.pages;
    }
}

describe('ELPX Download Integration', () => {
    let document: MockDocument;
    let resources: FileResourceProvider;
    let assets: MockAssetProvider;
    let zip: CapturingZipProvider;
    let exporter: Html5Exporter;

    beforeAll(() => {
        document = new MockDocument();
        resources = new FileResourceProvider();
        assets = new MockAssetProvider();
        zip = new CapturingZipProvider();
        exporter = new Html5Exporter(document, resources, assets, zip);
    });

    describe('HTML5 Export with download-source-file iDevice', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should include content.xml at root', async () => {
            await exporter.export();
            expect(zip.hasFile('content.xml')).toBe(true);
        });

        it('should include fflate.umd.js in libs/', async () => {
            await exporter.export();
            expect(zip.hasFile('libs/fflate/fflate.umd.js')).toBe(true);
        });

        it('should include exe_elpx_download.js in libs/', async () => {
            await exporter.export();
            expect(zip.hasFile('libs/exe_elpx_download/exe_elpx_download.js')).toBe(true);
        });

        it('should replace exe-package:elp with onclick handler in HTML', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            // Should contain onclick handler
            expect(indexHtml).toContain('onclick=');
            expect(indexHtml).toContain('downloadElpx');

            // Should NOT contain the raw protocol
            expect(indexHtml).not.toContain('href="exe-package:elp"');
        });

        it('should replace download attribute with project name', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            // Should contain download with project name
            expect(indexHtml).toContain('download="Test Project with Download.elpx"');

            // Should NOT contain the raw protocol attribute
            expect(indexHtml).not.toContain('download="exe-package:elp-name"');
        });

        it('should preserve iDevice styling and structure', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            // Should preserve the CSS classes
            expect(indexHtml).toContain('exe-download-package-instructions');
            expect(indexHtml).toContain('exe-download-package-link');
            expect(indexHtml).toContain('exe-package-info');

            // Should preserve styling
            expect(indexHtml).toContain('background-color:#107275');
        });

        it('should include fflate and exe_elpx_download script tags in HTML head', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            // These script tags are essential for the downloadElpx function to work
            // fflate should be loaded before the download script
            expect(indexHtml).toContain('libs/fflate/fflate.umd.js');
            expect(indexHtml).toContain('libs/exe_elpx_download/exe_elpx_download.js');
        });
    });

    describe('content.xml structure', () => {
        it('should have valid ODE XML structure', async () => {
            await exporter.export();
            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toBeDefined();

            // Should be valid ODE XML
            expect(contentXml).toContain('<?xml version="1.0"');
            expect(contentXml).toContain('<ode');
            expect(contentXml).toContain('xmlns="http://www.intef.es/xsd/ode"');
        });

        it('should include project metadata', async () => {
            await exporter.export();
            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toBeDefined();

            expect(contentXml).toContain('pp_title');
            expect(contentXml).toContain('Test Project with Download');
        });

        it('should include page structure', async () => {
            await exporter.export();
            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toBeDefined();

            expect(contentXml).toContain('odeNavStructure');
            expect(contentXml).toContain('Home Page');
        });
    });
});

describe('ELPX Download with Manual Link (no download-source-file iDevice)', () => {
    let document: MockDocumentWithManualLink;
    let resources: FileResourceProvider;
    let assets: MockAssetProvider;
    let zip: CapturingZipProvider;
    let exporter: Html5Exporter;

    beforeAll(() => {
        document = new MockDocumentWithManualLink();
        resources = new FileResourceProvider();
        assets = new MockAssetProvider();
        zip = new CapturingZipProvider();
        exporter = new Html5Exporter(document, resources, assets, zip);
    });

    describe('HTML5 Export with manual exe-package:elp link in text iDevice', () => {
        it('should export successfully', async () => {
            const result = await exporter.export();
            expect(result.success).toBe(true);
        });

        it('should detect exe-package:elp pattern and include fflate.umd.js', async () => {
            await exporter.export();
            expect(zip.hasFile('libs/fflate/fflate.umd.js')).toBe(true);
        });

        it('should detect exe-package:elp pattern and include exe_elpx_download.js', async () => {
            await exporter.export();
            expect(zip.hasFile('libs/exe_elpx_download/exe_elpx_download.js')).toBe(true);
        });

        it('should replace exe-package:elp with onclick handler', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            expect(indexHtml).toContain('onclick=');
            expect(indexHtml).toContain('downloadElpx');
            expect(indexHtml).not.toContain('href="exe-package:elp"');
        });

        it('should replace download attribute with project name', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            expect(indexHtml).toContain('download="Test Project Manual Link.elpx"');
            expect(indexHtml).not.toContain('download="exe-package:elp-name"');
        });

        it('should include elpx-manifest.js script tag', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            expect(indexHtml).toContain('libs/elpx-manifest.js');
        });

        it('should include fflate and exe_elpx_download script tags in HTML head', async () => {
            await exporter.export();
            const indexHtml = zip.getFileAsString('index.html');
            expect(indexHtml).toBeDefined();

            // These script tags are essential for the downloadElpx function to work
            expect(indexHtml).toContain('libs/fflate/fflate.umd.js');
            expect(indexHtml).toContain('libs/exe_elpx_download/exe_elpx_download.js');
        });

        it('should generate elpx-manifest.js with file list', async () => {
            await exporter.export();
            expect(zip.hasFile('libs/elpx-manifest.js')).toBe(true);

            const manifest = zip.getFileAsString('libs/elpx-manifest.js');
            expect(manifest).toBeDefined();
            expect(manifest).toContain('__ELPX_MANIFEST__');
            // Check for version (with or without space after colon)
            expect(manifest).toMatch(/"version":\s*1/);
            expect(manifest).toContain('"projectTitle": "Test Project Manual Link"');
        });
    });
});
