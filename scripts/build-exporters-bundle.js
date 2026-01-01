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
            // Normalize path separators for Windows compatibility
            const normalizedPath = args.importer.replace(/\\/g, '/');
            // Only redirect if coming from our source files
            if (normalizedPath.includes('src/shared/export') || normalizedPath.includes('src/services')) {
                return {
                    path: path.join(projectRoot, 'src/shared/export/browser/idevice-config-browser.ts'),
                };
            }
        });

        // Intercept imports of our internal xml-parser module (uses fs-extra which doesn't work in browser)
        // Note: Use specific pattern to avoid matching npm packages like 'fast-xml-parser'
        build.onResolve({ filter: /services\/xml\/xml-parser$/ }, (args) => {
            // Normalize path separators for Windows compatibility
            const normalizedPath = args.importer.replace(/\\/g, '/');
            if (normalizedPath.includes('src/shared/export') || normalizedPath.includes('src/services')) {
                return {
                    path: path.join(projectRoot, 'src/shared/export/browser/xml-validator-shim.ts'),
                };
            }
        });

        // Redirect fs-extra to browser shim (used by xml-builder.ts which is imported by YjsDocumentAdapter)
        build.onResolve({ filter: /^fs-extra$/ }, () => {
            return {
                path: path.join(projectRoot, 'src/shared/export/browser/fs-extra-shim.ts'),
            };
        });

        build.onResolve({ filter: /^fs$/ }, () => {
            return { path: 'fs', external: true };
        });

        // Redirect path to browser shim (used by xml-builder.ts)
        build.onResolve({ filter: /^path$/ }, () => {
            return {
                path: path.join(projectRoot, 'src/shared/export/browser/path-shim.ts'),
            };
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
    // Replace Node.js environment variables with browser-safe values
    define: {
        'process.env.APP_DEBUG': '"0"',
    },
}).then(() => {
    console.log('exporters.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
