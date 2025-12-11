/**
 * Tests for HTML5 Export Service
 * Uses dependency injection pattern - no mock.module pollution
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ParsedOdeStructure, NormalizedPage } from '../xml/interfaces';
import { ExportFormat } from './interfaces';
import { createHtml5ExportService, type Html5ExportService, type Html5ExportDeps } from './html5-export';

// Test directories
const TEST_EXPORT_DIR = '/tmp/html5-export-test';
const TEST_SESSION_DIR = '/tmp/html5-export-test/session';
const TEST_PREVIEW_DIR = '/tmp/html5-export-test/preview';

// Mock session data
let mockSessions: Map<string, any>;
let mockZipCalls: any[];

// Create test structure
function createTestStructure(title: string = 'Test'): ParsedOdeStructure {
    return {
        meta: {
            title,
            author: 'Test Author',
            language: 'en',
            version: '3.0',
            theme: 'base',
        },
        pages: [
            {
                id: 'page0',
                title: 'Home',
                level: 0,
                parent_id: null,
                position: 0,
                components: [
                    {
                        id: 'comp1',
                        type: 'TextComponent',
                        order: 0,
                        content: '<p>Home content</p>',
                        data: null,
                    },
                ],
            },
            {
                id: 'page1',
                title: 'Chapter 1',
                level: 1,
                parent_id: 'page0',
                position: 0,
                components: [],
            },
        ],
        navigation: { page: {} },
        raw: {},
    };
}

// Create mock dependencies for testing
function createMockDeps(): Html5ExportDeps {
    return {
        fs: fs as any,
        path: path as any,
        createZip: async (sourceDir: string, outputPath: string, options: any) => {
            mockZipCalls.push({ sourceDir, outputPath, options });
            // Create a dummy zip file
            await fs.ensureDir(path.dirname(outputPath));
            await fs.writeFile(outputPath, 'PK dummy zip content');
        },
        getFilesDir: () => TEST_EXPORT_DIR,
        getTempPath: (subpath: string) => path.join(TEST_EXPORT_DIR, 'tmp', subpath),
        getPreviewExportPath: (sessionId: string, tempPath: string) => path.join(TEST_PREVIEW_DIR, sessionId, tempPath),
        getSession: (sessionId: string) => mockSessions.get(sessionId),
        preview: {
            generateRandomTempPath: () => 'random-temp-path/',
            extractSessionPathComponents: (sessionPath: string) => ({
                sessionId: 'test-session',
                sessionPath,
            }),
            buildPreviewUrl: (sessionId: string, tempPath: string, filename: string) =>
                `/preview/${sessionId}/${tempPath}/${filename}`,
        },
        htmlGenerator: {
            generateIndexHtml: (structure: ParsedOdeStructure, _options: unknown) => `
<!DOCTYPE html>
<html>
<head><title>${structure.meta.title}</title></head>
<body>
<h1>${structure.meta.title}</h1>
<nav>
${structure.pages.map(p => `<a href="${p.id}.html">${p.title}</a>`).join('\n')}
</nav>
</body>
</html>`,
            generatePageHtml: (page: NormalizedPage, _structure: ParsedOdeStructure, _options: unknown) => `
<!DOCTYPE html>
<html>
<head><title>${page.title}</title></head>
<body>
<h1>${page.title}</h1>
${page.components?.map(c => `<div>${c.content || ''}</div>`).join('\n') || ''}
</body>
</html>`,
        },
        getCwd: () => TEST_EXPORT_DIR,
    };
}

describe('HTML5 Export Service', () => {
    let service: Html5ExportService;

    beforeEach(async () => {
        // Reset stores
        mockSessions = new Map();
        mockZipCalls = [];

        // Setup test directories
        await fs.ensureDir(TEST_EXPORT_DIR);
        await fs.ensureDir(TEST_SESSION_DIR);
        await fs.ensureDir(TEST_PREVIEW_DIR);

        // Create test session directory with some files
        await fs.writeFile(path.join(TEST_SESSION_DIR, 'content.xml'), '<xml>content</xml>');
        await fs.writeFile(path.join(TEST_SESSION_DIR, 'image.jpg'), 'fake image data');
        await fs.ensureDir(path.join(TEST_SESSION_DIR, 'resources'));
        await fs.writeFile(path.join(TEST_SESSION_DIR, 'resources', 'test.css'), '.test {}');

        // Setup test session
        mockSessions.set('test-session', {
            sessionId: 'test-session',
            sessionPath: TEST_SESSION_DIR,
            structure: createTestStructure('Test Document'),
        });

        // Create service with mock dependencies
        service = createHtml5ExportService(createMockDeps());
    });

    afterEach(async () => {
        // Clean up
        await fs.remove(TEST_EXPORT_DIR);
    });

    describe('exportToHtml5', () => {
        describe('Preview Mode', () => {
            it('should export in preview mode', async () => {
                const result = await service.exportToHtml5('test-session', {
                    preview: true,
                    tempPath: 'preview-test/',
                });

                expect(result.success).toBe(true);
                expect(result.format).toBe(ExportFormat.HTML5);
                expect(result.previewUrl).toBeDefined();
                expect(result.previewUrl).toContain('preview');
            });

            it('should generate preview URL', async () => {
                const result = await service.exportToHtml5('test-session', {
                    preview: true,
                    tempPath: 'my-preview/',
                });

                expect(result.previewUrl).toContain('test-session');
                expect(result.previewUrl).toContain('index.html');
            });

            it('should use random temp path when not provided', async () => {
                const result = await service.exportToHtml5('test-session', {
                    preview: true,
                });

                expect(result.success).toBe(true);
            });

            it('should not create ZIP in preview mode', async () => {
                await service.exportToHtml5('test-session', { preview: true });

                expect(mockZipCalls.length).toBe(0);
            });

            it('should return export directory as filePath', async () => {
                const result = await service.exportToHtml5('test-session', {
                    preview: true,
                    tempPath: 'dir-test/',
                });

                expect(result.filePath).toBeDefined();
                expect(typeof result.filePath).toBe('string');
            });
        });

        describe('Download Mode', () => {
            it('should export in download mode', async () => {
                const result = await service.exportToHtml5('test-session', {
                    preview: false,
                });

                expect(result.success).toBe(true);
                expect(result.format).toBe(ExportFormat.HTML5);
                expect(result.filePath).toContain('.zip');
            });

            it('should create ZIP file', async () => {
                await service.exportToHtml5('test-session', { preview: false });

                expect(mockZipCalls.length).toBe(1);
                expect(mockZipCalls[0].outputPath).toContain('.zip');
            });

            it('should use custom compression level', async () => {
                await service.exportToHtml5('test-session', {
                    preview: false,
                    compressionLevel: 5,
                });

                expect(mockZipCalls[0].options.compressionLevel).toBe(5);
            });

            it('should use default compression level 9', async () => {
                await service.exportToHtml5('test-session', { preview: false });

                expect(mockZipCalls[0].options.compressionLevel).toBe(9);
            });

            it('should include file size in result', async () => {
                const result = await service.exportToHtml5('test-session', { preview: false });

                expect(typeof result.fileSize).toBe('number');
                expect(result.fileSize).toBeGreaterThan(0);
            });

            it('should generate filename from document title', async () => {
                const result = await service.exportToHtml5('test-session', { preview: false });

                expect(result.fileName).toContain('Test Document');
                expect(result.fileName).toContain('_html5.zip');
            });
        });

        describe('Error Handling', () => {
            it('should throw error for non-existent session', async () => {
                await expect(service.exportToHtml5('non-existent-session', {})).rejects.toThrow('Session not found');
            });

            it('should handle missing session structure gracefully', async () => {
                mockSessions.set('broken-session', {
                    sessionId: 'broken-session',
                    sessionPath: TEST_SESSION_DIR,
                    // No structure
                });

                // Should throw when accessing structure.pages
                await expect(service.exportToHtml5('broken-session', { preview: true })).rejects.toThrow();
            });
        });

        describe('Default Behavior', () => {
            it('should default to download mode', async () => {
                const result = await service.exportToHtml5('test-session', {});

                // No preview URL means download mode
                expect(result.previewUrl).toBeUndefined();
                expect(mockZipCalls.length).toBe(1);
            });
        });
    });

    describe('exportPreview', () => {
        it('should be convenience wrapper for preview mode', async () => {
            const result = await service.exportPreview('test-session', 'test-path/');

            expect(result.success).toBe(true);
            expect(result.previewUrl).toBeDefined();
        });

        it('should use default temp path when not provided', async () => {
            const result = await service.exportPreview('test-session');

            expect(result.success).toBe(true);
        });

        it('should not create ZIP', async () => {
            await service.exportPreview('test-session');

            expect(mockZipCalls.length).toBe(0);
        });
    });

    describe('exportDownload', () => {
        it('should be convenience wrapper for download mode', async () => {
            const result = await service.exportDownload('test-session');

            expect(result.success).toBe(true);
            expect(result.filePath).toContain('.zip');
        });

        it('should use custom compression level', async () => {
            await service.exportDownload('test-session', 3);

            expect(mockZipCalls[0].options.compressionLevel).toBe(3);
        });

        it('should use default compression level 9', async () => {
            await service.exportDownload('test-session');

            expect(mockZipCalls[0].options.compressionLevel).toBe(9);
        });
    });

    describe('HTML Generation', () => {
        it('should generate index.html', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'html-gen-test/',
            });

            const exportDir = result.filePath;
            const indexPath = path.join(exportDir, 'index.html');

            expect(await fs.pathExists(indexPath)).toBe(true);

            const content = await fs.readFile(indexPath, 'utf-8');
            expect(content).toContain('<!DOCTYPE html>');
            expect(content).toContain('Test Document');
        });

        it('should generate page HTML files', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'page-gen-test/',
            });

            const exportDir = result.filePath;

            // Check page files exist
            expect(await fs.pathExists(path.join(exportDir, 'page0.html'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'page1.html'))).toBe(true);
        });

        it('should include page content in generated HTML', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'content-test/',
            });

            const exportDir = result.filePath;
            const pageContent = await fs.readFile(path.join(exportDir, 'page0.html'), 'utf-8');

            expect(pageContent).toContain('Home');
        });
    });

    describe('Resource Copying', () => {
        it('should copy session resources', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'resource-test/',
            });

            const exportDir = result.filePath;

            // Should copy image.jpg
            expect(await fs.pathExists(path.join(exportDir, 'image.jpg'))).toBe(true);

            // Should copy resources directory
            expect(await fs.pathExists(path.join(exportDir, 'resources', 'test.css'))).toBe(true);
        });

        it('should not copy content.xml', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'no-xml-test/',
            });

            const exportDir = result.filePath;

            // content.xml should not be copied
            expect(await fs.pathExists(path.join(exportDir, 'content.xml'))).toBe(false);
        });

        it('should skip export and preview directories', async () => {
            // Create export and preview dirs in session
            await fs.ensureDir(path.join(TEST_SESSION_DIR, 'export'));
            await fs.ensureDir(path.join(TEST_SESSION_DIR, 'preview'));
            await fs.writeFile(path.join(TEST_SESSION_DIR, 'export', 'test.txt'), 'test');
            await fs.writeFile(path.join(TEST_SESSION_DIR, 'preview', 'test.txt'), 'test');

            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'skip-test/',
            });

            const exportDir = result.filePath;

            // export and preview directories should not be copied
            expect(await fs.pathExists(path.join(exportDir, 'export'))).toBe(false);
            expect(await fs.pathExists(path.join(exportDir, 'preview'))).toBe(false);
        });
    });

    describe('Basic Assets Creation', () => {
        it('should create base.css', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'assets-test/',
            });

            const exportDir = result.filePath;
            expect(await fs.pathExists(path.join(exportDir, 'base.css'))).toBe(true);
        });

        it('should create content.css', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'css-test/',
            });

            const exportDir = result.filePath;
            expect(await fs.pathExists(path.join(exportDir, 'content.css'))).toBe(true);
        });

        it('should create JavaScript placeholders', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'js-test/',
            });

            const exportDir = result.filePath;

            expect(await fs.pathExists(path.join(exportDir, 'exe_jquery.js'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'common_i18n.js'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'common.js'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, '_style_js.js'))).toBe(true);
        });
    });

    describe('Theme Handling', () => {
        it('should create theme directory', async () => {
            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'theme-dir-test/',
            });

            const exportDir = result.filePath;
            expect(await fs.pathExists(path.join(exportDir, 'theme'))).toBe(true);
        });

        it('should use theme from structure meta', async () => {
            mockSessions.set('themed-session', {
                sessionId: 'themed-session',
                sessionPath: TEST_SESSION_DIR,
                structure: {
                    meta: {
                        title: 'Themed',
                        theme: 'custom-theme',
                    },
                    pages: [
                        {
                            id: 'page0',
                            title: 'Home',
                            level: 0,
                            parent_id: null,
                            position: 0,
                            components: [],
                        },
                    ],
                    navigation: { page: {} },
                    raw: {},
                },
            });

            // Should not throw even with non-existent theme
            const result = await service.exportToHtml5('themed-session', {
                preview: true,
                tempPath: 'custom-theme-test/',
            });

            expect(result.success).toBe(true);
        });

        it('should default to base theme', async () => {
            mockSessions.set('no-theme-session', {
                sessionId: 'no-theme-session',
                sessionPath: TEST_SESSION_DIR,
                structure: {
                    meta: {
                        title: 'No Theme',
                        // No theme specified
                    },
                    pages: [
                        {
                            id: 'page0',
                            title: 'Home',
                            level: 0,
                            parent_id: null,
                            position: 0,
                            components: [],
                        },
                    ],
                    navigation: { page: {} },
                    raw: {},
                },
            });

            const result = await service.exportToHtml5('no-theme-session', {
                preview: true,
                tempPath: 'default-theme-test/',
            });

            expect(result.success).toBe(true);
        });

        it('should copy theme files when they exist', async () => {
            // Create theme files in the expected location
            const themeDir = path.join(TEST_EXPORT_DIR, 'public', 'files', 'perm', 'themes', 'base', 'base');
            await fs.ensureDir(themeDir);
            await fs.writeFile(path.join(themeDir, 'style.css'), '.theme-style { color: red; }');
            await fs.writeFile(path.join(themeDir, 'style.js'), '// theme javascript');
            await fs.writeFile(path.join(themeDir, 'config.xml'), '<config><name>base</name></config>');
            await fs.ensureDir(path.join(themeDir, 'icons'));
            await fs.writeFile(path.join(themeDir, 'icons', 'icon.png'), 'fake icon data');
            await fs.ensureDir(path.join(themeDir, 'img'));
            await fs.writeFile(path.join(themeDir, 'img', 'bg.png'), 'fake bg image');

            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'theme-copy-test/',
            });

            const exportDir = result.filePath;

            // Verify theme files were copied with renamed filenames
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'content.css'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'default.js'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'config.xml'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'icons'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'img'))).toBe(true);

            // Verify content was copied correctly
            const cssContent = await fs.readFile(path.join(exportDir, 'theme', 'content.css'), 'utf-8');
            expect(cssContent).toBe('.theme-style { color: red; }');

            const jsContent = await fs.readFile(path.join(exportDir, 'theme', 'default.js'), 'utf-8');
            expect(jsContent).toBe('// theme javascript');
        });

        it('should copy theme files partially when some are missing', async () => {
            // Create theme directory with only some files
            const themeDir = path.join(TEST_EXPORT_DIR, 'public', 'files', 'perm', 'themes', 'base', 'base');
            await fs.ensureDir(themeDir);
            await fs.writeFile(path.join(themeDir, 'style.css'), '.partial-theme {}');
            // Don't create style.js, config.xml, icons, img

            const result = await service.exportToHtml5('test-session', {
                preview: true,
                tempPath: 'theme-partial-test/',
            });

            const exportDir = result.filePath;

            // Only style.css should be copied (as content.css)
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'content.css'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'default.js'))).toBe(false);
            expect(await fs.pathExists(path.join(exportDir, 'theme', 'config.xml'))).toBe(false);
        });
    });

    describe('Multiple Pages Export', () => {
        it('should generate HTML for all pages', async () => {
            mockSessions.set('multi-page-session', {
                sessionId: 'multi-page-session',
                sessionPath: TEST_SESSION_DIR,
                structure: {
                    meta: { title: 'Multi Page' },
                    pages: [
                        { id: 'p1', title: 'Page 1', level: 0, parent_id: null, position: 0 },
                        { id: 'p2', title: 'Page 2', level: 0, parent_id: null, position: 1 },
                        { id: 'p3', title: 'Page 3', level: 0, parent_id: null, position: 2 },
                    ],
                    navigation: { page: {} },
                    raw: {},
                },
            });

            const result = await service.exportToHtml5('multi-page-session', {
                preview: true,
                tempPath: 'multi-page-test/',
            });

            const exportDir = result.filePath;

            expect(await fs.pathExists(path.join(exportDir, 'p1.html'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'p2.html'))).toBe(true);
            expect(await fs.pathExists(path.join(exportDir, 'p3.html'))).toBe(true);
        });
    });

    describe('Export Result Format', () => {
        it('should return correct format enum', async () => {
            const result = await service.exportToHtml5('test-session', { preview: true });

            expect(result.format).toBe(ExportFormat.HTML5);
        });

        it('should return success flag', async () => {
            const result = await service.exportToHtml5('test-session', { preview: true });

            expect(result.success).toBe(true);
        });

        it('should return fileName for download', async () => {
            const result = await service.exportToHtml5('test-session', { preview: false });

            expect(result.fileName).toBeDefined();
            expect(result.fileName.length).toBeGreaterThan(0);
        });
    });

    describe('Dependency Injection', () => {
        it('should use injected dependencies', async () => {
            let getSessionCalled = false;
            const customDeps = createMockDeps();
            customDeps.getSession = (sessionId: string) => {
                getSessionCalled = true;
                return mockSessions.get(sessionId);
            };

            const customService = createHtml5ExportService(customDeps);
            await customService.exportToHtml5('test-session', { preview: true });

            expect(getSessionCalled).toBe(true);
        });

        it('should use default dependencies when none provided', () => {
            // This just tests that the factory works with no deps
            const defaultService = createHtml5ExportService();
            expect(defaultService).toBeDefined();
            expect(typeof defaultService.exportToHtml5).toBe('function');
        });
    });
});
