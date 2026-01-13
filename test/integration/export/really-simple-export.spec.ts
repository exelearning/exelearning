/**
 * Export tests for really-simple-test-project
 *
 * Tests that all export formats generate the expected output structure and content.
 * Uses fixtures in test/fixtures/export/really-simple/ as reference.
 *
 * Project structure:
 * - 6 pages in hierarchy: Page 1 > Page 1-1 > Page 1-1-1, Page 1-2, Page 2 > Page 2-1
 * - Each page has a text iDevice with Lorem ipsum and a distinctive bold word
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs-extra';

// Fixture directory
const FIXTURE_DIR = path.join(__dirname, '../../fixtures/export/really-simple');

// All bold words across all pages (for single-page validation)
const ALL_BOLD_WORDS = [
    'dolor',
    'exercitation',
    'laborum',
    'laboris',
    'tempor incididunt',
    'voluptate',
    'cillum',
    'non proident',
];

// Helper to read file from fixture
async function readFixtureFile(format: string, filePath: string): Promise<string> {
    const fullPath = path.join(FIXTURE_DIR, `really-simple-test-project_${format}`, filePath);
    return fs.readFile(fullPath, 'utf-8');
}

// Helper to check if file exists in fixture
async function fixtureFileExists(format: string, filePath: string): Promise<boolean> {
    const fullPath = path.join(FIXTURE_DIR, `really-simple-test-project_${format}`, filePath);
    return fs.pathExists(fullPath);
}

// Helper to get fixture directory path
function getFixtureDir(format: string): string {
    return path.join(FIXTURE_DIR, `really-simple-test-project_${format}`);
}

describe('Really Simple Export Tests', () => {
    beforeAll(async () => {
        // Verify fixtures exist
        const fixtureExists = await fs.pathExists(FIXTURE_DIR);
        if (!fixtureExists) {
            throw new Error(`Fixture directory not found: ${FIXTURE_DIR}`);
        }
    });

    describe('HTML5 Website Export (_web)', () => {
        const FORMAT = 'web';

        it('should have index.html with project title', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).toContain('Really Simple Test Project');
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('id="exe-index"');
        });

        it('should have all 5 sub-page HTML files', async () => {
            const subPages = ['page-1-1.html', 'page-1-1-1.html', 'page-1-2.html', 'page-2.html', 'page-2-1.html'];

            for (const page of subPages) {
                const exists = await fixtureFileExists(FORMAT, `html/${page}`);
                expect(exists).toBe(true);
            }
        });

        it('should have correct navigation structure', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');

            // Check nav element exists
            expect(html).toContain('<nav id="siteNav">');

            // Check navigation links
            expect(html).toContain('href="index.html"');
            expect(html).toContain('href="html/page-1-1.html"');
            expect(html).toContain('href="html/page-1-1-1.html"');
            expect(html).toContain('href="html/page-1-2.html"');
            expect(html).toContain('href="html/page-2.html"');
            expect(html).toContain('href="html/page-2-1.html"');

            // Check navigation classes
            expect(html).toContain('class="daddy"'); // Pages with children
            expect(html).toContain('class="no-ch"'); // Pages without children
        });

        it('should have page counter showing 1/6', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).toContain('page-counter-current-page');
            expect(html).toContain('>1<');
            expect(html).toContain('page-counter-total');
            expect(html).toContain('>6<');
        });

        it('should have distinctive bold words in each page', async () => {
            // Check index page
            const indexHtml = await readFixtureFile(FORMAT, 'index.html');
            expect(indexHtml).toContain('<strong>dolor</strong>');
            expect(indexHtml).toContain('<strong>exercitation</strong>');
            expect(indexHtml).toContain('<strong>laborum</strong>');

            // Check page 1-1
            const page11Html = await readFixtureFile(FORMAT, 'html/page-1-1.html');
            expect(page11Html).toContain('<strong>laboris</strong>');

            // Check page 1-1-1
            const page111Html = await readFixtureFile(FORMAT, 'html/page-1-1-1.html');
            expect(page111Html).toContain('<strong>tempor incididunt</strong>');

            // Check page 1-2
            const page12Html = await readFixtureFile(FORMAT, 'html/page-1-2.html');
            expect(page12Html).toContain('<strong>voluptate</strong>');

            // Check page 2
            const page2Html = await readFixtureFile(FORMAT, 'html/page-2.html');
            expect(page2Html).toContain('<strong>cillum</strong>');

            // Check page 2-1
            const page21Html = await readFixtureFile(FORMAT, 'html/page-2-1.html');
            expect(page21Html).toContain('<strong>non proident,</strong>');
        });

        it('should have content.xml at root', async () => {
            const exists = await fixtureFileExists(FORMAT, 'content.xml');
            expect(exists).toBe(true);

            const xml = await readFixtureFile(FORMAT, 'content.xml');
            expect(xml).toContain('<?xml');
            expect(xml).toContain('<ode');
        });

        it('should have theme files', async () => {
            expect(await fixtureFileExists(FORMAT, 'theme/style.css')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'theme/style.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'theme/config.xml')).toBe(true);
        });

        it('should have idevice files for text', async () => {
            expect(await fixtureFileExists(FORMAT, 'idevices/text/text.css')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'idevices/text/text.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'idevices/text/text.html')).toBe(true);
        });

        it('should have required library files', async () => {
            expect(await fixtureFileExists(FORMAT, 'libs/jquery/jquery.min.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/bootstrap/bootstrap.min.css')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/bootstrap/bootstrap.bundle.min.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/exe_atools/exe_atools.css')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/exe_atools/exe_atools.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/common.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/exe_export.js')).toBe(true);
        });

        it('should have prev/next navigation buttons', async () => {
            // Index page should have only next button
            const indexHtml = await readFixtureFile(FORMAT, 'index.html');
            expect(indexHtml).toContain('nav-button-right');
            expect(indexHtml).toContain('href="html/page-1-1.html"');

            // Middle page should have both
            const page11Html = await readFixtureFile(FORMAT, 'html/page-1-1.html');
            expect(page11Html).toContain('nav-button-left');
            expect(page11Html).toContain('nav-button-right');

            // Last page should have only prev button
            const page21Html = await readFixtureFile(FORMAT, 'html/page-2-1.html');
            expect(page21Html).toContain('nav-button-left');
        });

        it('should have correct body class for web export', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).toContain('exe-web-site');
        });

        it('should have license footer', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).toContain('creative commons: attribution - share alike 4.0');
            expect(html).toContain('packageLicense');
        });
    });

    describe('HTML5 Single Page Export (_page)', () => {
        const FORMAT = 'page';

        it('should have only index.html (no html subfolder with pages)', async () => {
            const exists = await fixtureFileExists(FORMAT, 'index.html');
            expect(exists).toBe(true);

            // html folder should be empty or not have page files
            const htmlFolderExists = await fixtureFileExists(FORMAT, 'html');
            if (htmlFolderExists) {
                const files = await fs.readdir(path.join(getFixtureDir(FORMAT), 'html'));
                expect(files.length).toBe(0);
            }
        });

        it('should have correct body class for single page export', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).toContain('exe-single-page');
        });

        it('should contain all 6 page sections', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');

            // Check all page titles are present
            expect(html).toContain('Page 1</h1>');
            expect(html).toContain('Page 1 - 1</h1>');
            expect(html).toContain('Page 1 - 1 -1</h1>');
            expect(html).toContain('Page 1 - 2</h1>');
            expect(html).toContain('Page 2</h1>');
            expect(html).toContain('Page 2 - 1</h1>');
        });

        it('should have all distinctive bold words in single file', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');

            for (const word of ALL_BOLD_WORDS) {
                expect(html).toContain(`<strong>${word}`);
            }
        });

        it('should NOT have navigation sidebar', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).not.toContain('<nav id="siteNav">');
        });

        it('should NOT have prev/next buttons', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).not.toContain('nav-button-left');
            expect(html).not.toContain('nav-button-right');
        });

        it('should have page sections as <section> elements', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            // Count section elements (should be 6 for 6 pages)
            const sectionCount = (html.match(/<section>/g) || []).length;
            expect(sectionCount).toBeGreaterThanOrEqual(5); // At least 5 sections for child pages
        });

        it('should have same library structure as web export', async () => {
            expect(await fixtureFileExists(FORMAT, 'libs/jquery/jquery.min.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/bootstrap/bootstrap.min.css')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/exe_export.js')).toBe(true);
        });
    });

    describe('SCORM 1.2 Export (_scorm)', () => {
        const FORMAT = 'scorm';

        it('should have valid imsmanifest.xml', async () => {
            const exists = await fixtureFileExists(FORMAT, 'imsmanifest.xml');
            expect(exists).toBe(true);

            const xml = await readFixtureFile(FORMAT, 'imsmanifest.xml');
            expect(xml).toContain('<?xml');
            expect(xml).toContain('<manifest');
        });

        it('should have ADL SCORM 1.2 schema in manifest', async () => {
            const xml = await readFixtureFile(FORMAT, 'imsmanifest.xml');
            expect(xml).toContain('<schema>ADL SCORM</schema>');
            expect(xml).toContain('<schemaversion>1.2</schemaversion>');
        });

        it('should have hierarchical organization with all pages', async () => {
            const xml = await readFixtureFile(FORMAT, 'imsmanifest.xml');

            // Check organization exists
            expect(xml).toContain('<organizations');
            expect(xml).toContain('<organization');
            expect(xml).toContain('structure="hierarchical"');

            // Check all page items
            expect(xml).toContain('<title>Page 1</title>');
            expect(xml).toContain('<title>Page 1 - 1</title>');
            expect(xml).toContain('<title>Page 1 - 1 -1</title>');
            expect(xml).toContain('<title>Page 1 - 2</title>');
            expect(xml).toContain('<title>Page 2</title>');
            expect(xml).toContain('<title>Page 2 - 1</title>');
        });

        it('should have resources with scormtype="sco"', async () => {
            const xml = await readFixtureFile(FORMAT, 'imsmanifest.xml');
            expect(xml).toContain('adlcp:scormtype="sco"');
        });

        it('should have COMMON_FILES resource with dependencies', async () => {
            const xml = await readFixtureFile(FORMAT, 'imsmanifest.xml');
            expect(xml).toContain('identifier="COMMON_FILES"');
            expect(xml).toContain('<dependency identifierref="COMMON_FILES"/>');
        });

        it('should have imslrm.xml (LOM metadata)', async () => {
            const exists = await fixtureFileExists(FORMAT, 'imslrm.xml');
            expect(exists).toBe(true);
        });

        it('should have SCORM API wrapper library', async () => {
            expect(await fixtureFileExists(FORMAT, 'libs/SCORM_API_wrapper.js')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs/SCOFunctions.js')).toBe(true);
        });

        it('should have all HTML pages', async () => {
            expect(await fixtureFileExists(FORMAT, 'index.html')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'html/page-1-1.html')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'html/page-1-1-1.html')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'html/page-1-2.html')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'html/page-2.html')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'html/page-2-1.html')).toBe(true);
        });
    });

    describe('IMS Content Package Export (_ims)', () => {
        const FORMAT = 'ims';

        it('should have imsmanifest.xml', async () => {
            const exists = await fixtureFileExists(FORMAT, 'imsmanifest.xml');
            expect(exists).toBe(true);
        });

        // Note: IMS packages may or may not include imslrm.xml depending on export options
        // The current fixture doesn't include it

        it('should NOT have SCORM API wrapper (IMS is not SCORM)', async () => {
            const scormApiExists = await fixtureFileExists(FORMAT, 'libs/SCORM_API_wrapper.js');
            const scoFunctionsExists = await fixtureFileExists(FORMAT, 'libs/SCOFunctions.js');

            // IMS packages should not have SCORM-specific files
            expect(scormApiExists).toBe(false);
            expect(scoFunctionsExists).toBe(false);
        });

        it('should have organization with hierarchical structure', async () => {
            const xml = await readFixtureFile(FORMAT, 'imsmanifest.xml');

            expect(xml).toContain('<organizations');
            expect(xml).toContain('<organization');
            expect(xml).toContain('<title>Really Simple Test Project</title>');
        });

        it('should have all HTML pages', async () => {
            expect(await fixtureFileExists(FORMAT, 'index.html')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'html/page-1-1.html')).toBe(true);
        });
    });

    describe('EPUB3 Export (_epub)', () => {
        const FORMAT = 'epub';

        it('should have mimetype file with correct content', async () => {
            const exists = await fixtureFileExists(FORMAT, 'mimetype');
            expect(exists).toBe(true);

            const content = await readFixtureFile(FORMAT, 'mimetype');
            expect(content.trim()).toBe('application/epub+zip');
        });

        it('should have META-INF/container.xml', async () => {
            const exists = await fixtureFileExists(FORMAT, 'META-INF/container.xml');
            expect(exists).toBe(true);

            const xml = await readFixtureFile(FORMAT, 'META-INF/container.xml');
            expect(xml).toContain('EPUB/package.opf');
        });

        it('should have EPUB/package.opf manifest', async () => {
            const exists = await fixtureFileExists(FORMAT, 'EPUB/package.opf');
            expect(exists).toBe(true);

            const xml = await readFixtureFile(FORMAT, 'EPUB/package.opf');
            expect(xml).toContain('<package');
            expect(xml).toContain('<manifest>');
            expect(xml).toContain('<spine>');
        });

        it('should have EPUB/nav.xhtml navigation document', async () => {
            const exists = await fixtureFileExists(FORMAT, 'EPUB/nav.xhtml');
            expect(exists).toBe(true);

            const html = await readFixtureFile(FORMAT, 'EPUB/nav.xhtml');
            expect(html).toContain('<nav');
        });

        it('should have XHTML files (not HTML)', async () => {
            expect(await fixtureFileExists(FORMAT, 'EPUB/index.xhtml')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'EPUB/html/page-1-1.xhtml')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'EPUB/html/page-1-1-1.xhtml')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'EPUB/html/page-1-2.xhtml')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'EPUB/html/page-2.xhtml')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'EPUB/html/page-2-1.xhtml')).toBe(true);
        });

        it('should have EPUB content structure', async () => {
            expect(await fixtureFileExists(FORMAT, 'EPUB/content.xml')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'EPUB/theme/style.css')).toBe(true);
        });
    });

    describe('ELPX Export (_elpx)', () => {
        const FORMAT = 'elpx';

        it('should have content.xml at root', async () => {
            const exists = await fixtureFileExists(FORMAT, 'content.xml');
            expect(exists).toBe(true);

            const xml = await readFixtureFile(FORMAT, 'content.xml');
            expect(xml).toContain('<?xml');
            expect(xml).toContain('<ode');
        });

        it('should have same HTML structure as web export', async () => {
            expect(await fixtureFileExists(FORMAT, 'index.html')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'html/page-1-1.html')).toBe(true);
        });

        it('should have all required directories', async () => {
            expect(await fixtureFileExists(FORMAT, 'theme')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'idevices')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'libs')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'content')).toBe(true);
        });
    });

    describe('Theme: Fluxus (_web_fluxus)', () => {
        const FORMAT = 'web_fluxus';

        it('should have Fluxus theme fonts', async () => {
            expect(await fixtureFileExists(FORMAT, 'theme/fonts/Fredoka-Bold.woff')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'theme/fonts/Fredoka-Regular.woff')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'theme/fonts/Fredoka-SemiBold.woff')).toBe(true);
        });

        it('should have Fluxus theme icons (SVG)', async () => {
            const iconsDir = path.join(getFixtureDir(FORMAT), 'theme/icons');
            const icons = await fs.readdir(iconsDir);

            // Fluxus has SVG icons instead of PNG
            const svgIcons = icons.filter(f => f.endsWith('.svg'));
            expect(svgIcons.length).toBeGreaterThan(30);
        });

        it('should have Fluxus-specific images', async () => {
            expect(await fixtureFileExists(FORMAT, 'theme/img/logo.png')).toBe(true);
            expect(await fixtureFileExists(FORMAT, 'theme/img/background.png')).toBe(true);
        });

        it('should have different style.css than base theme', async () => {
            const fluxusCss = await readFixtureFile(FORMAT, 'theme/style.css');
            const baseCss = await readFixtureFile('web', 'theme/style.css');

            // They should be different
            expect(fluxusCss).not.toBe(baseCss);
            expect(fluxusCss.length).toBeGreaterThan(baseCss.length);
        });

        it('should have all pages with correct content', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).toContain('Really Simple Test Project');
            expect(html).toContain('<strong>dolor</strong>');
        });
    });

    describe('Theme: Fluxus Single Page (_page_fluxus)', () => {
        const FORMAT = 'page_fluxus';

        it('should have Fluxus theme fonts', async () => {
            expect(await fixtureFileExists(FORMAT, 'theme/fonts/Fredoka-Bold.woff')).toBe(true);
        });

        it('should be single page with all content', async () => {
            const html = await readFixtureFile(FORMAT, 'index.html');
            expect(html).toContain('exe-single-page');

            // All pages should be in one file
            for (const word of ALL_BOLD_WORDS) {
                expect(html).toContain(`<strong>${word}`);
            }
        });
    });

    // TODO: Search data tests - commented out until fixtures are regenerated
    // describe('Search Data', () => {
    //     it('should have search_index.js file', async () => {
    //         const exists = await fixtureFileExists('web', 'search_index.js');
    //         expect(exists).toBe(true);
    //     });
    //
    //     it('should contain window.exeSearchData', async () => {
    //         const js = await readFixtureFile('web', 'search_index.js');
    //         expect(js).toContain('window.exeSearchData');
    //     });
    // });
});

/**
 * Preview Tests
 *
 * Tests that preview generation works correctly with the really-simple fixture.
 * Preview is a SPA (Single Page Application) that renders all pages in one HTML document.
 */
import {
    ElpDocumentAdapter,
    FileSystemResourceProvider,
    WebsitePreviewExporter,
    unzipSync as fflateUnzipSync,
} from '../../../src/shared/export';
import { parseFromString } from '../../../src/services/xml/xml-parser';

describe('Really Simple Preview Tests', () => {
    const publicDir = path.join(__dirname, '../../../public');
    const fixtureElpx = path.join(__dirname, '../../fixtures/really-simple-test-project.elpx');

    // Helper to extract and parse the ELPX fixture
    async function loadFixtureStructure(): Promise<any> {
        const elpxBuffer = await fs.readFile(fixtureElpx);
        const unzipped = fflateUnzipSync(new Uint8Array(elpxBuffer));

        // Find content.xml
        let contentXml: string | null = null;
        for (const [filename, content] of Object.entries(unzipped)) {
            if (filename === 'content.xml' || filename.endsWith('/content.xml')) {
                contentXml = new TextDecoder().decode(content as Uint8Array);
                break;
            }
        }

        if (!contentXml) {
            throw new Error('content.xml not found in ELPX');
        }

        return parseFromString(contentXml);
    }

    it('should generate preview HTML from ELPX fixture', async () => {
        const structure = await loadFixtureStructure();
        const tempDir = path.join(__dirname, '../../temp/preview-test-' + Date.now());
        await fs.ensureDir(tempDir);

        try {
            const document = new ElpDocumentAdapter(structure, tempDir);
            const resources = new FileSystemResourceProvider(publicDir);
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toBeDefined();
            expect(typeof result.html).toBe('string');
        } finally {
            await fs.remove(tempDir);
        }
    });

    it('should include project title in preview', async () => {
        const structure = await loadFixtureStructure();
        const tempDir = path.join(__dirname, '../../temp/preview-test-' + Date.now());
        await fs.ensureDir(tempDir);

        try {
            const document = new ElpDocumentAdapter(structure, tempDir);
            const resources = new FileSystemResourceProvider(publicDir);
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('Really Simple Test Project');
        } finally {
            await fs.remove(tempDir);
        }
    });

    it('should include all 6 page titles in preview (SPA)', async () => {
        const structure = await loadFixtureStructure();
        const tempDir = path.join(__dirname, '../../temp/preview-test-' + Date.now());
        await fs.ensureDir(tempDir);

        try {
            const document = new ElpDocumentAdapter(structure, tempDir);
            const resources = new FileSystemResourceProvider(publicDir);
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            // All page titles should be present
            expect(result.html).toContain('Page 1');
            expect(result.html).toContain('Page 1 - 1');
            expect(result.html).toContain('Page 1 - 1 -1');
            expect(result.html).toContain('Page 1 - 2');
            expect(result.html).toContain('Page 2');
            expect(result.html).toContain('Page 2 - 1');
        } finally {
            await fs.remove(tempDir);
        }
    });

    // Use ElpDocumentAdapter.fromElpFile() to properly load iDevice HTML content
    it('should include all distinctive bold words in preview', async () => {
        // Use fromElpFile which properly extracts and parses the ELP with all content
        const document = await ElpDocumentAdapter.fromElpFile(fixtureElpx);
        const resources = new FileSystemResourceProvider(publicDir);
        const exporter = new WebsitePreviewExporter(document, resources);

        try {
            const result = await exporter.generatePreview();

            // All distinctive bold words should be present
            for (const word of ALL_BOLD_WORDS) {
                expect(result.html).toContain(`<strong>${word}`);
            }
        } finally {
            // Clean up the temp extraction directory created by fromElpFile
            const extractDir = document.extractedPath;
            if (extractDir?.includes('/tmp/')) {
                await fs.remove(extractDir);
            }
        }
    });

    it('should have proper HTML structure in preview', async () => {
        const structure = await loadFixtureStructure();
        const tempDir = path.join(__dirname, '../../temp/preview-test-' + Date.now());
        await fs.ensureDir(tempDir);

        try {
            const document = new ElpDocumentAdapter(structure, tempDir);
            const resources = new FileSystemResourceProvider(publicDir);
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            expect(result.html).toContain('<!DOCTYPE html>');
            expect(result.html).toContain('<html');
            expect(result.html).toContain('</html>');
            expect(result.html).toContain('<head>');
            expect(result.html).toContain('<body');
        } finally {
            await fs.remove(tempDir);
        }
    });

    it('should include article elements for each page in preview', async () => {
        const structure = await loadFixtureStructure();
        const tempDir = path.join(__dirname, '../../temp/preview-test-' + Date.now());
        await fs.ensureDir(tempDir);

        try {
            const document = new ElpDocumentAdapter(structure, tempDir);
            const resources = new FileSystemResourceProvider(publicDir);
            const exporter = new WebsitePreviewExporter(document, resources);

            const result = await exporter.generatePreview();

            // Preview should have article elements for navigation
            const articleCount = (result.html.match(/<article/g) || []).length;
            expect(articleCount).toBeGreaterThanOrEqual(6); // At least 6 articles for 6 iDevices
        } finally {
            await fs.remove(tempDir);
        }
    });
});
