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

window.MathJax = window.MathJax || (function() {
    var isWorkarea = typeof window.eXeLearning !== 'undefined' || document.querySelector('script[src*="app/common/exe_math"]');
    var isIndex = document.documentElement.id === 'exe-index';
    // For workarea: use versioned path from eXeLearning config or detect from script tags
    // For exports: use relative paths (./libs or ../libs)
    var version = (window.eXeLearning && window.eXeLearning.version) || '';
    var configBasePath = '';
    if (isWorkarea) {
        // Try to detect version and basePath from existing script tags (e.g., /web/exelearning/v0.0.0-alpha/app/...)
        var scriptTag = document.querySelector('script[src*="/app/common/"]');
        if (scriptTag) {
            var src = scriptTag.src;
            // Extract version (e.g., v0.0.0-alpha)
            var versionMatch = src.match(/\/(v[\d.]+[^/]*)\//);
            if (versionMatch) version = versionMatch[1];
            // Extract basePath - everything before /v... or /app/
            // URL might be: /web/exelearning/v0.0.0/app/common/... or /v0.0.0/app/common/...
            try {
                var url = new URL(src);
                var pathname = url.pathname;
                // Find where the versioned path or /app/ starts
                var appIndex = pathname.indexOf('/app/common/');
                if (appIndex > 0) {
                    var beforeApp = pathname.substring(0, appIndex);
                    // If there's a version, remove it from the path
                    if (version && beforeApp.endsWith('/' + version)) {
                        configBasePath = beforeApp.substring(0, beforeApp.length - version.length - 1);
                    } else {
                        configBasePath = beforeApp;
                    }
                }
            } catch (e) {
                // If URL parsing fails, leave configBasePath empty
            }
        }
    }
    var basePath = isWorkarea
        ? (version ? configBasePath + '/' + version + '/app/common/exe_math' : configBasePath + '/app/common/exe_math')
        : (isIndex ? './libs/exe_math' : '../libs/exe_math');
    
    var externalExtensions = [
        'amscd', 'bbox', 'boldsymbol', 'braket', 'bussproofs', 'cancel',
        'cases', 'centernot', 'color', 'colortbl', 'empheq', 'enclose',
        'extpfeil', 'gensymb', 'html', 'mathtools', 'mhchem', 'noerrors',
        'physics', 'tagformat', 'textcomp', 'unicode', 'upgreek', 'verb',
        'setoptions'
        // TODO: Enable these extensions when upgrading to MathJax 4.0
        // Currently disabled due to dependency issues with bundled tex-mml-svg.js (MathJax 3.x)
        // These extensions require input/tex-base to be fully loaded before initialization
        // 'bbm', 'bboldx', 'begingroup', 'colorv2', 'dsfont', 'texhtml', 'units'
    ];
    
    return {
        tex: {
            inlineMath: [["\\(", "\\)"]],
            displayMath: [["$$", "$$"], ["\\[", "\\]"]],
            processEscapes: true,
            tags: 'ams',
            packages: { '[+]': externalExtensions }
        },
        loader: {
            paths: { mathjax: basePath },
            load: externalExtensions.map(function(ext) { return '[tex]/' + ext; })
        },
        options: {
            // Exclude navbar dropdown menus from MathJax processing (File, Edit, etc.)
            // Note: nav-element is NOT excluded - page titles with LaTeX must be processed
            ignoreHtmlClass: 'tex2jax_ignore|dropdown-menu|dropdown-item|modal',
            // Skip processing inside these HTML tags
            skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        }
    };
})();

var $exe = {

    options: {
        // Accessibility toolbar
        atools: {
            modeToggler: false,
            translator: false,
            i18n: {}
        }
    },

    init: function () {
        var bod = $('body');
        this.hasMultimediaGalleries = false;
        this.setMultimediaGalleries();
        this.setModalWindowContentSize(); // To review
        // No MediaElement in ePub
        if (!bod.hasClass("exe-epub")) {
            var n = document.body.innerHTML;
            if (this.hasMultimediaGalleries || $(".mediaelement").length > 0) {
                $exe.loadMediaPlayer.init();
            }
        } else {
            // No inline SCRIPT tags in ePub (due to Chrome app Content Security Policy)
            bod.addClass("js");
        }
        $exe.setIframesProperties();
        $exe.hasTooltips();
        $exe.math.init();
        $exe.mermaid.init();
        $exe.dl.init();
        $exe.sfHover();
        // Add a zoom icon to the images using CSS
        $("a.exe-enlarge").each(function (i) {
            var e = $(this);
            var c = $(this).children();
            if (c.length == 1 && c.eq(0).prop("tagName") == "IMG") {
                e.prepend('<span class="exe-enlarge-icon"><b></b></span>');
            }
        });
        // Disable autocomplete
        $("INPUT.autocomplete-off").attr("autocomplete", "off");
    },

    // Math options (MathJax, etc.) - To review (some options might not be needed)
    math: {
        get engine() {
            return $exeDevices.iDevice.gamification.math.engine;
        },
        get engineConfig() {
            return $exeDevices.iDevice.gamification.math.engineConfig;
        },
        loadMathJax: function(callback) {
            return $exeDevices.iDevice.gamification.math.loadMathJax(callback);
        },
        hasLatex: function(text) {
            return $exeDevices.iDevice.gamification.math.hasLatex(text);
        },
        refresh: function(elements) {
            return $exeDevices.iDevice.gamification.math.updateLatex(elements);
        },
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
            $("body").addClass("exe-auto-math"); // Always load it
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
                    $exe.math.loadMathJax(function () {
                        // For SPA preview: only typeset active page (prevents replaceChild errors)
                        var activePage = document.querySelector('.spa-page.active');
                        if (activePage) {
                            MathJax.typesetPromise([activePage]).catch(function(e) {
                                console.warn('[MathJax] Typeset error:', e.message);
                            });
                        } else {
                            // Not a SPA preview, typeset everything
                            MathJax.typesetPromise().catch(function(e) {
                                console.warn('[MathJax] Typeset error:', e.message);
                            });
                        }
                        $exe.math.createLinks();
                    });
                } else {
                    $exe.math.createLinks(math);
                }
            }
        }
    },
    // Mermaid options
    mermaid: {
        // Mermaid script path
        engine: $("html").prop("id") === "exe-index" ? "./libs/mermaid/mermaid.min.js" : "../app/common/mermaid/mermaid.min.js",
        reload_pending: false,
        initialized: false,
        loadMermaid: function () {
            if (typeof window.mermaid === 'undefined') {
                const script = document.createElement("script");
                script.src = this.engine;
                script.async = true;
                script.onload = function () {
                    mermaid = window.mermaid;
                    mermaid.initialize({
                        startOnLoad: false,
                        suppressErrorRendering: true,
                        logLevel: 'fatal',
                        // Gantt configuration to prevent negative width errors
                        gantt: {
                            useMaxWidth: true,
                            useWidth: undefined
                        },
                        flowchart: {
                            useMaxWidth: true
                        }
                    });
                    $exe.mermaid.initialized = true;
                    $exe.mermaid.renderDiagrams();
                };
                document.head.appendChild(script);
            } else if (this.initialized) {
                // debounce reloading to avoid multiple calls
                if (!this.reload_pending) {
                    this.reload_pending = true;
                    setTimeout(function () {
                        $exe.mermaid.reload_pending = false;
                        $exe.mermaid.renderDiagrams();
                    }, 100);
                }
            }
        },
        renderDiagrams: function (retryCount) {
            retryCount = retryCount || 0;
            var maxRetries = 10;
            // Include elements without data-processed OR with data-processed="pending" (failed previous render)
            var mermaidNodes = $(".mermaid:not([data-processed]), .mermaid[data-processed='pending']");

            if (mermaidNodes.length === 0) return;

            // Check if elements have valid dimensions
            var readyNodes = [];
            var pendingNodes = [];

            mermaidNodes.each(function () {
                var $el = $(this);
                // Element needs to be visible AND have width > 0
                if ($el.is(':visible') && $el.width() > 0) {
                    readyNodes.push(this);
                    // Remove pending status so mermaid.run() will process it
                    $el.removeAttr('data-processed');
                } else {
                    pendingNodes.push(this);
                }
            });

            // Only call mermaid.run() if there are ready nodes
            // IMPORTANT: Pass the specific nodes to render, not all .mermaid elements
            // This prevents Mermaid from rendering hidden elements with 0 width
            if (readyNodes.length > 0) {
                try {
                    // Pass only the ready nodes to mermaid.run()
                    mermaid.run({ nodes: readyNodes });
                } catch (e) {
                    // Silently handle rendering errors
                }
            }

            // Mark pending nodes so we know they need retry later
            // (when the page containing them becomes visible)
            pendingNodes.forEach(function(node) {
                if (!node.hasAttribute('data-processed')) {
                    node.setAttribute('data-processed', 'pending');
                }
            });

            // Retry for pending nodes that don't have dimensions yet
            if (pendingNodes.length > 0 && retryCount < maxRetries) {
                setTimeout(function () {
                    $exe.mermaid.renderDiagrams(retryCount + 1);
                }, 200);
            }
        },
        init: function () {
            // Check for mermaid elements that need rendering
            // Pre-rendered diagrams have class exe-mermaid-rendered (not .mermaid)
            // so they won't be matched by this selector.
            // Include ALL .mermaid elements (even data-processed="pending" which means
            // a previous render failed) so Mermaid library gets loaded and they can retry.
            var mermaidNodes = $(".mermaid");

            // Load Mermaid if there are any mermaid elements
            if (mermaidNodes.length > 0) {
                this.loadMermaid();
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
                // We execute this code only outside eXe or the Image Gallery edition will fail (see issue #317)
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

    // Load MediaElement if required - To review (Shall eXe still use MediaElement?)
    loadMediaPlayer: {
        isCalledInBox: false, // Box = prettyPhoto with video or audio
        isReady: false,
        // Start MediaElement
        init: function () {
            // Multimedia galleries
            $exe.mediaelements = $(".mediaelement");
            $exe.mediaelements.each(function () {
                // Only process actual audio/video elements, not MEJS wrapper containers
                // When MEJS wraps an element, the container also gets class 'mediaelement'
                // which can cause double-initialization issues
                var tagName = this.localName || this.tagName?.toLowerCase();
                if (tagName !== "audio" && tagName !== "video") {
                    return; // Skip non-media elements (like mejs-container divs)
                }
                // Skip if already processed by MEJS
                if (this.player !== undefined) {
                    return;
                }
                if (tagName === "video") {
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
    // Very old browsers need this because they don't support li:hover
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
        if ($("A.exe-tooltip").length > 0) {
            var p = "";
            if (typeof (eXeLearning) !== 'undefined') {
                // TODO: UNIFY - Fallback for branch compatibility.
                // In 'main' branch: eXeLearning.symfony.fullURL exists (added by Symfony backend)
                // In this branch: only eXeLearning.config.fullURL exists (set in workarea.njk)
                // To unify: Either add 'symfony' property to workarea.njk template,
                // or update main branch to use 'config' consistently.
                p = (eXeLearning.symfony?.fullURL || eXeLearning.config?.fullURL || '') + "/app/common/exe_tooltips/";
            } else {
                var ref = window.location.href;
                // Check if it's the home page
                p = "libs/exe_tooltips/";
                if (!document.getElementById("exe-index")) p = "../" + p;
            }
            $exe.loadScript(p + "exe_tooltips.js", "$exe.tooltips.init('" + p + "')")
        }
    },

    // Internet Explorer? - To review (Export this function?)
    isIE: function () {
        var e = navigator.userAgent.toLowerCase();
        return e.indexOf("msie") != -1 ? parseInt(e.split("msie")[1]) : false
    },

    // Add "http" to the IFRAMES without protocol in local pages and create a hidden link for the print version
    setIframesProperties: function () {
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

    // Check if you're in eXe
    isInExe: function () {
        return typeof eXeLearning !== "undefined";
    },

    // Check if you're in preview
    isPreview: function () {
        return $('body').hasClass('preview');
    },

    // Export idevice path - To review
    getIdeviceInstalledExportPath: function (ideviceType) {
        let ideviceNode;
        if (this.isInExe()) {
            ideviceNode = $(`article.idevice_node[idevice-type="${ideviceType}"]`);
            return ideviceNode.attr('idevice-path');
        } else {
            ideviceNode = $(`article.idevice_node[data-idevice-type="${ideviceType}"]`);
            return ideviceNode.attr('data-idevice-path');
        }
    }

};

// iDevices common code - To review (Part of this code should not be exported)
var $exeDevices = {
    iDevice: {
        // Gamification
        gamification: {
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
                                console.error("Error loading SCORM:", textStatus);
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
                    console.error("init() error:", err);
                } finally {
                    if (!scormFlow) {
                        $game.enable();
                    }
                }
            },

            scorm: {
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

                // Nueva función: Obtener puntuación de una actividad específica desde suspend_data
                getActivityScore: function (ideviceNumber) {
                    if (typeof pipwerks === 'undefined' || !pipwerks.SCORM) {
                        return 0;
                    }

                    const suspendData = pipwerks.SCORM.get("cmi.suspend_data") || "";
                    const lmsData = $exeDevices.iDevice.gamification.scorm.parseSuspendData(suspendData);

                    if (lmsData[ideviceNumber]) {
                        // Score está guardado en escala 0-1000, convertir a 0-10
                        return (lmsData[ideviceNumber].score / 10) || 0;
                    }

                    return 0;
                },

                // Nueva función: Obtener puntuación total del nodo desde cmi.core.score.raw
                getTotalScore: function () {
                    if (typeof pipwerks === 'undefined' || !pipwerks.SCORM) {
                        return 0;
                    }

                    const rawScore = pipwerks.SCORM.get("cmi.core.score.raw");
                    return parseFloat(rawScore) || 0;
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
                        console.error("parseJSONSafe: Could not parse JSON. Using empty object fallback.");
                        return {};
                    }
                },

                createScoreScormHtml: function (game) {
                    let $exeScoreNode = $("#exeScoreNode");
                    let initialScore = 0;
                    
                    if (typeof pipwerks !== 'undefined' && pipwerks.SCORM) {
                        const rawScore = pipwerks.SCORM.get("cmi.core.score.raw");
                        if (rawScore && rawScore !== "" && rawScore !== "0") {
                            initialScore = parseFloat(rawScore) || 0;
                        } else {
                            const suspendData = pipwerks.SCORM.get("cmi.suspend_data") || "";
                            if (suspendData && suspendData.trim() !== "") {
                                const lmsData = $exeDevices.iDevice.gamification.scorm.parseSuspendData(suspendData);
                                initialScore = $exeDevices.iDevice.gamification.scorm.getFinalScore(lmsData);
                            }
                        }
                    }

                    if ($exeScoreNode.length === 0) {
                        const newScoreNodeHtml = `
                                    <div id="exeScoreNode" class="text-end p-2">
                                        <div id="eXeScoreNodeScore" class="bg-success text-white d-inline-block px-2 py-1">
                                            ${game.msgs.msgYouScore}: ${initialScore}/100
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
                    } else {
                        $("#eXeScoreNodeScore").text(`${game.msgs.msgYouScore}: ${initialScore}/100`);
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

                        if (lmsData[game.ideviceNumber]) {
                            game.previousScore = (lmsData[game.ideviceNumber].score / 10).toFixed(2);
                            // Actualizar el score node con la puntuación recuperada
                            const totalScore = $exeDevices.iDevice.gamification.scorm.getFinalScore(lmsData);
                            if (totalScore > 0) {
                                $("#eXeScoreNodeScore").text(`${game.msgs.msgYouScore}: ${totalScore}/100`);
                            }
                        } else {
                            lmsData[game.ideviceNumber] = {
                                title: game.title,
                                score: 0,
                                weighted: game.weighted
                            };

                            const newFormatData = $exeDevices.iDevice.gamification.scorm.convertToLineFormat(lmsData, game);
                            pipwerks.SCORM.set("cmi.suspend_data", newFormatData);
                        }
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
                        pipwerks.SCORM.set("cmi.core.lesson_status", "failed");
                    }

                    $("#eXeScoreNodeScore").text(`${game.msgs.msgYouScore}: ${newFinalScore}/100`);

                }
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
                    if (typeof game !== 'undefined' && game.main) {
                        const $gmain = game.main.charAt(0) === '.' ? $(`${game.main}`).eq(0) : $(`#${game.main}`).eq(0);
                        game.id = $gmain.closest('.idevice_node').attr('id');
                    }
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
                        icon = 'exequextrerrors.svg';
                        text = game.msgs.msgUnsuccessfulActivity.replace('%s', formattedScore);
                    } else if (state === 2) {
                        icon = 'exequexthits.svg';
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
                    if (typeof game !== 'undefined' && game.main) {
                        const $gmain = game.main.charAt(0) === '.' ? $(`${game.main}`).eq(0) : $(`#${game.main}`).eq(0);
                        game.id = $gmain.closest('.idevice_node').attr('id');
                    }
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
                        const event = new CustomEvent('gamification-evaluation-saved', { detail: { evaluationID: game.evaluationID, ideviceId: game.id, ideviceType: game.idevice, score: scorm.score, state: scorm.state } });
                        window.dispatchEvent(event);
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
                _loading: false,
                _callbacks: [],

                engine: $("html").prop("id") == "exe-index" ? "./libs/exe_math/tex-mml-svg.js" : "../libs/exe_math/tex-mml-svg.js",

                engineConfig: window.MathJax,

                loadMathJax: function (callback) {
                    var self = $exeDevices.iDevice.gamification.math;

                    if (typeof window.MathJax === 'object' && typeof MathJax.typesetPromise === 'function') {
                        if (callback) callback();
                        return;
                    }

                    if (callback) {
                        self._callbacks.push(callback);
                    }

                    if (self._loading) {
                        return;
                    }

                    var existingScript = document.querySelector('script[src*="tex-mml-svg.js"]');
                    if (existingScript) {
                        self._loading = true;
                        var checkMathJax = function () {
                            if (typeof window.MathJax === 'object' && typeof MathJax.typesetPromise === 'function') {
                                self._loading = false;
                                while (self._callbacks.length > 0) {
                                    var cb = self._callbacks.shift();
                                    cb();
                                }
                            } else {
                                setTimeout(checkMathJax, 50);
                            }
                        };
                        checkMathJax();
                        return;
                    }

                    self._loading = true;
                    // For exports: use relative paths. For workarea: use versioned path if available
                    var isExport = $("html").prop("id") == "exe-index" || !document.querySelector('script[src*="/app/common/"]');
                    var basePath;
                    if (isExport) {
                        basePath = $("html").prop("id") == "exe-index" ? "./libs/exe_math" : "../libs/exe_math";
                    } else {
                        // Workarea: detect version and basePath from script tags
                        var version = (window.eXeLearning && window.eXeLearning.version) || '';
                        var configBasePath = '';
                        // Try to get basePath from parsed config first (if available)
                        if (window.eXeLearning && window.eXeLearning.config && typeof window.eXeLearning.config === 'object') {
                            configBasePath = window.eXeLearning.config.basePath || '';
                        }
                        // Detect version and basePath from script tags as fallback
                        var scriptTag = document.querySelector('script[src*="/app/common/"]');
                        if (scriptTag) {
                            var src = scriptTag.src;
                            if (!version) {
                                var versionMatch = src.match(/\/(v[\d.]+[^/]*)\//);
                                if (versionMatch) version = versionMatch[1];
                            }
                            // Detect basePath from script src if not already set
                            if (!configBasePath) {
                                try {
                                    var url = new URL(src);
                                    var pathname = url.pathname;
                                    var appIndex = pathname.indexOf('/app/common/');
                                    if (appIndex > 0) {
                                        var beforeApp = pathname.substring(0, appIndex);
                                        if (version && beforeApp.endsWith('/' + version)) {
                                            configBasePath = beforeApp.substring(0, beforeApp.length - version.length - 1);
                                        } else {
                                            configBasePath = beforeApp;
                                        }
                                    }
                                } catch (e) {}
                            }
                        }
                        basePath = version ? configBasePath + '/' + version + '/app/common/exe_math' : configBasePath + '/app/common/exe_math';
                    }
                    if (!window.MathJax) {
                        window.MathJax = self.engineConfig;
                    }
                    if (!window.MathJax.loader) window.MathJax.loader = {};
                    if (!window.MathJax.loader.paths) window.MathJax.loader.paths = {};
                    // In static mode, keep the pre-configured relative path
                    var capabilities = window.eXeLearning?.app?.capabilities;
                    if (capabilities?.storage?.remote) {
                        window.MathJax.loader.paths.mathjax = basePath;
                    }
                    var script = document.createElement('script');
                    script.src = self.engine;
                    script.async = true;
                    script.onload = function () {
                        var checkReady = function () {
                            if (typeof window.MathJax === 'object' && typeof MathJax.typesetPromise === 'function') {
                                self._loading = false;
                                while (self._callbacks.length > 0) {
                                    var cb = self._callbacks.shift();
                                    cb();
                                }
                            } else {
                                setTimeout(checkReady, 50);
                            }
                        };
                        checkReady();
                    };
                    document.head.appendChild(script);
                },

                hasLatex: function (text) {
                    return /\\\(|\\\[|\\begin\{|\$\$/.test(text);
                },

                updateLatex: function (target, opts) {
                    var self = $exeDevices.iDevice.gamification.math;
                    var options = opts || {};

                    function nodesFrom(t) {
                        if (!t) return [];
                        if (typeof t === 'string') {
                            try { return Array.from(document.querySelectorAll(t)); }
                            catch (e) { console.warn('selector inválido:', t, e); return []; }
                        }
                        if (t.nodeType === 1) return [t];
                        if (typeof t.length === 'number') return Array.from(t);
                        return [];
                    }

                    function runV3(nodes) {
                        if (!nodes.length) return;
                        // Filter out nodes in hidden SPA pages (prevents replaceChild errors)
                        var visibleNodes = nodes.filter(function(n) {
                            var spaPage = n.closest('.spa-page');
                            // If inside a SPA page, only process if active
                            if (spaPage) return spaPage.classList.contains('active');
                            // If not in a SPA page, always process
                            return true;
                        });
                        if (!visibleNodes.length) return;
                        var start = (MathJax.startup && MathJax.startup.promise) ? MathJax.startup.promise : Promise.resolve();
                        return start.then(function () {
                            if (typeof MathJax.typesetClear === 'function') MathJax.typesetClear(visibleNodes);
                            return (MathJax.typesetPromise ? MathJax.typesetPromise(visibleNodes) : MathJax.typeset(visibleNodes));
                        }).catch(function (e) { console.error('MathJax v3 typeset error:', e); });
                    }

                    function runV2(nodes) {
                        if (!nodes.length) return;
                        nodes.forEach(function (n) {
                            MathJax.Hub.Queue(['Typeset', MathJax.Hub, n]);
                        });
                    }

                    function typesetNow() {
                        var nodes = nodesFrom(target);
                        if (!nodes.length) return;

                        if (typeof MathJax === 'undefined') {
                            self.loadMathJax(function () {
                                typesetNow();
                            });
                            return;
                        }

                        if (MathJax.typesetPromise || MathJax.startup) return runV3(nodes);
                        if (MathJax.Hub && typeof MathJax.Hub.Queue === 'function') return runV2(nodes);
                    }

                    if (options.defer) {
                        // Espera a que termine la animación/visibilidad de la slide
                        requestAnimationFrame(function () { requestAnimationFrame(typesetNow); });
                    } else {
                        typesetNow();
                    }
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
                                tag.onerror = () => reject(new Error(_('Could not load YouTube API')));
                                document.head.appendChild(tag);
                            });
                        }
                        return apiReadyPromise;
                    }

                    return { load };
                })(),

            },

            helpers: {
                sanitizeJSONString: function (jsonString) {
                    if (typeof jsonString !== 'string' || jsonString === '') return jsonString;

                    let inString = false;
                    let result = '';

                    for (let i = 0; i < jsonString.length; i++) {
                        const ch = jsonString[i];

                        if (!inString) {
                            if (ch === '"') {
                                inString = true;
                            }
                            result += ch;
                            continue;
                        }

                        if (ch === '\\') {
                            if (i + 1 < jsonString.length) {
                                result += ch + jsonString[i + 1];
                                i++;
                            } else {
                                result += ch;
                            }
                            continue;
                        }

                        if (ch === '"') {
                            inString = false;
                            result += ch;
                            continue;
                        }

                        const code = ch.charCodeAt(0);

                        if (code === 0x08) {
                            result += '\\b';
                        } else if (code === 0x09) {
                            result += '\\t';
                        } else if (code === 0x0a) {
                            result += '\\n';
                        } else if (code === 0x0c) {
                            result += '\\f';
                        } else if (code === 0x0d) {
                            result += '\\r';
                        } else if (code === 0x2028 || code === 0x2029) {
                            const hex = code.toString(16).padStart(4, '0');
                            result += `\\u${hex}`;
                        } else if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
                            const hex = code.toString(16).padStart(4, '0');
                            result += `\\u${hex}`;
                        } else {
                            result += ch;
                        }
                    }

                    return result;
                },
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

    }
}

// Export globals for browser and test environments
if (typeof window !== 'undefined') {
    window.$exe = $exe;
    window.$exeDevices = $exeDevices;
}
if (typeof global !== 'undefined') {
    global.$exe = $exe;
    global.$exeDevices = $exeDevices;
}
