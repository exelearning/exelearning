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

        // Return code that uses window.Y
        build.onLoad({ filter: /.*/, namespace: 'yjs-global' }, () => {
            return {
                contents: `
                    // Use globally loaded Yjs from window.Y
                    const Y = window.Y;
                    if (!Y) {
                        console.error('[ProseMirror] Yjs not found. Ensure yjs.min.js is loaded first.');
                    }
                    // Public API exports
                    export const Doc = Y?.Doc;
                    export const Map = Y?.Map;
                    export const Array = Y?.Array;
                    export const Text = Y?.Text;
                    export const XmlFragment = Y?.XmlFragment;
                    export const XmlElement = Y?.XmlElement;
                    export const XmlText = Y?.XmlText;
                    export const UndoManager = Y?.UndoManager;
                    export const createAbsolutePositionFromRelativePosition = Y?.createAbsolutePositionFromRelativePosition;
                    export const createRelativePositionFromTypeIndex = Y?.createRelativePositionFromTypeIndex;
                    export const encodeStateAsUpdate = Y?.encodeStateAsUpdate;
                    export const applyUpdate = Y?.applyUpdate;
                    export const Snapshot = Y?.Snapshot;
                    export const snapshot = Y?.snapshot;
                    export const isDeleted = Y?.isDeleted;
                    export const isParentOf = Y?.isParentOf;
                    export const equalSnapshots = Y?.equalSnapshots;
                    export const AbstractType = Y?.AbstractType;
                    export const RelativePosition = Y?.RelativePosition;
                    // Internal exports used by y-prosemirror
                    export const Item = Y?.Item;
                    export const ContentType = Y?.ContentType;
                    export const Transaction = Y?.Transaction;
                    export const AbstractStruct = Y?.AbstractStruct;
                    export const GC = Y?.GC;
                    export default Y;
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
