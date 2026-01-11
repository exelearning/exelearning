/**
 * ProjectRepositoryPort - Domain interface for project persistence.
 * Implemented by ServerProjectRepository and StaticProjectRepository.
 */
export class ProjectRepositoryPort {
    /**
     * List all projects for the current user.
     * @returns {Promise<Array<{id: string, uuid: string, title: string, updatedAt: string}>>}
     */
    async list() {
        throw new Error('ProjectRepositoryPort.list() not implemented');
    }

    /**
     * Get a project by ID.
     * @param {string} id - Project ID or UUID
     * @returns {Promise<Object|null>}
     */
    async get(id) {
        throw new Error('ProjectRepositoryPort.get() not implemented');
    }

    /**
     * Create a new project.
     * @param {Object} data - Project data
     * @param {string} data.title - Project title
     * @returns {Promise<{id: string, uuid: string}>}
     */
    async create(data) {
        throw new Error('ProjectRepositoryPort.create() not implemented');
    }

    /**
     * Update an existing project.
     * @param {string} id - Project ID or UUID
     * @param {Object} data - Updated project data
     * @returns {Promise<Object>}
     */
    async update(id, data) {
        throw new Error('ProjectRepositoryPort.update() not implemented');
    }

    /**
     * Delete a project.
     * @param {string} id - Project ID or UUID
     * @returns {Promise<void>}
     */
    async delete(id) {
        throw new Error('ProjectRepositoryPort.delete() not implemented');
    }

    /**
     * Get recent projects.
     * @param {number} limit - Maximum number of projects to return
     * @returns {Promise<Array>}
     */
    async getRecent(limit = 10) {
        throw new Error('ProjectRepositoryPort.getRecent() not implemented');
    }

    /**
     * Check if a project exists.
     * @param {string} id - Project ID or UUID
     * @returns {Promise<boolean>}
     */
    async exists(id) {
        throw new Error('ProjectRepositoryPort.exists() not implemented');
    }

    /**
     * Save a project (manual save).
     * @param {string} sessionId - Session ID
     * @param {Object} params - Save parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async save(sessionId, params) {
        throw new Error('ProjectRepositoryPort.save() not implemented');
    }

    /**
     * Autosave a project.
     * @param {string} sessionId - Session ID
     * @param {Object} params - Autosave parameters
     * @returns {Promise<void>}
     */
    async autoSave(sessionId, params) {
        throw new Error('ProjectRepositoryPort.autoSave() not implemented');
    }

    /**
     * Save project as new copy.
     * @param {string} sessionId - Session ID
     * @param {Object} params - SaveAs parameters
     * @returns {Promise<{responseMessage: string, newProjectId?: string}>}
     */
    async saveAs(sessionId, params) {
        throw new Error('ProjectRepositoryPort.saveAs() not implemented');
    }

    /**
     * Duplicate a project.
     * @param {string} id - Project ID to duplicate
     * @returns {Promise<{id: string, uuid: string}>}
     */
    async duplicate(id) {
        throw new Error('ProjectRepositoryPort.duplicate() not implemented');
    }

    /**
     * Get project last updated timestamp.
     * @param {string} id - Project ID
     * @returns {Promise<{lastUpdated: string}>}
     */
    async getLastUpdated(id) {
        throw new Error('ProjectRepositoryPort.getLastUpdated() not implemented');
    }

    /**
     * Get concurrent users for a project.
     * @param {string} id - Project ID
     * @param {string} versionId - Version ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<{users: Array}>}
     */
    async getConcurrentUsers(id, versionId, sessionId) {
        throw new Error('ProjectRepositoryPort.getConcurrentUsers() not implemented');
    }

    /**
     * Close a project session.
     * @param {Object} params - Close session parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async closeSession(params) {
        throw new Error('ProjectRepositoryPort.closeSession() not implemented');
    }

    /**
     * Join a project session.
     * @param {string} sessionId - Session ID to join
     * @returns {Promise<{available: boolean}>}
     */
    async joinSession(sessionId) {
        throw new Error('ProjectRepositoryPort.joinSession() not implemented');
    }

    /**
     * Check current users in a session.
     * @param {Object} params - Check parameters
     * @returns {Promise<{currentUsers: number}>}
     */
    async checkCurrentUsers(params) {
        throw new Error('ProjectRepositoryPort.checkCurrentUsers() not implemented');
    }

    /**
     * Open/select a file for editing.
     * @param {string} fileName - File name or path
     * @returns {Promise<{responseMessage: string, odeSessionId: string}>}
     */
    async openFile(fileName) {
        throw new Error('ProjectRepositoryPort.openFile() not implemented');
    }

    /**
     * Open a local file (from browser upload).
     * @param {Object} data - File data
     * @returns {Promise<{responseMessage: string, odeSessionId: string}>}
     */
    async openLocalFile(data) {
        throw new Error('ProjectRepositoryPort.openLocalFile() not implemented');
    }

    /**
     * Open a large local file (chunked upload).
     * @param {Object} data - File data
     * @returns {Promise<{responseMessage: string, odeSessionId: string}>}
     */
    async openLargeLocalFile(data) {
        throw new Error('ProjectRepositoryPort.openLargeLocalFile() not implemented');
    }

    /**
     * Get properties from local XML file.
     * @param {Object} data - File data
     * @returns {Promise<{responseMessage: string, properties: Object}>}
     */
    async getLocalProperties(data) {
        throw new Error('ProjectRepositoryPort.getLocalProperties() not implemented');
    }

    /**
     * Get components from local file.
     * @param {Object} data - File data
     * @returns {Promise<{responseMessage: string, components: Array}>}
     */
    async getLocalComponents(data) {
        throw new Error('ProjectRepositoryPort.getLocalComponents() not implemented');
    }

    /**
     * Import ELP file to root.
     * @param {Object} data - Import data
     * @returns {Promise<{responseMessage: string}>}
     */
    async importToRoot(data) {
        throw new Error('ProjectRepositoryPort.importToRoot() not implemented');
    }

    /**
     * Import ELP file from local path to root.
     * @param {Object} payload - Import payload
     * @returns {Promise<{responseMessage: string}>}
     */
    async importToRootFromLocal(payload) {
        throw new Error('ProjectRepositoryPort.importToRootFromLocal() not implemented');
    }

    /**
     * Import ELP file as child of a navigation node.
     * @param {string} navId - Navigation node ID
     * @param {Object} payload - Import payload
     * @returns {Promise<{responseMessage: string}>}
     */
    async importAsChild(navId, payload) {
        throw new Error('ProjectRepositoryPort.importAsChild() not implemented');
    }

    /**
     * Open multiple local files.
     * @param {Object} data - Files data
     * @returns {Promise<{responseMessage: string}>}
     */
    async openMultipleLocalFiles(data) {
        throw new Error('ProjectRepositoryPort.openMultipleLocalFiles() not implemented');
    }

    /**
     * Delete old files by date.
     * @param {Object} params - Delete parameters (date cutoff)
     * @returns {Promise<{responseMessage: string}>}
     */
    async deleteByDate(params) {
        throw new Error('ProjectRepositoryPort.deleteByDate() not implemented');
    }

    /**
     * Clean autosaves for user.
     * @param {Object} params - Clean parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async cleanAutosaves(params) {
        throw new Error('ProjectRepositoryPort.cleanAutosaves() not implemented');
    }

    /**
     * Get project structure from session.
     * @param {string} versionId - Version ID
     * @param {string} sessionId - Session ID
     * @returns {Promise<{structure: Object|null}>}
     */
    async getStructure(versionId, sessionId) {
        throw new Error('ProjectRepositoryPort.getStructure() not implemented');
    }

    /**
     * Get project properties.
     * @param {string} sessionId - Session ID
     * @returns {Promise<{responseMessage: string, properties: Object}>}
     */
    async getProperties(sessionId) {
        throw new Error('ProjectRepositoryPort.getProperties() not implemented');
    }

    /**
     * Save project properties.
     * @param {Object} params - Properties to save
     * @returns {Promise<{responseMessage: string}>}
     */
    async saveProperties(params) {
        throw new Error('ProjectRepositoryPort.saveProperties() not implemented');
    }

    /**
     * Get used files in session.
     * @param {Object} params - Query parameters
     * @returns {Promise<{responseMessage: string, usedFiles: Array}>}
     */
    async getUsedFiles(params) {
        throw new Error('ProjectRepositoryPort.getUsedFiles() not implemented');
    }
}

export default ProjectRepositoryPort;
