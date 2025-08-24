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
    const supportedLangs = ['en', 'es', 'ca'];
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
        setupLanguageSelector();
    } else {
        const editorLink = document.getElementById('menu-editor-link');
        if (editorLink) editorLink.href = editorLink.href + '?lang=' + document.documentElement.lang;
    }
    updateAllDynamicTexts();
    addFooter(); // Ensure footer is translated on load
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
    }
    var s;
        s = document.createElement("script");
        s['async'] = "";
        s.id = "MathJax-script";
        s.src = url;
    document.getElementsByTagName("head")[0].appendChild(s);
});