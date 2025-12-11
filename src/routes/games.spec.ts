/**
 * Games Routes Tests
 * Tests for the progress-report endpoint
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { gamesRoutes, configureGamesRoutes, resetGamesRoutesDeps } from './games';
import { createSessionManager, type SessionManager } from '../services/session-manager';

describe('Games Routes', () => {
    let app: Elysia;
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
});
