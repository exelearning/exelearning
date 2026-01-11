/**
 * NullCollaborationAdapter - No-op implementation of CollaborationPort.
 * Used in static/offline mode where collaboration is not available.
 */
import { CollaborationPort } from '../../ports/CollaborationPort.js';

export class NullCollaborationAdapter extends CollaborationPort {
    /**
     * @inheritdoc
     */
    isEnabled() {
        return false;
    }

    /**
     * @inheritdoc
     */
    async connect(_projectId) {
        // No-op: No collaboration in static mode
    }

    /**
     * @inheritdoc
     */
    async disconnect() {
        // No-op: No collaboration in static mode
    }

    /**
     * @inheritdoc
     */
    async getPresence() {
        // In static mode, only the current user exists
        return [
            {
                clientId: 0,
                userId: 'local',
                username: 'You',
                color: '#4285f4',
                cursor: null,
            },
        ];
    }

    /**
     * @inheritdoc
     */
    async updatePresence(_data) {
        // No-op: No collaboration in static mode
    }

    /**
     * @inheritdoc
     */
    onPresenceChange(_callback) {
        // Return no-op unsubscribe function
        return () => {};
    }

    /**
     * @inheritdoc
     */
    getWebSocketUrl() {
        return null;
    }

    /**
     * @inheritdoc
     * In static mode, Yjs handles all synchronization.
     */
    async obtainBlockSync(_params) {
        return { responseMessage: 'OK', block: null };
    }
}

export default NullCollaborationAdapter;
