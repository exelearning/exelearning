/**
 * Build script for the mind map editor of the exemindmap TinyMCE plugin.
 *
 * Bundles editor/src/editor.ts with Mind Elixir and @erseco/mind-elixir-export-svg
 * (both pinned in package.json), and the Material Symbols icons it uses, into a
 * self-contained IIFE and one stylesheet, so the editor iframe loads two local files and
 * nothing from the network:
 *
 *   editor/mindmap-editor.bundle.js
 *   editor/mindmap-editor.bundle.css
 *
 * Both are generated (gitignored) by build:all, like the other bundles in public/.
 */

import { join, resolve } from 'path';

const editorDir = resolve(import.meta.dir, '..', 'public/libs/tinymce_5/js/tinymce/plugins/exemindmap/editor');

const result = await Bun.build({
    entrypoints: [join(editorDir, 'src/editor.ts')],
    outdir: editorDir,
    naming: 'mindmap-editor.bundle.[ext]',
    format: 'iife',
    minify: true,
    target: 'browser',
    // Icons are inlined as SVG markup
    loader: { '.svg': 'text' },
});

if (!result.success) {
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

console.log('Mind map editor bundle built:');
for (const out of result.outputs) {
    console.log(`  ${out.path} (${out.size} bytes)`);
}
