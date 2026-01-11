/**
 * StaticContentAdapter - Static/offline implementation of ContentPort.
 * In static mode, content operations are handled locally via Yjs.
 * These methods return success and let Yjs handle the actual changes.
 */
import { ContentPort } from '../../ports/ContentPort.js';

export class StaticContentAdapter extends ContentPort {
    /**
     * @param {Object} [dataProvider] - Optional DataProvider instance
     */
    constructor(dataProvider = null) {
        super();
        this.dataProvider = dataProvider;
    }

    /**
     * @inheritdoc
     * In static mode, page save is handled by Yjs sync.
     */
    async savePage(params) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, page reorder is handled by Yjs sync.
     */
    async reorderPage(params) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, page clone is handled locally.
     */
    async clonePage(params) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, page delete is handled by Yjs sync.
     */
    async deletePage(pageId) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, block reorder is handled by Yjs sync.
     */
    async reorderBlock(params) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, block delete is handled by Yjs sync.
     */
    async deleteBlock(blockId) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, iDevice reorder is handled by Yjs sync.
     */
    async reorderIdevice(params) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, iDevice save is handled by Yjs sync.
     */
    async saveIdevice(params) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, iDevice clone is handled locally.
     */
    async cloneIdevice(params) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, iDevice delete is handled by Yjs sync.
     */
    async deleteIdevice(ideviceId) {
        // In static mode, Yjs handles all content synchronization
        return { responseMessage: 'OK' };
    }

    /**
     * @inheritdoc
     * In static mode, generic send returns success.
     */
    async send(endpointId, params) {
        // In static mode, most endpoints are not available
        console.warn(`[StaticContentAdapter] Endpoint ${endpointId} not available in offline mode`);
        return { responseMessage: 'OK' };
    }
}

export default StaticContentAdapter;
