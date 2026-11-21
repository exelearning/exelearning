/**
 * Build script for the Slide iDevice editor bundle.
 *
 * Produces a single self-contained IIFE so the iDevice can be loaded
 * by the eXeLearning workarea via a plain <script> tag without any
 * module resolver. Fabric and DOMPurify are NOT inlined — they are
 * vendored separately under public/libs/ and exposed as window globals
 * (window.fabric, window.DOMPurify). The bridge in edition/slide.js
 * loads those libs lazily before this bundle.
 *
 * The bundle exposes window.__slideEditorInit.mount(container, opts).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { join, resolve } from 'path';

const root = resolve(import.meta.dir, '..', 'public/files/perm/idevices/base/slide');

const globalsPlugin: import('bun').BunPlugin = {
    name: 'slide-editor-globals',
    setup(build) {
        build.onResolve({ filter: /^fabric$/ }, () => ({ path: 'fabric', namespace: 'slide-globals' }));
        build.onResolve({ filter: /^dompurify$/ }, () => ({ path: 'dompurify', namespace: 'slide-globals' }));

        build.onLoad({ filter: /.*/, namespace: 'slide-globals' }, (args) => {
            if (args.path === 'fabric') {
                // `import * as fabric from 'fabric'` expects a namespace object.
                // Re-export every key of window.fabric so destructured/namespaced usage works.
                return {
                    contents: `
                        const __fabric = globalThis.fabric;
                        if (!__fabric) {
                            throw new Error('Slide editor: window.fabric is not loaded. Did you load libs/fabric/fabric.min.js first?');
                        }
                        module.exports = __fabric;
                    `,
                    loader: 'js',
                };
            }
            // dompurify: default export only
            return {
                contents: `
                    const __DOMPurify = globalThis.DOMPurify;
                    if (!__DOMPurify) {
                        throw new Error('Slide editor: window.DOMPurify is not loaded. Did you load libs/dompurify/purify.min.js first?');
                    }
                    module.exports = __DOMPurify;
                    module.exports.default = __DOMPurify;
                `,
                loader: 'js',
            };
        });
    },
};

// IIFE global name; omitted from Bun 1.4 BuildConfig types.
const buildOptions = {
    entrypoints: [join(root, 'src/index.ts')],
    outdir: join(root, 'edition'),
    naming: '[dir]/slide-editor.bundle.[ext]',
    format: 'iife',
    globalName: '__slideEditorInit',
    minify: true,
    target: 'browser',
    plugins: [globalsPlugin],
} as Bun.BuildConfig & { globalName: string };

const result = await Bun.build(buildOptions);

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
