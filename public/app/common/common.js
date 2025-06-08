/*! ===========================================================================
    eXe
    Copyright 2004-2005, University of Auckland
    Copyright 2004-2008 eXe Project, http://eXeLearning.org/

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.    See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA    02111-1307    USA
    ===========================================================================

    ClozelangElement's functions by José Ramón Jiménez Reyes
    More than one right answer in the Cloze iDevice by José Miguel Andonegi
    2015. Refactored and completed by Ignacio Gros (http://www.gros.es) for http://exelearning.net/
*/

/* To review (see #266)
if (typeof ($exe_i18n) == 'undefined') {
    var $exe_i18n = {
        previous: "Previous",
        next: "Next",
        show: "Show",
        hide: "Hide",
        showFeedback: "Show Feedback",
        hideFeedback: "Hide Feedback",
        correct: "Correct",
        incorrect: "Incorrect",
        menu: "Menu",
        download: "Download",
        yourScoreIs: "Your score is ",
        dataError: "Error recovering data",
        epubJSerror: "This might not work in this ePub reader.",
        solution: "Solution",
        epubDisabled: "This activity does not work in ePub.",
        print: "Print"
    }
}
*/

var $exe = {

    options: {
        // Accessibility toolbar
        atools: {
            modeToggler: false,
            translator: false,
            i18n: {}
        }
    },

    // Called right after the <body> tag
    /* To do
    setBodyClass: function(){
        var c=" js";
        var b = $("body");
        if(b.hasClass("exe-atools")&&typeof(localStorage)=='object'){
            var x=localStorage.getItem('exeAtoolsMode');
            if(x&&x=="dark") c+=" exe-atools-dm"};
        document.body.className+=c;
    },
    */

    init: function () {
        var bod = $('body');
        $exe.addRoles();
        if (!bod.hasClass("exe-single-page")) {
            var t = $exe.isIE();
            if (t) {
                if (t > 7) $exe.iDeviceToggler.init()
            } else $exe.iDeviceToggler.init()
        }
        this.hasMultimediaGalleries = false;
        this.setMultimediaGalleries();
        this.setModalWindowContentSize(); // To review
        // No MediaElement in ePub3
        if (!bod.hasClass("exe-epub3")) {
            var n = document.body.innerHTML;
            if (this.hasMultimediaGalleries || $(".mediaelement").length > 0) {
                $exe.loadMediaPlayer.init();
            }
        } else {
            // No inline SCRIPT tags in ePub (due to Chrome app Content Security Policy)
            bod.addClass("js");
        }
        $exe.hint.init();
        $exe.setIframesProperties();
        $exe.hasTooltips();
        $exe.hasExeNodeLinks();
        $exe.math.init();
        $exe.dl.init();
        // Add a zoom icon to the images using CSS
        $("a.exe-enlarge").each(function (i) {
            var e = $(this);
            var c = $(this).children();
            if (c.length == 1 && c.eq(0).prop("tagName") == "IMG") {
                e.prepend('<span class="exe-enlarge-icon"><b></b></span>');
            }
        });
        $exe.sfHover();
        // Disable autocomplete
        $("INPUT.autocomplete-off").attr("autocomplete", "off");

        // No inline JavaScript (see issue #258)
        // Common feedback
        $('.feedbackbutton.feedback-toggler').click(function () {
            var changeText = false;
            if (this.value == $exe_i18n.showFeedback || this.value == $exe_i18n.hideFeedback) changeText = true;
            $exe.toggleFeedback(this, changeText);
        });

        // Text and Tasks
        $(".textIdevice,.pblIdevice").each(function (i) {

            // Feedback toggler
            $(".feedbackbutton", this).each(function () {
                var buttonTxt = this.value.split("|");
                // The button might have 2 texts (Show|Hide)
                if (buttonTxt.length == 2) {
                    // Remove spaces before and after the text
                    buttonTxt = [
                        $.trim(buttonTxt[0]),
                        $.trim(buttonTxt[1])
                    ]
                    this.value = buttonTxt[0];
                    window['$exeTextIdeviceButtonText' + i] = buttonTxt;
                }
                $(this).click(function () {
                    var feedback = $(this).parent().next('.feedback');
                    var hasCustomText = typeof (window['$exeTextIdeviceButtonText' + i]) != 'undefined';
                    if (feedback.is(":visible")) {
                        if (hasCustomText) this.value = window['$exeTextIdeviceButtonText' + i][0];
                        feedback.slideUp();
                    } else {
                        if (hasCustomText) this.value = window['$exeTextIdeviceButtonText' + i][1];
                        feedback.slideDown();
                    }
                    return false;
                });
            });

            // Task iDevice: Fade in each DL
            $(".pbl-task-info", this).delay(1500).css({
                "opacity": 0,
                "visibility": "visible"
            }).fadeTo("slow", 1).each(function () {
                var dts = $("dt", this);
                // Set the DT width so the text can be properly aligned
                var tA = $(this).css("text-align");
                if (tA == "right") {
                    var width = 0;
                    dts.css("width", "auto").each(function () {
                        var w = $(this).width();
                        if (w > width) width = w;
                    });
                    if (width != 0) {
                        dts.css("width", width + "px");
                        $("dd", this).css("margin-left", width + "px");
                    }
                } else if (tA == "left") {
                    var width = 0;
                    dts.css("width", "auto").each(function () {
                        $(this).next("dd").css("margin-left", $(this).width() + "px");
                    });
                }
                // Add a title (just in case the Style displays an icon instead of the text)
                dts.each(function () {
                    $("span", this).attr("title", $(this).text());
                });
            });

        });

        // Cloze iDevice
        $('.cloze-feedback-toggler').click(function () {
            var e = $(this);
            var id = e.attr('name').replace('feedback', '');
            $exe.cloze.toggleFeedback(id, this);
        });
        $('.cloze-score-toggler').click(function () {
            var e = $(this);
            var id = e.attr('name').replace('getScore', '');
            $exe.cloze.showScore(id, 1);
        });
        $('form.cloze-form').submit(function () {
            var e = $(this);
            var id = e.attr('name').replace('cloze-form-', '');
            try {
                $exe.cloze.showScore(id, 1);
            } catch (e) {
                // Due to G. Chrome's Content Security Policy ('unsafe-eval' is not allowed)
                var txt = $exe_i18n.dataError;
                if ($('body').hasClass('exe-epub3')) txt += '<br /><br />' + $exe_i18n.epubJSerror;
                $("#clozeScore" + id).html(txt);
            }
            return false;
        });

        // SCORM Quiz iDevice
        $('form.quiz-test-form').submit(function () {
            try {
                calcScore2();
            } catch (e) {
                // Due to G. Chrome's Content Security Policy ('unsafe-eval' is not allowed)
                var txt = $exe_i18n.dataError;
                if ($('body').hasClass('exe-epub3')) txt += '<br /><br />' + $exe_i18n.epubJSerror;
                $('form.quiz-test-form input[type=submit]').hide().before(txt);
            }
            return false;
        });

        // Multi-choice iDevice and True-False Question
        $('.exe-radio-option').change(function () {
            var c = this.className.split(" ");
            if (c.length != 2) return;
            c = c[1];
            c = c.replace("exe-radio-option-", "");
            c = c.split("-");
            if (c.length != 4) return;
            $exe.getFeedback(c[0], c[1], c[2], c[3]);
        });

        // Multi-select iDevice
        $('form.multi-select-form').submit(function () {
            return false;
        });
        $('.multi-select-feedback-toggler').click(function () {
            var i = this.id.replace("multi-select-feedback-toggler-", "");
            i = i.split("-");
            if (i.length != 2) return;
            $exe.showFeedback(this, i[0], i[1]);
        });

        // Cloze Activity iDevice
        $('form.cloze-activity-form').submit(function () {
            try {
                var e = $(this);
                var id = e.attr('name').replace('cloze-form-', '');
                $exe.cloze.submit(id);
            } catch (e) {
                // Due to G. Chrome's Content Security Policy
                var txt = $exe_i18n.dataError;
                if ($('body').hasClass('exe-epub3')) txt += '<br /><br />' + $exe_i18n.epubJSerror;
                if ($exe.cloze.hasBeenTested == false) {
                    $exe.cloze.hasBeenTested = true;
                    $('form.cloze-activity-form input[type=submit]').hide().before(txt);
                }
            }
            return false;
        });

        // Search form
        if (window.DOMParser) this.clientSearch.init(bod); // IE8- do not support the DOMParser object

    },

    // Search engine in exports
    clientSearch: {

        init: function (bod) {
            // Search form
            if (bod.hasClass("exe-web-site") && bod.hasClass("exe-search-bar")) {
                $.ajax({
                    type: "GET",
                    url: "contentv3.xml",
                    dataType: "xml",
                    success: function (xml) {
                        $exe.clientSearch.main = $("#main");
                        $exe.contentv3 = xml;
                        var sF = '<div id="exe-client-search">\
                            <form id="exe-client-search-form" action="#" method="GET">\
                                <p><label for="exe-client-search-text" class="sr-av">'+ $exe_i18n.fullSearch + ': </label><input type="text" id="exe-client-search-text" /> \
                                <input type="submit" id="exe-client-search-submit" value="'+ $exe_i18n.search + '" />\
                                <a href="#main" id="exe-client-search-reset" title="'+ $exe_i18n.hideResults + '"><span>' + $exe_i18n.hideResults + '</span></a></p>\
                            </form>\
                        </div>\
                        <div id="exe-client-search-results"></div>';
                        $exe.clientSearch.main.prepend(sF);
                        $("#exe-client-search-form").submit(function () {
                            $exe.clientSearch.search($("#exe-client-search-text").val());
                            return false;
                        });
                        $("#exe-client-search-text").prop("placeholder", $exe_i18n.fullSearch + "...");
                        $("#exe-client-search-reset").click(function () {
                            $("#exe-client-search-text").val("")
                            $exe.clientSearch.search("");
                            return false;
                        });
                        $exe.clientSearch.results = $("#exe-client-search-results");
                        $exe.clientSearch.results.css("min-height", $exe.clientSearch.main.height() + "px");
                        $("#skipNav").append(' <a href="#exe-client-search-text" id="exe-client-search-lnk" class="sr-av">' + $exe_i18n.fullSearch + '</a>');
                        $("#exe-client-search-lnk").click(function () {
                            $("#exe-client-search-text").focus();
                            return false;
                        });
                    },
                    error: function () {

                    }
                });
            }
        },

        strip: function (html) {
            html = html.trim();
            var splitter = "~exe-activity-results~: ";
            // Check if it's an activity with results (#468)
            if (html.indexOf('<div class="adivina-IDevice') == 0 || html.indexOf('<div class="quext-IDevice') == 0 || html.indexOf('<div class="rosco-IDevice') == 0 || html.indexOf('<div class="vquext-IDevice') == 0) {
                html = html.replace('{', splitter + '{');
            } else if (html.indexOf('<div class="exe-interactive-video') == 0) {
                html = splitter + html;
            } else if (html.indexOf('<div class="exe-sortableList') == 0) {
                html = html.replace('<ul', splitter + '<ul');
            } else if (html.indexOf('<u>') != -1) {
                // Dropdown activity, etc.
                html = html.replace('<u>', '...' + splitter + '<u>');
            }
            var regex = /(<([^>]+)>)/ig
            html = html.replace(regex, "");
            html = html.replace(/</g, "&lt;");
            html = html.replace(/>/g, "&gt;");
            return html;
        },

        getNodeHTML: function (nodeNo, sTitle, query, html) {
            query = query.toLowerCase();
            // Create a tmp wprapper
            var div = $("<div />");
            // Fill it
            div.html(html);
            // Remove the nested nodes (children nodes)
            $("instance", div).each(function () {
                if ($(this).attr("class") == "exe.engine.node.Node" || $(this).attr("class") == "exe.engine.notaidevice.NotaIdevice") {
                    $(this).remove();
                }
            });
            // Get the content of those iDevices
            var res = "";
            var currHTML;
            var as = $("#siteNav a");
            var currTit = sTitle.toLowerCase();
            div.find('unicode').each(function () {
                if ($(this).attr("content") == "true") {
                    currHTML = $(this).attr("value");
                    if (typeof currHTML == 'string') currHTML = $exe.clientSearch.strip(currHTML);
                    if (currTit.indexOf(query) != -1 || currHTML.toLowerCase().indexOf(query) != -1) {
                        var a = as.eq(nodeNo);
                        // Test. Find a siteNav href by Title instead of nodeNo in case the titles do not match
                        a_by_title = $("#siteNav a:contains('" + sTitle + "')")
                        if (a.html() != sTitle && a_by_title) {
                            a = a_by_title;
                        }
                        if (a.length == 1) {
                            // Remove the results from the visible text (#468)
                            currHTML = currHTML.split("~exe-activity-results~: ");
                            currHTML = currHTML[0];
                            if (currHTML == "") currHTML = "...";
                            else res += '<li><strong><a href="' + a.attr("href") + '" \
                            class="exe-client-search-result-link">'+ sTitle + '</a> &rarr; </strong>\
                            <span class="exe-client-search-result-detail">'+ currHTML + "</span></li>";
                        }
                    }
                }
            });

            return res;
        },

        splitByWords: function (text, startFrom, lengthFrom) {
            var len = text.length,
                re = /[ ,.]/, // Search any of those characters
                fr = (startFrom <= 0) ? 0 : text.substr(startFrom).search(re) + startFrom + 1,
                to = (lengthFrom >= len) ? len : text.substr(lengthFrom).search(re) + lengthFrom;
            // If we don't find any character
            if (fr === -1) fr = 0;
            if (to === (lengthFrom - 1)) to = len;

            return text.substr(fr, to);
        },

        search: function (query) {
            if (query.length < 3) {
                $("body").removeClass("exe-client-search-results");
                return;
            }
            var xml = $exe.contentv3;
            var nodeNo = 0;
            $("body").addClass("exe-client-search-results");
            $exe.clientSearch.results.html("");
            var results = "";
            $(xml).find('instance').each(function () {
                if ($(this).attr("class") == "exe.engine.node.Node") {
                    var currentNode = $(this);
                    // Get the node title and HTML
                    var sTitle = currentNode.find('unicode').eq(0).attr("value");
                    // Get the content
                    var str = "";
                    try {
                        // This won't work in some old browsers (not even in IE11)
                        str = currentNode.html();
                    } catch (e) {
                        var s = new XMLSerializer();
                        var d = this;
                        str = s.serializeToString(d);
                        var tmp = $("<div></div>");
                        tmp.html(str);
                        var html = $("instance", tmp).eq(0).html();
                        str = html;
                    }
                    results += $exe.clientSearch.getNodeHTML(nodeNo, sTitle, query, str.replace(/script/g, "script_"));
                    nodeNo++;
                }
            });
            if (results != "") {
                results = '<p>' + $exe_i18n.searchResults.replace("%", "<strong>" + query + "</strong>") + ':</p><ul>' + results + '</ul>';
                $exe.clientSearch.results.html(results);
                // Underline the search text in the title
                $(".exe-client-search-result-link", $exe.clientSearch.results).html(function (_, html) {
                    html = html.replace(/script_/g, "script");
                    var re = new RegExp('(' + query + ')', "gi");
                    return html.replace(re, '<mark class="exe-client-search-result">$1</mark>');
                });
                $(".exe-client-search-result-detail", $exe.clientSearch.results).each(function (i) {
                    // Add a "Read more" link if needed
                    var max = 200;
                    var c = $(this).text();
                    c = $exe.clientSearch.strip(c); // This will prevent some JavaScript code to be executed
                    var n = "";
                    if (c.length > (max + 100)) {
                        var start = $exe.clientSearch.splitByWords(c, 0, max);
                        var end = c.replace(start, " ");
                        n += start;
                        n += '<a href="#exe-client-search-text-' + i + '" title="' + $exe_i18n.more + '" class="exe-client-search-read-more">[&hellip;]</a>';
                        n += '<span class="js-hidden" id="exe-client-search-text-' + i + '">';
                        n += end;
                        n += '</span>';
                        this.innerHTML = n;
                    }
                    // Underline the search text in the HTML
                    $(this).html(function (_, html) {
                        html = html.replace(/script_/g, "script");
                        var re = new RegExp('(' + query + ')', "gi");
                        return html.replace(re, '<mark class="exe-client-search-result">$1</mark>');
                    });
                });
                // Make the "Read more" link work
                $(".exe-client-search-read-more").click(function () {
                    var e = $(this);
                    $(e.attr("href")).fadeIn();
                    e.remove();
                    return false;
                });
            } else {
                // No results for that search
                $exe.clientSearch.results.html('<p>' + $exe_i18n.noSearchResults.replace("%", "<strong>" + query + "</strong>") + '</p>')
            }
        }

    },

    // Modal Window: Height problem in some browsers #328
    setModalWindowContentSize: function () {
        if (window.chrome) {
            $(".exe-dialog-text img").each(
                function () {
                    var e = $(this);
                    var h = e.attr("height");
                    var w = e.attr("width");
                    if (e.height() == 0 && e.css("height") == "0px" && h && w) {
                        if (!isNaN(h) && h > 0 && !isNaN(w) && w > 0) {
                            var maxW = 480;
                            if (w < maxW) maxW = w;
                            h = Math.round(maxW * h / w);
                            e.css("height", h + "px");
                        }
                    }
                }
            );
        }
    },

    // Transform links to audios or videos (with rel^='lightbox') in links to inline content
    // (see prettyPhoto documentation)
    setMultimediaGalleries: function () {
        if (typeof ($.prettyPhoto) != 'undefined') {
            var lightboxLinks = $("a[rel^='lightbox']");
            lightboxLinks.each(function (i) {
                var ref = $(this).attr("href");
                var _ref = ref.toLowerCase();
                var isAudio = _ref.indexOf(".mp3") != -1;
                var isVideo = _ref.indexOf(".mp4") != -1 || _ref.indexOf(".flv") != -1 || _ref.indexOf(".ogg") != -1 || _ref.indexOf(".ogv") != -1;
                if (isAudio || isVideo) {
                    var id = "media-box-" + i;
                    $(this).attr("href", "#" + id);
                    var hiddenPlayer = $('<div class="exe-media-box js-hidden" id="' + id + '"></div>');
                    if (isAudio) hiddenPlayer.html('<div class="exe-media-audio-box"><audio controls="controls" src="' + ref + '" class="exe-media-box-element exe-media-box-audio"><a href="' + ref + '">audio/mpeg</a></audio></div>');
                    else hiddenPlayer.html('<div class="exe-media-video-box"><video width="480" height="385" controls="controls" class="exe-media-box-element"><source src="' + ref + '" /></video></div>');
                    $("body").append(hiddenPlayer);
                    $exe.hasMultimediaGalleries = true;
                }
                // Inline content title
                var t = this.title;
                if (ref.indexOf('#') == 0 && $(ref).length == 1 && t && t != "") $(ref).prepend('<h2 class="pp_title">' + t + '</h2>');
            });
            lightboxLinks.prettyPhoto({
                social_tools: "",
                deeplinking: false,
                opacity: 0.85,
                changepicturecallback: function () {
                    var block = $("#pp_full_res")
                    var media = $(".exe-media-box-element", block);
                    if ($exe.loadMediaPlayer != undefined) {
                        if ($exe.loadMediaPlayer.isReady) {
                            if (media.length == 1) media.mediaelementplayer();
                            $exe.loadMediaPlayer.isCalledInBox = true;
                        }
                    }
                    // Add a download link and a CSS class to pp_content_container (see exe_lightbox.css)
                    var cont = $(".pp_content_container");
                    cont.attr("class", "pp_content_container");
                    if (media.length == 1 && media[0].hasAttribute('src')) {
                        if (media.hasClass("exe-media-box-audio")) cont.attr("class", "pp_content_container with-audio");
                        var src = media.attr('src');
                        var ext = src.split("/");
                        ext = ext[ext.length - 1];
                        ext = ext.split(".")[1];
                        $(".pp_details .pp_description").append(' <span class="exe-media-download"><a href="' + src + '" title="' + $exe_i18n.download + '" download>' + ext + '</a></span>');
                    } else {
                        // Hide the title at the bottom (we use h2.pp_title instead)
                        block = $(".pp_inline", block);
                        if (block.length == 1) $(".pp_description").hide();
                    }
                }
            });
            // If there are galleries, but lightboxLinks.length==0, there's an error
            // No links with the rel attribute were selected
            // This might happen in some ePub readers
            // See issue #258
            var eXeGalleries = $('.GalleryIdevice');
            if (lightboxLinks.length == 0 && eXeGalleries.length > 0 && typeof (exe_editor_mode) == "undefined") {
                // We execute this code only outside eXe or the Image Gallary edition will fail (see issue #317)
                $('.exeImageGallery a').each(function () {
                    this.title += " ~ [" + this.href + "]";
                    this.href = "#";
                    this.onclick = function () {
                        var ul = $(this).parent().parent();
                        if (ul.length == 1 && ul.attr('id') != "") {
                            if ($("#" + ul.attr('id') + "-warning").length == 0) {
                                // Due to G. Chrome's Content Security Policy
                                var txt = $exe_i18n.dataError;
                                if ($('body').hasClass('exe-epub3')) txt += '<br /><br />' + $exe_i18n.epubJSerror;
                                ul.prepend('<div id="' + ul.attr('id') + '-warning">' + txt + '</div>');
                            }
                        }
                    }
                });
            }
        }
    },

    // Load MediaElement if required
    loadMediaPlayer: {
        isCalledInBox: false, // Box = prettyPhoto with video or audio
        isReady: false,
        /*
        getPlayer: function() {
            $exe.mediaelements = $(".mediaelement");
            $exe.mediaelements.each(function() {
                if (typeof this.localName != "undefined" && this.localName == "video") {
                    var e = this.width;
                    var t = $(window).width();
                    if (e > t) {
                        var n = t - 20;
                        var r = parseInt(this.height * n / e);
                        this.width = n;
                        this.height = r
                    }
                }
            }).hide();
            var e = "exe_media.js";
            if (typeof eXe != "undefined") {
                e = "../scripts/mediaelement/" + e
            }
            // Load the JS file and then load the CSS
            $exe.loadScript(e, "$exe.loadMediaPlayer.getCSS()")
        },
        // Load the CSS file and start MediaElement
        getCSS: function() {
            var e = "exe_media.css";
            if (typeof eXe != "undefined") {
                e = "../scripts/mediaelement/" + e
            }
            $exe.loadScript(e, "$exe.loadMediaPlayer.init()")
        },
        */
        // Start MediaElement
        init: function () {
            // Multimedia galleries
            $exe.mediaelements = $(".mediaelement");
            $exe.mediaelements.each(function () {
                if (typeof this.localName != "undefined" && this.localName == "video") {
                    var e = this.width;
                    var t = $(window).width();
                    if (e > t) {
                        var n = t - 20;
                        var r = parseInt(this.height * n / e);
                        this.width = n;
                        this.height = r
                    }
                }
                $(this).mediaelementplayer();
            });
            $exe.loadMediaPlayer.isReady = true;
            if (!$exe.loadMediaPlayer.isCalledInBox) $("#pp_full_res .exe-media-box-element").mediaelementplayer();
        }
    },

    // Apply the 'sfhover' class to li elements when they are 'moused over'
    // Old browsers need this because they don't support li:hover
    sfHover: function () {
        var e = document.getElementById("siteNav");
        if (e) {
            var t = e.getElementsByTagName("LI");
            for (var n = 0; n < t.length; n++) {
                t[n].onmouseover = function () {
                    this.className = this.className.replace(new RegExp("( ?|^)sfout\\b"), "");
                    this.className += (this.className.length > 0 ? " " : "") + "sfhover";
                };
                t[n].onmouseout = function () {
                    this.className = this.className.replace(new RegExp("( ?|^)sfhover\\b"), "");
                    this.className += (this.className.length > 0 ? " " : "") + "sfout";
                }
            }
            // Enable Keyboard:
            var r = e.getElementsByTagName("A");
            for (var n = 0; n < r.length; n++) {
                r[n].onfocus = function () {
                    this.className += (this.className.length > 0 ? " " : "") + "sffocus";
                    this.parentNode.className += (this.parentNode.className.length > 0 ? " " : "") + "sfhover";
                    if (this.parentNode.parentNode.parentNode.nodeName == "LI") {
                        this.parentNode.parentNode.parentNode.className += (this.parentNode.parentNode.parentNode.className.length > 0 ? " " : "") + "sfhover";
                        if (this.parentNode.parentNode.parentNode.parentNode.parentNode.nodeName == "LI") {
                            this.parentNode.parentNode.parentNode.parentNode.parentNode.className += (this.parentNode.parentNode.parentNode.parentNode.parentNode.className.length > 0 ? " " : "") + "sfhover"
                        }
                    }
                };
                r[n].onblur = function () {
                    this.className = this.className.replace(new RegExp("( ?|^)sffocus\\b"), "");
                    this.parentNode.className = this.parentNode.className.replace(new RegExp("( ?|^)sfhover\\b"), "");
                    if (this.parentNode.parentNode.parentNode.nodeName == "LI") {
                        this.parentNode.parentNode.parentNode.className = this.parentNode.parentNode.parentNode.className.replace(new RegExp("( ?|^)sfhover\\b"), "");
                        if (this.parentNode.parentNode.parentNode.parentNode.parentNode.nodeName == "LI") {
                            this.parentNode.parentNode.parentNode.parentNode.parentNode.className = this.parentNode.parentNode.parentNode.parentNode.parentNode.className.replace(new RegExp("( ?|^)sfhover\\b"), "")
                        }
                    }
                }
            }
        }
    },

    mediaReplace: function () {
        // Quicktime and Real Media for IE
        if (navigator.appName == "Microsoft Internet Explorer") {
            var e = document.getElementsByTagName("OBJECT");
            var t = e.length;
            while (t--) {
                if (e[t].type == "video/quicktime" || e[t].type == "audio/x-pn-realaudio-plugin") {
                    if (typeof e.classid == "undefined") {
                        e[t].style.display = "none";
                        var n = "02BF25D5-8C17-4B23-BC80-D3488ABDDC6B";
                        if (e[t].type == "audio/x-pn-realaudio-plugin") n = "CFCDAA03-8BE4-11CF-B84B-0020AFBBCCFA";
                        var r = e[t].height;
                        var i = e[t].width;
                        var s = e[t].data;
                        var o = document.createElement("DIV");
                        o.innerHTML = '<object classid="clsid:' + n + '" data="' + s + '" width="' + i + '" height="' + r + '"><param name="controller" value="true" /><param name="src" value="' + s + '" /><param name="autoplay" value="false" /></object>';
                        e[t].parentNode.insertBefore(o, e[t])
                    }
                }
            }
        } else if (document.body.className.indexOf("exe-epub3") == 0) {
            // Replace OBJECT with VIDEO and AUDIO in ePub
            $("object").each(function () {
                var e = $(this);
                var p = e.attr("data"); // Player
                var w, h, f; // Width, Height, File
                var v = $("param[name=flv_src]", e);
                if (p == "flowPlayer.swf" && v.length == 1) {
                    w = this.width || 320;
                    h = this.height || 240;
                    f = v.attr("value");
                    e.before('<video width="' + w + '" height="' + h + '" src="' + f + '" controls="controls"><a href="' + f + '">' + f + '</a></video>').remove()
                } else if (p.indexOf("xspf_player.swf?song_url=") == 0) {
                    f = p.replace("xspf_player.swf?song_url=", "");
                    f = f.split("&")[0];
                    e.before('<audio width="300" height="32" src="' + f + '" controls="controls"><a href="' + f + '">' + f + '</a></audio>').remove()
                }
            });
        }
    },

    // RGB color to HEX
    rgb2hex: function (a) {
        if (/^#[0-9A-F]{6}$/i.test(a)) return a;
        a = a.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);

        function hex(x) {
            return ("0" + parseInt(x).toString(16)).slice(-2)
        }
        return "#" + hex(a[1]) + hex(a[2]) + hex(a[3])
    },

    // Use black or white text depending on the background color
    useBlackOrWhite: function (h) {
        var r = parseInt(h.substr(0, 2), 16);
        var g = parseInt(h.substr(2, 2), 16);
        var b = parseInt(h.substr(4, 2), 16);
        var y = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (y >= 128) ? 'black' : 'white'
    },

    // Definition lists with improved presentation
    dl: {
        init: function () {
            var l = $("dl.exe-dl");
            if (l.length == 0) return false;
            var h, e, t, bg, tc, s, id;
            l.each(function (i) {
                e = this;
                bg = $exe.rgb2hex($(e).css("color"));
                tc = $exe.useBlackOrWhite(bg.replace("#", ""));
                s = " style='text-decoration:none;background:" + bg + ";color:" + tc + "'";
                if (e.id == "") e.id = "exe-dl-" + i;
                id = e.id;
                $("dt", e).each(function () {
                    t = this;
                    h = $(t).html();
                    $(t).html("<a href='#' class='exe-dd-toggler exe-dd-toggler-closed exe-dl-" + i + "-a'><span class='icon'" + s + ">+ </span>" + h + "</a>")
                });
            });
            $('a.exe-dd-toggler').click(function () {
                var e = $(this);
                var s = $("span.icon", this);
                var dd = $(this).parent().next("dd");
                if (e.hasClass("exe-dd-toggler-closed")) {
                    e.removeClass("exe-dd-toggler-closed");
                    s.html("- ");
                    dd.show();
                } else {
                    e.addClass("exe-dd-toggler-closed");
                    s.html("+ ");
                    dd.hide();
                }
                return false;
            });
        }
    },

    // If the page has tooltips we load the JS file
    hasTooltips: function () {
        // if (!this.isInExe()) return;

        if ($("A.exe-tooltip").length > 0) {
            var p = "";
            if (typeof (eXeLearning) !== 'undefined') {
                p = eXeLearning.symfony.fullURL + "/app/common/exe_tooltips/";
            } else {
                var ref = window.location.href;
                // Check if it's the home page
                p = "libs/exe_tooltips/";
                if (!document.getElementById("exe-index")) p = "../" + p;
            }
            $exe.loadScript(p + "exe_tooltips.js", "$exe.tooltips.init('" + p + "')")
        }
    },

    // Math options (MathJax, etc.)
    math: {
        // Change this from your Style or your elp using $exe.math.engine="..."
        engine: $("html").prop("id") == "exe-index" ? "./libs/exe_math/tex-mml-svg.js" : "../libs/exe_math/tex-mml-svg.js",
        // Create links to the code and the image (different possibilities)
        createLinks: function (math) {
            var mathjax = false;
            if (!math) {
                var math = $(".exe-math");
                mathjax = true;
            }
            math.each(function () {
                var e = $(this);
                if ($(".exe-math-links", e).length > 0) return;
                var img = $(".exe-math-img img", e);
                var txt = "LaTeX";
                if (e.html().indexOf("<math") != -1) txt = "MathML";
                var html = '';
                if (img.length == 1) html += '<a href="' + img.attr("src") + '" target="_blank">GIF</a>';
                if (!mathjax) {
                    if (html != "") html += '<span> - </span>';
                    html += '<a href="#" class="exe-math-code-lnk">' + txt + '</a>';
                }
                if (html != "") {
                    html = '<p class="exe-math-links">' + html + '</p>';
                    e.append(html);
                }
                $(".exe-math-code-lnk").click(function () {
                    $exe.math.showCode(this);
                    return false;
                });
            });
        },

        // Open a new window with the LaTeX or MathML code
        showCode: function (e) {
            var tit = e.innerHTML;
            var block = $(e).parent().parent();
            var code = $(".exe-math-code", block);
            var a = window.open(tit);
            a.document.open("text/html");
            var html = '<!DOCTYPE html><html><head><title>' + tit + '</title>';
            html += '<style type="text/css">body{font:10pt/1.5 Verdana,Arial,Helvetica,sans-serif;margin:10pt;padding:0}</style>';
            html += '</head><body><pre><code>';
            html += code.html();
            html += '</code></pre></body></html>';
            a.document.write(html);
            a.document.close();
        },
        // Load MathJax or just create the links to the code and/or image
        init: function () {
            $("body").addClass("exe-auto-math");
            var math = $(".exe-math");
            var mathjax = false;
            if (math.length > 0 || $("body").hasClass("exe-auto-math")) {
                if ($("body").hasClass("exe-auto-math")) {
                    var hasLatex = /(?:\\\(|\\\[|\\begin\{.*?})/.test($('body').html());
                    if (hasLatex) mathjax = true;
                }
                math.each(function () {
                    var e = $(this);
                    if (e.hasClass("exe-math-engine")) {
                        mathjax = true;
                    }
                });
                if (mathjax) {
                    math.each(function () {
                        var isInline = false;
                        var codeW = $(".exe-math-code", this);
                        var code = codeW.html().trim();
                        if (code.indexOf("\\(") == 0 || (code.indexOf("$") == 0 && code.indexOf("$$") != 0)) isInline = true;
                        if (isInline) $(this).addClass("exe-math-inline");
                        if (code.indexOf("<math") == -1) {
                            if (isInline) {
                                if (code.indexOf("$") == 0 && code.substr(code.length - 1) == "$") {
                                    // $x$ is valid inline
                                } else {
                                    if (code.indexOf("\\(") != 0 && code.substr(code.length - 2) != "\\)") {
                                        // Wrap the code: \( ... \)
                                        codeW.html("\\(" + code + "\\)");
                                    }
                                }
                            } else {
                                if (code.indexOf("$$") == 0 && code.substr(code.length - 2) == "$$") {
                                    // $$x$$ is valid block
                                } else {
                                    if (code.indexOf("\\[") != 0 && code.substr(code.length - 2) != "\\]") {
                                        // Wrap the code: \[ ... \]
                                        codeW.html("\\[" + code + "\\]");
                                    }
                                }
                            }
                        }
                    });
                    if (typeof (window.MathJax) == 'object' && typeof (MathJax.typesetPromise) == 'function') {
                        if (typeof (eXeLearning) != 'undefined') MathJax.typesetPromise();
                        $exe.math.createLinks();
                    }
                } else {
                    $exe.math.createLinks(math);
                }
            }
        }
    },

    // If the page has links we load the JS file
    hasExeNodeLinks: function () {
        if (!this.isInExe()) return;

        let eXeNodeLinks = document.querySelectorAll("a[href^='exe-node']");
        if (eXeNodeLinks.length > 0) {

            let pages = eXeLearning.app.project.structure.data;
            let buttonsPages = document.querySelectorAll("span.nav-element-text");

            eXeNodeLinks.forEach(link => {
                let pageElement = null;
                let pageName = "nopage";
                let pageId = link.href.replace("exe-node:", "");

                pages.forEach(page => {
                    if (page.pageId === pageId) {
                        pageName = page.pageName;
                    }
                });

                buttonsPages.forEach(button => {
                    if (button.innerText.includes(pageName)) {
                        pageElement = button;
                    }
                });

                if (pageElement) {
                    link.onclick = function (event) {
                        event.preventDefault();
                        pageElement.click();
                    }
                }
            });
        }
    },

    // Add WAI-ARIA roles
    addRoles: function () {
        $("#header").attr("role", "banner");
        $("#siteNav").attr("role", "navigation");
        $("#main").attr("role", "main");
        $("#siteFooter").attr("role", "contentinfo");
        $(".js-feedback").attr("role", "status")
    },

    // Internet Explorer?
    isIE: function () {
        var e = navigator.userAgent.toLowerCase();
        return e.indexOf("msie") != -1 ? parseInt(e.split("msie")[1]) : false
    },

    // Enable "Lightbox"
    imageGallery: {
        init: function (e) {
            $("A", "#" + e).attr("rel", "lightbox[" + e + "]")
        }
    },

    // Show/Hide tips
    hint: {
        init: function () {
            $(".iDevice_hint").each(function (e) {
                // To review (this should be in base.css)
                if (typeof ($exe.hint.imgs) == 'undefined') {
                    $exe.hint.imgs = ['panel-amusements.png', 'stock-stop.png'];
                }
                var t = e + 1;
                var n = "hint-" + t;
                var r = $(".iDevice_hint_content", this);
                var i = $(".iDevice_hint_title", this);
                if (r.length == 1 && i.length == 1) {
                    r.eq(0).attr("id", n);
                    var s = i.eq(0);
                    var o = s.html();
                    s.html('<a href="#' + n + '" title="' + $exe_i18n.show + '" class="hint-toggler show-hint" id="toggle-' + n + '" style="background-image:url(' + $exe.hint.imgs[0] + ')">' + o + "</a>")
                }
                $('.hint-toggler', this).click(function () {
                    $exe.hint.toggle(this);
                    return false;
                });
            });
        },
        toggle: function (e) {
            var t = e.id.replace("toggle-", "");
            if (e.title == $exe_i18n.show) {
                $("#" + t).fadeIn("slow");
                e.title = $exe_i18n.hide;
                e.className = "hint-toggler hide-hint";
                e.style.backgroundImage = "url(" + $exe.hint.imgs[1] + ")"
            } else {
                $("#" + t).fadeOut();
                e.title = $exe_i18n.show;
                e.className = "hint-toggler show-hint";
                e.style.backgroundImage = "url(" + $exe.hint.imgs[0] + ")"
            }
        }
    },

    // Hide/Show iDevices (base.css hides this)
    iDeviceToggler: {
        init: function () {
            var isEdition = typeof (exe_editor_mode) != "undefined" && $("#activeIdevice").length == 1;
            if ($(".iDevice").length < 2 && isEdition == false) return false;
            var t = $(".iDevice_header,.iDevice.emphasis0");
            t.each(function () {
                var t = $exe_i18n.hide;
                e = $(this), c = e.hasClass("iDevice_header") ? "em1" : "em0", eP = e.parents(".iDevice_wrapper");
                if (eP.length) {
                    var n = '<p class="toggle-idevice toggle-' + c + '"><a href="#" id="toggle-idevice-' + eP.attr("id") + '-' + c + '" title="' + t + '"><span>' + t + "</span></a></p>";
                    if (c == "em1") {
                        var r = e.html();
                        e.html(r + n)
                    } else e.before(n)
                }
            });
            $(".toggle-idevice a").click(function () {
                var id = this.id.replace("toggle-idevice-", "");
                id = id.split("-");
                $exe.iDeviceToggler.toggle(this, id[0], id[1]);
                return false;
            });
            if (isEdition) {
                $(".toggle-idevice a").trigger("click");
                $(".iDevice_wrapper").css("opacity", .5).hover(function () {
                    $(this).animate({ opacity: 1 });
                }, function () {
                    $(this).animate({ opacity: .5 });
                });
            }
        },
        toggle: function (e, t, n) {
            var r = $exe_i18n.hide;
            var i = $("#" + t);
            var s = ".iDevice_content";
            if (n == "em1") s = ".iDevice_inner";
            var o = $(s, i);
            var u = i.attr("class");
            if (typeof u == "undefined") return false;
            if (u.indexOf(" hidden-idevice") == -1) {
                r = $exe_i18n.show;
                u += " hidden-idevice";
                o.slideUp("fast", function () {
                    e.className = "show-idevice";
                    e.title = r;
                    e.innerHTML = "<span>" + r + "</span>"
                    i.attr("class", u);
                });
            } else {
                u = u.replace(" hidden-idevice", "");
                o.slideDown("fast", function () {
                    e.className = "hide-idevice";
                    e.title = r;
                    e.innerHTML = "<span>" + r + "</span>";
                });
                i.attr("class", u);
            }
        }
    },

    // The MediaElement did not respect the alignment
    alignMediaElement: function (e) {
        var t = $(e);
        var n = t.parents().eq(2);
        var r = n.attr("class");
        if (typeof r == "string" && r.indexOf("mejs-container") == 0) {
            var i = e.style.marginLeft;
            var s = e.style.marginRight;
            if (i == "auto" && i == s) $(n).wrap('<div style="text-align:center"></div>')
        }
    },

    // Add "http" to the IFRAMES without protocol in local pages and create a hidden link for the print version
    setIframesProperties: function () {
        // setTimeout is provisional. We use it because some Styles were already adding the "external-iframe" class.
        setTimeout(function () {
            var p = window.location.protocol;
            var t = false;
            if (p != "http" && p != "https") t = true;
            $("iframe").each(function () {
                var i = $(this);
                var s = i.attr("src");
                if (typeof (s) == "string") {
                    if (t && s.indexOf("//") == 0) $(this).attr("src", "http:" + s);
                    s = i.attr("src");
                    if (!i.hasClass("external-iframe") && s.indexOf("http") == 0) {
                        i.addClass("external-iframe").before("<span class='external-iframe-src' style='display:none'><a href='" + s + "'>" + s + "</a></span>");
                    }
                }
            });
        }, 1000);
    },

    // Load a JavaScript or CSS file (in HEAD)
    loadScript: function (url, callback) {
        var s;
        if (url.split(".").pop() == "css") {
            s = document.createElement("link");
            s.type = "text/css";
            s.rel = "stylesheet";
            s.href = url
        } else {
            s = document.createElement("script");
            s.type = "text/javascript";
            s.src = url
        }
        if (s.readyState) { // IE
            s.onreadystatechange = function () {
                if (s.readyState == "loaded" || s.readyState == "complete") {
                    s.onreadystatechange = null;
                    if (callback) eval(callback)
                }
            }
        } else {
            s.onload = function () {
                if (callback) eval(callback)
            }
        }
        document.getElementsByTagName("head")[0].appendChild(s)
    },

    // True-False Question and Multi-choice (truefalseelement.py and element.py)
    getFeedback: function (e, t, n, r) {
        var i, s;
        if (r == "truefalse") {
            var o = "right";
            if (e == 1) o = "wrong";
            var u = document.getElementById("s" + n + "-result");
            var a = document.getElementById("s" + n);
            if (!u || !a) return false;
            var f = $exe_i18n.incorrect;
            if (u.className == o) f = $exe_i18n.correct;
            u.innerHTML = f;
            a.style.display = "block"
        } else {
            // Multi choice iDevice (mode=='multi')
            for (i = 0; i < t; i++) {
                s = "sa" + i + "b" + n;
                var d = "none";
                if (i == e) d = "block";
                document.getElementById(s).style.display = d;
            }
        }
    },

    // used to show question's feedback for multi-select idevice
    showFeedback: function (e, t, n) {
        var r, i, s, o;
        for (r = 0; r < t; r++) {
            var u = n + r.toString();
            var a = document.getElementById("op" + u);
            i = "False";
            s = $exe_i18n.incorrect;
            o = "wrong";
            if (a.checked == 1) i = "True";
            if (i == a.value) {
                s = "<strong>" + $exe_i18n.correct + "</strong>";
                o = "right"
            }
            var f = '<p class="' + o + '-option">' + s + "</p>";
            var l = $("#feedback-" + u);
            if (e.value == $exe_i18n.showFeedback) l.html(f).show();
            else l.hide()
        }
        if (e.value == $exe_i18n.showFeedback) {
            $("#f" + n).show();
            e.value = $exe_i18n.hideFeedback
        } else {
            $("#f" + n).hide();
            e.value = $exe_i18n.showFeedback
        }
    },

    // Common feedback (see common.py)
    toggleFeedback: function (e, b) {
        var t = e.name.replace("toggle-", "");
        var n = document.getElementById(t);
        var d = false;
        var r = window[t.replace("-", "") + "text"];
        if (typeof (r) != 'undefined') {
            r = r.split("|");
            if (r.length > 1) d = true
        }
        if (n) {
            if (n.className == "feedback js-feedback js-hidden") {
                n.className = "feedback js-feedback";
                if (d) e.value = r[1];
                else if (b) e.value = $exe_i18n.hideFeedback;
            } else {
                n.className = "feedback js-feedback js-hidden";
                if (d) e.value = r[0];
                else if (b) e.value = $exe_i18n.showFeedback;
            }
        }
    },

    // Used by maths idevice
    insertSymbol: function (e, t, n) {
        var r = document.getElementById(e);
        $exe.insertAtCursor(r, t, n)
    },

    // To review:
    insertAtCursor: function (e, t, n) {
        // MOZILLA/NETSCAPE support
        if (e.selectionStart || e.selectionStart == "0") {
            var r = e.selectionStart;
            var i = e.selectionEnd;
            e.value = e.value.substring(0, r) + t + e.value.substring(i, e.value.length);
            e.selectionStart = r + t.length - n
        } else {
            e.value += t
        }
        e.selectionEnd = e.selectionStart;
        e.focus()
    },

    /**
     * eXeLearning 3.0
     * Inside eXe app
     */
    isInExe: function () {
        return typeof eXeLearning !== "undefined";
    },

    /**
     * eXeLearning 3.0
     * Is preview
     */
    isPreview: function () {
        return $('body').hasClass('preview');
    },

    /**
     * eXeLearning 3.0
     * Export idevice path
     *
     * @param {*} ideviceType
     */
    getIdeviceInstalledExportPath: function (ideviceType) {
        let ideviceNode;
        if (this.isInExe()) {
            ideviceNode = $(`article.idevice_node[idevice-type="${ideviceType}"]`);
            return ideviceNode.attr('idevice-path');
        } else {
            ideviceNode = $(`article.idevice_node[data-idevice-type="${ideviceType}"]`);
            return ideviceNode.attr('data-idevice-path');
        }
    },

    //////////////////////////////////////////////
    // Cloze iDevice
    cloze: {

        // Constants
        NOT_ATTEMPTED: 0,
        WRONG: 1,
        CORRECT: 2,

        // Compatible reader
        hasBeenTested: false,

        // Functions /////////////////////

        // Called when a learner types something into a cloze word space
        change: function (ele) {
            var ident = $exe.cloze.getIds(ele)[0];
            var instant = eval(document.getElementById("clozeFlag" + ident + ".instantMarking").value);
            if (instant) {
                $exe.cloze.checkAndMarkWord(ele);
                // Hide the score paragraph if visible
                var scorePara = document.getElementById("clozeScore" + ident);
                scorePara.innerHTML = ""
            }
        },

        // Recieves and marks answers from student
        submit: function (e) {
            // Mark all of the words
            $exe.cloze.showScore(e, 1);
            // Hide Submit
            $exe.cloze.toggle("submit" + e);
            // Show Restart
            $exe.cloze.toggle("restart" + e);
            // Show Show Answers Button
            $exe.cloze.toggle("showAnswersButton" + e);
            // Show feedback
            $exe.cloze.toggleFeedback(e)
        },

        // Makes cloze idevice like new:
        restart: function (e) {
            // Hide Feedback
            $exe.cloze.toggleFeedback(e);
            // Clear the answers (Also hides score)
            $exe.cloze.toggleAnswers(e, true);
            // Hide Restart
            $exe.cloze.toggle("restart" + e);
            // Hide Show Answers Button
            $exe.cloze.toggle("showAnswersButton" + e);
            // Show Submit
            $exe.cloze.toggle("submit" + e)
        },

        // Show/Hide all answers in the cloze idevice
        // 'clear' is an optional argument, that forces all the answers to be cleared
        // whether they are all finished and correct or not
        toggleAnswers: function (e, t) {
            // See if any have not been answered yet
            var n = true; // allCorrect
            var r = $exe.cloze.getInputs(e);
            if (!t) {
                for (var i = 0; i < r.length; i++) {
                    var s = r[i];
                    if ($exe.cloze.getMark(s) != 2) {
                        n = false;
                        break
                    }
                }
            }
            if (n) {
                // Clear all answers
                $exe.cloze.clearInputs(e, r)
            } else {
                // Write all answers
                $exe.cloze.fillInputs(e, r)
            }
            // Hide the score paragraph, irrelevant now
            var o = document.getElementById("clozeScore" + e);
            o.innerHTML = "";
            // If the get score button is visible and we just filled in all the right
            // answers, disable it until they clear the scores again.
            var u = document.getElementById("getScore" + e);
            if (u) {
                u.disabled = !n
            }
        },

        // Shows all answers for a cloze field
        // 'inputs' is an option argument containing a list of the 'input' elements for
        // the field
        fillInputs: function (e, t) {
            if (!t) {
                var t = $exe.cloze.getInputs(e)
            }
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                var i = $exe.cloze.getAnswer(r); // Right Answer
                i = i.trim();
                var s = false;
                // Check if it has more than one right answer: |dog|bird|cat|
                if (i.indexOf("|") == 0 && i.charAt(i.length - 1) == "|") {
                    var o = i; // Right answer (to operate with this var)
                    var o = o.substring(1, o.length - 1);
                    var u = o.split("|");
                    if (u.length > 1) {
                        s = true;
                        var a = "";
                        for (x = 0; x < u.length; x++) {
                            a += u[x];
                            if (x < u.length - 1) a += " — ";
                            if (u[x] == "") s = false
                        }
                    }
                    if (s) {
                        // Update the field width to display all the answers and save the previous width (the user may want to try again)
                        r.className = "autocomplete-off width-" + r.style.width;
                        r.style.width = "auto";
                        i = a
                    }
                }
                // Show the right answer
                r.value = i;
                $exe.cloze.markWord(r, $exe.cloze.CORRECT);
                r.setAttribute("readonly", "readonly")
            }
        },

        // Blanks all the answers for a cloze field
        // 'inputs' is an option argument containing a list of the 'input' elements for
        // the field
        clearInputs: function (e, t) {
            if (!t) {
                var t = $exe.cloze.getInputs(e)
            }
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                // Reset the field width if it has more than one right answer: |dog|bird|cat|
                if (r.className.indexOf("autocomplete-off width-") != -1) {
                    var i = r.className.replace("autocomplete-off width-", "");
                    r.style.width = i
                }
                r.value = "";
                $exe.cloze.markWord(r, $exe.cloze.NOT_ATTEMPTED);
                // Toggle the readonlyness of the answers also
                r.removeAttribute("readonly")
            }
        },

        // Marks a cloze word in view mode.
        // Returns NOT_ATTEMPTED, CORRECT, or WRONG
        checkAndMarkWord: function (e) {
            var t = $exe.cloze.checkWord(e);
            if (t != "") {
                $exe.cloze.markWord(e, $exe.cloze.CORRECT);
                e.value = t;
                return $exe.cloze.CORRECT
            } else if (!e.value) {
                $exe.cloze.markWord(e, $exe.cloze.NOT_ATTEMPTED);
                return $exe.cloze.NOT_ATTEMPTED
            } else {
                $exe.cloze.markWord(e, $exe.cloze.WRONG);
                return $exe.cloze.WRONG
            }
        },

        // Marks a cloze question (at the moment just changes the color)
        // 'mark' should be 0=Not Answered, 1=Wrong, 2=Right
        markWord: function (e, t) {
            switch (t) {
                case 0:
                    // Not attempted
                    e.style.backgroundColor = "";
                    e.style.color = "";
                    break;
                case 1:
                    // Wrong
                    e.style.backgroundColor = "#FF9999";
                    e.style.color = "#000000";
                    break;
                case 2:
                    // Correct
                    e.style.backgroundColor = "#CCFF99";
                    e.style.color = "#000000";
                    break
            }
            return t
        },

        // Return the last mark applied to a word
        getMark: function (e) {
            var t = $exe.cloze.checkWord(e);
            if (t != "") {
                return $exe.cloze.CORRECT
            } else if (!e.value) {
                return $exe.cloze.NOT_ATTEMPTED
            } else {
                return $exe.cloze.WRONG
            }
        },

        // Decrypts and returns the answer for a certain cloze field word
        getAnswer: function (e) {
            var t = $exe.cloze.getIds(e);
            var n = t[0];
            var r = t[1];
            var i = document.getElementById("clozeAnswer" + n + "." + r);
            var s = i.innerHTML;
            s = $exe.cloze.decode64(s);
            s = unescape(s);
            // XOR "Decrypt"
            result = "";
            var o = "X".charCodeAt(0);
            for (var u = 0; u < s.length; u++) {
                var a = s.charCodeAt(u);
                o ^= a;
                result += String.fromCharCode(o)
            }
            return result
        },

        // Base64 Decode
        // Base64 code from Tyler Akins -- http://rumkin.com
        decode64: function (e) {
            var t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
            var n = "";
            var r, i, s;
            var o, u, a, f;
            var l = 0;
            // Remove all characters that are not A-Z, a-z, 0-9, +, /, or =
            e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
            do {
                o = t.indexOf(e.charAt(l++));
                u = t.indexOf(e.charAt(l++));
                a = t.indexOf(e.charAt(l++));
                f = t.indexOf(e.charAt(l++));
                r = o << 2 | u >> 4;
                i = (u & 15) << 4 | a >> 2;
                s = (a & 3) << 6 | f;
                n = n + String.fromCharCode(r);
                if (a != 64) {
                    n = n + String.fromCharCode(i)
                }
                if (f != 64) {
                    n = n + String.fromCharCode(s)
                }
            } while (l < e.length);
            return n
        },

        // Returns the corrected word or an empty string
        checkWord: function (e) {
            var t = e.value;
            // Extract the idevice id and the input number out of the element's id
            var n = $exe.cloze.getAnswer(e);
            var r = n;
            r = r.trim();
            var i = r.indexOf("|");
            var s = r.lastIndexOf("|");
            if (i == 0 && s == r.length - 1) {
                var o = r.split("|");
                var u;
                for (var a in o) {
                    if (o[a] != "") {
                        u = $exe.cloze.checkWordAnswer(e, o[a]);
                        if (u != "") return o[a]
                    }
                }
                return ""
            } else return $exe.cloze.checkWordAnswer(e, r)
        },

        // Returns the corrected word or an empty string agains one of the possible answers
        checkWordAnswer: function (ele, original_answer) {
            original_answer = original_answer.trim();
            var guess = ele.value;
            // Extract the idevice id and the input number out of the element's id
            //var original = getClozeAnswer(ele);
            var answer = original_answer;
            var ident = $exe.cloze.getIds(ele)[0];
            // Read the flags for checking answers
            var strictMarking = eval(document.getElementById("clozeFlag" + ident + ".strictMarking").value);
            var checkCaps = eval(document.getElementById("clozeFlag" + ident + ".checkCaps").value);

            // The Dropdown Activity has no strictMarking or checkCaps options (see #171)
            var $form = $(ele).closest('.iDevice_wrapper');
            if ($form.length == 1 && $form.hasClass("ListaIdevice")) {
                strictMarking = true;
                checkCaps = true;
            }

            if (!checkCaps) {
                guess = guess.toLowerCase();
                answer = answer.toLowerCase()
            }
            if (guess == answer) {
                // You are right!
                return original_answer;
            } else if (strictMarking || answer.length <= 4) {
                // You are wrong!
                return "";
            } else {
                // Now use the similarity check algorythm
                var i = 0;
                var j = 0;
                var orders = [
                    [answer, guess],
                    [guess, answer]
                ];
                var maxMisses = Math.floor(answer.length / 6) + 1;
                var misses = 0;
                if (guess.length <= maxMisses) {
                    misses = Math.abs(guess.length - answer.length);
                    for (i = 0; i < guess.length; i++) {
                        if (answer.search(guess[i]) == -1) {
                            misses += 1
                        }
                    }
                    if (misses <= maxMisses) {
                        return original_answer
                    } else {
                        return ""
                    }
                }
                // Iterate through the different orders of checking
                for (i = 0; i < 2; i++) {
                    var string1 = orders[i][0];
                    var string2 = orders[i][1];
                    while (string1) {
                        misses = Math.floor((Math.abs(string1.length - string2.length) + Math.abs(guess.length - answer.length)) / 2);
                        var max = Math.min(string1.length, string2.length);
                        for (j = 0; j < max; j++) {
                            var a = string2.charAt(j);
                            var b = string1.charAt(j);
                            if (a != b) misses += 1;
                            if (misses > maxMisses) break
                        }
                        if (misses <= maxMisses) {
                            // You are right
                            return original_answer;
                        }
                        string1 = string1.substr(1)
                    }
                }
                // You are wrong!
                return ""
            }
        },

        // Extracts the idevice id and input id from a javascript element
        getIds: function (e) {
            // Extract the idevice id and the input number out of the element's id
            // id is "clozeBlank%s.%s" % (idevice.id, input number)
            var t = e.id.slice(10);
            var n = t.indexOf(".");
            var r = t.slice(0, n);
            var i = t.slice(t.indexOf(".") + 1);
            return [r, i]
        },

        // Calculate the score for cloze idevice
        showScore: function (e, t) {
            var n = 0;
            var r = document.getElementById("cloze" + e);
            var i = $exe.cloze.getInputs(e);
            for (var s = 0; s < i.length; s++) {
                var o = i[s];
                if (t) {
                    var u = $exe.cloze.checkAndMarkWord(o)
                } else {
                    var u = $exe.cloze.getMark(o)
                }
                if (u == 2) {
                    n++
                }
            }
            // Show it in a nice paragraph
            var a = document.getElementById("clozeScore" + e);
            a.innerHTML = $exe_i18n.yourScoreIs + n + "/" + i.length + "."
        },

        // Returns an array of input elements that are associated with a certain idevice
        getInputs: function (e) {
            var t = new Array;
            var n = document.getElementById("cloze" + e);
            $exe.cloze.recurseFindInputs(n, e, t);
            return t
        },

        // Adds any cloze inputs found to result, recurses down
        recurseFindInputs: function (e, t, n) {
            for (var r = 0; r < e.childNodes.length; r++) {
                var i = e.childNodes[r];
                // See if it is a blank
                if (i.id) {
                    if (i.id.search("clozeBlank" + t) == 0) {
                        n.push(i);
                        continue
                    }
                }
                // See if it contains blanks
                if (i.hasChildNodes()) {
                    $exe.cloze.recurseFindInputs(i, t, n)
                }
            }
        },

        // Pass the cloze element's id, and the visible property of the feedback element
        // associated with it will be toggled. If there is no feedback field, does
        // nothing
        toggleFeedback: function (e, t) {
            var n = document.getElementById("clozeVar" + e + ".feedbackId");
            if (n) {
                var r = n.value;
                if (t) {
                    if (t.value == $exe_i18n.showFeedback) t.value = $exe_i18n.hideFeedback;
                    else t.value = $exe_i18n.showFeedback
                }
                $exe.cloze.toggle(r)
            }
        },

        // Toggle the visiblity of an element from it's id
        toggle: function (e) {
            $("#" + e).toggle()
        },

        // ClozelangElement's functions
        // This functions are only required for the iDevice "FPD - Actividad de Espacios en Blanco (Modificada)"

        // ClozelangElement's function
        // Called when a learner types something into a cloze word space
        onLangChange: function (ele) {
            var ident = $exe.cloze.getLangIds(ele)[0];
            var instant = eval(document.getElementById("clozelangFlag" + ident + ".instantMarking").value);
            if (instant) {
                $exe.cloze.checkAndMarkLangWord(ele);
                // Hide the score paragraph if visible
                var scorePara = document.getElementById("clozelangScore" + ident);
                scorePara.innerHTML = ""
            }
        },

        // ClozelangElement's function
        // Recieves and marks answers from student
        langSubmit: function (e) {
            // Mark all of the words
            $exe.cloze.showLangScore(e, 1);
            // Hide Submit
            $exe.cloze.toggle("submit" + e);
            // Show feedback
            $exe.cloze.toggleLangFeedback(e)
        },

        // ClozelangElement's function
        // Makes cloze idevice like new:
        langRestart: function (e) {
            // Hide Feedback
            $exe.cloze.toggleLangFeedback(e);
            // Clear the answers (Also hides score)
            $exe.cloze.toggleLangAnswers(e, true);
            // Hide Restart
            $exe.cloze.toggle("restart" + e);
            // Hide Show Answers Button
            $exe.cloze.toggle("showAnswersButton" + e);
            // Show Submit
            $exe.cloze.toggle("submit" + e)
        },

        // ClozelangElement's function
        // Show/Hide all answers in the cloze idevice
        // 'clear' is an optional argument, that forces all the answers to be cleared
        // whether they are all finished and correct or not
        toggleLangAnswers: function (e, t) {
            // See if any have not been answered yet
            var n = true; // allCorrect
            var r = $exe.cloze.getLangInputs(e);
            if (!t) {
                for (var i = 0; i < r.length; i++) {
                    var s = r[i];
                    if ($exe.cloze.getLangMark(s) != 2) {
                        n = false;
                        break
                    }
                }
            }
            if (n) {
                // Clear all answers
                $exe.cloze.clearLangInputs(e, r)
            } else {
                // Write all answers
                $exe.cloze.fillLangInputs(e, r)
            }
            // Hide the score paragraph, irrelevant now
            var o = document.getElementById("clozelangScore" + e);
            o.innerHTML = "";
            // If the get score button is visible and we just filled in all the right
            // answers, disable it until they clear the scores again.
            var u = document.getElementById("getScore" + e);
            if (u) {
                u.disabled = !n
            }
        },

        // ClozelangElement's function
        // Shows all answers for a cloze field
        // 'inputs' is an option argument containing a list of the 'input' elements for
        // the field
        fillLangInputs: function (e, t) {
            if (!t) {
                var t = $exe.cloze.getLangInputs(e)
            }
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                r.value = $exe.cloze.getLangAnswer(r);
                $exe.cloze.markWord(r, $exe.cloze.CORRECT);
                // Toggle the readonlyness of the answers also
                r.setAttribute("readonly", "readonly")
            }
        },

        // ClozelangElement's function
        // Blanks all the answers for a cloze field
        // 'inputs' is an option argument containing a list of the 'input' elements for
        // the field
        clearLangInputs: function (e, t) {
            if (!t) {
                var t = $exe.cloze.getLangInputs(e)
            }
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                r.value = "";
                $exe.cloze.markWord(r, $exe.cloze.NOT_ATTEMPTED);
                // Toggle the readonlyness of the answers also
                r.removeAttribute("readonly")
            }
        },

        // ClozelangElement's function
        // Marks a cloze word in view mode.
        // Returns NOT_ATTEMPTED, CORRECT, or WRONG
        checkAndMarkLangWord: function (e) {
            var t = $exe.cloze.checkLangWord(e);
            if (t != "") {
                $exe.cloze.markLangWord(e, $exe.cloze.CORRECT);
                e.value = t;
                return $exe.cloze.CORRECT
            } else if (!e.value) {
                $exe.cloze.markLangWord(e, $exe.cloze.NOT_ATTEMPTED);
                return $exe.cloze.NOT_ATTEMPTED
            } else {
                $exe.cloze.markLangWord(e, $exe.cloze.WRONG);
                return $exe.cloze.WRONG
            }
        },

        // ClozelangElement's function
        // Marks a cloze question (at the moment just changes the color)
        // 'mark' (t) should be 0=Not Answered, 1=Wrong, 2=Right
        markLangWord: function (e, t) {
            switch (t) {
                case 0:
                    // Not attempted
                    e.style.backgroundColor = "";
                    break;
                case 1:
                    // Wrong
                    e.style.backgroundColor = "#FF9999";
                    break;
                case 2:
                    // Correct
                    e.style.backgroundColor = "#CCFF99";
                    break
            }
            return t
        },

        // ClozelangElement's function
        // Return the last mark applied to a word
        getLangMark: function (e) {
            // Return last mark applied
            switch (e.style.backgroundColor) {
                case "#FF9999":
                    return 1; // Wrong
                case "#CCFF99":
                    return 2; // Correct
                default:
                    return 0 // Not attempted
            }
        },

        // ClozelangElement's function
        // Decrypts and returns the answer for a certain cloze field word
        getLangAnswer: function (e) {
            var t = $exe.cloze.getLangIds(e);
            var n = t[0];
            var r = t[1];
            var i = document.getElementById("clozelangAnswer" + n + "." + r);
            var s = i.innerHTML;
            s = $exe.cloze.decode64(s);
            s = unescape(s);
            // XOR "Decrypt"
            result = "";
            var o = "X".charCodeAt(0);
            for (var u = 0; u < s.length; u++) {
                var a = s.charCodeAt(u);
                o ^= a;
                result += String.fromCharCode(o)
            }
            return result
        },

        // ClozelangElement's function
        // Returns the corrected word or an empty string
        checkLangWord: function (ele) {
            var guess = ele.value;
            // Extract the idevice id and the input number out of the element's id
            var original = $exe.cloze.getLangAnswer(ele);
            var answer = original;
            var guess = ele.value;
            var ident = $exe.cloze.getLangIds(ele)[0];
            // Read the flags for checking answers
            var strictMarking = eval(document.getElementById("clozelangFlag" + ident + ".strictMarking").value);
            var checkCaps = eval(document.getElementById("clozelangFlag" + ident + ".checkCaps").value);
            if (!checkCaps) {
                guess = guess.toLowerCase();
                answer = original.toLowerCase()
            }
            if (guess == answer) {
                // You are right!
                return original;
            } else if (strictMarking || answer.length <= 4) {
                // You are wrong!
                return "";
            } else {
                // Now use the similarity check algorythm
                var i = 0;
                var j = 0;
                var orders = [
                    [answer, guess],
                    [guess, answer]
                ];
                var maxMisses = Math.floor(answer.length / 6) + 1;
                var misses = 0;
                if (guess.length <= maxMisses) {
                    misses = Math.abs(guess.length - answer.length);
                    for (i = 0; i < guess.length; i++) {
                        if (answer.search(guess[i]) == -1) {
                            misses += 1
                        }
                    }
                    if (misses <= maxMisses) {
                        return answer
                    } else {
                        return ""
                    }
                }
                // Iterate through the different orders of checking
                for (i = 0; i < 2; i++) {
                    var string1 = orders[i][0];
                    var string2 = orders[i][1];
                    while (string1) {
                        misses = Math.floor((Math.abs(string1.length - string2.length) + Math.abs(guess.length - answer.length)) / 2);
                        var max = Math.min(string1.length, string2.length);
                        for (j = 0; j < max; j++) {
                            var a = string2.charAt(j);
                            var b = string1.charAt(j);
                            if (a != b) misses += 1;
                            if (misses > maxMisses) break
                        }
                        if (misses <= maxMisses) {
                            // You are right
                            return answer;
                        }
                        string1 = string1.substr(1)
                    }
                }
                // You are wrong!
                return ""
            }
        },

        // ClozelangElement's function
        // Extracts the idevice id and input id from a javascript element
        getLangIds: function (e) {
            // Extract the idevice id and the input number out of the element's id
            // id is "clozelangBlank%s.%s" % (idevice.id, input number)
            var t = e.id.slice(14);
            var n = t.indexOf(".");
            var r = t.slice(0, n);
            var i = t.slice(t.indexOf(".") + 1);
            return [r, i]
        },

        // ClozelangElement's function
        // Calculate the score for cloze idevice
        showLangScore: function (ident, mark) {
            var showScore = eval(document.getElementById("clozelangFlag" + ident + ".showScore").value);
            if (showScore) {
                var score = 0;
                var div = document.getElementById("clozelang" + ident);
                var inputs = $exe.cloze.getLangInputs(ident);
                for (var i = 0; i < inputs.length; i++) {
                    var input = inputs[i];
                    if (mark) {
                        var result = $exe.cloze.checkAndMarkLangWord(input)
                    } else {
                        var result = $exe.cloze.getLangMark(input)
                    }
                    if (result == 2) {
                        score++
                    }
                }
                // Show it in a nice paragraph
                var scorePara = document.getElementById("clozelangScore" + ident);
                scorePara.innerHTML = $exe_i18n.yourScoreIs + score + "/" + inputs.length + "."
            }
        },

        // ClozelangElement's function
        // Adds any cloze inputs found to result, recurses down
        recurseFindLangInputs: function (e, t, n) {
            for (var r = 0; r < e.childNodes.length; r++) {
                var i = e.childNodes[r];
                // See if it is a blank
                if (i.id) {
                    if (i.id.search("clozelangBlank" + t) == 0) {
                        n.push(i);
                        continue
                    }
                }
                // See if it contains blanks
                if (i.hasChildNodes()) {
                    $exe.cloze.recurseFindLangInputs(i, t, n)
                }
            }
        },

        // ClozelangElement's function
        // Returns an array of input elements that are associated with a certain idevice
        getLangInputs: function (e) {
            var t = new Array;
            var n = document.getElementById("clozelang" + e);
            $exe.cloze.recurseFindLangInputs(n, e, t);
            return t
        },

        // Pass the cloze element's id, and the visible property of the feedback element
        // associated with it will be toggled. If there is no feedback field, does
        // nothing
        toggleLangFeedback: function (e) {
            var t = document.getElementById("clozelangVar" + e + ".feedbackId");
            if (t) {
                var n = t.value;
                $exe.cloze.toggle(n)
            }
        },
    },
};

// eXeDevices new
var $exeDevices = {
    iDevice: {
        init: function () {

            var errorMsg = "";

            // Check if the object and the required methods are defined
            if (typeof ($exeDevice) == 'undefined') errorMsg += "$exeDevice";
            else if (typeof ($exeDevice.init) == 'undefined') errorMsg += "$exeDevice.init";
            else if (typeof ($exeDevice.save) == 'undefined') errorMsg += "$exeDevice.save";

            // Show a message if they are not defined
            if (errorMsg != "") {
                errorMsg = _("iDevice error") + ": " + errorMsg + " is not defined.";
                eXe.app.alert(errorMsg);
                return;
            }

            // Check if the submit image exists (it will unless renderEditButtons changes)
            var myLink = $("#exe-submitButton a").eq(0);
            if (myLink.length != 1) {
                eXe.app.alert(_("Report an Issue") + ": $exeDevices.iDevice.init (#exe-submitButton)");
                return;
            }

            // Execute $exeDevice.save onclick (to validate)
            var onclick = myLink.attr("onclick");
            myLink[0].onclick = function () {
                var html = $exeDevice.save();
                if (html) {
                    $("textarea.mceEditor, #node-content .idevice_node[mode=edition]").val(html);
                    // Execute the IMG default behavior if everything is OK
                    eval(onclick);
                }
            }

            // Replace the _ function
            _ = function (str) {
                if (typeof ($exeDevice.i18n) != "undefined") {
                    var lang = $("HTML").attr("lang");
                    if (typeof ($exeDevice.i18n[lang]) != "undefined") {
                        return top.translations[str] || $exeDevice.i18n[lang][str] || str;
                    }
                }
                return top.translations[str] || str;
            }

            // Enable the iDevice
            $exeDevice.init();

            // Enable TinyMCE
            if (tinymce.majorVersion == 4) $exeTinyMCE.init("multiple-visible", ".exe-html-editor");
            else if (tinymce.majorVersion == 3) $exeTinyMCE.init("specific_textareas", "exe-html-editor");

            // Enable the FIELDSETs Toggler
            $(".exe-fieldset legend a").click(function () {
                $(this).parent().parent().toggleClass("exe-fieldset-closed");
                return false;
            });

            // Enable the iDevice instructions
            $(".exe-info").each(function () {
                var e = $(this);
                e.html('<p class="exe-block-info exe-block-dismissible">' + e.html() + ' <a href="#" class="exe-block-close" title="' + _("Hide") + '"><span class="sr-av">' + _("Hide") + ' </span>×</a></p>');
            });

            // Dismissible messages
            $(".exe-block-dismissible .exe-block-close").click(function () {
                $(this).parent().fadeOut();
                return false;
            });

            // Enable color pickers (provisional solution)
            // To review: 100 ms delay because the color picker won't work when combined with $exeTinyMCE.init
            setTimeout(function () {
                $exeDevices.iDevice.colorPicker.init();
            }, 100);

            // Enable file uploaders
            $exeDevices.iDevice.filePicker.init();
        },
        // Common
        common: {
            // Get the "Content after" or the "Content before" fieldset
            getTextFieldset: function (position) {
                if (typeof (position) != "string" || (position != "after" && position != "before")) return "";
                var tit = _('Content after');
                var id = "After";
                if (position == "before") {
                    tit = _('Content before');
                    id = "Before";
                }
                return "<fieldset class='exe-advanced exe-fieldset exe-feedback-fieldset exe-fieldset-closed'>\
                            <legend><a href='#'>"+ tit + " (" + _('Optional').toLowerCase() + ")</a></legend>\
                                <div>\
                                    <p>\
                                        <label for='eXeIdeviceText"+ id + "' class='sr-av'>" + tit + ":</label>\
                                            <textarea id='eXeIdeviceText"+ id + "' class='exe-html-editor'\></textarea>\
                                    </p>\
                                <div>\
                        </fieldset>";
            }
        },
        // Gamification
        gamification: {
            common: {
                getFieldsets: function () {
                    return "";
                },
                getLanguageTab: function (fields) {
                    var html = "";
                    var field, label, txt;
                    for (var i in fields) {
                        field = fields[i]
                        if (typeof field == "string") {
                            label = field
                            txt = field
                        } else {
                            if (field.length == 2) {
                                label = field[0]
                                txt = field[1]
                            } else {
                                label = field[0]
                                txt = field[0]
                            }
                        }
                        html += '<p class="ci18n"><label for="ci18n_' + i + '">' + label + '</label> <input type="text" class="form-control" name="ci18n_' + i + '" id="ci18n_' + i + '" value="' + txt + '" /></p>'
                    }
                    return '\
                            <div class="exe-form-tab" title="' + _('Custom texts') + '">\
                                <p>' + _("Type your own texts or use the default ones:") + '</p>\
                                ' + html + '\
                            </div>'
                },
                setLanguageTabValues: function (obj) {
                    if (typeof obj == "object") {
                        for (var i in obj) {
                            var v = obj[i];
                            if (v != "") $("#ci18n_" + i).val(v);
                        }
                    }
                },
                getGamificationTab: function () {
                    return '\
                            ' + $exeDevices.iDevice.gamification.itinerary.getItineraryTab() + '\
                            ' + $exeDevices.iDevice.gamification.scorm.getScormTab() + '\
                            ' + $exeDevices.iDevice.gamification.share.getShareTab();
                }
            },
            instructions: {
                getFieldset: function (str) {
                    return '<fieldset class="exe-fieldset exe-fieldset-closed">\
                        <legend><a href="#">' + _("Instructions") + '</a></legend>\
                        <div>\
                            <p>\
                                <label for="eXeGameInstructions" class="sr-av">' + _("Instructions") + ': </label>\
                                <textarea id="eXeGameInstructions" class="exe-html-editor"\>' + str + ' </textarea>\
                            </p>\
                        </div>\
                    </fieldset>';
                }
            },
            initGame($game, nameGame, gameClass, ideviceClass) {
                if ($(".QuizTestIdevice .iDevice").length > 0) {
                    $game.hasSCORMbutton = true;
                }
                let scormFlow = false;
                $game.isInExe = eXe.app.isInExe();
                $game.idevicePath = $game.isInExe
                    ? eXe.app.getIdeviceInstalledExportPath(gameClass)
                    : $(".idevice_node." + gameClass).eq(0).attr("data-idevice-path");

                $game.activities = $(`.${ideviceClass}`);
                if ($game.activities.length === 0) return;
                if (!$exeDevices.iDevice.gamification.helpers.supportedBrowser(nameGame)) return;

                if ($("#exe-submitButton").length > 0) {
                    $game.activities.hide();
                    if (typeof _ !== "undefined") {
                        $game.activities.before(`<p>${_(nameGame)}</p>`);
                    }
                    return;
                }
                if (!($('html').is('#exe-index'))) {
                    $game.scormAPIwrapper = '../libs/SCORM_API_wrapper.js';
                    $game.scormFunctions = '../libs/SCOFunctions.js';
                }

                function initScorm() {
                    if (typeof scorm !== "undefined" && scorm.init()) {
                        $game.mScorm = scorm;
                        $game.userName = $exeDevices.iDevice.gamification.scorm.getUserName(scorm);
                        $game.previousScore = $exeDevices.iDevice.gamification.scorm.getPreviousScore(scorm);
                        if (typeof scorm.SetScoreMax === "function") {
                            scorm.SetScoreMax(100);
                            scorm.SetScoreMin(0);
                        } else {
                            scorm.set("cmi.core.score.max", "100");
                            scorm.set("cmi.core.score.min", "0");
                        }
                    } else {
                        console.warn("La inicialización SCORM devolvió false o scorm no está definido");
                    }
                }

                function loadAndInitScorm() {
                    if (typeof window.scorm === "undefined") {
                        $.ajax({ url: $game.scormAPIwrapper, dataType: "script" })
                            .then(() => $.ajax({ url: $game.scormFunctions, dataType: "script" }))
                            .then(initScorm)
                            .fail((_, textStatus) => {
                                console.error("Error cargando SCORM:", textStatus);
                            })
                            .always(() => {
                                $game.enable();
                            });
                    } else {
                        initScorm();
                        $game.enable();
                    }
                }

                try {
                    if ($("body").hasClass("exe-scorm")) {
                        scormFlow = true;
                        loadAndInitScorm();
                        return;
                    }
                } catch (err) {
                    console.error("Error en init():", err);
                } finally {
                    if (!scormFlow) {
                        $game.enable();
                    }
                }
            },

            itinerary: {
                getContents: function () {
                    return '\
                        <div class="exe-info">'+ _("You might create an itinerary of challenges where players won't be able to access a new game or challenge until they get a key in a previous activity. For this purpose, you might establish an access code as well as a message that may be displayed to players when they get a fixed percentage of hits, and be used as a password to a new challenge or a following activity.") + '</div>\
                        <p>\
                            <label for="eXeGameShowCodeAccess"><input type="checkbox" id="eXeGameShowCodeAccess" >' + _("Access code is required") + '</label>\
                        </p>\
                        <p style="margin-left:1.4em;margin-bottom:1.5em;display:none" id="eXeGameShowCodeAccessOptions">\
                            <label for="eXeGameCodeAccess" id="labelCodeAccess">'+ _("Access code") + ':</label>\
                            <input type="text" name="eXeGameCodeAccess" id="eXeGameCodeAccess"    maxlength="40" disabled />\
                            <label for="eXeGameMessageCodeAccess" id="labelMessageAccess">'+ _("Question") + ':</label>\
                            <input type="text" name="eXeGameMessageCodeAccess" id="eXeGameMessageCodeAccess" maxlength="200"/ disabled> \
                        </p>\
                        <p>\
                            <label for="eXeGameShowClue"><input type="checkbox" id="eXeGameShowClue" >'+ _("Show a message or password when reaching the objective") + '</label>\
                        </p>\
                        <div style="margin-left:1.4em;margin-bottom:1.5em;display:none" id="eXeGameShowClueOptions">\
                            <p>\
                                <label for="eXeGameClue">'+ _("Message") + ':</label>\
                                <input type="text" name="eXeGameClue" id="eXeGameClue"    maxlength="50" disabled>\
                            </p>\
                            <p>\
                                <label for="eXeGamePercentajeClue" id="labelPercentajeClue">'+ _("Percentage of hits needed to display the message") + ':</label>\
                                <select id="eXeGamePercentajeClue" disabled>\
                                    <option value="10">10%</option>\
                                    <option value="20">20%</option>\
                                    <option value="30">30%</option>\
                                    <option value="40" selected>40%</option>\
                                    <option value="50">50%</option>\
                                    <option value="60">60%</option>\
                                    <option value="70">70%</option>\
                                    <option value="80">80%</option>\
                                    <option value="90">90%</option>\
                                    <option value="100">100%</option>\
                                </select>\
                            </p>\
                        </div>\
                    ';
                },
                getTab: function () {
                    return `
                        <div class="exe-form-tab" title="${_('Passwords')}">
                            ${$exeDevices.iDevice.gamification.itinerary.getContents()}
                        </div>`;
                },

                getValues: function () {
                    var showClue = $('#eXeGameShowClue').is(':checked'),
                        clueGame = $.trim($('#eXeGameClue').val()),
                        percentageClue = parseInt($('#eXeGamePercentajeClue').children("option:selected").val()),
                        showCodeAccess = $('#eXeGameShowCodeAccess').is(':checked'),
                        codeAccess = $.trim($('#eXeGameCodeAccess').val()),
                        messageCodeAccess = $.trim($('#eXeGameMessageCodeAccess').val());

                    if (showClue && clueGame.length == 0) {
                        eXe.app.alert(_("You must write a clue"));
                        return false;
                    }
                    if (showCodeAccess && codeAccess.length == 0) {
                        eXe.app.alert(_("You must provide the code to play this game"));
                        return false;
                    }
                    if (showCodeAccess && messageCodeAccess.length == 0) {
                        eXe.app.alert(_("Please explain how to obtain the code to play this game"));
                        return false;
                    }
                    var a = {
                        'showClue': showClue,
                        'clueGame': clueGame,
                        'percentageClue': percentageClue,
                        'showCodeAccess': showCodeAccess,
                        'codeAccess': codeAccess,
                        'messageCodeAccess': messageCodeAccess
                    }
                    return a;
                },
                setValues: function (a) {
                    $('#eXeGameShowClue').prop('checked', a.showClue);
                    if (a.showClue) $("#eXeGameShowClueOptions").show();
                    $('#eXeGameClue').val(a.clueGame);
                    $('#eXeGamePercentajeClue').val(a.percentageClue);
                    $('#eXeGameShowCodeAccess').prop('checked', a.showCodeAccess);
                    if (a.showCodeAccess) $("#eXeGameShowCodeAccessOptions").show();
                    $('#eXeGameCodeAccess').val(a.codeAccess);
                    $('#eXeGameMessageCodeAccess').val(a.messageCodeAccess);
                    $('#eXeGameClue').prop('disabled', !a.showClue);
                    $('#eXeGamePercentajeClue').prop('disabled', !a.showClue);
                    $('#eXeGameCodeAccess').prop('disabled', !a.showCodeAccess);
                    $('#eXeGameMessageCodeAccess').prop('disabled', !a.showCodeAccess);
                },
                addEvents: function () {
                    $('#eXeGameShowClue').on('change', function () {
                        var mark = $(this).is(':checked');
                        if (mark) $("#eXeGameShowClueOptions").show();
                        else $("#eXeGameShowClueOptions").hide();
                        $('#eXeGameClue').prop('disabled', !mark);
                        $('#eXeGamePercentajeClue').prop('disabled', !mark);
                    });
                    $('#eXeGameShowCodeAccess').on('change', function () {
                        var mark = $(this).is(':checked');
                        if (mark) $("#eXeGameShowCodeAccessOptions").show();
                        else $("#eXeGameShowCodeAccessOptions").hide();
                        $('#eXeGameCodeAccess').prop('disabled', !mark);
                        $('#eXeGameMessageCodeAccess').prop('disabled', !mark);
                    });
                    $('#eXeGameItineraryOptionsLnk').click(function () {
                        $("#eXeGameItineraryOptionsLnk").remove();
                        $("#eXeGameItineraryOptions").fadeIn();
                        return false;
                    });
                }
            },
            scorm: {
                init: function () {
                    $exeDevices.iDevice.gamification.scorm.setValues(0, _("Save score"), false)
                    $exeDevices.iDevice.gamification.scorm.addEvents();
                },

                getTab: function (hidebutton = false, hiderepeat = false, onlybutton = false) {
                    const displaybutton = hidebutton ? `style="display:none;"` : '';
                    const displayrepeat = hiderepeat ? `style="display:none;"` : '';
                    const message = onlybutton ? ("Save the score") : ("Automatically save the score");
                    return `
                        <div class="exe-form-tab" title="${_('SCORM')}">
                            <p id="eXeGameSCORMNoSave">
                                <label for="eXeGameSCORMNoSave">
                                    <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" checked /> 
                                    ${_("Do not save the score")}
                                </label>
                            </p>
                            <p id="eXeGameSCORMAutomatically">
                                <label for="eXeGameSCORMAutoSave">
                                    <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" /> 
                                    ${message}
                                </label>
                                <span id="eXeGameSCORgameAuto"  style="display:none;">
                                    <label for="eXeGameSCORMRepeatActivityAuto" ${displayrepeat}>
                                        <input type="checkbox" id="eXeGameSCORMRepeatActivityAuto" checked /> 
                                        ${_("Repeat activity")}
                                    </label>
                                </span>
                            </p>
                            <p id="eXeGameSCORMblock" ${displaybutton}>
                                <label for="eXeGameSCORMButtonSave">
                                    <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" /> 
                                    ${_("Show a button to save the score")}
                                </label>
                                <span id="eXeGameSCORgame" style="display:none;">
                                    <label for="eXeGameSCORMbuttonText">${_("Button text")}: </label>
                                    <input type="text" max="100" name="eXeGameSCORMbuttonText" id="eXeGameSCORMbuttonText" value="${_("Save score")}" />
                                    <label for="eXeGameSCORMRepeatActivity" ${displayrepeat}>
                                        <input type="checkbox" id="eXeGameSCORMRepeatActivity" checked /> 
                                        ${_("Repeat activity")}
                                    </label>
                                </span>
                            </p>
                            <div id="eXeGameSCORMinstructionsAuto">
                                <ul>
                                    <li>${_("This will only work when exporting as SCORM ")}</li>
                                    <li ${displaybutton}>${_("The score will be automatically saved after answering each question and at the end of the game.")}</li>
                                </ul>
                            </div>
                            <div id="eXeGameSCORMinstructionsButton">
                                <ul>
                                    <li>${_("The button will only be displayed when exporting as SCORM.")}</li>
                                </ul>
                            </div>
                            <div id="eXeGameSCORMPercentaje">
                                <p>
                                    <label for="eXeGameSCORMWeight">${_("Weighted")}: </label>
                                    <input type="number" id="eXeGameSCORMWeight" name="eXeGameSCORMWeight" value ="100" min="1" max="100" />
                                </p>
                            </div>
                        </div>`;
                },

                setValues: function (isScorm, textButtonScorm, repeatActivity = true, weighted = 100) {
                    $("#eXeGameSCORgame").css("visibility", "hidden");
                    $("#eXeGameSCORgameAuto").css("visibility", "hidden");
                    $("#eXeGameSCORMPercentaje").css("visibility", "visible");
                    $("#eXeGameSCORMinstructionsButton").hide();
                    $("#eXeGameSCORMinstructionsAuto").hide();

                    $('#eXeGameSCORMWeight').val(weighted);

                    if (isScorm == 0) {
                        $('#eXeGameSCORMNoSave').prop('checked', true);
                        $("#eXeGameSCORMPercentaje").css("visibility", "hidden");
                    } else if (isScorm == 1) {
                        $('#eXeGameSCORMAutoSave').prop('checked', true);
                        $('#eXeGameSCORgameAuto').css("visibility", "visible");
                        $('#eXeGameSCORMRepeatActivityAuto').prop("checked", repeatActivity);
                        $('#eXeGameSCORMinstructionsAuto').show();
                    } else if (isScorm == 2) {
                        $('#eXeGameSCORMButtonSave').prop('checked', true);
                        $('#eXeGameSCORMbuttonText').val(textButtonScorm);
                        $('#eXeGameSCORgame').css("visibility", "visible");
                        $('#eXeGameSCORMinstructionsButton').show();
                        $('#eXeGameSCORMRepeatActivity').prop("checked", repeatActivity);
                    }
                },

                getValues: function () {
                    var isScorm = parseInt($("input[type=radio][name='eXeGameSCORM']:checked").val()),
                        textButtonScorm = $("#eXeGameSCORMbuttonText").val(),
                        weighted = $('#eXeGameSCORMWeight').val() === '' ? -1 : parseFloat($('#eXeGameSCORMWeight').val());
                    return {
                        'isScorm': isScorm,
                        'textButtonScorm': textButtonScorm,
                        'repeatActivity': true,
                        'weighted': weighted,
                    };
                },

                addEvents: function () {
                    $('input[type=radio][name="eXeGameSCORM"]').on('change', function () {
                        $("#eXeGameSCORgame,#eXeGameSCORgameAuto, #eXeGameSCORMinstructionsButton,#eXeGameSCORMinstructionsAuto").hide();
                        switch ($(this).val()) {
                            case '0':
                                $("#eXeGameSCORMPercentaje").css("visibility", "hidden");
                                break;
                            case '1':
                                $("#eXeGameSCORMinstructionsAuto").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);
                                $("#eXeGameSCORMPercentaje").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);
                                break;
                            case '2':
                                $("#eXeGameSCORMinstructionsButton").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);

                                $("#eXeGameSCORMPercentaje").hide().css({
                                    opacity: 0,
                                    visibility: "visible"
                                }).show().animate({
                                    opacity: 1
                                }, 500);
                                break;
                        }
                    });
                    $('#eXeGameSCORMWeight').on('keyup click', function () {
                        this.value = this.value.replace(/\D/g, '').substring(0, 3);
                    }).on('focusout', function () {
                        let value = this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                        value = Math.max(1, Math.min(value, 100));
                        this.value = value;
                    });
                },

                getUserName: function (scormgame) {
                    if (scormgame && typeof scormgame.GetLearnerName === 'function') {
                        return scormgame.GetLearnerName() || '';
                    } else {
                        return '';
                    }
                },

                getPreviousScore: function (scormgame) {
                    if (scormgame && typeof scormgame.GetScoreRaw === 'function') {
                        return scormgame.GetScoreRaw() || '0';
                    } else {
                        return '0';
                    }
                },

                endScorm: function (scormgame) {
                    /*if (scormgame && typeof scormgame.quit == "function") scormgame.quit();*/
                },

                addButtonScoreNew: function (game, hasSCORMbutton, isInExe) {
                    if (typeof game !== 'object' || game === null) return;

                    let fB = '<div class="Games-BottonContainer d-flex align-items-center justify-content-end mx-auto p-0 w-100">';

                    if (game.isScorm == 2) {
                        const buttonText = game.textButtonScorm;
                        if (buttonText != "") {
                            fB += '<div class="Games-GetScore d-flex align-items-center justify-content-center w-100 mt-3">';
                            fB += `<input type="button" value="${buttonText}" class="Games-SendScore btn btn-primary btn-sm mx-1 my-1" /> <span class="Games-RepeatActivity"></span>`;
                            fB += '</div>';
                        }
                    } else if (game.isScorm == 1) {
                        fB += `<div class="Games-GetScore d-flex align-items-center justify-content-center w-100 mt-3"><span class="Games-RepeatActivity"></span></div>`;
                    }
                    fB += '</div>';
                    return fB;
                },

                parseJSONSafe: function (str) {
                    try {
                        return JSON.parse(str) || {};
                    } catch (e) {
                        console.error("parseJSONSafe: Error al parsear JSON. Usando objeto vacío como fallback.");
                        return {};
                    }
                },

                createScoreScormHtml: function (game) {
                    const $exeScoreNode = $("#exeScoreNode");

                    if ($exeScoreNode.length === 0) {
                        const newScoreNodeHtml = `
                                    <div id="exeScoreNode" class="text-end p-2">
                                        <div id="eXeScoreNodeScore" class="bg-success text-white d-inline-block px-2 py-1">
                                            ${game.msgs.msgYouScore}: 0/100
                                        </div>
                                    </div>
                                `;

                        let $page = $(".page-content");
                        if ($page.length === 0) {
                            $page = $("#node-content");
                        }
                        $("#exeScoreNode").remove();

                        if ($page.length > 0) {
                            $page.prepend(newScoreNodeHtml);
                        }
                    }
                },

                updateScormNew: function (game, lmsData) {
                    let previouScore = '';

                    if (lmsData && typeof pipwerks !== 'undefined' && pipwerks.SCORM) {
                        const scoreVal = parseFloat(lmsData[game.ideviceNumber]?.score);
                        previouScore = !Number.isNaN(scoreVal) ? (scoreVal / 10).toFixed(2) : '';
                        $exeDevices.iDevice.gamification.scorm.showFinalScore(lmsData, game);
                    }
                    const $gmain = game.main.charAt(0) === '.' ? $(`${game.main}`).eq(0) : $(`#${game.main}`).eq(0);

                    const $sendScore = $gmain.closest('article').find(".Games-SendScore"),
                        $repeatActivity = $gmain.closest('article').find(".Games-RepeatActivity");
                    game.repeatActivity = true;
                    let text = '';
                    if (typeof pipwerks === 'undefined' || !pipwerks.SCORM) {
                        text = game.msgs.msgScoreScorm;
                    } else if (game.isScorm === 1) {
                        if (game.repeatActivity && previouScore !== '') {
                            text = game.msgs.msgYouLastScore + ': ' + previouScore;
                        } else if (game.repeatActivity && previouScore === "") {
                            text = game.msgs.msgSaveAuto + ' ' + game.msgs.msgPlaySeveralTimes;
                        } else if (!game.repeatActivity && previouScore === "") {
                            text = game.msgs.msgOnlySaveAuto;
                        } else if (!game.repeatActivity && previouScore !== "") {
                            text = game.msgs.msgActityComply + ' ' + game.msgs.msgYouLastScore + ': ' + previouScore;
                        }
                    } else if (game.isScorm === 2) {
                        $sendScore.show();
                        if (game.repeatActivity && previouScore !== '') {
                            text = game.msgs.msgYouLastScore + ': ' + previouScore;
                        } else if (game.repeatActivity && previouScore === '') {
                            text = game.msgs.msgSeveralScore;
                        } else if (!game.repeatActivity && previouScore === '') {
                            text = game.msgs.msgOnlySaveScore;
                        } else if (!game.repeatActivity && previouScore !== '') {
                            $sendScore.hide();
                            text = game.msgs.msgActityComply + ' ' + game.msgs.msgYouScore + ': ' + previouScore;
                        }
                    }
                    $repeatActivity.text(text).fadeIn();
                },

                getFinalScore: function (lmsData) {
                    if (!lmsData) {
                        return 0;
                    }

                    const keys = Object.keys(lmsData);
                    if (keys.length === 0) {
                        return 0;
                    }
                    function clamp(num, min, max) {
                        return Math.max(min, Math.min(num, max));
                    }

                    let interactionsData = keys.map(key => {
                        const activity = lmsData[key] || {};
                        const scoreVal = parseFloat(activity.score) || 0;
                        const weightVal = parseFloat(activity.weighted) || 1;
                        return {
                            score: clamp(scoreVal, 0, 100),
                            weighted: clamp(weightVal, 1, 100),
                        };
                    });

                    let sumWeights = interactionsData.reduce((acc, item) => acc + item.weighted, 0);
                    const factor = (sumWeights !== 0) ? 100 / sumWeights : 1;
                    const tempWeights = interactionsData.map(item => {
                        const scaled = item.weighted * factor;
                        const floored = Math.floor(scaled);
                        const fraction = scaled - floored;
                        return {
                            score: item.score,
                            floored,
                            fraction
                        };
                    });

                    let sumFloors = tempWeights.reduce((acc, w) => acc + w.floored, 0);
                    let diff = 100 - sumFloors;

                    tempWeights.sort((a, b) => b.fraction - a.fraction);

                    for (let i = 0; i < tempWeights.length && diff !== 0; i++) {
                        if (diff > 0) {
                            tempWeights[i].floored += 1;
                            diff--;
                        }
                    }

                    function round2(num) {
                        return Math.round(num * 100) / 100;
                    }

                    let sumWeighted = 0;
                    tempWeights.forEach(item => {
                        sumWeighted += (item.score * item.floored);
                    });
                    const finalScore = round2(sumWeighted / 100);
                    return finalScore;
                },

                registerActivity: function (game) {
                    if (typeof game !== 'object' || game === null) return;

                    let lmsData = {};
                    if (typeof pipwerks !== 'undefined' && pipwerks.SCORM) {
                        game.mainElement = game.main.charAt(0) === '.' ? game.mainElement = $(`${game.main}`).eq(0) : game.mainElement = $(`#${game.main}`).eq(0);
                        $exeDevices.iDevice.gamification.scorm.createScoreScormHtml(game);
                        game.title = game.mainElement.closest('article')
                            .find('header .box-title').text() || '';
                        game.title = game.title.replace(/"/g, ' ');
                        let $idevices = $('.idevice_node');
                        let deviceId = game.mainElement.closest('.idevice_node').attr('id');
                        let index = $idevices.index($('#' + deviceId));

                        game.ideviceNumber = index + 1;

                        let suspendData = pipwerks.SCORM.get("cmi.suspend_data") || "";

                        lmsData = $exeDevices.iDevice.gamification.scorm.parseSuspendData(suspendData);

                        lmsData[game.ideviceNumber] = {
                            title: game.title,
                            score: lmsData[game.ideviceNumber]?.score || (game.scorerp * 10),
                            weighted: game.weighted
                        };

                        const newFormatData = $exeDevices.iDevice.gamification.scorm.convertToLineFormat(lmsData, game);
                        pipwerks.SCORM.set("cmi.suspend_data", newFormatData);
                    }

                    $exeDevices.iDevice.gamification.scorm.updateScormNew(game, lmsData);
                },

                convertToLineFormat: function (obj, game) {
                    return Object.keys(obj).map(key => {
                        const item = obj[key];
                        const num = parseInt(key, 10);
                        const title = item.title || "";
                        const score = item.score != null ? item.score : 0;
                        const weight = item.weighted ?? 0;
                        const msgScore = game.msgs.msgScore ?? "Puntuación";
                        const msgWeight = game.msgs.msgWeight ?? "Peso";

                        return `${num}. "${title}"; ${msgScore}: ${score}%; ${msgWeight}: ${weight}%`;
                    }).join('.\t');
                },

                parseActivity: function (line) {
                    const regex = /^(\d+)\.\s"(.*?)";\s[^:]+:\s([\d.]+)%;\s[^:]+:\s([\d.]+)%\.?$/;

                    const match = line.match(regex);

                    if (match) {
                        const [_, strIndex, title, score, weighted] = match;

                        return {
                            index: parseInt(strIndex, 10),
                            title: title.trim(),
                            score: parseFloat(score),
                            weighted: parseFloat(weighted)
                        }
                    }

                    return null;
                },

                parseSuspendData: function (data) {
                    let obj = {};

                    if (!data) return obj;

                    const lines = data.split('.\t');
                    lines.forEach(line => {
                        line = line.trim();
                        if (!line) return;

                        const activityData = $exeDevices.iDevice.gamification.scorm.parseActivity(line);

                        if (activityData) {
                            const { index, title, score, weighted } = activityData;
                            obj[index] = {
                                title: title.trim(),
                                score: parseFloat(score),
                                weighted: parseFloat(weighted)
                            };
                        }
                    });

                    return obj;
                },

                sendScoreNew: function (auto, game) {
                    if (typeof pipwerks === 'undefined' || !pipwerks.SCORM || typeof game !== 'object' || game === null) {
                        return;
                    }
                    const $gmain = game.main.charAt(0) === '.' ? $(`${game.main}`).eq(0) : $(`#${game.main}`).eq(0);
                    const $article = $gmain.closest('.idevice_node').eq(0);
                    const $sendScore = $article.find(".Games-SendScore");
                    const $repeatActivity = $article.find(".Games-RepeatActivity");

                    let message = '';
                    if (game.gameStarted || game.gameOver) {
                        game.repeatActivity = true;
                        const suspendData = pipwerks.SCORM.get("cmi.suspend_data") || "";
                        const lmsData = $exeDevices.iDevice.gamification.scorm.parseSuspendData(suspendData);
                        const scoreVal = parseFloat(lmsData[game.ideviceNumber]?.score);
                        const previousScore = !Number.isNaN(scoreVal) ? (scoreVal / 10).toFixed(2) : '';

                        const scoreNumber = parseFloat(game.scorerp);
                        const formattedScore = !isNaN(scoreNumber) ? scoreNumber.toFixed(2) : '0';
                        game.scorerp = formattedScore;

                        if (!auto) {
                            $sendScore.show();
                            if (!game.repeatActivity && previousScore !== '') {
                                message = game.userName !== ''
                                    ? (game.userName + ' ' + game.msgs.msgOnlySaveScore)
                                    : game.msgs.msgOnlySaveScore;
                            } else {
                                game.previousScore = formattedScore;
                                $exeDevices.iDevice.gamification.scorm.updateActivity(game, lmsData);

                                message = game.userName !== ''
                                    ? (game.userName + '. ' + game.msgs.msgYouScore + ': ' + formattedScore)
                                    : (game.msgs.msgYouScore + ': ' + formattedScore);

                                if (!game.repeatActivity) {
                                    $sendScore.hide();
                                }

                                $repeatActivity.text(game.msgs.msgYouScore + ': ' + formattedScore).show();
                            }
                        } else {
                            game.previousScore = formattedScore;
                            $exeDevices.iDevice.gamification.scorm.updateActivity(game, lmsData);
                            message = game.msgs.msgYouScore + ': ' + formattedScore;
                            $repeatActivity.text(message).show();
                        }

                    } else {
                        message = game.msgs.msgEndGameScore;
                    }

                    $repeatActivity.text(message).show();
                    if (!auto && message) {
                        alert(message);
                    }

                },

                updateActivity: function (game, lmsData) {
                    if (typeof pipwerks === 'undefined' || !pipwerks.SCORM || typeof game !== 'object' || game === null) {
                        return;
                    }

                    const updatedData = {
                        title: game.title,
                        score: game.scorerp * 10,
                        weighted: game.weighted
                    };
                    lmsData[game.ideviceNumber] = updatedData;

                    const newFormatData = $exeDevices.iDevice.gamification.scorm.convertToLineFormat(lmsData, game);

                    pipwerks.SCORM.set("cmi.suspend_data", newFormatData);

                    $exeDevices.iDevice.gamification.scorm.showFinalScore(lmsData, game);

                },

                showFinalScore: function (lmsData, game) {
                    if (typeof pipwerks === 'undefined' || !pipwerks.SCORM || typeof game !== 'object' || game === null) {
                        return;
                    }

                    if (!lmsData || typeof lmsData !== 'object') {
                        const suspendData = pipwerks.SCORM.get("cmi.suspend_data") || "";
                        lmsData = $exeDevices.iDevice.gamification.scorm.parseSuspendData(suspendData);
                    }

                    const newFinalScore = $exeDevices.iDevice.gamification.scorm.getFinalScore(lmsData);

                    pipwerks.SCORM.set("cmi.core.score.raw", newFinalScore);

                    if (newFinalScore >= 50) {
                        pipwerks.SCORM.set("cmi.core.lesson_status", "passed");
                    } else {
                        pipwerks.SCORM.set("cmi.core.lesson_status", "incomplete");
                    }

                    $("#eXeScoreNodeScore").text(`${game.msgs.msgYouScore}: ${newFinalScore}/100`);

                }
            },

            share: {
                getTab: function (allowtext = false, type = 0, exportquestion = false) {

                    const msgAddText = _("You can easily generate multiple questions for the activity using AI.")
                    const txt = allowtext ? ', .txt, .xml' : '';
                    const formtxt = allowtext ? ', txt, xml' : '';
                    const display = allowtext ? 'block' : 'none';
                    const displayEQ = exportquestion ? 'block' : 'none';
                    const msgimport = _('You can import questions compatible with this activity from txt or xml (Moodle) files.');
                    const fprompt = $exeDevices.iDevice.gamification.share.getAllowedFormats(type)
                    const tab = `
                            <div class="exe-form-tab" title="${_('Import/Export')}">
                                <p class="exe-block-info">${msgimport}</p>
                                <div id="eXeGameExportImport">
                                    <div>
                                        <form method="POST">
                                            <label for="eXeGameImportGame">${_("Import")}:</label>
                                            <input type="file" name="eXeGameImportGame" id="eXeGameImportGame" accept="${txt}" />
                                            <span class="exe-field-instructions">${_("Supported formats")}:${formtxt}</span>
                                        </form>
                                    </div>
                                    <div style="display:${display}">
                                        <p class="exe-block-info">${msgAddText}</p>
                                        <p><input type="button"  name="eXeGameAddQuestions" id="eXeGameAddQuestion" value="${_("Add questions")}" /></p>
                                        <div class="bg-white rounded border w-100 position-relative" style="display:none; max-width: 1400px;" id="eXeEAddArea">
                                            <ul class="nav nav-tabs">
                                                <li class="nav-item">
                                                    <a id="eXeETabPrompt" class="nav-link bg-light border-end active" href="#">
                                                    ${_('Prompt')}
                                                    </a>
                                                </li>
                                                <li class="nav-item">
                                                    <a id="eXeETabQuestions" class="nav-link bg-light border-end"  href="#">
                                                     ${_('Questions')}
                                                    </a>
                                                </li>                                          
                                                <li class="nav-item" style="display:none">
                                                    <a id="eXeETabIA" class="nav-link bg-light border-end" href="#">
                                                    ${_('Generate')}
                                                    </a>
                                                </li>
                                            </ul>
                                            <div class="eXeE-LightboxContent p-2">
                                                <textarea class="form-control font-monospace fs-6" style="min-height:350px;" id="eXeEPromptArea">
                                                    ${c_("Act as a teacher with many years of experience.")}
                                                    ${fprompt.prompt}
                                                    ${c_('Formats')}:
                                                    ${fprompt.format.join('\n')} 
                                                    ${fprompt.explanation}
                                                    ${c_('Examples')}:
                                                    ${fprompt.examples.join('\n')}
                                                    ${c_('You must return only the questions without numbering and without classification or bullet points, inside a code block, and do not include any additional HTML elements like buttons.')}, 
                                                </textarea>
                                                <textarea id="eXeEQuestionsArea" class="form-control font-monospace fs-6" style="min-height:350px;display:none"></textarea>
                                                <div  class="form-control font-monospace fs-6" id="eXeEIADiv"  style="display:none">
                                                    ${$exeDevices.iDevice.gamification.share.createIAButtonsHtml()}
                                                    <textarea class="form-control font-monospace fs-6" style="display:none" id="eXeEQuestionsIA"> </textarea>
                                                </div>
                                            </div>
                                            <div class="d-flex justify-content-end  border-secondary p-2">
                                               <button id="eXeESaveButton"  class="btn btn-success ms-2"/>${_('Save')}</button>
                                               <button id="eXeECopyButton"  class="btn btn-success ms-2"/>${_('Copy')}</button>
                                               <button id="eXeEIAButton"  class="btn btn-success ms-2"/>${_('Add questions')}</button>
                                            </div>
                                        </div>
                                    </div>
                                    <p class="exe-block-info" style="display:${displayEQ}" >${_('You can export its questions in txt format to integrate them into other compatible activities.')}</p>
                                    <p class ="d-flex align-items-center justify-content-start gap-1">
                                        <input type="button" lass="btn btn-success ms-2"  name="eXeGameExportGame" id="eXeGameExportQuestions" value="${_("Export questions")}" style="display:${displayEQ}" />
                                    </p>
                                </div>
                            </div>`;
                    return tab.replace(/[ \t]+/g, ' ').trim();
                },
                createIAButtonsHtml: function () {
                    return `<div id="eXeFormIAContainer">
                        <div class="dd-flex gap-2 mt-3 mb-3">
                            <label for="eXeSpecialtyIA">${_('Specialty')}:
                                <input list="specialtyList" id="eXeSpecialtyIA" name="specialty" value="${_('Biology')}" style="width: 150px;">
                                <datalist id="specialtyList">
                                    <option value="${_('Biology')}">
                                    <option value="${_('Law')}">
                                    <option value="${_('Economy')}">
                                    <option value="${_('Education')}">
                                    <option value="${_('Geology')}">
                                    <option value="${_('History')}">
                                    <option value="${_('Computer Science')}">
                                    <option value="${_('Mathematics')}">
                                    <option value="${_('Medicine')}">
                                    <option value="${_('Psychology')}">
                                    <option value="${_('Chemistry')}">
                                </datalist>
                            </label>
                            <label for="eXeCourseIA">${_('Course')}:
                                <input list="courseList" id="eXeCourseIA" name="course" value="${_('3rd ESO')}" style="width: 130px;">
                                <datalist id="courseList">
                                    <option value="${_('1st Primary')}">
                                    <option value="${_('2nd Primary')}">
                                    <option value="${_('3rd Primary')}">
                                    <option value="${_('4th Primary')}">
                                    <option value="${_('5th Primary')}">
                                    <option value="${_('6th Primary')}">
                                    <option value="${_('1st ESO')}">
                                    <option value="${_('2nd ESO')}">
                                    <option value="${_('3rd ESO')}">
                                    <option value="${_('4th ESO')}">
                                    <option value="${_('1st Baccalaureate')}">
                                    <option value="${_('2nd Baccalaureate')}">
                                    <option value="${_('Intermediate Vocational Training')}">
                                    <option value="${_('Higher Vocational Training')}">
                                </datalist>
                            </label>
                            <label for="eXeNumberOfQuestionsIA">${_('Number of Questions')}:
                                <input id="eXeNumberOfQuestionsIA" type="number" min="1" max="30" value="10">
                            </label>
                            <label for="eXeThemeIA">${_('Topic')}:
                                <input id="eXeThemeIA" type="text" style="width: 300px;">
                            </label>
                             <button id="eXeIAButton" class="btn btn-success ms-2">${_('Create')}</button>
                        </div>
                        <p id="eXeIAMessage" class="dp-none"></p>
                    </div>`;
                },


                getAllowedFormats: function (gameId) {
                    const gameFormats = {
                        0: { // Word/Definition
                            format: [`${c_('Word')}#${c_('Definition')}`],
                            explanation: `${c_('Neither the word nor the definition must contain #')}`,
                            examples: [`${c_('Heart')}#${c_('A muscular organ that pumps blood through the body')}`],
                            allowRegex: /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/,
                            prompt: c_(`Generate 10 words followed by their definitions, separated by #. Do not include the # character in either the word or the definition.`)
                        },
                        1: { // A-Z Quiz
                            format: [
                                `${c_('Word')}#${c_('Definition')}`,
                                `${c_('Word')}#${c_('Definition')}#${c_('Type')}#${c_('Letter')}`
                            ],
                            explanation: `${c_('Type will be 0 if the word starts with the letter and 1 if the word contains the letter')}`,
                            examples: [
                                `${c_('Atom')}#${c_('The basic unit of a chemical element')}`,
                                `${c_('Biology')}#${c_('The study of living organisms')}#0#${c_('B')}`
                            ],
                            allowRegex: /^([^#]+)#([^#]+)(#(0|1)(#[^#]+)?)?$/,
                            prompt: c_(`Generate 30 words and their definitions separated by #.`)
                        },
                        2: { // Test
                            format: [
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`
                            ],
                            explanation: `${c_('Solution: 0, 1, 2 or 3')}`,
                            examples: [
                                `1#${c_('What is the largest planet in the solar system?')}#${c_('Earth')}#${c_('Jupiter')}#${c_('Mars')}#${c_('Venus')}`,
                                `0#${c_('What is the process of plants making food?')}#${c_('Photosynthesis')}#${c_('Respiration')}#${c_('Digestion')}`
                            ],
                            allowRegex: /^(0|1|2|3)#([^#]+)#([^#]+)#([^#]+)(#[^#]+){0,2}$/,
                            prompt: c_(`Create 10 multiple-choice questions with 2 to 4 options. Start with the correct solution (0, 1, 2, or 3), followed by the question and each option, all separated by #.`)
                        },
                        3: { // Select
                            format: [
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`
                            ],
                            explanation: `${c_('Solution: Any combination of A,B,C and D: A, AC, CD...')}
                            `,
                            examples: [
                                `${c_('A')}#${c_('Which of the following are mammals?')}#${c_('Dog')}#${c_('Frog')}#${c_('Eagle')}#${c_('Lizard')}`,
                                `${c_('AB')}#${c_('Which gases are involved in photosynthesis?')}#${c_('Oxygen')}#${c_('Carbon dioxide')}#${c_('Nitrogen')}`
                            ],
                            allowRegex: /^(([0-3]|[A-D]{1,4})#[^#]+#[^#]+(?:#[^#]*){0,3}|[^#]+#[^#]+)$/,
                            prompt: c_(`Generate 10 questions with multiple-choice options. Provide the correct solution as letters (e.g., A, AB), followed by the question and the options, all separated by #.`)
                        },
                        4: { // Identify
                            prompt: c_(`Create 5 solution words followed by 3 to 9 clues that describe each one. Separate each clue with #.`),
                            format: [`${c_('Solution')}#${c_('Clue1')}#${c_('Clue2')}#${c_('Clue3')}#${c_('Clue4')}#${c_('Clue5')}...`],
                            explanation: `${c_('You must provide between 3 and 9 clues')}`,
                            examples: [
                                `${c_('Mercury')}#${c_('Closest planet to the Sun')}#${c_('Smallest planet')}#${c_('Named after a Roman god')}`
                            ],
                            allowRegex: /^([^#]+)(#([^#]+)){3,9}$/,
                        },
                        5: { // Classify
                            format: [`${c_('Group')}#${c_('Question')}`],
                            explanation: `${c_('Group: 0, 1, 2 or 3')}`,
                            examples: [
                                `0#${c_('Lion')}`,
                                `1#${c_('Rabbit')}`,
                                `0#${c_('Tiger')}`
                            ],
                            allowRegex: /^(0|1|2|3)#[^#]+$/,
                            prompt: c_(`Provide 4 elements for each of these groups: carnivores, 0, and herbivores, 1. Separate the group number and the element using the symbol #.`),
                        },
                        6: { // True or false
                            prompt: c_(`Generate 10 true or false questions. Each question must include the solution (0 = false, 1 = true), followed by a suggestion and feedback, all separated by #. Additionally, the feedback must not explicitly indicate whether the response is correct or incorrect`),
                            format: [`${c_('question')}#${c_('solution')}#${c_('suggestion')}#${c_('feedback')}`],
                            explanation: `${c_('The format requires a question (non-empty string), a solution (0 or 1), a suggestion (mandatory, can be empty), and feedback (mandatory, can be empty).')}`,
                            examples: [
                                `${c_('Is the Earth round?')}#1#${c_('Think about the horizon.')}#${c_('The Earth is not flat.')}`,
                                `${c_('Does water boil at 100 degrees Celsius?')}#0##${c_('It depends on altitude.')}`
                            ],
                            allowRegex: /^vof#[^\s#].*?#(0|1)#.*?#.*?|[^\s#].*?#(0|1)#.*?#.*?|[01]#[^#]+$/,
                        },
                        7: { // form
                            prompt: c_(`Generate 10 questions. The 'Solution' can be 0/1 for True/False, 0-3 for single-choice, or A-D (or combinations) for multiple-choice. Then provide the question and the answer options (2 to 4), all separated by '#'.`),
                            format: [
                                `${c_('Solution')}#${c_('Question')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}#${c_('OptionD')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}#${c_('OptionC')}`,
                                `${c_('Solution')}#${c_('Question')}#${c_('OptionA')}#${c_('OptionB')}`,
                            ],
                            explanation: `${c_('Solution can be:')} 
                              - ${c_('0 or 1 for True/False')}. Format: ${c_('Solution')}#${c_('Question')}
                              - ${c_('any digit from 0 to 3 for single-choice (up to 4 options)')} 
                              - ${c_('any combination of A-D for multiple-choice (up to 4 options).')}
                              ${c_('Provide a similar number of questions for each type.')}`,
                            examples: [
                                `1#${c_('Is the Earth round?')}`,
                                `3#${c_('Which number is prime?')}#4#6#11#12#14#15`,
                                `AB#${c_('Which of the following are mammals?')}#${c_("Dog")}#${c_("Frog")}#${c_("Eagle")}#${c_("Cat")}`
                            ],
                            allowRegex: /^(?:[01]#[^#]+|[0-5]#[^#]+(?:#[^#]+){2,6}|[A-F]{1,6}#[^#]+(?:#[^#]+){2,6})$/,
                        },
                        8: { // scrabled list
                            prompt: c_(`Provide only a single ordered list of steps or items, each separated by '#'.`),
                            format: [`${c_('first element')}#${c_('second element')}#${c_('third element')}#${c_('fourth element')}#${c_('fourth element')}...`],
                            explanation: `Ensure the list includes at least five elements.`,
                            examples: [
                                `${c_("Wake up")}#${c_("Have breakfast")}#${c_("Go to work")}`,
                            ],
                            allowRegex: /^[^#]+(?:#[^#]+){2,}$/,

                        },
                        9: { // crosswords
                            prompt: c_(`Generate 10 words followed by their definitions, separated by #. Do not include the # character in either the word or the definition`),
                            format: [`${c_('Word')}#${c_('Definition')}`],
                            explanation: `${c_('Neither the word nor the definition must contain #. The word must have a maximum of 14 letters and must not contain spaces.')}`,
                            examples: [`${c_('Heart')}#${c_('A muscular organ that pumps blood through the body')}`],
                            allowRegex: /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/
                        },
                    };

                    const game = gameFormats[gameId];

                    if (!game || !Array.isArray(game.format)) {
                        return { format: [], explanation: "", examples: [], allowRegex: '', prompt: '' };
                    }

                    return {
                        format: game.format,
                        explanation: game.explanation || "",
                        examples: game.examples || [],
                        allowRegex: game.allowRegex || '',
                        prompt: game.prompt || ''
                    };
                },

                addEvents: function (type, saveQuestions) {
                    const $textQuestionsArea = $('#eXeEQuestionsArea');
                    const $textPrompt = $('#eXeEPromptArea');
                    const $textAreaIa = $('#eXeEQuestionsIA');
                    const $divEIA = $('#eXeEIADiv');

                    const $tabQuestions = $('#eXeETabQuestions');
                    const $tabPrompt = $('#eXeETabPrompt');
                    const $tabIA = $('#eXeETabIA');

                    const $copyButton = $('#eXeECopyButton');
                    const $saveButton = $('#eXeESaveButton');
                    const $iaButton = $('#eXeEIAButton');

                    const $eXeGameAddQuestion = $('#eXeGameAddQuestion');
                    const $eXeEAddArea = $('#eXeEAddArea');

                    $saveButton.hide();
                    $textQuestionsArea.hide();

                    $textPrompt.show()
                    $copyButton.show();

                    $divEIA.hide();
                    $iaButton.hide()

                    $tabQuestions.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.addClass('active');
                        $tabPrompt.removeClass('active');
                        $tabIA.removeClass('active');
                        $textQuestionsArea.show();
                        $divEIA.hide();
                        $textPrompt.hide()
                        $saveButton.show();
                        $copyButton.hide();
                        $iaButton.hide();
                    });

                    $tabPrompt.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.removeClass('active');
                        $tabPrompt.addClass('active');
                        $tabIA.removeClass('active');
                        $textQuestionsArea.hide();
                        $divEIA.hide();
                        $textPrompt.show()
                        $saveButton.hide();
                        $copyButton.show();
                        $iaButton.hide();

                    });

                    $tabIA.on('click', function (e) {
                        e.preventDefault();
                        $tabQuestions.removeClass('active');
                        $tabPrompt.removeClass('active');
                        $tabIA.addClass('active');

                        $textQuestionsArea.hide();
                        $textPrompt.hide();
                        $divEIA.show();

                        $saveButton.hide();
                        $copyButton.hide();
                        $iaButton.hide();
                    });

                    $saveButton.on('click', function () {
                        const content = $textQuestionsArea.val().trim();
                        if (!content) {
                            alert(_("Please enter at least one question."));
                            return;
                        }
                        const questions = $exeDevices.iDevice.gamification.share.validateAndSave(type, $textQuestionsArea);

                        saveQuestions(questions.validLines);
                        if (questions.invalidLines.length > 0) {
                            alert(`The following lines are invalid:\n\n${questions.invalidLines.join('\n')}`);
                        } else {
                            alert('The questions have been added successfully');
                            $('.exe-form-tabs li:first-child a').trigger("click")
                        }
                    });
                    $iaButton.on('click', function () {
                        const content = $textAreaIa.val().trim();
                        if (!content) {
                            alert(_("Please enter at least one question."));
                            return;
                        }

                        const questions = $exeDevices.iDevice.gamification.share.validateAndSave(type, $textQuestionsArea);

                        saveQuestions(questions.validLines);
                        if (questions.invalidLines.length > 0) {
                            alert(`The following lines are invalid:\n\n${questions.invalidLines.join('\n')}`);
                        } else {
                            alert('The questions have been added successfully');
                            $('.exe-form-tabs li:first-child a').click();
                        }
                    });
                    $copyButton.on('click', function () {
                        const content = $textPrompt.val();
                        navigator.clipboard.writeText(content)
                            .then(() => console.log('Content copied to clipboard'))
                            .catch(err => console.error('Error copying content:', err));
                    });
                    $eXeGameAddQuestion.on('click', function () {
                        const currentDisplay = $eXeEAddArea.css('display');
                        if (currentDisplay === 'none') {
                            $eXeEAddArea.css('display', 'block');
                        } else if (currentDisplay === 'none') {
                            $eXeEAddArea.css('display', 'none');
                        }
                    });
                    $textQuestionsArea.on('paste', function (e) {
                        e.preventDefault();
                        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
                        const textarea = this;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
                        textarea.selectionStart = textarea.selectionEnd = start + text.length;
                    });

                    $('#eXeIAButton').on('click', function () {
                        $('#eXeIAMessage').text(_('Generating questions. Please wait...')).show();
                        $exeDevices.iDevice.gamification.share.genarateIAQuestons(type, saveQuestions);
                    });

                },
                genarateIAQuestons: async function (type, saveQuestions) {
                    $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', true);
                    const $specialty = $('#eXeSpecialtyIA');
                    const $course = $('#eXeCourseIA');
                    const $numQuestions = $('#eXeNumberOfQuestionsIA');
                    const $theme = $('#eXeThemeIA');
                    let promptText = `${_("Act as a teacher with many years of experience.")}`;

                    if ($specialty.length) {
                        const sp = $specialty.val().trim();
                        if (sp.length) {
                            promptText += ` ${_('Specialty')}: ${sp}.`;
                        }
                    }
                    if ($course.length) {
                        const cp = $course.val().trim();
                        if (cp.length) {
                            promptText += ` ${_('For students of')} ${cp}.`;
                        }
                    }
                    if ($theme.length) {
                        const tm = $theme.val().trim();
                        if (tm) {
                            promptText += ` ${_('on the following topic')}: ${tm}.`;
                        }
                    }
                    if ($numQuestions.length) {
                        let np = $numQuestions.val();
                        np = np ?? 10;
                        promptText += `${_('Generate')} ${np} ${_('questions')}`;
                    }
                    if ($numQuestions.length) {
                        let np = $numQuestions.val();
                        np = np ?? 10;
                        promptText += `${_('With the following formats:')}`;
                    }

                    const fprompt = $exeDevices.iDevice.gamification.share.getAllowedFormats(type);
                    let prompt = `
                        ${promptText}
                        ${fprompt.format.join('\n')}
                        ${fprompt.explanation}
                        ${_('Examples')}:
                        ${fprompt.examples.join('\n')}  
                        ${_('You must return only the questions without numbering and without classification or bullet points')},                    
                    `;

                    let sdata = '';
                    prompt = prompt.replace(/[ \t]+/g, ' ').trim();

                    try {
                        const data = await eXeLearning.app.api.getGenerateQuestions(prompt);

                        if (data.questions) {
                            let questions = $exeDevices.iDevice.gamification.share.checkQuestions(data.questions);
                            if (questions) {
                                const correctsQuestions = $exeDevices.iDevice.gamification.share.validateQuesionsIA(type, questions);
                                saveQuestions(correctsQuestions);
                            } else {
                                sdata = _('Could not generate the questions');
                                $('#eXeIAMessage').text(_(sdata)).show();
                            }
                        } else {
                            sdata = _('Could not generate the questions. Incorrect format');
                            $('#eXeIAMessage').text(_(sdata)).show();
                        }
                        $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', false);
                    } catch (error) {
                        sdata = _('An error occurred while retrieving the questions. Please try again.');
                        $('#eXeIAMessage').text(_(sdata)).show();
                        $('#eXeFormIAContainer').find('input, textarea, button, select').prop('disabled', false);
                    }
                },

                cleanText: function (input) {
                    const lines = input.split(/\r?\n/);
                    const cleanedLines = lines.map(line => {
                        line = line.trim();
                        line = line.replace(/\s+/g, ' ');
                        return line;
                    });
                    return cleanedLines.join('\n');
                },
                checkQuestions: function (lines) {
                    if (Array.isArray(lines) && lines.length > 0) {
                        return lines;
                    }
                    if (typeof lines === 'string') {
                        try {
                            lines = JSON.parse(lines);
                        } catch (error) {
                            return false;
                        }
                    }
                    if (typeof lines === 'object' && lines !== null) {
                        lines = Object.values(lines);
                    }
                    if (Array.isArray(lines) && lines.length > 0) {
                        return lines;
                    }

                    return false;
                },


                validateAndSave: function (gameId, $textQuestionsArea) {
                    const lines = $textQuestionsArea.val().trim().split('\n');
                    const validLines = [];
                    const invalidLines = [];
                    const regex = $exeDevices.iDevice.gamification.share.getAllowedFormats(gameId).allowRegex;

                    lines.forEach((line) => {
                        const cleanLine = line.trim();

                        if (regex.test(cleanLine)) {
                            validLines.push(cleanLine);
                        } else if (cleanLine.length > 0) {
                            invalidLines.push(cleanLine);
                        }
                    });
                    $textQuestionsArea.val(invalidLines.join('\n'));
                    return {
                        validLines: validLines,
                        invalidLines: invalidLines
                    }
                },

                validateQuesionsIA: function (gameId, lines) {
                    const validLines = [];
                    const invalidLines = [];
                    const regex = $exeDevices.iDevice.gamification.share.getAllowedFormats(gameId).allowRegex;

                    lines.forEach((line) => {
                        const cleanLine = line.trim();
                        if (regex.test(cleanLine)) {
                            validLines.push(cleanLine);
                        } else if (cleanLine.length > 0) {
                            invalidLines.push(cleanLine);
                        }
                    });

                    return validLines;
                },

                exportGame: function (dataGame, idevice, name) {

                    if (!dataGame) return false;

                    var blob = JSON.stringify(dataGame),
                        newBlob = new Blob([blob], {
                            type: "text/plain"
                        });

                    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
                        window.navigator.msSaveOrOpenBlob(newBlob);
                        return;
                    }

                    const data = window.URL.createObjectURL(newBlob);

                    var link = document.createElement('a');
                    link.href = data;

                    link.download = `${_("Activity")}-${name}.json`;
                    document.getElementById(idevice).appendChild(link);
                    link.click();

                    setTimeout(function () {
                        document.getElementById(idevice).removeChild(link);
                        window.URL.revokeObjectURL(data);
                    }, 100);
                },
                import: {

                    text: function (content, addWords) {
                        const lines = content.split('\n');
                        $exeDevices.iDevice.gamification.share.import.insertWords(lines, wordsgame);
                    },
                    insertWords: function (lines, addWords) {
                        const lineFormat = /^([^#]+)#([^#]+)(#([^#]+))?(#([^#]+))?$/;
                        let words = [];
                        lines.forEach((line) => {
                            if (lineFormat.test(line)) {
                                const p = $exeDevice.getCuestionDefault();
                                const parts = line.split('#');
                                p.word = parts[0];
                                p.definition = parts[1];
                                if (p.word && p.definition) {
                                    words.push(p);
                                }
                            }

                        });
                        $exeDevices.iDevice.gamification.share.import.addWords(words, wordsgame)
                    },
                    moodle: function (xmlString, addWords) {
                        const xmlDoc = $.parseXML(xmlString),
                            $xml = $(xmlDoc);
                        if ($xml.find("GLOSSARY").length > 0) {
                            $exeDevices.iDevice.gamification.share.import.glosary(xmlString, wordsgame);
                        } else if ($xml.find("quiz").length > 0) {
                            $exeDevices.iDevice.gamification.share.import.cuestionaryxml(xmlString, wordsgame);
                        } else {
                            eXe.app.alert(_('Sorry, wrong file format'));
                        }
                    },
                    cuestionaryxml: function (xmlText, addWords) {
                        const parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xmlText, "text/xml"),
                            $xml = $(xmlDoc);

                        if ($xml.find("parsererror").length > 0) {
                            return false;
                        }

                        const $quiz = $xml.find("quiz").first();
                        if ($quiz.length === 0) {
                            return false;
                        }

                        const words = [];
                        $quiz.find("question").each(function () {
                            const $question = $(this),
                                type = $question.attr('type');
                            if (type !== 'shortanswer') {
                                return true;
                            }
                            const questionText = $question.find("questiontext").first().text().trim(),
                                $answers = $question.find("answer");
                            let word = '',
                                maxFraction = -1;

                            $answers.each(function () {
                                const $answer = $(this),
                                    answerText = $answer.find('text').eq(0).text(),
                                    currentFraction = parseInt($answer.attr('fraction'), 10);
                                if (currentFraction > maxFraction) {
                                    maxFraction = currentFraction;
                                    word = answerText;
                                }
                            });
                            if (word && questionText) {
                                let wd = {
                                    word: $exeDevice.removeTags(word),
                                    definition: $exeDevice.removeTags(questionText)
                                }
                                words.push(wd);
                            }
                        });
                        addWords(words)
                    },

                    glosary: function (xmlText, addWords) {
                        const parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xmlText, "text/xml"),
                            $xml = $(xmlDoc);

                        if ($xml.find("parsererror").length > 0) return false;

                        const $entries = $xml.find("ENTRIES").first();
                        if ($entries.length === 0) return false;

                        const words = [];
                        $entries.find("ENTRY").each(function () {
                            const concept = $(this).find("CONCEPT").text(),
                                definition = $(this).find("DEFINITION").text().replace(/<[^>]*>/g, '');
                            if (concept && definition) {
                                let wd = {
                                    word: concept,
                                    definition: definition
                                }
                                words.push(wd);
                            }
                        });
                        addWords(words);
                    },
                },
            },

            colors: {
                borderColors: {
                    black: "#1c1b1b",
                    blue: '#5877c6',
                    green: '#00a300',
                    red: '#b3092f',
                    white: '#f9f9f9',
                    yellow: '#f3d55a',
                    grey: '#777777',
                    incorrect: '#d9d9d9',
                    correct: '#00ff00'
                },
                backColor: {
                    black: "#1c1b1b",
                    blue: '#dfe3f1',
                    green: '#caede8',
                    red: '#fbd2d6',
                    white: '#f9f9f9',
                    yellow: '#fcf4d3',
                    correct: '#dcffdc',
                    blackl: '#333333'
                },
            },

            report: {
                updateEvaluationIcon: function (game, isInExe) {
                    if (game && game.id && game.evaluation && game.evaluationID && game.evaluationID.length > 0) {
                        const data = $exeDevices.iDevice.gamification.report.getDataStorage(game.evaluationID);
                        const $gmain = game.main.charAt(0) === '.' ? $(`${game.main}`).eq(0) : $(`#${game.main}`).eq(0);

                        let score = '',
                            state = 0;

                        if (!data) {
                            $exeDevices.iDevice.gamification.report.showEvaluationIcon(game, state, score);
                            return;
                        }

                        const findObject = data.activities.find(
                            obj => obj.id === game.id
                        );

                        if (findObject) {
                            state = findObject.state;
                            score = findObject.score;
                        }

                        $exeDevices.iDevice.gamification.report.showEvaluationIcon(game, state, score);

                        const anchorId = 'ac-' + game.id;
                        $(`#${anchorId}`).remove();
                        $gmain.closest(`.${game.idevice}`).prepend(`<div id="${anchorId}"></div>`);

                        if ($exe.isInExe() || location.protocol === 'file:' || typeof window.API !== 'undefined' ||
                            typeof window.API_1484_11 !== 'undefined') {
                            return;
                        }

                        if (document.readyState === 'complete') {
                            $exeDevices.iDevice.gamification.report.scrollToHash();
                        } else {
                            $(window).on('load', $exeDevices.iDevice.gamification.report.scrollToHash);
                        }
                    }
                },

                showEvaluationIcon: function (game, state, score) {
                    if (typeof game !== 'object' || game === null) return;

                    const $main = game.main.charAt(0) === '.' ? $(`${game.main}`).eq(0) : $(`#${game.main}`).eq(0),
                        scoreNumber = parseFloat(score),
                        formattedScore = !isNaN(scoreNumber) ? scoreNumber.toFixed(2) : '0',
                        $header = $main.closest(`.${game.idevice}`);

                    let icon = 'exequextsq.png',
                        text = game.msgs.msgUncompletedActivity;

                    if (state === 1) {
                        icon = 'exequextrerrors.png';
                        text = game.msgs.msgUnsuccessfulActivity.replace('%s', formattedScore);
                    } else if (state === 2) {
                        icon = 'exequexthits.png';
                        text = game.msgs.msgSuccessfulActivity.replace('%s', formattedScore);
                    }

                    $header.find('.Games-ReportIconDiv').remove()

                    const sicon = `<div class="Games-ReportIconDiv d-flex justify-content-start align-items-center w-100 mb-1" style="gap: 0.1em;">
                            <img src="${game.idevicePath}${icon}" style="width:16px; height:16px; display:block;"><span style="font-size:0.9em;">${text}</span>
                        </div>`;

                    $header.prepend(sicon);
                },

                updateEvaluation: function (obj1, obj2, id1) {
                    if (!obj1) {
                        obj1 = {
                            id: id1,
                            activities: []
                        };
                    }
                    const findObject = obj1.activities.find(
                        obj => obj.id === obj2.id
                    );
                    if (findObject) {
                        findObject.state = obj2.state;
                        findObject.score = obj2.score;
                        findObject.name = obj2.name;
                        findObject.date = obj2.date;
                        findObject.page = obj2.page;
                    } else {
                        obj1.activities.push({
                            id: obj2.id,
                            type: obj2.type,
                            name: obj2.name,
                            score: obj2.score,
                            date: obj2.date,
                            state: obj2.state,
                            page: obj2.page,
                        });
                    }
                    return obj1;
                },

                getDateString: function () {
                    const currentDate = new Date(),
                        day = String(currentDate.getDate()).padStart(2, '0'),
                        month = String(currentDate.getMonth() + 1).padStart(2, '0'),
                        year = String(currentDate.getFullYear()).padStart(4, '0'),
                        hours = String(currentDate.getHours()).padStart(2, '0'),
                        minutes = String(currentDate.getMinutes()).padStart(2, '0'),
                        seconds = String(currentDate.getSeconds()).padStart(2, '0');
                    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

                },

                getNodeIdevice: function () {
                    let node = false;
                    if (!$exe.isInExe()) {
                        const pathSegments = window.location.pathname.split('/').filter(Boolean);
                        node = pathSegments.pop()
                    }
                    return node;
                },

                getNameIdevice: function ($main) {
                    const selector = $exe.isInExe() ? 'header.box-head .box-title' : '.box-title';
                    return $main.closest('article').find(selector).eq(0).text();
                },

                saveEvaluation: function (game,) {
                    if (game && game.id && game.evaluation && game.evaluationID.length > 0) {
                        const $main = game.main.charAt(0) === '.' ? $(`${game.main}`).eq(0) : $(`#${game.main}`).eq(0);
                        const name = $exeDevices.iDevice.gamification.report.getNameIdevice($main),
                            score = game.scorerp,
                            formattedDate = $exeDevices.iDevice.gamification.report.getDateString(),
                            scorm = {
                                'id': game.id,
                                'type': game.msgs.msgTypeGame,
                                'name': name,
                                'score': score,
                                'date': formattedDate,
                                'state': (parseFloat(score) >= 5 ? 2 : 1),
                                'page': $exeDevices.iDevice.gamification.report.getNodeIdevice()
                            },
                            data = $exeDevices.iDevice.gamification.report.updateEvaluation($exeDevices.iDevice.gamification.report.getDataStorage(game.evaluationID), scorm, game.id);

                        localStorage.setItem('dataEvaluation-' + game.evaluationID, JSON.stringify(data));
                        $exeDevices.iDevice.gamification.report.showEvaluationIcon(game, scorm.state, scorm.score);
                    }

                },

                getDataStorage: function (id) {
                    return $exeDevices.iDevice.gamification.helpers.isJsonString(localStorage.getItem('dataEvaluation-' + id));
                },

                scrollToHash: function () {

                    if ($exe.isInExe() || location.protocol === 'file:') return;

                    var hash = window.location.hash;
                    if (!hash) return;

                    var id = hash.substring(1);
                    var pending = localStorage.getItem('hashScrolled');
                    if (pending !== id) return;
                    var $target = $('#' + id);
                    if ($target.length && $target.hasClass('idevice_node')) {
                        $('html, body').scrollTop($target.offset().top);
                    }
                },

            },

            math: {
                loadMathJax: function () {
                    if (!window.MathJax) window.MathJax = $exe.math.engineConfig;
                    const script = document.createElement('script');
                    script.src = $exe.math.engine;
                    script.async = true;
                    document.head.appendChild(script);
                },

                updateLatex: function (selector) {
                    setTimeout(() => {
                        if (typeof MathJax !== "undefined") {
                            try {
                                const nodos = document.querySelectorAll(selector);
                                if (MathJax.Hub && typeof MathJax.Hub.Queue === "function") {
                                    nodos.forEach(nodo => MathJax.Hub.Queue(["Typeset", MathJax.Hub, nodo]));
                                } else if (typeof MathJax.typeset === "function") {
                                    MathJax.typesetClear([...nodos]);
                                    MathJax.typeset([...nodos]);
                                }
                            } catch (error) {
                                console.log('Error al refrescar MathJax:', error);
                            }
                        }
                    }, 100);
                }
            },

            media: {
                extractURLGD: function (urlmedia) {
                    let sUrl = urlmedia;

                    if (
                        typeof urlmedia !== 'undefined' &&
                        urlmedia.length > 0 &&
                        urlmedia.toLowerCase().startsWith('https://drive.google.com') &&
                        urlmedia.toLowerCase().includes('sharing')
                    ) {
                        sUrl = sUrl.replace(
                            /https:\/\/drive\.google\.com\/file\/d\/(.*?)\/.*?\?usp=sharing/g,
                            'https://docs.google.com/uc?export=open&id=$1'
                        );
                    } else if (
                        typeof urlmedia !== 'undefined' &&
                        urlmedia.length > 10 &&
                        $exeDevices.iDevice.gamification.media.getURLAudioMediaTeca(urlmedia)
                    ) {
                        sUrl = $exeDevices.iDevice.gamification.media.getURLAudioMediaTeca(urlmedia);
                    }

                    return sUrl;
                },

                getURLVideoMediaTeca: function (url) {
                    if (!url) return false;

                    if (url.includes("https://mediateca.educa.madrid.org/video/")) {
                        const id = url.split("https://mediateca.educa.madrid.org/video/")[1].split("?")[0];
                        return `http://mediateca.educa.madrid.org/streaming.php?id=${id}`;
                    }

                    return false;
                },

                getURLAudioMediaTeca: function (url) {
                    if (!url) return false;

                    let id = '';
                    if (url.includes("https://mediateca.educa.madrid.org/audio/")) {
                        id = url.split("https://mediateca.educa.madrid.org/audio/")[1].split("?")[0];
                    } else if (url.includes("https://mediateca.educa.madrid.org/video/")) {
                        id = url.split("https://mediateca.educa.madrid.org/video/")[1].split("?")[0];
                    } else {
                        return false;
                    }
                    return `https://mediateca.educa.madrid.org/streaming.php?id=${id}`;
                },

                getIDYoutube: function (url) {
                    if (!url) return "";
                    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/,
                        match = url.match(regExp);
                    return (match && match[2].length === 11) ? match[2] : "";
                },

                loadYoutubeApi: function (youTubeReady) {
                    onYouTubeIframeAPIReady = youTubeReady;
                    var tag = document.createElement('script');
                    tag.src = "https://www.youtube.com/iframe_api";
                    var firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                },

                stopSound: function (game) {
                    if (typeof game !== 'object' || game === null) return;
                    if (game.playerAudio && typeof game.playerAudio.pause === "function") {
                        game.playerAudio.pause();
                        game.playerAudio.currentTime = 0;
                    }
                },

                playSound: function (selectedFile, game) {
                    if (typeof game !== 'object' || game === null) return;
                    selectedFile = $exeDevices.iDevice.gamification.media.extractURLGD(selectedFile);

                    if (game.playerAudio && !game.playerAudio.paused) {
                        game.playerAudio.pause();
                    }

                    if (!game.playerAudio || game.playerAudio.src !== selectedFile) {
                        game.playerAudio = new Audio(selectedFile);
                        game.playerAudio.play().catch(error => console.error("Error playing audio:", error));
                    } else if (game.playerAudio.paused) {
                        game.playerAudio.play().catch(error => console.error("Error playing audio:", error));
                    }
                },

                startVideo: function (id, start, end, game, type, instance, updateTimerDisplayLocal) {
                    if (typeof game !== 'object' || game === null) return;

                    const mstart = start < 1 ? 0.1 : start;

                    if (type === 1) {
                        if (game.localPlayer) {
                            game.pointEnd = end;
                            game.localPlayer.src = id
                            game.localPlayer.currentTime = parseFloat(start)
                            if (typeof game.localPlayer.play == "function") {
                                game.localPlayer.play();
                            }
                        }
                        clearInterval(game.timeUpdateInterval);
                        game.timeUpdateInterval = setInterval(function () {
                            updateTimerDisplayLocal(instance);
                        }, 1000);
                        return;
                    }

                    if (game.player && typeof game.player.loadVideoById == "function") {
                        game.player.loadVideoById({
                            'videoId': id,
                            'startSeconds': mstart,
                            'endSeconds': end
                        });
                    }
                },

                startVideoIntro: function (id, start, end, game, instance, type, updateTimerDisplayLocalIntro) {
                    if (typeof game !== 'object' || game === null) return;

                    const mstart = start < 1 ? 0.1 : start;

                    if (type === 1) {
                        if (game.localPlayerIntro) {
                            game.pointEndIntro = end;
                            game.localPlayerIntro.src = id
                            game.localPlayerIntro.currentTime = parseFloat(start)
                            if (typeof game.localPlayerIntro.play == "function") {
                                game.localPlayerIntro.play();
                            }
                        }
                        clearInterval(game.timeUpdateIntervalIntro);
                        game.timeUpdateIntervalIntro = setInterval(function () {
                            updateTimerDisplayLocalIntro(instance);
                        }, 1000);
                        return
                    }

                    if (game.playerIntro) {
                        if (typeof game.playerIntro.loadVideoById == "function") {
                            game.playerIntro.loadVideoById({
                                'videoId': id,
                                'startSeconds': mstart,
                                'endSeconds': end
                            });
                        }
                    }
                },

                stopVideo: function (game) {
                    if (typeof game !== 'object' || game === null) return;

                    if (game.localPlayer && typeof game.localPlayer.pause === "function") {
                        game.localPlayer.pause();
                    }
                    if (game.player && typeof game.player.pauseVideo === "function") {
                        game.player.pauseVideo();
                    }
                },

                playVideo: function (game) {
                    if (game && game.player && typeof game.player.playVideo == "function") {
                        game.player.playVideo();
                    }
                },

                stopVideo: function (game) {
                    if (game && game.localPlayer && typeof game.localPlayer.pause === "function") {
                        game.localPlayer.pause();
                    }
                    if (game && game.player && typeof game.player.pauseVideo === "function") {
                        game.player.pauseVideo();
                    }
                },

                stopVideoIntro: function (game) {
                    if (typeof game !== 'object' || game === null) return;

                    if (game.localPlayerIntro && typeof game.localPlayerIntro.pause == "function") {
                        game.localPlayerIntro.pause();
                    }

                    if (game.playerIntro && typeof game.playerIntro.pauseVideo == "function") {
                        game.playerIntro.pauseVideo();
                    }
                },

                muteVideo: function (mute, game) {
                    if (game && game.localPlayer) {
                        if (mute) {
                            game.localPlayer.muted = true;
                        } else {
                            game.localPlayer.muted = false;;
                        }
                    }
                    if (game && game.player) {
                        if (mute) {
                            if (typeof game.player.mute == "function") {
                                game.player.mute();
                            }
                        } else {
                            if (typeof game.player.unMute == "function") {
                                game.player.unMute();
                            }
                        }
                    }
                },

                YouTubeAPILoader: (function () {
                    let apiReadyPromise;

                    function load() {
                        if (!apiReadyPromise) {
                            apiReadyPromise = new Promise((resolve, reject) => {
                                if (window.YT && window.YT.Player) {
                                    return resolve(window.YT);
                                }
                                window.onYouTubeIframeAPIReady = () => resolve(window.YT);
                                const tag = document.createElement('script');
                                tag.src = 'https://www.youtube.com/iframe_api';
                                tag.onerror = () => reject(new Error('No se pudo cargar la API de YouTube'));
                                document.head.appendChild(tag);
                            });
                        }
                        return apiReadyPromise;
                    }

                    return { load };
                })(),

            },

            helpers: {
                isJsonString: function (str) {
                    if (typeof str !== 'string') return false;
                    str = str.trim();
                    if (str.startsWith('{') && str.endsWith('}')) {
                        try {
                            const o = JSON.parse(str);
                            if (o && typeof o === 'object' && !Array.isArray(o)) {
                                return o;
                            }
                        } catch (e) {
                            return false;
                        }
                    }
                    return false;
                },

                shuffleAds: function (arr) {
                    if (Array.isArray(arr)) {
                        for (let i = arr.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [arr[i], arr[j]] = [arr[j], arr[i]];
                        }
                    }
                    return arr;
                },

                decrypt: function (str) {
                    str = str || "";
                    str = (str === "undefined" || str === "null") ? "" : str;
                    str = unescape(str);
                    try {
                        const key = 146;
                        let pos = 0,
                            ostr = '';
                        while (pos < str.length) {
                            ostr += String.fromCharCode(key ^ str.charCodeAt(pos));
                            pos += 1;
                        }
                        return ostr;
                    } catch (ex) {
                        return '';
                    }
                },

                encrypt: function (str = '') {
                    if (!str || str === 'undefined' || str === 'null') str = '';
                    try {
                        const key = 146;
                        return escape(str.split('').map(char => String.fromCharCode(char.charCodeAt(0) ^ key)).join(''));
                    } catch (ex) {
                        return '';
                    }
                },

                exitFullscreen: function () {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                },

                getFullscreen: function (element) {
                    if (element.requestFullscreen) {
                        element.requestFullscreen();
                    } else if (element.mozRequestFullScreen) {
                        element.mozRequestFullScreen();
                    } else if (element.webkitRequestFullscreen) {
                        element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
                    } else if (element.msRequestFullscreen) {
                        element.msRequestFullscreen();
                    }
                },

                toggleFullscreen: function (element) {
                    const elem = element || document.documentElement;
                    if (!document.fullscreenElement && !document.mozFullScreenElement &&
                        !document.webkitFullscreenElement && !document.msFullscreenElement) {
                        $exeDevices.iDevice.gamification.helpers.getFullscreen(elem);
                    } else {
                        $exeDevices.iDevice.gamification.helpers.exitFullscreen();
                    }
                },

                supportedBrowser: function (idevice) {
                    const isSupported = !(navigator.appName === 'Microsoft Internet Explorer' || navigator.userAgent.includes('MSIE '));
                    if (!isSupported) {
                        const bns = $(`.${idevice}-bns`).eq(0).text() || 'Your browser is not compatible with this tool.';
                        $(`.${idevice}-instructions`).text(bns);
                    }
                    return isSupported;
                },

                getTimeSeconds: function (iT) {
                    const times = [15, 30, 60, 180, 300, 600]
                    if ((iT) < times.length) return times[iT];
                    return iT;

                },

                getTimeToString: function (iTime) {
                    const mMinutes = Math.floor(iTime / 60) % 60,
                        mSeconds = iTime % 60,
                        formattedMinutes = mMinutes < 10 ? `0${mMinutes}` : mMinutes,
                        formattedSeconds = mSeconds < 10 ? `0${mSeconds}` : mSeconds;
                    return `${formattedMinutes}:${formattedSeconds}`;
                },

                getQuestions: function (questions, percentage) {
                    const totalQuestions = questions.length;

                    if (percentage >= 100) return questions;

                    const num = Math.max(1, Math.round((percentage * totalQuestions) / 100));

                    if (num >= totalQuestions) return questions;

                    const indices = Array.from({ length: totalQuestions }, (_, i) => i);
                    $exeDevices.iDevice.gamification.helpers.shuffleAds(indices);

                    const selectedIndices = indices.slice(0, num).sort((a, b) => a - b),
                        selectedQuestions = selectedIndices.map(index => questions[index]);

                    return selectedQuestions;
                },
                removeTags: (str) => {
                    const wrapper = $("<div></div>").html(str);
                    return wrapper.text();
                },

                generarID: function () {
                    const fecha = new Date(),
                        a = fecha.getUTCFullYear(),
                        m = fecha.getUTCMonth() + 1,
                        d = fecha.getUTCDate(),
                        h = fecha.getUTCHours(),
                        min = fecha.getUTCMinutes(),
                        s = fecha.getUTCSeconds(),
                        o = fecha.getTimezoneOffset();
                    return `${a}${m}${d}${h}${min}${s}${o}`;
                },

                hourToSeconds: function (str) {
                    let time = str.split(":");
                    if (time.length === 1) time = ["00", "00", time[0]];
                    if (time.length === 2) time = ["00", ...time];
                    return (+time[0] * 60 * 60) + (+time[1] * 60) + (+time[2]);
                },

                secondsToHour2: function (totalSec) {
                    const time = Math.round(totalSec),
                        hours = parseInt(time / 3600) % 24,
                        minutes = parseInt(time / 60) % 60,
                        seconds = time % 60;
                    return (hours < 10 ? "0" + hours : hours) + ":" +
                        (minutes < 10 ? "0" + minutes : minutes) + ":" +
                        (seconds < 10 ? "0" + seconds : seconds);
                },

                secondsToHour: function (totalSec) {
                    const time = Math.round(totalSec),
                        hours = String(Math.floor(time / 3600)).padStart(2, '0'),
                        minutes = String(Math.floor((time % 3600) / 60)).padStart(2, '0'),
                        seconds = String(time % 60).padStart(2, '0');
                    return `${hours}:${minutes}:${seconds}`;
                },

                arrayMove: function (arr, oldIndex, newIndex) {
                    if (newIndex >= arr.length) {
                        var k = newIndex - arr.length + 1;
                        while (k--) {
                            arr.push(undefined);
                        }
                    }
                    arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
                },

                showFullscreenImage: function (imageSrc, $container) {
                    const $overlay = $('<div>', {
                        class: 'Games-OverlayImage position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center',
                        css: {
                            display: 'none',
                            'background-color': 'rgba(0, 0, 0, 0.8)',
                            'z-index': 2000
                        }
                    });
                    const $image = $('<img>', {
                        src: imageSrc,
                        class: 'Games-FullScreenImage mw-100 object-fit-contain',
                        css: {
                            'max-height': '100%',
                            'z-index': 2000
                        },
                        alt: 'Image'
                    });

                    $overlay.append($image);

                    const $ctn = $exeDevices.iDevice.gamification.helpers.isFullscreen()
                        ? $container
                        : $('body');

                    $ctn.append($overlay);

                    $overlay.fadeIn(300);

                    $overlay.on('click', function () {
                        $overlay.fadeOut(300, function () {
                            $overlay.remove();
                        });
                    });
                },

                isFullscreen: function () {

                    const fullscreenSupported = !!(
                        document.fullscreenEnabled ||
                        document.webkitFullscreenEnabled ||
                        document.mozFullScreenEnabled ||
                        document.msFullscreenEnabled
                    );

                    if (!fullscreenSupported) return false;
                    const isFullscreenActive = !!(
                        document.fullscreenElement ||
                        document.webkitFullscreenElement ||
                        document.mozFullScreenElement ||
                        document.msFullscreenElement
                    );

                    return isFullscreenActive;
                }

            },
            observers: {
                debounce: function (func, wait) {
                    let timeout;
                    return function (...args) {
                        const later = () => {
                            clearTimeout(timeout);
                            func(...args);
                        };
                        clearTimeout(timeout);
                        timeout = setTimeout(later, wait);
                    };
                },

                observeMutations: function ($idevice, element) {
                    if (!element) return;

                    if (!$idevice.observers) $idevice.observers = new Map();

                    if ($idevice.observers.has(element)) return $idevice.observers.get(element);

                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            const mode = element.getAttribute('mode');
                            if (
                                (mutation.attributeName === 'mode' && mode === 'edition') ||
                                (mutation.attributeName === 'node-selected' && mode === 'view')
                            ) {
                                $exeDevices.iDevice.gamification.observers.observersDisconnect($idevice);
                            }
                        });
                    });

                    observer.observe(element, {
                        attributes: true,
                        attributeFilter: ['mode', 'node-selected'],
                    });

                    $idevice.observers.set(element, observer);

                    return observer;
                },

                observeResize: function ($idevice, element) {
                    if (!element) return;

                    if (!$idevice.observersresize) $idevice.observersresize = new Map();
                    if ($idevice.observersresize.has(element)) return $idevice.observersresize.get(element);
                    const resizeObserver = new ResizeObserver($exeDevices.iDevice.gamification.observers.debounce(resizeEntries => {
                        const isMap = $idevice.options instanceof Map;
                        const isArray = Array.isArray($idevice.options)
                        const optionEntries = isMap
                            ? $idevice.options.entries()
                            : isArray
                                ? $idevice.options.entries()
                                : [];
                        for (let [keyOrIndex, option] of optionEntries) {
                            if (typeof $idevice.refreshImageActive === "function") {
                                $idevice.refreshImageActive(keyOrIndex);
                            }
                            if (typeof $idevice.refreshGame === "function") {
                                $idevice.refreshGame(keyOrIndex);
                            }
                        }
                    }, 100));

                    resizeObserver.observe(element);
                    $idevice.observersresize.set(element, resizeObserver);
                },

                observersDisconnect: function ($idevice) {
                    if (!$idevice) return;

                    const isMap = $idevice.options instanceof Map;
                    const isArray = Array.isArray($idevice.options);
                    const optionEntries = isMap
                        ? $idevice.options.entries()
                        : isArray
                            ? $idevice.options.entries()
                            : [];

                    for (let [keyOrIndex, option] of optionEntries) {
                        if (option && option.gameStarted) {
                            if (typeof $idevice.stopSound === "function") {
                                $idevice.stopSound(option);
                            }
                        }
                        if (option && option.counterClock) {
                            clearInterval(option.counterClock);
                            option.counterClock = null;
                        }
                    }

                    if ($idevice.observers) {
                        $idevice.observers.forEach((observer) => {
                            observer.disconnect();
                        });
                        $idevice.observers.clear();
                    }

                    if ($idevice.observersresize) {
                        $idevice.observersresize.forEach((observer) => {
                            observer.disconnect();
                        });
                        $idevice.observersresize.clear();
                    }
                },
            },
        },
        // / Gamification
        filePicker: {
            init: function () {
                $(".exe-file-picker,.exe-image-picker").each(
                    function () {
                        var id = this.id;
                        var css = 'exe-pick-any-file';
                        var e = $(this);
                        if (e.hasClass("exe-image-picker")) css = 'exe-pick-image';
                        e.after(' <input type="button" class="' + css + '" value="' + _("Select a file") + '" id="_browseFor' + id + '" onclick="$exeDevices.iDevice.filePicker.openFilePicker(this)" />');
                    }
                );
            },
            openFilePicker: function (e) {
                var id = e.id.replace("_browseFor", "");
                var type = 'media';
                if ($(e).hasClass("exe-pick-image")) type = 'image';
                try {
                    exe_tinymce.chooseImage(id, "", type, window);
                } catch (e) {
                    eXe.app.alert(e);
                }
            }
        },
        // Save the iDevice
        save: function () {
            // Check if the object and the required methods are defined
            if (typeof ($exeDevice) != 'undefined' && typeof ($exeDevice.init) != 'undefined' && typeof ($exeDevice.save) == 'function') {
                // Trigger the click event so the form is submitted
                var html = $exeDevice.save();
                if (html) {
                    $("textarea.mceEditor, #node-content .idevice_node[mode=edition]").val(html);
                }
            }
        },
        // iDevice tabs
        tabs: {
            init: function (id) {
                var tabs = $("#" + id + " .exe-form-tab");
                var list = '';
                var tabId;
                var e;
                var txt;
                tabs.each(function (i) {
                    var klass = "exe-form-active-tab";
                    tabId = id + "Tab" + i;
                    e = $(this);
                    e.attr("id", tabId);
                    txt = e.attr("title");
                    e.attr("title", "");
                    if (txt == '') txt = (i + 1);
                    if (i > 0) {
                        e.hide();
                        klass = "";
                    }
                    list += '<li><a href="#' + tabId + '" class="' + klass + '">' + txt + '</a></li>';
                });
                if (list != "") {
                    list = '<ul id="' + id + 'Tabs" class="exe-form-tabs exe-advanced">' + list + '</ul>';
                    tabs.eq(0).before(list);
                    var as = $("#" + id + "Tabs a");
                    as.click(function () {
                        as.attr("class", "");
                        $(this).addClass("exe-form-active-tab");
                        tabs.hide();
                        $($(this).attr("href")).show();
                        return false;
                    });
                }
            },
            restart: function () {
                $("#activeIdevice .exe-form-tabs a").eq(0).trigger("click");
            }
        }
    }
}