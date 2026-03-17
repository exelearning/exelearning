export default class Locale {
    constructor(app) {
        this.app = app;
        this.lang = null;
        this.strings = {};
        this.c_strings = {};
        /** Content language used for the last refreshI18nGlobals() call */
        this._contentLang = null;
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
        this._contentLang = lang;
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

        const catalogue = this.strings?.translations;
        if (catalogue) {
            // Try exact key first (server returns unescaped keys)
            const key = string in catalogue ? string : string.replace(/"/g, '\\"');
            if (key in catalogue) {
                let res = catalogue[key].replace(/\\"/g, '"').replace(/\\\//g, '/');
                if (res.startsWith('~')) res = res.substring(1);
                return res;
            }
        }

        return string.replace(/\\\//g, '/');
    }

    getContentTranslation(string) {
        if (typeof string != 'string') return '';

        const catalogue = this.c_strings?.translations;
        if (catalogue) {
            // Try exact key first (server returns unescaped keys)
            const key = string in catalogue ? string : string.replace(/"/g, '\\"');
            if (key in catalogue) {
                let res = catalogue[key].replace(/\\"/g, '"').replace(/\\\//g, '/');
                if (res.startsWith('~')) res = res.substring(1);
                return res;
            }
        }

        return string.replace(/\\\//g, '/');
    }

    /**
     * Load and execute the pre-built i18n JS file for the current content language.
     *
     * The file `app/common/i18n/common_i18n.{lang}.js` is generated at build time
     * by `scripts/build-i18n-bundles.js` with all c_() calls already resolved to
     * translated strings. This works in both server and static modes.
     *
     * Called after `loadContentTranslationsStrings()` so that `$exe_i18n` reflects
     * the project's content language (e.g. Spanish) rather than English defaults.
     */
    async refreshI18nGlobals() {
        const lang = (this._contentLang || this.lang || 'en').split('-')[0];
        // In static mode files are served at root with no version routing, skip version prefix
        const isStatic = window.__EXE_STATIC_MODE__ === true;
        const version = isStatic ? '' : (window.eXeLearning?.version || '');
        const basePath = window.eXeLearning?.config?.basePath || '';
        const base = version ? `${basePath}/${version}` : basePath;
        const url = `${base}/app/common/i18n/common_i18n.${lang}.js`;

        let content = null;
        try {
            const response = await fetch(url);
            if (response.ok) {
                content = await response.text();
            } else if (lang !== 'en') {
                // Fall back to English
                const enUrl = `${base}/app/common/i18n/common_i18n.en.js`;
                try {
                    const enResponse = await fetch(enUrl);
                    if (enResponse.ok) content = await enResponse.text();
                } catch {
                    // ignore
                }
            }
            if (!content) {
                console.warn('[Locale] Failed to fetch common_i18n file:', response.status);
                return;
            }
        } catch (e) {
            console.warn('[Locale] Error fetching common_i18n file:', e);
            return;
        }

        // Execute in global scope so that the implicit `$exe_i18n = {...}` assignment
        // becomes a window property. new Function() runs in non-strict mode and
        // treats undeclared assignments as globals, matching <script> tag behaviour.
        // eslint-disable-next-line no-new-func
        new Function(content)();
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
