/**
 * CollaborationPort - Domain interface for real-time collaboration.
 * Implemented by ServerCollaborationAdapter and NullCollaborationAdapter.
 */
export class CollaborationPort {
    /**
     * Check if collaboration is enabled.
     * @returns {boolean}
     */
    isEnabled() {
        return false;
    }

    /**
     * Connect to a collaboration session for a project.
     * @param {string} projectId - Project UUID
     * @returns {Promise<void>}
     */
    async connect(projectId) {
        throw new Error('CollaborationPort.connect() not implemented');
    }

    /**
     * Disconnect from the current collaboration session.
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error('CollaborationPort.disconnect() not implemented');
    }

    /**
     * Get current presence information (who's online).
     * @returns {Promise<Array<{userId: string, username: string, color: string, cursor?: Object}>>}
     */
    async getPresence() {
        throw new Error('CollaborationPort.getPresence() not implemented');
    }

    /**
     * Update local user's presence (cursor position, selection, etc.).
     * @param {Object} data - Presence data
     * @returns {Promise<void>}
     */
    async updatePresence(data) {
        throw new Error('CollaborationPort.updatePresence() not implemented');
    }

    /**
     * Subscribe to presence changes.
     * @param {Function} callback - Called when presence changes
     * @returns {Function} - Unsubscribe function
     */
    onPresenceChange(callback) {
        throw new Error('CollaborationPort.onPresenceChange() not implemented');
    }

    /**
     * Get WebSocket URL for Yjs provider.
     * @returns {string|null}
     */
    getWebSocketUrl() {
        return null;
    }

    /**
     * Obtain block sync data.
     * In Yjs mode, synchronization is automatic - this returns null.
     * @param {Object} params - Sync parameters
     * @returns {Promise<{responseMessage: string, block: Object|null}>}
     */
    async obtainBlockSync(params) {
        throw new Error('CollaborationPort.obtainBlockSync() not implemented');
    }
}

export default CollaborationPort;
