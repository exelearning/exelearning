/**
 * Y.Doc Manager for Server-Side Operations
 *
 * Orchestrates loading, modifying, and saving Yjs documents.
 * Provides atomic operations with locking and automatic broadcasting.
 *
 * Usage:
 * ```ts
 * const result = await withDocument(projectUuid, origin, (ydoc) => {
 *     // Make changes to ydoc
 *     return { success: true };
 * });
 * ```
 */
import * as Y from 'yjs';
import * as docCache from './doc-cache';
import * as docLock from './doc-lock';
import * as broadcaster from './broadcaster';
import * as yjsPersistenceDefault from '../websocket/yjs-persistence';
import { findProjectByUuid as findProjectByUuidDefault } from '../db/queries';
import { db as defaultDb } from '../db/client';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import type { ChangeOrigin, CachedDocument, TransactionResult } from './types';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface DocManagerDependencies {
    db: Kysely<Database>;
    queries: {
        findProjectByUuid: typeof findProjectByUuidDefault;
    };
    persistence: {
        reconstructDocument: typeof yjsPersistenceDefault.reconstructDocument;
        saveFullState: typeof yjsPersistenceDefault.saveFullState;
        loadDocument: typeof yjsPersistenceDefault.loadDocument;
    };
    cache: typeof docCache;
    lock: typeof docLock;
    broadcaster: typeof broadcaster;
}

const defaultDependencies: DocManagerDependencies = {
    db: defaultDb,
    queries: {
        findProjectByUuid: findProjectByUuidDefault,
    },
    persistence: {
        reconstructDocument: yjsPersistenceDefault.reconstructDocument,
        saveFullState: yjsPersistenceDefault.saveFullState,
        loadDocument: yjsPersistenceDefault.loadDocument,
    },
    cache: docCache,
    lock: docLock,
    broadcaster: broadcaster,
};

let deps: DocManagerDependencies = defaultDependencies;

/**
 * Configure dependencies (mainly for testing)
 */
export function configure(newDeps: Partial<DocManagerDependencies>): void {
    deps = {
        ...defaultDependencies,
        ...newDeps,
        queries: {
            ...defaultDependencies.queries,
            ...(newDeps.queries || {}),
        },
        persistence: {
            ...defaultDependencies.persistence,
            ...(newDeps.persistence || {}),
        },
    };
}

/**
 * Reset to default dependencies
 */
export function resetDependencies(): void {
    deps = defaultDependencies;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error thrown when a project is not found
 */
export class ProjectNotFoundError extends Error {
    constructor(public projectUuid: string) {
        super(`Project not found: ${projectUuid}`);
        this.name = 'ProjectNotFoundError';
    }
}

/**
 * Error thrown when document cannot be loaded
 */
export class DocumentLoadError extends Error {
    constructor(
        public projectUuid: string,
        cause?: Error,
    ) {
        super(`Failed to load document for project ${projectUuid}: ${cause?.message || 'unknown error'}`);
        this.name = 'DocumentLoadError';
        this.cause = cause;
    }
}

// ============================================================================
// DOCUMENT OPERATIONS
// ============================================================================

/**
 * Get project info by UUID
 * Throws ProjectNotFoundError if not found
 */
export async function getProjectByUuid(
    projectUuid: string,
): Promise<{ id: number; uuid: string; title: string | null }> {
    const project = await deps.queries.findProjectByUuid(deps.db, projectUuid);

    if (!project) {
        throw new ProjectNotFoundError(projectUuid);
    }

    return {
        id: project.id,
        uuid: project.uuid,
        title: project.title,
    };
}

/**
 * Get or load a Y.Doc for a project
 *
 * @param projectUuid - The project UUID
 * @returns The cached document entry and project ID
 */
export async function getDocument(projectUuid: string): Promise<{ entry: CachedDocument; projectId: number }> {
    // Check cache first
    const cached = deps.cache.getDocument(projectUuid);
    if (cached) {
        return { entry: cached, projectId: cached.projectId };
    }

    // Get project info
    const project = await getProjectByUuid(projectUuid);

    // Load from database
    try {
        const ydoc = await deps.persistence.reconstructDocument(project.id);
        const entry = deps.cache.createEntry(projectUuid, project.id, ydoc);
        return { entry, projectId: project.id };
    } catch (error) {
        throw new DocumentLoadError(projectUuid, error instanceof Error ? error : undefined);
    }
}

/**
 * Execute an operation on a Y.Doc with locking, persistence, and broadcasting
 *
 * This is the main entry point for modifying documents from REST API:
 * 1. Acquires a lock on the project
 * 2. Loads the document (from cache or database)
 * 3. Captures the state vector before changes
 * 4. Executes the operation in a Yjs transaction
 * 5. Calculates the delta (changes only)
 * 6. Persists the full state to database
 * 7. Broadcasts the delta to connected WebSocket clients
 * 8. Releases the lock
 *
 * @param projectUuid - The project UUID
 * @param origin - Change origin for tracking
 * @param operation - Function to execute with the Y.Doc
 * @returns The operation result and the Yjs update
 */
export async function withDocument<T>(
    projectUuid: string,
    origin: ChangeOrigin,
    operation: (ydoc: Y.Doc) => T,
): Promise<TransactionResult<T>> {
    const release = await deps.lock.acquireLock(projectUuid);

    try {
        const { entry, projectId } = await getDocument(projectUuid);
        const ydoc = entry.ydoc;

        // Capture state before changes
        const stateVectorBefore = Y.encodeStateVector(ydoc);

        // Execute operation in transaction
        let result: T;
        ydoc.transact(() => {
            result = operation(ydoc);
        }, origin);

        // Calculate delta (only the changes)
        const update = Y.encodeStateAsUpdate(ydoc, stateVectorBefore);

        // Mark as dirty
        deps.cache.markDirty(projectUuid);

        // Persist full state to database
        const fullState = Y.encodeStateAsUpdate(ydoc);
        await deps.persistence.saveFullState(projectId, fullState);
        deps.cache.markClean(projectUuid);

        // Broadcast to connected WebSocket clients
        if (update.length > 0) {
            const broadcasted = deps.broadcaster.broadcastUpdate(projectUuid, update);
            console.log(
                `[DocManager] Broadcast ${update.length} bytes to ${projectUuid}: ${broadcasted ? 'SUCCESS' : 'NO_CLIENTS'}`,
            );
        } else {
            console.log(`[DocManager] No changes to broadcast for ${projectUuid}`);
        }

        return { result: result!, update };
    } finally {
        release();
    }
}

/**
 * Read document structure without modification
 * Does not acquire lock (read-only operation)
 *
 * @param projectUuid - The project UUID
 * @param reader - Function to read from the Y.Doc
 * @returns The reader result
 */
export async function readDocument<T>(projectUuid: string, reader: (ydoc: Y.Doc) => T): Promise<T> {
    const { entry } = await getDocument(projectUuid);
    return reader(entry.ydoc);
}

/**
 * Ensure a project has a Yjs document initialized
 * Creates an empty document if none exists
 *
 * @param projectUuid - The project UUID
 * @returns The project ID
 */
export async function ensureDocument(projectUuid: string): Promise<number> {
    const project = await getProjectByUuid(projectUuid);

    // Check if document exists
    const state = await deps.persistence.loadDocument(project.id);

    if (!state) {
        // Create empty document with default structure
        const ydoc = new Y.Doc();

        // Initialize with empty navigation array and metadata map
        ydoc.getArray('navigation');
        ydoc.getMap('metadata');
        ydoc.getMap('assets');

        // Save to database
        const fullState = Y.encodeStateAsUpdate(ydoc);
        await deps.persistence.saveFullState(project.id, fullState);

        // Destroy temporary document (will be recreated on next access)
        ydoc.destroy();
    }

    return project.id;
}

/**
 * Invalidate cached document (forces reload on next access)
 *
 * @param projectUuid - The project UUID
 */
export function invalidateCache(projectUuid: string): void {
    deps.cache.removeDocument(projectUuid);
}

/**
 * Get cache and lock statistics
 */
export function getStats(): {
    cache: ReturnType<typeof docCache.getStats>;
    locks: ReturnType<typeof docLock.getStats>;
} {
    return {
        cache: deps.cache.getStats(),
        locks: deps.lock.getStats(),
    };
}
