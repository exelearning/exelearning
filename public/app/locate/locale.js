export default class Locale {
    constructor(app) {
        this.app = app;
        this.lang = null;
        this.strings = {};
        this.c_strings = {};
        window._ = (s) => {
            return this.getGUITranslation(s);
        };
        window.c_ = (s) => {
            return this.getContentTranslation(s);
        };
    }

    /**
     *
     * @param {*} lang
     */
    async init() {
        this.setLocaleLang(this.app.eXeLearning.symfony.locale);
        await this.loadTranslationsStrings();
    }

    async loadContentTranslationsStrings(lang) {
        this.c_strings = await this.app.api.getTranslations(lang);
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
     *
     */
    async loadTranslationsStrings() {
        this.strings = await this.app.api.getTranslations(this.lang);
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
                    '"',
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
