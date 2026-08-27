/*!
 * eXeLearning v4+ Style Script File
 * -----------------------
 * Author: Eduardo Gros and Ignacio Gros for EducaMadrid
 * Project: www.educa.madrid.org
 *
 * This JavaScript file is part of a style for eXeLearning.
 * Licensed under Creative Commons Attribution-ShareAlike (CC BY-SA).
 *
 * Note: The style's config.xml contains additional information
 *       about materials (images, fonts, etc.) created by third parties
 *       and included in this style.
 */

var myTheme = {
    dropdownNavigation : true,
    init: function () {
        // Common functions
        if (this.inIframe()) $('body').addClass('in-iframe');
        if (!$('body').hasClass('exe-web-site')) {
            // Dark mode is website-only: undo the class setMode() applied at parse time
            $('html').removeClass('exe-dark-mode');
            return;
        }
        var togglers = '';
        if (this.isLocalStorageAvailable()) {
        togglers =
            '\
            <button type="button" id="darkModeToggler" class="toggler" title="' +
            $exe_i18n.mode_toggler +
            '">\
                <span>' +
            $exe_i18n.mode_toggler +
            '</span>\
            </button>\
        ';
        }
        // Add menu and search bar togglers
        togglers +=
            '\
            <button type="button" id="siteNavToggler" class="toggler" title="' +
            $exe_i18n.menu +
            '">\
                <span>' +
            $exe_i18n.menu +
            '</span>\
            </button>\
        ';
        $('#siteNav').before(togglers);
        // Check the current NAV status
        if (new URLSearchParams(window.location.search).get('nav') === 'false') {
            $('body').addClass('siteNav-off');
            myTheme.params('add');
        }
        // Dark mode
        this.darkMode.init();
        // Menu toggler
        $('#siteNavToggler').on('click', function () {
            if (myTheme.isLowRes()) {
                $('#exe-client-search').hide();
                if ($('body').hasClass('siteNav-off')) {
                    $('body').removeClass('siteNav-off');
                } else {
                    if ($('#siteNav').isInViewport()) {
                        $('body').addClass('siteNav-off');
                        myTheme.params('add');
                    }
                }
                window.scroll(0, 0);
            } else {
                $('body').toggleClass('siteNav-off');
                myTheme.params(
                    $('body').hasClass('siteNav-off') ? 'add' : 'remove'
                );
            }
        });  
        // Allways close the menu in low resolution
        $("#siteNav a").on('click', function(event){
            if (event.target.nodeName == 'A') {
                if (myTheme.isLowRes()) {
                    event.preventDefault();
                    window.location = $exeExport.setUrlParam(this.href, 'nav', 'false');
                }
            }
        });      
        // Enable dropdowns in the main navigation menu
        this.dropdownMenus();
        // Search form
        this.searchForm();
    },
    isLocalStorageAvailable : function(){
        var x = '';
        try {
            localStorage.setItem(x, x);
            localStorage.removeItem(x);
            return true;
        } catch(e) {
            return false;
        }
    },
    darkMode : {
        init : function(){
            $("#darkModeToggler").on("click",function(){
                var active = 'off';
                if (!$("html").hasClass("exe-dark-mode")) active = 'on';
                myTheme.darkMode.setMode(active);
            });
        },
        setMode : function(active){
            if (!myTheme.isLocalStorageAvailable()) return;
            var dark = false;
            var darkMode = localStorage.getItem('exeDarkMode');
            if (darkMode && darkMode == 'on') {
                dark = true;
            }
            if (active) {
                if (active == 'off') {
                    dark = false;
                } else {
                    dark = true;
                }
            }
            if (dark) {
                localStorage.setItem('exeDarkMode', 'on');
                $("html").addClass("exe-dark-mode");
            } else {
                localStorage.removeItem('exeDarkMode');
                $("html").removeClass("exe-dark-mode");
            }
        }
    },
    inIframe: function () {
        try {
            return window.self !== window.top;
        } catch (e) {
            return true;
        }
    },
    searchForm: function () {
        $('#exe-client-search-text').attr('class', 'form-control');
    },
    isLowRes: function () {
        return window.matchMedia('(max-width: 575.98px)').matches;
    },
    dropdownMenus: function(){
        if (!this.dropdownNavigation) return;
        this.dropdownMenusWorking = false;
        $("#siteNav ul ul").each(function(i){
            var elem = $(this);
            this.id = "child-section-"+i;
            var lnk = elem.prev("a");
            var css = 'closed-ul';
            if (elem.is(":visible")) css = 'open-ul';
            lnk.after('<button id="child-section-'+i+'-toggler" title="'+$exe_i18n.more+'" class="'+css+'" aria-controls="child-section-'+i+'" aria-expanded="'+(css == 'open-ul')+'"><span>'+$exe_i18n.more+'</span></button>');
            $("#child-section-"+i+"-toggler").on("click", function(event){
                event.preventDefault();
                if (myTheme.dropdownMenusWorking == true) return;
                myTheme.dropdownMenusWorking = true;
                var id = this.id;
                    id = id.replace("-toggler", "");
                var ul = $("#"+id);
                if (ul.is(":visible")) {
                    ul.slideUp("fast", function(){
                        var lnk = $("#"+this.id+"-toggler");
                            lnk.removeClass("open-ul");
                            lnk.addClass("closed-ul");
                            lnk.attr("aria-expanded", "false");
                        // $(this).removeClass("other-section-visible");
                        myTheme.dropdownMenusWorking = false;
                    });
                } else {
                    ul.slideDown("fast", function(){
                        var lnk = $("#"+this.id+"-toggler");
                            lnk.removeClass("closed-ul");
                            lnk.addClass("open-ul");
                            lnk.attr("aria-expanded", "true");
                        // $(this).addClass("other-section-visible");
                        myTheme.dropdownMenusWorking = false;
                    });
                }
            });
        });
    },
    // Toggle nav=false keeping the rest of the URL using a common function.
    params: function (act) {
        var value = act == 'add' ? 'false' : null;
        $('.nav-buttons a').each(function () {
            this.setAttribute(
                'href',
                $exeExport.setUrlParam(this.getAttribute('href'), 'nav', value)
            );
        });
    },
};
$(function () {
    myTheme.init();
});
myTheme.darkMode.setMode();
$.fn.isInViewport = function () {
    var elementTop = $(this).offset().top;
    var elementBottom = elementTop + $(this).outerHeight();
    var viewportTop = $(window).scrollTop();
    var viewportBottom = viewportTop + $(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};

