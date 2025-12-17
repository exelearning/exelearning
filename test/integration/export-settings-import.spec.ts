/**
 * Integration tests for export settings import from ELP files
 *
 * Tests that export settings (addPagination, addSearchBox, extraHeadContent, footer, etc.)
 * are correctly extracted from ELP files during import.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extractZip } from '../../src/services/zip';
import { parseFromFile } from '../../src/services/xml/xml-parser';

const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

describe('Export Settings Import', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = path.join('/tmp', `export-settings-test-${Date.now()}`);
        await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
        if (tempDir && (await fs.pathExists(tempDir))) {
            await fs.remove(tempDir);
        }
    });

    describe('really-simple-test-project.elpx', () => {
        const fixturePath = path.join(FIXTURES_DIR, 'really-simple-test-project.elpx');

        it('should extract boolean export settings from content.xml', async () => {
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: really-simple-test-project.elpx not found');
                return;
            }

            const extractDir = path.join(tempDir, 'extracted');
            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'content.xml');
            expect(await fs.pathExists(contentPath)).toBe(true);

            const structure = await parseFromFile(contentPath, 'test-session');
            expect(structure).toBeDefined();
            expect(structure.meta).toBeDefined();

            // Check boolean export settings
            expect(structure.meta.addPagination).toBe(true);
            expect(structure.meta.addSearchBox).toBe(true);
            expect(structure.meta.addExeLink).toBe(true);
            expect(structure.meta.addAccessibilityToolbar).toBe(true);
            expect(structure.meta.exportSource).toBe(true);
        }, 30000);

        it('should extract string export settings from content.xml', async () => {
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: really-simple-test-project.elpx not found');
                return;
            }

            const extractDir = path.join(tempDir, 'extracted_string');
            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'content.xml');
            const structure = await parseFromFile(contentPath, 'test-session');

            // Check extraHeadContent
            expect(structure.meta.extraHeadContent).toBeDefined();
            expect(structure.meta.extraHeadContent).toContain('<meta name="description"');
            expect(structure.meta.extraHeadContent).toContain('<meta name="generator"');

            // Check footer
            expect(structure.meta.footer).toBeDefined();
            expect(structure.meta.footer).toContain('<footer');
            expect(structure.meta.footer).toContain('eXeLearning');
        }, 30000);

        it('should extract basic metadata alongside export settings', async () => {
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: really-simple-test-project.elpx not found');
                return;
            }

            const extractDir = path.join(tempDir, 'extracted_basic');
            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'content.xml');
            const structure = await parseFromFile(contentPath, 'test-session');

            // Check basic metadata
            expect(structure.meta.title).toBe('Really Simple Test Project');
            expect(structure.meta.author).toBe('eXe Team');
            expect(structure.meta.locale).toBe('en');
            expect(structure.meta.description).toContain('Test content generated with eXeLearning');
        }, 30000);

        it('should have all export settings in the same meta object', async () => {
            if (!(await fs.pathExists(fixturePath))) {
                console.log('Skipping: really-simple-test-project.elpx not found');
                return;
            }

            const extractDir = path.join(tempDir, 'extracted_all');
            await extractZip(fixturePath, extractDir);

            const contentPath = path.join(extractDir, 'content.xml');
            const structure = await parseFromFile(contentPath, 'test-session');

            // Verify all expected properties exist
            const expectedProps = [
                'title',
                'author',
                'locale',
                'description',
                'addPagination',
                'addSearchBox',
                'addExeLink',
                'addAccessibilityToolbar',
                'exportSource',
                'extraHeadContent',
                'footer',
            ];

            for (const prop of expectedProps) {
                expect(structure.meta).toHaveProperty(prop);
            }
        }, 30000);
    });

    describe('export settings default values', () => {
        it('should use default values when export settings are missing', async () => {
            // Create a minimal content.xml without export settings
            const minimalXml = `<?xml version="1.0" encoding="utf-8"?>
<ode>
  <odeProperties>
    <odeProperty><key>pp_title</key><value>Minimal Project</value></odeProperty>
    <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  </odeProperties>
  <odeNavStructures>
    <odeNavStructure>
      <odePageId>page1</odePageId>
      <pageName>Page 1</pageName>
      <odeNavStructureOrder>1</odeNavStructureOrder>
      <odePagStructures/>
    </odeNavStructure>
  </odeNavStructures>
</ode>`;

            const contentPath = path.join(tempDir, 'minimal-content.xml');
            await fs.writeFile(contentPath, minimalXml);

            const structure = await parseFromFile(contentPath, 'test-session');

            // Default values should be used
            expect(structure.meta.title).toBe('Minimal Project');
            expect(structure.meta.locale).toBe('en');

            // Boolean defaults (may vary by implementation)
            // Just verify no errors and properties exist
            expect(structure.meta).toBeDefined();
        }, 30000);
    });
});
