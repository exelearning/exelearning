/**
 * StaticPlatformIntegrationAdapter - Static/offline implementation of PlatformIntegrationPort.
 * Platform integration is not supported in offline mode since it requires
 * server-side communication with external LMS platforms.
 */
import { PlatformIntegrationPort } from '../../ports/PlatformIntegrationPort.js';

export class StaticPlatformIntegrationAdapter extends PlatformIntegrationPort {
    /**
     * @inheritdoc
     */
    async uploadElp() {
        // Platform integration not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    async openElp() {
        // Platform integration not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    isSupported() {
        return false;
    }
}

export default StaticPlatformIntegrationAdapter;
