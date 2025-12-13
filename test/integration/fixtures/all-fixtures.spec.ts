/**
 * Exhaustive fixture tests for ELP/ELPX files
 * Tests small and medium fixtures for structure, metadata, and format detection
 * Migrated from NestJS to Elysia services
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { unzipSync } from '../../../src/shared/export';
import { extractZip, listZipContents, readFileFromZip, fileExistsInZip } from '../../../src/services/zip';
import { parseFromFile } from '../../../src/services/xml/xml-parser';
import {
    getFixturePath,
    getSmallFixtureNames,
    getMediumFixtureNames,
    FIXTURES,
    createTempTestDir,
    cleanupTempTestDir,
} from '../../helpers/fixture-loader';

/**
 * Check if a ZIP file is valid by trying to parse it
 */
async function isValidZip(zipPath: string): Promise<boolean> {
    try {
        const zipData = await fs.readFile(zipPath);
        unzipSync(new Uint8Array(zipData));
        return true;
    } catch {
        return false;
    }
}

describe('ELP/ELPX Fixtures - Integration Tests', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempTestDir('fixture-test-');
    });

    afterEach(async () => {
        await cleanupTempTestDir(tempDir);
    });

    describe('Small Fixtures (< 1MB)', () => {
        const smallFixtures = getSmallFixtureNames();

        for (const fixtureName of smallFixtures) {
            const fixtureInfo = FIXTURES[fixtureName];

            describe(`Fixture: ${fixtureName}`, () => {
                it('should be a valid ZIP file', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const valid = await isValidZip(fixturePath);
                    expect(valid).toBe(true);
                });

                it('should extract without errors', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, fixtureName.replace(/\./g, '_'));

                    const extractedFiles = await extractZip(fixturePath, extractDir);

                    expect(extractedFiles.length).toBeGreaterThan(0);
                    expect(await fs.pathExists(extractDir)).toBe(true);
                });

                it(`should have ${fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml'}`, async () => {
                    const fixturePath = getFixturePath(fixtureName);

                    const expectedFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const hasFile = await fileExistsInZip(fixturePath, expectedFile);
                    expect(hasFile).toBe(true);
                });

                it('should parse XML structure successfully', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `${fixtureName}_parse`);

                    await extractZip(fixturePath, extractDir);

                    const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const contentPath = path.join(extractDir, contentFile);

                    const structure = await parseFromFile(contentPath, 'test-session');

                    expect(structure).toBeDefined();
                    expect(structure.meta).toBeDefined();
                    expect(structure.pages).toBeDefined();
                    expect(Array.isArray(structure.pages)).toBe(true);
                });

                it('should have valid metadata', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `${fixtureName}_meta`);

                    await extractZip(fixturePath, extractDir);

                    const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const contentPath = path.join(extractDir, contentFile);

                    const structure = await parseFromFile(contentPath, 'test-session');

                    // Meta should exist
                    expect(structure.meta).toBeDefined();

                    // For non-legacy files, check basic meta properties
                    if (!fixtureInfo.isLegacy) {
                        // Title should exist (may be empty string)
                        expect('title' in structure.meta).toBe(true);

                        // Language is optional but if present should be valid ISO code
                        if (structure.meta.language) {
                            expect(structure.meta.language.length).toBeGreaterThanOrEqual(2);
                        }
                    }
                });

                it('should have pages or navigation structure', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `${fixtureName}_pages`);

                    await extractZip(fixturePath, extractDir);

                    const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const contentPath = path.join(extractDir, contentFile);

                    const structure = await parseFromFile(contentPath, 'test-session');

                    // Legacy files might have navigation structure instead of flat pages array
                    const hasPages = structure.pages && structure.pages.length >= 1;
                    const navStructures = (structure.raw as any)?.ode?.odeNavStructures?.odeNavStructure;
                    const hasNavigation =
                        navStructures && (Array.isArray(navStructures) ? navStructures.length > 0 : !!navStructures);

                    // At least one of pages or navigation should exist
                    expect(hasPages || hasNavigation || (structure.raw as any)?.ode).toBeTruthy();
                });
            });
        }
    });

    describe('Medium Fixtures (1-5MB)', () => {
        const mediumFixtures = getMediumFixtureNames();

        for (const fixtureName of mediumFixtures) {
            const fixtureInfo = FIXTURES[fixtureName];

            describe(`Fixture: ${fixtureName}`, () => {
                it('should be a valid ZIP file', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const valid = await isValidZip(fixturePath);
                    expect(valid).toBe(true);
                });

                it('should extract without errors', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, fixtureName.replace(/\./g, '_'));

                    const extractedFiles = await extractZip(fixturePath, extractDir);

                    expect(extractedFiles.length).toBeGreaterThan(0);
                    expect(await fs.pathExists(extractDir)).toBe(true);
                });

                it(`should have ${fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml'}`, async () => {
                    const fixturePath = getFixturePath(fixtureName);

                    const expectedFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const hasFile = await fileExistsInZip(fixturePath, expectedFile);
                    expect(hasFile).toBe(true);
                });

                it('should parse XML structure successfully', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `${fixtureName}_parse`);

                    await extractZip(fixturePath, extractDir);

                    const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const contentPath = path.join(extractDir, contentFile);

                    const structure = await parseFromFile(contentPath, 'test-session');

                    expect(structure).toBeDefined();
                    expect(structure.meta).toBeDefined();
                    expect(structure.pages).toBeDefined();
                    expect(Array.isArray(structure.pages)).toBe(true);
                });

                it('should contain resources/assets', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `${fixtureName}_resources`);

                    await extractZip(fixturePath, extractDir);

                    // Medium fixtures should have some resources
                    const resourcesDir = path.join(extractDir, 'resources');
                    const hasResources = await fs.pathExists(resourcesDir);

                    // Or files might be in root directory
                    const allFiles = await listZipContents(fixturePath);
                    const hasImages = allFiles.some(f => /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f));

                    expect(hasResources || hasImages).toBe(true);
                });

                it('should have multiple pages', async () => {
                    const fixturePath = getFixturePath(fixtureName);
                    const extractDir = path.join(tempDir, `${fixtureName}_pages`);

                    await extractZip(fixturePath, extractDir);

                    const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
                    const contentPath = path.join(extractDir, contentFile);

                    const structure = await parseFromFile(contentPath, 'test-session');

                    // Medium fixtures typically have multiple pages
                    expect(structure.pages.length).toBeGreaterThan(1);
                });
            });
        }
    });

    describe('Format Detection', () => {
        it('should detect modern format (content.xml) correctly', async () => {
            const modernFixtures = Object.entries(FIXTURES)
                .filter(([_, info]) => !info.isLegacy)
                .map(([name]) => name);

            for (const fixtureName of modernFixtures.slice(0, 2)) {
                const fixturePath = getFixturePath(fixtureName);
                const hasContentXml = await fileExistsInZip(fixturePath, 'content.xml');
                const hasContentV3 = await fileExistsInZip(fixturePath, 'contentv3.xml');

                expect(hasContentXml).toBe(true);
                expect(hasContentV3).toBe(false);
            }
        });

        it('should detect legacy format (contentv3.xml) correctly', async () => {
            const legacyFixtures = Object.entries(FIXTURES)
                .filter(([_, info]) => info.isLegacy)
                .map(([name]) => name);

            for (const fixtureName of legacyFixtures.slice(0, 2)) {
                const fixturePath = getFixturePath(fixtureName);
                const hasContentV3 = await fileExistsInZip(fixturePath, 'contentv3.xml');

                expect(hasContentV3).toBe(true);
            }
        });
    });

    describe('Page Hierarchy', () => {
        it('should parse nested page structure correctly', async () => {
            // Use a fixture known to have nested pages
            const fixtureName = 'basic-example.elp';
            const fixturePath = getFixturePath(fixtureName);
            const extractDir = path.join(tempDir, 'hierarchy_test');

            await extractZip(fixturePath, extractDir);

            const fixtureInfo = FIXTURES[fixtureName];
            const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
            const contentPath = path.join(extractDir, contentFile);

            const structure = await parseFromFile(contentPath, 'test-session');

            // Check that pages have proper level assignments
            const rootPages = structure.pages.filter(p => p.level === 0);
            expect(rootPages.length).toBeGreaterThan(0);

            // Check parent_id relationships
            for (const page of structure.pages) {
                if (page.level > 0) {
                    expect(page.parent_id).toBeDefined();
                } else {
                    expect(page.parent_id).toBeNull();
                }
            }
        });
    });

    describe('Component/iDevice Parsing', () => {
        it('should extract components from pages', async () => {
            const fixtureName = 'basic-example.elp';
            const fixturePath = getFixturePath(fixtureName);
            const extractDir = path.join(tempDir, 'component_test');

            await extractZip(fixturePath, extractDir);

            const fixtureInfo = FIXTURES[fixtureName];
            const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
            const contentPath = path.join(extractDir, contentFile);

            const structure = await parseFromFile(contentPath, 'test-session');

            // At least some pages should have components
            const pagesWithComponents = structure.pages.filter(p => p.components && p.components.length > 0);

            // Check that components have required fields
            for (const page of pagesWithComponents) {
                for (const component of page.components) {
                    expect(component).toHaveProperty('id');
                    expect(component).toHaveProperty('type');
                }
            }
        });
    });

    describe('Resource Path Handling', () => {
        it('should list all resources in ZIP', async () => {
            const fixtureName = 'encoding_test.elp';
            const fixturePath = getFixturePath(fixtureName);

            const contents = await listZipContents(fixturePath);

            expect(contents.length).toBeGreaterThan(0);

            // Should contain content.xml or contentv3.xml
            const hasContent = contents.some(f => f === 'content.xml' || f === 'contentv3.xml');
            expect(hasContent).toBe(true);
        });

        it('should extract single file from ZIP', async () => {
            const fixtureName = 'basic-example.elp';
            const fixturePath = getFixturePath(fixtureName);
            const fixtureInfo = FIXTURES[fixtureName];

            const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
            const buffer = await readFileFromZip(fixturePath, contentFile);

            expect(buffer).not.toBeNull();
            expect(buffer!.length).toBeGreaterThan(0);

            // Should be valid XML
            const content = buffer!.toString('utf-8');
            expect(content.includes('<?xml')).toBe(true);
        });
    });

    describe('Encoding Tests', () => {
        it('should handle UTF-8 content correctly', async () => {
            const fixtureName = 'encoding_test.elp';
            const fixturePath = getFixturePath(fixtureName);
            const extractDir = path.join(tempDir, 'encoding_test');

            await extractZip(fixturePath, extractDir);

            const fixtureInfo = FIXTURES[fixtureName];
            const contentFile = fixtureInfo.isLegacy ? 'contentv3.xml' : 'content.xml';
            const contentPath = path.join(extractDir, contentFile);

            const structure = await parseFromFile(contentPath, 'test-session');

            // Should parse without throwing
            expect(structure).toBeDefined();
            expect(structure.meta).toBeDefined();
        });
    });
});
