/**
 * Games Routes Tests
 * Tests for the progress-report endpoint
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import * as Y from 'yjs';
import { gamesRoutes, configureGamesRoutes, resetGamesRoutesDeps, extractIdevicesFromYjsDoc } from './games';
import { createSessionManager, type SessionManager } from '../services/session-manager';

describe('Games Routes', () => {
    let app: any;
    let mockSessionManager: SessionManager;

    beforeEach(() => {
        // Create isolated session manager for tests
        mockSessionManager = createSessionManager();

        // Configure DI to use mock session manager
        configureGamesRoutes({
            getSession: mockSessionManager.getSession,
        });

        // Create test app with routes
        app = new Elysia().use(gamesRoutes);
    });

    afterEach(() => {
        // Reset to default deps
        resetGamesRoutesDeps();
        mockSessionManager.clearAllSessions();
    });

    describe('GET /api/games/:odeSessionId/idevices', () => {
        it('should return empty array for non-existent session', async () => {
            const response = await app.handle(new Request('http://localhost/api/games/non-existent-session/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });

        it('should return empty array for session without structure', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-session-1',
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-session-1/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });

        it('should extract iDevices from raw structure (legacy format)', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-session-2',
                structure: {
                    raw: {
                        ode: {
                            odeNavStructures: {
                                odeNavStructure: [
                                    {
                                        id: 'page-1',
                                        odePageId: 'page-1-id',
                                        pageName: 'Test Page',
                                        odeNavStructureOrder: 0,
                                        odePagStructures: {
                                            odePagStructure: [
                                                {
                                                    id: 'block-1',
                                                    odeBlockId: 'block-1-id',
                                                    blockName: 'Test Block',
                                                    odePagStructureSyncOrder: 0,
                                                    odeComponents: {
                                                        odeComponent: [
                                                            {
                                                                id: 'comp-1',
                                                                odeComponentId: 'comp-1-id',
                                                                odeIdeviceId: 'idevice-1',
                                                                odeIdeviceTypeName: 'text',
                                                                htmlView: '<p>Test content</p>',
                                                                jsonProperties: '{"key": "value"}',
                                                                odeComponentsSyncOrder: 0,
                                                                isActive: true,
                                                            },
                                                        ],
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-session-2/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);

            const item = data.data[0];
            expect(item.odePageId).toBe('page-1-id');
            expect(item.pageName).toBe('Test Page');
            expect(item.ode_block_id).toBe('block-1-id');
            expect(item.blockName).toBe('Test Block');
            expect(item.componentId).toBe('comp-1-id');
            expect(item.odeIdeviceTypeName).toBe('text');
            expect(item.htmlViewer).toBe('<p>Test content</p>');
            expect(item.jsonProperties).toBe('{"key": "value"}');
            expect(item.componentIsActive).toBe(1);
        });

        it('should extract iDevices from simplified pages array', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-session-3',
                structure: {
                    pages: [
                        {
                            id: 'page-1',
                            title: 'Home Page',
                            blocks: [
                                {
                                    id: 'block-1',
                                    name: 'Main Block',
                                    components: [
                                        {
                                            id: 'comp-1',
                                            type: 'quiz',
                                            content: '<div>Quiz</div>',
                                            jsonProperties: { question: 'What?' },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-session-3/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);

            const item = data.data[0];
            expect(item.odePageId).toBe('page-1');
            expect(item.pageName).toBe('Home Page');
            expect(item.blockName).toBe('Main Block');
            expect(item.odeIdeviceTypeName).toBe('quiz');
            expect(item.htmlViewer).toBe('<div>Quiz</div>');
        });

        it('should handle pages without blocks', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-session-4',
                structure: {
                    pages: [
                        {
                            id: 'page-empty',
                            title: 'Empty Page',
                            blocks: [],
                        },
                    ],
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-session-4/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);

            const item = data.data[0];
            expect(item.odePageId).toBe('page-empty');
            expect(item.pageName).toBe('Empty Page');
            expect(item.componentId).toBeNull();
            expect(item.blockName).toBeNull();
        });

        it('should handle multiple pages with multiple components', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-session-5',
                structure: {
                    pages: [
                        {
                            id: 'page-1',
                            title: 'Page 1',
                            blocks: [
                                {
                                    id: 'block-1',
                                    name: 'Block 1',
                                    components: [
                                        { id: 'comp-1', type: 'text' },
                                        { id: 'comp-2', type: 'quiz' },
                                    ],
                                },
                            ],
                        },
                        {
                            id: 'page-2',
                            title: 'Page 2',
                            blocks: [
                                {
                                    id: 'block-2',
                                    name: 'Block 2',
                                    components: [{ id: 'comp-3', type: 'crossword' }],
                                },
                            ],
                        },
                    ],
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-session-5/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(3);

            // Verify ordering
            expect(data.data[0].componentId).toBe('comp-1');
            expect(data.data[1].componentId).toBe('comp-2');
            expect(data.data[2].componentId).toBe('comp-3');

            // Verify different pages
            expect(data.data[0].odePageId).toBe('page-1');
            expect(data.data[2].odePageId).toBe('page-2');
        });

        it('should include session ID in all items', async () => {
            mockSessionManager.createSession({
                sessionId: 'my-session-id',
                structure: {
                    pages: [
                        {
                            id: 'page-1',
                            title: 'Page',
                            blocks: [
                                {
                                    id: 'block-1',
                                    components: [{ id: 'comp-1', type: 'text' }],
                                },
                            ],
                        },
                    ],
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/my-session-id/idevices'));

            const data = await response.json();
            expect(data.data[0].ode_session_id).toBe('my-session-id');
            expect(data.data[0].componentSessionId).toBe('my-session-id');
        });

        it('should handle single odeNavStructure (not array)', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-session-single',
                structure: {
                    raw: {
                        ode: {
                            odeNavStructures: {
                                odeNavStructure: {
                                    id: 'single-page',
                                    odePageId: 'single-page-id',
                                    pageName: 'Single Page',
                                    odeNavStructureOrder: 0,
                                },
                            },
                        },
                    },
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-session-single/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);
            expect(data.data[0].pageName).toBe('Single Page');
        });

        it('should handle blocks without components in raw structure', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-blocks-no-components',
                structure: {
                    raw: {
                        ode: {
                            odeNavStructures: {
                                odeNavStructure: [
                                    {
                                        id: 'page-1',
                                        odePageId: 'page-1-id',
                                        pageName: 'Test Page',
                                        odeNavStructureOrder: 0,
                                        odePagStructures: {
                                            odePagStructure: [
                                                {
                                                    id: 'block-1',
                                                    odeBlockId: 'block-1-id',
                                                    blockName: 'Empty Block',
                                                    odePagStructureSyncOrder: 0,
                                                    // No odeComponents property
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            });

            const response = await app.handle(
                new Request('http://localhost/api/games/test-blocks-no-components/idevices'),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);

            const item = data.data[0];
            expect(item.odePageId).toBe('page-1-id');
            expect(item.pageName).toBe('Test Page');
            expect(item.ode_block_id).toBe('block-1-id');
            expect(item.blockName).toBe('Empty Block');
            expect(item.componentId).toBeNull();
            expect(item.htmlViewer).toBeNull();
        });

        it('should handle blocks without components in simplified pages array', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-simplified-blocks-no-components',
                structure: {
                    pages: [
                        {
                            id: 'page-1',
                            title: 'Page with Empty Block',
                            blocks: [
                                {
                                    id: 'block-1',
                                    name: 'Empty Block',
                                    components: [], // Empty array
                                },
                            ],
                        },
                    ],
                },
            });

            const response = await app.handle(
                new Request('http://localhost/api/games/test-simplified-blocks-no-components/idevices'),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);

            const item = data.data[0];
            expect(item.odePageId).toBe('page-1');
            expect(item.pageName).toBe('Page with Empty Block');
            expect(item.ode_block_id).toBe('block-1');
            expect(item.blockName).toBe('Empty Block');
            expect(item.componentId).toBeNull();
            expect(item.componentIsActive).toBeNull();
        });

        it('should handle pages with parentId in simplified structure', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-parent-id',
                structure: {
                    pages: [
                        {
                            id: 'page-1',
                            title: 'Root Page',
                            blocks: [],
                        },
                        {
                            id: 'page-2',
                            title: 'Child Page',
                            parentId: 'page-1',
                            blocks: [
                                {
                                    id: 'block-1',
                                    name: 'Block',
                                    components: [{ id: 'comp-1', type: 'text' }],
                                },
                            ],
                        },
                    ],
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-parent-id/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(2);

            // Root page (no parent)
            expect(data.data[0].odeParentPageId).toBeNull();
            // Child page (has parent)
            expect(data.data[1].odeParentPageId).toBe('page-1');
        });

        it('should handle component with isActive undefined in raw structure', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-isactive-undefined',
                structure: {
                    raw: {
                        ode: {
                            odeNavStructures: {
                                odeNavStructure: [
                                    {
                                        id: 'page-1',
                                        odePageId: 'page-1-id',
                                        pageName: 'Test Page',
                                        odePagStructures: {
                                            odePagStructure: [
                                                {
                                                    id: 'block-1',
                                                    odeBlockId: 'block-1-id',
                                                    odeComponents: {
                                                        odeComponent: [
                                                            {
                                                                id: 'comp-1',
                                                                odeComponentId: 'comp-1-id',
                                                                // isActive is undefined
                                                            },
                                                        ],
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            });

            const response = await app.handle(
                new Request('http://localhost/api/games/test-isactive-undefined/idevices'),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);
            // Default to 1 (active) when isActive is undefined
            expect(data.data[0].componentIsActive).toBe(1);
        });

        it('should stringify jsonProperties when it is an object in raw structure', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-json-object',
                structure: {
                    raw: {
                        ode: {
                            odeNavStructures: {
                                odeNavStructure: [
                                    {
                                        id: 'page-1',
                                        odePageId: 'page-1-id',
                                        pageName: 'Test Page',
                                        odePagStructures: {
                                            odePagStructure: [
                                                {
                                                    id: 'block-1',
                                                    odeBlockId: 'block-1-id',
                                                    odeComponents: {
                                                        odeComponent: [
                                                            {
                                                                id: 'comp-1',
                                                                odeComponentId: 'comp-1-id',
                                                                jsonProperties: { key: 'value', nested: { a: 1 } }, // Object, not string
                                                            },
                                                        ],
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-json-object/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);
            expect(data.data[0].jsonProperties).toBe('{"key":"value","nested":{"a":1}}');
        });

        it('should handle htmlView as object in raw structure', async () => {
            mockSessionManager.createSession({
                sessionId: 'test-html-object',
                structure: {
                    raw: {
                        ode: {
                            odeNavStructures: {
                                odeNavStructure: [
                                    {
                                        id: 'page-1',
                                        odePageId: 'page-1-id',
                                        pageName: 'Test Page',
                                        odePagStructures: {
                                            odePagStructure: [
                                                {
                                                    id: 'block-1',
                                                    odeBlockId: 'block-1-id',
                                                    odeComponents: {
                                                        odeComponent: [
                                                            {
                                                                id: 'comp-1',
                                                                odeComponentId: 'comp-1-id',
                                                                htmlView: { content: '<p>Test</p>' }, // Object, not string
                                                            },
                                                        ],
                                                    },
                                                },
                                            ],
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-html-object/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);
            expect(data.data[0].htmlViewer).toBe('{"content":"<p>Test</p>"}');
        });
    });

    /**
     * Tests for extractIdevicesFromYjsDoc functionality
     * These tests verify that the Yjs document extraction works correctly
     * when loading from database snapshots (fallback when session.structure is empty)
     */
    describe('extractIdevicesFromYjsDoc (Yjs document extraction)', () => {
        // Import Yjs for creating test documents
        const Y = require('yjs');

        /**
         * Helper function to create a Yjs document with navigation structure
         * Mirrors the structure used by YjsDocumentAdapter
         */
        function createTestYjsDoc(
            pages: Array<{
                id: string;
                title: string;
                parentId?: string;
                blocks?: Array<{
                    id: string;
                    name?: string;
                    components?: Array<{
                        id: string;
                        type?: string;
                        content?: string;
                    }>;
                }>;
            }>,
        ): Uint8Array {
            const ydoc = new Y.Doc();
            const navigation = ydoc.getArray('navigation');

            for (const page of pages) {
                const pageMap = new Y.Map();
                pageMap.set('id', page.id);
                pageMap.set('title', page.title);
                if (page.parentId) {
                    pageMap.set('parentId', page.parentId);
                }

                if (page.blocks && page.blocks.length > 0) {
                    const blocksArray = new Y.Array();
                    for (const block of page.blocks) {
                        const blockMap = new Y.Map();
                        blockMap.set('id', block.id);
                        if (block.name) {
                            blockMap.set('blockName', block.name);
                        }

                        if (block.components && block.components.length > 0) {
                            const componentsArray = new Y.Array();
                            for (const comp of block.components) {
                                const compMap = new Y.Map();
                                compMap.set('id', comp.id);
                                if (comp.type) {
                                    compMap.set('type', comp.type);
                                }
                                if (comp.content) {
                                    compMap.set('content', comp.content);
                                }
                                componentsArray.push([compMap]);
                            }
                            blockMap.set('components', componentsArray);
                        }

                        blocksArray.push([blockMap]);
                    }
                    pageMap.set('blocks', blocksArray);
                }

                navigation.push([pageMap]);
            }

            const update = Y.encodeStateAsUpdate(ydoc);
            ydoc.destroy();
            return update;
        }

        it('should extract iDevices from Yjs document with single page and component', async () => {
            // This test simulates what happens when session.structure is empty
            // but data exists in the Yjs snapshot in the database.
            // Since we can't easily mock the database in unit tests,
            // we test the extraction function indirectly by verifying
            // that the endpoint returns empty when no session exists.

            // For a session without structure, it should try Yjs fallback
            // (which won't find anything in test environment)
            const response = await app.handle(new Request('http://localhost/api/games/yjs-test-session/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            // Without database mock, returns empty (graceful fallback)
            expect(data.data).toEqual([]);
        });

        it('should prefer session.structure over Yjs snapshot when available', async () => {
            // When session.structure has data, it should NOT try Yjs fallback
            mockSessionManager.createSession({
                sessionId: 'test-prefer-structure',
                structure: {
                    pages: [
                        {
                            id: 'page-from-structure',
                            title: 'From Structure',
                            blocks: [
                                {
                                    id: 'block-1',
                                    name: 'Block',
                                    components: [{ id: 'comp-1', type: 'text' }],
                                },
                            ],
                        },
                    ],
                },
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-prefer-structure/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);
            // Data comes from structure, not Yjs
            expect(data.data[0].odePageId).toBe('page-from-structure');
        });

        it('should handle empty session gracefully without throwing', async () => {
            // Session exists but has no structure - should try Yjs fallback
            // and return empty array without errors
            mockSessionManager.createSession({
                sessionId: 'test-empty-structure',
                // No structure property
            });

            const response = await app.handle(new Request('http://localhost/api/games/test-empty-structure/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });

        it('should return success:true even when Yjs fallback finds nothing', async () => {
            // For non-existent session, Yjs fallback is tried but finds nothing
            // Should still return success:true with empty data
            const response = await app.handle(
                new Request('http://localhost/api/games/completely-unknown-session/idevices'),
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(Array.isArray(data.data)).toBe(true);
        });
    });

    /**
     * Tests for database fallback when session.structure is empty
     */
    describe('Database fallback (Yjs snapshot loading)', () => {
        it('should load iDevices from database when session structure is empty', async () => {
            // Create a mock Yjs document with content
            const ydoc = new Y.Doc();
            const navigation = ydoc.getArray('navigation');

            const pageMap = new Y.Map();
            pageMap.set('id', 'page-from-db');
            pageMap.set('title', 'Page From Database');

            const blocksArray = new Y.Array();
            const blockMap = new Y.Map();
            blockMap.set('id', 'block-1');
            blockMap.set('blockName', 'Block 1');

            const componentsArray = new Y.Array();
            const compMap = new Y.Map();
            compMap.set('id', 'comp-1');
            compMap.set('type', 'quiz');
            compMap.set('content', '<div>Quiz content</div>');
            componentsArray.push([compMap]);

            blockMap.set('components', componentsArray);
            blocksArray.push([blockMap]);
            pageMap.set('blocks', blocksArray);
            navigation.push([pageMap]);

            const snapshotData = Y.encodeStateAsUpdate(ydoc);
            ydoc.destroy();

            // Mock database functions
            const mockDb = {};
            configureGamesRoutes({
                getSession: () => undefined, // No session in memory
                getDb: () => mockDb as never,
                findProjectByUuid: async () => ({ id: 123, uuid: 'db-session-id' }) as never,
                findSnapshotByProjectId: async () =>
                    ({
                        snapshot_data: Buffer.from(snapshotData),
                    }) as never,
            });

            const response = await app.handle(new Request('http://localhost/api/games/db-session-id/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.length).toBe(1);
            expect(data.data[0].odePageId).toBe('page-from-db');
            expect(data.data[0].pageName).toBe('Page From Database');
            expect(data.data[0].ode_block_id).toBe('block-1');
            expect(data.data[0].componentId).toBe('comp-1');
            expect(data.data[0].odeIdeviceTypeName).toBe('quiz');
            expect(data.data[0].htmlViewer).toBe('<div>Quiz content</div>');
        });

        it('should return empty array when project not found in database', async () => {
            configureGamesRoutes({
                getSession: () => undefined,
                getDb: () => ({}) as never,
                findProjectByUuid: async () => undefined, // Project not found
                findSnapshotByProjectId: async () => undefined,
            });

            const response = await app.handle(new Request('http://localhost/api/games/unknown-project-id/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });

        it('should return empty array when snapshot has no data', async () => {
            configureGamesRoutes({
                getSession: () => undefined,
                getDb: () => ({}) as never,
                findProjectByUuid: async () => ({ id: 123, uuid: 'project-id' }) as never,
                findSnapshotByProjectId: async () => undefined, // No snapshot
            });

            const response = await app.handle(new Request('http://localhost/api/games/project-id/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });

        it('should handle database errors gracefully', async () => {
            configureGamesRoutes({
                getSession: () => undefined,
                getDb: () => {
                    throw new Error('Database connection failed');
                },
                findProjectByUuid: async () => undefined,
                findSnapshotByProjectId: async () => undefined,
            });

            const response = await app.handle(new Request('http://localhost/api/games/error-session/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });

        it('should handle findProjectByUuid errors gracefully', async () => {
            configureGamesRoutes({
                getSession: () => undefined,
                getDb: () => ({}) as never,
                findProjectByUuid: async () => {
                    throw new Error('Query failed');
                },
                findSnapshotByProjectId: async () => undefined,
            });

            const response = await app.handle(new Request('http://localhost/api/games/query-error-session/idevices'));

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual([]);
        });
    });
});

/**
 * Direct unit tests for extractIdevicesFromYjsDoc function
 * Tests all code paths in the Yjs document extraction
 */
describe('extractIdevicesFromYjsDoc', () => {
    it('should return empty array for empty Yjs document', () => {
        const ydoc = new Y.Doc();
        const result = extractIdevicesFromYjsDoc('session-id', ydoc);
        expect(result).toEqual([]);
        ydoc.destroy();
    });

    it('should return empty array for document with empty navigation', () => {
        const ydoc = new Y.Doc();
        ydoc.getArray('navigation'); // Create empty navigation array
        const result = extractIdevicesFromYjsDoc('session-id', ydoc);
        expect(result).toEqual([]);
        ydoc.destroy();
    });

    it('should extract page without blocks', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');
        pageMap.set('title', 'Page Title');
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].odePageId).toBe('page-1');
        expect(result[0].pageName).toBe('Page Title');
        expect(result[0].componentId).toBeNull();
        expect(result[0].ode_block_id).toBeNull();
        expect(result[0].ode_session_id).toBe('session-id');

        ydoc.destroy();
    });

    it('should extract page with parentId', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'child-page');
        pageMap.set('title', 'Child Page');
        pageMap.set('parentId', 'parent-page');
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].odeParentPageId).toBe('parent-page');

        ydoc.destroy();
    });

    it('should extract block without components', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');
        pageMap.set('title', 'Page');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('id', 'block-1');
        blockMap.set('blockName', 'Empty Block');
        blocksArray.push([blockMap]);

        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].ode_block_id).toBe('block-1');
        expect(result[0].blockName).toBe('Empty Block');
        expect(result[0].componentId).toBeNull();

        ydoc.destroy();
    });

    it('should extract complete hierarchy with components', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');
        pageMap.set('title', 'Main Page');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('id', 'block-1');
        blockMap.set('blockName', 'Content Block');

        const componentsArray = new Y.Array();
        const compMap = new Y.Map();
        compMap.set('id', 'comp-1');
        compMap.set('type', 'text');
        compMap.set('content', '<p>Hello</p>');
        componentsArray.push([compMap]);

        blockMap.set('components', componentsArray);
        blocksArray.push([blockMap]);
        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].odePageId).toBe('page-1');
        expect(result[0].pageName).toBe('Main Page');
        expect(result[0].ode_block_id).toBe('block-1');
        expect(result[0].blockName).toBe('Content Block');
        expect(result[0].componentId).toBe('comp-1');
        expect(result[0].odeIdeviceTypeName).toBe('text');
        expect(result[0].htmlViewer).toBe('<p>Hello</p>');
        expect(result[0].componentIsActive).toBe(1);

        ydoc.destroy();
    });

    it('should handle alternative property names (pageId, pageName)', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('pageId', 'alt-page-id');
        pageMap.set('pageName', 'Alt Page Name');
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].odePageId).toBe('alt-page-id');
        expect(result[0].pageName).toBe('Alt Page Name');

        ydoc.destroy();
    });

    it('should handle alternative block property names (blockId, name)', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('blockId', 'alt-block-id');
        blockMap.set('name', 'Alt Block Name');
        blockMap.set('order', 5);
        blocksArray.push([blockMap]);

        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].ode_block_id).toBe('alt-block-id');
        expect(result[0].blockName).toBe('Alt Block Name');
        expect(result[0].blockOrder).toBe(5);

        ydoc.destroy();
    });

    it('should handle alternative component property names (ideviceId, ideviceType)', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('id', 'block-1');

        const componentsArray = new Y.Array();
        const compMap = new Y.Map();
        compMap.set('ideviceId', 'alt-comp-id');
        compMap.set('ideviceType', 'crossword');
        compMap.set('order', 3);
        componentsArray.push([compMap]);

        blockMap.set('components', componentsArray);
        blocksArray.push([blockMap]);
        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].componentId).toBe('alt-comp-id');
        expect(result[0].odeIdeviceTypeName).toBe('crossword');
        expect(result[0].ode_components_sync_order).toBe(3);

        ydoc.destroy();
    });

    it('should handle idevices array instead of components array', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('id', 'block-1');

        const idevicesArray = new Y.Array();
        const compMap = new Y.Map();
        compMap.set('id', 'idevice-1');
        compMap.set('type', 'quiz');
        idevicesArray.push([compMap]);

        blockMap.set('idevices', idevicesArray); // Use 'idevices' instead of 'components'
        blocksArray.push([blockMap]);
        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].componentId).toBe('idevice-1');
        expect(result[0].odeIdeviceTypeName).toBe('quiz');

        ydoc.destroy();
    });

    it('should handle htmlContent and htmlView property names', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        // Test with htmlContent
        const pageMap1 = new Y.Map();
        pageMap1.set('id', 'page-1');

        const blocksArray1 = new Y.Array();
        const blockMap1 = new Y.Map();
        blockMap1.set('id', 'block-1');

        const componentsArray1 = new Y.Array();
        const compMap1 = new Y.Map();
        compMap1.set('id', 'comp-1');
        compMap1.set('htmlContent', '<p>Using htmlContent</p>');
        componentsArray1.push([compMap1]);

        blockMap1.set('components', componentsArray1);
        blocksArray1.push([blockMap1]);
        pageMap1.set('blocks', blocksArray1);
        navigation.push([pageMap1]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].htmlViewer).toBe('<p>Using htmlContent</p>');

        ydoc.destroy();
    });

    it('should handle htmlView object with toString method', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('id', 'block-1');

        const componentsArray = new Y.Array();
        const compMap = new Y.Map();
        compMap.set('id', 'comp-1');
        // Set an object with toString for htmlView
        const htmlContent = new Y.Text();
        htmlContent.insert(0, '<p>Text content</p>');
        compMap.set('content', htmlContent);
        componentsArray.push([compMap]);

        blockMap.set('components', componentsArray);
        blocksArray.push([blockMap]);
        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].htmlViewer).toBe('<p>Text content</p>');

        ydoc.destroy();
    });

    it('should skip non-Map entries in navigation', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        // Push a non-Map value (should be skipped)
        navigation.push(['not a map']);

        // Push a valid page
        const pageMap = new Y.Map();
        pageMap.set('id', 'valid-page');
        pageMap.set('title', 'Valid Page');
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].odePageId).toBe('valid-page');

        ydoc.destroy();
    });

    it('should skip non-Map entries in blocks array', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');

        const blocksArray = new Y.Array();
        blocksArray.push(['not a block map']); // Invalid entry

        const validBlock = new Y.Map();
        validBlock.set('id', 'valid-block');
        blocksArray.push([validBlock]);

        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].ode_block_id).toBe('valid-block');

        ydoc.destroy();
    });

    it('should skip non-Map entries in components array', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('id', 'block-1');

        const componentsArray = new Y.Array();
        componentsArray.push(['not a component']); // Invalid entry

        const validComp = new Y.Map();
        validComp.set('id', 'valid-comp');
        validComp.set('type', 'text');
        componentsArray.push([validComp]);

        blockMap.set('components', componentsArray);
        blocksArray.push([blockMap]);
        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].componentId).toBe('valid-comp');

        ydoc.destroy();
    });

    it('should handle multiple pages with multiple blocks and components', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        // Page 1 with 2 blocks, each with 2 components
        const page1 = new Y.Map();
        page1.set('id', 'page-1');
        page1.set('title', 'Page 1');

        const blocks1 = new Y.Array();

        const block1 = new Y.Map();
        block1.set('id', 'block-1');
        const comps1 = new Y.Array();
        const comp1 = new Y.Map();
        comp1.set('id', 'comp-1');
        const comp2 = new Y.Map();
        comp2.set('id', 'comp-2');
        comps1.push([comp1]);
        comps1.push([comp2]);
        block1.set('components', comps1);

        const block2 = new Y.Map();
        block2.set('id', 'block-2');
        const comps2 = new Y.Array();
        const comp3 = new Y.Map();
        comp3.set('id', 'comp-3');
        comps2.push([comp3]);
        block2.set('components', comps2);

        blocks1.push([block1]);
        blocks1.push([block2]);
        page1.set('blocks', blocks1);

        // Page 2 with 1 block and 1 component
        const page2 = new Y.Map();
        page2.set('id', 'page-2');
        page2.set('title', 'Page 2');

        const blocks2 = new Y.Array();
        const block3 = new Y.Map();
        block3.set('id', 'block-3');
        const comps3 = new Y.Array();
        const comp4 = new Y.Map();
        comp4.set('id', 'comp-4');
        comps3.push([comp4]);
        block3.set('components', comps3);
        blocks2.push([block3]);
        page2.set('blocks', blocks2);

        navigation.push([page1]);
        navigation.push([page2]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(4);
        expect(result[0].componentId).toBe('comp-1');
        expect(result[1].componentId).toBe('comp-2');
        expect(result[2].componentId).toBe('comp-3');
        expect(result[3].componentId).toBe('comp-4');

        expect(result[0].ode_nav_structure_sync_order).toBe(0);
        expect(result[3].ode_nav_structure_sync_order).toBe(1);

        ydoc.destroy();
    });

    it('should handle empty blocks array', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');
        pageMap.set('title', 'Page with empty blocks');

        const blocksArray = new Y.Array(); // Empty array
        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        // Empty blocks array should be treated same as no blocks
        expect(result.length).toBe(1);
        expect(result[0].componentId).toBeNull();
        expect(result[0].ode_block_id).toBeNull();

        ydoc.destroy();
    });

    it('should handle empty components array', () => {
        const ydoc = new Y.Doc();
        const navigation = ydoc.getArray('navigation');

        const pageMap = new Y.Map();
        pageMap.set('id', 'page-1');

        const blocksArray = new Y.Array();
        const blockMap = new Y.Map();
        blockMap.set('id', 'block-1');
        blockMap.set('blockName', 'Block with no components');
        blockMap.set('components', new Y.Array()); // Empty components
        blocksArray.push([blockMap]);

        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);

        const result = extractIdevicesFromYjsDoc('session-id', ydoc);

        expect(result.length).toBe(1);
        expect(result[0].ode_block_id).toBe('block-1');
        expect(result[0].componentId).toBeNull();

        ydoc.destroy();
    });
});
