/**
 * YjsDocumentManager
 * Central manager for Yjs documents in eXeLearning.
 * Handles document lifecycle, providers (IndexedDB, WebSocket), and persistence.
 *
 * Stateless Relay Architecture:
 * - WebSocket server is a pure relay (no Y.Doc on server)
 * - Client is the source of truth (IndexedDB + in-memory Y.Doc)
 * - Explicit saves only via REST API
 * - Auto-save on window/tab close (beforeunload)
 *
 * Usage:
 *   const manager = new YjsDocumentManager(projectId, config);
 *   await manager.initialize();
 *   const navigation = manager.getNavigation();
 *   // ... use document
 *   await manager.saveToServer(); // Explicit save
 *   manager.destroy();
 */
class YjsDocumentManager {
  /**
   * @param {string|number} projectId - The project ID (UUID or numeric)
   * @param {Object} config - Configuration options
   * @param {string} [config.wsUrl] - y-websocket server URL (defaults to same origin with /yjs path)
   * @param {string} [config.apiUrl='/api'] - REST API URL
   * @param {string} [config.token=null] - JWT token for authentication
   * @param {boolean} [config.offline=false] - If true, skip WebSocket connection
   */
  constructor(projectId, config = {}) {
    this.projectId = projectId;

    // Build default WebSocket URL from current location
    const defaultWsUrl = this._buildDefaultWsUrl();

    this.config = {
      // y-websocket server URL (same port as HTTP server with /yjs prefix)
      wsUrl: config.wsUrl || defaultWsUrl,
      apiUrl: config.apiUrl || '/api',
      token: config.token || null,
      offline: config.offline || false,
      // Awareness-based sync optimization
      awarenessCheckTimeout: config.awarenessCheckTimeout ?? 300, // ms to wait for awareness propagation
      fullSyncTimeout: config.fullSyncTimeout ?? 3000, // ms for full sync when collaborators present
      skipSyncWait: config.skipSyncWait ?? false, // Force skip sync wait (for Electron/offline)
      ...config,
    };

    this.ydoc = null;
    this.indexedDBProvider = null;
    this.wsProvider = null;
    this.undoManager = null;
    this.awareness = null;
    this.lockManager = null;

    // Event callbacks
    this.listeners = {
      sync: [],
      update: [],
      awareness: [],
      connectionChange: [],
      saveStatus: [], // New event for save status changes
      usersChange: [], // User presence changes
    };

    // User info (set from session)
    this.userInfo = null;

    this.initialized = false;
    this.synced = false;

    // Stateless relay architecture: track dirty state for explicit saves
    this.isDirty = false;
    this.lastSavedAt = null;
    this.saveInProgress = false;

    // Bind beforeunload handler
    this._beforeUnloadHandler = this._handleBeforeUnload.bind(this);
    // Bind unload handler (always fires, even if beforeunload is cancelled)
    this._unloadHandler = () => this._clearAwarenessOnUnload();
  }

  /**
   * Build default WebSocket URL from current location
   * Uses same origin with /yjs path prefix
   * @returns {string} WebSocket URL
   * @private
   */
  _buildDefaultWsUrl() {
    // Handle different environments
    if (typeof window === 'undefined') {
      // Node.js environment (shouldn't happen in browser, but handle gracefully)
      return 'ws://localhost:3001/yjs';
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname || 'localhost';
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    // Include basePath from eXeLearning config (set by pages.controller.ts)
    const basePath = window.eXeLearning?.config?.basePath || '';

    return `${protocol}//${hostname}:${port}${basePath}/yjs`;
  }

  /**
   * Initialize the document manager
   * Loads document from IndexedDB and optionally connects to WebSocket
   * @param {Object} options - Initialization options
   * @param {boolean} options.isNewProject - Skip server load for new projects (still syncs)
   */
  async initialize(options = {}) {
    if (this.initialized) {
      console.warn('YjsDocumentManager already initialized');
      return;
    }

    const { isNewProject = false } = options;

    // Import Yjs dynamically (assumes yjs is available globally via yjs-loader.js)
    const Y = window.Y;
    if (!Y) {
      throw new Error('Yjs (window.Y) not loaded. Ensure yjs.min.js is loaded first.');
    }

    // IndexedDB persistence is loaded via y-indexeddb.min.js which exports to window.IndexeddbPersistence
    const IndexeddbPersistence = window.IndexeddbPersistence;
    if (!IndexeddbPersistence) {
      throw new Error('IndexeddbPersistence not loaded. Ensure y-indexeddb.min.js is loaded first.');
    }

    // Create Y.Doc
    this.ydoc = new Y.Doc();
    this.Y = Y;

    // Setup IndexedDB persistence (offline-first)
    const dbName = `exelearning-project-${this.projectId}`;

    // Pre-validate IndexedDB schema to avoid runtime errors
    // y-indexeddb expects specific object stores, and corrupted/old databases can cause errors
    const isDbValid = await this._validateIndexedDb(dbName);
    if (!isDbValid) {
      Logger.warn(`[YjsDocumentManager] IndexedDB ${dbName} has invalid schema, deleting...`);
      try {
        await new Promise((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase(dbName);
          deleteReq.onsuccess = () => resolve();
          deleteReq.onerror = () => reject(deleteReq.error);
          deleteReq.onblocked = () => resolve(); // Proceed anyway
        });
        Logger.log(`[YjsDocumentManager] Deleted invalid database ${dbName}`);
      } catch (e) {
        Logger.warn(`[YjsDocumentManager] Failed to delete invalid database:`, e);
      }
    }

    // Try to create IndexedDB provider with error recovery
    try {
      this.indexedDBProvider = new IndexeddbPersistence(dbName, this.ydoc);

      // Add persistent error handler for runtime errors (e.g., corrupted schema)
      // This catches errors that occur during writes, not just initialization
      this.indexedDBProvider.on('error', async (error) => {
        Logger.warn(`[YjsDocumentManager] IndexedDB runtime error for project ${this.projectId}:`, error);
        // If error is about missing object stores, the database schema is corrupted
        if (error?.name === 'NotFoundError' || error?.message?.includes('object stores')) {
          Logger.warn('[YjsDocumentManager] Database schema appears corrupted, disabling persistence');
          // Destroy the provider to prevent further errors
          if (this.indexedDBProvider) {
            try {
              await this.indexedDBProvider.destroy();
            } catch (e) {
              // Ignore destroy errors
            }
            this.indexedDBProvider = null;
          }
        }
      });

      // Wait for IndexedDB to sync (with timeout to prevent hanging)
      // y-indexeddb may not fire 'synced' event in certain conditions (e.g., rapid reinit)
      await new Promise((resolve, reject) => {
        let resolved = false;

        const onSynced = () => {
          if (resolved) return;
          resolved = true;
          Logger.log(`[YjsDocumentManager] Synced from IndexedDB for project ${this.projectId}`);
          resolve();
        };

        // Handle errors during sync
        this.indexedDBProvider.on('error', (error) => {
          if (resolved) return;
          resolved = true;
          Logger.warn(`[YjsDocumentManager] IndexedDB error for project ${this.projectId}:`, error);
          reject(error);
        });

        // Check if already synced (may happen for empty/new databases)
        if (this.indexedDBProvider.synced) {
          onSynced();
          return;
        }

        // Listen for synced event
        this.indexedDBProvider.on('synced', onSynced);

        // Timeout after 3 seconds - IndexedDB sync should be fast
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          Logger.log(`[YjsDocumentManager] IndexedDB sync timeout for project ${this.projectId}, proceeding anyway`);
          resolve();
        }, 3000);
      });
    } catch (indexedDbError) {
      Logger.warn(`[YjsDocumentManager] IndexedDB initialization failed for project ${this.projectId}:`, indexedDbError);
      Logger.warn('[YjsDocumentManager] Attempting to clear corrupted database and retry...');

      // Try to delete the corrupted database
      try {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        await new Promise((resolve, reject) => {
          deleteRequest.onsuccess = () => {
            Logger.log(`[YjsDocumentManager] Deleted corrupted database ${dbName}`);
            resolve();
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => {
            Logger.warn(`[YjsDocumentManager] Database deletion blocked for ${dbName}`);
            resolve(); // Proceed anyway
          };
        });

        // Retry with fresh database
        this.indexedDBProvider = new IndexeddbPersistence(dbName, this.ydoc);

        // Wait for sync with shorter timeout
        await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(), 2000);
          this.indexedDBProvider.on('synced', () => {
            clearTimeout(timeout);
            Logger.log(`[YjsDocumentManager] Synced from fresh IndexedDB for project ${this.projectId}`);
            resolve();
          });
          if (this.indexedDBProvider.synced) {
            clearTimeout(timeout);
            resolve();
          }
        });
      } catch (deleteError) {
        Logger.error(`[YjsDocumentManager] Failed to recover IndexedDB for project ${this.projectId}:`, deleteError);
        // Proceed without IndexedDB persistence - data will only be in memory
        this.indexedDBProvider = null;
      }
    }

    // Setup WebSocket provider (but don't connect yet)
    // Connection happens later via startWebSocketConnection() after message handlers are installed
    // This prevents race conditions where JSON messages arrive before AssetWebSocketHandler is ready
    if (!this.config.offline) {
      await this.connectWebSocket();
      // NOTE: We no longer wait for sync here - sync will happen after startWebSocketConnection() is called
      // The YjsProjectBridge will call startWebSocketConnection() after AssetWebSocketHandler is ready
    }

    // Check if document is empty (after IndexedDB sync, before WebSocket sync)
    const navigation = this.ydoc.getArray('navigation');
    if (navigation.length === 0) {
      // Always try to load from server if not offline
      // Server-side initialization creates initial Yjs document when project is created,
      // so even new projects have data on the server
      if (!this.config.offline) {
        await this.loadFromServer();
      }

      // For OFFLINE mode only: create blank structure immediately
      // (no WebSocket sync will happen, so no risk of duplicates)
      // For ONLINE mode: defer to ensureBlankStructureIfEmpty() after WebSocket sync
      // This prevents duplicate pages when multiple clients join simultaneously
      if (this.config.offline && navigation.length === 0) {
        Logger.log('[YjsDocumentManager] Creating blank project structure (offline mode)');
        try {
          this.createBlankProjectStructure();
        } catch (createError) {
          // IndexedDB may throw if database schema is corrupted
          Logger.warn('[YjsDocumentManager] Error creating blank structure, disabling IndexedDB:', createError);
          if (this.indexedDBProvider) {
            try {
              await this.indexedDBProvider.destroy();
            } catch (e) {
              // Ignore
            }
            this.indexedDBProvider = null;
          }
          // Retry without persistence
          this.createBlankProjectStructure();
        }
      }
      // For online mode, YjsProjectBridge will call ensureBlankStructureIfEmpty() after sync
    }

    // Setup UndoManager
    this.setupUndoManager();

    // Clear undo stack so initial document state is not undoable
    // This establishes the current state as the "base" state
    this.clearUndoStack();

    // Setup LockManager (use window reference since it's loaded as separate file)
    if (window.YjsLockManager) {
      this.lockManager = new window.YjsLockManager(this.ydoc, this.awareness);
    } else {
      console.warn('[YjsDocumentManager] YjsLockManager not available, locking disabled');
      this.lockManager = null;
    }

    // Setup dirty tracking - mark dirty on any document change (local or remote)
    this.ydoc.on('update', (update, origin) => {
      // Don't mark dirty for system updates (initialization)
      // Mark dirty for both local changes AND remote changes from collaborators
      if (origin !== 'system') {
        this.markDirty();
      }
    });

    // Setup beforeunload handler for auto-save on close
    window.addEventListener('beforeunload', this._beforeUnloadHandler);
    // Setup unload handler to clear awareness (always fires, even if beforeunload cancelled)
    window.addEventListener('unload', this._unloadHandler);

    this.initialized = true;
    this.emit('sync', { synced: true });

    Logger.log(`[YjsDocumentManager] Initialized for project ${this.projectId} (stateless relay mode)`);
  }

  /**
   * Wait for WebSocket to sync with other clients
   * Uses awareness-based optimization for single-user scenarios:
   * 1. If skipSyncWait is true, return immediately
   * 2. If already synced, return immediately
   * 3. Wait briefly for awareness propagation (~300ms)
   * 4. If single user detected, proceed without full sync
   * 5. If other users present, wait for full sync (up to 3s)
   */
  async waitForWebSocketSync() {
    // Skip entirely if configured (Electron/offline mode)
    if (this.config.skipSyncWait) {
      Logger.log('[YjsDocumentManager] Sync wait skipped (skipSyncWait=true)');
      return;
    }

    // If already synced, resolve immediately
    if (this.wsProvider?.synced) {
      Logger.log('[YjsDocumentManager] WebSocket already synced');
      return;
    }

    // Phase 1: Quick awareness check for other users
    const otherUsersPresent = await this._checkForOtherUsers();

    if (!otherUsersPresent) {
      Logger.log('[YjsDocumentManager] Single user detected, skipping full sync wait');
      return;
    }

    // Phase 2: Full sync wait (other users detected)
    Logger.log('[YjsDocumentManager] Other users detected, waiting for full sync');
    await this._waitForFullSync();
  }

  /**
   * Check for other users via awareness with a short timeout
   * @returns {Promise<boolean>} true if other users are present
   * @private
   */
  async _checkForOtherUsers() {
    const awarenessTimeout = this.config.awarenessCheckTimeout;

    return new Promise((resolve) => {
      // Early exit if no provider
      if (!this.wsProvider || !this.awareness) {
        resolve(false);
        return;
      }

      let resolved = false;

      // Function to check awareness state
      const checkAwareness = () => {
        if (resolved) return;

        const onlineUsers = this.getOnlineUsers();
        // Filter out our own client (isLocal = true)
        const otherUsers = onlineUsers.filter((u) => !u.isLocal);

        if (otherUsers.length > 0) {
          resolved = true;
          Logger.log(
            `[YjsDocumentManager] Found ${otherUsers.length} other user(s)`
          );
          resolve(true);
        }
      };

      // Check immediately in case awareness is already populated
      checkAwareness();
      if (resolved) return;

      // Listen for awareness updates
      const awarenessHandler = () => checkAwareness();
      this.awareness.on('update', awarenessHandler);

      // Timeout after awarenessCheckTimeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.awareness.off('update', awarenessHandler);
          Logger.log(
            '[YjsDocumentManager] Awareness check timeout, no other users detected'
          );
          resolve(false);
        }
      }, awarenessTimeout);
    });
  }

  /**
   * Wait for full WebSocket sync (when other users are present)
   * @private
   */
  async _waitForFullSync() {
    const fullSyncTimeout = this.config.fullSyncTimeout;

    return new Promise((resolve) => {
      // If already synced, resolve immediately
      if (this.wsProvider?.synced) {
        resolve();
        return;
      }

      // Set timeout
      const timeout = setTimeout(() => {
        Logger.log(
          `[YjsDocumentManager] Full sync timeout (${fullSyncTimeout}ms), proceeding`
        );
        resolve();
      }, fullSyncTimeout);

      // Wait for sync event
      if (this.wsProvider) {
        this.wsProvider.once('sync', (isSynced) => {
          if (isSynced) {
            clearTimeout(timeout);
            Logger.log('[YjsDocumentManager] WebSocket synced with other clients');
            resolve();
          }
        });
      } else {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  /**
   * Load document state from server
   */
  async loadFromServer() {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/projects/uuid/${this.projectId}/yjs-document`,
        {
          headers: {
            Authorization: `Bearer ${this.config.token}`,
          },
        }
      );

      // 404 is expected for new projects that haven't been saved to server yet
      if (response.status === 404) {
        Logger.log('[YjsDocumentManager] No server document found (new project or not saved yet)');
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const update = new Uint8Array(arrayBuffer);

      // Apply server state
      this.Y.applyUpdate(this.ydoc, update);

      Logger.log(`[YjsDocumentManager] Loaded ${update.length} bytes from server`);
    } catch (error) {
      // Network errors or other issues - log but continue with local-only operation
      console.warn('[YjsDocumentManager] Could not load from server (using local data):', error.message);
    }
  }

  /**
   * Ensure blank project structure exists if document is empty.
   * Should be called AFTER WebSocket sync to prevent duplicate pages
   * when multiple clients join simultaneously.
   *
   * This method is the safe way to create blank structure after sync,
   * preventing the race condition where two clients both create pages
   * before syncing with each other.
   */
  ensureBlankStructureIfEmpty() {
    const navigation = this.ydoc.getArray('navigation');
    if (navigation.length === 0) {
      Logger.log('[YjsDocumentManager] Creating blank project structure (post-sync)');
      this.createBlankProjectStructure();
    } else {
      Logger.log('[YjsDocumentManager] Navigation not empty after sync, skipping blank structure');
    }
  }

  /**
   * Create a blank project structure with an initial page
   * Used when starting a new project or when no data exists
   */
  createBlankProjectStructure() {
    const Y = this.Y;
    const navigation = this.ydoc.getArray('navigation');
    const metadata = this.ydoc.getMap('metadata');

    // Double-check navigation is truly empty (race condition guard)
    if (navigation.length > 0) {
      Logger.log('[YjsDocumentManager] Navigation already has pages, skipping blank structure creation');
      return;
    }

    // Use a transaction to batch all changes
    this.ydoc.transact(() => {
      // Final check inside transaction (in case another client just added pages)
      if (navigation.length > 0) {
        Logger.log('[YjsDocumentManager] Navigation populated during transaction, aborting');
        return;
      }

      // Create initial metadata
      // Get user's language: app locale > document lang > navigator language > fallback to 'en'
      const userLanguage = window.eXeLearning?.app?.locale?.lang
        || document.documentElement.lang
        || navigator.language?.split('-')[0]
        || 'en';

      metadata.set('title', _('Untitled document'));
      metadata.set('author', '');
      metadata.set('description', '');
      metadata.set('language', userLanguage);
      metadata.set('license', 'creative commons: attribution - share alike 4.0');
      // Use configured default theme from admin panel, fallback to 'base'
      const defaultTheme = window.eXeLearning?.config?.defaultTheme || 'base';
      metadata.set('theme', defaultTheme);
      metadata.set('createdAt', Date.now());
      metadata.set('modifiedAt', Date.now());

      // Create root page
      const rootPageId = this.generateId();
      const rootPage = new Y.Map();
      rootPage.set('id', rootPageId);
      rootPage.set('pageId', rootPageId);
      rootPage.set('title', _('New page'));
      rootPage.set('pageName', _('New page'));
      rootPage.set('parentId', null);
      rootPage.set('order', 0);
      rootPage.set('blocks', new Y.Array());
      rootPage.set('children', new Y.Array());

      navigation.push([rootPage]);

      Logger.log(`[YjsDocumentManager] Created blank project with root page: ${rootPageId}`);
    }, 'system');
  }

  /**
   * Generate a unique ID
   * @returns {string}
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Validate IndexedDB schema before using it
   * y-indexeddb expects 'updates' and 'custom' object stores
   * @param {string} dbName - Database name to validate
   * @returns {Promise<boolean>} true if valid or doesn't exist, false if invalid schema
   * @private
   */
  async _validateIndexedDb(dbName) {
    return new Promise((resolve) => {
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        resolve(true); // No IndexedDB, let the provider handle it
        return;
      }

      // Try to open the database without specifying version (use existing version)
      const openReq = indexedDB.open(dbName);

      openReq.onerror = () => {
        // If we can't open, let the provider try to create it fresh
        resolve(true);
      };

      openReq.onsuccess = () => {
        const db = openReq.result;
        try {
          // y-indexeddb requires 'updates' object store (and optionally 'custom')
          const hasUpdates = db.objectStoreNames.contains('updates');
          db.close();

          if (!hasUpdates) {
            // Database exists but doesn't have required object stores
            Logger.warn(`[YjsDocumentManager] Database ${dbName} missing 'updates' object store`);
            resolve(false);
            return;
          }

          resolve(true);
        } catch (e) {
          db.close();
          resolve(false);
        }
      };

      openReq.onupgradeneeded = () => {
        // Database doesn't exist yet or needs upgrade - this is fine
        // Cancel the upgrade and let y-indexeddb handle creation
        openReq.transaction?.abort();
        resolve(true);
      };

      // Timeout in case something hangs
      setTimeout(() => resolve(true), 2000);
    });
  }

  /**
   * Connect to y-websocket server for real-time collaboration
   * Uses y-websocket's WebsocketProvider which handles:
   * - Automatic Yjs sync protocol
   * - Reconnection
   * - Awareness (cursors, presence)
   */
  async connectWebSocket() {
    // Get WebsocketProvider from window (loaded via yjs-loader)
    const WebsocketProvider = window.WebsocketProvider;
    if (!WebsocketProvider) {
      console.error('[YjsDocumentManager] WebsocketProvider not loaded');
      return;
    }

    // Document name follows convention: project-<projectId>
    const roomName = `project-${this.projectId}`;

    // Create WebsocketProvider instance
    // y-websocket URL format: ws://host:port
    // Room name is passed as second parameter
    // IMPORTANT: connect: false - we manually connect after AssetWebSocketHandler is ready
    // This prevents race conditions where JSON messages arrive before the handler intercepts them
    this.wsProvider = new WebsocketProvider(
      this.config.wsUrl,
      roomName,
      this.ydoc,
      {
        // Don't auto-connect - we'll call connect() after message handlers are installed
        connect: false,
        // Pass JWT token as URL param for authentication
        params: { token: this.config.token || '' },
      }
    );

    // Store awareness for lock manager
    this.awareness = this.wsProvider.awareness;

    // Set local user info in awareness (will be updated when setUserInfo is called)
    if (this.awareness) {
      const color = this.generateUserColor();
      this.awareness.setLocalStateField('user', {
        id: null,
        name: 'User',
        email: '',
        color: color,
        gravatarUrl: null,
        selectedPageId: null,
      });
    }

    // Setup event handlers
    this.wsProvider.on('status', ({ status }) => {
      Logger.log(`[YjsDocumentManager] Connection status: ${status}`);
      if (status === 'connected') {
        this.emit('connectionChange', { connected: true });
      } else if (status === 'disconnected') {
        this.emit('connectionChange', { connected: false });
      }
    });

    this.wsProvider.on('sync', (isSynced) => {
      Logger.log(`[YjsDocumentManager] Document synced: ${isSynced}`);
      if (isSynced) {
        this.synced = true;
        this.emit('sync', { synced: true });
      }
    });

    // Handle connection errors gracefully to prevent UI freeze
    this.wsProvider.on('connection-error', (event) => {
      console.error('[YjsDocumentManager] WebSocket connection error:', event);
      this.emit('error', { type: 'connection', error: event });
      // Don't throw - let the app continue in offline mode
    });

    this.wsProvider.on('connection-close', (event) => {
      console.warn('[YjsDocumentManager] WebSocket connection closed:', event);
      this.emit('connectionChange', {
        connected: false,
        code: event?.code,
        reason: event?.reason,
      });
      // Connection will auto-reconnect via y-websocket
    });

    // Awareness updates
    if (this.awareness) {
      this.awareness.on('update', () => {
        const states = Array.from(this.awareness.getStates().values());
        this.emit('awareness', { states });
        // Also emit usersChange for user presence UI
        const users = this.getOnlineUsers();
        this.emit('usersChange', { users });
      });
    }

    Logger.log(`[YjsDocumentManager] WebsocketProvider initialized for ${roomName} (not connected yet)`);
  }

  /**
   * Start the WebSocket connection
   * Call this AFTER installing any message handlers (like AssetWebSocketHandler)
   * to avoid race conditions with JSON messages
   */
  startWebSocketConnection() {
    if (!this.wsProvider) {
      console.warn('[YjsDocumentManager] Cannot start connection: wsProvider not initialized');
      return;
    }

    if (this.wsProvider.wsconnected) {
      Logger.log('[YjsDocumentManager] WebSocket already connected');
      return;
    }

    Logger.log('[YjsDocumentManager] Starting WebSocket connection...');
    this.wsProvider.connect();
  }

  /**
   * Setup UndoManager for undo/redo functionality
   */
  setupUndoManager() {
    const navigation = this.ydoc.getArray('navigation');
    const metadata = this.ydoc.getMap('metadata');

    this.undoManager = new this.Y.UndoManager([navigation, metadata], {
      trackedOrigins: new Set([this.ydoc.clientID]),
      captureTimeout: 500, // Group changes within 500ms
    });

    Logger.log(`[YjsDocumentManager] UndoManager initialized`);
  }

  /**
   * Stop capturing changes in the current undo group
   * Call this when user changes focus between fields to create atomic undo groups
   */
  stopCapturing() {
    if (this.undoManager) {
      this.undoManager.stopCapturing();
      Logger.log('[YjsDocumentManager] Stopped capturing - new undo group will start');
    }
  }

  /**
   * Clear the undo/redo stacks
   * Call this after initial document load to establish base state
   * This prevents the initial document state from being "undoable"
   */
  clearUndoStack() {
    if (this.undoManager) {
      this.undoManager.clear();
      Logger.log('[YjsDocumentManager] Cleared undo stack - current state is now base');
    }
  }

  /**
   * Generate a random color for user presence
   */
  generateUserColor() {
    const colors = [
      '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
      '#2196f3', '#03a9f4', '#00bcd4', '#009688',
      '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
      '#ffc107', '#ff9800', '#ff5722',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ===== User Presence =====

  /**
   * Set user info from session data
   * Call this after authentication to update awareness with real user info
   * @param {Object} userInfo - User info object
   * @param {string|number} userInfo.id - User ID
   * @param {string} userInfo.name - Display name
   * @param {string} userInfo.email - Email (for gravatar)
   * @param {string} [userInfo.gravatarUrl] - Gravatar URL (optional)
   */
  setUserInfo(userInfo) {
    this.userInfo = userInfo;

    if (this.awareness) {
      const currentState = this.awareness.getLocalState();
      const currentUser = currentState?.user || {};

      // Use centralized getInitials from AvatarUtils (loaded globally)
      const getInitials = window.AvatarUtils?.getInitials || this._fallbackGetInitials;
      const nameOrEmail = userInfo.name || userInfo.username || userInfo.email || 'User';

      this.awareness.setLocalStateField('user', {
        ...currentUser,
        id: userInfo.id,
        name: userInfo.name || userInfo.username || 'User',
        email: userInfo.email || '',
        gravatarUrl: userInfo.gravatarUrl || this.generateGravatarUrl(userInfo.email),
        initials: getInitials(nameOrEmail),
      });

      Logger.log('[YjsDocumentManager] Updated user info in awareness:', userInfo.name);
    }
  }

  /**
   * Generate Gravatar URL from email
   * @param {string} email - User email
   * @returns {string|null} Gravatar URL or null
   */
  generateGravatarUrl(email) {
    if (!email) return null;
    // Simple hash function (MD5 would be better but this works for demo)
    // In production, server should provide gravatarUrl
    const hash = email.trim().toLowerCase();
    return `https://www.gravatar.com/avatar/${this.simpleHash(hash)}?d=identicon&s=50`;
  }

  /**
   * Simple hash for gravatar (not MD5, just for fallback)
   * @param {string} str - String to hash
   * @returns {string} Hash string
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(32, '0');
  }

  /**
   * Fallback getInitials in case AvatarUtils is not loaded
   * @param {string} name - Full name or email
   * @returns {string} Initials (max 2 chars)
   */
  _fallbackGetInitials(name) {
    if (!name) return '?';
    // If email, extract from local part
    if (name.includes('@')) {
      const localPart = name.split('@')[0];
      const parts = localPart.split(/[._-]/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return localPart.substring(0, 2).toUpperCase();
    }
    // If name, extract from words
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Set the currently selected page ID
   * Updates awareness so other users can see which page we're viewing
   * @param {string} pageId - Page ID
   */
  setSelectedPage(pageId) {
    if (this.awareness) {
      this.awareness.setLocalStateField('user', {
        ...this.awareness.getLocalState()?.user,
        selectedPageId: pageId,
      });
      Logger.log('[YjsDocumentManager] Set selected page:', pageId);
    }
  }

  /**
   * Set the currently editing component ID (iDevice)
   * Updates awareness so other users can see which iDevice we're editing
   * @param {string|null} componentId - Component ID or null when not editing
   */
  setEditingComponent(componentId) {
    if (this.awareness) {
      this.awareness.setLocalStateField('user', {
        ...this.awareness.getLocalState()?.user,
        editingComponentId: componentId,
      });
      if (componentId) {
        Logger.log('[YjsDocumentManager] Set editing component:', componentId);
      } else {
        Logger.log('[YjsDocumentManager] Cleared editing component');
      }
    }
  }

  /**
   * Get all online users from awareness
   * @returns {Array<Object>} Array of user objects with { id, name, email, color, gravatarUrl, initials, selectedPageId, editingComponentId, clientId, isLocal }
   */
  getOnlineUsers() {
    if (!this.awareness) return [];

    const users = [];
    const localClientId = this.awareness.clientID;

    this.awareness.getStates().forEach((state, clientId) => {
      if (state.user) {
        users.push({
          ...state.user,
          clientId: clientId,
          isLocal: clientId === localClientId,
        });
      }
    });

    return users;
  }

  /**
   * Get users viewing a specific page
   * @param {string} pageId - Page ID
   * @returns {Array<Object>} Array of users on that page
   */
  getUsersOnPage(pageId) {
    return this.getOnlineUsers().filter(user => user.selectedPageId === pageId);
  }

  /**
   * Get users editing a specific component (iDevice)
   * @param {string} componentId - Component ID
   * @returns {Array<Object>} Array of users editing that component
   */
  getUsersEditingComponent(componentId) {
    return this.getOnlineUsers().filter(user => user.editingComponentId === componentId && !user.isLocal);
  }

  /**
   * Get all descendant page IDs for a given page
   * @param {string} pageId - Parent page ID
   * @param {Object} structureData - Structure data object (id -> node)
   * @returns {Array<string>} Array of descendant page IDs
   */
  getDescendantPageIds(pageId, structureData) {
    const descendants = [];

    const collectDescendants = (parentId) => {
      for (const [id, node] of Object.entries(structureData)) {
        if (node.parent === parentId) {
          descendants.push(node.pageId || id);
          collectDescendants(id);
        }
      }
    };

    collectDescendants(pageId);
    return descendants;
  }

  /**
   * Get other users (not local) viewing a page or any of its descendants
   * @param {string} pageId - Page ID to check
   * @param {Object} structureData - Structure data from structureEngine.data
   * @returns {{ usersOnTarget: Array, usersOnDescendants: Array, allAffectedUsers: Array }}
   */
  getOtherUsersOnPageAndDescendants(pageId, structureData) {
    const onlineUsers = this.getOnlineUsers().filter(u => !u.isLocal);

    // Users directly on the target page
    const usersOnTarget = onlineUsers.filter(u => u.selectedPageId === pageId);

    // Get all descendant page IDs
    const descendantIds = this.getDescendantPageIds(pageId, structureData);

    // Users on any descendant page
    const usersOnDescendants = onlineUsers.filter(u =>
      descendantIds.includes(u.selectedPageId)
    );

    // All unique affected users
    const allAffectedUsers = [...usersOnTarget];
    usersOnDescendants.forEach(u => {
      if (!allAffectedUsers.find(existing => existing.clientId === u.clientId)) {
        allAffectedUsers.push(u);
      }
    });

    return {
      usersOnTarget,
      usersOnDescendants,
      allAffectedUsers,
      descendantIds,
    };
  }

  /**
   * Subscribe to user presence changes
   * @param {Function} callback - Called with { users: Array } when users change
   * @returns {Function} Unsubscribe function
   */
  onUsersChange(callback) {
    this.on('usersChange', callback);
    return () => this.off('usersChange', callback);
  }

  // ===== Document Structure Access =====

  /**
   * Ensure the manager is initialized before accessing the document
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized || !this.ydoc) {
      throw new Error('YjsDocumentManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Get the navigation array (pages/blocks/components structure)
   * @returns {Y.Array}
   */
  getNavigation() {
    this._ensureInitialized();
    return this.ydoc.getArray('navigation');
  }

  /**
   * Get project metadata
   * @returns {Y.Map}
   */
  getMetadata() {
    this._ensureInitialized();
    return this.ydoc.getMap('metadata');
  }

  /**
   * Update exelearning_version in metadata before saving
   * Fetches the current app version from the server and stores it in metadata
   * @private
   * @returns {Promise<void>}
   */
  async _updateVersionMetadata() {
    try {
      const response = await fetch(`${this.config.apiUrl}/version`);
      if (response.ok) {
        const { version } = await response.json();
        const metadata = this.getMetadata();
        metadata.set('exelearning_version', version);
      }
    } catch (error) {
      console.warn('[YjsDocumentManager] Could not fetch app version:', error);
      // Continue without setting version - non-critical
    }
  }

  /**
   * Get locks map
   * @returns {Y.Map}
   */
  getLocks() {
    this._ensureInitialized();
    return this.ydoc.getMap('locks');
  }

  /**
   * Get assets map - stores asset metadata for instant sync
   * Structure: Map<uuid, {filename, folderPath, mime, size, hash, uploaded, createdAt}>
   * @returns {Y.Map}
   */
  getAssets() {
    this._ensureInitialized();
    return this.ydoc.getMap('assets');
  }

  /**
   * Get theme files map - stores user theme files imported from .elpx
   * Structure: Map<themeName, Map<relativePath, base64FileContent>>
   * Example: themeFiles.get('universal') -> Map { 'style.css' -> '...base64...', 'config.xml' -> '...' }
   *
   * User themes imported from .elpx files are stored client-side in Yjs,
   * not on the server. This simplifies the architecture and allows
   * themes to sync automatically between collaborators.
   * @returns {Y.Map}
   */
  getThemeFiles() {
    this._ensureInitialized();
    return this.ydoc.getMap('themeFiles');
  }

  /**
   * Get the raw Y.Doc
   * @returns {Y.Doc}
   */
  getDoc() {
    this._ensureInitialized();
    return this.ydoc;
  }

  /**
   * Flush/persist the current document state to IndexedDB
   * This is called automatically, but can be triggered manually
   * @returns {Promise<void>}
   */
  async flush() {
    if (this.indexedDBProvider) {
      // y-indexeddb auto-persists, but we can wait for the next persistence cycle
      // by checking if there are pending updates
      Logger.log('[YjsDocumentManager] Flush requested - state will persist to IndexedDB');
      // IndexedDB provider handles persistence automatically
      // We just confirm the operation completed
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  // ===== Undo/Redo =====

  /**
   * Undo the last change
   */
  undo() {
    if (this.undoManager && this.canUndo()) {
      this.undoManager.undo();
    }
  }

  /**
   * Redo the last undone change
   */
  redo() {
    if (this.undoManager && this.canRedo()) {
      this.undoManager.redo();
    }
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.undoManager?.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.undoManager?.redoStack.length > 0;
  }

  // ===== Locking =====

  /**
   * Request lock on a component
   * @param {string} componentId
   * @returns {boolean} - true if lock acquired
   */
  requestLock(componentId) {
    return this.lockManager?.requestLock(componentId);
  }

  /**
   * Release lock on a component
   * @param {string} componentId
   */
  releaseLock(componentId) {
    this.lockManager?.releaseLock(componentId);
  }

  /**
   * Check if a component is locked by another user
   * @param {string} componentId
   * @returns {boolean}
   */
  isLocked(componentId) {
    return this.lockManager?.isLocked(componentId);
  }

  /**
   * Get lock info for a component
   * @param {string} componentId
   * @returns {Object|null} - { user, clientId, timestamp } or null
   */
  getLockInfo(componentId) {
    return this.lockManager?.getLockInfo(componentId);
  }

  // ===== Events =====

  /**
   * Subscribe to an event
   * @param {string} event - Event name: 'sync', 'update', 'awareness', 'connectionChange'
   * @param {Function} callback
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Unsubscribe from an event
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  /**
   * Emit an event
   * @param {string} event
   * @param {Object} data
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data));
    }
  }

  // ===== Persistence (Stateless Relay) =====

  /**
   * Mark document as dirty (has unsaved changes)
   */
  markDirty() {
    if (!this.isDirty) {
      this.isDirty = true;
      this.emit('saveStatus', { status: 'dirty', isDirty: true });
      Logger.log('[YjsDocumentManager] Document marked dirty');
    }
  }

  /**
   * Mark document as clean (no unsaved changes)
   */
  markClean() {
    this.isDirty = false;
    this.lastSavedAt = new Date();
    this.emit('saveStatus', { status: 'saved', isDirty: false, savedAt: this.lastSavedAt });
  }

  /**
   * Check if document has unsaved changes
   * @returns {boolean}
   */
  hasUnsavedChanges() {
    return this.isDirty;
  }

  /**
   * Get save status info
   * @returns {{ isDirty: boolean, lastSavedAt: Date|null, saveInProgress: boolean }}
   */
  getSaveStatus() {
    return {
      isDirty: this.isDirty,
      lastSavedAt: this.lastSavedAt,
      saveInProgress: this.saveInProgress,
    };
  }

  /**
   * Handle beforeunload event - clear awareness and save if dirty
   * @param {BeforeUnloadEvent} event
   */
  _handleBeforeUnload(event) {
    // Clear awareness state immediately so other clients see us as disconnected
    this._clearAwarenessOnUnload();

    if (this.isDirty && !this.config.offline) {
      // Try to save synchronously (best effort) - no confirmation dialog
      this._saveSync();
    }
  }

  /**
   * Clear awareness state on page unload
   * This notifies other clients immediately that this user has disconnected
   */
  _clearAwarenessOnUnload() {
    try {
      if (this.awareness) {
        // Set local state to null to immediately notify other clients
        this.awareness.setLocalState(null);
        Logger.log('[YjsDocumentManager] Awareness cleared on unload');
      }
    } catch (error) {
      console.warn('[YjsDocumentManager] Failed to clear awareness on unload:', error);
    }
  }

  /**
   * Synchronous save attempt for beforeunload
   * Uses sendBeacon for best-effort delivery
   */
  _saveSync() {
    try {
      const state = this.Y.encodeStateAsUpdate(this.ydoc);
      const url = `${this.config.apiUrl}/projects/uuid/${this.projectId}/yjs-document`;

      // Use sendBeacon for reliable delivery during page unload
      if (navigator.sendBeacon) {
        const blob = new Blob([state], { type: 'application/octet-stream' });
        const success = navigator.sendBeacon(url, blob);
        Logger.log(`[YjsDocumentManager] sendBeacon save: ${success ? 'queued' : 'failed'}`);
      }
    } catch (error) {
      console.error('[YjsDocumentManager] Sync save failed:', error);
    }
  }

  /**
   * Save document to server (explicit save)
   * This is the primary save method in stateless relay architecture.
   *
   * @param {Object} options - Save options
   * @param {boolean} [options.silent=false] - Don't emit status events
   * @returns {Promise<{ success: boolean, bytes: number }>}
   */
  async saveToServer(options = {}) {
    const { silent = false } = options;

    if (this.config.offline) {
      console.warn('[YjsDocumentManager] Cannot save: offline mode');
      return { success: false, bytes: 0 };
    }

    if (this.saveInProgress) {
      console.warn('[YjsDocumentManager] Save already in progress');
      return { success: false, bytes: 0 };
    }

    this.saveInProgress = true;
    if (!silent) {
      this.emit('saveStatus', { status: 'saving', isDirty: this.isDirty });
    }

    try {
      // Store exelearning_version in metadata before saving
      await this._updateVersionMetadata();

      const state = this.Y.encodeStateAsUpdate(this.ydoc);

      const headers = {
        'Content-Type': 'application/octet-stream',
      };

      // Add auth token if available
      if (this.config.token) {
        headers['Authorization'] = `Bearer ${this.config.token}`;
      }

      const response = await fetch(
        `${this.config.apiUrl}/projects/uuid/${this.projectId}/yjs-document`,
        {
          method: 'POST',
          headers,
          body: state,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status} ${response.statusText}`);
      }

      this.markClean();
      Logger.log(`[YjsDocumentManager] Saved to server (${state.length} bytes)`);

      return { success: true, bytes: state.length };
    } catch (error) {
      console.error('[YjsDocumentManager] Failed to save to server:', error);

      if (!silent) {
        this.emit('saveStatus', { status: 'error', isDirty: this.isDirty, error: error.message });
      }

      throw error;
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * Save to server with UI feedback (returns status instead of throwing)
   * Useful for UI integration
   *
   * @returns {Promise<{ success: boolean, message: string, bytes?: number }>}
   */
  async save() {
    try {
      const result = await this.saveToServer();
      return {
        success: true,
        message: `Saved successfully (${result.bytes} bytes)`,
        bytes: result.bytes,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Save failed',
      };
    }
  }

  // ===== Cleanup =====

  /**
   * Destroy the document manager and cleanup resources
   * @param {Object} options - Destroy options
   * @param {boolean} [options.saveBeforeDestroy=false] - Save to server before destroying
   */
  async destroy(options = {}) {
    const { saveBeforeDestroy = false } = options;

    // Remove beforeunload and unload handlers
    window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    window.removeEventListener('unload', this._unloadHandler);

    // Save if requested and dirty
    if (saveBeforeDestroy && this.isDirty && !this.config.offline) {
      try {
        await this.saveToServer({ silent: true });
      } catch (error) {
        console.error('[YjsDocumentManager] Failed to save before destroy:', error);
      }
    }

    // Disconnect WebsocketProvider first
    if (this.wsProvider) {
      this.wsProvider.disconnect();
      this.wsProvider.destroy();
      this.wsProvider = null;
    }

    if (this.indexedDBProvider) {
      this.indexedDBProvider.destroy();
      this.indexedDBProvider = null;
    }

    if (this.undoManager) {
      this.undoManager.destroy();
      this.undoManager = null;
    }

    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }

    this.awareness = null;
    this.listeners = { sync: [], update: [], awareness: [], connectionChange: [], saveStatus: [], usersChange: [] };
    this.initialized = false;
    this.isDirty = false;
    this.saveInProgress = false;

    Logger.log(`[YjsDocumentManager] Destroyed for project ${this.projectId}`);
  }

  /**
   * Clear IndexedDB data for this project (useful before re-import)
   * Call this when the document is corrupted and needs to be reset
   * @returns {Promise<void>}
   */
  async clearIndexedDB() {
    const dbName = `exelearning-project-${this.projectId}`;
    Logger.log(`[YjsDocumentManager] Clearing IndexedDB: ${dbName}`);

    // If we have an active provider, use its clearData method
    if (this.indexedDBProvider && typeof this.indexedDBProvider.clearData === 'function') {
      await this.indexedDBProvider.clearData();
      Logger.log(`[YjsDocumentManager] Cleared via provider.clearData()`);
      return;
    }

    // Otherwise delete the database directly
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => {
        Logger.log(`[YjsDocumentManager] Deleted IndexedDB: ${dbName}`);
        resolve();
      };
      request.onerror = () => {
        console.error(`[YjsDocumentManager] Failed to delete IndexedDB: ${dbName}`);
        reject(request.error);
      };
      request.onblocked = () => {
        console.warn(`[YjsDocumentManager] IndexedDB deletion blocked: ${dbName}`);
        // Still resolve - the delete will happen when other tabs close
        resolve();
      };
    });
  }

  /**
   * Static method to clear IndexedDB for a project without initializing
   * @param {string|number} projectId
   * @returns {Promise<void>}
   */
  static async clearProjectIndexedDB(projectId) {
    const dbName = `exelearning-project-${projectId}`;
    Logger.log(`[YjsDocumentManager] Static clear IndexedDB: ${dbName}`);

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => {
        Logger.log(`[YjsDocumentManager] Deleted IndexedDB: ${dbName}`);
        resolve();
      };
      request.onerror = () => {
        console.error(`[YjsDocumentManager] Failed to delete IndexedDB: ${dbName}`);
        reject(request.error);
      };
      request.onblocked = () => {
        console.warn(`[YjsDocumentManager] IndexedDB deletion blocked: ${dbName}`);
        resolve();
      };
    });
  }
}


// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YjsDocumentManager;
} else {
  window.YjsDocumentManager = YjsDocumentManager;
}
