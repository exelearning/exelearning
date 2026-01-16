/**
 * Unit tests for PageElpxExporter
 *
 * Tests that single page (subtree) export:
 * 1. Exports only the specified page and its descendants
 * 2. Generates valid ELPX format (content.xml + DTD + HTML)
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { PageElpxExporter } from './PageElpxExporter';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ElpxExportOptions,
} from '../interfaces';

// Mock document with Tree Structure
// Root
//  |- Page 1
//  |- Page 2
//      |- Page 2-1
//      |- Page 2-2
//  |- Page 3
class MockTreeDocument implements ExportDocument {
    private metadata: ExportMetadata;
    private pages: ExportPage[];

    constructor() {
        this.metadata = {
            title: 'Test Tree Project',
            author: 'Test Author',
            language: 'es',
            description: 'A test project with hierarchy',
            license: 'CC-BY-SA 4.0',
            theme: 'base',
        };

        this.pages = [
            {
                id: 'root',
                title: 'Home',
                parentId: null,
                order: 0,
                blocks: [],
            },
            {
                id: 'page-1',
                title: 'Page 1',
                parentId: 'root',
                order: 0,
                blocks: [],
            },
            {
                id: 'page-2',
                title: 'Page 2',
                parentId: 'root',
                order: 1,
                blocks: [],
                properties: {
                    titleHtml: 'Page 2 HTML Title',
                    description: 'Page 2 Description',
                },
            },
            {
                id: 'page-2-1',
                title: 'Page 2-1',
                parentId: 'page-2',
                order: 0,
                blocks: [],
            },
            {
                id: 'page-2-2',
                title: 'Page 2-2',
                parentId: 'page-2',
                order: 1,
                blocks: [],
            },
            {
                id: 'page-3',
                title: 'Page 3',
                parentId: 'root',
                order: 2,
                blocks: [],
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

// Minimal Mocks
class MockResourceProvider implements ResourceProvider {
    async fetchTheme(): Promise<Map<string, Uint8Array>> {
        return new Map([
            ['style.css', new Uint8Array()],
            ['style.js', new Uint8Array()],
        ]);
    }
    async fetchIdeviceResources(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchBaseLibraries(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchLibraryFiles(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchScormFiles(): Promise<Map<string, Uint8Array>> {
        return new Map();
    }
    async fetchContentCss(): Promise<Map<string, Uint8Array>> {
        return new Map([['content/css/base.css', new Uint8Array()]]);
    }
    async fetchExeLogo(): Promise<Uint8Array | null> {
        return null;
    }
    normalizeIdeviceType(type: string): string {
        return type;
    }
}

class MockAssetProvider implements AssetProvider {
    async getAsset(): Promise<null> {
        return null;
    }
    async getAllAssets(): Promise<any[]> {
        return [];
    }
    async getProjectAssets(): Promise<any[]> {
        return [];
    }
}

class CapturingZipProvider implements ZipProvider {
    files = new Map<string, string | Uint8Array>();

    // Implement ZipArchive methods directly on provider for test simplicity
    addFile(path: string, content: string | Uint8Array) {
        this.files.set(path, content);
    }

    addFiles(files: Map<string, string | Uint8Array>) {
        files.forEach((v, k) => this.files.set(k, v));
    }

    hasFile(path: string) {
        return this.files.has(path);
    }

    getFilePaths() {
        return Array.from(this.files.keys());
    }

    async generate() {
        return new Uint8Array();
    }

    async generateAsync() {
        return new Uint8Array();
    }

    createZip() {
        return this as unknown as any;
    }

    // Test Helper
    getFileAsString(path: string): string | undefined {
        const content = this.files.get(path);
        if (!content) return undefined;
        if (typeof content === 'string') return content;
        return new TextDecoder().decode(content);
    }
}

describe('PageElpxExporter Unit Tests', () => {
    let document: MockTreeDocument;
    let resources: MockResourceProvider;
    let assets: MockAssetProvider;
    let zip: CapturingZipProvider;
    let exporter: PageElpxExporter;

    beforeAll(() => {
        document = new MockTreeDocument();
        resources = new MockResourceProvider();
        assets = new MockAssetProvider();
        zip = new CapturingZipProvider();
        exporter = new PageElpxExporter(document, resources, assets, zip);
    });

    describe('Exporting Subtree (Page 2)', () => {
        it('should export only Page 2 and its children', async () => {
            zip.files.clear();

            const options: ElpxExportOptions = {
                rootPageId: 'page-2',
                filename: 'page2_export',
            };

            const result = await exporter.export(options);
            if (!result.success) console.error('Export failed:', result.error);
            expect(result.success).toBe(true);

            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toBeDefined();

            // Should contain Page 2 and its children
            expect(contentXml).toContain('Page 2');
            expect(contentXml).toContain('Page 2-1');
            expect(contentXml).toContain('Page 2-2');

            // Should contain properties
            expect(contentXml).toContain('<key>titleHtml</key>');
            expect(contentXml).toContain('<value>Page 2 HTML Title</value>');
            expect(contentXml).toContain('<key>description</key>');
            expect(contentXml).toContain('<value>Page 2 Description</value>');

            // Should NOT contain Page 1 or Page 3
            expect(contentXml).not.toContain('Page 1');
            expect(contentXml).not.toContain('Page 3');
        });

        it('should handle missing rootPageId by exporting all', async () => {
            zip.files.clear();
            const result = await exporter.export({});
            expect(result.success).toBe(true);

            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toContain('Page 1');
            expect(contentXml).toContain('Page 3');
        });

        it('should handle invalid rootPageId by exporting all (fallback)', async () => {
            zip.files.clear();
            const result = await exporter.export({ rootPageId: 'invalid-id' });
            expect(result.success).toBe(true);

            const contentXml = zip.getFileAsString('content.xml');
            expect(contentXml).toContain('Page 1');
        });
    });
});
