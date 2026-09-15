/**
 * Get i18n text with fallback to default
 * @param {string} key - Translation key
 * @param {string} defaultText - Fallback text if translation not found
 * @returns {string} Translated or default text
 */
function getI18nText(key, defaultText) {
    return (typeof $exe_i18n !== 'undefined' && $exe_i18n[key])
        ? $exe_i18n[key]
        : defaultText;
}

/**
 * Translate elements with data-i18n attribute
 * @param {string} key - The i18n key to look up
 * @param {string} defaultText - Fallback text
 */
function translateI18nElement(key, defaultText) {
    var text = getI18nText(key, defaultText);
    $('[data-i18n="' + key + '"]').each(function() {
        $(this).attr('title', text);
        $('span', this).text(text);
    });
}

// Guard against multiple loads (EPUB readers may reload scripts when navigating)
if (typeof window.$exeExport === 'undefined') {
window.$exeExport = {

    isTogglingBox: false,
    delayLoadingPageTime: 200,
    delayLoadingIdevicesJson: 50,
    delayLoadScorm: 50,
    scormAPIwrapper: 'SCORM_API_wrapper.js',
    scormFunctions: 'SCOFunctions.js',

    init: function () {
        try {
            this.addBoxToggleEvent();
            this.translateNavButtons();
        } catch (err) {
            console.error('Error: Failed to initialize box toggle events');
        }
        try {
            this.setExe();
            this.initExe();
            this.initJsonIdevices();
        } catch (err) {
            console.error('Error: Failed to initialize content');
        }
        try {
            this.loadScorm();
        } catch (err) {
            console.error('Error: Failed to initialize SCORM');
        }
        // setTimeout to allow custom button in style
        setTimeout(function(){
            try {
                $exeExport.teacherMode.init();
            } catch (err) {
                console.error('Error: Failed to initialize Teacher Mode');
            }
            try {
                $exeExport.presentationMode.init();
            } catch (err) {
                console.error('Error: Failed to initialize Presentation mode');
            }
        }, 100);
        setTimeout(() => { this.addClassJsExecutedToExeContent() }, this.delayLoadingPageTime);
        setTimeout(() => {
            try {
                this.triggerPrintIfRequested();
            } catch (err) {
                console.error('Error: Failed to trigger print dialog');
            }
        }, this.delayLoadingPageTime);
        setTimeout(() => {
            try {
                this.searchBar.highlightFromUrl();
            } catch (err) {
                // Failed to highlight search results
            }
        }, this.delayLoadingPageTime);
    },

    /**
     * Set eXe object
     */
    setExe: function () {
        window.eXe = {};
        window.eXe.app = $exe;
    },

    /**
     * Init legacy $exe object
     */
    initExe: function () {
        window.eXe.app.init();
    },

    // Set one query param on an href (null removes it), keeping the rest and the fragment.
    /**
     * Append a `name=value` navigation parameter to an in-package href so a reader-chosen
     * mode (Teacher Mode, Presentation mode) survives navigation between pages — works in
     * same-origin AND opaque-origin iframes (where storage is unavailable). Leaves external
     * links, non-relative schemes and pure fragments untouched.
     */
    withNavParam : function(href, navParams){
        if (!href || !navParams) return href;
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return href;
        var eq = navParams.indexOf('=');
        var name = eq === -1 ? navParams : navParams.slice(0, eq);
        var value = eq === -1 ? '' : navParams.slice(eq + 1);
        return this.setUrlParam(href, name, value);
    },

    /** Rewrite the menu and prev/next links so navigation keeps the chosen mode. */
    propagateNavParam : function(navParams){
        if (!navParams) return;
        var self = this;
        document.querySelectorAll('#siteNav a[href], .nav-buttons a[href]').forEach(function(a){
            a.setAttribute('href', self.withNavParam(a.getAttribute('href'), navParams));
        });
    },

    setUrlParam : function (href, name, value) {
        if (!href || !name) return href;
        // A query would turn a fragment-only jump into a page load.
        if (href.charAt(0) === '#') return href;
        var hash = '';
        var i = href.indexOf('#');
        if (i !== -1) {
            hash = href.slice(i);
            href = href.slice(0, i);
        }
        var query = '';
        i = href.indexOf('?');
        if (i !== -1) {
            query = href.slice(i + 1);
            href = href.slice(0, i);
        }
        var parts = query ? query.split('&') : [];
        var kept = [];
        for (i = 0; i < parts.length; i++) {
            if (parts[i] && parts[i].split('=')[0] !== name) kept.push(parts[i]);
        }
        if (value !== null && value !== undefined) kept.push(name + '=' + value);
        return href + (kept.length ? '?' + kept.join('&') : '') + hash;
    },

    /**
     * Teacher Mode
     *
     * Teacher-only content (.teacher-only) is HIDDEN by default in exports (see the rule in
     * base.css). It is revealed by the `mode-teacher` class on <html>, which the in-page
     * self-serve toggle adds/removes. The toggle is opt-in via URL parameter, so host
     * integrations (LMS/CMS) only need to change the iframe URL — no injected CSS/JS:
     *
     *   ?exe-teacher=1|true|yes   show the Teacher Mode toggle (alias: ?teacher-mode=1, or
     *                             the legacy ?exe-teacher-toggler=1). The toggle is OFF by
     *                             default and remembers the viewer's choice in localStorage;
     *                             the viewer activates it to reveal teacher content. The
     *                             parameter never reveals content on its own.
     *   (no parameter)            no toggle; teacher content stays hidden (student view).
     *
     * NOTE: this is an opt-in PRESENTATION mode, not access control and not a security
     * boundary. Truly sensitive answer keys need a separate authenticated/password-gated
     * feature.
     */
    teacherMode : {
        STORAGE_KEY : 'exeTeacherMode',
        _showToggler : false,
        _navParams : '',
        _truthy : function(v){ return v === '1' || v === 'true' || v === 'yes'; },
        /**
         * Decide — as early as possible, since this file runs in <head> — whether the
         * self-serve toggle should be available, and restore the viewer's stored choice
         * flicker-free. The parameter only makes the toggle AVAILABLE; it never reveals
         * content on its own. Vanilla JS only; never throws (safe default = student view).
         */
        bootstrap : function(){
            var root = document.documentElement;
            try {
                var params = new URLSearchParams(window.location.search);
                var teacher = params.get('exe-teacher');
                if (teacher === null) teacher = params.get('teacher-mode'); // documented alias
                var toggler = params.get('exe-teacher-toggler'); // legacy alias, same effect
                this._showToggler = this._truthy(teacher) || this._truthy(toggler);
                this._navParams = this._showToggler ? 'exe-teacher=1' : '';
                if (this._showToggler) {
                    // Restore the viewer's stored choice (OFF by default), flicker-free.
                    try {
                        if (localStorage.getItem(this.STORAGE_KEY) === '1') root.classList.add('mode-teacher');
                    } catch (e) {}
                }
            } catch (e) {
                // Keep student mode (no toggle) as the safe default.
            }
        },
        /** Keep the teacher view across in-package navigation (see $exeExport.withNavParam). */
        withTeacherParams : function(href){
            return $exeExport.withNavParam(href, this._navParams);
        },
        /** Rewrite the menu and prev/next links so navigation keeps the teacher view. */
        propagateNavParams : function(){
            $exeExport.propagateNavParam(this._navParams);
        },
        init : function(){
            // Reveal is already applied by bootstrap() (flicker-free); here we only carry
            // the params across navigation and manage the optional self-serve toggle.
            this.propagateNavParams();
            if (typeof(localStorage)!='object') return;
            if ($(".box.teacher-only").length==0 && $(".idevice_node.teacher-only").length==0) return;
            if (document.getElementById("teacher-mode-toggler")) return;
            if ($("body").hasClass("exe-epub")) return;
            // The self-serve toggle is opt-in: shown only when the teacher URL parameter
            // made it available (?exe-teacher=1, alias ?teacher-mode=1, or the legacy
            // ?exe-teacher-toggler=1) — see bootstrap(). _showToggler captures that decision.
            if (this._showToggler !== true) return;
            document.body.classList.add('exe-teacher-mode-toggler');
            var btn = '<div class="form-check form-switch" id="teacher-mode-toggler-wrapper"><input class="form-check-input" type="checkbox" role="switch" id="teacher-mode-toggler"><label class="form-check-label" for="teacher-mode-toggler">'+$exe_i18n.teacher_mode+'</label></div>';
            if ($("body").hasClass("exe-single-page")) $(".package-header").before(btn);
            else $(".page-header").prepend(btn);
            this.toggler = $("#teacher-mode-toggler");
            if (document.documentElement.classList.contains('mode-teacher')) {
                this.toggler.prop("checked", true);
            }
            this.toggler.on("change", function(){
                var root = document.documentElement;
                var key = $exeExport.teacherMode.STORAGE_KEY;
                if (this.checked) {
                    try { localStorage.setItem(key, '1'); } catch (e) {}
                    root.classList.add('mode-teacher');
                } else {
                    try { localStorage.removeItem(key); } catch (e) {}
                    root.classList.remove('mode-teacher');
                }
            });
        },
        isEnabled : function(){
            try {
                return localStorage.getItem(this.STORAGE_KEY) === '1';
            } catch (e) {
                return false;
            }
        }
    },

    /**
     * Load SCO functions
     */
    loadScorm: function () {
        if (document.querySelector('body').classList.contains('exe-scorm')) {
            var loadScormScriptInterval = setInterval(() => {
                if (typeof window.scorm != 'undefined' && typeof window.loadPage == 'function') {
                    this.initScorm();
                    clearInterval(loadScormScriptInterval);
                }
            }, this.delayLoadScorm)
        }
    },

    /**
     * Load scorm page item
     */
    initScorm: function () {
        if (typeof window.scorm != 'undefined' && typeof window.loadPage == 'function') {
            var isSCORM = false;
            // We go through the activities to see if any save scorm data
            let idevicesNodes = document.querySelectorAll('.idevice_node');
            idevicesNodes.forEach(ideviceNode => {
                let ideviceComponentType = ideviceNode.getAttribute('data-idevice-component-type');
                let ideviceType = ideviceNode.getAttribute('data-idevice-type');
                let ideviceObject = this.getIdeviceObject(ideviceType);
                if (ideviceObject) {
                    // Check if idevice save scorm data
                    switch (ideviceComponentType) {
                        case 'js':
                            if (ideviceObject.options) {
                                ideviceObject.options.forEach(instanteOptions => {
                                    if (instanteOptions.isScorm) isSCORM = true;
                                })
                            }
                            break;
                        case 'json':
                            let jsonDataText = ideviceNode.getAttribute('data-idevice-json-data');
                            let jsonData = null;
                            
                            // Parse JSON data or create empty object if not valid
                            try {
                                if (jsonDataText) {
                                    jsonData = JSON.parse(jsonDataText);
                                }
                            } catch (e) {
                                jsonData = null;
                            }
                            
                            // Check for SCORM data if jsonData is valid
                            if (
                                jsonData &&
                                (
                                    (jsonData.exportScorm && jsonData.exportScorm.saveScore) ||
                                    Number(jsonData.isScorm) > 0
                                )
                            ) {
                                isSCORM = true;
                            }
                            break;
                    }
                }
            })
            if (window.exeScorm12 && typeof window.exeScorm12.setPageHasScoredActivities === 'function') {
                // Scan before loadPage() so applyEntryPolicy() sees whether
                // scored iDevices exist (a presentation iDevice may already
                // have registered on jQuery ready). The runtime owns
                // end-of-session handling; no unload handler is registered.
                window.exeScorm12.setPageHasScoredActivities(isSCORM);
                window.loadPage();
            } else {
                window.loadPage();
                // Legacy runtime (SCORM 2004 packages and packages exported
                // before the SCORM 1.2 runtime rewrite). `pagehide` rather
                // than `unload`: this file also ships inside SCORM 1.2
                // packages, where an unload-family listener anywhere on the
                // page would disable the back/forward cache the SCORM 1.2
                // runtime depends on. `pagehide` fires immediately before
                // `unload`, and the legacy unloadPage() is guarded to run only
                // once, so the end-of-session behaviour is unchanged.
                //
                // `event.persisted === true` means the page is being frozen
                // into the back/forward cache and may come back: ending the
                // LMS session then would be wrong, so the bridge stands down.
                window.addEventListener('pagehide', (event) => {
                    if (event && event.persisted) return;
                    window.unloadPage(isSCORM);
                });
            }
        }
    },

    /**
     * Init export json idevices
     */
    initJsonIdevices: function () {
        // Get idevices
        let idevicesTypes = {};
        let idevicesNodes = document.querySelectorAll('.idevice_node');
        idevicesNodes.forEach(ideviceNode => {
            let ideviceComponentType = ideviceNode.getAttribute('data-idevice-component-type');
            if (ideviceComponentType == 'json') {
                let ideviceType = ideviceNode.getAttribute('data-idevice-type');
                idevicesTypes[ideviceType] = true;
            }
        })
        // Init idevices
        Object.keys(idevicesTypes).forEach(ideviceType => {
            this.initJsonIdeviceInterval(ideviceType);
        })
    },

    /**
     * Init init export json idevice interval
     *
     * @param {*} ideviceType
     */
    initJsonIdeviceInterval: function (ideviceType) {
        let intervalName = 'eXe_idevice_init_interval_' + ideviceType;
        window[intervalName] = setInterval(
            () => this.initJsonIdevice(ideviceType, intervalName),
            this.delayLoadingIdevicesJson);
    },

    /**
     * Init export json idevice
     *
     * @param {*} ideviceType
     */
    initJsonIdevice: function (ideviceType, intervalName) {
        // Idevice export object
        let exportIdevice = this.getIdeviceObject(ideviceType);
        if (exportIdevice === undefined) return false;
        // Clear interval immediately - we only need to run once
        clearInterval(window[intervalName]);
        // Get json data and initializes each page component of the indicated type
        let idevicesNodes = document.querySelectorAll(`.idevice_node.${ideviceType}`);
        idevicesNodes.forEach(ideviceNode => {
            // Skip if already loaded or loading (prevents duplicate fetches)
            if (ideviceNode.classList.contains('loaded') || ideviceNode.classList.contains('loading')) {
                return;
            }
            // Loading class
            ideviceNode.classList.add('loading');
            // Get json data
            let jsonDataText = ideviceNode.getAttribute('data-idevice-json-data');
            let jsonData = null;

            // Text idevices don't need JSON data parsing - use empty object directly
            const currentIdeviceType = ideviceNode.getAttribute('data-idevice-type');
            if (currentIdeviceType === 'text') {
                jsonData = {};
            } else {
                // Parse JSON data or create empty object if not valid
                try {
                    if (jsonDataText) {
                        jsonData = JSON.parse(jsonDataText);
                    }
                } catch (e) {
                    jsonData = null;
                }

                // If jsonData is not an object, create an empty one
                if (!jsonData || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
                    jsonData = {};
                }
            }

            jsonData.ideviceId = ideviceNode.id;
            // Get accesibility
            let accesibility = null;
            // Get template filename and path
            let templateFilename = ideviceNode.getAttribute('data-idevice-template');
            let idevicePath = ideviceNode.getAttribute('data-idevice-path');
            // Idevice export function 1: renderView
            // JSON iDevices that store ALL content in jsonProperties (not in htmlView) need renderView
            // to generate the complete interface. These iDevices have empty htmlView by design.
            // Other JSON iDevices (like text) may have pre-rendered content in htmlView.
            const isJsonIdevice = ideviceNode.getAttribute('data-idevice-component-type') === 'json';
            // JSON-only iDevices that store ALL content in jsonProperties (not in htmlView)
            // and need renderView to generate the complete interface.
            // 'trueorfalse' added for legacy imports that have empty htmlView.
            const jsonOnlyIdevices = [
                'casestudy',
                'file-attachment',
                'form',
                'image-gallery',
                'magnifier',
                'three-sixty-viewer',
                'trueorfalse',
                'adaptative-quiz',
            ];
            const ideviceType = ideviceNode.getAttribute('data-idevice-type');
            const needsJsonRender = isJsonIdevice && jsonOnlyIdevices.includes(ideviceType);
            if (needsJsonRender || ideviceNode.classList.contains('db-no-data')) {
                // Load template content if we only have filename
                this.loadTemplateAndRender(ideviceNode, exportIdevice, jsonData, accesibility, templateFilename, idevicePath);
            } else {
                // No renderView needed, just behaviour and init
                exportIdevice.renderBehaviour(jsonData, accesibility);
                exportIdevice.init(jsonData, accesibility);
                this.afterIdeviceRendered(ideviceNode);
                ideviceNode.classList.add('loaded');
                setTimeout(() => { ideviceNode.classList.remove('loading') }, 100);
            }
        })
    },

    /**
     * Load template content and render idevice
     * Templates are loaded from idevicePath + templateFilename
     */
    loadTemplateAndRender: function (ideviceNode, exportIdevice, jsonData, accesibility, templateFilename, idevicePath) {
        // If template is already full content (contains {content}), use it directly
        if (templateFilename && templateFilename.includes('{content}')) {
            this.renderWithTemplate(ideviceNode, exportIdevice, jsonData, accesibility, templateFilename);
            return;
        }

        // If we have path and filename, fetch the template
        if (idevicePath && templateFilename) {
            const templateUrl = idevicePath + templateFilename;
            fetch(templateUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Template not found: ${templateUrl}`);
                    }
                    return response.text();
                })
                .then(templateContent => {
                    this.renderWithTemplate(ideviceNode, exportIdevice, jsonData, accesibility, templateContent);
                })
                .catch(error => {
                    console.warn(`[exe_export] Could not load template: ${error.message}`);
                    // Fallback: render without template (just the generated HTML)
                    this.renderWithTemplate(ideviceNode, exportIdevice, jsonData, accesibility, '{content}');
                });
        } else {
            // No template info, use simple wrapper
            this.renderWithTemplate(ideviceNode, exportIdevice, jsonData, accesibility, '{content}');
        }
    },

    /**
     * Render idevice with loaded template content
     */
    renderWithTemplate: function (ideviceNode, exportIdevice, jsonData, accesibility, templateContent) {
        let htmlIdevice = exportIdevice.renderView(jsonData, accesibility, templateContent);
        if (htmlIdevice) ideviceNode.innerHTML = htmlIdevice;
        // Idevice export function 2: renderBehaviour
        exportIdevice.renderBehaviour(jsonData, accesibility);
        // Idevice export function 3: init
        exportIdevice.init(jsonData, accesibility);
        this.afterIdeviceRendered(ideviceNode);
        // Loaded
        ideviceNode.classList.add('loaded');
        setTimeout(() => { ideviceNode.classList.remove('loading') }, 100);
    },

    /**
     * Apply the enhancements shared by every iDevice to content an iDevice has just
     * rendered.
     *
     * JSON iDevices build their markup from data long after the page-wide
     * initialization has run, so rich text they generate (which authors write in
     * TinyMCE, effects included) would never be processed. This is the export-side
     * counterpart of the editor's `loadLegacyExeFunctionalitiesExport()`: iDevices
     * stay unaware of the common libraries, and a new shared enhancement only has to
     * be registered here. See #2170.
     *
     * @param {HTMLElement} ideviceNode
     */
    afterIdeviceRendered: function (ideviceNode) {
        if (!ideviceNode) return;
        // Legacy $exe_effects object: initialize the effects inside this iDevice only,
        // leaving the ones already initialized elsewhere on the page untouched.
        if (typeof $exeFX !== 'undefined' && typeof $exeFX.init === 'function') {
            $exeFX.init(ideviceNode);
        }
    },

    /**
     * Get idevice export object
     *
     * @param {*} ideviceType
     */
    getIdeviceObject: function (ideviceType) {
        let exportIdeviceKey = this.getIdeviceObjectKey(ideviceType);
        let exportIdevice = window[exportIdeviceKey];
        return exportIdevice;
    },

    /**
     * Get idevice export object key
     *
     * @param {*} ideviceType
     */
    getIdeviceObjectKey: function (ideviceType) {
        let exportIdeviceKey = `$${ideviceType.split("-").join("")}`;
        return exportIdeviceKey;
    },

    /**
     * Add functionality to the boxes toggle button
     */
    addBoxToggleEvent: function () {
        // Apply i18n text to toggle buttons (translations from common_i18n.js)
        var toggleText = (typeof $exe_i18n !== 'undefined' && $exe_i18n.toggleContent)
            ? $exe_i18n.toggleContent
            : 'Toggle content';
        $('article.box .box-head .box-toggle').each(function() {
            $(this).attr('title', toggleText);
            $('span', this).text(toggleText);
        });

        $('article.box .box-head .box-toggle').on('click', function(){
            if ($exeExport.isTogglingBox) return;
            $exeExport.isTogglingBox = true;
            let box = $(this).parents('article.box');
            if (box.hasClass("minimized")) {
                box.removeClass('minimized');
                $('.box-content', box).slideDown(function(){
                    $exeExport.isTogglingBox = false;
                });
            } else {
                $('.box-content', box).slideUp(function(){
                    box.addClass('minimized');
                    $exeExport.isTogglingBox = false;
                });
            }
        });
        $('article.box .box-head').has('.box-toggle').css('cursor', 'pointer').on('click', function(e){
            let t = $(e.target);
            if (t.hasClass('box-toggle')) return false;
            $('.box-toggle', this).trigger('click');
        });

    },

    /**
     * Translate navigation buttons using data-i18n attributes
     * Applies translations from $exe_i18n (loaded from common_i18n.js)
     */
    translateNavButtons: function () {
        if (typeof $exe_i18n === 'undefined') return;
        translateI18nElement('previous', 'Previous');
        translateI18nElement('next', 'Next');
        translateI18nElement('menu', 'Menu');
    },

    /**
     * Add class to page
     */
    addClassJsExecutedToExeContent: function () {
        let eXeContent = document.querySelector('.exe-content');
        if (eXeContent) {
            eXeContent.classList.add('post-js');
            eXeContent.classList.remove('pre-js');
        }
    },

    /**
     * Trigger browser print dialog when `print=1` query parameter is present.
     */
    triggerPrintIfRequested: function () {
        const params = new URLSearchParams(window.location.search);
        if (params.get('print') === '1' && typeof window.print === 'function') {
            window.print();
        }
    },

    /**
     * Presentation mode
     *
     * Lets a reader present a web site export with the keyboard or a presenter remote:
     * the navigation menu collapses, Left/PageUp go to the previous page and
     * Right/PageDown to the next one. Pages stay the navigation unit and long pages keep
     * scrolling normally (Up/Down are never captured). Nothing is stored in the .elpx and
     * there is no export option: the READER activates the mode, like Teacher Mode.
     *
     *   ?exe-presentation=1|true|yes   present: the mode is on and a visible
     *                                  "Exit presentation mode" control leaves it.
     *   ?exe-presentation=0            the control is available but the mode is off.
     *   (no parameter)                 nothing is injected and no key is captured.
     *
     * The parameter IS the state: entering or leaving rewrites it in the current URL
     * (history.replaceState) and in the menu, prev/next and search-result links, so the
     * choice survives page changes and reloads without any storage.
     *
     * Scope: web site exports opened as the top-level document. Never SCORM/IMS (the LMS
     * owns navigation), EPUB, or content embedded in an iframe. Fullscreen is deliberately
     * left to the browser (F11): the Fullscreen API needs a user gesture, is lost on
     * navigation in Firefox/Safari and on file://, and is unavailable on iPhone. An
     * iDevice that goes fullscreen on its own counts as an open overlay (see
     * overlaySignals) and the keys stay inactive while it is.
     *
     * The control is appended to <body> as a sibling of #made-with-eXe (styled in
     * base.css the same way, and stacked below it so the badge can expand over it):
     * outside .exe-content and the footer, present in every web site export whatever
     * the style does to the page layout.
     */
    presentationMode : {
        PARAM : 'exe-presentation',
        _available : false,
        _requested : false,
        _active : false,
        _boundHandleKeydown : null,
        _truthy : function(v){ return v === '1' || v === 'true' || v === 'yes'; },
        /**
         * Runs in <head>: read the parameter and mark the requested mode on <html>
         * flicker-free. Never throws.
         */
        bootstrap : function(){
            try {
                var value = new URLSearchParams(window.location.search).get(this.PARAM);
                this._available = value !== null;
                this._requested = this._truthy(value);
                if (this._requested) document.documentElement.classList.add('mode-presentation');
            } catch (e) {
                // No presentation mode is the safe default.
            }
        },
        isActive : function(){ return this._active; },
        /** The parameter to carry in navigation links: the current state, or nothing. */
        navParams : function(){
            return this._available ? this.PARAM + '=' + (this._active ? '1' : '0') : '';
        },
        /** Keep the mode across in-package navigation (see $exeExport.withNavParam). */
        withParams : function(href){
            return $exeExport.withNavParam(href, this.navParams());
        },
        /** Web site export (never SCORM/IMS/EPUB) opened as the top-level document. */
        isSupported : function(){
            if (!document.body || !document.body.classList.contains('exe-web-site')) return false;
            try { return window.self === window.top; } catch (e) { return false; }
        },
        init : function(){
            if (!this._available) return;
            if (!this.isSupported()) {
                document.documentElement.classList.remove('mode-presentation');
                return;
            }
            $exeExport.propagateNavParam(this.navParams());
            if (document.getElementById('exe-presentation-toggler')) return;
            var control = document.createElement('button');
            control.type = 'button';
            control.id = 'exe-presentation-toggler';
            control.textContent = this._label();
            var self = this;
            control.addEventListener('click', function(){ self.toggle(); });
            document.body.appendChild(control);
            if (this._requested) this.enter();
        },
        toggle : function(){
            if (this._active) this.leave(); else this.enter();
        },
        enter : function(){
            if (this._active) return;
            this._active = true;
            document.documentElement.classList.add('mode-presentation');
            this._syncState();
            this._setMenuExpanded(false);
            this._boundHandleKeydown = this.handleKeydown.bind(this);
            document.addEventListener('keydown', this._boundHandleKeydown);
        },
        leave : function(){
            if (!this._active) return;
            this._active = false;
            document.documentElement.classList.remove('mode-presentation');
            this._syncState();
            this._setMenuExpanded(true);
            document.removeEventListener('keydown', this._boundHandleKeydown);
            this._boundHandleKeydown = null;
        },
        _label : function(){
            return this._active
                ? ($exe_i18n.exit_presentation_mode || 'Exit presentation mode')
                : ($exe_i18n.presentation_mode || 'Presentation mode');
        },
        // The parameter is the state: mirror it in the URL, the links and the control.
        _syncState : function(){
            $exeExport.propagateNavParam(this.navParams());
            try {
                var url = $exeExport.setUrlParam(window.location.href, this.PARAM, this._active ? '1' : '0');
                window.history.replaceState(window.history.state, '', url);
            } catch (e) {
                // The links still carry the state; only a reload of this page forgets it.
            }
            var control = document.getElementById('exe-presentation-toggler');
            if (control) control.textContent = this._label();
        },
        // Reuse the style's own menu toggler so its state classes, nav=false links and
        // low-resolution behaviour stay the single source of truth. The menu can still be
        // opened normally while presenting.
        _setMenuExpanded : function(expanded){
            var toggler = document.getElementById('siteNavToggler');
            if (!toggler) return;
            if ((toggler.getAttribute('aria-expanded') === 'true') !== expanded) toggler.click();
        },
        // Never hijack keys while the reader is typing or composing text.
        isTypingTarget : function(target){
            if (!target || typeof target.closest !== 'function') return false;
            return !!target.closest(
                'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'
            );
        },
        isHidden : function(el){
            if (!el) return true;
            if (el.hidden) return true;
            var style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : el.style;
            return style.display === 'none';
        },
        // Single source of truth for "some overlay currently owns the keyboard, so we must
        // not" (an open image-gallery lightbox must fully prevail over our keys — PR #2020
        // review from @ignaciogros). Add one entry here to cover a future overlay/widget;
        // nothing else in this module needs to change.
        overlaySignals : [
            {
                name: 'exe_lightbox (prettyPhoto, rel="lightbox[...]")',
                // .pp_pic_holder is created once on first open and never removed; open/closed
                // is toggled via jQuery show/hide, so existence alone is NOT enough.
                isActive: function (pm) {
                    var el = document.querySelector('.pp_pic_holder');
                    return !!el && !pm.isHidden(el);
                }
            },
            {
                name: 'SimpleLightbox (Image Gallery iDevice)',
                // .sl-wrapper exists only while open. Its own arrow-key nav runs on `keyup`:
                // without this our keydown would change page before it ever ran.
                isActive: function () { return !!document.querySelector('.sl-wrapper'); }
            },
            {
                name: 'Fullscreen image overlay (Magnifier + other Games-* iDevices)',
                // common.js showFullscreenImage(): appended while shown, removed on close.
                isActive: function () { return !!document.querySelector('.Games-OverlayImage'); }
            },
            {
                name: 'MediaElement.js fullscreen video (Interactive Video iDevice)',
                isActive: function () { return !!document.querySelector('.mejs-container-fullscreen'); }
            },
            {
                name: 'Fullscreen API (an iDevice that went fullscreen on its own)',
                isActive: function () { return !!document.fullscreenElement; }
            }
        ],
        isOverlayActive : function(){
            var pm = this;
            return this.overlaySignals.some(function (signal) {
                try {
                    return signal.isActive(pm);
                } catch (err) {
                    // A single broken probe must never mask the others.
                    return false;
                }
            });
        },
        handleKeydown : function(event){
            if (event.defaultPrevented || event.isComposing) return;
            // Plain keys only: never shadow Alt/Ctrl/Cmd/Shift combinations the browser
            // reserves (e.g. Alt+Left/Right for history).
            if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
            if (this.isTypingTarget(event.target) || this.isOverlayActive()) return;
            var link = null;
            if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
                link = document.querySelector('a.nav-button-left');
            } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
                link = document.querySelector('a.nav-button-right');
            }
            if (!link) return;
            link.click();
            if (event.cancelable) event.preventDefault();
        }
    }
}
} // End of if (typeof window.$exeExport === 'undefined')

// Use local reference for cleaner code
var $exeExport = window.$exeExport;

// Apply the Teacher Mode reveal as early as possible. This script runs in <head>, so
// doing it now (before DOMContentLoaded and the first paint) avoids any content flicker.
try { $exeExport.teacherMode.bootstrap(); } catch (e) { /* student mode is the safe default */ }
try { $exeExport.presentationMode.bootstrap(); } catch (e) { /* no presentation mode is the safe default */ }

$(function () {
    $exeExport.init();
});

/* To review: This should be in a different file (exe_search.js) */
$exeExport.searchBar = {
    deepLinking : false,
    markResults : true, // Mark results in list
    removeAllMarksOnClick : true, // If true, clicking a mark removes all marks; if false, only that one
    query : '',
    // Normalize text for search comparison: lowercase and remove diacritical marks
    normalizeText : function(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks
    },
    // Mark search term in text (for search results display)
    markText : function(text, term) {
        if (!this.markResults || !text || !term) return text;
        var normalizedText = this.normalizeText(text);
        var result = '';
        var lastIndex = 0;
        var index = normalizedText.indexOf(term);
        while (index !== -1) {
            result += text.substring(lastIndex, index);
            result += '<mark class="exe-client-search-result">' + text.substring(index, index + term.length) + '</mark>';
            lastIndex = index + term.length;
            index = normalizedText.indexOf(term, lastIndex);
        }
        result += text.substring(lastIndex);
        return result;
    },
    init : function(){
        var searchWrapper = $('#exe-client-search');
        if (searchWrapper.length != 1) return;
        $("body").addClass('exe-search-on');
        this.isIndex = $("html").attr('id') == 'exe-index';
        // Service Worker preview serves content at /viewer/ path
        this.isPreview = window.location.pathname.startsWith('/viewer/');
        this.createSearchForm();
        // Try window.exeSearchData first (from search_index.js), fallback to data-pages attribute
        if (window.exeSearchData) {
            this.data = window.exeSearchData;
        } else {
            var dataPagesAttr = searchWrapper.attr('data-pages');
            if (dataPagesAttr) {
                this.data = JSON.parse(dataPagesAttr);
            }
        }

        let page = document.querySelector('.exe-content > .page');
        let searchContainer = document.querySelector('#exe-client-search');
        if (searchContainer) {
            let searchForm = document.querySelector('form#exe-client-search-form');
            if (searchForm) {
                searchForm.addEventListener('submit', event => {
                    event.preventDefault();
                    let searchText = event.target.querySelector('#exe-client-search-text');
                    if (searchText) {
                        let valueSearch = searchText.value;
                        let valueSearchTempElement = document.createElement("div");
                        valueSearchTempElement.innerHTML = valueSearch;
                        valueSearch = valueSearchTempElement.textContent;
                        if (valueSearch) {
                            $exeExport.searchBar.query = valueSearch;
                            this.doSearch();
                            page.classList.add('exe-client-search-results');
                        }
                    }
                });
            }
            let searchHide = document.querySelector('#exe-client-search #exe-client-search-reset');
            if (searchHide) {
                searchHide.addEventListener('click', event => {
                    event.preventDefault();
                    $("main > header, main div.page-content").show();
                    $("#exe-client-search-reset").removeClass("visible");
                    $('#exe-client-search-results-list').html('');
                })
            }
        }
    },
    createSearchForm : function(){
        if (document.getElementById("exe-client-search-form")) return;
        let html = `
            <form id="exe-client-search-form" action="#" method="GET">
                <p>
                    <label for="exe-client-search-text" class="sr-av">${$exe_i18n.search}</label>
                    <input id="exe-client-search-text" type="text" placeholder="${$exe_i18n.search}">
                    <input id="exe-client-search-submit" type="submit" value="${$exe_i18n.search || 'Search'}">
                    <a id="exe-client-search-reset" href="#main" title="${$exe_i18n.hide}"><span>${$exe_i18n.hide}</span></a>
                </p>
            </form>
        `;
        $("#exe-client-search").prepend(html);
        html = `
            <div id="exe-client-search-results">
                <div id="exe-client-search-results-list">
                </div>
            </div>
        `;
        $("#exe-client-search").append(html);
    },
    doSearch : function(){
        this.results = [];
        var i;
        let res = '';
        let str = $exeExport.searchBar.query;
        str = this.normalizeText(str);
        let data = this.data;
        for (i in data) {
            var node = data[i];
            var nodeTitle = node.name;
            var nodetitle = this.normalizeText(nodeTitle);
            if (nodetitle.indexOf(str) != -1) {
                this.results.push(i);
                let lnk = this.getLink(node.fileUrl);
                lnk = this.addSearchParam(lnk);
                let displayTitle = this.markText(nodeTitle, str);
                res += '<li><a href="' + lnk +'">' + displayTitle + '</a><span> ' + this.searchInBlocks(i, str, false) + '</span></li>';
            } else {
                res += this.searchInBlocks(i, str, true);
            }
        }
        if (res != '') {
            res = '<ul>' + res + '</ul>';
        } else {
            res = '<p>'+$("#exe-client-search").attr("data-no-results-string")+'</p>';
        }
        $("#exe-client-search-results-list").html(res);
        $("main > header, main div.page-content").hide();
        $("#exe-client-search-reset").addClass("visible");
        this.checkBlockLinks();
    },
    getLink : function(lnk){
        if (this.isPreview) {
            // Check if we're on a subpage (/viewer/html/*)
            var currentPath = window.location.pathname;
            var isOnSubpage = currentPath.indexOf('/html/') !== -1;

            if (isOnSubpage) {
                // From /viewer/html/current.html, need to go up one level
                // html/page.html → ../html/page.html
                // index.html → ../index.html
                if (lnk.indexOf('../') !== 0 && lnk.indexOf('/') !== 0) {
                    return '../' + lnk;
                }
            }
            return lnk;
        }
        if (!this.isIndex) {
            lnk = lnk.replace('html/','');
            if (lnk == 'index.html') lnk = '../' + lnk;
        }
        return lnk;
    },
    checkBlockLinks : function(){
        let spans = $("#exe-client-search-results-list span");
        if (this.deepLinking) {
            spans.each(function(){
                var e = $(this);
                var h = e.html();
                if (h != " ") {
                    h = h.replace(', ', '(');
                    if (!h.endsWith(')')) h = h + ')';
                    e.html(h);
                } else {
                    e.remove();
                }
            });
        } else {
            spans.remove();
        }
        $("#exe-client-search-results-list a").on("click", function(){
            // Hits come from the search index, so they inherit no params.
            var href = $exeExport.teacherMode.withTeacherParams(this.getAttribute('href'));
            href = $exeExport.presentationMode.withParams(href);
            if (!$("#siteNav").is(":visible")) {
                // Deep links: the param goes before the fragment.
                href = $exeExport.setUrlParam(href, 'nav', 'false');
            }
            this.setAttribute('href', href);
            // Close search box and restore page content
            $("main > header, main div.page-content").show();
            $("#exe-client-search-reset").removeClass("visible");
            $('#exe-client-search-results-list').html('');
            $('#exe-client-search').hide();
            $('#searchBarToggler').attr('aria-expanded', 'false');
            $('#exe-client-search-text').val('');
        });
    },
    searchInBlocks : function(i, str, fullLink) {
        if (this.deepLinking == false && this.results.indexOf(i) != -1) {
            return '';
        }
        var x, z;
        let res = '';
        var node = this.data[i];
        var nodeTitle = node.name;
        var boxes = node.blocks;
        var boxCounter = 0;
        for (x in boxes) {
            boxCounter ++;
        }
        var localBoxOrder = 0;
        var pageLinked = false;
        for (x in boxes) {
            localBoxOrder++;
            var box = boxes[x];
            var boxOrder = localBoxOrder;
            var boxTitle = box.name;
            var boxtitle = this.normalizeText(boxTitle);

            // Add the HTML of the iDevices to boxtitle so it searches there too
            var iDevices = box.idevices;
            for (z in iDevices) {
                var iDevice = iDevices[z];
                if (typeof(iDevice.htmlView) == 'string') {
                    var iDeviceHTML = iDevice.htmlView;
                        iDeviceHTML = iDeviceHTML.replace(/<\/?[^>]+(>|$)/g, "");
                    var tmp = $("<div></div>");
                        tmp.html(iDeviceHTML);
                    var iDeviceText = tmp.text();
                        iDeviceText = this.normalizeText(iDeviceText);
                    boxtitle += ' ' + iDeviceText;
                }
            }

            if (boxtitle.indexOf(str) != -1) {
                this.results.push(i);
                let lnk = this.getLink(node.fileUrl);
                var blockLabel = (typeof $exe_i18n !== 'undefined' && $exe_i18n.block) ? $exe_i18n.block : 'block';
                if (fullLink) {
                    if (this.deepLinking) {
                        lnk += '#' + x;
                        lnk = this.addSearchParam(lnk);
                        let displayTitle = this.markText(nodeTitle, str);
                        res += '<li><a href="' + lnk+ '">' + displayTitle + '</a>';
                        if (boxCounter > 1) res += '<span> (' + blockLabel + ' ' + boxOrder + ')</span></li>';
                    } else if (!pageLinked) {
                        lnk = this.addSearchParam(lnk);
                        let displayTitle = this.markText(nodeTitle, str);
                        res += '<li><a href="' + lnk+ '">' + displayTitle + '</a></li>';
                        pageLinked = true;
                    }
                }
                else {
                    var blockLnk = lnk +'#' + x;
                    blockLnk = this.addSearchParam(blockLnk);
                    if (boxCounter > 1) res += ', <a href="' + blockLnk + '">' + blockLabel + ' ' + boxOrder + '</a>';
                }
            }
        }
        return res;
    },

    // Add search parameter to a link
    addSearchParam : function(lnk) {
        if (!this.query) return lnk;
        return $exeExport.setUrlParam(lnk, 'q', encodeURIComponent(this.query));
    },

    // Check URL for search parameter and highlight matches
    highlightFromUrl : function() {
        var params = new URLSearchParams(window.location.search);
        var searchTerm = params.get('q');
        if (searchTerm) {
            this.markSearchResults(searchTerm);
        }
    },

    // Mark search results in the page content
    markSearchResults : function(term) {
        var self = this;
        var normalizedTerm = this.normalizeText(term);
        if (!normalizedTerm) return;

        // Tags where we should not search for text
        var excludeTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'NOSCRIPT', 'IFRAME', 'MARK', 'SVG', 'CODE', 'PRE'];

        var container = document.querySelector('.exe-content') || document.body;

        // Use TreeWalker to find text nodes
        var walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // Check if any ancestor is in the excludeTags
                    var parent = node.parentNode;
                    while (parent && parent !== container) {
                        if (excludeTags.indexOf(parent.tagName) !== -1) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        parent = parent.parentNode;
                    }
                    // Skip empty or whitespace-only nodes
                    if (!node.textContent.trim()) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        // Collect nodes to process
        var nodesToProcess = [];
        while (walker.nextNode()) {
            var normalizedContent = self.normalizeText(walker.currentNode.textContent);
            if (normalizedContent.indexOf(normalizedTerm) !== -1) {
                nodesToProcess.push(walker.currentNode);
            }
        }

        // Process each text node
        nodesToProcess.forEach(function(textNode) {
            var text = textNode.textContent;
            var normalizedText = self.normalizeText(text);
            var termLen = normalizedTerm.length;
            var fragment = document.createDocumentFragment();
            var lastIndex = 0;
            var index = normalizedText.indexOf(normalizedTerm);

            while (index !== -1) {
                // Text before the match
                if (index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                }

                // The match (use original text to preserve accents)
                var mark = document.createElement('mark');
                mark.className = 'exe-client-search-result';
                mark.textContent = text.substring(index, index + termLen);
                fragment.appendChild(mark);

                lastIndex = index + termLen;
                index = normalizedText.indexOf(normalizedTerm, lastIndex);
            }

            // Remaining text after last match
            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            textNode.parentNode.replaceChild(fragment, textNode);
        });

        // Add click event to remove marks
        document.addEventListener('click', function(e) {
            if (e.target.matches && e.target.matches('mark.exe-client-search-result')) {
                if ($exeExport.searchBar.removeAllMarksOnClick) {
                    // Remove all marks
                    var marks = document.querySelectorAll('mark.exe-client-search-result');
                    marks.forEach(function(mark) {
                        var text = document.createTextNode(mark.textContent);
                        mark.parentNode.replaceChild(text, mark);
                    });
                } else {
                    // Remove only the clicked mark
                    var mark = e.target;
                    var text = document.createTextNode(mark.textContent);
                    mark.parentNode.replaceChild(text, mark);
                }
            }
        });
    }
};

$(function(){
    $exeExport.searchBar.init();
});
