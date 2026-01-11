/**
 * PlatformIntegrationPort - Domain interface for LMS platform integration.
 * Handles integration with external Learning Management Systems (Moodle, etc.).
 * Implemented by ServerPlatformIntegrationAdapter and StaticPlatformIntegrationAdapter.
 */
export class PlatformIntegrationPort {
    /**
     * Upload a new ELP file to an LMS platform.
     * @param {Object} params - Upload parameters
     * @param {string} params.platformId - Target platform ID
     * @param {string} params.projectId - Project ID to upload
     * @returns {Promise<{responseMessage: string}>}
     */
    async uploadElp(params) {
        throw new Error('PlatformIntegrationPort.uploadElp() not implemented');
    }

    /**
     * Open an ELP file from an LMS platform.
     * @param {Object} params - Open parameters
     * @param {string} params.platformId - Source platform ID
     * @param {string} params.fileId - File ID on the platform
     * @returns {Promise<{responseMessage: string}>}
     */
    async openElp(params) {
        throw new Error('PlatformIntegrationPort.openElp() not implemented');
    }

    /**
     * Check if platform integration is supported.
     * @returns {boolean}
     */
    isSupported() {
        return true;
    }
}

export default PlatformIntegrationPort;
