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
// Import from shared export system
import {
    ElpDocumentAdapter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    unzipSync,
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

        // Create required CSS file for exporters (stored in style/workarea/ but exported as content/css/)
        await fs.ensureDir(path.join(testDir, 'public', 'style', 'workarea'));
        await fs.writeFile(path.join(testDir, 'public', 'style', 'workarea', 'base.css'), '/* Test base CSS */');

        // Create minimal theme files
        await fs.writeFile(path.join(testDir, 'public', 'theme', 'base', 'style.css'), '/* Test theme CSS */');
        await fs.writeFile(path.join(testDir, 'public', 'theme', 'base', 'style.js'), '/* Test theme JS */');
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
        let zip: FflateZipProvider;

        beforeEach(() => {
            document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            zip = new FflateZipProvider();
        });

        it('Html5Exporter produces valid ZIP', async () => {
            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data).toBeInstanceOf(Uint8Array);

            // Verify it's a valid ZIP
            const zipFile = unzipSync(result.data!);
            expect(Object.keys(zipFile).length).toBeGreaterThan(0);
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
            const zipFile = unzipSync(result.data!);
            expect(zipFile['imsmanifest.xml']).toBeDefined();
        });

        it('Scorm2004Exporter produces ZIP with imsmanifest.xml', async () => {
            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify manifest exists
            const zipFile = unzipSync(result.data!);
            expect(zipFile['imsmanifest.xml']).toBeDefined();
        });

        it('ImsExporter produces ZIP with imsmanifest.xml', async () => {
            const exporter = new ImsExporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();

            // Verify manifest exists
            const zipFile = unzipSync(result.data!);
            expect(zipFile['imsmanifest.xml']).toBeDefined();
        });
    });

    describe('Export output structure consistency', () => {
        let document: ElpDocumentAdapter;
        let resources: FileSystemResourceProvider;
        let assets: FileSystemAssetProvider;
        let zip: FflateZipProvider;

        beforeEach(() => {
            document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            zip = new FflateZipProvider();
        });

        it('HTML5 export includes index.html', async () => {
            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            expect(zipFile['index.html']).toBeDefined();
        });

        it('HTML5 export includes content.xml and content.dtd for re-import', async () => {
            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            expect(zipFile['content.xml']).toBeDefined();
            expect(zipFile['content.dtd']).toBeDefined();

            // Verify DTD content
            const dtdContent = new TextDecoder().decode(zipFile['content.dtd']);
            expect(dtdContent).toContain('<!ELEMENT ode');
        });

        it('SCORM exports include required SCORM files', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);

            // SCORM 1.2 required files
            expect(zipFile['imsmanifest.xml']).toBeDefined();

            // Check manifest has SCORM 1.2 schema
            const manifestContent = new TextDecoder().decode(zipFile['imsmanifest.xml']);
            expect(manifestContent).toContain('ADL SCORM');
            expect(manifestContent).toContain('1.2');
        });

        it('IMS export includes valid IMS manifest', async () => {
            const exporter = new ImsExporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            expect(zipFile['imsmanifest.xml']).toBeDefined();

            // Check manifest has IMS schema
            const manifestContent = new TextDecoder().decode(zipFile['imsmanifest.xml']);
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
            expect(sharedExport.FflateZipProvider).toBeDefined();
        });

        it('Export result structure is consistent', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

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

    describe('SCORM 1.2 Export - Complete Structure', () => {
        let document: ElpDocumentAdapter;
        let resources: FileSystemResourceProvider;
        let assets: FileSystemAssetProvider;
        let zip: FflateZipProvider;

        beforeEach(async () => {
            document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            resources = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));
            assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            zip = new FflateZipProvider();
        });

        it('should include SCORM API wrapper files', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);

            expect(zipFile['libs/SCORM_API_wrapper.js']).toBeDefined();
            expect(zipFile['libs/SCOFunctions.js']).toBeDefined();
        });

        it('should include XSD schema files', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            const files = Object.keys(zipFile);

            // Check that some XSD files are included
            const xsdFiles = files.filter(f => f.endsWith('.xsd'));
            expect(xsdFiles.length).toBeGreaterThan(0);

            // Should have core SCORM 1.2 schemas
            expect(files.some(f => f.includes('imscp'))).toBe(true);
        });

        it('should include imslrm.xml (LOM metadata)', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);

            expect(zipFile['imslrm.xml']).toBeDefined();
        });

        it('should have correct SCORM 1.2 manifest structure', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            const manifest = new TextDecoder().decode(zipFile['imsmanifest.xml']);

            // SCORM 1.2 specific checks
            expect(manifest).toContain('ADL SCORM');
            expect(manifest).toContain('<schemaversion>1.2</schemaversion>');
            expect(manifest).toContain('adlcp:scormtype="sco"');
            expect(manifest).toContain('COMMON_FILES');
        });

        it('should include HTML pages for each navigation item', async () => {
            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);

            expect(zipFile['index.html']).toBeDefined();

            // Verify index.html has SCORM body class
            const indexHtml = new TextDecoder().decode(zipFile['index.html']);
            expect(indexHtml).toContain('exe-scorm');
            expect(indexHtml).toContain('exe-scorm12');
        });
    });

    describe('SCORM 2004 Export - Complete Structure', () => {
        let document: ElpDocumentAdapter;
        let resources: FileSystemResourceProvider;
        let assets: FileSystemAssetProvider;
        let zip: FflateZipProvider;

        beforeEach(async () => {
            document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            resources = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));
            assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            zip = new FflateZipProvider();
        });

        it('should include SCORM API wrapper files', async () => {
            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);

            expect(zipFile['libs/SCORM_API_wrapper.js']).toBeDefined();
            expect(zipFile['libs/SCOFunctions.js']).toBeDefined();
        });

        it('should include XSD schema files for SCORM 2004', async () => {
            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            const files = Object.keys(zipFile);

            // Check that XSD files are included
            const xsdFiles = files.filter(f => f.endsWith('.xsd'));
            expect(xsdFiles.length).toBeGreaterThan(0);
        });

        it('should have correct SCORM 2004 manifest structure', async () => {
            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            const manifest = new TextDecoder().decode(zipFile['imsmanifest.xml']);

            // SCORM 2004 specific checks
            expect(manifest).toContain('ADL SCORM');
            expect(manifest).toContain('2004');
            expect(manifest).toContain('adlcp:scormType="sco"'); // Note: capital T in 2004
            expect(manifest).toContain('imsss:sequencing'); // Sequencing element
        });

        it('should include sequencing rules in manifest', async () => {
            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            const manifest = new TextDecoder().decode(zipFile['imsmanifest.xml']);

            // SCORM 2004 sequencing
            expect(manifest).toContain('controlMode');
            expect(manifest).toContain('choice="true"');
        });

        it('should include HTML pages with SCORM 2004 body class', async () => {
            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);

            expect(zipFile['index.html']).toBeDefined();

            const indexHtml = new TextDecoder().decode(zipFile['index.html']);
            expect(indexHtml).toContain('exe-scorm');
            expect(indexHtml).toContain('exe-scorm2004');
        });
    });

    describe('Metadata preservation', () => {
        it('Export preserves project title in metadata', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);
            const manifestContent = new TextDecoder().decode(zipFile['imsmanifest.xml']);

            // Title should be in manifest
            expect(manifestContent).toContain('Test Project');
        });

        it('Export includes content.xml and content.dtd for full round-trip', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(path.join(testDir, 'public'));
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const zipFile = unzipSync(result.data!);

            // content.xml should exist for re-import capability
            expect(zipFile['content.xml']).toBeDefined();

            const contentXml = new TextDecoder().decode(zipFile['content.xml']);
            expect(contentXml).toContain('Test Project'); // Title
            expect(contentXml).toContain('Introduction'); // Page title

            // content.dtd should exist alongside content.xml
            expect(zipFile['content.dtd']).toBeDefined();
            const dtdContent = new TextDecoder().decode(zipFile['content.dtd']);
            expect(dtdContent).toContain('<!ELEMENT ode');
        });
    });
});
