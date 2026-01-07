/**
 * Tests for Admin Upload Validator Service
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fflate from 'fflate';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
    createAdminUploadValidator,
    SUPPORTED_LOCALES,
    BASE_THEME_NAMES,
    // Also test the default exports
    isZipFile,
    validateThemeZip,
    validateTemplateZip,
    extractTheme,
    extractTemplate,
    validatePathSecurity,
    slugify,
    parseThemeConfig,
} from './admin-upload-validator';

describe('Admin Upload Validator', () => {
    let validator: ReturnType<typeof createAdminUploadValidator>;

    beforeEach(() => {
        validator = createAdminUploadValidator();
    });

    describe('isZipFile', () => {
        test('should return true for valid ZIP magic bytes', () => {
            const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
            expect(validator.isZipFile(zipBuffer)).toBe(true);
        });

        test('should return false for non-ZIP file', () => {
            const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
            expect(validator.isZipFile(pngBuffer)).toBe(false);
        });

        test('should return false for buffer smaller than 4 bytes', () => {
            const smallBuffer = Buffer.from([0x50, 0x4b]);
            expect(validator.isZipFile(smallBuffer)).toBe(false);
        });

        test('should return false for empty buffer', () => {
            const emptyBuffer = Buffer.alloc(0);
            expect(validator.isZipFile(emptyBuffer)).toBe(false);
        });
    });

    describe('validatePathSecurity', () => {
        test('should return true for safe paths', () => {
            const safePaths = ['config.xml', 'style.css', 'icons/logo.png', 'js/main.js'];
            expect(validator.validatePathSecurity(safePaths)).toBe(true);
        });

        test('should return false for path traversal attempts', () => {
            const unsafePaths = ['../etc/passwd', 'config.xml'];
            expect(validator.validatePathSecurity(unsafePaths)).toBe(false);
        });

        test('should return false for absolute paths', () => {
            const unsafePaths = ['/etc/passwd', 'config.xml'];
            expect(validator.validatePathSecurity(unsafePaths)).toBe(false);
        });

        test('should return false for null bytes', () => {
            const unsafePaths = ['config\x00.xml', 'style.css'];
            expect(validator.validatePathSecurity(unsafePaths)).toBe(false);
        });

        test('should return false for backslash paths', () => {
            const unsafePaths = ['..\\windows\\system32', 'config.xml'];
            expect(validator.validatePathSecurity(unsafePaths)).toBe(false);
        });

        test('should return true for empty array', () => {
            expect(validator.validatePathSecurity([])).toBe(true);
        });
    });

    describe('slugify', () => {
        test('should convert to lowercase', () => {
            expect(validator.slugify('MyTheme')).toBe('mytheme');
        });

        test('should replace spaces with dashes', () => {
            expect(validator.slugify('My Theme Name')).toBe('my-theme-name');
        });

        test('should remove diacritics', () => {
            expect(validator.slugify('Café Theme')).toBe('cafe-theme');
        });

        test('should remove special characters', () => {
            expect(validator.slugify('Theme@#$%!')).toBe('theme');
        });

        test('should collapse multiple dashes', () => {
            expect(validator.slugify('Theme---Name')).toBe('theme-name');
        });

        test('should trim leading/trailing dashes', () => {
            expect(validator.slugify('-Theme-')).toBe('theme');
        });

        test('should truncate to 50 characters', () => {
            const longName = 'a'.repeat(100);
            expect(validator.slugify(longName).length).toBe(50);
        });

        test('should preserve underscores', () => {
            expect(validator.slugify('my_theme_name')).toBe('my_theme_name');
        });
    });

    describe('parseThemeConfig', () => {
        test('should parse valid config.xml', () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<theme>
    <name>my-custom-theme</name>
    <title>My Custom Theme</title>
    <version>1.5.0</version>
    <author>John Doe</author>
    <license>MIT</license>
    <description>A beautiful custom theme</description>
</theme>`;

            const metadata = validator.parseThemeConfig(xmlContent);
            expect(metadata).toEqual({
                name: 'my-custom-theme',
                title: 'My Custom Theme',
                version: '1.5.0',
                author: 'John Doe',
                license: 'MIT',
                description: 'A beautiful custom theme',
            });
        });

        test('should use name as title fallback', () => {
            const xmlContent = `<theme><name>my-theme</name></theme>`;
            const metadata = validator.parseThemeConfig(xmlContent);
            expect(metadata?.title).toBe('my-theme');
        });

        test('should provide defaults for missing fields', () => {
            const xmlContent = `<theme><name>minimal</name></theme>`;
            const metadata = validator.parseThemeConfig(xmlContent);
            expect(metadata).toEqual({
                name: 'minimal',
                title: 'minimal',
                version: '1.0',
                author: '',
                license: '',
                description: '',
            });
        });

        test('should handle multiline content', () => {
            const xmlContent = `<theme>
    <name>multi</name>
    <description>
        Line 1
        Line 2
    </description>
</theme>`;
            const metadata = validator.parseThemeConfig(xmlContent);
            expect(metadata?.description).toContain('Line 1');
            expect(metadata?.description).toContain('Line 2');
        });
    });

    describe('constants', () => {
        test('SUPPORTED_LOCALES should include common languages', () => {
            expect(SUPPORTED_LOCALES).toContain('en');
            expect(SUPPORTED_LOCALES).toContain('es');
            expect(SUPPORTED_LOCALES).toContain('fr');
            expect(SUPPORTED_LOCALES).toContain('de');
        });

        test('BASE_THEME_NAMES should include default themes', () => {
            expect(BASE_THEME_NAMES).toContain('base');
            expect(BASE_THEME_NAMES).toContain('neo');
        });
    });

    describe('validateThemeZip', () => {
        // Helper to create a valid ZIP buffer with config.xml
        function createThemeZip(configXml: string): Buffer {
            const zipData = fflate.zipSync({
                'config.xml': fflate.strToU8(configXml),
                'style.css': fflate.strToU8('body { color: red; }'),
            });
            return Buffer.from(zipData);
        }

        test('should reject non-ZIP file', async () => {
            const notZip = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
            const result = await validator.validateThemeZip(notZip);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not a ZIP file');
        });

        test('should reject ZIP without config.xml', async () => {
            const zipData = fflate.zipSync({
                'style.css': fflate.strToU8('body {}'),
            });
            const result = await validator.validateThemeZip(Buffer.from(zipData));
            expect(result.valid).toBe(false);
            expect(result.error).toContain('missing config.xml');
        });

        test('should reject config.xml without name element', async () => {
            const configXml = '<theme><title>Test</title></theme>';
            const result = await validator.validateThemeZip(createThemeZip(configXml));
            expect(result.valid).toBe(false);
            expect(result.error).toContain('missing <name> element');
        });

        test('should reject theme with base theme name', async () => {
            const configXml = '<theme><name>base</name></theme>';
            const result = await validator.validateThemeZip(createThemeZip(configXml));
            expect(result.valid).toBe(false);
            expect(result.error).toContain('conflicts with a built-in theme');
        });

        test('should accept valid theme ZIP', async () => {
            const configXml = `<theme>
                <name>custom-theme</name>
                <title>Custom Theme</title>
                <version>1.0.0</version>
                <author>Test Author</author>
            </theme>`;
            const result = await validator.validateThemeZip(createThemeZip(configXml));
            expect(result.valid).toBe(true);
            expect(result.metadata?.name).toBe('custom-theme');
            expect(result.metadata?.title).toBe('Custom Theme');
        });

        test('should reject ZIP with path traversal', async () => {
            const zipData = fflate.zipSync({
                '../evil.xml': fflate.strToU8('<evil/>'),
                'config.xml': fflate.strToU8('<theme><name>test</name></theme>'),
            });
            const result = await validator.validateThemeZip(Buffer.from(zipData));
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Security error');
        });

        test('should handle malformed ZIP', async () => {
            const corruptZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff]);
            const result = await validator.validateThemeZip(corruptZip);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Failed to process ZIP');
        });
    });

    describe('validateTemplateZip', () => {
        test('should reject non-ZIP file', async () => {
            const notZip = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
            const result = await validator.validateTemplateZip(notZip);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('not a ZIP file');
        });

        test('should reject ZIP without content.xml', async () => {
            const zipData = fflate.zipSync({
                'other.xml': fflate.strToU8('<other/>'),
            });
            const result = await validator.validateTemplateZip(Buffer.from(zipData));
            expect(result.valid).toBe(false);
            expect(result.error).toContain('missing content.xml');
        });

        test('should accept ZIP with content.xml', async () => {
            const zipData = fflate.zipSync({
                'content.xml': fflate.strToU8('<ode/>'),
            });
            const result = await validator.validateTemplateZip(Buffer.from(zipData));
            expect(result.valid).toBe(true);
            expect(result.isLegacy).toBe(false);
        });

        test('should accept ZIP with contentv3.xml as legacy', async () => {
            const zipData = fflate.zipSync({
                'contentv3.xml': fflate.strToU8('<ode/>'),
            });
            const result = await validator.validateTemplateZip(Buffer.from(zipData));
            expect(result.valid).toBe(true);
            expect(result.isLegacy).toBe(true);
        });

        test('should accept EPUB format with EPUB/content.xml', async () => {
            const zipData = fflate.zipSync({
                'mimetype': fflate.strToU8('application/epub+zip'),
                'META-INF/container.xml': fflate.strToU8('<container/>'),
                'EPUB/content.xml': fflate.strToU8('<ode/>'),
                'EPUB/package.opf': fflate.strToU8('<package/>'),
            });
            const result = await validator.validateTemplateZip(Buffer.from(zipData));
            expect(result.valid).toBe(true);
            expect(result.isLegacy).toBe(false);
        });

        test('should prefer content.xml over EPUB/content.xml', async () => {
            const zipData = fflate.zipSync({
                'content.xml': fflate.strToU8('<ode/>'),
                'EPUB/content.xml': fflate.strToU8('<ode/>'),
            });
            const result = await validator.validateTemplateZip(Buffer.from(zipData));
            expect(result.valid).toBe(true);
            expect(result.isLegacy).toBe(false);
        });

        test('should reject ZIP with path traversal', async () => {
            const zipData = fflate.zipSync({
                '../evil.xml': fflate.strToU8('<evil/>'),
                'content.xml': fflate.strToU8('<ode/>'),
            });
            const result = await validator.validateTemplateZip(Buffer.from(zipData));
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Security error');
        });

        test('should handle malformed ZIP', async () => {
            const corruptZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff]);
            const result = await validator.validateTemplateZip(corruptZip);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Failed to process ZIP');
        });
    });

    describe('extractTheme', () => {
        const testDir = '/tmp/admin-validator-test-theme';

        afterEach(async () => {
            await fs.remove(testDir);
        });

        test('should extract theme files to directory', async () => {
            const zipData = fflate.zipSync({
                'config.xml': fflate.strToU8('<theme><name>test</name></theme>'),
                'style.css': fflate.strToU8('body { color: blue; }'),
                'js/main.js': fflate.strToU8('console.log("hello");'),
            });

            const extractedFiles = await validator.extractTheme(Buffer.from(zipData), testDir);

            expect(extractedFiles).toContain('config.xml');
            expect(extractedFiles).toContain('style.css');
            expect(extractedFiles).toContain('js/main.js');

            // Verify files exist
            expect(await fs.pathExists(path.join(testDir, 'config.xml'))).toBe(true);
            expect(await fs.pathExists(path.join(testDir, 'style.css'))).toBe(true);
            expect(await fs.pathExists(path.join(testDir, 'js/main.js'))).toBe(true);
        });

        test('should handle directories in ZIP', async () => {
            const zipData = fflate.zipSync({
                'icons/': new Uint8Array(0),
                'icons/logo.png': fflate.strToU8('fake-png-data'),
            });

            const extractedFiles = await validator.extractTheme(Buffer.from(zipData), testDir);

            expect(extractedFiles).toContain('icons/logo.png');
            expect(await fs.pathExists(path.join(testDir, 'icons'))).toBe(true);
        });
    });

    describe('extractTemplate', () => {
        const testDir = '/tmp/admin-validator-test-template';
        const testFile = path.join(testDir, 'test.elpx');

        afterEach(async () => {
            await fs.remove(testDir);
        });

        test('should save template file as-is', async () => {
            const zipData = fflate.zipSync({
                'content.xml': fflate.strToU8('<ode/>'),
            });
            const buffer = Buffer.from(zipData);

            await validator.extractTemplate(buffer, testFile);

            expect(await fs.pathExists(testFile)).toBe(true);
            const savedBuffer = await fs.readFile(testFile);
            expect(savedBuffer.equals(buffer)).toBe(true);
        });

        test('should create parent directories', async () => {
            const deepPath = path.join(testDir, 'a', 'b', 'c', 'test.elpx');
            const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

            await validator.extractTemplate(buffer, deepPath);

            expect(await fs.pathExists(deepPath)).toBe(true);
        });
    });

    describe('default exports', () => {
        test('isZipFile should work', () => {
            const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
            expect(isZipFile(zipBuffer)).toBe(true);
        });

        test('validatePathSecurity should work', () => {
            expect(validatePathSecurity(['safe.txt'])).toBe(true);
            expect(validatePathSecurity(['../unsafe.txt'])).toBe(false);
        });

        test('slugify should work', () => {
            expect(slugify('My Theme')).toBe('my-theme');
        });

        test('parseThemeConfig should work', () => {
            const metadata = parseThemeConfig('<theme><name>test</name></theme>');
            expect(metadata?.name).toBe('test');
        });

        test('validateThemeZip should work', async () => {
            const zipData = fflate.zipSync({
                'config.xml': fflate.strToU8('<theme><name>custom</name></theme>'),
            });
            const result = await validateThemeZip(Buffer.from(zipData));
            expect(result.valid).toBe(true);
        });

        test('validateTemplateZip should work', async () => {
            const zipData = fflate.zipSync({
                'content.xml': fflate.strToU8('<ode/>'),
            });
            const result = await validateTemplateZip(Buffer.from(zipData));
            expect(result.valid).toBe(true);
        });

        test('extractTheme should work', async () => {
            const testDir = '/tmp/admin-validator-default-test';
            await fs.remove(testDir);
            const zipData = fflate.zipSync({
                'test.txt': fflate.strToU8('hello'),
            });
            const files = await extractTheme(Buffer.from(zipData), testDir);
            expect(files).toContain('test.txt');
            await fs.remove(testDir);
        });

        test('extractTemplate should work', async () => {
            const testFile = '/tmp/admin-validator-default-template.elpx';
            await fs.remove(testFile);
            const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
            await extractTemplate(buffer, testFile);
            expect(await fs.pathExists(testFile)).toBe(true);
            await fs.remove(testFile);
        });
    });
});
