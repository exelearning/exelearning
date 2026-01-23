#!/usr/bin/env node
/**
 * Build script for importers.bundle.js
 *
 * Uses esbuild to bundle the TypeScript import system for browser use.
 * This bundles the legacy iDevice handlers from src/shared/import/legacy-handlers/
 * for use in the browser when parsing legacy ELP files (contentv3.xml).
 */
const esbuild = require('esbuild');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

esbuild.build({
    entryPoints: [path.join(projectRoot, 'src/shared/import/browser/index.ts')],
    bundle: true,
    outfile: path.join(projectRoot, 'public/app/yjs/importers.bundle.js'),
    format: 'iife',
    platform: 'browser',
    logLevel: 'info',
    // No external modules needed - the handlers are pure TypeScript
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
