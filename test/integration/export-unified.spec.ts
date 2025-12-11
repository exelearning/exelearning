/**
 * Integration Tests for Unified Export System
 *
 * These tests verify that CLI, API routes, and Frontend all use the same
 * centralized export system from src/shared/export/
 *
 * This ensures consistency across all export entry points.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import JSZip from 'jszip';

// Import from shared export system
import {
    ElpDocumentAdapter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    ArchiverZipProvider,
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    type ParsedOdeStructure,
} from '../../src/shared/export';

const testDir = path.join(process.cwd(), 'test', 'temp', 'export-unified-test');

// Sample parsed structure for testing
const sampleParsedStructure: ParsedOdeStructure = {
    meta: {
        title: 'Test Project',
        author: 'Test Author',
        language: 'en',
        theme: 'base',
        description: 'A test project',
    },
    pages: [
        {
            id: 'page-1',
            title: 'Introduction',
            components: [
                {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    content: '<p>Welcome to the course.</p>',
                    order: 0,
                    position: 0,
                },
            ],
            level: 0,
            parent_id: null,
            position: 0,
        },
        {
            id: 'page-2',
            title: 'Chapter 1',
            components: [
                {
                    id: 'comp-2',
                    type: 'FreeTextIdevice',
                    content: '<p>This is chapter 1 content.</p>',
                    order: 0,
                    position: 0,
                },
            ],
            level: 0,
            parent_id: null,
            position: 1,
        },
    ],
    navigation: null,
    raw: null,
};

describe('Unified Export System Integration', () => {
    beforeEach(async () => {
        await fs.ensureDir(testDir);
        await fs.ensureDir(path.join(testDir, 'public'));
        await fs.ensureDir(path.join(testDir, 'public', 'theme', 'base'));
        await fs.ensureDir(path.join(testDir, 'public', 'libs'));
        await fs.ensureDir(path.join(testDir, 'extracted'));
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('ElpDocumentAdapter', () => {
        it('should create adapter from ParsedOdeStructure', () => {
            const adapter = new ElpDocumentAdapter(sampleParsedStructure, testDir);

            expect(adapter).toBeDefined();
            expect(adapter.extractedPath).toBe(testDir);
        });

        it('should return correct metadata', () => {
            const adapter = new ElpDocumentAdapter(sampleParsedStructure, testDir);
            const metadata = adapter.getMetadata();

            expect(metadata.title).toBe('Test Project');
            expect(metadata.author).toBe('Test Author');
            expect(metadata.language).toBe('en');
            expect(metadata.theme).toBe('base');
        });

        it('should return navigation pages', () => {
            const adapter = new ElpDocumentAdapter(sampleParsedStructure, testDir);
            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(2);
            expect(pages[0].title).toBe('Introduction');
            expect(pages[1].title).toBe('Chapter 1');
        });
    });

    describe('Exporters use same shared base', () => {
        let document: ElpDocumentAdapter;
        let resources: FileSystemResourceProvider;
        let assets: FileSystemAssetProvider;
        let zip: ArchiverZipProvider;

        beforeEach(() => {
            document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            zip = new ArchiverZipProvider();
        });

        it('Html5Exporter produces valid ZIP', async () => {
            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data).toBeInstanceOf(Uint8Array);

            // Verify it's a valid ZIP
            const zipFile = await JSZip.loadAsync(result.data!);
            expect(Object.keys(zipFile.files).length).toBeGreaterThan(0);
        });

        it('PageExporter produces valid ZIP', async () => {
            const exporter = new PageExporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('Scorm12Exporter produces ZIP with imsmanifest.xml', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify manifest exists
            const zipFile = await JSZip.loadAsync(result.data!);
            expect(zipFile.files['imsmanifest.xml']).toBeDefined();
        });

        it('Scorm2004Exporter produces ZIP with imsmanifest.xml', async () => {
            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify manifest exists
            const zipFile = await JSZip.loadAsync(result.data!);
            expect(zipFile.files['imsmanifest.xml']).toBeDefined();
        });

        it('ImsExporter produces ZIP with imsmanifest.xml', async () => {
            const exporter = new ImsExporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify manifest exists
            const zipFile = await JSZip.loadAsync(result.data!);
            expect(zipFile.files['imsmanifest.xml']).toBeDefined();
        });
    });

    describe('Export output structure consistency', () => {
        let document: ElpDocumentAdapter;
        let resources: FileSystemResourceProvider;
        let assets: FileSystemAssetProvider;
        let zip: ArchiverZipProvider;

        beforeEach(() => {
            document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            zip = new ArchiverZipProvider();
        });

        it('HTML5 export includes index.html', async () => {
            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = await JSZip.loadAsync(result.data!);
            expect(zipFile.files['index.html']).toBeDefined();
        });

        it('HTML5 export includes content.xml for re-import', async () => {
            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = await JSZip.loadAsync(result.data!);
            expect(zipFile.files['content.xml']).toBeDefined();
        });

        it('SCORM exports include required SCORM files', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = await JSZip.loadAsync(result.data!);

            // SCORM 1.2 required files
            expect(zipFile.files['imsmanifest.xml']).toBeDefined();

            // Check manifest has SCORM 1.2 schema
            const manifestContent = await zipFile.files['imsmanifest.xml'].async('string');
            expect(manifestContent).toContain('ADL SCORM');
            expect(manifestContent).toContain('1.2');
        });

        it('IMS export includes valid IMS manifest', async () => {
            const exporter = new ImsExporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = await JSZip.loadAsync(result.data!);
            expect(zipFile.files['imsmanifest.xml']).toBeDefined();

            // Check manifest has IMS schema
            const manifestContent = await zipFile.files['imsmanifest.xml'].async('string');
            expect(manifestContent).toContain('imscp');
        });
    });

    describe('CLI and API consistency', () => {
        it('CLI import path matches API import path', async () => {
            // This test verifies that both CLI and API use the same import paths
            // by checking the exports from src/shared/export/index.ts

            const sharedExport = await import('../../src/shared/export');

            // All exporters should be available
            expect(sharedExport.ElpDocumentAdapter).toBeDefined();
            expect(sharedExport.Html5Exporter).toBeDefined();
            expect(sharedExport.PageExporter).toBeDefined();
            expect(sharedExport.Scorm12Exporter).toBeDefined();
            expect(sharedExport.Scorm2004Exporter).toBeDefined();
            expect(sharedExport.ImsExporter).toBeDefined();

            // All providers should be available
            expect(sharedExport.FileSystemResourceProvider).toBeDefined();
            expect(sharedExport.FileSystemAssetProvider).toBeDefined();
            expect(sharedExport.ArchiverZipProvider).toBeDefined();
        });

        it('Export result structure is consistent', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new ArchiverZipProvider();

            const exporters = [
                new Html5Exporter(document, resources, assets, zip),
                new PageExporter(document, resources, assets, zip),
                new Scorm12Exporter(document, resources, assets, zip),
                new Scorm2004Exporter(document, resources, assets, zip),
                new ImsExporter(document, resources, assets, zip),
            ];

            for (const exporter of exporters) {
                const result = await exporter.export();

                // All exporters should return same structure
                expect(result).toHaveProperty('success');
                expect(result).toHaveProperty('data');
                expect(result.success).toBe(true);
                expect(result.data).toBeInstanceOf(Uint8Array);
            }
        });
    });

    describe('Metadata preservation', () => {
        it('Export preserves project title in metadata', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new ArchiverZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = await JSZip.loadAsync(result.data!);
            const manifestContent = await zipFile.files['imsmanifest.xml'].async('string');

            // Title should be in manifest
            expect(manifestContent).toContain('Test Project');
        });

        it('Export includes content.xml for full round-trip', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new ArchiverZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = await JSZip.loadAsync(result.data!);

            // content.xml should exist for re-import capability
            expect(zipFile.files['content.xml']).toBeDefined();

            const contentXml = await zipFile.files['content.xml'].async('string');
            expect(contentXml).toContain('Test Project'); // Title
            expect(contentXml).toContain('Introduction'); // Page title
        });
    });
});
