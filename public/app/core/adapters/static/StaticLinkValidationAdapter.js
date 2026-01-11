/**
 * StaticLinkValidationAdapter - Static/offline implementation of LinkValidationPort.
 * Link validation is not supported in offline mode since it requires
 * server-side connectivity checks.
 */
import { LinkValidationPort } from '../../ports/LinkValidationPort.js';

export class StaticLinkValidationAdapter extends LinkValidationPort {
    /**
     * @inheritdoc
     */
    async getSessionBrokenLinks() {
        // Link validation not supported in static mode
        return { responseMessage: 'OK', brokenLinks: [] };
    }

    /**
     * @inheritdoc
     */
    async extractLinks() {
        // Link extraction not supported in static mode
        return { responseMessage: 'OK', links: [], totalLinks: 0 };
    }

    /**
     * @inheritdoc
     */
    getValidationStreamUrl() {
        // No stream URL in static mode
        return null;
    }

    /**
     * @inheritdoc
     */
    async getPageBrokenLinks() {
        return { brokenLinks: [] };
    }

    /**
     * @inheritdoc
     */
    async getBlockBrokenLinks() {
        return { brokenLinks: [] };
    }

    /**
     * @inheritdoc
     */
    async getIdeviceBrokenLinks() {
        return { brokenLinks: [] };
    }

    /**
     * @inheritdoc
     */
    isSupported() {
        return false;
    }
}

export default StaticLinkValidationAdapter;
