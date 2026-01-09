/**
 * Collaboration Context for WebSocket Subsystem
 *
 * Provides a unified dependency container for all WebSocket-related modules:
 * - room-manager.ts
 * - asset-coordinator.ts
 * - yjs-persistence.ts
 * - yjs-websocket.ts
 *
 * Benefits:
 * - Single point of configuration for testing
 * - Shared dependencies (db, logger, queries) in one place
 * - Easier reasoning about module interactions
 * - Simplified mock setup for tests
 *
 * Usage:
 * ```typescript
 * // Production: modules use defaults
 * import * as roomManager from './room-manager';
 *
 * // Testing: configure all modules at once
 * import { createCollaborationContext, configureAllModules } from './collaboration.context';
 *
 * const ctx = createCollaborationContext({
 *     db: testDb,
 *     logger: silentLogger,
 *     queries: { findProjectByUuid: mockFindProject },
 * });
 * configureAllModules(ctx);
 * ```
 */
import type { Kysely } from 'kysely';
import type { Database, Project, Asset } from '../db/types';
import type { LoggerContext } from '../contexts/logger.context';
import { getLogger, silentLogger } from '../contexts/logger.context';
import { db as defaultDb } from '../db/client';

// Import default query implementations
import {
    findProjectByUuid as defaultFindProjectByUuid,
    checkProjectAccess as defaultCheckProjectAccess,
    markProjectAsSaved as defaultMarkProjectAsSaved,
    findAssetByClientId as defaultFindAssetByClientId,
} from '../db/queries';

// Import Yjs persistence queries
import {
    saveFullState as defaultSaveFullState,
    loadDocumentState as defaultLoadDocumentState,
    findUpdatesByProjectId as defaultFindUpdatesByProjectId,
    findUpdatesSince as defaultFindUpdatesSince,
    deleteAllUpdates as defaultDeleteAllUpdates,
    deleteUpdatesBefore as defaultDeleteUpdatesBefore,
    countUpdates as defaultCountUpdates,
    getLatestVersion as defaultGetLatestVersion,
    getAllUpdateBuffers as defaultGetAllUpdateBuffers,
    documentExists as defaultDocumentExists,
    saveIncrementalUpdate as defaultSaveIncrementalUpdate,
    loadDocumentWithUpdates as defaultLoadDocumentWithUpdates,
    upsertSnapshot as defaultUpsertSnapshot,
    deleteUpdatesUpToVersion as defaultDeleteUpdatesUpToVersion,
    findSnapshotByProjectId as defaultFindSnapshotByProjectId,
} from '../db/queries';

// Import service dependencies
import { verifyToken as defaultVerifyToken } from '../routes/auth';
import { getSession as defaultGetSession } from '../services/session-manager';
import {
    serverPriorityQueue as defaultPriorityQueue,
    type PriorityQueueRequest,
    type ActiveSlot,
    type PreemptResult,
    type QueueStats,
} from '../services/asset-priority-queue';
import * as defaultPubSub from '../redis/pubsub-manager';

// ============================================================================
// QUERY INTERFACES
// ============================================================================

/**
 * Common queries shared across modules
 */
export interface CommonQueries {
    findProjectByUuid: (db: Kysely<Database>, uuid: string) => Promise<Project | undefined>;
    checkProjectAccess: (db: Kysely<Database>, projectId: number, userId: number) => Promise<boolean>;
    markProjectAsSaved: (db: Kysely<Database>, projectId: number) => Promise<void>;
    findAssetByClientId: (db: Kysely<Database>, clientId: string, projectId: number) => Promise<Asset | undefined>;
}

/**
 * Yjs persistence queries
 */
export interface YjsPersistenceQueries {
    saveFullState: typeof defaultSaveFullState;
    loadDocumentState: typeof defaultLoadDocumentState;
    findUpdatesByProjectId: typeof defaultFindUpdatesByProjectId;
    findUpdatesSince: typeof defaultFindUpdatesSince;
    deleteAllUpdates: typeof defaultDeleteAllUpdates;
    deleteUpdatesBefore: typeof defaultDeleteUpdatesBefore;
    countUpdates: typeof defaultCountUpdates;
    getLatestVersion: typeof defaultGetLatestVersion;
    getAllUpdateBuffers: typeof defaultGetAllUpdateBuffers;
    documentExists: typeof defaultDocumentExists;
    saveIncrementalUpdate: typeof defaultSaveIncrementalUpdate;
    loadDocumentWithUpdates: typeof defaultLoadDocumentWithUpdates;
    upsertSnapshot: typeof defaultUpsertSnapshot;
    deleteUpdatesUpToVersion: typeof defaultDeleteUpdatesUpToVersion;
    findSnapshotByProjectId: typeof defaultFindSnapshotByProjectId;
}

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

/**
 * Auth service interface
 */
export interface AuthService {
    verifyToken: typeof defaultVerifyToken;
}

/**
 * Session manager interface
 */
export interface SessionManagerService {
    getSession: typeof defaultGetSession;
}

/**
 * Priority queue interface
 */
export interface PriorityQueueService {
    registerRequest: (request: PriorityQueueRequest) => void;
    registerActiveSlot: (slot: ActiveSlot) => void;
    releaseSlot: (projectId: string, assetId: string) => void;
    clearProject: (projectId: string) => void;
    shouldPreempt: (projectId: string) => PreemptResult;
    getStats: (projectId: string) => QueueStats;
    peekNextUpload: (projectId: string) => PriorityQueueRequest | null;
}

/**
 * Pub/sub manager interface
 */
export interface PubSubService {
    publish: typeof defaultPubSub.publish;
    subscribe: typeof defaultPubSub.subscribe;
    unsubscribe: typeof defaultPubSub.unsubscribe;
    isPubSubEnabled: typeof defaultPubSub.isPubSubEnabled;
    setMessageHandler: typeof defaultPubSub.setMessageHandler;
}

// ============================================================================
// COLLABORATION CONTEXT
// ============================================================================

/**
 * Full collaboration context with all dependencies
 */
export interface CollaborationContext {
    // Core infrastructure
    readonly db: Kysely<Database>;
    readonly logger: LoggerContext;

    // Queries
    readonly queries: CommonQueries;
    readonly yjsQueries: YjsPersistenceQueries;

    // Services
    readonly auth: AuthService;
    readonly sessionManager: SessionManagerService;
    readonly priorityQueue: PriorityQueueService;
    readonly pubSub: PubSubService;

    // Configuration overrides (for testing)
    readonly cleanupDelayOverride?: number;
}

/**
 * Options for creating a collaboration context
 */
export interface CollaborationContextOptions {
    db?: Kysely<Database>;
    logger?: LoggerContext;
    queries?: Partial<CommonQueries>;
    yjsQueries?: Partial<YjsPersistenceQueries>;
    auth?: Partial<AuthService>;
    sessionManager?: Partial<SessionManagerService>;
    priorityQueue?: Partial<PriorityQueueService>;
    pubSub?: Partial<PubSubService>;
    cleanupDelayOverride?: number;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const defaultCommonQueries: CommonQueries = {
    findProjectByUuid: defaultFindProjectByUuid,
    checkProjectAccess: defaultCheckProjectAccess,
    markProjectAsSaved: defaultMarkProjectAsSaved,
    findAssetByClientId: defaultFindAssetByClientId,
};

const defaultYjsQueries: YjsPersistenceQueries = {
    saveFullState: defaultSaveFullState,
    loadDocumentState: defaultLoadDocumentState,
    findUpdatesByProjectId: defaultFindUpdatesByProjectId,
    findUpdatesSince: defaultFindUpdatesSince,
    deleteAllUpdates: defaultDeleteAllUpdates,
    deleteUpdatesBefore: defaultDeleteUpdatesBefore,
    countUpdates: defaultCountUpdates,
    getLatestVersion: defaultGetLatestVersion,
    getAllUpdateBuffers: defaultGetAllUpdateBuffers,
    documentExists: defaultDocumentExists,
    saveIncrementalUpdate: defaultSaveIncrementalUpdate,
    loadDocumentWithUpdates: defaultLoadDocumentWithUpdates,
    upsertSnapshot: defaultUpsertSnapshot,
    deleteUpdatesUpToVersion: defaultDeleteUpdatesUpToVersion,
    findSnapshotByProjectId: defaultFindSnapshotByProjectId,
};

const defaultAuthService: AuthService = {
    verifyToken: defaultVerifyToken,
};

const defaultSessionManagerService: SessionManagerService = {
    getSession: defaultGetSession,
};

const defaultPriorityQueueService: PriorityQueueService = {
    registerRequest: defaultPriorityQueue.registerRequest,
    registerActiveSlot: defaultPriorityQueue.registerActiveSlot,
    releaseSlot: defaultPriorityQueue.releaseSlot,
    clearProject: defaultPriorityQueue.clearProject,
    shouldPreempt: defaultPriorityQueue.shouldPreempt,
    getStats: defaultPriorityQueue.getStats,
    peekNextUpload: defaultPriorityQueue.peekNextUpload,
};

const defaultPubSubService: PubSubService = {
    publish: defaultPubSub.publish,
    subscribe: defaultPubSub.subscribe,
    unsubscribe: defaultPubSub.unsubscribe,
    isPubSubEnabled: defaultPubSub.isPubSubEnabled,
    setMessageHandler: defaultPubSub.setMessageHandler,
};

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a collaboration context with optional overrides
 *
 * @param options - Optional overrides for dependencies
 * @returns Frozen collaboration context
 *
 * @example
 * ```typescript
 * // Production: use defaults
 * const ctx = createCollaborationContext();
 *
 * // Testing: override specific dependencies
 * const ctx = createCollaborationContext({
 *     db: testDb,
 *     logger: silentLogger,
 *     queries: { findProjectByUuid: mockFindProject },
 *     cleanupDelayOverride: 0, // Immediate cleanup in tests
 * });
 * ```
 */
export function createCollaborationContext(options: CollaborationContextOptions = {}): CollaborationContext {
    const context: CollaborationContext = {
        db: options.db ?? defaultDb,
        logger: options.logger ?? getLogger(),

        queries: {
            ...defaultCommonQueries,
            ...options.queries,
        },

        yjsQueries: {
            ...defaultYjsQueries,
            ...options.yjsQueries,
        },

        auth: {
            ...defaultAuthService,
            ...options.auth,
        },

        sessionManager: {
            ...defaultSessionManagerService,
            ...options.sessionManager,
        },

        priorityQueue: {
            ...defaultPriorityQueueService,
            ...options.priorityQueue,
        },

        pubSub: {
            ...defaultPubSubService,
            ...options.pubSub,
        },

        cleanupDelayOverride: options.cleanupDelayOverride,
    };

    return Object.freeze(context);
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Create a collaboration context with silent logger and common test defaults
 *
 * @param options - Additional overrides
 * @returns Test-friendly collaboration context
 */
export function createTestCollaborationContext(options: CollaborationContextOptions = {}): CollaborationContext {
    return createCollaborationContext({
        logger: silentLogger,
        cleanupDelayOverride: 0, // Immediate cleanup in tests
        ...options,
    });
}

/**
 * Create mock pub/sub service that does nothing
 * Useful for tests that don't need Redis functionality
 */
export function createMockPubSub(): PubSubService {
    return {
        publish: async () => {},
        subscribe: async () => {},
        unsubscribe: async () => {},
        isPubSubEnabled: () => false,
        setMessageHandler: () => {},
    };
}

/**
 * Create mock priority queue service
 * Useful for tests that don't need actual priority queue
 */
export function createMockPriorityQueue(): PriorityQueueService {
    return {
        registerRequest: () => {},
        registerActiveSlot: () => {},
        releaseSlot: () => {},
        clearProject: () => {},
        shouldPreempt: () => ({ shouldPreempt: false, reason: 'mock' }),
        getStats: () => ({
            pending: [],
            active: [],
            pendingCount: 0,
            activeCount: 0,
        }),
        peekNextUpload: () => null,
    };
}

// ============================================================================
// MODULE CONFIGURATION HELPERS
// ============================================================================

// Import configure functions (avoid circular deps by importing types only at top)
import { configure as configureRoomManager, resetDependencies as resetRoomManager } from './room-manager';
import { configure as configureYjsPersistence, resetDependencies as resetYjsPersistence } from './yjs-persistence';
import { configure as configureYjsWebSocket, resetDependencies as resetYjsWebSocket } from './yjs-websocket';

/**
 * Configure all WebSocket modules with a collaboration context
 *
 * @param ctx - The collaboration context to use
 *
 * @example
 * ```typescript
 * const ctx = createTestCollaborationContext({ db: testDb });
 * configureAllModules(ctx);
 *
 * // Now all modules use the test context
 * // Run your tests...
 *
 * // Clean up
 * resetAllModules();
 * ```
 */
export function configureAllModules(ctx: CollaborationContext): void {
    // Configure room manager
    configureRoomManager({
        pubSub: ctx.pubSub,
        cleanupDelayOverride: ctx.cleanupDelayOverride,
    });

    // Configure Yjs persistence
    configureYjsPersistence({
        db: ctx.db,
        queries: ctx.yjsQueries,
    });

    // Configure Yjs WebSocket
    configureYjsWebSocket({
        db: ctx.db,
        queries: {
            findProjectByUuid: ctx.queries.findProjectByUuid,
            checkProjectAccess: ctx.queries.checkProjectAccess,
            markProjectAsSaved: ctx.queries.markProjectAsSaved,
        },
        sessionManager: ctx.sessionManager,
        auth: ctx.auth,
    });
}

/**
 * Reset all WebSocket modules to default dependencies
 * Call this in afterEach() to prevent test pollution
 */
export function resetAllModules(): void {
    resetRoomManager();
    resetYjsPersistence();
    resetYjsWebSocket();
}

// ============================================================================
// DEFAULT CONTEXT SINGLETON
// ============================================================================

let _defaultContext: CollaborationContext | null = null;

/**
 * Get the default collaboration context (singleton)
 * Creates one on first access with production defaults
 */
export function getCollaborationContext(): CollaborationContext {
    if (!_defaultContext) {
        _defaultContext = createCollaborationContext();
    }
    return _defaultContext;
}

/**
 * Reset the default context (for testing)
 */
export function resetCollaborationContext(): void {
    _defaultContext = null;
}
