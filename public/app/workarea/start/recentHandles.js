/**
 * Recent project files in the browser (static app).
 *
 * A web page cannot keep a path, but where the File System Access API exists
 * (Chromium) it can keep the handle of a file the author picked or dropped and
 * ask to read that same file again later. Handles live in IndexedDB; reading
 * one back needs the author's permission again, which the browser asks for.
 * Elsewhere this module reports "not supported" and nothing is listed.
 */
import { isOpenableProjectFile } from '../../common/fileDropHandler.js';

const DB_NAME = 'exelearning-recent-files';
const STORE_NAME = 'handles';
export const MAX_RECENT_HANDLES = 10;

/**
 * Run one request against the handle store and resolve with its result once
 * the transaction has committed.
 */
function withStore(factory, mode, run) {
    return new Promise((resolve, reject) => {
        const open = factory.open(DB_NAME, 1);
        open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(STORE_NAME, mode);
            const request = run(tx.objectStore(STORE_NAME));
            tx.oncomplete = () => {
                db.close();
                resolve(request.result);
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        };
    });
}

/**
 * @param {IDBFactory} [factory]
 * @returns {{getAll: () => Promise<Object[]>, put: (record: Object) => Promise<void>, delete: (id: string) => Promise<void>}}
 */
export function createHandleStore(factory = window.indexedDB) {
    return {
        getAll: () => withStore(factory, 'readonly', (store) => store.getAll()),
        put: (record) => withStore(factory, 'readwrite', (store) => store.put(record)),
        delete: (id) => withStore(factory, 'readwrite', (store) => store.delete(id)),
    };
}

/**
 * True in a browser that can keep file handles. The desktop app has its own
 * list, kept by the main process.
 * @param {Window} [win]
 * @returns {boolean}
 */
export function isRecentHandlesSupported(win = window) {
    return typeof win.showOpenFilePicker === 'function' && !!win.indexedDB && !win.electronAPI;
}

/**
 * Newest first.
 * @param {{store?: Object}} [options]
 * @returns {Promise<{id: string, name: string, openedAt: number, handle: FileSystemFileHandle}[]>}
 */
export async function listRecentHandles({ store = createHandleStore() } = {}) {
    const records = (await store.getAll()) || [];
    return records.sort((a, b) => b.openedAt - a.openedAt);
}

/**
 * Put a handle first in the list, replacing an entry for the same file and
 * dropping the oldest beyond MAX_RECENT_HANDLES.
 * @param {FileSystemFileHandle} handle
 * @param {{store?: Object, now?: number, newId?: () => string}} [options]
 */
export async function rememberHandle(
    handle,
    { store = createHandleStore(), now = Date.now(), newId = () => crypto.randomUUID() } = {},
) {
    if (handle?.kind !== 'file' || !isOpenableProjectFile(handle.name)) return;
    const records = await listRecentHandles({ store });
    const kept = [];
    for (const record of records) {
        if (await handle.isSameEntry(record.handle)) await store.delete(record.id);
        else kept.push(record);
    }
    await store.put({ id: newId(), name: handle.name, openedAt: now, handle });
    for (const record of kept.slice(MAX_RECENT_HANDLES - 1)) await store.delete(record.id);
}

/**
 * Remember a dropped project file. The handle must be requested while the
 * drop event is being dispatched, so this is called synchronously from it;
 * storing happens afterwards and never fails the drop.
 * @param {DataTransfer} dataTransfer
 * @param {{store?: Object, win?: Window}} [options]
 * @returns {Promise<void>}
 */
export function rememberDroppedFile(dataTransfer, { store, win = window } = {}) {
    const item = dataTransfer?.items?.[0];
    if (!isRecentHandlesSupported(win) || typeof item?.getAsFileSystemHandle !== 'function') return Promise.resolve();
    return Promise.resolve(item.getAsFileSystemHandle())
        .then((handle) => rememberHandle(handle, store ? { store } : {}))
        .catch((error) => console.warn('[RecentHandles] Could not remember the dropped file:', error));
}

/**
 * Ask for a project file with the browser's own picker and remember it.
 * @param {{store?: Object, win?: Window}} [options]
 * @returns {Promise<File|null>} null when the author cancelled
 */
export async function pickProjectFile({ store, win = window } = {}) {
    let handle;
    try {
        [handle] = await win.showOpenFilePicker({
            types: [{ accept: { 'application/octet-stream': ['.elpx', '.elp', '.zip'] } }],
        });
    } catch (error) {
        if (error?.name === 'AbortError') return null;
        throw error;
    }
    const file = await handle.getFile();
    await rememberHandle(handle, store ? { store } : {}).catch((error) =>
        console.warn('[RecentHandles] Could not remember the picked file:', error),
    );
    return file;
}

/**
 * Read a remembered file again. The browser asks the author for permission
 * when it no longer holds it; a file that is gone is dropped from the list.
 * @param {string} id
 * @param {{store?: Object, now?: number}} [options]
 * @returns {Promise<File>}
 */
export async function openRecentHandle(id, { store = createHandleStore(), now = Date.now() } = {}) {
    const record = (await listRecentHandles({ store })).find((candidate) => candidate.id === id);
    if (!record) throw new Error('Recent file is not in the list');
    const { handle } = record;
    let permission = await handle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'read' });
    if (permission !== 'granted') throw new Error('Permission to read the file was not given');
    let file;
    try {
        file = await handle.getFile();
    } catch (error) {
        if (error?.name === 'NotFoundError') await store.delete(id);
        throw error;
    }
    await store.put({ ...record, openedAt: now });
    return file;
}
