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
        // Re-translate static UI elements (menus, modals, buttons)
        this.translateStaticUI();
    }

    /**
     * Translate static UI elements that were baked into HTML at build time.
     * This is needed for static mode where the HTML is pre-generated.
     */
    translateStaticUI() {
        // Map of element selectors to their translation keys
        const translations = {
            // Main menu items
            '#dropdownFile': 'File',
            '#dropdownUtilities': 'Utilities',
            '#dropdownHelp': 'Help',
            // File menu
            '#navbar-button-new': 'New',
            '#navbar-button-new-from-template': 'New from Template...',
            '#navbar-button-openuserodefiles': 'Open',
            '#navbar-button-dropdown-recent-projects': 'Recent projects',
            '#navbar-button-import-elp': 'Import (.elpx…)',
            '#navbar-button-save': 'Save',
            '#navbar-button-save-as': 'Save as',
            '#dropdownExportAs': 'Download as...',
            '#navbar-button-download-project': 'eXeLearning content (.elpx)',
            '#navbar-button-export-html5': 'Website',
            '#navbar-button-export-html5-sp': 'Single page',
            '#navbar-button-settings': 'Settings',
            '#navbar-button-share': 'Share',
            '#navbar-button-open-offline': 'Open',
            '#navbar-button-save-offline': 'Save',
            '#navbar-button-save-as-offline': 'Save as',
            '#dropdownExportAsOffline': 'Export as...',
            '#navbar-button-exportas-html5': 'Website',
            '#navbar-button-exportas-html5-folder': 'Export to Folder (Unzipped Website)',
            '#navbar-button-exportas-html5-sp': 'Single page',
            '#navbar-button-export-print': 'Print',
            '#dropdownUploadTo': 'Upload to',
            '#dropdownProperties': 'Metadata',
            '#navbar-button-import-xml-properties': 'Import',
            '#navbar-button-export-xml-properties': 'Export',
            // Utilities menu
            '#navbar-button-idevice-manager': 'iDevice manager',
            '#navbar-button-odeusedfiles': 'Resources report',
            '#navbar-button-odebrokenlinks': 'Link validation',
            '#navbar-button-filemanager': 'File manager',
            '#navbar-button-styles': 'Styles',
            '#navbar-button-preview': 'Preview',
            '#navbar-button-preferences': 'Preferences',
            // Help menu
            '#navbar-button-assistant': 'Assistant',
            '#navbar-button-exe-tutorial': 'User manual',
            '#navbar-button-api-docs': 'API Reference (Swagger)',
            '#navbar-button-about-exe': 'About eXeLearning',
            '#navbar-button-release-notes': 'Release notes',
            '#navbar-button-legal-notes': 'Legal notes',
            '#navbar-button-exe-web': 'eXeLearning website',
            '#navbar-button-report-bug': 'Report a bug',
            // Head buttons - only translate text inside span, not the whole button
            '#head-top-save-button > span:not([class*="icon"])': 'Save',
        };

        for (const [selector, key] of Object.entries(translations)) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                // Get translated text
                const translated = _(key);
                // For menu items, preserve icons (spans with icon classes)
                const iconSpan = el.querySelector('span[class*="icon"], div[class*="icon"]');
                if (iconSpan) {
                    // Clear all text nodes first, then add translated text after the icon
                    const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
                    textNodes.forEach(n => n.remove());
                    // Add text after the icon
                    if (iconSpan.nextSibling && iconSpan.nextSibling.nodeType === Node.TEXT_NODE) {
                        iconSpan.nextSibling.textContent = ' ' + translated;
                    } else {
                        iconSpan.after(document.createTextNode(' ' + translated));
                    }
                } else if (el.tagName === 'A' || el.tagName === 'BUTTON') {
                    // For links/buttons without icons, check for keyboard shortcuts
                    const shortcut = el.querySelector('.shortcut, kbd');
                    if (shortcut) {
                        const firstTextNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                        if (firstTextNode) {
                            firstTextNode.textContent = translated;
                        }
                    } else {
                        // Simple text replacement, but preserve any child elements
                        const firstTextNode = Array.from(el.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
                        if (firstTextNode) {
                            firstTextNode.textContent = translated;
                        }
                    }
                } else {
                    // For other elements (like spans), just set text content
                    el.textContent = translated;
                }
            });
        }

        // Translate modal titles and common elements
        const modalTitles = {
            '#modalProperties .modal-title': 'Preferences',
            '#modalAbout .modal-title': 'About eXeLearning',
            '#modalReleaseNotes .modal-title': 'Release notes',
            '#modalLegalNotes .modal-title': 'Legal notes',
        };

        for (const [selector, key] of Object.entries(modalTitles)) {
            const el = document.querySelector(selector);
            if (el) el.textContent = _(key);
        }
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
