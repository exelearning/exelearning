/**
 * LinkValidationPort - Domain interface for link validation operations.
 * Handles broken link detection and validation across project content.
 * Implemented by ServerLinkValidationAdapter and StaticLinkValidationAdapter.
 */
export class LinkValidationPort {
    /**
     * Get broken links for an entire session/project.
     * @param {Object} params - Query parameters
     * @param {string} params.odeSessionId - Session ID
     * @returns {Promise<{responseMessage: string, brokenLinks: Array}>}
     */
    async getSessionBrokenLinks(params) {
        throw new Error('LinkValidationPort.getSessionBrokenLinks() not implemented');
    }

    /**
     * Extract links from iDevices for validation.
     * @param {Object} params - Extraction parameters
     * @param {string} params.odeSessionId - Session ID
     * @param {Array} params.idevices - iDevice data to extract links from
     * @returns {Promise<{responseMessage: string, links: Array, totalLinks: number}>}
     */
    async extractLinks(params) {
        throw new Error('LinkValidationPort.extractLinks() not implemented');
    }

    /**
     * Get the URL for the link validation stream endpoint (SSE).
     * @returns {string}
     */
    getValidationStreamUrl() {
        throw new Error('LinkValidationPort.getValidationStreamUrl() not implemented');
    }

    /**
     * Get broken links for a specific page.
     * @param {string} pageId - Page ID
     * @returns {Promise<{brokenLinks: Array}>}
     */
    async getPageBrokenLinks(pageId) {
        throw new Error('LinkValidationPort.getPageBrokenLinks() not implemented');
    }

    /**
     * Get broken links for a specific block.
     * @param {string} blockId - Block ID
     * @returns {Promise<{brokenLinks: Array}>}
     */
    async getBlockBrokenLinks(blockId) {
        throw new Error('LinkValidationPort.getBlockBrokenLinks() not implemented');
    }

    /**
     * Get broken links for a specific iDevice.
     * @param {string} ideviceId - iDevice ID
     * @returns {Promise<{brokenLinks: Array}>}
     */
    async getIdeviceBrokenLinks(ideviceId) {
        throw new Error('LinkValidationPort.getIdeviceBrokenLinks() not implemented');
    }

    /**
     * Check if link validation is supported.
     * @returns {boolean}
     */
    isSupported() {
        return true;
    }
}

export default LinkValidationPort;
