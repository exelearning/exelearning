export default class Locale {
    constructor(app) {
        this.app = app;
        this.lang = null;
        this.strings = {};
        this.c_strings = {};
        /** Cached template text of common_i18n.js (fetched once, reused on language changes) */
        this._i18nTemplate = null;
        window._ = (s, idevice) => {
            // If idevice is passed, use getTranslation with iDevice support
            // Otherwise, use getGUITranslation (which has special processing: ~prefix, \\/)
            if (idevice) {
                return this.getTranslation(s, null, idevice);
            }
            return this.getGUITranslation(s);
        };
        window.c_ = (s) => {
            // elp → elpx (to review - #498)
            s = this.getContentTranslation(s);
            s = s.replace(' (elp)', ' (elpx)');
            s = s.replace(' .elp ', ' .elpx ');
            s = s.replace(' elp ', ' elpx ');
            if (s.endsWith('.elp')) s += 'x';
            return s;
        };
    }

    /**
     *
     * @param {*} lang
     */
    async init() {
        this.setLocaleLang(this.app.eXeLearning.config.locale);
        await this.loadTranslationsStrings();
    }

    async loadContentTranslationsStrings(lang) {
        // Use ApiCallManager which handles both static and server modes internally
        // Result structure: { translations: { "key": "value", ... }, count?: number }
        const result = await this.app.api.getTranslations(lang);
        this.c_strings = result || {};
    }

    /**
     *
     * @param {*} lang
     */
    async setLocaleLang(lang) {
        this.lang = lang;
        document.querySelector('body').setAttribute('lang', lang);
    }

    /**
     * Load translation strings from API (works in both static and server mode)
     */
    async loadTranslationsStrings() {
        // Use ApiCallManager which handles both static and server modes internally
        // Result structure: { translations: { "key": "value", ... }, count?: number }
        const result = await this.app.api.getTranslations(this.lang);
        this.strings = result || {};
    }

    getGUITranslation(string) {
        if (typeof string != 'string') return '';
        string = string ? string.replace(/"/g, '\\"') : '';

        if (
            this.strings &&
            this.strings.translations &&
            string in this.strings.translations
        ) {
            let res = this.strings.translations[string]
                .replace(/\\"/g, '"')
                .replace(/\\\//g, '/');
            // Remove ~ prefix if present
            if (res.startsWith('~')) {
                res = res.substring(1);
            }
            return res;
        } else {
            return string.replace(/\\"/g, '"');
        }
    }

    getContentTranslation(string) {
        if (typeof string != 'string') return '';
        string = string ? string.replace(/"/g, '\\"') : '';

        if (
            this.c_strings &&
            this.c_strings.translations &&
            string in this.c_strings.translations
        ) {
            let res = this.c_strings.translations[string]
                .replace(/\\"/g, '"')
                .replace(/\\\//g, '/');
            // Remove ~ prefix if present
            if (res.startsWith('~')) {
                res = res.substring(1);
            }
            return res;
        } else {
            return string.replace(/\\"/g, '"').replace(/\\\//g, '/');
        }
    }

    /**
     * Fetch and execute `common_i18n.js` with the current content-language translations.
     *
     * Called after `loadContentTranslationsStrings()` so that `$exe_i18n` reflects the
     * project's content language (e.g. Spanish) rather than English defaults.
     * On language changes the method is called again; the template is cached after the
     * first fetch.
     */
    async refreshI18nGlobals() {
        if (!this._i18nTemplate) {
            const version = window.eXeLearning?.version || '';
            const basePath = window.eXeLearning?.config?.basePath || '';
            const url = version
                ? `${basePath}/${version}/app/common/common_i18n.js`
                : `${basePath}/app/common/common_i18n.js`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('[Locale] Failed to fetch common_i18n.js template:', response.status);
                    return;
                }
                this._i18nTemplate = await response.text();
            } catch (e) {
                console.warn('[Locale] Error fetching common_i18n.js:', e);
                return;
            }
        }

        // Resolve every c_("English source") call to the translated literal string.
        // This is the same substitution the export pipeline applies, keeping workarea
        // and export behaviour consistent.
        const resolved = this._i18nTemplate.replace(
            /c_\("((?:[^"\\]|\\.)*)"\)/g,
            (_, source) => JSON.stringify(this.getContentTranslation(source))
        );

        // Execute in global scope so that the implicit `$exe_i18n = {...}` assignment
        // becomes a window property.  new Function() runs in non-strict mode and
        // treats undeclared assignments as globals, matching <script> tag behaviour.
        // eslint-disable-next-line no-new-func
        new Function(resolved)();
    }

    /**
     *
     * @param {*} string
     * @returns
     */
    getTranslation(string, lang, idevice) {
        if (typeof string != 'string') return '';
        string = string ? string.replace(/"/g, '\\"') : '';
        lang = lang ? lang : this.lang;
        // Idevice po translation
        if (idevice) {
            let stringConcIdevice = `${idevice}.${string}`;
            if (
                this.strings &&
                this.strings.translations &&
                stringConcIdevice in this.strings.translations
            ) {
                return this.strings.translations[stringConcIdevice].replace(
                    /\\"/g,
                    '"'
                );
            }
        }

        // Default translation
        if (
            this.strings &&
            this.strings.translations &&
            string in this.strings.translations
        ) {
            return this.strings.translations[string].replace(/\\"/g, '"');
        } else {
            return string.replace(/\\"/g, '"');
        }
    }
}
