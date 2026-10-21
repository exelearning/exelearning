/*!
 * eXeLearning v4+ INTEF Style Script File
 * -----------------------
 * Author: Ignacio Gros
 * Project: eXeLearning.net
 *
 * This JavaScript file is part of a style for eXeLearning.
 * Licensed under Creative Commons Attribution-ShareAlike (CC BY-SA).
 *
 * Note: The style's config.xml contains additional information
 *       about materials (images, fonts, logos, etc.) created by third
 *       parties and included in this style. The institutional logos are
 *       trademarks and may not be reused without written permission.
 */

var eXeIntefStyle = {
    breadcrumbs: true,
    dropdownNavigation: true,
    topBarTitle: true,
    // true | false | a domain | an array of domains (subdomains included)
    logos: 'intef.es',
    // 'web' | true | false
    darkModeToggler: 'web',
    darkModeIn: function (isWebSite) {
        if (!this.darkModeToggler) return false;
        if (this.darkModeToggler === 'web') return isWebSite;
        return true;
    },
    logosIn: function (host) {
        var domains = typeof this.logos == 'string' ? [this.logos] : this.logos;
        if (!Array.isArray(domains)) return !!this.logos;
        host = (host || '').toLowerCase();
        return domains.some(function (domain) {
            domain = domain.toLowerCase();
            return host == domain || host.endsWith('.' + domain);
        });
    },
    init: function () {
        // Common to every export format
        if (this.inIframe()) $('body').addClass('in-iframe');
        // Preload the attachment link :hover image
        var attachmentLinks = $('a.exe-attachment-link');
        if (attachmentLinks.length > 0) {
            attachmentLinks.addClass('tmp');
            setTimeout(function () {
                attachmentLinks.removeClass('tmp');
            }, 10);
        }
        this.externalLinks();
        // Dark mode
        var isWebSite = $('body').hasClass('exe-web-site');
        var darkMode = this.darkModeIn(isWebSite) && this.isLocalStorageAvailable();
        if (!darkMode) $('html').removeClass('exe-dark-mode');
        var togglers = '';
        if (darkMode) {
            togglers =
                '<button type="button" id="darkModeToggler" class="toggler" aria-pressed="' +
                ($('html').hasClass('exe-dark-mode') ? 'true' : 'false') +
                '" title="' +
                $exe_i18n.mode_toggler +
                '"><span>' +
                $exe_i18n.mode_toggler +
                '</span></button>';
        }
        // Website only from here on
        if (!isWebSite) {
            if (darkMode) {
                $('.package-header').prepend(togglers);
                this.darkMode.init();
            }
            return;
        }
        // Menu toggler
        togglers +=
            '<button type="button" id="siteNavToggler" class="toggler" aria-expanded="true" aria-controls="siteNav" title="' +
            $exe_i18n.menu +
            '"><span>' +
            $exe_i18n.menu +
            '</span></button>';
        // Search bar toggler (only when the package has a search box)
        if ($('#exe-client-search').length) {
            togglers +=
                '<button type="button" id="searchBarToggler" class="toggler" aria-expanded="false" aria-controls="exe-client-search" title="' +
                $exe_i18n.search +
                '"><span>' +
                $exe_i18n.search +
                '</span></button>';
        }
        $('#siteNav').before(togglers);
        // Check the current nav status
        if (new URLSearchParams(window.location.search).get('nav') === 'false') {
            $('body').addClass('siteNav-off');
            eXeIntefStyle.navExpanded(false);
            eXeIntefStyle.params('add');
        }
        // Dark mode
        this.darkMode.init();
        // Menu toggler
        $('#siteNavToggler').on('click', function () {
            if (eXeIntefStyle.isLowRes()) {
                $('#exe-client-search').hide();
                $('#searchBarToggler').attr('aria-expanded', 'false');
                if ($('body').hasClass('siteNav-off')) {
                    $('body').removeClass('siteNav-off');
                } else if ($('#siteNav').isInViewport()) {
                    $('body').addClass('siteNav-off');
                    eXeIntefStyle.params('add');
                }
                window.scroll(0, 0);
            } else {
                $('body').toggleClass('siteNav-off');
                eXeIntefStyle.params(
                    $('body').hasClass('siteNav-off') ? 'add' : 'remove'
                );
            }
            eXeIntefStyle.navExpanded(!$('body').hasClass('siteNav-off'));
        });
        // Search bar toggler
        $('#searchBarToggler').on('click', function () {
            var bar = $('#exe-client-search');
            if (bar.is(':visible')) {
                bar.hide();
            } else {
                if (eXeIntefStyle.isLowRes()) {
                    $('body').addClass('siteNav-off');
                    eXeIntefStyle.navExpanded(false);
                }
                bar.show();
                $('#exe-client-search-text').focus();
                window.scroll(0, 0);
            }
            $(this).attr('aria-expanded', bar.is(':visible'));
        });
        // Always close the menu in low resolution
        $('#siteNav a').on('click', function (event) {
            if (event.target.nodeName == 'A' && eXeIntefStyle.isLowRes()) {
                event.preventDefault();
                window.location = $exeExport.setUrlParam(
                    this.getAttribute('href'),
                    'nav',
                    'false'
                );
            }
        });
        // Institutional logos
        this.getLogos();
        // Breadcrumbs
        this.getBreadcrumbs();
        // Package title and subtitle in the top navigation bar
        this.getTopBarTitle();
        // Package title: link to the home page
        this.titleLinks();
        // Enable dropdowns in the main navigation menu
        this.dropdownMenus();
        // Search form
        this.searchForm();
    },
    // External links
    externalLinks: function () {
        $('.box-content a').each(function () {
            var e = $(this);
            var ref = e.attr('href');
            if (!ref) return;
            if (ref.indexOf('http') != 0 && ref.indexOf('//') != 0) return;
            if (this.rel && this.rel.indexOf('lightbox') != -1) return;
            if (e.attr('target') != '_blank') return;
            // The icon is for text links only
            var tmp = $('<div></div>').html(e.html());
            $('em, strong, span', tmp).contents().unwrap();
            if (tmp.children().length > 0) return;
            e.addClass('exe-external-link');
        });
    },
    isLocalStorageAvailable: function () {
        var x = '';
        try {
            localStorage.setItem(x, x);
            localStorage.removeItem(x);
            return true;
        } catch (e) {
            return false;
        }
    },
    darkMode: {
        init: function () {
            $('#darkModeToggler').on('click', function () {
                var active = 'off';
                if (!$('html').hasClass('exe-dark-mode')) active = 'on';
                eXeIntefStyle.darkMode.setMode(active);
            });
        },
        setMode: function (active) {
            var dark = false;
            var darkMode = localStorage.getItem('exeDarkMode');
            if (darkMode && darkMode == 'on') {
                dark = true;
            }
            if (active) {
                dark = active != 'off';
            }
            if (dark) {
                localStorage.setItem('exeDarkMode', 'on');
                $('html').addClass('exe-dark-mode');
            } else {
                localStorage.removeItem('exeDarkMode');
                $('html').removeClass('exe-dark-mode');
            }
            $('#darkModeToggler').attr('aria-pressed', dark ? 'true' : 'false');
        },
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
        return $(window).width() <= 576;
    },
    truncate: function (str) {
        var max = 25;
        if (str.length > max) {
            return str.substring(0, max - 3) + '...';
        }
        return str;
    },
    removeQuotes: function (str) {
        return str.replace(/"/g, '');
    },
    getBreadcrumbs: function () {
        if (!this.breadcrumbs) return;
        if ($('html').attr('id') == 'exe-index') return;
        // Page titles are text: build nodes, never markup
        function link(a) {
            var text = a.text();
            return $('<a></a>')
                .attr('href', a.attr('href'))
                .attr('title', text)
                .append($('<span></span>').text(eXeIntefStyle.truncate(text)));
        }
        function getNodeLinks() {
            var items = [];
            // File name of the current page
            var loc = window.location.href;
            loc = loc.split('/');
            loc = loc[loc.length - 1];
            loc = loc.split('?')[0];
            loc = loc.split('#')[0];
            var main = $('#siteNav a').first();
            $('#siteNav a').each(function () {
                var e = $(this);
                var ref = e.attr('href');
                if (!ref) return;
                if (ref == loc || ref.endsWith('/' + loc)) {
                    // Walk up the menu tree
                    e.parent()
                        .parents('li')
                        .each(function () {
                            var a = $('a', this).eq(0);
                            items.unshift($('<li></li>').append(link(a)));
                        });
                }
            });
            var mainTit = main.text();
            var home = $('<a id="siteBreadcrumbsHome"></a>')
                .attr('href', main.attr('href'))
                .attr('title', mainTit)
                .append(
                    $('<img width="19" height="19">')
                        .attr('src', '../theme/img/home.png')
                        .attr('alt', mainTit)
                )
                .append($('<span class="sr-av"></span>').text(mainTit));
            items.unshift($('<li></li>').append(home));
            items.push(
                $('<li></li>').append(
                    $('<strong></strong>').append(
                        $('<span></span>').text(
                            eXeIntefStyle.truncate($('.page-header .page-title').text())
                        )
                    )
                )
            );
            return items;
        }
        var breadcrumb = $('<div id="siteBreadcrumbs"><ul></ul></div>');
        breadcrumb.find('ul').append(getNodeLinks());
        $('.package-header').prepend(breadcrumb).addClass('width-breadcrumbs');
    },
    // Institutional logo band, website only. Trademarks: see config.xml.
    getLogos: function () {
        if (!this.logosIn(window.location.hostname)) return;
        var base = 'theme/img/';
        if ($('html').attr('id') != 'exe-index') base = '../' + base;
        // sm: reduced version, below 640px
        var logos = [
            {
                css: 'mefpd',
                img: 'mefpd.png',
                sm: 'mefpd_sm.png',
                url: 'https://www.educacionfpydeportes.gob.es/',
                alt: 'Ministerio de Educación, Formación Profesional y Deportes',
            },
            {
                css: 'intef',
                img: 'intef.png',
                sm: 'intef_sm.png',
                url: 'https://intef.es/',
                alt: 'INTEF (Instituto Nacional de Tecnologías Educativas y de Formación del Profesorado)',
            },
        ];
        var newWindow = '';
        if (typeof $exe_i18n != 'undefined' && $exe_i18n.newWindow) {
            newWindow = '<span class="sr-av"> (' + $exe_i18n.newWindow + ')</span>';
        }
        var res = '';
        $.each(logos, function (i, logo) {
            var source = '';
            if (logo.sm) {
                source =
                    '<source media="(max-width: 640px)" srcset="' +
                    base +
                    logo.sm +
                    '">';
            }
            res +=
                '<a href="' +
                logo.url +
                '" hreflang="es" class="logo-' +
                logo.css +
                '" target="_blank" rel="noopener"><picture>' +
                source +
                '<img lang="es" src="' +
                base +
                logo.img +
                '" alt="' +
                logo.alt +
                '"></picture>' +
                newWindow +
                '</a>';
        });
        var band = '<div id="siteLogos">' + res + '</div>';
        var skip = $('#skipNav');
        if (skip.length) skip.after(band);
        else $('body').prepend(band);
        $('body').addClass('logos');
    },
    // Package title and subtitle for the top bar
    getTopBarTitle: function () {
        if (!this.topBarTitle) return;
        var tit = $('.package-header .package-title').text();
        if (!tit) return;
        var sub = $('.package-header .package-subtitle').text();
        var box = $('<div id="topBarTitle" aria-hidden="true"></div>');
        $('<p class="top-bar-title"></p>').text(tit).appendTo(box);
        if (sub) $('<p class="top-bar-subtitle"></p>').text(sub).appendTo(box);
        $('.nav-buttons').prepend(box);
    },
    titleLinks: function () {
        if (!$('#siteNav a').length) return;
        var attrs = '';
        if ($('html').attr('id') == 'exe-index') {
            attrs = ' tabindex="-1" aria-current="page"';
        }
        var title = $('.package-header .package-title');
        if (!$('.package-header').hasClass('width-breadcrumbs')) {
            title.wrapInner(
                '<a class="package-title-link" href="#"' + attrs + '></a>'
            );
        }
        $('#topBarTitle .top-bar-title').wrapInner(
            '<a class="package-title-link" href="#" tabindex="-1"></a>'
        );
        this.setTitleLinks();
        $(document).on('mousedown click', '.package-title-link', function () {
            eXeCedecStyle.setTitleLinks();
        });
    },
    // Home href read at click time: teacher params are added after init
    setTitleLinks: function () {
        var href = $('#siteNav a').first().attr('href');
        if (!href) return;
        var nav = $('body').hasClass('siteNav-off') ? 'false' : null;
        $('.package-title-link').attr(
            'href',
            $exeExport.setUrlParam(href, 'nav', nav)
        );
    },
    dropdownMenus: function () {
        if (!this.dropdownNavigation) return;
        this.dropdownMenusWorking = false;
        $('#siteNav ul ul').each(function (i) {
            var elem = $(this);
            this.id = 'child-section-' + i;
            var lnk = elem.prev('a');
            var css = 'closed-ul';
            if (elem.is(':visible')) css = 'open-ul';
            lnk.append(
                '<button type="button" id="child-section-' +
                    i +
                    '-toggler" aria-expanded="' +
                    (css == 'open-ul' ? 'true' : 'false') +
                    '" aria-controls="child-section-' +
                    i +
                    '" title="' +
                    $exe_i18n.more +
                    '" class="' +
                    css +
                    '"><span>' +
                    $exe_i18n.more +
                    '</span></button>'
            );
            $('#child-section-' + i + '-toggler').on('click', function (event) {
                event.preventDefault();
                if (eXeIntefStyle.dropdownMenusWorking == true) return;
                eXeIntefStyle.dropdownMenusWorking = true;
                var id = this.id.replace('-toggler', '');
                var ul = $('#' + id);
                if (ul.is(':visible')) {
                    ul.slideUp('fast', function () {
                        var lnk = $('#' + this.id + '-toggler');
                        lnk.removeClass('open-ul');
                        lnk.addClass('closed-ul');
                        lnk.attr('aria-expanded', 'false');
                        eXeIntefStyle.dropdownMenusWorking = false;
                    });
                } else {
                    ul.slideDown('fast', function () {
                        var lnk = $('#' + this.id + '-toggler');
                        lnk.removeClass('closed-ul');
                        lnk.addClass('open-ul');
                        lnk.attr('aria-expanded', 'true');
                        eXeIntefStyle.dropdownMenusWorking = false;
                    });
                }
            });
        });
    },
    navExpanded: function (visible) {
        $('#siteNavToggler').attr('aria-expanded', visible ? 'true' : 'false');
    },
    // Navigation buttons: nav=false
    params: function (act) {
        var value = act == 'add' ? 'false' : null;
        $('.nav-buttons a').each(function () {
            this.setAttribute(
                'href',
                $exeExport.setUrlParam(this.getAttribute('href'), 'nav', value)
            );
        });
        this.setTitleLinks();
    }
};

$.fn.isInViewport = function () {
    var elementTop = $(this).offset().top;
    var elementBottom = elementTop + $(this).outerHeight();
    var viewportTop = $(window).scrollTop();
    var viewportBottom = viewportTop + $(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};

$(function () {
    eXeIntefStyle.init();
});

// Outside the ready handler: the class must reach <html> before paint.
// <body> does not exist yet here, so init() is what undoes it when needed.
if (eXeIntefStyle.isLocalStorageAvailable()) {
    eXeIntefStyle.darkMode.setMode();
}
