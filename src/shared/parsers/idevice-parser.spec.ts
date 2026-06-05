/**
 * Tests for iDevice Parser
 */
import { describe, it, expect } from 'bun:test';
import { parseIdeviceConfig, parseIdeviceConfigBasic, type FileSystemReader, type PathUtils } from './idevice-parser';

describe('idevice-parser', () => {
    // Mock file system for testing
    const createMockFs = (files: Record<string, string> = {}): FileSystemReader => {
        // Extract all directories from file paths
        const dirs = new Set<string>();
        for (const filePath of Object.keys(files)) {
            const parts = filePath.split('/');
            for (let i = 1; i < parts.length; i++) {
                dirs.add(parts.slice(0, i).join('/'));
            }
        }

        return {
            existsSync: (path: string) => path in files || dirs.has(path),
            readFileSync: (path: string, _encoding: 'utf-8') => files[path] || '',
            readdirSync: (path: string) => {
                const prefix = path.endsWith('/') ? path : path + '/';
                return Object.keys(files)
                    .filter(f => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'))
                    .map(f => f.slice(prefix.length));
            },
        };
    };

    // Mock path utilities
    const mockPath: PathUtils = {
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

    describe('parseIdeviceConfig', () => {
        it('should parse basic iDevice config', () => {
            const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<idevice>
    <title>Text Box</title>
    <css-class>text</css-class>
    <category>Content</category>
    <version>1.0</version>
    <api-version>3.0</api-version>
    <component-type>html</component-type>
    <author>eXeLearning</author>
    <description>A simple text content block</description>
    <downloadable>1</downloadable>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'text',
                basePath: '/idevices/text',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.id).toBe('text');
            expect(config!.name).toBe('text');
            expect(config!.title).toBe('Text Box');
            expect(config!.cssClass).toBe('text');
            expect(config!.category).toBe('Content');
            expect(config!.version).toBe('1.0');
            expect(config!.apiVersion).toBe('3.0');
            expect(config!.componentType).toBe('html');
            expect(config!.author).toBe('eXeLearning');
            expect(config!.description).toBe('A simple text content block');
            expect(config!.downloadable).toBe(true);
        });

        it('should parse icon with nested structure', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Quiz</title>
    <icon>
        <name>quiz-icon</name>
        <url>quiz-icon.svg</url>
        <type>img</type>
    </icon>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'quiz',
                basePath: '/idevices/quiz',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.icon.name).toBe('quiz-icon');
            expect(config!.icon.url).toBe('quiz-icon.svg');
            expect(config!.icon.type).toBe('img');
        });

        it('should parse simple icon name', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Note</title>
    <icon>lightbulb</icon>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'note',
                basePath: '/idevices/note',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.icon.name).toBe('lightbulb');
            expect(config!.icon.type).toBe('icon');
        });

        it('should use default icon when not specified', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Custom</title>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'custom',
                basePath: '/idevices/custom',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.icon.name).toBe('custom-icon');
            expect(config!.icon.url).toBe('custom-icon.svg');
            expect(config!.icon.type).toBe('img');
        });

        it('should parse export object', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Text</title>
    <export-object>$textbox</export-object>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'text',
                basePath: '/idevices/text',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.exportObject).toBe('$textbox');
        });

        it('should default export object to $ideviceId without dashes', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Multiple Choice</title>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'multiple-choice',
                basePath: '/idevices/multiple-choice',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.exportObject).toBe('$multiplechoice');
        });

        it('should read template content when files exist', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Text</title>
    <edition-template-filename>template.html</edition-template-filename>
    <export-template-filename>export.html</export-template-filename>
</idevice>`;

            const mockFs = createMockFs({
                '/idevices/text/edition/template.html': '<div class="edition">Edit</div>',
                '/idevices/text/export/export.html': '<div class="export">Export</div>',
            });

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'text',
                basePath: '/idevices/text',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.editionTemplateFilename).toBe('template.html');
            expect(config!.exportTemplateFilename).toBe('export.html');
            expect(config!.editionTemplateContent).toBe('<div class="edition">Edit</div>');
            expect(config!.exportTemplateContent).toBe('<div class="export">Export</div>');
        });

        it('should scan for JS and CSS files in edition/export folders', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Quiz</title>
</idevice>`;

            const mockFs = createMockFs({
                '/idevices/quiz/edition/quiz.js': '// edition js',
                '/idevices/quiz/edition/helper.js': '// helper',
                '/idevices/quiz/edition/quiz.css': '/* edition css */',
                '/idevices/quiz/export/quiz.js': '// export js',
                '/idevices/quiz/export/quiz.css': '/* export css */',
            });

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'quiz',
                basePath: '/idevices/quiz',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            // Main file should come first, then alphabetically
            expect(config!.editionJs).toContain('quiz.js');
            expect(config!.editionJs).toContain('helper.js');
            expect(config!.editionCss).toContain('quiz.css');
            expect(config!.exportJs).toContain('quiz.js');
            expect(config!.exportCss).toContain('quiz.css');
        });

        it('should exclude test files from JS/CSS scanning', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Text</title>
</idevice>`;

            const mockFs = createMockFs({
                '/idevices/text/edition/text.js': '// main',
                '/idevices/text/edition/text.test.js': '// test',
                '/idevices/text/edition/text.spec.js': '// spec',
            });

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'text',
                basePath: '/idevices/text',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.editionJs).toContain('text.js');
            expect(config!.editionJs).not.toContain('text.test.js');
            expect(config!.editionJs).not.toContain('text.spec.js');
        });

        it('should sort files alphabetically when main file is not present', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Custom</title>
</idevice>`;

            const mockFs = createMockFs({
                '/idevices/custom/edition/zebra.js': '// z',
                '/idevices/custom/edition/alpha.js': '// a',
                '/idevices/custom/edition/beta.js': '// b',
            });

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'custom',
                basePath: '/idevices/custom',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            // Should be sorted alphabetically
            expect(config!.editionJs[0]).toBe('alpha.js');
            expect(config!.editionJs[1]).toBe('beta.js');
            expect(config!.editionJs[2]).toBe('zebra.js');
        });

        it('should use explicit filenames from config.xml', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Explicit</title>
    <edition-js>
        <filename>main.js</filename>
        <filename>helper.js</filename>
    </edition-js>
    <edition-css>
        <filename>style.css</filename>
    </edition-css>
</idevice>`;

            const mockFs = createMockFs({
                '/idevices/explicit/edition/main.js': '// main',
                '/idevices/explicit/edition/helper.js': '// helper',
                '/idevices/explicit/edition/style.css': '/* css */',
            });

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'explicit',
                basePath: '/idevices/explicit',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.editionJs).toEqual(['main.js', 'helper.js']);
            expect(config!.editionCss).toEqual(['style.css']);
        });

        it('should fall back to default when empty edition-js tag', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Empty Tag</title>
    <edition-js></edition-js>
</idevice>`;

            const mockFs = createMockFs({
                '/idevices/empty/edition/empty.js': '// default',
            });

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'empty',
                basePath: '/idevices/empty',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.editionJs).toEqual(['empty.js']);
        });

        it('should return empty template content when file does not exist', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Missing Template</title>
    <edition-template-filename>missing.html</edition-template-filename>
</idevice>`;

            const mockFs = createMockFs({});

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'missing',
                basePath: '/idevices/missing',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.editionTemplateFilename).toBe('missing.html');
            expect(config!.editionTemplateContent).toBe('');
        });

        it('should handle readdirSync throwing an error', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Error</title>
</idevice>`;

            // When readdirSync throws, it falls back to default filename
            // The filter then checks if file exists, which returns true
            const mockFs: FileSystemReader = {
                existsSync: (path: string) =>
                    path.endsWith('.js') ||
                    path.endsWith('.css') ||
                    path.includes('edition') ||
                    path.includes('export'),
                readFileSync: () => '',
                readdirSync: () => {
                    throw new Error('Permission denied');
                },
            };

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'error',
                basePath: '/idevices/error',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            // Falls back to default filename ['error.js'] and it exists
            expect(config!.editionJs).toEqual(['error.js']);
            expect(config!.editionCss).toEqual(['error.css']);
        });

        it('should handle readFileSync throwing an error for templates', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Error Template</title>
    <edition-template-filename>error.html</edition-template-filename>
</idevice>`;

            const mockFs: FileSystemReader = {
                existsSync: () => true,
                readFileSync: () => {
                    throw new Error('Read error');
                },
                readdirSync: () => [],
            };

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'error-template',
                basePath: '/idevices/error-template',
                fs: mockFs,
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.editionTemplateContent).toBe('');
        });

        it('should use custom URL prefix', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Text</title>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'text',
                basePath: '/idevices/text',
                urlPrefix: '/v3.0/files/perm/idevices/base/text',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.url).toBe('/v3.0/files/perm/idevices/base/text');
        });

        it('should return null for invalid XML', () => {
            const xmlContent = 'not xml at all';

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'bad',
                basePath: '/idevices/bad',
                fs: createMockFs(),
                path: mockPath,
            });

            // Should still parse (regex-based), just return defaults
            expect(config).not.toBeNull();
            expect(config!.title).toBe('bad'); // Falls back to ideviceId
        });

        it('should use defaults for missing values', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
</idevice>`;

            const config = parseIdeviceConfig(xmlContent, {
                ideviceId: 'empty',
                basePath: '/idevices/empty',
                fs: createMockFs(),
                path: mockPath,
            });

            expect(config).not.toBeNull();
            expect(config!.id).toBe('empty');
            expect(config!.title).toBe('empty');
            expect(config!.cssClass).toBe('empty');
            expect(config!.category).toBe('Uncategorized');
            expect(config!.version).toBe('1.0');
            expect(config!.apiVersion).toBe('3.0');
            expect(config!.componentType).toBe('html');
            expect(config!.downloadable).toBe(false);
        });
    });

    describe('parseIdeviceConfigBasic', () => {
        it('should parse basic fields without file system access', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Simple iDevice</title>
    <category>Basic</category>
    <version>2.0</version>
    <author>Test Author</author>
</idevice>`;

            const config = parseIdeviceConfigBasic(xmlContent, 'simple');

            expect(config).not.toBeNull();
            expect(config!.id).toBe('simple');
            expect(config!.title).toBe('Simple iDevice');
            expect(config!.category).toBe('Basic');
            expect(config!.version).toBe('2.0');
            expect(config!.author).toBe('Test Author');
        });

        it('should not include file-dependent fields', () => {
            const xmlContent = `<?xml version="1.0"?>
<idevice>
    <title>Test</title>
    <edition-template-filename>template.html</edition-template-filename>
</idevice>`;

            const config = parseIdeviceConfigBasic(xmlContent, 'test');

            expect(config).not.toBeNull();
            // These fields require file system access, so shouldn't be in basic config
            expect(config!.editionJs).toBeUndefined();
            expect(config!.editionCss).toBeUndefined();
            expect(config!.editionTemplateContent).toBeUndefined();
        });
    });
});
