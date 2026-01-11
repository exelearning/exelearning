/**
 * ServerCollaborationAdapter - Server-side implementation of CollaborationPort.
 * Handles real-time collaboration via WebSocket.
 */
import { CollaborationPort } from '../../ports/CollaborationPort.js';

export class ServerCollaborationAdapter extends CollaborationPort {
    /**
     * @param {string} wsUrl - WebSocket base URL
     * @param {string} [basePath] - API base path for REST endpoints
     */
    constructor(wsUrl, basePath = '') {
        super();
        this.wsUrl = wsUrl;
        this.basePath = basePath;
        this.currentProjectId = null;
        this._presenceCallbacks = new Set();
    }

    /**
     * @inheritdoc
     */
    isEnabled() {
        return true;
    }

    /**
     * @inheritdoc
     */
    async connect(projectId) {
        this.currentProjectId = projectId;
        // Actual WebSocket connection is managed by YjsDocumentManager
        // This is a coordination point
    }

    /**
     * @inheritdoc
     */
    async disconnect() {
        this.currentProjectId = null;
    }

    /**
     * @inheritdoc
     */
    async getPresence() {
        // In server mode, presence is managed by Yjs awareness
        // This returns the current awareness states
        const awareness = window.eXeLearning?.app?.project?._yjsBridge?.awareness;
        if (!awareness) {
            return [];
        }

        const states = [];
        awareness.getStates().forEach((state, clientId) => {
            if (state.user) {
                states.push({
                    clientId,
                    userId: state.user.id || clientId.toString(),
                    username: state.user.name || 'Anonymous',
                    color: state.user.color || '#888888',
                    cursor: state.cursor,
                });
            }
        });

        return states;
    }

    /**
     * @inheritdoc
     */
    async updatePresence(data) {
        const awareness = window.eXeLearning?.app?.project?._yjsBridge?.awareness;
        if (!awareness) {
            return;
        }

        awareness.setLocalStateField('cursor', data.cursor);
        awareness.setLocalStateField('selection', data.selection);
    }

    /**
     * @inheritdoc
     */
    onPresenceChange(callback) {
        this._presenceCallbacks.add(callback);

        // Subscribe to awareness changes
        const awareness = window.eXeLearning?.app?.project?._yjsBridge?.awareness;
        if (awareness) {
            const handler = () => {
                this.getPresence().then(presence => {
                    callback(presence);
                });
            };
            awareness.on('change', handler);

            // Return unsubscribe function
            return () => {
                this._presenceCallbacks.delete(callback);
                awareness.off('change', handler);
            };
        }

        // Return no-op unsubscribe if awareness not available
        return () => {
            this._presenceCallbacks.delete(callback);
        };
    }

    /**
     * @inheritdoc
     */
    getWebSocketUrl() {
        return this.wsUrl;
    }

    /**
     * Get WebSocket URL for a specific project.
     * @param {string} projectId
     * @returns {string}
     */
    getProjectWebSocketUrl(projectId) {
        if (!this.wsUrl) {
            return null;
        }
        return `${this.wsUrl}/yjs/${projectId}`;
    }

    /**
     * @inheritdoc
     * In server mode with Yjs, block sync is automatic.
     * This method is for legacy API compatibility.
     */
    async obtainBlockSync(params) {
        // In Yjs mode, synchronization is automatic
        // Return null block indicating no server-side sync needed
        return { responseMessage: 'OK', block: null };
    }
}

export default ServerCollaborationAdapter;
