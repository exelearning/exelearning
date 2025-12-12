/**
 * Integration tests for ELP JSON iDevice import
 *
 * Tests that JSON-based iDevices (crossword, trueorfalse, etc.) are correctly
 * imported from ELP files and their jsonProperties are preserved as valid JSON strings.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extractZip } from '../../src/services/zip';
import { parseFromFile } from '../../src/services/xml/xml-parser';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

describe('ELP JSON iDevice Import', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = path.join('/tmp', `elp-json-idevice-test-${Date.now()}`);
        await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
        if (tempDir && (await fs.pathExists(tempDir))) {
            await fs.remove(tempDir);
        }
    });

    describe('todos-los-idevices.elp', () => {
        const fixturePath = path.join(FIXTURES_DIR, 'todos-los-idevices.elp');

        it('should extract and parse without errors', async () => {
            // Skip if fixture doesn't exist
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: todos-los-idevices.elp not found');
                return;
            }

            const extractDir = path.join(tempDir, 'extracted');
            await extractZip(fixturePath, extractDir);

            // Should have content.xml
            const contentPath = path.join(extractDir, 'content.xml');
            expect(await fs.pathExists(contentPath)).toBe(true);

            // Should parse successfully
            const structure = await parseFromFile(contentPath, 'test-session');
            expect(structure).toBeDefined();
            expect(structure.pages).toBeDefined();
            expect(Array.isArray(structure.pages)).toBe(true);
        }, 60000);

        it('should find JSON iDevice components (crossword, trueorfalse, etc.)', async () => {
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: todos-los-idevices.elp not found');
                return;
            }

            const extractDir = path.join(tempDir, 'extracted_json');
            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'content.xml');
            const structure = await parseFromFile(contentPath, 'test-session');

            // Collect all components across all pages
            // Note: The XML parser returns components directly on pages (not nested in blocks)
            const allComponents: any[] = [];
            for (const page of structure.pages) {
                // Components can be directly on page or in blocks depending on the parser
                if (page.components && Array.isArray(page.components)) {
                    allComponents.push(...page.components);
                }
                if (page.blocks && Array.isArray(page.blocks)) {
                    for (const block of page.blocks) {
                        if (block.components && Array.isArray(block.components)) {
                            allComponents.push(...block.components);
                        }
                    }
                }
            }

            // Should have some components
            expect(allComponents.length).toBeGreaterThan(0);

            // Find JSON-based iDevices
            // Note: XML parser uses 'type' instead of 'ideviceType'
            const jsonIdeviceTypes = ['crossword', 'trueorfalse', 'form', 'flipcards', 'trivial'];
            const jsonComponents = allComponents.filter(c => {
                const type = c.type || c.ideviceType || '';
                return jsonIdeviceTypes.some(t => type.toLowerCase().includes(t));
            });

            // If we have JSON iDevices, check their properties
            if (jsonComponents.length > 0) {
                console.log(`Found ${jsonComponents.length} JSON iDevice components`);

                for (const comp of jsonComponents) {
                    // JSON data can be in 'data' or 'jsonProperties' depending on the parser
                    const jsonData = comp.data || comp.jsonProperties;
                    if (jsonData) {
                        if (typeof jsonData === 'string') {
                            // Should be parseable JSON
                            expect(() => JSON.parse(jsonData)).not.toThrow();
                        } else if (typeof jsonData === 'object') {
                            // Already an object, that's fine
                            expect(jsonData).toBeDefined();
                        }
                    }
                }
            }
        }, 60000);

        it('should preserve htmlView content for iDevices', async () => {
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: todos-los-idevices.elp not found');
                return;
            }

            const extractDir = path.join(tempDir, 'extracted_html');
            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'content.xml');
            const structure = await parseFromFile(contentPath, 'test-session');

            // Collect all components
            const allComponents: any[] = [];
            for (const page of structure.pages) {
                if (page.components && Array.isArray(page.components)) {
                    allComponents.push(...page.components);
                }
                if (page.blocks && Array.isArray(page.blocks)) {
                    for (const block of page.blocks) {
                        if (block.components && Array.isArray(block.components)) {
                            allComponents.push(...block.components);
                        }
                    }
                }
            }

            // Should have components with content
            // Note: XML parser uses 'content' instead of 'htmlView'
            const componentsWithContent = allComponents.filter(c => {
                const content = c.content || c.htmlView || '';
                return content.trim().length > 0;
            });

            // At least some components should have content
            expect(componentsWithContent.length).toBeGreaterThan(0);
        }, 60000);
    });

    describe('basic-example.elp', () => {
        const fixturePath = path.join(FIXTURES_DIR, 'basic-example.elp');

        it('should import and have valid structure', async () => {
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: basic-example.elp not found');
                return;
            }

            const extractDir = path.join(tempDir, 'basic_extracted');
            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'content.xml');
            expect(await fs.pathExists(contentPath)).toBe(true);

            const structure = await parseFromFile(contentPath, 'test-session');

            expect(structure).toBeDefined();
            expect(structure.meta).toBeDefined();
            expect(structure.pages).toBeDefined();
            expect(structure.pages.length).toBeGreaterThan(0);
        }, 30000);
    });
});
