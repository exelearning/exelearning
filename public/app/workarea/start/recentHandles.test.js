import {
    MAX_RECENT_HANDLES,
    createHandleStore,
    isRecentHandlesSupported,
    listRecentHandles,
    openRecentHandle,
    pickProjectFile,
    rememberDroppedFile,
    rememberHandle,
} from './recentHandles.js';

function memoryStore(initial = []) {
    const records = new Map(initial.map((record) => [record.id, record]));
    return {
        records,
        getAll: vi.fn(async () => [...records.values()]),
        put: vi.fn(async (record) => void records.set(record.id, record)),
        delete: vi.fn(async (id) => void records.delete(id)),
    };
}

function fakeHandle(name, { permission = 'granted', afterRequest = 'granted', file, kind = 'file' } = {}) {
    const handle = {
        kind,
        name,
        isSameEntry: vi.fn(async (other) => other === handle || other.name === name),
        queryPermission: vi.fn(async () => permission),
        requestPermission: vi.fn(async () => afterRequest),
        getFile: vi.fn(async () => file || new File(['x'], name)),
    };
    return handle;
}

/** A minimal IndexedDB: one object store keyed by `id`, requests settle before the transaction completes. */
function fakeIndexedDB({ openError, txError } = {}) {
    const data = new Map();
    const state = { upgrades: 0, closed: 0 };
    const factory = {
        data,
        state,
        open: vi.fn(() => {
            const request = { result: null, error: openError || null };
            queueMicrotask(() => {
                if (openError) return request.onerror?.();
                const db = {
                    createObjectStore: vi.fn(),
                    close: () => {
                        state.closed += 1;
                    },
                    transaction: () => {
                        const tx = { error: txError || null };
                        tx.objectStore = () => ({
                            getAll: () => ({ result: [...data.values()] }),
                            put: (record) => {
                                data.set(record.id, record);
                                return { result: record.id };
                            },
                            delete: (id) => {
                                data.delete(id);
                                return { result: undefined };
                            },
                        });
                        queueMicrotask(() => (txError ? tx.onerror?.() : tx.oncomplete?.()));
                        return tx;
                    },
                };
                request.result = db;
                if (state.upgrades === 0) {
                    state.upgrades += 1;
                    request.onupgradeneeded?.();
                }
                request.onsuccess?.();
            });
            return request;
        }),
    };
    return factory;
}

describe('recent file handles (browser)', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isRecentHandlesSupported', () => {
        it('needs the file picker and IndexedDB, outside the desktop app', () => {
            const win = { showOpenFilePicker: () => {}, indexedDB: {} };
            expect(isRecentHandlesSupported(win)).toBe(true);
            expect(isRecentHandlesSupported({ indexedDB: {} })).toBe(false);
            expect(isRecentHandlesSupported({ showOpenFilePicker: () => {} })).toBe(false);
            expect(isRecentHandlesSupported({ ...win, electronAPI: {} })).toBe(false);
            expect(isRecentHandlesSupported({ ...win, self: {}, top: {} })).toBe(false);
        });

        it('reads the real window by default', () => {
            expect(typeof isRecentHandlesSupported()).toBe('boolean');
        });
    });

    describe('createHandleStore', () => {
        it('creates the store on first use and round-trips records', async () => {
            const factory = fakeIndexedDB();
            const store = createHandleStore(factory);

            await store.put({ id: 'a', name: 'a.elpx', openedAt: 1 });
            await store.put({ id: 'b', name: 'b.elpx', openedAt: 2 });
            expect(await store.getAll()).toHaveLength(2);

            await store.delete('a');
            expect((await store.getAll()).map((record) => record.id)).toEqual(['b']);
            expect(factory.state.upgrades).toBe(1);
            expect(factory.state.closed).toBe(5);
        });

        it('fails when the database cannot be opened or the transaction aborts', async () => {
            await expect(createHandleStore(fakeIndexedDB({ openError: new Error('blocked') })).getAll()).rejects.toThrow(
                'blocked',
            );
            await expect(
                createHandleStore(fakeIndexedDB({ txError: new Error('quota') })).put({ id: 'a' }),
            ).rejects.toThrow('quota');
        });

        it('uses the browser database by default', () => {
            expect(typeof createHandleStore().getAll).toBe('function');
        });
    });

    describe('rememberHandle', () => {
        it('stores the handle with its name and time, newest first', async () => {
            const store = memoryStore();
            const ids = ['one', 'two'];

            await rememberHandle(fakeHandle('a.elpx'), { store, now: 1, newId: () => ids.shift() });
            await rememberHandle(fakeHandle('b.elp'), { store, now: 2, newId: () => ids.shift() });

            const list = await listRecentHandles({ store });
            expect(list.map((record) => [record.id, record.name, record.openedAt])).toEqual([
                ['two', 'b.elp', 2],
                ['one', 'a.elpx', 1],
            ]);
        });

        it('replaces the entry of a file opened again', async () => {
            const store = memoryStore();
            await rememberHandle(fakeHandle('a.elpx'), { store, now: 1, newId: () => 'old' });
            await rememberHandle(fakeHandle('a.elpx'), { store, now: 5, newId: () => 'new' });

            expect([...store.records.keys()]).toEqual(['new']);
        });

        it('keeps only the newest ten', async () => {
            const store = memoryStore();
            for (let i = 0; i < MAX_RECENT_HANDLES + 3; i++) {
                await rememberHandle(fakeHandle(`p${i}.elpx`), { store, now: i, newId: () => `id${i}` });
            }

            const list = await listRecentHandles({ store });
            expect(list).toHaveLength(MAX_RECENT_HANDLES);
            expect(list[0].name).toBe(`p${MAX_RECENT_HANDLES + 2}.elpx`);
            expect(list.at(-1).name).toBe('p3.elpx');
        });

        it('ignores folders, other file types and a missing handle', async () => {
            const store = memoryStore();
            await rememberHandle(fakeHandle('notes.pdf'), { store });
            await rememberHandle(fakeHandle('folder.elpx', { kind: 'directory' }), { store });
            await rememberHandle(null, { store });

            expect(store.put).not.toHaveBeenCalled();
        });

        it('generates an id and a time by default', async () => {
            const store = memoryStore();
            await rememberHandle(fakeHandle('a.elpx'), { store });

            const [record] = await listRecentHandles({ store });
            expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
            expect(record.openedAt).toBeGreaterThan(0);
        });
    });

    it('lists nothing from an empty store', async () => {
        expect(await listRecentHandles({ store: { getAll: async () => undefined } })).toEqual([]);
    });

    describe('rememberDroppedFile', () => {
        const supported = { showOpenFilePicker: () => {}, indexedDB: {} };

        it('asks for the handle during the drop and stores it', async () => {
            const store = memoryStore();
            const handle = fakeHandle('dropped.elpx');
            const item = { getAsFileSystemHandle: vi.fn(async () => handle) };

            await rememberDroppedFile({ items: [item] }, { store, win: supported });

            expect(item.getAsFileSystemHandle).toHaveBeenCalledTimes(1);
            expect([...store.records.values()][0].name).toBe('dropped.elpx');
        });

        it('does nothing where handles are not available', async () => {
            const store = memoryStore();
            const item = { getAsFileSystemHandle: vi.fn() };

            await rememberDroppedFile({ items: [item] }, { store, win: {} });
            await rememberDroppedFile({ items: [{}] }, { store, win: supported });
            await rememberDroppedFile(undefined, { store, win: supported });

            expect(item.getAsFileSystemHandle).not.toHaveBeenCalled();
            expect(store.put).not.toHaveBeenCalled();
        });

        it('never fails the drop', async () => {
            const item = { getAsFileSystemHandle: vi.fn(async () => Promise.reject(new Error('denied'))) };

            await expect(
                rememberDroppedFile({ items: [item] }, { store: memoryStore(), win: supported }),
            ).resolves.toBeUndefined();
            expect(console.warn).toHaveBeenCalled();
        });

        it('falls back to the browser store', async () => {
            const item = { getAsFileSystemHandle: vi.fn(async () => fakeHandle('notes.pdf')) };
            await expect(rememberDroppedFile({ items: [item] }, { win: supported })).resolves.toBeUndefined();
        });
    });

    describe('pickProjectFile', () => {
        it('returns the picked file and remembers its handle', async () => {
            const store = memoryStore();
            const file = new File(['x'], 'picked.elpx');
            const handle = fakeHandle('picked.elpx', { file });
            const win = { showOpenFilePicker: vi.fn(async () => [handle]) };

            expect(await pickProjectFile({ store, win })).toBe(file);
            expect(win.showOpenFilePicker.mock.calls[0][0].types[0].accept['application/octet-stream']).toEqual([
                '.elpx',
                '.elp',
                '.zip',
            ]);
            expect(store.records.size).toBe(1);
        });

        it('returns null when the author cancels', async () => {
            const cancel = Object.assign(new Error('cancelled'), { name: 'AbortError' });
            const win = { showOpenFilePicker: vi.fn(async () => Promise.reject(cancel)) };

            expect(await pickProjectFile({ store: memoryStore(), win })).toBeNull();
        });

        it('reports any other picker failure', async () => {
            const win = { showOpenFilePicker: vi.fn(async () => Promise.reject(new Error('SecurityError'))) };
            await expect(pickProjectFile({ store: memoryStore(), win })).rejects.toThrow('SecurityError');
        });

        it('still opens the file when it cannot be remembered', async () => {
            const store = memoryStore();
            store.put.mockRejectedValue(new Error('quota'));
            const win = { showOpenFilePicker: vi.fn(async () => [fakeHandle('picked.elpx')]) };

            expect(await pickProjectFile({ store, win })).toBeInstanceOf(File);
            expect(console.warn).toHaveBeenCalled();
        });

        it('falls back to the browser store', async () => {
            const win = { showOpenFilePicker: vi.fn(async () => [fakeHandle('notes.pdf')]) };
            expect(await pickProjectFile({ win })).toBeInstanceOf(File);
        });
    });

    describe('openRecentHandle', () => {
        it('reads the file and moves it to the top', async () => {
            const file = new File(['x'], 'a.elpx');
            const handle = fakeHandle('a.elpx', { file });
            const store = memoryStore([{ id: 'a', name: 'a.elpx', openedAt: 1, handle }]);

            expect(await openRecentHandle('a', { store, now: 9 })).toBe(file);
            expect(handle.requestPermission).not.toHaveBeenCalled();
            expect(store.records.get('a').openedAt).toBe(9);
        });

        it('asks the author for permission when the browser no longer holds it', async () => {
            const handle = fakeHandle('a.elpx', { permission: 'prompt', afterRequest: 'granted' });
            const store = memoryStore([{ id: 'a', name: 'a.elpx', openedAt: 1, handle }]);

            await openRecentHandle('a', { store });

            expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
        });

        it('fails without reading when permission is refused', async () => {
            const handle = fakeHandle('a.elpx', { permission: 'prompt', afterRequest: 'denied' });
            const store = memoryStore([{ id: 'a', name: 'a.elpx', openedAt: 1, handle }]);

            await expect(openRecentHandle('a', { store })).rejects.toThrow('Permission');
            expect(handle.getFile).not.toHaveBeenCalled();
        });

        it('drops a file that no longer exists from the list', async () => {
            const handle = fakeHandle('a.elpx');
            handle.getFile.mockRejectedValue(Object.assign(new Error('gone'), { name: 'NotFoundError' }));
            const store = memoryStore([{ id: 'a', name: 'a.elpx', openedAt: 1, handle }]);

            await expect(openRecentHandle('a', { store })).rejects.toThrow('gone');
            expect(store.records.has('a')).toBe(false);
        });

        it('keeps the entry on any other read failure', async () => {
            const handle = fakeHandle('a.elpx');
            handle.getFile.mockRejectedValue(new Error('busy'));
            const store = memoryStore([{ id: 'a', name: 'a.elpx', openedAt: 1, handle }]);

            await expect(openRecentHandle('a', { store })).rejects.toThrow('busy');
            expect(store.records.has('a')).toBe(true);
        });

        it('rejects an id that is not in the list', async () => {
            await expect(openRecentHandle('nope', { store: memoryStore() })).rejects.toThrow('not in the list');
        });
    });
});
