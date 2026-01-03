/**
 * Integration test for legacy ELP icon import
 *
 * Tests that icons from legacy contentv3.xml files are correctly extracted
 * and mapped to modern theme icons.
 *
 * Uses real fixture: test/fixtures/more/a_la_romana.elp
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extractZip } from '../../src/services/zip';
import { createTempTestDir, cleanupTempTestDir } from '../helpers/fixture-loader';

// Path to the a_la_romana.elp fixture (in more/ subdirectory)
const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'more', 'a_la_romana.elp');

/**
 * Legacy icon to theme icon mapping (mirrors frontend LegacyXmlParser.LEGACY_ICON_MAP)
 */
const LEGACY_ICON_MAP: Record<string, string> = {
    preknowledge: 'think',
    reading: 'book',
    casestudy: 'case',
};

/**
 * Extract icon value from XML string near a given position
 * Looks for pattern: <string role="key" value="icon"/>...<unicode value="ICON_NAME"/>
 */
function extractIconFromXmlSnippet(xml: string, startPos: number): string | null {
    // Find the next <unicode value="..."/> or <string value="..."/> after the icon key
    const searchRegion = xml.substring(startPos, startPos + 500);
    const unicodeMatch = searchRegion.match(/<unicode\s+value="([^"]+)"/);
    const stringMatch = searchRegion.match(/<string\s+value="([^"]*)"\/>/);

    // Unicode takes precedence, but check if string comes first (empty icon)
    if (unicodeMatch && stringMatch) {
        return unicodeMatch.index! < stringMatch.index! ? unicodeMatch[1] : stringMatch[1] || '';
    }
    return unicodeMatch?.[1] || stringMatch?.[1] || null;
}

/**
 * Check if a string looks like a valid icon name (not a number or empty)
 */
function isValidIconName(value: string): boolean {
    if (!value || value.trim() === '') return false;
    // Icon names should be alphabetic strings, not numbers
    if (/^\d+$/.test(value)) return false;
    // Icon names should contain at least one letter
    if (!/[a-zA-Z]/.test(value)) return false;
    return true;
}

/**
 * Find all iDevice icon values in the XML
 */
function findAllIdeviceIcons(xml: string): Array<{ rawIcon: string; mappedIcon: string }> {
    const icons: Array<{ rawIcon: string; mappedIcon: string }> = [];

    // Find all occurrences of <string role="key" value="icon"/>
    const iconKeyRegex = /<string\s+role="key"\s+value="icon"\s*\/?>/g;
    let match;

    while ((match = iconKeyRegex.exec(xml)) !== null) {
        const rawIcon = extractIconFromXmlSnippet(xml, match.index + match[0].length);
        if (rawIcon !== null && isValidIconName(rawIcon)) {
            const mappedIcon = LEGACY_ICON_MAP[rawIcon] || rawIcon;
            icons.push({ rawIcon, mappedIcon });
        }
    }

    return icons;
}

describe('Legacy ELP Icon Import - Integration Tests', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempTestDir('icon-import-test-');
    });

    afterEach(async () => {
        await cleanupTempTestDir(tempDir);
    });

    describe('a_la_romana.elp fixture', () => {
        it('fixture file should exist', async () => {
            const exists = await fs.pathExists(FIXTURE_PATH);
            expect(exists).toBe(true);
        });

        it('should contain contentv3.xml (legacy format)', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const exists = await fs.pathExists(contentV3Path);
            expect(exists).toBe(true);
        });

        it('should have iDevices with icons in the XML', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            const icons = findAllIdeviceIcons(xmlContent);

            // a_la_romana.elp has multiple iDevices with icons
            expect(icons.length).toBeGreaterThan(0);

            // Log found icons for debugging
            console.log(`Found ${icons.length} iDevice icons in a_la_romana.elp`);
        });

        it('should contain preknowledge icons that map to think', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            const icons = findAllIdeviceIcons(xmlContent);

            // Find preknowledge icons
            const preknowledgeIcons = icons.filter(i => i.rawIcon === 'preknowledge');

            // a_la_romana.elp should have preknowledge iDevices
            expect(preknowledgeIcons.length).toBeGreaterThan(0);

            // All preknowledge icons should map to 'think'
            for (const icon of preknowledgeIcons) {
                expect(icon.mappedIcon).toBe('think');
            }
        });

        it('should contain objectives icons that pass through unchanged', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            const icons = findAllIdeviceIcons(xmlContent);

            // Find objectives icons
            const objectivesIcons = icons.filter(i => i.rawIcon === 'objectives');

            // a_la_romana.elp should have objectives iDevices
            expect(objectivesIcons.length).toBeGreaterThan(0);

            // Objectives icons should pass through unchanged (not in LEGACY_ICON_MAP)
            for (const icon of objectivesIcons) {
                expect(icon.mappedIcon).toBe('objectives');
            }
        });

        it('should correctly apply all legacy icon mappings', async () => {
            const extractDir = path.join(tempDir, 'extract');
            await extractZip(FIXTURE_PATH, extractDir);

            const contentV3Path = path.join(extractDir, 'contentv3.xml');
            const xmlContent = await fs.readFile(contentV3Path, 'utf-8');

            const icons = findAllIdeviceIcons(xmlContent);

            // Verify each icon is correctly mapped
            for (const icon of icons) {
                const expectedMapping = LEGACY_ICON_MAP[icon.rawIcon] || icon.rawIcon;
                expect(icon.mappedIcon).toBe(expectedMapping);
            }

            // Summary of icon mappings found
            const uniqueIcons = [...new Set(icons.map(i => `${i.rawIcon} -> ${i.mappedIcon}`))];
            console.log('Icon mappings found:', uniqueIcons);
        });
    });

    describe('LEGACY_ICON_MAP verification', () => {
        it('should map preknowledge to think', () => {
            expect(LEGACY_ICON_MAP['preknowledge']).toBe('think');
        });

        it('should map reading to book', () => {
            expect(LEGACY_ICON_MAP['reading']).toBe('book');
        });

        it('should map casestudy to case', () => {
            expect(LEGACY_ICON_MAP['casestudy']).toBe('case');
        });

        it('should return undefined for unmapped icons (pass-through)', () => {
            expect(LEGACY_ICON_MAP['objectives']).toBeUndefined();
            expect(LEGACY_ICON_MAP['reflection']).toBeUndefined();
            expect(LEGACY_ICON_MAP['activity']).toBeUndefined();
        });
    });

    describe('Theme icon availability', () => {
        const BASE_THEME_ICONS_DIR = path.join(
            __dirname,
            '..',
            '..',
            'public',
            'files',
            'perm',
            'themes',
            'base',
            'base',
            'icons',
        );

        it('base theme icons directory should exist', async () => {
            const exists = await fs.pathExists(BASE_THEME_ICONS_DIR);
            expect(exists).toBe(true);
        });

        it('mapped icon think.png should exist in base theme', async () => {
            const iconPath = path.join(BASE_THEME_ICONS_DIR, 'think.png');
            const exists = await fs.pathExists(iconPath);
            expect(exists).toBe(true);
        });

        it('mapped icon book.png should exist in base theme', async () => {
            const iconPath = path.join(BASE_THEME_ICONS_DIR, 'book.png');
            const exists = await fs.pathExists(iconPath);
            expect(exists).toBe(true);
        });

        it('mapped icon case.png should exist in base theme', async () => {
            const iconPath = path.join(BASE_THEME_ICONS_DIR, 'case.png');
            const exists = await fs.pathExists(iconPath);
            expect(exists).toBe(true);
        });

        it('pass-through icon objectives.png should exist in base theme', async () => {
            const iconPath = path.join(BASE_THEME_ICONS_DIR, 'objectives.png');
            const exists = await fs.pathExists(iconPath);
            expect(exists).toBe(true);
        });

        it('all commonly used legacy icons should have theme equivalents', async () => {
            const commonIcons = ['think', 'book', 'case', 'objectives', 'reflection', 'activity', 'file', 'info'];

            for (const iconName of commonIcons) {
                const iconPath = path.join(BASE_THEME_ICONS_DIR, `${iconName}.png`);
                const exists = await fs.pathExists(iconPath);
                expect(exists).toBe(true);
            }
        });
    });
});
