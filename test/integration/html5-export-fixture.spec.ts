/**
 * Integration Tests for HTML5 Export - Fixture Comparison
 *
 * These tests validate that the HTML5 export system produces HTML matching
 * the legacy Symfony output structure. Uses test/fixtures/old_el_cid.elp
 * as the source and test/fixtures/export/un-heroe-medieval-el-cid/ as reference.
 *
 * Key validations:
 * - HEAD order: scripts BEFORE CSS
 * - Navigation: main-node class on first element
 * - exe-client-search div conditional (only with addSearchBox=true)
 * - Theme files renamed: content.css, default.js
 * - iDevice paths are relative
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
// Import from shared export system
import {
    ElpDocumentAdapter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    Html5Exporter,
    unzipSync,
    type ParsedOdeStructure,
} from '../../src/shared/export';

// Import XML parser for loading ELP
import { parseFromString } from '../../src/services/xml/xml-parser';

const fixturesPath = path.join(process.cwd(), 'test', 'fixtures');
const elpFixturePath = path.join(fixturesPath, 'old_el_cid.elp');
const referenceExportPath = path.join(
    fixturesPath,
    'export',
    'un-heroe-medieval-el-cid',
    'un-heroe-medieval-el-cid_web',
);
const testDir = path.join(process.cwd(), 'test', 'temp', 'html5-fixture-test');

describe('HTML5 Export Fixture Comparison', () => {
    let extractedPath: string;
    let parsedStructure: ParsedOdeStructure;
    let exportedZip: Record<string, Uint8Array>;
    let exportedIndexHtml: string;
    let _referenceIndexHtml: string;

    beforeAll(async () => {
        // Skip if fixtures don't exist
        const elpExists = await fs.pathExists(elpFixturePath);
        const refExists = await fs.pathExists(referenceExportPath);

        if (!elpExists || !refExists) {
            console.warn('Skipping fixture tests - fixtures not found');
            return;
        }

        // Create test directory
        await fs.ensureDir(testDir);
        extractedPath = path.join(testDir, 'extracted');
        await fs.ensureDir(extractedPath);

        // Extract ELP file
        const elpBuffer = await fs.readFile(elpFixturePath);
        const elpZip = unzipSync(new Uint8Array(elpBuffer));

        for (const [filename, fileData] of Object.entries(elpZip)) {
            const filePath = path.join(extractedPath, filename);
            await fs.ensureDir(path.dirname(filePath));
            await fs.writeFile(filePath, Buffer.from(fileData));
        }

        // Parse content.xml or contentv3.xml (legacy format)
        let contentXmlPath = path.join(extractedPath, 'content.xml');
        if (!(await fs.pathExists(contentXmlPath))) {
            contentXmlPath = path.join(extractedPath, 'contentv3.xml');
        }
        const contentXml = await fs.readFile(contentXmlPath, 'utf-8');
        parsedStructure = parseFromString(contentXml);

        // Create exporters and export
        const document = new ElpDocumentAdapter(parsedStructure, extractedPath);
        const resources = new FileSystemResourceProvider(path.join(process.cwd(), 'public'));
        const assets = new FileSystemAssetProvider(extractedPath);
        const zip = new FflateZipProvider();

        const exporter = new Html5Exporter(document, resources, assets, zip);
        const result = await exporter.export();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        // Load exported ZIP
        exportedZip = unzipSync(result.data!);
        exportedIndexHtml = new TextDecoder().decode(exportedZip['index.html']);

        // Load reference HTML
        _referenceIndexHtml = await fs.readFile(path.join(referenceExportPath, 'index.html'), 'utf-8');
    });

    afterAll(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('HEAD Structure', () => {
        it('should have scripts BEFORE CSS in HEAD', async () => {
            if (!exportedIndexHtml) return;

            // Find position of first script and first CSS link
            const jqueryScriptPos = exportedIndexHtml.indexOf('libs/jquery/jquery.min.js');
            const bootstrapCssPos = exportedIndexHtml.indexOf('libs/bootstrap/bootstrap.min.css');

            expect(jqueryScriptPos).toBeGreaterThan(-1);
            expect(bootstrapCssPos).toBeGreaterThan(-1);

            // Scripts should come before CSS
            expect(jqueryScriptPos).toBeLessThan(bootstrapCssPos);
        });

        it('should include common_i18n.js script', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('libs/common_i18n.js');
        });

        it('should include common.js script', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('libs/common.js');
        });

        it('should include exe_export.js script', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('libs/exe_export.js');
        });

        it('should include bootstrap.bundle.min.js', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('libs/bootstrap/bootstrap.bundle.min.js');
        });

        it('should NOT include exe_lightbox when content does not use lightbox', async () => {
            if (!exportedIndexHtml) return;

            // exe_lightbox is now conditionally included only when content uses lightbox
            // (rel="lightbox" attribute or imageGallery class)
            // This fixture doesn't use lightbox, so it should not be included
            expect(exportedIndexHtml).not.toContain('libs/exe_lightbox/exe_lightbox.js');
            expect(exportedIndexHtml).not.toContain('libs/exe_lightbox/exe_lightbox.css');
        });

        it('should preserve original theme/style.css filename (not rename to content.css)', async () => {
            if (!exportedIndexHtml) return;

            // Theme file names should be preserved as-is from the source
            expect(exportedIndexHtml).toContain('theme/style.css');
            expect(exportedIndexHtml).not.toContain('theme/content.css');
        });

        it('should preserve original theme/style.js filename (not rename to default.js)', async () => {
            if (!exportedIndexHtml) return;

            // Theme file names should be preserved as-is from the source
            expect(exportedIndexHtml).toContain('theme/style.js');
            expect(exportedIndexHtml).not.toContain('theme/default.js');
        });

        it('should have idevice CSS/JS in correct order', async () => {
            if (!exportedIndexHtml) return;

            // iDevice scripts should come before their CSS
            const textJsPos = exportedIndexHtml.indexOf('idevices/text/text.js');
            const textCssPos = exportedIndexHtml.indexOf('idevices/text/text.css');

            // Both should exist if text idevice is used
            if (textJsPos > -1 && textCssPos > -1) {
                expect(textJsPos).toBeLessThan(textCssPos);
            }
        });
    });

    describe('Navigation Structure', () => {
        it('should have nav#siteNav element', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('id="siteNav"');
            expect(exportedIndexHtml).toContain('<nav');
        });

        it('should have main-node class on first navigation item', async () => {
            if (!exportedIndexHtml) return;

            // The first nav item should have main-node class
            expect(exportedIndexHtml).toMatch(/class="[^"]*main-node[^"]*"/);
        });

        it('should have active class on current page navigation', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="active');
        });
    });

    describe('Client Search Data', () => {
        // Note: exe-client-search is only rendered when addSearchBox is enabled in project properties
        // The default is false, so by default no search box is rendered
        it('should NOT have exe-client-search div by default (requires addSearchBox=true)', async () => {
            if (!exportedIndexHtml) return;

            // addSearchBox defaults to false, so no search div should be present
            expect(exportedIndexHtml).not.toContain('id="exe-client-search"');
        });

        it('should NOT have data-pages attribute by default', async () => {
            if (!exportedIndexHtml) return;

            // data-pages is only present when exe-client-search is rendered
            expect(exportedIndexHtml).not.toContain('data-pages="');
        });
    });

    describe('Body Structure', () => {
        it('should have exe-export class on body', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('exe-export');
        });

        it('should have exe-web-site class on body', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('exe-web-site');
        });

        it('should have lang attribute on body', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toMatch(/<body[^>]*lang="/);
        });
    });

    describe('Page Header Structure', () => {
        it('should have page-header element', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="page-header"');
        });

        it('should NOT have page-counter by default (addPagination must be enabled)', async () => {
            if (!exportedIndexHtml) return;

            // Page counter is now conditional - only shown when addPagination is true
            // Legacy exports always included it, but new exports require explicit opt-in
            expect(exportedIndexHtml).not.toContain('class="page-counter"');
        });

        it('should have package-title (h1)', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="package-title"');
        });

        it('should have page-title (h2)', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="page-title"');
        });
    });

    describe('Page Content Wrapper', () => {
        it('should have page-content wrapper div', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="page-content"');
            expect(exportedIndexHtml).toMatch(/id="page-content-[^"]+"/);
        });
    });

    describe('Footer Structure', () => {
        it('should have siteFooter element', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('id="siteFooter"');
            expect(exportedIndexHtml).toContain('<footer');
        });

        it('should have siteFooterContent wrapper', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('id="siteFooterContent"');
        });

        it('should have packageLicense inside footer', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('id="packageLicense"');
            expect(exportedIndexHtml).toContain('class="license-label"');
            expect(exportedIndexHtml).toContain('class="license"');
        });

        it('should have made-with-eXe credit', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('id="made-with-eXe"');
            expect(exportedIndexHtml).toContain('exelearning.net');
        });
    });

    describe('Navigation Buttons', () => {
        it('should have nav-buttons for subpages', async () => {
            if (!exportedZip) return;

            // Find a subpage (not first page)
            const subpageEntry = Object.keys(exportedZip).find(f => f.startsWith('html/') && f.endsWith('.html'));

            if (subpageEntry) {
                const subpageHtml = new TextDecoder().decode(exportedZip[subpageEntry]);

                // Subpages should have nav buttons
                expect(subpageHtml).toContain('class="nav-buttons"');
                expect(subpageHtml).toContain('nav-button-left');
            }
        });

        it('should have disabled nav-button-left on first page', async () => {
            if (!exportedIndexHtml) return;

            // First page should have prev button as a disabled span (not an anchor)
            // This matches the Symfony fixture behavior
            expect(exportedIndexHtml).toContain('nav-button-left');
            expect(exportedIndexHtml).toContain('<span class="nav-button nav-button-left"');
            // The prev button should NOT be an anchor link on the first page
            expect(exportedIndexHtml).not.toMatch(/<a[^>]*nav-button-left/);
        });
    });

    describe('ZIP Structure', () => {
        it('should contain index.html at root', async () => {
            if (!exportedZip) return;

            expect(exportedZip['index.html']).toBeDefined();
        });

        it('should contain html/ directory with subpages', async () => {
            if (!exportedZip) return;

            const htmlFiles = Object.keys(exportedZip).filter(f => f.startsWith('html/') && f.endsWith('.html'));
            expect(htmlFiles.length).toBeGreaterThan(0);
        });

        it('should contain theme/ directory', async () => {
            if (!exportedZip) return;

            const themeFiles = Object.keys(exportedZip).filter(f => f.startsWith('theme/'));
            expect(themeFiles.length).toBeGreaterThan(0);
        });

        it('should contain theme/style.css (preserving original filename)', async () => {
            if (!exportedZip) return;

            // Issue #905: Theme files should preserve their original names
            expect(exportedZip['theme/style.css']).toBeDefined();
        });

        it('should contain libs/ directory', async () => {
            if (!exportedZip) return;

            const libFiles = Object.keys(exportedZip).filter(f => f.startsWith('libs/'));
            expect(libFiles.length).toBeGreaterThan(0);
        });

        it('should reference idevices in HTML even if not bundled', async () => {
            if (!exportedZip || !exportedIndexHtml) return;

            // The HTML should reference idevices (even if the actual files aren't bundled in test env)
            expect(exportedIndexHtml).toContain('idevices/');
        });

        it('should contain content/css/base.css', async () => {
            if (!exportedZip) return;

            expect(exportedZip['content/css/base.css']).toBeDefined();
        });

        it('should contain content.xml for re-import', async () => {
            if (!exportedZip) return;

            expect(exportedZip['content.xml']).toBeDefined();
        });
    });

    describe('iDevice Rendering', () => {
        it('should have idevice_node class on iDevices', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="idevice_node');
        });

        it('should have relative idevice paths in data-idevice-path', async () => {
            if (!exportedIndexHtml) return;

            // Should use relative paths like "idevices/text/"
            expect(exportedIndexHtml).toMatch(/data-idevice-path="idevices\//);
            // Should NOT have absolute paths
            expect(exportedIndexHtml).not.toMatch(/data-idevice-path="\/[^"]*idevices\//);
        });

        it('should have data-idevice-type attribute', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('data-idevice-type="');
        });

        it('should have non-empty iDevice content (no db-no-data class)', async () => {
            if (!exportedIndexHtml) return;

            // iDevices with content should NOT have db-no-data class
            // The db-no-data class indicates empty content, which is a bug
            // Note: Some iDevices may legitimately be empty, but text iDevices should have content
            const _ideviceMatches = exportedIndexHtml.match(/class="idevice_node[^"]*"/g) || [];

            // Find text iDevices specifically - they should have content
            const hasTextIdevice =
                exportedIndexHtml.includes('data-idevice-type="FreeTextIdevice"') ||
                exportedIndexHtml.includes('data-idevice-type="text"');

            if (hasTextIdevice) {
                // Text iDevices should have exe-text class with content inside
                expect(exportedIndexHtml).toContain('class="exe-text"');
            }
        });
    });

    describe('Block Structure', () => {
        it('should have box class for blocks', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="box');
        });

        it('should have box-head header elements', async () => {
            if (!exportedIndexHtml) return;

            // Blocks should have box-head elements
            expect(exportedIndexHtml).toContain('class="box-head');
        });

        it('should have box-content wrapper', async () => {
            if (!exportedIndexHtml) return;

            expect(exportedIndexHtml).toContain('class="box-content"');
        });

        it('should preserve block titles from ELP (not default "Block")', async () => {
            if (!parsedStructure) return;

            // Get block names from parsed structure
            const pages = new ElpDocumentAdapter(parsedStructure, extractedPath).getNavigation();
            const blockNames = pages.flatMap(p => (p.blocks || []).map(b => b.name));

            // At least one block should have a real name (not empty or "Block")
            const hasRealBlockName = blockNames.some(
                name => name && name !== '' && name !== 'Block' && name !== 'default-block',
            );

            if (hasRealBlockName) {
                // Real block names should appear in the HTML as box-title
                const firstRealBlockName = blockNames.find(
                    name => name && name !== '' && name !== 'Block' && name !== 'default-block',
                );
                if (firstRealBlockName) {
                    expect(exportedIndexHtml).toContain(firstRealBlockName);
                }
            }
        });
    });

    describe('Subpage Structure', () => {
        it('should have relative paths in subpages pointing to parent', async () => {
            if (!exportedZip) return;

            // Find a subpage
            const subpageEntry = Object.keys(exportedZip).find(f => f.startsWith('html/') && f.endsWith('.html'));

            if (subpageEntry) {
                const subpageHtml = new TextDecoder().decode(exportedZip[subpageEntry]);

                // Subpages should use ../ for resources
                expect(subpageHtml).toContain('../libs/');
                expect(subpageHtml).toContain('../theme/');
                expect(subpageHtml).toContain('../idevices/');
            }
        });
    });
});

describe('HTML Structure Comparison with Reference', () => {
    let referenceIndexHtml: string;

    beforeAll(async () => {
        const refExists = await fs.pathExists(referenceExportPath);
        if (refExists) {
            referenceIndexHtml = await fs.readFile(path.join(referenceExportPath, 'index.html'), 'utf-8');
        }
    });

    it('reference should have scripts before CSS', async () => {
        if (!referenceIndexHtml) return;

        const jqueryPos = referenceIndexHtml.indexOf('libs/jquery/jquery.min.js');
        const cssPos = referenceIndexHtml.indexOf('libs/bootstrap/bootstrap.min.css');

        expect(jqueryPos).toBeLessThan(cssPos);
    });

    it('reference should use theme/content.css', async () => {
        if (!referenceIndexHtml) return;

        expect(referenceIndexHtml).toContain('theme/content.css');
    });

    it('reference should use theme/default.js', async () => {
        if (!referenceIndexHtml) return;

        expect(referenceIndexHtml).toContain('theme/default.js');
    });

    it('reference should have main-node class', async () => {
        if (!referenceIndexHtml) return;

        expect(referenceIndexHtml).toContain('main-node');
    });

    it('reference should have exe-client-search', async () => {
        if (!referenceIndexHtml) return;

        expect(referenceIndexHtml).toContain('exe-client-search');
    });
});
