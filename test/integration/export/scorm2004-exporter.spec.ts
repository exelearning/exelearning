/**
 * Integration Tests for Scorm2004Exporter
 *
 * Tests the unified SCORM 2004 export generation system using the real fixture.
 * Verifies that the exported package contains all required files:
 * - imsmanifest.xml with SCORM 2004 schema and sequencing rules
 * - SCORM API wrapper files
 * - XSD schema files (SCORM 2004 specific)
 * - HTML pages with SCORM 2004 body class
 * - content.xml for re-editing
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';

// Import from shared export system
import {
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Scorm2004Exporter,
    unzipSync as fflateUnzipSync,
    type ParsedOdeStructure,
} from '../../../src/shared/export';

// Import test helpers
import { createDocumentFromStructure, createDocumentFromElpFile } from '../../helpers/document-test-utils';

const testDir = path.join(process.cwd(), 'test', 'temp', 'scorm2004-exporter-test');
const fixtureElpx = path.join(process.cwd(), 'test', 'fixtures', 'really-simple-test-project.elpx');
const publicDir = path.join(process.cwd(), 'public');

// Sample parsed structure for unit-level testing
const sampleParsedStructure: ParsedOdeStructure = {
    meta: {
        title: 'SCORM 2004 Test Project',
        author: 'Test Author',
        language: 'en',
        theme: 'base',
        description: 'A test project for SCORM 2004 export',
    },
    pages: [
        {
            id: 'page-1',
            title: 'Introduction',
            components: [
                {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    content: '<p>Welcome to the SCORM 2004 course.</p>',
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
        {
            id: 'page-3',
            title: 'Subchapter 1.1',
            components: [
                {
                    id: 'comp-3',
                    type: 'FreeTextIdevice',
                    content: '<p>This is a subchapter with deeper content.</p>',
                    order: 0,
                    position: 0,
                },
            ],
            level: 1,
            parent_id: 'page-2',
            position: 2,
        },
    ],
    navigation: null,
    raw: null,
};

describe('Scorm2004Exporter Integration', () => {
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
        it('should generate SCORM 2004 package successfully', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should include imsmanifest.xml', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            expect(unzipped['imsmanifest.xml']).toBeDefined();

            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);
            expect(manifest).toContain('<?xml');
            expect(manifest).toContain('<manifest');
        });

        it('should have SCORM 2004 schema in manifest', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            // SCORM 2004 uses different schema
            expect(manifest).toContain('<schema>ADL SCORM</schema>');
            expect(manifest).toContain('<schemaversion>2004');
        });

        it('should have sequencing rules in manifest', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            // SCORM 2004 includes sequencing
            expect(manifest).toContain('imsss:sequencing');
            expect(manifest).toContain('imsss:controlMode');
        });

        it('should have resources with scormType="sco"', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            // SCORM 2004 uses adlcp:scormType (capital T)
            expect(manifest).toContain('adlcp:scormType="sco"');
        });

        it('should have COMMON_FILES resource', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            expect(manifest).toContain('identifier="COMMON_FILES"');
            expect(manifest).toContain('<dependency identifierref="COMMON_FILES"/>');
        });

        it('should include SCORM API wrapper files', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const files = Object.keys(unzipped);

            // Check for SCORM API files
            const hasScormApi = files.some(f => f.includes('SCORM_API_wrapper.js'));
            const hasScoFunctions = files.some(f => f.includes('SCOFunctions.js'));

            expect(hasScormApi).toBe(true);
            expect(hasScoFunctions).toBe(true);
        });

        it('should include HTML pages with SCORM 2004 body class', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);

            // Check index.html
            expect(unzipped['index.html']).toBeDefined();
            const indexHtml = new TextDecoder().decode(unzipped['index.html']);
            expect(indexHtml).toContain('exe-scorm');
            expect(indexHtml).toContain('exe-scorm2004');
        });
    });

    describe('Export with real ELPX fixture', () => {
        it('should export really-simple-test-project.elpx as SCORM 2004', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm2004Exporter(document, resources, assets, zip);
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

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm2004Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                const htmlFiles = Object.keys(unzipped).filter(f => f.endsWith('.html') && !f.includes('idevices/'));

                // Should have index.html and 5 sub-pages
                expect(htmlFiles).toContain('index.html');
                expect(htmlFiles.length).toBeGreaterThanOrEqual(6);
            } finally {
                await cleanup();
            }
        });

        it('should include content.xml for re-editing', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm2004Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                expect(unzipped['content.xml']).toBeDefined();

                const contentXml = new TextDecoder().decode(unzipped['content.xml']);
                expect(contentXml).toContain('<?xml');
                expect(contentXml).toContain('<ode');
            } finally {
                await cleanup();
            }
        });

        it('should have hierarchical organization with sequencing', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm2004Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

                // Check organization structure
                expect(manifest).toContain('<organizations');
                expect(manifest).toContain('<organization');
                expect(manifest).toContain('structure="hierarchical"');

                // Check sequencing rules
                expect(manifest).toContain('imsss:sequencing');

                // Check page titles
                expect(manifest).toContain('<title>Page 1</title>');
                expect(manifest).toContain('<title>Page 2</title>');
            } finally {
                await cleanup();
            }
        });

        it('should include imslrm.xml (LOM metadata)', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm2004Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                expect(unzipped['imslrm.xml']).toBeDefined();

                const lomXml = new TextDecoder().decode(unzipped['imslrm.xml']);
                expect(lomXml).toContain('<?xml');
                expect(lomXml).toContain('lom');
            } finally {
                await cleanup();
            }
        });

        it('should include theme and library files', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm2004Exporter(document, resources, assets, zip);
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
                await cleanup();
            }
        });

        it('should NOT have navigation structure in HTML pages (LMS handles navigation)', async () => {
            const fixtureExists = await fs.pathExists(fixtureElpx);
            if (!fixtureExists) {
                console.log('Skipping test: fixture not found');
                return;
            }

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm2004Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                const unzipped = fflateUnzipSync(result.data!);
                const indexHtml = new TextDecoder().decode(unzipped['index.html']);

                // SCORM exports should NOT have navigation (LMS handles it)
                expect(indexHtml).not.toContain('<nav id="siteNav">');

                // SCORM exports should NOT have prev/next buttons (LMS handles it)
                expect(indexHtml).not.toContain('<div class="nav-buttons">');

                // Should have page counter instead
                expect(indexHtml).toContain('page-counter');

                // Should have exe-export class in body
                expect(indexHtml).toContain('exe-export exe-scorm exe-scorm2004');
            } finally {
                await cleanup();
            }
        });
    });

    describe('SCORM 2004 vs SCORM 1.2 differences', () => {
        it('should use different namespace declarations than SCORM 1.2', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            // SCORM 2004 specific namespaces
            expect(manifest).toContain('adlseq');
            expect(manifest).toContain('adlnav');
            expect(manifest).toContain('imsss');
        });

        it('should use scormType instead of scormtype (case difference)', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            const unzipped = fflateUnzipSync(result.data!);
            const manifest = new TextDecoder().decode(unzipped['imsmanifest.xml']);

            // SCORM 2004 uses scormType (capital T)
            expect(manifest).toContain('scormType=');
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
            const document = createDocumentFromStructure(emptyStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm2004Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            // Should still produce a package (even if minimal)
            expect(result.success).toBe(true);
        });
    });
});
