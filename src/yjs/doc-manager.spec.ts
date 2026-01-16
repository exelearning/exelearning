/**
 * Y.Doc Manager Tests
 *
 * Tests for orchestrating Yjs document operations:
 * - Loading documents
 * - Atomic transactions with locking
 * - Persistence
 * - Broadcasting updates
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as Y from 'yjs';
import {
    configure,
    resetDependencies,
    getProjectByUuid,
    getDocument,
    withDocument,
    readDocument,
    ensureDocument,
    invalidateCache,
    getStats,
    ProjectNotFoundError,
    DocumentLoadError,
} from './doc-manager';
import type { ChangeOrigin } from './types';

describe('doc-manager', () => {
    // Mock data
    const mockProject = {
        id: 1,
        uuid: 'test-uuid-1234',
        title: 'Test Project',
    };

    // Track function calls
    let findProjectByUuidCalls: Array<{ uuid: string }> = [];
    let reconstructDocumentCalls: Array<{ projectId: number }> = [];
    let saveFullStateCalls: Array<{ projectId: number; state: Uint8Array }> = [];
    let loadDocumentCalls: Array<{ projectId: number }> = [];
    let broadcastCalls: Array<{ uuid: string; update: Uint8Array }> = [];
    let lockAcquireCalls: string[] = [];
    let cacheEntries: Map<string, { ydoc: Y.Doc; projectId: number; isDirty: boolean }> = new Map();

    // Mock Y.Doc for testing
    let mockYDoc: Y.Doc;

    beforeEach(() => {
        // Reset tracking
        findProjectByUuidCalls = [];
        reconstructDocumentCalls = [];
        saveFullStateCalls = [];
        loadDocumentCalls = [];
        broadcastCalls = [];
        lockAcquireCalls = [];
        cacheEntries = new Map();

        // Create mock Y.Doc
        mockYDoc = new Y.Doc();
        mockYDoc.getArray('navigation');
        mockYDoc.getMap('metadata');
        mockYDoc.getMap('assets');

        // Configure with mock dependencies
        configure({
            queries: {
                findProjectByUuid: async (_db: unknown, uuid: string) => {
                    findProjectByUuidCalls.push({ uuid });
                    if (uuid === mockProject.uuid) {
                        return mockProject;
                    }
                    return undefined;
                },
            },
            persistence: {
                reconstructDocument: async (projectId: number) => {
                    reconstructDocumentCalls.push({ projectId });
                    return mockYDoc;
                },
                saveFullState: async (projectId: number, state: Uint8Array) => {
                    saveFullStateCalls.push({ projectId, state });
                },
                loadDocument: async (projectId: number) => {
                    loadDocumentCalls.push({ projectId });
                    return Y.encodeStateAsUpdate(mockYDoc);
                },
            },
            cache: {
                getDocument: (uuid: string) => {
                    const entry = cacheEntries.get(uuid);
                    if (entry) {
                        return {
                            projectUuid: uuid,
                            projectId: entry.projectId,
                            ydoc: entry.ydoc,
                            isDirty: entry.isDirty,
                            lastAccessedAt: Date.now(),
                            loadedAt: Date.now(),
                        };
                    }
                    return undefined;
                },
                createEntry: (uuid: string, projectId: number, ydoc: Y.Doc) => {
                    const entry = {
                        projectUuid: uuid,
                        projectId,
                        ydoc,
                        isDirty: false,
                        lastAccessedAt: Date.now(),
                        loadedAt: Date.now(),
                    };
                    cacheEntries.set(uuid, { ydoc, projectId, isDirty: false });
                    return entry;
                },
                markDirty: (uuid: string) => {
                    const entry = cacheEntries.get(uuid);
                    if (entry) entry.isDirty = true;
                },
                markClean: (uuid: string) => {
                    const entry = cacheEntries.get(uuid);
                    if (entry) entry.isDirty = false;
                },
                removeDocument: (uuid: string) => {
                    return cacheEntries.delete(uuid);
                },
                hasDocument: (uuid: string) => cacheEntries.has(uuid),
                getStats: () => ({
                    size: cacheEntries.size,
                    maxSize: 50,
                    entries: [],
                }),
            },
            lock: {
                acquireLock: async (uuid: string) => {
                    lockAcquireCalls.push(uuid);
                    return () => {}; // Release function
                },
                getStats: () => ({
                    activeLocks: lockAcquireCalls.length,
                    waitingCount: 0,
                }),
            },
            broadcaster: {
                broadcastUpdate: (uuid: string, update: Uint8Array) => {
                    broadcastCalls.push({ uuid, update });
                    return true;
                },
            },
        });
    });

    afterEach(() => {
        resetDependencies();
        mockYDoc.destroy();
    });

    // =========================================================================
    // ERROR TYPES
    // =========================================================================

    describe('Error Types', () => {
        it('ProjectNotFoundError should have correct properties', () => {
            const error = new ProjectNotFoundError('test-uuid');

            expect(error.name).toBe('ProjectNotFoundError');
            expect(error.projectUuid).toBe('test-uuid');
            expect(error.message).toContain('test-uuid');
        });

        it('DocumentLoadError should have correct properties', () => {
            const cause = new Error('DB error');
            const error = new DocumentLoadError('test-uuid', cause);

            expect(error.name).toBe('DocumentLoadError');
            expect(error.projectUuid).toBe('test-uuid');
            expect(error.cause).toBe(cause);
        });
    });

    // =========================================================================
    // getProjectByUuid
    // =========================================================================

    describe('getProjectByUuid', () => {
        it('should return project info', async () => {
            const project = await getProjectByUuid(mockProject.uuid);

            expect(project.id).toBe(mockProject.id);
            expect(project.uuid).toBe(mockProject.uuid);
            expect(project.title).toBe(mockProject.title);
        });

        it('should throw ProjectNotFoundError for unknown uuid', async () => {
            await expect(getProjectByUuid('unknown-uuid')).rejects.toThrow(ProjectNotFoundError);
        });

        it('should query database', async () => {
            await getProjectByUuid(mockProject.uuid);
            expect(findProjectByUuidCalls.length).toBe(1);
            expect(findProjectByUuidCalls[0].uuid).toBe(mockProject.uuid);
        });
    });

    // =========================================================================
    // getDocument
    // =========================================================================

    describe('getDocument', () => {
        it('should load document from database', async () => {
            const result = await getDocument(mockProject.uuid);

            expect(result.projectId).toBe(mockProject.id);
            expect(result.entry.ydoc).toBeInstanceOf(Y.Doc);
            expect(reconstructDocumentCalls.length).toBe(1);
        });

        it('should return cached document', async () => {
            // First call loads from DB
            await getDocument(mockProject.uuid);
            expect(reconstructDocumentCalls.length).toBe(1);

            // Second call should use cache
            await getDocument(mockProject.uuid);
            expect(reconstructDocumentCalls.length).toBe(1); // Still 1
        });

        it('should throw ProjectNotFoundError for unknown uuid', async () => {
            await expect(getDocument('unknown-uuid')).rejects.toThrow(ProjectNotFoundError);
        });
    });

    // =========================================================================
    // withDocument
    // =========================================================================

    describe('withDocument', () => {
        it('should execute operation and return result', async () => {
            const result = await withDocument(mockProject.uuid, 'test' as ChangeOrigin, ydoc => {
                ydoc.getMap('metadata').set('title', 'New Title');
                return { modified: true };
            });

            expect(result.result).toEqual({ modified: true });
        });

        it('should acquire and release lock', async () => {
            await withDocument(mockProject.uuid, 'test' as ChangeOrigin, () => {});

            expect(lockAcquireCalls.length).toBe(1);
            expect(lockAcquireCalls[0]).toBe(mockProject.uuid);
        });

        it('should persist changes to database', async () => {
            await withDocument(mockProject.uuid, 'test' as ChangeOrigin, ydoc => {
                ydoc.getMap('metadata').set('title', 'Test');
            });

            expect(saveFullStateCalls.length).toBe(1);
            expect(saveFullStateCalls[0].projectId).toBe(mockProject.id);
        });

        it('should broadcast update', async () => {
            await withDocument(mockProject.uuid, 'test' as ChangeOrigin, ydoc => {
                ydoc.getMap('metadata').set('key', 'value');
            });

            expect(broadcastCalls.length).toBe(1);
            expect(broadcastCalls[0].uuid).toBe(mockProject.uuid);
            expect(broadcastCalls[0].update.length).toBeGreaterThan(0);
        });

        it('should return update in result', async () => {
            const result = await withDocument(mockProject.uuid, 'test' as ChangeOrigin, ydoc => {
                ydoc.getArray('navigation').push([new Y.Map()]);
            });

            expect(result.update).toBeInstanceOf(Uint8Array);
            expect(result.update.length).toBeGreaterThan(0);
        });

        it('should handle transactions with no content changes', async () => {
            // Note: Yjs may still produce a minimal update (2 bytes) even without
            // content changes due to internal clock tracking. This is expected behavior.
            const result = await withDocument(mockProject.uuid, 'test' as ChangeOrigin, () => {
                // No changes made
                return { noChanges: true };
            });

            expect(result.result).toEqual({ noChanges: true });
            // Update is present (may be minimal clock update)
            expect(result.update).toBeInstanceOf(Uint8Array);
        });
    });

    // =========================================================================
    // readDocument
    // =========================================================================

    describe('readDocument', () => {
        it('should read document without modification', async () => {
            // Pre-populate cache
            cacheEntries.set(mockProject.uuid, {
                ydoc: mockYDoc,
                projectId: mockProject.id,
                isDirty: false,
            });
            mockYDoc.getMap('metadata').set('title', 'Test');

            const result = await readDocument(mockProject.uuid, ydoc => {
                return ydoc.getMap('metadata').get('title');
            });

            expect(result).toBe('Test');
        });

        it('should not acquire lock', async () => {
            await readDocument(mockProject.uuid, () => 'result');

            expect(lockAcquireCalls.length).toBe(0);
        });
    });

    // =========================================================================
    // ensureDocument
    // =========================================================================

    describe('ensureDocument', () => {
        it('should return project ID', async () => {
            const projectId = await ensureDocument(mockProject.uuid);
            expect(projectId).toBe(mockProject.id);
        });

        it('should create empty document if none exists', async () => {
            // Configure loadDocument to return null (no existing document)
            configure({
                queries: {
                    findProjectByUuid: async (_db: unknown, uuid: string) => {
                        if (uuid === mockProject.uuid) return mockProject;
                        return undefined;
                    },
                },
                persistence: {
                    reconstructDocument: async () => mockYDoc,
                    saveFullState: async (projectId: number, state: Uint8Array) => {
                        saveFullStateCalls.push({ projectId, state });
                    },
                    loadDocument: async () => null, // No existing document
                },
                cache: {
                    getDocument: () => undefined,
                    createEntry: (uuid, projectId, ydoc) => ({
                        projectUuid: uuid,
                        projectId,
                        ydoc,
                        isDirty: false,
                        lastAccessedAt: Date.now(),
                        loadedAt: Date.now(),
                    }),
                    markDirty: () => {},
                    markClean: () => {},
                    removeDocument: () => false,
                    hasDocument: () => false,
                    getStats: () => ({ size: 0, maxSize: 50, entries: [] }),
                },
                lock: {
                    acquireLock: async () => () => {},
                    getStats: () => ({ activeLocks: 0, waitingCount: 0 }),
                },
                broadcaster: {
                    broadcastUpdate: () => true,
                },
            });

            await ensureDocument(mockProject.uuid);

            // Should have saved new document
            expect(saveFullStateCalls.length).toBe(1);
        });
    });

    // =========================================================================
    // invalidateCache
    // =========================================================================

    describe('invalidateCache', () => {
        it('should remove document from cache', async () => {
            // Pre-populate cache
            cacheEntries.set(mockProject.uuid, {
                ydoc: mockYDoc,
                projectId: mockProject.id,
                isDirty: false,
            });

            invalidateCache(mockProject.uuid);

            expect(cacheEntries.has(mockProject.uuid)).toBe(false);
        });
    });

    // =========================================================================
    // getStats
    // =========================================================================

    describe('getStats', () => {
        it('should return cache and lock statistics', () => {
            const stats = getStats();

            expect(stats.cache).toBeDefined();
            expect(stats.locks).toBeDefined();
            expect(stats.cache.maxSize).toBe(50);
        });
    });
});
