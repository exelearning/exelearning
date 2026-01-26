/**
 * DOM Translation Utility for Static Mode
 *
 * Translates elements with data-i18n attributes using the existing _() function.
 * This enables multi-language support in static/offline builds where Nunjucks
 * server-side translation is not available.
 *
 * Usage:
 *   const translator = new DOMTranslator();
 *   translator.translateAll();        // Translate all elements with data-i18n
 *   translator.observeDOM();          // Auto-translate dynamically added content
 *
 * Supported attributes:
 *   - data-i18n: Translates text content
 *   - data-i18n-suffix: Appends suffix after translation (e.g., ":" for labels)
 *   - data-i18n-title: Translates title attribute
 *   - data-i18n-placeholder: Translates placeholder attribute
 *   - data-i18n-aria-label: Translates aria-label attribute
 *   - data-i18n-alt: Translates alt attribute
 */
export default class DOMTranslator {
    /**
     * Create a DOMTranslator instance
     * @param {Object} options - Configuration options
     * @param {Function} options.translateFn - Translation function (defaults to window._)
     */
    constructor(options = {}) {
        this.translateFn = options.translateFn || (() => window._);
        this._observer = null;
        this._pendingTranslations = new Set();
        this._rafId = null;
    }

    /**
     * Get the translation function
     * @returns {Function} The translation function
     * @private
     */
    _getTranslateFn() {
        const fn = this.translateFn();
        return typeof fn === 'function' ? fn : (s) => s;
    }

    /**
     * Translate all elements with data-i18n attributes within a root element
     * @param {Element|Document} root - The root element to search within
     */
    translateAll(root = document) {
        const _ = this._getTranslateFn();

        // Translate text content
        const textElements = root.querySelectorAll('[data-i18n]');
        for (const el of textElements) {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const suffix = el.getAttribute('data-i18n-suffix') || '';
                el.textContent = _(key) + suffix;
            }
        }

        // Translate title attributes
        const titleElements = root.querySelectorAll('[data-i18n-title]');
        for (const el of titleElements) {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.setAttribute('title', _(key));
            }
        }

        // Translate placeholder attributes
        const placeholderElements = root.querySelectorAll('[data-i18n-placeholder]');
        for (const el of placeholderElements) {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.setAttribute('placeholder', _(key));
            }
        }

        // Translate aria-label attributes
        const ariaLabelElements = root.querySelectorAll('[data-i18n-aria-label]');
        for (const el of ariaLabelElements) {
            const key = el.getAttribute('data-i18n-aria-label');
            if (key) {
                el.setAttribute('aria-label', _(key));
            }
        }

        // Translate alt attributes
        const altElements = root.querySelectorAll('[data-i18n-alt]');
        for (const el of altElements) {
            const key = el.getAttribute('data-i18n-alt');
            if (key) {
                el.setAttribute('alt', _(key));
            }
        }
    }

    /**
     * Translate a single element and its descendants
     * @param {Element} element - The element to translate
     */
    translateElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;

        const _ = this._getTranslateFn();

        // Check if the element itself has data-i18n attributes
        if (element.hasAttribute('data-i18n')) {
            const key = element.getAttribute('data-i18n');
            if (key) {
                const suffix = element.getAttribute('data-i18n-suffix') || '';
                element.textContent = _(key) + suffix;
            }
        }
        if (element.hasAttribute('data-i18n-title')) {
            const key = element.getAttribute('data-i18n-title');
            if (key) element.setAttribute('title', _(key));
        }
        if (element.hasAttribute('data-i18n-placeholder')) {
            const key = element.getAttribute('data-i18n-placeholder');
            if (key) element.setAttribute('placeholder', _(key));
        }
        if (element.hasAttribute('data-i18n-aria-label')) {
            const key = element.getAttribute('data-i18n-aria-label');
            if (key) element.setAttribute('aria-label', _(key));
        }
        if (element.hasAttribute('data-i18n-alt')) {
            const key = element.getAttribute('data-i18n-alt');
            if (key) element.setAttribute('alt', _(key));
        }

        // Translate descendants
        this.translateAll(element);
    }

    /**
     * Schedule translation for an element (batched with requestAnimationFrame)
     * @param {Element} element - The element to translate
     * @private
     */
    _scheduleTranslation(element) {
        this._pendingTranslations.add(element);

        if (!this._rafId) {
            this._rafId = requestAnimationFrame(() => {
                for (const el of this._pendingTranslations) {
                    this.translateElement(el);
                }
                this._pendingTranslations.clear();
                this._rafId = null;
            });
        }
    }

    /**
     * Start observing the DOM for dynamically added content
     * @param {Element} root - The root element to observe (defaults to document.body)
     * @returns {MutationObserver} The mutation observer instance
     */
    observeDOM(root = document.body) {
        if (this._observer) {
            this._observer.disconnect();
        }

        this._observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this._scheduleTranslation(node);
                    }
                }
            }
        });

        this._observer.observe(root, {
            childList: true,
            subtree: true,
        });

        return this._observer;
    }

    /**
     * Stop observing the DOM
     */
    disconnect() {
        if (this._observer) {
            this._observer.disconnect();
            this._observer = null;
        }
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._pendingTranslations.clear();
    }

    /**
     * Re-translate all elements (useful when language changes)
     * @param {Element|Document} root - The root element to search within
     */
    refresh(root = document) {
        this.translateAll(root);
    }
}
