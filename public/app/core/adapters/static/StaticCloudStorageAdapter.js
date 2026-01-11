/**
 * StaticCloudStorageAdapter - Static/offline implementation of CloudStoragePort.
 * Cloud storage is not supported in offline mode since it requires
 * server-side OAuth and API integration.
 */
import { CloudStoragePort } from '../../ports/CloudStoragePort.js';

export class StaticCloudStorageAdapter extends CloudStoragePort {
    /**
     * @inheritdoc
     */
    async getGoogleDriveLoginUrl() {
        // Cloud storage not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED', url: null };
    }

    /**
     * @inheritdoc
     */
    async getGoogleDriveFolders() {
        // Cloud storage not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED', folders: [] };
    }

    /**
     * @inheritdoc
     */
    async uploadToGoogleDrive() {
        // Cloud storage not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    async getDropboxLoginUrl() {
        // Cloud storage not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED', url: null };
    }

    /**
     * @inheritdoc
     */
    async getDropboxFolders() {
        // Cloud storage not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED', folders: [] };
    }

    /**
     * @inheritdoc
     */
    async uploadToDropbox() {
        // Cloud storage not supported in static mode
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * @inheritdoc
     */
    isSupported() {
        return false;
    }
}

export default StaticCloudStorageAdapter;
