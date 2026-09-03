#!/usr/bin/env node
/**
 * Copy frontend library distributions from node_modules to public/.
 *
 * Run as part of bundle:vendor (before bundle:resources, which packages public/libs/).
 * Libraries listed here are managed via package.json.
 * Do NOT edit destination files directly — update the npm package version instead.
 *
 * MathJax (mathjax-full) is intentionally excluded:
 *   public/app/common/exe_math/ is a customized subset that mixes files from different
 *   sources (MathJax 3.x + 4.x extensions, extra adaptors, SRE mathmaps).
 *   It requires a dedicated migration — see the migration plan for details.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Resolve a path relative to node_modules root. */
const nm = p => path.join(ROOT, 'node_modules', p);

/** Resolve a path relative to public/. */
const pub = p => path.join(ROOT, 'public', p);

const createdDirs = new Set();

/** Reset the per-directory cache (used by tests so each run starts clean). */
function resetCreatedDirs() {
    createdDirs.clear();
}

/**
 * Copy a single file. Creates destination directory if needed (once per dir).
 * Throws if source does not exist or cannot be read; the CLI wrapper (run)
 * turns that into a non-zero exit. Throwing (rather than calling process.exit
 * inline) keeps the error path unit-testable.
 */
/**
 * Remove `sourceMappingURL` announcements. Same matchers as
 * scripts/static-bundle/strip-source-map-refs.ts — the `m` flag is load-bearing
 * because `$` without it misses files that end with a newline.
 *
 * Applied to the Bootstrap dist copies because exports and the resource bundle
 * read those files directly (#2260). Shipping the npm comment would 404 every
 * exported package the moment DevTools opens.
 */
const MAP_FILE_COMMENT =
    /(?:\/\/[@#][ \t]+?sourceMappingURL=([^\s'"`]+?)[ \t]*?$)|(?:\/\*[@#][ \t]+sourceMappingURL=([^*]+?)[ \t]*?(?:\*\/){1}[ \t]*?$)/gm;
const INLINE_COMMENT =
    /^\s*?\/[\/*][@#]\s+?sourceMappingURL=data:(((?:application|text)\/json)(?:;charset=([^;,]+?)?)?)?(?:;(base64))?,(.*?)$/gm;

function stripSourceMappingUrl(content) {
    return content.replace(INLINE_COMMENT, '').replace(MAP_FILE_COMMENT, '');
}

function copyFile(src, dest, options = {}) {
    const destDir = path.dirname(dest);
    if (!createdDirs.has(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        createdDirs.add(destDir);
    }
    try {
        fs.copyFileSync(src, dest);
        if (options.stripSourceMap) {
            const original = fs.readFileSync(dest, 'utf8');
            const stripped = stripSourceMappingUrl(original);
            if (stripped !== original) {
                fs.writeFileSync(dest, stripped);
            }
        }
    } catch (err) {
        throw new Error(`could not copy ${src}: ${err.message}`);
    }
    console.log(`  ✓ ${path.relative(ROOT, dest)}`);
}

/**
 * Append `content` to a file already produced by copyFile. Throws (rather than
 * calling process.exit) so the CLI wrapper turns failures into a non-zero exit
 * while keeping the error path unit-testable.
 */
function appendFile(dest, content) {
    try {
        fs.appendFileSync(dest, content);
    } catch (err) {
        throw new Error(`could not append to ${dest}: ${err.message}`);
    }
    console.log(`  ✎ ${path.relative(ROOT, dest)}`);
}

/** Copy every entry in COPIES, then re-apply local overrides. Throws on the first failure. */
function run() {
    console.log('Copying vendor libs from node_modules...');
    for (const { src, dest, stripSourceMap } of COPIES) {
        copyFile(src, dest, { stripSourceMap });
    }
    for (const { dest, content } of APPENDS) {
        appendFile(dest, content);
    }
    console.log('Done.');
}

const COPIES = [
    // pdfjs-dist ships ESM as .mjs; copy to .js so nginx/static hosts serve
    // text/javascript instead of application/octet-stream (see #2254).
    { src: nm('pdfjs-dist/build/pdf.min.mjs'), dest: pub('libs/pdfjs/pdf.min.js') },
    { src: nm('pdfjs-dist/build/pdf.worker.min.mjs'), dest: pub('libs/pdfjs/pdf.worker.min.js') },

    // mermaid: single minified bundle
    { src: nm('mermaid/dist/mermaid.min.js'), dest: pub('app/common/mermaid/mermaid.min.js') },

    // jquery 3.x
    { src: nm('jquery/dist/jquery.min.js'), dest: pub('libs/jquery/jquery.min.js') },

    // bootstrap (bundle includes Popper.js). stripSourceMap: exports and the
    // resource bundle read these files as-is (#2260); the npm dist still
    // announces maps we do not ship in BASE_LIBS.
    {
        src: nm('bootstrap/dist/js/bootstrap.bundle.min.js'),
        dest: pub('libs/bootstrap/bootstrap.bundle.min.js'),
        stripSourceMap: true,
    },
    {
        src: nm('bootstrap/dist/js/bootstrap.bundle.min.js.map'),
        dest: pub('libs/bootstrap/bootstrap.bundle.min.js.map'),
    },
    {
        src: nm('bootstrap/dist/css/bootstrap.min.css'),
        dest: pub('libs/bootstrap/bootstrap.min.css'),
        stripSourceMap: true,
    },
    { src: nm('bootstrap/dist/css/bootstrap.min.css.map'), dest: pub('libs/bootstrap/bootstrap.min.css.map') },

    // showdown
    { src: nm('showdown/dist/showdown.min.js'), dest: pub('libs/showdown/showdown.min.js') },

    // fflate UMD build
    { src: nm('fflate/umd/index.js'), dest: pub('libs/fflate/fflate.umd.js') },

    // abcjs (basic build — no audio, smaller footprint)
    { src: nm('abcjs/dist/abcjs-basic-min.js'), dest: pub('libs/abcjs/abcjs-basic-min.js') },

    // html2canvas — duplicated across three iDevices; all get the same file.
    // The rubric copy is the one loaded at runtime by YjsProjectBridge.js and rubric.js.
    {
        src: nm('html2canvas/dist/html2canvas.min.js'),
        dest: pub('files/perm/idevices/base/progress-report/export/html2canvas.js'),
    },
    {
        src: nm('html2canvas/dist/html2canvas.min.js'),
        dest: pub('files/perm/idevices/base/checklist/export/html2canvas.js'),
    },
    {
        src: nm('html2canvas/dist/html2canvas.min.js'),
        dest: pub('files/perm/idevices/base/rubric/export/html2canvas.js'),
    },

    // DOMPurify (embedded inside edicuatex)
    { src: nm('dompurify/dist/purify.min.js'), dest: pub('app/common/edicuatex/js/DOMPurify/purify.min.js') },

    // DOMPurify (slide iDevice — loaded lazily by edition/slide.js before the editor bundle)
    { src: nm('dompurify/dist/purify.min.js'), dest: pub('libs/dompurify/purify.min.js') },

    // fabric (slide iDevice — UMD that exposes window.fabric; the editor bundle uses
    // a shim plugin to reach it as a global instead of inlining the library)
    { src: nm('fabric/dist/index.min.js'), dest: pub('libs/fabric/fabric.min.js') },

    // interact.js (interactjs npm package provides the full minified bundle)
    { src: nm('interactjs/dist/interact.min.js'), dest: pub('libs/interact/interact.min.js') },
    { src: nm('interactjs/dist/interact.min.js.map'), dest: pub('libs/interact/interact.min.js.map') },

    // jquery-ui
    { src: nm('jquery-ui/dist/jquery-ui.min.js'), dest: pub('libs/jquery-ui/jquery-ui.min.js') },
    { src: nm('jquery-ui/dist/themes/base/jquery-ui.min.css'), dest: pub('libs/jquery-ui/jquery-ui.min.css') },

    // simplelightbox — only min.js and min.css are referenced (from public/libs/simplelightbox/dist/)
    // and from image-gallery iDevice export directory
    {
        src: nm('simplelightbox/dist/simple-lightbox.min.js'),
        dest: pub('libs/simplelightbox/dist/simple-lightbox.min.js'),
    },
    {
        src: nm('simplelightbox/dist/simple-lightbox.min.css'),
        dest: pub('libs/simplelightbox/dist/simple-lightbox.min.css'),
    },
    {
        src: nm('simplelightbox/dist/simple-lightbox.min.js'),
        dest: pub('files/perm/idevices/base/image-gallery/export/simple-lightbox.min.js'),
    },
    {
        src: nm('simplelightbox/dist/simple-lightbox.min.css'),
        dest: pub('files/perm/idevices/base/image-gallery/export/simple-lightbox.min.css'),
    },
];

/**
 * Local CSS override for simplelightbox (marker: SDWEB). The npm distribution
 * does not carry it, so it is re-appended to every generated
 * simple-lightbox.min.css after the pristine file is copied. Without this the
 * override — aqua links plus caption/license padding — is lost on every rebuild,
 * so exported image galleries silently drop those styles. copyFile truncates the
 * destination first, so a rebuild always ends with exactly one override block.
 */
const SIMPLELIGHTBOX_CSS_OVERRIDE =
    '\n/* +++++ SDWEB +++++ */' +
    '.sl-wrapper a{color:aqua}' +
    '.sl-wrapper a{padding-right:10px}' +
    '.sl-wrapper span{padding-right:10px}' +
    '.sl-wrapper .license,.sl-wrapper .license a,.sl-wrapper .custom-license,.sl-wrapper .custom-license a{padding-right:0}' +
    '/* +++++++++++++++++ */\n';

const APPENDS = [
    { dest: pub('libs/simplelightbox/dist/simple-lightbox.min.css'), content: SIMPLELIGHTBOX_CSS_OVERRIDE },
    {
        dest: pub('files/perm/idevices/base/image-gallery/export/simple-lightbox.min.css'),
        content: SIMPLELIGHTBOX_CSS_OVERRIDE,
    },
];

// Exported for unit testing. The CLI entry point runs below.
module.exports = {
    APPENDS,
    COPIES,
    SIMPLELIGHTBOX_CSS_OVERRIDE,
    appendFile,
    copyFile,
    resetCreatedDirs,
    run,
    stripSourceMappingUrl,
};

// Run only when executed directly (not when imported by a test).
if (require.main === module) {
    try {
        run();
    } catch (err) {
        console.error(`ERROR: ${err.message}`);
        process.exit(1);
    }
}
