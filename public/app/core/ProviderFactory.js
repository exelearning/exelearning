/**
 * ProviderFactory - Base class for creating adapters.
 * This is the single decision point for mode-based adapter creation.
 */
import { RuntimeConfig } from './RuntimeConfig.js';
import { Capabilities } from './Capabilities.js';
import { HttpClient } from './HttpClient.js';

// Server adapters
import { ServerProjectRepository } from './adapters/server/ServerProjectRepository.js';
import { ServerCatalogAdapter } from './adapters/server/ServerCatalogAdapter.js';
import { ServerAssetAdapter } from './adapters/server/ServerAssetAdapter.js';
import { ServerCollaborationAdapter } from './adapters/server/ServerCollaborationAdapter.js';
import { ServerExportAdapter } from './adapters/server/ServerExportAdapter.js';
import { ServerContentAdapter } from './adapters/server/ServerContentAdapter.js';
import { ServerUserPreferenceAdapter } from './adapters/server/ServerUserPreferenceAdapter.js';
import { ServerLinkValidationAdapter } from './adapters/server/ServerLinkValidationAdapter.js';
import { ServerCloudStorageAdapter } from './adapters/server/ServerCloudStorageAdapter.js';
import { ServerPlatformIntegrationAdapter } from './adapters/server/ServerPlatformIntegrationAdapter.js';
import { ServerSharingAdapter } from './adapters/server/ServerSharingAdapter.js';

// Static adapters
import { StaticProjectRepository } from './adapters/static/StaticProjectRepository.js';
import { StaticCatalogAdapter } from './adapters/static/StaticCatalogAdapter.js';
import { StaticAssetAdapter } from './adapters/static/StaticAssetAdapter.js';
import { NullCollaborationAdapter } from './adapters/static/NullCollaborationAdapter.js';
import { StaticExportAdapter } from './adapters/static/StaticExportAdapter.js';
import { StaticContentAdapter } from './adapters/static/StaticContentAdapter.js';
import { StaticUserPreferenceAdapter } from './adapters/static/StaticUserPreferenceAdapter.js';
import { StaticLinkValidationAdapter } from './adapters/static/StaticLinkValidationAdapter.js';
import { StaticCloudStorageAdapter } from './adapters/static/StaticCloudStorageAdapter.js';
import { StaticPlatformIntegrationAdapter } from './adapters/static/StaticPlatformIntegrationAdapter.js';
import { StaticSharingAdapter } from './adapters/static/StaticSharingAdapter.js';

/**
 * ProviderFactory - Creates adapters based on runtime mode.
 * Use ProviderFactory.create() to get the appropriate factory.
 */
export class ProviderFactory {
    /**
     * @param {RuntimeConfig} config
     * @param {Capabilities} capabilities
     */
    constructor(config, capabilities) {
        this.config = config;
        this.capabilities = capabilities;
    }

    /**
     * Create the appropriate ProviderFactory based on environment.
     * This is the ONLY place that mode detection happens.
     * @returns {Promise<ServerProviderFactory|StaticProviderFactory>}
     */
    static async create() {
        const config = RuntimeConfig.fromEnvironment();
        const capabilities = new Capabilities(config);

        if (config.isStaticMode() || config.isElectronMode()) {
            // Load static bundle data
            let bundleData = {};
            try {
                const response = await fetch(config.staticDataPath || './data/bundle.json');
                if (response.ok) {
                    bundleData = await response.json();
                }
            } catch (error) {
                console.warn('[ProviderFactory] Failed to load bundle data:', error);
            }

            return new StaticProviderFactory(config, capabilities, bundleData);
        }

        const factory = new ServerProviderFactory(config, capabilities);
        // Load API endpoints before returning (needed for adapters to know endpoint URLs)
        await factory.loadEndpoints();
        return factory;
    }

    /**
     * Get the runtime configuration.
     * @returns {RuntimeConfig}
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get the capabilities.
     * @returns {Capabilities}
     */
    getCapabilities() {
        return this.capabilities;
    }

    // Abstract factory methods - to be implemented by subclasses
    createProjectRepository() {
        throw new Error('ProviderFactory.createProjectRepository() not implemented');
    }

    createCatalogAdapter() {
        throw new Error('ProviderFactory.createCatalogAdapter() not implemented');
    }

    createAssetAdapter() {
        throw new Error('ProviderFactory.createAssetAdapter() not implemented');
    }

    createCollaborationAdapter() {
        throw new Error('ProviderFactory.createCollaborationAdapter() not implemented');
    }

    createExportAdapter() {
        throw new Error('ProviderFactory.createExportAdapter() not implemented');
    }

    createContentAdapter() {
        throw new Error('ProviderFactory.createContentAdapter() not implemented');
    }

    createUserPreferencesAdapter() {
        throw new Error('ProviderFactory.createUserPreferencesAdapter() not implemented');
    }

    createLinkValidationAdapter() {
        throw new Error('ProviderFactory.createLinkValidationAdapter() not implemented');
    }

    createCloudStorageAdapter() {
        throw new Error('ProviderFactory.createCloudStorageAdapter() not implemented');
    }

    createPlatformIntegrationAdapter() {
        throw new Error('ProviderFactory.createPlatformIntegrationAdapter() not implemented');
    }

    createSharingAdapter() {
        throw new Error('ProviderFactory.createSharingAdapter() not implemented');
    }

    /**
     * Create all adapters at once for injection.
     * @returns {Object} All adapters keyed by name
     */
    createAllAdapters() {
        return {
            projectRepo: this.createProjectRepository(),
            catalog: this.createCatalogAdapter(),
            assets: this.createAssetAdapter(),
            collaboration: this.createCollaborationAdapter(),
            exportAdapter: this.createExportAdapter(),
            content: this.createContentAdapter(),
            userPreferences: this.createUserPreferencesAdapter(),
            linkValidation: this.createLinkValidationAdapter(),
            cloudStorage: this.createCloudStorageAdapter(),
            platformIntegration: this.createPlatformIntegrationAdapter(),
            sharing: this.createSharingAdapter(),
        };
    }
}

/**
 * ServerProviderFactory - Creates server-mode adapters.
 */
export class ServerProviderFactory extends ProviderFactory {
    /**
     * @param {RuntimeConfig} config
     * @param {Capabilities} capabilities
     */
    constructor(config, capabilities) {
        super(config, capabilities);
        this.httpClient = new HttpClient(config.baseUrl);
        this.basePath = window.eXeLearning?.config?.basePath || '';
        this._endpoints = null;
    }

    /**
     * Load API endpoints.
     * @returns {Promise<Object>}
     */
    async loadEndpoints() {
        if (this._endpoints) {
            return this._endpoints;
        }

        try {
            const url = `${this.basePath}/api/parameter-management/parameters/data/list`;
            const params = await this.httpClient.get(url);
            this._endpoints = {};
            for (const [key, data] of Object.entries(params.routes || {})) {
                this._endpoints[key] = {
                    path: this.config.baseUrl + data.path,
                    methods: data.methods,
                };
            }
        } catch (error) {
            console.warn('[ServerProviderFactory] Failed to load endpoints:', error);
            this._endpoints = {};
        }

        return this._endpoints;
    }

    /**
     * @inheritdoc
     */
    createProjectRepository() {
        return new ServerProjectRepository(this.httpClient, this.basePath);
    }

    /**
     * @inheritdoc
     */
    createCatalogAdapter() {
        return new ServerCatalogAdapter(this.httpClient, this._endpoints || {});
    }

    /**
     * @inheritdoc
     */
    createAssetAdapter() {
        return new ServerAssetAdapter(this.httpClient, this.basePath);
    }

    /**
     * @inheritdoc
     */
    createCollaborationAdapter() {
        return new ServerCollaborationAdapter(this.config.wsUrl, this.basePath);
    }

    /**
     * @inheritdoc
     */
    createExportAdapter() {
        return new ServerExportAdapter(this.httpClient, this._endpoints || {}, this.basePath);
    }

    /**
     * @inheritdoc
     */
    createContentAdapter() {
        return new ServerContentAdapter(this.httpClient, this._endpoints || {});
    }

    /**
     * @inheritdoc
     */
    createUserPreferencesAdapter() {
        return new ServerUserPreferenceAdapter(this.httpClient, this._endpoints || {}, this.basePath);
    }

    /**
     * @inheritdoc
     */
    createLinkValidationAdapter() {
        return new ServerLinkValidationAdapter(this.httpClient, this._endpoints || {}, this.basePath);
    }

    /**
     * @inheritdoc
     */
    createCloudStorageAdapter() {
        return new ServerCloudStorageAdapter(this.httpClient, this._endpoints || {});
    }

    /**
     * @inheritdoc
     */
    createPlatformIntegrationAdapter() {
        return new ServerPlatformIntegrationAdapter(this.httpClient, this._endpoints || {});
    }

    /**
     * @inheritdoc
     */
    createSharingAdapter() {
        return new ServerSharingAdapter(this.httpClient, this._endpoints || {}, this.basePath);
    }
}

/**
 * StaticProviderFactory - Creates static/offline-mode adapters.
 */
export class StaticProviderFactory extends ProviderFactory {
    /**
     * @param {RuntimeConfig} config
     * @param {Capabilities} capabilities
     * @param {Object} bundleData - Pre-loaded bundle data from bundle.json
     */
    constructor(config, capabilities, bundleData = {}) {
        super(config, capabilities);
        this.bundleData = bundleData;
    }

    /**
     * @inheritdoc
     */
    createProjectRepository() {
        return new StaticProjectRepository();
    }

    /**
     * @inheritdoc
     */
    createCatalogAdapter() {
        // Pass the existing DataProvider if available for backwards compatibility
        const dataProvider = window.eXeLearning?.app?.dataProvider || null;
        return new StaticCatalogAdapter(this.bundleData, dataProvider);
    }

    /**
     * @inheritdoc
     */
    createAssetAdapter() {
        return new StaticAssetAdapter();
    }

    /**
     * @inheritdoc
     */
    createCollaborationAdapter() {
        return new NullCollaborationAdapter();
    }

    /**
     * @inheritdoc
     */
    createExportAdapter() {
        return new StaticExportAdapter();
    }

    /**
     * @inheritdoc
     */
    createContentAdapter() {
        const dataProvider = window.eXeLearning?.app?.dataProvider || null;
        return new StaticContentAdapter(dataProvider);
    }

    /**
     * @inheritdoc
     */
    createUserPreferencesAdapter() {
        return new StaticUserPreferenceAdapter();
    }

    /**
     * @inheritdoc
     */
    createLinkValidationAdapter() {
        return new StaticLinkValidationAdapter();
    }

    /**
     * @inheritdoc
     */
    createCloudStorageAdapter() {
        return new StaticCloudStorageAdapter();
    }

    /**
     * @inheritdoc
     */
    createPlatformIntegrationAdapter() {
        return new StaticPlatformIntegrationAdapter();
    }

    /**
     * @inheritdoc
     */
    createSharingAdapter() {
        return new StaticSharingAdapter();
    }
}

export default ProviderFactory;
