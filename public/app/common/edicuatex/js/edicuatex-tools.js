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
        let res = str;
        let appLang = document.documentElement.lang;
        // Default language (en)
        let translations = $i18n['eXe'];
        // Check if local translation exists
        if (typeof $i18n[appLang] == 'object') translations = $i18n[appLang];
        // Return local translation if available
        if (typeof translations[str] == 'string') return translations[str];
        // Use eXe's translation if needed
        if (isInExe) return parent._(str);
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
window.MathJax = {
    loader: {
        load: ['[tex]/color', '[tex]/mhchem']
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
            MathJax.startup.defaultReady();
            // This function is defined below in the main script
            if (window.initializeLatexEditor) {
                window.initializeLatexEditor();
            }
        }
    }
};
document.addEventListener("DOMContentLoaded", function() {
    var url = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js";
    if (isInExe) {
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
    var s;
        s = document.createElement("script");
        s['async'] = "";
        s.id = "MathJax-script";
        s.src = url;
    document.getElementsByTagName("head")[0].appendChild(s);
});
