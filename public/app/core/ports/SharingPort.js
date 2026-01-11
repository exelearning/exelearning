/**
 * SharingPort - Domain interface for project sharing operations.
 * Handles project visibility, collaborators, and ownership transfer.
 * Implemented by ServerSharingAdapter and StaticSharingAdapter.
 */
export class SharingPort {
    /**
     * Get project sharing information.
     * @param {string|number} projectId - Project ID or UUID
     * @returns {Promise<{responseMessage: string, project?: Object}>}
     */
    async getProject(projectId) {
        throw new Error('SharingPort.getProject() not implemented');
    }

    /**
     * Update project visibility (public/private).
     * @param {string|number} projectId - Project ID or UUID
     * @param {string} visibility - 'public' or 'private'
     * @returns {Promise<{responseMessage: string, project?: Object}>}
     */
    async updateVisibility(projectId, visibility) {
        throw new Error('SharingPort.updateVisibility() not implemented');
    }

    /**
     * Add a collaborator to a project.
     * @param {string|number} projectId - Project ID or UUID
     * @param {string} email - Collaborator's email
     * @param {string} [role='editor'] - Role (editor, viewer)
     * @returns {Promise<{responseMessage: string}>}
     */
    async addCollaborator(projectId, email, role = 'editor') {
        throw new Error('SharingPort.addCollaborator() not implemented');
    }

    /**
     * Remove a collaborator from a project.
     * @param {string|number} projectId - Project ID or UUID
     * @param {number} userId - Collaborator's user ID
     * @returns {Promise<{responseMessage: string}>}
     */
    async removeCollaborator(projectId, userId) {
        throw new Error('SharingPort.removeCollaborator() not implemented');
    }

    /**
     * Transfer project ownership to another user.
     * @param {string|number} projectId - Project ID or UUID
     * @param {number} newOwnerId - New owner's user ID
     * @returns {Promise<{responseMessage: string, project?: Object}>}
     */
    async transferOwnership(projectId, newOwnerId) {
        throw new Error('SharingPort.transferOwnership() not implemented');
    }

    /**
     * Check if sharing is supported in current mode.
     * @returns {boolean}
     */
    isSupported() {
        return true;
    }
}

export default SharingPort;
