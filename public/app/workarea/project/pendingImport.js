/**
 * Pending local-file import bridge (IndexedDB).
 *
 * A local `.elp`/`.elpx` file selected outside the workarea (e.g. on the
 * `/projects` landing page) cannot be passed through a full-page navigation.
 * We therefore stash the file bytes in IndexedDB before navigating to
 * `/workarea?project=…&pendingImport=1`, and the workarea reads them back on
 * boot (see `projectManager._processPendingImport`).
 *
 * This is the single source of truth for that contract: both the workarea
 * (`projectManager.js`) and the standalone `/projects` page consume it, so the
 * DB / store / key names live in exactly one place.
 */

/** IndexedDB database name for pending local file imports. */
export const PENDING_IMPORT_DB = 'exelearning-pending-import';

/** Object store name inside {@link PENDING_IMPORT_DB}. */
export const PENDING_IMPORT_STORE = 'files';

/** Record key for the single pending import entry. */
export const PENDING_IMPORT_KEY = 'pending-import';

/**
 * Store a file in IndexedDB so it survives a page reload / navigation.
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function storePendingImport(file) {
    const arrayBuffer = await file.arrayBuffer();
    const record = { name: file.name, bytes: arrayBuffer };

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(PENDING_IMPORT_DB, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PENDING_IMPORT_STORE)) {
                db.createObjectStore(PENDING_IMPORT_STORE);
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(PENDING_IMPORT_STORE, 'readwrite');
            tx.objectStore(PENDING_IMPORT_STORE).put(record, PENDING_IMPORT_KEY);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Read and delete the pending import from IndexedDB.
 * @returns {Promise<File|null>}
 */
export async function retrievePendingImport() {
    return new Promise((resolve) => {
        const request = indexedDB.open(PENDING_IMPORT_DB, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PENDING_IMPORT_STORE)) {
                db.createObjectStore(PENDING_IMPORT_STORE);
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(PENDING_IMPORT_STORE, 'readwrite');
            const store = tx.objectStore(PENDING_IMPORT_STORE);
            const getReq = store.get(PENDING_IMPORT_KEY);
            getReq.onsuccess = () => {
                const record = getReq.result;
                // Delete the entry regardless
                store.delete(PENDING_IMPORT_KEY);
                tx.oncomplete = () => {
                    db.close();
                    if (record && record.bytes) {
                        const file = new File([record.bytes], record.name, {
                            type: 'application/octet-stream',
                        });
                        resolve(file);
                    } else {
                        resolve(null);
                    }
                };
            };
            getReq.onerror = () => { db.close(); resolve(null); };
        };
        request.onerror = () => resolve(null);
    });
}
