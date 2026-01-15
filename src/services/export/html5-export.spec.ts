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
        getTempPath: (subpath: string) => path.join(TEST_EXPORT_DIR, 'tmp', subpath),
        getSession: (sessionId: string) => mockSessions.get(sessionId),
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
        describe('Download Mode', () => {
            it('should export in download mode', async () => {
                const result = await service.exportToHtml5('test-session', {});

                expect(result.success).toBe(true);
                expect(result.format).toBe(ExportFormat.HTML5);
                expect(result.filePath).toContain('.zip');
            });

            it('should create ZIP file', async () => {
                await service.exportToHtml5('test-session', {});

                expect(mockZipCalls.length).toBe(1);
                expect(mockZipCalls[0].outputPath).toContain('.zip');
            });

            it('should use custom compression level', async () => {
                await service.exportToHtml5('test-session', {
                    compressionLevel: 5,
                });

                expect(mockZipCalls[0].options.compressionLevel).toBe(5);
            });

            it('should use default compression level 9', async () => {
                await service.exportToHtml5('test-session', {});

                expect(mockZipCalls[0].options.compressionLevel).toBe(9);
            });

            it('should include file size in result', async () => {
                const result = await service.exportToHtml5('test-session', {});

                expect(typeof result.fileSize).toBe('number');
                expect(result.fileSize).toBeGreaterThan(0);
            });

            it('should generate filename from document title', async () => {
                const result = await service.exportToHtml5('test-session', {});

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
                await expect(service.exportToHtml5('broken-session', {})).rejects.toThrow();
            });
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

    describe('Export Result Format', () => {
        it('should return correct format enum', async () => {
            const result = await service.exportToHtml5('test-session', {});

            expect(result.format).toBe(ExportFormat.HTML5);
        });

        it('should return success flag', async () => {
            const result = await service.exportToHtml5('test-session', {});

            expect(result.success).toBe(true);
        });

        it('should return fileName for download', async () => {
            const result = await service.exportToHtml5('test-session', {});

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
            await customService.exportToHtml5('test-session', {});

            expect(getSessionCalled).toBe(true);
        });

        it('should use default dependencies when none provided', () => {
            // This just tests that the factory works with no deps
            const defaultService = createHtml5ExportService();
            expect(defaultService).toBeDefined();
            expect(typeof defaultService.exportToHtml5).toBe('function');
        });
    });

    describe('Theme Copying', () => {
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

            const result = await service.exportToHtml5('test-session', {});

            expect(result.success).toBe(true);
            // ZIP was created (we can't easily verify contents with mock)
            expect(mockZipCalls.length).toBe(1);
        });

        it('should copy theme files partially when some are missing', async () => {
            // Create theme directory with only some files
            const themeDir = path.join(TEST_EXPORT_DIR, 'public', 'files', 'perm', 'themes', 'base', 'base');
            await fs.ensureDir(themeDir);
            await fs.writeFile(path.join(themeDir, 'style.css'), '.partial-theme {}');
            // Don't create style.js, config.xml, icons, img

            const result = await service.exportToHtml5('test-session', {});

            expect(result.success).toBe(true);
        });
    });
});
