/**
 * Tests for idevice-config.ts
 * Tests the iDevice configuration service that loads configs from config.xml files
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
    loadIdeviceConfigs,
    getIdeviceConfig,
    isJsonIdevice,
    resetIdeviceConfigCache,
    setIdevicesBasePath,
    getAllIdeviceConfigs,
    getIdeviceExportFiles,
} from './idevice-config';

describe('IdeviceConfig Service', () => {
    const testDir = path.join(process.cwd(), 'test/temp/idevice-config-test');
    const idevicesDir = path.join(testDir, 'idevices');

    beforeEach(async () => {
        // Reset cache before each test
        resetIdeviceConfigCache();

        // Create test directory structure
        await fs.ensureDir(idevicesDir);
    });

    afterEach(async () => {
        // Clean up test files
        resetIdeviceConfigCache();
        await fs.remove(testDir);
    });

    describe('loadIdeviceConfigs', () => {
        it('should load configs from config.xml files', async () => {
            // Create a test iDevice directory with config.xml
            const textDir = path.join(idevicesDir, 'text');
            await fs.ensureDir(textDir);
            await fs.writeFile(
                path.join(textDir, 'config.xml'),
                `<?xml version="1.0" encoding="UTF-8"?>
                <idevice>
                    <name>text</name>
                    <title>Text</title>
                    <css-class>text</css-class>
                    <component-type>json</component-type>
                    <export-template-filename>text.html</export-template-filename>
                </idevice>`,
            );

            loadIdeviceConfigs(idevicesDir);

            const config = getIdeviceConfig('text');
            expect(config.cssClass).toBe('text');
            expect(config.componentType).toBe('json');
            expect(config.template).toBe('text.html');
        });

        it('should load multiple iDevice configs', async () => {
            // Create text iDevice
            const textDir = path.join(idevicesDir, 'text');
            await fs.ensureDir(textDir);
            await fs.writeFile(
                path.join(textDir, 'config.xml'),
                `<idevice>
                    <name>text</name>
                    <css-class>text</css-class>
                    <component-type>json</component-type>
                    <export-template-filename>text.html</export-template-filename>
                </idevice>`,
            );

            // Create crossword iDevice
            const crosswordDir = path.join(idevicesDir, 'crossword');
            await fs.ensureDir(crosswordDir);
            await fs.writeFile(
                path.join(crosswordDir, 'config.xml'),
                `<idevice>
                    <name>crossword</name>
                    <css-class>crossword</css-class>
                    <component-type>html</component-type>
                    <export-template-filename>crossword.html</export-template-filename>
                </idevice>`,
            );

            loadIdeviceConfigs(idevicesDir);

            const textConfig = getIdeviceConfig('text');
            expect(textConfig.componentType).toBe('json');

            const crosswordConfig = getIdeviceConfig('crossword');
            expect(crosswordConfig.componentType).toBe('html');
        });

        it('should handle missing config.xml gracefully', async () => {
            // Create directory without config.xml
            const emptyDir = path.join(idevicesDir, 'empty');
            await fs.ensureDir(emptyDir);

            loadIdeviceConfigs(idevicesDir);

            // Should not throw, should use fallback for unknown iDevice
            const config = getIdeviceConfig('empty');
            expect(config.cssClass).toBe('empty');
            expect(config.componentType).toBe('html');
        });

        it('should handle missing base path gracefully', () => {
            loadIdeviceConfigs('/nonexistent/path');

            // Should not throw, cache should be empty
            const config = getIdeviceConfig('unknown');
            expect(config.componentType).toBe('html');
        });

        it('should skip hidden directories', async () => {
            // Create hidden directory
            const hiddenDir = path.join(idevicesDir, '.hidden');
            await fs.ensureDir(hiddenDir);
            await fs.writeFile(
                path.join(hiddenDir, 'config.xml'),
                `<idevice>
                    <name>hidden</name>
                    <css-class>hidden</css-class>
                    <component-type>json</component-type>
                </idevice>`,
            );

            loadIdeviceConfigs(idevicesDir);

            // Hidden iDevice should use fallback
            const config = getIdeviceConfig('hidden');
            expect(config.componentType).toBe('html'); // fallback, not from config
        });

        it('should use directory name as fallback for css-class', async () => {
            const testDir = path.join(idevicesDir, 'my-idevice');
            await fs.ensureDir(testDir);
            await fs.writeFile(
                path.join(testDir, 'config.xml'),
                `<idevice>
                    <name>my-idevice</name>
                    <component-type>html</component-type>
                </idevice>`,
            );

            loadIdeviceConfigs(idevicesDir);

            const config = getIdeviceConfig('my-idevice');
            expect(config.cssClass).toBe('my-idevice');
        });
    });

    describe('getIdeviceConfig', () => {
        beforeEach(async () => {
            // Create test iDevice
            const textDir = path.join(idevicesDir, 'text');
            await fs.ensureDir(textDir);
            await fs.writeFile(
                path.join(textDir, 'config.xml'),
                `<idevice>
                    <name>text</name>
                    <css-class>text</css-class>
                    <component-type>json</component-type>
                    <export-template-filename>text.html</export-template-filename>
                </idevice>`,
            );
            loadIdeviceConfigs(idevicesDir);
        });

        it('should return config for exact match', () => {
            const config = getIdeviceConfig('text');
            expect(config.cssClass).toBe('text');
            expect(config.componentType).toBe('json');
        });

        it('should be case-insensitive', () => {
            const config1 = getIdeviceConfig('text');
            const config2 = getIdeviceConfig('TEXT');
            const config3 = getIdeviceConfig('Text');

            expect(config1.cssClass).toBe('text');
            expect(config2.cssClass).toBe('text');
            expect(config3.cssClass).toBe('text');
        });

        it('should return fallback config for unknown iDevice', () => {
            const config = getIdeviceConfig('UnknownCustomIdevice');

            expect(config.cssClass).toBe('unknowncustom');
            expect(config.componentType).toBe('html');
            expect(config.template).toBe('unknowncustom.html');
        });

        it('should strip "Idevice" suffix in fallback', () => {
            const config = getIdeviceConfig('MyTestIdevice');

            expect(config.cssClass).toBe('mytest');
            expect(config.template).toBe('mytest.html');
        });

        it('should lazy load configs if not initialized', () => {
            resetIdeviceConfigCache();
            setIdevicesBasePath(idevicesDir);

            // This should trigger lazy loading
            const config = getIdeviceConfig('text');
            expect(config.cssClass).toBe('text');
        });
    });

    describe('isJsonIdevice', () => {
        beforeEach(async () => {
            // Create JSON iDevice
            const textDir = path.join(idevicesDir, 'text');
            await fs.ensureDir(textDir);
            await fs.writeFile(
                path.join(textDir, 'config.xml'),
                `<idevice>
                    <name>text</name>
                    <component-type>json</component-type>
                </idevice>`,
            );

            // Create HTML iDevice
            const crosswordDir = path.join(idevicesDir, 'crossword');
            await fs.ensureDir(crosswordDir);
            await fs.writeFile(
                path.join(crosswordDir, 'config.xml'),
                `<idevice>
                    <name>crossword</name>
                    <component-type>html</component-type>
                </idevice>`,
            );

            loadIdeviceConfigs(idevicesDir);
        });

        it('should return true for JSON iDevice', () => {
            expect(isJsonIdevice('text')).toBe(true);
        });

        it('should return false for HTML iDevice', () => {
            expect(isJsonIdevice('crossword')).toBe(false);
        });

        it('should return false for unknown iDevice (defaults to html)', () => {
            expect(isJsonIdevice('unknown')).toBe(false);
        });
    });

    describe('resetIdeviceConfigCache', () => {
        it('should clear the cache', async () => {
            // Load configs
            const textDir = path.join(idevicesDir, 'text');
            await fs.ensureDir(textDir);
            await fs.writeFile(
                path.join(textDir, 'config.xml'),
                `<idevice>
                    <name>text</name>
                    <component-type>json</component-type>
                </idevice>`,
            );
            loadIdeviceConfigs(idevicesDir);

            // Verify loaded
            expect(getAllIdeviceConfigs()?.size).toBeGreaterThan(0);

            // Reset
            resetIdeviceConfigCache();

            // Cache should be null
            expect(getAllIdeviceConfigs()).toBeNull();
        });
    });

    describe('setIdevicesBasePath', () => {
        it('should update the base path and reset cache', async () => {
            // Create first path with one iDevice
            const path1 = path.join(testDir, 'path1');
            await fs.ensureDir(path.join(path1, 'idevice1'));
            await fs.writeFile(
                path.join(path1, 'idevice1', 'config.xml'),
                `<idevice>
                    <name>idevice1</name>
                    <css-class>dev1</css-class>
                    <component-type>json</component-type>
                </idevice>`,
            );

            // Create second path with different iDevice
            const path2 = path.join(testDir, 'path2');
            await fs.ensureDir(path.join(path2, 'idevice2'));
            await fs.writeFile(
                path.join(path2, 'idevice2', 'config.xml'),
                `<idevice>
                    <name>idevice2</name>
                    <css-class>dev2</css-class>
                    <component-type>html</component-type>
                </idevice>`,
            );

            // Load from first path
            loadIdeviceConfigs(path1);
            expect(getIdeviceConfig('idevice1').cssClass).toBe('dev1');

            // Change base path - should reset cache
            setIdevicesBasePath(path2);

            // Now should load from second path
            expect(getIdeviceConfig('idevice2').cssClass).toBe('dev2');
            // First iDevice should use fallback now
            expect(getIdeviceConfig('idevice1').cssClass).toBe('idevice1');
        });
    });

    describe('Integration with real iDevices', () => {
        const realIdevicesPath = path.join(process.cwd(), 'public/files/perm/idevices/base');

        it('should load real iDevice configs if available', () => {
            if (!fs.existsSync(realIdevicesPath)) {
                console.log('Skipping real iDevices test - path not found');
                return;
            }

            loadIdeviceConfigs(realIdevicesPath);
            const cache = getAllIdeviceConfigs();

            expect(cache).not.toBeNull();
            expect(cache!.size).toBeGreaterThan(0);
        });

        it('text iDevice should be JSON type', () => {
            if (!fs.existsSync(realIdevicesPath)) {
                console.log('Skipping real iDevices test - path not found');
                return;
            }

            loadIdeviceConfigs(realIdevicesPath);

            const textConfig = getIdeviceConfig('text');
            expect(textConfig.componentType).toBe('json');
        });

        it('crossword iDevice should be HTML type', () => {
            if (!fs.existsSync(realIdevicesPath)) {
                console.log('Skipping real iDevices test - path not found');
                return;
            }

            loadIdeviceConfigs(realIdevicesPath);

            const crosswordConfig = getIdeviceConfig('crossword');
            expect(crosswordConfig.componentType).toBe('html');
        });
    });

    describe('getIdeviceExportFiles', () => {
        beforeEach(async () => {
            // Create test iDevice with export folder
            const checklistDir = path.join(idevicesDir, 'checklist', 'export');
            await fs.ensureDir(checklistDir);
            // Create multiple JS files
            await fs.writeFile(path.join(checklistDir, 'checklist.js'), '// main');
            await fs.writeFile(path.join(checklistDir, 'html2canvas.js'), '// dependency');
            await fs.writeFile(path.join(checklistDir, 'checklist.css'), '/* main css */');

            // Set the base path
            setIdevicesBasePath(idevicesDir);
        });

        it('should return all JS files from export folder', () => {
            const files = getIdeviceExportFiles('checklist', '.js');
            expect(files).toContain('checklist.js');
            expect(files).toContain('html2canvas.js');
            expect(files.length).toBe(2);
        });

        it('should return main file first', () => {
            const files = getIdeviceExportFiles('checklist', '.js');
            expect(files[0]).toBe('checklist.js');
        });

        it('should return all CSS files from export folder', () => {
            const files = getIdeviceExportFiles('checklist', '.css');
            expect(files).toContain('checklist.css');
            expect(files.length).toBe(1);
        });

        it('should return fallback for non-existent iDevice', () => {
            const files = getIdeviceExportFiles('nonexistent', '.js');
            expect(files).toEqual(['nonexistent.js']);
        });

        it('should return fallback for empty export folder', async () => {
            // Create empty export folder
            const emptyDir = path.join(idevicesDir, 'empty', 'export');
            await fs.ensureDir(emptyDir);

            const files = getIdeviceExportFiles('empty', '.js');
            expect(files).toEqual(['empty.js']);
        });

        it('should sort alphabetically after main file', async () => {
            // Create iDevice with multiple dependencies
            const multiDir = path.join(idevicesDir, 'multi', 'export');
            await fs.ensureDir(multiDir);
            await fs.writeFile(path.join(multiDir, 'multi.js'), '// main');
            await fs.writeFile(path.join(multiDir, 'zebra.js'), '// z');
            await fs.writeFile(path.join(multiDir, 'alpha.js'), '// a');
            await fs.writeFile(path.join(multiDir, 'beta.js'), '// b');

            const files = getIdeviceExportFiles('multi', '.js');
            expect(files[0]).toBe('multi.js'); // main first
            expect(files[1]).toBe('alpha.js'); // then alphabetically
            expect(files[2]).toBe('beta.js');
            expect(files[3]).toBe('zebra.js');
        });

        it('should work with real checklist iDevice if available', () => {
            const realIdevicesPath = path.join(process.cwd(), 'public/files/perm/idevices/base');
            if (!fs.existsSync(path.join(realIdevicesPath, 'checklist', 'export'))) {
                console.log('Skipping real checklist test - path not found');
                return;
            }

            setIdevicesBasePath(realIdevicesPath);
            const files = getIdeviceExportFiles('checklist', '.js');

            // Should contain both checklist.js and html2canvas.js
            expect(files).toContain('checklist.js');
            expect(files).toContain('html2canvas.js');
            expect(files[0]).toBe('checklist.js'); // main first
        });
    });
});
