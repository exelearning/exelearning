import FormProperties from './formProperties.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class ProjectProperties {
    categoryPropertiesId = 'properties';
    categoryCataloguingId = 'cataloguing';

    constructor(project) {
        this.project = project;
        this.formProperties = new FormProperties(this);
    }

    /**
     * Load project properties
     */
    async load() {
        const app = eXeLearning.app;
        const isStaticMode = app.capabilities?.storage?.remote === false;

        // Get configs from appropriate source
        let propertiesConfigSource;
        let cataloguingConfigSource;

        if (isStaticMode) {
            // Static mode: get from API (uses internal static data cache)
            const apiParams = await app.api.getApiParameters();
            propertiesConfigSource = apiParams?.odeProjectSyncPropertiesConfig || {};
            cataloguingConfigSource = apiParams?.odeProjectSyncCataloguingConfig || {};
        } else {
            // Server mode: use api.parameters
            propertiesConfigSource = app.api?.parameters?.odeProjectSyncPropertiesConfig || {};
            cataloguingConfigSource = app.api?.parameters?.odeProjectSyncCataloguingConfig || {};
        }

        // Properties - Package [base]
        this.propertiesConfig = JSON.parse(JSON.stringify(propertiesConfigSource));
        this.properties = {};
        for (let [category, properties] of Object.entries(
            this.propertiesConfig
        )) {
            for (let [key, property] of Object.entries(properties)) {
                this.properties[key] = property;
            }
        }

        // Properties - Cataloguing [lom/lom-es]
        this.cataloguingConfig = JSON.parse(JSON.stringify(cataloguingConfigSource));
        this.cataloguing = {};
        for (let [category, properties] of Object.entries(
            this.cataloguingConfig
        )) {
            for (let [key, property] of Object.entries(properties)) {
                this.cataloguing[key] = property;
            }
        }
        this.loadPropertiesFromYjs();
    }

    /**
     * Show modal properties
     */
    showModalProperties() {
        // Ensure modal opens with the latest values from Yjs metadata
        this.loadPropertiesFromYjs();

        eXeLearning.app.modals.properties.show({
            node: this,
            title: _('Project properties'),
            contentId: 'project-properties',
            properties: this.properties,
            fullScreen: true,
        });
    }

    /**
     * Load properties from Yjs metadata map
     */
    loadPropertiesFromYjs() {
        try {
            const documentManager = this.project._yjsBridge?.getDocumentManager();
            if (!documentManager) {
                console.warn('[ProjectProperties] Yjs document manager not available');
                return;
            }

            const metadata = documentManager.getMetadata();
            if (!metadata) {
                console.warn('[ProjectProperties] Yjs metadata map not available');
                return;
            }

            // Load properties from metadata map
            for (let [key, property] of Object.entries(this.properties)) {
                const metadataKey = this.mapPropertyToMetadataKey(key);
                const value = metadata.get(metadataKey);
                if (value !== undefined) {
                    if (property.type === 'checkbox' && typeof value === 'boolean') {
                        this.properties[key].value = value ? 'true' : 'false';
                    } else {
                        this.properties[key].value = value;
                    }
                }
            }

            Logger.log('[ProjectProperties] Loaded properties from Yjs metadata');
        } catch (error) {
            console.error('[ProjectProperties] Failed to load from Yjs:', error);
        }
    }

    /**
     * Map property key to metadata key
     * @param {string} propertyKey - e.g., 'pp_title'
     * @returns {string} - e.g., 'title'
     */
    mapPropertyToMetadataKey(propertyKey) {
        if (propertyKey === 'pp_lang') {
            return 'language';
        }
        // Remove pp_ prefix if present
        if (propertyKey.startsWith('pp_')) {
            return propertyKey.substring(3);
        }
        return propertyKey;
    }

    /**
     * Update title in menu structure node root
     */
    updateTitlePropertiesStructureNode() {
        this.project.structure.setTitleToNodeRoot();
    }

    /**
     * Update title in menu top
     */
    updateTitlePropertiesMenuTop() {
        this.project.app.interface.odeTitleElement.setTitle();
    }
}
