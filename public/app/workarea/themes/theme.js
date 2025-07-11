export default class Theme {
    constructor(manager, data) {
        this.manager = manager;
        this.id = data.dirName;
        this.setConfigValues(data);
        this.path = `${manager.symfonyURL}${data.url}/`;
        this.valid = data.valid;
    }

    cssDefaultFileName = 'content.css';
    templatePageContainerClass = 'page-content-template-container';
    templatePageClass = 'page-content-template';

    /**
     * config.xml params
     */
    configParams = [
        'author',
        'authorUrl',
        'description',
        'license',
        'licenseUrl',
        'title',
        'version',
        'type',
        'templatePage',
        'templateIdevice',
        'textColor',
        'linkColor',
        'cssFiles',
        'downloadable',
    ];

    /**
     * config.xml translatable params
     */
    configParamsTranslatables = ['title'];

    /**
     * Default values of config.xml params
     */
    default = {
        author: '',
        authorUrl: '',
        description: '',
        license: '',
        licenseUrl: '',
        title: 'Unknown',
        version: '1.0',
        templatePage: '',
        templateIdevice: '',
        textColor: '',
        linkColor: '',
        cssFiles: [],
        type: eXeLearning.symfony.themeBaseType,
    };

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
     * Check if theme is valid
     *
     * @returns {boolean}
     */
    isValid() {
        return this.id != null;
    }

    /**
     *
     */
    async select(isSync = false) {
        // Add class prev theme
        document.querySelectorAll('head .theme-style').forEach((styleLink) => {
            styleLink.classList.add('prev-theme-style');
        });
        // Load css theme
        await this.loadCss();
        // Reload page
        if (eXeLearning.app.project.structure.nodeSelected) {
            if (
                eXeLearning.app.project.structure.nodeSelected.getAttribute(
                    'nav-id'
                ) != 'root' &&
                isSync == false
            ) {
                await eXeLearning.app.project.idevices.cleanNodeAndLoadPage(
                    true,
                    null
                );
            }
        }
        // Remove prev css theme
        setTimeout(() => {
            this.removePreviousCssLoaded();
        }, 100);
    }

    /**
     *
     */
    async loadCss() {
        for (let i = 0; i < this.cssFiles.length; i++) {
            let pathCss = this.path + this.cssFiles[i];
            await this.loadStyleByInsertingIt(
                this.getResourceServicePath(pathCss)
            );
        }
    }

    /**
     *
     */
    removePreviousCssLoaded() {
        document
            .querySelectorAll('head .theme-style.prev-theme-style')
            .forEach((styleLink) => {
                styleLink.remove();
            });
    }

    /**
     *
     */
    getHeaderImgUrl() {
        return this.manager.symfonyURL + this.headerImgUrl;
    }

    /**
     *
     */
    getLogoImgUrl() {
        return this.manager.symfonyURL + this.logoImgUrl;
    }

    /**
     *
     */
    getPageTemplateElement() {
        if (!this.templatePage) return false;
        let nodePageElement = document.createElement('div');
        nodePageElement.classList.add(this.templatePageContainerClass);
        nodePageElement.innerHTML = this.templatePage.replace(
            '{page-content}',
            `<div class='${this.templatePageClass}'></div>`
        );
        return nodePageElement;
    }

    /**
     *
     * @param {*} path
     * @returns {String}
     */
    getResourceServicePath(path) {
        let pathServiceResources =
            this.manager.app.api.endpoints.api_idevices_download_file_resources
                .path;
        let pathSplit = path.split('/files/');
        let pathParam = pathSplit.length == 2 ? pathSplit[1] : path;
        let pathServiceResourceContentCss = `${pathServiceResources}?resource=${pathParam}`;
        return pathServiceResourceContentCss;
    }

    /**
     * Import a theme style to the page
     *
     * @param {*} path
     * @returns {Node}
     */
    loadStyleDynamically(path, newVersion) {
        let style = document.createElement('link');
        style.classList.add('exe');
        style.classList.add('theme-style');
        style.setAttribute('rel', 'stylesheet');
        style.setAttribute('type', 'text/css');
        if (newVersion) {
            style.href = `${path}?t=${Date.now()}`;
        } else {
            style.href = path;
        }
        document.querySelector('head').append(style);
        return style;
    }

    /**
     * Import a style and inserting it in the page
     *
     * @param {*} path
     */
    async loadStyleByInsertingIt(path) {
        let style = document.createElement('style');
        style.classList.add('exe');
        style.classList.add('theme-style');
        // Get css
        let cssText = await eXeLearning.app.api.func.getText(path);
        // Replace idevice style urls
        cssText = cssText.replace(/url\((?:(?!http))/gm, `url(${this.path}`);
        style.innerHTML = cssText;
        document.querySelector('head').append(style);
        return style;
    }
}
