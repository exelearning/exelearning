/**
 * ContentPort - Domain interface for content structure operations.
 * Handles pages, blocks, and iDevices manipulation.
 * Implemented by ServerContentAdapter and StaticContentAdapter.
 */
export class ContentPort {
    /**
     * Save page data.
     * @param {Object} params - Page save parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async savePage(params) {
        throw new Error('ContentPort.savePage() not implemented');
    }

    /**
     * Reorder pages.
     * @param {Object} params - Reorder parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async reorderPage(params) {
        throw new Error('ContentPort.reorderPage() not implemented');
    }

    /**
     * Clone/duplicate a page.
     * @param {Object} params - Clone parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async clonePage(params) {
        throw new Error('ContentPort.clonePage() not implemented');
    }

    /**
     * Delete a page.
     * @param {string} pageId - Page ID to delete
     * @returns {Promise<{responseMessage: string}>}
     */
    async deletePage(pageId) {
        throw new Error('ContentPort.deletePage() not implemented');
    }

    /**
     * Reorder blocks within a page.
     * @param {Object} params - Reorder parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async reorderBlock(params) {
        throw new Error('ContentPort.reorderBlock() not implemented');
    }

    /**
     * Delete a block.
     * @param {string} blockId - Block ID to delete
     * @returns {Promise<{responseMessage: string}>}
     */
    async deleteBlock(blockId) {
        throw new Error('ContentPort.deleteBlock() not implemented');
    }

    /**
     * Reorder iDevices within a block.
     * @param {Object} params - Reorder parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async reorderIdevice(params) {
        throw new Error('ContentPort.reorderIdevice() not implemented');
    }

    /**
     * Save iDevice data.
     * @param {Object} params - iDevice save parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async saveIdevice(params) {
        throw new Error('ContentPort.saveIdevice() not implemented');
    }

    /**
     * Clone/duplicate an iDevice.
     * @param {Object} params - Clone parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async cloneIdevice(params) {
        throw new Error('ContentPort.cloneIdevice() not implemented');
    }

    /**
     * Delete an iDevice.
     * @param {string} ideviceId - iDevice ID to delete
     * @returns {Promise<{responseMessage: string}>}
     */
    async deleteIdevice(ideviceId) {
        throw new Error('ContentPort.deleteIdevice() not implemented');
    }

    /**
     * Generic send operation for custom endpoints.
     * @param {string} endpointId - Endpoint identifier
     * @param {Object} params - Request parameters
     * @returns {Promise<any>}
     */
    async send(endpointId, params) {
        throw new Error('ContentPort.send() not implemented');
    }
}

export default ContentPort;
