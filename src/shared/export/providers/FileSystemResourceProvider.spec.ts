/**
 * Tests for FileSystemResourceProvider
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileSystemResourceProvider } from './FileSystemResourceProvider';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('FileSystemResourceProvider', () => {
    let provider: FileSystemResourceProvider;
    let testDir: string;

    beforeEach(async () => {
        // Create temp directory structure
        testDir = path.join(os.tmpdir(), `test-resources-${Date.now()}`);
        await fs.ensureDir(testDir);

        // Create test file structure (matching actual directory layout)
        // Themes: files/perm/themes/base/{themeName}/
        await fs.ensureDir(path.join(testDir, 'files', 'perm', 'themes', 'base', 'base'));
        // iDevices: files/perm/idevices/base/{type}/export/
        await fs.ensureDir(path.join(testDir, 'files', 'perm', 'idevices', 'base', 'text', 'export'));
        // Libraries
        await fs.ensureDir(path.join(testDir, 'libs', 'jquery'));
        await fs.ensureDir(path.join(testDir, 'libs', 'bootstrap'));
        // SCORM files are in app/common/scorm/
        await fs.ensureDir(path.join(testDir, 'app', 'common', 'scorm'));
        // Common JS files
        await fs.ensureDir(path.join(testDir, 'app', 'common'));
        // Content CSS (stored in style/workarea/ but exported as content/css/)
        await fs.ensureDir(path.join(testDir, 'style', 'workarea'));

        // Create test files
        // Theme files
        await fs.writeFile(
            path.join(testDir, 'files', 'perm', 'themes', 'base', 'base', 'content.css'),
            '.base { color: red; }',
        );
        await fs.writeFile(
            path.join(testDir, 'files', 'perm', 'themes', 'base', 'base', 'default.js'),
            'console.log("base");',
        );
        // iDevice files
        await fs.writeFile(
            path.join(testDir, 'files', 'perm', 'idevices', 'base', 'text', 'export', 'text.css'),
            '.text {}',
        );
        await fs.writeFile(
            path.join(testDir, 'files', 'perm', 'idevices', 'base', 'text', 'export', 'text.js'),
            '/* text */',
        );
        // Library files
        await fs.writeFile(path.join(testDir, 'libs', 'jquery', 'jquery.min.js'), '/* jQuery */');
        await fs.writeFile(path.join(testDir, 'libs', 'bootstrap', 'bootstrap.bundle.min.js'), '/* Bootstrap JS */');
        await fs.writeFile(path.join(testDir, 'libs', 'bootstrap', 'bootstrap.min.css'), '/* Bootstrap CSS */');
        // SCORM files in app/common/scorm/
        await fs.writeFile(path.join(testDir, 'app', 'common', 'scorm', 'SCORM_API_wrapper.js'), '/* SCORM API */');
        await fs.writeFile(path.join(testDir, 'app', 'common', 'scorm', 'SCOFunctions.js'), '/* SCO Functions */');
        // Common JS files (app/common/)
        await fs.writeFile(path.join(testDir, 'app', 'common', 'exe_export.js'), '/* Export */');
        await fs.writeFile(path.join(testDir, 'app', 'common', 'common.js'), '/* Common */');
        await fs.writeFile(path.join(testDir, 'app', 'common', 'common_i18n.js'), '/* i18n */');
        // Content CSS (stored in style/workarea/ but exported as content/css/)
        await fs.writeFile(path.join(testDir, 'style', 'workarea', 'base.css'), '.content { margin: 0; }');

        provider = new FileSystemResourceProvider(testDir);
    });

    afterEach(async () => {
        await fs.remove(testDir);
    });

    describe('fetchTheme', () => {
        it('should fetch all files from theme directory', async () => {
            const files = await provider.fetchTheme('base');

            expect(files.size).toBe(2);
            // Files are returned without prefix (prefix added by caller)
            expect(files.has('content.css')).toBe(true);
            expect(files.has('default.js')).toBe(true);
        });

        it('should return file content as Buffer', async () => {
            const files = await provider.fetchTheme('base');
            const cssContent = files.get('content.css');

            expect(cssContent).toBeInstanceOf(Buffer);
            expect(cssContent?.toString()).toBe('.base { color: red; }');
        });

        it('should fall back to base theme for non-existent theme', async () => {
            const files = await provider.fetchTheme('nonexistent');

            // Falls back to 'base' theme, which has 2 files in our test setup
            expect(files.size).toBe(2);
            expect(files.has('content.css')).toBe(true);
            expect(files.has('default.js')).toBe(true);
        });

        it('should return empty map when neither theme nor base exists', async () => {
            // Create a provider with a directory that has no themes at all
            const emptyDir = path.join(os.tmpdir(), `test-empty-${Date.now()}`);
            await fs.ensureDir(emptyDir);
            const emptyProvider = new FileSystemResourceProvider(emptyDir);

            const files = await emptyProvider.fetchTheme('nonexistent');

            expect(files.size).toBe(0);

            await fs.remove(emptyDir);
        });
    });

    describe('fetchTheme with embedded themes', () => {
        let extractedDir: string;

        beforeEach(async () => {
            // Create a temp directory for extracted ELP/ELPX files
            extractedDir = path.join(os.tmpdir(), `test-extracted-${Date.now()}`);
            await fs.ensureDir(extractedDir);
        });

        afterEach(async () => {
            await fs.remove(extractedDir);
        });

        it('should use embedded theme when downloadable=1', async () => {
            // Create embedded theme structure
            await fs.ensureDir(path.join(extractedDir, 'theme'));
            await fs.writeFile(
                path.join(extractedDir, 'theme', 'config.xml'),
                `<?xml version="1.0"?>
<theme>
    <name>custom</name>
    <downloadable>1</downloadable>
</theme>`,
            );
            await fs.writeFile(path.join(extractedDir, 'theme', 'content.css'), '.custom { color: blue; }');
            await fs.writeFile(path.join(extractedDir, 'theme', 'default.js'), 'console.log("custom");');

            // Create provider with extracted directory
            const embeddedProvider = new FileSystemResourceProvider(testDir, extractedDir);
            const files = await embeddedProvider.fetchTheme('custom');

            expect(files.size).toBe(3); // config.xml, content.css, default.js
            expect(files.has('content.css')).toBe(true);
            expect(files.get('content.css')?.toString()).toBe('.custom { color: blue; }');
        });

        it('should fall back to base theme when downloadable=0', async () => {
            // Create embedded theme with downloadable=0
            await fs.ensureDir(path.join(extractedDir, 'theme'));
            await fs.writeFile(
                path.join(extractedDir, 'theme', 'config.xml'),
                `<?xml version="1.0"?>
<theme>
    <name>nondl</name>
    <downloadable>0</downloadable>
</theme>`,
            );
            await fs.writeFile(path.join(extractedDir, 'theme', 'content.css'), '.nondl { color: green; }');

            // Create provider with extracted directory
            const embeddedProvider = new FileSystemResourceProvider(testDir, extractedDir);
            const files = await embeddedProvider.fetchTheme('nondl');

            // Should fall back to base theme (2 files in our test setup)
            expect(files.size).toBe(2);
            expect(files.has('content.css')).toBe(true);
            expect(files.get('content.css')?.toString()).toBe('.base { color: red; }');
        });

        it('should fall back to base theme when config.xml is missing', async () => {
            // Create embedded theme without config.xml
            await fs.ensureDir(path.join(extractedDir, 'theme'));
            await fs.writeFile(path.join(extractedDir, 'theme', 'content.css'), '.noconfig { color: pink; }');

            // Create provider with extracted directory
            const embeddedProvider = new FileSystemResourceProvider(testDir, extractedDir);
            const files = await embeddedProvider.fetchTheme('noconfig');

            // Should fall back to base theme
            expect(files.size).toBe(2);
            expect(files.get('content.css')?.toString()).toBe('.base { color: red; }');
        });
    });

    describe('fetchIdeviceResources', () => {
        it('should fetch iDevice export files', async () => {
            const files = await provider.fetchIdeviceResources('text');

            expect(files.size).toBe(2);
            // Files are returned without prefix (prefix added by caller)
            expect(files.has('text.css')).toBe(true);
            expect(files.has('text.js')).toBe(true);
        });

        it('should normalize FreeTextIdevice to text', async () => {
            const files = await provider.fetchIdeviceResources('FreeTextIdevice');

            expect(files.size).toBe(2);
            expect(files.has('text.css')).toBe(true);
        });

        it('should return empty map for non-existent iDevice', async () => {
            const files = await provider.fetchIdeviceResources('nonexistent');

            expect(files.size).toBe(0);
        });
    });

    describe('normalizeIdeviceType', () => {
        it('should normalize FreeTextIdevice to text', () => {
            expect(provider.normalizeIdeviceType('FreeTextIdevice')).toBe('text');
        });

        it('should normalize TextIdevice to text', () => {
            expect(provider.normalizeIdeviceType('TextIdevice')).toBe('text');
        });

        it('should lowercase iDevice types and use canonical name', () => {
            // 'QUIZ' is normalized to 'quick-questions' per IDEVICE_TYPE_MAP
            expect(provider.normalizeIdeviceType('QUIZ')).toBe('quick-questions');
        });
    });

    describe('fetchBaseLibraries', () => {
        it('should fetch core library files', async () => {
            const files = await provider.fetchBaseLibraries();

            expect(files.size).toBeGreaterThan(0);
        });

        it('should include jQuery', async () => {
            const files = await provider.fetchBaseLibraries();

            // Check for any jQuery file
            const hasJquery = Array.from(files.keys()).some(k => k.includes('jquery'));
            expect(hasJquery).toBe(true);
        });
    });

    describe('fetchLibraryFiles', () => {
        it('should fetch specific library files', async () => {
            const files = await provider.fetchLibraryFiles(['jquery/jquery.min.js']);

            expect(files.size).toBe(1);
            // Files are returned without libs/ prefix (caller adds it)
            expect(files.has('jquery/jquery.min.js')).toBe(true);
        });

        it('should handle multiple files', async () => {
            const files = await provider.fetchLibraryFiles([
                'jquery/jquery.min.js',
                'bootstrap/bootstrap.bundle.min.js',
            ]);

            expect(files.size).toBe(2);
        });

        it('should skip non-existent files', async () => {
            const files = await provider.fetchLibraryFiles(['nonexistent.js']);

            expect(files.size).toBe(0);
        });

        it('should include entire directory when isDirectory pattern is passed', async () => {
            // Create a library directory with multiple files (like exe_atools)
            await fs.ensureDir(path.join(testDir, 'libs', 'exe_atools'));
            await fs.writeFile(path.join(testDir, 'libs', 'exe_atools', 'exe_atools.js'), '/* JS */');
            await fs.writeFile(path.join(testDir, 'libs', 'exe_atools', 'exe_atools.css'), '/* CSS */');
            await fs.writeFile(path.join(testDir, 'libs', 'exe_atools', 'exe_atools.png'), 'PNG');
            await fs.writeFile(path.join(testDir, 'libs', 'exe_atools', 'font.woff2'), 'FONT');

            // Pass a pattern with isDirectory: true
            const patterns = [
                {
                    name: 'exe_atools',
                    type: 'class' as const,
                    pattern: 'exe-atools',
                    files: ['exe_atools/exe_atools.js', 'exe_atools/exe_atools.css'],
                    isDirectory: true,
                },
            ];

            const files = await provider.fetchLibraryFiles(
                ['exe_atools/exe_atools.js', 'exe_atools/exe_atools.css'],
                patterns,
            );

            // Should include all files in the directory, not just the requested ones
            expect(files.size).toBe(4);
            expect(files.has('exe_atools/exe_atools.js')).toBe(true);
            expect(files.has('exe_atools/exe_atools.css')).toBe(true);
            expect(files.has('exe_atools/exe_atools.png')).toBe(true);
            expect(files.has('exe_atools/font.woff2')).toBe(true);
        });

        it('should filter out test files when including directory', async () => {
            await fs.ensureDir(path.join(testDir, 'app', 'common', 'exe_lightbox'));
            await fs.writeFile(path.join(testDir, 'app', 'common', 'exe_lightbox', 'exe_lightbox.js'), '/* JS */');
            await fs.writeFile(path.join(testDir, 'app', 'common', 'exe_lightbox', 'exe_lightbox.css'), '/* CSS */');
            await fs.writeFile(
                path.join(testDir, 'app', 'common', 'exe_lightbox', 'exe_lightbox.test.js'),
                '/* Test */',
            );
            await fs.writeFile(path.join(testDir, 'app', 'common', 'exe_lightbox', 'sprite.png'), 'PNG');

            const patterns = [
                {
                    name: 'exe_lightbox',
                    type: 'rel' as const,
                    pattern: 'lightbox',
                    files: ['exe_lightbox/exe_lightbox.js', 'exe_lightbox/exe_lightbox.css'],
                    isDirectory: true,
                },
            ];

            const files = await provider.fetchLibraryFiles(['exe_lightbox/exe_lightbox.js'], patterns);

            // Should include all files except test files
            expect(files.size).toBe(3);
            expect(files.has('exe_lightbox/exe_lightbox.js')).toBe(true);
            expect(files.has('exe_lightbox/exe_lightbox.css')).toBe(true);
            expect(files.has('exe_lightbox/sprite.png')).toBe(true);
            expect(files.has('exe_lightbox/exe_lightbox.test.js')).toBe(false);
        });

        it('should not include directory if isDirectory is not set', async () => {
            await fs.ensureDir(path.join(testDir, 'app', 'common', 'exe_effects'));
            await fs.writeFile(path.join(testDir, 'app', 'common', 'exe_effects', 'exe_effects.js'), '/* JS */');
            await fs.writeFile(path.join(testDir, 'app', 'common', 'exe_effects', 'exe_effects.css'), '/* CSS */');
            await fs.writeFile(path.join(testDir, 'app', 'common', 'exe_effects', 'extra.png'), 'PNG');

            // No isDirectory flag
            const patterns = [
                {
                    name: 'exe_effects',
                    type: 'class' as const,
                    pattern: 'exe-fx',
                    files: ['exe_effects/exe_effects.js', 'exe_effects/exe_effects.css'],
                },
            ];

            const files = await provider.fetchLibraryFiles(
                ['exe_effects/exe_effects.js', 'exe_effects/exe_effects.css'],
                patterns,
            );

            // Should only include the requested files, not the whole directory
            expect(files.size).toBe(2);
            expect(files.has('exe_effects/exe_effects.js')).toBe(true);
            expect(files.has('exe_effects/exe_effects.css')).toBe(true);
            expect(files.has('exe_effects/extra.png')).toBe(false);
        });
    });

    describe('fetchScormFiles', () => {
        it('should fetch SCORM library files', async () => {
            const files = await provider.fetchScormFiles('1.2');

            expect(files.size).toBe(2);
            // Files are returned without prefix (caller adds libs/ prefix)
            expect(files.has('SCORM_API_wrapper.js')).toBe(true);
            expect(files.has('SCOFunctions.js')).toBe(true);
        });

        it('should work with version 2004', async () => {
            const files = await provider.fetchScormFiles('2004');

            expect(files.size).toBe(2);
            expect(files.has('SCORM_API_wrapper.js')).toBe(true);
            expect(files.has('SCOFunctions.js')).toBe(true);
        });
    });

    describe('fetchContentCss', () => {
        it('should fetch content CSS files', async () => {
            const files = await provider.fetchContentCss();

            expect(files.size).toBe(1);
            expect(files.has('content/css/base.css')).toBe(true);
        });
    });

    describe('exists', () => {
        it('should return true for existing file', async () => {
            const exists = await provider.exists('app/common/common.js');

            expect(exists).toBe(true);
        });

        it('should return false for non-existent file', async () => {
            const exists = await provider.exists('libs/nonexistent.js');

            expect(exists).toBe(false);
        });
    });

    describe('readFile', () => {
        it('should read file content', async () => {
            const content = await provider.readFile('app/common/common.js');

            expect(content).toBeInstanceOf(Buffer);
            expect(content?.toString()).toBe('/* Common */');
        });

        it('should return null for non-existent file', async () => {
            const content = await provider.readFile('nonexistent.js');

            expect(content).toBeNull();
        });
    });

    describe('nested directories', () => {
        it('should recursively read nested directories', async () => {
            // Create nested structure in the correct theme path
            await fs.ensureDir(path.join(testDir, 'files', 'perm', 'themes', 'base', 'nested', 'level1', 'level2'));
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'themes', 'base', 'nested', 'file1.css'),
                '.file1 {}',
            );
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'themes', 'base', 'nested', 'level1', 'file2.css'),
                '.file2 {}',
            );
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'themes', 'base', 'nested', 'level1', 'level2', 'file3.css'),
                '.file3 {}',
            );

            const files = await provider.fetchTheme('nested');

            expect(files.size).toBe(3);
            // Files are returned without prefix (prefix added by caller)
            expect(files.has('file1.css')).toBe(true);
            expect(files.has('level1/file2.css')).toBe(true);
            expect(files.has('level1/level2/file3.css')).toBe(true);
        });
    });

    describe('fetchGlobalFontFiles', () => {
        beforeEach(async () => {
            // Create font directory structure
            await fs.ensureDir(path.join(testDir, 'files', 'perm', 'fonts', 'global', 'opendyslexic'));
            await fs.ensureDir(path.join(testDir, 'files', 'perm', 'fonts', 'global', 'andika'));

            // Create test font files for opendyslexic
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'fonts', 'global', 'opendyslexic', 'OpenDyslexic-Regular.woff'),
                Buffer.from('WOFF_FONT_DATA'),
            );
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'fonts', 'global', 'opendyslexic', 'OpenDyslexic-Bold.woff'),
                Buffer.from('WOFF_FONT_DATA'),
            );

            // Create test font files for andika
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'fonts', 'global', 'andika', 'Andika-Regular.woff2'),
                Buffer.from('WOFF2_FONT_DATA'),
            );
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'fonts', 'global', 'andika', 'ATTRIBUTION.txt'),
                'SIL Open Font License',
            );
        });

        it('should return empty map for default font', async () => {
            const files = await provider.fetchGlobalFontFiles('default');
            expect(files.size).toBe(0);
        });

        it('should return empty map for empty font id', async () => {
            const files = await provider.fetchGlobalFontFiles('');
            expect(files.size).toBe(0);
        });

        it('should return empty map for non-existent font', async () => {
            const files = await provider.fetchGlobalFontFiles('nonexistent');
            expect(files.size).toBe(0);
        });

        it('should fetch font files for opendyslexic', async () => {
            const files = await provider.fetchGlobalFontFiles('opendyslexic');

            expect(files.size).toBe(2);
            expect(files.has('fonts/global/opendyslexic/OpenDyslexic-Regular.woff')).toBe(true);
            expect(files.has('fonts/global/opendyslexic/OpenDyslexic-Bold.woff')).toBe(true);
        });

        it('should fetch font files and attribution for andika', async () => {
            const files = await provider.fetchGlobalFontFiles('andika');

            expect(files.size).toBe(2);
            expect(files.has('fonts/global/andika/Andika-Regular.woff2')).toBe(true);
            expect(files.has('fonts/global/andika/ATTRIBUTION.txt')).toBe(true);
        });

        it('should only include font-related extensions', async () => {
            // Add a non-font file
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'fonts', 'global', 'opendyslexic', 'readme.md'),
                '# OpenDyslexic Font',
            );
            await fs.writeFile(
                path.join(testDir, 'files', 'perm', 'fonts', 'global', 'opendyslexic', 'example.html'),
                '<html></html>',
            );

            const files = await provider.fetchGlobalFontFiles('opendyslexic');

            // Should still only have font files (woff, woff2, ttf, txt)
            expect(files.size).toBe(2);
            expect(files.has('fonts/global/opendyslexic/readme.md')).toBe(false);
            expect(files.has('fonts/global/opendyslexic/example.html')).toBe(false);
        });

        it('should return Buffer content', async () => {
            const files = await provider.fetchGlobalFontFiles('opendyslexic');
            const fontContent = files.get('fonts/global/opendyslexic/OpenDyslexic-Regular.woff');

            expect(fontContent).toBeInstanceOf(Buffer);
            expect(fontContent?.toString()).toBe('WOFF_FONT_DATA');
        });
    });

    describe('fetchExeLogo', () => {
        it('should return null when logo does not exist', async () => {
            const logo = await provider.fetchExeLogo();
            expect(logo).toBeNull();
        });

        it('should fetch logo when it exists', async () => {
            // Create the logo file
            await fs.ensureDir(path.join(testDir, 'app', 'common', 'exe_powered_logo'));
            const logoData = Buffer.from('PNG_IMAGE_DATA');
            await fs.writeFile(
                path.join(testDir, 'app', 'common', 'exe_powered_logo', 'exe_powered_logo.png'),
                logoData,
            );

            const logo = await provider.fetchExeLogo();

            expect(logo).not.toBeNull();
            expect(logo?.toString()).toBe('PNG_IMAGE_DATA');
        });
    });
});
