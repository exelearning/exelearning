/* LANGUAGE TOOLS */
// Define the object that will hold the translations
$i18n = {};
// Check if it's in eXe and translate (if possible)
let isInExe = parent && typeof(parent.eXeLearning) == 'object' && typeof(parent.tinymce) == 'object' && typeof(parent.jQuery) == 'function';
if (isInExe) {
    document.documentElement.className = 'exelearning';
    // Set HTML lang (eXe's lang)
    document.documentElement.lang = parent.eXeLearning.app.locale.lang;
    // Use eXe's _ function to translate
    _ = parent._;            
} else {
    // Not in eXe (_ is required)
    _ = function(str) {
        return str;
    }
    // Setup for standalone execution (browser language detection or localStorage)
    const savedLang = localStorage.getItem('userLanguage');
    const browserLang = navigator.language.split('-')[0];
    const supportedLangs = ['en', 'es', 'ca', 'gl', 'eu', 'de'];
    function getLangParam() {
        var result = "",
            tmp = [];
        location.search
            .substr(1)
            .split("&")
            .forEach(function (item) {
              tmp = item.split("=");
              if (tmp[0] === 'lang') result = decodeURIComponent(tmp[1]);
            });
        return result;
    }
    let defaultLang = savedLang || (supportedLangs.includes(browserLang) ? browserLang : 'en');
    const urlLang = getLangParam();
    if (urlLang != "") defaultLang = urlLang;
    document.documentElement.lang = defaultLang;
}
// Redefine _ function once the DOM is loaded and $i18n is available
document.addEventListener("DOMContentLoaded", function() {
    _ = function(str){
        // Prioritize eXe's translation
        if (isInExe && typeof parent._ === 'function') {
            let exeTranslation = parent._(str);
            if (exeTranslation !== str) return exeTranslation;
        }
        let res = str;
        let appLang = document.documentElement.lang;
        // Default language (en)
        let translations = $i18n['eXe'];
        // Check if local translation exists
        if (typeof $i18n[appLang] == 'object') translations = $i18n[appLang];
        // Return local translation if available
        if (typeof translations[str] == 'string') return translations[str];
        // Otherwite, return the original string
        return res;
    }

    // After defining _, update all texts
    if (!isInExe) {
        if (typeof setupLanguageSelector === 'function') {
            setupLanguageSelector();
        }
    } else {
        const editorLink = document.getElementById('menu-editor-link');
        if (editorLink) editorLink.href = editorLink.href + '?lang=' + document.documentElement.lang;
    }
    if (typeof updateAllDynamicTexts === 'function') {
        updateAllDynamicTexts();
    }
    if (typeof addFooter === 'function') {
        addFooter(); // Ensure footer is translated on load
    }
});

/* MATHJAX */
// Where MathJax comes from when the editor runs on its own (inside eXe the host
// says, see below). js/mathjax/ is committed, so this is what every deployment
// uses and nothing leaves the origin; the CDN stays as a fallback for a partial
// checkout or a copy served without that directory.
// Resolved against this file's own URL so index.html and menus/editor.html,
// which sit at different depths, both find it.
var MATHJAX_LOCAL_URL = new URL('mathjax/tex-svg.js', document.currentScript.src).href;
var MATHJAX_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/4.1.3/tex-svg.min.js';
// Whether what answered may be missing the Speech Rule Engine. The name is a
// leftover: the test is not "is it ours" but "is it anything other than the CDN
// build", the only copy known to carry the engine. Ours dropped it (see
// scripts/vendor-mathjax.mjs) and so did eXeLearning's, which arrives through
// edicuatex_mathjax_url and matches neither URL constant.
var mathjaxIsVendored = false;

window.MathJax = {
    loader: {
        // 'cases' and 'mathtools' are listed in tex.packages below, but nothing
        // ever loaded them: MathJax 3 stayed quiet about it and \begin{numcases}
        // failed, MathJax 4 warns on the console. Load what the config claims.
        // MathJax 3 bundled assistive-mml into the combined components and every
        // formula carried hidden MathML for screen readers. MathJax 4 does not:
        // without this the SVG is a bare role="img" with no label and a screen
        // reader announces nothing. Load it back.
        load: ['[tex]/cases', '[tex]/color', '[tex]/mathtools', '[tex]/mhchem',
               'a11y/assistive-mml'],
        // Filled in by loadMathJax(), which only knows where the glyph ranges
        // are once it knows which copy of MathJax answered.
        paths: {}
    },
    tex: {
        inlineMath: [
            ['\\(', '\\)']],
        displayMath: [
            ['$$', '$$'],
            ['\\[', '\\]']
        ],
        processEscapes: true,
        packages: {
            '[+]': ['cases', 'mathtools', 'color', 'mhchem']
        }
    },
    svg: {
        fontCache: 'local'
    },
    startup: {
        ready: () => {
            if (mathjaxIsVendored) forgetSpeechMenuSettings();
            MathJax.startup.defaultReady();
            // Guarded: anything thrown while tidying the menu would leave MathJax
            // un-started, and no formula on the page would ever render.
            if (mathjaxIsVendored) {
                try { hideSpeechMenuEntries(); } catch (e) {}
            }
            // This function is defined below in the main script
            if (window.initializeLatexEditor) {
                window.initializeLatexEditor();
            }
        }
    }
};
// Drops menu settings this copy cannot honour. MathJax keeps them in
// localStorage for the whole origin and acts on them while the document is
// being built, so this has to run before defaultReady(): a `speech: true` left
// by an older version, or by any other MathJax page on the same origin, would
// ask for the Speech Rule Engine that is no longer vendored and stall the
// typeset queue on a file that answers 404.
//
// `assistiveMml: false` is dropped too. Turning Speech off in MathJax's menu
// stores it, and it would take the hidden MathML away with it -- the one thing
// screen readers actually read -- for good, on that browser.
function forgetSpeechMenuSettings() {
    var KEY = 'MathJax-Menu-Settings';
    try {
        var stored = window.localStorage.getItem(KEY);
        if (!stored) return;
        var settings = JSON.parse(stored);
        if (!settings || typeof settings !== 'object') return;
        ['enrich', 'speech', 'braille', 'collapsible', 'explorer'].forEach(function(key) {
            delete settings[key];
        });
        if (settings.assistiveMml === false) delete settings.assistiveMml;
        if (Object.keys(settings).length) {
            window.localStorage.setItem(KEY, JSON.stringify(settings));
        } else {
            window.localStorage.removeItem(KEY);
        }
    } catch (e) {
        // Private mode, storage disabled or corrupt JSON: nothing to forget.
    }
}

// Hides the menu sections backed by the Speech Rule Engine. MathJax hides them
// by itself only when no loader is present, which is not the case here, so
// without this the menu offers Speech, Braille and Explorer and each toggle
// asks for a file that is not there. 'Accessibility' is the heading above the
// three, and would otherwise sit on top of nothing.
function hideSpeechMenuEntries() {
    var menu = window.MathJax && window.MathJax.startup
        && window.MathJax.startup.document && window.MathJax.startup.document.menu;
    if (!menu || !menu.menu || typeof menu.menu.findID !== 'function') return;
    ['Accessibility', 'Speech', 'Braille', 'Explorer'].forEach(function(id) {
        var item = menu.menu.findID(id);
        if (item && typeof item.hide === 'function') item.hide();
    });
}

// Loads MathJax from `url`, retrying on `fallbackUrl` if that file is not there.
function loadMathJax(url, fallbackUrl) {
    // MathJax 4 fetches the glyph ranges of its font (\mathbb, \mathcal,
    // stretchy arrows, the mhchem glyphs...) the first time a formula needs
    // them, and the default source is https://cdn.jsdelivr.net/npm/@mathjax.
    // Every copy that is not the CDN keeps them under fonts/ next to the bundle
    // (eXeLearning's exe_math/fonts, ours from `npm run vendor`), so nothing has
    // to leave the origin. No CDN mirrors the font packages, so the CDN keeps
    // MathJax's own default.
    window.MathJax.loader.paths = url === MATHJAX_CDN_URL ? {} : { fonts: '[mathjax]/fonts' };
    // Any copy that is not the full CDN build may lack the Speech Rule Engine: ours
    // does since the engine was dropped, and so does eXeLearning's, which supplies
    // its own MathJax through edicuatex_mathjax_url and made the same call. Only the
    // CDN is known to carry it, so that is the one exception -- same condition as the
    // font paths above.
    mathjaxIsVendored = url !== MATHJAX_CDN_URL;
    if (mathjaxIsVendored) {
        // The menu's own defaults have speech, braille and the explorer on, and
        // MathJax starts its speech worker while the document is being built --
        // before anyone opens a menu. Hiding the entries is not enough on its
        // own: without this it asks for sre/speech-worker.js, the request 404s
        // and not a single formula renders.
        window.MathJax.options = window.MathJax.options || {};
        window.MathJax.options.menuOptions = {
            settings: { enrich: false, speech: false, braille: false, explorer: false }
        };
    }
    var s = document.createElement("script");
    s['async'] = "";
    s.id = "MathJax-script";
    s.src = url;
    if (fallbackUrl) {
        s.onerror = function() {
            s.remove();
            loadMathJax(fallbackUrl, null);
        };
    }
    document.getElementsByTagName("head")[0].appendChild(s);
}

document.addEventListener("DOMContentLoaded", function() {
    var url = MATHJAX_LOCAL_URL;
    var fallbackUrl = MATHJAX_CDN_URL;
    if (isInExe) {
        fallbackUrl = null;
        url = parent.tinymce.activeEditor.settings.edicuatex_mathjax_url;

        // Detect app base path from edicuatex iframe URL for subdirectory deployments
        // e.g., /dist/static/app/common/edicuatex/index.html → /dist/static
        var appBasePath = '';
        var pathname = window.location.pathname;
        var appIndex = pathname.indexOf('/app/');
        if (appIndex > 0) {
            appBasePath = pathname.substring(0, appIndex);
        }

        // The URL may be absolute (e.g., /app/...) but the <base> tag
        // in this document would resolve it as relative, causing path duplication.
        // Prepend origin + basePath to make it a fully qualified URL that ignores the <base> tag.
        // Only prepend appBasePath if the URL doesn't already include it.
        // In online mode, getAssetURL() already adds the base path to the URL.
        if (url && url.startsWith('/')) {
            // Check if URL already starts with appBasePath (online mode)
            if (appBasePath && url.startsWith(appBasePath)) {
                // URL already has base path, just prepend origin
                url = window.location.origin + url;
            } else {
                // URL is root-relative, prepend origin + basePath
                url = window.location.origin + appBasePath + url;
            }
        } else if (url && url.startsWith('./')) {
            // Handle relative URLs with ./ prefix - convert to absolute from root
            // This avoids the <base> tag resolving ./app/... as /app/common/edicuatex/app/...
            url = window.location.origin + appBasePath + '/' + url.substring(2);
        }
    }
    loadMathJax(url, fallbackUrl);
});
