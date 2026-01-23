#!/usr/bin/env node
/**
 * Build script for importers.bundle.js
 *
 * Uses esbuild to bundle the TypeScript import system for browser use.
 * This bundles the legacy iDevice handlers from src/shared/import/legacy-handlers/
 * for use in the browser when parsing legacy ELP files (contentv3.xml).
 *
 * IMPORTANT: Yjs is marked as external and uses window.Y to avoid the
 * "Yjs was already imported" error. The main app loads Yjs from yjs.min.js
 * which exports to window.Y, so we must use the same instance.
 */
const esbuild = require('esbuild');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Plugin to replace 'yjs' imports with window.Y
 * This ensures the bundle uses the same Yjs instance as the main application
 */
const yjsExternalPlugin = {
    name: 'yjs-external',
    setup(build) {
        // Intercept imports of 'yjs' and redirect to our shim
        build.onResolve({ filter: /^yjs$/ }, (args) => {
            return { path: args.path, namespace: 'yjs-shim' };
        });

        // Return the shim that uses window.Y
        build.onLoad({ filter: /.*/, namespace: 'yjs-shim' }, () => {
            return {
                contents: `
                    // Use the global Yjs instance loaded by yjs-loader.js
                    const Y = window.Y;
                    export default Y;
                    export const Doc = Y.Doc;
                    export const Map = Y.Map;
                    export const Array = Y.Array;
                    export const Text = Y.Text;
                    export const XmlFragment = Y.XmlFragment;
                    export const XmlElement = Y.XmlElement;
                    export const XmlText = Y.XmlText;
                    export const createAbsolutePositionFromRelativePosition = Y.createAbsolutePositionFromRelativePosition;
                    export const createRelativePositionFromTypeIndex = Y.createRelativePositionFromTypeIndex;
                    export const encodeStateAsUpdate = Y.encodeStateAsUpdate;
                    export const applyUpdate = Y.applyUpdate;
                `,
                loader: 'js',
            };
        });
    },
};

esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/shared/import/browser/index.ts')],
    bundle: true,
    outfile: path.join(projectRoot, 'public/app/yjs/importers.bundle.js'),
    format: 'iife',
    platform: 'browser',
    logLevel: 'info',
    plugins: [yjsExternalPlugin],
    // Replace Node.js environment variables with browser-safe values
    define: {
        'process.env.APP_DEBUG': '"0"',
    },
}).then(() => {
    console.log('importers.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
