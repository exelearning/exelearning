/**
 * Tests for Export Routes
 * Uses Dependency Injection pattern - no mock.module needed
 *
 * Tests the unified export system that uses src/shared/export/ exporters
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Elysia } from 'elysia';

import {
    createExportRoutes,
    convertYjsStructureToParsed,
    type ExportDependencies,
    type ExportSessionManagerDeps,
    type ExportFileHelperDeps,
    type ExportSystemDeps,
} from './export';
import type { YjsExportStructure } from './types/request-payloads';

const testDir = path.join(process.cwd(), 'test', 'temp', 'export-test');
const testSessionId = '20250116testexport';

// Mock session data store
let mockSessions: Map<string, any>;

// Mock ParsedOdeStructure for testing
const mockParsedStructure = {
    meta: {
        title: 'Test Project',
        author: 'Test Author',
        language: 'en',
        theme: 'base',
    },
    pages: [
        {
            id: 'page-1',
            title: 'Page 1',
            components: [
                {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    content: '<p>Test content</p>',
                    order: 0,
                    position: 0,
                },
            ],
            level: 0,
            parent_id: null,
            position: 0,
        },
    ],
    navigation: null,
    raw: null,
};

// Create mock session manager functions
function createMockSessionManager(): ExportSessionManagerDeps {
    return {
        getSession: (sessionId: string) => mockSessions.get(sessionId),
    };
}

// Create mock file helper functions
function createMockFileHelper(): ExportFileHelperDeps {
    return {
        getOdeSessionTempDir: (sessionId: string) => path.join(testDir, 'tmp', sessionId),
        getOdeSessionDistDir: (sessionId: string) => path.join(testDir, 'dist', sessionId),
        fileExists: async (filePath: string) => fs.pathExists(filePath),
        readFile: async (filePath: string) => fs.readFile(filePath),
    };
}

// Create mock exporter class
function createMockExporter() {
    return class MockExporter {
        export = async () => ({
            success: true,
            data: new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // PK header (valid ZIP)
            filename: 'test-export.zip',
        });
    };
}

// Create mock export system with all exporters mocked
function createMockExportSystem(): ExportSystemDeps {
    const MockExporter = createMockExporter();

    return {
        ElpDocumentAdapter: class MockElpDocumentAdapter {
            getMetadata = () => mockParsedStructure.meta;
            getNavigation = () => mockParsedStructure.pages;
            static fromElpFile = async () => new MockElpDocumentAdapter({}, '');
        } as any,
        FileSystemResourceProvider: class MockResourceProvider {
            fetchTheme = async () => new Map();
            fetchBaseLibraries = async () => new Map();
            fetchLibraryFiles = async () => new Map();
            fetchIdeviceResources = async () => new Map();
        } as any,
        FileSystemAssetProvider: class MockAssetProvider {
            getProjectAssets = async () => [];
            getAsset = async () => null;
        } as any,
        DatabaseAssetProvider: class MockDatabaseAssetProvider {
            getProjectAssets = async () => [];
            getAsset = async () => null;
        } as any,
        CombinedAssetProvider: class MockCombinedAssetProvider {
            getProjectAssets = async () => [];
            getAsset = async () => null;
        } as any,
        FflateZipProvider: class MockZipProvider {
            createZip = () => ({
                addFile: () => {},
                addFiles: () => {},
                generate: async () => new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
            });
        } as any,
        Html5Exporter: MockExporter as any,
        PageExporter: MockExporter as any,
        Scorm12Exporter: MockExporter as any,
        Scorm2004Exporter: MockExporter as any,
        ImsExporter: MockExporter as any,
        Epub3Exporter: MockExporter as any,
        ElpxExporter: MockExporter as any,
        PageElpxExporter: MockExporter as any,
        YjsDocumentAdapter: class MockYjsAdapter {} as any,
        ServerYjsDocumentWrapper: class MockServerWrapper {} as any,
    };
}

// Create mock dependencies
function createMockDependencies(): ExportDependencies {
    return {
        fs: fs,
        path: path,
        sessionManager: createMockSessionManager(),
        fileHelper: createMockFileHelper(),
        exportSystem: createMockExportSystem(),
        publicDir: path.join(testDir, 'public'),
    };
}

describe('Export Routes', () => {
    let app: Elysia;
    let mockDeps: ExportDependencies;

    beforeEach(async () => {
        mockSessions = new Map();

        // Create mock dependencies and app
        mockDeps = createMockDependencies();
        app = new Elysia().use(createExportRoutes(mockDeps));

        // Create test directory structure
        await fs.ensureDir(path.join(testDir, 'tmp', testSessionId));
        await fs.ensureDir(path.join(testDir, 'dist', testSessionId));
        await fs.ensureDir(path.join(testDir, 'public'));

        // Create test session with structure (for unified export system)
        mockSessions.set(testSessionId, {
            id: testSessionId,
            fileName: 'test-project.elp',
            projectId: 1,
            structure: mockParsedStructure, // Required for unified export
        });

        // Create test content
        await fs.writeFile(path.join(testDir, 'tmp', testSessionId, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('GET /api/export/formats', () => {
        it('should return list of export formats', async () => {
            const res = await app.handle(new Request('http://localhost/api/export/formats'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.formats).toBeDefined();
            expect(Array.isArray(body.formats)).toBe(true);
        });

        it('should include HTML5 format', async () => {
            const res = await app.handle(new Request('http://localhost/api/export/formats'));

            const body = await res.json();
            const html5 = body.formats.find((f: any) => f.id === 'html5');
            expect(html5).toBeDefined();
            expect(html5.name).toBe('HTML5 Website');
            expect(html5.extension).toBe('zip');
        });

        it('should include SCORM formats', async () => {
            const res = await app.handle(new Request('http://localhost/api/export/formats'));

            const body = await res.json();
            const scorm12 = body.formats.find((f: any) => f.id === 'scorm12');
            const scorm2004 = body.formats.find((f: any) => f.id === 'scorm2004');

            expect(scorm12).toBeDefined();
            expect(scorm12.name).toContain('SCORM 1.2');
            expect(scorm2004).toBeDefined();
            expect(scorm2004.name).toContain('SCORM 2004');
        });

        it('should include EPUB3 format', async () => {
            const res = await app.handle(new Request('http://localhost/api/export/formats'));

            const body = await res.json();
            const epub3 = body.formats.find((f: any) => f.id === 'epub3');

            expect(epub3).toBeDefined();
            expect(epub3.extension).toBe('epub');
            expect(epub3.mimeType).toBe('application/epub+zip');
        });

        it('should include IMS Content Package format', async () => {
            const res = await app.handle(new Request('http://localhost/api/export/formats'));

            const body = await res.json();
            const ims = body.formats.find((f: any) => f.id === 'ims');

            expect(ims).toBeDefined();
            expect(ims.name).toContain('IMS');
        });

        it('should include ELP format', async () => {
            const res = await app.handle(new Request('http://localhost/api/export/formats'));

            const body = await res.json();
            const elp = body.formats.find((f: any) => f.id === 'elp');

            expect(elp).toBeDefined();
            expect(elp.extension).toBe('elp');
        });

        it('should include required properties for each format', async () => {
            const res = await app.handle(new Request('http://localhost/api/export/formats'));

            const body = await res.json();
            for (const format of body.formats) {
                expect(format.id).toBeDefined();
                expect(format.name).toBeDefined();
                expect(format.extension).toBeDefined();
                expect(format.mimeType).toBeDefined();
            }
        });
    });

    describe('GET /api/export/:odeSessionId/:exportType/download', () => {
        it('should return 404 for non-existent session', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/export/non-existent-session/html5/download'),
            );

            expect(res.status).toBe(404);
        });

        it('should return 400 for invalid export type', async () => {
            const res = await app.handle(
                new Request(`http://localhost/api/export/${testSessionId}/invalid-type/download`),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error).toContain('Invalid export type');
            expect(body.validTypes).toBeDefined();
        });

        it('should return ZIP file for HTML5 export', async () => {
            const res = await app.handle(new Request(`http://localhost/api/export/${testSessionId}/html5/download`));

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toBe('application/zip');
            expect(res.headers.get('content-disposition')).toContain('attachment');
            expect(res.headers.get('content-disposition')).toContain('html5.zip');
        });

        it('should include project name in filename', async () => {
            const res = await app.handle(new Request(`http://localhost/api/export/${testSessionId}/html5/download`));

            const disposition = res.headers.get('content-disposition');
            expect(disposition).toContain('test-project');
        });

        it('should include content-length header', async () => {
            const res = await app.handle(new Request(`http://localhost/api/export/${testSessionId}/html5/download`));

            expect(res.headers.get('content-length')).toBeDefined();
        });
    });

    describe('POST /api/export/:odeSessionId/:exportType/download', () => {
        it('should return 404 for non-existent session', async () => {
            const res = await app.handle(
                new Request('http://localhost/api/export/non-existent-session/html5/download', {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(404);
        });

        it('should return 400 for invalid export type', async () => {
            const res = await app.handle(
                new Request(`http://localhost/api/export/${testSessionId}/invalid/download`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(400);
        });

        it('should accept export options', async () => {
            const res = await app.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`, {
                    method: 'POST',
                    body: JSON.stringify({ includeNavigation: true }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(200);
        });

        it('should return same format as GET', async () => {
            const getRes = await app.handle(
                new Request(`http://localhost/api/export/${testSessionId}/scorm12/download`),
            );

            const postRes = await app.handle(
                new Request(`http://localhost/api/export/${testSessionId}/scorm12/download`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(postRes.headers.get('content-type')).toBe(getRes.headers.get('content-type'));
        });
    });

    describe('export type validation', () => {
        // Types fully implemented in unified export system
        // All export types are now implemented in the unified export system
        const implementedTypes = ['html5', 'html5-sp', 'scorm12', 'scorm2004', 'ims', 'epub3', 'elp'];

        for (const type of implementedTypes) {
            it(`should accept and export type: ${type}`, async () => {
                const res = await app.handle(
                    new Request(`http://localhost/api/export/${testSessionId}/${type}/download`),
                );

                expect(res.status).toBe(200);
            });
        }

        it('should reject unknown export types', async () => {
            const res = await app.handle(new Request(`http://localhost/api/export/${testSessionId}/pdf/download`));

            expect(res.status).toBe(400);
        });
    });

    describe('export error handling', () => {
        it('should return 500 when export fails (GET)', async () => {
            // Create deps with failing exporter
            const failingDeps = createMockDependencies();
            failingDeps.exportSystem.Html5Exporter = class FailingExporter {
                export = async () => ({ success: false, error: 'Export failed: test error' });
            } as any;

            const failingApp = new Elysia().use(createExportRoutes(failingDeps));

            const res = await failingApp.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Export failed');
        });

        it('should return 500 when export fails (POST)', async () => {
            // Create deps with failing exporter
            const failingDeps = createMockDependencies();
            failingDeps.exportSystem.Html5Exporter = class FailingExporter {
                export = async () => ({ success: false, error: 'Export failed: test error' });
            } as any;

            const failingApp = new Elysia().use(createExportRoutes(failingDeps));

            const res = await failingApp.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Export failed');
        });

        it('should catch and return error when export throws (GET)', async () => {
            // Create deps with throwing exporter
            const throwingDeps = createMockDependencies();
            throwingDeps.exportSystem.Html5Exporter = class ThrowingExporter {
                export = async () => {
                    throw new Error('Unexpected export error');
                };
            } as any;

            const throwingApp = new Elysia().use(createExportRoutes(throwingDeps));

            const res = await throwingApp.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Unexpected export error');
        });

        it('should catch and return error when export throws (POST)', async () => {
            // Create deps with throwing exporter
            const throwingDeps = createMockDependencies();
            throwingDeps.exportSystem.Html5Exporter = class ThrowingExporter {
                export = async () => {
                    throw new Error('Unexpected export error');
                };
            } as any;

            const throwingApp = new Elysia().use(createExportRoutes(throwingDeps));

            const res = await throwingApp.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Unexpected export error');
        });

        it('should handle non-Error throws gracefully', async () => {
            // Create deps with exporter that throws a string
            const throwingDeps = createMockDependencies();
            throwingDeps.exportSystem.Html5Exporter = class StringThrowingExporter {
                export = async () => {
                    throw 'String error message';
                };
            } as any;

            const throwingApp = new Elysia().use(createExportRoutes(throwingDeps));

            const res = await throwingApp.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toBe('String error message');
        });

        it('should return error when session has no structure and no content.xml', async () => {
            // Create session without structure
            const noContentSessionId = 'no-content-session';
            mockSessions.set(noContentSessionId, {
                id: noContentSessionId,
                fileName: 'test.elp',
                // No structure and no odeId
            });
            // Create empty temp dir (no content.xml)
            await fs.ensureDir(path.join(testDir, 'tmp', noContentSessionId));
            await fs.ensureDir(path.join(testDir, 'dist', noContentSessionId));

            const res = await app.handle(
                new Request(`http://localhost/api/export/${noContentSessionId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('No project structure');
        });

        it('should handle readFile error in GET download route', async () => {
            // Create deps where export succeeds but readFile throws
            const readFailDeps = createMockDependencies();
            readFailDeps.fileHelper.readFile = async () => {
                throw new Error('Failed to read file');
            };

            const readFailApp = new Elysia().use(createExportRoutes(readFailDeps));

            const res = await readFailApp.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Failed to read file');
        });

        it('should handle readFile error in POST download route', async () => {
            // Create deps where export succeeds but readFile throws
            const readFailDeps = createMockDependencies();
            readFailDeps.fileHelper.readFile = async () => {
                throw new Error('Failed to read file');
            };

            const readFailApp = new Elysia().use(createExportRoutes(readFailDeps));

            const res = await readFailApp.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`, {
                    method: 'POST',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('Failed to read file');
        });

        it('should use session structure when odeId lookup fails', async () => {
            // Create session with odeId but structure as fallback
            const odeIdSessionId = 'odeid-session';
            mockSessions.set(odeIdSessionId, {
                id: odeIdSessionId,
                fileName: 'test.elp',
                odeId: 'test-uuid-12345',
                structure: mockParsedStructure, // Fallback structure
            });
            await fs.ensureDir(path.join(testDir, 'tmp', odeIdSessionId));
            await fs.ensureDir(path.join(testDir, 'dist', odeIdSessionId));

            // The findProjectByUuid will return null (no project found)
            // This should trigger the fallback to session.structure
            const res = await app.handle(new Request(`http://localhost/api/export/${odeIdSessionId}/html5/download`));

            expect(res.status).toBe(200);
        });

        it('should return error when session with odeId has no fallback structure', async () => {
            // Create session with odeId but no structure
            const noFallbackSessionId = 'no-fallback-session';
            mockSessions.set(noFallbackSessionId, {
                id: noFallbackSessionId,
                fileName: 'test.elp',
                odeId: 'test-uuid-no-fallback',
                // No structure field
            });
            await fs.ensureDir(path.join(testDir, 'tmp', noFallbackSessionId));
            await fs.ensureDir(path.join(testDir, 'dist', noFallbackSessionId));

            // The findProjectByUuid will return null (no project found)
            // And there's no session.structure to fall back to
            const res = await app.handle(
                new Request(`http://localhost/api/export/${noFallbackSessionId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error).toContain('No project structure');
        });
    });

    describe('unified export system integration', () => {
        it('should use ElpDocumentAdapter from shared export system', async () => {
            // This test verifies that the route uses the injected export system
            const res = await app.handle(new Request(`http://localhost/api/export/${testSessionId}/html5/download`));

            expect(res.status).toBe(200);
            // The mock exporter returns a valid ZIP header
            const buffer = await res.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            expect(bytes[0]).toBe(0x50); // 'P'
            expect(bytes[1]).toBe(0x4b); // 'K'
        });

        it('should pass session structure to ElpDocumentAdapter', async () => {
            // Session without structure should still work (fallback to fromElpFile)
            const noStructureSessionId = 'no-structure-session';
            mockSessions.set(noStructureSessionId, {
                id: noStructureSessionId,
                fileName: 'test.elp',
                // No structure field - will trigger fallback
            });

            // Create temp dir and content.xml for fallback path
            const noStructureTempDir = path.join(testDir, 'tmp', noStructureSessionId);
            await fs.ensureDir(noStructureTempDir);
            await fs.writeFile(path.join(noStructureTempDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            await fs.ensureDir(path.join(testDir, 'dist', noStructureSessionId));

            const res = await app.handle(
                new Request(`http://localhost/api/export/${noStructureSessionId}/html5/download`),
            );

            // Should still return success because mock adapter handles it
            expect(res.status).toBe(200);
        });
    });

    describe('POST with Yjs structure', () => {
        it('should accept Yjs structure from client', async () => {
            const yjsStructure: YjsExportStructure = {
                meta: {
                    title: 'Test Yjs Project',
                    author: 'Test Author',
                    language: 'es',
                    theme: 'base',
                },
                pages: [
                    {
                        id: 'page-1',
                        pageName: 'Primera Página',
                        blocks: [
                            {
                                id: 'block-1',
                                blockName: 'Introducción',
                                components: [
                                    {
                                        id: 'comp-1',
                                        ideviceType: 'FreeTextIdevice',
                                        htmlContent: '<p>Test content</p>',
                                    },
                                ],
                            },
                        ],
                    },
                ],
                navigation: [{ id: 'nav-1', navText: 'Primera Página' }],
            };

            const res = await app.handle(
                new Request(`http://localhost/api/export/${testSessionId}/html5/download`, {
                    method: 'POST',
                    body: JSON.stringify({ structure: yjsStructure }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(200);
        });
    });
});

describe('convertYjsStructureToParsed', () => {
    it('should convert basic meta fields', () => {
        const yjs: YjsExportStructure = {
            meta: {
                title: 'My Project',
                author: 'John Doe',
                description: 'A test project',
                language: 'es',
                license: 'CC BY',
                theme: 'custom-theme',
            },
            pages: [],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.meta.title).toBe('My Project');
        expect(result.meta.author).toBe('John Doe');
        expect(result.meta.description).toBe('A test project');
        expect(result.meta.language).toBe('es');
        expect(result.meta.license).toBe('CC BY');
        expect(result.meta.theme).toBe('custom-theme');
    });

    it('should use default values for missing meta fields', () => {
        const yjs: YjsExportStructure = {
            meta: {},
            pages: [],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.meta.title).toBe('Untitled');
        expect(result.meta.author).toBe('');
        expect(result.meta.language).toBe('en');
        expect(result.meta.theme).toBe('base');
    });

    it('should flatten blocks into components with blockName', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            blockName: 'Block One',
                            components: [
                                {
                                    id: 'comp-1',
                                    ideviceType: 'FreeTextIdevice',
                                    htmlContent: '<p>Content 1</p>',
                                },
                                {
                                    id: 'comp-2',
                                    ideviceType: 'TextIdevice',
                                    htmlContent: '<p>Content 2</p>',
                                },
                            ],
                        },
                        {
                            id: 'block-2',
                            blockName: 'Block Two',
                            components: [
                                {
                                    id: 'comp-3',
                                    ideviceType: 'GalleryIdevice',
                                    properties: { images: [] },
                                },
                            ],
                        },
                    ],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages).toHaveLength(1);
        expect(result.pages[0].components).toHaveLength(3);

        // Check blockName is preserved
        expect(result.pages[0].components[0].blockName).toBe('Block One');
        expect(result.pages[0].components[1].blockName).toBe('Block One');
        expect(result.pages[0].components[2].blockName).toBe('Block Two');

        // Check order is incremental
        expect(result.pages[0].components[0].order).toBe(0);
        expect(result.pages[0].components[1].order).toBe(1);
        expect(result.pages[0].components[2].order).toBe(2);
    });

    it('should preserve component properties', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'comp-1',
                                    ideviceType: 'QuizIdevice',
                                    htmlContent: '',
                                    properties: {
                                        questions: ['Q1', 'Q2'],
                                        answers: [
                                            [1, 2],
                                            [3, 4],
                                        ],
                                        passScore: 80,
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);
        const comp = result.pages[0].components[0];

        expect(comp.properties).toEqual({
            questions: ['Q1', 'Q2'],
            answers: [
                [1, 2],
                [3, 4],
            ],
            passScore: 80,
        });
    });

    it('should build page hierarchy from parentId', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                { id: 'page-1', pageName: 'Root Page', parentId: null, blocks: [] },
                { id: 'page-2', pageName: 'Child 1', parentId: 'page-1', blocks: [] },
                { id: 'page-3', pageName: 'Child 2', parentId: 'page-1', blocks: [] },
                { id: 'page-4', pageName: 'Grandchild', parentId: 'page-2', blocks: [] },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        // Only root pages at top level
        expect(result.pages).toHaveLength(1);
        expect(result.pages[0].title).toBe('Root Page');

        // Children nested
        expect(result.pages[0].children).toHaveLength(2);
        expect(result.pages[0].children[0].title).toBe('Child 1');
        expect(result.pages[0].children[1].title).toBe('Child 2');

        // Grandchild nested in Child 1
        expect(result.pages[0].children[0].children).toHaveLength(1);
        expect(result.pages[0].children[0].children[0].title).toBe('Grandchild');
    });

    it('should handle multiple root pages', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                { id: 'page-1', pageName: 'Root 1', blocks: [] },
                { id: 'page-2', pageName: 'Root 2', blocks: [] },
                { id: 'page-3', pageName: 'Root 3', blocks: [] },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages).toHaveLength(3);
        expect(result.pages[0].title).toBe('Root 1');
        expect(result.pages[1].title).toBe('Root 2');
        expect(result.pages[2].title).toBe('Root 3');
    });

    it('should convert navigation structure', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [],
            navigation: [
                { id: 'nav-1', navText: 'Home' },
                { id: 'nav-2', navText: 'About', parentId: 'nav-1' },
                { id: 'nav-3', navText: 'Contact' },
            ],
        };

        const result = convertYjsStructureToParsed(yjs);

        // navigation is an object with page property
        const pages = Array.isArray(result.navigation.page) ? result.navigation.page : [result.navigation.page];
        expect(pages).toHaveLength(3);

        // Check properties on the page objects
        expect(pages[0].navText).toBe('Home');
        expect(pages[0].position).toBe(0);
        expect(pages[1].navText).toBe('About');
        expect((pages[1] as any).parent_id).toBe('nav-1');
        expect(pages[2].navText).toBe('Contact');
        expect((pages[2] as any).parent_id).toBeUndefined();
    });

    it('should handle empty blocks array', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [{ id: 'page-1', pageName: 'Empty Page', blocks: [] }],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages[0].components).toHaveLength(0);
    });

    it('should handle undefined blocks', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [{ id: 'page-1', pageName: 'No Blocks Page' } as any],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages[0].components).toHaveLength(0);
    });

    it('should handle empty components array in block', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page',
                    blocks: [{ id: 'block-1', blockName: 'Empty Block', components: [] }],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages[0].components).toHaveLength(0);
    });

    it('should use default type for missing ideviceType', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                { id: 'comp-1' } as any, // Missing ideviceType
                            ],
                        },
                    ],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages[0].components[0].type).toBe('FreeTextIdevice');
    });

    it('should include exelearning_version and timestamps in meta', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.meta.exelearning_version).toBe('4.0');
        expect(result.meta.created).toBeDefined();
        expect(result.meta.modified).toBeDefined();
    });

    it('should handle block without blockName', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page',
                    blocks: [
                        {
                            id: 'block-1',
                            // No blockName
                            components: [{ id: 'comp-1', ideviceType: 'TextIdevice' }],
                        },
                    ],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages[0].components[0].blockName).toBe('');
    });

    it('should preserve htmlContent in component content field', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'comp-1',
                                    ideviceType: 'FreeTextIdevice',
                                    htmlContent: '<h1>Title</h1><p>Paragraph with <strong>bold</strong></p>',
                                },
                            ],
                        },
                    ],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        expect(result.pages[0].components[0].content).toBe('<h1>Title</h1><p>Paragraph with <strong>bold</strong></p>');
    });

    it('should handle orphan pages (invalid parentId)', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [{ id: 'page-1', pageName: 'Orphan', parentId: 'non-existent-parent', blocks: [] }],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);

        // Orphan page should be treated as root
        expect(result.pages[0].title).toBe('Orphan');
    });

    it('should transform legacy TrueFalseIdevice to trueorfalse Game', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'tf-1',
                                    ideviceType: 'TrueFalseIdevice',
                                    properties: {
                                        title: 'TF Question',
                                        questions: [
                                            {
                                                question: 'Q1',
                                                isCorrect: true,
                                                feedback: 'F1',
                                                hint: 'H1',
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);
        const tf = result.pages[0].components[0];

        expect(tf.type).toBe('trueorfalse');
        // Check if complex properties are preserved
        const questionsGame = (tf.properties as any).questionsGame;
        expect(questionsGame).toBeDefined();
        expect(Array.isArray(questionsGame)).toBe(true);
        expect(questionsGame[0].solution).toBe(1); // True
        expect(questionsGame[0].question).toBe('Q1');
        expect(questionsGame[0].feedback).toBe('F1');
    });

    it('should transform FormIdevice to form', () => {
        const yjs: YjsExportStructure = {
            meta: { title: 'Test' },
            pages: [
                {
                    id: 'page-1',
                    pageName: 'Page 1',
                    blocks: [
                        {
                            id: 'block-1',
                            components: [
                                {
                                    id: 'form-1',
                                    ideviceType: 'FormIdevice',
                                    properties: {
                                        title: 'My Form',
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
            navigation: [],
        };

        const result = convertYjsStructureToParsed(yjs);
        const form = result.pages[0].components[0];

        expect(form.type).toBe('form');
    });
});
