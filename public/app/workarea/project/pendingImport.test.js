import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    storePendingImport,
    retrievePendingImport,
    PENDING_IMPORT_DB,
    PENDING_IMPORT_STORE,
    PENDING_IMPORT_KEY,
} from './pendingImport.js';

describe('pendingImport', () => {
    let fakeDb;
    let fakeStore;
    let fakeTx;

    /**
     * Build a fake IndexedDB mock.
     * For storePendingImport the tx.oncomplete fires right after transaction().
     * For retrievePendingImport the get().onsuccess sets tx.oncomplete, so we
     * need get().onsuccess to fire first, then tx.oncomplete after it.
     *
     * @param {Object} opts
     * @param {Error}  [opts.openError]   - make indexedDB.open fail
     * @param {Error}  [opts.txError]     - make tx.onerror fire
     * @param {*}      [opts.getResult]   - value returned by store.get().result
     * @param {boolean}[opts.getError]    - make get request fire onerror
     * @param {boolean}[opts.missingStore]- object store does not exist yet
     */
    function makeFakeIndexedDB({ openError, txError, getResult, getError, missingStore } = {}) {
        fakeTx = {
            objectStore: null, // set below
            oncomplete: null,
            onerror: null,
        };

        fakeStore = {
            put: vi.fn(),
            delete: vi.fn(),
            get: vi.fn(() => {
                const req = { result: getResult, onsuccess: null, onerror: null };
                Promise.resolve().then(() => {
                    if (getError) {
                        req.onerror?.();
                    } else {
                        req.onsuccess?.();
                        // After onsuccess runs (which may set tx.oncomplete), fire it
                        Promise.resolve().then(() => fakeTx.oncomplete?.());
                    }
                });
                return req;
            }),
        };

        fakeTx.objectStore = vi.fn(() => fakeStore);

        fakeDb = {
            objectStoreNames: { contains: vi.fn(() => !missingStore) },
            createObjectStore: vi.fn(),
            transaction: vi.fn(() => {
                if (txError) {
                    Promise.resolve().then(() => {
                        fakeTx.error = txError;
                        fakeTx.onerror?.();
                    });
                } else {
                    // For storePendingImport: oncomplete is set synchronously after put(),
                    // so we fire it on next microtick.
                    Promise.resolve().then(() => fakeTx.oncomplete?.());
                }
                return fakeTx;
            }),
            close: vi.fn(),
        };

        const fakeRequest = {
            result: fakeDb,
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null,
        };
        global.indexedDB = {
            open: vi.fn(() => {
                if (openError) {
                    Promise.resolve().then(() => {
                        fakeRequest.error = openError;
                        fakeRequest.onerror?.();
                    });
                } else {
                    Promise.resolve().then(() => {
                        fakeRequest.onupgradeneeded?.();
                        fakeRequest.onsuccess?.();
                    });
                }
                return fakeRequest;
            }),
        };
    }

    afterEach(() => {
        delete global.indexedDB;
    });

    it('exposes the shared DB / store / key contract', () => {
        expect(PENDING_IMPORT_DB).toBe('exelearning-pending-import');
        expect(PENDING_IMPORT_STORE).toBe('files');
        expect(PENDING_IMPORT_KEY).toBe('pending-import');
    });

    it('storePendingImport stores file bytes in IndexedDB under the shared key', async () => {
        makeFakeIndexedDB();
        const file = new File(['hello'], 'test.elp');
        await storePendingImport(file);
        expect(fakeStore.put).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'test.elp', bytes: expect.any(ArrayBuffer) }),
            PENDING_IMPORT_KEY,
        );
    });

    it('storePendingImport creates the object store when missing', async () => {
        makeFakeIndexedDB({ missingStore: true });
        const file = new File(['x'], 'c.elp');
        await storePendingImport(file);
        expect(fakeDb.createObjectStore).toHaveBeenCalledWith(PENDING_IMPORT_STORE);
    });

    it('storePendingImport rejects on IDB open error', async () => {
        makeFakeIndexedDB({ openError: new Error('IDB open failed') });
        const file = new File(['x'], 'a.elp');
        await expect(storePendingImport(file)).rejects.toThrow('IDB open failed');
    });

    it('storePendingImport rejects on transaction error', async () => {
        makeFakeIndexedDB({ txError: new Error('tx error') });
        const file = new File(['x'], 'b.elp');
        await expect(storePendingImport(file)).rejects.toThrow('tx error');
    });

    it('retrievePendingImport returns a File from stored data', async () => {
        makeFakeIndexedDB({ getResult: { name: 'my.elp', bytes: new ArrayBuffer(4) } });
        const file = await retrievePendingImport();
        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('my.elp');
        // Round-trip should remove the entry so it is consumed exactly once.
        expect(fakeStore.delete).toHaveBeenCalledWith(PENDING_IMPORT_KEY);
    });

    it('retrievePendingImport creates the object store when missing', async () => {
        makeFakeIndexedDB({ getResult: { name: 'fresh.elp', bytes: new ArrayBuffer(2) }, missingStore: true });
        const file = await retrievePendingImport();
        expect(fakeDb.createObjectStore).toHaveBeenCalledWith(PENDING_IMPORT_STORE);
        expect(file).toBeInstanceOf(File);
    });

    it('retrievePendingImport returns null when no data exists', async () => {
        makeFakeIndexedDB({ getResult: undefined });
        const result = await retrievePendingImport();
        expect(result).toBeNull();
    });

    it('retrievePendingImport returns null on IDB open error', async () => {
        makeFakeIndexedDB({ openError: new Error('open fail') });
        const result = await retrievePendingImport();
        expect(result).toBeNull();
    });

    it('retrievePendingImport returns null on get request error', async () => {
        makeFakeIndexedDB({ getError: true });
        const result = await retrievePendingImport();
        expect(result).toBeNull();
    });
});
