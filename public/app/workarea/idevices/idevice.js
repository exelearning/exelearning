// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

/**
 * eXeLearning
 *
 * Idevice config
 */

export default class Idevice {
    constructor(manager, data) {
        this.manager = manager;
        this.id = data.name;
        this.setConfigValues(data);
        this.path = `${manager.symfonyURL}${data.url}`;
        this.pathEdition = `${this.path}/edition/`;
        this.pathExport = `${this.path}/export/`;
        this.exportObject = null;
        if (this.exportJs.length > 0) {
            this.exportObject = this.getIdeviceObjectKey();
        }
    }

    /**
     * config.xml params
     */
    configParams = [
        'apiVersion',
        'author',
        'authorUrl',
        'category',
        'componentType',
        'cssClass',
        'description',
        'editionCss',
        'editionJs',
        'exportCss',
        'exportJs',
        'icon',
        'license',
        'licenseUrl',
        'location',
        'locationType',
        'title',
        'version',
        'downloadable',
    ];

    /**
     * config.xml translatable params
     * Note: 'category' is NOT translated here - it must stay in English for matching
     * with known category keys. Translation happens at display time in menuIdevicesCompose.
     */
    configParamsTranslatables = ['title'];

    /**
     * Default values of config.xml params
     */
    default = {
        apiVersion: '3.0',
        author: '',
        authorUrl: '',
        category: 'Others',
        componentType: 'html',
        cssClass: 'default',
        description: '',
        editionCss: [`${this.id}.css`],
        editionJs: [`${this.id}.js`],
        exportCss: [`${this.id}.css`],
        exportJs: [`${this.id}.js`],
        icon: {},
        license: '',
        licenseUrl: '',
        location: '',
        locationType: '',
        title: 'Unknown',
        version: '1.0',
    };

    /**
     * Get idevice export object key
     *
     * @param {*} ideviceType
     */
    getIdeviceObjectKey() {
        let exportIdeviceKey = '$' + this.id.split('-').join('');
        return exportIdeviceKey;
    }

    /**
     * Set values of config.xml
     *
     * @param {Array} data
     */
    setConfigValues(data) {
        for (let [key, value] of Object.entries(data)) {
            let defaultValue = this.default[key] ? this.default[key] : null;
            let v = value ? value : defaultValue;
            if (this.isTranslatable(key)) {
                v = _(v, this.id);
            }
            this[key] = v;
        }
    }

    /**
     *
     * @param {*} param
     * @returns
     */
    isTranslatable(param) {
        return this.configParamsTranslatables.includes(param);
    }

    /**
     * Check if idevice is valid
     *
     * @returns {boolean}
     */
    isValid() {
        return this.id != null;
    }

    /**
     * Load idevice edition js scripts
     *
     */
    loadScriptsEdition() {
        let elementsArray = [];
        for (let i = 0; i < this.editionJs.length; i++) {
            let script = this.editionJs[i];
            let path = `${this.pathEdition}${script}`;
            let servicePath = this.getResourceServicePath(path);
            let element =
                this.manager.app.project.idevices.loadScriptDynamically(
                    servicePath,
                    false
                );
            elementsArray.push(element);
        }
        return elementsArray;
    }

    /**
     * Load idevice export js scripts
     *
     */
    loadScriptsExport() {
        let elementsArray = [];
        for (let i = 0; i < this.exportJs.length; i++) {
            let script = this.exportJs[i];
            let path = `${this.pathExport}${script}`;
            let servicePath = this.getResourceServicePath(path);
            let element =
                this.manager.app.project.idevices.loadScriptDynamically(
                    servicePath,
                    false
                );
            elementsArray.push(element);
        }
        return elementsArray;
    }

    /**
     * Load idevice edition styles
     *
     */
    async loadStylesEdition() {
        let elementsArray = [];
        for (let i = 0; i < this.editionCss.length; i++) {
            let styleFileName = this.editionCss[i];
            let path = `${this.pathEdition}${styleFileName}`;
            let servicePath = this.getResourceServicePath(path);
            let element =
                await this.manager.app.project.idevices.loadStyleByInsertingIt(
                    servicePath,
                    this,
                    'edition'
                );
            elementsArray.push(element);
        }
        return elementsArray;
    }

    /**
     * Load idevice export styles
     *
     */
    async loadStylesExport() {
        let elementsArray = [];
        for (let i = 0; i < this.exportCss.length; i++) {
            let styleFileName = this.exportCss[i];
            let path = `${this.pathExport}${styleFileName}`;
            let servicePath = this.getResourceServicePath(path);
            let element =
                await this.manager.app.project.idevices.loadStyleByInsertingIt(
                    servicePath,
                    this,
                    'export'
                );
            elementsArray.push(element);
        }
        return elementsArray;
    }

    /**
     *
     * @param {*} path
     * @returns {String}
     */
    getResourceServicePath(path) {
        // Static mode: bundled iDevice files are served directly
        if (path.includes('/files/perm/idevices/')) {
            return path;
        }

        // Check if endpoint exists (may not exist in static mode)
        const endpoint =
            this.manager.app.api.endpoints.api_idevices_download_file_resources;
        if (!endpoint) {
            return path; // Return as-is if no endpoint available
        }

        let pathServiceResources = endpoint.path;
        let pathSplit = path.split('/files/');
        let pathParam = pathSplit.length == 2 ? pathSplit[1] : path;
        let pathServiceResourceContentCss = `${pathServiceResources}?resource=${pathParam}`;

        // Debug logging for path construction
        Logger.log('[iDevice] getResourceServicePath:', {
            inputPath: path,
            pathServiceResources,
            pathSplit,
            pathParam,
            finalUrl: pathServiceResourceContentCss,
        });

        return pathServiceResourceContentCss;
    }
}
