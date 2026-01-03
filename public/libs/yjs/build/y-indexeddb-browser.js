/**
 * y-indexeddb browser wrapper
 * Uses the globally loaded Yjs from window.Y
 * Based on y-indexeddb source
 */
(function() {
  'use strict';

  // Ensure Yjs is loaded
  const Y = window.Y;
  if (!Y) {
    console.error('[y-indexeddb] Yjs (window.Y) not found. Load yjs.min.js first.');
    return;
  }

  // IndexedDB helper functions
  const idbPromise = (request) => new Promise((resolve, reject) => {
    request.onerror = (event) => reject(new Error(event.target.error));
    request.onsuccess = (event) => resolve(event.target.result);
  });

  const openDB = (name, onUpgrade) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = (event) => onUpgrade(event.target.result);
    request.onerror = (event) => reject(new Error(event.target.error));
    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });

  const deleteDB = (name) => idbPromise(indexedDB.deleteDatabase(name));

  const createStores = (db, stores) => {
    stores.forEach(([name, options]) => {
      if (!db.objectStoreNames.contains(name)) {
        db.createObjectStore(name, options);
      }
    });
  };

  const getTransaction = (db, stores, mode = 'readwrite') => {
    const transaction = db.transaction(stores, mode);
    return stores.map(store => transaction.objectStore(store));
  };

  // Constants
  const PREFERRED_TRIM_SIZE = 500;
  const CUSTOM_STORE = 'custom';
  const UPDATES_STORE = 'updates';

  /**
   * Fetch updates from IndexedDB and apply to Y.Doc
   */
  const fetchUpdates = (idbPersistence, beforeApply, afterApply) => {
    const [updatesStore] = getTransaction(idbPersistence.db, [UPDATES_STORE], 'readonly');

    return new Promise((resolve, reject) => {
      const request = updatesStore.getAll(IDBKeyRange.lowerBound(idbPersistence._dbref, false));
      request.onerror = (event) => reject(new Error(event.target.error));
      request.onsuccess = (event) => {
        const updates = event.target.result;
        if (idbPersistence._destroyed) {
          resolve(updatesStore);
          return;
        }

        if (beforeApply) beforeApply(updatesStore);

        Y.transact(idbPersistence.doc, () => {
          updates.forEach(update => Y.applyUpdate(idbPersistence.doc, update));
        }, idbPersistence, false);

        if (afterApply) afterApply(updatesStore);
        resolve(updatesStore);
      };
    }).then(store => {
      // Get last key for dbref
      return new Promise((resolve, reject) => {
        const request = store.openKeyCursor(null, 'prev');
        request.onerror = (event) => reject(new Error(event.target.error));
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            idbPersistence._dbref = cursor.key + 1;
          }
          resolve();
        };
      });
    }).then(() => {
      // Get count for dbsize
      const [store] = getTransaction(idbPersistence.db, [UPDATES_STORE], 'readonly');
      return idbPromise(store.count()).then(count => {
        idbPersistence._dbsize = count;
        return store;
      });
    });
  };

  /**
   * Store document state and clear old updates
   */
  const storeState = (idbPersistence, forceStore = true) => {
    return fetchUpdates(idbPersistence).then(store => {
      if (forceStore || idbPersistence._dbsize >= PREFERRED_TRIM_SIZE) {
        const [updatesStore] = getTransaction(idbPersistence.db, [UPDATES_STORE]);
        // Add full state
        const state = Y.encodeStateAsUpdate(idbPersistence.doc);
        return idbPromise(updatesStore.add(state)).then(() => {
          // Delete old updates
          return idbPromise(updatesStore.delete(IDBKeyRange.upperBound(idbPersistence._dbref, true)));
        }).then(() => {
          return idbPromise(updatesStore.count()).then(count => {
            idbPersistence._dbsize = count;
          });
        });
      }
    });
  };

  /**
   * IndexedDB persistence for Yjs documents
   */
  class IndexeddbPersistence {
    constructor(name, doc) {
      this.doc = doc;
      this.name = name;
      this._dbref = 0;
      this._dbsize = 0;
      this._destroyed = false;
      this.db = null;
      this.synced = false;
      this._observers = new Map();

      // Open database
      this._db = openDB(name, (db) => {
        createStores(db, [
          [UPDATES_STORE, { autoIncrement: true }],
          [CUSTOM_STORE]
        ]);
      });

      // Promise that resolves when synced
      this.whenSynced = new Promise((resolve) => {
        this.once('synced', () => resolve(this));
      });

      // Initialize
      this._db.then((db) => {
        this.db = db;
        fetchUpdates(this, null, () => {
          if (this._destroyed) return;

          // Store current state if this is a new document (no existing updates)
          if (this._dbsize === 0) {
            const [store] = getTransaction(db, [UPDATES_STORE]);
            idbPromise(store.add(Y.encodeStateAsUpdate(doc))).then(() => {
              this._dbsize = 1;
            });
          }

          this.synced = true;
          this.emit('synced', [this]);
        });
      });

      // Store timeout configuration
      this._storeTimeout = 1000;
      this._storeTimeoutId = null;

      // Update handler
      this._storeUpdate = (update, origin) => {
        if (this.db && origin !== this) {
          const [store] = getTransaction(this.db, [UPDATES_STORE]);
          idbPromise(store.add(update));
          this._dbsize++;

          if (this._dbsize >= PREFERRED_TRIM_SIZE) {
            if (this._storeTimeoutId !== null) {
              clearTimeout(this._storeTimeoutId);
            }
            this._storeTimeoutId = setTimeout(() => {
              storeState(this, false);
              this._storeTimeoutId = null;
            }, this._storeTimeout);
          }
        }
      };

      doc.on('update', this._storeUpdate);
      this.destroy = this.destroy.bind(this);
      doc.on('destroy', this.destroy);
    }

    // Event emitter methods
    on(event, callback) {
      if (!this._observers.has(event)) {
        this._observers.set(event, new Set());
      }
      this._observers.get(event).add(callback);
    }

    once(event, callback) {
      const wrapper = (...args) => {
        this.off(event, wrapper);
        callback(...args);
      };
      this.on(event, wrapper);
    }

    off(event, callback) {
      const observers = this._observers.get(event);
      if (observers) {
        observers.delete(callback);
        if (observers.size === 0) {
          this._observers.delete(event);
        }
      }
    }

    emit(event, args) {
      const observers = this._observers.get(event);
      if (observers) {
        observers.forEach(callback => callback(...args));
      }
    }

    destroy() {
      if (this._storeTimeoutId) {
        clearTimeout(this._storeTimeoutId);
      }
      this.doc.off('update', this._storeUpdate);
      this.doc.off('destroy', this.destroy);
      this._destroyed = true;
      return this._db.then(db => db.close());
    }

    clearData() {
      return this.destroy().then(() => deleteDB(this.name));
    }

    get(key) {
      return this._db.then(db => {
        const [store] = getTransaction(db, [CUSTOM_STORE], 'readonly');
        return idbPromise(store.get(key));
      });
    }

    set(key, value) {
      return this._db.then(db => {
        const [store] = getTransaction(db, [CUSTOM_STORE]);
        return idbPromise(store.put(value, key));
      });
    }

    del(key) {
      return this._db.then(db => {
        const [store] = getTransaction(db, [CUSTOM_STORE]);
        return idbPromise(store.delete(key));
      });
    }
  }

  // Export to global
  window.IndexeddbPersistence = IndexeddbPersistence;
  console.log('[Yjs] IndexedDB persistence loaded (browser build)');
})();
