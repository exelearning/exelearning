#!/usr/bin/env node
/**
 * Build script for exporters.bundle.js
 *
 * Uses esbuild to bundle the TypeScript export system for browser use.
 * Uses a plugin to alias server-side modules to browser-compatible shims.
 */
const esbuild = require('esbuild');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

// Plugin to redirect server-side imports to browser shims
const browserAliasPlugin = {
    name: 'browser-alias',
    setup(build) {
        // Intercept imports of idevice-config
        build.onResolve({ filter: /idevice-config$/ }, (args) => {
            // Only redirect if coming from our source files
            if (args.importer.includes('src/shared/export') || args.importer.includes('src/services')) {
                return {
                    path: path.join(projectRoot, 'src/shared/export/browser/idevice-config-browser.ts'),
                };
            }
        });

        // Mark fs-extra as external (shouldn't be imported by browser code,
        // but just in case any transitive dependency tries)
        build.onResolve({ filter: /^fs-extra$/ }, () => {
            return { path: 'fs-extra', external: true };
        });

        build.onResolve({ filter: /^fs$/ }, () => {
            return { path: 'fs', external: true };
        });

        build.onResolve({ filter: /^path$/ }, () => {
            return { path: 'path', external: true };
        });
    },
};

esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/shared/export/browser/index.ts')],
    bundle: true,
    outfile: path.join(projectRoot, 'public/app/yjs/exporters.bundle.js'),
    format: 'iife',
    platform: 'browser',
    external: ['jszip'],
    plugins: [browserAliasPlugin],
    logLevel: 'info',
}).then(() => {
    console.log('exporters.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
