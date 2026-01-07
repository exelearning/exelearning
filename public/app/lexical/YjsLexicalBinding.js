/**
 * Yjs Lexical Binding
 *
 * Integrates Lexical with Yjs for real-time collaborative editing.
 * Uses @lexical/yjs for synchronization and cursor awareness.
 */
(function () {
    'use strict';

    const {
        createBinding,
        createBindingV2__EXPERIMENTAL,
        createUndoManager,
        syncCursorPositions,
        syncLexicalUpdateToYjs,
        syncLexicalUpdateToYjsV2__EXPERIMENTAL,
        syncYjsChangesToLexical,
        syncYjsChangesToLexicalV2__EXPERIMENTAL,
        syncYjsStateToLexicalV2__EXPERIMENTAL,
        initLocalState,
        setLocalStateFocus,
        CONNECTED_COMMAND,
        TOGGLE_CONNECT_COMMAND,
        COMMAND_PRIORITY_LOW,
        FOCUS_COMMAND,
        BLUR_COMMAND,
    } = window.LexicalBundle;

    const Logger = window.Logger || console;

    // User colors for remote cursors
    const USER_COLORS = [
        '#e91e63',
        '#9c27b0',
        '#673ab7',
        '#3f51b5',
        '#2196f3',
        '#03a9f4',
        '#00bcd4',
        '#009688',
        '#4caf50',
        '#8bc34a',
        '#cddc39',
        '#ffeb3b',
        '#ffc107',
        '#ff9800',
        '#ff5722',
        '#795548',
    ];

    /**
     * Generate a consistent color for a user ID
     */
    function getUserColor(userId) {
        if (!userId) return USER_COLORS[0];
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = (hash << 5) - hash + userId.charCodeAt(i);
            hash = hash & hash;
        }
        return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
    }

    // Global map for doc bindings - required by @lexical/yjs
    const globalDocMap = new Map();

    /**
     * YjsLexicalBinding class
     *
     * Binds a Lexical editor to a Yjs document for real-time collaboration.
     * Uses @lexical/yjs API: createBinding(editor, provider, id, doc, docMap)
     */
    class YjsLexicalBinding {
        /**
         * @param {LexicalEditor} editor - Lexical editor wrapper instance
         * @param {string} bindingId - Unique ID for this binding (e.g., componentId-fieldName)
         * @param {Object} options
         * @param {Y.Doc} options.ydoc - Yjs document
         * @param {Object} options.provider - WebSocket provider with awareness
         * @param {Object} [options.assetManager] - Asset manager for URL resolution
         * @param {string} [options.userId] - Current user ID
         * @param {string} [options.userName] - Current user display name
         * @param {string} [options.userColor] - User cursor color
         */
        constructor(editor, bindingId, options = {}) {
            this.editorWrapper = editor;
            this.editor = this.editorWrapper.getEditor();
            this.bindingId = bindingId;
            this.ydoc = options.ydoc;
            this.provider = options.provider;
            this.assetManager = options.assetManager || null;

            this.userId = options.userId || 'unknown';
            this.userName = options.userName || 'User';
            this.userColor = options.userColor || getUserColor(this.userId);

            this._binding = null;
            this._undoManager = null;
            this._cleanupFunctions = [];
            this._destroyed = false;
            this._assetObserver = null;
            this._cursorsContainer = null;

            this._init();
        }

        /**
         * Initialize the binding
         * @private
         */
        _init() {
            try {
                if (!this.ydoc) {
                    Logger.error('[YjsLexicalBinding] No Y.Doc provided');
                    return;
                }

                // Get awareness from provider
                const awareness = this.provider?.awareness;

                // Initialize local state for cursor tracking using @lexical/yjs API
                // initLocalState(provider, name, color, focusing, awarenessData)
                if (this.provider && awareness) {
                    initLocalState(this.provider, this.userName, this.userColor, false, {
                        bindingId: this.bindingId,
                    });
                    // Set the user field AFTER initLocalState (which sets a completely new state)
                    // This is needed for displaying user info in the cursor badge
                    awareness.setLocalStateField('user', {
                        name: this.userName,
                        color: this.userColor,
                        colorLight: this.userColor + '33',
                    });
                }

                // Add this doc to the global map if not already there
                if (!globalDocMap.has(this.bindingId)) {
                    globalDocMap.set(this.bindingId, this.ydoc);
                }

                // Create the Lexical-Yjs binding using the correct API
                // createBinding(editor, provider, id, doc, docMap, excludedProperties?)
                // Use a unique root name per binding to avoid conflicts between multiple editors
                // The V2 API allows specifying a custom rootName
                const rootName = this.bindingId;

                Logger.log('[YjsLexicalBinding] Creating binding:', {
                    hasEditor: !!this.editor,
                    editorType: this.editor?.constructor?.name,
                    hasProvider: !!this.provider,
                    providerType: this.provider?.constructor?.name,
                    providerSynced: this.provider?.synced,
                    providerWsConnected: this.provider?.wsconnected,
                    hasYdoc: !!this.ydoc,
                    ydocType: this.ydoc?.constructor?.name,
                    ydocClientId: this.ydoc?.clientID,
                    hasGlobalDocMap: !!globalDocMap,
                    rootName: rootName,
                });

                // Use V2 API with custom rootName so each editor has its own Y.XmlElement
                this._binding = createBindingV2__EXPERIMENTAL(
                    this.editor,
                    this.provider,
                    this.ydoc,
                    globalDocMap,
                    { rootName: rootName }
                );

                // Store the root name for later use
                this._rootName = rootName;

                Logger.log('[YjsLexicalBinding] Binding created:', {
                    hasBinding: !!this._binding,
                    hasRoot: !!this._binding?.root,
                    rootType: this._binding?.root?.constructor?.name,
                    rootName: rootName,
                });

                // Create cursors container for remote cursor display
                this._setupCursorsContainer();

                // Create undo manager for collaborative undo
                // For V2 API, binding.root is the XmlElement directly
                if (this._binding && this._binding.root) {
                    try {
                        Logger.log('[YjsLexicalBinding] Creating UndoManager with root:', this._binding.root?.constructor?.name);
                        this._undoManager = createUndoManager(this._binding, this._binding.root);
                    } catch (undoError) {
                        Logger.warn('[YjsLexicalBinding] UndoManager creation failed:', undoError);
                    }
                }

                // Setup focus/blur tracking for cursor visibility
                if (awareness) {
                    this._setupCursorSync(awareness);
                }

                // Setup asset URL observer
                this._setupAssetUrlObserver();

                // Register sync listeners to keep Lexical and Yjs in sync
                // This is the critical part for real-time collaboration
                if (this._binding) {
                    // Sync Lexical changes to Yjs
                    this._cleanupFunctions.push(
                        this.editor.registerUpdateListener(({ dirtyElements, editorState, prevEditorState, normalizedNodes, tags }) => {
                            // Ensure tags is a Set (may be undefined)
                            const tagsSet = tags || new Set();
                            if (tagsSet.has('collaboration') || tagsSet.has('historic')) {
                                // Skip if update came from Yjs or undo/redo
                                return;
                            }
                            try {
                                // Use V2 sync function for V2 bindings
                                // Signature: (binding, provider, prevEditorState, currEditorState, dirtyElements, normalizedNodes, tags)
                                syncLexicalUpdateToYjsV2__EXPERIMENTAL(
                                    this._binding,
                                    this.provider,
                                    prevEditorState,
                                    editorState,
                                    dirtyElements,
                                    normalizedNodes || new Set(),
                                    tagsSet
                                );
                            } catch (error) {
                                Logger.error('[YjsLexicalBinding] syncLexicalUpdateToYjs failed:', error);
                            }
                        })
                    );

                    // Sync Yjs changes to Lexical (from remote users)
                    // For V2 API, binding.root is the XmlElement directly
                    const root = this._binding.root;
                    if (root) {
                        // Observer receives Yjs events - use V2 sync function
                        // Signature: (binding, provider, events, transaction, isFromUndoManger)
                        const yjsObserver = (events, transaction) => {
                            // Skip if this is a local transaction
                            if (transaction.local) {
                                return;
                            }
                            try {
                                Logger.log('[YjsLexicalBinding] Yjs observer triggered for', this.bindingId, {
                                    eventsCount: events?.length || 0,
                                    transactionLocal: transaction.local,
                                    transactionOrigin: transaction.origin,
                                });
                                this.editor.update(() => {
                                    // Use V2 sync function for V2 bindings
                                    syncYjsChangesToLexicalV2__EXPERIMENTAL(this._binding, this.provider, events, transaction, false);
                                }, { tag: 'collaboration' });
                            } catch (error) {
                                Logger.error('[YjsLexicalBinding] syncYjsChangesToLexical failed:', error);
                            }
                        };
                        root.observeDeep(yjsObserver);
                        this._cleanupFunctions.push(() => root.unobserveDeep(yjsObserver));
                        Logger.log('[YjsLexicalBinding] Yjs observer registered on root:', this._rootName);
                    }

                    // Initial sync: Use V2 state sync to pull existing content from Yjs
                    try {
                        const childCount = root?.length || 0;
                        if (childCount > 0) {
                            Logger.log('[YjsLexicalBinding] Root has', childCount, 'children for', this.bindingId, '- performing initial sync');
                            this.editor.update(() => {
                                syncYjsStateToLexicalV2__EXPERIMENTAL(this._binding, this.provider);
                            }, { tag: 'collaboration' });
                        } else {
                            Logger.log('[YjsLexicalBinding] No initial content for', this.bindingId);
                        }
                    } catch (syncError) {
                        Logger.warn('[YjsLexicalBinding] Initial sync failed:', syncError);
                    }
                }

                // Debug: Log binding state
                Logger.log('[YjsLexicalBinding] Initialized', {
                    bindingId: this.bindingId,
                    rootName: this._rootName,
                    userId: this.userId,
                    userName: this.userName,
                    hasAwareness: !!awareness,
                    bindingRootType: this._binding?.root?.constructor?.name,
                });
            } catch (error) {
                Logger.error('[YjsLexicalBinding] Initialization failed:', error);
            }
        }

        /**
         * Setup cursors container for remote cursor display
         * @private
         */
        _setupCursorsContainer() {
            const rootElement = this.editor.getRootElement();
            if (!rootElement || !this._binding) return;

            // Find or create the editor wrapper that will contain the cursors
            let editorWrapper = rootElement.parentElement;
            if (!editorWrapper) return;

            // Make sure the wrapper has position:relative for absolute positioning of cursors
            const wrapperStyle = window.getComputedStyle(editorWrapper);
            if (wrapperStyle.position === 'static') {
                editorWrapper.style.position = 'relative';
            }

            // Create cursors container
            this._cursorsContainer = document.createElement('div');
            this._cursorsContainer.className = 'lexical-cursors-container';
            this._cursorsContainer.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:10;overflow:hidden;';
            editorWrapper.appendChild(this._cursorsContainer);

            // Assign to binding so syncCursorPositions can use it
            this._binding.cursorsContainer = this._cursorsContainer;

            Logger.log('[YjsLexicalBinding] Cursors container created');
        }

        /**
         * Setup cursor synchronization
         * @private
         */
        _setupCursorSync(awareness) {
            // Update focus state on focus/blur
            // Use setLocalStateFocus which preserves existing state fields
            if (FOCUS_COMMAND && BLUR_COMMAND) {
                this._cleanupFunctions.push(
                    this.editor.registerCommand(
                        FOCUS_COMMAND,
                        () => {
                            // Update local state to show we're focusing (preserves other fields)
                            setLocalStateFocus(this.provider, this.userName, this.userColor, true, {
                                bindingId: this.bindingId,
                            });
                            // Sync cursor positions when focus changes
                            if (this._binding && this.provider) {
                                syncCursorPositions(this._binding, this.provider);
                            }
                            return false;
                        },
                        COMMAND_PRIORITY_LOW
                    )
                );

                this._cleanupFunctions.push(
                    this.editor.registerCommand(
                        BLUR_COMMAND,
                        () => {
                            // Update local state to show we're not focusing (preserves other fields)
                            setLocalStateFocus(this.provider, this.userName, this.userColor, false, {
                                bindingId: this.bindingId,
                            });
                            return false;
                        },
                        COMMAND_PRIORITY_LOW
                    )
                );
            }

            // Listen for awareness updates from remote users to render their cursors
            const awarenessUpdateHandler = () => {
                if (this._binding && this.provider && !this._destroyed) {
                    try {
                        syncCursorPositions(this._binding, this.provider);
                    } catch (error) {
                        Logger.warn('[YjsLexicalBinding] syncCursorPositions failed:', error);
                    }
                }
            };

            awareness.on('update', awarenessUpdateHandler);
            this._cleanupFunctions.push(() => awareness.off('update', awarenessUpdateHandler));

            Logger.log('[YjsLexicalBinding] Cursor sync setup complete');
        }

        /**
         * Setup observer for asset:// URL resolution
         * @private
         */
        _setupAssetUrlObserver() {
            const editorRoot = this.editor.getRootElement();
            if (!editorRoot) return;

            const assetManager = this.assetManager || window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
            if (!assetManager) {
                Logger.log('[YjsLexicalBinding] AssetManager not available, skipping URL observer');
                return;
            }

            // Use MutationObserver to detect new media with asset:// URLs
            this._assetObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this._resolveAssetUrls(node, assetManager);
                        }
                    }
                }
            });

            this._assetObserver.observe(editorRoot, {
                childList: true,
                subtree: true,
            });

            // Resolve existing asset URLs
            this._resolveAssetUrls(editorRoot, assetManager);
        }

        /**
         * Resolve asset:// URLs to blob: URLs for display
         * @private
         */
        async _resolveAssetUrls(rootElement, assetManager) {
            const mediaSelectors = [
                'img[src^="asset://"]',
                'video[src^="asset://"]',
                'audio[src^="asset://"]',
                'source[src^="asset://"]',
            ];

            const elements = rootElement.querySelectorAll(mediaSelectors.join(', '));

            // Also check if rootElement itself matches
            if (rootElement.matches && rootElement.matches(mediaSelectors.join(', '))) {
                await this._resolveElementAssetUrl(rootElement, assetManager);
            }

            for (const element of elements) {
                await this._resolveElementAssetUrl(element, assetManager);
            }
        }

        /**
         * Resolve asset URL for a single element
         * @private
         */
        async _resolveElementAssetUrl(element, assetManager) {
            const src = element.getAttribute('src');
            if (!src || !src.startsWith('asset://')) return;

            // Store original asset URL
            if (!element.getAttribute('data-asset-src')) {
                element.setAttribute('data-asset-src', src);
            }

            // Set placeholder while loading
            if (element.tagName === 'IMG') {
                element.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            }

            try {
                // Parse asset URL: asset://uuid/filename
                const match = src.match(/^asset:\/\/([a-f0-9-]+)\/(.+)$/i);
                if (!match) {
                    Logger.warn('[YjsLexicalBinding] Invalid asset URL:', src);
                    return;
                }

                const assetId = match[1];

                // Try to get blob URL from cache
                let blobUrl = assetManager.blobURLCache?.get(assetId);

                if (!blobUrl) {
                    // Resolve via AssetManager
                    blobUrl = await assetManager.resolveAssetURL?.(src);
                }

                if (blobUrl && !this._destroyed) {
                    element.src = blobUrl;
                    Logger.log('[YjsLexicalBinding] Resolved asset URL:', src, '->', blobUrl);
                }
            } catch (error) {
                Logger.error('[YjsLexicalBinding] Failed to resolve asset URL:', src, error);
            }
        }

        /**
         * Get the current user info
         * @returns {Object}
         */
        getUserInfo() {
            return {
                userId: this.userId,
                userName: this.userName,
                userColor: this.userColor,
            };
        }

        /**
         * Update user info
         * @param {Object} info
         */
        updateUserInfo(info) {
            if (info.userName) this.userName = info.userName;
            if (info.userColor) this.userColor = info.userColor;

            const awareness = this.provider?.awareness;
            if (awareness) {
                awareness.setLocalStateField('user', {
                    name: this.userName,
                    color: this.userColor,
                    colorLight: this.userColor + '33',
                });
            }
        }

        /**
         * Get connected users
         * @returns {Array}
         */
        getConnectedUsers() {
            const awareness = this.provider?.awareness;
            if (!awareness) return [];

            const users = [];
            awareness.getStates().forEach((state, clientId) => {
                if (state.user && clientId !== awareness.clientID) {
                    users.push({
                        clientId,
                        ...state.user,
                    });
                }
            });

            return users;
        }

        /**
         * Undo
         */
        undo() {
            if (this._undoManager) {
                this._undoManager.undo();
            }
        }

        /**
         * Redo
         */
        redo() {
            if (this._undoManager) {
                this._undoManager.redo();
            }
        }

        /**
         * Check if binding is destroyed
         * @returns {boolean}
         */
        isDestroyed() {
            return this._destroyed;
        }

        /**
         * Destroy the binding
         */
        destroy() {
            if (this._destroyed) return;

            this._destroyed = true;

            // Cleanup functions
            for (const cleanup of this._cleanupFunctions) {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            }
            this._cleanupFunctions = [];

            // Stop observing asset URLs
            if (this._assetObserver) {
                this._assetObserver.disconnect();
                this._assetObserver = null;
            }

            // Remove cursors container
            if (this._cursorsContainer && this._cursorsContainer.parentElement) {
                this._cursorsContainer.parentElement.removeChild(this._cursorsContainer);
                this._cursorsContainer = null;
            }

            // Clear awareness state
            const awareness = this.provider?.awareness;
            if (awareness) {
                awareness.setLocalStateField('user', null);
            }

            // Destroy undo manager
            if (this._undoManager) {
                this._undoManager.destroy();
                this._undoManager = null;
            }

            // Remove from global doc map
            globalDocMap.delete(this.bindingId);

            this._binding = null;

            Logger.log('[YjsLexicalBinding] Destroyed');
        }
    }

    // Export globally
    window.YjsLexicalBinding = YjsLexicalBinding;
})();
