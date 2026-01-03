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

        it('should return empty map for non-existent theme', async () => {
            const files = await provider.fetchTheme('nonexistent');

            expect(files.size).toBe(0);
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

    describe('fetchScormSchemas', () => {
        it('should return empty map when no schemas exist', async () => {
            // By default test dir doesn't have schemas
            const files = await provider.fetchScormSchemas('1.2');
            expect(files.size).toBe(0);
        });

        it('should fetch schema files when they exist', async () => {
            // Create schema directory and file
            await fs.ensureDir(path.join(testDir, 'app', 'schemas', 'scorm12'));
            await fs.writeFile(
                path.join(testDir, 'app', 'schemas', 'scorm12', 'imscp_rootv1p1p2.xsd'),
                '<?xml version="1.0"?>',
            );

            const files = await provider.fetchScormSchemas('1.2');
            expect(files.size).toBe(1);
            expect(files.has('imscp_rootv1p1p2.xsd')).toBe(true);
        });

        it('should fetch SCORM 2004 schemas', async () => {
            // Create schema directory and file
            await fs.ensureDir(path.join(testDir, 'app', 'schemas', 'scorm2004'));
            await fs.writeFile(
                path.join(testDir, 'app', 'schemas', 'scorm2004', 'adlcp_v1p3.xsd'),
                '<?xml version="1.0"?>',
            );

            const files = await provider.fetchScormSchemas('2004');
            expect(files.size).toBe(1);
            expect(files.has('adlcp_v1p3.xsd')).toBe(true);
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
});
