import type * as Y from 'yjs';
import type { DocManagerDependencies } from '../../src/yjs/doc-manager';

/**
 * No-op cache, lock and broadcaster for configureDocManager(), so a test only supplies
 * the db, queries and persistence it cares about: every load goes to persistence.
 */
export function noopDocManagerRuntime(): Pick<DocManagerDependencies, 'cache' | 'lock' | 'broadcaster'> {
    return {
        cache: {
            getDocument: () => undefined,
            createEntry: (uuid: string, projectId: number, ydoc: Y.Doc) => ({
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
        } as unknown as DocManagerDependencies['cache'],
        lock: {
            acquireLock: async () => () => {},
            getStats: () => ({ activeLocks: 0, locks: [] }),
        } as unknown as DocManagerDependencies['lock'],
        broadcaster: {
            broadcastUpdate: () => true,
        } as unknown as DocManagerDependencies['broadcaster'],
    };
}
