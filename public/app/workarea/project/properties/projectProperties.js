import FormProperties from './formProperties.js';

export default class ProjectProperties {
    categoryPropertiesId = 'properties';
    categoryCataloguingId = 'cataloguing';

    constructor(project) {
        this.project = project;
        this.formProperties = new FormProperties(this);
    }

    /**
     * Load project properties
     *
     */
    async load() {
        //  Properties - Package [base]
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
        await this.apiLoadProperties();
    }

    /**
     * Set values of api package properties
     *
     * @param {Array} properties
     */
    setProperties(properties) {
        for (let [key, value] of Object.entries(properties)) {
            if (value.category == this.categoryPropertiesId) {
                let newValue = properties[key].value
                    ? properties[key].value
                    : '';
                if (this.properties[key]) {
                    this.properties[key].value = newValue;
                }
            }
        }
    }

    /**
     * Set values of api cataloguing properties
     *
     * @param {Array} properties
     */
    setCataloguing(properties) {
        for (let [key, value] of Object.entries(properties)) {
            if (value.category == this.categoryCataloguingId) {
                let newValue = properties[key].value
                    ? properties[key].value
                    : '';
                if (this.cataloguing[key]) {
                    this.cataloguing[key].value = newValue;
                } else if (
                    properties[key].multipleId &&
                    this.cataloguing[properties[key].multipleId]
                ) {
                    // Multiple properties
                    this.cataloguing[key] = JSON.parse(
                        JSON.stringify(
                            this.cataloguing[properties[key].multipleId]
                        )
                    );
                    this.cataloguing[key].value = newValue;
                    this.cataloguing[key].multipleId =
                        properties[key].multipleId;
                    this.cataloguing[key].multipleIndex =
                        properties[key].multipleIndex;
                    this.cataloguing[key].prefix = properties[key].groups.pop();
                }
            }
        }
    }

    /**
     * Show modal properties
     *
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
     * Get ode properties
     *
     */
    async apiLoadProperties() {
        let odeSession = this.project.odeSession;
        let properties = await eXeLearning.app.api.getOdeProperties(odeSession);

        if (properties) {
            this.setProperties(properties.odeProperties);
            this.setCataloguing(properties.odeProperties);
            this.project.versionName = properties.odeVersionName;
        } else {
            eXeLearning.app.modals.alert.show({
                title: _('Properties error'),
                body: _('An error occurred while saving properties'),
            });
        }
    }

    /**
     * Save ode properties
     *
     */
    async apiSaveProperties(properties) {
        // Generate params array
        let params = {};
        // - Session Id
        params.odeSessionId = this.project.odeSession;
        // - Properties dict
        for (let [key, value] of Object.entries(properties)) {
            params[key] = value;
        }
        // Save in database
        let response = await eXeLearning.app.api.putSaveOdeProperties(params);
        await this.apiLoadProperties();
        this.formProperties.reloadValues();
        // Update interface
        this.updateTitlePropertiesStructureNode();
        this.updateTitlePropertiesMenuTop();
        // Send update sync change to the BBDD
        eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
            false,
            'root',
            null,
            null,
            'EDIT'
        );

        return response;
    }

    /**
     * Update title in menu structure node root
     *
     */
    updateTitlePropertiesStructureNode() {
        this.project.structure.setTitleToNodeRoot();
    }

    /**
     * Update title in menu top
     *
     */
    updateTitlePropertiesMenuTop() {
        this.project.app.interface.odeTitleElement.setTitle();
    }
}
