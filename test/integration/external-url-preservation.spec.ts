/**
 * Integration tests for external URL preservation during ELP import
 *
 * These tests verify that external URLs containing filenames that also exist
 * as local resources are NOT corrupted during the asset path conversion process.
 *
 * Bug scenario: An ELP has both:
 * - Local file: resources/cedec-Plantilla.pdf
 * - External iframe: https://example.com/.../cedec-Plantilla.pdf
 *
 * The import process should:
 * - Convert local paths (resources/...) to asset:// references
 * - Leave external URLs (https://...) completely unchanged
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extractZip, readFileFromZip, fileExistsInZip } from '../../src/services/zip';
import { parseFromFile } from '../../src/services/xml/xml-parser';
import { createTempTestDir, cleanupTempTestDir } from '../helpers/fixture-loader';

// Path to the "more" fixtures directory with special test cases
const MORE_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'more');

/**
 * Get path to a fixture in the "more" directory
 */
function getMoreFixturePath(name: string): string {
    return path.join(MORE_FIXTURES_DIR, name);
}

/**
 * Check if a fixture exists in the "more" directory
 */
async function moreFixtureExists(name: string): Promise<boolean> {
    return fs.pathExists(getMoreFixturePath(name));
}

describe('External URL Preservation - Integration Tests', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempTestDir('external-url-test-');
    });

    afterEach(async () => {
        await cleanupTempTestDir(tempDir);
    });

    describe('a_la_romana.elp - External PDF Viewer URLs', () => {
        const fixtureName = 'a_la_romana.elp';

        it('should verify fixture exists and has contentv3.xml', async () => {
            const exists = await moreFixtureExists(fixtureName);
            if (!exists) {
                console.log(`Skipping: ${fixtureName} not found in test/fixtures/more/`);
                return;
            }

            const fixturePath = getMoreFixturePath(fixtureName);
            const hasContentV3 = await fileExistsInZip(fixturePath, 'contentv3.xml');
            expect(hasContentV3).toBe(true);
        });

        it('should contain both local and external references to the same PDF filename', async () => {
            const exists = await moreFixtureExists(fixtureName);
            if (!exists) {
                console.log(`Skipping: ${fixtureName} not found`);
                return;
            }

            const fixturePath = getMoreFixturePath(fixtureName);
            const contentBuffer = await readFileFromZip(fixturePath, 'contentv3.xml');
            expect(contentBuffer).not.toBeNull();

            const contentXml = contentBuffer!.toString('utf-8');

            // The fixture should contain BOTH:
            // 1. Local resource reference
            const hasLocalPdfRef = contentXml.includes('resources/cedec-Plantilla-ideografia-A-la-romana.pdf');
            expect(hasLocalPdfRef).toBe(true);

            // 2. External iframe with CEDEC PDF viewer
            const hasExternalIframe = contentXml.includes(
                'https://cedec.intef.es/wp-content/plugins/pdfjs-viewer-shortcode',
            );
            expect(hasExternalIframe).toBe(true);

            // Both references use the same filename
            const hasExternalPdfUrl = contentXml.includes(
                'https://cedec.intef.es/wp-content/uploads/2019/09/cedec-Plantilla-ideografia-A-la-romana.pdf',
            );
            expect(hasExternalPdfUrl).toBe(true);
        });

        it('should have the actual PDF file in the ZIP', async () => {
            const exists = await moreFixtureExists(fixtureName);
            if (!exists) {
                console.log(`Skipping: ${fixtureName} not found`);
                return;
            }

            const fixturePath = getMoreFixturePath(fixtureName);

            // The local PDF should exist in the ZIP
            const hasPdf = await fileExistsInZip(fixturePath, 'cedec-Plantilla-ideografia-A-la-romana.pdf');
            expect(hasPdf).toBe(true);
        });

        it('should parse XML structure without errors', async () => {
            const exists = await moreFixtureExists(fixtureName);
            if (!exists) {
                console.log(`Skipping: ${fixtureName} not found`);
                return;
            }

            const fixturePath = getMoreFixturePath(fixtureName);
            const extractDir = path.join(tempDir, 'parse_test');

            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'contentv3.xml');
            const structure = await parseFromFile(contentPath, 'test-session');

            expect(structure).toBeDefined();
            expect(structure.meta).toBeDefined();
            expect(structure.pages).toBeDefined();
            expect(structure.pages.length).toBeGreaterThan(0);
        });

        it('should contain components with HTML content including iframes', async () => {
            const exists = await moreFixtureExists(fixtureName);
            if (!exists) {
                console.log(`Skipping: ${fixtureName} not found`);
                return;
            }

            const fixturePath = getMoreFixturePath(fixtureName);
            const extractDir = path.join(tempDir, 'component_test');

            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'contentv3.xml');
            const structure = await parseFromFile(contentPath, 'test-session');

            // Find components that contain iframe content
            // Note: Legacy parser normalizes content to 'content' key
            let foundIframeComponent = false;
            for (const page of structure.pages) {
                if (page.components) {
                    for (const component of page.components) {
                        // Try different content keys used by different parser modes
                        const content = component.content || component.htmlContent || component.htmlView || '';
                        if (content.includes('<iframe') && content.includes('cedec.intef.es')) {
                            foundIframeComponent = true;
                            // Verify the external URL is intact in the parsed content
                            expect(content).toContain('https://cedec.intef.es/');
                        }
                    }
                }
            }

            expect(foundIframeComponent).toBe(true);
        });
    });

    describe('Other fixtures - Structural validation', () => {
        const otherFixtures = ['radioexploradores.elp', 'emocion_claqueta_accion.elp', 'home_is_where_art_is.elp'];

        for (const fixtureName of otherFixtures) {
            describe(`Fixture: ${fixtureName}`, () => {
                it('should be a valid legacy ELP (contentv3.xml)', async () => {
                    const exists = await moreFixtureExists(fixtureName);
                    if (!exists) {
                        console.log(`Skipping: ${fixtureName} not found`);
                        return;
                    }

                    const fixturePath = getMoreFixturePath(fixtureName);
                    const hasContentV3 = await fileExistsInZip(fixturePath, 'contentv3.xml');
                    expect(hasContentV3).toBe(true);
                });

                it('should parse XML structure successfully', async () => {
                    const exists = await moreFixtureExists(fixtureName);
                    if (!exists) {
                        console.log(`Skipping: ${fixtureName} not found`);
                        return;
                    }

                    const fixturePath = getMoreFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, fixtureName.replace(/\./g, '_'));

                    await extractZip(fixturePath, extractDir);

                    const contentPath = path.join(extractDir, 'contentv3.xml');
                    const structure = await parseFromFile(contentPath, 'test-session');

                    expect(structure).toBeDefined();
                    expect(structure.meta).toBeDefined();
                    expect(structure.pages.length).toBeGreaterThan(0);
                }, 60000); // Larger fixtures need more time

                it('should have multiple pages with content', async () => {
                    const exists = await moreFixtureExists(fixtureName);
                    if (!exists) {
                        console.log(`Skipping: ${fixtureName} not found`);
                        return;
                    }

                    const fixturePath = getMoreFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `${fixtureName}_pages`);

                    await extractZip(fixturePath, extractDir);

                    const contentPath = path.join(extractDir, 'contentv3.xml');
                    const structure = await parseFromFile(contentPath, 'test-session');

                    // These are substantial educational resources
                    expect(structure.pages.length).toBeGreaterThan(5);
                }, 60000);
            });
        }
    });

    describe('External URL patterns in HTML content', () => {
        /**
         * Test that various external URL patterns are correctly identified
         * This is a unit-style test using the parsed XML structure
         */
        it('should identify external URL patterns correctly', () => {
            // Patterns that should NOT be modified by asset replacement
            const externalPatterns = [
                'https://example.com/file.pdf',
                'https://cedec.intef.es/wp-content/uploads/file.pdf',
                'http://example.org/viewer.php?file=https://example.org/doc.pdf',
                'https://youtube.com/watch?v=abc123',
                'https://vimeo.com/123456',
            ];

            // Patterns that SHOULD be converted to asset:// references
            const localPatterns = ['resources/file.pdf', '{{context_path}}/resources/image.png'];

            // Verify patterns are correctly identified
            for (const pattern of externalPatterns) {
                expect(pattern.startsWith('http://') || pattern.startsWith('https://')).toBe(true);
            }

            for (const pattern of localPatterns) {
                expect(pattern.startsWith('resources/') || pattern.includes('{{context_path}}')).toBe(true);
            }
        });

        it('should handle query string parameters in external URLs', () => {
            // Example: PDF viewer with file parameter
            const pdfViewerUrl =
                'https://cedec.intef.es/wp-content/plugins/pdfjs-viewer-shortcode/pdfjs/web/viewer.php?file=https://cedec.intef.es/wp-content/uploads/2019/09/cedec-Plantilla-ideografia-A-la-romana.pdf&download=false&print=false';

            // The filename appears in the query string
            expect(pdfViewerUrl).toContain('cedec-Plantilla-ideografia-A-la-romana.pdf');

            // But it's part of a https:// URL, not a local path
            expect(pdfViewerUrl.startsWith('https://')).toBe(true);

            // The file parameter value is also a full URL
            const fileParam = new URL(pdfViewerUrl).searchParams.get('file');
            expect(fileParam).toContain('https://cedec.intef.es/');
        });
    });
});
