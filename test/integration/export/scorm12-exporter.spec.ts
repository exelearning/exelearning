/**
 * Integration Tests for Scorm12Exporter
 *
 * Tests the unified SCORM 1.2 export generation system using the real fixture.
 * Verifies that the exported package contains all required files:
 * - imsmanifest.xml with correct schema
 * - SCORM API wrapper files
 * - XSD schema files
 * - HTML pages with SCORM body class
 * - content.xml for re-editing
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
    Scorm12Exporter,
    unzipSync as fflateUnzipSync,
    type ParsedOdeStructure,
} from '../../../src/shared/export';

const testDir = path.join(process.cwd(), 'test', 'temp', 'scorm12-exporter-test');
const fixtureElpx = path.join(process.cwd(), 'test', 'fixtures', 'really-simple-test-project.elpx');
const publicDir = path.join(process.cwd(), 'public');

// Sample parsed structure for unit-level testing
const sampleParsedStructure: ParsedOdeStructure = {
    meta: {
        title: 'SCORM 1.2 Test Project',
        author: 'Test Author',
        language: 'en',
        theme: 'base',
        description: 'A test project for SCORM 1.2 export',
    },
    pages: [
        {
            id: 'page-1',
            title: 'Introduction',
            components: [
                {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    content: '<p>Welcome to the SCORM course.</p>',
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

describe('Scorm12Exporter Integration', () => {
    beforeEach(async () => {
        await fs.ensureDir(testDir);
        await fs.ensureDir(path.join(testDir, 'extracted'));
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('Basic export with sample structure', () => {
        it('should generate SCORM 1.2 package successfully', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should include imsmanifest.xml', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            expect(unzipped['imsmanifest.xml']).toBeDefined();

            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);
            expect(manifest).toContain('<?xml');
            expect(manifest).toContain('<manifest');
        });

        it('should have SCORM 1.2 schema in manifest', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            expect(manifest).toContain('<schema>ADL SCORM</schema>');
            expect(manifest).toContain('<schemaversion>1.2</schemaversion>');
        });

        it('should have resources with scormtype="sco"', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            expect(manifest).toContain('adlcp:scormtype="sco"');
        });

        it('should have COMMON_FILES resource', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            expect(manifest).toContain('identifier="COMMON_FILES"');
            expect(manifest).toContain('<dependency identifierref="COMMON_FILES"/>');
        });

        it('should include SCORM API wrapper files', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const files = Object.keys(unzipped);

            // Check for SCORM API files (may be in libs/ or root)
            const hasScormApi = files.some(f => f.includes('SCORM_API_wrapper.js'));
            const hasScoFunctions = files.some(f => f.includes('SCOFunctions.js'));

            expect(hasScormApi).toBe(true);
            expect(hasScoFunctions).toBe(true);
        });

        it('should include XSD schema files', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const files = Object.keys(unzipped);

            // Check for XSD schema files
            const xsdFiles = files.filter(f => f.endsWith('.xsd'));
            expect(xsdFiles.length).toBeGreaterThan(0);

            // Should have key SCORM 1.2 schema files
            const hasAdlcp = xsdFiles.some(f => f.includes('adlcp'));
            const hasImscp = xsdFiles.some(f => f.includes('imscp'));
            expect(hasAdlcp).toBe(true);
            expect(hasImscp).toBe(true);
        });

        it('should include HTML pages with SCORM body class', async () => {
            const document = new ElpDocumentAdapter(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);

            // Check index.html
            expect(unzipped['index.html']).toBeDefined();
            const indexHtml = new TextDecoder().decode(unzipped['index.html']);
            expect(indexHtml).toContain('exe-scorm');
            expect(indexHtml).toContain('exe-scorm12');
        });
    });

    describe('Export with real ELPX fixture', () => {
        it('should export really-simple-test-project.elpx as SCORM 1.2', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(document.extractedPath!);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
            } finally {
                // Clean up extracted temp directory
                if (document.extractedPath?.includes('/tmp/')) {
                    await fs.remove(document.extractedPath);
                }
            }
        });

        it('should include all 6 pages from fixture', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(document.extractedPath!);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                const htmlFiles = Object.keys(unzipped).filter(f => f.endsWith('.html') && !f.includes('idevices/'));

                // Should have index.html and 5 sub-pages
                expect(htmlFiles).toContain('index.html');
                expect(htmlFiles.length).toBeGreaterThanOrEqual(6);
            } finally {
                if (document.extractedPath?.includes('/tmp/')) {
                    await fs.remove(document.extractedPath);
                }
            }
        });

        it('should include content.xml for re-editing', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(document.extractedPath!);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                expect(unzipped['content.xml']).toBeDefined();

                const contentXml = new TextDecoder().decode(unzipped['content.xml']);
                expect(contentXml).toContain('<?xml');
                expect(contentXml).toContain('<ode');
            } finally {
                if (document.extractedPath?.includes('/tmp/')) {
                    await fs.remove(document.extractedPath);
                }
            }
        });

        it('should have hierarchical organization in manifest', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(document.extractedPath!);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

                // Check organization structure
                expect(manifest).toContain('<organizations');
                expect(manifest).toContain('<organization');
                expect(manifest).toContain('structure="hierarchical"');

                // Check page titles
                expect(manifest).toContain('<title>Page 1</title>');
                expect(manifest).toContain('<title>Page 2</title>');
            } finally {
                if (document.extractedPath?.includes('/tmp/')) {
                    await fs.remove(document.extractedPath);
                }
            }
        });

        it('should include imslrm.xml (LOM metadata)', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(document.extractedPath!);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                expect(unzipped['imslrm.xml']).toBeDefined();

                const lomXml = new TextDecoder().decode(unzipped['imslrm.xml']);
                expect(lomXml).toContain('<?xml');
                expect(lomXml).toContain('lom');
            } finally {
                if (document.extractedPath?.includes('/tmp/')) {
                    await fs.remove(document.extractedPath);
                }
            }
        });

        it('should include theme and library files', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(document.extractedPath!);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                const files = Object.keys(unzipped);

                // Theme files
                const hasThemeCss = files.some(f => f.includes('theme/') && f.endsWith('.css'));
                expect(hasThemeCss).toBe(true);

                // Library files
                const hasJquery = files.some(f => f.includes('jquery'));
                expect(hasJquery).toBe(true);

                // Common JS
                const hasCommonJs = files.some(f => f.includes('common.js'));
                expect(hasCommonJs).toBe(true);
            } finally {
                if (document.extractedPath?.includes('/tmp/')) {
                    await fs.remove(document.extractedPath);
                }
            }
        });

        it('should have navigation structure in HTML pages', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(document.extractedPath!);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                const indexHtml = new TextDecoder().decode(unzipped['index.html']);

                // Should have navigation
                expect(indexHtml).toContain('siteNav');

                // Should have prev/next buttons
                expect(indexHtml).toContain('nav-button');
            } finally {
                if (document.extractedPath?.includes('/tmp/')) {
                    await fs.remove(document.extractedPath);
                }
            }
        });
    });

    describe('Error handling', () => {
        it('should handle empty pages gracefully', async () => {
            const emptyStructure: ParsedOdeStructure = {
                meta: { title: 'Empty', author: '', language: 'en', theme: 'base' },
                pages: [],
                navigation: null,
                raw: null,
            };
            const document = new ElpDocumentAdapter(emptyStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            // Should still produce a package (even if minimal)
            expect(result.success).toBe(true);
        });
    });
});
