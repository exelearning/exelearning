/*!
 * eXeLearning v3.0.1 Example Style Script File
 * -----------------------
 * Author: Ignacio Gros
 * Project: eXeLearning.net
 *
 * This JavaScript file is part of a style for eXeLearning.
 * Licensed under Creative Commons Attribution-ShareAlike (CC BY-SA).
 *
 * Note: The style's config.xml contains additional information
 *       about materials (images, fonts, etc.) created by third parties
 *       and included in this style.
 */

var exampleStyle = {
    breadcrumbs : true,
    dropdownNavigation : true,
    init: function () {
        // Common functions
        if (this.inIframe()) $('body').addClass('in-iframe');
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
        if (!$('body').hasClass('exe-web-site')) {
            $('.package-header').prepend(togglers);
            // Dark mode
            exampleStyle.darkMode.init();
            return;
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
            <button type="button" id="searchBarTogger" class="toggler" title="' +
            $exe_i18n.search +
            '">\
                <span>' +
            $exe_i18n.search +
            '</span>\
            </button>\
        ';
        $('#siteNav').before(togglers);
        // Check the current NAV status
        var url = window.location.href;
        url = url.split('?');
        if (url.length > 1) {
            if (url[1].indexOf('nav=false') != -1) {
                $('body').addClass('siteNav-off');
                exampleStyle.params('add');
            }
        }
        // Dark mode
        this.darkMode.init();
        // Menu toggler
        $('#siteNavToggler').on('click', function () {
            if (exampleStyle.isLowRes()) {
                $('#exe-client-search').hide();
                if ($('body').hasClass('siteNav-off')) {
                    $('body').removeClass('siteNav-off');
                } else {
                    if ($('#siteNav').isInViewport()) {
                        $('body').addClass('siteNav-off');
                        exampleStyle.params('add');
                    }
                }
                window.scroll(0, 0);
            } else {
                $('body').toggleClass('siteNav-off');
                exampleStyle.params(
                    $('body').hasClass('siteNav-off') ? 'add' : 'remove'
                );
            }
        });
        // Search bar toggler
        $('#searchBarTogger').on('click', function () {
            var bar = $('#exe-client-search');
            if (bar.is(':visible')) {
                bar.hide();
            } else {
                if (exampleStyle.isLowRes()) {
                    $('body').addClass('siteNav-off');
                }
                bar.show();
                $('#exe-client-search-text').focus();
                window.scroll(0, 0);
            }
        });
        // Allways close the menu in low resolution
        $("#siteNav a").on('click', function(event){
            if (event.target.nodeName == 'A') {
                if (exampleStyle.isLowRes()) {
                    event.preventDefault();
                    window.location = this.href + '?nav=false';
                }
            }
        });
        // Breadcrumbs
        this.getBreadcrumbs();
        // Enable dropdowns in the main navigation menu
        this.dropdownMenus();
        // Search form
        this.searchForm();
        // Made with eXeLearning + EducaMadrid
        this.madeWith();
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
                exampleStyle.darkMode.setMode(active);
            });
        },
        setMode : function(active){
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
    madeWith : function () {
        // Made with eXeLearning + EducaMadrid
        var lnk = $("#made-with-eXe a");
        var htm = lnk.html();
            htm = htm.replace(" eXeLearning", " eXeLearning + EducaMadrid");
        lnk.html(htm);
    },
    isLowRes: function () {
        return $(window).width() <= 576;
    },
    truncate : function(str) {
        var max = 25;
        if (str.length > max) {
            return str.substring(0, max - 3) + '...';
        }
        return str;
    },
    removeQuotes : function(str){
        return str.replace(/"/g, '');
    },
    getBreadcrumbs : function(){
        if(!this.breadcrumbs) return;
        if ($("html").attr("id")=="exe-index") return false;
        function getNodeLinks(){
            var res = '<li><strong><span>'+exampleStyle.truncate($(".page-header .page-title").text())+'</span></strong></li>';
            var extra = "";
            var loc = window.location.href;
                loc = loc.split("/");
                loc = loc[loc.length-1];
                loc = loc.split("?");
                loc = loc[0];
                loc = loc.split("#");
                loc = loc[0];
            var mainTit = "";
            var mainLnk = "";
            $("#siteNav a").each(function(x){
                var e = $(this);
                if (x==0) {
                    mainTit = e.text();
                    mainLnk = e.attr("href");
                }
                var ref = e.attr("href");
                if (ref==loc || ref.endsWith("/" + loc)) {
                    var li = e.parent();
                    li.parents('li').each(function() {
                        var a = $("a",this).eq(0);
                        extra = '<li><a href="'+a.attr("href")+'" title="'+exampleStyle.removeQuotes(a.text())+'"><span>'+exampleStyle.truncate(a.text())+'</span></a></li>' + extra;
                    });
                }
            });
            if ($('html').attr('id')=='exe-index') {
                extra = '';
                res = '';
            }
            var img = 'theme/img/home.png';
            if ($('html').attr('id')!='exe-index') img = '../' + img;
            var tit = exampleStyle.removeQuotes(mainTit);
            return '<li><a href="'+mainLnk+'" id="siteBreadcrumbsHome" title="'+tit+'"><img src="'+img+'" width="19" height="19" alt="'+tit+'"><span class="sr-av">'+mainTit+'</span></a></li>' + extra + res;
        }
        var breadcrumb = '<div id="siteBreadcrumbs"><ul>'+getNodeLinks()+'</ul></div>';
        $(".package-header").prepend(breadcrumb).addClass("width-breadcrumbs");
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
            lnk.append('<button id="child-section-'+i+'-toggler" title="'+$exe_i18n.more+'" class="'+css+'"><span>'+$exe_i18n.more+'</span></button>');
            $("#child-section-"+i+"-toggler").on("click", function(event){
                event.preventDefault();
                if (exampleStyle.dropdownMenusWorking == true) return;
                exampleStyle.dropdownMenusWorking = true;
                var id = this.id;
                    id = id.replace("-toggler", "");
                var ul = $("#"+id);
                if (ul.is(":visible")) {
                    ul.slideUp("fast", function(){
                        var lnk = $("#"+this.id+"-toggler");
                            lnk.removeClass("open-ul");
                            lnk.addClass("closed-ul");
                        // $(this).removeClass("other-section-visible");
                        exampleStyle.dropdownMenusWorking = false;
                    });
                } else {
                    ul.slideDown("fast", function(){
                        var lnk = $("#"+this.id+"-toggler");
                            lnk.removeClass("closed-ul");
                            lnk.addClass("open-ul");
                        // $(this).addClass("other-section-visible");
                        exampleStyle.dropdownMenusWorking = false;
                    });
                }
            });
        })
    },
    param: function (e, act) {
        if (act == 'add') {
            var ref = e.href;
            var con = '?';
            if (ref.indexOf('.html?') != -1) con = '&';
            var param = 'nav=false';
            if (ref.indexOf(param) == -1) {
                ref += con + param;
                e.href = ref;
            }
        } else {
            // This will remove all params
            var ref = e.href;
            ref = ref.split('?');
            e.href = ref[0];
        }
    },
    params: function (act) {
        $('.nav-buttons a').each(function () {
            exampleStyle.param(this, act);
        });
    },
};
$(function () {
    exampleStyle.init();
});
exampleStyle.darkMode.setMode();
$.fn.isInViewport = function () {
    var elementTop = $(this).offset().top;
    var elementBottom = elementTop + $(this).outerHeight();
    var viewportTop = $(window).scrollTop();
    var viewportBottom = viewportTop + $(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};
