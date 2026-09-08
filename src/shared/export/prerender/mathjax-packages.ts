/**
 * MathJax TeX package registration for the server-side pre-renderer.
 *
 * MathJax 4 dropped the `AllPackages` barrel that v3 offered: every TeX extension
 * now registers itself as a side effect of importing its Configuration module. The
 * combined component the browser loads does that for us; a direct Node.js consumer
 * has to do it by hand, and a package that is named but never imported is silently
 * omitted with a console warning rather than an error.
 *
 * The list below must stay equal to what the browser configures in
 * public/app/common/common.js, or the same document renders differently depending
 * on whether the export ran in the browser (primary path) or on the server (CLI and
 * external API). mathjax-packages.spec.ts asserts that equality.
 */

// Default set of the tex-mml-svg combined component, read off a running instance
// (document.inputJax TeX options.packages) rather than assumed.
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';
import '@mathjax/src/js/input/tex/require/RequireConfiguration.js';
import '@mathjax/src/js/input/tex/autoload/AutoloadConfiguration.js';
import '@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js';

// Extensions eXeLearning adds on top, mirroring `externalExtensions` in common.js.
import '@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js';
import '@mathjax/src/js/input/tex/bbox/BboxConfiguration.js';
import '@mathjax/src/js/input/tex/begingroup/BegingroupConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js';
import '@mathjax/src/js/input/tex/bussproofs/BussproofsConfiguration.js';
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js';
import '@mathjax/src/js/input/tex/cases/CasesConfiguration.js';
import '@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js';
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js';
import '@mathjax/src/js/input/tex/colortbl/ColortblConfiguration.js';
import '@mathjax/src/js/input/tex/colorv2/ColorV2Configuration.js';
import '@mathjax/src/js/input/tex/dsfont/DsfontConfiguration.js';
import '@mathjax/src/js/input/tex/empheq/EmpheqConfiguration.js';
import '@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js';
import '@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js';
import '@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js';
import '@mathjax/src/js/input/tex/html/HtmlConfiguration.js';
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js';
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js';
import '@mathjax/src/js/input/tex/noerrors/NoErrorsConfiguration.js';
import '@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js';
import '@mathjax/src/js/input/tex/setoptions/SetOptionsConfiguration.js';
import '@mathjax/src/js/input/tex/tagformat/TagFormatConfiguration.js';
import '@mathjax/src/js/input/tex/texhtml/TexHtmlConfiguration.js';
import '@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js';
import '@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js';
import '@mathjax/src/js/input/tex/units/UnitsConfiguration.js';
import '@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js';
import '@mathjax/src/js/input/tex/verb/VerbConfiguration.js';

/** Packages the tex-mml-svg combined component enables by default. */
export const TEX_DEFAULT_PACKAGES = [
    'base',
    'ams',
    'newcommand',
    'textmacros',
    'noundefined',
    'require',
    'autoload',
    'configmacros',
] as const;

/** Extensions eXeLearning adds, mirroring `externalExtensions` in common.js. */
export const TEX_EXE_EXTENSIONS = [
    'amscd',
    'bbox',
    'begingroup',
    'boldsymbol',
    'braket',
    'bussproofs',
    'cancel',
    'cases',
    'centernot',
    'color',
    'colortbl',
    'colorv2',
    'dsfont',
    'empheq',
    'enclose',
    'extpfeil',
    'gensymb',
    'html',
    'mathtools',
    'mhchem',
    'noerrors',
    'physics',
    'setoptions',
    'tagformat',
    'texhtml',
    'textcomp',
    'unicode',
    'units',
    'upgreek',
    'verb',
] as const;

/** Everything the server-side pre-renderer enables, matching the browser. */
export const TEX_PACKAGES: string[] = [...TEX_DEFAULT_PACKAGES, ...TEX_EXE_EXTENSIONS];
