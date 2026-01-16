/**
 * Y.Doc Cache Tests
 *
 * Tests for the LRU cache with TTL for Y.Doc instances.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as Y from 'yjs';
import {
    configure,
    resetConfig,
    getConfig,
    createEntry,
    getDocument,
    hasDocument,
    removeDocument,
    markDirty,
    markClean,
    getCachedUuids,
    getStats,
    stopCleanupTimer,
    clearAll,
    setRoomManagerIntegration,
} from './doc-cache';

describe('doc-cache', () => {
    beforeEach(() => {
        // Reset to defaults and clear cache before each test
        resetConfig();
        clearAll();
    });

    afterEach(() => {
        // Stop cleanup timer and clear cache after tests
        stopCleanupTimer();
        clearAll();
    });

    describe('configure', () => {
        it('should use default configuration', () => {
            const config = getConfig();
            expect(config.maxSize).toBe(50);
            expect(config.ttlMs).toBe(5 * 60 * 1000); // 5 minutes
            expect(config.cleanupIntervalMs).toBe(60 * 1000); // 1 minute
        });

        it('should allow custom configuration', () => {
            configure({
                maxSize: 100,
                ttlMs: 10 * 60 * 1000,
            });

            const config = getConfig();
            expect(config.maxSize).toBe(100);
            expect(config.ttlMs).toBe(10 * 60 * 1000);
        });

        it('should reset to defaults', () => {
            configure({ maxSize: 100 });
            resetConfig();

            const config = getConfig();
            expect(config.maxSize).toBe(50);
        });
    });

    describe('createEntry', () => {
        it('should create a cache entry', () => {
            const ydoc = new Y.Doc();
            const entry = createEntry('uuid-1', 1, ydoc);

            expect(entry.projectUuid).toBe('uuid-1');
            expect(entry.projectId).toBe(1);
            expect(entry.ydoc).toBe(ydoc);
            expect(entry.isDirty).toBe(false);
            expect(typeof entry.lastAccessedAt).toBe('number');
            expect(typeof entry.loadedAt).toBe('number');
        });

        it('should add entry to cache', () => {
            const ydoc = new Y.Doc();
            createEntry('uuid-1', 1, ydoc);

            expect(hasDocument('uuid-1')).toBe(true);
        });
    });

    describe('getDocument / setDocument', () => {
        it('should return undefined for non-existent document', () => {
            expect(getDocument('non-existent')).toBeUndefined();
        });

        it('should get and set documents', () => {
            const ydoc = new Y.Doc();
            const entry = createEntry('uuid-1', 1, ydoc);

            const retrieved = getDocument('uuid-1');
            expect(retrieved).toBe(entry);
        });

        it('should update lastAccessedAt on get', async () => {
            const ydoc = new Y.Doc();
            createEntry('uuid-1', 1, ydoc);

            const before = getDocument('uuid-1')!.lastAccessedAt;
            await new Promise(resolve => setTimeout(resolve, 10));
            const after = getDocument('uuid-1')!.lastAccessedAt;

            expect(after).toBeGreaterThanOrEqual(before);
        });
    });

    describe('hasDocument', () => {
        it('should return false for non-existent document', () => {
            expect(hasDocument('non-existent')).toBe(false);
        });

        it('should return true for existing document', () => {
            const ydoc = new Y.Doc();
            createEntry('uuid-1', 1, ydoc);

            expect(hasDocument('uuid-1')).toBe(true);
        });
    });

    describe('removeDocument', () => {
        it('should return false for non-existent document', () => {
            expect(removeDocument('non-existent')).toBe(false);
        });

        it('should remove existing document', () => {
            const ydoc = new Y.Doc();
            createEntry('uuid-1', 1, ydoc);

            expect(removeDocument('uuid-1')).toBe(true);
            expect(hasDocument('uuid-1')).toBe(false);
        });
    });

    describe('markDirty / markClean', () => {
        it('should mark document as dirty', () => {
            const ydoc = new Y.Doc();
            createEntry('uuid-1', 1, ydoc);

            markDirty('uuid-1');

            const entry = getDocument('uuid-1');
            expect(entry?.isDirty).toBe(true);
        });

        it('should mark document as clean', () => {
            const ydoc = new Y.Doc();
            createEntry('uuid-1', 1, ydoc);
            markDirty('uuid-1');
            markClean('uuid-1');

            const entry = getDocument('uuid-1');
            expect(entry?.isDirty).toBe(false);
        });
    });

    describe('getCachedUuids', () => {
        it('should return empty array when no documents cached', () => {
            expect(getCachedUuids()).toEqual([]);
        });

        it('should return all cached UUIDs', () => {
            const ydoc1 = new Y.Doc();
            const ydoc2 = new Y.Doc();
            createEntry('uuid-1', 1, ydoc1);
            createEntry('uuid-2', 2, ydoc2);

            const uuids = getCachedUuids();
            expect(uuids).toContain('uuid-1');
            expect(uuids).toContain('uuid-2');
            expect(uuids.length).toBe(2);
        });
    });

    describe('getStats', () => {
        it('should return correct stats', () => {
            const ydoc1 = new Y.Doc();
            const ydoc2 = new Y.Doc();
            createEntry('uuid-1', 1, ydoc1);
            createEntry('uuid-2', 2, ydoc2);
            markDirty('uuid-1');

            const stats = getStats();
            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(50);
            expect(stats.entries.length).toBe(2);
        });
    });

    describe('clearAll', () => {
        it('should clear all documents', () => {
            const ydoc1 = new Y.Doc();
            const ydoc2 = new Y.Doc();
            createEntry('uuid-1', 1, ydoc1);
            createEntry('uuid-2', 2, ydoc2);

            clearAll();

            expect(getCachedUuids()).toEqual([]);
            expect(getStats().size).toBe(0);
        });
    });

    describe('LRU eviction', () => {
        it('should evict when max size reached', () => {
            configure({ maxSize: 2 });

            // Add 2 documents
            const ydoc1 = new Y.Doc();
            const ydoc2 = new Y.Doc();
            createEntry('uuid-1', 1, ydoc1);
            createEntry('uuid-2', 2, ydoc2);

            expect(hasDocument('uuid-1')).toBe(true);
            expect(hasDocument('uuid-2')).toBe(true);

            // Add another document - should evict one
            const ydoc3 = new Y.Doc();
            createEntry('uuid-3', 3, ydoc3);

            // One of the original documents should be evicted
            const count = [hasDocument('uuid-1'), hasDocument('uuid-2'), hasDocument('uuid-3')].filter(Boolean).length;
            expect(count).toBe(2); // Should have exactly 2 documents
            expect(hasDocument('uuid-3')).toBe(true); // New one should exist
        });
    });

    describe('room manager integration', () => {
        it('should not evict documents with active connections', () => {
            configure({ maxSize: 2 });

            // Mock room manager
            setRoomManagerIntegration({
                hasActiveConnections: (uuid: string) => uuid === 'uuid-1',
            });

            const ydoc1 = new Y.Doc();
            const ydoc2 = new Y.Doc();
            createEntry('uuid-1', 1, ydoc1);
            createEntry('uuid-2', 2, ydoc2);

            // Add another - should evict uuid-2 (uuid-1 has active connections)
            const ydoc3 = new Y.Doc();
            createEntry('uuid-3', 3, ydoc3);

            expect(hasDocument('uuid-1')).toBe(true); // Kept (active connections)
            expect(hasDocument('uuid-2')).toBe(false); // Evicted
            expect(hasDocument('uuid-3')).toBe(true);

            // Reset room manager integration
            setRoomManagerIntegration(null);
        });
    });

    describe('configure with existing timer', () => {
        it('should restart cleanup timer when reconfiguring', () => {
            // First configure - starts a timer
            configure({ maxSize: 10, cleanupIntervalMs: 10000 });

            // Second configure - should clear existing timer and start new one
            configure({ maxSize: 20, cleanupIntervalMs: 20000 });

            const config = getConfig();
            expect(config.maxSize).toBe(20);
            expect(config.cleanupIntervalMs).toBe(20000);
        });
    });

    describe('TTL expiration', () => {
        it('should expire documents after TTL', async () => {
            // Set very short TTL and cleanup interval
            configure({
                ttlMs: 50, // 50ms TTL
                cleanupIntervalMs: 30, // 30ms cleanup interval
            });

            const ydoc = new Y.Doc();
            createEntry('uuid-expire', 1, ydoc);

            expect(hasDocument('uuid-expire')).toBe(true);

            // Wait for TTL to expire and cleanup to run
            await new Promise(resolve => setTimeout(resolve, 150));

            // Document should be expired and removed
            expect(hasDocument('uuid-expire')).toBe(false);
        });

        it('should not expire documents with active connections', async () => {
            // Set very short TTL and cleanup interval
            configure({
                ttlMs: 50,
                cleanupIntervalMs: 30,
            });

            // Mock room manager - document has active connections
            setRoomManagerIntegration({
                hasActiveConnections: (uuid: string) => uuid === 'uuid-active',
            });

            const ydoc = new Y.Doc();
            createEntry('uuid-active', 1, ydoc);

            expect(hasDocument('uuid-active')).toBe(true);

            // Wait for TTL to expire and cleanup to run
            await new Promise(resolve => setTimeout(resolve, 150));

            // Document should still exist (has active connections)
            expect(hasDocument('uuid-active')).toBe(true);

            // Cleanup
            setRoomManagerIntegration(null);
        });
    });

    describe('LRU eviction with all connected', () => {
        it('should not evict any document when all have active connections', () => {
            configure({ maxSize: 2 });

            // Mock room manager - all documents have active connections
            setRoomManagerIntegration({
                hasActiveConnections: () => true,
            });

            const ydoc1 = new Y.Doc();
            const ydoc2 = new Y.Doc();
            createEntry('uuid-a', 1, ydoc1);
            createEntry('uuid-b', 2, ydoc2);

            // Add another - should not evict anyone since all have connections
            const ydoc3 = new Y.Doc();
            createEntry('uuid-c', 3, ydoc3);

            // All three should exist because no eviction happened
            expect(hasDocument('uuid-a')).toBe(true);
            expect(hasDocument('uuid-b')).toBe(true);
            expect(hasDocument('uuid-c')).toBe(true);
            expect(getStats().size).toBe(3); // Exceeds maxSize but no eviction

            // Cleanup
            setRoomManagerIntegration(null);
        });
    });
});
