import { storePendingImport, retrievePendingImport } from './pendingImport.js';

// ===========================================
// storePendingImport / retrievePendingImport (IndexedDB)
// ===========================================

describe('storePendingImport and retrievePendingImport', () => {
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
     */
    function makeFakeIndexedDB({ openError, txError, getResult, getError } = {}) {
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
            objectStoreNames: { contains: vi.fn(() => true) },
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

    it('storePendingImport stores file bytes in IndexedDB', async () => {
        makeFakeIndexedDB();
        const file = new File(['hello'], 'test.elp');
        await storePendingImport(file);
        expect(fakeStore.put).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'test.elp', bytes: expect.any(ArrayBuffer) }),
            'pending-import',
        );
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

    it('retrievePendingImport returns File from stored data', async () => {
        makeFakeIndexedDB({ getResult: { name: 'my.elp', bytes: new ArrayBuffer(4) } });
        const file = await retrievePendingImport();
        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('my.elp');
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
