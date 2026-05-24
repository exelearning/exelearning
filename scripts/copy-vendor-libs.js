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
const nm = (p) => path.join(ROOT, 'node_modules', p);

/** Resolve a path relative to public/. */
const pub = (p) => path.join(ROOT, 'public', p);

const createdDirs = new Set();

/**
 * Copy a single file. Creates destination directory if needed (once per dir).
 * Exits with an error if source does not exist or cannot be read.
 */
function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!createdDirs.has(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        createdDirs.add(destDir);
    }
    try {
        fs.copyFileSync(src, dest);
    } catch (err) {
        console.error(`ERROR: could not copy ${src}: ${err.message}`);
        process.exit(1);
    }
    console.log(`  ✓ ${path.relative(ROOT, dest)}`);
}

const COPIES = [
    // pdfjs-dist: two ESM module files (worker must live alongside the main file)
    { src: nm('pdfjs-dist/build/pdf.min.mjs'),        dest: pub('libs/pdfjs/pdf.min.mjs') },
    { src: nm('pdfjs-dist/build/pdf.worker.min.mjs'), dest: pub('libs/pdfjs/pdf.worker.min.mjs') },

    // mermaid: single minified bundle
    { src: nm('mermaid/dist/mermaid.min.js'), dest: pub('app/common/mermaid/mermaid.min.js') },

    // jquery 3.x
    { src: nm('jquery/dist/jquery.min.js'), dest: pub('libs/jquery/jquery.min.js') },

    // bootstrap (bundle includes Popper.js)
    { src: nm('bootstrap/dist/js/bootstrap.bundle.min.js'),     dest: pub('libs/bootstrap/bootstrap.bundle.min.js') },
    { src: nm('bootstrap/dist/js/bootstrap.bundle.min.js.map'), dest: pub('libs/bootstrap/bootstrap.bundle.min.js.map') },
    { src: nm('bootstrap/dist/css/bootstrap.min.css'),          dest: pub('libs/bootstrap/bootstrap.min.css') },
    { src: nm('bootstrap/dist/css/bootstrap.min.css.map'),      dest: pub('libs/bootstrap/bootstrap.min.css.map') },

    // showdown
    { src: nm('showdown/dist/showdown.min.js'), dest: pub('libs/showdown/showdown.min.js') },

    // fflate UMD build
    { src: nm('fflate/umd/index.js'), dest: pub('libs/fflate/fflate.umd.js') },

    // abcjs (basic build — no audio, smaller footprint)
    { src: nm('abcjs/dist/abcjs-basic-min.js'), dest: pub('libs/abcjs/abcjs-basic-min.js') },

    // html2canvas — duplicated in two iDevices; both get the same file
    { src: nm('html2canvas/dist/html2canvas.min.js'), dest: pub('files/perm/idevices/base/progress-report/export/html2canvas.js') },
    { src: nm('html2canvas/dist/html2canvas.min.js'), dest: pub('files/perm/idevices/base/checklist/export/html2canvas.js') },

    // DOMPurify (embedded inside edicuatex)
    { src: nm('dompurify/dist/purify.min.js'), dest: pub('app/common/edicuatex/js/DOMPurify/purify.min.js') },

    // DOMPurify (slide iDevice — loaded lazily by edition/slide.js before the editor bundle)
    { src: nm('dompurify/dist/purify.min.js'), dest: pub('libs/dompurify/purify.min.js') },

    // fabric (slide iDevice — UMD that exposes window.fabric; the editor bundle uses
    // a shim plugin to reach it as a global instead of inlining the library)
    { src: nm('fabric/dist/index.min.js'), dest: pub('libs/fabric/fabric.min.js') },

    // interact.js (interactjs npm package provides the full minified bundle)
    { src: nm('interactjs/dist/interact.min.js'),     dest: pub('libs/interact/interact.min.js') },
    { src: nm('interactjs/dist/interact.min.js.map'), dest: pub('libs/interact/interact.min.js.map') },

    // jquery-ui
    { src: nm('jquery-ui/dist/jquery-ui.min.js'),              dest: pub('libs/jquery-ui/jquery-ui.min.js') },
    { src: nm('jquery-ui/dist/themes/base/jquery-ui.min.css'), dest: pub('libs/jquery-ui/jquery-ui.min.css') },

    // simplelightbox — only min.js and min.css are referenced (from public/libs/simplelightbox/dist/)
    // and from image-gallery iDevice export directory
    { src: nm('simplelightbox/dist/simple-lightbox.min.js'),  dest: pub('libs/simplelightbox/dist/simple-lightbox.min.js') },
    { src: nm('simplelightbox/dist/simple-lightbox.min.css'), dest: pub('libs/simplelightbox/dist/simple-lightbox.min.css') },
    { src: nm('simplelightbox/dist/simple-lightbox.min.js'),  dest: pub('files/perm/idevices/base/image-gallery/export/simple-lightbox.min.js') },
    { src: nm('simplelightbox/dist/simple-lightbox.min.css'), dest: pub('files/perm/idevices/base/image-gallery/export/simple-lightbox.min.css') },
];

console.log('Copying vendor libs from node_modules...');
for (const { src, dest } of COPIES) {
    copyFile(src, dest);
}
console.log('Done.');
