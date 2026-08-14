/*!
 * eXeLearning v4+ Style Script File
 * -----------------------
 * Author: Ignacio Gros for eXeLearning
 * Project: exelearning.net
 *
 * This JavaScript file is part of a style for eXeLearning.
 * Licensed under Creative Commons Attribution-ShareAlike (CC BY-SA).
 *
 * Note: The style's config.xml contains additional information
 *       about materials (images) created by third parties
 *       and included in this style.
 */

var myTheme = {
    init: function () {
        // Common functions
        if (this.inIframe()) $('body').addClass('in-iframe');
        if (!$('body').hasClass('exe-web-site')) return;
        // Add menu and search bar togglers
        var togglers =
            '\
            <button type="button" id="siteNavToggler" class="toggler" aria-expanded="true" aria-controls="siteNav" title="' +
            $exe_i18n.menu +
            '">\
                <span class="sr-av">' +
            $exe_i18n.menu +
            '</span>\
            </button>\
            <button type="button" id="searchBarTogger" class="toggler" aria-expanded="false" aria-controls="exe-client-search" title="' +
            $exe_i18n.search +
            '">\
                <span class="sr-av">' +
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
                $('#siteNavToggler').attr('aria-expanded', 'false');
                myTheme.params('add');
            }
        }
        // Menu toggler
        $('#siteNavToggler').on('click', function () {
            if (myTheme.isLowRes()) {
                $('#exe-client-search').hide();
                $('#searchBarTogger').attr('aria-expanded', 'false');
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
            $(this).attr('aria-expanded', !$('body').hasClass('siteNav-off'));
        });
        // Search bar toggler
        $('#searchBarTogger').on('click', function () {
            var bar = $('#exe-client-search');
            if (bar.is(':visible')) {
                bar.hide();
            } else {
                if (myTheme.isLowRes()) {
                    $('body').addClass('siteNav-off');
                    $('#siteNavToggler').attr('aria-expanded', 'false');
                }
                bar.show();
                $('#exe-client-search-text').focus();
                window.scroll(0, 0);
            }
            $(this).attr('aria-expanded', bar.is(':visible'));
        });
        if (!this.inIframe()) {
            // Fixed navigation
            $('#siteNav').wrap('<div id="sidebar-nav"></div>');
            myTheme.checkNav();
            $(window).bind('resize', function () {
                myTheme.checkNav();
            });
        }
        // Search form
        this.searchForm();
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
        return $('#siteNav').css('float') == 'none';
    },
    checkNav: function () {
        var wrapper = $('#sidebar-nav');
        var navH = $('#siteNav > ul').height(); // Menu height
        navH = navH + 50;
        if (navH < $(window).height()) wrapper.addClass('fixed');
        else wrapper.removeClass('fixed');
    },
    param: function (e, act) {
        if (act == 'add') {
            var ref = e.href;
            var hash = '';
            var h = ref.indexOf('#');
            if (h != -1) {
                hash = ref.slice(h);
                ref = ref.slice(0, h);
            }
            var param = 'nav=false';
            if (ref.indexOf(param) == -1) {
                e.href =
                    ref + (ref.indexOf('?') != -1 ? '&' : '?') + param + hash;
            }
        } else {
            var ref = e.href;
            var q = ref.indexOf('?');
            if (q == -1) return;
            var tail = ref.slice(q + 1);
            var hash = '';
            var h = tail.indexOf('#');
            if (h != -1) {
                hash = tail.slice(h);
                tail = tail.slice(0, h);
            }
            // Keep every other param
            var kept = tail.split('&').filter(function (p) {
                return p !== '' && p != 'nav=false';
            });
            e.href =
                ref.slice(0, q) +
                (kept.length ? '?' + kept.join('&') : '') +
                hash;
        }
    },
    params: function (act) {
        $('.nav-buttons a').each(function () {
            myTheme.param(this, act);
        });
    },
};
$(function () {
    myTheme.init();
});
$.fn.isInViewport = function () {
    var elementTop = $(this).offset().top;
    var elementBottom = elementTop + $(this).outerHeight();
    var viewportTop = $(window).scrollTop();
    var viewportBottom = viewportTop + $(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};
