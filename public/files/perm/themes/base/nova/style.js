// Pre-paint FOUC guard: this script is loaded in <head> synchronously, so it
// runs before <body> parses. We can't touch document.body yet, but we can put
// the class on <html>; CSS uses `.siteNav-off` (ancestor) so #siteNav, main,
// togglers etc. are styled before they ever paint expanded. sessionStorage is
// canonical; ?nav=false is honored only on the very first visit.
(function () {
    try {
        var s = sessionStorage.getItem('siteNav-off');
        var off = s === '1' || (s === null && window.location.search.indexOf('nav=false') !== -1);
        if (off) document.documentElement.classList.add('siteNav-off');
    } catch (e) {}
})();

var myTheme = {
    dropdownMenusWorking: false,
    init: function () {
        // Common functions
        if (this.inIframe()) $('body').addClass('in-iframe');
        if (!$('body').hasClass('exe-web-site')) return;
        // Add menu and search bar togglers
        var togglers =
            '\
            <button type="button" id="siteNavToggler" class="toggler" title="' +
            $exe_i18n.menu +
            '">\
                <span class="sr-av">' +
            $exe_i18n.menu +
            '</span>\
            </button>\
            <button type="button" id="searchBarTogger" class="toggler" title="' +
            $exe_i18n.search +
            '">\
                <span class="sr-av">' +
            $exe_i18n.search +
            '</span>\
            </button>\
        ';
        $('#siteNav').before(togglers);
        // The pre-paint guard above set .siteNav-off on <html>; mirror it onto
        // <body> for jQuery checks and selectors that target body specifically.
        // Then sync nav-button URLs and persist so sessionStorage is canonical.
        var off = document.documentElement.classList.contains('siteNav-off');
        if (off) {
            $('body').addClass('siteNav-off');
            myTheme.params('add');
        }
        myTheme.persistNavState(off);
        // Menu toggler
        $('#siteNavToggler').on('click', function () {
            if (myTheme.isLowRes()) {
                $('#exe-client-search').hide();
                if ($('body').hasClass('siteNav-off')) {
                    myTheme.setNavOff(false);
                } else if ($('#siteNav').isInViewport()) {
                    myTheme.setNavOff(true);
                    myTheme.params('add');
                }
                return;
            }
            var off = !$('body').hasClass('siteNav-off');
            myTheme.setNavOff(off);
            myTheme.params(off ? 'add' : 'remove');
        });
        // Search bar toggler — preserve sidebar state
        $('#searchBarTogger').on('click', function () {
            var bar = $('#exe-client-search');
            if (bar.is(':visible')) {
                bar.hide();
                return;
            }
            bar.show();
            $('#exe-client-search-text').focus();
        });
        // Fixed navigation
        $('#siteNav').wrap('<div id="sidebar-nav"></div>');
        myTheme.checkNav();
        $(window).bind('resize', function () {
            myTheme.checkNav();
        });
        // Search form
        this.searchForm();

        // mover .page-title dentro de .page-content
        this.movePageTitle();

        // Collapsible submenus
        this.dropdownMenus();
    },
    setNavOff: function (off) {
        document.documentElement.classList.toggle('siteNav-off', off);
        $('body').toggleClass('siteNav-off', off);
        myTheme.persistNavState(off);
    },
    persistNavState: function (off) {
        try {
            sessionStorage.setItem('siteNav-off', off ? '1' : '0');
        } catch (e) {}
    },
    dropdownMenus: function () {
        $('#siteNav ul ul').each(function (i) {
            var elem = $(this);
            this.id = 'child-section-' + i;
            var lnk = elem.prev('a');
            var css = elem.is(':visible') ? 'open-ul' : 'closed-ul';
            lnk.append(
                '<button type="button" id="child-section-' +
                    i +
                    '-toggler" title="' +
                    $exe_i18n.more +
                    '" class="' +
                    css +
                    '"><span class="sr-av">' +
                    $exe_i18n.more +
                    '</span></button>'
            );
            $('#child-section-' + i + '-toggler').on('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                if (myTheme.dropdownMenusWorking) return;
                myTheme.dropdownMenusWorking = true;
                var btn = $(this);
                var ul = $('#' + this.id.replace('-toggler', ''));
                if (ul.is(':visible')) {
                    ul.slideUp('fast', function () {
                        btn.removeClass('open-ul').addClass('closed-ul');
                        myTheme.dropdownMenusWorking = false;
                    });
                } else {
                    ul.slideDown('fast', function () {
                        btn.removeClass('closed-ul').addClass('open-ul');
                        myTheme.dropdownMenusWorking = false;
                    });
                }
            });
        });
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
            myTheme.param(this, act);
        });
    },

    // function that move the h2 outside the header
    movePageTitle: function () {
        const tryMove = () => {
            const $header = $('.main-header .page-header');
            const $title = $header.find('.page-title').first();

            // Search container of content
            let $content = $('.page-content').first();
            if (!$content.length)
                $content = $('.content, main .content').first();
            if (!$content.length) $content = $('#main, #content').first();
            if (!$content.length && $header.length)
                $content = $header.nextAll(':not(header)').first();
            if (!$content.length && $header.length) $content = $header.parent();

            if ($header.length && $title.length && $content.length) {
                $content.prepend($title); // move it to the start
                return true;
            }
            return false;
        };

        if (tryMove()) return;

        const observer = new MutationObserver(() => {
            if (tryMove()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    },
    // 🔼
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
