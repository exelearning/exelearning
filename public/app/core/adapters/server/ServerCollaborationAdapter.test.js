import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerCollaborationAdapter } from './ServerCollaborationAdapter.js';

describe('ServerCollaborationAdapter', () => {
    let adapter;
    let mockAwareness;

    beforeEach(() => {
        adapter = new ServerCollaborationAdapter('ws://localhost:8083', '/test');

        mockAwareness = {
            getStates: vi.fn().mockReturnValue(new Map([
                [1, { user: { id: 'user-1', name: 'Alice', color: '#ff0000' }, cursor: { x: 10, y: 20 } }],
                [2, { user: { id: 'user-2', name: 'Bob', color: '#00ff00' } }],
            ])),
            setLocalStateField: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
        };

        window.eXeLearning = {
            app: {
                project: {
                    _yjsBridge: {
                        awareness: mockAwareness,
                    },
                },
            },
        };
    });

    afterEach(() => {
        delete window.eXeLearning;
    });

    describe('constructor', () => {
        it('should store wsUrl and basePath', () => {
            expect(adapter.wsUrl).toBe('ws://localhost:8083');
            expect(adapter.basePath).toBe('/test');
        });

        it('should default basePath to empty string', () => {
            const adapterWithoutPath = new ServerCollaborationAdapter('ws://test');
            expect(adapterWithoutPath.basePath).toBe('');
        });

        it('should initialize currentProjectId as null', () => {
            expect(adapter.currentProjectId).toBeNull();
        });

        it('should initialize empty presence callbacks set', () => {
            expect(adapter._presenceCallbacks).toBeInstanceOf(Set);
            expect(adapter._presenceCallbacks.size).toBe(0);
        });
    });

    describe('isEnabled', () => {
        it('should return true', () => {
            expect(adapter.isEnabled()).toBe(true);
        });
    });

    describe('connect', () => {
        it('should set currentProjectId', async () => {
            await adapter.connect('project-123');

            expect(adapter.currentProjectId).toBe('project-123');
        });
    });

    describe('disconnect', () => {
        it('should clear currentProjectId', async () => {
            adapter.currentProjectId = 'project-123';

            await adapter.disconnect();

            expect(adapter.currentProjectId).toBeNull();
        });
    });

    describe('getPresence', () => {
        it('should return presence from awareness', async () => {
            const presence = await adapter.getPresence();

            expect(presence).toHaveLength(2);
            expect(presence[0]).toEqual({
                clientId: 1,
                userId: 'user-1',
                username: 'Alice',
                color: '#ff0000',
                cursor: { x: 10, y: 20 },
            });
            expect(presence[1]).toEqual({
                clientId: 2,
                userId: 'user-2',
                username: 'Bob',
                color: '#00ff00',
                cursor: undefined,
            });
        });

        it('should return empty array if awareness not available', async () => {
            delete window.eXeLearning;

            const presence = await adapter.getPresence();

            expect(presence).toEqual([]);
        });

        it('should handle missing user data', async () => {
            mockAwareness.getStates.mockReturnValue(new Map([
                [1, {}], // No user data
                [2, { user: { name: 'Bob' } }], // Missing id and color
            ]));

            const presence = await adapter.getPresence();

            expect(presence).toHaveLength(1);
            expect(presence[0].userId).toBe('2'); // Falls back to clientId
            expect(presence[0].username).toBe('Bob');
            expect(presence[0].color).toBe('#888888'); // Default color
        });
    });

    describe('updatePresence', () => {
        it('should update awareness state', async () => {
            await adapter.updatePresence({
                cursor: { x: 100, y: 200 },
                selection: { start: 0, end: 10 },
            });

            expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
                'cursor',
                { x: 100, y: 200 },
            );
            expect(mockAwareness.setLocalStateField).toHaveBeenCalledWith(
                'selection',
                { start: 0, end: 10 },
            );
        });

        it('should do nothing if awareness not available', async () => {
            delete window.eXeLearning;

            await adapter.updatePresence({ cursor: { x: 0, y: 0 } });

            // Should not throw
        });
    });

    describe('onPresenceChange', () => {
        it('should subscribe to awareness changes', () => {
            const callback = vi.fn();

            adapter.onPresenceChange(callback);

            expect(adapter._presenceCallbacks.has(callback)).toBe(true);
            expect(mockAwareness.on).toHaveBeenCalledWith('change', expect.any(Function));
        });

        it('should return unsubscribe function', () => {
            const callback = vi.fn();

            const unsubscribe = adapter.onPresenceChange(callback);
            unsubscribe();

            expect(adapter._presenceCallbacks.has(callback)).toBe(false);
            expect(mockAwareness.off).toHaveBeenCalledWith('change', expect.any(Function));
        });

        it('should return no-op unsubscribe if awareness not available', () => {
            delete window.eXeLearning;
            const callback = vi.fn();

            const unsubscribe = adapter.onPresenceChange(callback);
            expect(typeof unsubscribe).toBe('function');

            unsubscribe(); // Should not throw
        });

        it('should call callback with presence on change', () => {
            const callback = vi.fn();

            adapter.onPresenceChange(callback);

            // Get the handler that was registered
            const registeredHandler = mockAwareness.on.mock.calls[0][1];

            // Simulate change
            registeredHandler();

            // Wait for async operation
            return new Promise(resolve => setTimeout(resolve, 0)).then(() => {
                expect(callback).toHaveBeenCalled();
            });
        });
    });

    describe('getWebSocketUrl', () => {
        it('should return wsUrl', () => {
            expect(adapter.getWebSocketUrl()).toBe('ws://localhost:8083');
        });
    });

    describe('getProjectWebSocketUrl', () => {
        it('should return project-specific WebSocket URL', () => {
            const url = adapter.getProjectWebSocketUrl('project-123');

            expect(url).toBe('ws://localhost:8083/yjs/project-123');
        });

        it('should return null if no wsUrl', () => {
            const adapterWithoutWs = new ServerCollaborationAdapter(null);

            const url = adapterWithoutWs.getProjectWebSocketUrl('project-123');

            expect(url).toBeNull();
        });
    });

    describe('obtainBlockSync', () => {
        it('should return OK with null block (Yjs handles sync)', async () => {
            const result = await adapter.obtainBlockSync({ blockId: '123' });

            expect(result).toEqual({ responseMessage: 'OK', block: null });
        });
    });
});
