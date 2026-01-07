#!/usr/bin/env node
/**
 * Build script for lexical.bundle.js
 *
 * Uses esbuild to bundle Lexical and @lexical/yjs for browser use.
 * Outputs an IIFE that exposes LexicalBundle globally.
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
                        console.error('[Lexical] Yjs not found. Ensure yjs.min.js is loaded first.');
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
                    // Internal exports used by @lexical/yjs
                    export const Item = Y?.Item;
                    export const ContentType = Y?.ContentType;
                    export const Transaction = Y?.Transaction;
                    export const AbstractStruct = Y?.AbstractStruct;
                    export const GC = Y?.GC;
                    // Additional exports required by @lexical/yjs
                    export const typeListToArraySnapshot = Y?.typeListToArraySnapshot;
                    export const XmlHook = Y?.XmlHook;
                    export const ContentString = Y?.ContentString;
                    export const ContentFormat = Y?.ContentFormat;
                    export const emptySnapshot = Y?.emptySnapshot;
                    export const PermanentUserData = Y?.PermanentUserData;
                    export const iterateDeletedStructs = Y?.iterateDeletedStructs;
                    export const compareRelativePositions = Y?.compareRelativePositions;
                    export const YMapEvent = Y?.YMapEvent;
                    export const YTextEvent = Y?.YTextEvent;
                    export const YXmlEvent = Y?.YXmlEvent;
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
    entryPoints: [path.join(projectRoot, 'src/shared/lexical/browser/index.ts')],
    bundle: true,
    outfile: path.join(projectRoot, 'public/libs/lexical/lexical.bundle.js'),
    format: 'iife',
    globalName: 'LexicalBundle',
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
    console.log('lexical.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
