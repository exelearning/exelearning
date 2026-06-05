/**
 * LRU Cache for Y.Doc instances
 *
 * Provides efficient document caching with:
 * - LRU eviction when max size is reached
 * - TTL-based expiration
 * - Automatic cleanup of inactive documents
 */
import * as Y from 'yjs';
import type { CachedDocument, DocCacheConfig } from './types';

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DocCacheConfig = {
    maxSize: 50,
    ttlMs: 5 * 60 * 1000, // 5 minutes
    cleanupIntervalMs: 60 * 1000, // 1 minute
};

// ============================================================================
// MODULE STATE
// ============================================================================

let config: DocCacheConfig = { ...DEFAULT_CONFIG };
const cache = new Map<string, CachedDocument>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// Optional room manager integration (set via configure)
let roomManagerIntegration: {
    hasActiveConnections: (projectUuid: string) => boolean;
} | null = null;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configure the document cache
 */
export function configure(newConfig: Partial<DocCacheConfig>): void {
    config = { ...DEFAULT_CONFIG, ...newConfig };

    // Restart cleanup timer with new interval
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
    }
    startCleanupTimer();
}

/**
 * Set room manager integration for checking active connections
 */
export function setRoomManagerIntegration(
    integration: { hasActiveConnections: (projectUuid: string) => boolean } | null,
): void {
    roomManagerIntegration = integration;
}

/**
 * Reset to default configuration
 */
export function resetConfig(): void {
    config = { ...DEFAULT_CONFIG };
}

/**
 * Get current configuration
 */
export function getConfig(): DocCacheConfig {
    return { ...config };
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get a cached document entry
 * Updates lastAccessedAt on access
 */
export function getDocument(projectUuid: string): CachedDocument | undefined {
    const entry = cache.get(projectUuid);
    if (entry) {
        entry.lastAccessedAt = Date.now();
    }
    return entry;
}

/**
 * Check if a document is in the cache
 */
export function hasDocument(projectUuid: string): boolean {
    return cache.has(projectUuid);
}

/**
 * Add or update a document in the cache
 * Evicts LRU document if cache is full
 */
export function setDocument(projectUuid: string, entry: CachedDocument): void {
    // Evict if at capacity and this is a new entry
    if (cache.size >= config.maxSize && !cache.has(projectUuid)) {
        evictLRU();
    }
    cache.set(projectUuid, entry);
}

/**
 * Create and cache a new document entry
 */
export function createEntry(projectUuid: string, projectId: number, ydoc: Y.Doc): CachedDocument {
    const now = Date.now();
    const entry: CachedDocument = {
        ydoc,
        projectId,
        projectUuid,
        loadedAt: now,
        lastAccessedAt: now,
        isDirty: false,
    };
    setDocument(projectUuid, entry);
    return entry;
}

/**
 * Remove a document from the cache
 * Destroys the Y.Doc to free resources
 */
export function removeDocument(projectUuid: string): boolean {
    const entry = cache.get(projectUuid);
    if (entry) {
        entry.ydoc.destroy();
        return cache.delete(projectUuid);
    }
    return false;
}

/**
 * Mark a document as dirty (has unsaved changes)
 */
export function markDirty(projectUuid: string): void {
    const entry = cache.get(projectUuid);
    if (entry) {
        entry.isDirty = true;
    }
}

/**
 * Mark a document as clean (all changes saved)
 */
export function markClean(projectUuid: string): void {
    const entry = cache.get(projectUuid);
    if (entry) {
        entry.isDirty = false;
    }
}

/**
 * Get all cached document UUIDs
 */
export function getCachedUuids(): string[] {
    return Array.from(cache.keys());
}

/**
 * Get cache statistics
 */
export function getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{
        uuid: string;
        projectId: number;
        loadedAt: number;
        lastAccessedAt: number;
        isDirty: boolean;
    }>;
} {
    return {
        size: cache.size,
        maxSize: config.maxSize,
        entries: Array.from(cache.entries()).map(([uuid, entry]) => ({
            uuid,
            projectId: entry.projectId,
            loadedAt: entry.loadedAt,
            lastAccessedAt: entry.lastAccessedAt,
            isDirty: entry.isDirty,
        })),
    };
}

// ============================================================================
// EVICTION
// ============================================================================

/**
 * Evict the least recently used document
 * Only evicts documents without active WebSocket connections
 */
function evictLRU(): void {
    let oldest: { uuid: string; time: number } | null = null;

    for (const [uuid, entry] of cache) {
        // Skip if there are active WebSocket connections
        if (roomManagerIntegration?.hasActiveConnections(uuid)) {
            continue;
        }

        if (!oldest || entry.lastAccessedAt < oldest.time) {
            oldest = { uuid, time: entry.lastAccessedAt };
        }
    }

    if (oldest) {
        removeDocument(oldest.uuid);
    }
}

/**
 * Remove all expired documents
 * Respects active WebSocket connections
 */
function cleanupExpired(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [uuid, entry] of cache) {
        // Check if expired
        if (now - entry.lastAccessedAt > config.ttlMs) {
            // Don't remove if there are active WebSocket connections
            if (roomManagerIntegration?.hasActiveConnections(uuid)) {
                // Update lastAccessedAt to prevent repeated cleanup attempts
                entry.lastAccessedAt = now;
                continue;
            }
            toRemove.push(uuid);
        }
    }

    for (const uuid of toRemove) {
        removeDocument(uuid);
    }
}

/**
 * Start the periodic cleanup timer
 */
function startCleanupTimer(): void {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
    }
    cleanupTimer = setInterval(cleanupExpired, config.cleanupIntervalMs);
}

/**
 * Stop the cleanup timer
 */
export function stopCleanupTimer(): void {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
    }
}

/**
 * Clear all cached documents
 * Destroys all Y.Doc instances
 */
export function clearAll(): void {
    for (const [uuid] of cache) {
        removeDocument(uuid);
    }
}

// Start cleanup timer on module load
startCleanupTimer();
