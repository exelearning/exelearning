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
        // Properties - Package [base]
        this.propertiesConfig = JSON.parse(
            JSON.stringify(
                eXeLearning.app.api.parameters.odeProjectSyncPropertiesConfig
            )
        );
        this.properties = {};
        for (let [category, properties] of Object.entries(
            this.propertiesConfig
        )) {
            for (let [key, property] of Object.entries(properties)) {
                this.properties[key] = property;
            }
        }
        // Properties - Cataloguing [lom/lom-es]
        this.cataloguingConfig = JSON.parse(
            JSON.stringify(
                eXeLearning.app.api.parameters.odeProjectSyncCataloguingConfig
            )
        );
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
                    this.properties[key].value = value;
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
