const $exeExport = window.$exeExport = {

    isTogglingBox: false,
    delayLoadingPageTime: 200,
    delayLoadingIdevicesJson: 50,
    delayLoadScorm: 50,
    scormAPIwrapper: 'SCORM_API_wrapper.js',
    scormFunctions: 'SCOFunctions.js',

    init: function () {
        try {
            this.addBoxToggleEvent();
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

$(function () {
    $exeExport.init();
});

/* To review: This should be in a different file (exe_search.js) */
$exeExport.searchBar = {
    deepLinking : false,
    markResults : false,
    query : '',
    /**
     * Normalize text for search comparison: lowercase and remove diacritical marks
     * (accents, tildes, umlauts, cedillas, etc.)
     * @param {string} text - The text to normalize
     * @returns {string} - Normalized text without diacritical marks
     */
    normalizeText : function(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks
    },
    init : function(){
        var searchWrapper = $('#exe-client-search');
        if (searchWrapper.length != 1) return;
        $("body").addClass('exe-search-on');
        this.isIndex = $("html").attr('id') == 'exe-index';
        this.isPreview = window.location.href.indexOf('/file/resources?resource=/tmp/') != -1;
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
                    <input id="exe-client-search-submit" type="submit" value="Búsqueda">
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
                res += '<li><a href="' + lnk +'">' + nodeTitle + '</a><span> ' + this.searchInBlocks(i, str, false) + '</span></li>';
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
        if (this.isPreview) return lnk;
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
            if (!$("#siteNav").is(":visible")) this.href += '?nav=false';
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
        for (x in boxes) {
            var box = boxes[x];
            var boxOrder = box.order;
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
                if (fullLink) {
                    if (this.deepLinking) lnk += '#' + x;
                    res += '<li><a href="' + lnk+ '">' + nodeTitle + '</a>';
                    if (boxCounter > 1) res += '<span> (bloque ' + boxOrder + ')</span></li>';
                }
                else {
                    if (boxCounter > 1) res += ', <a href="' + lnk +'#' + x + '">bloque ' + boxOrder + '</a>';
                }
            }
        }
        return res;
    }
};

$(function(){
    $exeExport.searchBar.init();
});
