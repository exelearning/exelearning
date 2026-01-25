/**
 * Tests for Theme Parser
 */
import { describe, it, expect } from 'bun:test';
import {
    parseThemeConfig,
    parseThemeConfigBasic,
    type ThemeFileSystemReader,
    type ThemePathUtils,
} from './theme-parser';

describe('theme-parser', () => {
    // Mock file system for testing
    const createMockFs = (files: Record<string, string> = {}, dirs: string[] = []): ThemeFileSystemReader => ({
        existsSync: (path: string) => path in files || dirs.includes(path),
        readFileSync: (path: string, _encoding: 'utf-8') => files[path] || '',
        readdirSync: (path: string, options?: { withFileTypes: boolean }) => {
            const prefix = path.endsWith('/') ? path : path + '/';
            const entries = Object.keys(files)
                .filter(f => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'))
                .map(f => f.slice(prefix.length));

            if (options?.withFileTypes) {
                return entries.map(name => ({
                    name,
                    isFile: () => true,
                    isDirectory: () => false,
                }));
            }
            return entries;
        },
    });

    // Mock path utilities
    const mockPath: ThemePathUtils = {
        join: (...paths: string[]) => paths.filter(Boolean).join('/'),
        extname: (p: string) => {
            const match = p.match(/\.[^./]+$/);
            return match ? match[0] : '';
        },
        basename: (p: string, ext?: string) => {
            const base = p.split('/').pop() || p;
            return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
        },
    };

    describe('parseThemeConfig', () => {
        it('should parse basic theme config', () => {
            const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<theme>
    <name>Base Theme</name>
    <version>1.0</version>
    <exe-version>3.0</exe-version>
    <author>eXeLearning</author>
    <description>A clean, minimal theme</description>
    <downloadable>1</downloadable>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'base',
                themePath: '/themes/base',
                type: 'base',
                themeUrl: '/files/perm/themes/base/base',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.id).toBe('base');
            expect(config!.name).toBe('base');
            expect(config!.dirName).toBe('base');
            expect(config!.displayName).toBe('Base Theme');
            expect(config!.title).toBe('Base Theme');
            expect(config!.type).toBe('base');
            expect(config!.version).toBe('1.0');
            expect(config!.compatibility).toBe('3.0');
            expect(config!.author).toBe('eXeLearning');
            expect(config!.description).toBe('A clean, minimal theme');
            expect(config!.downloadable).toBe('1');
            expect(config!.valid).toBe(true);
        });

        it('should use title tag if name not present', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <title>Modern Theme</title>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'modern',
                themePath: '/themes/modern',
                type: 'base',
                themeUrl: '/files/perm/themes/base/modern',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.displayName).toBe('Modern Theme');
            expect(config!.title).toBe('Modern Theme');
        });

        it('should fall back to themeId for display name', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <version>1.0</version>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'minimal',
                themePath: '/themes/minimal',
                type: 'base',
                themeUrl: '/files/perm/themes/base/minimal',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.displayName).toBe('minimal');
            expect(config!.title).toBe('minimal');
        });

        it('should scan for CSS files', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Multi CSS</name>
</theme>`;

            const mockFs = createMockFs(
                {
                    '/themes/multi/style.css': '/* main style */',
                    '/themes/multi/print.css': '/* print style */',
                    '/themes/multi/mobile.css': '/* mobile style */',
                },
                ['/themes/multi'],
            );

            const config = parseThemeConfig(xmlContent, {
                themeId: 'multi',
                themePath: '/themes/multi',
                type: 'base',
                themeUrl: '/files/perm/themes/base/multi',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.cssFiles).toContain('style.css');
            expect(config!.cssFiles).toContain('print.css');
            expect(config!.cssFiles).toContain('mobile.css');
        });

        it('should default to style.css if no CSS files found', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Empty</name>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'empty',
                themePath: '/themes/empty',
                type: 'base',
                themeUrl: '/files/perm/themes/base/empty',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.cssFiles).toEqual(['style.css']);
        });

        it('should scan for JS files', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Interactive</name>
</theme>`;

            const mockFs = createMockFs(
                {
                    '/themes/interactive/theme.js': '// theme js',
                    '/themes/interactive/effects.js': '// effects',
                },
                ['/themes/interactive'],
            );

            const config = parseThemeConfig(xmlContent, {
                themeId: 'interactive',
                themePath: '/themes/interactive',
                type: 'base',
                themeUrl: '/files/perm/themes/base/interactive',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.js).toContain('theme.js');
            expect(config!.js).toContain('effects.js');
        });

        it('should scan for icon files', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>With Icons</name>
</theme>`;

            const mockFs = createMockFs(
                {
                    '/themes/icons/icons/arrow.svg': '<svg></svg>',
                    '/themes/icons/icons/star.png': 'binary',
                    '/themes/icons/icons/check.gif': 'binary',
                },
                ['/themes/icons', '/themes/icons/icons'],
            );

            const config = parseThemeConfig(xmlContent, {
                themeId: 'icons',
                themePath: '/themes/icons',
                type: 'base',
                themeUrl: '/files/perm/themes/base/icons',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.icons).toHaveProperty('arrow');
            expect(config!.icons.arrow.id).toBe('arrow');
            expect(config!.icons.arrow.type).toBe('img');
            expect(config!.icons.arrow.value).toBe('/files/perm/themes/base/icons/icons/arrow.svg');

            expect(config!.icons).toHaveProperty('star');
            expect(config!.icons.star.value).toBe('/files/perm/themes/base/icons/icons/star.png');
        });

        it('should use provided preview URL', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Custom Preview</name>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'custom',
                themePath: '/themes/custom',
                type: 'base',
                themeUrl: '/files/perm/themes/base/custom',
                previewUrl: '/style/custom/preview.png',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.preview).toBe('/style/custom/preview.png');
        });

        it('should default preview URL to theme URL + preview.png', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Default Preview</name>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'default',
                themePath: '/themes/default',
                type: 'site',
                themeUrl: '/site-files/themes/default',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.preview).toBe('/site-files/themes/default/preview.png');
        });

        it('should handle site type themes', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Site Theme</name>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'site-theme',
                themePath: '/data/themes/site/site-theme',
                type: 'site',
                themeUrl: '/v3.0/site-files/themes/site-theme',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.type).toBe('site');
            expect(config!.url).toBe('/v3.0/site-files/themes/site-theme');
        });

        it('should handle user type themes', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>User Theme</name>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'my-theme',
                themePath: '/user/themes/my-theme',
                type: 'user',
                themeUrl: '/user/themes/my-theme',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.type).toBe('user');
        });

        it('should use defaults for missing values', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
</theme>`;

            const config = parseThemeConfig(xmlContent, {
                themeId: 'empty',
                themePath: '/themes/empty',
                type: 'base',
                themeUrl: '/files/perm/themes/base/empty',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.version).toBe('1.0');
            expect(config!.compatibility).toBe('3.0');
            expect(config!.author).toBe('');
            expect(config!.description).toBe('');
            expect(config!.downloadable).toBe('1');
        });
    });

    describe('parseThemeConfigBasic', () => {
        it('should parse basic fields without file system access', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Simple Theme</name>
    <version>2.0</version>
    <author>Test Author</author>
    <license>MIT</license>
</theme>`;

            const config = parseThemeConfigBasic(xmlContent, 'simple', 'base');

            expect(config).not.toBeNull();
            expect(config!.id).toBe('simple');
            expect(config!.displayName).toBe('Simple Theme');
            expect(config!.version).toBe('2.0');
            expect(config!.author).toBe('Test Author');
            expect(config!.license).toBe('MIT');
            expect(config!.type).toBe('base');
        });

        it('should not include file-dependent fields', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Test</name>
</theme>`;

            const config = parseThemeConfigBasic(xmlContent, 'test');

            expect(config).not.toBeNull();
            // These fields require file system access, so shouldn't be in basic config
            expect(config!.cssFiles).toBeUndefined();
            expect(config!.js).toBeUndefined();
            expect(config!.icons).toBeUndefined();
        });

        it('should default type to base', () => {
            const xmlContent = `<?xml version="1.0"?>
<theme>
    <name>Test</name>
</theme>`;

            const config = parseThemeConfigBasic(xmlContent, 'test');

            expect(config).not.toBeNull();
            expect(config!.type).toBe('base');
        });
    });
});
