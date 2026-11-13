/**
 * IndexedDB store name and key for pending local file imports.
 * The file bytes are stored before a full page reload and read back after.
 */
const PENDING_IMPORT_DB = 'exelearning-pending-import';
const PENDING_IMPORT_KEY = 'pending-import';

/**
 * Store a file in IndexedDB so it survives a page reload.
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
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files');
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('files', 'readwrite');
            tx.objectStore('files').put(record, PENDING_IMPORT_KEY);
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
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files');
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
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
