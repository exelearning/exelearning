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
window.MathJax = window.MathJax || (function() {
    var isWorkarea = typeof window.eXeLearning !== 'undefined' || document.querySelector('script[src*="app/common/exe_math"]');
    var isIndex = document.documentElement.id === 'exe-index';
    var basePath = isWorkarea ? '/app/common/exe_math' : (isIndex ? './libs/exe_math' : '../libs/exe_math');
    
    var externalExtensions = [
        'amscd', 'bbox', 'boldsymbol', 'braket', 'bussproofs', 'cancel', 
        'cases', 'centernot', 'color', 'colortbl', 'empheq', 'enclose', 
        'extpfeil', 'gensymb', 'html', 'mathtools', 'mhchem', 'noerrors',
        'physics', 'tagformat', 'textcomp', 'unicode', 'upgreek', 'verb', 
        'setoptions',
        'bbm', 'bboldx', 'begingroup', 'colorv2', 'dsfont', 'texhtml', 'units'
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
            enableMenu: false,
            menuOptions: {
                settings: {
                    enrich: false,      // ← DESACTIVA el semantic enrichment (y el explorer)
                    speech: false,      // ← Desactiva generación de speech
                    braille: false,     // ← Desactiva generación de Braille
                    assistiveMml: false
                }
            },
            renderActions: {
                addMenu: [],
                checkLoading: [],
                assistiveMml: []
            }
        }
    };
})();
document.addEventListener("DOMContentLoaded", function() {
    var url = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/4.0.0/es5/tex-svg.min.js";

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