export default class Theme {
    constructor(manager, data) {
        this.manager = manager;
        this.id = data.dirName;
        this.dirName = data.dirName; // Store dirName for theme editing
        this.setConfigValues(data);
        this.path = `${manager.symfonyURL}${data.url}/`;
        this.valid = data.valid;
    }

    templatePageContainerClass = 'page-content-template-container';
    templatePageClass = 'page-content-template';

    /**
     * config.xml params
     */
    configParams = [
        'name',
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
        'icons',
    ];

    /**
     * config.xml translatable params
     */
    configParamsTranslatables = ['title'];

    /**
     * Default values of config.xml params
     */
    default = {
        name: '',
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
        type: eXeLearning.config.themeBaseType,
        icons: {},
    };

    /**
     * Set values of config.xml
     *
     * @param {Array} data
     */
    setConfigValues(data) {
        this.configParams.forEach((key) => {
            let value = data[key];
            let defaultValue =
                this.default[key] !== undefined ? this.default[key] : null;
            let v = value !== undefined && value !== null ? value : defaultValue;
            if (this.isTranslatable(key) && v) {
                v = _(v, this.id);
            }
            this[key] = v;
        });
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
     * Load theme CSS files
     * Handles both server themes and user themes (from Yjs storage)
     */
    async loadCss() {
        // Check if this is a user theme (stored in Yjs, not on server)
        if (this.isUserTheme || this.path.startsWith('user-theme://')) {
            await this.loadUserThemeCss();
            return;
        }

        // Standard server theme loading
        for (let i = 0; i < this.cssFiles.length; i++) {
            let pathCss = this.path + this.cssFiles[i];
            await this.loadStyleByInsertingIt(
                this.getResourceServicePath(pathCss)
            );
        }
    }

    /**
     * Load CSS for user themes (stored in IndexedDB/ResourceFetcher)
     * @private
     */
    async loadUserThemeCss() {
        const resourceFetcher = eXeLearning.app.resourceFetcher;
        if (!resourceFetcher) {
            console.error('[Theme] ResourceFetcher not available for user theme');
            return;
        }

        // Get theme files from ResourceFetcher (async to support IndexedDB fallback)
        let themeFiles = resourceFetcher.getUserTheme(this.id);
        if (!themeFiles && resourceFetcher.getUserThemeAsync) {
            // Try async method that fetches from IndexedDB
            themeFiles = await resourceFetcher.getUserThemeAsync(this.id);
        }

        if (!themeFiles) {
            console.error(`[Theme] User theme '${this.id}' files not found in ResourceFetcher`);
            return;
        }

        // Load each CSS file
        for (const cssFileName of this.cssFiles) {
            const cssBlob = themeFiles.get(cssFileName);
            if (cssBlob) {
                const cssText = await cssBlob.text();
                await this.injectUserThemeCss(cssText, cssFileName);
            } else {
                console.warn(`[Theme] CSS file '${cssFileName}' not found in user theme '${this.id}'`);
            }
        }
    }

    /**
     * Inject user theme CSS into the page
     * @param {string} cssText - CSS content
     * @param {string} fileName - CSS file name (for debugging)
     * @private
     */
    async injectUserThemeCss(cssText, fileName) {
        const style = document.createElement('style');
        style.classList.add('exe');
        style.classList.add('theme-style');
        style.setAttribute('data-user-theme', this.id);
        style.setAttribute('data-file', fileName);

        // For user themes, we need to convert relative URLs to blob URLs
        // This is handled by rewriting url() references to use blob URLs from the theme files
        const resourceFetcher = eXeLearning.app.resourceFetcher;
        const themeFiles = resourceFetcher?.getUserTheme(this.id);

        if (themeFiles) {
            cssText = await this.rewriteCssUrls(cssText, themeFiles);
        }

        style.innerHTML = cssText;
        document.querySelector('head').append(style);
        return style;
    }

    /**
     * Rewrite CSS url() references to use blob URLs for user theme resources
     * @param {string} cssText - Original CSS
     * @param {Map<string, Blob>} themeFiles - Theme files map
     * @returns {Promise<string>} CSS with rewritten URLs
     * @private
     */
    async rewriteCssUrls(cssText, themeFiles) {
        // Find all url() references
        const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
        const matches = [...cssText.matchAll(urlRegex)];

        // Process each URL reference
        for (const match of matches) {
            const originalUrl = match[1];

            // Skip absolute URLs, data URLs, and external URLs
            if (originalUrl.startsWith('http') ||
                originalUrl.startsWith('data:') ||
                originalUrl.startsWith('//')) {
                continue;
            }

            // Get the file from theme files
            const cleanPath = originalUrl.replace(/^\.\//, '');
            const fileBlob = themeFiles.get(cleanPath);

            if (fileBlob) {
                // Create blob URL for the resource
                const blobUrl = URL.createObjectURL(fileBlob);
                cssText = cssText.replace(match[0], `url('${blobUrl}')`);
            }
        }

        return cssText;
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
        // Site themes and user themes from FILES_DIR are served directly
        // No need to go through the idevices download service
        if (path.includes('/site-files/') || path.includes('/admin-files/') || path.includes('/user-files/')) {
            return path;
        }

        // Static mode: bundled theme files in /files/perm/themes/ are served directly
        if (path.includes('/files/perm/themes/')) {
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
        pathParam = '/' + pathParam;
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
        // Rewrite relative URLs to absolute, preserving quotes
        // Skip absolute URLs (http:, https:, data:, blob:) and root-relative paths (/)
        cssText = cssText.replace(
            /url\(\s*(['"]?)(?!data:|http:|https:|blob:|\/)([^'")]+)\1\s*\)/g,
            (match, quote, path) => `url(${quote}${this.path}${path}${quote})`
        );
        style.innerHTML = cssText;
        document.querySelector('head').append(style);
        return style;
    }
}
