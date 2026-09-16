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
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Scorm12Exporter,
    unzipSync as fflateUnzipSync,
    type ParsedOdeStructure,
} from '../../../src/shared/export';

// Import test helpers
import { createDocumentFromStructure, createDocumentFromElpFile } from '../../helpers/document-test-utils';
import { formatUnloadFindings, scanPackageForUnloadHandlers } from '../../helpers/unload-handler-scanner';

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
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should include imsmanifest.xml', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
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
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
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
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
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
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
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
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
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

        it('should include HTML pages with SCORM body class', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
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

            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
                const result = await exporter.export();

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
            } finally {
                await cleanup();
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
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
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
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
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

        it('should have hierarchical organization in manifest', async () => {
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
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
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
                const exporter = new Scorm12Exporter(document, resources, assets, zip);
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
                expect(indexHtml).toContain('exe-export exe-scorm exe-scorm12');
            } finally {
                await cleanup();
            }
        });
    });

    describe('SCORM 1.2 runtime packaging (clean-provenance rewrite)', () => {
        async function exportPackage() {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();
            expect(result.success).toBe(true);
            return fflateUnzipSync(result.data!);
        }

        it('ships the vendored pipwerks wrapper byte-identical to the repository copy', async () => {
            const unzipped = await exportPackage();

            const vendoredPath = path.join(
                publicDir,
                'app',
                'common',
                'scorm',
                'scorm12',
                'vendor',
                'pipwerks',
                'SCORM_API_wrapper.js',
            );
            const vendored = await fs.readFile(vendoredPath);
            expect(Buffer.from(unzipped['libs/SCORM_API_wrapper.js']).equals(vendored)).toBe(true);
        });

        it('keeps the MIT license notice inside the exported package', async () => {
            const unzipped = await exportPackage();

            const wrapper = new TextDecoder().decode(unzipped['libs/SCORM_API_wrapper.js']);
            expect(wrapper).toContain('MIT-style license');
            expect(wrapper).toContain('pipwerks SCORM Wrapper for JavaScript');
        });

        it('ships the assembled project runtime instead of the legacy SCOFunctions.js', async () => {
            const unzipped = await exportPackage();

            const scoFunctions = new TextDecoder().decode(unzipped['libs/SCOFunctions.js']);
            // The assembled AGPL runtime: every layer under its section marker…
            expect(scoFunctions).toContain('SPDX-License-Identifier: AGPL-3.0-or-later');
            for (const layer of [
                'exe-scorm12-client.js',
                'exe-scorm12-activities.js',
                'exe-scorm12-policy.js',
                'exe-scorm12-lifecycle.js',
                'exe-scorm12-adapter.js',
            ]) {
                expect(scoFunctions).toContain(`/* ==== ${layer} ==== */`);
            }
            // …and none of the legacy ADL/CTC-derived file.
            expect(scoFunctions).not.toContain('ADL Technical Team');
            expect(scoFunctions).not.toContain('convertTotalMiliSeconds');
        });

        it('emits no unload/beforeunload attributes or handlers in the pages', async () => {
            const unzipped = await exportPackage();

            const htmlFiles = Object.keys(unzipped).filter(f => f.endsWith('.html') && !f.includes('idevices/'));
            expect(htmlFiles.length).toBeGreaterThan(0);
            for (const file of htmlFiles) {
                const html = new TextDecoder().decode(unzipped[file]);
                expect(html).not.toContain('onunload');
                expect(html).not.toContain('onbeforeunload');
                expect(html).toContain('onload="loadPage()"');
            }
        });

        it('assembles the runtime layers in load order', async () => {
            const unzipped = await exportPackage();
            const scoFunctions = new TextDecoder().decode(unzipped['libs/SCOFunctions.js']);

            const order = [
                'exe-scorm12-client.js',
                'exe-scorm12-activities.js',
                'exe-scorm12-policy.js',
                'exe-scorm12-lifecycle.js',
                'exe-scorm12-adapter.js',
            ].map(layer => scoFunctions.indexOf(`/* ==== ${layer} ==== */`));

            expect(order.every(position => position !== -1)).toBe(true);
            expect(order).toEqual([...order].sort((a, b) => a - b));
        });
    });

    // The acceptance target is zero unload/beforeunload handlers anywhere in a
    // newly exported SCORM 1.2 package: not only the page bodies, but every
    // inline script, every runtime library and every iDevice JavaScript file
    // copied into it. An unload-family listener anywhere on the page disables
    // the back/forward cache the SCORM 1.2 runtime relies on.
    describe('SCORM 1.2 package carries no unload/beforeunload handlers', () => {
        it('holds for a minimal text-only package', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const result = await new Scorm12Exporter(document, resources, assets, zip).export();
            const findings = scanPackageForUnloadHandlers(fflateUnzipSync(result.data!));

            expect(formatUnloadFindings(findings)).toBe('');
        });

        it('holds for a package built from the real ELPX fixture', async () => {
            const { document, extractedPath, cleanup } = await createDocumentFromElpFile(fixtureElpx);
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(extractedPath);
            const zip = new FflateZipProvider();

            try {
                const result = await new Scorm12Exporter(document, resources, assets, zip).export();
                const findings = scanPackageForUnloadHandlers(fflateUnzipSync(result.data!));

                expect(formatUnloadFindings(findings)).toBe('');
            } finally {
                await cleanup();
            }
        });

        // Regression fixture: one page per iDevice whose export runtime binds a
        // page-lifecycle handler. The list is derived from the repository
        // itself, so an iDevice added (or reverted) later is covered
        // automatically rather than silently dropped from the fixture.
        //
        // The component type is the iDevice's export folder name, because that
        // is what normalizeIdeviceType() resolves to and therefore what makes
        // the exporter copy the folder's JavaScript into the package. Getting
        // that wrong would leave the scan trivially green, so the test asserts
        // the files are really there before scanning them.
        it('holds for a package containing every lifecycle-binding iDevice', async () => {
            const ideviceRoot = path.join(publicDir, 'files', 'perm', 'idevices', 'base');
            const folders = (await fs.readdir(ideviceRoot)).filter(folder => {
                const exportDir = path.join(ideviceRoot, folder, 'export');
                if (!fs.existsSync(exportDir)) {
                    return false;
                }
                return fs
                    .readdirSync(exportDir)
                    .filter(file => file.endsWith('.js'))
                    .some(file => fs.readFileSync(path.join(exportDir, file), 'utf8').includes('pagehide'));
            });
            // Only the runtimes that persist state or clean up on page hide
            // still bind `pagehide`; they anchor the fixture so that the
            // filter can never go trivially empty.
            expect(folders).toEqual(
                expect.arrayContaining([
                    'challenge',
                    'crossword',
                    'padlock',
                    'trivial',
                    'three-d-viewer',
                    'three-sixty-viewer',
                ]),
            );

            const structure: ParsedOdeStructure = {
                meta: { title: 'iDevice matrix', author: '', language: 'en', theme: 'base' },
                pages: folders.map((folder, index) => ({
                    id: `page-${index}`,
                    title: folder,
                    components: [
                        {
                            id: `comp-${index}`,
                            type: folder,
                            content: `<div class="idevice_node" id="id-${index}">${folder}</div>`,
                            order: 0,
                            position: 0,
                        },
                    ],
                    level: 0,
                    parent_id: null,
                    position: index,
                })),
                navigation: null,
                raw: null,
            };

            const document = createDocumentFromStructure(structure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const result = await new Scorm12Exporter(document, resources, assets, zip).export();
            const unzipped = fflateUnzipSync(result.data!);

            // Positive control: without this, a fixture that failed to pull the
            // iDevice JavaScript in would pass the scan for the wrong reason.
            const withoutJavaScript = folders.filter(
                folder =>
                    !Object.keys(unzipped).some(
                        entry => entry.startsWith(`idevices/${folder}/`) && entry.endsWith('.js'),
                    ),
            );
            expect(withoutJavaScript).toEqual([]);
            expect(Object.keys(unzipped)).toContain('idevices/three-d-viewer/three-d-viewer-runtime.js');
            expect(Object.keys(unzipped)).toContain('idevices/three-sixty-viewer/three-sixty-viewer.js');

            expect(formatUnloadFindings(scanPackageForUnloadHandlers(unzipped))).toBe('');
        });

        it('the scanner would catch a handler if one were reintroduced', async () => {
            const document = createDocumentFromStructure(sampleParsedStructure, path.join(testDir, 'extracted'));
            const resources = new FileSystemResourceProvider(publicDir);
            const assets = new FileSystemAssetProvider(path.join(testDir, 'extracted'));
            const zip = new FflateZipProvider();

            const result = await new Scorm12Exporter(document, resources, assets, zip).export();
            const unzipped = fflateUnzipSync(result.data!);
            unzipped['libs/regression-probe.js'] = new TextEncoder().encode(
                "$(window).on('unload.probe beforeunload.probe', function () {});",
            );

            const findings = scanPackageForUnloadHandlers(unzipped);

            expect(findings).toHaveLength(1);
            expect(findings[0].file).toBe('libs/regression-probe.js');
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

            const exporter = new Scorm12Exporter(document, resources, assets, zip);
            const result = await exporter.export();

            // Should still produce a package (even if minimal)
            expect(result.success).toBe(true);
        });
    });
});
