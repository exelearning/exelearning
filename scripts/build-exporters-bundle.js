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
    // Production bundle: app.bundle.js is already minified; keeping this one
    // readable cost ~410 KB raw / ~100 KB compressed in every distribution.
    minify: true,
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
}).then(async () => {
    const printDir = path.join(projectRoot, 'public/app/common/exe_print');
    fs.mkdirSync(printDir, { recursive: true });
    fs.writeFileSync(path.join(printDir, 'frame.html'), '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
    await esbuild.build({
        entryPoints: {
            runtime: path.join(projectRoot, 'public/app/print/exportedPrintPreview.js'),
            frame: path.join(projectRoot, 'public/app/print/printFrame.js'),
        },
        outdir: printDir,
        bundle: true,
        minify: true,
        format: 'iife',
        platform: 'browser',
        plugins: [browserAliasPlugin],
        define: { 'process.env.APP_DEBUG': '"0"' },
    });
    const sass = require('sass');
    const css = sass.compile(path.join(projectRoot, 'assets/styles/print-preview.scss'), { style: 'compressed' }).css;
    const variables = sass.compile(path.join(projectRoot, 'assets/styles/abstracts/_variables.scss'), { style: 'compressed' }).css;
    fs.writeFileSync(path.join(printDir, 'preview.css'), variables.replace(':root', '.print-preview-overlay') + css);
    fs.copyFileSync(path.join(projectRoot, 'public/app/print/printButton.css'), path.join(printDir, 'button.css'));
    fs.mkdirSync(path.join(printDir, 'fonts'), { recursive: true });
    for (const weight of ['Regular', 'SemiBold', 'Bold']) {
        const name = `Catamaran-${weight}.woff2`;
        fs.copyFileSync(path.join(projectRoot, 'public/style/workarea/fonts', name), path.join(printDir, 'fonts', name));
    }
    // Collect the shared UI's source keys without extracting or changing translation catalogs.
    const strings = new Set();
    for (const file of ['modalPrintPreview.js', 'printPreviewShell.js']) {
        const source = fs.readFileSync(path.join(projectRoot, 'public/app/workarea/modals/modals/pages', file), 'utf8');
        for (const match of source.matchAll(/\b_\((['"])(.*?)\1\)/g)) strings.add(match[2]);
    }
    fs.writeFileSync(path.join(printDir, 'strings.json'), JSON.stringify([...strings]));
    for (const mirrorPath of mirrorOutputs) {
        const mirrorDir = path.dirname(mirrorPath);
        fs.mkdirSync(mirrorDir, { recursive: true });
        fs.copyFileSync(outputPath, mirrorPath);
        fs.cpSync(printDir, path.join(mirrorDir, '../common/exe_print'), { recursive: true });
    }
    console.log('exporters.bundle.js built successfully');
}).catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
