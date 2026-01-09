/**
 * WebSocket Module for Elysia
 * Yjs collaboration and asset coordination
 */

// Types
export * from './types';

// Services
export * as yjsWebSocket from './yjs-websocket';
export * as yjsPersistence from './yjs-persistence';
export * as assetCoordinator from './asset-coordinator';

// Context
export {
    createCollaborationContext,
    createTestCollaborationContext,
    createMockPubSub,
    createMockPriorityQueue,
    configureAllModules,
    resetAllModules,
    getCollaborationContext,
    resetCollaborationContext,
    type CollaborationContext,
    type CollaborationContextOptions,
} from './collaboration.context';

// Convenience re-exports
export {
    createWebSocketRoutes,
    initialize,
    stop,
    getServerInfo,
    getActiveRooms,
    broadcastToRoom,
} from './yjs-websocket';
export {
    saveFullState,
    loadDocument,
    loadDocumentByUuid,
    saveFullStateByUuid,
    reconstructDocument,
    documentExists,
} from './yjs-persistence';
