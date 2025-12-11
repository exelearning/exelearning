// y-indexeddb needs access to the same Y instance
import { IndexeddbPersistence } from 'y-indexeddb';
window.IndexeddbPersistence = IndexeddbPersistence;
console.log('[Yjs] IndexedDB persistence loaded');
