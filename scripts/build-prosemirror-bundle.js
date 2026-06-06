#!/usr/bin/env node
/**
 * Build script for prosemirror.bundle.js
 *
 * Uses esbuild to bundle ProseMirror and y-prosemirror for browser use.
 * Outputs an IIFE that exposes ProseMirrorBundle globally.
 *
 * IMPORTANT: Yjs is externalized because it's already loaded globally (window.Y)
 * by yjs.min.js. Including it again would cause "Yjs was already imported" errors.
 */
const esbuild = require('esbuild');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// Plugin to redirect yjs imports to global window.Y
const yjsGlobalPlugin = {
    name: 'yjs-global',
    setup(build) {
        // Mark yjs as external and provide a shim
        build.onResolve({ filter: /^yjs$/ }, args => {
            return { path: args.path, namespace: 'yjs-global' };
        });

        // Expose the COMPLETE globally-loaded Yjs (window.Y) as the 'yjs' module.
        //
        // y-prosemirror uses `import * as Y from 'yjs'` and references many Yjs
        // symbols (Doc, XmlFragment, createRelativePositionFromJSON,
        // compareRelativePositions, PermanentUserData, ...). Re-exporting a
        // hand-picked subset is fragile: any name we forget resolves to
        // `undefined` and crashes at runtime (e.g. yCursorPlugin throwing
        // "(void 0) is not a function" on every transaction/focus, which makes
        // the editor impossible to type in). A CommonJS `module.exports = window.Y`
        // exposes every symbol, so esbuild's interop maps `Y.<anything>` and
        // `import { X } from 'yjs'` to the real implementation.
        build.onLoad({ filter: /.*/, namespace: 'yjs-global' }, () => {
            return {
                contents: `
                    if (!window.Y) {
                        console.error('[ProseMirror] Yjs not found. Ensure yjs.min.js is loaded first.');
                    }
                    module.exports = window.Y;
                `,
                loader: 'js',
            };
        });

        // Also handle lib0 which is a yjs dependency
        build.onResolve({ filter: /^lib0/ }, args => {
            // Let lib0 be bundled normally - it's a utility library without duplication issues
            return null;
        });
    },
};

esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/shared/prosemirror/browser/index.ts')],
    bundle: true,
    outfile: path.join(projectRoot, 'public/libs/prosemirror/prosemirror.bundle.js'),
    format: 'iife',
    globalName: 'ProseMirrorBundle',
    platform: 'browser',
    plugins: [yjsGlobalPlugin],
    logLevel: 'info',
    // Minify for production but keep readable for debugging
    minify: false,
    sourcemap: false,
    // Define process.env for browser compatibility
    define: {
        'process.env.NODE_ENV': '"production"',
    },
}).then(() => {
    console.log('prosemirror.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
