#!/usr/bin/env node
/**
 * Build script for lexical-playground.bundle.js
 *
 * Uses esbuild to bundle the Lexical Playground React components for browser use.
 * Outputs an IIFE that exposes LexicalPlayground globally with mount/unmount functions.
 *
 * Dependencies:
 * - React and ReactDOM are externalized (loaded separately as UMD from window.React/ReactDOM)
 * - Yjs is externalized (loaded separately from window.Y)
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

// Plugin to redirect yjs imports to global window.Y
const yjsGlobalPlugin = {
    name: 'yjs-global',
    setup(build) {
        build.onResolve({ filter: /^yjs$/ }, args => {
            return { path: args.path, namespace: 'yjs-global' };
        });

        build.onLoad({ filter: /.*/, namespace: 'yjs-global' }, () => {
            return {
                contents: `
                    const Y = window.Y;
                    if (!Y) {
                        console.error('[LexicalPlayground] Yjs not found. Ensure yjs.min.js is loaded first.');
                    }
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
                    export const Item = Y?.Item;
                    export const ContentType = Y?.ContentType;
                    export const Transaction = Y?.Transaction;
                    export const AbstractStruct = Y?.AbstractStruct;
                    export const GC = Y?.GC;
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
    },
};

// Plugin to redirect React imports to global window.React/ReactDOM
const reactGlobalPlugin = {
    name: 'react-global',
    setup(build) {
        // React core
        build.onResolve({ filter: /^react$/ }, () => ({
            path: 'react',
            namespace: 'react-global'
        }));

        // React JSX runtime (for automatic JSX)
        build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
            path: 'react/jsx-runtime',
            namespace: 'react-jsx-global'
        }));

        // ReactDOM
        build.onResolve({ filter: /^react-dom$/ }, () => ({
            path: 'react-dom',
            namespace: 'react-dom-global'
        }));

        // ReactDOM/client (createRoot)
        build.onResolve({ filter: /^react-dom\/client$/ }, () => ({
            path: 'react-dom/client',
            namespace: 'react-dom-client-global'
        }));

        // React global shim
        build.onLoad({ filter: /.*/, namespace: 'react-global' }, () => ({
            contents: `
                const React = window.React;
                if (!React) {
                    console.error('[LexicalPlayground] React not found. Ensure react.min.js is loaded first.');
                }
                module.exports = React;
            `,
            loader: 'js',
        }));

        // JSX runtime shim
        build.onLoad({ filter: /.*/, namespace: 'react-jsx-global' }, () => ({
            contents: `
                const React = window.React;
                export const jsx = React?.createElement;
                export const jsxs = React?.createElement;
                export const Fragment = React?.Fragment;
            `,
            loader: 'js',
        }));

        // ReactDOM shim
        build.onLoad({ filter: /.*/, namespace: 'react-dom-global' }, () => ({
            contents: `
                const ReactDOM = window.ReactDOM;
                if (!ReactDOM) {
                    console.error('[LexicalPlayground] ReactDOM not found. Ensure react-dom.min.js is loaded first.');
                }
                module.exports = ReactDOM;
            `,
            loader: 'js',
        }));

        // ReactDOM/client shim
        build.onLoad({ filter: /.*/, namespace: 'react-dom-client-global' }, () => ({
            contents: `
                const ReactDOM = window.ReactDOM;
                export const createRoot = ReactDOM?.createRoot;
                export const hydrateRoot = ReactDOM?.hydrateRoot;
            `,
            loader: 'js',
        }));
    },
};

// Plugin to handle CSS imports
const cssPlugin = {
    name: 'css-loader',
    setup(build) {
        build.onLoad({ filter: /\.css$/ }, async (args) => {
            const css = await fs.promises.readFile(args.path, 'utf8');
            // Return CSS as a string that can be injected
            return {
                contents: `
                    const style = document.createElement('style');
                    style.textContent = ${JSON.stringify(css)};
                    document.head.appendChild(style);
                    export default ${JSON.stringify(css)};
                `,
                loader: 'js',
            };
        });
    },
};

const entryPoint = path.join(projectRoot, 'src/shared/lexical-playground/index.tsx');

// Check if entry point exists
if (!fs.existsSync(entryPoint)) {
    console.error(`Entry point not found: ${entryPoint}`);
    console.error('Please create the lexical-playground source files first.');
    process.exit(1);
}

esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    outfile: path.join(projectRoot, 'public/libs/lexical/lexical-playground.bundle.js'),
    format: 'iife',
    globalName: 'LexicalPlayground',
    platform: 'browser',
    plugins: [yjsGlobalPlugin, reactGlobalPlugin, cssPlugin],
    loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.svg': 'text',
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.gif': 'dataurl',
    },
    jsx: 'automatic',
    jsxImportSource: 'react',
    minify: false, // Keep readable for debugging, enable in production
    sourcemap: false,
    treeShaking: true,
    define: {
        'process.env.NODE_ENV': '"production"',
        '__DEV__': 'false',
    },
    // Resolve paths
    alias: {
        '@': path.join(projectRoot, 'src/shared/lexical-playground'),
    },
    logLevel: 'info',
}).then(() => {
    console.log('lexical-playground.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
