/**
 * Build script for the Slide iDevice editor bundle.
 *
 * Produces a single self-contained IIFE so the iDevice can be loaded
 * by the eXeLearning workarea via a plain <script> tag without any
 * module resolver. Both fabric and dompurify are inlined.
 *
 * The bundle exposes window.__slideEditorInit.mount(container, opts).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { join } from 'path';

const root = join(import.meta.dir, '..');

const result = await Bun.build({
    entrypoints: [join(root, 'src/index.ts')],
    outdir: join(root, 'edition'),
    naming: '[dir]/slide-editor.bundle.[ext]',
    format: 'iife',
    globalName: '__slideEditorInit',
    minify: true,
    target: 'browser',
});

if (!result.success) {
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

console.log('Slide editor bundle built:');
for (const out of result.outputs) {
    console.log('  ' + out.path);
}
