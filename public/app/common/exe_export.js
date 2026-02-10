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
    
    /**
     * Teacher Mode
     */
    teacherMode : {
        STORAGE_KEY : 'exeTeacherMode',
        init : function(){
            if (typeof(localStorage)!='object') return;
            if ($(".box.teacher-only").length==0 && $(".idevice_node.teacher-only").length==0) return;
            if (document.getElementById("teacher-mode-toggler")) return;
            if ($("body").hasClass("exe-epub")) return;
            document.body.classList.add('exe-teacher-mode-toggler');
            var btn = '<div class="form-check form-switch" id="teacher-mode-toggler-wrapper"><input class="form-check-input" type="checkbox" role="switch" id="teacher-mode-toggler"><label class="form-check-label" for="teacher-mode-toggler">'+$exe_i18n.teacher_mode+'</label></div>';
            if ($("body").hasClass("exe-single-page")) $(".package-header").before(btn);
            else $(".page-header").prepend(btn);
            this.toggler = $("#teacher-mode-toggler");
            var enabled = this.isEnabled();
            if (enabled) {
                this.toggler.prop("checked", true);
                document.documentElement.classList.add('mode-teacher');
            }
            this.toggler.on("change", function(){
                var root = document.documentElement;
                var key = $exeExport.teacherMode.STORAGE_KEY;
                if (this.checked) {
                    localStorage.setItem(key, '1');
                    root.classList.add('mode-teacher');
                } else {
                    localStorage.removeItem(key);
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
                            if (jsonData && jsonData.exportScorm && jsonData.exportScorm.saveScore) {
                                isSCORM = true;
                            }
                            break;
                    }
                }
            })
            window.loadPage()
            window.addEventListener('unload', () => window.unloadPage(isSCORM));
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
            const jsonOnlyIdevices = ['casestudy', 'form', 'image-gallery', 'magnifier', 'trueorfalse'];
            const ideviceType = ideviceNode.getAttribute('data-idevice-type');
            const needsJsonRender = isJsonIdevice && jsonOnlyIdevices.includes(ideviceType);
            if (needsJsonRender || ideviceNode.classList.contains('db-no-data')) {
                // Load template content if we only have filename
                this.loadTemplateAndRender(ideviceNode, exportIdevice, jsonData, accesibility, templateFilename, idevicePath);
            } else {
                // No renderView needed, just behaviour and init
                exportIdevice.renderBehaviour(jsonData, accesibility);
                exportIdevice.init(jsonData, accesibility);
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
        // Loaded
        ideviceNode.classList.add('loaded');
        setTimeout(() => { ideviceNode.classList.remove('loading') }, 100);
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
        $('article.box .box-head').css('cursor', 'pointer').on('click', function(e){
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
    }
}
} // End of if (typeof window.$exeExport === 'undefined')

// Use local reference for cleaner code
var $exeExport = window.$exeExport;

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
            if (!$("#siteNav").is(":visible")) {
                // Use & if URL already has parameters, otherwise use ?
                var separator = this.href.indexOf('?') !== -1 ? '&' : '?';
                this.href += separator + 'nav=false';
            }
            // Close search box and restore page content
            $("main > header, main div.page-content").show();
            $("#exe-client-search-reset").removeClass("visible");
            $('#exe-client-search-results-list').html('');
            $('#exe-client-search').hide();
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
                    if (this.deepLinking) lnk += '#' + x;
                    lnk = this.addSearchParam(lnk);
                    let displayTitle = this.markText(nodeTitle, str);
                    res += '<li><a href="' + lnk+ '">' + displayTitle + '</a>';
                    if (boxCounter > 1) res += '<span> (' + blockLabel + ' ' + boxOrder + ')</span></li>';
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
        var searchParam = encodeURIComponent(this.query);
        // Handle hash
        var hashIndex = lnk.indexOf('#');
        var hash = '';
        if (hashIndex !== -1) {
            hash = lnk.substring(hashIndex);
            lnk = lnk.substring(0, hashIndex);
        }
        // Add parameter
        if (lnk.indexOf('?') !== -1) {
            lnk += '&q=' + searchParam;
        } else {
            lnk += '?q=' + searchParam;
        }
        return lnk + hash;
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
