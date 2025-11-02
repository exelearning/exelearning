/**
 * UDL Content iDevice
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Ignacio Gros (http://gros.es/) for Consejería de Educación y Deporte, Junta de Andalucía (https://moocedu.juntadeandalucia.es/)
 * Cofinanced with the European Union FEDER funds.
 *
 * Characters and alternative content icons: Consejería de Educación y Deporte (Junta de Andalucía)
 *
 *
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $udlcontent = {
    // Check if it's working to stop if so
    isWorking: false,

    // Close alt content default button text
    closeBtnTxt: $exe_i18n.hide,

    // Alternative content links position
    altContentLinks: 'bottom', // bottom or top
    // You can also use this in content.css for "top": #UDLcontentIdevicAaltContentLinks{top:0}

    // Get the base path (different in eXe)
    getBase: function () {
        return 'idevices/udl-content/export/';
    },

    // Check if the position of the links is set to top in the Style
    checkAltContentLinksPosition: function () {
        var e = $('#UDLcontentIdevicAaltContentLinks');
        if (e.length > 0) return;
        e = $('<div id="UDLcontentIdevicAaltContentLinks"></div>');
        $('body').append(e);
        if (e.css('top') == '0px') this.altContentLinks = 'top';
        $('#UDLcontentIdevicAaltContentLinks').remove();
    },

    // Go!
    init: function () {
        this.checkAltContentLinksPosition();

        $('.exe-udlContent').each(function () {
            // Add a different CSS class for each content type
            var cont = $('.exe-udlContent', this);
            if (cont.length == 1) {
                var type = 'eng';
                if (cont.hasClass('exe-udlContent-representation'))
                    type = 'rep';
                else if (cont.hasClass('exe-udlContent-expression'))
                    type = 'exp';
                $(this).addClass('udl-contentIdevice-' + type);
            }

            var iDeviceId = $(this).parents('.idevice_node').attr('id');

            if ($udlcontent.altContentLinks == 'bottom')
                $(this).addClass('exe-udlContent-alt-bottom');

            // Get the close button text and remove the buttons
            var cBtn = $('button.exe-udlContent-alt-content-hide', this);
            if (cBtn.length > 0) {
                var cBtnTxt = cBtn.eq(0).text();
                if (cBtnTxt != '') $udlcontent.closeBtnTxt = cBtnTxt;
                cBtn.remove();
            }

            var blocks = $('.exe-udlContent-block', this);

            blocks.each(function (i) {
                var e = $(this);
                // Add an ID to each block
                var blockId = 'exe-udlContent-block-' + iDeviceId + '-' + i;
                e.attr('id', blockId);
                var isFeedback = $(this).hasClass('js-hidden');
                // Add a "Show feedback" button if required
                if (isFeedback) {
                    var h2 = $('.exe-udlContent-header', this);
                    var btnCSS = 'udl-btn';
                    // Check the button type (normal button or character)
                    if (h2.hasClass('exe-udlContent-character-1'))
                        btnCSS = 'udl-character udl-character-1';
                    else if (h2.hasClass('exe-udlContent-character-2'))
                        btnCSS = 'udl-character udl-character-2';
                    else if (h2.hasClass('exe-udlContent-character-3'))
                        btnCSS = 'udl-character udl-character-3';
                    else if (h2.hasClass('exe-udlContent-character-4'))
                        btnCSS = 'udl-character udl-character-4';
                    if (h2.length == 1) {
                        var t = $('h2', h2).html();
                        if (t != '') {
                            // Add the link (button)
                            var p =
                                '<p class="exe-udlContent-block-toggler"><a href="#' +
                                blockId +
                                '" class="' +
                                btnCSS +
                                '" id="' +
                                blockId +
                                '-toggler"><span>' +
                                t +
                                '</span></a></p>';
                            e.before(p);
                        }
                        // Add event
                        $('#' + blockId + '-toggler').click(function () {
                            var ref = $(this).attr('href');
                            if ($udlcontent.isWorking) return false;
                            $udlcontent.isWorking = true;
                            var block = $(ref);
                            if (block.is(':visible')) {
                                block.slideUp(function () {
                                    $udlcontent.isWorking = false;
                                });
                            } else {
                                block.slideDown(function () {
                                    $udlcontent.isWorking = false;
                                    // Resize H5P activities (to review)
                                    var iframes = $('iframe', block);
                                    iframes.each(function () {
                                        if (
                                            this.src &&
                                            (this.src.indexOf(
                                                'https://h5p.org/'
                                            ) == 0 ||
                                                this.src.indexOf(
                                                    '/wp-admin/admin-ajax.php?action=h5p_embed'
                                                ) != -1)
                                        ) {
                                            if (
                                                !this.style ||
                                                !this.style.height ||
                                                this.style.height == ''
                                            ) {
                                                this.src = this.src;
                                            }
                                        }
                                    });
                                });
                            }
                            return false;
                        });
                        // ARIA attributes
                        h2.attr('id', blockId + '-title');
                        e.attr(
                            'aria-labelledby',
                            blockId + '-toggler ' + blockId + '-title'
                        );
                    }
                }

                // Main content (add ID and CSS class)
                var cont = $('.exe-udlContent-content-main', this);
                if (cont.length != 1) return;
                var id = blockId + '-content-main';
                cont.attr('id', id);
                cont.addClass('exe-udlContent-content-block'); // Add a common CSS to the block contents

                // Alternative contents
                var hasExtras = false;
                var alt1 = $('.exe-udlContent-content-simplified', this);
                var alt2 = $('.exe-udlContent-content-audio', this);
                var alt3 = $('.exe-udlContent-content-visual', this);
                if (alt1.length == 1 || alt2.length == 1 || alt3.length == 1)
                    hasExtras = true;
                if (!hasExtras) return;

                // CSS class for blocks with alternative content
                e.addClass('exe-udlContent-block-with-alt');

                // Alternative contents menu
                var nav = '';

                // Simplified text
                nav += $udlcontent.getNavLi(alt1, blockId, 'simplified');

                // Audio
                nav += $udlcontent.getNavLi(alt2, blockId, 'audio');

                // Visual aid
                nav += $udlcontent.getNavLi(alt3, blockId, 'visual');

                if (nav == '') return;

                // Add a Close link
                nav +=
                    '<li class="exe-udlContent-alt-toggler"><a href="#' +
                    blockId +
                    '-content-main" class="exe-udlContent-alt-lnk exe-udlContent-alt-lnk-close" title="' +
                    $udlcontent.closeBtnTxt +
                    '"><span class="sr-av">' +
                    $udlcontent.closeBtnTxt +
                    '</span></a></li>';
                nav =
                    "<ul id='" +
                    blockId +
                    "-content-nav' class='exe-udlContent-content-nav'>" +
                    nav +
                    '</ul>';

                // Add the menu
                e.prepend(nav);
            });

            // Media URL (only visible when printing)
            $('audio,video,iframe', this).each(function () {
                var a = $(this);
                var src = a.attr('src');
                if (src && src != '') {
                    a.before(
                        '<span class="exe-udlContent-url">&lt;' +
                            src +
                            '&gt;</span>'
                    );
                } else {
                    src = $('source', a);
                    if (src.length > 0) {
                        src = src.attr('src');
                        if (src && src != '') {
                            a.before(
                                '<span class="exe-udlContent-url">&lt;' +
                                    src +
                                    '&gt;</span>'
                            );
                        }
                    }
                }
            });
        });

        // Alternative content links events
        $('.exe-udlContent-alt-lnk').each(function () {
            var e = $(this);

            if ($(e).hasClass('exe-udlContent-alt-lnk-close')) {
                // Close link
                e.click(function () {
                    $udlcontent.isWorking = false;
                    $udlcontent.closeAltContents(this);
                    return false;
                });
            } else {
                // Alt content links
                e.click(function () {
                    if ($udlcontent.isWorking) return false;
                    $udlcontent.isWorking = true;

                    var ref = $(this).attr('href');
                    var dest = $(ref);
                    if (dest.is(':visible')) {
                        $udlcontent.isWorking = false;
                        $udlcontent.closeAltContents(this);
                        return false;
                    } else {
                        // Hide all the contents
                        ref = ref.split('-content-');
                        if (ref.length == 2) {
                            ref = ref[0];
                            var block = $(ref);
                            // Hide all the blocks
                            $('.exe-udlContent-content-block', block).hide();
                        }

                        // Show the Close link
                        var ul = e.closest('ul');
                        var closeLnk = $('.exe-udlContent-alt-toggler', ul);
                        var txt = $udlcontent.closeBtnTxt;
                        var lnk = $('.exe-udlContent-alt-close-lnk', dest);
                        if (lnk.length == 1) {
                            lnk = lnk.text();
                            if (lnk != '') {
                                txt = lnk;
                            }
                        }
                        $('a', closeLnk).attr('title', txt);
                        closeLnk.css('visibility', 'visible');

                        // Show the right content
                        dest.fadeIn('fast', function () {
                            $udlcontent.isWorking = false;
                        });
                    }
                    return false;
                });
            }
        });

        // Close alt content link
        $('.exe-udlContent-alt-close-lnk a').click(function () {
            $udlcontent.isWorking = false;
            $udlcontent.closeAltContents(this);
            return false;
        });

        // Add character image
        $('.exe-udlContent-block-toggler a.udl-character').each(function () {
            var c = this.className;
            c = c.split(' ');
            c = c[c.length - 1];
            c = c.replace('udl-character-', '');
            if (c == 1 || c == 2 || c == 3 || c == 4) {
                // Image names (characters)
                var characters = ['', 'MOTUS', 'KARDIA', 'CLAVIS', 'LUMEN'];
                var tmp = '';
                var img = '';
                try {
                    tmp = window.getComputedStyle(this, ':before');
                    if (tmp && tmp.backgroundImage && tmp.backgroundImg != '') {
                        tmp = tmp.backgroundImage;
                        tmp = tmp.split('(');
                        tmp = tmp[tmp.length - 1];
                        tmp = tmp.split(')');
                        tmp = tmp[0];
                        tmp = tmp.replace(/"/g, '');
                        if (tmp != '') img = tmp;
                    }
                } catch (e) {}
                if (img != '') {
                    var ext = img.substr(img.length - 4);
                    if (ext != '.gif') {
                        img =
                            $udlcontent.getBase() +
                            'udl-character-' +
                            c +
                            '.gif';
                    }
                    $(this).prepend(
                        '<img src="' +
                            img +
                            '" alt="' +
                            characters[c] +
                            '" class="udl-character-img" />'
                    );
                }
            }
        });
    },

    // Alternative content link HTML
    getAltLink: function (id, type, tit) {
        return (
            '<li><a href="#' +
            id +
            '" class="exe-udlContent-alt-lnk exe-udlContent-alt-lnk-' +
            type +
            '" title="' +
            tit +
            '" id="' +
            id +
            '-lnk"><span class="sr-av">' +
            tit +
            '</span></a></li>'
        );
    },

    // Close link HTML (hidden, but accessible)
    getCloseAltLink: function (blockId, type, tit) {
        return (
            '<p class="exe-udlContent-alt-close-lnk"><a href="#' +
            blockId +
            '-content-main" title="' +
            $udlcontent.closeBtnTxt +
            '" class="udl-lnk-' +
            type +
            '"><span>' +
            $udlcontent.closeBtnTxt +
            ' (' +
            tit +
            ')</span></a></p>'
        );
    },

    // Get the alternative content link
    getNavLi: function (e, blockId, type) {
        var li = '';
        if (e.length != 1) return li;
        e.addClass('exe-udlContent-content-block'); // Add a common CSS to the block contents
        var h2 = $('.exe-udlContent-alt-content-title h2', e);
        if (h2.length == 1) {
            var tit = h2.text();
            if (tit != '') {
                var id = blockId + '-content-' + type;
                e.attr('id', id);
                li += $udlcontent.getAltLink(id, type, tit);
                h2.after($udlcontent.getCloseAltLink(blockId, type, tit));
                // ARIA attributes
                h2.attr('id', id + '-title');
                e.attr('aria-labelledby', id + '-lnk ' + id + '-title');
            }
        }
        return li;
    },

    // Close all the alternative contents and show the main content
    closeAltContents: function (e) {
        var ref = $(e).attr('href');
        ref = ref.split('-content-');
        if (ref.length == 2) {
            ref = ref[0];
            var block = $(ref);
            // Hide all the blocks
            $('.exe-udlContent-content-block', block).hide();
            // Show the main content
            $('.exe-udlContent-content-main').show();
            // Hide the Close link
            $('.exe-udlContent-alt-toggler', block).css('visibility', 'hidden');
        }
    },
};

$(function () {
    // DOM is loaded
    $udlcontent.init();
});
