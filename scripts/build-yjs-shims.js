#!/usr/bin/env node
/**
 * Build Yjs browser shims using esbuild.
 *
 * Produces three files under public/libs/yjs/:
 *   yjs.min.js          — Yjs bundled as an IIFE, assigns window.Y
 *   y-websocket.min.js  — WebsocketProvider bundled with Yjs aliased to window.Y
 *   y-indexeddb.min.js  — Minified hand-written IndexedDB persistence (y-indexeddb-browser.js)
 *
 * Run as part of bundle:vendor (before bundle:resources).
 * Do not edit the output files directly; update the source and re-run this script.
 */

'use strict';

const { buildSync } = require('esbuild');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'public/libs/yjs/build');
const OUT_DIR = path.join(ROOT, 'public/libs/yjs');

// yjs.min.js — bundle yjs as an IIFE that assigns window.Y.
// stdin lets us avoid committing a one-liner entry file.
console.log('Building yjs.min.js...');
buildSync({
    stdin: {
        contents: "const Y = require('yjs'); window.Y = Y; console.log('[Yjs] Library loaded, window.Y available');",
        resolveDir: ROOT,
        loader: 'js',
    },
    outfile: path.join(OUT_DIR, 'yjs.min.js'),
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'iife',
});
console.log('  ✓ yjs.min.js');

// y-websocket.min.js — alias 'yjs' → yjs-global-shim.js so WebsocketProvider
// shares the same Yjs instance as window.Y.
console.log('Building y-websocket.min.js...');
buildSync({
    entryPoints: [path.join(BUILD_DIR, 'y-websocket-entry.js')],
    outfile: path.join(OUT_DIR, 'y-websocket.min.js'),
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'iife',
    alias: {
        yjs: path.join(BUILD_DIR, 'yjs-global-shim.js'),
    },
});
console.log('  ✓ y-websocket.min.js');

// y-indexeddb.min.js — minify the hand-written IIFE (uses window.Y, no bundling needed).
console.log('Building y-indexeddb.min.js...');
buildSync({
    entryPoints: [path.join(BUILD_DIR, 'y-indexeddb-browser.js')],
    outfile: path.join(OUT_DIR, 'y-indexeddb.min.js'),
    bundle: false,
    minify: true,
    platform: 'browser',
});
console.log('  ✓ y-indexeddb.min.js');

console.log('Yjs shims built successfully.');
