#!/usr/bin/env node
/**
 * Build script for exporters.bundle.js
 *
 * Uses esbuild to bundle the TypeScript export system for browser use.
 * Uses a plugin to alias server-side modules to browser-compatible shims.
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

/**
 * Check if import comes from our source files (for selective redirects)
 */
function isFromSourceFiles(importer) {
    // Normalize path separators for Windows compatibility
    const normalized = importer.replace(/\\/g, '/');
    return normalized.includes('src/shared/export') || normalized.includes('src/services');
}

// Plugin to redirect server-side imports to browser shims
const browserAliasPlugin = {
    name: 'browser-alias',
    setup(build) {
        // Redirect idevice-config to browser version
        build.onResolve({ filter: /idevice-config$/ }, (args) => {
            if (isFromSourceFiles(args.importer)) {
                return { path: path.join(projectRoot, 'src/shared/export/browser/idevice-config-browser.ts') };
            }
        });

        // Redirect xml-parser to browser shim (uses fs-extra which doesn't work in browser)
        // Note: Use specific pattern to avoid matching npm packages like 'fast-xml-parser'
        build.onResolve({ filter: /services\/xml\/xml-parser$/ }, (args) => {
            if (isFromSourceFiles(args.importer)) {
                return { path: path.join(projectRoot, 'src/shared/export/browser/xml-validator-shim.ts') };
            }
        });

        // Redirect translation service to browser shim (uses fs/path for XLF file reading)
        build.onResolve({ filter: /services\/translation$/ }, (args) => {
            if (isFromSourceFiles(args.importer)) {
                return { path: path.join(projectRoot, 'src/shared/export/browser/translation-shim.ts') };
            }
        });
    },
};

const outputPath = path.join(projectRoot, 'public/app/yjs/exporters.bundle.js');
const mirrorOutputs = [
    path.join(projectRoot, 'dist/static/app/yjs/exporters.bundle.js'),
    path.join(projectRoot, 'app/dist/static/app/yjs/exporters.bundle.js'),
];

esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/shared/export/browser/index.ts')],
    bundle: true,
    outfile: outputPath,
    format: 'iife',
    platform: 'browser',
    plugins: [browserAliasPlugin],
    // Node.js-only modules - mark as external (not used in browser bundle)
    external: ['fs', 'fs-extra', 'path'],
    logLevel: 'info',
    define: {
        'process.env.APP_DEBUG': '"0"',
    },
}).then(() => {
    for (const mirrorPath of mirrorOutputs) {
        const mirrorDir = path.dirname(mirrorPath);
        fs.mkdirSync(mirrorDir, { recursive: true });
        fs.copyFileSync(outputPath, mirrorPath);
    }
    console.log('exporters.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
