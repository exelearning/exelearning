/**
 * YjsProviderFactory - Creates Yjs providers based on capabilities.
 *
 * This factory abstracts the decision of which Yjs providers to use:
 * - IndexedDB persistence: Always used for local offline storage
 * - WebSocket provider: Only used when collaboration is enabled
 *
 * Usage:
 * ```javascript
 * const factory = new YjsProviderFactory(capabilities, config);
 * const { indexedDB, websocket, awareness } = await factory.createProviders(ydoc, projectId);
 * ```
 */

export class YjsProviderFactory {
    /**
     * @param {import('../core/Capabilities').Capabilities} capabilities
     * @param {Object} [config]
     * @param {string} [config.wsUrl] - WebSocket URL for collaboration
     * @param {string} [config.token] - Auth token for WebSocket
     * @param {string} [config.dbPrefix] - IndexedDB database name prefix
     */
    constructor(capabilities, config = {}) {
        this.capabilities = capabilities;
        this.config = {
            wsUrl: config.wsUrl || null,
            token: config.token || '',
            dbPrefix: config.dbPrefix || 'exelearning-project-',
        };
    }

    /**
     * Create Yjs providers for a document.
     * @param {Y.Doc} ydoc - Yjs document
     * @param {string} projectId - Project UUID
     * @returns {Promise<{indexedDB: Object|null, websocket: Object|null, awareness: Object|null}>}
     */
    async createProviders(ydoc, projectId) {
        const result = {
            indexedDB: null,
            websocket: null,
            awareness: null,
        };

        // IndexedDB persistence - ALWAYS created for local storage
        result.indexedDB = await this._createIndexedDBProvider(ydoc, projectId);

        // WebSocket provider - ONLY if collaboration is enabled
        if (this.capabilities.collaboration.enabled && this.config.wsUrl) {
            const wsResult = await this._createWebSocketProvider(ydoc, projectId);
            result.websocket = wsResult.provider;
            result.awareness = wsResult.awareness;
        }

        return result;
    }

    /**
     * Create IndexedDB persistence provider.
     * @private
     */
    async _createIndexedDBProvider(ydoc, projectId) {
        const IndexeddbPersistence = window.IndexeddbPersistence;
        if (!IndexeddbPersistence) {
            console.warn(
                '[YjsProviderFactory] IndexeddbPersistence not loaded. ' +
                    'Ensure y-indexeddb.min.js is loaded first.'
            );
            return null;
        }

        const dbName = `${this.config.dbPrefix}${projectId}`;
        const provider = new IndexeddbPersistence(dbName, ydoc);

        // Wait for sync
        return new Promise((resolve) => {
            provider.on('synced', () => {
                resolve(provider);
            });

            // Timeout fallback
            setTimeout(() => {
                if (!provider.synced) {
                    console.warn('[YjsProviderFactory] IndexedDB sync timeout, continuing...');
                    resolve(provider);
                }
            }, 5000);
        });
    }

    /**
     * Create WebSocket provider for real-time collaboration.
     * @private
     */
    async _createWebSocketProvider(ydoc, projectId) {
        const WebsocketProvider = window.WebsocketProvider;
        if (!WebsocketProvider) {
            console.warn(
                '[YjsProviderFactory] WebsocketProvider not loaded. ' +
                    'Collaboration features will be disabled.'
            );
            return { provider: null, awareness: null };
        }

        const roomName = `project-${projectId}`;

        const provider = new WebsocketProvider(this.config.wsUrl, roomName, ydoc, {
            // Don't auto-connect - let caller control when to connect
            connect: false,
            // Pass JWT token as URL param for authentication
            params: { token: this.config.token },
        });

        return {
            provider,
            awareness: provider.awareness,
        };
    }

    /**
     * Check if WebSocket provider is available.
     * @returns {boolean}
     */
    isWebSocketAvailable() {
        return (
            this.capabilities.collaboration.enabled &&
            !!this.config.wsUrl &&
            !!window.WebsocketProvider
        );
    }

    /**
     * Check if IndexedDB provider is available.
     * @returns {boolean}
     */
    isIndexedDBAvailable() {
        return !!window.IndexeddbPersistence;
    }

    /**
     * Generate a random user color for awareness.
     * @returns {string} - Hex color string
     */
    generateUserColor() {
        const colors = [
            '#f44336', '#e91e63', '#9c27b0', '#673ab7',
            '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
            '#009688', '#4caf50', '#8bc34a', '#cddc39',
            '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

export default YjsProviderFactory;
