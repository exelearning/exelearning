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
        YjsDocumentAdapter: class MockYjsAdapter {
            getMetadata = () => mockParsedStructure.meta;
            getNavigation = () => mockParsedStructure.pages;
        } as any,
        ServerYjsDocumentWrapper: class MockServerWrapper {
            hasContent = () => true;
            destroy = () => {};
        } as any,
        // Import system
        ElpxImporter: class MockElpxImporter {
            importFromBuffer = async () => ({ pages: 1, blocks: 1, components: 1, assets: 0 });
            importFromZipContents = async () => ({ pages: 1, blocks: 1, components: 1, assets: 0 });
        } as any,
        FileSystemAssetHandler: class MockFileSystemAssetHandler {
            storeAsset = async () => 'asset-id';
            extractAssetsFromZip = async () => new Map();
            convertContextPathToAssetRefs = (html: string) => html;
        } as any,
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

        it('should fallback to ELP import when odeId lookup fails', async () => {
            // Create session with odeId
            const odeIdSessionId = 'odeid-session';
            mockSessions.set(odeIdSessionId, {
                id: odeIdSessionId,
                fileName: 'test.elp',
                odeId: 'test-uuid-12345',
            });

            // Create temp dir with content.xml for fallback (ElpxImporter will read this)
            const sessionTempDir = path.join(testDir, 'tmp', odeIdSessionId);
            await fs.ensureDir(sessionTempDir);
            await fs.writeFile(path.join(sessionTempDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            await fs.ensureDir(path.join(testDir, 'dist', odeIdSessionId));

            // The findProjectByUuid will return null (no project found)
            // This should trigger the fallback to ElpxImporter (content.xml)
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
        it('should use YjsDocumentAdapter from shared export system', async () => {
            // This test verifies that the route uses the injected export system
            const res = await app.handle(new Request(`http://localhost/api/export/${testSessionId}/html5/download`));

            expect(res.status).toBe(200);
            // The mock exporter returns a valid ZIP header
            const buffer = await res.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            expect(bytes[0]).toBe(0x50); // 'P'
            expect(bytes[1]).toBe(0x4b); // 'K'
        });

        it('should fallback to ElpxImporter when session has no structure', async () => {
            // Session without structure should still work (fallback to ElpxImporter)
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

            // Should still return success because mock importer handles it
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

        it('should accept Yjs structure with page/block/component properties', async () => {
            const yjsStructure: YjsExportStructure = {
                meta: {
                    title: 'Test With Properties',
                    author: 'Test Author',
                    language: 'en',
                    theme: 'base',
                },
                pages: [
                    {
                        id: 'page-1',
                        pageName: 'Page with Properties',
                        parentId: null,
                        properties: {
                            visibility: 'visible',
                            cssClass: 'custom-page-class',
                        },
                        blocks: [
                            {
                                id: 'block-1',
                                blockName: 'Block with Properties',
                                iconName: 'icon-text',
                                properties: {
                                    minimized: false,
                                    teacherOnly: true,
                                },
                                components: [
                                    {
                                        id: 'comp-1',
                                        ideviceType: 'FreeTextIdevice',
                                        htmlContent: '<p>Content with properties</p>',
                                        properties: {
                                            emphasis: 'strong',
                                            customField: 'value',
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
                navigation: [],
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

        it('should create virtual session for Yjs-only sessions with structure in POST', async () => {
            // Test for Yjs-only session (yjs-* prefix) with structure provided in body
            const yjsOnlySessionId = 'yjs-only-test-session';
            // Don't add to mockSessions - simulate a Yjs-only session

            const yjsStructure: YjsExportStructure = {
                meta: {
                    title: 'Yjs Only Project',
                    author: 'Test Author',
                    language: 'en',
                    theme: 'base',
                },
                pages: [
                    {
                        id: 'page-1',
                        pageName: 'Page 1',
                        blocks: [],
                    },
                ],
                navigation: [],
            };

            const res = await app.handle(
                new Request(`http://localhost/api/export/${yjsOnlySessionId}/html5/download`, {
                    method: 'POST',
                    body: JSON.stringify({ structure: yjsStructure }),
                    headers: { 'Content-Type': 'application/json' },
                }),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('elpx-page export type', () => {
        it('should accept elpx-page export type', async () => {
            const res = await app.handle(
                new Request(`http://localhost/api/export/${testSessionId}/elpx-page/download`),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('ELP file direct import', () => {
        it('should import from .elp file when present in tempDir', async () => {
            const elpFileSessionId = 'elp-file-session';
            mockSessions.set(elpFileSessionId, {
                id: elpFileSessionId,
                fileName: 'project.elp',
                // No structure - will trigger ELP import
            });

            // Create temp dir with an .elp file
            const elpFileTempDir = path.join(testDir, 'tmp', elpFileSessionId);
            await fs.ensureDir(elpFileTempDir);
            // Create a minimal ZIP file (ELP is a ZIP)
            const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK header
            await fs.writeFile(path.join(elpFileTempDir, 'project.elp'), zipHeader);
            await fs.ensureDir(path.join(testDir, 'dist', elpFileSessionId));

            const res = await app.handle(new Request(`http://localhost/api/export/${elpFileSessionId}/html5/download`));

            expect(res.status).toBe(200);
        });

        it('should import from .elpx file when present in tempDir', async () => {
            const elpxFileSessionId = 'elpx-file-session';
            mockSessions.set(elpxFileSessionId, {
                id: elpxFileSessionId,
                fileName: 'project.elpx',
                // No structure - will trigger ELP import
            });

            // Create temp dir with an .elpx file
            const elpxFileTempDir = path.join(testDir, 'tmp', elpxFileSessionId);
            await fs.ensureDir(elpxFileTempDir);
            // Create a minimal ZIP file (ELPX is a ZIP)
            const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK header
            await fs.writeFile(path.join(elpxFileTempDir, 'project.elpx'), zipHeader);
            await fs.ensureDir(path.join(testDir, 'dist', elpxFileSessionId));

            const res = await app.handle(
                new Request(`http://localhost/api/export/${elpxFileSessionId}/html5/download`),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('legacy content and resources import', () => {
        it('should handle contentv3.xml (legacy format) when present', async () => {
            const legacySessionId = 'legacy-session';
            mockSessions.set(legacySessionId, {
                id: legacySessionId,
                fileName: 'legacy.elp',
                // No structure - will trigger ELP import
            });

            // Create temp dir with both content.xml and contentv3.xml
            const legacyTempDir = path.join(testDir, 'tmp', legacySessionId);
            await fs.ensureDir(legacyTempDir);
            await fs.writeFile(path.join(legacyTempDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            await fs.writeFile(
                path.join(legacyTempDir, 'contentv3.xml'),
                '<?xml version="1.0"?><exe_document></exe_document>',
            );
            await fs.ensureDir(path.join(testDir, 'dist', legacySessionId));

            const res = await app.handle(new Request(`http://localhost/api/export/${legacySessionId}/html5/download`));

            expect(res.status).toBe(200);
        });

        it('should handle resources directory when present', async () => {
            const resourcesSessionId = 'resources-session';
            mockSessions.set(resourcesSessionId, {
                id: resourcesSessionId,
                fileName: 'resources-test.elp',
                // No structure - will trigger ELP import
            });

            // Create temp dir with content.xml and resources directory
            const resourcesTempDir = path.join(testDir, 'tmp', resourcesSessionId);
            await fs.ensureDir(resourcesTempDir);
            await fs.writeFile(path.join(resourcesTempDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');

            // Create resources directory with files
            const resourcesDir = path.join(resourcesTempDir, 'resources');
            await fs.ensureDir(resourcesDir);
            await fs.writeFile(path.join(resourcesDir, 'image.png'), 'PNG DATA');
            await fs.writeFile(path.join(resourcesDir, 'style.css'), 'body { color: red; }');
            await fs.ensureDir(path.join(testDir, 'dist', resourcesSessionId));

            const res = await app.handle(
                new Request(`http://localhost/api/export/${resourcesSessionId}/html5/download`),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('database asset provider integration', () => {
        it('should use DatabaseAssetProvider when project exists in database', async () => {
            // Create session with odeId that will find a project
            const dbAssetSessionId = 'db-asset-session';
            mockSessions.set(dbAssetSessionId, {
                id: dbAssetSessionId,
                fileName: 'db-asset-test.elp',
                odeId: 'test-project-uuid',
                structure: mockParsedStructure, // Has structure, will use it
            });

            await fs.ensureDir(path.join(testDir, 'tmp', dbAssetSessionId));
            await fs.ensureDir(path.join(testDir, 'dist', dbAssetSessionId));

            // Create deps with database that returns a project
            const dbDeps = createMockDependencies();
            dbDeps.database = {
                db: {} as any,
                findProjectByUuid: async () => ({ id: 1, uuid: 'test-project-uuid', title: 'Test' }) as any,
            };

            const dbApp = new Elysia().use(createExportRoutes(dbDeps));

            const res = await dbApp.handle(
                new Request(`http://localhost/api/export/${dbAssetSessionId}/html5/download`),
            );

            expect(res.status).toBe(200);
        });
    });

    describe('Yjs document reconstruction paths', () => {
        it('should fallback when Yjs document has no content', async () => {
            const emptyYjsSessionId = 'empty-yjs-session';
            mockSessions.set(emptyYjsSessionId, {
                id: emptyYjsSessionId,
                fileName: 'empty-yjs.elp',
                odeId: 'empty-yjs-project-uuid',
            });

            // Create temp dir with content.xml for fallback
            const emptyYjsTempDir = path.join(testDir, 'tmp', emptyYjsSessionId);
            await fs.ensureDir(emptyYjsTempDir);
            await fs.writeFile(path.join(emptyYjsTempDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            await fs.ensureDir(path.join(testDir, 'dist', emptyYjsSessionId));

            // Create deps where Yjs document is reconstructed but empty
            const emptyYjsDeps = createMockDependencies();
            emptyYjsDeps.database = {
                db: {} as any,
                findProjectByUuid: async () => ({ id: 1, uuid: 'empty-yjs-project-uuid', title: 'Test' }) as any,
            };
            emptyYjsDeps.yjsPersistence = {
                reconstructDocument: async () => {
                    // Return a mock Y.Doc
                    return { destroy: () => {} } as any;
                },
            };
            // Make ServerYjsDocumentWrapper return hasContent() = false
            emptyYjsDeps.exportSystem.ServerYjsDocumentWrapper = class EmptyWrapper {
                hasContent = () => false;
                destroy = () => {};
            } as any;

            const emptyYjsApp = new Elysia().use(createExportRoutes(emptyYjsDeps));

            const res = await emptyYjsApp.handle(
                new Request(`http://localhost/api/export/${emptyYjsSessionId}/html5/download`),
            );

            expect(res.status).toBe(200);
        });

        it('should fallback when reconstructDocument returns null', async () => {
            const nullYjsSessionId = 'null-yjs-session';
            mockSessions.set(nullYjsSessionId, {
                id: nullYjsSessionId,
                fileName: 'null-yjs.elp',
                odeId: 'null-yjs-project-uuid',
            });

            // Create temp dir with content.xml for fallback
            const nullYjsTempDir = path.join(testDir, 'tmp', nullYjsSessionId);
            await fs.ensureDir(nullYjsTempDir);
            await fs.writeFile(path.join(nullYjsTempDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            await fs.ensureDir(path.join(testDir, 'dist', nullYjsSessionId));

            // Create deps where reconstructDocument returns null
            const nullYjsDeps = createMockDependencies();
            nullYjsDeps.database = {
                db: {} as any,
                findProjectByUuid: async () => ({ id: 1, uuid: 'null-yjs-project-uuid', title: 'Test' }) as any,
            };
            nullYjsDeps.yjsPersistence = {
                reconstructDocument: async () => null,
            };

            const nullYjsApp = new Elysia().use(createExportRoutes(nullYjsDeps));

            const res = await nullYjsApp.handle(
                new Request(`http://localhost/api/export/${nullYjsSessionId}/html5/download`),
            );

            expect(res.status).toBe(200);
        });

        it('should fallback when findProjectByUuid returns null', async () => {
            const noProjectSessionId = 'no-project-session';
            mockSessions.set(noProjectSessionId, {
                id: noProjectSessionId,
                fileName: 'no-project.elp',
                odeId: 'non-existent-project-uuid',
            });

            // Create temp dir with content.xml for fallback
            const noProjectTempDir = path.join(testDir, 'tmp', noProjectSessionId);
            await fs.ensureDir(noProjectTempDir);
            await fs.writeFile(path.join(noProjectTempDir, 'content.xml'), '<?xml version="1.0"?><ode></ode>');
            await fs.ensureDir(path.join(testDir, 'dist', noProjectSessionId));

            // Create deps where findProjectByUuid returns null
            const noProjectDeps = createMockDependencies();
            noProjectDeps.database = {
                db: {} as any,
                findProjectByUuid: async () => null,
            };

            const noProjectApp = new Elysia().use(createExportRoutes(noProjectDeps));

            const res = await noProjectApp.handle(
                new Request(`http://localhost/api/export/${noProjectSessionId}/html5/download`),
            );

            expect(res.status).toBe(200);
        });

        it('should return error when all fallbacks fail (empty Yjs, no ELP)', async () => {
            const allFailSessionId = 'all-fail-session';
            mockSessions.set(allFailSessionId, {
                id: allFailSessionId,
                fileName: 'all-fail.elp',
                odeId: 'all-fail-project-uuid',
            });

            // Create temp dir WITHOUT content.xml - all fallbacks will fail
            await fs.ensureDir(path.join(testDir, 'tmp', allFailSessionId));
            await fs.ensureDir(path.join(testDir, 'dist', allFailSessionId));

            // Create deps where Yjs document has no content and no ELP fallback
            const allFailDeps = createMockDependencies();
            allFailDeps.database = {
                db: {} as any,
                findProjectByUuid: async () => ({ id: 1, uuid: 'all-fail-project-uuid', title: 'Test' }) as any,
            };
            allFailDeps.yjsPersistence = {
                reconstructDocument: async () => ({ destroy: () => {} }) as any,
            };
            allFailDeps.exportSystem.ServerYjsDocumentWrapper = class EmptyWrapper {
                hasContent = () => false;
                destroy = () => {};
            } as any;

            const allFailApp = new Elysia().use(createExportRoutes(allFailDeps));

            const res = await allFailApp.handle(
                new Request(`http://localhost/api/export/${allFailSessionId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toContain('No project structure');
        });

        it('should return error when reconstructDocument is null and no ELP fallback', async () => {
            const nullNoFallbackId = 'null-no-fallback-session';
            mockSessions.set(nullNoFallbackId, {
                id: nullNoFallbackId,
                fileName: 'null-no-fallback.elp',
                odeId: 'null-no-fallback-uuid',
            });

            // Create temp dir WITHOUT content.xml
            await fs.ensureDir(path.join(testDir, 'tmp', nullNoFallbackId));
            await fs.ensureDir(path.join(testDir, 'dist', nullNoFallbackId));

            // Create deps where reconstructDocument returns null and no ELP
            const nullNoFallbackDeps = createMockDependencies();
            nullNoFallbackDeps.database = {
                db: {} as any,
                findProjectByUuid: async () => ({ id: 1, uuid: 'null-no-fallback-uuid', title: 'Test' }) as any,
            };
            nullNoFallbackDeps.yjsPersistence = {
                reconstructDocument: async () => null,
            };

            const nullNoFallbackApp = new Elysia().use(createExportRoutes(nullNoFallbackDeps));

            const res = await nullNoFallbackApp.handle(
                new Request(`http://localhost/api/export/${nullNoFallbackId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toContain('No project structure');
        });

        it('should return error when project not found and no ELP fallback', async () => {
            const noProjectNoFallbackId = 'no-project-no-fallback-session';
            mockSessions.set(noProjectNoFallbackId, {
                id: noProjectNoFallbackId,
                fileName: 'no-project-no-fallback.elp',
                odeId: 'no-project-no-fallback-uuid',
            });

            // Create temp dir WITHOUT content.xml
            await fs.ensureDir(path.join(testDir, 'tmp', noProjectNoFallbackId));
            await fs.ensureDir(path.join(testDir, 'dist', noProjectNoFallbackId));

            // Create deps where findProjectByUuid returns null and no ELP
            const noProjectNoFallbackDeps = createMockDependencies();
            noProjectNoFallbackDeps.database = {
                db: {} as any,
                findProjectByUuid: async () => null,
            };

            const noProjectNoFallbackApp = new Elysia().use(createExportRoutes(noProjectNoFallbackDeps));

            const res = await noProjectNoFallbackApp.handle(
                new Request(`http://localhost/api/export/${noProjectNoFallbackId}/html5/download`),
            );

            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body.error).toContain('No project structure');
        });
    });
});
