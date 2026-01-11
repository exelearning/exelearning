/**
 * StaticSharingAdapter - Static/offline implementation of SharingPort.
 * Sharing is not supported in offline mode since it requires
 * server-side user management and real-time collaboration.
 */
import { SharingPort } from '../../ports/SharingPort.js';

export class StaticSharingAdapter extends SharingPort {
    /**
     * @inheritdoc
     */
    async getProject(_projectId) {
        // Sharing not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    async updateVisibility(_projectId, _visibility) {
        // Sharing not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    async addCollaborator(_projectId, _email, _role) {
        // Sharing not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    async removeCollaborator(_projectId, _userId) {
        // Sharing not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    async transferOwnership(_projectId, _newOwnerId) {
        // Sharing not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    isSupported() {
        return false;
    }
}

export default StaticSharingAdapter;
